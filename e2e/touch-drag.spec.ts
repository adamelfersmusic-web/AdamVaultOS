// TOUCH DRAG — the pointer-events fallback (src/lib/touchDrag.ts). iOS
// Safari never fires HTML5 drag events, so every house drag surface ALSO
// answers to a long-press pointer gesture: 350ms arms it (a floating mirror
// chip appears, the source lifts), moving > 8px BEFORE that lets the page
// scroll, dropping on an accepting target performs the SAME write the HTML5
// path would, and letting go anywhere else writes NOTHING.
//
// Driven here with hand-dispatched PointerEvents (pointerType:'touch') —
// the exact stream a finger produces, minus the OS.

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
const day = (n: number) => ymd(daysFromNow(n))

const seedAmandaProject = (page: Page) =>
  seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x',
  })

const chips = (page: Page) => page.getByTestId('tasks-chips')
const cell = (page: Page, d: string) =>
  page.locator(`[data-testid="cal-cell"][data-date="${d}"]`)

// ——— the synthetic finger: PointerEvents with pointerType 'touch'. The
// pointerdown lands ON the source element (React's root listener picks it
// up); move/up ride window, which is where touchDrag.ts listens. ———

async function fingerDown(page: Page, source: Locator): Promise<{ x: number; y: number }> {
  const box = await source.boundingBox()
  if (!box) throw new Error('source has no box')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const src = await source.elementHandle()
  await page.evaluate(
    ({ src, x, y }) => {
      src!.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: x,
          clientY: y,
        }),
      )
    },
    { src, x, y },
  )
  return { x, y }
}
async function fingerMove(page: Page, x: number, y: number) {
  await page.evaluate(
    ({ x, y }) => {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: x,
          clientY: y,
        }),
      )
    },
    { x, y },
  )
}
async function fingerUp(page: Page, x: number, y: number) {
  await page.evaluate(
    ({ x, y }) => {
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: x,
          clientY: y,
        }),
      )
    },
    { x, y },
  )
}

/** Where on the target to aim: top edge (insert before), bottom edge
 * (insert after) or dead center (calendar cells). */
async function aimAt(target: Locator, pos: 'top' | 'bottom' | 'center') {
  const box = await target.boundingBox()
  if (!box) throw new Error('target has no box')
  return {
    x: box.x + box.width / 2,
    y: pos === 'top' ? box.y + 2 : pos === 'bottom' ? box.y + box.height - 2 : box.y + box.height / 2,
  }
}

/** The full gesture: press, hold past the 350ms arm (the mirror appears),
 * drag onto the target, release. */
