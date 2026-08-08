// Canvas sitting 3 — labelled cross-links.
//
// Arrows are what let a canvas land as a flowchart rather than a mindmap: a
// mermaid `mindmap` is strictly a tree and cannot hold a loop, so cross-links
// are the thing that promotes the output from a hierarchy to a graph.
//
// THE design detail under test: dropping a link opens its label input at once.
// An unlabelled arrow only says "related somehow", which the tree already says.

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
interface Row {
  path: string
  content?: string
  metadata?: Record<string, unknown>
}
async function rows(page: Page, kind: 'card' | 'edge'): Promise<Row[]> {
  const res = await page.request.get(
    `${MOCK}/api/notes?path_prefix=${encodeURIComponent('canvas/')}&include_content=true`,
    { headers: AUTH },
  )
  return ((await res.json()) as Row[]).filter((r) => r.metadata?.['ckind'] === kind)
}
const nodeByLabel = (page: Page, label: string) =>
  page.getByTestId('map-node').filter({ has: page.getByText(label, { exact: true }) })

/** A trunk with two children, built by keyboard. */
async function threeNodeMap(page: Page) {
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('mode-map').click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 120, y: 200 } })
  await expect(page.getByTestId('map-node-input')).toBeVisible()
  await page.keyboard.type('root')
  await page.keyboard.press('Tab')
  await page.keyboard.type('alpha')
  await page.keyboard.press('Enter')
  await page.keyboard.type('beta')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('map-node')).toHaveCount(3)
  await expect(nodeByLabel(page, 'beta')).toBeVisible()
}

/** Drag from one node's port onto another node. */
async function link(page: Page, fromLabel: string, toLabel: string) {
  const from = nodeByLabel(page, fromLabel)
  await from.hover()
  const port = from.getByTestId('map-port')
  const pb = await port.boundingBox()
  const tb = await nodeByLabel(page, toLabel).boundingBox()
  if (!pb || !tb) throw new Error('missing port or target')
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2)
  await page.mouse.down()
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('dropping a link opens its label input immediately', async ({ page }) => {
  await connectViaStorage(page)
  await threeNodeMap(page)

  await link(page, 'alpha', 'beta')

  // The label input is open and focused, with no extra click — the whole point.
  const input = page.getByTestId('map-link-input')
  await expect(input).toBeVisible()
  await expect(input).toBeFocused()

  await page.keyboard.type('feeds into')
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('map-link-label')).toContainText('feeds into')
  await expect.poll(async () => (await rows(page, 'edge')).length).toBe(1)
  const edge = (await rows(page, 'edge'))[0]
  expect(edge.metadata?.['label']).toBe('feeds into')
  expect(edge.content).toBe('feeds into')
})

test('a cross-link is stored as its own note, pointing at two card paths', async ({ page }) => {
  await connectViaStorage(page)
  await threeNodeMap(page)
  await link(page, 'beta', 'alpha') // deliberately backwards: a tree cannot say this
  await page.keyboard.type('blocks')
  await page.keyboard.press('Enter')

  await expect.poll(async () => (await rows(page, 'edge')).length).toBe(1)
  const edge = (await rows(page, 'edge'))[0]
  const cards = await rows(page, 'card')
  const alpha = cards.find((c) => (c.content ?? '').trim() === 'alpha')!
  const beta = cards.find((c) => (c.content ?? '').trim() === 'beta')!

  expect(edge.metadata?.['from']).toBe(beta.path)
  expect(edge.metadata?.['to']).toBe(alpha.path)
  expect(edge.metadata?.['board']).toBeTruthy()
  // Tree structure is untouched: parent still describes the hierarchy, and no
  // edge note was invented for the parent/child links.
  expect(alpha.metadata?.['parent']).toBeTruthy()
  expect((await rows(page, 'edge')).length).toBe(1)
})

test('links survive a reload and can be relabelled or removed', async ({ page }) => {
  await connectViaStorage(page)
  await threeNodeMap(page)
  await link(page, 'alpha', 'beta')
  await page.keyboard.type('feeds into')
  await page.keyboard.press('Enter')
  // Wait for the LABEL to land, not just the edge — reloading between the two
  // writes is a race the test would otherwise lose at random.
  await expect
    .poll(async () => (await rows(page, 'edge'))[0]?.metadata?.['label'])
    .toBe('feeds into')

  await page.reload()
  await expect(page.getByTestId('map-link')).toHaveCount(1)
  await expect(page.getByTestId('map-link-label')).toContainText('feeds into')

  // Relabel in place.
  await page.getByTestId('map-link-label').getByRole('button').first().click()
  const input = page.getByTestId('map-link-input')
  await expect(input).toBeVisible()
  await input.fill('depends on')
  await page.keyboard.press('Enter')
  await expect
    .poll(async () => (await rows(page, 'edge'))[0]?.metadata?.['label'])
    .toBe('depends on')

  // Remove it — the note goes with it.
  await page.getByTestId('map-link-remove').click()
  await expect(page.getByTestId('map-link')).toHaveCount(0)
  await expect.poll(async () => (await rows(page, 'edge')).length).toBe(0)
})

test('edges are drawn with right angles only — no diagonals', async ({ page }) => {
  await connectViaStorage(page)
  await threeNodeMap(page)
  await link(page, 'alpha', 'beta')
  await page.keyboard.press('Escape')

  const ds = await page
    .locator('.map-edge, .map-link')
    .evaluateAll((els) => els.map((el) => el.getAttribute('d') ?? ''))
  expect(ds.length).toBeGreaterThan(0)
  for (const d of ds) {
    // Only M / H / V commands: every segment is horizontal or vertical. A
    // diagonal would need L or a curve command.
    expect(d, `"${d}" must use right angles only`).toMatch(/^M[\s\d.,-]+(?:[HV][\s\d.-]+)+$/)
    expect(d).not.toMatch(/[LCQSTAlcqsta]/)
  }
})

test('a link to a collapsed branch disappears with it', async ({ page }) => {
  await connectViaStorage(page)
  await threeNodeMap(page)
  // Give alpha a child, then link the trunk to that child.
  await nodeByLabel(page, 'alpha').click()
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('map-node-input')).toBeVisible()
  await page.keyboard.type('deep')
  await page.keyboard.press('Escape')
  await expect(nodeByLabel(page, 'deep')).toBeVisible()

  await link(page, 'beta', 'deep')
  await page.keyboard.type('needs')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('map-link')).toHaveCount(1)

  // Collapse alpha — "deep" is hidden, so the link has nowhere to land and is
  // not drawn. The edge note itself is untouched.
  await nodeByLabel(page, 'alpha').getByTestId('map-collapse').click()
  await expect(nodeByLabel(page, 'deep')).toHaveCount(0)
  await expect(page.getByTestId('map-link')).toHaveCount(0)
  expect((await rows(page, 'edge')).length).toBe(1)
})
