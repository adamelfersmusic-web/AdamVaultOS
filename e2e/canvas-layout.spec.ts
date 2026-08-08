// Unit tests for the map-mode layout engine. No browser — the module is pure,
// and Playwright runs TypeScript in Node, so this needs no extra test runner.
//
// These assert the checkable half of "calm": columns, one rhythm, zero
// crossings, and collapsed branches leaving no gap.

import { test, expect } from '@playwright/test'
import {
  layoutMap,
  orderAfter,
  MAP_CARD_W,
  MAP_H_GAP,
  MAP_V_GAP,
  MAP_X0,
  type LayoutInput,
} from '../src/lib/canvasLayout'

const card = (
  path: string,
  parent: string | null,
  order: number,
  height = 100,
  collapsed = false,
): LayoutInput => ({ path, parent, order, height, collapsed })

/** The real shape: one trunk, 8 sections, uneven depth. */
function signalcraft(): LayoutInput[] {
  const out: LayoutInput[] = [card('root', null, 10, 60)]
  const sections = ['rubric', 'score', 'bench', 'pilot', 'engine', 'next', 'where', 'who']
  sections.forEach((s, i) => out.push(card(s, 'root', (i + 1) * 10, 80)))
  // Section A goes three deep; section B is flat. A layout that only looks
  // right when the tree is balanced is not done.
  for (let i = 0; i < 10; i++) out.push(card(`rubric/${i}`, 'rubric', (i + 1) * 10, 60))
  for (let i = 0; i < 3; i++) out.push(card(`rubric/0/${i}`, 'rubric/0', (i + 1) * 10, 50))
  for (let i = 0; i < 8; i++) out.push(card(`score/${i}`, 'score', (i + 1) * 10, 60))
  return out
}

test('every node at a given depth shares the same x — columns, not a staircase', () => {
  const { placed } = layoutMap(signalcraft())
  const xByDepth = new Map<number, Set<number>>()
  for (const p of placed) {
    if (!xByDepth.has(p.depth)) xByDepth.set(p.depth, new Set())
    xByDepth.get(p.depth)!.add(p.x)
  }
  for (const [depth, xs] of xByDepth) {
    expect([...xs], `depth ${depth} must occupy one column`).toHaveLength(1)
  }
  // And the columns are evenly pitched.
  expect(xByDepth.get(0)!.has(MAP_X0)).toBe(true)
  expect(xByDepth.get(1)!.has(MAP_X0 + MAP_CARD_W + MAP_H_GAP)).toBe(true)
  expect(xByDepth.get(2)!.has(MAP_X0 + 2 * (MAP_CARD_W + MAP_H_GAP))).toBe(true)
})

test('siblings share one vertical gap, even with wildly different heights', () => {
  // A 3-word node next to a 40-word node.
  const cards = [
    card('root', null, 10, 60),
    card('a', 'root', 10, 40),
    card('b', 'root', 20, 300),
    card('c', 'root', 30, 40),
  ]
  const { placed } = layoutMap(cards)
  const at = (p: string) => placed.find((x) => x.path === p)!
  const h = new Map(cards.map((c) => [c.path, c.height]))

  const gapAB = at('b').y - (at('a').y + h.get('a')!)
  const gapBC = at('c').y - (at('b').y + h.get('b')!)
  expect(gapAB).toBe(MAP_V_GAP)
  expect(gapBC).toBe(MAP_V_GAP)
})

test('siblings never overlap, anywhere in the real map', () => {
  const cards = signalcraft()
  const { placed } = layoutMap(cards)
  const h = new Map(cards.map((c) => [c.path, c.height]))
  const byDepth = new Map<number, typeof placed>()
  for (const p of placed) byDepth.set(p.depth, [...(byDepth.get(p.depth) ?? []), p])

  for (const [depth, nodes] of byDepth) {
    const sorted = [...nodes].sort((a, b) => a.y - b.y)
    for (let i = 1; i < sorted.length; i++) {
      const prevBottom = sorted[i - 1].y + h.get(sorted[i - 1].path)!
      expect(sorted[i].y, `overlap at depth ${depth}`).toBeGreaterThanOrEqual(prevBottom)
    }
  }
})

