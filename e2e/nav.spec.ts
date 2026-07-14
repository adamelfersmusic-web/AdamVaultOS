// Navigation drop (build log PART 20): N4 hierarchical tag tree in the
// Library rail, N3 Pages sidebar browser (search + Recent + visual folders),
// and the Cockpit's + New project (capped at 6 — Adam's rule).

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

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('N4 — tag tree: nested tags drill down; parent filter includes descendants', async ({ page }) => {
  await seed(page, 'esc/one', '# Esc One', ['escensus'], {})
  await seed(page, 'esc/two', '# Esc Two', ['escensus/strategy'], {})
  await seed(page, 'esc/three', '# Esc Three', ['escensus/engine'], {})
  await seed(page, 'health/one', '# Health One', ['health'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/library')
  const tree = page.getByTestId('tag-tree')
  await expect(tree).toBeVisible()

  // Parent shows the COMBINED count (self + descendants) and a chevron.
  const escRow = tree.locator('.tag-tree-item', { hasText: '#escensus' }).first()
  await expect(escRow).toContainText('3')
  // Children are collapsed until expanded.
  await expect(tree.getByText('#strategy')).toHaveCount(0)
  await escRow.locator('.tag-tree-chevron').click()
  await expect(tree.locator('.tag-rail-name', { hasText: 'strategy' })).toBeVisible()

  // Child click filters to just that branch…
  await tree.locator('.tag-tree-name', { hasText: 'strategy' }).click()
  await expect(page.locator('.note-row')).toHaveCount(1)
  await expect(page.getByText('Esc Two')).toBeVisible()

  // …parent click filters to the whole subtree (3 notes, not 1).
  await tree.locator('.tag-tree-name', { hasText: '#escensus' }).first().click()
  await expect(page.locator('.note-row')).toHaveCount(3)

  // The rail's own filter box flattens matches.
  await page.fill('.tag-rail-search', 'engi')
  await expect(tree.locator('.tag-rail-item', { hasText: '#escensus/engine' })).toBeVisible()
})

test('N3 — Pages sidebar: search, Recent, and collapsible visual folders', async ({ page }) => {
  await seed(page, 'Amanda/00-home', '# Amanda Home', ['amanda'], {})
  await seed(page, 'Amanda/02-work-log', '# Work Log', ['amanda'], {})
  await seed(page, 'Atelier/sop', '# Atelier SOP', [], {})
  await seed(page, 'pages/reel-ideas', '# Reel Ideas', ['type/page'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages')
  await expect(page.getByTestId('pages')).toBeVisible()

  // Recent section exists; folders render collapsed with counts.
  await expect(page.locator('.pages-section-label', { hasText: 'Recent' })).toBeVisible()
  const amandaGroup = page.locator('.pages-group-head', { hasText: 'Amanda' })
  await expect(amandaGroup).toContainText('2')
  // Expanding a folder reveals its docs (indented copies).
  await amandaGroup.click()
  await expect(page.locator('.pages-item-indent', { hasText: 'Work Log' })).toBeVisible()

  // Search flattens to matches only.
  await page.fill('.pages-side-search', 'reel')
  await expect(page.locator('.pages-item', { hasText: 'Reel Ideas' })).toBeVisible()
  await expect(page.locator('.pages-item', { hasText: 'Atelier SOP' })).toHaveCount(0)
})

test('N5 — fullscreen editor scrolls (long doc reachable below the fold)', async ({ page }) => {
  const long = '# Long Doc\n\n' + Array.from({ length: 120 }, (_, i) => `Paragraph ${i + 1}.`).join('\n\n')
  await seed(page, 'pages/long-doc', long, ['type/page'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/long-doc'))
  await expect(page.locator('.page-prose')).toContainText('Paragraph 1.')

  await page.locator('.page-tool[title^="Fullscreen"]').click()
  const state = await page.evaluate(() => {
    const el = document.querySelector('.page-editor') as HTMLElement
    const isFs = document.fullscreenElement === el
    el.scrollTop = 500
    return { isFs, scrolled: el.scrollTop }
  })
  expect(state.isFs).toBe(true)
  expect(state.scrolled).toBeGreaterThan(0) // the fullscreened editor scrolls itself
})

test('Cockpit — + New project creates a card; the deck caps at 6', async ({ page }) => {
  for (let i = 1; i <= 5; i++) {
    await seed(page, `projects/p${i}`, `# Project ${i}`, ['project'], {
      key: `p${i}`, tag: `p${i}`, status: 'active', order: i, summary: `Project ${i}.`,
    })
  }
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  await expect(page.getByTestId('macro-row')).toHaveCount(5)

  // Create #6 → lands inside the new world.
  await page.getByTestId('new-project').click()
  await page.locator('.cockpit-actions .world-new-input').fill('Big Thing Six')
  await page.locator('.cockpit-actions .btn-gold').click()
  await expect(page.getByTestId('world')).toBeVisible()
  await expect(page.locator('.world-title')).toHaveText('Big Thing Six')

  // Back at the strip: 6 rows, and the button is now capped.
  await page.locator('.canvas-back').click()
  await expect(page.getByTestId('macro-row')).toHaveCount(6)
  await expect(page.getByTestId('new-project')).toBeDisabled()
  await expect(page.getByText('6 of 6 — a full deck')).toBeVisible()
})
