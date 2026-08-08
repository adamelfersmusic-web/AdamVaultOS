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

// ── The other two surfaces ───────────────────────────────────────────────────
// A note is rendered in three places. Pages (TipTap) is covered above; these
// cover the read view — which is also the Library's preview pane — and the
// inline editor that its Edit button opens.

test('the read view renders diagrams too (it is the Library preview pane)', async ({ page }) => {
  await seed(
    page,
    'atelier/diag-read',
    '# Read view\n\nProse above.\n\n```mermaid\ngraph TD\n  A[Start] --> B[Next]\n```\n\nProse below.\n',
  )
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('atelier/diag-read'))
  const body = page.getByTestId('note-body')
  await expect(body).toBeVisible()

  // The fence became a diagram, not a <pre> of grey code.
  await expect(body.locator('.mdx-mermaid svg')).toBeVisible()
  await expect(body.locator('code.language-mermaid')).toHaveCount(0)
  await expect(body).toContainText('Prose below.')

  expect(errors, errors.join('\n')).toEqual([])
})

test('a note with no diagram loads mermaid not at all', async ({ page }) => {
  await seed(page, 'atelier/plain', '# Plain\n\nJust words, no diagram.\n')
  await connectViaStorage(page)

  const requested: string[] = []
  page.on('request', (r) => {
    if (/mermaid/i.test(r.url())) requested.push(r.url())
  })

  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('atelier/plain'))
  await expect(page.getByTestId('note-body')).toContainText('Just words')
  await page.waitForTimeout(1200)

  // The whole point of the cheap querySelectorAll guard: zero network cost on
  // the notes that have no diagram, which is nearly all of them.
  expect(requested, requested.join('\n')).toEqual([])
})

test('the inline editor keeps a diagram as a plain fence, byte-stable', async ({ page }) => {
  const original = '# Inline\n\nProse above.\n\n```mermaid\ngraph LR\n  A --> B\n```\n\nProse below.'
  await seed(page, 'atelier/diag-edit', original)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('atelier/diag-edit'))
  await expect(page.getByTestId('note-body')).toBeVisible()
  await page.getByRole('button', { name: /edit/i }).first().click()

  // In the inline editor it is the same live block as in Pages.
  await expect(page.getByTestId('mermaid-render')).toBeVisible()
  await expect(page.getByTestId('mermaid-render').locator('.mdx-mermaid svg')).toBeVisible()

  // Edit a paragraph far from the diagram and save. Everything except that one
  // character must come back byte-identical — including the fence.
  await page.locator('.ProseMirror').getByText('Prose below.').click()
  await page.keyboard.press('End')
  await page.keyboard.type('X')
  await page.getByTestId('savebar').getByRole('button', { name: /save/i }).click()

  await expect.poll(() => savedContent(page, 'atelier/diag-edit')).toContain('Prose below.X')
  expect(await savedContent(page, 'atelier/diag-edit')).toBe(
    original.replace('Prose below.', 'Prose below.X'),
  )

  expect(errors, errors.join('\n')).toEqual([])
})
