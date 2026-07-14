// The NOW drop (build log PART 25/28/29), re-tuned by the altitude pass:
// the Projects page keeps ONE cognitive question ("what worlds are alive?").
// The Today checklist stays (a short list earns its corner), the ⭐ This-week
// whisper reads the latest desk/weekly review's Top 3, the daily note is a
// quiet header button, and the 📍 Current pin lost its panel (the pin itself
// still writes desk/current). Plus F1a auto-slug, the World Landing (1+2),
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

test('Today checklist — lists when:today, toggles done, promotes via picker; no pin panel', async ({ page }) => {
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

  // The 📍 Current panel is gone — the page holds week altitude.
  await expect(page.locator('.today-current-note')).toHaveCount(0)
  await expect(strip).not.toContainText('Current')

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
})

// ——— Today picker v2 — write first, pick second, nothing ever lost ———

test('Picker v2 — typing shows the ➕ create row first; Enter mints a project-less when:today task', async ({ page }) => {
  await seed(page, 'tasks/amanda/caption-pass', 'Caption pass — all 20 posts', ['task'], {
    project: 'amanda', state: 'next', done: false, when: 'later',
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const strip = page.getByTestId('today-strip')
  await strip.locator('.today-add-btn').click()
  const picker = strip.locator('.today-picker')
  await expect(picker).toBeVisible()

  // Empty input → no create row yet.
  await expect(page.getByTestId('today-create')).toHaveCount(0)

  await strip.locator('.today-picker-input').fill('Call the venue about parking')
  const create = page.getByTestId('today-create')
  await expect(create).toBeVisible()
  await expect(create).toContainText('Add “Call the venue about parking”')
  // The create row is ALWAYS the first row of the list.
  await expect(picker.locator('.today-picker-item').first()).toHaveAttribute(
    'data-testid', 'today-create',
  )

  await strip.locator('.today-picker-input').press('Enter')
  // The new task lands on the Today list immediately, and the picker closes.
  await expect(strip).toContainText('Call the venue about parking')
  await expect(picker).toHaveCount(0)

  // The note exists in the vault: #task, when:today, done:false, NO project.
  const note = await mockNote(page, 'tasks/inbox/call-the-venue-about-parking')
  expect(note).not.toBeNull()
  expect(note.tags).toContain('task')
  expect(note.metadata.when).toBe('today')
  expect(note.metadata.done).toBe(false)
  expect(note.metadata.project).toBeUndefined()

  // Adam's law (2026-07-14): unfiled tasks NEVER reach the Tracker — filing
  // to a world is the promotion gesture. The inbox mint stays invisible here.
  await page.goto('http://127.0.0.1:4173/#/tracker')
  await expect(page.locator('.db-title')).toHaveText('Tracker')
  // The filed (amanda) row proves the table rendered before we assert absence.
  await expect(page.locator('body')).toContainText('Caption pass — all 20 posts')
  await expect(page.locator('body')).not.toContainText('Call the venue about parking')
})

test('Picker v2 — this-week tasks rank above later ones in the pick-list', async ({ page }) => {
  // Seed the later task FIRST so raw vault order would show it first —
  // the ranking must still lift the this-week task above it.
  await seed(page, 'tasks/amanda/a-later-task', 'A later task', ['task'], {
    project: 'amanda', state: 'next', done: false, when: 'later',
  })
  await seed(page, 'tasks/amanda/blessed-task', 'Blessed by the ritual', ['task'], {
    project: 'amanda', state: 'next', done: false, when: 'this-week',
  })
  await seed(page, 'tasks/amanda/done-task', 'Already done', ['task'], {
    project: 'amanda', state: 'done', done: true, when: 'this-week',
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const strip = page.getByTestId('today-strip')
  await strip.locator('.today-add-btn').click()
  const items = strip.locator('.today-picker-item')
  await expect(items).toHaveCount(2) // done tasks never appear
  await expect(items.nth(0)).toContainText('Blessed by the ritual')
  await expect(items.nth(1)).toContainText('A later task')
})

test('Picker v2 — ✕ demotes to when:later; the note is never deleted', async ({ page }) => {
  await seed(page, 'tasks/amanda/video-8', 'Send Amanda video 8', ['task'], {
    project: 'amanda', state: 'active', done: false, when: 'today',
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const strip = page.getByTestId('today-strip')
  await expect(strip).toContainText('Send Amanda video 8')

  await strip.locator('.today-item-x').click()
  // Off today's list…
  await expect(strip).not.toContainText('Send Amanda video 8')
  // …but the note survives, filed back on the running list.
  await expect
    .poll(async () => (await mockNote(page, 'tasks/amanda/video-8'))?.metadata?.when)
    .toBe('later')
  const note = await mockNote(page, 'tasks/amanda/video-8')
  expect(note).not.toBeNull()
  expect(note.content).toContain('Send Amanda video 8')
})

test('Picker v2 — closes like a normal window: outside click, Escape, add, and the button again', async ({ page }) => {
  await seed(page, 'tasks/amanda/caption-pass', 'Caption pass — all 20 posts', ['task'], {
    project: 'amanda', state: 'next', done: false, when: 'later',
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const strip = page.getByTestId('today-strip')
  const picker = strip.locator('.today-picker')
  const addBtn = strip.locator('.today-add-btn')

  // (a) click anywhere outside → closes.
  await addBtn.click()
  await expect(picker).toBeVisible()
  await page.locator('.cockpit-sub').click()
  await expect(picker).toHaveCount(0)

  // (b) Escape → closes.
  await addBtn.click()
  await expect(picker).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(picker).toHaveCount(0)

  // (c) a successful pick → closes (and the pick sticks).
  await addBtn.click()
  await strip.locator('.today-picker-item', { hasText: 'Caption pass' }).click()
  await expect(picker).toHaveCount(0)
  await expect(strip).toContainText('Caption pass — all 20 posts')

  // (d) the "Add to today" button itself toggles: open → click again → closed.
  await addBtn.click()
  await expect(picker).toBeVisible()
  await addBtn.click()
  await expect(picker).toHaveCount(0)
})

test('Daily note — the quiet header button creates today’s note and opens it', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const btn = page.getByTestId('daily-note-btn')
  await expect(btn).toBeVisible()
  // It lives in the header row, beside "New project".
  await expect(page.locator('.cockpit-actions').getByTestId('daily-note-btn')).toBeVisible()
  await expect(page.locator('.cockpit-actions').getByTestId('new-project')).toBeVisible()

  await btn.click()
  await expect(page).toHaveURL(/#\/pages\/desk%2F\d{4}-\d{2}-\d{2}/)
  const key = new Date()
  const dateKey = `${key.getFullYear()}-${String(key.getMonth() + 1).padStart(2, '0')}-${String(key.getDate()).padStart(2, '0')}`
  expect(await mockNote(page, `desk/${dateKey}`)).not.toBeNull()
})

test('📍 set-as-current — pinning a page still writes desk/current (the panel is gone)', async ({ page }) => {
  await seed(page, 'pages/reel-plan', '# Reel Plan\n\nwork work', ['type/page'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/reel-plan'))
  await page.getByTestId('set-current').click()
  await expect
    .poll(async () => (await mockNote(page, 'desk/current'))?.metadata?.target)
    .toBe('pages/reel-plan')

  // The Projects page no longer surfaces it — day furniture moved out.
  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()
  await expect(page.locator('.today-current-note')).toHaveCount(0)
})

// ——— ⭐ This week — the latest desk/weekly review's Top 3, whispered ———

const WEEK_REVIEW = [
  '# Week Plan — Mon July 13, 2026',
  '',
  '*First full run of* [[desk/weekly/template]]*.*',
  '',
  '## ⭐ TOP 3 THIS WEEK',
  '',
  '*If nothing else happens, this is a win. Ruthless — never more than 3.*',
  '',
  '1. **Fire the warm Jonathan text** — unfreezes the entire Escensus pilot.',
  '2. **Finish Amanda video edits → hand to Cassy** — releases Cassy + Patricia.',
  '3. **Back up the Escensus scoring work** — irreplaceable, at risk of loss.',
  '',
  '*Bonus (2-min): send Amanda video 8.*',
  '',
  '## 🎯 MASTER PRIORITY LIST',
  '',
  '- Never surfaces on the Projects page.',
].join('\n')

test('⭐ This week — the latest review’s Top 3 renders; clicking opens the review', async ({ page }) => {
  // The template and an older week must both LOSE to the latest dated note.
  await seed(page, 'desk/weekly/template', '# Template\n\n## ⭐ TOP 3 THIS WEEK\n\n1. Template noise', ['desk'], {})
  await seed(page, 'desk/weekly/2026-07-06', '# Old week\n\n## ⭐ TOP 3 THIS WEEK\n\n1. Old week thing', ['desk'], {})
  await seed(page, 'desk/weekly/2026-07-13', WEEK_REVIEW, ['desk'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const week = page.getByTestId('week-top3')
  await expect(week).toBeVisible()
  await expect(week).toContainText('This week')

  // Three quiet lines, markdown stripped to plain text; asides ignored.
  const items = week.locator('li')
  await expect(items).toHaveCount(3)
  await expect(items.nth(0)).toHaveText(
    'Fire the warm Jonathan text — unfreezes the entire Escensus pilot.',
  )
  await expect(items.nth(1)).toContainText('Finish Amanda video edits → hand to Cassy')
  await expect(items.nth(2)).toContainText('Back up the Escensus scoring work')
  await expect(week).not.toContainText('Bonus')
  await expect(week).not.toContainText('Old week thing')
  await expect(week).not.toContainText('Template noise')
  // Not a checklist — nothing to tick here.
  await expect(week.locator('input')).toHaveCount(0)

  // The block is one door: click → the weekly review itself.
  await week.click()
  await expect(page).toHaveURL(/#\/pages\/desk%2Fweekly%2F2026-07-13/)
})

test('⭐ This week — no weekly review, no element (air, not an empty state)', async ({ page }) => {
  await seed(page, 'desk/weekly/template', '# Template\n\n## ⭐ TOP 3 THIS WEEK\n\n1. Template noise', ['desk'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  await expect(page.getByTestId('cockpit')).toBeVisible()
  await expect(page.getByTestId('week-top3')).toHaveCount(0)
})

// ——— The ritual chip + the quiet tracker exit ———

/** This week's Monday (local), same rule the app uses. */
function thisMonday(): string {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}

test('Ritual chip — green when this week is minted; click opens the template', async ({ page }) => {
  const monday = thisMonday()
  await seed(page, 'desk/weekly/template', '# The Weekly Project Review — Template', ['desk'], {})
  await seed(page, `desk/weekly/${monday}`, `# Week Plan — ${monday}\n\n## ⭐ TOP 3 THIS WEEK\n\n1. One thing`, ['desk'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const chip = page.getByTestId('ritual-chip')
  await expect(chip).toBeVisible()
  await expect(chip).toHaveClass(/is-fresh/)
  await expect(chip).toContainText(`Week of ${monday} ✓`)

  // The chip is ALWAYS the door to the ritual's front door.
  await chip.click()
  await expect(page).toHaveURL(/#\/pages\/desk%2Fweekly%2Ftemplate/)
})

test('Ritual chip — only an old week exists → the calm red "Ritual due"', async ({ page }) => {
  await seed(page, 'desk/weekly/template', '# The Weekly Project Review — Template', ['desk'], {})
  await seed(page, 'desk/weekly/2020-01-06', '# Ancient week', ['desk'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const chip = page.getByTestId('ritual-chip')
  await expect(chip).toBeVisible()
  await expect(chip).toHaveClass(/is-due/)
  await expect(chip).toContainText('Ritual due')
  await expect(chip).not.toContainText('✓')
})

test('Tracker link — the quiet line at the bottom routes to the Tracker', async ({ page }) => {
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  const link = page.getByTestId('tracker-link')
  await expect(link).toBeVisible()
  await expect(link).toHaveText('All tasks → Tracker')
  await link.click()
  await expect(page).toHaveURL(/#\/tracker/)
  await expect(page.locator('.db-title')).toHaveText('Tracker')
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
  await page.getByTestId('macro-row').filter({ hasText: 'Amanda' }).click()
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
