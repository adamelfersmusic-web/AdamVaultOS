// The Tracker database — the productivity layer. Every note tagged `task`
// (which the vault excludes from the knowledge graph) rendered as one dataset,
// scoped to the `tasks/` path. The first project living here is Amanda; the
// schema is deliberately project-agnostic (state / project / phase / track /
// owner) so future projects drop in under `tasks/<project>/…` with no changes.
//
// Metadata is the source of truth for every chip. Dragging a card between
// board lanes writes the `state` field back to the vault — nothing else is
// ever auto-written.

import type { ChipColor, DatabaseDef, FieldDef, Note } from '../lib/types'

// The daily-driver workflow axis: what's in flight, what's queued, what's
// stuck, what's done. Board lanes render in this order.
export const STATE_LANES = ['active', 'next', 'blocked', 'done'] as const

const STATE_COLORS: Record<string, ChipColor> = {
  active: 'gold',
  next: 'blue',
  blocked: 'red',
  done: 'green',
}

// The Amanda campaign spine. Phases 5a–5d are the parallel production tracks
// (photos / DTC videos / b-roll / reels + graphics). Kept as a flat enum so
// the board/pipeline order matches how the campaign actually runs.
export const PHASES = [
  '1', '2', '3', '4', '5a', '5b', '5c', '5d', '6', '7', '8', '9',
] as const

const PHASE_COLORS: Record<string, ChipColor> = {
  '1': 'blue', '2': 'blue', '3': 'blue', '4': 'blue', // prep
  '5a': 'gold', '5b': 'gold', '5c': 'gold', '5d': 'gold', // production
  '6': 'purple', // assembly
  '7': 'neutral', // approval
  '8': 'red', // live
  '9': 'green', // analytics
}

const TRACK_COLORS: Record<string, ChipColor> = {
  planable: 'blue',
  captions: 'purple',
  photos: 'gold',
  'DTC videos': 'red',
  'b-roll': 'green',
  reels: 'purple',
  graphics: 'gold',
  approval: 'blue',
  live: 'red',
  outreach: 'green',
  analytics: 'neutral',
}

const OWNER_COLORS: Record<string, ChipColor> = {
  Adam: 'gold',
  Cassy: 'blue',
  Amanda: 'purple',
  Patricia: 'green',
}

const colorFrom =
  (map: Record<string, ChipColor>) =>
  (value: unknown): ChipColor =>
    map[String(value ?? '')] ?? 'neutral'

export const FIELDS: FieldDef[] = [
  {
    key: 'state',
    label: 'State',
    kind: 'enum',
    indexed: false, // in-memory sort/filter only (not a vault-indexed field)
    rank: [...STATE_LANES],
    options: STATE_LANES.map((value) => ({
      value,
      color: STATE_COLORS[value] ?? 'neutral',
    })),
    openEnum: true,
    colorOf: colorFrom(STATE_COLORS),
  },
  {
    key: 'project',
    label: 'Project',
    kind: 'enum',
    indexed: true, // vault-indexed (from the #task schema)
    options: [{ value: 'amanda', color: 'purple' }],
    openEnum: true,
    colorOf: (v) => (String(v) === 'amanda' ? 'purple' : 'neutral'),
  },
  {
    key: 'phase',
    label: 'Phase',
    kind: 'enum',
    indexed: false,
    rank: [...PHASES],
    options: PHASES.map((value) => ({ value, color: PHASE_COLORS[value] ?? 'neutral' })),
    openEnum: true,
    colorOf: colorFrom(PHASE_COLORS),
  },
  {
    key: 'track',
    label: 'Track',
    kind: 'enum',
    indexed: false,
    options: Object.keys(TRACK_COLORS).map((value) => ({
      value,
      color: TRACK_COLORS[value]!,
    })),
    openEnum: true,
    colorOf: colorFrom(TRACK_COLORS),
  },
  {
    key: 'owner',
    label: 'Owner',
    kind: 'enum',
    indexed: false,
    options: Object.keys(OWNER_COLORS).map((value) => ({
      value,
      color: OWNER_COLORS[value]!,
    })),
    openEnum: true,
    colorOf: colorFrom(OWNER_COLORS),
  },
  {
    key: 'done',
    label: 'Done',
    kind: 'bool',
    indexed: true,
    options: [
      { value: 'false', label: '—', color: 'dim' },
      { value: 'true', label: 'done', color: 'green' },
    ],
  },
  {
    key: 'due',
    label: 'Due',
    kind: 'date', // 'YYYY-MM-DD' — the fine layer under the when-words
    indexed: false, // sorted/filtered in memory only (never server-side)
  },
  {
    key: 'url',
    label: 'URL',
    kind: 'text',
    indexed: false, // free-text link out to wherever the task lives
  },
]

export const TRACKER_DB: DatabaseDef = {
  key: 'tracker',
  title: 'Tracker',
  pathPrefix: 'tasks/',
  titleFromContent: true, // the task body IS the title
  fields: FIELDS,
  tableColumns: ['state', 'project', 'phase', 'track', 'owner', 'due', 'done'],
  board: {
    field: 'state',
    lanes: [...STATE_LANES],
    dimLanes: ['done'], // completed work recedes
  },
  gallery: { fields: ['state', 'phase', 'owner'] },
  progress: { field: 'phase', doneField: 'done' },
  newNote: {
    pathPrefix: 'tasks/amanda/',
    tags: ['task'],
    metadata: {
      project: 'amanda',
      state: 'next',
      done: false,
    },
  },
}

export function isTaskNote(note: Note): boolean {
  return note.path.startsWith(TRACKER_DB.pathPrefix) || (note.tags ?? []).includes('task')
}
