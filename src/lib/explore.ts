// Explore — pure data shaping for the Knowledge Explorer's three modes
// (Atlas · Orbit · Threads). Everything is computed client-side from the ONE
// graphNotes() fetch the Graph view already relies on (lean notes + hydrated
// links + link degree): no new API endpoints, and Explore never writes.

import type { Note } from './types'
import { cleanPreview, titleFromPath } from './format'
import { inferNoteType } from '../domain/noteType'

// ---------------------------------------------------------------------------
// Domains — Adam thinks in worlds. A note's domain is the first path segment;
// anything outside the named worlds gathers under "elsewhere" at the end.
// ---------------------------------------------------------------------------

export const DOMAINS = [
  'escensus',
  'atelier',
  'ai',
  'people',
  'personal',
  'health',
  'music',
] as const

export const ELSEWHERE = 'elsewhere'

export type Domain = (typeof DOMAINS)[number] | typeof ELSEWHERE

export function domainOf(path: string): Domain {
  const seg = (path.split('/')[0] ?? '').toLowerCase()
  return (DOMAINS as readonly string[]).includes(seg) ? (seg as Domain) : ELSEWHERE
}

/** Per-domain accent, existing tokens only (Threads' left-border colors). */
export const DOMAIN_COLOR: Record<Domain, string> = {
  escensus: 'var(--gold)',
  atelier: 'var(--purple)',
  ai: 'var(--blue)',
  people: 'var(--green)',
  personal: 'var(--neutral)',
  health: 'var(--red)',
  music: 'var(--gold-bright)',
  elsewhere: 'var(--ink-4)',
}

// ---------------------------------------------------------------------------
// Atlas — domain-sectioned topic grid. A topic = an in-use tag on notes in
// that domain. Capped per domain so the grid stays calm.
// ---------------------------------------------------------------------------

export interface Topic {
  tag: string
  count: number
}

export interface DomainSection {
  domain: Domain
  topics: Topic[]
}

export const TOPICS_PER_DOMAIN = 12

export function buildAtlas(notes: Note[]): DomainSection[] {
  const perDomain = new Map<Domain, Map<string, number>>()
  for (const n of notes) {
    const d = domainOf(n.path)
    let m = perDomain.get(d)
    if (!m) {
      m = new Map()
      perDomain.set(d, m)
    }
    for (const t of n.tags ?? []) m.set(t, (m.get(t) ?? 0) + 1)
  }
  const sections: DomainSection[] = []
  for (const d of [...DOMAINS, ELSEWHERE] as Domain[]) {
    const m = perDomain.get(d)
    if (!m || m.size === 0) continue
    const topics = [...m.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, TOPICS_PER_DOMAIN)
    sections.push({ domain: d, topics })
  }
  return sections
}

// ---------------------------------------------------------------------------
// Topic page — notes carrying a tag, grouped by KIND, plus co-occurring tags.
// ---------------------------------------------------------------------------

/** Hierarchical tag semantics, same as the Library rail: a note carries `tag`
 * if it has the tag itself or any descendant (ai ⊇ ai/agents). */
export function hasTagDeep(n: Note, tag: string): boolean {
  return (n.tags ?? []).some((t) => t === tag || t.startsWith(`${tag}/`))
}

export type TopicKind = 'concepts' | 'people' | 'sources' | 'records'

export const TOPIC_KINDS: { kind: TopicKind; label: string }[] = [
  { kind: 'concepts', label: 'Concepts & frameworks' },
  { kind: 'people', label: 'People' },
  { kind: 'sources', label: 'Sources' },
  { kind: 'records', label: 'Records' },
]

export function topicKindOf(n: Note): TopicKind {
  const tags = n.tags ?? []
  const path = (n.path ?? '').toLowerCase()
  const inferred = inferNoteType(n)
  if (
    inferred === 'person' ||
    tags.includes('person') ||
    path.startsWith('people/')
  ) {
    return 'people'
  }
  if (String(n.metadata?.['voice'] ?? '').toLowerCase() === 'source') return 'sources'
  if (inferred === 'source') return 'sources'
  if (inferred === 'task' || inferred === 'meeting' || inferred === 'capture') {
    return 'records'
  }
  if (path.startsWith('logs/') || tags.includes('log')) return 'records'
  return 'concepts'
}

export function groupByKind(notes: Note[]): Record<TopicKind, Note[]> {
  const groups: Record<TopicKind, Note[]> = {
    concepts: [],
    people: [],
    sources: [],
    records: [],
  }
  for (const n of notes) groups[topicKindOf(n)].push(n)
  const byWeight = (a: Note, b: Note) =>
    (b.linkCount ?? 0) - (a.linkCount ?? 0) ||
    titleFromPath(a.path).localeCompare(titleFromPath(b.path))
  for (const k of Object.keys(groups) as TopicKind[]) groups[k].sort(byWeight)
  return groups
}

