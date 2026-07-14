// W1 — Work Docs (build log PART 30): Google-Docs-style tabs on desk/ docs,
// and the project world's Docs door.

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
  const res = await page.request.get(`${MOCK}/api/notes?id=${encodeURIComponent(path)}`, {
    headers: AUTH,
  })
  return res.ok() ? res.json() : null
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('daily note gets the tab rail; ＋ adds a tab (real sub-note) and opens it', async ({ page }) => {
  await seed(page, 'desk/2026-07-12', '# Saturday, July 12\n\nMain thread.', ['desk'], {})
  await seed(page, 'desk/2026-07-12/aaron-neyer', '# Aaron Neyer\n\n- [ ] send videos', ['desk'], {})
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent('desk/2026-07-12'))
  const rail = page.getByTestId('worktabs')
  await expect(rail).toBeVisible()
  // Root ("Main") + one tab, active state on the root.
  await expect(rail.locator('.worktabs-item')).toHaveCount(2)
  await expect(rail.locator('.worktabs-item.is-active')).toContainText('Saturday')
  await expect(rail).toContainText('Aaron Neyer')

  // Add a tab → creates desk/<date>/<slug>, navigates there, rail updates.
  await page.getByTestId('worktabs-add').click()
  await page.locator('.worktabs-input').fill('UI app')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/desk%2F2026-07-12%2Fui-app/)
  await expect(page.getByTestId('worktabs').locator('.worktabs-item')).toHaveCount(3)
  expect(await mockNote(page, 'desk/2026-07-12/ui-app')).not.toBeNull()

  // Tabs collapse to a sliver and come back.
  await page.locator('.worktabs-hide').click()
  await expect(page.getByTestId('worktabs')).toHaveCount(0)
  await page.getByTestId('worktabs-expand').click()
  await expect(page.getByTestId('worktabs')).toBeVisible()
})

test('world Docs door — create a project work doc, tabbed under desk/<key>', async ({ page }) => {
  await seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x',
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/')
  await page.getByTestId('macro-row').filter({ hasText: 'Amanda' }).click()
  await page.locator('.landing-doors button', { hasText: 'docs' }).click()
  await expect(page.getByTestId('world-docs')).toBeVisible()

  await page.getByTestId('world-new-doc').click()
  await page.locator('.world-new-input').fill('Sprint')
  await page.keyboard.press('Enter')

  // Opens in the editor WITH the tab rail; note lives at desk/amanda/sprint.
  await expect(page).toHaveURL(/desk%2Famanda%2Fsprint/)
  await expect(page.getByTestId('worktabs')).toBeVisible()
  expect(await mockNote(page, 'desk/amanda/sprint')).not.toBeNull()
})

// ——— TAB DRAG & DROP — native HTML5 DnD, same dispatch trick as the shelves
// suite: Playwright's mouse-based drag can't carry a DataTransfer through the
// app's dragover guards, so each drag hand-dispatches the real event sequence
// with ONE shared DataTransfer — exactly what a browser does, minus the ghost
// image. ———

async function dragDrop(page: Page, source: Locator, target: Locator, pos: 'top' | 'bottom') {
  const src = await source.elementHandle()
  const tgt = await target.elementHandle()
  if (!src || !tgt) throw new Error('drag endpoints not found')
  await page.evaluate(
    ({ src, tgt, pos }) => {
      const dt = new DataTransfer()
      const r = tgt.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = pos === 'top' ? r.top + 2 : r.bottom - 2
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

/** A drag that never lands: start, hover a slot, then let go OUTSIDE any
 * drop target (Escape / dropped on the editor). No drop event ever fires. */
async function dragCancel(page: Page, source: Locator, hover: Locator) {
  const src = await source.elementHandle()
  const tgt = await hover.elementHandle()
  if (!src || !tgt) throw new Error('drag endpoints not found')
  await page.evaluate(
    ({ src, tgt }) => {
      const dt = new DataTransfer()
      const r = tgt.getBoundingClientRect()
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: r.left + r.width / 2,
            clientY: r.top + 2,
          }),
        )
      fire(src, 'dragstart')
      fire(tgt, 'dragenter')
      fire(tgt, 'dragover')
      fire(src, 'dragend') // cancelled — no drop anywhere
    },
    { src, tgt },
  )
}

