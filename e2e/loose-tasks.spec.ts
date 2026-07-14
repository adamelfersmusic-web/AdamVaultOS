// CRAFT PHASE B — LIVE CHECKBOXES: loose `- [ ]` lines inside ordinary notes
// surface on the Tasks tab, toggle IN PLACE (byte-stable round-trip — the
// law), and can be PROMOTED into real tasks/* rows (ownership transferred:
// the source line stops being a checkbox). Exclusion zones (weekly surfaces,
// locked notes, …) stay think-space only.
// All expected dates are computed from new Date() — never hardcoded.

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
  const res = await page.request.get(
    `${MOCK}/api/notes?id=${encodeURIComponent(path)}`,
    { headers: AUTH },
  )
  return res.ok() ? res.json() : null
}
async function savedContent(page: Page, path: string): Promise<string> {
  const note = await mockNote(page, path)
  return note?.content ?? ''
}

// ——— expected dates, computed the same way src/lib/dates.ts does ———

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}
function daysFromNow(n: number): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

const seedAmandaProject = (page: Page) =>
  seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x',
  })

const chips = (page: Page) => page.getByTestId('tasks-chips')

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('scanner — loose lines surface under "In your notes" (due stripped, tone shown), fence decoys stay invisible, overdue joins Today', async ({ page }) => {
  const yesterday = ymd(daysFromNow(-1))
  const content = [
    '# Studio Notes', // 0
    '', // 1
    'Some thinking prose.', // 2
    '', // 3
    '- [ ] Restring the guitar', // 4
    `- [ ] Email the mastering engineer 📅 ${yesterday}`, // 5
    '', // 6
    '```', // 7
    '- [ ] decoy inside the fence', // 8
    '```', // 9
    '',
  ].join('\n')
  await seed(page, 'pages/studio-notes', content)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await expect(page.getByTestId('tasks-view')).toBeVisible()
  await chips(page).getByRole('tab', { name: 'All' }).click()

  // The closing section, headed by the bold note title — exactly the two
  // real lines; the fenced decoy never surfaces.
  const looseSection = page.getByTestId('tasks-loose')
  await expect(looseSection.getByTestId('tasks-loose-head')).toHaveText('In your notes')
  await expect(looseSection.getByTestId('loose-row')).toHaveCount(2)
  await expect(looseSection.getByTestId('tasks-group-head')).toContainText('Studio Notes')
  await expect(looseSection).toContainText('Restring the guitar')
  await expect(looseSection).toContainText('Email the mastering engineer')
  await expect(page.getByText('decoy inside the fence')).toHaveCount(0)

  // The inline 📅 token is carried as a due (calm-red overdue tone), never
  // shown as raw emoji text in the row.
  const dueRow = looseSection.locator('[data-path="pages/studio-notes"][data-line="5"]')
  await expect(dueRow.getByTestId('task-due')).toHaveClass(/due-overdue/)
  await expect(dueRow).not.toContainText('📅')
  // The source chip is a door into the note.
  await expect(dueRow.getByTestId('task-src')).toHaveText('Studio Notes')

  // Today: the overdue line joins under its note-title group; the undated
  // one stays off the day.
  await chips(page).getByRole('tab', { name: 'Today' }).click()
  const noteGroup = page.locator('[data-group="note:pages/studio-notes"]')
  await expect(noteGroup.getByTestId('tasks-group-head')).toContainText('Studio Notes')
  await expect(noteGroup).toContainText('Email the mastering engineer')
  await expect(noteGroup).not.toContainText('Restring the guitar')

  // Upcoming: a future-dued loose line slots under its day header.
  expect(errors, errors.join('\n')).toEqual([])
})

test('toggle — flips EXACTLY that line in the vault note; every other byte survives', async ({ page }) => {
  const lines = [
    '# Roundtrip', // 0
    '', // 1
    `- [ ] flip me 📅 ${ymd(daysFromNow(3))}`, // 2
    '- [ ] leave me alone', // 3
    '', // 4
    'tail prose with trailing spaces   ', // 5 — byte-stability bait
    '',
  ]
  await seed(page, 'pages/roundtrip', lines.join('\n'))
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()
  const row = page.locator('[data-testid="loose-row"][data-path="pages/roundtrip"][data-line="2"]')
  await expect(row).toBeVisible()
  await row.locator('.task-check').click()

  // Byte-equality except the one line: [ ] → [x], due token untouched.
  const expected = [...lines]
  expected[2] = `- [x] flip me 📅 ${ymd(daysFromNow(3))}`
  await expect
    .poll(() => savedContent(page, 'pages/roundtrip'))
    .toBe(expected.join('\n'))

  // The checked row takes its bow and leaves; its sibling stays.
  await expect(row).toHaveCount(0)
  await expect(page.getByText('leave me alone')).toBeVisible()
})

