// MonthPicker — the house calendar popover (Craft-style, no external deps).
// Opens from any date chip; anchored via the shared Popover (outside click,
// Escape, viewport clamping all come from there). A month grid with weekday
// headers, prev/next month arrows, a today-bullseye that snaps the view back
// to the current month, TODAY ringed, the selected day filled with the
// accent, days outside the month dimmed (still tappable — a date is a date),
// and a 'Clear date' row at the bottom. Tap a day = select + close.
// Both themes for free: every color routes through the CSS vars.

import { useMemo, useState } from 'react'
import { Popover } from './Popover'
import { ymd } from '../lib/dates'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const
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
 * the month's first week, so the popover never changes height. */
function monthGrid(year: number, month: number): Cell[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { key: ymd(d), day: d.getDate(), inMonth: d.getMonth() === month }
  })
}

export function MonthPicker({
  anchor,
  value,
  onPick,
  onClear,
  onClose,
}: {
  anchor: HTMLElement
  /** Currently selected due ('YYYY-MM-DD'), or null when no date is set. */
  value: string | null
  onPick: (due: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const today = ymd(new Date())
  // Open on the selected day's month when there is one, else the current.
  const seed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today
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

  return (
    <Popover anchor={anchor} onClose={onClose} width={252}>
      <div className="mp" data-testid="month-picker">
        <div className="mp-head">
          <span className="mp-title">
            {MONTHS[view.month]} {view.year}
          </span>
          <div className="mp-nav">
            <button
              className="mp-nav-btn"
              data-testid="mp-prev"
              aria-label="Previous month"
              onClick={() => step(-1)}
            >
              ‹
            </button>
            <button
              className="mp-nav-btn mp-bullseye"
              data-testid="mp-today"
              aria-label="Jump to the current month"
              title="Today"
              onClick={jumpToday}
            >
              ◎
            </button>
            <button
              className="mp-nav-btn"
              data-testid="mp-next"
              aria-label="Next month"
              onClick={() => step(1)}
            >
              ›
            </button>
          </div>
        </div>
        <div className="mp-grid" role="grid" aria-label="Pick a date">
          {WEEKDAYS.map((w) => (
            <span key={w} className="mp-wd" aria-hidden="true">
              {w}
            </span>
          ))}
          {cells.map((c) => (
            <button
              key={c.key}
              className={`mp-day${c.inMonth ? '' : ' is-out'}${
                c.key === today ? ' is-today' : ''
              }${c.key === value ? ' is-selected' : ''}`}
              data-date={c.key}
              aria-label={c.key}
              onClick={() => {
                onPick(c.key)
                onClose()
              }}
            >
              {c.day}
            </button>
          ))}
        </div>
        <button
          className="mp-clear"
          data-testid="mp-clear"
          onClick={() => {
            onClear()
            onClose()
          }}
        >
          Clear date
        </button>
      </div>
    </Popover>
  )
}
