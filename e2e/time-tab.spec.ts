// THE TIME TAB (#/time) — the daily time log: always ONE day on screen, a
// fields-only form (no freeform input exists on the view — the law), rows
// in the pinned contract shape `- HH:MM · <minutes>m · <project|—> · <what>`
// (+ ` · ⚡` on auto-fed rows), and the STRICT metadata trio
// (date · total_minutes · entry_count) present on every observed write.
// Day keys and HH:MM stamps live on Adam's clock (America/New_York).
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

// ——— Adam's clock, computed the same way domain/timelog.ts does ———

const NY = 'America/New_York'
const nyDay = (d: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
const nyLabel = (key: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: NY, weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date(`${key}T12:00:00Z`))
/** key ± days — pure calendar math, matching domain/timelog.ts stepDay. */
function shiftKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d! + delta)
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dt.getFullYear()}-${mm}-${String(dt.getDate()).padStart(2, '0')}`
}
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const VIEW = 'http://127.0.0.1:4173/#/time'
const pathFor = (key: string) => `desk/timelog/${key}`
/** The pinned clock shape inside a contract line. */
const HHMM = '([01]\\d|2[0-3]):[0-5]\\d'

async function addRow(page: Page, what: string, project: string, minutes: string) {
  await page.getByTestId('time-what').fill(what)
  await page.getByTestId('time-project').fill(project)
  await page.getByTestId('time-minutes').fill(minutes)
  await page.getByTestId('time-minutes').press('Enter')
  await expect(page.getByTestId('time-row').filter({ hasText: what })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('the form appends the exact contract line and the note is born with the strict trio', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto(VIEW)

  const today = nyDay()
  await expect(page.getByTestId('time-title')).toHaveText(nyLabel(today))
  await expect(page.getByTestId('time-empty')).toHaveText('nothing logged yet')

  // THE LAW — no freeform anywhere: no textarea, no contenteditable, and
  // exactly the three field inputs.
  await expect(page.locator('textarea')).toHaveCount(0)
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(page.getByTestId('time-view').locator('input')).toHaveCount(3)

  await addRow(page, 'Practice piano', '', '25')

  // The note: exact contract content (creation-time HH:MM, em dash for no
  // project), tags desk + timelog, and ALL THREE strict fields at birth.
  await expect
    .poll(() => savedContent(page, pathFor(today)))
    .toMatch(
      new RegExp(`^# Time — ${escapeRe(nyLabel(today))}\\n\\n- ${HHMM} · 25m · — · Practice piano\\n$`),
    )
  const note = await mockNote(page, pathFor(today))
  expect(note.tags).toContain('desk')
  expect(note.tags).toContain('timelog')
  expect(note.metadata.date).toBe(today)
  expect(note.metadata.total_minutes).toBe(25)
  expect(note.metadata.entry_count).toBe(1)
})

test('three rows sum in the header; delete recomputes the trio in the same write', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto(VIEW)
  const today = nyDay()

  await addRow(page, 'Practice piano', '', '25')
  await addRow(page, 'Caption pass', 'amanda', '15')
  await addRow(page, 'Mix bus', '', '60')

  await expect(page.getByTestId('time-total')).toHaveText('1h 40m logged')
  await expect(page.getByTestId('time-row')).toHaveCount(3)
  await expect.poll(async () => (await mockNote(page, pathFor(today)))?.metadata?.total_minutes).toBe(100)
  let note = await mockNote(page, pathFor(today))
  expect(note.metadata.entry_count).toBe(3)
  expect(note.metadata.date).toBe(today)
  expect(note.content).toMatch(new RegExp(`- ${HHMM} · 15m · amanda · Caption pass\\n`))

  // Delete the middle row — the correction path. Totals recompute.
  await page.getByTestId('time-row').filter({ hasText: 'Caption pass' }).getByTestId('time-row-del').click()
  await expect(page.getByTestId('time-row')).toHaveCount(2)
  await expect(page.getByTestId('time-total')).toHaveText('1h 25m logged')
  await expect.poll(async () => (await mockNote(page, pathFor(today)))?.metadata?.total_minutes).toBe(85)
  note = await mockNote(page, pathFor(today))
  expect(note.metadata.entry_count).toBe(2)
  expect(note.content).not.toContain('Caption pass')
})

