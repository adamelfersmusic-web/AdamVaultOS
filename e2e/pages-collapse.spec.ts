// Pages sidebar collapse: down to a bare dark sliver — just "◇ Pages" at the
// top so you know where you are. Persisted across reloads.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

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
  await page.request.post(`${MOCK}/__test/reset`)
})

test('sidebar collapses to the wordmark sliver, persists, expands back', async ({ page }) => {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path: 'pages/quiet-doc', content: '# Quiet doc\n\nBody.', tags: [], metadata: {} },
  })
  expect(res.status(), await res.text()).toBe(201)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/quiet-doc'))
  const side = page.locator('.pages-sidebar')
  await expect(side.locator('.pages-list')).toBeVisible()

  // Collapse: list, search, and New page all go; the wordmark stays.
  await page.getByTestId('pages-side-collapse').click()
  await expect(side).toHaveClass(/is-collapsed/)
  await expect(side.locator('.pages-list')).toHaveCount(0)
  await expect(side.locator('.pages-new')).toHaveCount(0)
  await expect(side.locator('.pages-wordmark')).toBeVisible()
  // The editor is untouched.
  await expect(page.locator('.page-prose')).toContainText('Quiet doc')

  // Survives a reload.
  await page.reload()
  await expect(page.locator('.pages-sidebar')).toHaveClass(/is-collapsed/)

  // Expands back to the full browser.
  await page.getByTestId('pages-side-expand').click()
  await expect(page.locator('.pages-sidebar')).not.toHaveClass(/is-collapsed/)
  await expect(page.locator('.pages-list')).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})
