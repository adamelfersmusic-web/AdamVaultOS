// THE SYSTEM's dashboard (desk/the-system §6) — the Projects macro strip
// ("What worlds are alive?") + the per-project Status view ("Where are we?").
// Seeds spines (fixed H2 sections), weekly cards (Priority · Top 3 ·
// Blockers), and tasks against the mock, then drives: strip rows in order
// with card-derived one-things → paused fold → the Status stack (mission /
// phase bar / ⭐ THIS WEEK / blockers / open tasks) → checking a Top-3 box
// writes [x] through to the card note → the world rooms (overview / board /
// notes) that survive below the stack.

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

// The Amanda SPINE — fixed H2 sections per THE SYSTEM's data model.
const AMANDA_SPINE = [
  '# Amanda Bridges',
  '',
  '## Purpose',
  'A calm brand system that raises the money without burning the week.',
  '',
  '## Definition of done',
  'Campaign launched, calendar handed to Cassy.',
  '',
  '## The phases',
  '1. ✅ Brand system',
  '2. ✅ Content calendar',
  '3. Final polish — CURRENT',
  '4. Launch week',
  '5. ⛔ Wrap + handoff',
  '',
  '## People',
  '- Cassy — VA, owns Planable',
  '',
  '## Dates',
  '- Original target: 2026-08-03',
].join('\n')

// This week's CARD (the latest) + one older card that must LOSE.
const AMANDA_CARD = [
  '# Amanda — week of 2026-07-13',
  '',
  '## Priority',
  'Ship the last videos and hand the calendar to Cassy.',
  '',
  '## Top 3',
  '- [ ] Finish video edits',
  '- [ ] Caption pass on the 20 posts',
  '- [x] Send Amanda video 8',
  '',
  '## Blockers / waiting on',
  '- Amanda: approval on video 6',
].join('\n')

const AMANDA_OLD_CARD = [
  '# Amanda — week of 2026-07-06',
  '',
  '## Priority',
  'Old week priority — must never surface.',
  '',
  '## Top 3',
  '- [ ] Old week thing',
].join('\n')

async function seedAmandaWorld(page: Page) {
  await seed(page, 'projects/amanda-bridges', AMANDA_SPINE, ['project'], {
    key: 'amanda',
    tag: 'amanda',
    status: 'active',
    order: 1,
    phase: 'active',
    milestone: 'Fallback milestone — the card outranks me',
    home: 'Amanda/00-home',
    deep: 'Amanda/12-process',
    summary: 'Fundraiser campaign — brand system, calendar, videos.',
  })
  await seed(page, 'Amanda/12-process', '# The Process\n\nThe deep ops note.', ['amanda'], {
    summary: 'The master plan — every phase in detail.',
  })
  await seed(page, 'projects/amanda/weekly/2026-07-06', AMANDA_OLD_CARD, [], {})
  await seed(page, 'projects/amanda/weekly/2026-07-13', AMANDA_CARD, [], {})
  await seed(page, 'Amanda/00-home', '# Amanda Bridges — Home\n\nFront door. See [[Amanda/01-overview]].', ['amanda', 'client'], {
    summary: 'Front door for the Amanda project.',
  })
  await seed(page, 'Amanda/01-overview', '# Overview', ['amanda'], {
    summary: 'Strategy layer.',
  })
  await seed(page, 'tasks/amanda/caption-pass', 'Caption pass — all 20 posts', ['task'], {
    project: 'amanda', phase: '4', track: 'captions', owner: 'Adam', state: 'next', done: false, when: 'this-week',
  })
  await seed(page, 'tasks/amanda/build-posts', 'Build the 20 posts', ['task'], {
    project: 'amanda', phase: '1', track: 'planable', owner: 'Cassy', state: 'done', done: true,
  })
  await seed(page, 'tasks/amanda/someday-reel', 'Someday: living-room reel', ['task'], {
    project: 'amanda', state: 'next', done: false, when: 'later',
  })
}

