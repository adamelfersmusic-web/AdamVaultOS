// Ask AI panel (⌘J) — Sonnet 5 default / Opus 4.8 toggle, streaming answers
// grounded in the vault + the open page, one-click insert back into the page.
// The Anthropic API is mocked with playwright route interception (SSE bytes),
// so these tests exercise the panel end-to-end without a real key.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}
async function seed(
  page: Page,
  path: string,
  content: string,
  tags: string[],
  metadata: Record<string, unknown> = {},
) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags, metadata },
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
      localStorage.setItem('adamvaultos.anthropicKey', 'sk-test-key')
    },
    [SESSION_KEY, MOCK, TOKEN] as const,
  )
}

function sse(events: unknown[]): string {
  return events
    .map((e) => `event: x\ndata: ${JSON.stringify(e)}\n`)
    .join('\n')
    .concat('\n')
}

/** Intercept api.anthropic.com and stream a canned answer; capture requests. */
async function mockAnthropic(page: Page, answer: string, captured: unknown[]) {
  await page.route('https://api.anthropic.com/**', async (route) => {
    captured.push(route.request().postDataJSON())
    const body = sse([
      { type: 'message_start', message: { id: 'msg_test' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      ...answer
        .split(/(?<= )/)
        .map((chunk) => ({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: chunk },
        })),
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } },
      { type: 'message_stop' },
    ])
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    })
  })
}

test.describe('Ask AI panel', () => {
  test('opens, streams a grounded answer, remembers model default', async ({ page }) => {
    await reset(page)
    await seed(page, 'atelier/00-home', '# Atelier\n\nThe agency front door.', ['atelier'])
    await connectViaStorage(page)
    const captured: unknown[] = []
    await mockAnthropic(page, 'Grounded answer citing atelier/00-home for you. ', captured)

    await page.goto('/')
    await page.getByTestId('askai-open').click()
    await expect(page.getByTestId('askai-panel')).toBeVisible()

    // Sonnet is the default model chip
    await expect(page.getByTestId('askai-model-sonnet')).toHaveClass(/is-on/)

    await page.getByTestId('askai-input').fill('What is the atelier front door?')
    await page.getByTestId('askai-send').click()

    await expect(page.getByTestId('askai-thread')).toContainText(
      'Grounded answer citing atelier/00-home',
      { timeout: 10_000 },
    )

    // The request went out on Sonnet 5 with medium effort and streaming on.
    expect(captured.length).toBeGreaterThan(0)
    const req = captured[0] as {
      model: string
      stream: boolean
      output_config: { effort: string }
      thinking?: unknown
    }
    expect(req.model).toBe('claude-sonnet-5')
    expect(req.stream).toBe(true)
    expect(req.output_config.effort).toBe('medium')
    expect(req.thinking).toBeUndefined()
  })

  test('broad vault question bumps effort; opus toggle switches model at high', async ({
    page,
  }) => {
    await reset(page)
    await seed(page, 'atelier/00-home', '# Atelier', ['atelier'])
    await connectViaStorage(page)
    const captured: unknown[] = []
    await mockAnthropic(page, 'Deep answer. ', captured)

    await page.goto('/')
    await expect(page.getByTestId('askai-open')).toBeVisible()
    await page.keyboard.press('ControlOrMeta+j')
    await expect(page.getByTestId('askai-panel')).toBeVisible()

    // Broad phrasing on Sonnet → effort high
    await page.getByTestId('askai-input').fill('Look across my whole vault: themes?')
    await page.getByTestId('askai-send').click()
    await expect.poll(() => captured.length, { timeout: 10_000 }).toBe(1)
    await expect(page.getByTestId('askai-thread')).toContainText('Deep answer', {
      timeout: 10_000,
    })
    const first = captured[0] as { model: string; output_config: { effort: string } }
    expect(first.model).toBe('claude-sonnet-5')
    expect(first.output_config.effort).toBe('high')

    // Opus toggle → opus model, high effort, adaptive thinking explicit
    await page.getByTestId('askai-model-opus').click()
    await page.getByTestId('askai-input').fill('Quick one')
    await page.getByTestId('askai-send').click()
    await expect.poll(() => captured.length, { timeout: 10_000 }).toBe(2)
    const second = captured[captured.length - 1] as {
      model: string
      output_config: { effort: string }
      thinking?: { type?: string }
    }
    expect(second.model).toBe('claude-opus-4-8')
    expect(second.output_config.effort).toBe('high')
    expect(second.thinking?.type).toBe('adaptive')
  })

  test('open page rides along as context and Insert appends to it', async ({ page }) => {
    await reset(page)
    await seed(page, 'pages/strategy', '# Strategy\n\nExisting body.', [])
    await connectViaStorage(page)
    const captured: unknown[] = []
    await mockAnthropic(page, 'A crisp new paragraph. ', captured)

    await page.goto('/#/pages/pages%2Fstrategy')
    // Pages is a full-bleed layout (no .stage) — wait for the editor body.
    await expect(page.getByText('Existing body').first()).toBeVisible({
      timeout: 10_000,
    })

    // Pages is full-bleed (no rail) — the floating pill is the way in there.
    await page.getByTestId('askai-fab').click()
    await expect(page.getByTestId('askai-context')).toContainText('Strategy')

    await page.getByTestId('askai-input').fill('Draft a paragraph')
    await page.getByTestId('askai-send').click()
    await expect(page.getByTestId('askai-insert')).toBeVisible({ timeout: 10_000 })

    // The open page's body was injected into the system prompt.
    const req = captured[0] as { system: string }
    expect(req.system).toContain('pages/strategy')
    expect(req.system).toContain('Existing body.')

    await page.getByTestId('askai-insert').click()

    // The OPEN editor re-syncs in place — no navigation needed (the glitch
    // Adam hit: insert saved to the vault but the mounted editor never
    // reloaded until you left Pages and came back).
    await expect(page.locator('.page-prose')).toContainText(
      'A crisp new paragraph.',
      { timeout: 10_000 },
    )

    // The vault note now ends with the inserted answer.
    await expect
      .poll(async () => {
        const res = await page.request.get(
          `${MOCK}/api/notes?id=${encodeURIComponent('pages/strategy')}`,
          { headers: AUTH },
        )
        const note = (await res.json()) as { content?: string }
        return note.content ?? ''
      })
      .toContain('A crisp new paragraph.')
  })
})

