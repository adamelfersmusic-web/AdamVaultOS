// The Cockpit — the app's front door. A calm deck of project cards (title,
// one-liner, status, live task progress), each opening into its world.
// Composition over construction: cards derive entirely from `project`-tagged
// notes + the already-loaded tracker slice. Build log PART 22.

import { useMemo, useState } from 'react'
import type { Note } from '../lib/types'
import { createProject, loadProjects, loadTracker, toast, useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { projectProgress, STATUS_COLORS, toProjects, type Project } from '../domain/projects'
import { IconPlus, IconRefresh } from '../components/Icons'
import { TodayStrip } from '../components/TodayStrip'

/** The deck is capped — six big things, no more. Calm by law. */
const MAX_PROJECTS = 6

function ProgressBar({ done, total }: { done: number; total: number }) {
  if (total === 0) return <span className="proj-noprog">no tasks yet</span>
  const pct = Math.round((done / total) * 100)
  return (
    <div className="proj-progress" title={`${done} of ${total} tasks done`}>
      <div className="proj-progress-track">
        <i className="proj-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="proj-progress-label">
        {done}/{total} · {pct}%
      </span>
    </div>
  )
}

function ProjectCard({ project, taskNotes }: { project: Project; taskNotes: Note[] }) {
  const { done, total } = projectProgress(project.key, taskNotes)
  const color = STATUS_COLORS[project.status] ?? 'neutral'
  return (
    <button
      className="proj-card"
      onClick={() => navigate({ kind: 'project', path: project.path })}
      data-testid="project-card"
    >
      <div className="proj-card-top">
        <h2 className="proj-card-title">{project.title}</h2>
        <span className={`proj-status proj-status-${color}`}>{project.status}</span>
      </div>
      {project.summary && <p className="proj-card-summary">{project.summary}</p>}
      <div className="proj-card-foot">
        <ProgressBar done={done} total={total} />
        <span className="proj-open">open →</span>
      </div>
    </button>
  )
}

export function ProjectsView() {
  const { projects, projectsStatus, projectsError, notes, tracker } = useStore()
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const cards = useMemo(
    () =>
      toProjects((projects ?? []).map((p) => notes[p]).filter((n): n is Note => Boolean(n))),
    [projects, notes],
  )
  const taskNotes = useMemo(
    () => (tracker ?? []).map((p) => notes[p]).filter((n): n is Note => Boolean(n)),
    [tracker, notes],
  )
  const full = cards.length >= MAX_PROJECTS

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

  return (
    <div className="cockpit" data-testid="cockpit">
      <header className="cockpit-head">
        <div>
          <h1 className="db-title">Projects</h1>
          <p className="cockpit-sub">The big things. Open one and work inside its world.</p>
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
                  ? 'The Cockpit holds 6 projects max — finish or park one first'
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
            className="icon-btn"
            title="Refresh projects"
            onClick={() => {
              void loadProjects()
              void loadTracker()
            }}
          >
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
      ) : cards.length === 0 ? (
        <div className="db-state">
          <p className="db-state-title">No projects yet</p>
          <p className="db-state-msg">
            A project is a note tagged <code>project</code> — its tasks and notes become a
            world you can open.
          </p>
        </div>
      ) : (
        <div className="cockpit-grid">
          {cards.map((p) => (
            <ProjectCard key={p.path} project={p} taskNotes={taskNotes} />
          ))}
        </div>
      )}
    </div>
  )
}
