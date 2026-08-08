// Mermaid export — the canvas as a portable, GitHub-renderable view.
//
// Generated on demand, never stored: mermaid holds neither positions nor arrow
// geometry, so it can only ever be a view of the board.
//
// THE test that matters is the last one: the generated text is fed through the
// REAL mermaid renderer. Asserting the string looks right only proves it is
// plausible; rendering it proves it is valid.

import { test, expect, type Page } from '@playwright/test'
import { toMermaid, toMermaidFence, type MermaidCard } from '../src/lib/canvasMermaid'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

const card = (path: string, parent: string | null, order: number, label: string): MermaidCard => ({
  path,
  parent,
  order,
  label,
})

/** One trunk, uneven depth — the real shape. */
const tree: MermaidCard[] = [
  card('root', null, 10, 'SIGNALCRAFT'),
  card('a', 'root', 10, 'A · MAKE A RUBRIC'),
  card('a1', 'a', 10, 'Bree Final Expense Config — "important", and our first real attempt.'),
  card('a2', 'a', 20, 'slot two'),
  card('b', 'root', 20, 'B · SCORE CALLS'),
]

test('one trunk with no cross-links exports as a mindmap', () => {
  const exp = toMermaid(tree, [])
  expect(exp.kind).toBe('mindmap')
  expect(exp.text.split('\n')[0]).toBe('mindmap')
  expect(exp.nodeCount).toBe(5)

  // Reading order matches the map: trunk, then A and its children, then B.
  const labels = exp.text.match(/"([^"]+)"/g)!.map((s) => s.slice(1, -1))
  expect(labels[0]).toBe('SIGNALCRAFT')
  expect(labels[1]).toBe('A · MAKE A RUBRIC')
  expect(labels[labels.length - 1]).toBe('B · SCORE CALLS')

  // Depth shows up as indentation.
  const line = (needle: string) => exp.text.split('\n').find((l) => l.includes(needle))!
  const indent = (l: string) => l.length - l.trimStart().length
  expect(indent(line('SIGNALCRAFT'))).toBeLessThan(indent(line('A · MAKE A RUBRIC')))
  expect(indent(line('A · MAKE A RUBRIC'))).toBeLessThan(indent(line('slot two')))
})

test('a cross-link forces a flowchart — a mindmap cannot hold one', () => {
  const exp = toMermaid(tree, [{ from: 'b', to: 'a1', label: 'feeds into' }])
  expect(exp.kind).toBe('flowchart')
  expect(exp.text.startsWith('flowchart LR')).toBe(true)
  expect(exp.linkCount).toBe(1)
  expect(exp.reason).toContain('strictly a tree')
  // Tree edges are solid, the cross-link dotted and labelled.
  expect(exp.text).toMatch(/n0 --> n1/)
  expect(exp.text).toMatch(/-\.->\|"feeds into"\|/)
})

test('two trunks force a flowchart — a mindmap has exactly one root', () => {
  const exp = toMermaid([card('r1', null, 10, 'One'), card('r2', null, 20, 'Two')], [])
  expect(exp.kind).toBe('flowchart')
  // Two bare trunks means nothing is joined to anything, so the message says
  // that rather than the technically-true "more than one trunk".
  expect(exp.structureless).toBe(true)
  expect(exp.reason).toContain('Nothing on this board is connected')
})

test('multiple trunks WITH children is not structureless', () => {
  const exp = toMermaid(
    [
      card('r1', null, 10, 'One'),
      card('a', 'r1', 10, 'child'),
      card('r2', null, 20, 'Two'),
    ],
    [],
  )
  expect(exp.kind).toBe('flowchart')
  expect(exp.structureless).toBe(false)
  expect(exp.reason).toContain('more than one trunk')
})

test('labels that would break mermaid are neutralised', () => {
  const exp = toMermaid(
    [card('r', null, 10, 'Quote " and (parens) [brackets]\nand a newline')],
    [],
  )
  // Quotes cannot survive inside a quoted mermaid string.
  expect(exp.text).not.toMatch(/[^\\]"[^"\n]*"[^"\n]*"/)
  expect(exp.text).toContain("Quote ' and (parens) [brackets] and a newline")
  expect(exp.text).not.toContain('\n and a newline')
})

