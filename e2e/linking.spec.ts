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
