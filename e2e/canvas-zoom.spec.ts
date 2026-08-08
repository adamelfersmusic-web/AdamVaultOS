// Canvas sitting 1 — zoom + pan.
//
// THE contract under test is the coordinate refactor: every screen→plane
// conversion must divide by the zoom. Miss one and a card lands somewhere you
// didn't drop it — which is silent, so it gets its own tests rather than a
// "zoom changes the scale" smoke check.
//
// Zoom is viewport state. Nothing here may change what a card stores beyond
// the x/y it already stored.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
  // Wait for the vault to be genuinely empty. Canvas writes are optimistic, so
  // a previous test's creates can still be in flight when it ends and land just
  // AFTER this reset — repopulating the board and failing whichever test runs
  // next, for no reason of its own.
  await expect
    .poll(async () => {
      const res = await page.request.get(
        `${MOCK}/api/notes?path_prefix=${encodeURIComponent('canvas/')}`,
        { headers: AUTH },
      )
      return ((await res.json()) as unknown[]).length
    })
    .toBe(0)
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

/** Every card note's stored geometry, by path. */
async function cardGeom(page: Page): Promise<Record<string, { x: number; y: number; w: number; h: number }>> {
  const res = await page.request.get(
    `${MOCK}/api/notes?path_prefix=${encodeURIComponent('canvas/')}`,
    { headers: AUTH },
  )
  const rows = (await res.json()) as Array<{ path: string; metadata?: Record<string, unknown> }>
  const out: Record<string, { x: number; y: number; w: number; h: number }> = {}
  for (const r of rows) {
    if (r.metadata?.['ckind'] !== 'card') continue
    out[r.path] = {
      x: Number(r.metadata?.['x']),
      y: Number(r.metadata?.['y']),
      w: Number(r.metadata?.['w']),
      h: Number(r.metadata?.['h']),
    }
  }
  return out
}

async function newBoardWithCard(page: Page, at = { x: 400, y: 300 }) {
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await expect(page.locator('.db-title')).toHaveText('Canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await expect(page.locator('.canvas-title-input')).toBeVisible()
  await page.getByTestId('canvas-plane').dblclick({ position: at })
  await expect(page.locator('.canvas-card')).toHaveCount(1)
  // Leave the freshly-opened editor so later keystrokes aren't typing.
  await page.locator('.canvas-title-input').click()
}

/** Drag a card by its header, by a screen-pixel delta. */
async function dragCardBy(page: Page, dx: number, dy: number) {
  const head = page.locator('.canvas-card-head').first()
  const box = await head.boundingBox()
  if (!box) throw new Error('no card header')
  const sx = box.x + box.width / 2
  const sy = box.y + box.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + dx, sy + dy, { steps: 8 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('the zoom control scales the plane and the level survives a reload', async ({ page }) => {
  await connectViaStorage(page)
  await newBoardWithCard(page)

  const plane = page.getByTestId('canvas-plane')
  await expect(page.getByTestId('zoom-reset')).toHaveText('100%')
  await expect(plane).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')

  await page.getByTestId('zoom-out').click()
  await expect(page.getByTestId('zoom-reset')).toHaveText('80%')
  // matrix(0.8, 0, 0, 0.8, 0, 0)
  await expect(plane).toHaveCSS('transform', /matrix\(0\.8,/)

  await page.reload()
  await expect(page.getByTestId('zoom-reset')).toHaveText('80%')

  // The level doubles as reset.
  await page.getByTestId('zoom-reset').click()
  await expect(page.getByTestId('zoom-reset')).toHaveText('100%')
  await expect(page.getByTestId('canvas-plane')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)',
  )
})

test('a card dragged while zoomed OUT lands where you dropped it', async ({ page }) => {
  await connectViaStorage(page)
  await newBoardWithCard(page)

  const before = Object.values(await cardGeom(page))[0]
  expect(before, 'card persisted its geometry').toBeTruthy()

  // 100% → 80% → 64%.
  await page.getByTestId('zoom-out').click()
  await page.getByTestId('zoom-out').click()
  await expect(page.getByTestId('zoom-reset')).toHaveText('64%')

  // Move 128 SCREEN px right and 64 down. At 0.64 scale that is 200 × 100
  // plane units — which is what must be stored, snapped to the 20px grid.
  await dragCardBy(page, 128, 64)

  await expect
    .poll(async () => Object.values(await cardGeom(page))[0]?.x)
    .not.toBe(before.x)
  const after = Object.values(await cardGeom(page))[0]
  expect(after.x).toBe(before.x + 200)
  expect(after.y).toBe(before.y + 100)
  // Grid snap survives the divide.
  expect(after.x % 20).toBe(0)
  expect(after.y % 20).toBe(0)
})

test('a card dragged while zoomed IN lands where you dropped it', async ({ page }) => {
  await connectViaStorage(page)
  await newBoardWithCard(page)
  const before = Object.values(await cardGeom(page))[0]

  await page.getByTestId('zoom-in').click() // 125%
  await expect(page.getByTestId('zoom-reset')).toHaveText('125%')

  // 250 screen px at 1.25 scale = 200 plane units.
  await dragCardBy(page, 250, 125)

  await expect
    .poll(async () => Object.values(await cardGeom(page))[0]?.x)
    .not.toBe(before.x)
  const after = Object.values(await cardGeom(page))[0]
  expect(after.x).toBe(before.x + 200)
  expect(after.y).toBe(before.y + 100)
})

test('double-click while zoomed drops the card under the cursor', async ({ page }) => {
  await connectViaStorage(page)
  await newBoardWithCard(page, { x: 200, y: 200 })

  await page.getByTestId('zoom-out').click()
  await page.getByTestId('zoom-out').click() // 64%

  // A second card at 320×192 SCREEN px inside the plane → 500×300 plane units.
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 320, y: 192 } })
  await expect(page.locator('.canvas-card')).toHaveCount(2)
  await page.locator('.canvas-title-input').click()

  await expect.poll(async () => Object.keys(await cardGeom(page)).length).toBe(2)
  const geoms = Object.values(await cardGeom(page))
  const second = geoms.find((g) => g.x !== 200 || g.y !== 200)
  expect(second, 'the new card is not on top of the first').toBeTruthy()
  expect(second!.x).toBe(500)
  expect(second!.y).toBe(300)
})