/** A second world with NO weekly card — one-thing falls back to milestone. */
async function seedOtherWorld(page: Page) {
  await seed(page, 'projects/other', '# Other Venture\n\nx', ['project'], {
    key: 'other', tag: 'other', status: 'active', order: 2, phase: 'planning',
    milestone: 'Get the demo in front of Jonathan',
    summary: 'Other project.',
  })
  await seed(page, 'tasks/other/other-task', 'Someone else’s task', ['task'], {
    project: 'other', state: 'next', done: false,
  })
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Macro strip — rows in order with card-derived one-things; paused folds away', async ({ page }) => {
  await seedAmandaWorld(page)
  await seedOtherWorld(page)
  await seed(page, 'projects/dormant', '# Dormant Thing\n\nasleep', ['project'], {
    key: 'dormant', tag: 'dormant', status: 'parked', order: 3, phase: 'paused',
    milestone: 'Wake me in the fall',
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // #/projects → the Cockpit: the macro strip. (The BARE url is the gate
  // now — the Map greets there; see ceremonial.spec.ts.)
  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()
  const strip = page.getByTestId('macro-strip')
  await expect(strip).toBeVisible()

  // One calm row per LIVE world, order asc; the paused one is folded.
  const rows = page.getByTestId('macro-row')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Amanda Bridges')
  await expect(rows.nth(1)).toContainText('Other Venture')

  // Amanda's one thing = first UNCHECKED Top-3 of the LATEST card (the older
  // card and the checked item must never surface; milestone is outranked).
  const amandaTop = rows.nth(0).getByTestId('macro-top')
  await expect(amandaTop).toContainText('Finish video edits')
  await expect(strip).not.toContainText('Old week thing')
  await expect(strip).not.toContainText('Send Amanda video 8')
  await expect(strip).not.toContainText('Fallback milestone')

  // Phase label: the spine's CURRENT line, markers stripped.
  await expect(rows.nth(0).locator('.macro-phase')).toHaveText('Final polish')
  // No card, no spine phases → milestone + metadata.phase fallbacks.
  await expect(rows.nth(1).getByTestId('macro-top')).toContainText(
    'Get the demo in front of Jonathan',
  )
  await expect(rows.nth(1).locator('.macro-phase')).toHaveText('planning')

  // Paused · N — collapsed by default, one click to open (disclosure law).
  const pausedHead = page.getByTestId('macro-paused')
  await expect(pausedHead).toContainText('Paused · 1')
  await expect(strip).not.toContainText('Dormant Thing')
  await pausedHead.click()
  await expect(rows).toHaveCount(3)
  await expect(strip).toContainText('Dormant Thing')

  // Row click → the world.
  await rows.nth(0).click()
  await expect(page.getByTestId('world')).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

test('Status view — mission → phase bar → ⭐ THIS WEEK → blockers, in order; later pile folded', async ({ page }) => {
  await seedAmandaWorld(page)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/projects')
  await page.getByTestId('macro-row').filter({ hasText: 'Amanda Bridges' }).click()
  await expect(page.getByTestId('world')).toBeVisible()

  const status = page.getByTestId('world-status')
  await expect(status).toBeVisible()

  // 1 · Mission line — first paragraph of the spine's ## Purpose.
  await expect(status.locator('.status-mission')).toContainText(
    'A calm brand system that raises the money',
  )

  // 2 · Phase bar — ✅ dimmed, CURRENT lit, rest dim; markers stripped.
  const bar = status.getByTestId('phase-bar')
  await expect(bar.locator('.phase-step')).toHaveCount(5)
  await expect(bar.locator('.phase-step.is-done')).toHaveCount(2)
  await expect(bar.locator('.phase-step.is-current')).toHaveText(/Final polish/)
  await expect(bar.locator('.phase-step.is-current')).not.toContainText('CURRENT')
  await expect(bar.locator('.phase-step.is-blocked')).toContainText('Wrap + handoff')

  // 3 · ⭐ THIS WEEK — the LATEST card's Priority + checkable Top 3.
  const week = status.getByTestId('week-card')
  await expect(week).toContainText('Ship the last videos and hand the calendar to Cassy.')
  const items = week.getByTestId('week-top3-item')
  await expect(items).toHaveCount(3)
  await expect(items.nth(2)).toHaveClass(/is-done/)
  await expect(week).not.toContainText('Old week priority')

  // 4 · Blockers, from the card.
  await expect(status.getByTestId('status-blockers')).toContainText(
    'Amanda: approval on video 6',
  )

  // The stack renders in THE SYSTEM's exact order (the zoom-ladder doors
  // sit above it, top right).
  const stack = status.locator(':scope > *')
  await expect(stack.nth(0)).toHaveClass(/status-doors/)
  await expect(stack.nth(1)).toHaveClass(/status-mission/)
  await expect(stack.nth(2)).toHaveAttribute('data-testid', 'phase-bar')
  await expect(stack.nth(3)).toHaveAttribute('data-testid', 'week-card')
  await expect(stack.nth(4)).toHaveAttribute('data-testid', 'status-blockers')
  await expect(stack.nth(5)).toHaveClass(/status-tasks/)

  // 5 · Open tasks — this-week row visible; the later pile is a COUNT.
  const tasks = status.locator('.status-tasks')
  await expect(tasks).toContainText('Caption pass — all 20 posts')
  await expect(tasks).not.toContainText('Build the 20 posts') // done stays out
  const later = status.getByTestId('later-pile')
  await expect(later).toContainText('+ 1 later')
  await expect(tasks).not.toContainText('Someday: living-room reel')
  await later.click()
  await expect(tasks).toContainText('Someday: living-room reel')

  // 6 · Quiet footer — spine link + the week's review + past-cards count.
  await expect(status.locator('.status-foot')).toContainText('Open the spine')
  await expect(status.locator('.status-foot')).toContainText('1 past card')

  // The world header still carries live progress (1 done of 3 → 33%).
  await expect(page.locator('.world-progress')).toContainText('33%')

  // The original landing survives BELOW the divider — Continue + doors.
  await expect(page.getByTestId('landing')).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

test('⭐ THIS WEEK — checking a Top-3 box persists [x] into the card note', async ({ page }) => {
  await seedAmandaWorld(page)
  await connectViaStorage(page)

  await page.goto(
    'http://127.0.0.1:4173/#/project/' + encodeURIComponent('projects/amanda-bridges'),
  )
  const week = page.getByTestId('week-card')
  await expect(week).toBeVisible()

  // Check "Finish video edits" → the exact line flips to [x] in the vault.
  const first = week.getByTestId('week-top3-item').nth(0)
  await expect(first.locator('input')).not.toBeChecked()
  await first.locator('input').check()
  await expect
    .poll(async () => (await mockNote(page, 'projects/amanda/weekly/2026-07-13'))?.content)
    .toContain('- [x] Finish video edits')
  await expect(first).toHaveClass(/is-done/)

  // And back — the write path is a toggle, not a one-way door.
  await first.locator('input').uncheck()
  await expect
    .poll(async () => (await mockNote(page, 'projects/amanda/weekly/2026-07-13'))?.content)
    .toContain('- [ ] Finish video edits')
  // The untouched neighbors kept their exact state.
  const content = (await mockNote(page, 'projects/amanda/weekly/2026-07-13'))?.content as string
  expect(content).toContain('- [ ] Caption pass on the 20 posts')
  expect(content).toContain('- [x] Send Amanda video 8')
})

test('Status view — a world with no card shows the quiet empty line', async ({ page }) => {
  await seedOtherWorld(page)
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/project/' + encodeURIComponent('projects/other'))
  await expect(page.getByTestId('world')).toBeVisible()
  const empty = page.getByTestId('week-card-empty')
  await expect(empty).toContainText('No card yet — mint one in Monday’s review.')
  await expect(page.getByTestId('week-card')).toHaveCount(0)
  // No spine sections either → mission falls back to metadata.summary.
  await expect(page.locator('.status-mission')).toContainText('Other project.')
})

test('Zoom-ladder doors — Master plan opens metadata.deep; Week plan opens the latest review', async ({ page }) => {
  await seedAmandaWorld(page)
  // The whole-week review lives at desk/weekly/<date>; older weeks lose.
  await seed(page, 'desk/weekly/2026-07-06', '# Old week', ['desk'], {})
  await seed(page, 'desk/weekly/2026-07-13', '# Week Plan — Mon July 13', ['desk'], {})
  await seed(page, 'desk/weekly/template', '# Template — never a destination', ['desk'], {})
  await connectViaStorage(page)

  await page.goto(
    'http://127.0.0.1:4173/#/project/' + encodeURIComponent('projects/amanda-bridges'),
  )
  const status = page.getByTestId('world-status')
  await expect(status).toBeVisible()

  // UP one rung: the spine's deep ops note.
  await status.getByTestId('door-master').click()
  await expect(page).toHaveURL(/#\/note\/Amanda%2F12-process/)
  await expect(page.getByTestId('note-body')).toContainText('The deep ops note.')

  // UP to the top rung: the latest weekly review (never the template).
  await page.goBack()
  await status.getByTestId('door-week').click()
  await expect(page).toHaveURL(/#\/pages\/desk%2Fweekly%2F2026-07-13/)
})

test('Zoom-ladder doors — no deep → Master plan falls back to the spine; no review → no Week plan', async ({ page }) => {
  await seedOtherWorld(page)
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/project/' + encodeURIComponent('projects/other'))
  const status = page.getByTestId('world-status')
  await expect(status).toBeVisible()

  // No desk/weekly note anywhere → the Week-plan door doesn't exist.
  await expect(status.getByTestId('door-master')).toBeVisible()
  await expect(status.getByTestId('door-week')).toHaveCount(0)

  // Master plan without metadata.deep = the spine note itself.
  await status.getByTestId('door-master').click()
  await expect(page).toHaveURL(/#\/note\/projects%2Fother/)
})

test('World — overview renders the home note; board is scoped; create task + note inside', async ({ page }) => {
  await seedAmandaWorld(page)
  // A second project whose tasks must NOT leak into Amanda's board.
  await seedOtherWorld(page)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/projects')
  await page.getByTestId('macro-row').filter({ hasText: 'Amanda Bridges' }).click()
  await expect(page.getByTestId('world')).toBeVisible()

  // The Status stack greets first; the LANDING (Continue + doors) sits below.
  await expect(page.getByTestId('world-status')).toBeVisible()
  await expect(page.getByTestId('landing')).toBeVisible()

  // Overview is a door — the home note renders behind it.
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
