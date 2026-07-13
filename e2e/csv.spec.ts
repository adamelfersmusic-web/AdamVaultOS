// CSV/TSV ↔ table, three surfaces: paste-to-table (strict detection — false
// positives are worse than misses), /table-from-csv via the slash menu, and
// copy-as-CSV from the table bar. The contract under test, as ever, is the
// markdown round-trip: an inserted table must land in the vault as a clean
// GFM pipe table.

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
/** Put the caret on a fresh line after `anchor`, ready for a paste/insert. */
async function caretOnFreshLine(page: Page, anchor: string) {
  await page.locator('.page-prose').getByText(anchor).click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
}
/** Dispatch a synthetic text/plain paste into the editor. */
async function pasteText(page: Page, text: string) {
  await page.evaluate((t) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', t)
    const el = document.querySelector('.page-prose')
    if (!el) throw new Error('.page-prose not found')
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, text)
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('paste TSV — becomes a real table; vault gets a GFM pipe table', async ({ page }) => {
  await seed(page, 'pages/csv', '# CSV\n\nend line')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/csv')
  await caretOnFreshLine(page, 'end line')
  await pasteText(page, 'a\tb\tc\n1\t2\t3\nx\ty\tz')

  const table = page.locator('.page-prose table')
  await expect(table).toHaveCount(1)
  await expect(table.locator('th')).toHaveCount(3)
  await expect(table.locator('th').first()).toHaveText('a')
  await expect(table.locator('tr')).toHaveCount(3)
  await expect(table.locator('td').nth(3)).toHaveText('x')

  // The markdown-round-trip law: the vault stores clean pipe rows.
  await expect
    .poll(() => savedContent(page, 'pages/csv'))
    .toMatch(/\| a\s+\| b\s+\| c\s+\|/)
  const md = await savedContent(page, 'pages/csv')
  expect(md).toMatch(/\| 1\s+\| 2\s+\| 3\s+\|/)
  expect(md).toMatch(/\| x\s+\| y\s+\| z\s+\|/)

  expect(errors, errors.join('\n')).toEqual([])
})

test('paste prose with commas — stays plain text, NO table', async ({ page }) => {
  await seed(page, 'pages/csv', '# CSV\n\nend line')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/csv')
  await caretOnFreshLine(page, 'end line')
  await pasteText(page, 'Hello, world, this is one line')

  await expect(
    page.locator('.page-prose p', { hasText: 'Hello, world, this is one line' }),
  ).toHaveCount(1)
  await expect(page.locator('.page-prose table')).toHaveCount(0)

  await expect
    .poll(() => savedContent(page, 'pages/csv'))
    .toContain('Hello, world, this is one line')
  expect(await savedContent(page, 'pages/csv')).not.toContain('|')

  expect(errors, errors.join('\n')).toEqual([])
})

test('/table-from-csv — modal parses quoted fields; comma survives inside a cell', async ({ page }) => {
  await seed(page, 'pages/csv', '# CSV\n\nend line')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/csv')
  await caretOnFreshLine(page, 'end line')
  await page.keyboard.type('/csv')
  await expect(page.locator('.slash-menu')).toBeVisible()
  await expect(page.locator('.slash-item', { hasText: 'Table — from CSV' })).toBeVisible()
  await page.keyboard.press('Enter')

  const input = page.getByTestId('csv-input')
  await expect(input).toBeVisible()
  // Empty input → Create disabled (strict parser gate).
  await expect(page.getByTestId('csv-create')).toBeDisabled()
  await input.fill('name,note\nAmanda,"hello, world"')
  await expect(page.getByTestId('csv-create')).toBeEnabled()
  await page.getByTestId('csv-create').click()

  const table = page.locator('.page-prose table')
  await expect(table).toHaveCount(1)
  await expect(table.locator('th')).toHaveCount(2)
  await expect(table.locator('th').first()).toHaveText('name')
  await expect(table.locator('td', { hasText: 'hello, world' })).toHaveCount(1)

  await expect
    .poll(() => savedContent(page, 'pages/csv'))
    .toMatch(/\| Amanda\s+\| hello, world\s+\|/)

  expect(errors, errors.join('\n')).toEqual([])
})

test('copy as CSV — table bar CSV button quotes the comma field', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await seed(
    page,
    'pages/csv',
    '# CSV\n\n| name | note |\n| --- | --- |\n| Amanda | hello, world |\n\nend line',
  )
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/csv')
  await page.locator('.page-prose td', { hasText: 'Amanda' }).click()
  await expect(page.getByTestId('table-bar')).toBeVisible()
  await page.getByTestId('table-bar').getByText('CSV', { exact: true }).click()

  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('name,note\nAmanda,"hello, world"')

  expect(errors, errors.join('\n')).toEqual([])
})

test('table filter hides rows view-only; storage untouched; bar floats by the table', async ({
  page,
}) => {
  await reset(page)
  await seed(
    page,
    'pages/roster',
    '# Roster\n\n| name | role |\n| --- | --- |\n| Cassy | content ops |\n| Patricia | video editor |\n',
  )
  await connectViaStorage(page)
  await page.goto('/#/pages/' + encodeURIComponent('pages/roster'))
  await expect(page.locator('.page-prose table')).toBeVisible({ timeout: 10_000 })

  // Click into the table → the bar floats next to it (not the old sticky top strip).
  await page.locator('.page-prose table td').first().click()
  const bar = page.getByTestId('table-bar')
  await expect(bar).toBeVisible()
  await expect(bar).toHaveClass(/table-bar-float/)

  // Filter to "cassy" — Patricia's row hides, header stays.
  await page.getByTestId('table-filter').fill('cassy')
  await expect(page.locator('.page-prose table tr', { hasText: 'Patricia' })).toBeHidden()
  await expect(page.locator('.page-prose table tr', { hasText: 'Cassy' })).toBeVisible()
  await expect(page.locator('.page-prose table tr', { hasText: 'role' })).toBeVisible()

  // Clear → everything back.
  await page.getByTestId('table-filter-clear').click()
  await expect(page.locator('.page-prose table tr', { hasText: 'Patricia' })).toBeVisible()

  // View-only law: the stored markdown never changed while filtered.
  const res = await page.request.get(
    `${MOCK}/api/notes?id=${encodeURIComponent('pages/roster')}`,
    { headers: AUTH },
  )
  const note = (await res.json()) as { content?: string }
  expect(note.content).toContain('| Patricia | video editor |')
})
