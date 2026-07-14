// THE TASKS TAB — a Craft-style daily driver over the vault's task notes
// (tasks/<project>/<slug>, tag `task`). Four lenses on the same truth:
//
//   Inbox    — unfiled brain-pops (no metadata.project), due-dated first
//   Today    — the ONE shared merged-today rule (domain/tasks.ts): picked
//              when:"today" + anything due today/overdue, grouped by world
//   Upcoming — an agenda by day; the next 7 days render EVEN WHEN EMPTY
//              (an empty day is signal, not noise)
//   All      — Inbox first, then a collapsible group per world
//
// Every list shows only open work. Done tasks are NOT shown anywhere here —
// the Tracker is the archive/ops table, and per Adam's law (2026-07-14) it in
// turn never sees UNFILED tasks: filing to a world is the promotion gesture.
// Checking a row off writes done:true through the house setMetadata path
// (undo toast included) and the row animates out gracefully.

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { Note } from '../lib/types'
import {
  createTask,
  loadProjects,
  loadTracker,
  setMetadata,
  toast,
  useStore,
} from '../lib/store'
import { navigate } from '../lib/router'
import { dueTone, formatDue, ymd } from '../lib/dates'
import { mergedTodayTasks, taskDue, taskProject, taskTitle } from '../domain/tasks'
import { toProjects, type Project } from '../domain/projects'
import { MonthPicker } from '../components/MonthPicker'
import { IconPlus } from '../components/Icons'

// ————————————————————————— persistence keys —————————————————————————

const CHIP_KEY = 'adamvaultos.tasks.chip'
const COLLAPSE_KEY = 'adamvaultos.tasks.collapsed'

type ChipKind = 'inbox' | 'today' | 'upcoming' | 'all'
const CHIPS: { key: ChipKind; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
]

function loadChip(): ChipKind {
  const raw = localStorage.getItem(CHIP_KEY)
  return raw === 'inbox' || raw === 'today' || raw === 'upcoming' || raw === 'all'
    ? raw
    : 'today'
}

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

// ————————————————————————— shaping helpers —————————————————————————

const byCreated = (a: Note, b: Note) => (a.createdAt < b.createdAt ? -1 : 1)

/** Due-dated first ascending, then created order — the Inbox sort. */
function sortDueFirst(list: Note[]): Note[] {
  const dued = list.filter((n) => taskDue(n)).sort((a, b) => {
    const da = taskDue(a)!
    const db = taskDue(b)!
    return da < db ? -1 : da > db ? 1 : byCreated(a, b)
  })
  const rest = list.filter((n) => !taskDue(n)).sort(byCreated)
  return [...dued, ...rest]
}

interface WorldGroup {
  /** metadata.project value; null = the unfiled Inbox bucket. */
  key: string | null
  title: string
  /** World-page path for header/source-chip navigation (null for Inbox). */
  path: string | null
  tasks: Note[]
}

/** Craft's group anatomy: 'Inbox' (unfiled) first, then one group per world —
 * known worlds in Cockpit order, unknown keys alphabetically after. Empty
 * groups are dropped (emptiness is only signal on the Upcoming agenda). */
function groupByWorld(list: Note[], worlds: Project[]): WorldGroup[] {
  const buckets = new Map<string | null, Note[]>()
  for (const n of list) {
    const key = taskProject(n)
    const arr = buckets.get(key)
    if (arr) arr.push(n)
    else buckets.set(key, [n])
  }
  const groups: WorldGroup[] = []
  const inbox = buckets.get(null)
  if (inbox) groups.push({ key: null, title: 'Inbox', path: null, tasks: inbox })
  const claimed = new Set<string>()
  for (const w of worlds) {
    const tasks = buckets.get(w.key)
    claimed.add(w.key)
    if (tasks) groups.push({ key: w.key, title: w.title, path: w.path, tasks })
  }
  const strays = [...buckets.keys()]
    .filter((k): k is string => k !== null && !claimed.has(k))
    .sort()
  for (const k of strays) {
    groups.push({
      key: k,
      title: k.charAt(0).toUpperCase() + k.slice(1),
      path: `projects/${k}`,
      tasks: buckets.get(k)!,
    })
  }
  return groups
}

