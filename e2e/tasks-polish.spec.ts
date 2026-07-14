// THE POLISH PASS — Tasks tab row affordances:
//  · row-level dates: the hover calendar (row-due-set) on dateless rows, the
//    due label as its own edit button (row-due-edit), Clear date REMOVES the
//    key (row) / strips the 📅 token (loose line) — never due:null/''.
//  · drag-reorder within a group → 10-spaced metadata.order (WorkTabs law);
//  · drag-to-file across groups (All/Today) → metadata.project re-files the
//    row, and Tracker inclusion follows from Adam's law (isFiledTask);
//  · a cancelled drag writes NOTHING.

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

// ——— native HTML5 DnD — the same dispatch trick as the worktabs suite:
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

/** A drag that never lands: start, hover a slot, then let go OUTSIDE any
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
            clientY: r.top + 2,
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

// ————————————————————————— drag: reorder —————————————————————————

test('reorder two amanda rows — 10-spaced metadata.order lands in the vault and survives reload', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/alpha', 'Alpha edit', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false,
  })
  await seed(page, 'tasks/amanda/bravo', 'Bravo edit', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false,
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()
  const rows = page.locator('[data-group="amanda"]').getByTestId('task-row')
  await expect(rows.locator('.task-row-title')).toHaveText(['Alpha edit', 'Bravo edit'])

  // Bravo above Alpha → the group reflects it instantly…
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
    page.locator('[data-group="amanda"]').getByTestId('task-row').locator('.task-row-title'),
  ).toHaveText(['Bravo edit', 'Alpha edit'])

  expect(errors, errors.join('\n')).toEqual([])
})

// ————————————————————————— drag: re-file —————————————————————————

test('drag an inbox row into the amanda group — project=amanda lands in the vault; the row reaches the Tracker', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/inbox/stray-thought', 'File the stray thought', ['task'], {
    state: 'next', when: 'later', done: false,
  })
  await seed(page, 'tasks/amanda/anchor', 'Anchor task', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()
  const stray = page.locator('[data-path="tasks/inbox/stray-thought"]')
  await expect(stray).toBeVisible()

  // The physical promotion gesture: drop the unfiled row into the world group.
  await dragDrop(page, stray, page.locator('[data-path="tasks/amanda/anchor"]'), 'bottom')
  await expect
    .poll(async () => (await mockNote(page, 'tasks/inbox/stray-thought'))?.metadata?.project)
    .toBe('amanda')

  // The row now lives in the amanda group on the Tasks tab…
  await expect(page.locator('[data-group="amanda"]')).toContainText('File the stray thought')

  // …and Adam's law follows: filed → visible to the Tracker.
  await page.goto('http://127.0.0.1:4173/#/tracker')
  await expect(page.locator('.db-title')).toHaveText('Tracker')
  await expect(page.locator('body')).toContainText('File the stray thought')
})

// ————————————————————————— drag: cancel —————————————————————————

test('cancelled drag — indicator clears, order stays, NOTHING is written', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/alpha', 'Alpha edit', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false,
  })
  await seed(page, 'tasks/amanda/bravo', 'Bravo edit', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()
  const rows = page.locator('[data-group="amanda"]').getByTestId('task-row')
  await expect(rows.locator('.task-row-title')).toHaveText(['Alpha edit', 'Bravo edit'])

  await dragCancel(
    page,
    rows.filter({ hasText: 'Bravo edit' }),
    rows.filter({ hasText: 'Alpha edit' }),
  )

  // The gold insertion line is swept away and the order is untouched.
  await expect(page.getByTestId('row-drop-line')).toHaveCount(0)
  await expect(rows.locator('.task-row-title')).toHaveText(['Alpha edit', 'Bravo edit'])

  // A cancelled drag writes NOTHING — no order metadata appears anywhere.
  await page.waitForTimeout(250)
  for (const p of ['tasks/amanda/alpha', 'tasks/amanda/bravo']) {
    expect((await mockNote(page, p)).metadata.order).toBeUndefined()
  }
})

// ————————————————————————— row-level dates —————————————————————————

test('row dates — the hover calendar sets metadata.due; the due label edits it; Clear REMOVES the key', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/dateless', 'The dateless edit', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false,
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()
  const row = page.locator('[data-path="tasks/amanda/dateless"]')
  await expect(row).toBeVisible()

  // Dateless row: the tiny calendar (hover-revealed) opens the MonthPicker.
  const target = ymd(daysFromNow(3))
  await row.hover()
  await row.getByTestId('row-due-set').click()
  await expect(page.getByTestId('month-picker')).toBeVisible()
  await page.locator(`[data-date="${target}"]`).click()
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/dateless'))?.metadata?.due)
    .toBe(target)

  // The due label itself is now the edit button — picking another day changes it.
  const target2 = ymd(daysFromNow(5))
  await row.getByTestId('row-due-edit').click()
  await expect(page.getByTestId('month-picker')).toBeVisible()
  await page.locator(`[data-date="${target2}"]`).click()
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/dateless'))?.metadata?.due)
    .toBe(target2)

  // Clear date REMOVES the key — never due:null / due:''.
  await row.getByTestId('row-due-edit').click()
  await page.getByTestId('mp-clear').click()
  await expect
    .poll(async () => 'due' in ((await mockNote(page, 'tasks/amanda/dateless'))?.metadata ?? {}))
    .toBe(false)
  // The calendar affordance is back for the now-dateless row.
  await row.hover()
  await expect(row.getByTestId('row-due-set')).toBeVisible()
})

test('loose-line dates — the calendar appends the 📅 token surgically; Clear strips it', async ({ page }) => {
  const body = '# Practice Log\n\nwarmups first\n\n- [ ] restring the guitar'
  await seed(page, 'pages/practice-log', body, ['type/page'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'All' }).click()
  const row = page.locator('[data-testid="loose-row"][data-path="pages/practice-log"]')
  await expect(row).toBeVisible()

  // Set a date → the trailing token lands on exactly that line; every other
  // byte of the note survives.
  const target = ymd(daysFromNow(2))
  await row.hover()
  await row.getByTestId('row-due-set').click()
  await page.locator(`[data-date="${target}"]`).click()
  await expect
    .poll(async () => (await mockNote(page, 'pages/practice-log'))?.content)
    .toBe(`# Practice Log\n\nwarmups first\n\n- [ ] restring the guitar 📅 ${target}`)

  // The row now wears the due label (never the raw emoji)…
  await expect(row.getByTestId('row-due-edit')).toBeVisible()
  await expect(row).not.toContainText('📅')

  // …and Clear date strips the token entirely — byte-exact restore.
  await row.getByTestId('row-due-edit').click()
  await page.getByTestId('mp-clear').click()
  await expect
    .poll(async () => (await mockNote(page, 'pages/practice-log'))?.content)
    .toBe(body)
})

// ————————————————————————— no dragging where dates rule —————————————————————

test('The Week runway is an agenda — its rows are not draggable; loose lines never are', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/dated', 'The dated edit', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false, due: ymd(daysFromNow(1)),
  })
  await seed(page, 'pages/notes-loose', '# Loose Notes\n\n- [ ] a loose line', ['type/page'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Week' }).click()
  const agendaRow = page.locator(`[data-day="${ymd(daysFromNow(1))}"]`).getByTestId('task-row')
  await expect(agendaRow).toBeVisible()
  await expect(agendaRow).not.toHaveAttribute('draggable', 'true')

  await chips(page).getByRole('tab', { name: 'All' }).click()
  const loose = page.locator('[data-testid="loose-row"][data-path="pages/notes-loose"]')
  await expect(loose).toBeVisible()
  await expect(loose).not.toHaveAttribute('draggable', 'true')
})
