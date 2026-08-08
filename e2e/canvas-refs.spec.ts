// Ref cards through the real UI.
//
// THE contract, in three parts:
//   1. Linking a note puts a WINDOW on the board — the note stays one note, in
//      one place. Nothing is copied and nothing new is filed.
//   2. The pointer is an ID, so re-filing the target does not break the card.
//      This is the test the whole design exists for.
//   3. Removing the card never touches the note.
//
// A ref is `ckind: 'card'`, so it inherits the clutter filter, groups, map
// layout and mermaid export for free. The last test holds that line.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
  // Canvas writes are optimistic: a previous test's creates can land AFTER
  // this reset and repopulate the board, failing whichever test runs next.
  await expect
    .poll(async () => {
      const res = await page.request.get(
        `${MOCK}/api/notes?path_prefix=${encodeURIComponent('canvas/')}`,
        { headers: AUTH },
      )
      return ((await res.json()) as unknown[]).length
    })
    .toBe(0)
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
async function seed(page: Page, path: string, content: string, tags: string[] = []) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags, metadata: {} },
  })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json()) as { id: string; path: string; updatedAt: string }
}

interface Row {
  id: string
  path: string
  content?: string
  updatedAt: string
  metadata?: Record<string, unknown>
}
async function canvasRows(page: Page): Promise<Row[]> {
  const res = await page.request.get(
    `${MOCK}/api/notes?path_prefix=${encodeURIComponent('canvas/')}&include_content=true`,
    { headers: AUTH },
  )
  return (await res.json()) as Row[]
}
async function noteAt(page: Page, path: string): Promise<Row | null> {
  const res = await page.request.get(`${MOCK}/api/notes?limit=2000&include_content=true`, {
    headers: AUTH,
  })
  return ((await res.json()) as Row[]).find((r) => r.path === path) ?? null
}

const TARGET = '_priority/escensus/rubric-v2'

