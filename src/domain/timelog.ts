// THE TIME TAB (#/time) — the daily time log's grammar ("ADHD is brutal and
// my life is a blur"). One HYPER-STRUCTURED note per America/New_York day at
// desk/timelog/YYYY-MM-DD, tags desk + timelog. The vault's `timelog` tag
// carries a STRICT schema — date · total_minutes · entry_count are REQUIRED
// on every write (the vault hard-rejects anything less), so the store always
// sends content + the recomputed trio in ONE patch.
//
// Content contract — a title line, then ONE LINE PER ENTRY, nothing else:
//
//   # Time — Sunday, July 19
//
//   - 09:12 · 25m · amanda · Caption pass on the reel
//   - 11:40 · 67m · — · Amanda Photo Script · ⚡
//
// THE LINE CONTRACT (pinned — future ingesters parse by this exact shape):
//   `- HH:MM · <minutes>m · <project|—> · <what>` with an optional trailing
//   ` · ⚡` on auto-fed rows (One Task resolutions). HH:MM is the entry's
//   CREATION time, 24h, America/New_York. `—` (em dash) when no project.
//   `what` is a single line. NO checkboxes, no freeform — parseTimelog
//   IGNORES any other line, and the app never writes one. The ` · ` (space,
//   middle dot, space) is the field delimiter, so cleanField strips it from
//   human input before a line is ever minted.
//
// Everything here is a pure function over note content — no fetching, no
// state. Law #2: the app is a lens; the notes hold the facts. The vault
// writes live in lib/store.ts.

export const TIMELOG_PREFIX = 'desk/timelog/'
export const TIMELOG_TAGS = ['desk', 'timelog']
/** Adam's clock — the day boundary and every HH:MM stamp live here. */
export const TIMELOG_TZ = 'America/New_York'

/** The pinned entry-line contract (see the module header). Groups:
 * 1 hour · 2 minute · 3 minutes-spent · 4 project (— = none) · 5 what ·
 * 6 the ` · ⚡` auto marker (present on auto-fed rows). */
export const ENTRY_RE = /^- ([01]\d|2[0-3]):([0-5]\d) · (\d+)m · (.+?) · (.+?)( · ⚡)?$/

export interface TimelogEntry {
  /** The exact source line, byte-for-byte — the delete's surgical key. */
  raw: string
  lineIndex: number
  /** HH:MM, 24h, America/New_York — the entry's creation time. */
  time: string
  minutes: number
  /** null when the line carries the `—` no-project dash. */
  project: string | null
  what: string
  /** True on auto-fed rows (the ` · ⚡` marker — One Task resolutions). */
  auto: boolean
}

/** Read a day's entries — every contract line, in note order. Anything
 * else (the title, blanks, stray prose) is ignored, never surfaced. */
export function parseTimelog(content: string | undefined | null): TimelogEntry[] {
  if (!content) return []
  const out: TimelogEntry[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = ENTRY_RE.exec(lines[i]!)
    if (!m) continue
    const project = m[4]!.trim()
    out.push({
      raw: lines[i]!,
      lineIndex: i,
      time: `${m[1]}:${m[2]}`,
      minutes: Number(m[3]),
      project: project === '—' ? null : project,
      what: m[5]!.trim(),
      auto: Boolean(m[6]),
    })
  }
  return out
}

/** The strict-schema trio's numbers, recomputed from the lines themselves —
 * the note content is the truth, the metadata mirrors it. */
export function totalsOf(entries: TimelogEntry[]): {
  totalMinutes: number
  entryCount: number
} {
  return {
    totalMinutes: entries.reduce((sum, e) => sum + e.minutes, 0),
    entryCount: entries.length,
  }
}

/** Human input → field-safe text: newlines collapse to spaces and the
 * ` · ` delimiter can never be smuggled in (middle dots become hyphens). */
export function cleanField(s: string): string {
  return s
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s*·\s*/g, ' - ')
    .trim()
}

/** Mint one contract line. Fields arrive pre-cleaned by the form/store. */
export function formatEntryLine(input: {
  time: string
  minutes: number
  project: string | null
  what: string
  auto?: boolean
}): string {
  const project = input.project && input.project.trim() ? input.project.trim() : '—'
  return `- ${input.time} · ${input.minutes}m · ${project} · ${input.what}${input.auto ? ' · ⚡' : ''}`
}

// ————————————————————————— Adam's clock —————————————————————————

const DAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMELOG_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const CLOCK_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMELOG_TZ,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
})
const LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMELOG_TZ,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

/** Today's day key (YYYY-MM-DD) on Adam's clock. */
export function timelogDayKey(d: Date = new Date()): string {
  return DAY_FMT.format(d)
}

/** The HH:MM stamp for a new entry, 24h, on Adam's clock. */
export function timelogClock(d: Date = new Date()): string {
  return CLOCK_FMT.format(d)
}

/** 'Sunday, July 19' for a day key — anchored at noon UTC so the calendar
 * day can never shift across the timezone. */
export function timelogDayLabel(dateKey: string): string {
  return LABEL_FMT.format(new Date(`${dateKey}T12:00:00Z`))
}

/** The day note's title line. */
export function timelogTitle(dateKey: string): string {
  return `# Time — ${timelogDayLabel(dateKey)}`
}

/** A freshly minted day note — the title over its first entry line. */
export function timelogContent(dateKey: string, firstLine: string): string {
  return `${timelogTitle(dateKey)}\n\n${firstLine}\n`
}

/** dateKey ± days — pure calendar math on the key, timezone-free. */
export function stepDay(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d! + delta)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${String(dt.getDate()).padStart(2, '0')}`
}

// ————————————————————————— line mutations —————————————————————————

/** Append an entry line after the LAST entry — or, on an entry-less note,
 * after the content with one blank line of breathing room. */
export function appendTimelogLine(lines: string[], line: string): string[] {
  const next = [...lines]
  let last = -1
  for (let i = 0; i < next.length; i++) {
    if (ENTRY_RE.test(next[i]!)) last = i
  }
  if (last !== -1) {
    next.splice(last + 1, 0, line)
    return next
  }
  let end = next.length
  while (end > 0 && next[end - 1]!.trim() === '') end--
  next.splice(end, 0, '', line)
  return next
}

/** Remove exactly entry's line: trust lineIndex while the bytes still
 * match; else a UNIQUE byte-identical line; zero or many → throw (the
 * caller's conflict-toast path — never guess which row was meant). */
export function removeTimelogLine(lines: string[], entry: TimelogEntry): string[] {
  let idx = -1
  if (lines[entry.lineIndex] === entry.raw) {
    idx = entry.lineIndex
  } else {
    const hits: number[] = []
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === entry.raw) hits.push(i)
    }
    if (hits.length === 1) idx = hits[0]!
    else {
      throw new Error(
        hits.length === 0
          ? 'that row changed in the vault — refresh and try again'
          : 'that row appears more than once — edit the note directly',
      )
    }
  }
  const next = [...lines]
  next.splice(idx, 1)
  return next
}
