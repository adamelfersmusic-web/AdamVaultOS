// #23 — IMAGE RESIZE + ALIGNMENT. The contract under test is the byte-stable
// markdown round-trip: a plain `![alt](src)` must NEVER change on its own,
// and only a deliberate resize/align turns it into a raw HTML
// `<img src alt width style>` — which must then round-trip byte-identically
// itself (no attribute reordering, no normalization drift).

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

const IMG = '/api/storage/2026-07-11/amp.png' // mock serves a 320×200 image
const IMG2 = '/api/storage/2026-07-11/two.png'

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
/** Wait for the vault image (auth-resolved blob) to actually render. */
async function imageReady(page: Page, nth = 0) {
  const img = page.locator('.page-prose .vault-image').nth(nth)
  await expect(img).toBeVisible()
  return img
}
/** Type an unrelated edit at the end of the "tail line" paragraph. Clicks
 *  near the paragraph's left edge — its center can sit under a floated image. */
async function editTail(page: Page) {
  await page
    .locator('.page-prose')
    .getByText('tail line')
    .click({ position: { x: 5, y: 8 } })
  await page.keyboard.press('End')
  await page.keyboard.type(' ping')
}
/** Drag a resize handle horizontally by dx px (negative = leftward). */
async function dragHandle(page: Page, testid: string, dx: number) {
  const handle = page.getByTestId(testid)
  await expect(handle).toBeVisible()
  const box = (await handle.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y, { steps: 8 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('byte law — a plain ![](…) note survives open + unrelated edit byte-identical', async ({ page }) => {
  const body = `# Img\n\n![](${IMG})\n\ntail line`
  await seed(page, 'pages/img', body)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/img')
  await imageReady(page)
  await editTail(page)

  await expect
    .poll(() => savedContent(page, 'pages/img'))
    .toBe(body.replace('tail line', 'tail line ping'))
  const after = await savedContent(page, 'pages/img')
  expect(after).toContain(`![](${IMG})`)
  expect(after).not.toContain('<img')

  expect(errors, errors.join('\n')).toEqual([])
})

test('resize — corner drag writes <img width>, renders at that width, idempotent round-trip', async ({ page }) => {
  await seed(page, 'pages/imgsize', `# Size\n\n![](${IMG})\n\ntail line`)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/imgsize')
  const img = await imageReady(page)
  await img.click()
  await expect(page.getByTestId('vimg-toolbar')).toBeVisible()

  // Drag the SE corner +100px → natural 320 grows to ~420.
  await dragHandle(page, 'vimg-handle-se', 100)

  await expect
    .poll(() => savedContent(page, 'pages/imgsize'))
    .toMatch(new RegExp(`<img src="${IMG.replace(/\//g, '\\/')}" width="\\d+">`))
  const md = await savedContent(page, 'pages/imgsize')
  const width = Number(/width="(\d+)"/.exec(md)![1])
  expect(width).toBeGreaterThan(380)
  expect(width).toBeLessThan(460)

  // Reload → renders at exactly that width.
  await page.reload()
  await imageReady(page)
  await expect(page.locator('.vault-image-frame')).toHaveCSS('width', `${width}px`)

  // Idempotent round-trip: an unrelated edit changes ONLY the edited bytes.
  const before = await savedContent(page, 'pages/imgsize')
  await editTail(page)
  await expect
    .poll(() => savedContent(page, 'pages/imgsize'))
    .toBe(before.replace('tail line', 'tail line ping'))

  expect(errors, errors.join('\n')).toEqual([])
})

test('align — float-left writes the canonical inline style, wraps in editor + read view, clear restores the exact original bytes', async ({ page }) => {
  const body = `# Align\n\n![](${IMG})\n\nAround the amp the copy keeps flowing, line after line, so the float has something to wrap.\n\ntail line`
  await seed(page, 'pages/imgalign', body)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/imgalign')
  const img = await imageReady(page)
  await img.click()
  await expect(page.getByTestId('vimg-toolbar')).toBeVisible()
  await page.getByTestId('vimg-align-left').click()

  // Editor: the node floats (text wraps beside it).
  await expect(page.locator('.vault-image-wrap')).toHaveCSS('float', 'left')

  // Vault: width attr absent, align carried as the canonical inline style.
  await expect
    .poll(() => savedContent(page, 'pages/imgalign'))
    .toContain(`<img src="${IMG}" style="float:left;margin:4px 16px 8px 0">`)

  // Read view renders the same float (inline style carries everywhere).
  await page.goto('http://127.0.0.1:4173/#/note/' + encodeURIComponent('pages/imgalign'))
  const readImg = page.locator('.prose img.vault-img[style*="float:left"]')
  await expect(readImg).toBeVisible()
  await expect(readImg).toHaveCSS('float', 'left')

  // Back in the editor: clear alignment → the note returns to the simplest
  // serialization — byte-identical to the original seed.
  await openPage(page, 'pages/imgalign')
  await (await imageReady(page)).click()
  await page.getByTestId('vimg-align-clear').click()
  await expect.poll(() => savedContent(page, 'pages/imgalign')).toBe(body)

  expect(errors, errors.join('\n')).toEqual([])
})

test('hand-authored <img width style> — loads, unrelated edit keeps the tag byte-identical (no attribute drift)', async ({ page }) => {
  const body = `# Hand\n\n<img src="${IMG}" alt="amp" width="420" style="float:right;margin:4px 0 8px 16px">\n\ntail line`
  await seed(page, 'pages/imghand', body)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/imghand')
  await imageReady(page)
  // The hand-authored width + float render live in the editor.
  await expect(page.locator('.vault-image-frame')).toHaveCSS('width', '420px')
  await expect(page.locator('.vault-image-wrap')).toHaveCSS('float', 'right')

  await editTail(page)
  await expect
    .poll(() => savedContent(page, 'pages/imghand'))
    .toBe(body.replace('tail line', 'tail line ping'))

  expect(errors, errors.join('\n')).toEqual([])
})

test('isolation — resizing one image leaves a plain sibling image untouched', async ({ page }) => {
  const body = `# Two\n\n![](${IMG})\n\n![](${IMG2})\n\ntail line`
  await seed(page, 'pages/imgtwo', body)
  await connectViaStorage(page)

  await openPage(page, 'pages/imgtwo')
  await imageReady(page, 1)
  // Select the SECOND image and shrink it.
  await page.locator('.page-prose .vault-image').nth(1).click()
  await expect(page.getByTestId('vimg-toolbar')).toBeVisible()
  await dragHandle(page, 'vimg-handle-se', -100)

  await expect
    .poll(() => savedContent(page, 'pages/imgtwo'))
    .toMatch(new RegExp(`<img src="${IMG2.replace(/\//g, '\\/')}" width="\\d+">`))
  const md = await savedContent(page, 'pages/imgtwo')
  // The first image is still the sacred plain form — byte-identical.
  expect(md).toContain(`![](${IMG})\n`)
  expect(md.match(/<img /g)).toHaveLength(1)
})

test('legacy data-align — renders centered and survives an unrelated edit byte-identical', async ({ page }) => {
  const body = `# Legacy\n\n<img src="${IMG}" width="300" data-align="center">\n\ntail line`
  await seed(page, 'pages/imglegacy', body)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/imglegacy')
  await imageReady(page)
  // Legacy data-align still renders centered in the editor.
  await expect(page.locator('.vault-image-wrap[data-align="center"]').first()).toBeVisible()
  await expect(page.locator('.vault-image-frame')).toHaveCSS('width', '300px')

  await editTail(page)
  await expect
    .poll(() => savedContent(page, 'pages/imglegacy'))
    .toBe(body.replace('tail line', 'tail line ping'))

  expect(errors, errors.join('\n')).toEqual([])
})

test('image inside a toggle — the fold and its image survive an unrelated edit intact', async ({ page }) => {
  // NOTE: <details> followed by a paragraph has a pre-existing serialization
  // quirk (extra blank lines after </details> — visible on main with any
  // details note, images or not), so this asserts the image + fold content
  // round-trip intact rather than whole-body byte equality (same approach as
  // editor-richness's pre-existing rich-note test).
  const body = `# Fold\n\n<details>\n<summary>Amp shots</summary>\n\n![](${IMG2})\n</details>\n\ntail line`
  await seed(page, 'pages/imgfold', body)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await openPage(page, 'pages/imgfold')
  await editTail(page)
  await expect.poll(() => savedContent(page, 'pages/imgfold')).toContain('tail line ping')
  const after = await savedContent(page, 'pages/imgfold')
  expect(after).toContain(`<details>\n<summary>Amp shots</summary>\n\n![](${IMG2})\n</details>`)
  expect(after).not.toContain('<img')

  expect(errors, errors.join('\n')).toEqual([])
})
