// L2 — light mode (build log PART 30): the latte theme. One attribute on
// <html>, persisted in localStorage, toggled from the rail and from Pages.

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

test('rail toggle flips to latte, persists across reload, flips back', async ({ page }) => {
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()

  const html = page.locator('html')
  await expect(html).not.toHaveAttribute('data-theme', 'light')

  // Flip to light — attribute lands, background actually goes cream.
  await page.getByTestId('theme-toggle').click()
  await expect(html).toHaveAttribute('data-theme', 'light')
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
  )
  expect(bg).toBe('#f6f1e7')

  // Survives a reload (initTheme runs before first paint).
  await page.reload()
  await expect(page.getByTestId('cockpit')).toBeVisible()
  await expect(html).toHaveAttribute('data-theme', 'light')

  // And flips back to dark.
  await page.getByTestId('theme-toggle').click()
  await expect(html).not.toHaveAttribute('data-theme', 'light')

  expect(errors, errors.join('\n')).toEqual([])
})

test('Pages has its own toggle (the rail is hidden there)', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages')
  await expect(page.getByTestId('pages')).toBeVisible()

  await page.getByTestId('theme-toggle-pages').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByTestId('theme-toggle-pages').click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light')
})
