// The Shortcuts panel (⌘/) — one source-of-truth keymap (src/lib/keymap.ts)
// rendered in a house modal. Three doors, one panel: the ⌘/ chord, the
// sidebar's "⌨ Shortcuts" row, and the Omnibar's "Keyboard shortcuts"
// command. Also pins the sidebar's "Jump anywhere" affordance to the Omnibar.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
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

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('⌘/ toggles the panel; it shows the keymap; Escape closes it', async ({ page }) => {
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()

  await page.keyboard.press('ControlOrMeta+/')
  const panel = page.getByTestId('shortcuts-panel')
  await expect(panel).toBeVisible()
  // The real keymap renders — the Omnibar chord leads the list.
  await expect(panel).toContainText('⌘K')
  await expect(panel).toContainText('Omnibar')
  await expect(panel).toContainText('⌘⌥1–3')

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('shortcuts-panel')).toHaveCount(0)

  expect(errors, errors.join('\n')).toEqual([])
})

test('the sidebar row (below Disconnect) opens the panel; so does the Omnibar command', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()

  // The footer row is the VERY bottom of the rail — after Disconnect.
  const foot = page.locator('.rail-foot')
  await expect(foot.locator('button').last()).toHaveText(/Shortcuts/)
  await page.getByTestId('shortcuts-open').click()
  await expect(page.getByTestId('shortcuts-panel')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('shortcuts-panel')).toHaveCount(0)

  // Omnibar: ⌘K → "Keyboard shortcuts" opens the same panel.
  await page.keyboard.press('ControlOrMeta+k')
  await page.locator('.palette-input').fill('keyboard shortcuts')
  await page
    .locator('.palette-item[data-group="commands"]', { hasText: 'Keyboard shortcuts' })
    .click()
  await expect(page.getByTestId('shortcuts-panel')).toBeVisible()
})

test('the sidebar "Jump anywhere" affordance opens the Omnibar on click', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()

  await page.locator('.rail-kbd', { hasText: 'Jump anywhere' }).click()
  await expect(page.getByTestId('omnibar')).toBeVisible()
  await expect(page.locator('.palette-input')).toBeFocused()
})
