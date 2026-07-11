// The note-type axis for search-as-cards + backlink cards. ONE clean "what
// kind of thing is this" label per note, used only for a small colored dot in
// the UI — never written to a note here. It PREFERS an explicit `type`
// metadata field (Decision 1: once notes start carrying `type`, that wins),
// then falls back to inference from tags / doc_type / path. So it works today
// on 743 un-typed notes and gets sharper as types get stamped — zero backfill
// required, degrades gracefully (unknown → the neutral "note").

import type { ChipColor, Note } from '../lib/types'

export type NoteType =
  | 'person'
  | 'meeting'
  | 'project'
  | 'task'
  | 'source'
  | 'capture'
  | 'note'

export const TYPE_META: Record<NoteType, { label: string; color: ChipColor }> = {
  person: { label: 'person', color: 'gold' },
  meeting: { label: 'meeting', color: 'purple' },
  project: { label: 'project', color: 'green' },
  task: { label: 'task', color: 'blue' },
  source: { label: 'source', color: 'red' },
  capture: { label: 'capture', color: 'dim' },
  note: { label: 'note', color: 'neutral' },
}

const KNOWN: ReadonlySet<string> = new Set<NoteType>([
  'person', 'meeting', 'project', 'task', 'source', 'capture', 'note',
])

// doc_type is already on many vault notes — treat these as source/reference
// material rather than free-standing concepts.
const SOURCE_DOC_TYPES = new Set([
  'sop', 'reference', 'process', 'assets', 'transcript', 'ops', 'log',
])

export function inferNoteType(note: Note): NoteType {
  // 1. Explicit `type` metadata wins (Decision 1 forward path).
  const explicit = String(note.metadata?.['type'] ?? '').toLowerCase()
  if (KNOWN.has(explicit)) return explicit as NoteType

  const tags = note.tags ?? []
  const has = (t: string) => tags.includes(t)
  const path = (note.path ?? '').toLowerCase()

  if (has('task') || path.startsWith('tasks/')) return 'task'
  if (has('capture') || tags.some((t) => t.startsWith('capture/')) || path.startsWith('capture/')) {
    return 'capture'
  }
  if (has('meeting') || path.includes('/meetings/') || path.includes('meetings/')) return 'meeting'
  if (has('people') || tags.some((t) => t.startsWith('people/')) || has('team') || path.includes('/team/')) {
    return 'person'
  }
  if (has('client') || has('project') || /(^|\/)00-home$/.test(path)) return 'project'

  const docType = String(note.metadata?.['doc_type'] ?? '').toLowerCase()
  if (SOURCE_DOC_TYPES.has(docType) || has('sop') || has('reference') || has('transcript')) {
    return 'source'
  }
  return 'note'
}

/** The one-line summary for a card: the note's own `summary` metadata when it
 * has one (the vault has these on most real notes), else null (caller derives
 * a preview from the body). */
export function summaryOf(note: Note): string | null {
  const s = note.metadata?.['summary']
  return typeof s === 'string' && s.trim() ? s.trim() : null
}
