// The Cockpit — the app's front door. A calm deck of project cards (title,
// one-liner, status, live task progress), each opening into its world.
// Composition over construction: cards derive entirely from `project`-tagged
// notes + the already-loaded tracker slice. Build log PART 22.

import { useMemo } from 'react'
import type { Note } from '../lib/types'
import { loadProjects, loadTracker, useStore } from '../lib/store'
import { navigate } from '../lib/router'
import { projectProgress, STATUS_COLORS, toProjects, type Project } from '../domain/projects'
import { IconRefresh } from '../components/Icons'

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

  const cards = useMemo(
    () =>
      toProjects((projects ?? []).map((p) => notes[p]).filter((n): n is Note => Boolean(n))),
    [projects, notes],
  )
  const taskNotes = useMemo(
    () => (tracker ?? []).map((p) => notes[p]).filter((n): n is Note => Boolean(n)),
    [tracker, notes],
  )

  return (
    <div className="cockpit" data-testid="cockpit">
      <header className="cockpit-head">
        <div>
          <h1 className="db-title">Projects</h1>
          <p className="cockpit-sub">The big things. Open one and work inside its world.</p>
        </div>
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
      </header>

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
