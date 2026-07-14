// Shared task-shaping helpers — ONE definition of "what is today's list"
// and "what is a task's title/due", used by both the Cockpit's TodayStrip
// and the Tasks tab. Extracted from TodayStrip (build log PART 25 + Craft
// Phase A) so the two surfaces can never drift apart.

import type { Note } from '../lib/types'
import { dueTone } from '../lib/dates'
import { titleFromPath } from '../lib/format'

/** The task's due ('YYYY-MM-DD') when set, else null — never '' or junk. */
export function taskDue(n: Note): string | null {
  const v = n.metadata['due']
  return typeof v === 'string' && v ? v : null
}

/** A task's display line is its body's first line (same rule as the Tracker). */
export function taskTitle(n: Note): string {
  const first = (n.content ?? '')
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean)
  return first ? first.replace(/^#{1,6}\s+/, '').slice(0, 120) : titleFromPath(n.path)
}

/** The task's world key (metadata.project) when set, else null — unfiled. */
export function taskProject(n: Note): string | null {
  const v = n.metadata['project']
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * The day's merged list: picked tasks (when:"today") PLUS any not-done task
 * whose due date has arrived (today or overdue) — the date claims the day
 * even when the when-word says later. Deduped by construction: the due pull
 * skips anything already picked. Done rows sink to the bottom (the TodayStrip
 * keeps them visible struck-through; the Tasks tab filters them out).
 */
export function mergedTodayTasks(taskNotes: Note[]): Note[] {
  const picked = taskNotes.filter((n) => n.metadata['when'] === 'today')
  const dued = taskNotes.filter((n) => {
    if (n.metadata['when'] === 'today' || n.metadata['done'] === true) return false
    const due = taskDue(n)
    if (!due) return false
    const tone = dueTone(due)
    return tone === 'today' || tone === 'overdue'
  })
  return [...picked, ...dued].sort(
    (a, b) => Number(a.metadata['done'] === true) - Number(b.metadata['done'] === true),
  )
}
