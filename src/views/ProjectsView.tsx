// The Projects front door — THE SYSTEM §6's MACRO STRIP ("What worlds are
// alive?"). One calm line per world: name ▸ the one thing (from that world's
// latest weekly card) with the current phase on the right. Paused worlds fold
// into a quiet count at the bottom. Nothing else — click a world to enter it.
// Derives entirely from #project spines + projects/<key>/weekly/ cards.
//
// The altitude pass: one calm band above the strip — the weekly review's
// ⭐ Top 3 whispered beside the kept Today checklist. The 📍 Current pin
// panel moved out entirely, and the daily note shrank to a quiet header
// button. One screen, one cognitive question — with the day's short list
// earning its corner.

import { useEffect, useMemo, useState } from 'react'
import type { Note } from '../lib/types'
import {
  createProject,
  ensureTodayNote,
  fetchLatestWeeklyReview,
  fetchWeeklyCards,
  loadProjects,
  loadTracker,
  toast,
  useStore,
} from '../lib/store'
import { navigate } from '../lib/router'
import { toProjects, type Project } from '../domain/projects'
import {
  latestCardNote,
  oneThingOf,
  parseWeeklyCard,
  phaseLabelOf,
  weekTop3Of,
} from '../domain/spine'
import { IconPage, IconPlus, IconRefresh } from '../components/Icons'
import { TodayStrip } from '../components/TodayStrip'

/** The strip is capped — six big things, no more. Calm by law. */
const MAX_PROJECTS = 6

function MacroRow({ project, weeklies }: { project: Project; weeklies: Note[] }) {
  const cardNote = latestCardNote(weeklies, project.key)
  const card = cardNote ? parseWeeklyCard(cardNote) : null
  const one = oneThingOf(card, project)
  const phase = phaseLabelOf(project)
  return (
    <button
      className="macro-row"
      onClick={() => navigate({ kind: 'project', path: project.path })}
      data-testid="macro-row"
    >
      <span className="macro-name">{project.title}</span>
      <span className="macro-top" data-testid="macro-top">
        {one && (
          <>
            <span className="macro-top-mark">▸</span>
            {one}
          </>
        )}
      </span>
      {phase && <span className="macro-phase">{phase}</span>}
    </button>
  )
}

/** ⭐ This week — the latest weekly review's Top 3, whispered above the
 * strip. Three muted lines, nothing interactive except the block itself,
 * which opens the review. No review yet → nothing at all (air, not an
 * empty state). */
function WeekTop3({ weekly }: { weekly: Note | null | undefined }) {
  const items = useMemo(() => (weekly ? weekTop3Of(weekly.content) : []), [weekly])
  if (!weekly || items.length === 0) return null
  return (
    <button
      className="week-top3"
      data-testid="week-top3"
      title="Open this week’s review"
      onClick={() => navigate({ kind: 'pages', path: weekly.path })}
    >
      <span className="week-top3-label">This week</span>
      <ol className="week-top3-list">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    </button>
  )
}

/** This week's Monday (local clock) as YYYY-MM-DD — the ritual's due date. */
function mondayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}

/** The weekly ritual's status chip: green when this week is minted, a calm
 * red when Monday came and went without one. Always one click from the
 * ritual's front door (desk/weekly/template). */
function RitualChip({ weekly }: { weekly: Note | null | undefined }) {
  if (weekly === undefined) return null // still loading — no verdicts yet
  const monday = mondayKey()
  const noteDate = weekly ? (weekly.path.split('/').pop() ?? '') : ''
  const fresh = Boolean(weekly) && noteDate >= monday
  const daysLate = (new Date().getDay() + 6) % 7
  return (
    <button
      className={`ritual-chip ${fresh ? 'is-fresh' : 'is-due'}`}
      data-testid="ritual-chip"
      title="The Monday ritual — dictate, approve, the week mints itself"
      onClick={() => navigate({ kind: 'pages', path: 'desk/weekly/template' })}
    >
      <span className="ritual-dot" />
      {fresh
        ? `Week of ${noteDate} ✓`
        : `Ritual due${daysLate > 0 ? ` · ${daysLate} ${daysLate === 1 ? 'day' : 'days'} late` : ''}`}
    </button>
  )
}

