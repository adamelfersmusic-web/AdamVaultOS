// Acceptance tests for the AdamVaultOS post-Tier-1 fix pass.
//   Fix 1 — slashed note paths (Amanda/00-home) open in the block editor.
//   Fix 2 — rebranded to "Adam · Vault OS" (no "Atelier" / "Scripts" wordmark).
//   Fix 3 — Scripts removed from the rail nav.
//   Fix 4 — Library loads far more than the old 60-note cap.
//
// Runs against the mock vault (started by playwright.config webServer).

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }

const AMANDA_PATH = 'Amanda/00-home'
const AMANDA_CONTENT = `# Amanda Bridges — Home
*Front door for the Amanda project. Orientation + link index.*

## Who She Is
Amanda Bridges — healing folk artist and Certified Recovery Peer Advocate, Buffalo NY.

## The Notes
- [[Amanda/01-campaign-overview]] — goal, two engines, phases
- [[Amanda/02-work-log]] — the living tracker
`

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}

async function seedNote(page: Page, path: string, content: string, tags: string[] = []) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags, metadata: {} },
  })
  expect(res.status(), await res.text()).toBe(201)
}

/** Pre-authorize the app by seeding localStorage before any script runs. */
async function connectViaStorage(page: Page) {
  await page.addInitScript(
    ([url, token]) => {
      localStorage.setItem('atelier.vault', JSON.stringify({ url, token }))
    },
    [MOCK, TOKEN] as const,
  )
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Fix 1 — a slashed note path opens in the block editor and edits persist', async ({
  page,
}) => {
  await seedNote(page, AMANDA_PATH, AMANDA_CONTENT, ['amanda'])
  await connectViaStorage(page)

  await page.goto('/#/pages')
  await expect(page.getByTestId('pages')).toBeVisible()

  // The widened sidebar lists real notes; Amanda/00-home → title "00 Home".
  const item = page.locator('.pages-item', { hasText: '00 Home' })
  await expect(item).toBeVisible()
  await item.click()

  // Fix 1: the slashed path survives the hash router (single %2F segment).
  await expect(page).toHaveURL(/#\/pages\/Amanda(%2F|\/)00-home$/)

  // The block editor opened and rendered the note as BLOCKS, not raw markdown.
  const prose = page.locator('.page-prose')
  await expect(prose).toBeVisible()
  await expect(prose.locator('h1')).toHaveText(/Amanda Bridges — Home/)
  await expect(prose).not.toContainText('# Amanda Bridges') // no literal '#'

  // Edit a word and confirm it saves back to the vault under the slashed path.
  await prose.locator('h1').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' EDITED')
  await expect(page.getByTestId('page-save')).toHaveText(/Saved/, { timeout: 10_000 })

  const saved = await page.request.get(
    `${MOCK}/__test/note?path=${encodeURIComponent(AMANDA_PATH)}`,
  )
  expect(saved.ok()).toBeTruthy()
  expect((await saved.json()).content).toContain('Amanda Bridges — Home EDITED')
})

test('Fix 2 + 3 — rebranded to Adam, Scripts removed from the rail', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('/#/library')

  // Rail wordmark says Adam, never Atelier.
  await expect(page.locator('.wordmark-text')).toContainText('Adam')
  await expect(page.locator('.wordmark-text')).not.toContainText('Atelier')

  // Scripts is gone from the nav; Pages / Graph / Library remain.
  await expect(page.locator('.rail-link', { hasText: 'Scripts' })).toHaveCount(0)
  await expect(page.getByText('New script')).toHaveCount(0)
  await expect(page.locator('.rail-link', { hasText: 'Pages' })).toHaveCount(1)
  await expect(page.locator('.rail-link', { hasText: 'Library' })).toHaveCount(1)
})

test('Fix 4 — Library loads well past the old 60-note cap', async ({ page }) => {
  // Seed 70 extra notes so the total clears the previous hardcoded limit of 60.
  await Promise.all(
    Array.from({ length: 70 }, (_, i) =>
      seedNote(page, `bulk/note-${String(i).padStart(3, '0')}`, `# Bulk ${i}\n`),
    ),
  )
  await connectViaStorage(page)
  await page.goto('/#/library')

  await expect(page.locator('.lib-row').first()).toBeVisible()
  const rows = await page.locator('.lib-row').count()
  expect(rows).toBeGreaterThan(60)
})
