import { useState, type ReactNode } from 'react'
import { disconnect, useStore } from '../lib/store'
import { navigate, type Route } from '../lib/router'
import { AuthBanner } from '../components/AuthBanner'
import { openPalette, toggleAskAi } from '../lib/ui'
import { toggleTheme, useTheme } from '../lib/theme'
import {
  IconBoard,
  IconDisconnect,
  IconGallery,
  IconGem,
  IconGraph,
  IconLibrary,
  IconMoon,
  IconPage,
  IconSpark,
  IconSun,
} from '../components/Icons'

function Wordmark() {
  return (
    <a
      className="wordmark"
      href="#/projects"
      onClick={(e) => {
        e.preventDefault()
        navigate({ kind: 'projects' })
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
      <span className="wordmark-text">
        Adam
        <span className="wordmark-sub">Vault OS</span>
      </span>
    </a>
  )
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
          <a
            className={`rail-link${route.kind === 'projects' || route.kind === 'project' ? ' is-active' : ''}`}
            href="#/projects"
          >
            <IconSpark size={15} />
            Projects
          </a>
          <a
            className={`rail-link${route.kind === 'pages' ? ' is-active' : ''}`}
            href="#/pages"
          >
            <IconPage size={15} />
            Pages
          </a>
          <a
            className={`rail-link${route.kind === 'tracker' ? ' is-active' : ''}`}
            href="#/tracker"
          >
            <IconBoard size={15} />
            Tracker
          </a>
          <a
            className={`rail-link${route.kind === 'canvas' ? ' is-active' : ''}`}
            href="#/canvas"
          >
            <IconGallery size={15} />
            Canvas
          </a>
          <a
            className={`rail-link${route.kind === 'graph' ? ' is-active' : ''}`}
            href="#/graph"
          >
            <IconGraph size={15} />
            Graph
          </a>
          <a
            className={`rail-link${route.kind === 'explore' || route.kind === 'explore-tag' ? ' is-active' : ''}`}
            href="#/explore"
          >
            <IconGem size={15} />
            Explore
          </a>
          <a
            className={`rail-link${route.kind === 'library' || route.kind === 'note' ? ' is-active' : ''}`}
            href="#/library"
          >
            <IconLibrary size={15} />
            Library
          </a>
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
        </div>
      </aside>

      <main className="stage">
        <AuthBanner />
        {children}
      </main>
    </div>
  )
}
