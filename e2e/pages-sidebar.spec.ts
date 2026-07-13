// Pages sidebar fixes (Adam's live reports, July 12):
// 1. A freshly created page must still be in the sidebar after leaving Pages
//    and coming back (the lean fetch was unsorted + truncated at 500 — the
//    NEWEST notes silently fell off on a 700+ note vault).
// 2. Folders nest one level: _priority/escensus/… shows an "escensus"
//    subfolder instead of hiding 100+ notes behind "_priority".
// 3. The sidebar search is the app's ONE relevance ranking — body text counts.

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
  metadata: Record<string, unknown> = {},
) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags: [], metadata },
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

test('a fresh page survives leaving Pages and coming back — newest on top', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/pages')
  await expect(page.getByTestId('pages')).toBeVisible()

  // Create + title a page.
  await page.locator('.pages-new').click()
  await expect(page.locator('.page-prose')).toBeVisible()
  await page.locator('.page-prose h1').click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('# Ya')
  await expect(page.getByTestId('page-save')).toContainText('Saved', { timeout: 8000 })

  // Leave for the Cockpit, come back — the page MUST be first under Recent.
  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()
  await page.goto('http://127.0.0.1:4173/#/pages')
  await expect(page.locator('.pages-list .pages-item').first()).toContainText('Ya')
})

test('folders nest one level — escensus surfaces inside _priority', async ({ page }) => {
  await seed(page, '_priority/escensus/pitch-plan', '# Pitch plan\n\nBody.')
  await seed(page, '_priority/escensus/call-corpus', '# Call corpus\n\nBody.')
  await seed(page, '_priority/loose-note', '# Loose note\n\nBody.')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages')
  const group = page.locator('.pages-group', { hasText: '_priority' }).first()
  await group.locator('.pages-group-head').first().click()

  // Direct child listed; escensus is a collapsible subfolder with its count.
  await expect(group).toContainText('Loose Note')
  const sub = group.locator('.pages-subgroup', { hasText: 'escensus' })
  await expect(sub.locator('.pages-group-count')).toHaveText('2')
  await sub.locator('.pages-subgroup-head').click()
  await expect(sub).toContainText('Pitch Plan')
})

