// A project's WORLD — everything about one big thing in one place.
// Header (title · status · live progress) + three sections:
//   Overview — the project's front-door note, rendered (backlinks and all)
//   Board    — the Tracker scoped to this project (drag between lanes works)
//   Notes    — the project's knowledge notes, master-detail style, with
//              create-in-world (“＋ New note” born carrying the project tag)
// Composition of shipped pieces: NotePage, DatabaseView(presetFilter), NoteRow
// patterns. Build log PART 22.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import {
  createPage,
  createTask,
  fetchProjectNotes,
  loadProjects,
  toast,
  useStore,
} from '../lib/store'
import { navigate } from '../lib/router'
import { relativeTime, titleFromPath } from '../lib/format'
import { projectProgress, STATUS_COLORS, toProject } from '../domain/projects'
import { TRACKER_DB } from '../domain/tracker'
import { inferNoteType, summaryOf, TYPE_META } from '../domain/noteType'
import { IconBack, IconPlus } from '../components/Icons'
import { DatabaseView } from './DatabaseView'
import { NotePage } from './NotePage'

type Section = 'overview' | 'board' | 'notes'

export function ProjectWorld({ path }: { path: string }) {
  const { notes, projectsStatus, tracker } = useStore()
  const [section, setSection] = useState<Section>('overview')

  // Direct deep-link: make sure the project deck is loaded.
  useEffect(() => {
    if (projectsStatus === 'idle') void loadProjects()
  }, [projectsStatus])

  const note = notes[path]
  const project = useMemo(() => (note ? toProject(note) : null), [note])
  const taskNotes = useMemo(
    () => (tracker ?? []).map((p) => notes[p]).filter((n): n is Note => Boolean(n)),
    [tracker, notes],
  )

  if (!project) {
    return projectsStatus === 'error' || projectsStatus === 'ready' ? (
      <div className="db-state">
        <p className="db-state-title">Project not found</p>
        <p className="db-state-msg">
          No project note at <code>{path}</code>.
        </p>
        <button className="btn btn-gold" onClick={() => navigate({ kind: 'projects' })}>
          All projects
        </button>
      </div>
    ) : (
      <div className="db-skeleton" aria-label="Loading">
        <div className="skel-row" />
        <div className="skel-row" />
      </div>
    )
  }

  const { done, total } = projectProgress(project.key, taskNotes)
  const pct = total ? Math.round((done / total) * 100) : 0
  const statusColor = STATUS_COLORS[project.status] ?? 'neutral'

  return (
    <div className="world" data-testid="world">
      <header className="world-head">
        <button className="canvas-back" onClick={() => navigate({ kind: 'projects' })}>
          <IconBack size={13} /> Projects
        </button>
        <h1 className="world-title">{project.title}</h1>
        <span className={`proj-status proj-status-${statusColor}`}>{project.status}</span>
        {total > 0 && (
          <span className="world-progress" title={`${done}/${total} tasks done`}>
            <i className="proj-progress-track world-progress-track">
              <i className="proj-progress-fill" style={{ width: `${pct}%` }} />
            </i>
            {pct}%
          </span>
        )}
        <nav className="world-tabs" role="tablist" aria-label="Project sections">
          {(['overview', 'board', 'notes'] as Section[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={section === s}
              className={`world-tab${section === s ? ' is-active' : ''}`}
              onClick={() => setSection(s)}
            >
              {s === 'overview' ? 'Overview' : s === 'board' ? 'Board' : 'Notes'}
            </button>
          ))}
        </nav>
      </header>

      {section === 'overview' && (
        <div className="world-overview">
          <NotePage path={project.home} key={project.home} />
        </div>
      )}

      {section === 'board' && (
        <div className="world-board">
          <WorldNewTask projectKey={project.key} />
          <DatabaseView
            def={TRACKER_DB}
            dataset="tracker"
            embedded
            presetFilter={{ project: [project.key] }}
          />
        </div>
      )}

      {section === 'notes' && <WorldNotes project={project} notesCache={notes} />}
    </div>
  )
}

// ——— ＋ New task, born inside this world ———

