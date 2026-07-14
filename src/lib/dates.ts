// Craft Phase A — real due dates. The `due` metadata key ('YYYY-MM-DD') is
// the FINE scheduling layer under the coarse when-words (today/this-week/
// later); a task may carry both, and due is always optional — never written
// as null or ''. This module is the whole date story: a tiny natural-language
// parser for the minting inputs, and a formatter + tone for the chips.
// Pure, total functions — no locale surprises, no Date mutation leaks.

const DAY_MS = 86_400_000

const WEEKDAYS = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
] as const
const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
] as const

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** Local calendar key, the same shape the daily note uses: 'YYYY-MM-DD'. */
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}

/** True when (y, m 1-12, d) names a real calendar day (no Feb 31 rollover). */
function isRealDay(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const probe = new Date(y, m - 1, d)
  return probe.getMonth() === m - 1 && probe.getDate() === d
}

/** 'YYYY-MM-DD' → local-midnight Date, or null when malformed/impossible. */
function fromYmd(due: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return isRealDay(y, mo, d) ? new Date(y, mo - 1, d) : null
}

/** Month + day → this year, rolled to next year when the day already passed. */
function monthDay(mo: number, d: number, now: Date): string | null {
  if (!isRealDay(now.getFullYear(), mo, d)) return null
  let y = now.getFullYear()
  const todayKey = ymd(now)
  if (ymd(new Date(y, mo - 1, d)) < todayKey) y += 1
  return isRealDay(y, mo, d) ? ymd(new Date(y, mo - 1, d)) : null
}

/**
 * Parse a human due entry → 'YYYY-MM-DD', or null when it isn't one.
 * Accepts: 'today' · 'tomorrow' · weekday names full + 3-letter ('friday',
 * 'fri' → the NEXT occurrence, never today) · 'jul 22' / 'july 22' · '7/22'
 * (month/day, this year, rolled forward when already past) · 'YYYY-MM-DD'
 * passthrough. Case-insensitive, trimmed. Anything else → null.
 */
export function parseDue(input: string, now: Date = new Date()): string | null {
  const s = input.trim().toLowerCase()
  if (!s) return null

  if (s === 'today') return ymd(now)
  if (s === 'tomorrow') return ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))

  // Weekday, full or 3-letter → next occurrence (never today: || 7).
  const wd = WEEKDAYS.findIndex((w) => s === w || s === w.slice(0, 3))
  if (wd !== -1) {
    const delta = (wd - now.getDay() + 7) % 7 || 7
    return ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta))
  }

  // ISO passthrough — still has to name a real day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fromYmd(s) ? s : null

  // 'jul 22' / 'july 22'
  const named = /^([a-z]+)\s+(\d{1,2})$/.exec(s)
  if (named) {
    const mo = MONTHS.findIndex((m) => named[1] === m || named[1] === m.slice(0, 3))
    if (mo !== -1) return monthDay(mo + 1, Number(named[2]), now)
    return null
  }

  // '7/22' — month/day.
  const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(s)
  if (slash) return monthDay(Number(slash[1]), Number(slash[2]), now)

  return null
}

/**
 * Human label for a stored due: 'Today' · 'Tomorrow' · 'Mon Jul 20' (this
 * year) · 'Jan 5 ’27' (any other year). A malformed due echoes back verbatim
 * — the formatter never throws, never hides data.
 */
export function formatDue(due: string, now: Date = new Date()): string {
  const d = fromYmd(due)
  if (!d) return due
  if (due === ymd(now)) return 'Today'
  if (due === ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))) return 'Tomorrow'
  if (d.getFullYear() === now.getFullYear()) {
    return `${WEEKDAY_SHORT[d.getDay()]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
  }
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()} ’${String(d.getFullYear() % 100).padStart(2, '0')}`
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later'

/** Styling tone: overdue (calm red — never a nag) · today · soon (≤7 days) ·
 * later. A malformed due reads as 'later' — quiet, not alarming. */
export function dueTone(due: string, now: Date = new Date()): DueTone {
  const d = fromYmd(due)
  if (!d) return 'later'
  const days = Math.round(
    (d.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / DAY_MS,
  )
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 7) return 'soon'
  return 'later'
}
