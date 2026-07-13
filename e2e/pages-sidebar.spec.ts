// Pages sidebar fixes (Adam's live reports, July 12):
// 1. A freshly created page must still be in the sidebar after leaving Pages
//    and coming back (the lean fetch was unsorted + truncated at 500 — the
//    NEWEST notes silently fell off on a 700+ note vault).
// 2. Folders nest one level: _priority/escensus/… shows an "escensus"
//    subfolder instead of hiding 100+ notes behind "_priority".
// 3. The sidebar search is the app's ONE relevance ranking — body text counts.

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
  metadata: Record<string, unknown> = {},
) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags: [], metadata },
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

test('a fresh page survives leaving Pages and coming back — newest on top', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/pages')
  await expect(page.getByTestId('pages')).toBeVisible()

  // Create + title a page.
  await page.locator('.pages-new').click()
  await expect(page.locator('.page-prose')).toBeVisible()
  await page.locator('.page-prose h1').click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('# Ya')
  await expect(page.getByTestId('page-save')).toContainText('Saved', { timeout: 8000 })

  // Leave for the Cockpit, come back — the page MUST be first under Recent.
  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()
  await page.goto('http://127.0.0.1:4173/#/pages')
  await expect(page.locator('.pages-list .pages-item').first()).toContainText('Ya')
})

test('folders nest one level — escensus surfaces inside _priority', async ({ page }) => {
  await seed(page, '_priority/escensus/pitch-plan', '# Pitch plan\n\nBody.')
  await seed(page, '_priority/escensus/call-corpus', '# Call corpus\n\nBody.')
  await seed(page, '_priority/loose-note', '# Loose note\n\nBody.')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages')
  const group = page.locator('.pages-group', { hasText: '_priority' }).first()
  await group.locator('.pages-group-head').first().click()

  // Direct child listed; escensus is a collapsible subfolder with its count.
  await expect(group).toContainText('Loose Note')
  const sub = group.locator('.pages-subgroup', { hasText: 'escensus' })
  await expect(sub.locator('.pages-group-count')).toHaveText('2')
  await sub.locator('.pages-subgroup-head').click()
  await expect(sub).toContainText('Pitch Plan')
})

test('pinned notes sit in a Pinned group above Recent, and open on click', async ({ page }) => {
  await seed(page, 'desk/00-plan', '# The Plan\n\nFront door.', { pinned: true })
  await seed(page, 'pages/ordinary-note', '# Ordinary\n\nNothing pinned here.')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages')
  const pinned = page.getByTestId('pages-pinned')
  await expect(pinned).toBeVisible()

  // Pinned is the FIRST section in the list, and holds ONLY the pinned note.
  await expect(page.locator('.pages-list .pages-section-label').first()).toHaveText('Pinned')
  await expect(pinned.locator('.pages-item')).toHaveCount(1)
  await expect(pinned.locator('.pages-item')).toContainText('00 Plan')
  // The non-pinned note stays out of the group (it lives under Recent).
  await expect(pinned).not.toContainText('Ordinary')

  // Clicking navigates like any Recent row — the page opens in the editor.
  await pinned.locator('.pages-item').click()
  await expect(page).toHaveURL(/#\/pages\/desk%2F00-plan/)
  await expect(page.locator('.page-prose h1')).toContainText('The Plan')
})

test('sidebar search finds body-text mentions (the Arianne case)', async ({ page }) => {
  await seed(page, 'pages/session-notes', '# Session Notes\n\nReviewed Arianne’s taiko beat.')
  await seed(page, 'pages/other-note', '# Other note\n\nNothing relevant here.')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages')
  await page.locator('.pages-side-search').fill('arianne')
  await expect(page.locator('.pages-list .pages-item')).toHaveCount(1)
  await expect(page.locator('.pages-list .pages-item')).toContainText('Session Notes')
})
