// THE SUGGEST BRAIN — smarter link-time matching plus the ⌘K whisper date.
//   · Any-order token prefixes in the `[[` suggester and the 🔗 Link picker:
//     "jo bree" (which today's whole-query subsequence matcher cannot see)
//     finds people/bree-jonathan — every space-separated token must prefix-
//     match some word of the title or path, in any order.
//   · Content fallback: when title/path matching yields fewer than 3 rows,
//     the Omnibar's own relevance engine (rankNotes over the shared corpus)
//     fills in quiet `.wiki-content-row` rows — BEFORE the ✨ semantic tail,
//     inserting a normal [[path]] link like any other row.
//   · The Omnibar wears a whisper created-date on every note-backed row;
//     ✨ Related rows show it alongside (not instead of) their badge.
// Conventions mirror semantic-links.spec: mock vault on 8787, preview build
// on 4173, index warmed through the Omnibar's corpus flow only.

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

// Semantic-only bait (borrowed from semantic-links.spec): its BODY shares
// stems with CONTENT_QUERY but holds no query word VERBATIM ("customizable",
// not "customize"), so it can never be a keyword row OR a content-fallback
// row — any row it appears in is ✨ or nothing.
const NOTE_A_PATH = 'notes/remix-studio'
const NOTE_A =
  '# Remix Studio\n\nA customizable interface that users remix and reshape to their own taste. Panels, themes, layouts — everything invites remixing.\n'
const CONTENT_QUERY = 'customize and remix the interface'

test.beforeEach(async ({ page }) => {
  await reset(page)
  await seed(page, 'pages/scratch', '# Scratch\n\nstart')
  await connectViaStorage(page)
})

test('[[ any-order token prefixes: "led har" (reversed) finds Harvest Ledger; Enter links it', async ({ page }) => {
  await seed(page, 'notes/harvest-ledger', '# Harvest Ledger\n\nBushels, totals, and the tally.\n')
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openScratch(page)
  // Tokens in REVERSED title order — a whole-query subsequence matcher has
  // no path to this note; token prefix matching does.
  await page.keyboard.type(' see [[led har')

  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  const first = menu.locator('.slash-item').first()
  await expect(first).toContainText('Harvest Ledger')
  await expect(first).toContainText('notes/harvest-ledger')
  // A real keyword row, not a fallback flavor.
  await expect(first).not.toHaveClass(/wiki-content-row|wiki-semantic|wiki-as-typed/)

  await page.keyboard.press('Enter')
  await expect(page.locator('.page-prose .wikilink')).toContainText('notes/harvest-ledger')
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain('see [[notes/harvest-ledger]]')

  expect(errors, errors.join('\n')).toEqual([])
})

test('"jo bree" — nothing under the old matcher — finds people/bree-jonathan in [[ AND the Link picker', async ({ page }) => {
  await seed(page, 'people/bree-jonathan', '# Bree Jonathan\n\nCall notes and follow-ups.\n')

  await openScratch(page)
  await page.keyboard.type(' [[jo bree')
  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  const first = menu.locator('.slash-item').first()
  await expect(first).toContainText('Bree Jonathan')
  await expect(first).toContainText('people/bree-jonathan')
  await page.keyboard.press('Enter')
  await expect(page.locator('.page-prose .wikilink').first()).toContainText('people/bree-jonathan')

  // Same brain in the 🔗 Link picker.
  await page.getByTestId('insert-link').click()
  const picker = page.getByTestId('link-picker')
  await expect(picker).toBeVisible()
  await picker.locator('input').fill('jo bree')
  const row = picker.locator('.subpage-row').first()
  await expect(row).toContainText('Bree Jonathan')
  await expect(row).toContainText('people/bree-jonathan')
  await row.click()
  await expect(page.locator('.page-prose .wikilink')).toHaveCount(2)
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain('[[people/bree-jonathan]]')
})

