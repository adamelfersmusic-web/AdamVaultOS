// The app's ONE relevance ranking (#5a) — shared by the Library browser and
// the Pages sidebar so "good search" means the same thing everywhere.
//
// Each query term must appear SOMEWHERE (AND search), and hits are weighted
// by field: title/slug >> path/tags >> body. Bonuses for the exact phrase,
// all-terms-in-title, and start-of-word matches so e.g. "canonical scoring
// engine" surfaces the note actually named that, not a note that merely
// mentions the words in its body. Recency breaks ties.

import type { Note } from './types'

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

    let score = 0
    let allTerms = true
    for (const term of terms) {
      let t = 0
      if (title.includes(term)) t += 12
      if (slug.includes(term)) t += 8
      if (path.includes(term)) t += 6
      if (tags.includes(term)) t += 6
      if (body.includes(term)) t += 2
      if (new RegExp(`(^|[\\s/_-])${escapeRe(term)}`).test(title)) t += 4
      if (t === 0) allTerms = false
      score += t
    }
    if (!allTerms) continue // every term must land somewhere

    // Whole-phrase + all-in-title bonuses.
    if (title === q) score += 40
    else if (title.includes(q)) score += 20
    if (slug.includes(q)) score += 12
    else if (path.includes(q)) score += 8
    if (terms.length > 1 && terms.every((tm) => title.includes(tm))) score += 15

    scored.push({ n, score })
  }
  scored.sort((a, b) => b.score - a.score || ts(b.n) - ts(a.n))
  return scored.map((s) => s.n)
}
