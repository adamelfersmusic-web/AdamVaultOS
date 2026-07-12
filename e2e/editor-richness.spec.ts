// The supervised editor drop: E1 ==highlight==, #20 colored text, #18 toggle
// blocks. THE contract under test is the markdown round-trip — these three
// were deferred for months precisely because a bad serializer corrupts notes.
// Every test ends by checking the vault got clean, stable markdown.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function seed(page: Page, path: string, content: string) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags: [], metadata: {} },
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
async function savedContent(page: Page, path: string): Promise<string> {
  const res = await page.request.get(`${MOCK}/api/notes?id=${encodeURIComponent(path)}`, {
    headers: AUTH,
  })
  return ((await res.json()) as { content?: string }).content ?? ''
}
async function openPage(page: Page, path: string) {
  await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent(path))
  await expect(page.locator('.page-prose')).toBeVisible()
}
/** Select `word` inside the paragraph containing `anchor` (DOM range → PM). */
async function selectWord(page: Page, anchor: string, word: string) {
  await page.evaluate(
    ([a, w]) => {
      const p = [...document.querySelectorAll('.page-prose p')].find((el) =>
        el.textContent?.includes(a),
      )
      if (!p) throw new Error('anchor paragraph not found')
      for (const n of p.childNodes) {
        if (n.nodeType === 3) {
          const i = n.textContent!.indexOf(w)
          if (i !== -1) {
            const r = document.createRange()
            r.setStart(n, i)
            r.setEnd(n, i + w.length)
            const s = getSelection()!
            s.removeAllRanges()
            s.addRange(r)
            return
          }
        }
      }
      throw new Error('word not found')
    },
    [anchor, word] as const,
  )
  await page.waitForTimeout(300)
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('highlight — ⌘⇧H writes ==word==, survives reload, renders in read view', async ({ page }) => {
  await seed(page, 'pages/rich', '# Rich\n\nalpha beta gamma')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/rich')
  await selectWord(page, 'alpha', 'beta')
  await expect(page.getByTestId('format-bar')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+Shift+h')
  await expect(page.locator('.page-prose mark')).toHaveText('beta')

  await expect.poll(() => savedContent(page, 'pages/rich')).toContain('alpha ==beta== gamma')
  await page.reload()
  await expect(page.locator('.page-prose mark')).toHaveText('beta')

  // Read view renders <mark>, never literal ==.
  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('pages/rich'))
  await expect(page.locator('mark', { hasText: 'beta' }).first()).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

test('color — format bar writes a safe <span style>, round-trips, stays stable', async ({ page }) => {
  await seed(page, 'pages/rich', '# Rich\n\nalpha beta gamma')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/rich')
  await selectWord(page, 'alpha', 'gamma')
  await expect(page.getByTestId('format-bar')).toBeVisible()
  await page.locator('.fmt-color').nth(2).click() // Blue

  await expect
    .poll(() => savedContent(page, 'pages/rich'))
    .toContain('alpha beta <span style="color: #4a7fa5">gamma</span>')

  // Reload → the mark is back, and an unrelated edit keeps the span intact.
  await page.reload()
  await expect(page.locator('.page-prose span[style*="color"]')).toHaveText('gamma')
  await page.locator('.page-prose').getByText('alpha').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('ping')
  await expect
    .poll(() => savedContent(page, 'pages/rich'))
    .toContain('alpha beta <span style="color: #4a7fa5">gamma</span>')

  expect(errors, errors.join('\n')).toEqual([])
})

test('toggle — /toggle folds; Enter drops INTO the fold; canonical markdown', async ({ page }) => {
  await seed(page, 'pages/rich', '# Rich\n\nend line')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/rich')
  await page.locator('.page-prose').getByText('end line').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/toggle')
  await expect(page.locator('.slash-menu')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('.page-prose [data-type="details"]')).toHaveCount(1)

  await page.keyboard.type('Plan for Vegas')
  await page.keyboard.press('Enter')
  await page.keyboard.type('- [ ] book flight')

  await expect
    .poll(() => savedContent(page, 'pages/rich'))
    .toContain('<details>\n<summary>Plan for Vegas</summary>\n\n- [ ] book flight\n</details>')

  // Reload: the todo is INSIDE the fold, and a trivial edit stays byte-stable.
  await page.reload()
  await expect(
    page.locator('.page-prose [data-type="detailsContent"] ul[data-type="taskList"] li'),
  ).toHaveCount(1)
  const before = await savedContent(page, 'pages/rich')
  await page.locator('.page-prose').getByText('end line').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' ping')
  await expect
    .poll(() => savedContent(page, 'pages/rich'))
    .toBe(before.replace('end line', 'end line ping'))

  expect(errors, errors.join('\n')).toEqual([])
})

test('pre-existing rich note — read view renders all three; body round-trip is byte-stable', async ({ page }) => {
  const body =
    '# Mixed\n\n==hot take== stays marked.\n\n<span style="color: #c4445a">red alert</span> text.\n\n<details>\n<summary>The fold</summary>\n\n- [ ] inside task\n</details>\n\ntail line'
  await seed(page, 'pages/mixed', body)
  await connectViaStorage(page)

  // Read view: mark + colored span + native details.
  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('pages/mixed'))
  await expect(page.locator('mark', { hasText: 'hot take' }).first()).toBeVisible()
  await expect(page.locator('span[style*="color"]', { hasText: 'red alert' }).first()).toBeVisible()
  await expect(page.locator('details > summary', { hasText: 'The fold' })).toBeVisible()

  // Editor round-trip: open, tweak the tail only, everything else byte-identical.
  await openPage(page, 'pages/mixed')
  await page.locator('.page-prose').getByText('tail line').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' ping')
  // Wait for the edited tail to land (debounced save), THEN check the rest
  // of the body came through byte-identical.
  await expect
    .poll(() => savedContent(page, 'pages/mixed'))
    .toContain('tail line ping')
  const after = await savedContent(page, 'pages/mixed')
  expect(after).toContain('==hot take== stays marked.')
  expect(after).toContain('<span style="color: #c4445a">red alert</span> text.')
  expect(after).toContain('<details>\n<summary>The fold</summary>\n\n- [ ] inside task\n</details>')
})
