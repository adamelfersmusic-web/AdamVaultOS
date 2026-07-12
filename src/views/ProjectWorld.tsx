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
  createWorkTab,
  fetchProjectNotes,
  fetchWorkspaceTabs,
  loadProjects,
  setMetadata,
  toast,
  useStore,
} from '../lib/store'
import { navigate } from '../lib/router'
import { relativeTime, titleFromPath } from '../lib/format'
import { projectProgress, STATUS_COLORS, toProject, type Project } from '../domain/projects'
import { PHASES, TRACKER_DB } from '../domain/tracker'
import { inferNoteType, summaryOf, TYPE_META } from '../domain/noteType'
import { IconBack, IconPlus } from '../components/Icons'
import { DatabaseView } from './DatabaseView'
import { NotePage } from './NotePage'

// The LANDING is the default (build log PART 28/29, Adam's 1+2 pick): dead
// simple first — Continue + milestone + next 3 checkboxes — with overview/
// board/notes as quiet doors. Complexity is a room you walk into.
type Section = 'landing' | 'overview' | 'board' | 'notes' | 'docs'

export function ProjectWorld({ path }: { path: string }) {
  const { notes, projectsStatus, tracker } = useStore()
  const [section, setSection] = useState<Section>('landing')

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
        {section !== 'landing' && (
          <nav className="world-tabs" role="tablist" aria-label="Project sections">
            {(['landing', 'overview', 'board', 'notes', 'docs'] as Section[]).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={section === s}
                className={`world-tab${section === s ? ' is-active' : ''}`}
                onClick={() => setSection(s)}
              >
                {s === 'landing'
                  ? '‹ Landing'
                  : s === 'overview'
                    ? 'Overview'
                    : s === 'board'
                      ? 'Board'
                      : s === 'notes'
                        ? 'Notes'
                        : 'Docs'}
              </button>
            ))}
          </nav>
        )}
      </header>

      {section === 'landing' && (
        <WorldLanding project={project} taskNotes={taskNotes} onDoor={setSection} />
      )}

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

      {section === 'docs' && <WorldDocs projectKey={project.key} />}
    </div>
  )
}

// ——— the project's WORK DOCS (W1): tabbed working documents under desk/<key> ———

