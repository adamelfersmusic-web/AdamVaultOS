import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { disconnect, useStore } from '../lib/store'
import { navigate, type Route } from '../lib/router'
import { AuthBanner } from '../components/AuthBanner'
import { openPalette, openShortcuts, toggleAskAi } from '../lib/ui'
import { toggleTheme, useTheme } from '../lib/theme'
import {
  IconBoard,
  IconCalendar,
  IconCheck,
  IconDisconnect,
  IconGallery,
  IconGem,
  IconGraph,
  IconLibrary,
  IconMoon,
  IconPage,
  IconSpark,
  IconSun,
  IconTodo,
} from '../components/Icons'

// THE GEM DOOR — the wordmark's gem is its own button (a thumb-reachable
// monument door onto the Map); the text part keeps navigating to Projects.
function Wordmark() {
  return (
    <div className="wordmark">
      <button
        className="wordmark-gem-btn"
        data-testid="wordmark-gem"
        title="The Map"
        aria-label="The Map"
        onClick={(e) => {
          e.stopPropagation()
          navigate({ kind: 'map' })
        }}
      >
        <svg className="wordmark-gem" width="18" height="18" viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M16 4.5 27.5 16 16 27.5 4.5 16Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          />
          <circle cx="16" cy="16" r="3" fill="currentColor" />
        </svg>
      </button>
      <a
        className="wordmark-link"
        href="#/projects"
        onClick={(e) => {
          e.preventDefault()
          navigate({ kind: 'projects' })
        }}
      >
        <span className="wordmark-text">
          Adam
          <span className="wordmark-sub">Vault OS</span>
        </span>
      </a>
    </div>
  )
}

// ——— THE RAIL ORDER — the nav tabs drag-to-reorder (the house DnD in
// miniature: native HTML5, payload in dataTransfer with a module mirror for
// dragover, the thin gold insertion line, window-level dragend sweep).
// Dropping is the ONLY gesture that writes; a cancelled drag leaves no
// trace. The order is pure UI state, so it lives in localStorage — never
// the vault. No edit mode, no settings: the rail is just always draggable. ———

const RAIL_ORDER_KEY = 'adamvaultos.rail.order'

interface RailTab {
  key: string
  label: string
  href: string
  icon: ReactNode
  active: (route: Route) => boolean
}

/** The default order — also each tab's home slot when the saved order has
 * never heard of it (a future feature appears where it was designed to). */
const RAIL_TABS: RailTab[] = [
  {
    key: 'projects',
    label: 'Projects',
    href: '#/projects',
    icon: <IconSpark size={15} />,
    active: (r) => r.kind === 'projects' || r.kind === 'project',
  },
  {
    key: 'pages',
    label: 'Pages',
    href: '#/pages',
    icon: <IconPage size={15} />,
    active: (r) => r.kind === 'pages',
  },
  {
    key: 'tasks',
    label: 'Tasks',
    href: '#/tasks',
    icon: <IconTodo size={15} />,
    active: (r) => r.kind === 'tasks',
  },
  {
    key: 'one-task',
    label: 'One Task',
    href: '#/one-task',
    icon: <IconCheck size={15} />,
    active: (r) => r.kind === 'one-task',
  },
  {
    key: 'time',
    label: 'Time',
    href: '#/time',
    icon: <IconCalendar size={15} />,
    active: (r) => r.kind === 'time',
  },
  {
    key: 'tracker',
    label: 'Tracker',
    href: '#/tracker',
    icon: <IconBoard size={15} />,
    active: (r) => r.kind === 'tracker',
  },
  {
    key: 'canvas',
    label: 'Canvas',
    href: '#/canvas',
    icon: <IconGallery size={15} />,
    active: (r) => r.kind === 'canvas',
  },
  {
    key: 'graph',
    label: 'Graph',
    href: '#/graph',
    icon: <IconGraph size={15} />,
    active: (r) => r.kind === 'graph',
  },
  {
    key: 'explore',
    label: 'Explore',
    href: '#/explore',
    icon: <IconGem size={15} />,
    active: (r) => r.kind === 'explore' || r.kind === 'explore-tag',
  },
  {
    key: 'library',
    label: 'Library',
    href: '#/library',
    icon: <IconLibrary size={15} />,
    active: (r) => r.kind === 'library' || r.kind === 'note',
  },
]

/** The saved order, defensively: unknown keys are dropped, duplicates
 * collapse, and every tab the stash is missing slots back in at its DEFAULT
 * index. A garbled stash never breaks the rail. */
