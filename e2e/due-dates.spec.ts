// Craft Phase A — real due dates. The optional `due` metadata key
// ('YYYY-MM-DD') is the fine scheduling layer under the coarse when-words:
// minting surfaces (Today picker, dock Todos, Tracker new-task) each grow a
// small due entry, the Tracker gets a Due column, and the Today checklist
// pulls in anything due today or overdue. All expected dates are computed
// from new Date() the same way the app does — never hardcoded.

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
  const res = await page.request.get(
    `${MOCK}/api/notes?id=${encodeURIComponent(path)}`,
    { headers: AUTH },
  )
  return res.ok() ? res.json() : null
}

// ——— expected dates, computed the same way src/lib/dates.ts does ———

/** Local 'YYYY-MM-DD'. */
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}
function daysFromNow(n: number): Date {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
/** The label formatDue renders for a non-today/tomorrow date. */
function longLabel(d: Date): string {
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (d.getFullYear() === new Date().getFullYear()) {
    return `${WD[d.getDay()]} ${MO[d.getMonth()]} ${d.getDate()}`
  }
  return `${MO[d.getMonth()]} ${d.getDate()} ’${String(d.getFullYear() % 100).padStart(2, '0')}`
}
/** 'friday' → the NEXT Friday, never today — the parser's rule. */
function nextFriday(): string {
  const now = new Date()
  const delta = (5 - now.getDay() + 7) % 7 || 7
  return ymd(daysFromNow(delta))
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Today add-row — minting with due "tomorrow" writes metadata.due; chip renders Tomorrow', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const strip = page.getByTestId('today-strip')
  await strip.locator('.today-add-btn').click()

  // No task text yet → no due input either (it belongs to the create row).
  await expect(page.getByTestId('today-due-input')).toHaveCount(0)

  await strip.locator('.today-picker-input').first().fill('Master the bridge vocal')
  const dueInput = page.getByTestId('today-due-input')
  await expect(dueInput).toBeVisible()
  await dueInput.fill('tomorrow')
  await dueInput.press('Enter')

  // The picker closes only after the vault write lands — wait for that
  // before reading the mock, or the GET races the app's POST.
  await expect(strip.locator('.today-picker')).toHaveCount(0)
  // On the list with a 'Tomorrow' chip, soon-toned.
  await expect(strip.locator('.today-item')).toContainText('Master the bridge vocal')
  const chip = strip.getByTestId('today-due')
  await expect(chip).toHaveText('Tomorrow')
  await expect(chip).toHaveClass(/due-soon/)

  // The vault note carries when:today AND the fine-grain due.
  const note = await mockNote(page, 'tasks/inbox/master-the-bridge-vocal')
  expect(note).not.toBeNull()
  expect(note.metadata.when).toBe('today')
  expect(note.metadata.due).toBe(ymd(daysFromNow(1)))
})

test('Today add-row — an unparseable due entry writes NO due key at all', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const strip = page.getByTestId('today-strip')
  await strip.locator('.today-add-btn').click()
  await strip.locator('.today-picker-input').first().fill('Loose task')
  const dueInput = page.getByTestId('today-due-input')
  await dueInput.fill('whenever it rains')
  await dueInput.press('Enter')

  // Picker closed = the create round-tripped; safe to read the mock now.
  await expect(strip.locator('.today-picker')).toHaveCount(0)
  await expect(strip.locator('.today-item')).toContainText('Loose task')
  const note = await mockNote(page, 'tasks/inbox/loose-task')
  expect(note).not.toBeNull()
  expect(note.metadata.when).toBe('today')
  // Never due:null / due:'' — the key is simply absent.
  expect('due' in note.metadata).toBe(false)
})

