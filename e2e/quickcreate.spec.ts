// Phase D — the small sweep: create things where you're standing.
// 1) Global Tracker "＋ New task" with a project picker.
// 2) Library "＋ New note" that inherits the tag you're filtered on.

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
  return res.ok() ? ((await res.json()) as { path: string; tags?: string[]; metadata?: Record<string, unknown> }) : null
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Tracker ＋ New task — project picker, lands in row-as-page', async ({ page }) => {
  await seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x',
  })
  await seed(page, 'projects/escensus', '# Escensus', ['project'], {
    key: 'escensus', tag: 'escensus', status: 'active', order: 2, summary: 'y',
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/tracker')
  await expect(page.locator('.db-title')).toHaveText('Tracker')

  // The nav rail collapses on any view for max real estate, and it sticks.
  await page.getByTestId('rail-collapse').click()
  await expect(page.locator('.rail')).toHaveClass(/is-collapsed/)
  await page.getByTestId('rail-collapse').click()
  await expect(page.locator('.rail')).not.toHaveClass(/is-collapsed/)

  await page.getByTestId('tracker-new-task').click()
  const form = page.getByTestId('tracker-new-task-form')
  await expect(form).toBeVisible()

  // Both worlds are in the picker; pick the second one.
  await form.locator('.db-newtask-project').selectOption('escensus')
  await form.locator('.db-newtask-title').fill('Wire the pitch deck')
  await page.keyboard.press('Enter')

  // STAYS in the tracker (no auto-navigation) — the row appears inline.
  await expect(page).toHaveURL(/#\/tracker/)
  const row = page.locator('tr', { hasText: 'Wire the pitch deck' })
  await expect(row).toBeVisible()

  // Notion-style side peek: 📄 on the row opens the task BESIDE the tracker.
  await row.hover()
  await row.getByTestId('row-peek').click()
  const peek = page.getByTestId('db-peek')
  await expect(peek).toBeVisible()
  await expect(page.locator('.db-title')).toBeVisible() // tracker still on screen
  // Notion-style peek: the task title is BIG at the top, editable props under it.
  await expect(peek.getByTestId('db-peek-title')).toHaveText('Wire the pitch deck')
  await expect(peek.locator('[data-testid="record-props"]')).toBeVisible()
  // The peek is resizable (drag divider present).
  await expect(page.getByTestId('db-peek-resize')).toBeVisible()

  // Inside the peek there's no back button — the tracker is already on screen.
  await expect(peek.getByTestId('back-to-tracker')).toHaveCount(0)

  // Open ↗ promotes to the full page.
  await peek.locator('.detail-btn', { hasText: 'Open' }).click()
  await expect(page).toHaveURL(/tasks%2Fescensus%2Fwire-the-pitch-deck/)
  await expect(page.getByTestId('record-props')).toBeVisible()

  // …and even in FULL PAGE mode, one click gets you back to the tracker.
  await page.getByTestId('back-to-tracker').click()
  await expect(page).toHaveURL(/#\/tracker/)
  await expect(page.locator('.db-title')).toHaveText('Tracker')
  await expect(page.locator('tr', { hasText: 'Wire the pitch deck' })).toBeVisible()

  // The vault note carries the picked project + task defaults.
  const note = await mockNote(page, 'tasks/escensus/wire-the-pitch-deck')
  expect(note).not.toBeNull()
  expect(note!.tags).toContain('task')
  expect(note!.metadata?.project).toBe('escensus')
  expect(note!.metadata?.state).toBe('next')

  expect(errors, errors.join('\n')).toEqual([])
})

test('Library ＋ New note — inherits the active tag filter', async ({ page }) => {
  await seed(page, 'escensus/pitch-notes', '# Pitch notes\n\nBody.', ['escensus'], {})
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/library')
  await expect(page.getByTestId('library-new-note')).toBeVisible()

  // Stand inside #escensus, then create.
  await page.getByTestId('tag-tree').getByRole('button', { name: /#escensus/ }).first().click()
  await expect(page.getByTestId('library-new-note')).toContainText('#escensus')
  await page.getByTestId('library-new-note').click()

  // Opens in the Pages editor as a fresh untitled page…
  await expect(page).toHaveURL(/#\/pages\/pages%2Funtitled/)

  // …and the note is already filed under the tag it was born in.
  const note = await mockNote(page, 'pages/untitled')
  expect(note).not.toBeNull()
  expect(note!.tags).toContain('escensus')

  expect(errors, errors.join('\n')).toEqual([])
})
