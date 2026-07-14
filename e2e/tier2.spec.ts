// Tier 2 — verb-gated widgets + sacred-handful locks. The week card's Top 3
// becomes a widget offering ONLY sanctioned moves (✅ check · ✏️ cross off ·
// the earned ＋ bonus win, hard-capped at 3+1), every press a surgical line
// write into the card note — never a doc regeneration. The world card grows
// a quiet ➕ that appears only when the committed week is fully done. And a
// note carrying metadata.locked === true renders read-only in the Pages
// editor behind a two-step, visit-scoped unlock pill.

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

/** 'friday' → the NEXT Friday, never today — parseDue's rule. */
function nextFriday(): string {
  const now = new Date()
  const delta = (5 - now.getDay() + 7) % 7 || 7
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}

// ——— the Loft world: spine + this week's card ———

const CARD_OPEN = [
  '# Loft — Week of 2026-07-13',
  '',
  '## Priority',
  'Finish the vocal comps.',
  '',
  '## Top 3',
  '- [ ] Comp the bridge vocal',
  '- [ ] Print rough mix v3',
  '- [ ] Send stems to Aaron',
  '',
  '## Blockers / waiting on',
  '- none',
].join('\n')

// Two already checked, one still open — one press from the earned slot.
const CARD_NEARLY = CARD_OPEN.replace(
  '- [ ] Comp the bridge vocal',
  '- [x] Comp the bridge vocal',
).replace('- [ ] Print rough mix v3', '- [x] Print rough mix v3')

// Fully resolved: two checked, one crossed off (renounced, box untouched).
const CARD_RESOLVED = CARD_NEARLY.replace(
  '- [ ] Send stems to Aaron',
  '- [ ] ~~Send stems to Aaron~~',
)

async function seedLoft(page: Page, card: string) {
  await seed(page, 'projects/loft', '# Loft Album\n\nThe record.', ['project'], {
    key: 'loft', tag: 'loft', status: 'active', order: 1, summary: 'The record.',
  })
  await seed(page, 'projects/loft/weekly/2026-07-13', card, [], {})
}

