// THE TASKS TAB — the Craft-style daily driver (#/tasks): chip lenses
// (Inbox · Today · Week · All), world grouping, the agenda, the
// quick-create bar with its MonthPicker, and the source-chip doors. Also
// pins Adam's law (2026-07-14): unfiled (inbox) tasks NEVER reach the
// Tracker — filing to a world is the promotion gesture.
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
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const seedAmandaProject = (page: Page) =>
  seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x',
  })

const chips = (page: Page) => page.getByTestId('tasks-chips')

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('chips filter — unfiled lives in Inbox only, choice persists, and the Tracker never sees it', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/inbox/loose-thought', 'Capture the loose thought', ['task'], {
    state: 'next', when: 'later', done: false,
  })
  await seed(page, 'tasks/amanda/shoot', 'Shoot the photos', ['task'], {
    project: 'amanda', state: 'active', when: 'later', done: false,
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await expect(page.getByTestId('tasks-view')).toBeVisible()

  // Inbox = only the project-less task, wearing a quiet 'Inbox' source chip.
  await chips(page).getByRole('tab', { name: 'Inbox' }).click()
  await expect(page.getByText('Capture the loose thought')).toBeVisible()
  await expect(page.getByText('Shoot the photos')).toHaveCount(0)
  const looseRow = page.locator('[data-path="tasks/inbox/loose-thought"]')
  await expect(looseRow.getByTestId('task-src')).toHaveText('Inbox')

  // All = Inbox group first, then the world group with its filed task.
  await chips(page).getByRole('tab', { name: 'All' }).click()
  const groups = page.getByTestId('tasks-group')
  await expect(groups.first()).toHaveAttribute('data-group', 'inbox')
  await expect(page.locator('[data-group="inbox"]')).toContainText('Capture the loose thought')
  await expect(page.locator('[data-group="amanda"]')).toContainText('Shoot the photos')
  await expect(page.locator('[data-group="amanda"]').getByTestId('tasks-group-head')).toContainText('Amanda')

  // The chip choice persists across a reload (localStorage).
  await chips(page).getByRole('tab', { name: 'Inbox' }).click()
  await page.reload()
  await expect(chips(page).getByRole('tab', { name: 'Inbox' })).toHaveClass(/is-on/)
  await expect(page.getByText('Capture the loose thought')).toBeVisible()
  await expect(page.getByText('Shoot the photos')).toHaveCount(0)

  // Adam's law: the Tracker shows the filed row and NEVER the unfiled one.
  await page.goto('http://127.0.0.1:4173/#/tracker')
  await expect(page.locator('.db-title')).toHaveText('Tracker')
  await expect(page.locator('body')).toContainText('Shoot the photos')
  await expect(page.locator('body')).not.toContainText('Capture the loose thought')

  expect(errors, errors.join('\n')).toEqual([])
})

test('Today — unfiled under the Inbox header first, amanda task under its world header', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/inbox/call-venue', 'Call the venue', ['task'], {
    state: 'next', when: 'today', done: false,
  })
  await seed(page, 'tasks/amanda/caption-pass', 'Caption pass', ['task'], {
    project: 'amanda', state: 'active', when: 'today', done: false,
  })
  // Due-today pulls onto the day even though its when-word says later —
  // the same merged rule the Cockpit's TodayStrip uses.
  await seed(page, 'tasks/amanda/due-pull', 'Deliver the rough cut', ['task'], {
    project: 'amanda', state: 'active', when: 'later', done: false, due: ymd(new Date()),
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Today' }).click()

  const groups = page.getByTestId('tasks-group')
  await expect(groups.first()).toHaveAttribute('data-group', 'inbox')
  const inbox = page.locator('[data-group="inbox"]')
  await expect(inbox.getByTestId('tasks-group-head')).toContainText('Inbox')
  await expect(inbox).toContainText('Call the venue')

  const amanda = page.locator('[data-group="amanda"]')
  await expect(amanda.getByTestId('tasks-group-head')).toContainText('Amanda')
  await expect(amanda).toContainText('Caption pass')
  await expect(amanda).toContainText('Deliver the rough cut')

  // A world header is a door — it opens the world page.
  await amanda.getByTestId('tasks-group-head').click()
  await expect(page).toHaveURL(/#\/project\/projects%2Famanda/)
})

test('Week runway — calm-red Overdue, Tomorrow section, and an empty near day still renders', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/final-cut', 'Deliver the final cut', ['task'], {
    project: 'amanda', state: 'active', when: 'later', done: false, due: ymd(daysFromNow(-2)),
  })
  await seed(page, 'tasks/inbox/master-mix', 'Master the mix', ['task'], {
    state: 'next', when: 'later', done: false, due: ymd(daysFromNow(1)),
  })
  await seed(page, 'tasks/inbox/sort-samples', 'Sort the samples', ['task'], {
    state: 'next', when: 'this-week', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Week' }).click()

  // Overdue leads, in the calm-red tone — a section, never a banner.
  const overdue = page.locator('[data-day="overdue"]')
  await expect(overdue.getByTestId('tasks-day-head')).toHaveText('Overdue')
  await expect(overdue.getByTestId('tasks-day-head')).toHaveClass(/is-overdue/)
  await expect(overdue).toContainText('Deliver the final cut')
  await expect(page.locator('[role="alert"]')).toHaveCount(0)

  // Tomorrow's section holds tomorrow's task.
  const tomorrow = page.locator(`[data-day="${ymd(daysFromNow(1))}"]`)
  await expect(tomorrow.getByTestId('tasks-day-head')).toHaveText('Tomorrow')
  await expect(tomorrow).toContainText('Master the mix')

  // Day +4 holds nothing — its header STILL renders, over a quiet dash.
  const quiet = page.locator(`[data-day="${ymd(daysFromNow(4))}"]`)
  await expect(quiet.getByTestId('tasks-day-head')).toHaveText(longLabel(daysFromNow(4)))
  await expect(quiet.locator('.tasks-day-empty')).toHaveText('—')

  // The old 'This week — no date' trailing section is GONE — the undated
  // this-week task now lives in the This week ZONE at the top instead.
  await expect(page.locator('[data-day="this-week"]')).toHaveCount(0)
  await expect(page.locator('[data-zone="this-week"]')).toContainText('Sort the samples')
})

