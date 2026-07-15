// SEMANTIC LINK SUGGESTIONS — the ✨ meaning-tail on both link-entry
// surfaces: the inline `[[` wikilink suggester and the 🔗 Link picker.
// Link-time is exactly when you can't remember a note's name, so after the
// keyword rows both surfaces append up to 3 candidates from the local vector
// index (the same engine as the Omnibar's ✨ Related group).
//
// Deterministic by design: hash-ngram-v1 is a pure function of the text.
// Seeding trick (mirrors semantic.spec): note A's BODY shares stems with the
// typed query, but its TITLE/PATH contain none of the typed words — the
// whole-query-subsequence fuzzy matcher CANNOT surface it, so any row it
// appears in is semantic or nothing. Note B is honestly unrelated and must
// stay below SEMANTIC_FLOOR.
//
// The index is consume-only on these surfaces: it builds in the Omnibar's
// corpus flow, so each test warms it by opening the bar once first.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}

async function seed(page: Page, path: string, content: string) {
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

/** Build the vector index the way the app really does: the Omnibar's corpus
 * flow. The link surfaces only CONSUME a ready index — they never build. */
async function warmIndex(page: Page) {
  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByTestId('omnibar')).toBeVisible()
  await page.waitForFunction(() => {
    const d = (window as unknown as { __semanticDebug?: { ready: boolean } })
      .__semanticDebug
    return d?.ready === true
  })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('omnibar')).toHaveCount(0)
}

async function openScratch(page: Page) {
  // Hash-only navigation — the SPA (and the in-memory vector index) survives.
  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/scratch'))
  await expect(page.locator('.page-prose')).toBeVisible()
  await page.locator('.page-prose').getByText('start').click()
  await page.keyboard.press('End')
}

async function waitSaved(page: Page) {
  await expect(page.getByTestId('page-save')).toContainText('Saved', { timeout: 8000 })
}

async function mockNote(page: Page, path: string) {
  const res = await page.request.get(`${MOCK}/api/notes?id=${encodeURIComponent(path)}`, {
    headers: AUTH,
  })
  return res.ok() ? ((await res.json()) as { path: string; content?: string }) : null
}

// Note A: the query "customize and remix the interface" shares stems with the
// BODY (customize ↔ customizable via char-grams, remix/interface verbatim) but
// the title/path contain no typed word — fuzzy matching cannot see it.
const NOTE_A_PATH = 'notes/remix-studio'
const NOTE_A =
  '# Remix Studio\n\nA customizable interface that users remix and reshape to their own taste. Panels, themes, layouts — everything invites remixing.\n'
const NOTE_B_PATH = 'notes/sourdough-log'
const NOTE_B =
  '# Sourdough Log\n\nFed the starter at dawn, baked at high hydration, the crumb came out open and glossy.\n'
const QUERY = 'customize and remix the interface'

test.beforeEach(async ({ page }) => {
  await reset(page)
  await seed(page, 'pages/scratch', '# Scratch\n\nstart')
  await connectViaStorage(page)
})

test('[[ + a paraphrase: the ✨ row surfaces the note fuzzy cannot, and Enter links it', async ({ page }) => {
  await seed(page, NOTE_A_PATH, NOTE_A)
  await seed(page, NOTE_B_PATH, NOTE_B)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await warmIndex(page)
  await openScratch(page)
  await page.keyboard.type(' see [[' + QUERY)

  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  const semRows = menu.locator('.wiki-semantic')
  // Top ✨ row is the meaning-match fuzzy can't see. The mock vault's default
  // corpus may clear the floor with more rows behind it — capped at 3.
  await expect(semRows.first()).toContainText('Remix Studio')
  await expect(semRows.first()).toContainText(NOTE_A_PATH)
  await expect(semRows.first()).toContainText('related') // the muted hint
  expect(await semRows.count()).toBeLessThanOrEqual(3)
  // No keyword row can exist for this query — the ✨ row leads, with only
  // the as-typed escape hatch behind it.
  await expect(menu.locator('.slash-item').first()).toHaveClass(/wiki-semantic/)
  await expect(menu.locator('.wiki-as-typed')).toHaveCount(1)
  // The unrelated note stays under the floor — no fake serendipity.
  await expect(menu.locator('.wiki-semantic', { hasText: 'Sourdough' })).toHaveCount(0)

  // Keyboard selection works identically on semantic rows: the ✨ row is the
  // highlighted first row, Enter inserts a REAL chip…
  await page.keyboard.press('Enter')
  await expect(page.locator('.page-prose .wikilink')).toContainText(NOTE_A_PATH)
  // …and the vault gets plain [[path]] markdown, exactly like a keyword row.
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain(`see [[${NOTE_A_PATH}]]`)

  expect(errors, errors.join('\n')).toEqual([])
})

