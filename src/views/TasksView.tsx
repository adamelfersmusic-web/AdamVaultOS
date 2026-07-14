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
//
// CRAFT PHASE B — LIVE CHECKBOXES: loose `- [ ]` lines inside ordinary notes
// join these lists too ("In your notes" on All; due-dated ones on Today and
// Upcoming), toggle IN PLACE via surgicalLineEdit, and can be PROMOTED into
// real tasks/* rows (the ↗ affordance). No dual bookkeeping — see
// domain/looseTasks.ts for the law.

import { Fragment, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { Note } from '../lib/types'
import {
  createTask,
  loadProjects,
  loadTracker,
  persistTaskOrder,
  promoteLooseTask,
  setLooseTaskDue,
  setMetadata,
  toast,
  toggleLooseTask,
  useStore,
} from '../lib/store'
import { cachedCorpus, corpusFresh, refreshCorpus } from '../lib/corpus'
import { navigate } from '../lib/router'
import { dueTone, formatDue, ymd } from '../lib/dates'
import {
  mergedTodayTasks,
  orderFirst,
  taskDue,
  taskProject,
  taskTitle,
} from '../domain/tasks'
import {
  groupLooseByNote,
  scanLooseTasks,
  type LooseNoteGroup,
  type LooseTask,
} from '../domain/looseTasks'
import { toProjects, type Project } from '../domain/projects'
import { ringOf, type CheckboxRing } from '../domain/checkboxRing'
import { ProgressRing } from '../components/ProgressRing'
import { MonthPicker } from '../components/MonthPicker'
import { Popover } from '../components/Popover'
import { IconCalendar, IconPlus } from '../components/Icons'

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

// ——— ROW DRAG & DROP — the house DnD (WorkTabs/Shelves pattern): native
// HTML5, payload in dataTransfer with a module mirror for dragover (which
// can't read dataTransfer in protected mode), a thin gold insertion line,
// window-level dragend sweep. Dropping is the ONLY gesture that writes; a
// cancelled drag (Escape / let go outside) leaves no trace. Dragging is a
// pointer-only enhancement — dates, promote, checkboxes, filing all stay
// button-reachable, so no functionality is exclusive to it. ———

type RowDragPayload = { kind: 'taskrow'; path: string; group: string }

const ROW_DND_MIME = 'application/x-adamvaultos-taskrow-dnd'
let liveRowDrag: RowDragPayload | null = null

function isRowDragPayload(p: unknown): p is RowDragPayload {
  if (!p || typeof p !== 'object') return false
  const d = p as Record<string, unknown>
  return d.kind === 'taskrow' && typeof d.path === 'string' && typeof d.group === 'string'
}

/** Drop-time payload: dataTransfer JSON when it parses, else the live mirror. */
function readRowDragPayload(e: React.DragEvent): RowDragPayload | null {
  try {
    const raw = e.dataTransfer.getData(ROW_DND_MIME)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isRowDragPayload(parsed)) return parsed
    }
  } catch {
    // fall through to the mirror
  }
  return liveRowDrag
}

/** Top or bottom half of the hovered row → insert before it or after it. */
function slotFor(e: React.DragEvent, index: number): number {
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientY > r.top + r.height / 2 ? index + 1 : index
}

/** Handlers a draggable row wires up (undefined = not draggable, e.g. the
 * Upcoming agenda and every loose line — their home orders them). */
interface RowDrag {
  group: string
  onOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
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

  // ——— row-level date affordance: ONE MonthPicker, anchored per row.
  // `write(null)` = Clear date → the key/token is REMOVED, never nulled. ———
  const [datePick, setDatePick] = useState<{
    anchor: HTMLElement
    value: string | null
    write: (due: string | null) => void
  } | null>(null)

