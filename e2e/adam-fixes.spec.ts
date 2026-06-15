// Acceptance tests for the AdamVaultOS fix passes.
//   Fix 1   — slashed note paths (Amanda/00-home) open in the block editor.
//   Fix 2/3 — rebranded to "Adam · Vault OS"; Scripts removed from the rail.
//   Fix 4   — Library loads far more than the old 60-note cap.
//   Bug 1   — OAuth round-trip signs in without a blank crash; errors are readable.
//   Bug 2/3 — never inherits AtelierVaultOS's session from the shared origin.
//
// Runs against the mock vault + hub (started by playwright.config webServer).

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

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

/** Pre-authorize via the app's OWN namespaced session key (token mode). */
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

test('Fix 1 — a slashed note path opens in the block editor and edits persist', async ({
  page,
}) => {
  await seedNote(page, AMANDA_PATH, AMANDA_CONTENT, ['amanda'])
  await connectViaStorage(page)

  await page.goto('/#/pages')
  await expect(page.getByTestId('pages')).toBeVisible()

  const item = page.locator('.pages-item', { hasText: '00 Home' })
  await expect(item).toBeVisible()
  await item.click()

  await expect(page).toHaveURL(/#\/pages\/Amanda(%2F|\/)00-home$/)

  const prose = page.locator('.page-prose')
  await expect(prose).toBeVisible()
  await expect(prose.locator('h1')).toHaveText(/Amanda Bridges — Home/)
  await expect(prose).not.toContainText('# Amanda Bridges')

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

  await expect(page.locator('.wordmark-text')).toContainText('Adam')
  await expect(page.locator('.wordmark-text')).not.toContainText('Atelier')

  await expect(page.locator('.rail-link', { hasText: 'Scripts' })).toHaveCount(0)
  await expect(page.getByText('New script')).toHaveCount(0)
  await expect(page.locator('.rail-link', { hasText: 'Pages' })).toHaveCount(1)
  await expect(page.locator('.rail-link', { hasText: 'Library' })).toHaveCount(1)
})

test('Fix 4 — Library loads well past the old 60-note cap', async ({ page }) => {
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

test('Bug 2/3 — does not inherit AtelierVaultOS’s session from the shared origin', async ({
  page,
}) => {
  // Simulate AtelierVaultOS having saved a Jonathan session under its (shared,
  // same-origin) "atelier.*" keys BEFORE AdamVaultOS loads.
  await page.addInitScript(() => {
    localStorage.setItem(
      'atelier.session.v1',
      JSON.stringify({
        vaultUrl: 'https://friends.parachute.computer/vault/jonathan',
        mode: 'token',
        token: { accessToken: 'jonathan-token' },
      }),
    )
    localStorage.setItem(
      'atelier.lastVaultUrl',
      'https://friends.parachute.computer/vault/jonathan',
    )
  })

  await page.goto('/')

  // AdamVaultOS must ignore the foreign keys: not signed in, lands on Connect.
  await expect(page).toHaveURL(/#\/connect/)
  // …and the vault field defaults to the adam vault, never jonathan's.
  await expect(page.locator('input[name="vault-url"]')).toHaveValue(/vault\/adam$/)
  // No Jonathan vault data leaks in anywhere.
  await expect(page.getByText('The Fake Map')).toHaveCount(0)
})

test('Bug 1 — OAuth round-trip signs in without a blank crash', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/#\/connect/)
  await page.fill('input[name="vault-url"]', MOCK)
  await page.getByTestId('connect-oauth').click()
  await page.waitForURL(/oauth\/authorize/)
  await page.click('#approve')

  // Back in the app, signed in: the rail + Library render (not blank, not connect).
  await expect(page.locator('.rail')).toBeVisible()
  await expect(page).not.toHaveURL(/#\/connect/)
  await expect(page.locator('.lib-row').first()).toBeVisible()

  // Session persisted under the namespaced key; the shared atelier key is untouched.
  const session = await page.evaluate((k) => localStorage.getItem(k), SESSION_KEY)
  expect(session).toContain('"mode":"oauth"')
  const foreign = await page.evaluate(() => localStorage.getItem('atelier.session.v1'))
  expect(foreign).toBeNull()
})

test('Bug 1 — a hub-denied sign-in shows a readable error, not a blank page', async ({
  page,
}) => {
  await page.goto('/?error=access_denied&error_description=You+cancelled+the+sign-in')
  await expect(page.locator('.connect-error')).toContainText('You cancelled the sign-in')
  // The crash-proof shell stayed mounted (connect card present, not a blank body).
  await expect(page.locator('.connect-card')).toBeVisible()
})
