// The ceremonial wing: the Commandments stele + the Map of chambers.
// Hidden routes (no nav tabs) reached via the Omnibar; every Map chamber is
// a real door into the corresponding room of the app.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function seedNote(page: Page, path: string, content: string) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags: ['desk'], metadata: {} },
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

test('the Commandments — ten laws on the stele; Escape leaves the room', async ({ page }) => {
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()

  // Enter through the hash (same as any door) — the stele rises.
  await page.evaluate(() => {
    window.location.hash = '#/commandments'
  })
  const stele = page.getByTestId('commandments')
  await expect(stele).toBeVisible()
  await expect(stele.locator('.cere-laws li')).toHaveCount(10)
  await expect(stele.getByText('The machine proposes. The human decides.')).toBeVisible()

  // Escape returns to wherever you were.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('cockpit')).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

test('the Map — chambers are real doors; monuments cross-link', async ({ page }) => {
  await seedNote(page, 'desk/00-plan', '# The Plan\n\nOne door.')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/map')
  const map = page.getByTestId('vault-map')
  await expect(map).toBeVisible()

  // The Mirror sleeps — it is a chamber, not a door.
  await expect(page.getByTestId('chamber-mirror')).toBeVisible()
  expect(
    await page.getByTestId('chamber-mirror').evaluate((el) => el.tagName.toLowerCase()),
  ).toBe('div')

  // The Tracker chamber opens the real Tracker…
  await page.getByTestId('chamber-tracker').click()
  await expect(page.getByTestId('db-views')).toBeVisible()

  // …and the Plan chamber opens the real Plan note.
  await page.goto('http://127.0.0.1:4173/#/map')
  await page.getByTestId('chamber-plan').click()
  await expect(page).toHaveURL(/note\/desk%2F00-plan/)

  // The two monuments point at each other.
  await page.goto('http://127.0.0.1:4173/#/map')
  await page.getByRole('button', { name: 'the commandments →' }).click()
  await expect(page.getByTestId('commandments')).toBeVisible()
  await page.getByRole('button', { name: 'the map →' }).click()
  await expect(page.getByTestId('vault-map')).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

test('the gate — the bare address greets with the Map; deep links sail past; a chamber lets you in', async ({ page }) => {
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // The bare address is the threshold: the Map greets the arrival.
  await page.goto('http://127.0.0.1:4173/')
  await expect(page.getByTestId('vault-map')).toBeVisible()

  // From the gate, a chamber is a real door — the Tracker chamber enters it.
  await page.getByTestId('chamber-tracker').click()
  await expect(page.getByTestId('db-views')).toBeVisible()
  await expect(page.getByTestId('vault-map')).toHaveCount(0)

  // A REAL hash sails straight past the gate — no Map flash on deep links.
  await page.goto('http://127.0.0.1:4173/#/tracker')
  await expect(page.getByTestId('db-views')).toBeVisible()
  await expect(page.getByTestId('vault-map')).toHaveCount(0)

  expect(errors, errors.join('\n')).toEqual([])
})

test('the gem door — tapping the wordmark gem opens the Map; the text still opens Projects', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()

  // The gem is its own button onto the Map…
  await page.getByTestId('wordmark-gem').click()
  await expect(page.getByTestId('vault-map')).toBeVisible()

  // …and the wordmark text keeps navigating to Projects (from a shell route).
  await page.goto('http://127.0.0.1:4173/#/tracker')
  await page.locator('.wordmark-link').click()
  await expect(page.getByTestId('cockpit')).toBeVisible()
})

test('the sky — the Map wears the constellation from pages/knowledge-graph, as a whisper', async ({ page }) => {
  // The vault controls the sky: the note's first storage image becomes the
  // Map's backdrop (auth-safe blob), at whisper opacity.
  await seedNote(
    page,
    'pages/knowledge-graph',
    '# Knowledge Graph\n\n<img src="/api/storage/2026-07-14/constellation.png" alt="sky" width="820">\n',
  )
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/map')
  await expect(page.getByTestId('vault-map')).toBeVisible()
  const sky = page.getByTestId('map-sky')
  await expect(sky).toBeAttached()
  await expect
    .poll(async () => sky.evaluate((el) => (el as HTMLElement).style.backgroundImage))
    .toContain('blob:')

  // The whisper law: hardly visible, never interactive.
  const style = await sky.evaluate((el) => {
    const cs = getComputedStyle(el as HTMLElement)
    return { opacity: Number(cs.opacity), pointerEvents: cs.pointerEvents }
  })
  expect(style.opacity).toBeLessThanOrEqual(0.1)
  expect(style.pointerEvents).toBe('none')

  expect(errors, errors.join('\n')).toEqual([])
})

test('the sky — no note, no sky: the void alone, no errors', async ({ page }) => {
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/map')
  await expect(page.getByTestId('vault-map')).toBeVisible()
  await expect(page.getByTestId('chamber-vault')).toBeVisible()
  await expect(page.getByTestId('map-sky')).toHaveCount(0)

  expect(errors, errors.join('\n')).toEqual([])
})

test('enter the vault — both monuments carry the gem door onto the Cockpit', async ({ page }) => {
  await connectViaStorage(page)

  // From the stele…
  await page.goto('http://127.0.0.1:4173/#/commandments')
  await expect(page.getByTestId('commandments')).toBeVisible()
  await page.getByTestId('enter-vault').click()
  await expect(page.getByTestId('cockpit')).toBeVisible()

  // …and from the Map (the gate's own explicit way in).
  await page.goto('http://127.0.0.1:4173/#/map')
  await expect(page.getByTestId('vault-map')).toBeVisible()
  await page.getByTestId('enter-vault').click()
  await expect(page.getByTestId('cockpit')).toBeVisible()
})

test('the Omnibar knows the wing — ⌘K → "commandments" enters the room', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()

  await page.keyboard.press('ControlOrMeta+k')
  const input = page.locator('.palette-input')
  await expect(input).toBeVisible()
  await input.fill('commandments')
  await page
    .locator('.palette-item', { hasText: 'The Commandments — the laws of the vault' })
    .click()
  await expect(page.getByTestId('commandments')).toBeVisible()

  // And the Omnibar still opens INSIDE the wing (the doors never lock).
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.locator('.palette-input')).toBeVisible()
  await page.locator('.palette-input').fill('map — chambers')
  await page.locator('.palette-item', { hasText: 'The Map — chambers of the vault' }).click()
  await expect(page.getByTestId('vault-map')).toBeVisible()
})
