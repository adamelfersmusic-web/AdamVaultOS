// THE SYSTEM's reading layer (desk/the-system §6) — spines + weekly cards.
//
// A SPINE is the project note at projects/<key>: the macro plan, written
// once, with fixed H2 sections — ## Purpose · ## Definition of done ·
// ## The phases (or ## The gates) · ## People · ## Dates. Exactly one
// phase line carries CURRENT; completed lines start with ✅; blocked lines
// may carry ⛔.
//
// A WEEKLY CARD lives at projects/<key>/weekly/YYYY-MM-DD — the mint of
// Monday's review: ## Priority (one paragraph) · ## Top 3 (a markdown task
// list) · ## Blockers / waiting on. The latest card is simply the
// lexicographically greatest date path (ISO dates sort as strings).
//
// Everything here is a pure function over note content — no fetching, no
// state. Law #2: the app is a lens; the notes hold the facts.

import type { Note } from '../lib/types'
import type { Project } from './projects'

const LIST_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/
const CHECKBOX_RE = /^\s*(?:[-*+]|\d+[.)])\s*\[( |x|X)\]\s*(.*)$/

/**
 * Lines belonging to the first H2/H3 whose heading matches one of `names`
 * (case-insensitive; prefix match, so "blockers" finds "Blockers / waiting
 * on"; pass `'contains'` when the heading may lead with decoration, so
 * "top 3" finds "⭐ TOP 3 THIS WEEK"). The section ends at the next heading
 * of any level.
 */
export function sectionLines(
  content: string,
  names: string[],
  match: 'prefix' | 'contains' = 'prefix',
): string[] {
  const wanted = names.map((n) => n.toLowerCase())
  const out: string[] = []
  let inside = false
  for (const line of content.split('\n')) {
    const h = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (h) {
      if (inside) break
      if (h[1]!.length >= 2 && h[1]!.length <= 3) {
        const head = h[2]!.trim().toLowerCase()
        inside = wanted.some(
          (w) => head === w || (match === 'contains' ? head.includes(w) : head.startsWith(w)),
        )
      }
      continue
    }
    if (inside) out.push(line)
  }
  return out
}

/** Graceful ~n-char truncation on a word boundary. */
export function truncate(s: string, n = 60): string {
  const t = s.trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n)
  const at = cut.lastIndexOf(' ')
  return `${(at > n * 0.5 ? cut.slice(0, at) : cut).trimEnd()}…`
}

// ---------------------------------------------------------------------------
// The spine's phase chain
// ---------------------------------------------------------------------------

export type PhaseState = 'done' | 'current' | 'blocked' | 'todo'
export interface PhaseStep {
  label: string
  state: PhaseState
}

/** Strip list scaffolding, status emoji, and CURRENT markers to the label. */
export function cleanPhaseLabel(text: string): string {
  return text
    .replace(/[✅⛔✔☑]️?/gu, '')
    .replace(/\*\*/g, '')
    .replace(/[（(]\s*CURRENT\s*[)）]/gi, ' ')
    .replace(/(?:[-—–:·|]|←|→|<-|->)?\s*\bCURRENT\b\s*(?:[-—–:·|]|←|→|<-|->)?/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-—–·:]+|[\s\-—–·:]+$/g, '')
    .trim()
}

/** Mission line — the first paragraph of ## Purpose, else null. */
export function missionOf(content: string | undefined): string | null {
  if (!content) return null
  const first = sectionLines(content, ['purpose'])
    .map((l) => l.trim())
    .find((l) => Boolean(l) && !LIST_RE.test(l))
  return first ?? null
}

/** The phase chain from ## The phases / ## The gates, in written order. */
export function parsePhases(content: string | undefined): PhaseStep[] {
  if (!content) return []
  const lines = sectionLines(content, ['the phases', 'phases', 'the gates', 'gates'])
  const steps: PhaseStep[] = []
  for (const line of lines) {
    const m = LIST_RE.exec(line)
    if (!m || !m[1]!.trim()) continue
    const raw = m[1]!.trim()
    const state: PhaseState = /\bCURRENT\b/i.test(raw)
      ? 'current'
      : raw.startsWith('✅')
        ? 'done'
        : raw.includes('⛔')
          ? 'blocked'
          : 'todo'
    const label = cleanPhaseLabel(raw)
    if (label) steps.push({ label, state })
  }
  return steps
}