test('Today pulls due tasks — an overdue when:later task joins the checklist, calm red chip; ✕ keeps the date', async ({ page }) => {
  const yesterday = ymd(daysFromNow(-1))
  await seed(page, 'tasks/amanda/overdue-cut', 'Deliver the final cut', ['task'], {
    project: 'amanda', state: 'active', done: false, when: 'later', due: yesterday,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const strip = page.getByTestId('today-strip')
  // Pulled onto the day by its date, even though when is 'later'.
  await expect(strip).toContainText('Deliver the final cut')
  const chip = strip.getByTestId('today-due')
  await expect(chip).toHaveClass(/due-overdue/)
  await expect(chip).toHaveText(longLabel(daysFromNow(-1)))
  // Calm red TEXT — never a nag banner.
  await expect(page.locator('.today-banner, [role="alert"]')).toHaveCount(0)

  // ✕ demotes the when-word only — the due date survives.
  await strip.locator('.today-item-x').click()
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/overdue-cut'))?.metadata?.when)
    .toBe('later')
  const note = await mockNote(page, 'tasks/amanda/overdue-cut')
  expect(note.metadata.due).toBe(yesterday)
})

test('Tracker — Due column renders formatted + toned; header sort puts empty dues last', async ({ page }) => {
  const seedTask = (slug: string, text: string, metadata: Record<string, unknown>) =>
    seed(page, `tasks/amanda/${slug}`, text, ['task'], metadata)
  await seedTask('overdue', 'The overdue one', {
    project: 'amanda', state: 'active', done: false, due: ymd(daysFromNow(-1)),
  })
  await seedTask('soon', 'The tomorrow one', {
    project: 'amanda', state: 'next', done: false, due: ymd(daysFromNow(1)),
  })
  await seedTask('dateless', 'The dateless one', {
    project: 'amanda', state: 'next', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tracker')
  await expect(page.locator('.db-title')).toHaveText('Tracker')
  const table = page.locator('.db-table')
  await expect(table.locator('th', { hasText: 'Due' })).toBeVisible()

  // Formatted, toned cells: overdue = calm red, tomorrow reads 'Tomorrow'.
  const overdueCell = table.locator('.due-cell.due-overdue')
  await expect(overdueCell).toHaveText(longLabel(daysFromNow(-1)))
  await expect(table.locator('.due-cell.due-soon')).toHaveText('Tomorrow')
  // The dateless row shows a quiet dash.
  await expect(table.locator('.due-cell.due-unset')).toHaveText('—')

  // Header click sorts by due ascending; the empty due sinks to the bottom.
  await table.locator('.th-btn', { hasText: 'Due' }).click()
  const titles = table.locator('tbody .cell-title-text')
  await expect(titles.nth(0)).toHaveText('The overdue one')
  await expect(titles.nth(1)).toHaveText('The tomorrow one')
  await expect(titles.nth(2)).toHaveText('The dateless one')
})

test('Tracker new-task + dock todo — both mint with a parsed due ("friday" → next Friday)', async ({ page }) => {
  await seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x',
  })
  await connectViaStorage(page)
  const friday = nextFriday()
  const today = ymd(new Date())

  // ——— Tracker's New task form ———
  await page.goto('http://127.0.0.1:4173/#/tracker')
  await page.getByTestId('tracker-new-task').click()
  const form = page.getByTestId('tracker-new-task-form')
  await expect(form).toBeVisible()
  await form.locator('.db-newtask-project').selectOption('amanda')
  await form.locator('.db-newtask-title').fill('Book the mastering slot')
  await page.getByTestId('newtask-due').fill('friday')
  await form.locator('button', { hasText: 'Create' }).click()
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/book-the-mastering-slot'))?.metadata?.due)
    .toBe(friday)

  // ——— Dock Todos → File to project ———
  await page.locator('.dock-fab-main').click()
  await page.locator('.dock-tab', { hasText: 'Todos' }).click()
  await page.locator('.dock-input').first().fill('Send the stems to Aaron')
  await page.keyboard.press('Enter')
  await page.getByTestId('todo-to-project').first().click()
  await expect(page.getByTestId('todo-assign')).toBeVisible()
  await page.getByTestId('todo-due-input').fill('friday')
  await page.getByTestId('todo-assign').locator('button', { hasText: 'File' }).click()

  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/send-the-stems-to-aaron'))?.metadata?.due)
    .toBe(friday)
  const due = (await mockNote(page, 'tasks/amanda/send-the-stems-to-aaron')).metadata.due as string
  // A valid calendar key, never in the past ('friday' means the NEXT one).
  expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(due >= today).toBe(true)
})