test('THE PLAN owns the top slot and opens on click', async ({ page }) => {
  await seed(page, 'desk/00-plan', '# The Plan\n\nFront door.', { pinned: true })
  await seed(page, 'pages/ordinary-note', '# Ordinary\n\nNothing pinned here.')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages')
  const plan = page.getByTestId('plan-slot')
  await expect(plan).toBeVisible()

  // The Plan slot is the VERY FIRST row in the list — above every section.
  await expect(page.locator('.pages-list .pages-item').first()).toContainText('00 Plan')
  await expect(page.locator('.pages-list > :first-child')).toHaveAttribute(
    'data-testid',
    'plan-slot',
  )

  // Clicking navigates like any row — the page opens in the editor.
  await plan.click()
  await expect(page).toHaveURL(/#\/pages\/desk%2F00-plan/)
  await expect(page.locator('.page-prose h1')).toContainText('The Plan')
})

test('Pinned folds away by default, reveals on toggle, and remembers across reload', async ({ page }) => {
  await seed(page, 'desk/00-plan', '# The Plan\n\nFront door.', { pinned: true })
  await seed(page, 'pages/pinned-alpha', '# Pinned Alpha\n\nBody.', { pinned: true })
  await seed(page, 'pages/pinned-beta', '# Pinned Beta\n\nBody.', { pinned: true })
  await seed(page, 'pages/ordinary-note', '# Ordinary\n\nNothing pinned here.')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages')
  const pinned = page.getByTestId('pages-pinned')
  const toggle = page.getByTestId('pinned-toggle')

  // Collapsed by default: only the header row (with the count) shows —
  // 23 pins were swamping the sidebar and burying Recent.
  await expect(toggle).toBeVisible()
  await expect(pinned.locator('.pages-group-count')).toHaveText('2')
  await expect(pinned.locator('.pages-item')).toHaveCount(0)
  await expect(pinned).not.toContainText('Pinned Alpha')

  // Expand: the pinned rows appear — but desk/00-plan stays out (it already
  // owns the Plan slot up top).
  await toggle.click()
  await expect(pinned.locator('.pages-item')).toHaveCount(2)
  await expect(pinned).toContainText('Pinned Alpha')
  await expect(pinned).toContainText('Pinned Beta')
  await expect(pinned).not.toContainText('00 Plan')
  await expect(pinned).not.toContainText('Ordinary')

  // The open state persists across a reload…
  await page.reload()
  await expect(page.getByTestId('pages-pinned').locator('.pages-item')).toHaveCount(2)

  // …and so does collapsing again.
  await page.getByTestId('pinned-toggle').click()
  await expect(page.getByTestId('pages-pinned').locator('.pages-item')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('pinned-toggle')).toBeVisible()
  await expect(page.getByTestId('pages-pinned').locator('.pages-item')).toHaveCount(0)
})

test('a non-pinned note lives only under Recent', async ({ page }) => {
  await seed(page, 'desk/00-plan', '# The Plan\n\nFront door.', { pinned: true })
  await seed(page, 'pages/pinned-alpha', '# Pinned Alpha\n\nBody.', { pinned: true })
  await seed(page, 'pages/ordinary-note', '# Ordinary\n\nNothing pinned here.')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages')
  await page.getByTestId('pinned-toggle').click()

  // Not in the Plan slot, not in the pinned group — only the Recent section
  // (and its folder) carries it.
  await expect(page.getByTestId('plan-slot')).not.toContainText('Ordinary')
  await expect(page.getByTestId('pages-pinned')).not.toContainText('Ordinary')
  const recent = page
    .locator('.pages-list .pages-item')
    .filter({ hasText: 'Ordinary' })
    .first()
  await expect(recent).toBeVisible()
})

// ——— SHELVES — virtual folders (desk/shelves). Visual grouping only: the
// layout lives in ONE markdown note; member paths/tags/links never change. ———

const SHELVES_INTRO =
  '*Sidebar shelves — visual only; paths never change. Edit freely.*'

const SHELVES_MD = [
  '# Shelves',
  '',
  SHELVES_INTRO,
  '',
  'Stray prose the parser must ignore.',
  '',
  '## Music',
  '- [[pages/song-idea]]',
  '- [[pages/gone-note]]',
  '',
  '## Research',
  '- [[pages/deep-dive]]',
  '',
].join('\n')

async function storedNote(page: Page, path: string) {
  const res = await page.request.get(
    `${MOCK}/__test/note?path=${encodeURIComponent(path)}`,
  )
  return res.ok() ? ((await res.json()) as { content: string }) : null
}

async function seedShelvesWorld(page: Page) {
  await seed(page, 'desk/00-plan', '# The Plan\n\nFront door.', { pinned: true })
  await seed(page, 'pages/pinned-alpha', '# Pinned Alpha\n\nBody.', { pinned: true })
  await seed(page, 'pages/song-idea', '# Song Idea\n\nBody.')
  await seed(page, 'pages/deep-dive', '# Deep Dive\n\nBody.')
  await seed(page, 'desk/shelves', SHELVES_MD)
  await connectViaStorage(page)
}

test('shelves render between Plan and Pinned; expanding shows members; a member opens', async ({ page }) => {
  await seedShelvesWorld(page)
  await page.goto('http://127.0.0.1:4173/#/pages')

  // Locked order: Plan slot → SHELVES → Pinned → Recent.
  await expect(page.locator('.pages-list > :nth-child(1)')).toHaveAttribute(
    'data-testid',
    'plan-slot',
  )
  await expect(page.locator('.pages-list > :nth-child(2)')).toHaveAttribute(
    'data-testid',
    'pages-shelves',
  )
  await expect(page.locator('.pages-list > :nth-child(3)')).toHaveAttribute(
    'data-testid',
    'pages-pinned',
  )
  await expect(page.locator('.pages-list > :nth-child(4)')).toHaveText('Recent')

  // Section open by default with the shelf count; each SHELF starts collapsed.
  const shelves = page.getByTestId('pages-shelves')
  await expect(shelves.getByTestId('shelves-toggle').locator('.pages-group-count')).toHaveText('2')
  await expect(shelves.getByTestId('shelf-head')).toHaveCount(2)
  await expect(shelves.locator('.pages-item')).toHaveCount(0)

  // Expand Music: the real member shows; the vanished note is skipped
  // silently (its wikilink stays in the markdown, it just doesn't render).
  const music = shelves.locator('.pages-shelf', { hasText: 'Music' })
  await expect(music.locator('.pages-group-count')).toHaveText('1')
  await music.getByTestId('shelf-head').click()
  await expect(music.locator('.pages-item')).toHaveCount(1)
  await expect(music).toContainText('Song Idea')
  await expect(music).not.toContainText('Gone Note')

  // A member row is a normal page row — clicking opens the page.
  await music.locator('.pages-item', { hasText: 'Song Idea' }).click()
  await expect(page).toHaveURL(/#\/pages\/pages%2Fsong-idea/)
  await expect(page.locator('.page-prose h1')).toContainText('Song Idea')
})

test('creating the first shelf mints desk/shelves; + search adds a [[wikilink]] member', async ({ page }) => {
  // No desk/shelves seeded — the section is just the "+ New shelf" affordance.
  await seed(page, 'pages/song-idea', '# Song Idea\n\nBody.')
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/pages')

  const shelves = page.getByTestId('pages-shelves')
  await expect(shelves.getByTestId('shelf-head')).toHaveCount(0)
  await shelves.getByTestId('shelf-new').click()
  const nameInput = shelves.getByTestId('shelf-name-input')

  // Empty name: quietly rejected, the input stays open.
  await nameInput.press('Enter')
  await expect(nameInput).toBeVisible()

  await nameInput.fill('Reading')
  await nameInput.press('Enter')
  const head = shelves.getByTestId('shelf-head')
  await expect(head).toContainText('Reading')

  // The saved markdown is the canonical format — H2 + intro line.
  await expect
    .poll(async () => (await storedNote(page, 'desk/shelves'))?.content ?? '')
    .toContain('## Reading')
  expect((await storedNote(page, 'desk/shelves'))?.content).toContain(SHELVES_INTRO)

  // Add a member via the shelf's + search (titles filter as you type).
  const row = shelves.locator('.pages-shelf', { hasText: 'Reading' })
  await row.locator('.pages-shelf-row').hover()
  await row.getByTestId('shelf-add').click()
  await row.getByTestId('shelf-add-input').fill('song')
  await row.getByTestId('shelf-add-result').filter({ hasText: 'Song Idea' }).click()

  await expect(row.locator('.pages-group-count')).toHaveText('1')
  await expect
    .poll(async () => (await storedNote(page, 'desk/shelves'))?.content ?? '')
    .toContain('- [[pages/song-idea]]')
})

test('removing a member and deleting a shelf rewrite the markdown — notes untouched', async ({ page }) => {
  await seedShelvesWorld(page)
  await page.goto('http://127.0.0.1:4173/#/pages')

  const shelves = page.getByTestId('pages-shelves')
  const music = shelves.locator('.pages-shelf', { hasText: 'Music' })

  // Remove Song Idea from Music (hover ×) — membership only.
  await music.getByTestId('shelf-head').click()
  const member = music.locator('.pages-shelf-member', { hasText: 'Song Idea' })
  await member.hover()
  await member.getByTestId('shelf-remove').click()
  await expect(music.locator('.pages-item')).toHaveCount(0)
  await expect
    .poll(async () => (await storedNote(page, 'desk/shelves'))?.content ?? '')
    .not.toContain('[[pages/song-idea]]')
  const afterRemove = (await storedNote(page, 'desk/shelves'))?.content ?? ''
  expect(afterRemove).toContain('## Music') // the (now empty) shelf remains
  expect(afterRemove).toContain('- [[pages/deep-dive]]')
  // The note itself never moved or changed.
  expect((await storedNote(page, 'pages/song-idea'))?.content).toBe('# Song Idea\n\nBody.')

  // Delete Research (has a member → confirm) — its note stays put.
  page.once('dialog', (d) => void d.accept())
  const research = shelves.locator('.pages-shelf', { hasText: 'Research' })
  await research.locator('.pages-shelf-row').hover()
  await research.getByTestId('shelf-delete').click()
  await expect(shelves.getByTestId('shelf-head')).toHaveCount(1)
  await expect
    .poll(async () => (await storedNote(page, 'desk/shelves'))?.content ?? '')
    .not.toContain('## Research')
  expect((await storedNote(page, 'pages/deep-dive'))?.content).toBe('# Deep Dive\n\nBody.')
})

test('shelf and section collapse states persist across reload', async ({ page }) => {
  await seedShelvesWorld(page)
  await page.goto('http://127.0.0.1:4173/#/pages')

  const shelves = page.getByTestId('pages-shelves')
  const music = shelves.locator('.pages-shelf', { hasText: 'Music' })

  // Expand Music, reload: still expanded (per-shelf key, by name).
  await music.getByTestId('shelf-head').click()
  await expect(music.locator('.pages-item')).toHaveCount(1)
  await page.reload()
  await expect(
    page
      .getByTestId('pages-shelves')
      .locator('.pages-shelf', { hasText: 'Music' })
      .locator('.pages-item'),
  ).toHaveCount(1)

  // Collapse the whole section, reload: it stays folded (header only).
  await page.getByTestId('shelves-toggle').click()
  await expect(page.getByTestId('pages-shelves').getByTestId('shelf-head')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('shelves-toggle')).toBeVisible()
  await expect(page.getByTestId('pages-shelves').getByTestId('shelf-head')).toHaveCount(0)
})

// ——— SHELF DRAG & DROP — native HTML5 DnD. Playwright's mouse-based drag
// can't carry a DataTransfer through the app's dragover guards, so each drag
// hand-dispatches the real event sequence with ONE shared DataTransfer —
// exactly what a browser does, minus the ghost image. ———

type DropPos = 'top' | 'bottom' | 'center'

async function dragDrop(
  page: Page,
  source: Locator,
  target: Locator,
  pos: DropPos = 'center',
) {
  const src = await source.elementHandle()
  const tgt = await target.elementHandle()
  if (!src || !tgt) throw new Error('drag endpoints not found')
  await page.evaluate(
    ({ src, tgt, pos }) => {
      const dt = new DataTransfer()
      const r = tgt.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y =
        pos === 'top'
          ? r.top + 2
          : pos === 'bottom'
            ? r.bottom - 2
            : r.top + r.height / 2
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: x,
            clientY: y,
          }),
        )
      fire(src, 'dragstart')
      fire(tgt, 'dragenter')
      fire(tgt, 'dragover')
      fire(tgt, 'drop')
      fire(src, 'dragend')
    },
    { src, tgt, pos },
  )
}