function loadRailOrder(): RailTab[] {
  let saved: string[] = []
  try {
    const raw = localStorage.getItem(RAIL_ORDER_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    if (Array.isArray(parsed)) {
      saved = parsed.filter((k): k is string => typeof k === 'string')
    }
  } catch {
    // fall through to the default order
  }
  const byKey = new Map(RAIL_TABS.map((t) => [t.key, t]))
  const out: RailTab[] = []
  for (const k of saved) {
    const t = byKey.get(k)
    if (t && !out.includes(t)) out.push(t)
  }
  RAIL_TABS.forEach((t, i) => {
    if (!out.includes(t)) out.splice(Math.min(i, out.length), 0, t)
  })
  return out
}

const RAIL_DND_MIME = 'application/x-adamvaultos-raillink-dnd'
let liveRailDrag: string | null = null

/** Top or bottom half of the hovered tab → insert before it or after it. */
function slotFor(e: React.DragEvent, index: number): number {
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientY > r.top + r.height / 2 ? index + 1 : index
}

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { session, connection } = useStore()
  const theme = useTheme()
  let host = ''
  try {
    if (session) {
      const u = new URL(session.vaultUrl)
      host = u.host + u.pathname
    }
  } catch {
    host = session?.vaultUrl ?? ''
  }

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('adamvaultos.rail.collapsed') === '1',
  )
  const toggleRail = () =>
    setCollapsed((c) => {
      localStorage.setItem('adamvaultos.rail.collapsed', c ? '0' : '1')
      return !c
    })

  const [tabs, setTabs] = useState<RailTab[]>(loadRailOrder)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [slot, setSlot] = useState<number | null>(null)

  // Window-level dragend/drop is the safety net for cancelled drags: the
  // indicator clears, nothing is written.
  useEffect(() => {
    const clear = () => {
      liveRailDrag = null
      setDragKey(null)
      setSlot(null)
    }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  const dropTab = (fromKey: string, to: number) => {
    const from = tabs.findIndex((t) => t.key === fromKey)
    if (from === -1 || to === from || to === from + 1) return
    const next = [...tabs]
    const [moved] = next.splice(from, 1)
    next.splice(from < to ? to - 1 : to, 0, moved!)
    setTabs(next)
    localStorage.setItem(RAIL_ORDER_KEY, JSON.stringify(next.map((t) => t.key)))
  }

  const dragging = dragKey !== null

  return (
    <div className={`shell${collapsed ? ' rail-collapsed' : ''}`}>
      <aside className={`rail${collapsed ? ' is-collapsed' : ''}`}>
        <div className="rail-top">
          <Wordmark />
          <button
            className="rail-collapse"
            data-testid="rail-collapse"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={toggleRail}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="rail-nav">
          {tabs.map((t, i) => (
            <Fragment key={t.key}>
              {dragging && slot === i && (
                <div className="rail-drop-line" data-testid="rail-drop-line" />
              )}
              <a
                className={`rail-link${t.active(route) ? ' is-active' : ''}`}
                href={t.href}
                data-railkey={t.key}
                draggable
                onDragStart={(e) => {
                  liveRailDrag = t.key
                  e.dataTransfer.setData(RAIL_DND_MIME, t.key)
                  e.dataTransfer.effectAllowed = 'move'
                  setDragKey(t.key)
                }}
                onDragOver={(e) => {
                  if (liveRailDrag === null) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setSlot(slotFor(e, i))
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const raw = e.dataTransfer.getData(RAIL_DND_MIME)
                  const fromKey = raw || liveRailDrag
                  // The slot comes from the EVENT, not state — the render
                  // indicator may lag a dispatch-fast drop.
                  const to = slotFor(e, i)
                  liveRailDrag = null
                  setDragKey(null)
                  setSlot(null)
                  if (fromKey) dropTab(fromKey, to)
                }}
              >
                {t.icon}
                {t.label}
              </a>
            </Fragment>
          ))}
          {dragging && slot === tabs.length && (
            <div className="rail-drop-line" data-testid="rail-drop-line" />
          )}
        </nav>

        <button className="rail-kbd" onClick={openPalette}>
          Jump anywhere
          <kbd>⌘K</kbd>
        </button>
        <button
          className="rail-kbd rail-askai"
          data-testid="askai-open"
          onClick={toggleAskAi}
        >
          Ask AI
          <kbd>⌘J</kbd>
        </button>

        <div className="rail-foot">
          <button
            className="rail-theme"
            data-testid="theme-toggle"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <IconSun size={13} /> : <IconMoon size={13} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          {connection === 'auth-error' ? (
            <div className="vault-status vault-status-error">
              <i className="status-dot status-dot-error" />
              <span className="vault-host" title={host}>
                session expired — reconnect
              </span>
            </div>
          ) : (
            <div
              className="vault-status"
              title={`${host} · ${session?.mode === 'oauth' ? 'OAuth session' : 'pasted token'}`}
            >
              <i className="status-dot" />
              <span className="vault-host">{host}</span>
            </div>
          )}
          <button
            className="rail-disconnect"
            title="Disconnect — clears the stored URL and token"
            onClick={() => {
              disconnect()
              navigate({ kind: 'connect' })
            }}
          >
            <IconDisconnect size={13} />
            Disconnect
          </button>
          <button
            className="rail-shortcuts"
            data-testid="shortcuts-open"
            title="Keyboard shortcuts (⌘/)"
            onClick={openShortcuts}
          >
            <span aria-hidden="true">⌨</span>
            Shortcuts
          </button>
        </div>
      </aside>

      <main className="stage">
        <AuthBanner />
        {children}
      </main>
    </div>
  )
}
