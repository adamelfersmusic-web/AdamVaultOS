// AUTH RESILIENCE DROP — multi-tab token rotation must never kill the session,
// and a dead session must never cost typed work.
//
//   (a) adopt-from-storage: a 401 on the old token adopts the newer token
//       another tab persisted, replays, and succeeds — no banner.
//   (b) dead session: saves 401 persistently and refresh fails → the typed
//       buffer is stashed to adamvaultos.draft.<path> and the calm banner shows.
//   (c) draft restore: a seeded stash offers Restore on mount; Restore fills
//       the editor and the normal save flow clears the stash.
//   (d) regression: the happy-path save still works, no banner, no stash.
//
// Mock-only (drives the mock's control plane), skipped in REAL_VAULT mode.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'
const PAGE_PATH = 'pages/resilience'
const DRAFT_KEY = `adamvaultos.draft.${PAGE_PATH}`

test.skip(Boolean(process.env.REAL_VAULT), 'mock-only auth-resilience suite')

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}

async function control(page: Page, data: Record<string, unknown>) {
  const res = await page.request.post(`${MOCK}/__test/oauth`, { data })
  expect(res.ok()).toBeTruthy()
}

async function apiRequests(page: Page): Promise<Array<{ method: string; path: string; token: string }>> {
  const res = await page.request.get(`${MOCK}/__test/requests`)
  return res.json()
}

async function mockNote(page: Page, path: string) {
  const res = await page.request.get(
    `${MOCK}/__test/note?path=${encodeURIComponent(path)}`,
  )
  expect(res.ok()).toBeTruthy()
  return res.json()
}

async function seed(page: Page, path: string, content: string) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags: [], metadata: {} },
  })
  expect(res.status(), await res.text()).toBe(201)
}

async function connectViaStorage(page: Page, token = TOKEN) {
  await page.addInitScript(
    ([key, url, tok]) => {
      localStorage.setItem(
        key,
        JSON.stringify({ vaultUrl: url, mode: 'token', token: { accessToken: tok } }),
      )
    },
    [SESSION_KEY, MOCK, token] as const,
  )
}

/** The full OAuth dance (same journey oauth.spec.ts drives). */
async function signInWithOAuth(page: Page) {
  await page.goto('/')
  await expect(page).toHaveURL(/#\/connect/)
  await page.fill('input[name="vault-url"]', MOCK)
  await page.getByTestId('connect-oauth').click()
  await page.waitForURL(/oauth\/authorize/)
  await page.click('#approve')
  await expect(page.getByTestId('cockpit')).toBeVisible()
}

async function openResiliencePage(page: Page) {
  await page.goto(`/#/pages/${encodeURIComponent(PAGE_PATH)}`)
  await expect(page.locator('.page-prose p')).toContainText('Body.')
}

test.beforeEach(async ({ page }) => {
  await reset(page)
  await seed(page, PAGE_PATH, '# Resilience\n\nBody.')
})

test('adopt-from-storage: a sibling tab’s newer token is adopted on 401 — save succeeds, no banner', async ({ page }) => {
  await control(page, { addToken: 'tab-old-token' })
  await control(page, { addToken: 'tab-new-token' })
  await connectViaStorage(page, 'tab-old-token')
  await openResiliencePage(page)

  // Another tab refreshed: the hub revoked our token and the persisted
  // session now carries the newer one. This tab's memory is stale.
  await control(page, { revokeToken: 'tab-old-token', clearLog: true })
  await page.evaluate(
    ([key, url]) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          vaultUrl: url,
          mode: 'token',
          token: { accessToken: 'tab-new-token' },
        }),
      )
    },
    [SESSION_KEY, MOCK] as const,
  )

  // Type — the debounced save 401s on the old token, adopts, replays, lands.
  await page.locator('.page-prose p').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' adopted across tabs')
  await expect(page.getByTestId('page-save')).toContainText('Saved', { timeout: 8000 })

  // The write really landed, and the replay carried the newer token.
  const note = await mockNote(page, PAGE_PATH)
  expect(note.content).toContain('adopted across tabs')
  const patches = (await apiRequests(page)).filter((r) => r.method === 'PATCH')
  expect(patches.some((r) => r.token === 'tab-old-token')).toBe(true) // the 401'd attempt
  expect(patches[patches.length - 1]!.token).toBe('tab-new-token') // the replay
  // No death was declared — the banner never appeared.
  await expect(page.getByTestId('auth-banner')).toHaveCount(0)
})

