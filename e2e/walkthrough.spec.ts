// Not a test — a screenshot walkthrough of the branch's new UI, seeded with
// representative Amanda data, so Adam can review the changes visually before
// merging. Saves PNGs to e2e/.shots/walkthrough/.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'
const SHOTS = 'e2e/.shots/walkthrough'

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function seed(
  page: Page,
  path: string,
  content: string,
  tags: string[],
  metadata: Record<string, unknown>,
) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags, metadata },
  })
  expect(res.status(), await res.text()).toBe(201)
}
async function connect(page: Page) {
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

const TASKS: Array<[string, string, Record<string, unknown>]> = [
  ['build-20-posts', 'Build the 20 posts in Planable from Calendar v9.1', { phase: '1', track: 'planable', owner: 'Cassy', state: 'done', done: true }],
  ['import-captions', "Import Amanda's captions into Planable", { phase: '3', track: 'planable', owner: 'Cassy', state: 'done', done: true }],
  ['caption-pass', 'Caption pass — all 20 posts (formatting / mobile / conversion)', { phase: '4', track: 'captions', owner: 'Adam', state: 'next', done: false }],
  ['send-caption-doc', 'Send revised caption doc to Amanda', { phase: '4', track: 'captions', owner: 'Adam', state: 'next', done: false }],
  ['taste-pass-cull', "Taste pass over Cassy's cull", { phase: '5a', track: 'photos', owner: 'Adam', state: 'blocked', done: false }],
  ['cull-frames', 'Cull — 1-2 frames per scene across both subfolders', { phase: '5a', track: 'photos', owner: 'Cassy', state: 'active', done: false }],
  ['final-adjustment', 'Final adjustment pass — video 1-7', { phase: '5b', track: 'DTC videos', owner: 'Adam', state: 'active', done: false }],
  ['send-video-8', 'Send Amanda video 8', { phase: '5b', track: 'DTC videos', owner: 'Adam', state: 'active', done: false }],
  ['decide-color', 'DECIDE: color correction yes or no', { phase: '5b', track: 'DTC videos', owner: 'Adam', state: 'next', done: false }],
  ['react-batch-1', 'React to Batch 1 — once', { phase: '5c', track: 'b-roll', owner: 'Adam', state: 'blocked', done: false }],
  ['batch-1-outdoor', 'Batch 1 outdoor — string-out + 2-3 tights', { phase: '5c', track: 'b-roll', owner: 'Patricia', state: 'active', done: false }],
  ['pair-assets', 'Pair each post with its asset', { phase: '6', track: 'planable', owner: 'Cassy', state: 'next', done: false }],
  ['amanda-approves', 'Amanda reviews + approves — sticker to pink', { phase: '7', track: 'approval', owner: 'Amanda', state: 'next', done: false }],
  ['day-1-outreach', 'Days 1-7 — Amanda texts 10-20 warm contacts', { phase: '8', track: 'outreach', owner: 'Amanda', state: 'next', done: false }],
  ['collect-performance', 'Collect performance — sticker to blue', { phase: '9', track: 'analytics', owner: 'Adam', state: 'next', done: false }],
]

test('walkthrough — navigation: tag tree + pages sidebar', async ({ page }) => {
  await reset(page)
  const tagged: Array<[string, string, string[]]> = [
    ['esc/pitch-notes', '# Vegas Pitch Notes', ['escensus/pitch']],
    ['esc/scoring', '# Scoring Engine', ['escensus/engine']],
    ['esc/strategy-map', '# Strategy Map', ['escensus/strategy']],
    ['esc/front', '# Escensus Front Door', ['escensus']],
    ['health/labs-june', '# June Labs', ['health/labs']],
    ['health/protocol', '# Protocol', ['health']],
    ['Amanda/00-home', '# Amanda Home', ['amanda', 'client']],
    ['Amanda/02-work-log', '# Work Log', ['amanda']],
    ['Atelier/sop', '# Atelier SOP', ['atelier']],
    ['pages/reel-ideas', '# Reel Ideas', ['type/page']],
    ['capture/2026-07-11-thought', '# Quick thought', ['capture/quick']],
  ]
  for (const [path, content, tags] of tagged) {
    await seed(page, path, content, tags, { summary: `${content.slice(2)} — summary line.` })
  }
  await connect(page)

  // Library: hierarchical tag tree, escensus expanded.
  await page.goto('http://127.0.0.1:4173/#/library')
  const tree = page.getByTestId('tag-tree')
  await expect(tree).toBeVisible()
  await tree.locator('.tag-tree-item', { hasText: '#escensus' }).first().locator('.tag-tree-chevron').click()
  await tree.locator('.tag-tree-item', { hasText: '#health' }).first().locator('.tag-tree-chevron').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/11-tag-tree.png` })

  // Pages: Recent + folders, one expanded.
  await page.goto('http://127.0.0.1:4173/#/pages')
  await expect(page.locator('.pages-section-label', { hasText: 'Recent' })).toBeVisible()
  await page.locator('.pages-group-head', { hasText: 'Amanda' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/12-pages-sidebar.png` })
})