test('the /ai block shares the panel grounding: page context + Sonnet 5 + effort', async ({
  page,
}) => {
  await reset(page)
  await seed(page, 'pages/songcraft', '# Songcraft\n\nThe bridge needs lift.', [])
  await connectViaStorage(page)

  // /ai uses the non-streaming Messages shape — separate mock from the panel's SSE.
  const captured: unknown[] = []
  await page.route('https://api.anthropic.com/**', async (route) => {
    captured.push(route.request().postDataJSON())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{ type: 'text', text: 'A grounded drafting answer.' }],
      }),
    })
  })

  await page.goto('/#/pages/' + encodeURIComponent('pages/songcraft'))
  await expect(page.getByText('The bridge needs lift.')).toBeVisible({ timeout: 10_000 })

  // Insert the /ai block at the end of the doc and ask.
  await page.locator('.page-prose').click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/ai')
  await page.locator('.slash-item, .slash-menu button', { hasText: 'Ask AI' }).first().click()
  await page.locator('.ai-input').fill('Draft the next line')
  await page.keyboard.press('ControlOrMeta+Enter')

  // The answer lands in the page as plain paragraphs.
  await expect(page.locator('.page-prose')).toContainText('A grounded drafting answer.', {
    timeout: 10_000,
  })

  const req = captured[0] as {
    model: string
    system: string
    output_config: { effort: string }
  }
  expect(req.model).toBe('claude-sonnet-5')
  expect(req.output_config.effort).toBe('medium')
  expect(req.system).toContain('pages/songcraft')
  expect(req.system).toContain('The bridge needs lift.')
})