test('dead session: the typed buffer is stashed locally and the calm banner appears', async ({ page }) => {
  await signInWithOAuth(page)
  await openResiliencePage(page)

  // The hub revokes the whole token family: access dead, refresh dead.
  const state = await (await page.request.get(`${MOCK}/__test/oauth-state`)).json()
  for (const t of state.validAccessTokens as string[]) {
    await control(page, { revokeToken: t })
  }
  await control(page, { refreshDisabled: true })

  await page.locator('.page-prose p').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' words that must not die')

  // The banner appears (top of the content area, not a toast) and the buffer
  // is parked in localStorage under the draft key.
  const banner = page.getByTestId('auth-banner')
  await expect(banner).toBeVisible({ timeout: 10_000 })
  await expect(banner).toContainText('Session expired — your work is safe locally.')
  await expect(page.getByTestId('auth-reconnect')).toBeVisible()

  const raw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)
  expect(raw).toBeTruthy()
  const stash = JSON.parse(raw!)
  expect(stash.content).toContain('words that must not die')
  expect(stash.stashedAt).toBeTruthy()
  expect(stash.baseUpdatedAt).toBeTruthy()
})

test('draft restore: a stash is offered on mount; Restore fills the editor; a save clears it', async ({ page }) => {
  await connectViaStorage(page)
  await page.addInitScript(
    ([key]) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          content: '# Resilience\n\nBody. Recovered gold.',
          stashedAt: new Date().toISOString(),
          baseUpdatedAt: new Date().toISOString(),
        }),
      )
    },
    [DRAFT_KEY] as const,
  )
  await openResiliencePage(page)

  const bar = page.getByTestId('draft-restore')
  await expect(bar).toBeVisible()
  await expect(bar).toContainText('Recovered unsaved draft')

  await bar.getByRole('button', { name: 'Restore' }).click()
  await expect(page.locator('.page-prose')).toContainText('Recovered gold')

  // Dirty buffer → normal save flow → stash cleared on success.
  await expect(page.getByTestId('page-save')).toContainText('Saved', { timeout: 8000 })
  const note = await mockNote(page, PAGE_PATH)
  expect(note.content).toContain('Recovered gold')
  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull()
})

test('draft restore: a stash matching the live content is silently dropped', async ({ page }) => {
  await connectViaStorage(page)
  await page.addInitScript(
    ([key]) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          content: '# Resilience\n\nBody.', // identical — it got saved after all
          stashedAt: new Date().toISOString(),
          baseUpdatedAt: new Date().toISOString(),
        }),
      )
    },
    [DRAFT_KEY] as const,
  )
  await openResiliencePage(page)

  await expect(page.getByTestId('draft-restore')).toHaveCount(0)
  await expect
    .poll(() => page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY))
    .toBeNull()
})

test('regression: the happy-path save still works — no banner, no stash', async ({ page }) => {
  await connectViaStorage(page)
  await openResiliencePage(page)

  await page.locator('.page-prose p').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' plain sailing')
  await expect(page.getByTestId('page-save')).toContainText('Saved', { timeout: 8000 })

  const note = await mockNote(page, PAGE_PATH)
  expect(note.content).toContain('plain sailing')
  await expect(page.getByTestId('auth-banner')).toHaveCount(0)
  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull()
})
