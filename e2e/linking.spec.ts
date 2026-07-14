// The Linking UX drop (#9 + #11 + F1b): inline [[ autocomplete, the Link
// picker in the page tools, hand-typed [[path]] converting live, and
// click-to-edit paths with the inbound-link guard.

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
    },
    [SESSION_KEY, MOCK, TOKEN] as const,
  )
}
async function mockNote(page: Page, path: string) {
  const res = await page.request.get(`${MOCK}/api/notes?id=${encodeURIComponent(path)}`, {
    headers: AUTH,
  })
  return res.ok()
    ? ((await res.json()) as { path: string; content?: string })
    : null
}
async function openPage(page: Page, path: string) {
  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent(path))
  await expect(page.locator('.page-prose')).toBeVisible()
}
async function waitSaved(page: Page) {
  await expect(page.getByTestId('page-save')).toContainText('Saved', { timeout: 8000 })
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('[[ opens the note menu; picking inserts a chip; vault gets [[path]]', async ({ page }) => {
  await seed(page, 'escensus/pitch', '# Pitch\n\nThe deck.')
  await seed(page, 'pages/scratch', '# Scratch\n\nstart')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/scratch')
  await page.locator('.page-prose').getByText('start').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' see [[pitch')

  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('escensus/pitch')
  await page.keyboard.press('Enter')

  // A real chip in the doc, not raw brackets…
  await expect(page.locator('.page-prose .wikilink')).toContainText('escensus/pitch')
  // …and clean markdown in the vault.
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain('see [[escensus/pitch]]')

  expect(errors, errors.join('\n')).toEqual([])
})

test('loading a wikilinked note never wakes the suggest menu; typing still does', async ({ page }) => {
  await seed(page, 'projects/amanda', '# Amanda\n\nplan')
  await seed(page, 'projects/escensus/engine', '# Engine\n\ncore')
  // Two chips mid-sentence with trailing text — the exact shape that used to
  // strand a "No notes match" ghost: the load's setContent parks the caret at
  // the end of the doc, right after literal [[…]] markdown.
  await seed(
    page,
    'projects/escensus',
    '# Escensus\n\nSpine: [[projects/amanda]] and [[projects/escensus/engine]] hold the plan.',
  )
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('projects/escensus'))
  await expect(page.getByTestId('note-page')).toBeVisible()
  await page.getByTestId('edit-body').click()
  const editor = page.getByTestId('note-editor')
  await expect(editor).toBeVisible()
  await expect(editor.locator('.wikilink')).toHaveCount(2)
  // The ghost used to appear only after the vault list fetch resolved — give
  // that race time to lose before declaring victory.
  await page.waitForTimeout(600)
  await expect(page.locator('.slash-menu')).toHaveCount(0)

  // Real typing still opens the picker…
  await editor.click()
  await editor.press('Control+End')
  await page.keyboard.type(' [[amanda')
  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('projects/amanda')
  // …and erasing the query closes it again (Escape here is the note editor's
  // leave-edit-mode key, so back out with Backspace).
  for (let i = 0; i < ' [[amanda'.length; i++) await page.keyboard.press('Backspace')
  await expect(page.locator('.slash-menu')).toHaveCount(0)
})

test('loading a wikilinked page never wakes the suggest menu; typing still does', async ({ page }) => {
  await seed(page, 'escensus/pitch', '# Pitch\n\nThe deck.')
  await seed(
    page,
    'pages/spine',
    '# Spine\n\nstart [[escensus/pitch]] then [[projects/amanda]] end.',
  )
  await connectViaStorage(page)

  await openPage(page, 'pages/spine')
  await expect(page.locator('.page-prose .wikilink')).toHaveCount(2)
  await page.waitForTimeout(600)
  await expect(page.locator('.slash-menu')).toHaveCount(0)

  // Click a chip-free spot (the title), then jump to the end of the doc —
  // clicking the paragraph itself could land on a chip and navigate away.
  await page.locator('.page-prose h1').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' [[pitch')
  const menu = page.getByTestId('wiki-menu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('escensus/pitch')
  await page.keyboard.press('Escape')
  await expect(page.locator('.slash-menu')).toHaveCount(0)
})

test('typing a full [[path]] by hand converts to a chip on ]]', async ({ page }) => {
  await seed(page, 'escensus/pitch', '# Pitch\n\nThe deck.')
  await seed(page, 'pages/scratch', '# Scratch\n\nstart')
  await connectViaStorage(page)

  await openPage(page, 'pages/scratch')
  await page.locator('.page-prose').getByText('start').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' also [[escensus/pitch]]')

  await expect(page.locator('.page-prose .wikilink')).toContainText('escensus/pitch')
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain('also [[escensus/pitch]]')
})

