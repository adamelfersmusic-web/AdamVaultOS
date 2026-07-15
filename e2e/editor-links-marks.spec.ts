// Editor links + composable marks. Two round-trip-law fixes under test:
//   BUG 1 — [[path|display]] wikilink aliases (target navigates, alias shows),
//           byte-identical on save for BOTH the aliased and the plain form.
//   BUG 2 — colored text composes with bold: <span style="color">**x**</span>
//           renders bold AND colored, in the editor AND across a save.
// Every assertion that matters ends at the vault bytes — the sacred law.

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
/** Select `word` inside the paragraph containing `anchor` (DOM range → PM).
 * Walks ALL descendant text nodes so a word already wrapped in a mark span
 * (e.g. after a color was applied) is still selectable. */
async function selectWord(page: Page, anchor: string, word: string) {
  await page.evaluate(
    ([a, w]) => {
      const p = [...document.querySelectorAll('.page-prose p')].find((el) =>
        el.textContent?.includes(a),
      )
      if (!p) throw new Error('anchor paragraph not found')
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
      let n: Node | null
      while ((n = walker.nextNode())) {
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
      throw new Error('word not found')
    },
    [anchor, word] as const,
  )
  await page.waitForTimeout(300)
}

/** The app renders bold with a variable-font weight (>= 600), not exactly 700. */
async function expectBold(loc: import('@playwright/test').Locator) {
  const w = await loc.evaluate((el) => Number(getComputedStyle(el).fontWeight))
  expect(w).toBeGreaterThanOrEqual(600)
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

// ——— BUG 1: wikilink aliases ———

test('(a) alias chip shows the display text, navigates to the target, round-trips byte-identical', async ({ page }) => {
  const body = 'Go to [[a/b|Nice Name]] now.\n\ntail'
  await seed(page, 'pages/alias', body)
  await connectViaStorage(page)

  await openPage(page, 'pages/alias')
  // The chip renders the ALIAS, not the raw path.
  const chip = page.locator('.page-prose .wikilink')
  await expect(chip).toHaveText('Nice Name')

  // Clicking navigates to the TARGET path (a/b) in the Pages editor.
  await chip.click()
  await expect(page).toHaveURL(/#\/pages\/a(%2F|\/)b$/)

  // Reopen + trivial edit → the exact aliased source survives byte-for-byte.
  await openPage(page, 'pages/alias')
  await page.locator('.page-prose').getByText('tail').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' ping')
  await expect.poll(() => savedContent(page, 'pages/alias')).toContain('tail ping')
  const md = await savedContent(page, 'pages/alias')
  expect(md).toContain('[[a/b|Nice Name]]')
})

test('(b) plain wikilink still shows the path and is byte-identical on save (no regression)', async ({ page }) => {
  const body = 'Go to [[a/b]] now.\n\ntail'
  await seed(page, 'pages/plain', body)
  await connectViaStorage(page)

  await openPage(page, 'pages/plain')
  const chip = page.locator('.page-prose .wikilink')
  await expect(chip).toHaveText('a/b')

  await page.locator('.page-prose').getByText('tail').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' ping')
  await expect.poll(() => savedContent(page, 'pages/plain')).toContain('tail ping')
  const md = await savedContent(page, 'pages/plain')
  expect(md).toContain('[[a/b]]')
  expect(md).not.toContain('[[a/b|') // never grew a spurious alias
})

test('(c) read view renders an alias as a link showing the display text, going to the target', async ({ page }) => {
  await seed(page, 'pages/aliasread', 'Go to [[a/b|Nice Name]] now.')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('pages/aliasread'))
  const link = page.locator('a.wikilink', { hasText: 'Nice Name' })
  await expect(link).toBeVisible()
  await expect(link).toHaveText('Nice Name')
  await expect(link).toHaveAttribute('href', /#\/note\/a(%2F|\/)b$/)
})

// ——— BUG 2: colored text composes with bold ———

test('(d) stored <span color>**bold**</span> renders bold AND colored, saves byte-identical', async ({ page }) => {
  const body = '# Mixed\n\n<span style="color: #35b8ad">**bold teal**</span> tail'
  await seed(page, 'pages/cb', body)
  await connectViaStorage(page)

  // Read view: the colored span wraps a <strong> — BOTH marks survive.
  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('pages/cb'))
  const readEl = page.locator('span[style*="color"] strong', { hasText: 'bold teal' })
  await expect(readEl).toBeVisible()
  await expectBold(readEl)

  // Editor: same composition — a colored span containing a bold node.
  await openPage(page, 'pages/cb')
  const edEl = page.locator('.page-prose span[style*="color"] strong', { hasText: 'bold teal' })
  await expect(edEl).toBeVisible()
  await expectBold(edEl)
  // (browsers reserialize the inline style attribute to rgb(); the exact hex
  // is asserted on the saved markdown below, which is the byte-stable law.)
  await expect(page.locator('.page-prose span[style*="color"]')).toHaveCount(1)

  // Round-trip: a trivial tail edit keeps the composed span byte-identical.
  await page.locator('.page-prose').getByText('tail').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' ping')
  await expect.poll(() => savedContent(page, 'pages/cb')).toContain('tail ping')
  const md = await savedContent(page, 'pages/cb')
  expect(md).toContain('<span style="color: #35b8ad">**bold teal**</span>')
})

test('(e) apply a color swatch then bold — text ends up colored AND bold, round-trips byte-stable', async ({ page }) => {
  await seed(page, 'pages/cbi', '# Rich\n\nalpha beta gamma')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/cbi')
  await selectWord(page, 'alpha', 'beta')
  await expect(page.getByTestId('format-bar')).toBeVisible()
  await page.locator('.fmt-font-color').first().click() // Teal #2fa39b
  await expect(page.locator('.page-prose span[style*="color"]')).toHaveText('beta')

  // The format-bar swatch preserves the selection (onMouseDown preventDefault),
  // so bold applies to the still-selected, now-colored word.
  await page.keyboard.press('ControlOrMeta+b')

  // Both marks now live on the word: a colored span wrapping a <strong>.
  const el = page.locator('.page-prose span[style*="color"] strong', { hasText: 'beta' })
  await expect(el).toBeVisible()
  await expectBold(el)

  // The vault gets the canonical composed spelling — span OUTSIDE, ** INSIDE.
  await expect
    .poll(() => savedContent(page, 'pages/cbi'))
    .toContain('<span style="color: #2fa39b">**beta**</span>')

  // Reload → both marks return; an unrelated edit stays byte-stable.
  await page.reload()
  await expect(
    page.locator('.page-prose span[style*="color"] strong', { hasText: 'beta' }),
  ).toBeVisible()
  const before = await savedContent(page, 'pages/cbi')
  await page.locator('.page-prose').getByText('gamma').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' ping')
  await expect
    .poll(() => savedContent(page, 'pages/cbi'))
    .toBe(before.replace('gamma', 'gamma ping'))

  expect(errors, errors.join('\n')).toEqual([])
})
