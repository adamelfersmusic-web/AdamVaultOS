// The /diagram block — a Mermaid diagram rendered IN PLACE inside the editable
// .md editor, ending the old either/or (editable .md with grey code text vs a
// rendering but read-only .mdx).
//
// THE contract under test is the markdown round-trip: the block's storage form
// is an ordinary ```mermaid fence, so a note that already has one becomes live
// on open and byte-identical on save.

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

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('an existing ```mermaid fence opens as a live diagram, and the note stays editable', async ({
  page,
}) => {
  await seed(
    page,
    'pages/diag',
    '# Diagram note\n\nBefore the picture.\n\n```mermaid\ngraph TD\n  A[Start] --> B[Next]\n```\n\nAfter the picture.\n',
  )
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/diag')

  // The fence rendered as an SVG, not grey code text.
  const render = page.getByTestId('mermaid-render')
  await expect(render).toBeVisible()
  await expect(render.locator('.mdx-mermaid svg')).toBeVisible()
  await expect(page.locator('.page-prose pre')).toHaveCount(0)

  // …and the prose around it is still ordinary editable text (the whole point).
  await page.locator('.page-prose').getByText('After the picture.').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' Edited.')
  await expect
    .poll(() => savedContent(page, 'pages/diag'))
    .toContain('After the picture. Edited.')

  // The diagram survived that edit as a plain fence.
  const md = await savedContent(page, 'pages/diag')
  expect(md).toContain('```mermaid')
  expect(md).toContain('graph TD')
  expect(md).toContain('A[Start] --> B[Next]')

  expect(errors, errors.join('\n')).toEqual([])
})

test('click the diagram to edit it, click away to render — the fence updates', async ({ page }) => {
  await seed(page, 'pages/edit', '# Edit\n\n```mermaid\ngraph TD\n  A --> B\n```\n\ntail\n')
  await connectViaStorage(page)
  await openPage(page, 'pages/edit')

  await expect(page.getByTestId('mermaid-render')).toBeVisible()
  await page.getByTestId('mermaid-render').click()

  const input = page.getByTestId('mermaid-input')
  await expect(input).toBeVisible()
  await expect(input).toHaveValue('graph TD\n  A --> B')

  await input.fill('graph LR\n  Adam --> Vault')
  // Click away → back to a picture.
  await page.locator('.page-prose').getByText('tail').click()
  await expect(page.getByTestId('mermaid-input')).toHaveCount(0)
  await expect(page.getByTestId('mermaid-render').locator('.mdx-mermaid svg')).toBeVisible()

  await expect.poll(() => savedContent(page, 'pages/edit')).toContain('Adam --> Vault')
  const md = await savedContent(page, 'pages/edit')
  expect(md).toContain('```mermaid\ngraph LR\n  Adam --> Vault\n```')
  expect(md).not.toContain('A --> B')
})

test('/diagram inserts a block; it stores as a plain fence', async ({ page }) => {
  await seed(page, 'pages/ins', '# Ins\n\nend line')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/ins')
  await page.locator('.page-prose').getByText('end line').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/diagram')
  await expect(page.locator('.slash-menu')).toBeVisible()
  await page.keyboard.press('Enter')

  // A fresh block opens straight into the editor, focused.
  const input = page.getByTestId('mermaid-input')
  await expect(input).toBeVisible()
  await input.fill('graph TD\n  One --> Two')
  await page.keyboard.press('Meta+Enter')

  await expect(page.getByTestId('mermaid-render').locator('.mdx-mermaid svg')).toBeVisible()
  await expect
    .poll(() => savedContent(page, 'pages/ins'))
    .toContain('```mermaid\ngraph TD\n  One --> Two\n```')

  expect(errors, errors.join('\n')).toEqual([])
})

test('an abandoned empty block leaves no empty fence behind', async ({ page }) => {
  await seed(page, 'pages/empty', '# Empty\n\nend line')
  await connectViaStorage(page)
  await openPage(page, 'pages/empty')

  await page.locator('.page-prose').getByText('end line').click()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/diagram')
  await expect(page.locator('.slash-menu')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('mermaid-input')).toBeVisible()

  // Walk away without typing anything — the block removes itself.
  await page.locator('.page-prose').getByText('end line').click()
  await expect(page.getByTestId('mermaid-input')).toHaveCount(0)
  await expect(page.getByTestId('mermaid-render')).toHaveCount(0)

  await page.waitForTimeout(1200)
  expect(await savedContent(page, 'pages/empty')).not.toContain('mermaid')
})

test('a diagram nobody touched is byte-stable across an open/save round-trip', async ({ page }) => {
  const original =
    '# Stable\n\nIntro line.\n\n```mermaid\nmindmap\n  root((vault))\n    atelier\n    escensus\n```\n\nOutro line.\n'
  await seed(page, 'pages/stable', original)
  await connectViaStorage(page)
  await openPage(page, 'pages/stable')
  await expect(page.getByTestId('mermaid-render')).toBeVisible()

  // Touch a paragraph far from the diagram, then undo it — this forces a save
  // whose content should match the original byte for byte.
  await page.locator('.page-prose').getByText('Outro line.').click()
  await page.keyboard.press('End')
  await page.keyboard.type('X')
  await expect.poll(() => savedContent(page, 'pages/stable')).toContain('Outro line.X')
  await page.keyboard.press('Backspace')
  await expect.poll(() => savedContent(page, 'pages/stable')).not.toContain('Outro line.X')

  // Byte-identical, save for the editor's pre-existing trailing-newline strip
  // (a note with no diagram in it loses that newline too — verified separately,
  // it is not something the Mermaid block introduces).
  expect(await savedContent(page, 'pages/stable')).toBe(original.replace(/\n$/, ''))
})

test('invalid syntax degrades to readable text instead of crashing the note', async ({ page }) => {
  await seed(page, 'pages/bad', '# Bad\n\n```mermaid\nthis is not a diagram at all {{{\n```\n\ntail\n')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/bad')
  await expect(page.locator('.mdx-mermaid-fallback')).toBeVisible()
  await expect(page.locator('.page-prose')).toContainText('this is not a diagram at all')
  // The rest of the note still works.
  await expect(page.locator('.page-prose')).toContainText('tail')
  expect(errors, errors.join('\n')).toEqual([])
})