// ————————————————————————— the view —————————————————————————

export function TasksView() {
  const { tracker, trackerStatus, trackerError, projects, projectsStatus, notes } =
    useStore()
  const [chip, setChipState] = useState<ChipKind>(loadChip)
  // Done rows linger briefly (is-leaving) so checking off feels like a
  // graceful exit, not a teleport. The vault write fires immediately.
  const [leaving, setLeaving] = useState<Record<string, boolean>>({})
  const leaveTimers = useRef<number[]>([])

  useEffect(() => {
    if (trackerStatus === 'idle') void loadTracker()
    if (projectsStatus === 'idle') void loadProjects()
  }, [trackerStatus, projectsStatus])
  useEffect(
    () => () => leaveTimers.current.forEach((t) => window.clearTimeout(t)),
    [],
  )

  const setChip = (c: ChipKind) => {
    setChipState(c)
    localStorage.setItem(CHIP_KEY, c)
  }

  const worlds = useMemo(
    () => toProjects((projects ?? []).map((p) => notes[p]).filter((n): n is Note => Boolean(n))),
    [projects, notes],
  )
  const worldByKey = useMemo(() => {
    const m = new Map<string, Project>()
    for (const w of worlds) if (!m.has(w.key)) m.set(w.key, w)
    return m
  }, [worlds])

  const taskNotes = useMemo(
    () => (tracker ?? []).map((p) => notes[p]).filter((n): n is Note => Boolean(n)),
    [tracker, notes],
  )
  // Open work only — except rows mid-exit, which stay put while they fade.
  const openTasks = useMemo(
    () => taskNotes.filter((n) => n.metadata['done'] !== true || leaving[n.path]),
    [taskNotes, leaving],
  )

  const toggleDone = (n: Note) => {
    const done = n.metadata['done'] === true
    if (!done) {
      setLeaving((l) => ({ ...l, [n.path]: true }))
      leaveTimers.current.push(
        window.setTimeout(() => {
          setLeaving((l) => {
            const next = { ...l }
            delete next[n.path]
            return next
          })
        }, 460),
      )
    }
    void setMetadata(
      n.path,
      { done: !done, state: done ? 'active' : 'done' },
      { undo: { done, state: String(n.metadata['state'] ?? 'next') } },
    )
  }

  const openTask = (path: string) => navigate({ kind: 'pages', path })
  const openWorld = (g: { key: string | null; path: string | null }) => {
    if (g.path) navigate({ kind: 'project', path: g.path })
  }

  // ——— one row, everywhere: check · title (+due) · source chip ———
  const Row = ({ n, showDue = true }: { n: Note; showDue?: boolean }) => {
    const done = n.metadata['done'] === true
    const due = taskDue(n)
    const key = taskProject(n)
    const world = key ? worldByKey.get(key) : undefined
    return (
      <div
        className={`task-row${done ? ' is-done' : ''}${done && leaving[n.path] ? ' is-leaving' : ''}`}
        data-testid="task-row"
        data-path={n.path}
      >
        <input
          type="checkbox"
          className="task-check"
          checked={done}
          onChange={() => toggleDone(n)}
          aria-label={taskTitle(n)}
        />
        <button className="task-row-main" onClick={() => openTask(n.path)} title={n.path}>
          <span className="task-row-title">{taskTitle(n)}</span>
          {showDue && due && (
            <span className={`task-row-due due-${dueTone(due)}`} data-testid="task-due" title={due}>
              {formatDue(due)}
            </span>
          )}
        </button>
        {key ? (
          <button
            className="task-src"
            data-testid="task-src"
            title={`Open the ${world?.title ?? key} world`}
            onClick={() =>
              navigate({ kind: 'project', path: world?.path ?? `projects/${key}` })
            }
          >
            {world?.title ?? key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ) : (
          // Inbox chip is a label, not a door — there's no world to open.
          <span className="task-src is-inbox" data-testid="task-src">
            Inbox
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="tasks" data-testid="tasks-view">
      <header className="tasks-head">
        <h1 className="db-title">Tasks</h1>
        <div className="tasks-chips" data-testid="tasks-chips" role="tablist" aria-label="Task lists">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              role="tab"
              aria-selected={chip === c.key}
              className={`tasks-chip${chip === c.key ? ' is-on' : ''}`}
              onClick={() => setChip(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>

      {trackerStatus === 'error' ? (
        <div className="db-state">
          <p className="db-state-title">Couldn’t load the vault</p>
          <p className="db-state-msg">{trackerError}</p>
          <button className="btn btn-gold" onClick={() => void loadTracker()}>
            Try again
          </button>
        </div>
      ) : trackerStatus !== 'ready' ? (
        <div className="db-skeleton" aria-label="Loading">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="skel-row" key={i} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      ) : (
        <div className="tasks-body">
          {chip === 'inbox' && <InboxList tasks={openTasks} Row={Row} />}
          {chip === 'today' && (
            <TodayList tasks={taskNotes} leaving={leaving} worlds={worlds} Row={Row} onHeader={openWorld} />
          )}
          {chip === 'upcoming' && <UpcomingList tasks={openTasks} Row={Row} />}
          {chip === 'all' && (
            <AllList tasks={openTasks} worlds={worlds} Row={Row} onHeader={openWorld} />
          )}
        </div>
      )}

      <QuickCreate worlds={worlds} />
    </div>
  )
}

type RowRenderer = (props: { n: Note; showDue?: boolean }) => ReactElement

// ————————————————————————— Inbox —————————————————————————

function InboxList({ tasks, Row }: { tasks: Note[]; Row: RowRenderer }) {
  const unfiled = useMemo(
    () => sortDueFirst(tasks.filter((n) => !taskProject(n))),
    [tasks],
  )
  if (unfiled.length === 0) {
    return <p className="tasks-empty">Inbox zero. Type a thought below to capture one.</p>
  }
  return (
    <section className="tasks-group" data-testid="tasks-group" data-group="inbox">
      {unfiled.map((n) => (
        <Row key={n.path} n={n} />
      ))}
    </section>
  )
}

// ————————————————————————— Today —————————————————————————

function TodayList({
  tasks,
  leaving,
  worlds,
  Row,
  onHeader,
}: {
  tasks: Note[]
  leaving: Record<string, boolean>
  worlds: Project[]
  Row: RowRenderer
  onHeader: (g: WorldGroup) => void
}) {
  // The shared merged-today rule (identical to the Cockpit's TodayStrip),
  // then open-only — done rows leave the day (mid-exit rows linger).
  const todays = useMemo(
    () =>
      mergedTodayTasks(tasks).filter(
        (n) => n.metadata['done'] !== true || leaving[n.path],
      ),
    [tasks, leaving],
  )
  const groups = useMemo(() => groupByWorld(todays, worlds), [todays, worlds])
  if (groups.length === 0) {
    return <p className="tasks-empty">Nothing claimed today yet — a clear morning.</p>
  }
  return (
    <>
      {groups.map((g) => (
        <section
          key={g.key ?? 'inbox'}
          className="tasks-group"
          data-testid="tasks-group"
          data-group={g.key ?? 'inbox'}
        >
          {g.path ? (
            <button
              className="tasks-group-head is-link"
              data-testid="tasks-group-head"
              onClick={() => onHeader(g)}
              title={`Open the ${g.title} world`}
            >
              {g.title}
              <span className="tasks-group-count">{g.tasks.length}</span>
            </button>
          ) : (
            <div className="tasks-group-head" data-testid="tasks-group-head">
              {g.title}
              <span className="tasks-group-count">{g.tasks.length}</span>
            </div>
          )}
          {g.tasks.map((n) => (
            <Row key={n.path} n={n} />
          ))}
        </section>
      ))}
    </>
  )
}

// ————————————————————————— Upcoming —————————————————————————

function UpcomingList({ tasks, Row }: { tasks: Note[]; Row: RowRenderer }) {
  const now = new Date()
  const dayKey = (offset: number) =>
    ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset))
  const todayK = dayKey(0)
  const horizonK = dayKey(7)

  const { overdue, byDue, beyond, thisWeek } = useMemo(() => {
    const dued = tasks.filter((n) => taskDue(n))
    const byDue = new Map<string, Note[]>()
    for (const n of dued) {
      const d = taskDue(n)!
      const arr = byDue.get(d)
      if (arr) arr.push(n)
      else byDue.set(d, [n])
    }
    for (const arr of byDue.values()) arr.sort(byCreated)
    const overdue = sortDueFirst(dued.filter((n) => taskDue(n)! < todayK))
    const beyond = [...byDue.keys()].filter((d) => d > horizonK).sort()
    // The coarse layer's tail: blessed for the week but not yet dated.
    const thisWeek = tasks
      .filter((n) => !taskDue(n) && n.metadata['when'] === 'this-week')
      .sort(byCreated)
    return { overdue, byDue, beyond, thisWeek }
  }, [tasks, todayK, horizonK])

  return (
    <>
      {overdue.length > 0 && (
        <section className="tasks-day" data-testid="tasks-day" data-day="overdue">
          <div className="tasks-day-head is-overdue" data-testid="tasks-day-head">
            Overdue
          </div>
          {overdue.map((n) => (
            <Row key={n.path} n={n} />
          ))}
        </section>
      )}
      {/* Today + the next 7 days ALWAYS render — an empty day under its
          header is the calendar telling you it's clear. */}
      {Array.from({ length: 8 }, (_, i) => dayKey(i)).map((d) => {
        const dayTasks = byDue.get(d) ?? []
        return (
          <section className="tasks-day" data-testid="tasks-day" data-day={d} key={d}>
            <div className="tasks-day-head" data-testid="tasks-day-head">
              {formatDue(d)}
            </div>
            {dayTasks.length === 0 ? (
              <div className="tasks-day-empty" aria-label="Nothing due">
                —
              </div>
            ) : (
              dayTasks.map((n) => <Row key={n.path} n={n} showDue={false} />)
            )}
          </section>
        )
      })}
      {/* Past the horizon, only days that actually hold something. */}
      {beyond.map((d) => (
        <section className="tasks-day" data-testid="tasks-day" data-day={d} key={d}>
          <div className="tasks-day-head" data-testid="tasks-day-head">
            {formatDue(d)}
          </div>
          {byDue.get(d)!.map((n) => (
            <Row key={n.path} n={n} showDue={false} />
          ))}
        </section>
      ))}
      {thisWeek.length > 0 && (
        <section className="tasks-day" data-testid="tasks-day" data-day="this-week">
          <div className="tasks-day-head is-undated" data-testid="tasks-day-head">
            This week — no date
          </div>
          {thisWeek.map((n) => (
            <Row key={n.path} n={n} />
          ))}
        </section>
      )}
    </>
  )
}

// ————————————————————————— All —————————————————————————

const GROUP_PREVIEW = 10

function AllList({
  tasks,
  worlds,
  Row,
  onHeader,
}: {
  tasks: Note[]
  worlds: Project[]
  Row: RowRenderer
  onHeader: (g: WorldGroup) => void
}) {
  // Done tasks are deliberately absent here — the Tracker is the archive and
  // ops table; this list is only ever "what's still open, by world".
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const groups = useMemo(
    () => groupByWorld(sortDueFirst(tasks), worlds),
    [tasks, worlds],
  )

  const toggleCollapse = (id: string) => {
    setCollapsed((c) => {
      const next = { ...c, [id]: !c[id] }
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next))
      } catch {
        /* storage full — collapse is a nicety */
      }
      return next
    })
  }

  if (groups.length === 0) {
    return <p className="tasks-empty">No open tasks anywhere. Savor it.</p>
  }
  return (
    <>
      {groups.map((g) => {
        const id = g.key ?? 'inbox'
        const isCollapsed = collapsed[id] === true
        const isExpanded = expanded[id] === true
        const shown = isExpanded ? g.tasks : g.tasks.slice(0, GROUP_PREVIEW)
        const hidden = g.tasks.length - shown.length
        return (
          <section
            key={id}
            className="tasks-group"
            data-testid="tasks-group"
            data-group={id}
          >
            <div className="tasks-group-row">
              <button
                className="tasks-collapse"
                data-testid="tasks-collapse"
                aria-label={isCollapsed ? `Expand ${g.title}` : `Collapse ${g.title}`}
                aria-expanded={!isCollapsed}
                onClick={() => toggleCollapse(id)}
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
              {g.path ? (
                <button
                  className="tasks-group-head is-link"
                  data-testid="tasks-group-head"
                  onClick={() => onHeader(g)}
                  title={`Open the ${g.title} world`}
                >
                  {g.title}
                  <span className="tasks-group-count">{g.tasks.length}</span>
                </button>
              ) : (
                <div className="tasks-group-head" data-testid="tasks-group-head">
                  {g.title}
                  <span className="tasks-group-count">{g.tasks.length}</span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <>
                {shown.map((n) => (
                  <Row key={n.path} n={n} />
                ))}
                {hidden > 0 && (
                  <button
                    className="tasks-more"
                    data-testid="tasks-more"
                    onClick={() => setExpanded((e) => ({ ...e, [id]: true }))}
                  >
                    {hidden} more
                  </button>
                )}
              </>
            )}
          </section>
        )
      })}
    </>
  )
}

// ————————————————————————— quick create —————————————————————————

function QuickCreate({ worlds }: { worlds: Project[] }) {
  const [dest, setDest] = useState('') // '' = Inbox (unfiled)
  const [text, setText] = useState('')
  // The date chip defaults to Tomorrow — the calm default for a new thought.
  const [due, setDue] = useState<string | null>(() => {
    const now = new Date()
    return ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const chipRef = useRef<HTMLButtonElement>(null)

  const create = async () => {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      // A due of today claims the day; otherwise the task waits on 'later'.
      const when = due && dueTone(due) === 'today' ? 'today' : 'later'
      await createTask(dest || null, t, { when, ...(due ? { due } : {}) })
      setText('')
      toast('success', dest ? `Task filed to ${dest}` : 'Task captured to Inbox')
    } catch (e) {
      toast('error', `Couldn’t create task — ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tasks-qc" data-testid="qc-bar">
      <select
        className="tasks-qc-dest"
        data-testid="qc-dest"
        value={dest}
        onChange={(e) => setDest(e.target.value)}
        aria-label="Destination"
        title="Where this task lands"
      >
        <option value="">Inbox ▾</option>
        {worlds.map((w) => (
          <option key={w.key} value={w.key}>
            {w.title}
          </option>
        ))}
      </select>
      {/* Deliberately NO natural-language date parsing here — 'call venue
          friday' stays exactly that text. The date chip is the only date
          entry: predictable > clever (v1 law). */}
      <input
        className="tasks-qc-input"
        data-testid="qc-input"
        placeholder="New task…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void create()}
      />
      <button
        ref={chipRef}
        className={`tasks-qc-due${due ? ` due-${dueTone(due)}` : ' is-unset'}`}
        data-testid="qc-due-chip"
        title="Due date"
        onClick={() => setPickerOpen((o) => !o)}
      >
        {due ? formatDue(due) : 'No date'}
      </button>
      {pickerOpen && chipRef.current && (
        <MonthPicker
          anchor={chipRef.current}
          value={due}
          onPick={setDue}
          onClear={() => setDue(null)}
          onClose={() => setPickerOpen(false)}
        />
      )}
      <button
        className="btn btn-gold tasks-qc-create"
        data-testid="qc-create"
        disabled={busy || !text.trim()}
        onClick={() => void create()}
      >
        <IconPlus size={13} />
        Create
      </button>
    </div>
  )
}
