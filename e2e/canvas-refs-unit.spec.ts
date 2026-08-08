// Ref resolution — pure, no browser.
//
// THE contract: the pointer is an ID. Everything here exists to prove that a
// ref survives the target being MOVED, and says something honest when it is
// deleted or when the index simply hasn't arrived yet. Confusing those last
// two is the failure that matters — "your note is gone" is a lie the user has
// no way to check.

import { test, expect } from '@playwright/test'
import {
  indexById,
  refOf,
  resolveRef,
  titleForPath,
  type RefLookup,
} from '../src/lib/canvasRefs'

const NOTES: RefLookup[] = [
  {
    id: 'n1',
    path: '_priority/escensus/rubric-v2',
    preview: 'The scoring rubric, second pass.',
  },
  {
    id: 'n2',
    path: 'health/labs/panel-june',
    preview: 'raw numbers',
    metadata: { summary: 'June panel — everything in range.' },
  },
]
const INDEX = indexById(NOTES)

test('refOf reads a ref, and refuses one with no id', () => {
  expect(refOf({ ref: 'n1', refPath: 'a/b' })).toEqual({ id: 'n1', path: 'a/b' })
  // A plain card.
  expect(refOf({ ckind: 'card' })).toBeNull()
  expect(refOf(undefined)).toBeNull()
  // An id-less "ref" could only ever be resolved by path — the exact failure
  // this module exists to prevent — so it is not a ref at all.
  expect(refOf({ refPath: 'a/b' })).toBeNull()
  expect(refOf({ ref: '', refPath: 'a/b' })).toBeNull()
  // The path is optional; the id is not.
  expect(refOf({ ref: 'n1' })).toEqual({ id: 'n1', path: '' })
})

test('a ref resolves by id and shows the note’s CURRENT path', () => {
  const r = resolveRef({ id: 'n1', path: '_priority/escensus/rubric-v2' }, INDEX)
  expect(r.status).toBe('ok')
  if (r.status !== 'ok') return
  expect(r.path).toBe('_priority/escensus/rubric-v2')
  expect(r.title).toBe('Rubric V2')
  expect(r.summary).toBe('The scoring rubric, second pass.')
  expect(r.moved).toBe(false)
})

test('🔑 the target moved — the ref follows it, and says so', () => {
  // Linked when it lived in inbox/; since re-filed under _priority/.
  const r = resolveRef({ id: 'n1', path: 'inbox/rubric-draft' }, INDEX)
  expect(r.status).toBe('ok')
  if (r.status !== 'ok') return
  // The live path wins over the stored one — this is the whole feature.
  expect(r.path).toBe('_priority/escensus/rubric-v2')
  expect(r.title).toBe('Rubric V2')
  expect(r.moved).toBe(true)
})

test('a stored summary beats the raw preview', () => {
  const r = resolveRef({ id: 'n2', path: 'health/labs/panel-june' }, INDEX)
  expect(r.status).toBe('ok')
  if (r.status !== 'ok') return
  expect(r.summary).toBe('June panel — everything in range.')
})

test('a deleted target is "missing" and still names what it was', () => {
  const r = resolveRef({ id: 'gone', path: 'health/labs/panel-may' }, INDEX)
  expect(r.status).toBe('missing')
  // Not a blank card: the stored path is the only record left of what you lost.
  expect(r.path).toBe('health/labs/panel-may')
  expect(r.title).toBe('Panel May')
})

test('🔑 no index yet is "loading", never "missing"', () => {
  // Reporting a live note as gone because the vault list hasn't landed is a
  // lie the user cannot check — and it would flash on every board open.
  const r = resolveRef({ id: 'n1', path: '_priority/escensus/rubric-v2' }, null)
  expect(r.status).toBe('loading')
  expect(r.title).toBe('Rubric V2')
})

test('titleForPath de-slugs the last segment only', () => {
  expect(titleForPath('_priority/escensus/deal-memo')).toBe('Deal Memo')
  expect(titleForPath('loose_note')).toBe('Loose Note')
  expect(titleForPath('single')).toBe('Single')
  // A trailing slash must not produce an empty title.
  expect(titleForPath('folder/')).toBe('Folder')
})