test('the 🔗 Link picker searches the whole vault and inserts at the cursor', async ({ page }) => {
  await seed(page, 'Amanda/00-home', '# Amanda home\n\nFront door.')
  await seed(page, 'pages/scratch', '# Scratch\n\nstart')
  await connectViaStorage(page)

  await openPage(page, 'pages/scratch')
  await page.locator('.page-prose').getByText('start').click()
  await page.keyboard.press('End')

  await page.getByTestId('insert-link').click()
  const picker = page.getByTestId('link-picker')
  await expect(picker).toBeVisible()
  await picker.locator('input').fill('amanda home')
  await picker.locator('.subpage-row', { hasText: 'Amanda/00-home' }).first().click()

  await expect(page.locator('.page-prose .wikilink')).toContainText('Amanda/00-home')
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain('[[Amanda/00-home]]')
})

// ——— the "Link a page" (sub-page) picker: the vault's real search ———

async function openSubPagePicker(page: Page) {
  await page.locator('.page-prose').getByText('start').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/subpage')
  await expect(page.locator('.slash-menu')).toBeVisible()
  await page.keyboard.press('Enter')
  const picker = page.getByTestId('subpage-picker')
  await expect(picker).toBeVisible()
  return picker
}

test('"Link a page" ranks title, path-segment, and body matches — rows show the path', async ({ page }) => {
  await seed(page, 'pages/harbor-plan', '# Harbor plan\n\nThe plan body.')
  // Title never says "weekly" — only the path does.
  await seed(page, 'desk/weekly/standup-notes', '# Standup notes\n\nAgenda for the crew.')
  // "zephyr" in the TITLE of one note, only in the BODY of another.
  await seed(page, 'pages/zephyr-plan', '# Zephyr plan\n\nNamed for the wind.')
  await seed(page, 'pages/quarterly-goals', '# Quarterly goals\n\nShip the zephyr initiative next.')
  await seed(page, 'pages/scratch', '# Scratch\n\nstart')
  await connectViaStorage(page)

  await openPage(page, 'pages/scratch')
  const picker = await openSubPagePicker(page)
  const input = picker.locator('input')
  const rows = picker.locator('.subpage-row:not(.subpage-create)')

  // Title fragment finds it — and the row carries the muted path, so
  // same-titled notes are tellable apart.
  await input.fill('harbor')
  await expect(rows.first()).toContainText('Harbor Plan')
  await expect(rows.first()).toContainText('pages/harbor-plan')

  // A path segment finds a note whose title doesn't contain the term.
  await input.fill('weekly')
  await expect(
    picker.locator('.subpage-row', { hasText: 'desk/weekly/standup-notes' }),
  ).toBeVisible()

  // A body-only keyword matches too (Library's lazy full-text corpus), but
  // ranks below the note actually NAMED for the term.
  await input.fill('zephyr')
  await expect(
    picker.locator('.subpage-row', { hasText: 'pages/quarterly-goals' }),
  ).toBeVisible()
  await expect(rows.first()).toContainText('Zephyr Plan')
})

test('"Link a page" still creates a new page from a typed title', async ({ page }) => {
  await seed(page, 'pages/scratch', '# Scratch\n\nstart')
  await connectViaStorage(page)

  await openPage(page, 'pages/scratch')
  const picker = await openSubPagePicker(page)
  await picker.locator('input').fill('Fresh Idea Doc')
  await picker.locator('.subpage-create').click()

  // Chip in the doc, note in the vault, markdown link in the saved body.
  await expect(page.locator('.page-prose .subpage-link')).toContainText('Fresh Idea Doc')
  await expect.poll(async () => mockNote(page, 'pages/fresh-idea-doc')).not.toBeNull()
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain('](pages/fresh-idea-doc)')
})

test('F1b — path is click-to-edit; a note with no inbound links moves freely', async ({ page }) => {
  await seed(page, 'pages/loose-idea', '# Loose idea\n\nNobody links here.')
  await connectViaStorage(page)

  await openPage(page, 'pages/loose-idea')
  await page.getByTestId('path-edit').click()
  const input = page.getByTestId('path-input')
  await expect(input).toHaveValue('pages/loose-idea')
  await input.fill('escensus/loose-idea')
  await page.keyboard.press('Enter')

  // Route follows the move; the note lives at the new path, old one is gone.
  await expect(page).toHaveURL(/escensus%2Floose-idea/)
  expect(await mockNote(page, 'escensus/loose-idea')).not.toBeNull()
  expect(await mockNote(page, 'pages/loose-idea')).toBeNull()
})

