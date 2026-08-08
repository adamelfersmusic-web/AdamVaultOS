// Canvas parts stay on their boards.
//
// THE contract: a board's cards, groups and arrows are real vault notes — that
// is what lets a card hold a checklist — but they are MACHINERY, and the
// surfaces you browse must not list them beside the notes you wrote. One
// 40-node map otherwise adds 40 rows to the Library, 40 dots to the graph, and
// 40 candidates to every [[ menu.
//
// Hidden, never gone. Two escape hatches are tested here as hard requirements:
// the Library's toggle, and `path:canvas` in the Omnibar. Board notes are
// never hidden by any of it.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'
const PARTS_KEY = 'adamvaultos.library.canvasParts'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function seed(
  page: Page,
  path: string,
  content: string,
  tags: string[] = [],
  metadata: Record<string, unknown> = {},
) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags, metadata },
  })
  expect(res.status(), await res.text()).toBe(201)
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

/**
 * A vault shaped like Adam's after building one map: a handful of real notes,
 * one board, and the board's parts — cards, a group and an arrow. The card
 * bodies deliberately contain a word ("rubric") that a real note also contains,
 * so a search can prove the parts are filtered rather than merely out-ranked.
 */
async function seedVault(page: Page) {
  await seed(page, '_priority/escensus/rubric-v2', '# Rubric v2\nThe scoring rubric.', [
    'escensus',
  ])
  await seed(page, '_priority/escensus/pilot-plan', '# Pilot plan\nLaunch notes.', ['escensus'])
  await seed(page, 'health/labs/panel-june', '# Panel June', ['health'])

  await seed(page, 'canvas/signalcraft-map', 'Signalcraft map', ['canvas'], {
    ckind: 'board',
    title: 'Signalcraft map',
  })
  for (const [slug, body] of [
    ['root', 'SIGNALCRAFT'],
    ['a', 'A · MAKE A RUBRIC'],
    ['a-1', 'Slot wording pass for the rubric'],
    ['b', 'B · SCORE CALLS'],
  ] as const) {
    await seed(page, `canvas/signalcraft-map/${slug}`, body, ['canvas'], {
      ckind: 'card',
      board: 'signalcraft-map',
      x: 40,
      y: 40,
      w: 240,
      h: 100,
    })
  }
  await seed(page, 'canvas/signalcraft-map/g1', 'Cluster', ['canvas'], {
    ckind: 'group',
    board: 'signalcraft-map',
    x: 0,
    y: 0,
    w: 400,
    h: 300,
  })
  await seed(page, 'canvas/signalcraft-map/e1', '', ['canvas'], {
    ckind: 'edge',
    board: 'signalcraft-map',
    from: 'root',
    to: 'a',
    label: '',
  })
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('the Library lists the board — and none of its 6 parts', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/library')
  await expect(page.locator('.note-row').first()).toBeVisible()

  // The board is a thing you made, so it stays.
  await expect(page.getByText('Signalcraft map')).toBeVisible()
  // Its cards and its group do not. (Both strings are ones the row DOES render
  // when the parts are shown — the next test proves it, so absence here means
  // filtered, not merely unrendered.)
  await expect(page.getByText('SIGNALCRAFT', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Cluster', { exact: true })).toHaveCount(0)
  // The toolbar says exactly how many, so nothing is hidden silently.
  await expect(page.getByTestId('canvas-parts-toggle')).toHaveText('＋6 canvas')
})

test('the #canvas tag counts the boards you made, not their nodes', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/library')

  const tree = page.getByTestId('tag-tree')
  const canvas = tree.locator('.tag-tree-item', { hasText: 'canvas' }).first()
  await expect(canvas).toBeVisible()
  // 1, not 7 — the count is the thing you'd actually look for.
  await expect(canvas).toContainText('1')

  // And the canvas/ folder in the path rail agrees.
  await page.getByTestId('rail-mode-paths').click()
  const folder = page
    .getByTestId('path-tree')
    .locator('.tag-tree-item', { hasText: 'canvas' })
    .first()
  await expect(folder).toContainText('1')
})

test('the toggle brings every part back, and remembers the choice', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/library')

  const rows = page.locator('.note-row')
  await expect(rows.first()).toBeVisible()
  const hidden = await rows.count()

  const toggle = page.getByTestId('canvas-parts-toggle')
  await expect(toggle).toHaveText('＋6 canvas')

  await toggle.click()
  await expect(rows).toHaveCount(hidden + 6)
  await expect(page.getByText('SIGNALCRAFT', { exact: true })).toBeVisible()
  await expect(page.getByText('Cluster', { exact: true })).toBeVisible()
  await expect(toggle).toHaveText('Hide canvas parts')

  // Persisted, so the choice survives the next visit.
  expect(await page.evaluate((k) => localStorage.getItem(k), PARTS_KEY)).toBe('1')
  await page.reload()
  await expect(rows).toHaveCount(hidden + 6)

  // …and it goes back.
  await page.getByTestId('canvas-parts-toggle').click()
  await expect(rows).toHaveCount(hidden)
  expect(await page.evaluate((k) => localStorage.getItem(k), PARTS_KEY)).toBe('0')
})