function WorldNewTask({ projectKey }: { projectKey: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const t = title.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      const note = await createTask(projectKey, t)
      // Straight into row-as-page to set phase/track/owner/state.
      navigate({ kind: 'pages', path: note.path })
    } catch (e) {
      toast('error', `Couldn’t create task — ${e instanceof Error ? e.message : e}`)
      setBusy(false)
    }
  }

  return (
    <div className="world-newtask">
      {open ? (
        <div className="world-new-row">
          <input
            autoFocus
            className="db-search world-new-input"
            placeholder="Task title — Enter to create…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
              if (e.key === 'Escape') setOpen(false)
            }}
          />
          <button className="btn btn-gold" disabled={busy || !title.trim()} onClick={() => void submit()}>
            Create
          </button>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-gold" onClick={() => setOpen(true)} data-testid="world-new-task">
          <IconPlus size={13} /> New task
        </button>
      )}
    </div>
  )
}

// ——— the project's notes: list | detail, with create-in-world ———

function WorldNotes({
  project,
  notesCache,
}: {
  project: { tag: string; path: string }
  notesCache: Record<string, Note>
}) {
  const [list, setList] = useState<Note[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    setError(null)
    fetchProjectNotes(project.tag)
      .then((all) => {
        if (seq.current === id) setList(all.filter((n) => n.path !== project.path))
      })
      .catch((e) => {
        if (seq.current === id) setError(e instanceof Error ? e.message : String(e))
      })
  }, [project.tag, project.path])

  const createNote = async () => {
    const t = newTitle.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      const note = await createPage({ title: t, extraTags: [project.tag] })
      setList((prev) => [note, ...(prev ?? [])])
      setSelected(note.path)
      setNewOpen(false)
      setNewTitle('')
    } catch (e) {
      toast('error', `Couldn’t create note — ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`world-notes${selected ? ' has-detail' : ''}`}>
      <div className="world-notes-list">
        <div className="world-new-row">
          {newOpen ? (
            <>
              <input
                autoFocus
                className="db-search world-new-input"
                placeholder="Note title — Enter to create…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createNote()
                  if (e.key === 'Escape') setNewOpen(false)
                }}
              />
              <button className="btn btn-gold" disabled={busy || !newTitle.trim()} onClick={() => void createNote()}>
                Create
              </button>
            </>
          ) : (
            <button className="btn btn-gold" onClick={() => setNewOpen(true)} data-testid="world-new-note">
              <IconPlus size={13} /> New note
            </button>
          )}
          <span className="world-notes-count">
            {list ? `${list.length} ${list.length === 1 ? 'note' : 'notes'} · #${project.tag}` : ''}
          </span>
        </div>

        {error ? (
          <div className="db-state">
            <p className="db-state-msg">{error}</p>
          </div>
        ) : list === null ? (
          <div className="db-skeleton">
            <div className="skel-row" />
            <div className="skel-row" />
          </div>
        ) : list.length === 0 ? (
          <p className="pages-side-empty">No notes carry #{project.tag} yet.</p>
        ) : (
          list.map((n) => {
            const cached = notesCache[n.path] ?? n
            const tmeta = TYPE_META[inferNoteType(cached)]
            const summary = summaryOf(cached)
            return (
              <button
                key={n.path}
                className={`note-row${selected === n.path ? ' is-selected' : ''}`}
                onClick={() => setSelected(n.path)}
              >
                <div className="note-row-head">
                  <span className="note-row-title">
                    <span className={`type-dot type-dot-${tmeta.color}`} title={tmeta.label} />
                    {titleFromPath(n.path)}
                  </span>
                  <span className="note-row-time">{relativeTime(n.updatedAt)}</span>
                </div>
                <div className="note-row-path">{n.path}</div>
                {summary && <div className="note-row-preview">{summary}</div>}
              </button>
            )
          })
        )}
      </div>

      {selected && (
        <section className="browser-detail world-detail">
          <div className="browser-detail-bar">
            <span className="browser-detail-path" title={selected}>
              {selected}
            </span>
            <div className="browser-detail-actions">
              <button
                className="detail-btn"
                onClick={() => navigate({ kind: 'pages', path: selected })}
                title="Open full-screen editor"
              >
                Open ↗
              </button>
              <button className="detail-btn" onClick={() => setSelected(null)} aria-label="Close">
                ✕
              </button>
            </div>
          </div>
          <div className="browser-detail-body">
            <NotePage path={selected} key={selected} />
          </div>
        </section>
      )}
    </div>
  )
}