test('F1b — moving a linked-to note offers to rewrite the linking notes', async ({ page }) => {
  await seed(page, 'pages/target-doc', '# Target\n\nThe one being moved.')
  await seed(page, 'pages/linker-a', '# Linker A\n\nsee [[pages/target-doc]] for details')
  await seed(page, 'pages/linker-b', '# Linker B\n\nalso [[pages/target-doc|the target]]')
  await connectViaStorage(page)

  await openPage(page, 'pages/target-doc')
  await page.getByTestId('path-edit').click()
  await page.getByTestId('path-input').fill('escensus/target-doc')
  await page.keyboard.press('Enter')

  // The guard lists both linking notes.
  const guard = page.locator('.canon-confirm', { hasText: 'link here' })
  await expect(guard).toBeVisible()
  await expect(guard).toContainText('pages/linker-a')
  await expect(guard).toContainText('pages/linker-b')

  await page.getByTestId('move-and-fix').click()
  await expect(page).toHaveURL(/escensus%2Ftarget-doc/)

  // Both linkers now point at the new path — alias preserved.
  const a = await mockNote(page, 'pages/linker-a')
  const b = await mockNote(page, 'pages/linker-b')
  expect(a?.content).toContain('[[escensus/target-doc]]')
  expect(b?.content).toContain('[[escensus/target-doc|the target]]')
  expect(await mockNote(page, 'pages/target-doc')).toBeNull()
})

// ——— page-link chips + vault-path links survive the round trip ———
//
// The bug: a chip to a note OUTSIDE pages/ serialized fine but reloaded as a
// plain <a> whose relative href hard-navigated off the SPA — the hosting 404
// fallback rebooted the app hashless, dumping the user on Projects.

