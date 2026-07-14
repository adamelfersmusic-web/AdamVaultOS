// The Projects front door — THE SYSTEM §6's MACRO STRIP ("What worlds are
// alive?"). One calm line per world: name ▸ the one thing (from that world's
// latest weekly card) with the current phase on the right. Paused worlds fold
// into a quiet count at the bottom. Nothing else — click a world to enter it.
// Derives entirely from #project spines + projects/<key>/weekly/ cards.

import { useEffect, useMemo, useState } from 'react'
import type { Note } from '../lib/types'
import {
  createProject,
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
} from '../domain/spine'
import { IconPlus, IconRefresh } from '../components/Icons'
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

export function ProjectsView() {
  const { projects, projectsStatus, projectsError, notes } = useStore()
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  // The card layer: every world's weekly stream in ONE prefix fetch.
  const [weeklies, setWeeklies] = useState<Note[] | null>(null)
  const [pausedOpen, setPausedOpen] = useState(false)

  useEffect(() => {
    let alive = true
    fetchWeeklyCards()
      .then((list) => {
        if (alive) setWeeklies(list)
      })
      .catch(() => {
        if (alive) setWeeklies([])
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
          <button className="icon-btn" title="Refresh projects" onClick={refresh}>
            <IconRefresh size={14} />
          </button>
        </div>
      </header>

      <TodayStrip />

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
    </div>
  )
}
