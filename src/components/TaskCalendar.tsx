// THE CALENDAR LENS — the Tasks tab's fifth chip. TIME as a lens over the
// same one pool: not-done row tasks (metadata.due) and not-done loose lines
// (the inline 📅 token) land on a full-surface month grid. No new storage
// concepts — due/📅 are the only time truths, and every write here rides the
// existing paths (setMetadata / setLooseTaskDue).
//
// Anatomy: MonthPicker's visual vocabulary grown into a big sibling —
// weekday header row, a stable 6-row (42-cell) grid, out-of-month days
// dimmed, TODAY ringed, the selected day's number filled with the accent.
// Each day cell previews up to 3 tiny task titles, then a '+N' overflow
// marker; past days wear the overdue tone (calm red — the calendar tells the
// truth about the past without nagging); done tasks never render; empty
// cells stay clean. Tapping a day renders its full task list UNDER the grid,
// reusing the Tasks tab's own row anatomy (checkbox, due-edit, ↗ promote,
// source chip) — nothing selected defaults to today.
//
// VISUAL SCHEDULING — drag a task onto a day: a cell's title chip (or a day
// panel row) drags, a day cell drops, and the new due is WRITTEN — house
// setMetadata for rows, setLooseTaskDue for loose lines. The target cell
// shows the house drop affordance while dragging; Escape / dropping outside
// writes NOTHING. Pointer-only enhancement: the row-due-edit button in the
// panel remains the accessible path to the very same write.

import { useEffect, useMemo, useState, type ReactElement } from 'react'
import type { Note } from '../lib/types'
import { setLooseTaskDue, setMetadata, toast } from '../lib/store'
import { formatDue, ymd } from '../lib/dates'
import { taskDue, taskTitle } from '../domain/tasks'
import type { LooseTask } from '../domain/looseTasks'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

interface Cell {
  key: string // 'YYYY-MM-DD'
  day: number
  inMonth: boolean
}

/** A stable 6×7 grid (42 cells) covering the month — starts on the Sunday of
 * the month's first week, so the surface never changes height (the same rule
 * as the MonthPicker popover). */
function monthGrid(year: number, month: number): Cell[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { key: ymd(d), day: d.getDate(), inMonth: d.getMonth() === month }
  })
}

// ——— CALENDAR DRAG — the house DnD (WorkTabs/Tasks pattern): native HTML5,
// payload in dataTransfer with a module mirror for dragover (which can't
// read dataTransfer in protected mode), window-level dragend sweep.
// Dropping on a cell is the ONLY gesture that writes. ———

type CalDragPayload =
  | { kind: 'cal-row'; path: string }
  | { kind: 'cal-loose'; notePath: string; lineIndex: number }

const CAL_DND_MIME = 'application/x-adamvaultos-caldue-dnd'
let liveCalDrag: CalDragPayload | null = null

function isCalDragPayload(p: unknown): p is CalDragPayload {
  if (!p || typeof p !== 'object') return false
  const d = p as Record<string, unknown>
  if (d.kind === 'cal-row') return typeof d.path === 'string'
  if (d.kind === 'cal-loose')
    return typeof d.notePath === 'string' && typeof d.lineIndex === 'number'
  return false
}

/** Drop-time payload: dataTransfer JSON when it parses, else the live mirror. */
function readCalDragPayload(e: React.DragEvent): CalDragPayload | null {
  try {
    const raw = e.dataTransfer.getData(CAL_DND_MIME)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isCalDragPayload(parsed)) return parsed
    }
  } catch {
    // fall through to the mirror
  }
  return liveCalDrag
}

