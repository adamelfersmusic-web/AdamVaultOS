// The TODAY checklist (build log PART 25, trimmed in the altitude pass) —
// tasks with when:"today", HARD-CAPPED at 5 (calm by law), plus the picker
// that promotes any open task onto the day. The strip's old neighbors moved
// out of the Projects page: the 📍 Current pin lost its panel, and the
// 📓 Daily note became a quiet header button. What's left is the one piece
// of day furniture that earns its place beside the week: the short list.

import { useMemo, useState } from 'react'
import type { Note } from '../lib/types'
import { setMetadata, setTaskToday, useStore } from '../lib/store'
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')

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

  return (
    <section className="today" data-testid="today-strip">
      <div className="today-label">
        Today{' '}
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
    </section>
  )
}
