// Path-mode toggle in the Library rail: a second tree over folder paths, a
// button that switches to it, and the choice remembered in localStorage.
// The tag tree is untouched — it still opens by default.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function seed(page: Page, path: string, content: string, tags: string[]) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags, metadata: {} },
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

/** The corpus: a nested folder, a sibling folder, and one root-level note. */
async function seedCorpus(page: Page) {
  await seed(page, '_priority/escensus/strategy/one', '# Strat One', ['escensus/strategy'])
  await seed(page, '_priority/escensus/strategy/two', '# Strat Two', [])
  await seed(page, '_priority/escensus/training/three', '# Training Three', [])
  await seed(page, 'health/labs/four', '# Labs Four', ['health'])
  await seed(page, 'loose', '# Loose Note', [])
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('path tree: folders nest, counts roll up, a parent filters its whole subtree', async ({
  page,
}) => {
  await seedCorpus(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/library')

  // Tags is the default — the path tree is not mounted yet.
  await expect(page.getByTestId('tag-tree')).toBeVisible()
  await expect(page.getByTestId('path-tree')).toHaveCount(0)

  await page.getByTestId('rail-mode-paths').click()
  const tree = page.getByTestId('path-tree')
  await expect(tree).toBeVisible()
  await expect(page.getByTestId('tag-tree')).toHaveCount(0)

  // Root folder carries the combined count of everything beneath it.
  const priority = tree.locator('.tag-tree-item', { hasText: '_priority' }).first()
  await expect(priority).toContainText('3')

  // Children stay collapsed until the chevron is clicked.
  await expect(tree.locator('.tag-rail-name', { hasText: 'escensus' })).toHaveCount(0)
  await priority.locator('.tag-tree-chevron').click()
  await tree.locator('.tag-tree-item', { hasText: 'escensus' }).first().locator('.tag-tree-chevron').click()
  await expect(tree.locator('.tag-rail-name', { hasText: 'training' })).toBeVisible()

  // A leaf folder filters to just its notes…
  await tree.locator('.tag-tree-name', { hasText: 'training' }).click()
  await expect(page.locator('.note-row')).toHaveCount(1)
  await expect(page.getByText('Training Three')).toBeVisible()

  // …and a parent folder filters to the whole subtree, not just its own level.
  await tree.locator('.tag-tree-name', { hasText: '_priority' }).first().click()
  await expect(page.locator('.note-row')).toHaveCount(3)
})

test('path tree: a root-level note lands under Unfiled', async ({ page }) => {
  await seedCorpus(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/library')
  await page.getByTestId('rail-mode-paths').click()

  const tree = page.getByTestId('path-tree')
  const unfiled = tree.locator('.tag-tree-item', { hasText: 'Unfiled' }).first()
  await expect(unfiled).toContainText('1')
  await unfiled.locator('.tag-tree-name').click()
  await expect(page.locator('.note-row')).toHaveCount(1)
  await expect(page.getByText('Loose Note')).toBeVisible()
})

test('path tree: the rail filter box flattens matches', async ({ page }) => {
  await seedCorpus(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/library')
  await page.getByTestId('rail-mode-paths').click()

  await page.fill('.tag-rail-search', 'labs')
  const tree = page.getByTestId('path-tree')
  await expect(tree.locator('.tag-rail-item', { hasText: 'health/labs' })).toBeVisible()
  await expect(tree.locator('.tag-rail-item', { hasText: '_priority' })).toHaveCount(0)
})

test('the chosen mode survives a reload, and switching clears the other filter', async ({
  page,
}) => {
  await seedCorpus(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/library')

  // Filter by a tag, then flip to paths — the tag filter must not linger.
  await expect(page.locator('.note-row').first()).toBeVisible()
  const unfiltered = await page.locator('.note-row').count()
  await page.getByTestId('tag-tree').locator('.tag-tree-name', { hasText: 'health' }).first().click()
  await expect(page.locator('.note-row')).toHaveCount(1)
  await expect(page.locator('.browser-count')).toContainText('#health')
  await page.getByTestId('rail-mode-paths').click()
  await expect(page.locator('.note-row')).toHaveCount(unfiltered)
  await expect(page.locator('.browser-count')).not.toContainText('#health')

  // Reload: paths is still the mode, with no second choice to make.
  await page.reload()
  await expect(page.getByTestId('path-tree')).toBeVisible()
  await expect(page.getByTestId('tag-tree')).toHaveCount(0)

  // And back again, also persisted.
  await page.getByTestId('rail-mode-tags').click()
  await page.reload()
  await expect(page.getByTestId('tag-tree')).toBeVisible()
  await expect(page.getByTestId('path-tree')).toHaveCount(0)
})