test('a vault with no canvas parts shows no toggle at all', async ({ page }) => {
  // Nothing seeded beyond the standard corpus, which holds no boards.
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/library')
  await expect(page.locator('.note-row').first()).toBeVisible()
  await expect(page.getByTestId('canvas-parts-toggle')).toHaveCount(0)
})

test('Library search cannot surface a card, even on a word the card contains', async ({
  page,
}) => {
  await seedVault(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/library')

  // "rubric" is in a real note AND in two card bodies. Only the note comes back.
  await page.locator('.browser-search').fill('rubric')
  await expect(page.locator('.note-row')).toHaveCount(1)
  await expect(page.getByText('Rubric v2')).toBeVisible()
  await expect(page.getByText('MAKE A RUBRIC')).toHaveCount(0)
})

test('⌘K hides the parts — and path:canvas hands them straight back', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/library')
  await expect(page.locator('.note-row').first()).toBeVisible()

  await page.keyboard.press('Meta+k')
  const omni = page.getByTestId('omnibar')
  await expect(omni).toBeVisible()

  await omni.locator('input').fill('rubric')
  await expect(omni.getByText('Rubric v2')).toBeVisible()
  await expect(omni.getByText('MAKE A RUBRIC')).toHaveCount(0)

  // Asking for canvas storage by path is a deliberate act — nothing in the
  // vault may be permanently unreachable from here.
  await omni.locator('input').fill('path:canvas rubric')
  await expect(omni.getByText('MAKE A RUBRIC')).toBeVisible()
})

test('the [[ menu offers the board, never its cards', async ({ page }) => {
  await seedVault(page)
  await seed(page, 'pages/scratch', '# Scratch', ['page'])
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/pages/pages%2Fscratch')

  const editor = page.locator('.ProseMirror')
  await expect(editor).toBeVisible()
  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.type('\n[[signalcraft')

  const menu = page.locator('.slash-menu')
  await expect(menu).toBeVisible()
  // The board is a link target. Its cards, which share the path prefix and so
  // fuzzy-match "signalcraft" through their path, are not.
  await expect(menu.getByText('Signalcraft Map', { exact: false })).toBeVisible()
  await expect(menu.getByText('canvas/signalcraft-map/', { exact: false })).toHaveCount(0)
})

test('the graph draws the board and skips its nodes', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/graph')

  // The board is a node…
  await expect(page.locator('.gnode[data-path="canvas/signalcraft-map"]')).toHaveCount(1)
  // …and not one of its six parts is.
  await expect(page.locator('.gnode[data-path^="canvas/signalcraft-map/"]')).toHaveCount(0)
})