const DND_SHELVES_MD = [
  '# Shelves',
  '',
  SHELVES_INTRO,
  '',
  '## Mixes',
  '- [[pages/alpha-track]]',
  '- [[pages/beta-track]]',
  '',
  '## Stems',
  '- [[pages/gamma-stem]]',
  '',
].join('\n')

async function seedDndWorld(page: Page) {
  await seed(page, 'pages/alpha-track', '# Alpha Track\n\nBody.')
  await seed(page, 'pages/beta-track', '# Beta Track\n\nBody.')
  await seed(page, 'pages/gamma-stem', '# Gamma Stem\n\nBody.')
  await seed(page, 'pages/fresh-cut', '# Fresh Cut\n\nBody.')
  await seed(page, 'desk/shelves', DND_SHELVES_MD)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/pages')
  await expect(
    page.getByTestId('pages-shelves').getByTestId('shelf-head'),
  ).toHaveCount(2)
}

test('drag a Recent note onto a shelf header — membership lands in the markdown', async ({ page }) => {
  await seedDndWorld(page)
  const recentRow = page.locator('.pages-list > .pages-item', { hasText: 'Fresh Cut' })
  const stems = page
    .getByTestId('pages-shelves')
    .locator('.pages-shelf', { hasText: 'Stems' })

  await dragDrop(page, recentRow, stems.getByTestId('shelf-head'))

  await expect(stems.locator('.pages-group-count')).toHaveText('2')
  await expect
    .poll(async () => (await storedNote(page, 'desk/shelves'))?.content ?? '')
    .toContain('## Stems\n- [[pages/gamma-stem]]\n- [[pages/fresh-cut]]')
  // Dropping is additive — the note itself never moved or changed.
  expect((await storedNote(page, 'pages/fresh-cut'))?.content).toBe('# Fresh Cut\n\nBody.')

  // Same drop again: already a member — silent no-op, no duplicate line.
  await dragDrop(page, recentRow, stems.getByTestId('shelf-head'))
  await page.waitForTimeout(250)
  const after = (await storedNote(page, 'desk/shelves'))?.content ?? ''
  expect(after.match(/\[\[pages\/fresh-cut\]\]/g)).toHaveLength(1)
})

