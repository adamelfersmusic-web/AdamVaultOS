// The filter rule itself — pure, no browser.
//
// THE contract, in one line: a BOARD is a note, its PARTS are machinery. Get
// that backwards and either the boards vanish from the Library (you lose the
// thing you made) or the parts stay (the clutter this exists to stop).

import { test, expect } from '@playwright/test'
import { asksForCanvas, isCanvasPart, withoutCanvasParts } from '../src/lib/canvasParts'

const note = (ckind?: string) => ({ metadata: ckind === undefined ? {} : { ckind } })

test('cards, groups and arrows are parts; boards and plain notes are not', () => {
  expect(isCanvasPart(note('card'))).toBe(true)
  expect(isCanvasPart(note('group'))).toBe(true)
  expect(isCanvasPart(note('edge'))).toBe(true)

  // The two that must survive.
  expect(isCanvasPart(note('board'))).toBe(false)
  expect(isCanvasPart(note())).toBe(false)
})

test('a note with no metadata at all is never a part', () => {
  // The live vault has returned notes with no `metadata` object — reading
  // through it unguarded is how the graph used to crash on load.
  expect(isCanvasPart({})).toBe(false)
  expect(withoutCanvasParts([{}, { metadata: { ckind: 'card' } }])).toHaveLength(1)
})

test('an unknown ckind is left alone rather than guessed at', () => {
  // A future kind we do not know about is not silently hidden — a thing you
  // cannot see and did not ask to hide is the worst outcome here.
  expect(isCanvasPart(note('portal'))).toBe(false)
  expect(isCanvasPart(note(''))).toBe(false)
})

test('withoutCanvasParts keeps order and identity, and copies rather than mutates', () => {
  const input = [
    { path: 'a', metadata: {} },
    { path: 'canvas/b', metadata: { ckind: 'board' } },
    { path: 'canvas/b/c', metadata: { ckind: 'card' } },
    { path: 'z', metadata: {} },
  ]
  const out = withoutCanvasParts(input)
  expect(out.map((n) => n.path)).toEqual(['a', 'canvas/b', 'z'])
  expect(out[0]).toBe(input[0]) // same objects, not clones
  expect(input).toHaveLength(4) // the caller's list is untouched
})

test('path:canvas is the escape hatch — and only that prefix opens it', () => {
  expect(asksForCanvas(['canvas'])).toBe(true)
  expect(asksForCanvas(['canvas/signalcraft-map'])).toBe(true)
  expect(asksForCanvas(['CANVAS/'])).toBe(true) // case is not a trap
  expect(asksForCanvas(['_priority', 'canvas'])).toBe(true) // any one of them

  expect(asksForCanvas([])).toBe(false)
  expect(asksForCanvas(['health'])).toBe(false)
  // Not a prefix match on a DIFFERENT folder that merely contains the word.
  expect(asksForCanvas(['art/canvas-notes'])).toBe(false)
})
