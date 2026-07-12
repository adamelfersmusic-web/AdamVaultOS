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

test('Canvas v2 — double-click adds a card in the BLOCK editor; /todo + Tab nests; markdown round-trips', async ({ page }) => {
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/canvas')
  await expect(page.locator('.db-title')).toHaveText('Canvas')

  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await expect(page.locator('.canvas-title-input')).toBeVisible()

  // C1 — double-click empty canvas → a card right there, already editing
  // (block editor, NOT a raw-markdown textarea).
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 600, y: 320 } })
  await expect(page.locator('.canvas-card')).toHaveCount(1)
  const prose = page.locator('.card-prose')
  await expect(prose).toBeVisible()
  await expect(page.locator('.canvas-card-textarea')).toHaveCount(0)

  // Blocks, not markdown: heading via input rule, then /todo from the slash
  // menu, then Tab to NEST (C3).
  await page.keyboard.type('# Launch brain')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/todo')
  await expect(page.locator('.slash-menu')).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type('Ship it')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.type('sub-step')
  await expect(prose.locator('ul[data-type=taskList] ul[data-type=taskList]')).toHaveCount(1)

  // Blur (click the top bar) → saves; read view renders rich.
  await page.locator('.canvas-title-input').click()
  await expect(page.locator('.canvas-card-body')).toContainText('Ship it')
  await expect(page.locator('.canvas-card-body h1, .canvas-card-body h2, .canvas-card-body h3').first()).toContainText('Launch brain')

  // The vault got clean MARKDOWN (storage format survives the round-trip).
  const list = await page.request.get(`${MOCK}/api/notes?path_prefix=${encodeURIComponent('canvas/')}&include_content=true`, { headers: AUTH })
  const notesList = (await list.json()) as Array<{ path: string; content?: string; metadata?: Record<string, unknown> }>
  const card = notesList.find((n) => n.content?.includes('Ship it'))
  expect(card, 'card note with content exists').toBeTruthy()
  expect(card!.content).toMatch(/# Launch brain/)
  expect(card!.content).toMatch(/- \[ \] Ship it/)
  expect(card!.content).toMatch(/\n\s+- \[ \] sub-step/) // nested via Tab

  expect(errors, errors.join('\n')).toEqual([])
})

