// Files — the full-screen Finder over vault paths (#/files). Phase 2 of the
// finder-mode spec: breadcrumb, descend, back/forward/up, sorts, grid/list.
//
// THE contract: it is READ-ONLY. Nothing here may write a path. The last test
// asserts that directly — no note's path changes, however much you browse.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function seed(page: Page, path: string, content = '# ' + path) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags: [], metadata: {} },
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
async function allPaths(page: Page): Promise<string[]> {
  const res = await page.request.get(`${MOCK}/api/notes?limit=2000`, { headers: AUTH })
  return ((await res.json()) as { path: string }[]).map((n) => n.path).sort()
}

/** A small vault with real nesting, a second branch, and a root-level note. */
async function seedVault(page: Page) {
  await seed(page, '_priority/escensus/strategy/deal-memo')
  await seed(page, '_priority/escensus/strategy/pricing')
  await seed(page, '_priority/escensus/training/onboarding')
  await seed(page, 'atelier/parachute/ui-ideas/finder-mode')
  await seed(page, 'health/labs/panel-june')
  await seed(page, 'loose-note')
}

async function openFiles(page: Page) {
  await page.goto('http://127.0.0.1:4173/#/files')
  await expect(page.getByTestId('files')).toBeVisible()
  await expect(page.locator('.files-card, .files-row').first()).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('descend by double-click, climb back via the breadcrumb', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  await openFiles(page)

  // Root shows top-level folders, with nested counts.
  const priority = page.locator('.files-card', { hasText: '_priority' })
  await expect(priority).toContainText('3 notes')

  await priority.dblclick()
  await expect(page.getByTestId('files-crumbs')).toContainText('_priority')
  await expect(page.locator('.files-card', { hasText: 'escensus' })).toBeVisible()
  await page.locator('.files-card', { hasText: 'escensus' }).dblclick()
  await page.locator('.files-card', { hasText: 'strategy' }).dblclick()

  // Two notes here, no folders, and the crumb shows where we stand.
  await expect(page.locator('.files-card', { hasText: 'deal-memo' })).toBeVisible()
  await expect(page.getByTestId('files-status')).toContainText('0 folders · 2 notes here')

  // Click a breadcrumb crumb to jump straight back up two levels.
  await page.getByTestId('files-crumbs').getByRole('button', { name: '_priority' }).click()
  await expect(page.locator('.files-card', { hasText: 'escensus' })).toBeVisible()
  await expect(page.getByTestId('files-status')).toContainText('in this branch')
})

test('back, forward and up — including their disabled states', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  await openFiles(page)

  const back = page.getByTestId('files-back')
  const fwd = page.getByTestId('files-forward')
  const up = page.getByTestId('files-up')

  // At the root there is nowhere to go but forward-into.
  await expect(back).toBeDisabled()
  await expect(fwd).toBeDisabled()
  await expect(up).toBeDisabled()

  await page.locator('.files-card', { hasText: 'health' }).dblclick()
  await expect(page.getByTestId('files-crumbs')).toContainText('health')
  await expect(back).toBeEnabled()
  await expect(up).toBeEnabled()

  await back.click()
  await expect(page.getByTestId('files-crumbs')).not.toContainText('health')
  await expect(fwd).toBeEnabled()

  await fwd.click()
  await expect(page.getByTestId('files-crumbs')).toContainText('health')

  await up.click()
  await expect(up).toBeDisabled()
  await expect(page.locator('.files-card', { hasText: '_priority' })).toBeVisible()
})

test('folders always sort before notes, under every sort', async ({ page }) => {
  await seed(page, 'mix/aaa-folder/one')
  await seed(page, 'mix/aaa-folder/two')
  await seed(page, 'mix/zzz-note')
  await seed(page, 'mix/bbb-note')
  await connectViaStorage(page)
  await openFiles(page)
  await page.locator('.files-card', { hasText: 'mix' }).dblclick()

  for (const sortLabel of ['Name', 'Updated', 'Size']) {
    await page.getByTestId('files-sort').getByRole('button', { name: sortLabel }).click()
    const kinds = await page.locator('.files-card').evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-kind')),
    )
    // Every folder must appear before every note — Finder's one law.
    const lastFolder = kinds.lastIndexOf('folder')
    const firstNote = kinds.indexOf('note')
    expect(kinds, `sort=${sortLabel}`).toContain('folder')
    expect(lastFolder, `sort=${sortLabel}`).toBeLessThan(firstNote)
  }
})

test('a root-level note lives in Unfiled and opens from there', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  await openFiles(page)

  const unfiled = page.locator('.files-card', { hasText: 'Unfiled' })
  await expect(unfiled).toContainText('1 note')
  await unfiled.dblclick()

  await expect(page.locator('.files-card', { hasText: 'loose-note' })).toBeVisible()
  await expect(page.getByTestId('files-status')).toContainText('0 folders · 1 note here')

  // Double-click the note → it opens in the reader.
  await page.locator('.files-card', { hasText: 'loose-note' }).dblclick()
  await expect(page).toHaveURL(/#\/note\/loose-note/)
})

test('sort and view are remembered across a reload', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  await openFiles(page)

  await page.getByTestId('files-view').getByRole('button', { name: 'List' }).click()
  await page.getByTestId('files-sort').getByRole('button', { name: 'Size' }).click()
  await expect(page.locator('.files-list-head')).toBeVisible()

  await page.reload()
  await expect(page.getByTestId('files')).toBeVisible()
  // Still list view, still sorted by size — no choice to make twice.
  await expect(page.locator('.files-list-head')).toBeVisible()
  await expect(
    page.getByTestId('files-sort').getByRole('button', { name: 'Size' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('folder counts match the Library rail — one tree, not two', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  await openFiles(page)

  // Files says 3 for _priority (nested, not just direct children)…
  await expect(page.locator('.files-card', { hasText: '_priority' })).toContainText('3 notes')

  // …and so does the Library's path rail, because both call buildPathTree().
  await page.goto('http://127.0.0.1:4173/#/library')
  await page.getByTestId('rail-mode-paths').click()
  await expect(
    page.getByTestId('path-tree').locator('.tag-tree-item', { hasText: '_priority' }).first(),
  ).toContainText('3')
})

test('browsing never writes: every path is untouched afterwards', async ({ page }) => {
  await seedVault(page)
  await connectViaStorage(page)
  const before = await allPaths(page)

  await openFiles(page)
  // Wander: descend, sort, switch view, go back, jump a crumb, open nothing.
  await page.locator('.files-card', { hasText: '_priority' }).dblclick()
  await page.locator('.files-card', { hasText: 'escensus' }).dblclick()
  await page.getByTestId('files-sort').getByRole('button', { name: 'Updated' }).click()
  await page.getByTestId('files-view').getByRole('button', { name: 'List' }).click()
  await page.locator('.files-row', { hasText: 'strategy' }).dblclick()
  await page.getByTestId('files-back').click()
  await page.getByTestId('files-up').click()
  await page.waitForTimeout(800)

  expect(await allPaths(page)).toEqual(before)
})
