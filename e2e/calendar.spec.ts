// THE CALENDAR LENS — the Tasks tab's fifth chip (#/tasks → Calendar):
//  · the month grid places not-done row tasks (metadata.due) and not-done
//    loose 📅 lines in their day cells; past days wear the calm-red overdue
//    tone; done tasks never render; 4+ on a day → three chips and a '+N';
//  · tapping a day fills its number and lists the day under the grid in the
//    house row anatomy — checking one off writes done:true and it leaves
//    the cell;
//  · with a day selected, quick-create mints due = THAT day (Tomorrow
//    default restored when the selection clears);
//  · drag a task chip onto another day cell → the vault due is rewritten
//    (metadata.due for rows, the 📅 token for loose lines); a cancelled
//    drag writes NOTHING;
//  · month nav: prev/next arrows move, the bullseye returns to today.

import { test, expect, type Locator, type Page } from '@playwright/test'

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
const day = (n: number) => ymd(daysFromNow(n))
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
/** 'July 2026'-style title for the month `offset` months from now. */
function monthTitle(offset: number): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`
}

const seedAmandaProject = (page: Page) =>
  seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x',
  })

const chips = (page: Page) => page.getByTestId('tasks-chips')
const cell = (page: Page, d: string) =>
  page.locator(`[data-testid="cal-cell"][data-date="${d}"]`)

async function openCalendar(page: Page) {
  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Calendar' }).click()
  await expect(page.getByTestId('task-calendar')).toBeVisible()
}

/** A recent-past day can fall before the current month's 42-cell grid when
 * today sits at the very start of the month — step back one month then. */
async function ensureCellVisible(page: Page, d: string): Promise<Locator> {
  if ((await cell(page, d).count()) === 0) {
    await page.getByTestId('cal-prev').click()
  }
  const c = cell(page, d)
  await expect(c).toBeVisible()
  return c
}

// ——— native HTML5 DnD — the same dispatch trick as the tasks-polish suite:
// hand-dispatch the real event sequence with ONE shared DataTransfer. ———

async function dragDrop(page: Page, source: Locator, target: Locator) {
  const src = await source.elementHandle()
  const tgt = await target.elementHandle()
  if (!src || !tgt) throw new Error('drag endpoints not found')
  await page.evaluate(
    ({ src, tgt }) => {
      const dt = new DataTransfer()
      const r = tgt.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = r.top + r.height / 2
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: x,
            clientY: y,
          }),
        )
      fire(src, 'dragstart')
      fire(tgt, 'dragenter')
      fire(tgt, 'dragover')
      fire(tgt, 'drop')
      fire(src, 'dragend')
    },
    { src, tgt },
  )
}

/** A drag that never lands: start, hover a cell, then let go OUTSIDE any
 * drop target (Escape / dropped elsewhere). No drop event ever fires. */
async function dragCancel(page: Page, source: Locator, hover: Locator) {
  const src = await source.elementHandle()
  const tgt = await hover.elementHandle()
  if (!src || !tgt) throw new Error('drag endpoints not found')
  await page.evaluate(
    ({ src, tgt }) => {
      const dt = new DataTransfer()
      const r = tgt.getBoundingClientRect()
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
          }),
        )
      fire(src, 'dragstart')
      fire(tgt, 'dragenter')
      fire(tgt, 'dragover')
      fire(src, 'dragend') // cancelled — no drop anywhere
    },
    { src, tgt },
  )
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

// ————————————————————————— the grid tells the truth —————————————————————————

test('month grid — row task, loose 📅 line and overdue land in their cells; overdue wears the calm red; done is absent; the chip persists', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/rehearse', 'Rehearse the set', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false, due: day(1),
  })
  await seed(page, 'tasks/amanda/invoice', 'Send the invoice', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false, due: day(-2),
  })
  await seed(page, 'tasks/amanda/shipped', 'Already shipped thing', ['task'], {
    project: 'amanda', state: 'done', when: 'later', done: true, due: day(1),
  })
  await seed(page, 'pages/gig-prep', `# Gig Prep\n\n- [ ] print setlists 📅 ${day(2)}`, ['type/page'], {})
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openCalendar(page)

  // Tomorrow's cell holds the row task; day-after holds the loose line
  // (its chip is the stripped text — never the raw 📅 token).
  await expect(cell(page, day(1))).toContainText('Rehearse the set')
  const looseChip = cell(page, day(2)).getByTestId('cal-chip')
  await expect(looseChip).toHaveText('print setlists')

  // Done tasks don't render — the grid shows only open work.
  await expect(page.getByTestId('cal-grid')).not.toContainText('Already shipped thing')

  // The past told truthfully: the overdue row sits on its day in calm red.
  const overdueCell = await ensureCellVisible(page, day(-2))
  await expect(overdueCell.locator('.cal-chip.is-overdue')).toHaveText('Send the invoice')

  // The Calendar chip persists like its four siblings (localStorage).
  await page.reload()
  await expect(chips(page).getByRole('tab', { name: 'Calendar' })).toHaveClass(/is-on/)
  await expect(page.getByTestId('task-calendar')).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