test('PR2 — right-click a canvas card: open as full page, or move it into Pages', async ({ page }) => {
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 500, y: 300 } })
  await expect(page.locator('.card-prose')).toBeVisible() // editor mounted + focused
  await page.keyboard.type('# Merch ideas')
  await page.locator('.canvas-title-input').click() // blur → save
  await expect(page.locator('.canvas-card-body')).toContainText('Merch ideas') // save landed

  // Right-click → the promote menu.
  await page.locator('.canvas-card').click({ button: 'right' })
  await expect(page.getByTestId('card-menu')).toBeVisible()

  // Open as full page: navigates to the Pages editor for the SAME note (stays on canvas).
  await page.getByTestId('card-open-page').click()
  await expect(page).toHaveURL(/#\/pages\/canvas%2F/)
  await expect(page.locator('.page-prose')).toContainText('Merch ideas')

  // ← Canvas takes you straight back INTO the board you were on (no gallery
  // detour) — the card is still there (opening ≠ moving).
  await page.getByTestId('back-to-canvas').click()
  await expect(page).toHaveURL(/#\/canvas/)
  await expect(page.locator('.canvas-card')).toHaveCount(1)

  // Turn into a page: MOVES the note out of canvas/ into pages/.
  await page.locator('.canvas-card').click({ button: 'right' })
  await page.getByTestId('card-move-pages').click()
  await expect(page).toHaveURL(/#\/pages\/pages%2Fmerch-ideas/)
  // The moved page keeps its #canvas breadcrumb — ← Canvas still works here.
  await expect(page.getByTestId('back-to-canvas')).toBeVisible()
  await expect(page.locator('.canvas-card')).toHaveCount(0)

  const res = await page.request.get(`${MOCK}/api/notes?id=${encodeURIComponent('pages/merch-ideas')}`, { headers: AUTH })
  expect(res.ok()).toBe(true)

  expect(errors, errors.join('\n')).toEqual([])
})

test('kanban survives the canvas — badge in read view, chip in card edit, NO deletion on save', async ({ page }) => {
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // A canvas card, opened as a full page, gains a kanban.
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 500, y: 300 } })
  await expect(page.locator('.card-prose')).toBeVisible()
  await page.keyboard.type('Test')
  await page.locator('.canvas-title-input').click()
  await expect(page.locator('.canvas-card-body')).toContainText('Test')

  await page.locator('.canvas-card').click({ button: 'right' })
  await page.getByTestId('card-open-page').click()
  await expect(page.locator('.page-prose')).toContainText('Test')
  await page.locator('.page-prose').getByText('Test').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/kanban')
  await expect(page.locator('.slash-menu')).toBeVisible()
  await page.keyboard.press('Enter')
  await page.getByTestId('kanban-add-card').first().click()
  await page.keyboard.type('Jah')
  await page.keyboard.press('Enter')

  // Saved to the vault with the board in it.
  const cardPath = decodeURIComponent(page.url().split('#/pages/')[1])
  await expect.poll(() => savedNote(page, cardPath)).toContain('<!--kanban-->')

  // ← Canvas: the card's READ view shows the BADGE (bold title + lanes), not a raw table.
  await page.getByTestId('back-to-canvas').click()
  const badge = page.locator('.canvas-card-body .kanban-badge')
  await expect(badge).toBeVisible()
  await expect(badge.locator('strong')).toHaveText('📋 Kanban board')
  await expect(badge.locator('span')).toContainText('To do · Doing · Done')
  await expect(page.locator('.canvas-card-body table')).toHaveCount(0)

  // THE BUG: pencil-edit the card on the canvas, then blur-save. The board
  // must SURVIVE — in edit it shows as a chip, and the markdown is untouched.
  await page.locator('.canvas-card-btn[title="Edit"]').click()
  await expect(page.getByTestId('kanban-chip')).toBeVisible()
  await page.locator('.card-prose').getByText('Test').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' edited')
  await page.locator('.canvas-title-input').click() // blur → save
  await expect(page.locator('.canvas-card-body')).toContainText('Test edited')

  const after = await savedNote(page, cardPath)
  expect(after).toContain('<!--kanban-->')
  expect(after).toContain('| To do | Doing | Done |')
  expect(after).toContain('| Jah |  |  |')

  expect(errors, errors.join('\n')).toEqual([])
})

async function savedNote(page: Page, path: string): Promise<string> {
  const res = await page.request.get(`${MOCK}/api/notes?id=${encodeURIComponent(path)}`, {
    headers: AUTH,
  })
  return ((await res.json()) as { content?: string }).content ?? ''
}

test('project board embed survives a canvas card edit — chip shown, marker preserved', async ({ page }) => {
  await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: {
      path: 'projects/amanda',
      content: '# Amanda',
      tags: ['project'],
      metadata: { key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x' },
    },
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 500, y: 300 } })
  await expect(page.locator('.card-prose')).toBeVisible()
  await page.keyboard.type('Hey')
  await page.locator('.canvas-title-input').click()
  await expect(page.locator('.canvas-card-body')).toContainText('Hey')

  // Full page: /board → pick Amanda → the marker lands in the note.
  await page.locator('.canvas-card').click({ button: 'right' })
  await page.getByTestId('card-open-page').click()
  await page.locator('.page-prose').getByText('Hey').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/board')
  await expect(page.locator('.slash-menu')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('board-embed-picker')).toBeVisible()
  await page.getByTestId('board-embed-picker').locator('button', { hasText: 'Amanda' }).click()
  const cardPath = decodeURIComponent(page.url().split('#/pages/')[1])
  await expect.poll(() => savedNote(page, cardPath)).toContain('![[board:amanda]]')

  // Back on the canvas: pencil-edit shows a CHIP; blur-save must not eat the marker.
  await page.getByTestId('back-to-canvas').click()
  await page.locator('.canvas-card-btn[title="Edit"]').click()
  await expect(page.getByTestId('board-embed-chip')).toBeVisible()
  await page.locator('.card-prose').getByText('Hey').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' there')
  await page.locator('.canvas-title-input').click()
  await expect(page.locator('.canvas-card-body')).toContainText('Hey there')

  const after = await savedNote(page, cardPath)
  expect(after).toContain('![[board:amanda]]')
})