/** Type-dot color for Explore cards: sources glow gold, people purple,
 * everything else the green/turquoise concept tier. Maps straight onto the
 * existing .type-dot-* token classes — no new palette. */
export function dotColorOf(n: Note): 'gold' | 'purple' | 'green' {
  if (String(n.metadata?.['voice'] ?? '').toLowerCase() === 'source') return 'gold'
  if (topicKindOf(n) === 'people') return 'purple'
  return 'green'
}

/** Tags that co-occur most with `tag` across its notes — the RELATED rail. */
export function relatedTags(notes: Note[], tag: string, cap = 10): Topic[] {
  const counts = new Map<string, number>()
  for (const n of notes) {
    if (!hasTagDeep(n, tag)) continue
    for (const t of n.tags ?? []) {
      if (t === tag || t.startsWith(`${tag}/`)) continue
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([t, count]) => ({ tag: t, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, cap)
}

/** One-line takeaway: the note's own summary (audit-backfilled on most real
 * notes), else the first non-heading content line, else the lean preview
 * stripped of its heading clutter. */
export function takeawayOf(n: Note): string {
  const s = n.metadata?.['summary']
  if (typeof s === 'string' && s.trim()) return s.trim()
  if (typeof n.content === 'string') {
    for (const line of n.content.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || /^[-*_]{3,}$/.test(t)) continue
      return t.replace(/[*_`>]/g, '').replace(/\s+/g, ' ').trim()
    }
  }
  return cleanPreview(n.preview, titleFromPath(n.path))
}

// ---------------------------------------------------------------------------
// Orbit — one note as the center; rings of what it CITES (outgoing), what
// CITES IT (incoming), and SIBLINGS sharing 2+ tags (not already ringed).
// ---------------------------------------------------------------------------

export interface Orbit {
  center: Note
  cites: Note[]
  citedBy: Note[]
  siblings: Note[]
}

export const SIBLING_CAP = 12

export function orbitFor(notes: Note[], centerPath: string): Orbit | null {
  const center = notes.find((n) => n.path === centerPath)
  if (!center) return null
  const byId = new Map(notes.map((n) => [n.id, n]))
  const cites: Note[] = []
  const citedBy: Note[] = []
  const seenOut = new Set<string>()
  const seenIn = new Set<string>()
  for (const l of center.links ?? []) {
    if (l.sourceId === center.id && l.targetId !== center.id) {
      const t = byId.get(l.targetId)
      if (t && !seenOut.has(t.path)) {
        seenOut.add(t.path)
        cites.push(t)
      }
    } else if (l.targetId === center.id && l.sourceId !== center.id) {
      const s = byId.get(l.sourceId)
      if (s && !seenIn.has(s.path)) {
        seenIn.add(s.path)
        citedBy.push(s)
      }
    }
  }
  const ringed = new Set([center.path, ...seenOut, ...seenIn])
  const centerTags = new Set(center.tags ?? [])
  const siblings = notes
    .filter((n) => !ringed.has(n.path))
    .map((n) => ({
      n,
      shared: (n.tags ?? []).filter((t) => centerTags.has(t)).length,
    }))
    .filter((x) => x.shared >= 2)
    .sort(
      (a, b) =>
        b.shared - a.shared || (b.n.linkCount ?? 0) - (a.n.linkCount ?? 0),
    )
    .slice(0, SIBLING_CAP)
    .map((x) => x.n)
  const byDegree = (a: Note, b: Note) => (b.linkCount ?? 0) - (a.linkCount ?? 0)
  cites.sort(byDegree)
  citedBy.sort(byDegree)
  return { center, cites, citedBy, siblings }
}

/** Default orbit seed: the vault's most-linked note (its biggest hub). */
export function mostLinked(notes: Note[]): Note | null {
  let best: Note | null = null
  for (const n of notes) {
    if (!best || (n.linkCount ?? 0) > (best.linkCount ?? 0)) best = n
  }
  return best
}

// ---------------------------------------------------------------------------
// Threads — time × mind. Notes grouped by LOCAL day of creation, newest day
// first, capped to the last N days that actually have notes.
// ---------------------------------------------------------------------------

export interface ThreadDay {
  /** Local date key, yyyy-mm-dd. */
  key: string
  label: string
  notes: Note[]
}

export const THREAD_DAY_CAP = 60

function dayKeyOf(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function dayLabelOf(key: string): string {
  const d = new Date(`${key}T12:00:00`)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function buildThreads(notes: Note[], cap = THREAD_DAY_CAP): ThreadDay[] {
  const byDay = new Map<string, Note[]>()
  for (const n of notes) {
    const key = dayKeyOf(n.createdAt ?? '')
    if (!key) continue
    const list = byDay.get(key)
    if (list) list.push(n)
    else byDay.set(key, [n])
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest day first
    .slice(0, cap)
    .map(([key, list]) => ({
      key,
      label: dayLabelOf(key),
      // Within a day the strip reads left → right chronologically.
      notes: [...list].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    }))
}
