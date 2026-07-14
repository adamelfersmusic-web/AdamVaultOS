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

/** A row's hand-placed position: metadata.order when it's a finite number
 * (written 10-spaced by the Tasks tab's drag-reorder — the WorkTabs pattern),
 * else null. */
export function taskOrder(n: Note): number | null {
  const v = n.metadata['order']
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * THE SORT LAW for rows inside a Tasks-tab group: hand-placed rows (order
 * set) come FIRST, ascending — where a due-sort previously ordered rows
 * inside a group, order (when present) WINS and due breaks ties (created-at
 * settles the rest). Rows without an order keep the caller's existing
 * arrangement (due-first, merged-today, …) after them — so vaults from
 * before the reorder feature look exactly as they always did.
 */
export function orderFirst(list: Note[]): Note[] {
  const ordered = list.filter((n) => taskOrder(n) !== null)
  const rest = list.filter((n) => taskOrder(n) === null)
  ordered.sort((a, b) => {
    const d = taskOrder(a)! - taskOrder(b)!
    if (d !== 0) return d
    const da = taskDue(a)
    const db = taskDue(b)
    if (da !== db) {
      if (da === null) return 1
      if (db === null) return -1
      return da < db ? -1 : 1
    }
    return a.createdAt < b.createdAt ? -1 : 1
  })
  return [...ordered, ...rest]
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