const WS = 'desk/2026-07-13'

async function seedTabWorld(page: Page) {
  await seed(page, WS, '# Monday\n\nMain thread.', ['desk'], {})
  await seed(page, `${WS}/alpha`, '# Alpha\n', ['desk'], {})
  await seed(page, `${WS}/bravo`, '# Bravo\n', ['desk'], {})
  await seed(page, `${WS}/charlie`, '# Charlie\n', ['desk'], {})
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent(WS))
}

test('drag a tab above another — 10-spaced tab_order lands in the vault and survives reload', async ({ page }) => {
  await seedTabWorld(page)
  const items = page.getByTestId('worktabs').locator('.worktabs-item')
  await expect(items).toHaveText(['Monday', 'Alpha', 'Bravo', 'Charlie'])

  // Charlie above Alpha (the root doc stays pinned first — it isn't a tab).
  await dragDrop(page, items.filter({ hasText: 'Charlie' }), items.filter({ hasText: 'Alpha' }), 'top')
  await expect(items).toHaveText(['Monday', 'Charlie', 'Alpha', 'Bravo'])

  // The new order persisted onto the sibling notes, 10-spaced.
  await expect
    .poll(async () => (await mockNote(page, `${WS}/charlie`))?.metadata?.tab_order)
    .toBe(10)
  expect((await mockNote(page, `${WS}/alpha`)).metadata.tab_order).toBe(20)
  expect((await mockNote(page, `${WS}/bravo`)).metadata.tab_order).toBe(30)

  // …and it survives a full reload (re-derived from the vault, not local state).
  await page.reload()
  await expect(page.getByTestId('worktabs').locator('.worktabs-item')).toHaveText([
    'Monday', 'Charlie', 'Alpha', 'Bravo',
  ])
})

test('cancelled tab drag — indicator clears, order stays, nothing is written', async ({ page }) => {
  await seedTabWorld(page)
  const items = page.getByTestId('worktabs').locator('.worktabs-item')
  await expect(items).toHaveText(['Monday', 'Alpha', 'Bravo', 'Charlie'])

  await dragCancel(page, items.filter({ hasText: 'Charlie' }), items.filter({ hasText: 'Alpha' }))

  // The gold insertion line is swept away and the rail order is untouched.
  await expect(page.getByTestId('drop-line')).toHaveCount(0)
  await expect(items).toHaveText(['Monday', 'Alpha', 'Bravo', 'Charlie'])

  // A cancelled drag writes NOTHING — no tab_order appears on any sibling.
  await page.waitForTimeout(250)
  for (const p of [`${WS}/alpha`, `${WS}/bravo`, `${WS}/charlie`]) {
    expect((await mockNote(page, p)).metadata.tab_order).toBeUndefined()
  }
})

test('new tab appends at the end of an ordered rail with tab_order = max + 10', async ({ page }) => {
  await seed(page, WS, '# Monday\n\nMain thread.', ['desk'], {})
  await seed(page, `${WS}/bravo`, '# Bravo\n', ['desk'], { tab_order: 20 })
  await seed(page, `${WS}/alpha`, '# Alpha\n', ['desk'], { tab_order: 10 })
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent(WS))

  // Seeded tab_order wins over creation order (Bravo was created first).
  const rail = page.getByTestId('worktabs')
  await expect(rail.locator('.worktabs-item')).toHaveText(['Monday', 'Alpha', 'Bravo'])

  await page.getByTestId('worktabs-add').click()
  await page.locator('.worktabs-input').fill('Zeta')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/desk%2F2026-07-13%2Fzeta/)

  // Appended last in the rail AND in the vault: max(10, 20) + 10.
  await expect(page.getByTestId('worktabs').locator('.worktabs-item')).toHaveText([
    'Monday', 'Alpha', 'Bravo', 'Zeta',
  ])
  await expect
    .poll(async () => (await mockNote(page, `${WS}/zeta`))?.metadata?.tab_order)
    .toBe(30)
})