test('an empty label becomes Untitled rather than empty syntax', () => {
  const exp = toMermaid([card('r', null, 10, '   ')], [])
  expect(exp.text).toContain('"Untitled"')
})

test('a collapsed branch is still exported — collapse is a view, not content', () => {
  // The generator never sees `collapsed`: it takes the whole card list.
  const exp = toMermaid(tree, [])
  expect(exp.nodeCount).toBe(5)
  expect(exp.text).toContain('slot two')
})

test('an unlabelled cross-link exports without an empty label box', () => {
  const exp = toMermaid(tree, [{ from: 'b', to: 'a1', label: '' }])
  expect(exp.text).toMatch(/n\d+ -\.-> n\d+/)
  expect(exp.text).not.toContain('|""|')
})

// ── The one that proves it, by rendering it ─────────────────────────────────


/**
 * Reset and WAIT until the vault is actually empty.
 *
 * Writes are optimistic, so a previous test's creates can still be in flight
 * when it ends and land just after the next reset — repopulating the board and
 * failing a later test for no reason of its own. Polling for empty makes each
 * test start from a slate that is genuinely clean.
 */
async function freshVault(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
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

test('both dialects actually render — not just look plausible', async ({ page }) => {
  await page.request.post(`${MOCK}/__test/reset`)
  const mindmap = toMermaid(tree, [])
  const flowchart = toMermaid(tree, [{ from: 'b', to: 'a1', label: 'feeds into' }])

  for (const [slug, exp] of [
    ['mm', mindmap],
    ['fc', flowchart],
  ] as const) {
    const res = await page.request.post(`${MOCK}/api/notes`, {
      headers: AUTH,
      data: {
        path: `pages/${slug}`,
        content: `# Export\n\n${toMermaidFence(exp)}\n\ntail`,
        tags: [],
        metadata: {},
      },
    })
    expect(res.status(), await res.text()).toBe(201)
  }

  await connectViaStorage(page)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  for (const slug of ['mm', 'fc']) {
    await page.goto('http://127.0.0.1:4173/#/pages/' + encodeURIComponent(`pages/${slug}`))
    await expect(page.locator('.page-prose')).toBeVisible()
    // A real SVG, not the raw-text fallback that bad syntax degrades to.
    await expect(page.getByTestId('mermaid-render').locator('.mdx-mermaid svg')).toBeVisible()
    await expect(page.locator('.mdx-mermaid-fallback')).toHaveCount(0)
  }
  expect(errors, errors.join('\n')).toEqual([])
})

// ── The export button, end to end ───────────────────────────────────────────

test('Export a real board, land it as a page, and see it render', async ({ page }) => {
  await freshVault(page)
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('mode-map').click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 120, y: 200 } })
  await expect(page.getByTestId('map-node-input')).toBeVisible()
  await page.keyboard.type('SIGNALCRAFT')
  await page.keyboard.press('Tab')
  await page.keyboard.type('A · MAKE A RUBRIC')
  await page.keyboard.press('Enter')
  await page.keyboard.type('B · SCORE CALLS')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('map-node')).toHaveCount(3)

  // With no cross-links this is a tree, so it exports as a mindmap.
  await page.getByTestId('canvas-export').click()
  const text = page.getByTestId('export-text')
  await expect(text).toBeVisible()
  await expect(text).toHaveValue(/^mindmap/)
  await expect(text).toHaveValue(/SIGNALCRAFT/)
  await expect(text).toHaveValue(/B · SCORE CALLS/)

  // Landing it opens the page, where the Mermaid block renders it.
  await page.getByTestId('export-save').click()
  await expect(page).toHaveURL(/#\/pages\//)
  await expect(page.getByTestId('mermaid-render').locator('.mdx-mermaid svg')).toBeVisible()
  await expect(page.locator('.mdx-mermaid-fallback')).toHaveCount(0)

  // The export is a snapshot in a page note — the canvas is untouched.
  const res = await page.request.get(
    `${MOCK}/api/notes?path_prefix=${encodeURIComponent('canvas/')}&include_content=true`,
    { headers: AUTH },
  )
  const canvasNotes = (await res.json()) as Array<{ metadata?: Record<string, unknown> }>
  expect(canvasNotes.some((n) => n.metadata?.['exported_from'])).toBe(false)

  expect(errors, errors.join('\n')).toEqual([])
})