/** The macro strip's right-aligned phase label: the spine's CURRENT line
 * (cleaned + truncated) → else metadata.phase. */
export function phaseLabelOf(project: Project): string | null {
  const current = parsePhases(project.note.content).find((s) => s.state === 'current')
  if (current) return truncate(current.label, 40)
  const phase = project.note.metadata['phase']
  return typeof phase === 'string' && phase.trim() ? phase.trim() : null
}

// ---------------------------------------------------------------------------
// Weekly cards
// ---------------------------------------------------------------------------

/** Card address shape: projects/<key>/weekly/YYYY-MM-DD */
export const WEEKLY_CARD_RE = /^projects\/.+\/weekly\/\d{4}-\d{2}-\d{2}$/

export interface Top3Item {
  text: string
  checked: boolean
}

export interface WeeklyCard {
  path: string
  /** The card's date key — the path basename, YYYY-MM-DD. */
  date: string
  priority: string | null
  top3: Top3Item[]
  blockers: string[]
}

export function parseWeeklyCard(note: Note): WeeklyCard {
  const content = note.content ?? ''
  const priority =
    sectionLines(content, ['priority'])
      .map((l) => l.trim())
      .find(Boolean) ?? null
  const top3: Top3Item[] = []
  for (const line of sectionLines(content, ['top 3', 'top3', 'top three'])) {
    const m = CHECKBOX_RE.exec(line)
    if (m && m[2]!.trim()) top3.push({ text: m[2]!.trim(), checked: m[1] !== ' ' })
  }
  const blockers = sectionLines(content, ['blockers'])
    .map((l) => {
      const m = LIST_RE.exec(l)
      return (m ? m[1]! : l).trim()
    })
    .filter(Boolean)
  return {
    path: note.path,
    date: note.path.split('/').pop() ?? '',
    priority,
    top3,
    blockers,
  }
}

/** Latest card under projects/<key>/weekly/ — greatest date path wins. */
export function latestCardNote(notes: Note[], key: string): Note | null {
  const prefix = `projects/${key}/weekly/`
  let best: Note | null = null
  for (const n of notes) {
    if (!n.path.startsWith(prefix) || !WEEKLY_CARD_RE.test(n.path)) continue
    if (!best || n.path > best.path) best = n
  }
  return best
}

// ---------------------------------------------------------------------------
// The weekly REVIEW (desk/weekly/YYYY-MM-DD) — Monday's mint for the WHOLE
// week, not one world. The Projects page whispers its ⭐ Top 3.
// ---------------------------------------------------------------------------

/** Review address shape: desk/weekly/YYYY-MM-DD (dated only — never the
 * template that lives beside them). */
export const WEEK_REVIEW_RE = /^desk\/weekly\/\d{4}-\d{2}-\d{2}$/

/** Inline markdown → plain text: bold markers and link syntax fall away. */
function stripInline(s: string): string {
  return s
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** The review's Top 3 — list items under the H2 containing "top 3" (fuzzy:
 * "## ⭐ TOP 3 THIS WEEK" matches), as plain text, capped at 3. The italic
 * intro and the *Bonus …* aside aren't list items, so they fall away. */
export function weekTop3Of(content: string | undefined): string[] {
  if (!content) return []
  const out: string[] = []
  for (const line of sectionLines(content, ['top 3', 'top3', 'top three'], 'contains')) {
    const m = LIST_RE.exec(line)
    if (!m) continue
    const text = stripInline(m[1]!.replace(/^\[( |x|X)\]\s*/, ''))
    if (text) out.push(text)
    if (out.length === 3) break
  }
  return out
}

/** The macro strip's "one thing": first UNCHECKED Top-3 item of the latest
 * card → the card's Priority line → metadata.milestone. Truncated ~60ch. */
export function oneThingOf(card: WeeklyCard | null, project: Project): string | null {
  const fromCard = card?.top3.find((t) => !t.checked)?.text ?? card?.priority ?? null
  if (fromCard) return truncate(fromCard, 60)
  const milestone = project.note.metadata['milestone']
  if (typeof milestone === 'string' && milestone.trim()) return truncate(milestone, 60)
  return null
}