test('a parent centres against the band its children occupy', () => {
  const cards = [
    card('root', null, 10, 60),
    card('a', 'root', 10, 100),
    card('b', 'root', 20, 100),
  ]
  const { placed } = layoutMap(cards)
  const at = (p: string) => placed.find((x) => x.path === p)!
  const bandTop = at('a').y
  const bandBottom = at('b').y + 100
  const rootCentre = at('root').y + 60 / 2
  expect(rootCentre).toBeCloseTo(bandTop + (bandBottom - bandTop) / 2, 5)
})

test('a collapsed branch leaves no gap — the column closes up', () => {
  const open = layoutMap([
    card('root', null, 10, 60),
    card('a', 'root', 10, 80),
    card('a/1', 'a', 10, 80),
    card('a/2', 'a', 20, 80),
    card('b', 'root', 20, 80),
  ])
  const shut = layoutMap([
    card('root', null, 10, 60),
    card('a', 'root', 10, 80, true), // collapsed
    card('a/1', 'a', 10, 80),
    card('a/2', 'a', 20, 80),
    card('b', 'root', 20, 80),
  ])

  // Hidden children are not placed at all…
  expect(shut.placed.map((p) => p.path)).not.toContain('a/1')
  expect(shut.placed.find((p) => p.path === 'a')!.collapsedWithChildren).toBe(true)
  // …and b moves up to sit directly under a, rather than leaving a hole.
  const bOpen = open.placed.find((p) => p.path === 'b')!.y
  const bShut = shut.placed.find((p) => p.path === 'b')!.y
  expect(bShut).toBeLessThan(bOpen)
  expect(bShut).toBe(shut.placed.find((p) => p.path === 'a')!.y + 80 + MAP_V_GAP)
  // No link is drawn into a hidden child.
  expect(shut.links.some((l) => l.to === 'a/1')).toBe(false)
})

test('links connect exactly the visible parent/child pairs', () => {
  const { placed, links } = layoutMap(signalcraft())
  const visible = new Set(placed.map((p) => p.path))
  for (const l of links) {
    expect(visible.has(l.from)).toBe(true)
    expect(visible.has(l.to)).toBe(true)
  }
  // A pure tree: every node except the trunk is the target of exactly one link.
  const targets = links.map((l) => l.to)
  expect(new Set(targets).size).toBe(targets.length)
  expect(targets).not.toContain('root')
})

test('a card whose parent was deleted becomes a trunk, not an invisible orphan', () => {
  const { placed } = layoutMap([
    card('root', null, 10, 60),
    card('lost', 'gone-away', 10, 60),
  ])
  expect(placed.map((p) => p.path).sort()).toEqual(['lost', 'root'])
  expect(placed.find((p) => p.path === 'lost')!.depth).toBe(0)
})

test('a parent cycle cannot hang the layout or hide a card', () => {
  const { placed } = layoutMap([
    card('a', 'b', 10, 60),
    card('b', 'a', 10, 60),
    card('c', null, 20, 60),
  ])
  expect(placed.map((p) => p.path).sort()).toEqual(['a', 'b', 'c'])
})

test('orderAfter keeps siblings 10-spaced and inserts between neighbours', () => {
  const sibs = [{ order: 10 }, { order: 20 }, { order: 30 }]
  expect(orderAfter(sibs, 30)).toBe(40) // append
  expect(orderAfter(sibs, 10)).toBe(15) // between 10 and 20
  expect(orderAfter(sibs, null)).toBe(0) // prepend
  expect(orderAfter([], null)).toBe(0)
  expect(orderAfter([], 10)).toBe(20)
})