async function openLoft(page: Page) {
  await page.goto(
    'http://127.0.0.1:4173/#/project/' + encodeURIComponent('projects/loft'),
  )
  await expect(page.getByTestId('week-card')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('✅ check — flips exactly ONE line of the card note; every other byte survives', async ({ page }) => {
  await seedLoft(page, CARD_OPEN)
  await connectViaStorage(page)
  await openLoft(page)

  const items = page.getByTestId('week-top3-item')
  await expect(items).toHaveCount(3)
  await items.nth(0).locator('input').check()

  // Full-content equality: the seeded card with ONLY that line changed.
  await expect
    .poll(async () => (await mockNote(page, 'projects/loft/weekly/2026-07-13'))?.content)
    .toBe(CARD_OPEN.replace('- [ ] Comp the bridge vocal', '- [x] Comp the bridge vocal'))
  await expect(items.nth(0)).toHaveClass(/is-done/)

  // And back — a toggle, not a one-way door. Byte-identical to the seed.
  await items.nth(0).locator('input').uncheck()
  await expect
    .poll(async () => (await mockNote(page, 'projects/loft/weekly/2026-07-13'))?.content)
    .toBe(CARD_OPEN)
})

test('✏️ cross off — wraps the item text in ~~…~~, box untouched; second press unwraps', async ({ page }) => {
  await seedLoft(page, CARD_OPEN)
  await connectViaStorage(page)
  await openLoft(page)

  const item = page.getByTestId('week-top3-item').nth(1)
  await item.getByTestId('top3-cross').click()

  await expect
    .poll(async () => (await mockNote(page, 'projects/loft/weekly/2026-07-13'))?.content)
    .toBe(CARD_OPEN.replace('- [ ] Print rough mix v3', '- [ ] ~~Print rough mix v3~~'))
  // Renounced, not done: struck through in the UI, box still unchecked,
  // display text carries no tildes.
  await expect(item).toHaveClass(/is-crossed/)
  await expect(item.locator('input')).not.toBeChecked()
  await expect(item.locator('span')).toHaveText('Print rough mix v3')

  // Take it back — byte-identical to the seed again.
  await item.getByTestId('top3-cross').click()
  await expect
    .poll(async () => (await mockNote(page, 'projects/loft/weekly/2026-07-13'))?.content)
    .toBe(CARD_OPEN)
})

test('＋ bonus win — earned only when all three resolve; appends a 4th line; 4 is forever the cap', async ({ page }) => {
  await seedLoft(page, CARD_NEARLY)
  await connectViaStorage(page)
  await openLoft(page)

  // 2 checked + 1 open → not earned yet.
  await expect(page.getByTestId('top3-bonus')).toHaveCount(0)

  // Cross off the third (2 checked + 1 crossed = all resolved) → the ONE
  // quiet affordance appears.
  await page.getByTestId('week-top3-item').nth(2).getByTestId('top3-cross').click()
  const afterCross = CARD_NEARLY.replace(
    '- [ ] Send stems to Aaron',
    '- [ ] ~~Send stems to Aaron~~',
  )
  await expect
    .poll(async () => (await mockNote(page, 'projects/loft/weekly/2026-07-13'))?.content)
    .toBe(afterCross)
  const bonus = page.getByTestId('top3-bonus')
  await expect(bonus).toBeVisible()

  // Enter appends `- [ ] <text>` as the 4th line under ## Top 3 — a targeted
  // insert, everything else byte-stable.
  await bonus.click()
  const input = page.getByTestId('top3-bonus-input')
  await input.fill('Sketch the outro strings')
  await input.press('Enter')
  await expect
    .poll(async () => (await mockNote(page, 'projects/loft/weekly/2026-07-13'))?.content)
    .toBe(
      afterCross.replace(
        '- [ ] ~~Send stems to Aaron~~',
        '- [ ] ~~Send stems to Aaron~~\n- [ ] Sketch the outro strings',
      ),
    )

  // 4 items now — the affordance is gone, and the bonus item carries the
  // same verbs without ever unlocking a fifth.
  const items = page.getByTestId('week-top3-item')
  await expect(items).toHaveCount(4)
  await expect(page.getByTestId('top3-bonus')).toHaveCount(0)
  await items.nth(3).locator('input').check()
  await expect
    .poll(async () => (await mockNote(page, 'projects/loft/weekly/2026-07-13'))?.content)
    .toContain('- [x] Sketch the outro strings')
  await expect(page.getByTestId('top3-bonus')).toHaveCount(0)
})

test('world ➕ — only when the committed week is fully done; mints an active this-week task with parsed due', async ({ page }) => {
  await seedLoft(page, CARD_RESOLVED)
  await seed(page, 'tasks/loft/mix-notes', 'Mix notes pass', ['task'], {
    project: 'loft', state: 'active', done: false, when: 'this-week',
  })
  await connectViaStorage(page)
  await openLoft(page)

  // Top 3 all resolved but one committed this-week task still open → no ➕.
  await expect(page.locator('.status-task')).toBeVisible()
  await expect(page.getByTestId('world-next-task')).toHaveCount(0)

  // Finish the week: the last open this-week task goes done. (click, not
  // check — the row leaves the open-tasks list the moment done flips, so
  // there is no checked state left to verify.)
  await page.locator('.status-task input').click()
  const next = page.getByTestId('world-next-task')
  await expect(next).toBeVisible()
  await expect(next).toContainText('next task for Loft Album')

  // Inline mint with an optional due (parseDue: 'friday' → NEXT Friday).
  await next.click()
  await page.getByTestId('world-next-input').fill('Cut the reprise stems')
  await page.getByTestId('world-next-due').fill('friday')
  await page.getByTestId('world-next-due').press('Enter')

  await expect
    .poll(async () => (await mockNote(page, 'tasks/loft/cut-the-reprise-stems'))?.metadata)
    .toEqual({
      project: 'loft',
      state: 'active',
      when: 'this-week',
      done: false,
      due: nextFriday(),
    })
  const minted = await mockNote(page, 'tasks/loft/cut-the-reprise-stems')
  expect(minted.content).toBe('Cut the reprise stems')
  expect(minted.tags).toContain('task')

  // The minted task IS the new committed week — the gate closes again.
  await expect(page.getByTestId('world-next-task')).toHaveCount(0)
})

test('sacred-handful lock — read-only editor, two-step visit unlock, re-locks on navigate; unlocked notes untouched', async ({ page }) => {
  await seed(page, 'pages/sacred', '# The Sacred One\n\nHands off, mostly.', [], {
    locked: true,
  })
  await seed(page, 'pages/free', '# Free Note\n\nType away.', [], {})
  await connectViaStorage(page)

  await page.goto(
    'http://127.0.0.1:4173/#/pages/' + encodeURIComponent('pages/sacred'),
  )
  const prose = page.locator('.page-prose')
  await expect(prose).toContainText('Hands off, mostly.')

  // Locked: contenteditable false, typing lands nowhere, mutating tools out.
  await expect(prose).toHaveAttribute('contenteditable', 'false')
  const pill = page.getByTestId('lock-pill')
  await expect(pill).toHaveText('🔒 Locked — the sacred handful')
  await prose.click()
  await page.keyboard.type('INTRUDER')
  await expect(prose).not.toContainText('INTRUDER')
  await expect(page.getByTestId('insert-link')).toBeDisabled()

  // The deliberate two-step: click → the pill asks → click again → editable.
  await pill.click()
  await expect(pill).toHaveText('Unlock for this visit?')
  await pill.click()
  await expect(pill).toHaveText('🔓 Unlocked this visit')
  await expect(prose).toHaveAttribute('contenteditable', 'true')
  await expect(page.getByTestId('insert-link')).toBeEnabled()
  await prose.click()
  await page.keyboard.type('A blessed edit. ')
  await expect(prose).toContainText('A blessed edit.')

  // Navigate away (in-app, no reload) — an unlocked note stays fully normal…
  await page.evaluate(() => {
    location.hash = '#/pages/' + encodeURIComponent('pages/free')
  })
  await expect(page.locator('.page-prose')).toContainText('Type away.')
  await expect(page.locator('.page-prose')).toHaveAttribute('contenteditable', 'true')
  await expect(page.getByTestId('lock-pill')).toHaveCount(0)
  await expect(page.getByTestId('insert-link')).toBeEnabled()

  // …and coming back, the sacred one is locked again (nothing persisted).
  await page.evaluate(() => {
    location.hash = '#/pages/' + encodeURIComponent('pages/sacred')
  })
  await expect(page.getByTestId('lock-pill')).toHaveText('🔒 Locked — the sacred handful')
  await expect(page.locator('.page-prose')).toHaveAttribute('contenteditable', 'false')
})