  // Reorder hover slot (per group; a gold line renders there). Window-level
  // dragend/drop is the safety net for cancelled drags.
  const [dropSlot, setDropSlot] = useState<{ group: string; slot: number } | null>(null)
  useEffect(() => {
    const clear = () => setDropSlot(null)
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

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
  /** House note-opening rule (same as the Omnibar/Library). */
  const openLooseNote = (path: string) =>
    navigate(path.startsWith('pages/') ? { kind: 'pages', path } : { kind: 'note', path })

  /** Row task date: metadata.due via the house setMetadata path. Clearing
   * REMOVES the key (null = merge-patch deletion) — never due:null/''. */
  const pickRowDate = (n: Note, anchor: HTMLElement) => {
    const prev = taskDue(n)
    setDatePick({
      anchor,
      value: prev,
      write: (due) => {
        if (due === prev) return
        void setMetadata(n.path, { due }, { undo: { due: prev } })
      },
    })
  }

  /** Loose line date: rewrite the trailing `📅 YYYY-MM-DD` token via the
   * loose-task machinery (surgicalLineEdit — byte-exact elsewhere). */
  const pickLooseDate = (t: LooseTask, anchor: HTMLElement) => {
    setDatePick({
      anchor,
      value: t.due ?? null,
      write: (due) => {
        if (due === (t.due ?? null)) return
        void setLooseTaskDue(t, due).catch((e) => {
          toast('error', `Couldn’t save — ${e instanceof Error ? e.message : e}`)
        })
      },
    })
  }

  /** THE PHYSICAL PROMOTION GESTURE — dropping a row into another world group
   * re-files it: metadata.project set to the world key, REMOVED for Inbox
   * (null = merge-patch deletion). Tracker inclusion follows automatically
   * from Adam's law (isFiledTask) — nothing else to write. */
  const refileTask = (path: string, key: string | null) => {
    const n = notes[path]
    if (!n) return
    const prev = taskProject(n)
    if (prev === key) return
    void setMetadata(path, { project: key }, { undo: { project: prev } })
  }

  // ——— Craft Phase B: loose checkboxes living inside ordinary notes ———

  // The shared 60s corpus (lib/corpus.ts — the Omnibar's cache, not a fork).
  // No refresh affordance by design: the same staleness rule re-fetches.
  const [corpus, setCorpus] = useState<Note[] | null>(() => cachedCorpus())
  useEffect(() => {
    let alive = true
    if (!corpusFresh()) {
      refreshCorpus()
        .then((list) => {
          if (alive) setCorpus(list)
        })
        .catch(() => {
          /* the loose section stays quiet; the row lists still work */
        })
    }
    return () => {
      alive = false
    }
  }, [])

  // The corpus with the store's fresher note bodies overlaid — so a toggle
  // (ours, or a Pages-editor save) shows up the moment it merges instead of
  // waiting out the staleness window.
  const mergedCorpus = useMemo(() => {
    if (!corpus) return null
    return corpus.map((n) => {
      const live = notes[n.path]
      return live && live.content !== undefined && live.updatedAt > n.updatedAt
        ? live
        : n
    })
  }, [corpus, notes])

  // Scan memoized on the merged corpus reference.
  const loose = useMemo(
    () => (mergedCorpus ? scanLooseTasks(mergedCorpus) : []),
    [mergedCorpus],
  )

  // The note-group headers' progress rings — the WHOLE note's checkbox tally
  // (done included; no think-space excludes), from the same merged corpus.
  const ringFor = useMemo(() => {
    const byPath = new Map<string, string>()
    for (const n of mergedCorpus ?? []) {
      if (typeof n.content === 'string') byPath.set(n.path, n.content)
    }
    return (path: string): CheckboxRing | null => ringOf(byPath.get(path) ?? '')
  }, [mergedCorpus])

  // Optimistic checkbox state, keyed by line. An entry exists only while the
  // vault hasn't confirmed the flip; once the scan agrees, it's pruned.
  const [looseFlips, setLooseFlips] = useState<Record<string, boolean>>({})
  const [looseLeaving, setLooseLeaving] = useState<Record<string, boolean>>({})
  const looseKey = (t: LooseTask) => `${t.notePath}#${t.lineIndex}`
  useEffect(() => {
    setLooseFlips((f) => {
      let changed = false
      const next = { ...f }
      for (const t of loose) {
        const k = `${t.notePath}#${t.lineIndex}`
        if (k in next && next[k] === t.checked) {
          delete next[k]
          changed = true
        }
      }
      return changed ? next : f
    })
  }, [loose])

  const toggleLoose = (t: LooseTask) => {
    const k = looseKey(t)
    const on = !(looseFlips[k] ?? t.checked)
    setLooseFlips((f) => ({ ...f, [k]: on }))
    if (on) {
      setLooseLeaving((l) => ({ ...l, [k]: true }))
      leaveTimers.current.push(
        window.setTimeout(() => {
          setLooseLeaving((l) => {
            const next = { ...l }
            delete next[k]
            return next
          })
        }, 460),
      )
    }
    void toggleLooseTask(t).catch((e) => {
      // Revert the optimism; the house error toast carries the message.
      setLooseFlips((f) => {
        const next = { ...f }
        delete next[k]
        return next
      })
      setLooseLeaving((l) => {
        const next = { ...l }
        delete next[k]
        return next
      })
      toast('error', `Couldn’t save — ${e instanceof Error ? e.message : e}`)
    })
  }

  // Only unchecked lines surface (checked ones linger just for the exit bow).
  const looseOpen = useMemo(
    () =>
      loose.filter(
        (t) =>
          !(looseFlips[`${t.notePath}#${t.lineIndex}`] ?? t.checked) ||
          looseLeaving[`${t.notePath}#${t.lineIndex}`],
      ),
    [loose, looseFlips, looseLeaving],
  )
  const looseToday = useMemo(
    () =>
      looseOpen.filter((t) => {
        if (!t.due) return false
        const tone = dueTone(t.due)
        return tone === 'today' || tone === 'overdue'
      }),
    [looseOpen],
  )

  // ——— promote-to-row: the ↗ popover ———
  const [promote, setPromote] = useState<{ t: LooseTask; anchor: HTMLElement } | null>(
    null,
  )
  const promoteTo = async (t: LooseTask, key: string | null, title: string) => {
    setPromote(null)
    try {
      await promoteLooseTask(t, key)
      toast('success', `Promoted to ${title} — the line now points at the row`)
    } catch (e) {
      // Mint-then-rewrite: if the rewrite failed the row still exists — the
      // duplicate is visible, never silent. Say so plainly.
      toast('error', `Couldn’t promote — ${e instanceof Error ? e.message : e}`)
    }
  }

  // ——— one row, everywhere: check · title (+due) · date · source chip ———
  const Row = ({
    n,
    showDue = true,
    drag,
  }: {
    n: Note
    showDue?: boolean
    /** Present = draggable (reorder / re-file); absent on the Upcoming agenda. */
    drag?: RowDrag
  }) => {
    const done = n.metadata['done'] === true
    const due = taskDue(n)
    const key = taskProject(n)
    const world = key ? worldByKey.get(key) : undefined
    return (
      <div
        className={`task-row${done ? ' is-done' : ''}${done && leaving[n.path] ? ' is-leaving' : ''}${drag ? ' is-draggable' : ''}`}
        data-testid="task-row"
        data-path={n.path}
        draggable={Boolean(drag)}
        onDragStart={
          drag
            ? (e) => {
                const payload: RowDragPayload = {
                  kind: 'taskrow',
                  path: n.path,
                  group: drag.group,
                }
                liveRowDrag = payload
                e.dataTransfer.setData(ROW_DND_MIME, JSON.stringify(payload))
                e.dataTransfer.effectAllowed = 'move'
              }
            : undefined
        }
        onDragEnd={
          drag
            ? () => {
                liveRowDrag = null
              }
            : undefined
        }
        onDragOver={drag?.onOver}
        onDrop={drag?.onDrop}
      >
        <input
          type="checkbox"
          className="task-check"
          checked={done}
          onChange={() => toggleDone(n)}
          aria-label={taskTitle(n)}
        />
        <div className="task-row-main">
          <button className="task-row-open" onClick={() => openTask(n.path)} title={n.path}>
            <span className="task-row-title">{taskTitle(n)}</span>
          </button>
          {showDue && due && (
            <button
              className={`task-row-due due-${dueTone(due)}`}
              data-testid="row-due-edit"
              title="Change due date"
              aria-label={`Change due date for “${taskTitle(n)}”`}
              onClick={(e) => pickRowDate(n, e.currentTarget)}
            >
              <span className={`due-${dueTone(due)}`} data-testid="task-due" title={due}>
                {formatDue(due)}
              </span>
            </button>
          )}
        </div>
        {!due && (
          <button
            className="row-due-set"
            data-testid="row-due-set"
            title="Set due date"
            aria-label={`Set due date for “${taskTitle(n)}”`}
            onClick={(e) => pickRowDate(n, e.currentTarget)}
          >
            <IconCalendar size={13} />
          </button>
        )}
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

  // ——— a loose line's row: same anatomy, source chip = the note. NOT
  // draggable — a line's home is its note; the ↗ promote popover is its door. ———
  const LooseRow = ({ t, showDue = true }: { t: LooseTask; showDue?: boolean }) => {
    const k = looseKey(t)
    const done = looseFlips[k] ?? t.checked
    return (
      <div
        className={`task-row is-loose${done ? ' is-done' : ''}${done && looseLeaving[k] ? ' is-leaving' : ''}`}
        data-testid="loose-row"
        data-path={t.notePath}
        data-line={t.lineIndex}
      >
        <input
          type="checkbox"
          className="task-check"
          checked={done}
          onChange={() => toggleLoose(t)}
          aria-label={t.text}
        />
        <div className="task-row-main">
          <button
            className="task-row-open"
            onClick={() => openLooseNote(t.notePath)}
            title={`${t.notePath} · line ${t.lineIndex + 1}`}
          >
            <span className="task-row-title">{t.text}</span>
          </button>
          {showDue && t.due && (
            <button
              className={`task-row-due due-${dueTone(t.due)}`}
              data-testid="row-due-edit"
              title="Change due date"
              aria-label={`Change due date for “${t.text}”`}
              onClick={(e) => pickLooseDate(t, e.currentTarget)}
            >
              <span className={`due-${dueTone(t.due)}`} data-testid="task-due" title={t.due}>
                {formatDue(t.due)}
              </span>
            </button>
          )}
        </div>
        {!t.due && (
          <button
            className="row-due-set"
            data-testid="row-due-set"
            title="Set due date"
            aria-label={`Set due date for “${t.text}”`}
            onClick={(e) => pickLooseDate(t, e.currentTarget)}
          >
            <IconCalendar size={13} />
          </button>
        )}
        <button
          className="loose-promote"
          data-testid="loose-promote"
          title="Promote to a task row"
          aria-label={`Promote “${t.text}” to a task`}
          onClick={(e) => setPromote({ t, anchor: e.currentTarget })}
        >
          ↗
        </button>
        <button
          className="task-src"
          data-testid="task-src"
          title={`Open ${t.noteTitle}`}
          onClick={() => openLooseNote(t.notePath)}
        >
          {t.noteTitle}
        </button>
      </div>
    )
  }

  // ——— a group's row stack, drag-enabled. WITHIN the group: reorder →
  // 10-spaced metadata.order (the tabs' persistence, renumber-on-drop).
  // ACROSS groups (refile=true — the All/Today chips): dropping re-files the
  // row (metadata.project → the target world; removed for Inbox). ———
  const DraggableRows = ({
    group,
    rows,
    refile,
  }: {
    group: string
    rows: Note[]
    refile: boolean
  }) => {
    const accepts = (d: RowDragPayload | null): boolean => {
      if (!d || d.kind !== 'taskrow') return false
      return d.group === group || refile
    }
    const onDrop = (e: React.DragEvent, slot: number) => {
      const payload = readRowDragPayload(e)
      setDropSlot(null)
      if (!accepts(payload)) return
      e.preventDefault()
      e.stopPropagation()
      if (payload!.group === group) {
        // Reorder within the group; landing where it already sits writes nothing.
        const from = rows.findIndex((r) => r.path === payload!.path)
        if (from === -1) return
        const next = [...rows]
        const [moved] = next.splice(from, 1)
        const at = Math.max(0, Math.min(slot > from ? slot - 1 : slot, next.length))
        if (at === from) return
        next.splice(at, 0, moved!)
        void persistTaskOrder(next.map((r) => r.path))
      } else {
        refileTask(payload!.path, group === 'inbox' ? null : group)
      }
    }
    const rowDrag = (i: number): RowDrag => ({
      group,
      onOver: (e) => {
        if (!accepts(liveRowDrag)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        setDropSlot({ group, slot: slotFor(e, i) })
      },
      onDrop: (e) => onDrop(e, slotFor(e, i)),
    })
    return (
      <div
        className="tasks-rows"
        onDragOver={(e) => {
          // The gap under the last row — append (or file into this group).
          if (!accepts(liveRowDrag)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDropSlot({ group, slot: rows.length })
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
          setDropSlot((s) => (s?.group === group ? null : s))
        }}
        onDrop={(e) => onDrop(e, rows.length)}
      >
        {rows.map((n, i) => (
          <Fragment key={n.path}>
            {dropSlot?.group === group && dropSlot.slot === i && (
              <div className="tasks-drop-line" data-testid="row-drop-line" />
            )}
            <Row n={n} drag={rowDrag(i)} />
          </Fragment>
        ))}
        {dropSlot?.group === group && dropSlot.slot === rows.length && rows.length > 0 && (
          <div className="tasks-drop-line" data-testid="row-drop-line" />
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
          {chip === 'inbox' && <InboxList tasks={openTasks} Rows={DraggableRows} />}
          {chip === 'today' && (
            <TodayList
              tasks={taskNotes}
              leaving={leaving}
              worlds={worlds}
              Rows={DraggableRows}
              onHeader={openWorld}
              loose={looseToday}
              LooseRow={LooseRow}
              onNote={openLooseNote}
              ringFor={ringFor}
            />
          )}
          {chip === 'upcoming' && (
            <UpcomingList tasks={openTasks} Row={Row} loose={looseOpen} LooseRow={LooseRow} />
          )}
          {chip === 'all' && (
            <AllList
              tasks={openTasks}
              worlds={worlds}
              Rows={DraggableRows}
              onHeader={openWorld}
              loose={looseOpen}
              LooseRow={LooseRow}
              onNote={openLooseNote}
              ringFor={ringFor}
            />
          )}
        </div>
      )}

      {datePick && (
        <MonthPicker
          anchor={datePick.anchor}
          value={datePick.value}
          onPick={(d) => datePick.write(d)}
          onClear={() => datePick.write(null)}
          onClose={() => setDatePick(null)}
        />
      )}

      {promote && (
        <Popover anchor={promote.anchor} onClose={() => setPromote(null)} width={200}>
          <div className="menu-label">Promote to</div>
          <button
            role="menuitem"
            className="menu-item"
            data-testid="promote-dest"
            data-dest="inbox"
            onClick={() => void promoteTo(promote.t, null, 'Inbox')}
          >
            <span className="menu-item-text">Inbox</span>
          </button>
          {worlds.map((w) => (
            <button
              key={w.key}
              role="menuitem"
              className="menu-item"
              data-testid="promote-dest"
              data-dest={w.key}
              onClick={() => void promoteTo(promote.t, w.key, w.title)}
            >
              <span className="menu-item-text">{w.title}</span>
            </button>
          ))}
        </Popover>
      )}

      <QuickCreate worlds={worlds} />
    </div>
  )
}

type RowRenderer = (props: { n: Note; showDue?: boolean; drag?: RowDrag }) => ReactElement
type LooseRowRenderer = (props: { t: LooseTask; showDue?: boolean }) => ReactElement
/** A drag-enabled group of rows (reorder within; re-file across when refile). */
type GroupRowsRenderer = (props: {
  group: string
  rows: Note[]
  refile: boolean
}) => ReactElement

// ————————————————————————— loose note groups —————————————————————————

/** Bold note-title headers (doors into the note) over loose rows — shared by
 * Today's tail and All's "In your notes" section. Each header carries the
 * note's mini progress ring (its WHOLE checkbox tally, done included). */
function LooseNoteGroups({
  groups,
  LooseRow,
  onNote,
  ringFor,
}: {
  groups: LooseNoteGroup[]
  LooseRow: LooseRowRenderer
  onNote: (path: string) => void
  ringFor: (path: string) => CheckboxRing | null
}) {
  return (
    <>
      {groups.map((g) => {
        const ring = ringFor(g.path)
        return (
        <section
          key={g.path}
          className="tasks-group"
          data-testid="tasks-group"
          data-group={`note:${g.path}`}
        >
          <button
            className="tasks-group-head is-link"
            data-testid="tasks-group-head"
            onClick={() => onNote(g.path)}
            title={`Open ${g.title}`}
          >
            {g.title}
            <span className="tasks-group-count">{g.items.length}</span>
            {ring && <ProgressRing ring={ring} size={14} />}
          </button>
          {g.items.map((t) => (
            <LooseRow key={`${t.notePath}#${t.lineIndex}`} t={t} />
          ))}
        </section>
        )
      })}
    </>
  )
}

// ————————————————————————— Inbox —————————————————————————

function InboxList({ tasks, Rows }: { tasks: Note[]; Rows: GroupRowsRenderer }) {
  // Hand-placed order first (drag-reorder), then the classic due-first sort.
  const unfiled = useMemo(
    () => orderFirst(sortDueFirst(tasks.filter((n) => !taskProject(n)))),
    [tasks],
  )
  if (unfiled.length === 0) {
    return <p className="tasks-empty">Inbox zero. Type a thought below to capture one.</p>
  }
  return (
    <section className="tasks-group" data-testid="tasks-group" data-group="inbox">
      <Rows group="inbox" rows={unfiled} refile={false} />
    </section>
  )
}

// ————————————————————————— Today —————————————————————————

function TodayList({
  tasks,
  leaving,
  worlds,
  Rows,
  onHeader,
  loose,
  LooseRow,
  onNote,
  ringFor,
}: {
  tasks: Note[]
  leaving: Record<string, boolean>
  worlds: Project[]
  Rows: GroupRowsRenderer
  onHeader: (g: WorldGroup) => void
  /** Loose lines due today/overdue — they join AFTER the world groups. */
  loose: LooseTask[]
  LooseRow: LooseRowRenderer
  onNote: (path: string) => void
  ringFor: (path: string) => CheckboxRing | null
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
  // Within each group, hand-placed order leads (the sort law in domain/tasks).
  const groups = useMemo(
    () =>
      groupByWorld(todays, worlds).map((g) => ({ ...g, tasks: orderFirst(g.tasks) })),
    [todays, worlds],
  )
  const looseGroups = useMemo(() => groupLooseByNote(loose), [loose])
  if (groups.length === 0 && looseGroups.length === 0) {
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
          <Rows group={g.key ?? 'inbox'} rows={g.tasks} refile />
        </section>
      ))}
      {/* Loose lines whose date has arrived — grouped under their notes,
          AFTER the Inbox + world groups (rows outrank lines on the day). */}
      <LooseNoteGroups
        groups={looseGroups}
        LooseRow={LooseRow}
        onNote={onNote}
        ringFor={ringFor}
      />
    </>
  )
}

// ————————————————————————— Upcoming —————————————————————————

function UpcomingList({
  tasks,
  Row,
  loose,
  LooseRow,
}: {
  tasks: Note[]
  Row: RowRenderer
  /** All open loose lines — only future-dued ones slot into the agenda. */
  loose: LooseTask[]
  LooseRow: LooseRowRenderer
}) {
  const now = new Date()
  const dayKey = (offset: number) =>
    ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset))
  const todayK = dayKey(0)
  const horizonK = dayKey(7)

  const { overdue, byDue, beyond, thisWeek, looseByDue } = useMemo(() => {
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
    // Loose lines with FUTURE inline dues slot under their day headers
    // (today/overdue ones belong to the Today chip, not the agenda).
    const looseByDue = new Map<string, LooseTask[]>()
    for (const t of loose) {
      if (!t.due || t.due <= todayK) continue
      const arr = looseByDue.get(t.due)
      if (arr) arr.push(t)
      else looseByDue.set(t.due, [t])
    }
    const beyond = [...new Set([...byDue.keys(), ...looseByDue.keys()])]
      .filter((d) => d > horizonK)
      .sort()
    // The coarse layer's tail: blessed for the week but not yet dated.
    const thisWeek = tasks
      .filter((n) => !taskDue(n) && n.metadata['when'] === 'this-week')
      .sort(byCreated)
    return { overdue, byDue, beyond, thisWeek, looseByDue }
  }, [tasks, loose, todayK, horizonK])

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
        const dayLoose = looseByDue.get(d) ?? []
        return (
          <section className="tasks-day" data-testid="tasks-day" data-day={d} key={d}>
            <div className="tasks-day-head" data-testid="tasks-day-head">
              {formatDue(d)}
            </div>
            {dayTasks.length === 0 && dayLoose.length === 0 ? (
              <div className="tasks-day-empty" aria-label="Nothing due">
                —
              </div>
            ) : (
              <>
                {dayTasks.map((n) => (
                  <Row key={n.path} n={n} showDue={false} />
                ))}
                {dayLoose.map((t) => (
                  <LooseRow key={`${t.notePath}#${t.lineIndex}`} t={t} showDue={false} />
                ))}
              </>
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
          {(byDue.get(d) ?? []).map((n) => (
            <Row key={n.path} n={n} showDue={false} />
          ))}
          {(looseByDue.get(d) ?? []).map((t) => (
            <LooseRow key={`${t.notePath}#${t.lineIndex}`} t={t} showDue={false} />
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
  Rows,
  onHeader,
  loose,
  LooseRow,
  onNote,
  ringFor,
}: {
  tasks: Note[]
  worlds: Project[]
  Rows: GroupRowsRenderer
  onHeader: (g: WorldGroup) => void
  /** Open loose lines — the closing "In your notes" section. */
  loose: LooseTask[]
  LooseRow: LooseRowRenderer
  onNote: (path: string) => void
  ringFor: (path: string) => CheckboxRing | null
}) {
  // Done tasks are deliberately absent here — the Tracker is the archive and
  // ops table; this list is only ever "what's still open, by world".
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // Within each group, hand-placed order leads (the sort law in domain/tasks),
  // then the classic due-first sort for the unordered tail.
  const groups = useMemo(
    () =>
      groupByWorld(sortDueFirst(tasks), worlds).map((g) => ({
        ...g,
        tasks: orderFirst(g.tasks),
      })),
    [tasks, worlds],
  )
  const looseGroups = useMemo(() => groupLooseByNote(loose), [loose])

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

  if (groups.length === 0 && looseGroups.length === 0) {
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
                <Rows group={id} rows={shown} refile />
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
      {/* The prize: every `- [ ]` living inside an ordinary note, checkable
          right here. Rows stay rows; lines stay lines (no dual bookkeeping). */}
      {looseGroups.length > 0 && (
        <section className="tasks-loose" data-testid="tasks-loose">
          <div className="tasks-loose-head" data-testid="tasks-loose-head">
            In your notes
          </div>
          <LooseNoteGroups
            groups={looseGroups}
            LooseRow={LooseRow}
            onNote={onNote}
            ringFor={ringFor}
          />
        </section>
      )}
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