function startCalDrag(e: React.DragEvent, payload: CalDragPayload) {
  liveCalDrag = payload
  e.dataTransfer.setData(CAL_DND_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'move'
}

/** One day's pool: rows first, then loose lines (rows outrank lines). */
interface DayPool {
  rows: Note[]
  loose: LooseTask[]
}

/** The Tasks tab's own row renderers, passed in so the panel is the SAME row
 * anatomy as every other chip (checkbox toggle, due edit, ↗ promote, source
 * chip) — not a calendar-flavored fork. */
type PanelRowRenderer = (props: { n: Note; showDue?: boolean }) => ReactElement
type PanelLooseRowRenderer = (props: { t: LooseTask; showDue?: boolean }) => ReactElement

export function TaskCalendar({
  tasks,
  loose,
  selected,
  onSelect,
  Row,
  LooseRow,
}: {
  /** Open row tasks (not-done, plus rows mid-exit for the panel's bow). */
  tasks: Note[]
  /** Open loose lines from the scanned corpus. */
  loose: LooseTask[]
  /** The explicitly selected day, or null (the panel then shows today). */
  selected: string | null
  onSelect: (day: string | null) => void
  Row: PanelRowRenderer
  LooseRow: PanelLooseRowRenderer
}) {
  const today = ymd(new Date())
  // Open on the selected day's month when there is one, else the current.
  const seed = selected ?? today
  const [view, setView] = useState(() => ({
    year: Number(seed.slice(0, 4)),
    month: Number(seed.slice(5, 7)) - 1,
  }))
  const cells = useMemo(() => monthGrid(view.year, view.month), [view])

  const step = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }
  const jumpToday = () => {
    const now = new Date()
    setView({ year: now.getFullYear(), month: now.getMonth() })
  }

  // Everything dued, bucketed by day. Cells never show done rows — mid-exit
  // rows (done but lingering for the panel's leave animation) are excluded
  // here so a checked task leaves its cell immediately.
  const byDay = useMemo(() => {
    const m = new Map<string, DayPool>()
    const poolOf = (d: string): DayPool => {
      let p = m.get(d)
      if (!p) {
        p = { rows: [], loose: [] }
        m.set(d, p)
      }
      return p
    }
    for (const n of tasks) {
      if (n.metadata['done'] === true) continue
      const d = taskDue(n)
      if (d) poolOf(d).rows.push(n)
    }
    for (const t of loose) {
      if (t.due) poolOf(t.due).loose.push(t)
    }
    return m
  }, [tasks, loose])

  // The drop-hover day (the house drop affordance renders on that cell).
  // Window-level dragend/drop is the safety net for cancelled drags.
  const [dropDay, setDropDay] = useState<string | null>(null)
  useEffect(() => {
    const clear = () => {
      setDropDay(null)
      liveCalDrag = null
    }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  /** THE VISUAL-SCHEDULING WRITE — dropping on a day rewrites the due via
   * the existing machinery only: metadata.due for rows (house setMetadata,
   * undo included), the 📅 token for loose lines (setLooseTaskDue —
   * byte-stable everywhere else). Landing on the same day writes nothing. */
  const writeDrop = (payload: CalDragPayload, day: string) => {
    if (payload.kind === 'cal-row') {
      const n = tasks.find((x) => x.path === payload.path)
      if (!n) return
      const prev = taskDue(n)
      if (prev === day) return
      void setMetadata(n.path, { due: day }, { undo: { due: prev } })
    } else {
      const t = loose.find(
        (x) => x.notePath === payload.notePath && x.lineIndex === payload.lineIndex,
      )
      if (!t || (t.due ?? null) === day) return
      void setLooseTaskDue(t, day).catch((e) => {
        toast('error', `Couldn’t save — ${e instanceof Error ? e.message : e}`)
      })
    }
  }

  // Tap = select; tapping the selected day again CLEARS the selection (the
  // panel falls back to today, quick-create back to Tomorrow).
  const tapDay = (key: string) => onSelect(key === selected ? null : key)

  // ——— the day panel's pool: the selected day, else today. Rows here keep
  // mid-exit entries so checking one off bows out gracefully (same as the
  // other chips) — the Row/LooseRow renderers own that behavior. ———
  const day = selected ?? today
  const panelRows = useMemo(() => tasks.filter((n) => taskDue(n) === day), [tasks, day])
  const panelLoose = useMemo(() => loose.filter((t) => t.due === day), [loose, day])

  return (
    <div className="task-cal" data-testid="task-calendar">
      <div className="cal-head">
        <span className="cal-title" data-testid="cal-title">
          {MONTHS[view.month]} {view.year}
        </span>
        <div className="cal-nav">
          <button
            className="cal-nav-btn"
            data-testid="cal-prev"
            aria-label="Previous month"
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <button
            className="cal-nav-btn cal-bullseye"
            data-testid="cal-today"
            aria-label="Jump to the current month"
            title="Today"
            onClick={jumpToday}
          >
            ◎
          </button>
          <button
            className="cal-nav-btn"
            data-testid="cal-next"
            aria-label="Next month"
            onClick={() => step(1)}
          >
            ›
          </button>
        </div>
      </div>

      <div className="cal-grid" data-testid="cal-grid" role="grid" aria-label="Month of tasks">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-wd" aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((c) => {
          const pool = byDay.get(c.key)
          const entries: (Note | LooseTask)[] = pool ? [...pool.rows, ...pool.loose] : []
          const past = c.key < today
          return (
            // A div, not a button — the tiny title chips inside are drag
            // sources, and buttons can't nest. Enter/Space select it anyway.
            <div
              key={c.key}
              className={`cal-cell${c.inMonth ? '' : ' is-out'}${c.key === today ? ' is-today' : ''}${
                c.key === selected ? ' is-selected' : ''
              }${dropDay === c.key ? ' is-drop' : ''}`}
              data-testid="cal-cell"
              data-date={c.key}
              role="button"
              tabIndex={0}
              aria-label={`${c.key}${entries.length ? ` — ${entries.length} due` : ''}`}
              onClick={() => tapDay(c.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  tapDay(c.key)
                }
              }}
              onDragOver={(e) => {
                if (!liveCalDrag) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDropDay(c.key)
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
                setDropDay((d) => (d === c.key ? null : d))
              }}
              onDrop={(e) => {
                const payload = readCalDragPayload(e)
                setDropDay(null)
                if (!payload) return
                e.preventDefault()
                writeDrop(payload, c.key)
              }}
            >
              <span className="cal-daynum">{c.day}</span>
              {entries.slice(0, 3).map((entry) =>
                'path' in entry ? (
                  <div
                    key={entry.path}
                    className={`cal-chip${past ? ' is-overdue' : ''}`}
                    data-testid="cal-chip"
                    data-path={entry.path}
                    title={taskTitle(entry)}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation()
                      startCalDrag(e, { kind: 'cal-row', path: entry.path })
                    }}
                    onDragEnd={() => {
                      liveCalDrag = null
                    }}
                  >
                    {taskTitle(entry)}
                  </div>
                ) : (
                  <div
                    key={`${entry.notePath}#${entry.lineIndex}`}
                    className={`cal-chip is-loose${past ? ' is-overdue' : ''}`}
                    data-testid="cal-chip"
                    data-path={entry.notePath}
                    data-line={entry.lineIndex}
                    title={entry.text}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation()
                      startCalDrag(e, {
                        kind: 'cal-loose',
                        notePath: entry.notePath,
                        lineIndex: entry.lineIndex,
                      })
                    }}
                    onDragEnd={() => {
                      liveCalDrag = null
                    }}
                  >
                    {entry.text}
                  </div>
                ),
              )}
              {entries.length > 3 && (
                <span className="cal-more" data-testid="cal-more">
                  +{entries.length - 3}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* ——— the day panel: the selected day's full list, in the Tasks tab's
          own row anatomy. Each row rides a thin draggable wrapper so it can
          be dropped onto a cell above (the accessible path to the same write
          is the row's own due-edit button). ——— */}
      <section className="cal-panel" data-testid="cal-panel" data-day={day}>
        <div className="cal-panel-head" data-testid="cal-panel-head">
          {formatDue(day)}
          <span className="tasks-group-count">{panelRows.length + panelLoose.length}</span>
        </div>
        {panelRows.length === 0 && panelLoose.length === 0 ? (
          <p className="tasks-empty">Nothing due this day.</p>
        ) : (
          <>
            {panelRows.map((n) => (
              <div
                key={n.path}
                className="cal-drag"
                draggable
                onDragStart={(e) => startCalDrag(e, { kind: 'cal-row', path: n.path })}
                onDragEnd={() => {
                  liveCalDrag = null
                }}
              >
                <Row n={n} />
              </div>
            ))}
            {panelLoose.map((t) => (
              <div
                key={`${t.notePath}#${t.lineIndex}`}
                className="cal-drag"
                draggable
                onDragStart={(e) =>
                  startCalDrag(e, {
                    kind: 'cal-loose',
                    notePath: t.notePath,
                    lineIndex: t.lineIndex,
                  })
                }
                onDragEnd={() => {
                  liveCalDrag = null
                }}
              >
                <LooseRow t={t} />
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  )
}
