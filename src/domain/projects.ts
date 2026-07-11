// The Cockpit's project layer — the world-first reframe (build log PART 22).
//
// A project is a note tagged `project` (schema: order + phase indexed). Its
// metadata carries the Cockpit contract:
//   key     — the value its tasks use in their `project` field (tasks/<key>/…)
//   tag     — the knowledge tag its notes carry (#amanda, #escensus)
//   home    — optional path of the real front-door note (falls back to the
//             project note itself)
//   summary / status (active|parked|done) / order (display order, indexed)
//
// Everything here DERIVES from notes — no separate database, nothing to drift.

import type { ChipColor, Note } from '../lib/types'

export interface Project {
  /** Stable identity = the project note's path. */
  path: string
  title: string
  summary: string
  status: string
  order: number
  /** Task-matching key (tasks' metadata.project). */
  key: string
  /** Knowledge tag for the world's Notes section. */
  tag: string
  /** Front-door note rendered in the world's Overview. */
  home: string
  note: Note
}

export const PROJECT_TAG = 'project'

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

/** Display title: first heading of the content/preview, else the de-slugged
 * basename (with any trailing 4-char id suffix like `-di4z` stripped). */
function projectTitle(n: Note): string {
  const source = n.content ?? n.preview ?? ''
  const m = source.match(/^#{1,3}[ \t]+(.+?)(?:[ \t]*[#*_`].*)?$/m)
  if (m?.[1]) return m[1].trim()
  const base = (n.path.split('/').pop() ?? n.path).replace(/-[a-z0-9]{4}$/, '')
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Fallback key/tag when the note doesn't declare one: the path basename
 * minus any id suffix ("amanda-bridges-di4z" → "amanda-bridges"). */
function fallbackKey(n: Note): string {
  return (n.path.split('/').pop() ?? n.path).replace(/-[a-z0-9]{4}$/, '').toLowerCase()
}

export function toProject(n: Note): Project {
  const key = str(n.metadata['key']) || fallbackKey(n)
  return {
    path: n.path,
    title: projectTitle(n),
    summary: str(n.metadata['summary']),
    status: str(n.metadata['status']) || 'active',
    order: num(n.metadata['order'], 999),
    key,
    tag: str(n.metadata['tag']) || key,
    home: str(n.metadata['home']) || n.path,
    note: n,
  }
}

/** Notes tagged `project`, shaped and sorted for the Cockpit. Notes that also
 * carry `task` are malformed hybrids (pre-schema) — excluded from cards. */
export function toProjects(notes: Note[]): Project[] {
  return notes
    .filter((n) => !(n.tags ?? []).includes('task'))
    .map(toProject)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}

export const STATUS_COLORS: Record<string, ChipColor> = {
  active: 'green',
  parked: 'dim',
  done: 'neutral',
}

/** Progress over the tracker slice: tasks whose metadata.project === key. */
export function projectProgress(
  key: string,
  taskNotes: Note[],
): { total: number; done: number } {
  let total = 0
  let done = 0
  for (const t of taskNotes) {
    if (String(t.metadata['project'] ?? '') !== key) continue
    total++
    if (t.metadata['done'] === true) done++
  }
  return { total, done }
}