async function newBoard(page: Page) {
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await expect(page.locator('.db-title')).toHaveText('Canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await expect(page.locator('.canvas-title-input')).toBeVisible()
}

/** Link `TARGET` onto the open board via the picker. */
async function linkTarget(page: Page, query = 'rubric') {
  await page.getByTestId('canvas-link-note').click()
  const picker = page.getByTestId('ref-picker')
  await expect(picker).toBeVisible()
  await picker.locator('.subpage-search').fill(query)
  await picker.getByTestId('ref-picker-row').first().click()
  await expect(picker).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('linking a note puts a window on the board — nothing is copied', async ({ page }) => {
  const target = await seed(page, TARGET, '# Rubric v2\nThe scoring rubric, second pass.')
  await connectViaStorage(page)
  await newBoard(page)
  await linkTarget(page)

  // On screen: the note's title and its live path.
  const body = page.getByTestId('ref-body')
  await expect(body).toBeVisible()
  await expect(body).toHaveAttribute('data-ref-status', 'ok')
  await expect(body.locator('.canvas-ref-title')).toHaveText('Rubric V2')
  await expect(body.locator('.canvas-ref-path')).toHaveText(TARGET)

  // In the vault: ONE new note, the card, pointing by id. The target is
  // untouched — same content, same path.
  await expect.poll(async () => (await canvasRows(page)).length).toBe(2) // board + card
  const card = (await canvasRows(page)).find((r) => r.metadata?.['ckind'] === 'card')!
  expect(card.metadata?.['ref']).toBe(target.id)
  expect(card.metadata?.['refPath']).toBe(TARGET)
  // A ref is a CARD, not a fourth kind — that is what keeps groups, map
  // layout, mermaid export and the clutter filter working untouched.
  expect(card.metadata?.['ckind']).toBe('card')

  const still = await noteAt(page, TARGET)
  expect(still?.content).toBe('# Rubric v2\nThe scoring rubric, second pass.')
})

test('🔑 the target is re-filed — the card follows it and says so', async ({ page }) => {
  await seed(page, TARGET, '# Rubric v2\nThe scoring rubric.')
  await connectViaStorage(page)
  await newBoard(page)
  await linkTarget(page)
  await expect(page.getByTestId('ref-body')).toHaveAttribute('data-ref-status', 'ok')

  // Move the note, exactly as re-filing it in the vault would.
  const moved = await page.request.patch(`${MOCK}/api/notes/${encodeURIComponent(TARGET)}`, {
    headers: AUTH,
    data: { path: 'archive/2026/rubric-v2', force: true },
  })
  expect(moved.status(), await moved.text()).toBe(200)

  // A path-keyed card would be dead here. This one followed.
  await page.reload()
  const body = page.getByTestId('ref-body')
  await expect(body).toHaveAttribute('data-ref-status', 'ok')
  await expect(body.locator('.canvas-ref-path')).toHaveText('archive/2026/rubric-v2')
  await expect(page.getByTestId('ref-moved')).toBeVisible()

  // And nothing was written back to the card — the pointer never needed to change.
  const card = (await canvasRows(page)).find((r) => r.metadata?.['ckind'] === 'card')!
  expect(card.metadata?.['refPath']).toBe(TARGET)
})

test('a deleted target reads as gone, and names what it was', async ({ page }) => {
  await seed(page, TARGET, '# Rubric v2\nThe scoring rubric.')
  await connectViaStorage(page)
  await newBoard(page)
  await linkTarget(page)
  await expect(page.getByTestId('ref-body')).toHaveAttribute('data-ref-status', 'ok')

  const del = await page.request.delete(`${MOCK}/api/notes/${encodeURIComponent(TARGET)}`, {
    headers: AUTH,
  })
  expect(del.status(), await del.text()).toBeLessThan(300)

  await page.reload()
  const gone = page.getByTestId('ref-gone')
  await expect(gone).toBeVisible()
  // Not a blank card — the stored path is the only record left.
  await expect(gone).toContainText(TARGET)
})

test('double-click opens the note; the card body is never editable', async ({ page }) => {
  await seed(page, TARGET, '# Rubric v2\nThe scoring rubric.')
  await connectViaStorage(page)
  await newBoard(page)
  await linkTarget(page)

  // A plain card offers ✎. A ref offers ↗ instead — there is no text of its
  // own to edit, so an editor here would promise an edit that cannot stick.
  await expect(page.getByTestId('ref-open')).toBeVisible()
  await expect(page.locator('.canvas-card-btn', { hasText: '✎' })).toHaveCount(0)

  await page.getByTestId('ref-body').dblclick()
  await expect(page).toHaveURL(/#\/note\//)
  // The real note, not the card.
  await expect(page.locator('.canvas-card-edit')).toHaveCount(0)
})

test('removing the card leaves the note completely alone', async ({ page }) => {
  await seed(page, TARGET, '# Rubric v2\nThe scoring rubric.')
  await connectViaStorage(page)
  await newBoard(page)
  await linkTarget(page)
  await expect.poll(async () => (await canvasRows(page)).length).toBe(2)

  await page.locator('.canvas-card-btn').last().click()
  await expect(page.locator('.canvas-card')).toHaveCount(0)
  await expect.poll(async () => (await canvasRows(page)).length).toBe(1) // the board

  const still = await noteAt(page, TARGET)
  expect(still, 'the linked note must survive its card').not.toBeNull()
  expect(still?.content).toBe('# Rubric v2\nThe scoring rubric.')
})

test('the picker never offers a canvas card as a link target', async ({ page }) => {
  await seed(page, TARGET, '# Rubric v2\nThe scoring rubric.')
  await connectViaStorage(page)
  await newBoard(page)

  // A plain card whose text would match the search.
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 300, y: 260 } })
  await expect(page.locator('.canvas-card')).toHaveCount(1)
  await page.locator('.canvas-title-input').click()

  await page.getByTestId('canvas-link-note').click()
  const picker = page.getByTestId('ref-picker')
  await picker.locator('.subpage-search').fill('rubric')
  // The real note only — offering a board's own nodes here would rebuild the
  // clutter the ckind filter exists to stop.
  await expect(picker.getByTestId('ref-picker-row')).toHaveCount(1)
  await expect(picker.getByText(TARGET)).toBeVisible()
})

test('a ref lives in map mode too, and exports as its title', async ({ page }) => {
  await seed(page, TARGET, '# Rubric v2\nThe scoring rubric.')
  await connectViaStorage(page)
  await newBoard(page)
  await page.getByTestId('mode-map').click()
  await linkTarget(page)

  const node = page.getByTestId('map-ref')
  await expect(node).toBeVisible()
  await expect(node).toHaveAttribute('data-ref-status', 'ok')
  await expect(node.locator('.map-node-ref-title')).toHaveText('Rubric V2')

  // Export reads the card's stored label — which is the note's title, so a map
  // of linked notes exports as a readable diagram rather than a row of blanks.
  await page.getByTestId('canvas-export').click()
  await expect(page.getByTestId('export-text')).toContainText('Rubric V2')
})

test('ref cards inherit the clutter filter — the Library shows the board only', async ({
  page,
}) => {
  await seed(page, TARGET, '# Rubric v2\nThe scoring rubric.')
  await connectViaStorage(page)
  await newBoard(page)
  await linkTarget(page)
  await expect.poll(async () => (await canvasRows(page)).length).toBe(2)

  await page.goto('http://127.0.0.1:4173/#/library')
  await expect(page.locator('.note-row').first()).toBeVisible()
  // One canvas part hidden — the ref card. The board and the linked note stay.
  await expect(page.getByTestId('canvas-parts-toggle')).toHaveText('＋1 canvas')
  await expect(page.getByText('Rubric v2')).toBeVisible()
})
