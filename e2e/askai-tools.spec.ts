// ASK AI v2 — the copilot gets hands. The agentic tool loop: the model calls
// search_vault (the Omnibar's own relevance engine) and read_note mid-answer,
// the app executes them client-side against the seeded vault, and the panel
// whispers the research trail (🔍 searching / 📖 reading) above the answer.
// The Anthropic API is mocked with playwright route interception (SSE bytes),
// scripted per-call so one conversation can walk tool_use → tool_result →
// final text without a real key.

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

/** A plain streamed text answer (the shape the v1 spec's mock emits). */
function sseText(answer: string): string {
  return sse([
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
}

/** A streamed tool_use turn — input arrives via input_json_delta, like the
 * real wire. Optional leading text exercises mixed text+tool_use hops. */
function sseToolUse(
  id: string,
  name: string,
  input: Record<string, unknown>,
  leadText?: string,
): string {
  const events: unknown[] = [{ type: 'message_start', message: { id: 'msg_test' } }]
  let index = 0
  if (leadText) {
    events.push(
      { type: 'content_block_start', index, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index, delta: { type: 'text_delta', text: leadText } },
      { type: 'content_block_stop', index },
    )
    index++
  }
  events.push(
    { type: 'content_block_start', index, content_block: { type: 'tool_use', id, name, input: {} } },
    {
      type: 'content_block_delta',
      index,
      delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) },
    },
    { type: 'content_block_stop', index },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  )
  return sse(events)
}

interface CapturedReq {
  model: string
  system: string
  tools?: Array<{ name: string }>
  tool_choice?: { type?: string }
  messages: Array<{ role: string; content: unknown }>
}

type ToolResult = { type: string; tool_use_id: string; content: string; is_error?: boolean }

/** The tool_result blocks of a request's last (user) message. */
function lastToolResults(req: CapturedReq): ToolResult[] {
  const last = req.messages[req.messages.length - 1]!
  expect(last.role).toBe('user')
  return last.content as ToolResult[]
}

