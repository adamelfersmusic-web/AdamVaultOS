import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DatabaseDef, FieldDef, LensKind, Note } from '../lib/types'
import {
  createTask,
  loadProjects,
  loadScripts,
  loadTracker,
  setMetadata,
  toast,
  useStore,
} from '../lib/store'
import { navigate } from '../lib/router'
import { openNewScript } from '../lib/ui'
import { titleFromPath } from '../lib/format'
import { toProjects } from '../domain/projects'
import { Chip, chipFor } from '../components/Chip'
import { Popover } from '../components/Popover'
import {
  IconBoard,
  IconCheck,
  IconClose,
  IconFilter,
  IconGallery,
  IconPlus,
  IconRefresh,
  IconSpark,
  IconTable,
  IconBack,
} from '../components/Icons'
import { TableLens } from './TableLens'
import { PageEditor } from './PageEditor'
import { RecordProperties } from '../components/RecordProperties'
import { BoardLens } from './BoardLens'
import { GalleryLens } from './GalleryLens'

// The brand's source-of-truth project, opened in a new tab from the top bar.
const BRAND_BRAIN_URL = 'https://claude.ai/project/019df26a-e720-77a8-bfd1-1be88ba75aef'

export interface Row {
  path: string
  title: string
  note: Note
}

/** Row title: the note's first content line for content-titled datasets
 * (tasks), else the de-slugged path. Falls back to the path if content is
 * absent or blank. */