test('walkthrough — cockpit: project cards and a world', async ({ page }) => {
  await reset(page)
  const AMANDA_SPINE = [
    '# Amanda Bridges', '',
    '## Purpose',
    'A calm brand system that raises the money without burning the week.', '',
    '## The phases',
    '1. ✅ Brand system',
    '2. ✅ Content calendar',
    '3. Final polish — CURRENT',
    '4. Launch week',
    '5. Wrap + handoff',
  ].join('\n')
  const projects: Array<[string, string, Record<string, unknown>]> = [
    ['projects/escensus', '# Escensus', { key: 'escensus', tag: 'escensus', status: 'active', order: 1, milestone: 'Fire the Jonathan stakes text', phase: 'active', summary: 'The sales-performance OS venture with Jonathan — Signalcraft pilot with Bree Starr: training, practice, weekly real-call scoring.' }],
    ['projects/jonathan', '# Jonathan Gaietto', { key: 'jonathan', tag: 'jonathan', status: 'active', order: 2, milestone: 'Brand Brain v2 review', phase: 'planning', summary: 'Brand + recruiting intelligence system on his Parachute vault: Brand Brain, content engine, weekly ops.' }],
    ['projects/amanda', AMANDA_SPINE, { key: 'amanda', tag: 'amanda', status: 'active', order: 3, home: 'Amanda/00-home', summary: "'This World Needs You' fundraiser: brand system, 20-post calendar, DTC videos + photos; campaign runs on the Tracker." }],
    ['projects/parachute', '# Parachute', { key: 'parachute', tag: 'parachute', status: 'active', order: 4, milestone: 'Boulder footage → backup → edit', phase: 'active', summary: "Content delivery for Aaron's Parachute: Boulder session footage → backup → edit → deliver." }],
  ]
  for (const [path, content, meta] of projects) await seed(page, path, content, ['project'], meta)
  // Amanda's weekly card — the strip's one-thing + the world's ⭐ THIS WEEK.
  await seed(page, 'projects/amanda/weekly/2026-07-13', [
    '# Amanda — week of 2026-07-13', '',
    '## Priority',
    'Ship the last videos and hand the calendar to Cassy.', '',
    '## Top 3',
    '- [ ] Finish video edits → hand to Cassy',
    '- [ ] Caption pass on the 20 posts',
    '- [x] Send Amanda video 8', '',
    '## Blockers / waiting on',
    '- Amanda: approval on video 6',
  ].join('\n'), [], {})
  await seed(page, 'Amanda/00-home', '# Amanda Bridges — Home\n\nFront door. See [[Amanda/01-campaign-overview]] and [[Amanda/02-work-log]].', ['amanda', 'client'], { summary: 'Front door for the Amanda Bridges project — orientation + link index only.' })
  await seed(page, 'Amanda/01-campaign-overview', '# Campaign Overview', ['amanda'], { summary: 'Strategy layer — goal, two engines, four pillars.' })
  await seed(page, 'Amanda/02-work-log', '# Work Log', ['amanda'], { summary: 'Master work log — every completed phase in order.' })
  const tasks: Array<[string, string, string, string, boolean]> = [
    ['caption-pass', 'Caption pass — all 20 posts', '4', 'next', false],
    ['build-posts', 'Build the 20 posts in Planable', '1', 'done', true],
    ['send-video-8', 'Send Amanda video 8', '5b', 'active', false],
    ['taste-pass', "Taste pass over Cassy's cull", '5a', 'blocked', false],
    ['import-captions', "Import Amanda's captions", '3', 'done', true],
  ]
  for (const [slug, text, phase, state, done] of tasks) {
    await seed(page, `tasks/amanda/${slug}`, text, ['task'], { project: 'amanda', phase, track: 'planable', owner: 'Adam', state, done })
  }
  // Week-band data: two tasks promoted to today + the week's review (its
  // ⭐ Top 3 whispers above the strip). The pin still writes desk/current,
  // it just has no panel on this page anymore.
  await seed(page, 'desk/weekly/2026-07-13', [
    '# Week Plan — Mon July 13, 2026', '',
    '## ⭐ TOP 3 THIS WEEK', '',
    '1. **Finish Amanda video edits → hand to Cassy.**',
    '2. Send Amanda video 8.',
    '3. Hand the calendar over.',
  ].join('\n'), ['desk'], {})
  await page.request.patch(`${MOCK}/api/notes/${encodeURIComponent('tasks/amanda/send-video-8')}`, {
    headers: AUTH, data: { metadata: { when: 'today' }, force: true },
  })
  await page.request.patch(`${MOCK}/api/notes/${encodeURIComponent('tasks/amanda/caption-pass')}`, {
    headers: AUTH, data: { metadata: { when: 'today' }, force: true },
  })
  await seed(page, 'pages/gohighlevel-wiring', '# GoHighLevel Wiring\n\nNotes…', ['type/page', 'escensus'], {})
  await seed(page, 'desk/current', '# Current', ['desk'], { target: 'pages/gohighlevel-wiring' })
  await connect(page)

  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()
  await expect(page.getByTestId('macro-row')).toHaveCount(4)
  await expect(page.getByTestId('today-strip')).toContainText('Send Amanda video 8')
  await expect(page.getByTestId('week-top3')).toContainText('Finish Amanda video edits')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/07-cockpit.png` })

  await page.getByTestId('macro-row').filter({ hasText: 'Amanda Bridges' }).click()
  await expect(page.getByTestId('world-status')).toBeVisible()
  await expect(page.getByTestId('week-card')).toBeVisible()
  await expect(page.getByTestId('landing')).toBeVisible()
  await expect(page.locator('.landing-continue')).toBeEnabled()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/14-landing.png` })

  await page.locator('.landing-doors button', { hasText: 'overview' }).click()
  await expect(page.locator('.world-overview')).toContainText('Amanda Bridges — Home')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/08-world-overview.png` })

  await page.locator('.world-tab', { hasText: 'Board' }).click()
  await page.locator('.lens-btn', { hasText: 'Board' }).click()
  await expect(page.locator('.lane').first()).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/09-world-board.png` })

  await page.locator('.world-tab', { hasText: 'Notes' }).click()
  await expect(page.locator('.world-notes .note-row').first()).toBeVisible()
  await page.locator('.world-notes .note-row', { hasText: '00 Home' }).click()
  await expect(page.locator('.world-detail')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/10-world-notes.png` })
})

test('walkthrough — tracker board, table, and row-as-page', async ({ page }) => {
  await reset(page)
  for (const [slug, text, meta] of TASKS) {
    await seed(page, `tasks/amanda/${slug}`, text, ['task'], { project: 'amanda', ...meta })
  }
  await connect(page)

  // Board, grouped by state, with the campaign-progress overview on top.
  await page.goto('http://127.0.0.1:4173/#/tracker/board')
  await expect(page.getByTestId('progress-overview')).toBeVisible()
  await expect(page.locator('.board .lane').first()).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/01-tracker-board.png` })

  // Table view.
  await page.goto('http://127.0.0.1:4173/#/tracker/table')
  await expect(page.locator('.db-table tbody tr').first()).toBeVisible()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/02-tracker-table.png` })

  // Row-as-page: a task open with the editable property panel.
  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('tasks/amanda/caption-pass'))
  await expect(page.getByTestId('record-props')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/03-row-as-page.png` })
})

