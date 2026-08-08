// Groups, driven through the real UI.
//
// THE contract: dragging a group moves everything inside it, and it is all or
// nothing. A half-applied move leaves the group torn — some cards moved, some
// not, and no way to tell which — so a failure must put everything back.
//
// Membership itself is geometric and covered as unit tests in
// canvas-groups-unit.spec.ts.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

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

interface Row {
  path: string
  content?: string
  metadata?: Record<string, unknown>
}
async function rowsOf(page: Page, kind: 'card' | 'group'): Promise<Row[]> {
  const res = await page.request.get(
    `${MOCK}/api/notes?path_prefix=${encodeURIComponent('canvas/')}&include_content=true`,
    { headers: AUTH },
  )
  return ((await res.json()) as Row[]).filter((r) => r.metadata?.['ckind'] === kind)
}
const xy = (r: Row) => ({ x: Number(r.metadata?.['x']), y: Number(r.metadata?.['y']) })

/** A free-mode board with two cards: one that will sit in the group, one far away. */
async function boardWithCards(page: Page) {
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await expect(page.locator('.canvas-title-input')).toBeVisible()
  // Two cards, well apart.
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 300, y: 260 } })
  await page.locator('.canvas-title-input').click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 1000, y: 640 } })
  await page.locator('.canvas-title-input').click()
  await expect(page.locator('.canvas-card')).toHaveCount(2)
}

async function dragBy(page: Page, locator: ReturnType<Page['locator']>, dx: number, dy: number) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('no box')
  const sx = box.x + box.width / 2
  const sy = box.y + box.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + dx, sy + dy, { steps: 10 })
  await page.mouse.up()
}

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

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('a group is a note, titled and coloured in place', async ({ page }) => {
  await connectViaStorage(page)
  await boardWithCards(page)

  await page.getByTestId('canvas-add-group').click()
  await expect(page.getByTestId('canvas-group')).toHaveCount(1)
  await expect.poll(async () => (await rowsOf(page, 'group')).length).toBe(1)

  // Title it — double-click the header, the same gesture a card uses.
  await page.locator('.group-head').dblclick()
  await page.getByTestId('group-title-input').fill('Cassy / Amanda')
  await page.keyboard.press('Enter')
  await expect
    .poll(async () => (await rowsOf(page, 'group'))[0]?.metadata?.['title'])
    .toBe('Cassy / Amanda')

  // Recolour it.
  await page.locator('.group-tone').click()
  await page.getByTestId('group-tone-green').click()
  await expect
    .poll(async () => (await rowsOf(page, 'group'))[0]?.metadata?.['tone'])
    .toBe('green')
  await expect(page.getByTestId('canvas-group')).toHaveClass(/tone-green/)
})

test('dragging a group carries the cards inside it, and leaves the others', async ({ page }) => {
  await connectViaStorage(page)
  await boardWithCards(page)
  await page.getByTestId('canvas-add-group').click()
  await expect(page.getByTestId('canvas-group')).toHaveCount(1)

  // Put the group over the first card.
  const group = page.getByTestId('canvas-group')
  const inside = page.locator('.canvas-card').first()
  const gb = await group.boundingBox()
  const cb = await inside.boundingBox()
  await page.mouse.move(gb!.x + gb!.width / 2, gb!.y + 8) // the header
  await page.mouse.down()
  await page.mouse.move(cb!.x + cb!.width / 2, cb!.y + cb!.height / 2 + 40, { steps: 10 })
  await page.mouse.up()
  await expect(page.getByTestId('group-count')).toHaveText('1')

  await expect.poll(async () => (await rowsOf(page, 'card')).length).toBe(2)
  const before = await rowsOf(page, 'card')
  const inPath = before.find((r) => xy(r).x < 700)!.path
  const outPath = before.find((r) => r.path !== inPath)!.path
  const beforeIn = xy(before.find((r) => r.path === inPath)!)
  const beforeOut = xy(before.find((r) => r.path === outPath)!)

  // Drag the group by its header.
  await dragBy(page, page.locator('.group-head'), 120, 80)

  await expect
    .poll(async () => xy((await rowsOf(page, 'card')).find((r) => r.path === inPath)!).x)
    .toBe(beforeIn.x + 120)
  const after = await rowsOf(page, 'card')
  expect(xy(after.find((r) => r.path === inPath)!)).toEqual({
    x: beforeIn.x + 120,
    y: beforeIn.y + 80,
  })
  // The far card never moved.
  expect(xy(after.find((r) => r.path === outPath)!)).toEqual(beforeOut)
})

