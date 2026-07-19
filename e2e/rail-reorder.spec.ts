// THE RAIL ORDER — the Shell nav tabs drag-to-reorder (the house DnD:
// hand-dispatched HTML5 events with one shared DataTransfer, same as the
// worktabs/shelves suites). The order is pure UI state in localStorage
// ('adamvaultos.rail.order') — dropping is the only gesture that writes,
// and a cancelled drag leaves no trace.

import { test, expect, type Page, type Locator } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
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

// ——— the shelves/worktabs dispatch trick: Playwright's mouse drag can't
// carry a DataTransfer through the dragover guards, so the real event
// sequence is hand-dispatched with ONE shared DataTransfer. ———

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
 * drop target. No drop event ever fires. */
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

const railLinks = (page: Page) => page.locator('.rail-nav .rail-link')
const railLink = (page: Page, label: string) =>
  page.locator('.rail-nav .rail-link', { hasText: label })

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('drag Tracker above Projects — the new order sticks and survives a reload', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/tasks')
  await expect(railLinks(page).first()).toHaveText(/Projects/)

  await dragDrop(page, railLink(page, 'Tracker'), railLink(page, 'Projects'), 'top')
  await expect(railLinks(page).first()).toHaveText(/Tracker/)
  await expect(railLinks(page).nth(1)).toHaveText(/Projects/)
  // The indicator is gone the moment the drop lands.
  await expect(page.getByTestId('rail-drop-line')).toHaveCount(0)

  // localStorage holds the order — a reload keeps it.
  await page.reload()
  await expect(railLinks(page).first()).toHaveText(/Tracker/)
  await expect(railLinks(page).nth(1)).toHaveText(/Projects/)

  // The tabs still navigate after the reorder.
  await railLink(page, 'Tracker').click()
  await expect(page.locator('.db-title')).toHaveText('Tracker')
})

test('cancelled drag — indicator clears, order stays, nothing is written', async ({ page }) => {
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/tasks')
  await expect(railLinks(page).first()).toHaveText(/Projects/)

  await dragCancel(page, railLink(page, 'Tracker'), railLink(page, 'Projects'))
  await expect(page.getByTestId('rail-drop-line')).toHaveCount(0)
  await expect(railLinks(page).first()).toHaveText(/Projects/)

  // Nothing was stashed — the default order also survives a reload.
  await page.reload()
  await expect(railLinks(page).first()).toHaveText(/Projects/)
  await expect(railLink(page, 'Tracker')).toBeVisible()
})

test('a garbled stash never breaks the rail — every tab renders in default order', async ({ page }) => {
  await connectViaStorage(page)
  await page.addInitScript(() => {
    localStorage.setItem('adamvaultos.rail.order', '{not json[')
  })
  await page.goto('http://127.0.0.1:4173/#/tasks')
  await expect(railLinks(page)).toHaveCount(10)
  await expect(railLinks(page).first()).toHaveText(/Projects/)

  // A partial stash: saved keys lead, missing tabs slot back at their
  // default position (Projects is default-first, so it re-leads).
  await page.evaluate(() => {
    localStorage.setItem('adamvaultos.rail.order', JSON.stringify(['graph', 'bogus-key']))
  })
  await page.reload()
  await expect(railLinks(page)).toHaveCount(10)
  await expect(railLinks(page).first()).toHaveText(/Projects/)
  await expect(railLink(page, 'Graph')).toBeVisible()
})