test('✨ rows sit AFTER keyword rows, deduped against them; arrow keys reach them', async ({ page }) => {
  // "harbor" fuzzy-hits harbor-plan (keyword row). marina-log shares stems in
  // its body only (harbormaster/harbors) — semantic row. harbor-plan clears
  // the floor too, but it is already a keyword row and must NOT echo.
  await seed(page, 'notes/harbor-plan', '# Harbor Plan\n\nSlips, moorings, and the town dock budget for next season.\n')
  await seed(page, 'notes/marina-log', '# Marina Log\n\nThe harbormaster logged arrivals at dusk; sheltered harbors and breakwaters kept the swell off the moored boats.\n')
  await seed(page, NOTE_B_PATH, NOTE_B)

  await warmIndex(page)
  await openScratch(page)
  await page.keyboard.type(' [[harbor')

  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  const rows = menu.locator('.slash-item')
  // Keyword first, ✨ after, escape hatch last.
  await expect(rows.nth(0)).toContainText('notes/harbor-plan')
  await expect(rows.nth(0)).not.toHaveClass(/wiki-semantic/)
  await expect(rows.nth(1)).toHaveClass(/wiki-semantic/)
  await expect(rows.nth(1)).toContainText('notes/marina-log')
  // Dedup: the keyword hit appears exactly once in the whole menu.
  await expect(menu.locator('.slash-item', { hasText: 'notes/harbor-plan' })).toHaveCount(1)

  // ArrowDown onto the ✨ row; Enter inserts it like any other row.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('.page-prose .wikilink')).toContainText('notes/marina-log')
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain('[[notes/marina-log]]')
})

test('the 🔗 Link picker grows a quiet ✨ Related tail with the same insert behavior', async ({ page }) => {
  await seed(page, NOTE_A_PATH, NOTE_A)
  await seed(page, NOTE_B_PATH, NOTE_B)

  await warmIndex(page)
  await openScratch(page)
  await page.getByTestId('insert-link').click()
  const picker = page.getByTestId('link-picker')
  await expect(picker).toBeVisible()

  await picker.locator('input').fill(QUERY)
  await expect(page.getByTestId('link-picker-related')).toBeVisible()
  const semRows = picker.locator('.subpage-row[data-semantic]')
  await expect(semRows.first()).toContainText('Remix Studio')
  await expect(semRows.first()).toContainText(NOTE_A_PATH)
  expect(await semRows.count()).toBeLessThanOrEqual(3)
  await expect(picker.locator('.subpage-row', { hasText: 'Sourdough' })).toHaveCount(0)

  // Same insert behavior as a keyword row: a chip, then plain [[path]] bytes.
  await semRows.first().click()
  await expect(page.locator('.page-prose .wikilink')).toContainText(NOTE_A_PATH)
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain(`[[${NOTE_A_PATH}]]`)
})

test('queries under 3 chars never grow ✨ rows — either surface', async ({ page }) => {
  await seed(page, NOTE_A_PATH, NOTE_A)
  await seed(page, NOTE_B_PATH, NOTE_B)

  await warmIndex(page)
  await openScratch(page)

  // Inline: "re" fuzzy-hits remix-studio as a KEYWORD row; no semantic rows.
  await page.keyboard.type(' [[re')
  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  await expect(menu.locator('.slash-item', { hasText: NOTE_A_PATH })).toBeVisible()
  await expect(menu.locator('.wiki-semantic')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // Link picker: same law.
  await page.getByTestId('insert-link').click()
  const picker = page.getByTestId('link-picker')
  await expect(picker).toBeVisible()
  await picker.locator('input').fill('re')
  await expect(picker.locator('.subpage-row', { hasText: NOTE_A_PATH })).toBeVisible()
  await expect(page.getByTestId('link-picker-related')).toHaveCount(0)
  await expect(picker.locator('.subpage-row[data-semantic]')).toHaveCount(0)
})

test('stale race: fast typing then shrinking the query never leaves stale ✨ rows or crashes', async ({ page }) => {
  await seed(page, NOTE_A_PATH, NOTE_A)
  await seed(page, NOTE_B_PATH, NOTE_B)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await warmIndex(page)
  await openScratch(page)

  // Every keystroke fires items() with a semanticSearch in flight — typed
  // fast, the older tails MUST lose to the newest query.
  await page.keyboard.type(' [[' + QUERY, { delay: 5 })
  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  await expect(menu.locator('.wiki-semantic').first()).toContainText('Remix Studio')

  // Now shrink fast to a sub-3-char query ("cu"): the long query's semantic
  // hits are stale and must vanish — even if their search resolves late —
  // leaving the as-typed escape hatch for the final query.
  for (let i = 0; i < QUERY.length - 2; i++) await page.keyboard.press('Backspace')
  await expect(menu.locator('.wiki-as-typed')).toContainText('Link “cu”')
  await expect(menu.locator('.wiki-semantic')).toHaveCount(0)

  expect(errors, errors.join('\n')).toEqual([])
})

test('PR #50 guard holds with a warm index: loading [[chips]] never wakes the suggester', async ({ page }) => {
  await seed(page, NOTE_A_PATH, NOTE_A)
  await seed(
    page,
    'pages/spine',
    `# Spine\n\nstart [[${NOTE_A_PATH}]] then [[${NOTE_B_PATH}]] end.`,
  )
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // The semantic path is LIVE (index ready) — the PREVENT_SUGGEST gate must
  // still keep programmatic setContent from ever opening the menu.
  await warmIndex(page)
  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/spine'))
  await expect(page.locator('.page-prose')).toBeVisible()
  await expect(page.locator('.page-prose .wikilink')).toHaveCount(2)
  await page.waitForTimeout(600)
  await expect(page.locator('.slash-menu')).toHaveCount(0)

  expect(errors, errors.join('\n')).toEqual([])
})
