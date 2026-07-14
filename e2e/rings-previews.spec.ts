// PROGRESS RINGS + COCKPIT CONTENT PREVIEWS.
//
// Rings (Craft's doc-title ring): a note with checkboxes carries a small
// done/total ring — Pages topbar (live from the editor's buffer, display
// only) and the Tasks tab's "In your notes" note-group headers. Fenced
// checkboxes are quotation, not work; a note with zero checkboxes gets NO
// ring. Previews (Craft Home, restrained): each world card on the Cockpit
// gains ONE muted line — the week-card Priority → the next open task
// (active first) → nothing at all (never a placeholder).

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

// 2 done of 5 real checkboxes + a fenced decoy that must never count.
const RING_NOTE = [
  '# Ring Note',
  '',
  '- [x] first done',
  '- [ ] second open',
  '- [x] third done',
  '- [ ] fourth open',
  '- [ ] fifth open',
  '',
  '```',
  '- [ ] decoy inside the fence',
  '- [x] second decoy',
  '```',
  '',
].join('\n')

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Pages topbar ring — counts real checkboxes only (2/5, fence excluded) and moves the moment a box is checked, before any save', async ({ page }) => {
  await seed(page, 'pages/ring-note', RING_NOTE)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/ring-note'))
  await expect(page.locator('.page-prose')).toBeVisible()

  // The ring sits in the topbar: 2 of 5 — the fenced decoys never count.
  const ring = page.locator('.page-topbar').getByTestId('checkbox-ring')
  await expect(ring).toBeVisible()
  await expect(ring).toHaveAttribute('data-done', '2')
  await expect(ring).toHaveAttribute('data-total', '5')
  await expect(ring.locator('.checkbox-ring-count')).toHaveText('2/5')
  await expect(ring).toHaveAttribute('title', '2 of 5 done')

  // Check a box IN the editor → the ring moves immediately (display derives
  // from the live buffer; the debounced save hasn't landed yet — the topbar
  // still says Unsaved while the ring already reads 3/5).
  await page
    .locator('.page-prose li')
    .filter({ hasText: 'second open' })
    .locator('input[type="checkbox"]')
    .click()
  await expect(ring.locator('.checkbox-ring-count')).toHaveText('3/5')

  expect(errors, errors.join('\n')).toEqual([])
})

test('Pages topbar — a note with zero checkboxes shows NO ring; a fully-checked note goes quiet green (is-full)', async ({ page }) => {
  await seed(page, 'pages/prose-only', '# Prose Only\n\nJust thinking, no work items.\n')
  await seed(page, 'pages/all-done', '# All Done\n\n- [x] one\n- [x] two\n')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/prose-only'))
  await expect(page.locator('.page-prose')).toBeVisible()
  await expect(page.locator('.page-topbar').getByTestId('checkbox-ring')).toHaveCount(0)

  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/all-done'))
  await expect(page.locator('.page-prose')).toBeVisible()
  const ring = page.locator('.page-topbar').getByTestId('checkbox-ring')
  await expect(ring.locator('.checkbox-ring-count')).toHaveText('2/2')
  await expect(ring).toHaveClass(/is-full/)
})

test('Tasks tab — the "In your notes" note-group header carries the ring (whole-note tally, done lines included)', async ({ page }) => {
  await seed(page, 'pages/ring-note', RING_NOTE)
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await expect(page.getByTestId('tasks-view')).toBeVisible()
  await page.getByTestId('tasks-chips').getByRole('tab', { name: 'All' }).click()

  const looseSection = page.getByTestId('tasks-loose')
  const head = looseSection.getByTestId('tasks-group-head')
  await expect(head).toContainText('Ring Note')
  // 3 open lines listed; the ring reads the whole note — 2 of 5.
  await expect(looseSection.getByTestId('loose-row')).toHaveCount(3)
  const ring = head.getByTestId('checkbox-ring')
  await expect(ring).toHaveAttribute('data-done', '2')
  await expect(ring).toHaveAttribute('data-total', '5')
  await expect(ring.locator('.checkbox-ring-count')).toHaveText('2/5')
})

test('Cockpit previews — week-card Priority → next open ACTIVE task → nothing at all', async ({ page }) => {
  // alpha: has a week card → the Priority line is the preview.
  await seed(page, 'projects/alpha', '# Alpha World', ['project'], {
    key: 'alpha', tag: 'alpha', status: 'active', order: 1,
  })
  await seed(
    page,
    'projects/alpha/weekly/2026-07-13',
    [
      '# Alpha — week of 2026-07-13',
      '',
      '## Priority',
      'Ship the alpha launch page before Friday.',
      '',
      '## Top 3',
      '- [ ] Draft the hero copy',
    ].join('\n'),
  )
  // beta: NO card, two open tasks — the ACTIVE one outranks the earlier
  // 'next' one; the done one never counts.
  await seed(page, 'projects/beta', '# Beta World', ['project'], {
    key: 'beta', tag: 'beta', status: 'active', order: 2,
  })
  await seed(page, 'tasks/beta/earlier-next', 'Waiting-in-line task', ['task'], {
    project: 'beta', state: 'next', done: false,
  })
  await seed(page, 'tasks/beta/the-active-one', 'Wire the beta signup flow', ['task'], {
    project: 'beta', state: 'active', done: false,
  })
  await seed(page, 'tasks/beta/already-done', 'Finished thing', ['task'], {
    project: 'beta', state: 'done', done: true,
  })
  // gamma: no card, no open tasks → NO preview element, no placeholder.
  await seed(page, 'projects/gamma', '# Gamma World', ['project'], {
    key: 'gamma', tag: 'gamma', status: 'active', order: 3,
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/projects')
  await expect(page.getByTestId('cockpit')).toBeVisible()
  const rows = page.getByTestId('macro-row')
  await expect(rows).toHaveCount(3)

  // alpha — the card's Priority line, muted, one line.
  const alpha = rows.filter({ hasText: 'Alpha World' })
  await expect(alpha.getByTestId('macro-preview')).toHaveText(
    'Ship the alpha launch page before Friday.',
  )
  // The ⭐-adjacent one-thing (macro-top) is untouched — still the first
  // unresolved Top-3 item.
  await expect(alpha.getByTestId('macro-top')).toContainText('Draft the hero copy')

  // beta — no card: the next open task, active first.
  await expect(rows.filter({ hasText: 'Beta World' }).getByTestId('macro-preview')).toHaveText(
    'Wire the beta signup flow',
  )

  // gamma — neither: no preview element at all (air, not an empty state).
  await expect(
    rows.filter({ hasText: 'Gamma World' }).getByTestId('macro-preview'),
  ).toHaveCount(0)

  expect(errors, errors.join('\n')).toEqual([])
})
