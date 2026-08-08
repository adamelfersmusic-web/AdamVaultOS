// Canvas sitting 2 — map mode.
//
// THE acceptance test is the keyboard flow: build a tree using only Enter, Tab
// and Shift+Tab, never touching the mouse to position anything. If placement
// needs a mouse, the layout engine has failed.
//
// Layout correctness itself is covered in canvas-layout.spec.ts against the
// pure module. This drives the real UI: keys, persistence, collapse, and the
// lossless toggle back to free mode.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function connectViaStorage(page: Page) {
  await page.addInitScript(
    ([key, url, token]) => {
      localStorage.setItem(
        key,
        JSON.stringify({ vaultUrl: url, mode: 'token', token: { accessToken: token } }),
      )
    },
    [SESSION_KEY, MOCK, TOKEN] as const,
  )
}

interface CardRow {
  path: string
  content?: string
  metadata?: Record<string, unknown>
}
async function cardRows(page: Page): Promise<CardRow[]> {
  const res = await page.request.get(
    `${MOCK}/api/notes?path_prefix=${encodeURIComponent('canvas/')}&include_content=true`,
    { headers: AUTH },
  )
  const rows = (await res.json()) as CardRow[]
  return rows.filter((r) => r.metadata?.['ckind'] === 'card')
}
const byLabel = (rows: CardRow[], label: string) =>
  rows.find((r) => (r.content ?? '').trim() === label)

/** The node whose label is exactly `label` — "A" must not match "A1". */
const nodeByLabel = (page: Page, label: string) =>
  page.getByTestId('map-node').filter({ has: page.getByText(label, { exact: true }) })

/** Wait until every label has actually reached the vault. Writes are queued
 * behind their creates, so node count reaching six precedes the text landing. */
async function waitForLabels(page: Page, labels: string[]) {
  await expect
    .poll(async () => {
      const got = new Set((await cardRows(page)).map((r) => (r.content ?? '').trim()))
      return labels.every((l) => got.has(l))
    }, { timeout: 10_000 })
    .toBe(true)
}

/** A fresh board switched into map mode, with the trunk created and selected. */
async function mapBoardWithTrunk(page: Page, trunk = 'SIGNALCRAFT') {
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await expect(page.locator('.db-title')).toHaveText('Canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await expect(page.locator('.canvas-title-input')).toBeVisible()
  await page.getByTestId('mode-map').click()
  await expect(page.getByTestId('mode-map')).toHaveAttribute('aria-pressed', 'true')

  // The first node comes from a double-click; everything after is keyboard.
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 200, y: 200 } })
  await expect(page.getByTestId('map-node')).toHaveCount(1)
  await page.getByTestId('map-node').first().dblclick()
  // Free-mode double-click navigates away; in map mode we edit in place.
  await page.goBack().catch(() => {})
  await expect(page.getByTestId('map-node')).toHaveCount(1)
  return trunk
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('build a tree with only Enter, Tab and Shift+Tab', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('mode-map').click()

  // One double-click to plant the trunk; the editor opens on the new node.
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 200, y: 200 } })
  const input = page.getByTestId('map-node-input')
  await expect(input).toBeVisible()

  // From here: keyboard only.
  await page.keyboard.type('SIGNALCRAFT')
  await page.keyboard.press('Tab') // → a child of the trunk
  await page.keyboard.type('A · MAKE A RUBRIC')
  await page.keyboard.press('Tab') // → a child of A
  await page.keyboard.type('slot one')
  await page.keyboard.press('Enter') // → a sibling of "slot one"
  await page.keyboard.type('slot two')
  await page.keyboard.press('Enter')
  await page.keyboard.type('B · SCORE CALLS')
  // Shift+Tab MOVES this node up a level rather than creating one, and the
  // editor stays on it so typing can continue.
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Enter')
  await page.keyboard.type('C · TEST BENCH')
  await page.keyboard.press('Escape')

  await expect(page.getByTestId('map-node')).toHaveCount(6)

  // The structure reached the vault, on the card notes themselves.
  await waitForLabels(page, [
    'SIGNALCRAFT',
    'A · MAKE A RUBRIC',
    'slot one',
    'slot two',
    'B · SCORE CALLS',
    'C · TEST BENCH',
  ])
  const rows = await cardRows(page)
  const trunk = byLabel(rows, 'SIGNALCRAFT')!
  const a = byLabel(rows, 'A · MAKE A RUBRIC')!
  const one = byLabel(rows, 'slot one')!
  const two = byLabel(rows, 'slot two')!
  const b = byLabel(rows, 'B · SCORE CALLS')!
  const c = byLabel(rows, 'C · TEST BENCH')!

  expect(trunk.metadata?.['parent']).toBeFalsy()
  expect(a.metadata?.['parent']).toBe(trunk.path)
  expect(one.metadata?.['parent']).toBe(a.path)
  expect(two.metadata?.['parent']).toBe(a.path) // Enter = sibling
  expect(b.metadata?.['parent']).toBe(trunk.path) // Shift+Tab moved it up
  expect(c.metadata?.['parent']).toBe(trunk.path) // then Enter kept that level
  // Siblings keep their typed order.
  expect(Number(two.metadata?.['order'])).toBeGreaterThan(Number(one.metadata?.['order']))
  expect(Number(c.metadata?.['order'])).toBeGreaterThan(Number(b.metadata?.['order']))
})