test('if part of a group move fails, nothing moves — the group is never torn', async ({ page }) => {
  await connectViaStorage(page)
  await boardWithCards(page)
  await page.getByTestId('canvas-add-group').click()
  const group = page.getByTestId('canvas-group')
  const inside = page.locator('.canvas-card').first()
  const gb = await group.boundingBox()
  const cb = await inside.boundingBox()
  await page.mouse.move(gb!.x + gb!.width / 2, gb!.y + 8)
  await page.mouse.down()
  await page.mouse.move(cb!.x + cb!.width / 2, cb!.y + cb!.height / 2 + 40, { steps: 10 })
  await page.mouse.up()
  await expect(page.getByTestId('group-count')).toHaveText('1')

  await expect.poll(async () => (await rowsOf(page, 'card')).length).toBe(2)
  const before = await rowsOf(page, 'card')
  const groupBefore = xy((await rowsOf(page, 'group'))[0])
  const carried = before.find((r) => xy(r).x < 700)!

  // Make the carried card's write fail: bump it server-side so the version the
  // UI holds is stale and its conditional update is rejected. `force` is needed
  // or the mock rejects THIS write for want of a precondition, and the setup
  // fails silently — leaving a test that proves nothing.
  const bump = await page.request.patch(
    `${MOCK}/api/notes/${encodeURIComponent(carried.path)}`,
    { headers: AUTH, data: { content: 'changed elsewhere', force: true } },
  )
  expect(bump.status(), await bump.text()).toBe(200)

  await dragBy(page, page.locator('.group-head'), 140, 100)
  await page.waitForTimeout(1200)

  // Nothing moved — not the cards, and not the group either. A partly-applied
  // move would leave the group torn, which is the failure this guards against.
  const after = await rowsOf(page, 'card')
  for (const b of before) {
    expect(xy(after.find((r) => r.path === b.path)!), `${b.path} must not move`).toEqual(xy(b))
  }
  expect(xy((await rowsOf(page, 'group'))[0])).toEqual(groupBefore)
})

test('removing a group leaves its cards exactly where they are', async ({ page }) => {
  await connectViaStorage(page)
  await boardWithCards(page)
  await page.getByTestId('canvas-add-group').click()
  await expect(page.getByTestId('canvas-group')).toHaveCount(1)

  await expect.poll(async () => (await rowsOf(page, 'card')).length).toBe(2)
  const before = (await rowsOf(page, 'card')).map((r) => ({ path: r.path, ...xy(r) }))

  await page.getByTestId('group-delete').click()
  await expect(page.getByTestId('canvas-group')).toHaveCount(0)
  await expect.poll(async () => (await rowsOf(page, 'group')).length).toBe(0)

  // The cards are all still there, untouched.
  const after = (await rowsOf(page, 'card')).map((r) => ({ path: r.path, ...xy(r) }))
  expect(after.sort((a, b) => a.path.localeCompare(b.path))).toEqual(
    before.sort((a, b) => a.path.localeCompare(b.path)),
  )
})

test('groups belong to free mode — map mode does not offer them', async ({ page }) => {
  await connectViaStorage(page)
  await boardWithCards(page)
  await expect(page.getByTestId('canvas-add-group')).toBeVisible()

  // In map mode positions are computed, so a rectangle cannot hold anything.
  await page.getByTestId('mode-map').click()
  await expect(page.getByTestId('canvas-add-group')).toHaveCount(0)
  await expect(page.getByTestId('canvas-group')).toHaveCount(0)

  await page.getByTestId('mode-free').click()
  await expect(page.getByTestId('canvas-add-group')).toBeVisible()
})

test('a group survives a reload with its title, colour and size', async ({ page }) => {
  await connectViaStorage(page)
  await boardWithCards(page)
  await page.getByTestId('canvas-add-group').click()
  await page.locator('.group-head').dblclick()
  await page.getByTestId('group-title-input').fill('Escensus / Signalcraft')
  await page.keyboard.press('Enter')
  await page.locator('.group-tone').click()
  await page.getByTestId('group-tone-purple').click()
  await expect
    .poll(async () => (await rowsOf(page, 'group'))[0]?.metadata?.['tone'])
    .toBe('purple')

  await dragBy(page, page.getByTestId('group-resize'), 120, 90)
  await expect.poll(async () => Number((await rowsOf(page, 'group'))[0]?.metadata?.['w'])).toBe(520)

  await page.reload()
  await expect(page.getByTestId('canvas-group')).toHaveCount(1)
  await expect(page.getByTestId('canvas-group')).toHaveClass(/tone-purple/)
  await expect(page.getByTestId('group-title')).toHaveText('Escensus / Signalcraft')
})
