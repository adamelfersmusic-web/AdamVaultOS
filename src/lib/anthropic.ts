// Direct browser → Anthropic Messages API. Two consumers:
//   • the editor's /ai block (askVault — one-shot, non-streaming)
//   • the Ask AI panel (streamAsk — multi-turn, streaming, model toggle)
// Both ground answers with client-side RAG: before calling Claude we search
// the vault's REST API (the same authenticated session that powers Scripts
// and Graph) for relevant notes and inject them into the system prompt as
// context. No SDK and no MCP round-trip — a single fetch to api.anthropic.com
// with the user's own key, read from client-side settings at call time.

import { mostLinkedContext, searchVaultContext, toast } from './store'
import { titleFromPath } from './format'
import type { Note } from './types'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

// Ask AI model policy (decided with Adam 2026-07-12): Sonnet 5 default —
// near-Opus at vault Q&A, faster, cheaper — with Opus 4.8 one toggle away for
// the heaviest synthesis. Effort: medium on Sonnet for snappy answers, bumped
// to high automatically when the question reads vault-wide; always high on
// Opus (reaching for it means you want the deep pass).
export const ASK_MODELS = {
  sonnet: { id: 'claude-sonnet-5', label: 'Sonnet 5', hint: 'fast · default' },
  opus: { id: 'claude-opus-4-8', label: 'Opus 4.8', hint: 'deepest' },
} as const
export type AskModel = keyof typeof ASK_MODELS

const SYSTEM =
  "You are the Ask AI copilot inside AdamVaultOS — Adam Elfers' personal " +
  'vault. The notes most relevant to the question are provided below. Ground ' +
  'answers in those notes and cite the ones you drew from by path (e.g. ' +
  '"per atelier/00-home"). If the notes don\'t contain the answer, say so ' +
  'plainly, then answer from general knowledge only if clearly labeled as ' +
  'such. Be direct and concrete; lead with the answer. Markdown is fine.'

// The /ai editor block inserts prose INTO a page, so it stays plain-prose.
const SYSTEM_BLOCK =
  SYSTEM +
  ' For this request write clean plain prose only — no markdown formatting, ' +
  'no asterisks, no pound signs, no bullet dashes; natural paragraph breaks.'

// Retrieval tuning: a baseline of the most-linked hubs plus keyword matches.
const BASELINE_N = 20 // most-linked notes fetched on every query
const SEARCH_LIMIT = 50 // keyword search breadth
const TOP_N = 15 // max keyword matches added on top of the baseline
const MAX_BODY_CHARS = 1800
const MAX_PAGE_CHARS = 12000 // the open page gets far more room than RAG hits

export interface AskVaultInput {
  prompt: string
  apiKey: string
}

export class AnthropicError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AnthropicError'
  }
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'at', 'by', 'from', 'about', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'it', 'its', 'this', 'that', 'these', 'those', 'what', 'who', 'whom',
  'whose', 'which', 'when', 'where', 'why', 'how', 'do', 'does', 'did', 'can',
  'could', 'would', 'should', 'will', 'tell', 'me', 'my', 'our', 'us', 'i',
  'you', 'your', 'please', 'give', 'show', 'explain', 'into', 'over', 'than',
  'then', 'so', 'his', 'her', 'their', 'they', 'he', 'she',
])

/** Reduce a natural-language question to vault full-text search keywords. */
function keywords(prompt: string): string {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const w of prompt.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (w.length >= 2 && !STOPWORDS.has(w) && !seen.has(w)) {
      seen.add(w)
      terms.push(w)
    }
  }
  // Fall back to the raw prompt if stripping left nothing meaningful.
  return terms.length ? terms.join(' ') : prompt.trim()
}

/** Vault-wide questions get the deeper effort tier automatically. */
function looksBroad(prompt: string): boolean {
  return /\b(vault|across|all my|everything|overall|entire|big picture|domains?)\b/i.test(
    prompt,
  )
}

/** Render retrieved notes as a context block: title, path, tags, bounded body. */
function contextBlock(notes: Note[]): string {
  if (notes.length === 0) {
    return 'No relevant vault notes were found for this question.'
  }
  return notes
    .map((n) => {
      const nt = n.tags ?? []
      const tags = nt.length ? nt.join(', ') : '—'
      let body = (n.content ?? '').trim()
      if (body.length > MAX_BODY_CHARS) body = `${body.slice(0, MAX_BODY_CHARS)}…`
      return `## ${titleFromPath(n.path)}\nPath: ${n.path}\nTags: ${tags}\n\n${body}`
    })
    .join('\n\n---\n\n')
}

