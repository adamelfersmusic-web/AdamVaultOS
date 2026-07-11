// Smoke tests for the two new tabs: Tracker (Amanda tasks) and Canvas.
// Connects via the app's own namespaced session key (token mode) to skip the
// OAuth dance, seeds a few task notes, and drives the real UI against the mock.

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

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Tracker — renders seeded Amanda tasks and switches to a board', async ({ page }) => {
  await seedTask(page, 'build-posts', 'Build the 20 posts', {
    project: 'amanda', phase: '1', track: 'planable', owner: 'Cassy', state: 'done', done: true,
  })
  await seedTask(page, 'caption-pass', 'Caption pass — all 20 posts', {
    project: 'amanda', phase: '4', track: 'captions', owner: 'Adam', state: 'next', done: false,
  })
  await seedTask(page, 'send-video-8', 'Send Amanda video 8', {
    project: 'amanda', phase: '5b', track: 'DTC videos', owner: 'Adam', state: 'active', done: false,
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/tracker')
  await expect(page.locator('.db-title')).toHaveText('Tracker')
  // Titles come from the task body, not the path slug.
  await expect(page.getByText('Caption pass — all 20 posts')).toBeVisible()
  await expect(page.getByText('Build the 20 posts')).toBeVisible()

  // Campaign progress: 1 of 3 done overall (33%), phase 1 shows 1/1 complete.
  const progress = page.getByTestId('progress-overview')
  await expect(progress.locator('.progress-overall-pct')).toHaveText('33%')
  await expect(progress.locator('.progress-phase.is-complete')).toHaveCount(1)

  // Board lens groups by state — the lanes should appear.
  await page.goto('http://127.0.0.1:4173/#/tracker/board')
  await expect(page.locator('.lane-name', { hasText: 'active' })).toBeVisible()
  await expect(page.locator('.lane-name', { hasText: 'next' })).toBeVisible()
  await expect(page.getByText('Send Amanda video 8')).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

test('Row-as-page — a task opens with an editable property panel', async ({ page }) => {
  await seedTask(page, 'caption-pass', 'Caption pass — all 20 posts', {
    project: 'amanda', phase: '4', track: 'captions', owner: 'Adam', state: 'next', done: false,
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(
    'http://127.0.0.1:4173/#/pages/' + encodeURIComponent('tasks/amanda/caption-pass'),
  )
  const props = page.getByTestId('record-props')
  await expect(props).toBeVisible()

  // The State property shows the seeded value…
  const stateRow = props.locator('.prop-row', { hasText: 'State' })
  await expect(stateRow.locator('.chip')).toContainText('next')
  // …and changes via the popover.
  await stateRow.locator('.prop-chip-btn').click()
  await page.locator('.menu-item', { hasText: 'blocked' }).click()
  await expect(stateRow.locator('.chip')).toContainText('blocked')

  // The URL field saves and survives a reload.
  const urlInput = () =>
    page.getByTestId('record-props').locator('.prop-row', { hasText: 'URL' }).locator('.prop-input')
  await urlInput().fill('https://planable.io/x')
  await props.locator('.record-props-label').click() // blur → save
  await page.reload()
  await expect(urlInput()).toHaveValue('https://planable.io/x')

  expect(errors, errors.join('\n')).toEqual([])
})

test('Canvas — create a canvas, add a card, write to it', async ({ page }) => {
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/canvas')
  await expect(page.locator('.db-title')).toHaveText('Canvas')

  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await expect(page.locator('.canvas-title-input')).toBeVisible()

  await page.getByRole('button', { name: 'Add card' }).click()
  await expect(page.locator('.canvas-card')).toHaveCount(1)

  // Double-click the body to edit, type markdown, blur to save.
  await page.locator('.canvas-card-body').dblclick()
  await page.locator('.canvas-card-textarea').fill('# Hello canvas\n\nDrag me around.')
  await page.locator('.canvas-title-input').click() // blur the textarea → save

  await expect(page.locator('.canvas-card-body')).toContainText('Hello canvas')

  expect(errors, errors.join('\n')).toEqual([])
})
