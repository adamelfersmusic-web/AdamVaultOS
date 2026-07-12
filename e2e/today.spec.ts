// The NOW drop (build log PART 25/28/29): Today strip on the cockpit,
// 📍 set-as-current, daily note, F1a auto-slug, the World Landing (1+2),
// and the read-view metadata Details-fold.

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

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Today strip — lists when:today, toggles done, promotes via picker, opens the daily note', async ({ page }) => {
  await seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x',
  })
  await seed(page, 'tasks/amanda/video-8', 'Send Amanda video 8', ['task'], {
    project: 'amanda', state: 'active', done: false, when: 'today',
  })
  await seed(page, 'tasks/amanda/caption-pass', 'Caption pass — all 20 posts', ['task'], {
    project: 'amanda', state: 'next', done: false, when: 'later',
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const strip = page.getByTestId('today-strip')
  await expect(strip).toBeVisible()
  await expect(strip).toContainText('Send Amanda video 8')

  // Toggle done → written to the vault.
  await strip.locator('.today-item input[type=checkbox]').first().check()
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/video-8'))?.metadata?.done)
    .toBe(true)

  // Promote another task via the picker → when flips to today.
  await strip.locator('.today-add-btn').click()
  await strip.locator('.today-picker-input').fill('caption')
  await strip.locator('.today-picker-item', { hasText: 'Caption pass' }).click()
  await expect(strip).toContainText('Caption pass — all 20 posts')
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/caption-pass'))?.metadata?.when)
    .toBe('today')

  // Daily note: created on first open, lands in the Pages editor.
  await page.getByTestId('open-daily').click()
  await expect(page).toHaveURL(/#\/pages\/desk%2F\d{4}-\d{2}-\d{2}/)
  const key = new Date()
  const dateKey = `${key.getFullYear()}-${String(key.getMonth() + 1).padStart(2, '0')}-${String(key.getDate()).padStart(2, '0')}`
  expect(await mockNote(page, `desk/${dateKey}`)).not.toBeNull()
})

test('📍 set-as-current — pin a page, the strip shows it', async ({ page }) => {
  await seed(page, 'pages/reel-plan', '# Reel Plan\n\nwork work', ['type/page'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/reel-plan'))
  await page.getByTestId('set-current').click()
  await expect
    .poll(async () => (await mockNote(page, 'desk/current'))?.metadata?.target)
    .toBe('pages/reel-plan')

  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('today-strip').locator('.today-current-note')).toContainText(
    'Reel Plan',
  )
})

test('F1a auto-slug — an untitled page follows its first real title', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/pages')
  await page.locator('.pages-new').click()
  await expect(page).toHaveURL(/#\/pages\/pages%2Funtitled(-\d+)?/)

  // Replace the placeholder H1 with a real title (select-all → retype).
  await page.locator('.page-prose').click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('# Vegas Pitch Plan')
  // Debounced save (900ms) → rename → route swap to the slugged path.
  await expect(page).toHaveURL(/#\/pages\/pages%2Fvegas-pitch-plan/, { timeout: 8000 })
  const note = await mockNote(page, 'pages/vegas-pitch-plan')
  expect(note?.content).toContain('Vegas Pitch Plan')
})

test('Landing (1+2) — Continue + milestone + next 3 + doors; checkbox writes', async ({ page }) => {
  await seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1,
    home: 'Amanda/00-home', summary: 'x', milestone: 'Phase 5b — final adjustment pass',
  })
  await seed(page, 'Amanda/00-home', '# Amanda Home', ['amanda'], {})
  await seed(page, 'Amanda/02-work-log', '# Work Log', ['amanda'], {})
  const states: Array<[string, string, string]> = [
    ['t1', 'Send Amanda video 8', 'active'],
    ['t2', 'Caption pass', 'next'],
    ['t3', 'Pair assets', 'next'],
    ['t4', 'Launch day', 'next'],
  ]
  for (const [slug, text, state] of states) {
    await seed(page, `tasks/amanda/${slug}`, text, ['task'], {
      project: 'amanda', state, done: false, phase: '5b',
    })
  }
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  await page.getByTestId('project-card').filter({ hasText: 'Amanda' }).click()
  const landing = page.getByTestId('landing')
  await expect(landing).toBeVisible()

  // Continue points at the most recent world note; milestone reads verbatim;
  // the list hard-caps at 3 with active first.
  await expect(landing.locator('.landing-continue')).toContainText('Work Log')
  await expect(landing).toContainText('Phase 5b — final adjustment pass')
  await expect(landing.locator('.landing-item')).toHaveCount(3)
  await expect(landing.locator('.landing-item').first()).toContainText('Send Amanda video 8')
  await expect(landing).not.toContainText('Launch day')

  // Checking one writes done to the vault — and the item STAYS, struck
  // through (pinned for the visit; no teleporting replacements).
  await landing.locator('.landing-item input[type=checkbox]').first().check()
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/t1'))?.metadata?.done)
    .toBe(true)
  await expect(landing.locator('.landing-item').first()).toHaveClass(/is-done/)
  await expect(landing.locator('.landing-item')).toHaveCount(3)
  await expect(landing).not.toContainText('Launch day')

  // Doors work.
  await landing.locator('.landing-doors button', { hasText: 'board' }).click()
  await expect(page.locator('.db-title')).toHaveText('Tracker')
})

test('Details fold — the metadata wall is collapsed by default in the read view', async ({ page }) => {
  await seed(page, 'esc/front', '# Front Door\n\nThe words.', ['escensus'], {
    summary: 'A very long summary '.repeat(30),
    doc_type: 'front-door',
    status: 'living',
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('esc/front'))
  await expect(page.getByTestId('note-body')).toContainText('The words.')
  // Wall hidden; one quiet toggle with the field count.
  await expect(page.locator('.props-readonly')).toHaveCount(0)
  const toggle = page.getByTestId('props-toggle')
  await expect(toggle).toContainText('Details')
  await toggle.click()
  await expect(page.locator('.props-readonly')).toBeVisible()
  await expect(page.locator('.props-readonly')).toContainText('doc_type')
})