/** Client-side RAG: most-linked hubs as a baseline + keyword matches on top. */
async function retrieve(prompt: string): Promise<Note[]> {
  const [baseRes, kwRes] = await Promise.allSettled([
    mostLinkedContext(BASELINE_N),
    searchVaultContext(keywords(prompt), SEARCH_LIMIT),
  ])
  const baseline = baseRes.status === 'fulfilled' ? baseRes.value : []
  const matches = kwRes.status === 'fulfilled' ? kwRes.value : []

  // Keyword matches first (most query-relevant), then the baseline hubs;
  // dedupe by path and cap the keyword additions.
  const seen = new Set(baseline.map((n) => n.path))
  const extra = matches.filter((n) => !seen.has(n.path)).slice(0, TOP_N)

  if (baseRes.status === 'rejected') {
    console.warn('[ai] baseline (most-linked) retrieval failed:', baseRes.reason)
  }
  if (baseRes.status === 'rejected' && kwRes.status === 'rejected') {
    toast('info', 'Answered without vault context.')
  }
  return [...extra, ...baseline]
}

function parseError(data: unknown, res: Response): AnthropicError {
  const d = data as { error?: { message?: string }; message?: string } | null
  const msg = d?.error?.message || d?.message || `${res.status} ${res.statusText}`
  return new AnthropicError(msg)
}

async function requestMessages(
  apiKey: string,
  system: string,
  prompt: string,
): Promise<string> {
  let res: Response
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ASK_MODELS.sonnet.id,
        max_tokens: 1000,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
  } catch (e) {
    throw new AnthropicError(
      `Couldn't reach Anthropic — ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw parseError(data, res)

  // Assemble every `text` block from the response (ignore non-text blocks).
  const content = (data as { content?: unknown })?.content
  const blocks = Array.isArray(content) ? content : []
  const text = blocks
    .filter(
      (b): b is { type: string; text: string } =>
        !!b && b.type === 'text' && typeof b.text === 'string',
    )
    .map((b) => b.text)
    .join('\n\n')
    .trim()
  if (!text) throw new AnthropicError('The model returned no text answer.')
  return text
}

/** One-shot ask for the /ai editor block (plain prose, non-streaming). */
export async function askVault(input: AskVaultInput): Promise<string> {
  const { prompt, apiKey } = input
  if (!apiKey) throw new AnthropicError('No Anthropic API key set.')
  const notes = await retrieve(prompt)
  const system = `${SYSTEM_BLOCK}\n\n# Vault context\n\n${contextBlock(notes)}`
  return requestMessages(apiKey, system, prompt)
}

// ——— Ask AI panel: streaming, multi-turn, model toggle ————————————————————

export interface AskTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamAskInput {
  prompt: string
  apiKey: string
  model: AskModel
  /** Prior turns in this panel conversation (full history is re-sent). */
  history: AskTurn[]
  /** The page currently open in the app, injected as first-class context. */
  page?: { path: string; content: string } | null
}

export async function streamAsk(
  input: StreamAskInput,
  onDelta: (text: string) => void,
): Promise<string> {
  const { prompt, apiKey, model, history, page } = input
  if (!apiKey) throw new AnthropicError('No Anthropic API key set.')

  const notes = await retrieve(prompt)
  let system = `${SYSTEM}\n\n# Vault context\n\n${contextBlock(notes)}`
  if (page) {
    let body = page.content.trim()
    if (body.length > MAX_PAGE_CHARS) body = `${body.slice(0, MAX_PAGE_CHARS)}…`
    system += `\n\n# The page Adam has OPEN right now\n\nPath: ${page.path}\n\n${body}`
  }

  // Sonnet 5 runs adaptive thinking by default (omit the param); Opus 4.8
  // must opt in explicitly. Effort: medium for quick panel answers, high for
  // vault-wide questions and always on Opus.
  const effort = model === 'opus' || looksBroad(prompt) ? 'high' : 'medium'
  const body: Record<string, unknown> = {
    model: ASK_MODELS[model].id,
    max_tokens: 4096,
    stream: true,
    system,
    output_config: { effort },
    messages: [...history, { role: 'user', content: prompt }],
  }
  if (model === 'opus') body.thinking = { type: 'adaptive' }

  let res: Response
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new AnthropicError(
      `Couldn't reach Anthropic — ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  if (!res.ok) {
    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      /* non-JSON error body */
    }
    throw parseError(data, res)
  }
  if (!res.body) throw new AnthropicError('No response stream.')

  // Parse the SSE stream: accumulate `text_delta` payloads, ignore the rest
  // (thinking blocks stream with empty text at the default display setting).
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (!raw || raw === '[DONE]') continue
      try {
        const ev = JSON.parse(raw) as {
          type?: string
          delta?: { type?: string; text?: string }
          error?: { message?: string }
        }
        if (ev.type === 'error') {
          throw new AnthropicError(ev.error?.message ?? 'Stream error.')
        }
        if (
          ev.type === 'content_block_delta' &&
          ev.delta?.type === 'text_delta' &&
          typeof ev.delta.text === 'string'
        ) {
          full += ev.delta.text
          onDelta(ev.delta.text)
        }
      } catch (e) {
        if (e instanceof AnthropicError) throw e
        /* partial JSON split across chunks — the buffer logic prevents this,
           but a malformed keep-alive line is harmless to skip */
      }
    }
  }
  const text = full.trim()
  if (!text) throw new AnthropicError('The model returned no text answer.')
  return text
}
