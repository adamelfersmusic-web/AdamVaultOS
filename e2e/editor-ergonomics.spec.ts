// Editor ergonomics: (1) Tab never walks focus out of the Pages editor — it
// indents/outdents list items, and is swallowed in plain blocks (no literal
// tab characters: doc bytes must not change). (2) Block-type conversions
// (H2 / paragraph) target exactly the intended block — a caret or a
// boundary-grazing selection must never convert the neighbor above/below.
// Every assertion checks the EXACT markdown the vault received — the
// round-trip is the law.

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
/** Click into `text`, give ProseMirror a beat to sync the caret (same settle
 * the other editor specs use), then run the key steps. */
async function caretIn(page: Page, text: string, ...keys: string[]) {
  await page.locator('.page-prose').getByText(text).click()
  await page.waitForTimeout(300)
  for (const k of keys) await page.keyboard.press(k)
  await page.waitForTimeout(200)
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Tab in a bullet list indents; Shift-Tab outdents — nesting lands in the markdown', async ({ page }) => {
  const original = '- one\n- two\n\ntail line'
  await seed(page, 'pages/tab', original)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/tab')
  await caretIn(page, 'two', 'End')
  await page.keyboard.press('Tab')
  await expect.poll(() => savedContent(page, 'pages/tab')).toBe('- one\n  - two\n\ntail line')

  await page.keyboard.press('Shift+Tab')
  await expect.poll(() => savedContent(page, 'pages/tab')).toBe(original)

  expect(errors, errors.join('\n')).toEqual([])
})

test('Tab in a task list nests the item (taskItem, not just listItem)', async ({ page }) => {
  await seed(page, 'pages/tab', '- [ ] one\n- [ ] two\n\ntail line')
  await connectViaStorage(page)

  await openPage(page, 'pages/tab')
  await caretIn(page, 'two', 'End')
  await page.keyboard.press('Tab')
  await expect
    .poll(() => savedContent(page, 'pages/tab'))
    .toBe('- [ ] one\n  - [ ] two\n\ntail line')
})

test('Tab in a plain paragraph stays home — editor keeps focus, bytes untouched', async ({ page }) => {
  const original = 'alpha block\n\nbeta block'
  await seed(page, 'pages/tab', original)
  await connectViaStorage(page)

  await openPage(page, 'pages/tab')
  await caretIn(page, 'alpha block', 'End')
  await page.keyboard.press('Tab')

  // Focus never left the editor (it used to land on the Ask AI fab)…
  const active = await page.evaluate(() => document.activeElement?.className ?? '')
  expect(active).toContain('page-prose')
  // …and nothing was typed: after a full save-debounce window the vault
  // still holds the exact original bytes.
  await page.waitForTimeout(1400)
  expect(await savedContent(page, 'pages/tab')).toBe(original)
})

test('heading bleed regression — conversions never touch the neighboring block', async ({ page }) => {
  await seed(page, 'pages/bleed', 'alpha block\n\nbeta block')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/bleed')

  // 1 — caret at the very END of block 1 → H2: block 2 untouched.
  await caretIn(page, 'alpha block', 'End')
  await page.keyboard.press('ControlOrMeta+Alt+2')
  await expect
    .poll(() => savedContent(page, 'pages/bleed'))
    .toBe('## alpha block\n\nbeta block')

  // 2 — caret at the very START of block 2 → H2: block 1 stays H2.
  await caretIn(page, 'beta block', 'Home')
  await page.keyboard.press('ControlOrMeta+Alt+2')
  await expect
    .poll(() => savedContent(page, 'pages/bleed'))
    .toBe('## alpha block\n\n## beta block\n\n')

  // 3 — select block 2 only, but with the selection START touching the very
  // end of block 1 (the classic drag/Shift-selection artifact) → paragraph:
  // block 1 must STAY H2.
  await caretIn(page, 'alpha block', 'End', 'Shift+ArrowDown', 'Shift+End')
  await page.keyboard.press('ControlOrMeta+Alt+0')
  await expect
    .poll(() => savedContent(page, 'pages/bleed'))
    .toBe('## alpha block\n\nbeta block\n\n')

  expect(errors, errors.join('\n')).toEqual([])
})

test('heading bleed regression — selection ending at offset 0 of block 2 converts only block 1', async ({ page }) => {
  await seed(page, 'pages/bleed', 'alpha block\n\nbeta block')
  await connectViaStorage(page)

  await openPage(page, 'pages/bleed')
  // Home + Shift+Down: anchor at start of block 1, head at offset 0 of
  // block 2 — all of block 1 covered, none of block 2.
  await caretIn(page, 'alpha block', 'Home', 'Shift+ArrowDown')
  await page.keyboard.press('ControlOrMeta+Alt+2')
  await expect
    .poll(() => savedContent(page, 'pages/bleed'))
    .toBe('## alpha block\n\nbeta block')
})