test.describe('Ask AI v2 — agentic tool loop', () => {
  test('search_vault → read_note → answer, with whisper trail', async ({ page }) => {
    await reset(page)
    await seed(page, 'atelier/00-home', '# Atelier\n\nThe agency front door.', ['atelier'])
    await seed(
      page,
      'atelier/booking',
      '# Booking\n\nThe day rate is 1200 and travel rides on top.',
      ['atelier'],
    )
    await connectViaStorage(page)

    const captured: CapturedReq[] = []
    await page.route('https://api.anthropic.com/**', async (route) => {
      captured.push(route.request().postDataJSON() as CapturedReq)
      const n = captured.length
      const body =
        n === 1
          ? sseToolUse('tu_1', 'search_vault', { query: 'booking rate' }, 'Let me look. ')
          : n === 2
            ? sseToolUse('tu_2', 'read_note', { path: 'atelier/booking' })
            : sseText('The day rate is 1200, per atelier/booking. ')
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body })
    })

    await page.goto('/#/projects')
    await page.getByTestId('askai-open').click()
    await expect(page.getByTestId('askai-panel')).toBeVisible()
    await page.getByTestId('askai-input').fill('What is the booking day rate?')
    await page.getByTestId('askai-send').click()

    // The final answer streams in…
    await expect(page.getByTestId('askai-thread')).toContainText(
      'The day rate is 1200, per atelier/booking.',
      { timeout: 10_000 },
    )
    // …and the whisper trail persists above it, small and dim.
    const steps = page.getByTestId('askai-step')
    await expect(steps).toHaveCount(2)
    await expect(steps.nth(0)).toHaveText('🔍 searching "booking rate"')
    await expect(steps.nth(1)).toHaveText('📖 reading atelier/booking')

    // Three round-trips: tools rode on each, and the loop echoed results.
    expect(captured.length).toBe(3)
    expect(captured[0]!.tools?.map((t) => t.name)).toEqual(['search_vault', 'read_note'])

    // Hop 2 carries the search_vault result — ranked against the SEEDED
    // vault by the house engine, so atelier/booking leads the results.
    const searchResults = lastToolResults(captured[1]!)
    expect(searchResults[0]!.type).toBe('tool_result')
    expect(searchResults[0]!.tool_use_id).toBe('tu_1')
    expect(searchResults[0]!.is_error).toBeUndefined()
    const parsed = JSON.parse(searchResults[0]!.content) as {
      results: Array<{ path: string; title: string; snippet: string | null; updatedAt: string }>
    }
    expect(parsed.results[0]!.path).toBe('atelier/booking')
    expect(parsed.results[0]!.title).toBe('Booking')
    expect(parsed.results[0]!.snippet).toContain('day rate is 1200')

    // Hop 3 carries the read_note result with the full seeded body.
    const readResults = lastToolResults(captured[2]!)
    expect(readResults[0]!.tool_use_id).toBe('tu_2')
    const note = JSON.parse(readResults[0]!.content) as {
      path: string
      content: string
      truncated: boolean
      totalChars: number
    }
    expect(note.path).toBe('atelier/booking')
    expect(note.content).toContain('travel rides on top')
    expect(note.truncated).toBe(false)

    // The mixed text+tool_use hop's narration streamed into the answer too.
    await expect(page.getByTestId('askai-thread')).toContainText('Let me look.')
  })

  test('hop cap: the loop stops at 5 round-trips and forces a final answer', async ({
    page,
  }) => {
    await reset(page)
    await seed(page, 'atelier/00-home', '# Atelier', ['atelier'])
    await connectViaStorage(page)

    const captured: CapturedReq[] = []
    await page.route('https://api.anthropic.com/**', async (route) => {
      const req = route.request().postDataJSON() as CapturedReq
      captured.push(req)
      // Keep asking for tools forever; only tool_choice: none gets an answer.
      const body =
        req.tool_choice?.type === 'none'
          ? sseText('Forced final answer after the cap. ')
          : sseToolUse(`tu_${captured.length}`, 'search_vault', {
              query: `probe ${captured.length}`,
            })
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body })
    })

    await page.goto('/#/projects')
    await page.getByTestId('askai-open').click()
    await page.getByTestId('askai-input').fill('Chase your tail')
    await page.getByTestId('askai-send').click()

    await expect(page.getByTestId('askai-thread')).toContainText(
      'Forced final answer after the cap.',
      { timeout: 15_000 },
    )
    // 5 tool round-trips executed (one whisper each), then the forced hop.
    await expect(page.getByTestId('askai-step')).toHaveCount(5)
    expect(captured.length).toBe(6)
    for (const req of captured.slice(0, 5)) expect(req.tool_choice).toBeUndefined()
    expect(captured[5]!.tool_choice?.type).toBe('none')
  })

  test('read_note on a missing path returns an error tool_result; the model recovers', async ({
    page,
  }) => {
    await reset(page)
    await seed(page, 'atelier/00-home', '# Atelier', ['atelier'])
    await connectViaStorage(page)

    const captured: CapturedReq[] = []
    await page.route('https://api.anthropic.com/**', async (route) => {
      captured.push(route.request().postDataJSON() as CapturedReq)
      const body =
        captured.length === 1
          ? sseToolUse('tu_1', 'read_note', { path: 'missing/nowhere' })
          : sseText("There's no such note in the vault. ")
      await route.fulfill({ status: 200, contentType: 'text/event-stream', body })
    })

    await page.goto('/#/projects')
    await page.getByTestId('askai-open').click()
    await page.getByTestId('askai-input').fill('Read missing/nowhere for me')
    await page.getByTestId('askai-send').click()

    // The model's recovery answer renders — no crash, no ⚠️ row.
    await expect(page.getByTestId('askai-thread')).toContainText(
      "There's no such note in the vault.",
      { timeout: 10_000 },
    )
    await expect(page.getByTestId('askai-thread')).not.toContainText('⚠️')
    await expect(page.getByTestId('askai-step')).toHaveText(['📖 reading missing/nowhere'])

    // The failure went back as an is_error tool_result, not a thrown error.
    const results = lastToolResults(captured[1]!)
    expect(results[0]!.tool_use_id).toBe('tu_1')
    expect(results[0]!.is_error).toBe(true)
    expect(results[0]!.content).toContain('missing/nowhere')
    expect(results[0]!.content).toContain('search_vault')
  })

  test('hard error on the first tools request degrades to the v1 single-shot path', async ({
    page,
  }) => {
    await reset(page)
    await seed(page, 'atelier/00-home', '# Atelier\n\nThe agency front door.', ['atelier'])
    await connectViaStorage(page)

    const captured: CapturedReq[] = []
    await page.route('https://api.anthropic.com/**', async (route) => {
      captured.push(route.request().postDataJSON() as CapturedReq)
      if (captured.length === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'temporary blip' } }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: sseText('Single-shot fallback answer. '),
      })
    })

    await page.goto('/#/projects')
    await page.getByTestId('askai-open').click()
    await page.getByTestId('askai-input').fill('What is the atelier?')
    await page.getByTestId('askai-send').click()

    await expect(page.getByTestId('askai-thread')).toContainText(
      'Single-shot fallback answer.',
      { timeout: 10_000 },
    )
    // First request carried tools (v2); the retry was the v1 shape — no
    // tools, full pre-stuffed context.
    expect(captured.length).toBe(2)
    expect(captured[0]!.tools).toBeDefined()
    expect(captured[1]!.tools).toBeUndefined()
    expect(captured[1]!.system).toContain('# Vault context')
  })
})
