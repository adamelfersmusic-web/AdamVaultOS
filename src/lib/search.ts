// The app's ONE relevance ranking (#5a) — shared by the Library browser, the
// Pages sidebar, and the Omnibar so "good search" means the same thing
// everywhere.
//
// Each query term must appear SOMEWHERE (AND search), and hits are weighted
// by field: title/slug >> path/tags/summary >> body. Bonuses for the exact
// phrase, all-terms-in-title, and start-of-word matches so e.g. "canonical
// scoring engine" surfaces the note actually named that, not a note that
// merely mentions the words in its body. Recency breaks ties. Notes marked
// `status: superseded`/`parked` are dampened (not excluded) so a live note
// outranks its own retired predecessor.
//
// This module also carries the Omnibar's query grammar (parseQuery), snippet
// extraction (snippetFor), and the tiny edit-distance-1 typo net — all pure
// functions so they stay unit-testable through the e2e assertions.

import type { Note } from './types'

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const escapeRe = escapeRegExp

function ts(n: Note): number {
  const t = new Date(n.updatedAt ?? 0).getTime()
  return Number.isNaN(t) ? 0 : t
}

export function rankNotes(
  rawQuery: string,
  notes: Note[],
  titleOf: (n: Note) => string,
): Note[] {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return []
  const terms = q.split(/\s+/).filter(Boolean)
  const scored: { n: Note; score: number }[] = []
  for (const n of notes) {
    const title = titleOf(n).toLowerCase()
    const slug = (n.path ?? '').split('/').pop()?.toLowerCase() ?? ''
    const path = (n.path ?? '').toLowerCase()
    const tags = (n.tags ?? []).join(' ').toLowerCase()
    const body = (n.content ?? '').toLowerCase()
    const summaryRaw = n.metadata?.['summary']
    const summary = typeof summaryRaw === 'string' ? summaryRaw.toLowerCase() : ''

    let score = 0
    let allTerms = true
    for (const term of terms) {
      let t = 0
      if (title.includes(term)) t += 12
      if (slug.includes(term)) t += 8
      if (path.includes(term)) t += 6
      if (tags.includes(term)) t += 6
      if (summary.includes(term)) t += 6
      if (body.includes(term)) t += 2
      if (new RegExp(`(^|[\\s/_-])${escapeRe(term)}`).test(title)) t += 4
      if (t === 0) allTerms = false
      score += t
    }
    if (!allTerms) continue // every term must land somewhere

    // Whole-phrase + all-in-title bonuses: exact ≫ prefix ≫ substring.
    if (title === q) score += 40
    else if (title.startsWith(q)) score += 28
    else if (title.includes(q)) score += 20
    if (slug.includes(q)) score += 12
    else if (path.includes(q)) score += 8
    if (terms.length > 1 && terms.every((tm) => title.includes(tm))) score += 15

    // Superseded/parked notes stay findable but rank below a live equivalent.
    const statusRaw = n.metadata?.['status']
    const status = typeof statusRaw === 'string' ? statusRaw : ''
    if (status === 'superseded' || status === 'parked') score *= 0.4

    scored.push({ n, score })
  }
  scored.sort((a, b) => b.score - a.score || ts(b.n) - ts(a.n))
  return scored.map((s) => s.n)
}

// ---------------------------------------------------------------------------
// The Omnibar's query grammar — operators parsed BEFORE ranking, composable
// with free text. Unknown operators (and invalid values) are treated as
// literal text, so `re:something` still searches for the words.
// ---------------------------------------------------------------------------

