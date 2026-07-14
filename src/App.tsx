import { lazy, Suspense, useEffect, useRef } from 'react'
import { processOAuthReturn, useStore } from './lib/store'
import { useUi, openPalette, closePalette, toggleAskAi } from './lib/ui'
import { AskAi } from './components/AskAi'
import { navigate, useRoute } from './lib/router'
import { installVaultLinkInterceptor } from './lib/vaultLinks'
import { Shell } from './views/Shell'
import { ConnectView } from './views/ConnectView'
import { DatabaseView } from './views/DatabaseView'
import { NotePage } from './views/NotePage'
import { LibraryView } from './views/LibraryView'
import { CanvasView } from './views/CanvasView'
import { ProjectsView } from './views/ProjectsView'
import { ProjectWorld } from './views/ProjectWorld'
import { GraphView } from './views/GraphView'
import { NewScriptModal } from './views/NewScriptModal'
import { Omnibar } from './components/Omnibar'
import { CaptureDock } from './components/CaptureDock'
import { ToastHost } from './components/Toast'
import { SCRIPTS_DB } from './domain/scripts'
import { TRACKER_DB } from './domain/tracker'

// Pages pulls in the whole Tiptap/ProseMirror editor — keep it out of the
// initial bundle so Scripts/Graph/Library stay light. It loads on first visit.
const PagesView = lazy(() =>
  import('./views/PagesView').then((m) => ({ default: m.PagesView })),
)

// Explore is its own world — split it out so the everyday bundle (and the
// editor's load timing) stays exactly as it was. It loads on first visit.
const ExploreView = lazy(() =>
  import('./views/ExploreView').then((m) => ({ default: m.ExploreView })),
)

export default function App() {
  const { session, oauthStatus, oauthError } = useStore()
  const ui = useUi()
  const route = useRoute()
  const ranReturn = useRef(false)

  // On first load, finish an OAuth return (?code&state / ?error) if present.
  // init() in main.tsx already restored any saved session synchronously.
  useEffect(() => {
    if (ranReturn.current) return
    ranReturn.current = true
    void processOAuthReturn()
  }, [])

  // Stored notes carry plain markdown links whose hrefs are bare vault paths
  // (`[Title](people/x/y)`). ONE document-level interceptor keeps every such
  // click inside the SPA — read views and editors alike — routing by the
  // house note-opening rule instead of hard-navigating into a hosting 404.
  useEffect(() => installVaultLinkInterceptor(), [])

  // Global shortcuts: ⌘K / Ctrl+K opens the palette, ⌘J / Ctrl+J Ask AI —
  // anywhere, including the full-bleed Pages and Graph layouts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (ui.paletteOpen) closePalette()
        else if (session) openPalette()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        if (session) toggleAskAi()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui.paletteOpen, session])

  // Route guard: unconfigured sessions land on connect; configured sessions
  // never see it.
  useEffect(() => {
    if (!session && route.kind !== 'connect') navigate({ kind: 'connect' })
    if (session && route.kind === 'connect') navigate({ kind: 'projects' })
  }, [session, route.kind])

  if (oauthStatus === 'completing') {
    return (
      <div className="connect">
        <div className="connect-glow" aria-hidden="true" />
        <div className="connect-card connect-completing" data-testid="oauth-completing">
          <div className="spinner" aria-hidden="true" />
          <h1 className="connect-title">Signing in…</h1>
          <p className="connect-sub">Exchanging the authorization code with your hub.</p>
        </div>
      </div>
    )
  }

  // Show the connect screen when signed out, on the connect route, OR whenever
  // an OAuth error is pending — so a failed exchange surfaces a readable message
  // instead of being hidden behind a (possibly stale) session or a blank screen.
  if (!session || route.kind === 'connect' || oauthError) {
    return (
      <>
        <ConnectView />
        <ToastHost />
      </>
    )
  }

  // The graph is full-bleed: the sidebar collapses away entirely.
  if (route.kind === 'graph') {
    return (
      <>
        <GraphView />
        {ui.paletteOpen && <Omnibar />}
        <AskAi />
        <CaptureDock />
        <ToastHost />
      </>
    )
  }

  // Pages is full-bleed too — its own two-pane shell replaces the rail.
  if (route.kind === 'pages') {
    return (
      <>
        <Suspense
          fallback={
            <div className="pages-loading">
              <div className="spinner" aria-hidden="true" />
            </div>
          }
        >
          <PagesView path={route.path} />
        </Suspense>
        {ui.paletteOpen && <Omnibar />}
        <AskAi />
        <CaptureDock />
        <ToastHost />
      </>
    )
  }

  return (
    <>
      <Shell route={route}>
        {route.kind === 'scripts' && (
          <DatabaseView def={SCRIPTS_DB} lensOverride={route.lens} />
        )}
        {route.kind === 'tracker' && (
          <DatabaseView def={TRACKER_DB} dataset="tracker" lensOverride={route.lens} />
        )}
        {route.kind === 'note' && <NotePage path={route.path} key={route.path} />}
        {route.kind === 'library' && <LibraryView />}
        {(route.kind === 'explore' || route.kind === 'explore-tag') && (
          <Suspense fallback={null}>
            <ExploreView tag={route.kind === 'explore-tag' ? route.tag : undefined} />
          </Suspense>
        )}
        {route.kind === 'canvas' && <CanvasView />}
        {route.kind === 'projects' && <ProjectsView />}
        {route.kind === 'project' && <ProjectWorld path={route.path} key={route.path} />}
      </Shell>
      {ui.newScriptOpen && <NewScriptModal />}
      {ui.paletteOpen && <Omnibar />}
      <AskAi />
      <CaptureDock />
      <ToastHost />
    </>
  )
}
