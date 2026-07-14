// The TODAY checklist (build log PART 25, trimmed in the altitude pass) —
// tasks with when:"today", HARD-CAPPED at 5 (calm by law), plus the picker
// that promotes any open task onto the day. Picker v2 is write-OR-find:
// typing filters existing tasks AND the first row always offers to mint the
// typed text as a brand-new project-less task straight onto today (Enter =
// create-and-add). This-week tasks rank first, ✕ demotes to "later" instead
// of deleting, and the picker dismisses like a normal window (outside click,
// Escape, after an add, or the button again). The strip's old neighbors moved
// out of the Projects page: the 📍 Current pin lost its panel, and the
// 📓 Daily note became a quiet header button. What's left is the one piece
// of day furniture that earns its place beside the week: the short list.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import { createTask, setMetadata, setTaskToday, toast, useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { titleFromPath } from '../lib/format'
import { IconPlus } from './Icons'

const TODAY_CAP = 5

// Pick-list ranking: this-week tasks first (the ritual blessed them), then
// the later/running list, then everything else. Stable within each group.
const WHEN_RANK: Record<string, number> = { 'this-week': 0, later: 1 }
const whenRank = (n: Note) => WHEN_RANK[String(n.metadata['when'] ?? '')] ?? 2

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
  const [busy, setBusy] = useState(false)
  const addRef = useRef<HTMLDivElement>(null)

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

  // Picker candidates: not-done tasks not already on today, this-week first
  // (ritual-blessed), then later, then the rest — stable within groups.
  const candidates = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    return taskNotes
      .filter((n) => n.metadata['done'] !== true && n.metadata['when'] !== 'today')
      .filter((n) => !q || taskTitle(n).toLowerCase().includes(q))
      .sort((a, b) => whenRank(a) - whenRank(b))
      .slice(0, 8)
  }, [taskNotes, pickerQuery])

  const closePicker = () => {
    setPickerOpen(false)
    setPickerQuery('')
  }

  // The picker closes like a normal window: outside pointerdown or Escape
  // (the same house pattern as Popover — capture-phase listeners, ref check).
  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (e: PointerEvent) => {
      const el = addRef.current
      if (el && !el.contains(e.target as Node)) {
        setPickerOpen(false)
        setPickerQuery('')
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setPickerOpen(false)
        setPickerQuery('')
      }
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [pickerOpen])

  // Write-OR-find: Enter (or the ➕ row) mints a brand-new project-less task
  // straight onto today. Zero-cost capture — file it to a world later, or not.
  const createAndAdd = async () => {
    const t = pickerQuery.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      await createTask(null, t, { when: 'today' })
      closePicker()
    } catch (e) {
      toast('error', `Couldn’t create task — ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  const pickExisting = (n: Note) => {
    void setTaskToday(n.path, true)
    closePicker()
  }

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
            {/* ✕ DEMOTES, never deletes: the task goes back to when:"later"
                (the running list). The note itself is never touched. */}
            <button
              className="today-item-x"
              title="Not today — back to the running list"
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
        <div className="today-add" ref={addRef}>
          {/* The button stays put — clicking it again while open closes. */}
          <button
            className="today-add-btn"
            onClick={() => (pickerOpen ? closePicker() : setPickerOpen(true))}
          >
            <IconPlus size={12} /> Add to today
          </button>
          {pickerOpen && (
            <div className="today-picker">
              <input
                autoFocus
                className="today-picker-input"
                placeholder="Type to add — or find a task…"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void createAndAdd()}
              />
              {/* Write first: any typed text is one Enter from being a task. */}
              {pickerQuery.trim() && (
                <button
                  className="today-picker-item today-picker-create"
                  data-testid="today-create"
                  disabled={busy}
                  onClick={() => void createAndAdd()}
                >
                  ➕ Add “{pickerQuery.trim()}”
                </button>
              )}
              {candidates.map((n) => (
                <button
                  key={n.path}
                  className="today-picker-item"
                  onClick={() => pickExisting(n)}
                >
                  {taskTitle(n)}
                  <span className="today-picker-proj">{String(n.metadata['project'] ?? '')}</span>
                </button>
              ))}
              {candidates.length === 0 && !pickerQuery.trim() && (
                <p className="today-empty">No open tasks — just type one.</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