test('quick-create — default chip says Tomorrow; Create mints tasks/inbox/<slug>, due tomorrow, NO project key', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await expect(page.getByTestId('qc-bar')).toBeVisible()
  await expect(page.getByTestId('qc-due-chip')).toHaveText('Tomorrow')

  await page.getByTestId('qc-input').fill('Send the invoices')
  await page.getByTestId('qc-input').press('Enter')

  await expect
    .poll(async () => (await mockNote(page, 'tasks/inbox/send-the-invoices'))?.metadata?.due)
    .toBe(ymd(daysFromNow(1)))
  const note = await mockNote(page, 'tasks/inbox/send-the-invoices')
  expect(note.tags).toContain('task')
  expect('project' in note.metadata).toBe(false)
  expect(note.metadata.state).toBe('next')
  expect(note.metadata.when).toBe('later')
  expect(note.metadata.done).toBe(false)
  // The input clears for the next thought; the chip keeps its date.
  await expect(page.getByTestId('qc-input')).toHaveValue('')
})

test('MonthPicker — month nav + bullseye; picked day lands as due; Clear date mints with NO due key', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await page.getByTestId('qc-due-chip').click()
  const mp = page.getByTestId('month-picker')
  await expect(mp).toBeVisible()

  // Weekday header row + this month's title.
  await expect(mp.locator('.mp-wd').first()).toHaveText('Su')
  const now = new Date()
  const thisMonth = `${MONTHS_LONG[now.getMonth()]} ${now.getFullYear()}`
  await expect(mp.locator('.mp-title')).toHaveText(thisMonth)

  // ‹ steps away; the bullseye snaps back to the current month.
  await page.getByTestId('mp-prev').click()
  await expect(mp.locator('.mp-title')).not.toHaveText(thisMonth)
  await page.getByTestId('mp-today').click()
  await expect(mp.locator('.mp-title')).toHaveText(thisMonth)

  // TODAY wears the ring. Escape closes the popover.
  await expect(mp.locator(`[data-date="${ymd(now)}"]`)).toHaveClass(/is-today/)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('month-picker')).toHaveCount(0)

  // Pick day +4 → the chip re-labels, the selected day fills on reopen.
  const target = ymd(daysFromNow(4))
  await page.getByTestId('qc-due-chip').click()
  await page.locator(`[data-date="${target}"]`).click()
  await expect(page.getByTestId('month-picker')).toHaveCount(0)
  await expect(page.getByTestId('qc-due-chip')).toHaveText(longLabel(daysFromNow(4)))
  await page.getByTestId('qc-due-chip').click()
  await expect(page.locator(`[data-date="${target}"]`)).toHaveClass(/is-selected/)
  await page.keyboard.press('Escape')

  await page.getByTestId('qc-input').fill('Book the studio')
  await page.getByTestId('qc-create').click()
  await expect
    .poll(async () => (await mockNote(page, 'tasks/inbox/book-the-studio'))?.metadata?.due)
    .toBe(target)

  // Clear date → the chip reads 'No date' and the next mint has NO due key.
  await page.getByTestId('qc-due-chip').click()
  await page.getByTestId('mp-clear').click()
  await expect(page.getByTestId('qc-due-chip')).toHaveText('No date')
  await page.getByTestId('qc-input').fill('Walk the dog')
  await page.getByTestId('qc-input').press('Enter')
  await expect
    .poll(async () => Boolean(await mockNote(page, 'tasks/inbox/walk-the-dog')))
    .toBe(true)
  const dateless = await mockNote(page, 'tasks/inbox/walk-the-dog')
  // Never due:null / due:'' — the key is simply absent.
  expect('due' in dateless.metadata).toBe(false)
  expect(dateless.metadata.when).toBe('later')
})

test('source chip — an amanda row’s world chip opens the world page', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/shoot', 'Shoot the photos', ['task'], {
    project: 'amanda', state: 'active', when: 'later', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()
  const row = page.locator('[data-path="tasks/amanda/shoot"]')
  await expect(row.getByTestId('task-src')).toHaveText('Amanda')
  await row.getByTestId('task-src').click()
  await expect(page).toHaveURL(/#\/project\/projects%2Famanda/)
  await expect(page.getByTestId('world')).toBeVisible()
  await expect(page.locator('.world-title')).toHaveText('Amanda')
})

test('checkbox — done:true reaches the vault via the house write path and the row leaves the list', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/ship-batch', 'Ship the batch', ['task'], {
    project: 'amanda', state: 'active', when: 'later', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()
  const row = page.locator('[data-path="tasks/amanda/ship-batch"]')
  await expect(row).toBeVisible()
  await row.locator('.task-check').click()

  // The metadata-only patch lands in the vault (done + state stay in sync)…
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/ship-batch'))?.metadata?.done)
    .toBe(true)
  const note = await mockNote(page, 'tasks/amanda/ship-batch')
  expect(note.metadata.state).toBe('done')
  // …the note body was never rewritten…
  expect(note.content).toBe('Ship the batch')
  // …and after its graceful exit the row is gone (done work lives in the Tracker).
  await expect(row).toHaveCount(0)
})
