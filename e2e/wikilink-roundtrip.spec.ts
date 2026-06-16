// Wikilink + special-character round-trip safety. The block editor must open,
// edit, and save a note WITHOUT escaping [[wikilinks]] or special characters —
// the bug that turned [[Amanda/02-work-log]] into \[\[Amanda/02-work-log\]\],
// "File & Storage" into "File &amp; Storage", etc. and destroyed graph edges.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'
const PATH = 'Amanda/03-roundtrip-test'

// The exact acceptance content from the task.
const CONTENT = `Link test [[Amanda/02-work-log]] and [[Amanda/06-content-calendar-v9-1]].
Ampersand: File & Storage.
Arrow: Adam -> Cassy.
Underscore: some_variable_name.
`

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function seed(page: Page) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path: PATH, content: CONTENT, tags: ['amanda'], metadata: {} },
  })
  expect(res.status(), await res.text()).toBe(201)
}
async function readVault(page: Page): Promise<string> {
  const res = await page.request.get(`${MOCK}/__test/note?path=${encodeURIComponent(PATH)}`)
  expect(res.ok()).toBeTruthy()
  return (await res.json()).content as string
}
async function connect(page: Page) {
  await page.addInitScript(
    ([k, url, t]) => {
      localStorage.setItem(
        k,
        JSON.stringify({ vaultUrl: url, mode: 'token', token: { accessToken: t } }),
      )
    },
    [SESSION_KEY, MOCK, TOKEN] as const,
  )
}

/** No escaping artifacts; every special construct survives literally. */
function assertNoCorruption(md: string) {
  expect(md).toContain('[[Amanda/02-work-log]]')
  expect(md).toContain('[[Amanda/06-content-calendar-v9-1]]')
  expect(md).not.toMatch(/\\\[/) // no \[
  expect(md).not.toMatch(/\\\]/) // no \]
  expect(md).toContain('File & Storage')
  expect(md).not.toContain('&amp;')
  expect(md).toContain('Adam -> Cassy')
  expect(md).not.toContain('&gt;')
  expect(md).not.toContain('&lt;')
  expect(md).toContain('some_variable_name')
  expect(md).not.toContain('some\\_variable') // no escaped underscore
}

test.beforeEach(async ({ page }) => {
  await reset(page)
  await seed(page)
})

test('unedited open → save is byte-identical (wikilinks parsed as chips)', async ({ page }) => {
  await connect(page)
  await page.goto(`/#/pages/${encodeURIComponent(PATH)}`)

  // Parsed as first-class nodes: two clickable wikilink chips render.
  await expect(page.locator('.page-prose .wikilink')).toHaveCount(2)

  // Opening (no edit) must never rewrite the stored note.
  expect(await readVault(page)).toBe(CONTENT)
})

test('edit → save keeps wikilinks and special characters intact', async ({ page }) => {
  await connect(page)
  await page.goto(`/#/pages/${encodeURIComponent(PATH)}`)
  await expect(page.locator('.page-prose .wikilink').first()).toBeVisible()

  // Edit one word at the end, then save.
  await page.locator('.page-prose').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' EDITED')
  await expect(page.getByTestId('page-save')).toHaveText(/Saved/, { timeout: 10_000 })

  const md = await readVault(page)
  assertNoCorruption(md)
  expect(md).toContain('EDITED')
})

test('clicking a wikilink opens that note in the block editor', async ({ page }) => {
  await connect(page)
  await page.goto(`/#/pages/${encodeURIComponent(PATH)}`)
  await page
    .locator('.page-prose .wikilink', { hasText: 'Amanda/02-work-log' })
    .click()
  await expect(page).toHaveURL(/#\/pages\/Amanda(%2F|\/)02-work-log$/)
})