test('a chip to a NON-pages note survives save → reload → click (note route, not Projects)', async ({ page }) => {
  await seed(page, 'atelier/parachute/aaron-feature-request', '# Aaron feature request\n\nThe ask.')
  await seed(page, 'pages/scratch', '# Scratch\n\nstart')
  await connectViaStorage(page)

  await openPage(page, 'pages/scratch')
  const picker = await openSubPagePicker(page)
  await picker.locator('input').fill('aaron feature')
  await picker
    .locator('.subpage-row', { hasText: 'atelier/parachute/aaron-feature-request' })
    .first()
    .click()

  const chip = page.locator('.page-prose .subpage-link')
  await expect(chip).toContainText('Aaron Feature Request')

  // Storage law: a plain, readable markdown link — de-slugged title, raw path.
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain(
    '[Aaron Feature Request](atelier/parachute/aaron-feature-request)',
  )

  // Leave and come back — the chip is rebuilt from saved markdown, then clicked.
  await page.reload()
  await expect(page.locator('.page-prose')).toBeVisible()
  await expect(chip).toContainText('Aaron Feature Request')
  await chip.click()
  await expect(page).toHaveURL(/#\/note\/atelier%2Fparachute%2Faaron-feature-request$/)
})

test('a chip to a pages/ note survives save → reload → click (pages route)', async ({ page }) => {
  await seed(page, 'pages/harbor-plan', '# Harbor plan\n\nThe plan body.')
  await seed(page, 'pages/scratch', '# Scratch\n\nstart')
  await connectViaStorage(page)

  await openPage(page, 'pages/scratch')
  const picker = await openSubPagePicker(page)
  await picker.locator('input').fill('harbor')
  await picker.locator('.subpage-row', { hasText: 'pages/harbor-plan' }).first().click()

  const chip = page.locator('.page-prose .subpage-link')
  await expect(chip).toContainText('Harbor Plan')
  await waitSaved(page)
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toContain('[Harbor Plan](pages/harbor-plan)')

  await page.reload()
  await expect(page.locator('.page-prose')).toBeVisible()
  await expect(chip).toContainText('Harbor Plan')
  await chip.click()
  await expect(page).toHaveURL(/#\/pages\/pages%2Fharbor-plan$/)
})

test('a chip whose target is gone: quiet toast, no navigation, no byte drift', async ({ page }) => {
  const body = '# Scratch\n\nsee [Ghost Note](atelier/ghost-note) end\n'
  await seed(page, 'pages/scratch', body)
  await connectViaStorage(page)

  await openPage(page, 'pages/scratch')
  const chip = page.locator('.page-prose .subpage-link')
  await expect(chip).toContainText('Ghost Note')

  await chip.click()
  await expect(page.locator('.toast', { hasText: 'Page not found' })).toBeVisible()
  await expect(page).toHaveURL(/#\/pages\/pages%2Fscratch$/)

  // Opening (no edit) never rewrites the stored note.
  const saved = await mockNote(page, 'pages/scratch')
  expect(saved?.content).toBe(body)
})

test('a plain vault-path link in the read view routes in-app — the page never unloads', async ({ page }) => {
  await seed(page, 'people/arianne/00-profile', '# Profile\n\nHer file.')
  await seed(
    page,
    'projects/dossier',
    '# Dossier\n\nsee [Custom Label](people/arianne/00-profile) for more',
  )
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('projects/dossier'))
  const body = page.getByTestId('note-body')
  await expect(body).toBeVisible()

  // Sentinel survives only if the document is never unloaded (no hard 404 trip).
  await page.evaluate(() => {
    ;(window as unknown as { __stayed?: boolean }).__stayed = true
  })
  await body.locator('a', { hasText: 'Custom Label' }).click()
  await expect(page).toHaveURL(/#\/note\/people%2Farianne%2F00-profile$/)
  expect(
    await page.evaluate(() => (window as unknown as { __stayed?: boolean }).__stayed),
  ).toBe(true)
})

test('a plain vault-path link to a missing note: toast + stays put', async ({ page }) => {
  await seed(page, 'projects/dossier', '# Dossier\n\nsee [Lost Doc](people/lost/lost-doc) maybe')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('projects/dossier'))
  const body = page.getByTestId('note-body')
  await expect(body).toBeVisible()
  await body.locator('a', { hasText: 'Lost Doc' }).click()

  await expect(page.locator('.toast', { hasText: 'Page not found' })).toBeVisible()
  await expect(page).toHaveURL(/#\/note\/projects%2Fdossier$/)
})

test('in the Pages editor, a custom-text vault link stays plain (byte law) but routes in-app', async ({ page }) => {
  await seed(page, 'people/arianne/00-profile', '# Profile\n\nHer file.')
  await seed(
    page,
    'pages/scratch',
    '# Scratch\n\nstart [Custom Label](people/arianne/00-profile) end',
  )
  await connectViaStorage(page)

  await openPage(page, 'pages/scratch')
  // Custom text ≠ the chip's own serialized title → must NOT convert (a chip
  // would re-serialize with a different label and rewrite the stored bytes).
  await expect(page.locator('.page-prose .subpage-link')).toHaveCount(0)
  await page.locator('.page-prose a', { hasText: 'Custom Label' }).click()
  await expect(page).toHaveURL(/#\/note\/people%2Farianne%2F00-profile$/)
})

test('an external https link in the editor still opens in a new tab', async ({ page }) => {
  await page
    .context()
    .route('https://example.com/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>external</h1>' }),
    )
  await seed(page, 'pages/scratch', '# Scratch\n\nvisit [Example](https://example.com/x) now')
  await connectViaStorage(page)

  await openPage(page, 'pages/scratch')
  const popupPromise = page.context().waitForEvent('page')
  await page.locator('.page-prose a', { hasText: 'Example' }).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  expect(popup.url()).toContain('example.com')
  // The editor itself never navigated.
  await expect(page).toHaveURL(/#\/pages\/pages%2Fscratch$/)
})

test('board — dragging into done also flips the done bool (progress feeds)', async ({ page }) => {
  await seed(page, 'tasks/amanda/wrap-up', 'Wrap up the shoot', ['task'], {
    project: 'amanda', phase: '4', track: 'photos', state: 'active', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tracker/board')
  const card = page.locator('.card[data-path="tasks/amanda/wrap-up"]')
  await expect(card).toBeVisible()

  const doneLane = page.locator('section.lane[data-lane="done"]')
  await card.hover()
  await page.mouse.down()
  const box = await doneLane.boundingBox()
  if (!box) throw new Error('done lane not found')
  await page.mouse.move(box.x + box.width / 2, box.y + 80, { steps: 12 })
  await page.mouse.up()

  await expect(doneLane.locator('.card[data-path="tasks/amanda/wrap-up"]')).toBeVisible()
  await expect
    .poll(async () => {
      const res = await page.request.get(
        `${MOCK}/api/notes?id=${encodeURIComponent('tasks/amanda/wrap-up')}`,
        { headers: AUTH },
      )
      const n = (await res.json()) as { metadata?: Record<string, unknown> }
      return n.metadata?.done
    })
    .toBe(true)
})
