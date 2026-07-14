// WEEK + FIND-INTO-TODAY — Adam's week-centric redesign of the Tasks tab:
//  · the Upcoming chip is now WEEK, two zones over the one task pool:
//    THIS WEEK (every open when:"this-week" row, grouped per world,
//    reorderable) above THE RUNWAY (the dated agenda, unchanged);
//  · a dated this-week task appears in BOTH zones (committed AND time-fixed);
//  · the old 'This week — no date' trailing agenda section is gone;
//  · the Today chip's quick-create bar is write-OR-find: typing surfaces
//    matching open tasks (this-week ranked first — the shared TodayStrip
//    ranking); picking one writes when:"today" and pulls it onto the day.
// All expected dates are computed from new Date() — never hardcoded.

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

/** Local 'YYYY-MM-DD' — same rule as src/lib/dates.ts. */
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

// ——— native HTML5 DnD — the tasks-polish/worktabs dispatch trick:
// hand-dispatch the real event sequence with ONE shared DataTransfer. ———

async function dragDrop(page: Page, source: Locator, target: Locator, pos: 'top' | 'bottom') {
  const src = await source.elementHandle()
  const tgt = await target.elementHandle()
  if (!src || !tgt) throw new Error('drag endpoints not found')
  await page.evaluate(
    ({ src, tgt, pos }) => {
      const dt = new DataTransfer()
      const r = tgt.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = pos === 'top' ? r.top + 2 : r.bottom - 2
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
    { src, tgt, pos },
  )
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

// ————————————————————————— WEEK: the two zones —————————————————————————

test('Week zone A — a when:this-week undated task sits under its world; the old trailing section is gone', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/sort-samples', 'Sort the samples', ['task'], {
    project: 'amanda', state: 'next', when: 'this-week', done: false,
  })
  // A non-blessed task stays OUT of zone A (undated → not on the runway either).
  await seed(page, 'tasks/amanda/someday', 'Someday sketch', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false,
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Week' }).click()

  // Two zones, in order: This week (with its count) above The runway.
  const zoneHeads = page.getByTestId('tasks-zone-head')
  await expect(zoneHeads).toHaveCount(2)
  await expect(zoneHeads.nth(0)).toContainText('This week')
  await expect(zoneHeads.nth(0)).toContainText('1')
  await expect(zoneHeads.nth(1)).toHaveText('The runway')

  // Zone A: the blessed task under its world header — full row anatomy
  // (checkbox, hover date affordance, source chip), and draggable.
  const zoneA = page.locator('[data-zone="this-week"]')
  const amanda = zoneA.locator('[data-group="amanda"]')
  await expect(amanda.getByTestId('tasks-group-head')).toContainText('Amanda')
  const row = amanda.locator('[data-path="tasks/amanda/sort-samples"]')
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute('draggable', 'true')
  await expect(row.locator('.task-check')).toBeVisible()
  await expect(row.getByTestId('task-src')).toHaveText('Amanda')
  await row.hover()
  await expect(row.getByTestId('row-due-set')).toBeVisible()
  // The unblessed task never enters the zone.
  await expect(zoneA).not.toContainText('Someday sketch')

  // The old 'This week — no date' trailing agenda section is GONE.
  await expect(page.locator('[data-day="this-week"]')).toHaveCount(0)
  await expect(page.getByText('This week — no date')).toHaveCount(0)

  expect(errors, errors.join('\n')).toEqual([])
})