test('content fallback: a body-only match surfaces as a quiet .wiki-content-row and links normally', async ({ page }) => {
  // TITLE/PATH share no words with the query; the BODY holds both terms.
  await seed(
    page,
    'notes/orchard-map',
    '# Orchard Map\n\nThe ziggurat blueprint lives in the annex drawer, third shelf down.\n',
  )
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openScratch(page)
  await page.keyboard.type(' find [[ziggurat blueprint')

  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  const contentRow = menu.locator('.wiki-content-row').first()
  await expect(contentRow).toContainText('Orchard Map')
  await expect(contentRow).toContainText('notes/orchard-map')
  await expect(contentRow).toContainText('in content') // the whisper hint
  // No keyword row can exist — the content row leads, as-typed trails.
  await expect(menu.locator('.slash-item').first()).toHaveClass(/wiki-content-row/)
  await expect(menu.locator('.wiki-as-typed')).toHaveCount(1)

  await page.keyboard.press('Enter')
  await expect(page.locator('.page-prose .wikilink')).toContainText('notes/orchard-map')
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain('find [[notes/orchard-map]]')

  expect(errors, errors.join('\n')).toEqual([])
})

test('content rows sit BEFORE the ✨ semantic rows when both are present', async ({ page }) => {
  await seed(page, NOTE_A_PATH, NOTE_A)
  // Holds every query word verbatim in its BODY; title/path share none.
  await seed(
    page,
    'notes/settings-manual',
    '# Settings Manual\n\nHow to customize and remix the interface without breaking sync.\n',
  )

  await warmIndex(page)
  await openScratch(page)
  await page.keyboard.type(' [[' + CONTENT_QUERY)

  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  const rows = menu.locator('.slash-item')
  // Content row first (no keyword rows can exist for this query)…
  await expect(rows.nth(0)).toHaveClass(/wiki-content-row/)
  await expect(rows.nth(0)).toContainText('notes/settings-manual')
  // …then the ✨ tail, led by the stem-match fallback cannot hold.
  await expect(menu.locator('.wiki-semantic').first()).toContainText('Remix Studio')
  await expect(rows.nth(1)).toHaveClass(/wiki-semantic/)
  // No echoes: the content hit never doubles as a ✨ row.
  await expect(menu.locator('.wiki-semantic', { hasText: 'notes/settings-manual' })).toHaveCount(0)
})

test('⌘K title: operator scopes matching to display titles only; the legend advertises it', async ({ page }) => {
  await seed(page, 'notes/golden', '# Golden\n\nthe exact phrase lives here.\n')
  // Matches "golden" in its BODY only — free text finds it, title: must not.
  await seed(page, 'notes/scattered', '# Scattered\n\ngolden words but the phrase is elsewhere entirely.\n')

  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByTestId('omnibar')).toBeVisible()

  const input = page.getByTestId('omnibar-input')
  const noteRows = page.locator('.palette-item[data-group="notes"]')

  // Baseline: as free text, the body-only match IS a result…
  await input.fill('golden')
  await expect(noteRows.filter({ hasText: 'Golden' }).first()).toBeVisible()
  await expect(noteRows.filter({ hasText: 'Scattered' }).first()).toBeVisible()

  // …under title: it vanishes; the title match stays.
  await input.fill('title:golden')
  await expect(noteRows.filter({ hasText: 'Golden' }).first()).toBeVisible()
  await expect(noteRows.filter({ hasText: 'Scattered' })).toHaveCount(0)

  // Both legend surfaces advertise the operator.
  await expect(input).toHaveAttribute('placeholder', /title:/)
  await expect(page.locator('.palette-foot-ops')).toContainText('title:')
})

// ——— dismissed runs wake back up ———
// Escape used to file the run's `[[` anchor as permanently dismissed (tiptap
// Suggestion's dismissedRange survives every edit inside the run when
// allowSpaces is on), so the menu could never return without RETYPING the
// trigger. The shouldResetDismissed hook clears the dismissal on any real
// user gesture — typing/deleting or a pointer click — inside the run.

