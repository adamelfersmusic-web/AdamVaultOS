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
  /** Indentation level of the line: floor(leadingSpaces / 2), tabs counting
   * one level each, capped at 3. NESTING LIVES IN THE NOTE — this is pure
   * READ-SIDE derivation from the bytes already there (the TipTap editor's
   * Tab writes the indentation); no parent IDs, no new storage concepts. */
  depth: number
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
  (n) => n.path.startsWith('desk/one-task'), // the One Task slot owns its subtasks; its log is history, not work
  (n) => n.path.startsWith('desk/shelves'), // the shelves layout note is app plumbing
  (n) => n.metadata?.['locked'] === true, // the sacred handful stays untouched
]

/** The ONE fence-aware checkbox walk — every `- [ ] text` line outside code
 * fences, in order. Shared by the loose-task scanner and the progress rings
 * (domain/checkboxRing.ts) so the two can never disagree about what counts. */
export function eachCheckboxLine(
  lines: string[],
  visit: (hit: {
    index: number
    raw: string
    checked: boolean
    body: string
    /** The line's leading whitespace, verbatim. */
    indent: string
  }) => void,
): void {
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
    visit({ index: i, raw: line, checked: m[2] !== ' ', body: m[3]!, indent: m[1]! })
  }
}

/** Indent → outline level: two spaces per level (the TipTap editor's Tab),
 * a tab counts as one whole level, capped at 3 — deeper indents render at
 * the cap rather than marching off the row. */
export function depthOf(indent: string): number {
  let spaces = 0
  let tabs = 0
  for (const ch of indent) {
    if (ch === '\t') tabs++
    else spaces++
  }
  return Math.min(tabs + Math.floor(spaces / 2), 3)
}

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
    eachCheckboxLine(n.content.split('\n'), ({ index, raw, checked, body, indent }) => {
      const dm = DUE_RE.exec(body)
      out.push({
        notePath: n.path,
        noteTitle,
        lineIndex: index,
        raw,
        text: dm ? dm[1]! : body,
        checked,
        ...(dm ? { due: dm[2]! } : {}),
        depth: depthOf(indent),
      })
    })
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
 * becomes a pointer to the minted row — ownership transferred.
 *
 * NESTING NOTE: promoting a PARENT rewrites ONLY that one line. Any child
 * lines beneath it keep their bytes — indentation included — so they simply
 * sit at their old depth under the pointer line (i.e., the outline reads as
 * children of the pointer, siblings of nothing new). No cascade, no
 * re-indent: the note stays the single truth and untouched lines stay
 * untouched. */
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

// ————————————————————————— the nested tree (render-only) —————————————————————————
//
// Adam thinks in nested task trees — "maybe the task subtask is just visual
// nesting… it helps me think way clearer." THE LAW: nesting lives in the
// note (markdown indentation under checkbox lines) and the Tasks tab only
// RENDERS the tree. No parent IDs, no new metadata, no cascade writes —
// checking a parent flips exactly that parent's line, nothing else.

/** One node of the rendered outline: a task and the tasks indented under it. */
export interface LooseTaskNode {
  task: LooseTask
  children: LooseTaskNode[]
}

/**
 * Shape a flat scan into outline trees — pure, standard outline semantics:
 * a task's parent is the nearest PRECEDING task with a lower depth, within
 * the same note. Non-task lines between them break nothing (markdown lists
 * tolerate wrapped text — the scanner already skipped those lines). A depth
 * jump with no shallower predecessor roots the task. Crossing into another
 * note resets the outline (nesting never spans notes).
 *
 * Callers pass whatever list they RENDER (usually the open-only filter), so
 * this is arrangement only: a task whose parent isn't in the list attaches
 * to its nearest present ancestor, or becomes a root. Visibility rules are
 * untouched.
 */
export function treeifyLoose(tasks: LooseTask[]): LooseTaskNode[] {
  const roots: LooseTaskNode[] = []
  // The current outline spine: strictly increasing depths, innermost last.
  let stack: { depth: number; node: LooseTaskNode }[] = []
  let notePath: string | null = null
  for (const t of tasks) {
    if (t.notePath !== notePath) {
      notePath = t.notePath
      stack = []
    }
    const node: LooseTaskNode = { task: t, children: [] }
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= t.depth) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent) parent.node.children.push(node)
    else roots.push(node)
    stack.push({ depth: t.depth, node })
  }
  return roots
}

/** A tree flattened back to render order: each task with its RENDERED indent
 * (position in the tree, not the raw line depth — an orphan at raw depth 2
 * whose parent isn't in the list renders flush, never floating) and how many
 * children render beneath it. */
export interface LooseTreeRow {
  t: LooseTask
  indent: number
  childCount: number
}

/** DFS the outline into row order — what every loose list actually maps over. */
export function flattenLooseTree(nodes: LooseTaskNode[]): LooseTreeRow[] {
  const out: LooseTreeRow[] = []
  const walk = (list: LooseTaskNode[], indent: number) => {
    for (const n of list) {
      out.push({ t: n.task, indent, childCount: n.children.length })
      walk(n.children, indent + 1)
    }
  }
  walk(nodes, 0)
  return out
}

export interface SubtreeTally {
  done: number
  total: number
}

/** The stable key every loose surface already uses for a line. */
export const looseTaskKey = (t: LooseTask): string => `${t.notePath}#${t.lineIndex}`

/**
 * Per-line subtree tallies (self + all descendants, done included) from the
 * FULL scan — checked lines count here even though the open-only lists drop
 * them, so a parent's "2/5" tells the truth about the whole subtree in the
 * note. Keyed by looseTaskKey.
 */
export function subtreeTallies(tasks: LooseTask[]): Map<string, SubtreeTally> {
  const map = new Map<string, SubtreeTally>()
  const walk = (node: LooseTaskNode): SubtreeTally => {
    const tally: SubtreeTally = { done: node.task.checked ? 1 : 0, total: 1 }
    for (const c of node.children) {
      const ct = walk(c)
      tally.done += ct.done
      tally.total += ct.total
    }
    map.set(looseTaskKey(node.task), tally)
    return tally
  }
  for (const root of treeifyLoose(tasks)) walk(root)
  return map
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