export interface ParsedQuery {
  /** Free-text terms (lowercased) — these rank via rankNotes. */
  terms: string[]
  /** `"exact phrase"` constraints — must appear verbatim in title or body. */
  phrases: string[]
  /** `tag:x` constraints — hierarchical (x matches x and x/*). */
  tags: string[]
  /** `path:prefix/` constraints. */
  paths: string[]
  /** `title:x` constraints — must appear in the display title (only). */
  titles: string[]
  /** `is:task|note|project|page` — scopes which groups render. */
  is: 'task' | 'note' | 'project' | 'page' | null
  /** `when:today|this-week|later` — task scheduling constraint. */
  when: 'today' | 'this-week' | 'later' | null
  /** `done:true|false` — task completion constraint. */
  done: boolean | null
}

const IS_VALUES = new Set(['task', 'note', 'project', 'page'])
const WHEN_VALUES = new Set(['today', 'this-week', 'later'])

export function parseQuery(raw: string): ParsedQuery {
  const out: ParsedQuery = {
    terms: [],
    phrases: [],
    tags: [],
    paths: [],
    titles: [],
    is: null,
    when: null,
    done: null,
  }
  // Quoted phrases first, so their words never leak into the term list.
  const rest = raw.replace(/"([^"]*)"/g, (_m, phrase: string) => {
    const p = phrase.trim().toLowerCase()
    if (p) out.phrases.push(p)
    return ' '
  })
  for (const token of rest.split(/\s+/).filter(Boolean)) {
    const m = /^([A-Za-z-]+):(.*)$/.exec(token)
    if (m) {
      const key = m[1]!.toLowerCase()
      const v = m[2]!.toLowerCase()
      if (key === 'tag' && v) {
        out.tags.push(v.replace(/^#/, ''))
        continue
      }
      if (key === 'path' && v) {
        out.paths.push(v)
        continue
      }
      if (key === 'title' && v) {
        out.titles.push(v)
        continue
      }
      if (key === 'is' && IS_VALUES.has(v)) {
        out.is = v as ParsedQuery['is']
        continue
      }
      if (key === 'when' && WHEN_VALUES.has(v)) {
        out.when = v as ParsedQuery['when']
        continue
      }
      if (key === 'done' && (v === 'true' || v === 'false')) {
        out.done = v === 'true'
        continue
      }
      // Unknown operator / invalid value — falls through as literal text.
    }
    out.terms.push(token.toLowerCase())
  }
  return out
}

/** Any constraint operator present (tag/path/is/when/done or a phrase)? */
export function hasConstraints(q: ParsedQuery): boolean {
  return (
    q.tags.length > 0 ||
    q.paths.length > 0 ||
    q.titles.length > 0 ||
    q.phrases.length > 0 ||
    q.is !== null ||
    q.when !== null ||
    q.done !== null
  )
}

/** Any free text left to rank with? */
export function hasFreeText(q: ParsedQuery): boolean {
  return q.terms.length > 0 || q.phrases.length > 0
}

/** The vault's hierarchical-tag semantic: `x` covers `x` and `x/*`. */
export function noteHasTagDeep(n: Note, tag: string): boolean {
  return (n.tags ?? []).some((t) => t === tag || t.startsWith(`${tag}/`))
}

/**
 * Constraint filters applied BEFORE ranking: every tag: (hierarchical), every
 * path: prefix, every title: substring (display title ONLY — the same field
 * the ranking scores as title), and every quoted phrase (verbatim in title
 * or body) must hold. is:/when:/done: are group-level scopes and live with
 * the caller.
 */
export function noteMatchesFilters(
  n: Note,
  q: ParsedQuery,
  titleOf: (n: Note) => string,
): boolean {
  for (const tag of q.tags) if (!noteHasTagDeep(n, tag)) return false
  if (q.paths.length > 0) {
    const p = (n.path ?? '').toLowerCase()
    if (!q.paths.every((prefix) => p.startsWith(prefix))) return false
  }
  if (q.titles.length > 0) {
    const t = titleOf(n).toLowerCase()
    if (!q.titles.every((s) => t.includes(s))) return false
  }
  if (q.phrases.length > 0) {
    const title = titleOf(n).toLowerCase()
    const body = (n.content ?? '').toLowerCase()
    if (!q.phrases.every((ph) => title.includes(ph) || body.includes(ph))) {
      return false
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// Snippets — the best-matching line of a note's body, windowed to ~90 chars
// around the first hit. Plain text out; the caller builds <mark> spans from
// it (never innerHTML of note content).
// ---------------------------------------------------------------------------

/** One content line stripped of light markdown clutter for display. */
function displayLine(raw: string): string {
  return raw
    .replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, p: string, alias?: string) => alias ?? p)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[\s>*+-]+/, '')
    .replace(/[*_`]/g, '')
    .trim()
}

/**
 * The first line containing the MOST query terms, windowed to ~`span` chars
 * around the first hit. Heading lines are skipped (the row already shows the
 * title); null when no body line matches — a title-only row shows no snippet.
 */
export function snippetFor(
  content: string | undefined,
  terms: string[],
  span = 90,
): string | null {
  const wanted = terms.map((t) => t.toLowerCase()).filter(Boolean)
  if (!content || wanted.length === 0) return null
  let best: { line: string; hits: number; firstIdx: number } | null = null
  for (const raw of content.split(/\r?\n/)) {
    if (/^\s{0,3}#{1,6}\s/.test(raw)) continue // headings = titles, not snippets
    const line = displayLine(raw)
    if (!line) continue
    const lower = line.toLowerCase()
    let hits = 0
    let firstIdx = -1
    for (const t of wanted) {
      const i = lower.indexOf(t)
      if (i < 0) continue
      hits++
      if (firstIdx < 0 || i < firstIdx) firstIdx = i
    }
    if (hits === 0) continue
    if (!best || hits > best.hits) best = { line, hits, firstIdx }
    if (best.hits === wanted.length) break // first all-terms line wins
  }
  if (!best) return null
  const start = best.firstIdx <= 30 ? 0 : best.firstIdx - 30
  let text = best.line.slice(start, start + span).trim()
  if (start > 0) text = `…${text}`
  if (start + span < best.line.length) text = `${text}…`
  return text
}

// ---------------------------------------------------------------------------
// Typo net (edit distance ≤ 1) — when a term ≥4 chars hits NOTHING anywhere,
// the Omnibar retries it against title/path vocabulary. Tiny and bounded — no
// dependency, no full Levenshtein matrix.
// ---------------------------------------------------------------------------

/** True when a and b are within one edit (insert/delete/substitute). */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) return false
  if (la === lb) {
    let diff = 0
    for (let i = 0; i < la; i++) {
      if (a[i] !== b[i] && ++diff > 1) return false
    }
    return true
  }
  const [s, l] = la < lb ? [a, b] : [b, a]
  let i = 0
  let j = 0
  let skipped = false
  while (i < s.length && j < l.length) {
    if (s[i] === l[j]) {
      i++
      j++
    } else {
      if (skipped) return false
      skipped = true
      j++ // skip one char of the longer string
    }
  }
  return true
}

/**
 * The most frequent title/path word within one edit of `term`, or null.
 * Only fires for terms ≥4 chars — short words correct into noise.
 */
export function correctTerm(
  term: string,
  notes: Note[],
  titleOf: (n: Note) => string,
): string | null {
  const t = term.toLowerCase()
  if (t.length < 4) return null
  const freq = new Map<string, number>()
  for (const n of notes) {
    const words = `${titleOf(n)} ${n.path ?? ''}`.toLowerCase().split(/[^a-z0-9]+/)
    for (const w of words) {
      if (!w || w === t) continue
      if (Math.abs(w.length - t.length) > 1) continue
      if (!withinOneEdit(t, w)) continue
      freq.set(w, (freq.get(w) ?? 0) + 1)
    }
  }
  let best: string | null = null
  let bestCount = 0
  for (const [w, c] of freq) {
    if (c > bestCount || (c === bestCount && best !== null && w < best)) {
      best = w
      bestCount = c
    }
  }
  return best
}
