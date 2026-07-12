// Library enrichment: "N rel" link-degree badges on note cards (#5's original
// weighted-cards vision) and the tag-rail ＋ (L1 — create exactly where you're
// looking).

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function seed(
  page: Page,
  path: string,
  content: string,
  tags: string[] = [],
) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags, metadata: {} },
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

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('note cards show an "N rel" weight when links touch them', async ({ page }) => {
  await seed(page, 'escensus/hub-note', '# Hub note\n\nCites [[escensus/leaf-note]] here.')
  await seed(page, 'escensus/leaf-note', '# Leaf note\n\nQuiet.')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/library')
  const hubRow = page.locator('.note-row', { hasText: 'Hub note' })
  await expect(hubRow).toBeVisible()
  await expect(hubRow.locator('.note-rel')).toHaveText('1 rel')
  // The leaf is CITED-BY the hub — degree counts both directions.
  await expect(
    page.locator('.note-row', { hasText: 'Leaf note' }).locator('.note-rel'),
  ).toHaveText('1 rel')
})

test('tag-rail ＋ creates a note pre-tagged with that exact tag', async ({ page }) => {
  await seed(page, 'escensus/pitch-notes', '# Pitch notes\n\nBody.', ['escensus'])
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/library')
  const row = page
    .getByTestId('tag-tree')
    .locator('.tag-tree-item', { hasText: '#escensus' })
    .first()
  await row.hover()
  await row.locator('.tag-tree-add').click()

  // Lands in the Pages editor; the note is born carrying the tag.
  await expect(page).toHaveURL(/#\/pages\/pages%2Funtitled/)
  const res = await page.request.get(
    `${MOCK}/api/notes?id=${encodeURIComponent('pages/untitled')}`,
    { headers: AUTH },
  )
  const note = (await res.json()) as { tags?: string[] }
  expect(note.tags).toContain('escensus')
})
