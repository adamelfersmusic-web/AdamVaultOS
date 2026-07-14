// CRAFT PHASE B — LIVE CHECKBOXES. Every `- [ ]` line inside an ordinary
// note is system-visible: surfaced on the Tasks tab, checkable from anywhere.
//
// THE LAW — NO DUAL BOOKKEEPING: a task's state lives in the LINE or in a
// ROW (a tasks/* note), NEVER both. Loose lines are surfaced and toggled in
// place — the byte between the brackets is the single source of truth.
// PROMOTION transfers ownership: the row is minted, and the source line
// becomes a pointer (`- ➜ [[<row path>]]`) — it stops being a checkbox, so
// the two truths can never fork.
//
// This module is pure (scan + line mutations). The vault writes live in
// lib/store.ts (toggleLooseTask / promoteLooseTask), on surgicalLineEdit —
// only the intended line ever changes; every other byte survives.

import type { Note } from '../lib/types'
import { titleFromPath } from '../lib/format'

export interface LooseTask {
  notePath: string
  noteTitle: string
  lineIndex: number
  /** The exact source line, byte-for-byte — the write's precondition. */
  raw: string
  /** Display text: the line's text with any trailing 📅 token stripped. */
  text: string
  checked: boolean
  /** Inline due — the trailing `📅 YYYY-MM-DD` token, when present. */
  due?: string
}

/** A checkbox line: `- [ ] text` / `- [x] text`, any leading indent. */
const CHECKBOX_RE = /^(\s*)- \[( |x|X)\] (.+)$/
/** The inline due: a trailing `📅 YYYY-MM-DD` token — exactly that shape,
 * no NLP. Requires text before it so a bare-date line stays literal. */
const DUE_RE = /^(.*\S)\s+📅 (\d{4}-\d{2}-\d{2})$/
/** A fence delimiter — checkboxes inside code blocks are quotation, not work. */
const FENCE_RE = /^\s*(```|~~~)/

/** Think-space only: surfaces that already own their task machinery (or are
 * sacred) never surface loose lines here. One rule per entry. */
export const EXCLUDES: ReadonlyArray<(n: Note) => boolean> = [
  (n) => n.path.startsWith('tasks/'), // already rows — the Tracker owns them
  (n) => n.path.startsWith('desk/weekly/'), // the weekly review + its template have their own surfaces
  (n) => /^projects\/[^/]+\/weekly\//.test(n.path), // Top 3 weekly cards carry the verb widgets
  (n) => n.path.startsWith('desk/00-sweep'), // janitor proposals are suggestions, not commitments
  (n) => n.path.startsWith('desk/shelves'), // the shelves layout note is app plumbing
  (n) => n.metadata?.['locked'] === true, // the sacred handful stays untouched
]

/** Display title — the note's first heading, else the de-slugged path
 * (the Omnibar's own rule). */
function noteTitleOf(n: Note): string {
  const m = (n.content ?? '').match(/^\s{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/m)
  if (m?.[1]) {
    const t = m[1].replace(/[*_`#]+/g, '').trim()
    if (t) return t
  }
  return titleFromPath(n.path)
}

/**
 * Scan a corpus for loose checkbox lines. Checked lines are returned too —
 * the toggle needs both directions — but only unchecked ones belong on
 * lists. Notes without content (lean shapes) are skipped, never guessed at.
 */
export function scanLooseTasks(notes: Note[]): LooseTask[] {
  const out: LooseTask[] = []
  for (const n of notes) {
    if (typeof n.content !== 'string') continue
    if (EXCLUDES.some((excluded) => excluded(n))) continue
    if (!n.content.includes('- [')) continue // cheap pre-check before splitting
    const noteTitle = noteTitleOf(n)
    const lines = n.content.split('\n')
    let inFence = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      if (FENCE_RE.test(line)) {
        inFence = !inFence
        continue
      }
      if (inFence) continue
      const m = CHECKBOX_RE.exec(line)
      if (!m) continue
      const body = m[3]!
      const dm = DUE_RE.exec(body)
      out.push({
        notePath: n.path,
        noteTitle,
        lineIndex: i,
        raw: line,
        text: dm ? dm[1]! : body,
        checked: m[2] !== ' ',
        ...(dm ? { due: dm[2]! } : {}),
      })
    }
  }
  return out
}

/** Find t's line in the FRESH note: trust lineIndex while the bytes still
 * match; if the line moved, accept a UNIQUE byte-identical line; zero or
 * many matches → throw (the caller's conflict-toast path takes it from
 * there — never guess which line the human meant). */
function locateLine(lines: string[], t: LooseTask): number {
  if (lines[t.lineIndex] === t.raw) return t.lineIndex
  const hits: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === t.raw) hits.push(i)
  }
  if (hits.length === 1) return hits[0]!
  throw new Error(
    hits.length === 0
      ? `That line changed in ${t.notePath} — refresh and try again.`
      : `That line appears ${hits.length} times in ${t.notePath} — edit the note directly.`,
  )
}

/** Flip `[ ]` ↔ `[x]` on exactly t's line. Every other byte survives. */
export function toggleTaskLine(lines: string[], t: LooseTask): string[] {
  const i = locateLine(lines, t)
  const next = [...lines]
  next[i] = t.raw.replace(
    CHECKBOX_RE,
    (_all, indent: string, mark: string, body: string) =>
      `${indent}- [${mark === ' ' ? 'x' : ' '}] ${body}`,
  )
  return next
}

/** Set/replace/remove the trailing `📅 YYYY-MM-DD` token on exactly t's
 * line. `due` = 'YYYY-MM-DD' appends or replaces the token; null strips it —
 * a cleared date leaves NO token behind (never `📅 ` or an empty date).
 * Surgical: every other byte of the note survives. */
export function setLineDue(lines: string[], t: LooseTask, due: string | null): string[] {
  const i = locateLine(lines, t)
  const next = [...lines]
  next[i] = t.raw.replace(
    CHECKBOX_RE,
    (_all, indent: string, mark: string, body: string) => {
      const bare = DUE_RE.exec(body)?.[1] ?? body
      return `${indent}- [${mark}] ${bare}${due ? ` 📅 ${due}` : ''}`
    },
  )
  return next
}

/** PROMOTION's second half: the source line stops being a checkbox and
 * becomes a pointer to the minted row — ownership transferred. */
export function promoteTaskLine(
  lines: string[],
  t: LooseTask,
  rowPath: string,
): string[] {
  const i = locateLine(lines, t)
  const indent = CHECKBOX_RE.exec(t.raw)?.[1] ?? ''
  const next = [...lines]
  next[i] = `${indent}- ➜ [[${rowPath}]]`
  return next
}

// ————————————————————————— shaping for the Tasks tab —————————————————————————

export interface LooseNoteGroup {
  path: string
  title: string
  items: LooseTask[]
}

/** Group loose tasks under their note (corpus order preserved) — the
 * bold note-title headers on the Tasks tab. */
export function groupLooseByNote(list: LooseTask[]): LooseNoteGroup[] {
  const groups: LooseNoteGroup[] = []
  const byPath = new Map<string, LooseNoteGroup>()
  for (const t of list) {
    let g = byPath.get(t.notePath)
    if (!g) {
      g = { path: t.notePath, title: t.noteTitle, items: [] }
      byPath.set(t.notePath, g)
      groups.push(g)
    }
    g.items.push(t)
  }
  return groups
}
