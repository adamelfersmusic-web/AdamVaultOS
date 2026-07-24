// Proof for the two show-off components: <ContextWindowMeter> (pure client,
// no API) and <QuizMe> (Claude generates a question — the endpoint is routed
// to a canned JSON question so no key/credit is used). Mock-only.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const NOTE_PATH = 'Atelier/Method/ai-primer/_showcase-2'

const MDX = `## Showcase 2

Feel a context window fill and overflow:

<ContextWindowMeter size={15} />

Then let Claude quiz you:

<QuizMe />
`

const QUESTION = {
  question: 'Which layer does MCP belong to?',
  options: ['Model', 'Memory', 'Tools', 'Interface'],
  correct: 2,
  explanation: 'MCP is layer 5 — Tools. Covered in Module 4.',
}

async function seed(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
  // A primer note so the course-context load has something to read.
  await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: {
      path: 'Atelier/Method/ai-primer/ai-primer-00-mental-model',
      content: '# Module 0\nEight layers: model, context window, tools, memory…',
      tags: ['ai-primer'],
      metadata: { module_number: 0 },
    },
  })
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path: NOTE_PATH, extension: 'mdx', content: MDX, tags: [], metadata: {} },
  })
  expect(res.status(), await res.text()).toBe(201)
}

test.skip(!!process.env.REAL_VAULT, 'mock-only spec')

test('showcase 2: ContextWindowMeter overflows and QuizMe grades', async ({ page }) => {
  await seed(page)
  await page.addInitScript(
    ([url, token]) => {
      localStorage.setItem('adamvaultos.vault', JSON.stringify({ url, token }))
      localStorage.setItem('adamvaultos.anthropicKey', 'sk-test-key')
    },
    [MOCK, TOKEN] as const,
  )
  await page.route('https://api.anthropic.com/v1/messages', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(QUESTION) }] }),
    }),
  )

  await page.goto(`/#/note/${NOTE_PATH.split('/').map(encodeURIComponent).join('/')}`)
  const body = page.getByTestId('note-body')
  await expect(body).toBeVisible()

  // --- ContextWindowMeter --- the long sample text overflows size=15, so the
  // oldest tokens are marked dropped.
  const cwm = body.locator('.mdx-cwm')
  await expect(cwm).toBeVisible()
  await expect(cwm.locator('.mdx-cwm-count')).toHaveAttribute('data-state', 'over')
  await expect(cwm.locator('.mdx-cwm-tok.is-dropped').first()).toBeVisible()
  await page.screenshot({ path: 'e2e/.shots/cwm-overflow.png' })
  // Clearing the box drops it below budget — no more dropped tokens.
  await cwm.locator('.mdx-cwm-input').fill('just a few words here')
  await expect(cwm.locator('.mdx-cwm-tok.is-dropped')).toHaveCount(0)

  // --- QuizMe --- generate (routed) → question renders → pick correct → win.
  const quiz = body.locator('.mdx-quizme')
  await quiz.getByRole('button', { name: 'Generate a question' }).click()
  await expect(quiz.locator('.mdx-quizme-q')).toContainText('Which layer does MCP')
  await quiz.getByRole('button', { name: 'Tools', exact: true }).click()
  await expect(quiz.locator('.mdx-quizme-verdict.is-win')).toBeVisible()
  await expect(quiz.locator('.mdx-quizme-verdict')).toContainText('Module 4')
  await page.screenshot({ path: 'e2e/.shots/quizme-answered.png' })
})
