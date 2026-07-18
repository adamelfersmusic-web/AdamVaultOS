// ONE TASK (#/one-task) — the single-task focus surface's grammar. One task
// at a time, TYPED FRESH — never picked from existing tasks. Three
// convention notes, all tag `desk` (deliberately NOT `task`, so the Tracker
// never sees them, and all excluded from the loose-task scan — no clutter):
//
//   desk/one-task       the SLOT. `# <task name>` over its subtask lines:
//                         - [ ] subtask
//                             > an optional tucked-away note under it
//                         - [x] done subtask
//                       An empty (or missing) note IS the empty slot —
//                       resolving never deletes the note, it empties it.
//
//   desk/one-task-log   append-only history — one stamped block per resolved
//                       task: ## YYYY-MM-DD — <name> ✅ (or 🕊 renounced),
//                       subtask lines preserved byte-for-byte beneath.
//
//   desk/one-task-queue THE QUEUE — at most three parked NAMES (plain
//                       `- item` lines, deliberately never checkboxes) so
//                       the next few tasks stop costing RAM. Names only: a
//                       task earns its breakdown when it becomes THE task.
//                       Its own note, never inside the slot — an empty slot
//                       carrying queued lines would read as a task.
//
// Everything here is a pure function over note content — no fetching, no
// state. Law #2: the app is a lens; the notes hold the facts. The vault
// writes live in lib/store.ts, all riding surgicalLineEdit / saveContent.

export const ONE_TASK_PATH = 'desk/one-task'
export const ONE_TASK_LOG_PATH = 'desk/one-task-log'
export const ONE_TASK_QUEUE_PATH = 'desk/one-task-queue'
/** The queue's hard cap — the slot holds ONE task; the queue holds three. */
export const ONE_TASK_QUEUE_CAP = 3
/** Tag `desk` ONLY — the slot must never wear `task` (Tracker stays blind). */
export const ONE_TASK_TAGS = ['desk']

/** A subtask line: `- [ ] text` / `- [x] text`, flush or indented. */
const CHECKBOX_RE = /^\s*- \[( |x|X)\] (.+)$/
/** A subtask's note: indented `>` line(s) directly under its checkbox. */
const NOTE_LINE_RE = /^\s+>\s?(.*)$/
const HEADING_RE = /^#{1,6}\s+(.+?)\s*$/

export type OneTaskOutcome = 'done' | 'renounced'

export interface OneSubtask {
  /** The exact checkbox line, byte-for-byte — the surgical write's key. */
  raw: string
  lineIndex: number
  text: string
  checked: boolean
  /** The indented `> …` lines directly under the checkbox, verbatim — they
   * travel with the subtask through reorder and into the history block. */
  noteLines: string[]
  /** The note as display text — `>` scaffolding stripped, lines joined. */
  noteText: string
}

export interface OneTask {
  name: string
  subtasks: OneSubtask[]
}

/**
 * Read the slot. The task's name is the first heading (else the first plain
 * line — a heading-less note still counts); subtasks are every checkbox line,
 * each claiming the indented `>` lines directly beneath it as its note.
 * Blank or missing content → null: the slot is empty.
 */
export function parseOneTask(content: string | undefined | null): OneTask | null {
  if (!content || !content.trim()) return null
  const lines = content.split('\n')
  let name: string | null = null
  const subtasks: OneSubtask[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const m = CHECKBOX_RE.exec(line)
    if (m) {
      const noteLines: string[] = []
      for (let j = i + 1; j < lines.length && NOTE_LINE_RE.test(lines[j]!); j++) {
        noteLines.push(lines[j]!)
      }
      subtasks.push({
        raw: line,
        lineIndex: i,
        text: m[2]!.trim(),
        checked: m[1] !== ' ',
        noteLines,
        noteText: noteLines
          .map((l) => NOTE_LINE_RE.exec(l)?.[1] ?? '')
          .join('\n')
          .trim(),
      })
      i += noteLines.length
      continue
    }
    if (name === null) {
      const h = HEADING_RE.exec(line)
      if (h) name = h[1]!.trim()
      else if (line.trim()) name = line.trim()
    }
  }
  return name ? { name, subtasks } : null
}

