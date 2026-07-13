// Pages — a full-bleed, two-pane writing space (the Shell collapses away, like
// Graph). Left: every page, newest-first, with a "New page" button and the
// settings gear. Right: the block editor for the open page, or an invitation
// to start one.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import {
  createNoteAt,
  createPage,
  fetchAllNotes,
  fetchNote,
  loadPages,
  saveContent,
  toast,
  useStore,
} from '../lib/store'
import { announcePageUpdate } from '../lib/ui'
import {
  parseShelves,
  serializeShelves,
  SHELF_CAP,
  SHELVES_PATH,
  type Shelf,
} from '../lib/shelves'
import { rankNotes } from '../lib/search'
import { hrefFor, navigate } from '../lib/router'
import { relativeTime, titleFromPath } from '../lib/format'
import {
  PAGES_SETTINGS_EVENT,
  setSetting,
  useEditorSettings,
} from '../lib/editorSettings'
import { listScribeModels } from '../lib/scribe'
import { toggleTheme, useTheme } from '../lib/theme'
import { Modal } from '../components/Modal'
import {
  IconMoon,
  IconPin,
  IconPlus,
  IconSettings,
  IconSun,
} from '../components/Icons'
import { WorkTabs } from '../components/WorkTabs'
import { AuthBanner } from '../components/AuthBanner'
import { PageEditor } from './PageEditor'

/** Sidebar label: the doc's real H1 once its content is cached (i.e. it's been
 * opened/created this session), else the de-slugged path. Fixes "my doc shows
 * as Untitled-10" — a renamed doc reads by its actual title. */
