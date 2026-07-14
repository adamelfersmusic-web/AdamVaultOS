// THE OMNIBAR (⌘K) — one bar, whole vault. Covers: open/close/toggle, ranked
// notes with marked snippets, the operator grammar (tag:/path:/is:/when:/
// done:/"phrase"), commands surviving the palette absorption, task/tag rows
// navigating, the Ask-the-vault handoff (Anthropic mocked, like askai.spec),
// the edit-distance-1 typo net, and the recents-backed zero state.

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
  tags: string[] = [],
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
      localStorage.setItem('adamvaultos.anthropicKey', 'sk-test-key')
    },
    [SESSION_KEY, MOCK, TOKEN] as const,
  )
}

async function mockNote(page: Page, path: string) {
  const res = await page.request.get(
    `${MOCK}/api/notes?id=${encodeURIComponent(path)}`,
    { headers: AUTH },
  )
  return res.ok()
    ? ((await res.json()) as { path: string; tags?: string[] })
    : null
}

/** The house vault: a strong-title note, a body-only match, tasks, a world. */
async function seedVault(page: Page) {
  await seed(
    page,
    'escensus/scoring-engine',
    '# Canonical Scoring Engine\n\nThe canonical scoring engine ranks every fighter by output.',
    ['escensus/engine'],
  )
  await seed(
    page,
    'notes/random-thoughts',
    '# Random Thoughts\n\nSomewhere in here a scoring engine idea is buried mid-sentence.',
    [],
  )
  await seed(
    page,
    'notes/golden',
    '# Golden\n\nthe exact golden phrase lives here, verbatim.',
    [],
  )
  await seed(
    page,
    'notes/scattered',
    '# Scattered\n\ngolden words but the phrase is elsewhere entirely.',
    [],
  )
  await seed(page, 'projects/escensus', '# Escensus', ['project'], {
    key: 'escensus',
    tag: 'escensus',
    status: 'active',
    order: 1,
    summary: 'The engine world.',
  })
  await seed(page, 'tasks/escensus/ship-the-scoring-demo', 'Ship the scoring demo', ['task'], {
    project: 'escensus',
    state: 'active',
    done: false,
    when: 'this-week',
  })
  await seed(page, 'tasks/escensus/polish-landing', 'Polish landing page', ['task'], {
    project: 'escensus',
    state: 'next',
    done: false,
    when: 'today',
  })
  await seed(page, 'tasks/escensus/old-done-chore', 'Old done scoring chore', ['task'], {
    project: 'escensus',
    state: 'done',
    done: true,
  })
}

async function openBar(page: Page) {
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByTestId('omnibar')).toBeVisible()
}

function sse(events: unknown[]): string {
  return events
    .map((e) => `event: x\ndata: ${JSON.stringify(e)}\n`)
    .join('\n')
    .concat('\n')
}

/** Intercept api.anthropic.com and stream a canned answer (as askai.spec). */
async function mockAnthropic(page: Page, answer: string, captured: unknown[]) {
  await page.route('https://api.anthropic.com/**', async (route) => {
    captured.push(route.request().postDataJSON())
    const body = sse([
      { type: 'message_start', message: { id: 'msg_test' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      ...answer.split(/(?<= )/).map((chunk) => ({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: chunk },
      })),
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
      { type: 'message_stop' },
    ])
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body })
  })
}

test.beforeEach(async ({ page }) => {
  await reset(page)
  await seedVault(page)
  await connectViaStorage(page)
})

test('⌘K opens; typing ranks the titled note first with a marked snippet', async ({ page }) => {
  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
  await openBar(page)

  await page.fill('.palette-input', 'scoring engine')

  const noteRows = page.locator('.palette-item[data-group="notes"]')
  // The note NAMED "Canonical Scoring Engine" outranks the body-only match…
  await expect(noteRows.first()).toContainText('Canonical Scoring Engine')
  // …and the weaker body match still shows, below it.
  await expect(noteRows.nth(1)).toContainText('Random Thoughts')

  // Snippet: best-matching body line, query terms wrapped in <mark>.
  await expect(noteRows.first().locator('.omni-snippet')).toContainText('ranks every fighter')
  await expect(
    noteRows.first().locator('.omni-snippet mark', { hasText: /scoring/i }).first(),
  ).toBeVisible()

  // The Ask row is ALWAYS the last row when a query is present.
  await expect(page.getByTestId('omnibar-ask')).toContainText('scoring engine')
})

