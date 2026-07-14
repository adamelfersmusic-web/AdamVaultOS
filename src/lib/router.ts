// Minimal hash router. Note paths contain slashes (e.g. Amanda/00-home), so
// they are carried as a SINGLE percent-encoded segment (slash → %2F) — the
// router never mistakes them for nested routes. parseHash also accepts the
// legacy multi-segment form for backward compatibility, and every segment is
// decoded defensively so a malformed escape can't throw and blank the app.

import { useSyncExternalStore } from 'react'
import type { LensKind } from './types'

export type Route =
  | { kind: 'connect' }
  | { kind: 'scripts'; lens?: LensKind }
  | { kind: 'tracker'; lens?: LensKind }
  | { kind: 'canvas' }
  | { kind: 'projects' }
  | { kind: 'project'; path: string }
  | { kind: 'note'; path: string }
  | { kind: 'library' }
  | { kind: 'graph' }
  | { kind: 'explore' }
  | { kind: 'explore-tag'; tag: string }
  | { kind: 'pages'; path?: string }
  | { kind: 'commandments' }
  | { kind: 'map' }

/** Decode a hash path back to a vault path. Accepts the single %2F-encoded
 * segment form (Amanda%2F00-home) and the legacy per-segment form
 * (Amanda/00-home); decoding is guarded so a bad escape never throws. */
function decodePath(segments: string[]): string {
  return segments
    .map((s) => {
      try {
        return decodeURIComponent(s)
      } catch {
        return s
      }
    })
    .join('/')
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  const [head, ...rest] = h.split('/')
  switch (head) {
    case 'connect':
      return { kind: 'connect' }
    case 'note': {
      const path = decodePath(rest)
      return path ? { kind: 'note', path } : { kind: 'library' }
    }
    case 'library':
      return { kind: 'library' }
    case 'canvas':
      return { kind: 'canvas' }
    case 'projects':
      return { kind: 'projects' }
    case 'project': {
      const path = decodePath(rest)
      return path ? { kind: 'project', path } : { kind: 'projects' }
    }
    case 'graph':
      return { kind: 'graph' }
    // The ceremonial wing — two monument rooms, deliberately unlisted in the
    // nav. Reached through the Omnibar and each other.
    case 'commandments':
      return { kind: 'commandments' }
    case 'map':
      return { kind: 'map' }
    case 'explore': {
      // #/explore/tag/<tag> — tags can themselves contain slashes
      // (capture/voice), so everything after /tag/ is decoded greedily as
      // ONE tag name (accepting both the %2F-encoded and legacy forms).
      if (rest[0] === 'tag') {
        const tag = decodePath(rest.slice(1))
        return tag ? { kind: 'explore-tag', tag } : { kind: 'explore' }
      }
      return { kind: 'explore' }
    }
    case 'pages': {
      const path = decodePath(rest)
      return path ? { kind: 'pages', path } : { kind: 'pages' }
    }
    case 'scripts': {
      const lens = rest[0]
      if (lens === 'table' || lens === 'board' || lens === 'gallery') {
        return { kind: 'scripts', lens }
      }
      return { kind: 'scripts' }
    }
    case 'tracker': {
      const lens = rest[0]
      if (lens === 'table' || lens === 'board' || lens === 'gallery') {
        return { kind: 'tracker', lens }
      }
      return { kind: 'tracker' }
    }
    default:
      // The Cockpit is the app's front door — a calm deck of project cards.
      return { kind: 'projects' }
  }
}

export function hrefFor(route: Route): string {
  switch (route.kind) {
    case 'connect':
      return '#/connect'
    case 'scripts':
      return route.lens ? `#/scripts/${route.lens}` : '#/scripts'
    case 'tracker':
      return route.lens ? `#/tracker/${route.lens}` : '#/tracker'
    case 'library':
      return '#/library'
    case 'canvas':
      return '#/canvas'
    case 'projects':
      return '#/projects'
    case 'project':
      return `#/project/${encodeURIComponent(route.path)}`
    case 'graph':
      return '#/graph'
    case 'commandments':
      return '#/commandments'
    case 'map':
      return '#/map'
    case 'explore':
      return '#/explore'
    case 'explore-tag':
      // Same single-encoded-segment contract as note paths: the slashed tag
      // stays opaque to the splitter.
      return `#/explore/tag/${encodeURIComponent(route.tag)}`
    case 'pages':
      // Single %2F-encoded segment so the slashed vault path is opaque to the
      // splitter (and never re-parsed as a nested route).
      return route.path ? `#/pages/${encodeURIComponent(route.path)}` : '#/pages'
    case 'note':
      return `#/note/${encodeURIComponent(route.path)}`
  }
}

export function navigate(route: Route): void {
  window.location.hash = hrefFor(route)
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

function getSnapshot(): string {
  return window.location.hash
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot)
  return parseHash(hash)
}

/** Guard asked before leaving the current route (dirty editors). */
let routeGuard: (() => boolean) | null = null
let lastHash = window.location.hash

export function setRouteGuard(guard: (() => boolean) | null): void {
  routeGuard = guard
  lastHash = window.location.hash
}

window.addEventListener('hashchange', () => {
  if (routeGuard && window.location.hash !== lastHash) {
    if (!routeGuard()) {
      // Veto: restore the previous hash without re-triggering the guard.
      const guard = routeGuard
      routeGuard = null
      window.location.hash = lastHash
      setTimeout(() => {
        routeGuard = guard
      }, 0)
      return
    }
    routeGuard = null
  }
  lastHash = window.location.hash
})