test('overflow — a day holding 4 tasks shows 3 tiny titles and a +1 marker; an empty day stays clean', async ({ page }) => {
  await seedAmandaProject(page)
  for (const slug of ['one', 'two', 'three', 'four']) {
    await seed(page, `tasks/amanda/${slug}`, `Busy day ${slug}`, ['task'], {
      project: 'amanda', state: 'next', when: 'later', done: false, due: day(3),
    })
  }
  await connectViaStorage(page)

  await openCalendar(page)
  const busy = cell(page, day(3))
  await expect(busy.getByTestId('cal-chip')).toHaveCount(3)
  await expect(busy.getByTestId('cal-more')).toHaveText('+1')

  // A day with nothing shows nothing — no dots, no zero-noise.
  const quiet = cell(page, day(4))
  await expect(quiet.getByTestId('cal-chip')).toHaveCount(0)
  await expect(quiet.getByTestId('cal-more')).toHaveCount(0)
})

// ————————————————————————— the day panel —————————————————————————

test('tap a day — its number fills, the panel lists the day in house row anatomy; checking one writes done:true and it leaves the cell', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/rehearse', 'Rehearse the set', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false, due: day(1),
  })
  await connectViaStorage(page)

  await openCalendar(page)

  // Nothing selected → the panel defaults to today.
  await expect(page.getByTestId('cal-panel')).toHaveAttribute('data-day', day(0))

  await cell(page, day(1)).click()
  await expect(cell(page, day(1))).toHaveClass(/is-selected/)
  const panel = page.getByTestId('cal-panel')
  await expect(panel).toHaveAttribute('data-day', day(1))

  // The house row anatomy, verbatim: checkbox, due-edit button, source chip.
  const row = panel.getByTestId('task-row')
  await expect(row).toContainText('Rehearse the set')
  await expect(row.getByTestId('row-due-edit')).toBeVisible()
  await expect(row.getByTestId('task-src')).toHaveText('Amanda')

  // Check it off → done:true reaches the vault and the chip leaves the cell.
  await row.locator('.task-check').check()
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/rehearse'))?.metadata?.done)
    .toBe(true)
  await expect(cell(page, day(1)).getByTestId('cal-chip')).toHaveCount(0)
})

test('the panel edits dates in place — row-due-edit opens the MonthPicker and rewrites metadata.due', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/rehearse', 'Rehearse the set', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false, due: day(1),
  })
  await connectViaStorage(page)

  await openCalendar(page)
  await cell(page, day(1)).click()

  // The accessible path to rescheduling — no drag required.
  await page.getByTestId('cal-panel').getByTestId('row-due-edit').click()
  await expect(page.getByTestId('month-picker')).toBeVisible()
  await page.getByTestId('month-picker').locator(`[data-date="${day(4)}"]`).click()
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/rehearse'))?.metadata?.due)
    .toBe(day(4))
  await expect(cell(page, day(4))).toContainText('Rehearse the set')
})

// ————————————————————————— quick-create synergy —————————————————————————