/** A freshly typed task's whole note — the name is the hero, nothing else. */
export function oneTaskContent(name: string): string {
  return `# ${name.trim()}\n`
}

/** Find sub's checkbox line in the FRESH note: trust lineIndex while the
 * bytes still match; if the line moved, accept a UNIQUE byte-identical line;
 * zero or many matches → throw (the caller's conflict-toast path takes it
 * from there — never guess which line the human meant). */
function locateSubtask(lines: string[], sub: OneSubtask): number {
  if (lines[sub.lineIndex] === sub.raw) return sub.lineIndex
  const hits: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === sub.raw) hits.push(i)
  }
  if (hits.length === 1) return hits[0]!
  throw new Error(
    hits.length === 0
      ? 'that subtask changed in the vault — refresh and try again'
      : 'that subtask line appears more than once — edit the note directly',
  )
}

/** End (exclusive) of the subtask block starting at `start`: the checkbox
 * line plus every `>` note line directly under it. */
function blockEnd(lines: string[], start: number): number {
  let end = start + 1
  while (end < lines.length && NOTE_LINE_RE.test(lines[end]!)) end++
  return end
}

/** Every subtask block's extent, in note order. */
function subtaskBlocks(lines: string[]): { start: number; end: number }[] {
  const blocks: { start: number; end: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!CHECKBOX_RE.test(lines[i]!)) continue
    const end = blockEnd(lines, i)
    blocks.push({ start: i, end })
    i = end - 1
  }
  return blocks
}

/** Append `- [ ] <text>` after the LAST subtask block (so under its note
 * lines, never inside them) — or, on a subtask-less note, after the content
 * with one blank line of breathing room. Every other byte survives. */
export function appendSubtaskLine(lines: string[], text: string): string[] {
  const t = text.trim()
  if (!t) return lines
  const next = [...lines]
  const blocks = subtaskBlocks(next)
  const last = blocks[blocks.length - 1]
  if (last) {
    next.splice(last.end, 0, `- [ ] ${t}`)
    return next
  }
  let end = next.length
  while (end > 0 && next[end - 1]!.trim() === '') end--
  next.splice(end, 0, '', `- [ ] ${t}`)
  return next
}

/** Flip `[ ]` ↔ `[x]` on exactly sub's line — the note lines beneath it (and
 * every other byte) survive untouched. */
export function toggleSubtaskLine(lines: string[], sub: OneSubtask): string[] {
  const i = locateSubtask(lines, sub)
  const next = [...lines]
  next[i] = sub.raw.replace(
    CHECKBOX_RE,
    (_all, mark: string, body: string) => `- [${mark === ' ' ? 'x' : ' '}] ${body}`,
  )
  return next
}

/** Set/replace/remove the `>` note under exactly sub's line. `text` becomes
 * one indented `> ` line per newline; empty text leaves NO note lines behind
 * (never a bare `    >`). Surgical: only the note lines change. */
export function setSubtaskNote(lines: string[], sub: OneSubtask, text: string): string[] {
  const i = locateSubtask(lines, sub)
  const next = [...lines]
  const end = blockEnd(next, i)
  const noteLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `    > ${l}`)
  next.splice(i + 1, end - (i + 1), ...noteLines)
  return next
}

/** Reorder: lift sub's WHOLE block (checkbox + its note lines) and set it
 * back down immediately before `before`'s block — or after the last block
 * when before is null. Line order in the note IS the subtask order; one
 * write on drop, nothing speculative. */
