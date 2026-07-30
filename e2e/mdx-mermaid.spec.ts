// Mermaid in MDX: both the <Mermaid> tag and a ```mermaid fence compile to an
// SVG diagram, while a normal fenced code block passes straight through to a
// <pre>. Mock-only; seeds its own mdx note.
import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const NOTE = 'Atelier/Method/ai-primer/_mermaid-test'

const MDX = `## Diagrams

<Mermaid chart="graph LR; A[Start] --> B[Ship]" />

A fenced mermaid block:

\`\`\`mermaid
graph TD
  Legal --> Script --> Rubric
\`\`\`

And a normal code block that must NOT become a diagram:

\`\`\`js
const keep = "ordinary code block"
\`\`\`
`

async function seed(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path: NOTE, extension: 'mdx', content: MDX, tags: [], metadata: {} },
  })
  expect(res.status(), await res.text()).toBe(201)
}

test.skip(!!process.env.REAL_VAULT, 'mock-only spec')

test('mermaid: <Mermaid> tag and ```mermaid fence both render SVG; normal code passes through', async ({
  page,
}) => {
  await seed(page)
  await page.addInitScript(
    ([url, token]) => localStorage.setItem('adamvaultos.vault', JSON.stringify({ url, token })),
    [MOCK, TOKEN] as const,
  )
  await page.goto(`/#/note/${NOTE.split('/').map(encodeURIComponent).join('/')}`)

  const body = page.getByTestId('note-body')
  await expect(body).toBeVisible()

  // Both diagrams compile to inline SVG (lazy mermaid chunk loads first).
  await expect(body.locator('.mdx-mermaid svg').first()).toBeVisible({ timeout: 20000 })
  await expect(body.locator('.mdx-mermaid svg')).toHaveCount(2)

  // The normal js block stayed a plain code block — not a diagram.
  await expect(body).toContainText('ordinary code block')
  await expect(body.locator('pre:not(.mdx-mermaid *) code')).toContainText('ordinary code block')

  // The raw mermaid source is gone (it became a picture).
  await expect(body).not.toContainText('graph TD')
})