test('day nav — one day at a time: yesterday is read-only (no form), › returns to today and stops', async ({ page }) => {
  const today = nyDay()
  const yday = shiftKey(today, -1)
  await seed(
    page,
    pathFor(yday),
    `# Time — ${nyLabel(yday)}\n\n- 09:12 · 25m · amanda · Caption pass on the reel\n- 11:40 · 30m · — · Errands\n`,
    ['desk', 'timelog'],
    { date: yday, total_minutes: 55, entry_count: 2 },
  )
  await connectViaStorage(page)

  await page.goto(VIEW)
  await expect(page.getByTestId('time-title')).toHaveText(nyLabel(today))
  await expect(page.getByTestId('time-form')).toBeVisible()
  await expect(page.getByTestId('time-next')).toBeDisabled()

  // ‹ — yesterday: same read-only rows, the total, NO form (the HH:MM stamp
  // is creation time, so the past can't be backfilled with a lying clock).
  await page.getByTestId('time-prev').click()
  await expect(page.getByTestId('time-title')).toHaveText(nyLabel(yday))
  await expect(page.getByTestId('time-row')).toHaveCount(2)
  await expect(page.getByTestId('time-total')).toHaveText('55m logged')
  await expect(page.getByTestId('time-form')).toHaveCount(0)
  // Deleting a past row stays possible — corrections have no curfew.
  await expect(page.getByTestId('time-row-del')).toHaveCount(2)

  // › — back to today, the form returns, and the future stays shut.
  await page.getByTestId('time-next').click()
  await expect(page.getByTestId('time-title')).toHaveText(nyLabel(today))
  await expect(page.getByTestId('time-form')).toBeVisible()
  await expect(page.getByTestId('time-next')).toBeDisabled()
})

test('auto-feed — resolving a stamped One Task writes today’s ⚡ row; history and slot behavior unchanged', async ({ page }) => {
  await connectViaStorage(page)
  await page.clock.install()

  await page.goto('http://127.0.0.1:4173/#/one-task')
  await page.getByTestId('one-input').fill('Amanda Photo Script')
  await page.getByTestId('one-input').press('Enter')
  await expect(page.getByTestId('one-hero')).toHaveText('Amanda Photo Script')
  await page.clock.fastForward('01:07:00')
  await page.getByTestId('one-done').click()
  await expect(page.getByTestId('one-input')).toBeVisible()

  // History + slot exactly as before the feed existed.
  const feedDay = nyDay(new Date(Date.now() + 67 * 60_000))
  await expect
    .poll(() => savedContent(page, 'desk/one-task-log'))
    .toContain('— Amanda Photo Script ✅ · 1h 7m')
  const slot = await mockNote(page, 'desk/one-task')
  expect(slot.content).toBe('')
  expect('started_at' in slot.metadata).toBe(false)

  // The ⚡ row wrote itself: same floored minutes, no project, full trio.
  await expect
    .poll(() => savedContent(page, pathFor(feedDay)))
    .toMatch(new RegExp(`- ${HHMM} · 67m · — · Amanda Photo Script · ⚡\\n`))
  const log = await mockNote(page, pathFor(feedDay))
  expect(log.tags).toContain('desk')
  expect(log.tags).toContain('timelog')
  expect(log.metadata.date).toBe(feedDay)
  expect(log.metadata.total_minutes).toBe(67)
  expect(log.metadata.entry_count).toBe(1)

  // The Time tab shows it, marked as having logged itself.
  await page.goto(VIEW)
  const row = page.getByTestId('time-row').filter({ hasText: 'Amanda Photo Script' })
  await expect(row).toBeVisible()
  await expect(row).toContainText('⚡')
  await expect(row).toContainText('67m')
})

test('auto-feed — a pre-feature task without started_at feeds nothing', async ({ page }) => {
  await seed(page, 'desk/one-task', '# Mix the record\n', ['desk'])
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/one-task')
  await page.getByTestId('one-done').click()
  await expect(page.getByTestId('one-input')).toBeVisible()

  // The resolve completed (history stamped, slot empty)…
  await expect.poll(() => savedContent(page, 'desk/one-task-log')).toContain('— Mix the record ✅')
  // …and NO timelog note was minted — unknown elapsed feeds nothing, silently.
  expect(await mockNote(page, pathFor(nyDay()))).toBeNull()
})