export function moveSubtaskBlock(
  lines: string[],
  sub: OneSubtask,
  before: OneSubtask | null,
): string[] {
  const from = locateSubtask(lines, sub)
  const fromEnd = blockEnd(lines, from)
  const block = lines.slice(from, fromEnd)
  const next = [...lines.slice(0, from), ...lines.slice(fromEnd)]
  let at: number
  if (before) {
    at = locateSubtask(next, before)
  } else {
    const blocks = subtaskBlocks(next)
    const last = blocks[blocks.length - 1]
    at = last ? last.end : next.length
  }
  next.splice(at, 0, ...block)
  return next
}

/**
 * The stamped history block for a resolved task:
 *
 *   ## 2026-07-17 — <task name> ✅        (or 🕊 renounced)
 *   - [x] subtask
 *   - [ ] subtask                          (unchecked ones preserved as-is)
 *       > its note travels along, verbatim
 */
export function historyBlock(
  task: OneTask,
  outcome: OneTaskOutcome,
  date: string,
): string[] {
  const stamp = outcome === 'done' ? '✅' : '🕊 renounced'
  const out = [`## ${date} — ${task.name} ${stamp}`]
  for (const s of task.subtasks) {
    out.push(s.raw, ...s.noteLines)
  }
  return out
}

/** Append a stamped block to the log's lines — one blank line between
 * blocks, trailing whitespace tidied, everything above preserved. */
export function appendHistoryBlock(lines: string[], block: string[]): string[] {
  const next = [...lines]
  while (next.length > 0 && next[next.length - 1]!.trim() === '') next.pop()
  if (next.length > 0) next.push('')
  next.push(...block)
  return next
}

/** A freshly minted log note — the title, then the first stamped block. */
export function oneTaskLogContent(block: string[]): string {
  return `# One Task — the log\n\n${block.join('\n')}\n`
}

// ---------------------------------------------------------------------------
// THE QUEUE (desk/one-task-queue) — at most three parked names
// ---------------------------------------------------------------------------

/** A queued NAME: a plain `- item` line. The lookahead refuses checkboxes,
 * so a queued name can never read as work to any scanner. */
const QUEUE_LINE_RE = /^- (?!\[)(.+)$/

/** Read the queue — every plain `- item` line, in note order. */
export function parseQueue(content: string | undefined | null): string[] {
  if (!content) return []
  const out: string[] = []
  for (const line of content.split('\n')) {
    const m = QUEUE_LINE_RE.exec(line)
    if (m && m[1]!.trim()) out.push(m[1]!.trim())
  }
  return out
}

/** A freshly minted queue note — the title over its first parked name. */
export function oneTaskQueueContent(name: string): string {
  return `# One Task — the queue\n\n- ${name.trim()}\n`
}

/** Park a name at the queue's tail. The cap is sacred and re-checked against
 * the FRESH note: a fourth is refused with a human sentence, not clamped. */
export function addQueueLine(lines: string[], name: string): string[] {
  const t = name.trim()
  if (!t) return lines
  if (parseQueue(lines.join('\n')).length >= ONE_TASK_QUEUE_CAP) {
    throw new Error('the queue holds three — one must become the task first')
  }
  const next = [...lines]
  let last = -1
  for (let i = 0; i < next.length; i++) {
    if (QUEUE_LINE_RE.test(next[i]!)) last = i
  }
  if (last !== -1) {
    next.splice(last + 1, 0, `- ${t}`)
    return next
  }
  let end = next.length
  while (end > 0 && next[end - 1]!.trim() === '') end--
  next.splice(end, 0, '', `- ${t}`)
  return next
}

/** Remove exactly one parked name (the first line carrying it). A name that
 * vanished in the vault throws for the caller's conflict-toast path. */
export function removeQueueLine(lines: string[], name: string): string[] {
  const idx = lines.findIndex((l) => {
    const m = QUEUE_LINE_RE.exec(l)
    return Boolean(m && m[1]!.trim() === name)
  })
  if (idx === -1) {
    throw new Error('that queued name changed in the vault — refresh and try again')
  }
  const next = [...lines]
  next.splice(idx, 1)
  return next
}