test('space-drag pans the board without moving any card', async ({ page }) => {
  await connectViaStorage(page)
  await newBoardWithCard(page)
  const before = await cardGeom(page)

  const scroll = page.locator('.canvas-scroll')
  await expect.poll(async () => scroll.evaluate((el) => el.scrollLeft)).toBe(0)

  // Leave the title field: space inside an input types a space, by design.
  await page.getByTestId('canvas-plane').click({ position: { x: 1000, y: 500 } })
  await page.keyboard.down('Space')
  await expect(scroll).toHaveClass(/is-pannable/)
  const box = await scroll.boundingBox()
  if (!box) throw new Error('no scroller')
  // Start in open canvas — the corner sits on the scrollbar, which swallows
  // pointerdown, and the middle sits on the card.
  const sx = box.x + box.width - 220
  const sy = box.y + 140
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx - 260, sy - 100, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Space')

  // The viewport moved…
  expect(await scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(200)
  // …and nothing was written.
  await page.waitForTimeout(700)
  expect(await cardGeom(page)).toEqual(before)
})

test('the plane grows to fit a card placed beyond its floor', async ({ page }) => {
  await connectViaStorage(page)
  await newBoardWithCard(page)

  const plane = page.getByTestId('canvas-plane')
  const startW = await plane.evaluate((el) => (el as HTMLElement).offsetWidth)
  expect(startW).toBe(3000) // the floor

  // Zoom out so a far-right plane coordinate is reachable on screen, then drop
  // a card past the floor: 1250 screen px at 0.51 ≈ 2450 plane units, so the
  // card's right edge plus the margin exceeds 3000.
  await page.getByTestId('zoom-out').click()
  await page.getByTestId('zoom-out').click()
  await page.getByTestId('zoom-out').click()
  await expect(page.getByTestId('zoom-reset')).toHaveText('51%')

  await plane.dblclick({ position: { x: 1250, y: 200 } })
  await expect(page.locator('.canvas-card')).toHaveCount(2)

  await expect
    .poll(async () => plane.evaluate((el) => (el as HTMLElement).offsetWidth))
    .toBeGreaterThan(startW)
})