function rowTitle(note: Note, def: DatabaseDef): string {
  if (def.titleFromContent) {
    const first = (note.content ?? '')
      .split('\n')
      .map((s) => s.trim())
      .find(Boolean)
    if (first) return first.replace(/^#{1,6}\s+/, '').slice(0, 140)
  }
  return titleFromPath(note.path)
}

export interface LensProps {
  def: DatabaseDef
  rows: Row[]
  observed: Map<string, Set<string>>
  saving: Record<string, number>
  onOpen: (path: string) => void
  setField: (path: string, key: string, value: unknown, prev: unknown) => void
}

type SortState = { key: string; dir: 1 | -1 }
type Filters = Record<string, string[]>

const lensKey = (db: string) => `adamvaultos.${db}.lens`
const sortKey = (db: string) => `adamvaultos.${db}.sort`
const filterKey = (db: string) => `adamvaultos.${db}.filters`

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function filterValueOf(field: FieldDef, note: Note): string {
  const v = note.metadata[field.key]
  if (field.kind === 'bool') return String(v === true)
  if (v === undefined || v === null || v === '') return ''
  return String(v)
}

export function rankOf(field: FieldDef, value: string): number {
  const order = field.rank ?? field.options?.map((o) => o.value)
  if (!order) return -1
  const i = order.indexOf(value)
  return i === -1 ? order.length : i
}

export function compareRows(a: Row, b: Row, sort: SortState, def: DatabaseDef): number {
  const dir = sort.dir
  if (sort.key === 'title') return a.title.localeCompare(b.title) * dir
  if (sort.key === 'updated') {
    return (a.note.updatedAt < b.note.updatedAt ? -1 : a.note.updatedAt > b.note.updatedAt ? 1 : 0) * dir
  }
  const field = def.fields.find((f) => f.key === sort.key)
  if (!field) return 0
  const va = filterValueOf(field, a.note)
  const vb = filterValueOf(field, b.note)
  if (va === vb) return a.title.localeCompare(b.title)
  // Unset values sink to the bottom regardless of direction.
  if (va === '') return 1
  if (vb === '') return -1
  const ra = rankOf(field, va)
  const rb = rankOf(field, vb)
  if (ra !== rb && ra !== -1 && rb !== -1) return (ra - rb) * dir
  return va.localeCompare(vb) * dir
}

// ---------------------------------------------------------------------------

function LensSwitch({ lens, onPick }: { lens: LensKind; onPick: (l: LensKind) => void }) {
  const lenses: { key: LensKind; label: string; icon: ReactNode }[] = [
    { key: 'table', label: 'Table', icon: <IconTable size={14} /> },
    { key: 'board', label: 'Board', icon: <IconBoard size={14} /> },
    { key: 'gallery', label: 'Gallery', icon: <IconGallery size={14} /> },
  ]
  const index = lenses.findIndex((l) => l.key === lens)
  return (
    <div className="lens-switch" role="tablist" aria-label="Lens">
      <i
        className="lens-thumb"
        style={{ transform: `translateX(${index * 100}%)` }}
        aria-hidden="true"
      />
      {lenses.map((l) => (
        <button
          key={l.key}
          role="tab"
          aria-selected={lens === l.key}
          className={`lens-btn${lens === l.key ? ' is-active' : ''}`}
          onClick={() => onPick(l.key)}
        >
          {l.icon}
          {l.label}
        </button>
      ))}
    </div>
  )
}

function Pipeline({
  def,
  rows,
  active,
  onToggle,
}: {
  def: DatabaseDef
  rows: Row[]
  active: string[]
  onToggle: (lane: string) => void
}) {
  const field = def.fields.find((f) => f.key === def.board.field)!
  const counts = new Map<string, number>()
  for (const lane of def.board.lanes) counts.set(lane, 0)
  for (const r of rows) {
    const v = filterValueOf(field, r.note)
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const lanes = [...counts.keys()]
  const total = rows.length || 1
  return (
    <div className="pipeline" role="group" aria-label="Pipeline">
      {lanes.map((lane) => {
        const n = counts.get(lane) ?? 0
        const { color } = chipFor(field, lane)
        const isActive = active.includes(lane)
        return (
          <button
            key={lane}
            className={`pipe-seg pipe-${color}${isActive ? ' is-active' : ''}${active.length > 0 && !isActive ? ' is-muted' : ''}`}
            style={{ flexGrow: Math.max(n, 0.45) * (100 / total) + 1 }}
            title={`${lane} — ${n} ${n === 1 ? 'item' : 'items'}`}
            onClick={() => onToggle(lane)}
          >
            <span className="pipe-label">{lane}</span>
            <span className="pipe-count">{n}</span>
          </button>
        )
      })}
    </div>
  )
}

function ProgressOverview({ def, rows }: { def: DatabaseDef; rows: Row[] }) {
  const cfg = def.progress!
  const field = def.fields.find((f) => f.key === cfg.field)
  if (!field) return null
  const isDone = (n: Note) => n.metadata[cfg.doneField] === true

  const groups = new Map<string, { total: number; done: number }>()
  for (const r of rows) {
    const v = filterValueOf(field, r.note)
    if (!v) continue
    const g = groups.get(v) ?? { total: 0, done: 0 }
    g.total++
    if (isDone(r.note)) g.done++
    groups.set(v, g)
  }
  if (groups.size === 0) return null

  const order = field.rank ?? [...groups.keys()]
  const phases = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
  const total = rows.length
  const done = rows.filter((r) => isDone(r.note)).length
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <div className="progress-overview" data-testid="progress-overview">
      <div className="progress-overall" title={`${done} of ${total} tasks done`}>
        <span className="progress-overall-pct">{pct}%</span>
        <span className="progress-overall-label">
          {done}<span className="progress-overall-sep">/</span>{total} done
        </span>
      </div>
      <div className="progress-phases">
        {phases.map((p) => {
          const g = groups.get(p)!
          const { color } = chipFor(field, p)
          const ratio = g.total ? g.done / g.total : 0
          return (
            <div
              key={p}
              className={`progress-phase${g.done === g.total ? ' is-complete' : ''}`}
              title={`${field.label} ${p} — ${g.done}/${g.total} done`}
            >
              <div className="progress-phase-head">
                <span className="progress-phase-name">{p}</span>
                <span className="progress-phase-count">
                  {g.done}/{g.total}
                </span>
              </div>
              <div className="progress-phase-track">
                <i
                  className={`progress-phase-fill fill-${color}`}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FilterMenu({
  def,
  observed,
  filters,
  anchor,
  onChange,
  onClose,
}: {
  def: DatabaseDef
  observed: Map<string, Set<string>>
  filters: Filters
  anchor: HTMLElement
  onChange: (next: Filters) => void
  onClose: () => void
}) {
  const [fieldKey, setFieldKey] = useState<string | null>(null)
  const field = def.fields.find((f) => f.key === fieldKey)

  if (!field) {
    return (
      <Popover anchor={anchor} onClose={onClose} width={200}>
        <div className="menu-label">Filter by</div>
        {def.fields
          .filter((f) => f.kind !== 'text')
          .map((f) => (
          <button key={f.key} className="menu-item" onClick={() => setFieldKey(f.key)}>
            <span className="menu-item-text">{f.label}</span>
            {filters[f.key]?.length ? (
              <span className="menu-badge">{filters[f.key]!.length}</span>
            ) : null}
          </button>
        ))}
      </Popover>
    )
  }

  const declared = (field.options ?? []).map((o) => o.value)
  const extra = [...(observed.get(field.key) ?? [])].filter(
    (v) => v && !declared.includes(v),
  )
  const values = [...declared, ...extra.sort()]
  const selected = filters[field.key] ?? []

  const toggle = (v: string) => {
    const has = selected.includes(v)
    const nextVals = has ? selected.filter((x) => x !== v) : [...selected, v]
    const next = { ...filters }
    if (nextVals.length === 0) delete next[field.key]
    else next[field.key] = nextVals
    onChange(next)
  }

  return (
    <Popover anchor={anchor} onClose={onClose} width={216}>
      <button className="menu-back" onClick={() => setFieldKey(null)}>
        <IconBack size={12} /> {field.label}
      </button>
      {values.map((v) => {
        const { label, color } = chipFor(
          field,
          field.kind === 'bool' ? v === 'true' : v,
        )
        const on = selected.includes(v)
        return (
          <button
            key={v}
            className={`menu-item${on ? ' is-current' : ''}`}
            onClick={() => toggle(v)}
          >
            <Chip color={color} label={label} />
            {on && <IconCheck size={14} className="menu-check" />}
          </button>
        )
      })}
    </Popover>
  )
}

// ---------------------------------------------------------------------------

export type DatasetKind = 'scripts' | 'tracker'

export function DatabaseView({
  def,
  lensOverride,
  dataset = 'scripts',
  presetFilter,
  embedded = false,
}: {
  def: DatabaseDef
  lensOverride?: LensKind
  dataset?: DatasetKind
  /** Fixed scope applied before user filters (e.g. {project:['amanda']} inside
   * a Cockpit world) — never shown as a removable chip. */
  presetFilter?: Record<string, string[]>
  /** True when hosted inside another view (a world): lens switches stay local
   * instead of navigating to the global route. */
  embedded?: boolean
}) {
  const store = useStore()
  const { notes, saving } = store
  // Select the dataset's slice. Both boards share the same chrome; only the
  // source list, loader, and route kind differ.
  const paths = dataset === 'tracker' ? store.tracker : store.scripts
  const dataStatus = dataset === 'tracker' ? store.trackerStatus : store.scriptsStatus
  const dataError = dataset === 'tracker' ? store.trackerError : store.scriptsError
  const reload = dataset === 'tracker' ? loadTracker : loadScripts
  const isScripts = dataset === 'scripts'
  const [lens, setLensState] = useState<LensKind>(
    () => lensOverride ?? readJson<LensKind>(lensKey(def.key), 'table'),
  )
  const [sort, setSort] = useState<SortState>(() =>
    readJson<SortState>(sortKey(def.key), { key: 'updated', dir: -1 }),
  )
  const [filters, setFiltersState] = useState<Filters>(() =>
    readJson<Filters>(filterKey(def.key), {}),
  )
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (lensOverride && lensOverride !== lens) {
      setLensState(lensOverride)
      localStorage.setItem(lensKey(def.key), JSON.stringify(lensOverride))
    }
  }, [lensOverride, lens, def.key])

  const setLens = (l: LensKind) => {
    setLensState(l)
    localStorage.setItem(lensKey(def.key), JSON.stringify(l))
    if (!embedded) navigate({ kind: dataset, lens: l })
  }

  const setFilters = (f: Filters) => {
    setFiltersState(f)
    localStorage.setItem(filterKey(def.key), JSON.stringify(f))
  }

  const setSortPersist = (s: SortState) => {
    setSort(s)
    localStorage.setItem(sortKey(def.key), JSON.stringify(s))
  }

  const allRows = useMemo<Row[]>(() => {
    if (!paths) return []
    let rows = paths
      .map((path) => notes[path])
      .filter((n): n is Note => Boolean(n))
      .map((note) => ({ path: note.path, note, title: rowTitle(note, def) }))
    // Fixed scope (a world's slice) applies before any user filtering, so
    // counts, pipeline, and progress all reflect just this scope.
    if (presetFilter) {
      for (const [key, vals] of Object.entries(presetFilter)) {
        if (vals.length === 0) continue
        const field = def.fields.find((f) => f.key === key)
        if (!field) continue
        rows = rows.filter((r) => vals.includes(filterValueOf(field, r.note)))
      }
    }
    return rows
  }, [paths, notes, def, presetFilter])

  const observed = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const f of def.fields) map.set(f.key, new Set())
    for (const r of allRows) {
      for (const f of def.fields) {
        const v = filterValueOf(f, r.note)
        if (v) map.get(f.key)!.add(v)
      }
    }
    return map
  }, [allRows, def.fields])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = allRows
    if (q) {
      out = out.filter(
        (r) => r.title.toLowerCase().includes(q) || r.path.toLowerCase().includes(q),
      )
    }
    for (const [key, vals] of Object.entries(filters)) {
      if (vals.length === 0) continue
      const field = def.fields.find((f) => f.key === key)
      if (!field) continue
      out = out.filter((r) => vals.includes(filterValueOf(field, r.note)))
    }
    return [...out].sort((a, b) => compareRows(a, b, sort, def))
  }, [allRows, query, filters, sort, def])

  const setField = (path: string, key: string, value: unknown, prev: unknown) => {
    const patch: Record<string, unknown> = { [key]: value }
    const undo: Record<string, unknown> = { [key]: prev ?? null }
    // Keep state ↔ done in sync: dragging a card into (or out of) the done
    // lane also flips the bool that feeds the progress bars.
    if (def.progress && key === def.board.field) {
      const doneField = def.progress.doneField
      const wasDone = notes[path]?.metadata[doneField] === true
      if (value === 'done' && !wasDone) {
        patch[doneField] = true
        undo[doneField] = false
      } else if (prev === 'done' && value !== 'done' && wasDone) {
        patch[doneField] = false
        undo[doneField] = true
      }
    }
    void setMetadata(path, patch, { undo })
  }

  // Notion-style peek: on the GLOBAL tracker, opening a row splits the screen
  // — the tracker stays put, the task page mounts beside it. Full page is an
  // explicit Open ↗ in the peek bar. (Scripts + embedded boards still navigate.)
  const [peek, setPeek] = useState<string | null>(null)
  const onOpen = (path: string) => {
    if (dataset === 'tracker' && !embedded) setPeek(path)
    else navigate({ kind: 'pages', path })
  }

  // Drag-to-resize the side peek: the divider writes a % width to localStorage
  // so the split you pick sticks. Clamped 28–72% so neither pane vanishes.
  const PEEK_KEY = 'adamvaultos.peek.width'
  const [peekWidth, setPeekWidth] = useState<number>(() => {
    const stored = Number(localStorage.getItem(PEEK_KEY))
    return stored >= 28 && stored <= 72 ? stored : 46
  })
  const wrapRef = useRef<HTMLDivElement>(null)
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const move = (ev: MouseEvent) => {
      const box = wrapRef.current?.getBoundingClientRect()
      if (!box) return
      const pct = Math.min(72, Math.max(28, ((box.right - ev.clientX) / box.width) * 100))
      setPeekWidth(pct)
    }
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      localStorage.setItem(PEEK_KEY, String(Math.round(peekWidthRef.current)))
    }
    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }
  const peekWidthRef = useRef(peekWidth)
  peekWidthRef.current = peekWidth

  const lensProps: LensProps = { def, rows, observed, saving, onOpen, setField }
  const statusFilters = filters[def.board.field] ?? []

  return (
    <div className={`db-wrap${peek ? ' has-peek' : ''}`} ref={wrapRef}>
    <div className="db">
      <header className="db-head">
        <div className="db-title-row">
          <h1 className="db-title">{def.title}</h1>
          <span className="db-count">
            {dataStatus === 'ready'
              ? `${rows.length}${rows.length !== allRows.length ? ` of ${allRows.length}` : ''}`
              : ''}
          </span>
          <button
            className="icon-btn db-refresh"
            title="Refresh from vault"
            onClick={() => void reload()}
          >
            <IconRefresh size={14} />
          </button>
          <div className="db-actions">
            {isScripts && (
              <a
                className="btn btn-brand"
                href={BRAND_BRAIN_URL}
                target="_blank"
                rel="noreferrer"
                title="Open the Brand Brain project in a new tab"
              >
                <IconSpark size={13} />
                Brand Brain
              </a>
            )}
            <input
              className="db-search"
              placeholder={`Search ${def.title.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              ref={filterBtn}
              className={`btn btn-ghost${Object.keys(filters).length ? ' is-on' : ''}`}
              onClick={() => setFilterOpen(true)}
            >
              <IconFilter size={13} />
              Filter
            </button>
            <LensSwitch lens={lens} onPick={setLens} />
            {isScripts && (
              <button className="btn btn-gold" onClick={openNewScript}>
                <IconPlus size={13} />
                New script
              </button>
            )}
            {dataset === 'tracker' && !embedded && <TrackerNewTask />}
          </div>
        </div>

        {dataset === 'tracker' && (
          <TrackerViews
            filters={filters}
            setFilters={setFilters}
            worlds={VIEW_WORLDS.filter((w) => (observed.get('project') ?? new Set()).has(w))}
          />
        )}

        <Pipeline
          def={def}
          rows={allRows}
          active={statusFilters}
          onToggle={(lane) => {
            const has = statusFilters.includes(lane)
            const next = has
              ? statusFilters.filter((l) => l !== lane)
              : [...statusFilters, lane]
            const f = { ...filters }
            if (next.length === 0) delete f[def.board.field]
            else f[def.board.field] = next
            setFilters(f)
          }}
        />

        {def.progress && allRows.length > 0 && (
          <ProgressOverview def={def} rows={allRows} />
        )}

        {Object.keys(filters).length > 0 && (
          <div className="filter-bar">
            {Object.entries(filters).map(([key, vals]) => {
              const field = def.fields.find((f) => f.key === key)
              if (!field) return null
              return (
                <span key={key} className="filter-chip">
                  <span className="filter-chip-field">{field.label}</span>
                  {vals
                    .map((v) =>
                      chipFor(field, field.kind === 'bool' ? v === 'true' : v).label,
                    )
                    .join(' · ')}
                  <button
                    className="filter-chip-x"
                    aria-label={`Clear ${field.label} filter`}
                    onClick={() => {
                      const f = { ...filters }
                      delete f[key]
                      setFilters(f)
                    }}
                  >
                    <IconClose size={10} />
                  </button>
                </span>
              )
            })}
            <button className="filter-clear" onClick={() => setFilters({})}>
              Clear all
            </button>
          </div>
        )}
      </header>

      {filterOpen && filterBtn.current && (
        <FilterMenu
          def={def}
          observed={observed}
          filters={filters}
          anchor={filterBtn.current}
          onChange={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {dataStatus === 'error' ? (
        <div className="db-state">
          <p className="db-state-title">Couldn’t load the vault</p>
          <p className="db-state-msg">{dataError}</p>
          <button className="btn btn-gold" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : dataStatus !== 'ready' ? (
        <div className="db-skeleton" aria-label="Loading">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="skel-row" key={i} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      ) : allRows.length === 0 ? (
        <div className="db-state">
          <p className="db-state-title">Nothing here yet</p>
          <p className="db-state-msg">
            {isScripts ? 'Capture the first one' : 'Tasks land'} in the vault at{' '}
            <code>{def.pathPrefix}…</code>
          </p>
          {isScripts && (
            <button className="btn btn-gold" onClick={openNewScript}>
              <IconPlus size={13} /> New script
            </button>
          )}
        </div>
      ) : (
        <>
          {lens === 'table' && (
            <TableLens
              {...lensProps}
              sort={sort}
              onSort={(key) =>
                setSortPersist(
                  sort.key === key
                    ? { key, dir: sort.dir === 1 ? -1 : 1 }
                    : { key, dir: 1 },
                )
              }
            />
          )}
          {lens === 'board' && <BoardLens {...lensProps} />}
          {lens === 'gallery' && <GalleryLens {...lensProps} />}
        </>
      )}
    </div>

    {peek && (
      <>
        <div
          className="db-peek-resize"
          onMouseDown={startResize}
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize"
          data-testid="db-peek-resize"
        />
        <section
          className="db-peek"
          data-testid="db-peek"
          style={{ flexBasis: `${peekWidth}%` }}
        >
          <div className="db-peek-bar">
            <span className="db-peek-path" title={peek}>
              {peek}
            </span>
            <div className="db-peek-actions">
              <button
                className="detail-btn"
                onClick={() => navigate({ kind: 'pages', path: peek })}
                title="Open as a full page"
              >
                Open ↗
              </button>
              <button
                className="detail-btn"
                data-testid="db-peek-close"
                onClick={() => setPeek(null)}
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
          {notes[peek] && (
            <div className="db-peek-head">
              <h1 className="db-peek-title" data-testid="db-peek-title">
                {rowTitle(notes[peek], def)}
              </h1>
              <RecordProperties note={notes[peek]} def={def} variant="peek" />
            </div>
          )}
          <div className="db-peek-notes-label">Notes</div>
          <div className="db-peek-body">
            <PageEditor key={peek} path={peek} inPeek />
          </div>
        </section>
      </>
    )}
    </div>
  )
}

// ——— ＋ New task from the global Tracker: pick the world it belongs to ———

function TrackerNewTask() {
  const { projects, projectsStatus, notes } = useStore()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [projectKey, setProjectKey] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && projectsStatus === 'idle') void loadProjects()
  }, [open, projectsStatus])

  const options = useMemo(() => {
    const list = (projects ?? []).map((p) => notes[p]).filter(Boolean)
    return toProjects(list)
  }, [projects, notes])

  // Default to the first project once the list lands.
  useEffect(() => {
    if (!projectKey && options.length > 0) setProjectKey(options[0].key)
  }, [options, projectKey])

  const submit = async () => {
    const t = title.trim()
    if (!t || !projectKey || busy) return
    setBusy(true)
    try {
      await createTask(projectKey, t)
      // Stay HERE — the row appears below and every field edits inline.
      // (Open it beside the tracker with the row's 📄 if you want the page.)
      setTitle('')
      toast('success', 'Task added — fill the chips right in the row')
    } catch (e) {
      toast('error', `Couldn’t create task — ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        className="btn btn-gold"
        data-testid="tracker-new-task"
        onClick={() => setOpen(true)}
      >
        <IconPlus size={13} />
        New task
      </button>
    )
  }

  return (
    <div className="db-newtask" data-testid="tracker-new-task-form">
      <select
        className="db-newtask-project"
        value={projectKey}
        onChange={(e) => setProjectKey(e.target.value)}
        aria-label="Project"
      >
        {options.length === 0 && <option value="">no projects yet</option>}
        {options.map((p) => (
          <option key={p.key} value={p.key}>
            {p.title}
          </option>
        ))}
      </select>
      <input
        autoFocus
        className="db-search db-newtask-title"
        placeholder="Task title — Enter to create…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      <button
        className="btn btn-gold"
        disabled={busy || !title.trim() || !projectKey}
        onClick={() => void submit()}
      >
        Create
      </button>
      <button className="btn btn-ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  )
}