test('editor round-trip — checking the line in the Pages editor is reflected on the Tasks tab via the store', async ({ page }) => {
  await seed(page, 'pages/edit-here', '- [ ] alpha\n- [ ] beta')
  await connectViaStorage(page)

  // Warm the Tasks tab first — both lines are loose.
  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()
  await expect(
    page.locator('[data-testid="loose-row"][data-path="pages/edit-here"]'),
  ).toHaveCount(2)

  // Check 'alpha' where it lives — inside the Pages editor.
  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/edit-here'))
  await expect(page.locator('.page-prose')).toBeVisible()
  await page
    .locator('.page-prose li')
    .filter({ hasText: 'alpha' })
    .locator('input[type="checkbox"]')
    .click()
  // (Trailing-newline drift is the Pages editor's own serializer at doc end —
  // out of scope here; the loose-task writes are the byte-stable ones.)
  await expect
    .poll(async () => (await savedContent(page, 'pages/edit-here')).replace(/\n+$/, ''))
    .toBe('- [x] alpha\n- [ ] beta')

  // Back on the Tasks tab the store's fresher note body wins — alpha is done
  // and gone, beta still stands. No corpus re-fetch needed within the window.
  await page.goto('http://127.0.0.1:4173/#/tasks')
  await expect(
    page.locator('[data-testid="loose-row"][data-path="pages/edit-here"]'),
  ).toHaveCount(1)
  await expect(page.getByTestId('tasks-loose')).toContainText('beta')
  await expect(page.getByTestId('tasks-loose')).not.toContainText('alpha')
})

test('exclusions — weekly surfaces and locked notes never surface their checkboxes', async ({ page }) => {
  await seed(
    page,
    'desk/weekly/template',
    '# Weekly Template\n\n- [ ] weekly ritual line\n- [ ] second ritual line',
  )
  await seed(page, 'pages/sacred', '# Sacred\n\n- [ ] locked line', [], { locked: true })
  await seed(page, 'pages/normal', '- [ ] the only loose line')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()

  const looseSection = page.getByTestId('tasks-loose')
  await expect(looseSection.getByTestId('loose-row')).toHaveCount(1)
  await expect(looseSection).toContainText('the only loose line')
  await expect(page.getByText('weekly ritual line')).toHaveCount(0)
  await expect(page.getByText('locked line')).toHaveCount(0)
})

test('promote — ↗ to amanda mints the row (due + provenance), rewrites the line to a pointer, and the row is filed everywhere', async ({ page }) => {
  const tomorrow = ymd(daysFromNow(1))
  const lines = [
    '# Gig Prep', // 0
    '', // 1
    `- [ ] Book the hall 📅 ${tomorrow}`, // 2
    '', // 3
    'closing prose', // 4
  ]
  await seedAmandaProject(page)
  await seed(page, 'pages/gig-prep', lines.join('\n'))
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()
  const row = page.locator('[data-testid="loose-row"][data-path="pages/gig-prep"]')
  await expect(row).toBeVisible()
  await row.hover()
  await row.getByTestId('loose-promote').click()
  await page.locator('[data-testid="promote-dest"][data-dest="amanda"]').click()

  // (a) the minted row: house createTask path — title from the line's text,
  // due carried over, filed to amanda, provenance backlink as the last line.
  await expect
    .poll(async () => Boolean(await mockNote(page, 'tasks/amanda/book-the-hall')))
    .toBe(true)
  const minted = await mockNote(page, 'tasks/amanda/book-the-hall')
  expect(minted.tags).toContain('task')
  expect(minted.metadata.project).toBe('amanda')
  expect(minted.metadata.state).toBe('next')
  expect(minted.metadata.when).toBe('later')
  expect(minted.metadata.due).toBe(tomorrow)
  expect(minted.metadata.done).toBe(false)
  expect(minted.content).toBe('Book the hall\n\nfrom [[pages/gig-prep]]')

  // (b) ownership transferred: the source line is a pointer now, not a
  // checkbox — and every other byte of the note survived.
  const expected = [...lines]
  expected[2] = '- ➜ [[tasks/amanda/book-the-hall]]'
  await expect
    .poll(() => savedContent(page, 'pages/gig-prep'))
    .toBe(expected.join('\n'))

  // The loose row is gone; the ROW now lives in the amanda world group.
  await expect(row).toHaveCount(0)
  await expect(page.locator('[data-group="amanda"]')).toContainText('Book the hall')

  // And the Tracker sees it — it's filed (Adam's law satisfied by promotion).
  await page.goto('http://127.0.0.1:4173/#/tracker')
  await expect(page.locator('.db-title')).toHaveText('Tracker')
  await expect(page.locator('body')).toContainText('Book the hall')

  expect(errors, errors.join('\n')).toEqual([])
})