test('with a day selected, quick-create mints due = that day; clearing the selection restores Tomorrow', async ({ page }) => {
  await connectViaStorage(page)

  await openCalendar(page)
  await expect(page.getByTestId('qc-due-chip')).toHaveText('Tomorrow')

  // Select day +5 → the date chip re-labels to that day…
  await cell(page, day(5)).click()
  await expect(page.getByTestId('qc-due-chip')).toHaveText(longLabel(daysFromNow(5)))

  // …and the mint carries it as metadata.due.
  await page.getByTestId('qc-input').fill('Book the studio')
  await page.getByTestId('qc-input').press('Enter')
  await expect
    .poll(async () => (await mockNote(page, 'tasks/inbox/book-the-studio'))?.metadata?.due)
    .toBe(day(5))
  // The fresh mint shows up in its cell right away.
  await expect(cell(page, day(5))).toContainText('Book the studio')

  // Tapping the selected day again clears the selection → Tomorrow returns.
  await cell(page, day(5)).click()
  await expect(cell(page, day(5))).not.toHaveClass(/is-selected/)
  await expect(page.getByTestId('qc-due-chip')).toHaveText('Tomorrow')
})

// ————————————————————————— visual scheduling: drag onto a day —————————————————————————

test('drag a row task chip onto another day — metadata.due is rewritten; a cancelled drag writes NOTHING', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/rehearse', 'Rehearse the set', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false, due: day(1),
  })
  await connectViaStorage(page)

  await openCalendar(page)
  const chip = cell(page, day(1)).getByTestId('cal-chip')
  await expect(chip).toBeVisible()

  // Drop on day +4 → the due moves in the vault and on the grid.
  await dragDrop(page, chip, cell(page, day(4)))
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/rehearse'))?.metadata?.due)
    .toBe(day(4))
  await expect(cell(page, day(4))).toContainText('Rehearse the set')
  await expect(cell(page, day(1)).getByTestId('cal-chip')).toHaveCount(0)

  // A cancelled drag (let go outside any cell) writes NOTHING.
  await dragCancel(page, cell(page, day(4)).getByTestId('cal-chip'), cell(page, day(2)))
  await expect(cell(page, day(2))).not.toHaveClass(/is-drop/)
  await page.waitForTimeout(250)
  expect((await mockNote(page, 'tasks/amanda/rehearse')).metadata.due).toBe(day(4))
})

test('drag a loose line from the day panel onto a day cell — the 📅 token is rewritten surgically', async ({ page }) => {
  const body = `# Gig Prep\n\nstrings first\n\n- [ ] print setlists 📅 ${day(2)}`
  await seed(page, 'pages/gig-prep', body, ['type/page'], {})
  await connectViaStorage(page)

  await openCalendar(page)
  await cell(page, day(2)).click()
  const panel = page.getByTestId('cal-panel')
  await expect(panel.getByTestId('loose-row')).toContainText('print setlists')

  // Drag the panel row (its draggable wrapper) onto day +5.
  await dragDrop(page, panel.locator('.cal-drag'), cell(page, day(5)))
  await expect
    .poll(async () => (await mockNote(page, 'pages/gig-prep'))?.content)
    .toBe(`# Gig Prep\n\nstrings first\n\n- [ ] print setlists 📅 ${day(5)}`)
  await expect(cell(page, day(5))).toContainText('print setlists')
})

// ————————————————————————— month navigation —————————————————————————

test('month nav — prev/next arrows move the view; the bullseye returns to today’s month', async ({ page }) => {
  await connectViaStorage(page)

  await openCalendar(page)
  const title = page.getByTestId('cal-title')
  await expect(title).toHaveText(monthTitle(0))
  // Today wears its ring only in its own month.
  await expect(cell(page, day(0))).toHaveClass(/is-today/)

  await page.getByTestId('cal-next').click()
  await expect(title).toHaveText(monthTitle(1))

  await page.getByTestId('cal-prev').click()
  await page.getByTestId('cal-prev').click()
  await expect(title).toHaveText(monthTitle(-1))

  await page.getByTestId('cal-today').click()
  await expect(title).toHaveText(monthTitle(0))
  await expect(cell(page, day(0))).toBeVisible()
})
