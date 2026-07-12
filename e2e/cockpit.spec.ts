// Cockpit v1 — the Projects front door + project worlds (build log PART 22).
// Seeds project notes + tasks + tagged knowledge notes against the mock, then
// drives: default landing → cards → open a world → overview/board/notes →
// create a task and a note INSIDE the world.

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

async function seedAmandaWorld(page: Page) {
  await seed(
    page,
    'projects/amanda-bridges',
    '# Amanda Bridges\n\nCampaign HQ.',
    ['project'],
    {
      key: 'amanda',
      tag: 'amanda',
      status: 'active',
      order: 1,
      home: 'Amanda/00-home',
      summary: 'Fundraiser campaign — brand system, calendar, videos.',
    },
  )
  await seed(page, 'Amanda/00-home', '# Amanda Bridges — Home\n\nFront door. See [[Amanda/01-overview]].', ['amanda', 'client'], {
    summary: 'Front door for the Amanda project.',
  })
  await seed(page, 'Amanda/01-overview', '# Overview', ['amanda'], {
    summary: 'Strategy layer.',
  })
  await seed(page, 'tasks/amanda/caption-pass', 'Caption pass — all 20 posts', ['task'], {
    project: 'amanda', phase: '4', track: 'captions', owner: 'Adam', state: 'next', done: false,
  })
  await seed(page, 'tasks/amanda/build-posts', 'Build the 20 posts', ['task'], {
    project: 'amanda', phase: '1', track: 'planable', owner: 'Cassy', state: 'done', done: true,
  })
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Cockpit — default landing shows project cards with live progress', async ({ page }) => {
  await seedAmandaWorld(page)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // Bare URL → the Projects front door.
  await page.goto('http://127.0.0.1:4173/')
  await expect(page.getByTestId('cockpit')).toBeVisible()

  const card = page.getByTestId('project-card').filter({ hasText: 'Amanda Bridges' })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Fundraiser campaign')
  await expect(card).toContainText('active')
  await expect(card).toContainText('1/2 · 50%') // live task progress

  expect(errors, errors.join('\n')).toEqual([])
})

test('World — overview renders the home note; board is scoped; create task + note inside', async ({ page }) => {
  await seedAmandaWorld(page)
  // A second project whose tasks must NOT leak into Amanda's board.
  await seed(page, 'projects/other', '# Other\n\nx', ['project'], {
    key: 'other', tag: 'other', status: 'active', order: 2, summary: 'Other project.',
  })
  await seed(page, 'tasks/other/other-task', 'Someone else’s task', ['task'], {
    project: 'other', state: 'next', done: false,
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/')
  await page.getByTestId('project-card').filter({ hasText: 'Amanda Bridges' }).click()
  await expect(page.getByTestId('world')).toBeVisible()

  // The LANDING greets first (1+2): Continue + next items + quiet doors.
  await expect(page.getByTestId('landing')).toBeVisible()

  // Overview is a door now — the home note renders behind it.
  await page.locator('.landing-doors button', { hasText: 'overview' }).click()
  await expect(page.locator('.world-overview')).toContainText('Amanda Bridges — Home')

  // Board: scoped to this project only.
  await page.locator('.world-tab', { hasText: 'Board' }).click()
  await expect(page.getByText('Caption pass — all 20 posts')).toBeVisible()
  await expect(page.getByText('Someone else’s task')).toHaveCount(0)

  // Create a task inside the world → lands in row-as-page with project preset.
  await page.getByTestId('world-new-task').click()
  await page.locator('.world-new-input').fill('Ship the reel')
  await page.locator('.world-new-row .btn-gold').click()
  await expect(page).toHaveURL(/#\/pages\/tasks%2Famanda%2Fship-the-reel/)
  const props = page.getByTestId('record-props')
  await expect(props).toBeVisible()
  await expect(props.locator('.prop-row', { hasText: 'Project' }).locator('.chip')).toContainText('amanda')

  // Back to the world → Notes: lists tagged notes, creates one carrying the tag.
  await page.goBack()
  await expect(page.getByTestId('world')).toBeVisible()
  await page.locator('.landing-doors button', { hasText: 'notes' }).click()
  await expect(page.locator('.world-notes .note-row', { hasText: '00 Home' })).toBeVisible()

  await page.getByTestId('world-new-note').click()
  await page.locator('.world-new-input').fill('Reel shot list')
  await page.locator('.world-new-row .btn-gold').click()
  // Opens inline in the world's detail pane, born with the project tag.
  await expect(page.locator('.world-detail')).toContainText('pages/reel-shot-list')
  const created = await page.request.get(
    `${MOCK}/api/notes?id=${encodeURIComponent('pages/reel-shot-list')}`,
    { headers: AUTH },
  )
  const body = await created.json()
  expect(body.tags).toContain('amanda')
  expect(body.tags).toContain('type/page')

  expect(errors, errors.join('\n')).toEqual([])
})
