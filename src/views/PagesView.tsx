// Pages — a full-bleed, two-pane writing space (the Shell collapses away, like
// Graph). Left: every page, newest-first, with a "New page" button and the
// settings gear. Right: the block editor for the open page, or an invitation
// to start one.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import {
  createPage,
  fetchAllNotes,
  loadPages,
  toast,
  useStore,
} from '../lib/store'
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
                <PageItem p={PLAN_PATH} path={path} notes={notes} plan />
              )}
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
                      <PageItem key={p} p={p} path={path} notes={notes} pinned />
                    ))}
                </div>
              )}
              <div className="pages-section-label">Recent</div>
              {ordered.slice(0, RECENT_COUNT).map((p) => (
                <PageItem key={p} p={p} path={path} notes={notes} />
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

function PageItem({
  p,
  path,
  notes,
  indent,
  deep,
  pinned,
  plan,
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
}) {
  return (
    <a
      className={`pages-item${p === path ? ' is-active' : ''}${indent ? ' pages-item-indent' : ''}${deep ? ' pages-item-deep' : ''}${plan ? ' pages-item-plan' : ''}`}
      href={hrefFor({ kind: 'pages', path: p })}
      data-testid={plan ? 'plan-slot' : undefined}
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