test('walkthrough — canvas board with markdown cards', async ({ page }) => {
  await reset(page)
  await seed(page, 'canvas/demo', 'Amanda — launch brain', ['canvas'], {
    ckind: 'board', title: 'Amanda — launch brain',
  })
  const cards: Array<[string, string, number, number, number, number]> = [
    ['c1', '## This week\n- Cassy handoff\n- Video 8 → Amanda\n- Caption pass', 60, 60, 250, 160],
    ['c2', '**Blocked on Adam**\n\nFraming decision + color yes/no', 340, 60, 240, 130],
    ['c3', 'Idea: living-room live performance reel — two cameras, cut on musical events, not timers.', 60, 250, 280, 150],
    ['c4', 'Launch = a **Monday**. No date set yet — by decision.', 360, 220, 220, 120],
  ]
  for (const [id, content, x, y, w, h] of cards) {
    await seed(page, `canvas/demo/${id}`, content, ['canvas'], { ckind: 'card', board: 'demo', x, y, w, h })
  }
  await connect(page)

  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.locator('.canvas-tile', { hasText: 'launch brain' }).click()
  await expect(page.locator('.canvas-card').first()).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/04-canvas.png` })
})

test('walkthrough — library cards and backlinks', async ({ page }) => {
  await reset(page)
  await seed(page, 'Amanda/00-home', '# Amanda Bridges — Home\n\nFront door. See [[Amanda/01-campaign-overview]], [[Amanda/12-process]], and [[Amanda/02-work-log]].', ['amanda', 'client', 'pinned'], { summary: 'Front door for the Amanda Bridges project — orientation + link index only.' })
  await seed(page, 'Amanda/01-campaign-overview', '# Campaign Overview', ['amanda', 'campaign'], { summary: 'Strategy layer — goal, the two engines, four content pillars, four-phase structure, donor psychology.' })
  await seed(page, 'Amanda/12-process', '# Process — Canonical Spine\n\nBack to [[Amanda/00-home]].', ['amanda', 'process'], { doc_type: 'process', summary: 'CANONICAL SPINE — nine phases end to end with actions, owners, and gates. Read first for any Amanda workflow question.' })
  await seed(page, 'Amanda/02-work-log', '# Work Log', ['amanda', 'log'], { summary: 'Master work log — every completed phase and the full sequence of upcoming phases in order.' })
  await seed(page, 'atelier/meetings/2026-06-15-cassy', '# Cassy check-in', ['meeting', 'cassy'], { summary: 'Weekly check-in with Cassy — Planable review, photo-culling workflow, 100-photo test batch.' })
  await seed(page, 'atelier/team/cassy', '# Cassy', ['team', 'people'], { summary: 'VA in the Philippines — owns the eight DTC videos, Planable, photo culling, and the tracker.' })
  await connect(page)

  // Library — rows as cards with type dots + summaries.
  await page.goto('http://127.0.0.1:4173/#/library')
  await expect(page.locator('.note-row').first()).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/05-library-cards.png` })

  // Backlinks — open the home note; it cites three and is cited by one.
  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('Amanda/00-home'))
  await expect(page.getByTestId('backlinks')).toBeVisible()
  await page.locator('.backlinks').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/06-backlinks.png` })
})