// ——— saved views (#4): one-tap named slices of the Tracker ———
// "Now" = what's moving (active + next). World chips = the projects Adam
// actually wants pre-filtered in one tap (his call 2026-07-14: Amanda +
// Escensus — the only worlds that earn a chip; people-chips folded into the
// worlds). These are filter presets, so they compose with the pipeline +
// filter UI and persist through the same localStorage key as hand-built
// filters.

/** Worlds that earn a one-tap chip. Grow deliberately — a chip must be a
 * button Adam would actually press. */
const VIEW_WORLDS = ['amanda', 'escensus']

function TrackerViews({
  filters,
  setFilters,
  worlds,
}: {
  filters: Filters
  setFilters: (f: Filters) => void
  worlds: string[]
}) {
  const keys = Object.keys(filters)
  const isAll = keys.length === 0
  const isNow =
    keys.length === 1 &&
    [...(filters.state ?? [])].sort().join(',') === 'active,next'
  const worldOf =
    keys.length === 1 && (filters.project?.length ?? 0) === 1 ? filters.project[0] : null

  return (
    <div className="db-views" data-testid="db-views" role="group" aria-label="Saved views">
      <span className="db-views-label">views</span>
      <button className={`db-view${isAll ? ' is-on' : ''}`} onClick={() => setFilters({})}>
        All
      </button>
      <button
        className={`db-view${isNow ? ' is-on' : ''}`}
        title="What's moving — active + next"
        onClick={() => setFilters({ state: ['active', 'next'] })}
      >
        Now
      </button>
      {worlds.map((w) => (
        <button
          key={w}
          className={`db-view${worldOf === w ? ' is-on' : ''}`}
          title={`${w[0].toUpperCase()}${w.slice(1)} — this world's tasks`}
          onClick={() => setFilters({ project: [w] })}
        >
          {w[0].toUpperCase()}
          {w.slice(1)}
        </button>
      ))}
    </div>
  )
}