function sideTitle(p: string, n?: Note): string {
  const c = n?.content
  if (c) {
    const m = c.match(/^\s{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/m)
    if (m?.[1]) {
      const t = m[1].replace(/[*_`#\[\]]/g, '').trim()
      if (t) return t
    }
  }
  return titleFromPath(p)
}

const RECENT_COUNT = 8
/** Pinned shows EVERY pinned note (no Recent-style trim) — the cap is purely a
 * defensive ceiling against a runaway `pinned: true` sweep. */
const PINNED_CAP = 30
const SIDE_COLLAPSE_KEY = 'adamvaultos.pages.side.collapsed'
/** App-owned front-door convention: the note at this path is THE PLAN — the
 * planning front door. If it exists, it gets a dedicated slot at the very top
 * of the sidebar, above every section. */
const PLAN_PATH = 'desk/00-plan'
const PINNED_OPEN_KEY = 'adamvaultos.pages.pinnedOpen'

// ——— DRAG & DROP (native HTML5) — shelves are the ONLY drop targets. A drag
// is pure gesture: nothing is written until a drop lands on a shelf, and
// every drop funnels through the same conflict-safe mutate() as the +/×
// clicks. Dragging never REMOVES anything — removal stays the explicit ×. ———

/** What's riding the drag: a plain note row (Recent / Pinned / Plan), a shelf
 * member (knows which shelf it left), or a whole shelf (header reorder). */
type DragPayload =
  | { kind: 'note'; path: string }
  | { kind: 'member'; path: string; fromShelf: string }
  | { kind: 'shelf'; name: string }

const DND_MIME = 'application/x-adamvaultos-shelf-dnd'
/** Hovering a collapsed shelf header this long springs it open (macOS style). */
const SPRING_OPEN_MS = 600

/** dragover can't read dataTransfer (HTML5 protected mode), so the in-flight
 * payload is mirrored here for hover affordances; drop still prefers the real
 * dataTransfer JSON. Cleared on dragend — a cancelled drag leaves no trace. */
let liveDrag: DragPayload | null = null

function isDragPayload(p: unknown): p is DragPayload {
  if (!p || typeof p !== 'object') return false
  const d = p as Record<string, unknown>
  if (d.kind === 'note') return typeof d.path === 'string'
  if (d.kind === 'member')
    return typeof d.path === 'string' && typeof d.fromShelf === 'string'
  if (d.kind === 'shelf') return typeof d.name === 'string'
  return false
}

/** The drop-time payload: the dataTransfer JSON when it parses, else the live
 * mirror. Malformed/foreign data (someone dropping random text) → null. */
function readDragPayload(e: React.DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(DND_MIME)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isDragPayload(parsed)) return parsed
    }
  } catch {
    // fall through to the mirror
  }
  return liveDrag
}

function startDrag(e: React.DragEvent, payload: DragPayload) {
  liveDrag = payload
  e.dataTransfer.setData(DND_MIME, JSON.stringify(payload))
  // Notes COPY onto a shelf (the row stays put); members/shelves MOVE.
  e.dataTransfer.effectAllowed = payload.kind === 'note' ? 'copy' : 'move'
}

function endDrag() {
  liveDrag = null
}

/** Top or bottom half of the hovered row → insert before it or after it. */
function slotFor(e: React.DragEvent, index: number): number {
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientY > r.top + r.height / 2 ? index + 1 : index
}
const SHELVES_OPEN_KEY = 'adamvaultos.pages.shelvesOpen'
/** Per-shelf disclosure, keyed by shelf name (shelves default collapsed). */
const SHELF_OPEN_PREFIX = 'adamvaultos.pages.shelf.'

export function PagesView({ path }: { path?: string }) {
  const { pages, pagesStatus, pagesError, notes } = useStore()
  const theme = useTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Collapse the whole sidebar to a bare dark sliver — just "◇ Pages" at the
  // top so you know where you are. Persisted like the work-tabs rail.
  const [sideCollapsed, setSideCollapsed] = useState(
    () => localStorage.getItem(SIDE_COLLAPSE_KEY) === '1',
  )
  const toggleSide = () =>
    setSideCollapsed((c) => {
      localStorage.setItem(SIDE_COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  const [creating, setCreating] = useState(false)
  const [sideQuery, setSideQuery] = useState('')
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())
  // Pinned folds away by default — 20+ pinned notes were swamping the sidebar
  // and burying Recent. Disclosure persists like the sidebar collapse.
  const [pinnedOpen, setPinnedOpen] = useState(
    () => localStorage.getItem(PINNED_OPEN_KEY) === '1',
  )
  const togglePinned = () =>
    setPinnedOpen((o) => {
      localStorage.setItem(PINNED_OPEN_KEY, o ? '0' : '1')
      return !o
    })

  // Canvas cards are their own surface — a card only becomes a browsable page
  // when you promote it there, so keep canvas/* out of the Pages browser.
  const pagePaths = useMemo(
    () => (pages ?? []).filter((p) => !p.startsWith('canvas/')),
    [pages],
  )

  // Live order: newest-touched first, from the note cache — so the doc you're
  // saving bubbles to the top instead of drifting down a stale list.
  const ordered = useMemo(() => {
    const ts = (p: string) => {
      const t = new Date(notes[p]?.updatedAt ?? 0).getTime()
      return Number.isNaN(t) ? 0 : t
    }
    return [...pagePaths].sort((a, b) => ts(b) - ts(a))
  }, [pagePaths, notes])

  // N3 — the minimal browser. Searching → the app's ONE relevance ranking
  // (same as the Library: title/slug ≫ path/tags ≫ BODY, AND-terms, phrase
  // bonuses). Bodies are lean until the first search keystroke pulls the full
  // corpus once — after that "arianne" finds body mentions too. Otherwise:
  // Recent + collapsible visual folders. Purely presentational.
  const bodiesRequested = useRef(false)
  useEffect(() => {
    if (sideQuery.trim() && !bodiesRequested.current) {
      bodiesRequested.current = true
      fetchAllNotes().catch(() => {
        bodiesRequested.current = false // retry on the next keystroke
      })
    }
  }, [sideQuery])

  const filtered = useMemo(() => {
    const q = sideQuery.trim()
    if (!q) return null
    const list = pagePaths
      .map((p) => notes[p])
      .filter((n): n is Note => Boolean(n))
    return rankNotes(q, list, (n) => sideTitle(n.path, n)).map((n) => n.path)
  }, [sideQuery, pagePaths, notes])

  // THE PLAN slot — desk/00-plan, when it exists, sits above everything.
  const hasPlan = useMemo(() => pagePaths.includes(PLAN_PATH), [pagePaths])

  // Pinned notes (metadata.pinned === true) live in a collapsible group below
  // the Plan slot so they never drift down the recency order — but never
  // swamp Recent either. The lean list already carries metadata, so this is
  // the same store data Recent reads. desk/00-plan is excluded: it already
  // has the dedicated slot on top.
  const pinned = useMemo(
    () =>
      pagePaths
        .filter((p) => p !== PLAN_PATH && notes[p]?.metadata.pinned === true)
        .sort((a, b) => a.localeCompare(b))
        .slice(0, PINNED_CAP),
    [pagePaths, notes],
  )

  const groups = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const p of ordered) {
      const seg = p.includes('/') ? p.slice(0, p.indexOf('/')) : '·'
      const list = m.get(seg)
      if (list) list.push(p)
      else m.set(seg, [p])
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [ordered])

  // Lazy-load the dataset when the view first opens.
  useEffect(() => {
    void loadPages()
  }, [])

  // Let any corner of the app open settings (e.g. the /ai no-key prompt).
  useEffect(() => {
    const open = () => setSettingsOpen(true)
    window.addEventListener(PAGES_SETTINGS_EVENT, open)
    return () => window.removeEventListener(PAGES_SETTINGS_EVENT, open)
  }, [])

  const newPage = async () => {
    if (creating) return
    setCreating(true)
    try {
      const note = await createPage({ title: 'Untitled' })
      navigate({ kind: 'pages', path: note.path })
    } catch (e) {
      toast('error', `Couldn’t create page — ${e instanceof Error ? e.message : e}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="pages" data-testid="pages">
      <aside className={`pages-sidebar${sideCollapsed ? ' is-collapsed' : ''}`}>
        <div className="pages-sidebar-head">
          <a
            className="pages-wordmark"
            href="#/library"
            onClick={(e) => {
              e.preventDefault()
              navigate({ kind: 'library' })
            }}
            title="Back to Library"
          >
            <svg width="15" height="15" viewBox="0 0 32 32" aria-hidden="true">
              <path
                d="M16 4.5 27.5 16 16 27.5 4.5 16Z"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="2.6"
              />
              <circle cx="16" cy="16" r="3" fill="var(--gold)" />
            </svg>
            Pages
          </a>
          {sideCollapsed ? (
            <button
              className="icon-btn pages-side-toggle"
              data-testid="pages-side-expand"
              title="Expand the page list"
              aria-label="Expand the page list"
              onClick={toggleSide}
            >
              »
            </button>
          ) : (
            <div className="pages-head-tools">
              <button
                className="icon-btn"
                data-testid="theme-toggle-pages"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle light / dark mode"
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
              </button>
              <button
                className="icon-btn"
                title="Editor settings"
                aria-label="Editor settings"
                onClick={() => setSettingsOpen(true)}
              >
                <IconSettings size={15} />
              </button>
              <button
                className="icon-btn pages-side-toggle"
                data-testid="pages-side-collapse"
                title="Collapse — just the dark rail"
                aria-label="Collapse the page list"
                onClick={toggleSide}
              >
                «
              </button>
            </div>
          )}
        </div>

        {!sideCollapsed && (
          <>
        <button
          className="rail-new pages-new"
          onClick={() => void newPage()}
          disabled={creating}
        >
          <IconPlus size={14} />
          New page
        </button>

        <input
          className="pages-side-search"
          placeholder="Search pages…"
          value={sideQuery}
          onChange={(e) => setSideQuery(e.target.value)}
        />

        <div className="pages-list">
          {pagesStatus === 'loading' && !pages ? (
            <div className="db-skeleton">
              <div className="skel-row" />
              <div className="skel-row" />
              <div className="skel-row" />
            </div>
          ) : pagesError && !pages ? (
            <div className="pages-side-state">
              <p>Couldn’t load pages.</p>
              <button className="btn btn-ghost" onClick={() => void loadPages()}>
                Retry
              </button>
            </div>
          ) : (pages ?? []).length === 0 ? (
            <p className="pages-side-empty">No pages yet.</p>
          ) : filtered ? (
            filtered.length === 0 ? (
              <p className="pages-side-empty">No page matches.</p>
            ) : (
              filtered.map((p) => <PageItem key={p} p={p} path={path} notes={notes} />)
            )
          ) : (
            <>
              {hasPlan && (
                <PageItem
                  p={PLAN_PATH}
                  path={path}
                  notes={notes}
                  plan
                  drag={{ kind: 'note', path: PLAN_PATH }}
                />
              )}
              <ShelvesSection path={path} notes={notes} pagePaths={pagePaths} />
              {pinned.length > 0 && (
                <div className="pages-pinned" data-testid="pages-pinned">
                  <button
                    className="pages-group-head pages-pinned-head"
                    data-testid="pinned-toggle"
                    aria-expanded={pinnedOpen}
                    onClick={togglePinned}
                  >
                    <span className="pages-group-chevron">
                      {pinnedOpen ? '▾' : '▸'}
                    </span>
                    <span className="pages-group-name">Pinned</span>
                    <span className="pages-group-count">{pinned.length}</span>
                  </button>
                  {pinnedOpen &&
                    pinned.map((p) => (
                      <PageItem
                        key={p}
                        p={p}
                        path={path}
                        notes={notes}
                        pinned
                        drag={{ kind: 'note', path: p }}
                      />
                    ))}
                </div>
              )}
              <div className="pages-section-label">Recent</div>
              {ordered.slice(0, RECENT_COUNT).map((p) => (
                <PageItem
                  key={p}
                  p={p}
                  path={path}
                  notes={notes}
                  drag={{ kind: 'note', path: p }}
                />
              ))}
              <div className="pages-section-label pages-section-label-groups">Folders</div>
              {groups.map(([seg, paths]) => {
                const open = openGroups.has(seg)
                return (
                  <div key={seg} className="pages-group">
                    <button
                      className="pages-group-head"
                      aria-expanded={open}
                      onClick={() =>
                        setOpenGroups((prev) => {
                          const next = new Set(prev)
                          if (next.has(seg)) next.delete(seg)
                          else next.add(seg)
                          return next
                        })
                      }
                    >
                      <span className="pages-group-chevron">{open ? '▾' : '▸'}</span>
                      <span className="pages-group-name">{seg}</span>
                      <span className="pages-group-count">{paths.length}</span>
                    </button>
                    {open && (
                      <FolderContents
                        seg={seg}
                        paths={paths}
                        path={path}
                        notes={notes}
                        openGroups={openGroups}
                        setOpenGroups={setOpenGroups}
                      />
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
          </>
        )}
      </aside>

      <main className="pages-main">
        <AuthBanner />
        {path ? (
          path.startsWith('desk/') ? (
            // Work docs get the tab rail (W1) — daily notes + project docs.
            <div className="workdoc">
              <WorkTabs path={path} />
              <div className="workdoc-editor">
                <PageEditor key={path} path={path} />
              </div>
            </div>
          ) : (
            <PageEditor key={path} path={path} />
          )
        ) : (
          <div className="page-empty">
            <p className="page-empty-title">A clean page</p>
            <p className="page-empty-msg">
              Pick a page from the left, or start a new one. Type{' '}
              <kbd>/</kbd> anywhere for blocks, <kbd>/ai</kbd> to ask your vault,{' '}
              <kbd>/voice</kbd> to dictate.
            </p>
            <button className="btn btn-gold" onClick={() => void newPage()} disabled={creating}>
              <IconPlus size={14} />
              New page
            </button>
          </div>
        )}
      </main>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

/** One level of nesting inside a folder: notes under `seg/<sub>/…` group into
 * collapsible subfolders (Adam: "_priority hides Escensus, which has more
 * notes than anything"); direct children list first. Deeper paths stay flat
 * inside their subfolder — two levels is structure, three is a filing cabinet. */
function FolderContents({
  seg,
  paths,
  path,
  notes,
  openGroups,
  setOpenGroups,
}: {
  seg: string
  paths: string[]
  path?: string
  notes: Record<string, Note>
  openGroups: Set<string>
  setOpenGroups: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const direct: string[] = []
  const subs = new Map<string, string[]>()
  for (const p of paths) {
    const rest = p.slice(seg.length + 1)
    const cut = rest.indexOf('/')
    if (cut === -1) {
      direct.push(p)
    } else {
      const sub = rest.slice(0, cut)
      const list = subs.get(sub)
      if (list) list.push(p)
      else subs.set(sub, [p])
    }
  }
  const subList = [...subs.entries()].sort((a, b) => b[1].length - a[1].length)
  return (
    <>
      {direct.map((p) => (
        <PageItem key={p} p={p} path={path} notes={notes} indent />
      ))}
      {subList.map(([sub, subPaths]) => {
        const key = `${seg}/${sub}`
        const open = openGroups.has(key)
        return (
          <div key={key} className="pages-group pages-subgroup">
            <button
              className="pages-group-head pages-subgroup-head"
              aria-expanded={open}
              onClick={() =>
                setOpenGroups((prev) => {
                  const next = new Set(prev)
                  if (next.has(key)) next.delete(key)
                  else next.add(key)
                  return next
                })
              }
            >
              <span className="pages-group-chevron">{open ? '▾' : '▸'}</span>
              <span className="pages-group-name">{sub}</span>
              <span className="pages-group-count">{subPaths.length}</span>
            </button>
            {open &&
              subPaths.map((p) => (
                <PageItem key={p} p={p} path={path} notes={notes} indent deep />
              ))}
          </div>
        )
      })}
    </>
  )
}

// ——— SHELVES — virtual folders (desk/shelves). Visual grouping ONLY: a shelf
// never moves, retags, or relinks a note. The whole layout lives in one
// hand-editable markdown note; every write here is an explicit click that
// re-reads the note, re-applies the intent, and saves through the same
// conflict-safe flow as Ask AI's insert. ———

function ShelvesSection({
  path,
  notes,
  pagePaths,
}: {
  path?: string
  notes: Record<string, Note>
  pagePaths: string[]
}) {
  const note = notes[SHELVES_PATH]
  const shelves = useMemo(
    () => (note?.content ? parseShelves(note.content) : []),
    [note?.content],
  )
  // Default OPEN (unlike Pinned) — shelves are curated, so they stay small.
  const [open, setOpen] = useState(
    () => localStorage.getItem(SHELVES_OPEN_KEY) !== '0',
  )
  const toggle = () =>
    setOpen((o) => {
      localStorage.setItem(SHELVES_OPEN_KEY, o ? '0' : '1')
      return !o
    })
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  // Hydrate the layout note once — the lean pages list carries no bodies.
  // Missing is fine: the section is just the "+ New shelf" affordance until
  // the first shelf creates desk/shelves.
  useEffect(() => {
    fetchNote(SHELVES_PATH).catch(() => {})
  }, [])

  /** Every mutation: re-read the freshest desk/shelves, apply the intent to
   * THAT parse (never a stale render), regenerate the canonical markdown, and
   * write via the conflict-safe saveContent flow — create-if-missing on the
   * very first shelf. `fn` returning null = silent no-op, nothing written. */
  const mutate = async (fn: (current: Shelf[]) => Shelf[] | null) => {
    try {
      const fresh = await fetchNote(SHELVES_PATH)
      const next = fn(fresh?.content ? parseShelves(fresh.content) : [])
      if (!next) return
      const body = serializeShelves(next)
      const updated = fresh
        ? await saveContent(SHELVES_PATH, body, {
            updatedAt: fresh.updatedAt,
            content: fresh.content ?? '',
          })
        : await createNoteAt(SHELVES_PATH, body, ['desk'], { type: 'note' })
      // An open desk/shelves editor re-syncs in place (won't clobber edits).
      announcePageUpdate(updated.path, updated.content ?? '', updated.updatedAt)
    } catch (e) {
      toast('error', `Couldn’t save shelves — ${e instanceof Error ? e.message : e}`)
    }
  }

  const atCap = shelves.length >= SHELF_CAP

  const submitName = () => {
    const trimmed = name.trim()
    // Empty or duplicate: quietly keep the input open for a rethink.
    if (!trimmed || atCap || shelves.some((s) => s.name === trimmed)) return
    setNaming(false)
    setName('')
    void mutate((current) =>
      current.length >= SHELF_CAP || current.some((s) => s.name === trimmed)
        ? null
        : [...current, { name: trimmed, members: [] }],
    )
  }

  const addMember = (shelfName: string, notePath: string) =>
    void mutate((current) =>
      // Already on this shelf (or the shelf vanished) — silent no-op.
      current.some((s) => s.name === shelfName && !s.members.includes(notePath))
        ? current.map((s) =>
            s.name === shelfName
              ? { ...s, members: [...s.members, notePath] }
              : s,
          )
        : null,
    )

  /** Insert `item` before `before` (null / not found → append). */
  const insertBefore = (list: string[], item: string, before: string | null) => {
    const next = [...list]
    const at = before === null ? -1 : next.indexOf(before)
    if (at === -1) next.push(item)
    else next.splice(at, 0, item)
    return next
  }

  // Drop intents. The UI hands over an ANCHOR (the member/shelf the drop
  // landed above; null = end) rather than a raw index — mutate() re-reads the
  // freshest note, so an anchor survives concurrent edits and the hidden
  // members that don't render (missing notes) without off-by-ones.

  /** Note row dropped on a shelf — same dedup rule as +: already there → no-op. */
  const addMemberAt = (shelfName: string, notePath: string, before: string | null) =>
    void mutate((current) => {
      const shelf = current.find((s) => s.name === shelfName)
      if (!shelf || shelf.members.includes(notePath)) return null
      return current.map((s) =>
        s.name === shelfName
          ? { ...s, members: insertBefore(s.members, notePath, before) }
          : s,
      )
    })

  /** Member dropped inside a shelf (reorder) or on another shelf (move —
   * leaves A; joins B at the drop slot unless already there: no dupes). */
  const moveMember = (
    fromName: string,
    toName: string,
    notePath: string,
    before: string | null,
  ) =>
    void mutate((current) => {
      const from = current.find((s) => s.name === fromName)
      const to = current.find((s) => s.name === toName)
      if (!from || !to || !from.members.includes(notePath)) return null
      if (before === notePath) return null // dropped right where it sits
      if (fromName === toName) {
        const members = insertBefore(
          from.members.filter((m) => m !== notePath),
          notePath,
          before,
        )
        if (members.every((m, i) => m === from.members[i])) return null
        return current.map((s) => (s.name === fromName ? { ...s, members } : s))
      }
      return current.map((s) => {
        if (s.name === fromName)
          return { ...s, members: s.members.filter((m) => m !== notePath) }
        if (s.name === toName && !s.members.includes(notePath))
          return { ...s, members: insertBefore(s.members, notePath, before) }
        return s
      })
    })

  /** Shelf header dropped between shelf headers. */
  const reorderShelf = (name: string, before: string | null) =>
    void mutate((current) => {
      if (name === before) return null
      const moved = current.find((s) => s.name === name)
      if (!moved) return null
      const rest = current.filter((s) => s.name !== name)
      const at = before === null ? -1 : rest.findIndex((s) => s.name === before)
      const next = [...rest]
      if (at === -1) next.push(moved)
      else next.splice(at, 0, moved)
      if (next.every((s, i) => s === current[i])) return null
      return next
    })

  /** A note/member drop landing on a shelf (header = append, member slot =
   * insert before the anchor). Shelf drags never route here. */
  const dropOnShelf = (
    shelfName: string,
    payload: DragPayload,
    before: string | null,
  ) => {
    if (payload.kind === 'note') addMemberAt(shelfName, payload.path, before)
    else if (payload.kind === 'member')
      moveMember(payload.fromShelf, shelfName, payload.path, before)
  }

  // Shelf-reorder hover slot (index into `shelves`; a gold line renders
  // there). Window-level dragend/drop is the safety net for cancelled drags.
  const [shelfDropIndex, setShelfDropIndex] = useState<number | null>(null)
  useEffect(() => {
    const clear = () => setShelfDropIndex(null)
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  const shelfDropAt = (payload: DragPayload, index: number) => {
    setShelfDropIndex(null)
    if (payload.kind !== 'shelf') return
    reorderShelf(payload.name, shelves[index]?.name ?? null)
  }

  const removeMember = (shelfName: string, notePath: string) =>
    void mutate((current) =>
      current.some((s) => s.name === shelfName && s.members.includes(notePath))
        ? current.map((s) =>
            s.name === shelfName
              ? { ...s, members: s.members.filter((m) => m !== notePath) }
              : s,
          )
        : null,
    )

  const deleteShelf = (shelf: Shelf) => {
    if (
      shelf.members.length > 0 &&
      !window.confirm(
        `Delete shelf “${shelf.name}”? Its notes stay exactly where they are.`,
      )
    ) {
      return
    }
    void mutate((current) => current.filter((s) => s.name !== shelf.name))
  }

  return (
    <div className="pages-shelves" data-testid="pages-shelves">
      <div className="pages-shelf-row">
        <button
          className="pages-group-head pages-pinned-head"
          data-testid="shelves-toggle"
          aria-expanded={open}
          onClick={toggle}
        >
          <span className="pages-group-chevron">{open ? '▾' : '▸'}</span>
          <span className="pages-group-name">Shelves</span>
          <span className="pages-group-count">{shelves.length}</span>
        </button>
        <button
          className="pages-shelf-tool pages-shelf-tool-static"
          data-testid="shelf-new"
          disabled={atCap}
          title={atCap ? `Shelf limit reached (${SHELF_CAP})` : 'New shelf'}
          aria-label="New shelf"
          onClick={() => {
            setNaming(true)
            if (!open) toggle()
          }}
        >
          +
        </button>
      </div>
      {naming && (
        <div className="pages-shelf-inputbox">
          <input
            autoFocus
            className="pages-side-search pages-shelf-input"
            data-testid="shelf-name-input"
            placeholder="Shelf name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitName()
              if (e.key === 'Escape') {
                setNaming(false)
                setName('')
              }
            }}
          />
        </div>
      )}
      {open &&
        shelves.map((s, i) => (
          <Fragment key={s.name}>
            {shelfDropIndex === i && (
              <div className="pages-drop-line" data-testid="drop-line" />
            )}
            <ShelfRow
              shelf={s}
              index={i}
              path={path}
              notes={notes}
              pagePaths={pagePaths}
              onAdd={addMember}
              onRemove={removeMember}
              onDelete={() => deleteShelf(s)}
              onDropOnShelf={dropOnShelf}
              onShelfHover={setShelfDropIndex}
              onShelfDropAt={shelfDropAt}
            />
          </Fragment>
        ))}
      {open && shelfDropIndex === shelves.length && shelves.length > 0 && (
        <div className="pages-drop-line" data-testid="drop-line" />
      )}
    </div>
  )
}

function ShelfRow({
  shelf,
  index,
  path,
  notes,
  pagePaths,
  onAdd,
  onRemove,
  onDelete,
  onDropOnShelf,
  onShelfHover,
  onShelfDropAt,
}: {
  shelf: Shelf
  /** Position among the rendered shelves — shelf-reorder slots hang off it. */
  index: number
  path?: string
  notes: Record<string, Note>
  pagePaths: string[]
  onAdd: (shelfName: string, notePath: string) => void
  onRemove: (shelfName: string, notePath: string) => void
  onDelete: () => void
  onDropOnShelf: (
    shelfName: string,
    payload: DragPayload,
    before: string | null,
  ) => void
  onShelfHover: (insertIndex: number | null) => void
  onShelfDropAt: (payload: DragPayload, insertIndex: number) => void
}) {
  // Default collapsed; per-shelf disclosure keyed by name.
  const [open, setOpen] = useState(
    () => localStorage.getItem(`${SHELF_OPEN_PREFIX}${shelf.name}`) === '1',
  )
  const toggle = () =>
    setOpen((o) => {
      localStorage.setItem(`${SHELF_OPEN_PREFIX}${shelf.name}`, o ? '0' : '1')
      return !o
    })
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')

  // ——— DnD state: header highlight, member insertion slot, spring timer. ———
  const [headOver, setHeadOver] = useState(false)
  const [overSlot, setOverSlot] = useState<number | null>(null)
  const springTimer = useRef<number | null>(null)
  const clearSpring = () => {
    if (springTimer.current !== null) {
      window.clearTimeout(springTimer.current)
      springTimer.current = null
    }
  }
  // Cancelled or elsewhere-dropped drags: sweep every affordance clean.
  useEffect(() => {
    const clear = () => {
      setHeadOver(false)
      setOverSlot(null)
      clearSpring()
    }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  /** The header accepts notes and members of OTHER shelves (a member dropped
   * back on its own header would only mean "stay put"). */
  const headerAccepts = () =>
    liveDrag?.kind === 'note' ||
    (liveDrag?.kind === 'member' && liveDrag.fromShelf !== shelf.name)
  /** The member area additionally accepts this shelf's own members (reorder). */
  const areaAccepts = () =>
    liveDrag?.kind === 'note' || liveDrag?.kind === 'member'

  const expandForDrag = () => {
    setOpen(true)
    localStorage.setItem(`${SHELF_OPEN_PREFIX}${shelf.name}`, '1')
  }

  const onHeaderEnter = (e: React.DragEvent) => {
    if (!headerAccepts()) return
    e.preventDefault()
    setHeadOver(true)
    // Spring-loading: keep hovering a COLLAPSED header and it opens itself.
    if (!open && springTimer.current === null) {
      springTimer.current = window.setTimeout(() => {
        springTimer.current = null
        expandForDrag()
      }, SPRING_OPEN_MS)
    }
  }
  const onHeaderOver = (e: React.DragEvent) => {
    if (liveDrag?.kind === 'shelf') {
      if (liveDrag.name === shelf.name) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      onShelfHover(slotFor(e, index))
      return
    }
    if (!headerAccepts()) return
    e.preventDefault()
    e.dataTransfer.dropEffect = liveDrag?.kind === 'note' ? 'copy' : 'move'
    setHeadOver(true)
  }
  const onHeaderLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setHeadOver(false)
    clearSpring()
    if (liveDrag?.kind === 'shelf') onShelfHover(null)
  }
  const onHeaderDrop = (e: React.DragEvent) => {
    const payload = readDragPayload(e)
    setHeadOver(false)
    clearSpring()
    if (!payload) return
    e.preventDefault()
    e.stopPropagation()
    if (payload.kind === 'shelf') {
      if (payload.name !== shelf.name) onShelfDropAt(payload, slotFor(e, index))
      return
    }
    // A member dropped on its OWN header stays put — never a surprise shuffle.
    if (payload.kind === 'member' && payload.fromShelf === shelf.name) return
    onDropOnShelf(shelf.name, payload, null) // header drop = append
  }

  // Members whose note no longer exists are skipped silently — the wikilink
  // stays in desk/shelves (the note might come back); it just doesn't render.
  const existing = useMemo(() => {
    const have = new Set(pagePaths)
    return shelf.members.filter((m) => have.has(m))
  }, [shelf.members, pagePaths])

  // The sidebar's ONE relevance ranking, reused: filter every loaded page
  // title, shortlist the top handful.
  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return []
    const list = pagePaths
      .map((p) => notes[p])
      .filter((n): n is Note => Boolean(n))
    return rankNotes(q, list, (n) => sideTitle(n.path, n)).slice(0, 8)
  }, [query, pagePaths, notes])

  return (
    <div className={`pages-group pages-shelf${headOver ? ' is-drop-target' : ''}`}>
      <div
        className="pages-shelf-row"
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          startDrag(e, { kind: 'shelf', name: shelf.name })
        }}
        onDragEnd={() => {
          endDrag()
          onShelfHover(null)
        }}
        onDragEnter={onHeaderEnter}
        onDragOver={onHeaderOver}
        onDragLeave={onHeaderLeave}
        onDrop={onHeaderDrop}
      >
        <button
          className="pages-group-head"
          data-testid="shelf-head"
          aria-expanded={open}
          onClick={toggle}
        >
          <span className="pages-group-chevron">{open ? '▾' : '▸'}</span>
          <span className="pages-group-name">{shelf.name}</span>
          <span className="pages-group-count">{existing.length}</span>
        </button>
        <button
          className="pages-shelf-tool"
          data-testid="shelf-add"
          title={`Add a note to “${shelf.name}”`}
          aria-label={`Add a note to ${shelf.name}`}
          onClick={() => {
            setAdding((a) => !a)
            setQuery('')
          }}
        >
          +
        </button>
        <button
          className="pages-shelf-tool"
          data-testid="shelf-delete"
          title={`Delete shelf “${shelf.name}” — its notes stay put`}
          aria-label={`Delete shelf ${shelf.name}`}
          onClick={onDelete}
        >
          ×
        </button>
      </div>
      {adding && (
        <div className="pages-shelf-inputbox">
          <input
            autoFocus
            className="pages-side-search pages-shelf-input"
            data-testid="shelf-add-input"
            placeholder="Add a note…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setAdding(false)
                setQuery('')
              }
            }}
          />
          {results.map((n) => (
            <button
              key={n.path}
              className="pages-shelf-result"
              data-testid="shelf-add-result"
              onClick={() => {
                onAdd(shelf.name, n.path)
                setAdding(false)
                setQuery('')
              }}
            >
              {sideTitle(n.path, n)}
            </button>
          ))}
        </div>
      )}
      {open && (
        <div
          className="pages-shelf-members"
          data-testid="shelf-members"
          onDragOver={(e) => {
            // The gap under the last member — append.
            if (!areaAccepts()) return
            e.preventDefault()
            e.dataTransfer.dropEffect = liveDrag?.kind === 'note' ? 'copy' : 'move'
            setOverSlot(existing.length)
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
            setOverSlot(null)
          }}
          onDrop={(e) => {
            const payload = readDragPayload(e)
            setOverSlot(null)
            if (!payload || payload.kind === 'shelf') return
            e.preventDefault()
            e.stopPropagation()
            onDropOnShelf(shelf.name, payload, null)
          }}
        >
          {existing.map((p, i) => (
            <Fragment key={p}>
              {overSlot === i && (
                <div className="pages-drop-line" data-testid="drop-line" />
              )}
              <div
                className="pages-shelf-member"
                onDragOver={(e) => {
                  if (!areaAccepts()) return
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect =
                    liveDrag?.kind === 'note' ? 'copy' : 'move'
                  setOverSlot(slotFor(e, i))
                }}
                onDrop={(e) => {
                  const payload = readDragPayload(e)
                  setOverSlot(null)
                  if (!payload || payload.kind === 'shelf') return
                  e.preventDefault()
                  e.stopPropagation()
                  // Anchor = the visible member at the slot; null = append.
                  // (Hidden members — missing notes — keep their lines; the
                  // anchor resolves against the FRESH parse inside mutate.)
                  onDropOnShelf(
                    shelf.name,
                    payload,
                    existing[slotFor(e, i)] ?? null,
                  )
                }}
              >
                <PageItem
                  p={p}
                  path={path}
                  notes={notes}
                  indent
                  drag={{ kind: 'member', path: p, fromShelf: shelf.name }}
                />
                <button
                  className="pages-shelf-remove"
                  data-testid="shelf-remove"
                  title="Remove from this shelf — the note itself is untouched"
                  aria-label={`Remove from ${shelf.name}`}
                  onClick={() => onRemove(shelf.name, p)}
                >
                  ×
                </button>
              </div>
            </Fragment>
          ))}
          {overSlot === existing.length && existing.length > 0 && (
            <div className="pages-drop-line" data-testid="drop-line" />
          )}
        </div>
      )}
    </div>
  )
}

function PageItem({
  p,
  path,
  notes,
  indent,
  deep,
  pinned,
  plan,
  drag,
}: {
  p: string
  path?: string
  notes: Record<string, Note>
  indent?: boolean
  deep?: boolean
  /** Row lives in the Pinned group — show the little pin marker. */
  pinned?: boolean
  /** THE PLAN front-door slot — pin marker plus a firmer voice. */
  plan?: boolean
  /** When set, the row can be dragged onto a shelf, carrying this payload.
   * Absent (folders, search results, section labels) → no app-level drag. */
  drag?: DragPayload
}) {
  return (
    <a
      className={`pages-item${p === path ? ' is-active' : ''}${indent ? ' pages-item-indent' : ''}${deep ? ' pages-item-deep' : ''}${plan ? ' pages-item-plan' : ''}${drag ? ' pages-item-draggable' : ''}`}
      href={hrefFor({ kind: 'pages', path: p })}
      data-testid={plan ? 'plan-slot' : undefined}
      draggable={drag ? true : undefined}
      onDragStart={drag ? (e) => startDrag(e, drag) : undefined}
      onDragEnd={drag ? () => endDrag() : undefined}
    >
      <span className="pages-item-title">
        {(pinned || plan) && <IconPin size={11} className="pages-item-pin" />}
        {sideTitle(p, notes[p])}
      </span>
      <span className="pages-item-time">{relativeTime(notes[p]?.updatedAt)}</span>
    </a>
  )
}

// ——— settings: client-only keys for /ai (Anthropic) and /voice (scribe) ———

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useEditorSettings()
  const [models, setModels] = useState<string[] | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)

  const detect = async () => {
    if (loadingModels) return
    setLoadingModels(true)
    try {
      const list = await listScribeModels(s.scribeUrl, s.scribeToken || undefined)
      setModels(list)
      if (list.length > 0 && !list.includes(s.scribeModel)) {
        setSetting('scribeModel', list[0]!)
      }
    } catch (e) {
      toast('error', `Couldn’t list models — ${e instanceof Error ? e.message : e}`)
    } finally {
      setLoadingModels(false)
    }
  }

  return (
    <Modal onClose={onClose} width={480} labelledBy="settings-title">
      <div className="settings-panel">
        <h2 id="settings-title" className="settings-title">
          Editor settings
        </h2>
        <p className="settings-note">
          Stored only in this browser — never committed, never sent to the vault.
        </p>

        <div className="settings-group">
          <div className="settings-group-label">Ask AI · Anthropic</div>
          <label className="settings-field">
            <span className="settings-field-label">API key</span>
            <input
              type="password"
              className="settings-input"
              placeholder="sk-ant-…"
              autoComplete="off"
              value={s.anthropicKey}
              onChange={(e) => setSetting('anthropicKey', e.target.value)}
            />
          </label>
        </div>

        <div className="settings-group">
          <div className="settings-group-label">Voice · parachute-scribe</div>
          <label className="settings-field">
            <span className="settings-field-label">Scribe URL</span>
            <input
              className="settings-input"
              placeholder="http://localhost:1943"
              value={s.scribeUrl}
              onChange={(e) => setSetting('scribeUrl', e.target.value)}
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">
              Token <em>optional</em>
            </span>
            <input
              type="password"
              className="settings-input"
              autoComplete="off"
              value={s.scribeToken}
              onChange={(e) => setSetting('scribeToken', e.target.value)}
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">Model</span>
            <span className="settings-model">
              <input
                className="settings-input"
                value={s.scribeModel}
                onChange={(e) => setSetting('scribeModel', e.target.value)}
              />
              <button
                className="btn btn-ghost"
                disabled={loadingModels}
                onClick={() => void detect()}
              >
                {loadingModels ? '…' : 'Detect'}
              </button>
            </span>
          </label>
          {models && models.length > 0 && (
            <div className="settings-models">
              {models.map((m) => (
                <button
                  key={m}
                  className={`settings-chip${m === s.scribeModel ? ' is-on' : ''}`}
                  onClick={() => setSetting('scribeModel', m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <label className="settings-check">
            <input
              type="checkbox"
              checked={s.scribeCleanup}
              onChange={(e) => setSetting('scribeCleanup', e.target.checked)}
            />
            <span>Clean up transcript</span>
          </label>
        </div>

        <div className="settings-actions">
          <button className="btn btn-gold" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
