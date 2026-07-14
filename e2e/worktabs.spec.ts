// W1 — Work Docs (build log PART 30): Google-Docs-style tabs on desk/ docs,
// and the project world's Docs door.

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
  tags: string[],
  metadata: Record<string, unknown> = {},
) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags, metadata },
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
async function mockNote(page: Page, path: string) {
  const res = await page.request.get(`${MOCK}/api/notes?id=${encodeURIComponent(path)}`, {
    headers: AUTH,
  })
  return res.ok() ? res.json() : null
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('daily note gets the tab rail; ＋ adds a tab (real sub-note) and opens it', async ({ page }) => {
  await seed(page, 'desk/2026-07-12', '# Saturday, July 12\n\nMain thread.', ['desk'], {})
  await seed(page, 'desk/2026-07-12/aaron-neyer', '# Aaron Neyer\n\n- [ ] send videos', ['desk'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('desk/2026-07-12'))
  const rail = page.getByTestId('worktabs')
  await expect(rail).toBeVisible()
  // Root ("Main") + one tab, active state on the root.
  await expect(rail.locator('.worktabs-item')).toHaveCount(2)
  await expect(rail.locator('.worktabs-item.is-active')).toContainText('Saturday')
  await expect(rail).toContainText('Aaron Neyer')

  // Add a tab → creates desk/<date>/<slug>, navigates there, rail updates.
  await page.getByTestId('worktabs-add').click()
  await page.locator('.worktabs-input').fill('UI app')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/desk%2F2026-07-12%2Fui-app/)
  await expect(page.getByTestId('worktabs').locator('.worktabs-item')).toHaveCount(3)
  expect(await mockNote(page, 'desk/2026-07-12/ui-app')).not.toBeNull()

  // Tabs collapse to a sliver and come back.
  await page.locator('.worktabs-hide').click()
  await expect(page.getByTestId('worktabs')).toHaveCount(0)
  await page.getByTestId('worktabs-expand').click()
  await expect(page.getByTestId('worktabs')).toBeVisible()
})

test('world Docs door — create a project work doc, tabbed under desk/<key>', async ({ page }) => {
  await seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x',
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  await page.getByTestId('macro-row').filter({ hasText: 'Amanda' }).click()
  await page.locator('.landing-doors button', { hasText: 'docs' }).click()
  await expect(page.getByTestId('world-docs')).toBeVisible()

  await page.getByTestId('world-new-doc').click()
  await page.locator('.world-new-input').fill('Sprint')
  await page.keyboard.press('Enter')

  // Opens in the editor WITH the tab rail; note lives at desk/amanda/sprint.
  await expect(page).toHaveURL(/desk%2Famanda%2Fsprint/)
  await expect(page.getByTestId('worktabs')).toBeVisible()
  expect(await mockNote(page, 'desk/amanda/sprint')).not.toBeNull()
})
