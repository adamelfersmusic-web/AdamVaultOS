// Explore — the Knowledge Explorer (Atlas · Orbit · Threads). Read-only layer
// over the graphNotes() snapshot: domain-sectioned topic grid, topic pages
// grouped by kind with rel badges, orbit rings that re-center on click, and
// the mode switch persisted in localStorage.

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

/** A small typed-and-linked corpus in the spec's named domains. Wikilinks in
 * the bodies register real edges in the mock (like the live vault), so rel
 * counts and orbit rings come from genuine link data. */
async function seedExplore(page: Page) {
  await seed(
    page,
    'ai/linked-knowledge-llms',
    '# Linked Knowledge\n\nLLMs walk the mycelium instead of searching the pile.\n\nBuilds on [[ai/isenberg-concepts]] and [[atelier/method/frameworks/origin-web]].',
    ['ai', 'concept'],
    { summary: 'How LLMs walk the vault graph.' },
  )
  await seed(
    page,
    'ai/isenberg-concepts',
    '# Isenberg Concepts\n\nThe core concept map.',
    ['ai', 'concept'],
    { summary: 'The Isenberg concept map.' },
  )
  await seed(
    page,
    'ai/context-windows',
    '# Context Windows\n\nUnlinked cousin note — shares both tags.',
    ['ai', 'concept'],
    { summary: 'Why context is the bottleneck.' },
  )
  await seed(
    page,
    'ai/youtube-agentic-os',
    '# Agentic OS Video\n\nSource notes from the video.\n\nSee [[ai/linked-knowledge-llms]].',
    ['ai', 'source-material'],
    { voice: 'source', summary: 'The Agentic OS walkthrough video.' },
  )
  await seed(
    page,
    'people/jack-roberts',
    '# Jack Roberts\n\nBuilt the reference explorer.\n\nWatch [[ai/linked-knowledge-llms]].',
    ['people', 'ai'],
    {},
  )
  await seed(
    page,
    'atelier/method/frameworks/origin-web',
    '# Origin Web\n\nThe origin/thesis web.',
    ['atelier', 'framework'],
    { summary: 'The origin web framework.' },
  )
  await seed(page, 'health/labs/june-panel', '# June Panel\n\nLab numbers.', ['health'], {})
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('rail item opens #/explore; Atlas renders domain sections and topic counts', async ({ page }) => {
  await seedExplore(page)
  await connectViaStorage(page)
  await page.goto('/#/library')

  await page.click('.rail-link:has-text("Explore")')
  await expect(page).toHaveURL(/#\/explore$/)
  await expect(page.getByTestId('atlas')).toBeVisible()

  // Domain sections appear in the fixed world order; elsewhere trails last.
  const domains = await page.locator('.atlas-domain').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-domain')),
  )
  expect(domains).toEqual(['atelier', 'ai', 'people', 'health', 'elsewhere'])

  // Topic cards carry the in-use tag + its note count within the domain.
  const ai = page.locator('.atlas-domain[data-domain="ai"]')
  await expect(ai.locator('.topic-card', { hasText: '#ai' }).first()).toContainText('4 notes')
  await expect(ai.locator('.topic-card', { hasText: '#concept' })).toContainText('3 notes')

  // The seed's Jonathan-shaped corpus (content/scripts…) gathers elsewhere.
  await expect(
    page.locator('.atlas-domain[data-domain="elsewhere"] .topic-card', {
      hasText: '#content/script',
    }),
  ).toBeVisible()
})

test('topic page: kind sections, takeaways, rel badges, related rail, note walk', async ({ page }) => {
  await seedExplore(page)
  await connectViaStorage(page)
  await page.goto('/#/explore')

  await page
    .locator('.atlas-domain[data-domain="ai"] .topic-card', { hasText: '#ai' })
    .first()
    .click()
  await expect(page).toHaveURL(/#\/explore\/tag\/ai$/)
  await expect(page.locator('.topic-head')).toContainText('#ai')
  await expect(page.locator('.topic-head')).toContainText('5 notes')

  // Grouped by kind: concepts / people / sources.
  await expect(
    page.locator('.topic-section[data-kind="concepts"] .explore-card'),
  ).toHaveCount(3)
  await expect(
    page.locator('.topic-section[data-kind="people"] .explore-card', {
      hasText: 'Jack Roberts',
    }),
  ).toBeVisible()
  await expect(
    page.locator('.topic-section[data-kind="sources"] .explore-card', {
      hasText: 'Youtube Agentic Os',
    }),
  ).toBeVisible()

  // Summary takeaway + link-degree badge (2 wikilinks out, 2 in = 4 rel).
  const hub = page.locator('.explore-card', { hasText: 'Linked Knowledge Llms' })
  await expect(hub).toContainText('How LLMs walk the vault graph.')
  await expect(hub.locator('.note-rel')).toHaveText('4 rel')

  // Related rail: tags that co-occur with #ai, hop-able.
  const rail = page.getByTestId('related-rail')
  await expect(rail.locator('.related-item', { hasText: '#concept' })).toContainText('3')
  await expect(rail.locator('.related-item', { hasText: '#source-material' })).toBeVisible()

  // A card click walks into the existing note surface.
  await page
    .locator('.topic-section[data-kind="concepts"] .explore-card', {
      hasText: 'Isenberg Concepts',
    })
    .click()
  await expect(page).toHaveURL(/#\/note\//)
  await expect(page.locator('.note-title')).toHaveText('Isenberg Concepts')
})

test('orbit: seeds the most-linked hub, picker re-centers, ring cards re-center', async ({ page }) => {
  await seedExplore(page)
  await connectViaStorage(page)
  await page.goto('/#/explore')

  await page.click('.explore-modes button:has-text("Orbit")')
  await expect(page.getByTestId('orbit')).toBeVisible()

  // Default center = the vault's biggest hub (the transcript, 8 inbound).
  await expect(page.getByTestId('orbit-center')).toContainText('California Day One')
  await expect(
    page.locator('.orbit-ring[data-ring="cited-by"] .orbit-card'),
  ).toHaveCount(8)

  // The picker re-centers on any note by title search.
  await page.fill('.orbit-picker input', 'linked knowledge')
  await page.click('.orbit-pick-item:has-text("Linked Knowledge")')
  await expect(page.getByTestId('orbit-center')).toContainText('Linked Knowledge Llms')

  // Rings: cites (2 outgoing wikilinks) · cited by (2 inbound) · siblings
  // (shares ai+concept, not already ringed → context-windows).
  await expect(page.locator('.orbit-ring[data-ring="cites"] .orbit-card')).toHaveCount(2)
  const citedBy = page.locator('.orbit-ring[data-ring="cited-by"]')
  await expect(citedBy.locator('.orbit-card')).toHaveCount(2)
  await expect(
    page.locator('.orbit-ring[data-ring="siblings"] .orbit-card'),
  ).toHaveText(['Context Windows'])

  // Clicking an orbiting card RE-CENTERS — we stay in Explore.
  await citedBy.locator('.orbit-card', { hasText: 'Jack Roberts' }).click()
  await expect(page.getByTestId('orbit-center')).toContainText('Jack Roberts')
  await expect(page).toHaveURL(/#\/explore$/)
  // Jack cites the hub we came from.
  await expect(
    page.locator('.orbit-ring[data-ring="cites"] .orbit-card', {
      hasText: 'Linked Knowledge Llms',
    }),
  ).toBeVisible()
})

test('threads: notes grouped by day, domain-labeled; mode persists across reload', async ({ page }) => {
  await seedExplore(page)
  await connectViaStorage(page)
  await page.goto('/#/explore')

  await page.click('.explore-modes button:has-text("Threads")')
  await expect(page.getByTestId('threads')).toBeVisible()

  // Seeded-today notes form the newest day row; the June corpus threads below.
  const firstDay = page.locator('.thread-day').first()
  await expect(firstDay.locator('.thread-card', { hasText: 'Jack Roberts' })).toBeVisible()
  await expect(
    firstDay.locator('.thread-card', { hasText: 'Jack Roberts' }).locator('.thread-card-domain'),
  ).toHaveText('people')
  expect(await page.locator('.thread-day').count()).toBeGreaterThan(1)

  // The chosen mode is remembered (localStorage) across a full reload.
  expect(
    await page.evaluate(() => localStorage.getItem('adamvaultos.explore.mode')),
  ).toBe('threads')
  await page.reload()
  await expect(page.getByTestId('threads')).toBeVisible()
  await expect(
    page.locator('.explore-modes button', { hasText: 'Threads' }),
  ).toHaveClass(/is-active/)
})