test('a board with a cross-link exports as a flowchart instead', async ({ page }) => {
  await freshVault(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('mode-map').click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 120, y: 200 } })
  await expect(page.getByTestId('map-node-input')).toBeVisible()
  await page.keyboard.type('root')
  await page.keyboard.press('Tab')
  await page.keyboard.type('alpha')
  await page.keyboard.press('Enter')
  await page.keyboard.type('beta')
  await page.keyboard.press('Escape')

  const node = (label: string) =>
    page.getByTestId('map-node').filter({ has: page.getByText(label, { exact: true }) })
  await node('beta').hover()
  const pb = await node('beta').getByTestId('map-port').boundingBox()
  const tb = await node('alpha').boundingBox()
  await page.mouse.move(pb!.x + pb!.width / 2, pb!.y + pb!.height / 2)
  await page.mouse.down()
  await page.mouse.move(tb!.x + tb!.width / 2, tb!.y + tb!.height / 2, { steps: 10 })
  await page.mouse.up()
  await page.keyboard.type('blocks')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('map-link')).toHaveCount(1)

  await page.getByTestId('canvas-export').click()
  const text = page.getByTestId('export-text')
  await expect(text).toHaveValue(/^flowchart LR/)
  await expect(text).toHaveValue(/-\.->\|"blocks"\|/)
})

// ── The notice on a board with nothing joined up ────────────────────────────

test('a free board with no structure says so, once, and offers Map mode', async ({ page }) => {
  await freshVault(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()

  // One card is not yet a board worth warning about.
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 300, y: 240 } })
  await page.locator('.canvas-title-input').click()
  await expect(page.getByTestId('canvas-structure-hint')).toHaveCount(0)

  // Two unconnected cards: a mermaid export here would be a row of boxes.
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 800, y: 500 } })
  await page.locator('.canvas-title-input').click()
  const hint = page.getByTestId('canvas-structure-hint')
  await expect(hint).toBeVisible()
  await expect(hint).toContainText('no structure to export')

  // The export modal agrees, rather than reporting a technicality.
  await page.getByTestId('canvas-export').click()
  await expect(page.locator('.export-warn').first()).toBeVisible()
  await expect(page.locator('.modal-sub').first()).toContainText('Nothing on this board is connected')
  await page.keyboard.press('Escape')

  // Taking the offer switches modes and clears the notice.
  await page.getByTestId('hint-switch-map').click()
  await expect(page.getByTestId('mode-map')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('canvas-structure-hint')).toHaveCount(0)

  // Back in free mode it stays gone — a hint that reappears is a nag.
  await page.getByTestId('mode-free').click()
  await expect(page.getByTestId('canvas-structure-hint')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.canvas-card')).toHaveCount(2)
  await expect(page.getByTestId('canvas-structure-hint')).toHaveCount(0)
})

test('a board that IS joined up never shows the notice', async ({ page }) => {
  await freshVault(page)
  await connectViaStorage(page)
  await page.goto('http://127.0.0.1:4173/#/canvas')
  await page.getByRole('button', { name: 'New canvas' }).first().click()
  await page.getByTestId('mode-map').click()
  await page.getByTestId('canvas-plane').dblclick({ position: { x: 200, y: 200 } })
  await expect(page.getByTestId('map-node-input')).toBeVisible()
  await page.keyboard.type('root')
  await page.keyboard.press('Tab')
  await page.keyboard.type('child')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('map-node')).toHaveCount(2)

  // These cards have a parent/child relationship, so free mode has something
  // real to export and there is nothing to warn about.
  await page.getByTestId('mode-free').click()
  await expect(page.locator('.canvas-card')).toHaveCount(2)
  await expect(page.getByTestId('canvas-structure-hint')).toHaveCount(0)
})
