// THE TIME TAB (#/time) — the daily time log ("ADHD is brutal and my life
// is a blur"). ALWAYS one day on screen — today by default, ‹ › steps a
// single day, never a range, never a list of days. The note is HYPER
// STRUCTURED (domain/timelog.ts): fields only, and you can't write anything
// but those exact fields — there is NO freeform text input anywhere on this
// view. That's the law.
//
//   header   the day + its total ("3h 40m logged"), tabular numerals
//   form     [what] [project] [minutes] → Enter appends one contract line
//            (TODAY only — the HH:MM stamp is creation time, so the past
//            can't be backfilled with a lying clock)
//   rows     read-only, entry order, a quiet per-row × (delete + re-add is
//            the correction path — no editing-in-place in v1)
//
// Most rows write themselves: resolving a stamped One Task auto-feeds a
// ` · ⚡` row (store.resolveOneTask). Project suggestions come from the
// Cockpit's project keys but the field stays open text.

import { useEffect, useMemo, useState } from 'react'
import type { Note } from '../lib/types'
import {
  addTimelogEntry,
  fetchTimelogNote,
  loadProjects,
  removeTimelogEntry,
  toast,
  useStore,
} from '../lib/store'
import { formatElapsed } from '../domain/oneTask'
import {
  parseTimelog,
  stepDay,
  TIMELOG_PREFIX,
  timelogDayKey,
  timelogDayLabel,
  totalsOf,
  type TimelogEntry,
} from '../domain/timelog'
import { toProjects } from '../domain/projects'

export function TimeView() {
  const { notes, projects, projectsStatus } = useStore()
  const [dayKey, setDayKey] = useState<string>(() => timelogDayKey())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [what, setWhat] = useState('')
  const [project, setProject] = useState('')
  const [minutes, setMinutes] = useState('')

  const today = timelogDayKey()
  const isToday = dayKey === today

  // One fresh read per viewed day — after that the store's merge is truth.
  useEffect(() => {
    let alive = true
    setStatus('loading')
    fetchTimelogNote(dayKey)
      .then(() => {
        if (alive) setStatus('ready')
      })
      .catch((e) => {
        if (alive) {
          setStatus('error')
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      })
    return () => {
      alive = false
    }
  }, [dayKey])

  // Project keys for the suggestion list (open text — never a hard picker).
  useEffect(() => {
    if (projectsStatus === 'idle') void loadProjects()
  }, [projectsStatus])
  const projectKeys = useMemo(
    () =>
      toProjects(
        (projects ?? []).map((p) => notes[p]).filter((n): n is Note => Boolean(n)),
      ).map((p) => p.key),
    [projects, notes],
  )

  const note = notes[`${TIMELOG_PREFIX}${dayKey}`]
  const entries = useMemo(() => parseTimelog(note?.content), [note?.content])
  const { totalMinutes } = totalsOf(entries)

  const minutesOk = /^\d+$/.test(minutes.trim()) && Number(minutes.trim()) > 0
  const canAdd = isToday && !busy && what.trim() !== '' && minutesOk

  const guard = async (verb: string, run: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    try {
      await run()
    } catch (e) {
      toast('error', `Couldn’t ${verb} — ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  const add = () =>
    guard('log it', async () => {
      if (!canAdd) return
      await addTimelogEntry({
        what,
        project: project.trim() ? project : null,
        minutes: Number(minutes.trim()),
      })
      // The what and minutes clear for the next entry; the project sticks
      // (runs of work usually belong to one world).
      setWhat('')
      setMinutes('')
    })

  const remove = (entry: TimelogEntry) =>
    guard('delete the row', () => removeTimelogEntry(dayKey, entry))

  if (status === 'error') {
    return (
      <div className="time" data-testid="time-view">
        <p className="time-quiet">Couldn’t reach the vault — {loadError}</p>
      </div>
    )
  }

  return (
    <div className="time" data-testid="time-view">
      <header className="time-head">
        <button
          className="time-step"
          data-testid="time-prev"
          title="The day before"
          aria-label="The day before"
          onClick={() => setDayKey((k) => stepDay(k, -1))}
        >
          ‹
        </button>
        <div className="time-head-main">
          <h1 className="time-title" data-testid="time-title">
            {timelogDayLabel(dayKey)}
          </h1>
          {entries.length > 0 && (
            <span className="time-total" data-testid="time-total">
              {formatElapsed(totalMinutes * 60_000)} logged
            </span>
          )}
        </div>
        <button
          className="time-step"
          data-testid="time-next"
          title="The day after"
          aria-label="The day after"
          disabled={isToday}
          onClick={() => setDayKey((k) => (k === today ? k : stepDay(k, 1)))}
        >
          ›
        </button>
      </header>

      {isToday && (
        <form
          className="time-form"
          data-testid="time-form"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <input
            className="time-what"
            data-testid="time-what"
            placeholder="What"
            aria-label="What"
            value={what}
            disabled={busy}
            onChange={(e) => setWhat(e.target.value)}
          />
          <input
            className="time-project"
            data-testid="time-project"
            placeholder="Project"
            aria-label="Project"
            list="time-project-keys"
            value={project}
            disabled={busy}
            onChange={(e) => setProject(e.target.value)}
          />
          <datalist id="time-project-keys">
            {projectKeys.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <input
            className="time-minutes"
            data-testid="time-minutes"
            placeholder="Min"
            aria-label="Minutes"
            inputMode="numeric"
            value={minutes}
            disabled={busy}
            onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, ''))}
          />
          <button className="time-add" data-testid="time-add" type="submit" disabled={!canAdd}>
            Log
          </button>
        </form>
      )}

      <div className="time-rows">
        {status === 'loading' ? (
          <div className="spinner" aria-hidden="true" />
        ) : entries.length === 0 ? (
          <p className="time-quiet" data-testid="time-empty">
            nothing logged yet
          </p>
        ) : (
          entries.map((e) => (
            <div
              key={`${e.lineIndex}:${e.raw}`}
              className={`time-row${e.auto ? ' is-auto' : ''}`}
              data-testid="time-row"
              data-line={e.lineIndex}
            >
              <span className="time-row-clock">{e.time}</span>
              <span className="time-row-min">{e.minutes}m</span>
              <span className={`time-row-project${e.project ? '' : ' is-none'}`}>
                {e.project ?? '—'}
              </span>
              <span className="time-row-what">{e.what}</span>
              {e.auto && (
                <span className="time-row-auto" title="Logged itself — a resolved One Task">
                  ⚡
                </span>
              )}
              <button
                className="time-row-del"
                data-testid="time-row-del"
                disabled={busy}
                title="Delete this row (delete + re-add is the correction path)"
                aria-label={`Delete ${e.what}`}
                onClick={() => void remove(e)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