test('operators: tag: scopes, is:task when: filters, quoted phrase is verbatim', async ({
  page,
}) => {
  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
  await openBar(page)

  // tag:escensus (hierarchical — matches escensus/engine too).
  await page.fill('.palette-input', 'tag:escensus engine')
  const noteRows = page.locator('.palette-item[data-group="notes"]')
  await expect(noteRows.first()).toContainText('Canonical Scoring Engine')
  await expect(
    page.locator('.palette-item', { hasText: 'Random Thoughts' }),
  ).toHaveCount(0)

  // is:task when:this-week — only that task, no notes group at all.
  await page.fill('.palette-input', 'is:task when:this-week')
  const taskRows = page.locator('.palette-item[data-group="tasks"]')
  await expect(taskRows).toHaveCount(1)
  await expect(taskRows.first()).toContainText('Ship the scoring demo')
  await expect(page.locator('.palette-item[data-group="notes"]')).toHaveCount(0)

  // done:true resurfaces finished work.
  await page.fill('.palette-input', 'is:task done:true')
  await expect(taskRows).toHaveCount(1)
  await expect(taskRows.first()).toContainText('Old done scoring chore')

  // "exact phrase" must appear verbatim — the scattered note is excluded.
  await page.fill('.palette-input', '"golden phrase"')
  await expect(page.locator('.palette-item', { hasText: 'Golden' }).first()).toBeVisible()
  await expect(page.locator('.palette-item', { hasText: 'Scattered' })).toHaveCount(0)
})

test('commands survive the absorption: New page runs from the bar', async ({ page }) => {
  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
  await openBar(page)

  await page.fill('.palette-input', 'New page')
  await page.locator('.palette-item', { hasText: 'New page' }).first().click()

  await expect(page).toHaveURL(/#\/pages\/pages%2Funtitled/)
  const note = await mockNote(page, 'pages/untitled')
  expect(note).not.toBeNull()
})

test('a task row opens the task note; a tag row explores the tag', async ({ page }) => {
  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
  await openBar(page)

  await page.fill('.palette-input', 'polish landing')
  const taskRow = page.locator('.palette-item[data-group="tasks"]', {
    hasText: 'Polish landing page',
  })
  await expect(taskRow).toContainText('escensus') // project label rides along
  await taskRow.click()
  await expect(page).toHaveURL(/#\/pages\/tasks%2Fescensus%2Fpolish-landing/)

  await openBar(page)
  await page.fill('.palette-input', 'escensus')
  await page
    .locator('.palette-item[data-group="tags"]', { hasText: '#escensus/engine' })
    .click()
  await expect(page).toHaveURL(/#\/explore\/tag\/escensus%2Fengine/)
})

test('the Ask-the-vault row opens Ask AI with the query already sent', async ({ page }) => {
  const captured: unknown[] = []
  await mockAnthropic(page, 'The engine lives in escensus/scoring-engine. ', captured)

  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
  await openBar(page)
  await page.fill('.palette-input', 'where is the scoring engine spec')
  await page.getByTestId('omnibar-ask').click()

  // One continuous gesture: the panel is open, the question is already in the
  // thread, and the mocked answer streams in — no second Enter needed.
  await expect(page.getByTestId('askai-panel')).toBeVisible()
  await expect(page.getByTestId('askai-thread')).toContainText(
    'where is the scoring engine spec',
    { timeout: 10_000 },
  )
  await expect(page.getByTestId('askai-thread')).toContainText(
    'The engine lives in escensus/scoring-engine',
    { timeout: 10_000 },
  )
  expect(captured.length).toBe(1)
})

test('typo net: a one-edit miss still finds the note (no dead ends)', async ({ page }) => {
  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
  await openBar(page)

  // "escensis" — one substitution away from "escensus"; zero literal hits.
  await page.fill('.palette-input', 'escensis')
  await expect(
    page.locator('.palette-item[data-group="notes"]', {
      hasText: 'Canonical Scoring Engine',
    }),
  ).toBeVisible()
})

test('zero state: recents persist across reload; Esc closes; ⌘K toggles', async ({ page }) => {
  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
  await openBar(page)

  // Zero state before any search: recently touched notes + top commands.
  await expect(page.locator('.palette-group', { hasText: 'Recently opened' })).toBeVisible()
  await expect(page.locator('.palette-group', { hasText: 'Commands' })).toBeVisible()

  // Search and select via Enter — that's what mints a recent.
  await page.fill('.palette-input', 'canonical scoring')
  await expect(
    page.locator('.palette-item[data-group="notes"]').first(),
  ).toContainText('Canonical Scoring Engine')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/note\/escensus%2Fscoring-engine/)
  await expect(page.getByTestId('omnibar')).toBeHidden()

  // Reopen: the query is now a recent-search row; clicking refills the input.
  await openBar(page)
  await expect(page.locator('.palette-group', { hasText: 'Recent searches' })).toBeVisible()
  await page
    .locator('.palette-item[data-group="recent"]', { hasText: 'canonical scoring' })
    .click()
  await expect(page.locator('.palette-input')).toHaveValue('canonical scoring')

  // Esc closes.
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('omnibar')).toBeHidden()

  // Recents survive a full reload. (The reload lands on the note route —
  // wait for the app shell via the always-present Ask AI fab.)
  await page.reload()
  await expect(page.getByTestId('askai-fab')).toBeVisible()
  await openBar(page)
  await expect(
    page.locator('.palette-item[data-group="recent"]', { hasText: 'canonical scoring' }),
  ).toBeVisible()

  // ⌘K toggles closed again.
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByTestId('omnibar')).toBeHidden()
})