test('the map is calm: one column per depth, and it re-opens the same way', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('mode-map').click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 200, y: 200 } })
  await expect(page.getByTestId('map-node-input')).toBeVisible()

  await page.keyboard.type('root')
  await page.keyboard.press('Tab')
  await page.keyboard.type('one')
  await page.keyboard.press('Enter')
  // A deliberately long label — cards must wrap and grow, and the layout has
  // to stay calm with wildly different sibling heights.
  await page.keyboard.type(
    'Bree Final Expense Config — this is important and was our first real attempt at taking an actual real final expense call and setting it up for our template.',
  )
  await page.keyboard.press('Enter')
  await page.keyboard.type('three')
  await page.keyboard.press('Escape')
  await waitForLabels(page, ['root', 'one', 'three'])
  await expect(nodeByLabel(page, 'three')).toBeVisible()

  const xs = async () =>
    page.getByTestId('map-node').evaluateAll((els) =>
      els
        .map((el) => ({
          x: Math.round((el as HTMLElement).offsetLeft),
          y: Math.round((el as HTMLElement).offsetTop),
          h: (el as HTMLElement).offsetHeight,
        }))
        .sort((a, b) => a.x - b.x || a.y - b.y),
    )
  /** Heights are measured, so the layout settles over a frame. Waiting for two
   * identical reads also proves it converges instead of oscillating. */
  const stable = async () => {
    let prev = JSON.stringify(await xs())
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(120)
      const now = JSON.stringify(await xs())
      if (now === prev) return JSON.parse(now) as Awaited<ReturnType<typeof xs>>
      prev = now
    }
    throw new Error('layout never settled')
  }

  const boxes = await stable()
  expect(boxes).toHaveLength(4)
  // Exactly two columns: the trunk, and its three children.
  const columns = [...new Set(boxes.map((b) => b.x))]
  expect(columns).toHaveLength(2)
  // The long label really did grow the card.
  expect(Math.max(...boxes.map((b) => b.h))).toBeGreaterThan(
    Math.min(...boxes.map((b) => b.h)),
  )
  // Nothing overlaps in the child column.
  const col = boxes.filter((b) => b.x === Math.max(...columns)).sort((a, b) => a.y - b.y)
  for (let i = 1; i < col.length; i++) {
    expect(col[i].y).toBeGreaterThanOrEqual(col[i - 1].y + col[i - 1].h)
  }

  // Re-openable: the map's job is to come back, not to be built once.
  await page.reload()
  await expect(page.getByTestId('map-node')).toHaveCount(4)
  await expect(page.getByTestId('mode-map')).toHaveAttribute('aria-pressed', 'true')
  expect(await stable()).toEqual(boxes)
})

