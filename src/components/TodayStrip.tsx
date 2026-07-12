// The TODAY strip (build log PART 25) — the now-surface, sitting on top of
// the Projects cockpit. Three zones:
//   📍 Current  — the one note Adam is working on right now (desk/current)
//   ☑ Today     — tasks with when:"today", HARD-CAPPED at 5 (calm by law)
//   📓 Daily    — today's desk/<date> note, one click, auto-created
// Projects answers "what exists"; this answers "what NOW".

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import {
  ensureTodayNote,
  fetchCurrentTarget,
  setMetadata,
  setTaskToday,
  toast,
  useStore,
} from '../lib/store'
import { navigate } from '../lib/router'
import { titleFromPath } from '../lib/format'
import { IconPlus } from './Icons'

const TODAY_CAP = 5

/** A task's display line is its body's first line (same rule as the Tracker). */
function taskTitle(n: Note): string {
  const first = (n.content ?? '')
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean)
  return first ? first.replace(/^#{1,6}\s+/, '').slice(0, 120) : titleFromPath(n.path)
}

export function TodayStrip() {
  const { tracker, notes } = useStore()
  const [current, setCurrent] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [openingDaily, setOpeningDaily] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    fetchCurrentTarget().then((t) => {
      if (seq.current === id) setCurrent(t)
    })
  }, [])

  const taskNotes = useMemo(
    () => (tracker ?? []).map((p) => notes[p]).filter((n): n is Note => Boolean(n)),
    [tracker, notes],
  )
  const todays = useMemo(
    () =>
      taskNotes
        .filter((n) => n.metadata['when'] === 'today')
        .sort((a, b) => Number(a.metadata['done'] === true) - Number(b.metadata['done'] === true)),
    [taskNotes],
  )
  const openCount = todays.filter((n) => n.metadata['done'] !== true).length

  // Picker candidates: not-done tasks not already on today.
  const candidates = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    return taskNotes
      .filter((n) => n.metadata['done'] !== true && n.metadata['when'] !== 'today')
      .filter((n) => !q || taskTitle(n).toLowerCase().includes(q))
      .slice(0, 8)
  }, [taskNotes, pickerQuery])

  const toggleDone = (n: Note) => {
    const done = n.metadata['done'] === true
    void setMetadata(
      n.path,
      { done: !done, state: done ? 'active' : 'done' },
      { undo: { done, state: String(n.metadata['state'] ?? 'next') } },
    )
  }

  const openDaily = async () => {
    if (openingDaily) return
    setOpeningDaily(true)
    try {
      const path = await ensureTodayNote()
      navigate({ kind: 'pages', path })
    } catch (e) {
      toast('error', `Couldn’t open today’s note — ${e instanceof Error ? e.message : e}`)
    } finally {
      setOpeningDaily(false)
    }
  }

  return (
    <section className="today" data-testid="today-strip">
      <div className="today-zone today-current">
        <div className="today-label">📍 Current</div>
        {current ? (
          <button
            className="today-current-note"
            onClick={() =>
              navigate(
                current.startsWith('pages/') || current.startsWith('desk/')
                  ? { kind: 'pages', path: current }
                  : { kind: 'note', path: current },
              )
            }
            title={current}
          >
            {titleFromPath(current)}
          </button>
        ) : (
          <p className="today-empty">
            Nothing pinned. Open any page and hit 📍 to mark what you’re on.
          </p>
        )}
      </div>

      <div className="today-zone today-list">
        <div className="today-label">
          ☑ Today{' '}
          <span className="today-count">
            {openCount}/{TODAY_CAP}
          </span>
        </div>
        {todays.length === 0 && (
          <p className="today-empty">Pick 1–5 things. That’s the whole day.</p>
        )}
        {todays.map((n) => {
          const done = n.metadata['done'] === true
          return (
            <div key={n.path} className={`today-item${done ? ' is-done' : ''}`}>
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggleDone(n)}
                aria-label={taskTitle(n)}
              />
              <button
                className="today-item-title"
                onClick={() => navigate({ kind: 'pages', path: n.path })}
                title={n.path}
              >
                {taskTitle(n)}
              </button>
              <button
                className="today-item-x"
                title="Not today"
                onClick={() => void setTaskToday(n.path, false)}
              >
                ✕
              </button>
            </div>
          )
        })}
        {openCount >= TODAY_CAP ? (
          <p className="today-cap">5 of 5 — enough for today.</p>
        ) : (
          <div className="today-add">
            {pickerOpen ? (
              <div className="today-picker">
                <input
                  autoFocus
                  className="today-picker-input"
                  placeholder="Find a task…"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setPickerOpen(false)}
                />
                {candidates.map((n) => (
                  <button
                    key={n.path}
                    className="today-picker-item"
                    onClick={() => {
                      void setTaskToday(n.path, true)
                      setPickerOpen(false)
                      setPickerQuery('')
                    }}
                  >
                    {taskTitle(n)}
                    <span className="today-picker-proj">{String(n.metadata['project'] ?? '')}</span>
                  </button>
                ))}
                {candidates.length === 0 && (
                  <p className="today-empty">No open tasks match.</p>
                )}
              </div>
            ) : (
              <button className="today-add-btn" onClick={() => setPickerOpen(true)}>
                <IconPlus size={12} /> Add to today
              </button>
            )}
          </div>
        )}
      </div>

      <div className="today-zone today-daily">
        <div className="today-label">📓 Daily note</div>
        <button
          className="btn btn-gold today-daily-btn"
          disabled={openingDaily}
          onClick={() => void openDaily()}
          data-testid="open-daily"
        >
          {openingDaily ? 'Opening…' : 'Open today’s note'}
        </button>
        <p className="today-hint">Your live workspace for the day.</p>
      </div>
    </section>
  )
}