test('drag a member above another — the shelf lines reorder', async ({ page }) => {
  await seedDndWorld(page)
  const mixes = page
    .getByTestId('pages-shelves')
    .locator('.pages-shelf', { hasText: 'Mixes' })
  await mixes.getByTestId('shelf-head').click()
  await expect(mixes.locator('.pages-item')).toHaveCount(2)

  const beta = mixes.locator('.pages-item', { hasText: 'Beta Track' })
  const alphaRow = mixes.locator('.pages-shelf-member', { hasText: 'Alpha Track' })
  await dragDrop(page, beta, alphaRow, 'top')

  await expect
    .poll(async () => (await storedNote(page, 'desk/shelves'))?.content ?? '')
    .toContain('## Mixes\n- [[pages/beta-track]]\n- [[pages/alpha-track]]')
})

test('drag a member from shelf A to shelf B — moved, never duplicated', async ({ page }) => {
  await seedDndWorld(page)
  const shelves = page.getByTestId('pages-shelves')
  const mixes = shelves.locator('.pages-shelf', { hasText: 'Mixes' })
  const stems = shelves.locator('.pages-shelf', { hasText: 'Stems' })
  await stems.getByTestId('shelf-head').click()

  const gamma = stems.locator('.pages-item', { hasText: 'Gamma Stem' })
  await dragDrop(page, gamma, mixes.getByTestId('shelf-head'))

  await expect
    .poll(async () => (await storedNote(page, 'desk/shelves'))?.content ?? '')
    .toContain(
      '## Mixes\n- [[pages/alpha-track]]\n- [[pages/beta-track]]\n- [[pages/gamma-stem]]',
    )
  const content = (await storedNote(page, 'desk/shelves'))?.content ?? ''
  expect(content.match(/\[\[pages\/gamma-stem\]\]/g)).toHaveLength(1)
  expect(content).toContain('## Stems') // the emptied shelf survives
})

test('drag shelf Stems above Mixes — the H2 order flips', async ({ page }) => {
  await seedDndWorld(page)
  const shelves = page.getByTestId('pages-shelves')
  const stemsHead = shelves
    .locator('.pages-shelf', { hasText: 'Stems' })
    .getByTestId('shelf-head')
  const mixesRow = shelves
    .locator('.pages-shelf', { hasText: 'Mixes' })
    .locator('.pages-shelf-row')

  await dragDrop(page, stemsHead, mixesRow, 'top')

  await expect
    .poll(async () => (await storedNote(page, 'desk/shelves'))?.content ?? '')
    .toContain('## Stems\n- [[pages/gamma-stem]]\n\n## Mixes\n- [[pages/alpha-track]]')
})

test('sidebar search finds body-text mentions (the Arianne case)', async ({ page }) => {
  await seed(page, 'pages/session-notes', '# Session Notes\n\nReviewed Arianne’s taiko beat.')
  await seed(page, 'pages/other-note', '# Other note\n\nNothing relevant here.')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages')
  await page.locator('.pages-side-search').fill('arianne')
  await expect(page.locator('.pages-list .pages-item')).toHaveCount(1)
  await expect(page.locator('.pages-list .pages-item')).toContainText('Session Notes')
})