test('Week — a DATED this-week task appears in BOTH zones (committed AND time-fixed)', async ({ page }) => {
  await seedAmandaProject(page)
  const due = ymd(daysFromNow(2))
  await seed(page, 'tasks/amanda/mix-single', 'Mix the single', ['task'], {
    project: 'amanda', state: 'active', when: 'this-week', done: false, due,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Week' }).click()

  // Zone A holds it (blessed), wearing its due label…
  const zoneA = page.locator('[data-zone="this-week"]')
  const zoneARow = zoneA.locator('[data-path="tasks/amanda/mix-single"]')
  await expect(zoneARow).toBeVisible()
  await expect(zoneARow.getByTestId('task-due')).toHaveText(/./)

  // …AND the runway holds it under its day — deliberate double appearance.
  const runwayDay = page.locator(`[data-zone="runway"] [data-day="${due}"]`)
  await expect(runwayDay.locator('[data-path="tasks/amanda/mix-single"]')).toBeVisible()
})

test('Week zone A reorder — 10-spaced metadata.order lands in the vault and survives reload', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/alpha', 'Alpha edit', ['task'], {
    project: 'amanda', state: 'next', when: 'this-week', done: false,
  })
  await seed(page, 'tasks/amanda/bravo', 'Bravo edit', ['task'], {
    project: 'amanda', state: 'next', when: 'this-week', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Week' }).click()
  const rows = page
    .locator('[data-zone="this-week"] [data-group="amanda"]')
    .getByTestId('task-row')
  await expect(rows.locator('.task-row-title')).toHaveText(['Alpha edit', 'Bravo edit'])

  // Bravo above Alpha → the zone reflects it instantly…
  await dragDrop(
    page,
    rows.filter({ hasText: 'Bravo edit' }),
    rows.filter({ hasText: 'Alpha edit' }),
    'top',
  )
  await expect(rows.locator('.task-row-title')).toHaveText(['Bravo edit', 'Alpha edit'])

  // …and the 10-spaced order landed on the task notes in the vault.
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/bravo'))?.metadata?.order)
    .toBe(10)
  expect((await mockNote(page, 'tasks/amanda/alpha')).metadata.order).toBe(20)

  // Survives a full reload (re-derived from the vault, not local state).
  await page.reload()
  await expect(
    page
      .locator('[data-zone="this-week"] [data-group="amanda"]')
      .getByTestId('task-row')
      .locator('.task-row-title'),
  ).toHaveText(['Bravo edit', 'Alpha edit'])
})

// ———————————————————— FIND-INTO-TODAY (the Today chip) ————————————————————

test('Today find bar — typing surfaces matches (this-week first); picking writes when:today and the row joins the day', async ({ page }) => {
  await seedAmandaProject(page)
  // Two tasks share the 'mix' substring — the this-week one must rank first
  // even though the later one was created before it.
  await seed(page, 'tasks/amanda/mix-interlude', 'Mix the interlude', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false,
  })
  await seed(page, 'tasks/amanda/mix-single', 'Mix the single', ['task'], {
    project: 'amanda', state: 'next', when: 'this-week', done: false,
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Today' }).click()

  // Type ≥2 chars → the dropdown floats above the bar, this-week first,
  // each row carrying its world chip.
  await page.getByTestId('qc-input').fill('mix')
  const find = page.getByTestId('qc-find')
  await expect(find).toBeVisible()
  const items = find.getByTestId('qc-find-item')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toHaveAttribute('data-path', 'tasks/amanda/mix-single')
  await expect(items.nth(0).locator('.task-src')).toHaveText('Amanda')

  // Pick → when:"today" lands in the vault; due stays untouched (absent).
  await items.nth(0).click()
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/mix-single'))?.metadata?.when)
    .toBe('today')
  const note = await mockNote(page, 'tasks/amanda/mix-single')
  expect('due' in note.metadata).toBe(false)

  // The dropdown closes, the input clears, and the row now sits in the
  // Today list under its world.
  await expect(find).toHaveCount(0)
  await expect(page.getByTestId('qc-input')).toHaveValue('')
  await expect(
    page.locator('[data-group="amanda"] [data-path="tasks/amanda/mix-single"]'),
  ).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

test('Today find bar — gibberish shows no dropdown and Create still mints; other chips stay pure-create', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/mix-single', 'Mix the single', ['task'], {
    project: 'amanda', state: 'next', when: 'this-week', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Today' }).click()

  // No match → no dropdown; Create mints exactly as before (Inbox default,
  // Tomorrow date-chip default).
  await page.getByTestId('qc-input').fill('Zanzibar drills')
  await expect(page.getByTestId('qc-find')).toHaveCount(0)
  await page.getByTestId('qc-create').click()
  await expect
    .poll(async () => Boolean(await mockNote(page, 'tasks/inbox/zanzibar-drills')))
    .toBe(true)
  const minted = await mockNote(page, 'tasks/inbox/zanzibar-drills')
  expect(minted.tags).toContain('task')
  expect('project' in minted.metadata).toBe(false)
  expect(minted.metadata.due).toBe(ymd(daysFromNow(1)))

  // On a non-Today chip the same matching text raises NO dropdown — the bar
  // is pure-create everywhere but Today.
  await chips(page).getByRole('tab', { name: 'All' }).click()
  await page.getByTestId('qc-input').fill('mix')
  await expect(page.getByTestId('qc-find')).toHaveCount(0)
})

test('Today find bar — Escape closes the dropdown, the input keeps its text, typing reopens', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/mix-single', 'Mix the single', ['task'], {
    project: 'amanda', state: 'next', when: 'this-week', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Today' }).click()

  await page.getByTestId('qc-input').fill('mix')
  await expect(page.getByTestId('qc-find')).toBeVisible()

  // Escape: the dropdown goes, the typed thought stays.
  await page.getByTestId('qc-input').press('Escape')
  await expect(page.getByTestId('qc-find')).toHaveCount(0)
  await expect(page.getByTestId('qc-input')).toHaveValue('mix')

  // Any further keystroke un-parks the finder.
  await page.getByTestId('qc-input').press('t')
  await expect(page.getByTestId('qc-find')).toHaveCount(0) // 'mixt' matches nothing
  await page.getByTestId('qc-input').fill('mix')
  await expect(page.getByTestId('qc-find')).toBeVisible()
})