test('Escape closes the [[ menu and it STAYS closed — until typing inside the same run reopens it with the live query', async ({ page }) => {
  await seed(page, 'notes/daily-log', '# Daily Log\n\nEntries.\n')
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openScratch(page)
  await page.keyboard.type(' [[ dail')
  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()

  // Dismiss. The menu must close AND stay closed while nothing happens —
  // Escape still means something.
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await page.waitForTimeout(400)
  await expect(menu).toHaveCount(0)

  // Typing INSIDE the still-standing `[[ dail` run reopens with the fresh
  // query (" daily"), not a stale frame.
  await page.keyboard.type('y')
  await expect(menu).toBeVisible()
  const first = menu.locator('.slash-item').first()
  await expect(first).toContainText('Daily Log')
  await expect(first).toContainText('notes/daily-log')

  // And the reopened menu is fully live: Enter links the note.
  await page.keyboard.press('Enter')
  await expect(page.locator('.page-prose .wikilink')).toContainText('notes/daily-log')
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain('[[notes/daily-log]]')

  expect(errors, errors.join('\n')).toEqual([])
})

test('Escape then a pointer click back inside the run reopens the menu; deleting inside a dismissed run reopens too', async ({ page }) => {
  await seed(page, 'notes/daily-log', '# Daily Log\n\nEntries.\n')

  await openScratch(page)
  await page.keyboard.type(' [[ daily')
  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)

  // Click ON the run's own text (a precise mid-word coordinate — the caret
  // sits at the end of the run, so the click must land elsewhere INSIDE it
  // to be a real selection change). The caret never leaves the run, so only
  // the pointer-gesture reset can bring the menu back.
  const pt = await page
    .locator('.page-prose p', { hasText: 'daily' })
    .evaluate((el) => {
      const node = el.firstChild as Text // "start [[ daily"
      const i = (node.textContent ?? '').indexOf('daily') + 2
      const r = document.createRange()
      r.setStart(node, i)
      r.setEnd(node, i + 1)
      const rect = r.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    })
  await page.mouse.click(pt.x, pt.y)
  await expect(menu).toBeVisible()

  // Dismiss again; this time BACKSPACE (an edit, not an insert) reopens.
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await page.keyboard.press('End')
  await page.keyboard.press('Backspace')
  await expect(menu).toBeVisible()
  await expect(menu.locator('.slash-item').first()).toContainText('Daily Log')
})

test('blur then refocus: typing inside the run brings the menu with fresh items', async ({ page }) => {
  await seed(page, 'notes/daily-log', '# Daily Log\n\nEntries.\n')

  await openScratch(page)
  await page.keyboard.type(' [[ dail')
  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()

  // Focus leaves the editor entirely…
  await page.locator('.page-prose').evaluate((el) => (el as HTMLElement).blur())
  await page.waitForTimeout(300)

  // …then comes back via a click on the run and typing resumes: the menu is
  // there with the current query's items.
  await page.locator('.page-prose').getByText('dail').click()
  await page.keyboard.press('End')
  await page.keyboard.type('y')
  await expect(menu).toBeVisible()
  const first = menu.locator('.slash-item').first()
  await expect(first).toContainText('Daily Log')
  await expect(first).toContainText('notes/daily-log')
})

test('⌘K: every note-backed row wears the whisper created-date; ✨ Related shows date + badge', async ({ page }) => {
  await seed(page, 'notes/golden', '# Golden\n\nthe exact golden phrase lives here.\n')
  await seed(page, NOTE_A_PATH, NOTE_A)

  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByTestId('omnibar')).toBeVisible()
  await page.waitForFunction(() => {
    const d = (window as unknown as { __semanticDebug?: { ready: boolean } })
      .__semanticDebug
    return d?.ready === true
  })

  const input = page.getByTestId('omnibar-input')
  await input.fill('golden')
  const noteRows = page.locator('.palette-item[data-group="notes"]')
  await expect(noteRows.first()).toContainText('Golden')
  // Universal: EVERY note row carries the quiet date (seeded now → relative).
  const n = await noteRows.count()
  for (let i = 0; i < n; i++) {
    await expect(noteRows.nth(i).locator('.omni-date')).toHaveText(/now|ago/i)
  }

  // A ✨ Related row: the date rides ALONGSIDE the badge, never instead.
  await input.fill(CONTENT_QUERY)
  const rel = page.locator('.palette-item[data-group="related"]').first()
  await expect(rel).toContainText('Remix Studio')
  await expect(rel.locator('.palette-hint')).toHaveText(/related/i)
  await expect(rel.locator('.omni-date')).toHaveText(/now|ago/i)
})