async function longPressDrag(
  page: Page,
  source: Locator,
  target: Locator,
  pos: 'top' | 'bottom' | 'center',
) {
  const start = await fingerDown(page, source)
  await page.waitForTimeout(450) // past the 350ms arm — NO movement before it
  await expect(page.getByTestId('touch-drag-mirror')).toBeVisible()
  const to = await aimAt(target, pos)
  await fingerMove(page, start.x + 12, start.y + 12)
  await fingerMove(page, to.x, to.y)
  await fingerUp(page, to.x, to.y)
  // The mirror never outlives the gesture.
  await expect(page.getByTestId('touch-drag-mirror')).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

// ————————————————————————— (a) reorder within a group —————————————————————————

test('long-press reorder — Bravo above Alpha writes 10-spaced metadata.order, exactly like the HTML5 path', async ({ page }) => {
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

  // Press-hold Bravo, watch the drag arm, hover Alpha's top half (the gold
  // insertion line appears), release.
  const start = await fingerDown(page, rows.filter({ hasText: 'Bravo edit' }))
  await page.waitForTimeout(450)
  await expect(page.getByTestId('touch-drag-mirror')).toBeVisible()
  const to = await aimAt(rows.filter({ hasText: 'Alpha edit' }), 'top')
  await fingerMove(page, start.x + 12, start.y + 12)
  await fingerMove(page, to.x, to.y)
  await expect(page.getByTestId('row-drop-line')).toBeVisible()
  await fingerUp(page, to.x, to.y)

  await expect(rows.locator('.task-row-title')).toHaveText(['Bravo edit', 'Alpha edit'])
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/bravo'))?.metadata?.order)
    .toBe(10)
  expect((await mockNote(page, 'tasks/amanda/alpha')).metadata.order).toBe(20)

  // Every affordance swept.
  await expect(page.getByTestId('touch-drag-mirror')).toHaveCount(0)
  await expect(page.getByTestId('row-drop-line')).toHaveCount(0)
  expect(errors, errors.join('\n')).toEqual([])
})

// ————————————————————————— (b) refile across groups —————————————————————————

test('long-press refile — dropping an inbox row into the amanda group writes metadata.project', async ({ page }) => {
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

  await longPressDrag(page, stray, page.locator('[data-path="tasks/amanda/anchor"]'), 'bottom')
  await expect
    .poll(async () => (await mockNote(page, 'tasks/inbox/stray-thought'))?.metadata?.project)
    .toBe('amanda')
  await expect(page.locator('[data-group="amanda"]')).toContainText('File the stray thought')
})

// ————————————————————————— (c) calendar: chip → day —————————————————————————

test('long-press schedule — dragging a calendar chip onto another day rewrites metadata.due', async ({ page }) => {
  await seedAmandaProject(page)
  await seed(page, 'tasks/amanda/rehearse', 'Rehearse the set', ['task'], {
    project: 'amanda', state: 'next', when: 'later', done: false, due: day(1),
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await chips(page).getByRole('tab', { name: 'Calendar' }).click()
  await expect(page.getByTestId('task-calendar')).toBeVisible()
  const chip = cell(page, day(1)).getByTestId('cal-chip')
  await expect(chip).toBeVisible()

  await longPressDrag(page, chip, cell(page, day(4)), 'center')
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/rehearse'))?.metadata?.due)
    .toBe(day(4))
  await expect(cell(page, day(4))).toContainText('Rehearse the set')
  await expect(cell(page, day(1)).getByTestId('cal-chip')).toHaveCount(0)
})

// ————————————————————————— WorkTabs ride the same contract —————————————————————————

test('long-press tab reorder — Charlie above Alpha writes 10-spaced tab_order', async ({ page }) => {
  const WS = 'desk/2026-07-13'
  await seed(page, WS, '# Monday\n\nMain thread.', ['desk'], {})
  await seed(page, `${WS}/alpha`, '# Alpha\n', ['desk'], {})
  await seed(page, `${WS}/bravo`, '# Bravo\n', ['desk'], {})
  await seed(page, `${WS}/charlie`, '# Charlie\n', ['desk'], {})
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent(WS))
  const items = page.getByTestId('worktabs').locator('.worktabs-item')
  await expect(items).toHaveText(['Monday', 'Alpha', 'Bravo', 'Charlie'])

  await longPressDrag(
    page,
    items.filter({ hasText: 'Charlie' }),
    items.filter({ hasText: 'Alpha' }),
    'top',
  )
  await expect(items).toHaveText(['Monday', 'Charlie', 'Alpha', 'Bravo'])
  await expect
    .poll(async () => (await mockNote(page, `${WS}/charlie`))?.metadata?.tab_order)
    .toBe(10)
  expect((await mockNote(page, `${WS}/alpha`)).metadata.tab_order).toBe(20)
  expect((await mockNote(page, `${WS}/bravo`)).metadata.tab_order).toBe(30)
})

// ————————————————————————— (d) a swipe is a swipe —————————————————————————

test('a sub-350ms swipe never arms — no mirror, no write; the page keeps its scroll', async ({ page }) => {
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

  // Finger down, immediately flick > 8px (a scroll), lift — all well inside
  // the 350ms window. Arming must be cancelled the moment the flick starts.
  const start = await fingerDown(page, rows.filter({ hasText: 'Bravo edit' }))
  await fingerMove(page, start.x, start.y + 40)
  await fingerUp(page, start.x, start.y + 40)

  // Even after the long-press window has long passed: no mirror ever came,
  await page.waitForTimeout(500)
  await expect(page.getByTestId('touch-drag-mirror')).toHaveCount(0)
  // …the order is untouched, and NOTHING was written.
  await expect(rows.locator('.task-row-title')).toHaveText(['Alpha edit', 'Bravo edit'])
  for (const p of ['tasks/amanda/alpha', 'tasks/amanda/bravo']) {
    expect((await mockNote(page, p)).metadata.order).toBeUndefined()
  }
})

// ————————————————————————— (e) dropping outside cancels —————————————————————————

test('an armed drag released outside any target cancels — indicator swept, NOTHING written', async ({ page }) => {
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

  // Arm on Bravo, then wander up to the page header — no drop target lives
  // there — and let go. The touch Escape.
  const start = await fingerDown(page, rows.filter({ hasText: 'Bravo edit' }))
  await page.waitForTimeout(450)
  await expect(page.getByTestId('touch-drag-mirror')).toBeVisible()
  const head = await page.locator('.tasks-head .db-title').boundingBox()
  await fingerMove(page, start.x + 12, start.y + 12)
  await fingerMove(page, head!.x + 10, head!.y + 10)
  await fingerUp(page, head!.x + 10, head!.y + 10)

  await expect(page.getByTestId('touch-drag-mirror')).toHaveCount(0)
  await expect(page.getByTestId('row-drop-line')).toHaveCount(0)
  await expect(rows.locator('.task-row-title')).toHaveText(['Alpha edit', 'Bravo edit'])
  await page.waitForTimeout(250)
  for (const p of ['tasks/amanda/alpha', 'tasks/amanda/bravo']) {
    expect((await mockNote(page, p)).metadata.order).toBeUndefined()
  }
})