function WorldDocs({ projectKey }: { projectKey: string }) {
  const root = `desk/${projectKey}`
  const [docs, setDocs] = useState<Note[] | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    fetchWorkspaceTabs(root)
      .then((t) => {
        if (seq.current === id) setDocs(t.children)
      })
      .catch(() => {
        if (seq.current === id) setDocs([])
      })
  }, [root])

  const create = async () => {
    const title =
      name.trim() ||
      new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    if (busy) return
    setBusy(true)
    try {
      const note = await createWorkTab(root, title)
      navigate({ kind: 'pages', path: note.path }) // opens with the tab rail
    } catch (e) {
      toast('error', `Couldn’t create doc — ${e instanceof Error ? e.message : e}`)
      setBusy(false)
    }
  }

  return (
    <div className="world-docs" data-testid="world-docs">
      <div className="world-new-row">
        {newOpen ? (
          <>
            <input
              autoFocus
              className="db-search world-new-input"
              placeholder="Doc name (empty = today's date)…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create()
                if (e.key === 'Escape') setNewOpen(false)
              }}
            />
            <button className="btn btn-gold" disabled={busy} onClick={() => void create()}>
              Create
            </button>
          </>
        ) : (
          <button className="btn btn-gold" onClick={() => setNewOpen(true)} data-testid="world-new-doc">
            <IconPlus size={13} /> New work doc
          </button>
        )}
        <span className="world-notes-count">
          {docs ? `${docs.length} ${docs.length === 1 ? 'doc' : 'docs'}` : ''}
        </span>
      </div>
      <p className="today-empty world-docs-hint">
        Simple working docs — nested to-dos (<code>/todo</code>, Tab to nest), tabs on the left.
      </p>
      {docs === null ? (
        <div className="db-skeleton">
          <div className="skel-row" />
        </div>
      ) : docs.length === 0 ? null : (
        <div className="world-docs-list">
          {docs.map((d) => (
            <button
              key={d.path}
              className="note-row"
              onClick={() => navigate({ kind: 'pages', path: d.path })}
            >
              <div className="note-row-head">
                <span className="note-row-title">{titleFromPath(d.path)}</span>
                <span className="note-row-time">{relativeTime(d.updatedAt)}</span>
              </div>
              <div className="note-row-path">{d.path}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ——— the Landing: Continue + milestone + next 3 + quiet doors (1+2) ———

const phaseIdx = (n: Note): number => {
  const i = (PHASES as readonly string[]).indexOf(String(n.metadata['phase'] ?? ''))
  return i === -1 ? 99 : i
}
const stateRank = (n: Note): number => {
  const s = String(n.metadata['state'] ?? '')
  return s === 'active' ? 0 : s === 'next' ? 1 : s === 'blocked' ? 2 : 3
}
const taskLine = (n: Note): string => {
  const first = (n.content ?? n.preview ?? '')
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean)
  return first ? first.replace(/^#{1,6}\s+/, '').slice(0, 110) : titleFromPath(n.path)
}

function WorldLanding({
  project,
  taskNotes,
  onDoor,
}: {
  project: Project
  taskNotes: Note[]
  onDoor: (s: Section) => void
}) {
  // Continue = the most recently touched note in this world (its knowledge
  // tag), falling back to the project's home note. One click, zero decisions.
  const [cont, setCont] = useState<Note | null>(null)
  const [contReady, setContReady] = useState(false)
  const seq = useRef(0)
  useEffect(() => {
    const id = ++seq.current
    fetchProjectNotes(project.tag)
      .then((list) => {
        if (seq.current !== id) return
        setCont(list.find((n) => n.path !== project.path) ?? null)
        setContReady(true)
      })
      .catch(() => {
        if (seq.current === id) setContReady(true)
      })
  }, [project.tag, project.path])

  const mine = useMemo(
    () => taskNotes.filter((n) => String(n.metadata['project'] ?? '') === project.key),
    [taskNotes, project.key],
  )
  // The 3 picks PIN for the visit: checking one keeps it in place (struck
  // through — the dopamine beat) instead of teleporting a new task in.
  const [pinned, setPinned] = useState<string[] | null>(null)
  useEffect(() => {
    if (pinned !== null || mine.length === 0) return
    const picks = mine
      .filter((n) => n.metadata['done'] !== true)
      .sort((a, b) => stateRank(a) - stateRank(b) || phaseIdx(a) - phaseIdx(b))
      .slice(0, 3)
      .map((n) => n.path)
    setPinned(picks)
  }, [mine, pinned])
  const next3 = useMemo(
    () =>
      (pinned ?? [])
        .map((p) => mine.find((n) => n.path === p))
        .filter((n): n is Note => Boolean(n)),
    [pinned, mine],
  )

  // Milestone: the project note's own one-liner wins; else derive "Phase X"
  // from the earliest phase still carrying open tasks; else say nothing.
  const milestone = useMemo(() => {
    const explicit = project.note.metadata['milestone']
    if (typeof explicit === 'string' && explicit.trim()) return explicit.trim()
    const open = mine.filter((n) => n.metadata['done'] !== true && phaseIdx(n) !== 99)
    if (open.length === 0) return null
    const lead = open.sort((a, b) => phaseIdx(a) - phaseIdx(b))[0]!
    const phase = String(lead.metadata['phase'])
    const track = String(lead.metadata['track'] ?? '').trim()
    return `Phase ${phase}${track ? ` — ${track}` : ''}`
  }, [project.note, mine])

  const openContinue = () => {
    const target = cont?.path ?? project.home
    navigate(
      target.startsWith('pages/') || target.startsWith('desk/')
        ? { kind: 'pages', path: target }
        : { kind: 'note', path: target },
    )
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
    <div className="landing" data-testid="landing">
      <button className="landing-continue" onClick={openContinue} disabled={!contReady}>
        <span className="landing-continue-play">▶</span>
        <span className="landing-continue-body">
          <span className="landing-continue-label">Continue</span>
          <span className="landing-continue-title">
            {contReady ? titleFromPath(cont?.path ?? project.home) : '…'}
          </span>
        </span>
        {cont && (
          <span className="landing-continue-time">{relativeTime(cont.updatedAt)}</span>
        )}
      </button>

      {milestone && (
        <p className="landing-milestone">
          <span className="landing-milestone-label">Where we are</span>
          {milestone}
        </p>
      )}

      <div className="landing-next">
        <div className="landing-label">Next here</div>
        {next3.length === 0 ? (
          <p className="landing-empty">Nothing queued. The board’s behind the door.</p>
        ) : (
          next3.map((n) => (
            <div
              key={n.path}
              className={`landing-item${n.metadata['done'] === true ? ' is-done' : ''}`}
            >
              <input
                type="checkbox"
                checked={n.metadata['done'] === true}
                onChange={() => toggleDone(n)}
                aria-label={taskLine(n)}
              />
              <button
                className="landing-item-title"
                onClick={() => navigate({ kind: 'pages', path: n.path })}
                title={n.path}
              >
                {taskLine(n)}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="landing-doors">
        <button onClick={() => onDoor('overview')}>overview</button>
        <span>·</span>
        <button onClick={() => onDoor('board')}>board</button>
        <span>·</span>
        <button onClick={() => onDoor('notes')}>notes</button>
        <span>·</span>
        <button onClick={() => onDoor('docs')}>docs</button>
      </div>
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