test('collapsing a branch hides it and closes the gap; the state persists', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('mode-map').click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 200, y: 200 } })
  await expect(page.getByTestId('map-node-input')).toBeVisible()

  await page.keyboard.type('root')
  await page.keyboard.press('Tab')
  await page.keyboard.type('A')
  await page.keyboard.press('Tab')
  await page.keyboard.type('A1')
  await page.keyboard.press('Enter')
  await page.keyboard.type('A2')
  await page.keyboard.press('Enter')
  await page.keyboard.type('B')
  await page.keyboard.press('Shift+Tab') // B moves up beside A
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('map-node')).toHaveCount(5)

  await waitForLabels(page, ['root', 'A', 'A1', 'A2', 'B'])
  const yOf = async (label: string) =>
    nodeByLabel(page, label).evaluate((el) => Math.round((el as HTMLElement).offsetTop))
  const bBefore = await yOf('B')

  // Collapse A — its two children vanish and B climbs into the freed space.
  await nodeByLabel(page, 'A').getByTestId('map-collapse').click()
  await expect(page.getByTestId('map-node')).toHaveCount(3)
  expect(await yOf('B')).toBeLessThan(bBefore)

  await page.reload()
  await expect(page.getByTestId('map-node')).toHaveCount(3)
})

test('toggling to free mode and back never moves a hand-placed card', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('mode-map').click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 200, y: 200 } })
  await expect(page.getByTestId('map-node-input')).toBeVisible()
  await page.keyboard.type('root')
  await page.keyboard.press('Tab')
  await page.keyboard.type('child')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('map-node')).toHaveCount(2)

  // Back to free mode, and hand-place a card somewhere deliberate.
  await page.getByTestId('mode-free').click()
  await expect(page.locator('.canvas-card')).toHaveCount(2)
  const head = page.locator('.canvas-card-head').first()
  const box = await head.boundingBox()
  if (!box) throw new Error('no card')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2 + 120, { steps: 6 })
  await page.mouse.up()

  await expect.poll(async () => (await cardRows(page)).some((r) => Number(r.metadata?.['x']) > 100)).toBe(true)
  const placedBefore = (await cardRows(page)).map((r) => ({
    path: r.path,
    x: r.metadata?.['x'],
    y: r.metadata?.['y'],
  }))

  // Into map mode and back out. Map mode computes positions; it must not
  // write them, or this hand placement would be silently destroyed.
  await page.getByTestId('mode-map').click()
  await expect(page.getByTestId('map-node')).toHaveCount(2)
  await page.getByTestId('mode-free').click()
  await expect(page.locator('.canvas-card')).toHaveCount(2)
  await page.waitForTimeout(700)

  const placedAfter = (await cardRows(page)).map((r) => ({
    path: r.path,
    x: r.metadata?.['x'],
    y: r.metadata?.['y'],
  }))
  expect(placedAfter).toEqual(placedBefore)
})

test('map-mode keys stay out of the block editor — Tab still nests todos', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()

  // Free mode: the block editor owns Tab, exactly as before map mode existed.
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 300, y: 200 } })
  const prose = page.locator('.card-prose')
  await expect(prose).toBeVisible()
  await page.keyboard.type('/todo')
  await expect(page.locator('.slash-menu')).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type('Ship it')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.type('sub-step')
  await expect(prose.locator('ul[data-type=taskList] ul[data-type=taskList]')).toHaveCount(1)

  // And no stray map node was created by those Tabs.
  await page.locator('.canvas-title-input').click()
  await expect(page.locator('.canvas-card')).toHaveCount(1)
})
