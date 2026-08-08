// Group geometry — pure, no browser. Membership is the part that must be right:
// it is derived from position on every render, so a wrong rule silently moves
// the wrong cards.

import { test, expect } from '@playwright/test'
import {
  centreIn,
  contentsOf,
  innermostGroup,
  groupCounts,
  type Placed,
} from '../src/lib/canvasGroups'

const r = (path: string, x: number, y: number, w = 100, h = 60): Placed => ({ path, x, y, w, h })

test('a card belongs to a group by its CENTRE, not full containment', () => {
  const group = r('g', 0, 0, 200, 200)
  // Overhangs the right edge, but its middle is inside — the eye says it's in.
  expect(centreIn(r('c', 150, 50, 100, 60), group)).toBe(true)
  // Mostly outside: centre is beyond the edge.
  expect(centreIn(r('c', 190, 50, 100, 60), group)).toBe(false)
})

test('nudging a group edge does not eject a card that overhangs it', () => {
  const card = r('c', 150, 50, 100, 60) // centre x = 200
  expect(centreIn(card, r('g', 0, 0, 210, 200))).toBe(true)
  // Shrink the group by 5px — full containment would have dropped this card
  // several pixels ago; the centre rule keeps it.
  expect(centreIn(card, r('g', 0, 0, 205, 200))).toBe(true)
})

test('dragging a group carries its cards', () => {
  const g = r('g', 0, 0, 300, 300)
  const cards = [r('in', 50, 50), r('out', 500, 500)]
  const { cards: moved } = contentsOf(g, cards, [g])
  expect(moved).toEqual(['in'])
})

test('dragging an outer group carries nested groups and their cards', () => {
  const outer = r('outer', 0, 0, 400, 400)
  const inner = r('inner', 50, 50, 150, 150)
  const cards = [r('deep', 80, 80), r('loose', 300, 300), r('far', 900, 900)]
  const res = contentsOf(outer, cards, [outer, inner])
  expect(res.groups).toEqual(['inner'])
  expect(res.cards.sort()).toEqual(['deep', 'loose'])
})

test('dragging an inner group leaves the outer one alone', () => {
  const outer = r('outer', 0, 0, 400, 400)
  const inner = r('inner', 50, 50, 150, 150)
  const cards = [r('deep', 80, 80), r('loose', 300, 300)]
  const res = contentsOf(inner, cards, [outer, inner])
  expect(res.groups).toEqual([])
  expect(res.cards).toEqual(['deep'])
})

test('two identical groups cannot swallow each other into a cycle', () => {
  const a = r('a', 0, 0, 200, 200)
  const b = r('b', 0, 0, 200, 200)
  const res = contentsOf(a, [], [a, b])
  expect(res.groups).toEqual(['b'])
  // And the reverse drag terminates too, rather than recursing forever.
  expect(contentsOf(b, [], [a, b]).groups).toEqual(['a'])
})

test('when groups overlap, the innermost owns the card', () => {
  const outer = r('outer', 0, 0, 400, 400)
  const inner = r('inner', 50, 50, 150, 150)
  expect(innermostGroup(r('c', 80, 80), [outer, inner])).toBe('inner')
  expect(innermostGroup(r('c', 300, 300), [outer, inner])).toBe('outer')
  expect(innermostGroup(r('c', 900, 900), [outer, inner])).toBe(null)
})

test('counts attribute each card to exactly one group', () => {
  const outer = r('outer', 0, 0, 400, 400)
  const inner = r('inner', 50, 50, 150, 150)
  const counts = groupCounts([r('a', 80, 80), r('b', 90, 90), r('c', 300, 300)], [outer, inner])
  expect(counts).toEqual({ outer: 1, inner: 2 })
})

test('an empty group reports zero rather than being absent', () => {
  expect(groupCounts([], [r('g', 0, 0)])).toEqual({ g: 0 })
})