export function ProjectsView() {
  const { projects, projectsStatus, projectsError, notes } = useStore()
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  // The card layer: every world's weekly stream in ONE prefix fetch.
  const [weeklies, setWeeklies] = useState<Note[] | null>(null)
  const [pausedOpen, setPausedOpen] = useState(false)
  const [openingDaily, setOpeningDaily] = useState(false)
  // The whole-week review (desk/weekly/<date>) — feeds the ⭐ Top-3 whisper
  // AND the ritual chip. undefined = still loading, null = none exists.
  const [weekly, setWeekly] = useState<Note | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    fetchWeeklyCards()
      .then((list) => {
        if (alive) setWeeklies(list)
      })
      .catch(() => {
        if (alive) setWeeklies([])
      })
    fetchLatestWeeklyReview()
      .then((n) => {
        if (alive) setWeekly(n)
      })
      .catch(() => {
        if (alive) setWeekly(null)
      })
    return () => {
      alive = false
    }
  }, [])

  const worlds = useMemo(
    () =>
      toProjects((projects ?? []).map((p) => notes[p]).filter((n): n is Note => Boolean(n))),
    [projects, notes],
  )
  // Paused worlds fold away — same disclosure law as the sidebar's Pinned.
  const alive = useMemo(
    () => worlds.filter((p) => String(p.note.metadata['phase'] ?? '') !== 'paused'),
    [worlds],
  )
  const paused = useMemo(
    () => worlds.filter((p) => String(p.note.metadata['phase'] ?? '') === 'paused'),
    [worlds],
  )
  const full = worlds.length >= MAX_PROJECTS

  const submitNew = async () => {
    const name = newName.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      const note = await createProject(name)
      setNewOpen(false)
      setNewName('')
      navigate({ kind: 'project', path: note.path })
    } catch (e) {
      toast('error', `${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  // Open (create if needed) today's desk/<date> note — the same door the old
  // DAILY NOTE panel opened, now a quiet header button.
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

  const refresh = () => {
    void loadProjects()
    void loadTracker()
    fetchWeeklyCards()
      .then(setWeeklies)
      .catch(() => {})
  }

  return (
    <div className="cockpit" data-testid="cockpit">
      <header className="cockpit-head">
        <div>
          <h1 className="db-title">Projects</h1>
          <p className="cockpit-sub">The worlds that are alive. Open one to see where it stands.</p>
        </div>
        <div className="cockpit-actions">
          {newOpen ? (
            <div className="world-new-row">
              <input
                autoFocus
                className="db-search world-new-input"
                placeholder="Project name — Enter to create…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitNew()
                  if (e.key === 'Escape') setNewOpen(false)
                }}
              />
              <button
                className="btn btn-gold"
                disabled={busy || !newName.trim()}
                onClick={() => void submitNew()}
              >
                Create
              </button>
            </div>
          ) : (
            <button
              className="btn btn-gold"
              disabled={full}
              title={
                full
                  ? 'The strip holds 6 projects max — finish or park one first'
                  : 'Add a project'
              }
              onClick={() => setNewOpen(true)}
              data-testid="new-project"
            >
              <IconPlus size={13} /> New project
            </button>
          )}
          {full && <span className="cockpit-cap">6 of 6 — a full deck</span>}
          <button
            className="btn btn-ghost"
            disabled={openingDaily}
            title="Open (or create) today’s daily note"
            onClick={() => void openDaily()}
            data-testid="daily-note-btn"
          >
            <IconPage size={13} /> {openingDaily ? 'Opening…' : 'Today’s note'}
          </button>
          <RitualChip weekly={weekly} />
          <button className="icon-btn" title="Refresh projects" onClick={refresh}>
            <IconRefresh size={14} />
          </button>
        </div>
      </header>

      <section className="week-band">
        <WeekTop3 weekly={weekly} />
        <TodayStrip />
      </section>

      {projectsStatus === 'error' ? (
        <div className="db-state">
          <p className="db-state-title">Couldn’t load projects</p>
          <p className="db-state-msg">{projectsError}</p>
          <button className="btn btn-gold" onClick={() => void loadProjects()}>
            Try again
          </button>
        </div>
      ) : projects === null ? (
        <div className="db-skeleton" aria-label="Loading">
          {Array.from({ length: 3 }, (_, i) => (
            <div className="skel-row" key={i} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      ) : worlds.length === 0 ? (
        <div className="db-state">
          <p className="db-state-title">No projects yet</p>
          <p className="db-state-msg">
            A project is a note tagged <code>project</code> — its tasks and notes become a
            world you can open.
          </p>
        </div>
      ) : (
        <div className="macro-strip" data-testid="macro-strip">
          {alive.map((p) => (
            <MacroRow key={p.path} project={p} weeklies={weeklies ?? []} />
          ))}
          {paused.length > 0 && (
            <div className="macro-paused">
              <button
                className="macro-paused-head"
                onClick={() => setPausedOpen((o) => !o)}
                aria-expanded={pausedOpen}
                data-testid="macro-paused"
              >
                <span className="pages-group-chevron">{pausedOpen ? '▾' : '▸'}</span>
                Paused · {paused.length}
              </button>
              {pausedOpen &&
                paused.map((p) => (
                  <MacroRow key={p.path} project={p} weeklies={weeklies ?? []} />
                ))}
            </div>
          )}
        </div>
      )}

      <button
        className="tracker-link"
        data-testid="tracker-link"
        onClick={() => navigate({ kind: 'tracker' })}
      >
        All tasks → Tracker
      </button>
    </div>
  )
}
