// Saved views (#4): one-tap Tracker slices — All · Now · per-owner.
// Dock Pad promote (#15 remnant): ⤢ Open as doc → today's daily note.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function seedTask(
  page: Page,
  slug: string,
  content: string,
  metadata: Record<string, unknown>,
) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path: `tasks/amanda/${slug}`, content, tags: ['task'], metadata },
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

function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Tracker views — Now shows only moving work; world chips slice per project', async ({ page }) => {
  await seedTask(page, 'shoot', 'Shoot the photos', {
    project: 'amanda', phase: '3', track: 'photos', owner: 'Adam', state: 'active', done: false,
  })
  await seedTask(page, 'stakes', 'Send the stakes text', {
    project: 'escensus', phase: '1', track: 'pilot', owner: 'Adam', state: 'next', done: false,
  })
  await seedTask(page, 'archive', 'Archive the drafts', {
    project: 'amanda', phase: '1', track: 'planable', owner: 'Adam', state: 'done', done: true,
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/tracker')
  const views = page.getByTestId('db-views')
  await expect(views).toBeVisible()
  await expect(page.getByText('Archive the drafts')).toBeVisible()

  // Now = active + next; done work disappears.
  await views.getByRole('button', { name: 'Now' }).click()
  await expect(page.getByText('Archive the drafts')).toHaveCount(0)
  await expect(page.getByText('Shoot the photos')).toBeVisible()
  await expect(page.getByText('Send the stakes text')).toBeVisible()

  // Escensus world: only that project's rows. No people chips anymore.
  await expect(views.getByRole('button', { name: 'Adam' })).toHaveCount(0)
  await views.getByRole('button', { name: 'Escensus' }).click()
  await expect(page.getByText('Shoot the photos')).toHaveCount(0)
  await expect(page.getByText('Send the stakes text')).toBeVisible()

  // The view survives a reload (same persistence as hand-built filters)…
  await page.reload()
  await expect(page.getByText('Send the stakes text')).toBeVisible()
  await expect(page.getByText('Shoot the photos')).toHaveCount(0)

  // …and All brings everything back.
  await page.getByTestId('db-views').getByRole('button', { name: 'All' }).click()
  await expect(page.getByText('Archive the drafts')).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

test('dock Pad ⤢ Open as doc — jot lands in today’s daily note, pad clears', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  await expect(page.getByTestId('cockpit')).toBeVisible()

  await page.locator('.dock-fab-main').click()
  await page.locator('.dock-tab', { hasText: 'Pad' }).click()
  await page.locator('.dock-pad').fill('remember: call Aaron about the mix')
  await page.getByTestId('pad-promote').click()

  // Lands in the Pages editor on today's note, jot in the body.
  const today = `desk/${todayKey()}`
  await expect(page).toHaveURL(new RegExp(encodeURIComponent(today).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  await expect(page.locator('.page-prose')).toContainText('remember: call Aaron about the mix')

  // The vault note has it; the pad is empty again.
  const res = await page.request.get(`${MOCK}/api/notes?id=${encodeURIComponent(today)}`, {
    headers: AUTH,
  })
  const note = (await res.json()) as { content?: string }
  expect(note.content).toContain('remember: call Aaron about the mix')

  await page.locator('.dock-fab-main').click()
  await page.locator('.dock-tab', { hasText: 'Pad' }).click()
  await expect(page.locator('.dock-pad')).toHaveValue('')
})

test('T5 — a dock todo files into a project as a real task', async ({ page }) => {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path: 'projects/amanda', content: '# Amanda', tags: ['project'], metadata: { key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x' } },
  })
  expect(res.status()).toBe(201)
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  await page.locator('.dock-fab-main').click()
  await page.locator('.dock-tab', { hasText: 'Todos' }).click()
  await page.locator('.dock-input').fill('Call the venue about parking')
  await page.keyboard.press('Enter')
  await page.getByTestId('todo-to-project').first().click()
  await expect(page.getByTestId('todo-assign')).toBeVisible()
  await page.getByTestId('todo-assign').locator('button', { hasText: 'File' }).click()

  // Task note exists with tracker defaults; the local todo is gone.
  await expect
    .poll(async () => {
      const r = await page.request.get(
        `${MOCK}/api/notes?id=${encodeURIComponent('tasks/amanda/call-the-venue-about-parking')}`,
        { headers: AUTH },
      )
      return r.ok() ? ((await r.json()) as { metadata?: Record<string, unknown> }).metadata?.project : null
    })
    .toBe('amanda')
  await expect(page.locator('.dock-todo')).toHaveCount(0)
})
