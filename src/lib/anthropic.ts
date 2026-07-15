// Direct browser → Anthropic Messages API. Two consumers:
//   • the editor's /ai block (askVault — one-shot, non-streaming)
//   • the Ask AI panel (streamAsk — multi-turn, streaming, model toggle)
// Both ground answers with client-side RAG AND — v2 — an agentic tool loop:
// the model can call `search_vault` (the app's ONE relevance engine, the same
// parseQuery + rankNotes brain behind ⌘K) and `read_note` mid-conversation to
// fetch what the pre-stuffed context missed. Tool calls are executed
// client-side and fed back as tool_result blocks, up to a hard cap of five
// round-trips; then a final answer is forced with tool_choice: none. If the
// very first tools request fails outright, we degrade to the v1 single-shot
// path — Ask AI never gets worse than it was. No SDK and no MCP round-trip —
// plain fetches to api.anthropic.com with the user's own key, read from
// client-side settings at call time.

import { fetchNote, mostLinkedContext, searchVaultContext, toast } from './store'
import { cachedCorpus, corpusFresh, refreshCorpus } from './corpus'
import {
  hasFreeText,
  noteMatchesFilters,
  parseQuery,
  rankNotes,
  snippetFor,
} from './search'
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

// v2: the copilot has hands. The pre-stuffed context shrinks to a starter and
// the model fetches the rest itself with the two vault tools.
const SYSTEM_TOOLS_ADDON =
  '\n\nYou can research the vault yourself with two tools. search_vault runs ' +
  "the app's own search: bare words are ANDed and ranked across title, path, " +
  'tags, and body; operators narrow it — tag:x, path:prefix/, title:word, ' +
  '"exact phrase". read_note fetches one note\'s full body by path. The ' +
  "context below is only a starter — when it doesn't cover the question, " +
  'search, then read the most promising paths before answering. A few ' +
  'focused calls beat many broad ones.'

// Retrieval tuning: a baseline of the most-linked hubs plus keyword matches.
const BASELINE_N = 20 // most-linked notes fetched on every query (v1 fallback)
const SEARCH_LIMIT = 50 // keyword search breadth
const TOP_N = 15 // max keyword matches added on top of the baseline (v1)
const LEAN_TOP_N = 5 // v2 starter context: just the best keyword hits
const MAX_BODY_CHARS = 1800
const MAX_PAGE_CHARS = 12000 // the open page gets far more room than RAG hits

// Tool-loop tuning.
const MAX_TOOL_ROUNDS = 5 // hard cap on tool round-trips per question
const TOOL_SEARCH_LIMIT = 8 // search_vault returns the top handful
const READ_NOTE_MAX_CHARS = 6000 // read_note caps bodies so one giant note
// can't blow the context

export interface AskVaultInput {
  prompt: string
  apiKey: string
  /** The page the /ai block lives in — first-class context, like the panel. */
  page?: { path: string; content: string } | null
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

/** The open page rendered for the system prompt, body bounded. */
function pageBlock(page: { path: string; content: string }, heading: string): string {
  let body = page.content.trim()
  if (body.length > MAX_PAGE_CHARS) body = `${body.slice(0, MAX_PAGE_CHARS)}…`
  return `\n\n# ${heading}\n\nPath: ${page.path}\n\n${body}`
}

/** v1 client-side RAG: most-linked hubs as a baseline + keyword matches. */
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

/** v2 starter context: just the best keyword hits — the model tools its own
 * way to the rest, so the baseline hub dump stays out of the prompt. */
async function retrieveLean(prompt: string): Promise<Note[]> {
  const matches = await searchVaultContext(keywords(prompt), SEARCH_LIMIT)
  return matches.slice(0, LEAN_TOP_N)
}

function parseError(data: unknown, res: Response): AnthropicError {
  const d = data as { error?: { message?: string }; message?: string } | null
  const msg = d?.error?.message || d?.message || `${res.status} ${res.statusText}`
  return new AnthropicError(msg)
}

// ——— The two vault tools ————————————————————————————————————————————————

export interface ToolStatus {
  kind: 'search' | 'read'
  /** The query searched or the path read — the whisper row's payload. */
  label: string
}

const VAULT_TOOLS = [
  {
    name: 'search_vault',
    description:
      "Search Adam's vault with the app's own relevance engine (the same one " +
      'behind ⌘K). Bare words are ANDed and ranked across title, path, tags, ' +
      'and body. Operators compose with free text: tag:x (hierarchical), ' +
      'path:prefix/, title:word, "exact phrase". Returns the top matches as ' +
      '{path, title, snippet, updatedAt}. Use read_note to fetch a full body.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query — keywords and/or operators.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_note',
    description:
      "Fetch one vault note's full content by its exact path (as returned by " +
      'search_vault, e.g. "atelier/00-home"). Very long notes are truncated ' +
      'and flagged with truncated: true plus the total length.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Exact vault path of the note.' },
      },
      required: ['path'],
    },
  },
]

/** Display title — the note's first heading, else the de-slugged path (the
 * Omnibar's own rule, so tool results name notes the way the app does). */
function toolNoteTitle(n: Note): string {
  const m = (n.content ?? '').match(/^\s{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/m)
  if (m?.[1]) {
    const t = m[1].replace(/[*_`#]+/g, '').trim()
    if (t) return t
  }
  return titleFromPath(n.path)
}

/** search_vault — the Omnibar's exact pipeline (parseQuery → filters →
 * rankNotes) over the shared corpus cache. NOT a second ranking fork. */
async function execSearchVault(query: string): Promise<string> {
  let corpus = corpusFresh() ? cachedCorpus() : null
  if (!corpus) {
    corpus = await refreshCorpus().catch(() => cachedCorpus())
  }
  if (!corpus) throw new Error('the vault index is unreachable right now')

  const parsed = parseQuery(query)
  const rankQ = [...parsed.terms, ...parsed.phrases].join(' ')
  const pool = corpus.filter((n) => noteMatchesFilters(n, parsed, toolNoteTitle))
  const ranked = hasFreeText(parsed)
    ? rankNotes(rankQ, pool, toolNoteTitle)
    : [...pool].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))

  const markTerms = [...parsed.terms, ...parsed.phrases]
  const results = ranked.slice(0, TOOL_SEARCH_LIMIT).map((n) => ({
    path: n.path,
    title: toolNoteTitle(n),
    snippet: snippetFor(n.content, markTerms),
    updatedAt: n.updatedAt,
  }))
  return JSON.stringify({ query, totalMatches: ranked.length, results })
}

/** read_note — the store's own note fetch, body capped so a giant note can't
 * blow the context. Not-found comes back as a recoverable error string. */
async function execReadNote(
  path: string,
): Promise<{ content: string; isError: boolean }> {
  const note = await fetchNote(path)
  if (!note) {
    return {
      content: `No note found at path "${path}". Use search_vault to find the right path.`,
      isError: true,
    }
  }
  const full = (note.content ?? '').trim()
  const truncated = full.length > READ_NOTE_MAX_CHARS
  return {
    content: JSON.stringify({
      path: note.path,
      title: toolNoteTitle(note),
      content: truncated ? full.slice(0, READ_NOTE_MAX_CHARS) : full,
      truncated,
      totalChars: full.length,
    }),
    isError: false,
  }
}

/** Execute one tool call. NEVER throws — every failure (bad input, missing
 * note, network) returns an error string the model can recover from. */
async function runTool(
  name: string,
  input: unknown,
): Promise<{ content: string; isError: boolean }> {
  try {
    const args = (input ?? {}) as Record<string, unknown>
    if (name === 'search_vault') {
      const query = String(args['query'] ?? '').trim()
      if (!query) {
        return { content: 'search_vault needs a non-empty query.', isError: true }
      }
      return { content: await execSearchVault(query), isError: false }
    }
    if (name === 'read_note') {
      const path = String(args['path'] ?? '').trim()
      if (!path) return { content: 'read_note needs a note path.', isError: true }
      return await execReadNote(path)
    }
    return { content: `Unknown tool: ${name}`, isError: true }
  } catch (e) {
    return {
      content: `Tool failed — ${e instanceof Error ? e.message : String(e)}`,
      isError: true,
    }
  }
}

// ——— Messages plumbing: one hop = one API call ————————————————————————————

/** A content block as the wire gives it to us — replayed verbatim on the next
 * hop (tool_use ids, thinking signatures and all), never reshaped. */
type WireBlock = Record<string, unknown> & { type: string }

interface HopResult {
  blocks: WireBlock[]
  stopReason: string | null
}

interface ToolUseBlock extends WireBlock {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

function isToolUse(b: WireBlock): b is ToolUseBlock {
  return b.type === 'tool_use' && typeof b['id'] === 'string' && typeof b['name'] === 'string'
}

/** Every `text` block joined — the human-readable side of a hop. */
function textOf(blocks: WireBlock[]): string {
  return blocks
    .filter((b): b is WireBlock & { text: string } => b.type === 'text' && typeof b['text'] === 'string')
    .map((b) => b.text)
    .join('\n\n')
    .trim()
}

function statusFor(tu: ToolUseBlock): ToolStatus {
  const args = (tu.input ?? {}) as Record<string, unknown>
  return tu.name === 'read_note'
    ? { kind: 'read', label: String(args['path'] ?? '') }
    : { kind: 'search', label: String(args['query'] ?? '') }
}

async function postMessages(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Response> {
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
  return res
}

interface SseEvent {
  type?: string
  index?: number
  content_block?: WireBlock
  delta?: {
    type?: string
    text?: string
    partial_json?: string
    thinking?: string
    signature?: string
    stop_reason?: string
  }
  error?: { message?: string }
}

/** One non-streaming Messages call → the full block list + stop reason. */
async function requestHop(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<HopResult> {
  const res = await postMessages(apiKey, body)
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    throw new AnthropicError('Malformed response from Anthropic.')
  }
  const d = data as { content?: unknown; stop_reason?: unknown }
  const blocks = (Array.isArray(d.content) ? d.content : []).filter(
    (b): b is WireBlock => !!b && typeof (b as { type?: unknown }).type === 'string',
  )
  return {
    blocks,
    stopReason: typeof d.stop_reason === 'string' ? d.stop_reason : null,
  }
}

/** One streaming Messages call: text deltas go to `onDelta` as they arrive;
 * ALL blocks (text, tool_use with assembled input, thinking with signature)
 * are reconstructed so the loop can replay the assistant turn verbatim. */
async function streamHop(
  apiKey: string,
  body: Record<string, unknown>,
  onDelta: (text: string) => void,
): Promise<HopResult> {
  const res = await postMessages(apiKey, body)
  if (!res.body) throw new AnthropicError('No response stream.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const blocks: WireBlock[] = []
  const partialJson = new Map<number, string>()
  let stopReason: string | null = null
  let buffer = ''
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
      let ev: SseEvent
      try {
        ev = JSON.parse(raw) as SseEvent
      } catch {
        continue /* malformed keep-alive line — harmless to skip */
      }
      if (ev.type === 'error') {
        throw new AnthropicError(ev.error?.message ?? 'Stream error.')
      }
      if (ev.type === 'content_block_start' && typeof ev.index === 'number' && ev.content_block) {
        blocks[ev.index] = { ...ev.content_block }
        if (ev.content_block.type === 'tool_use') partialJson.set(ev.index, '')
        continue
      }
      if (ev.type === 'content_block_delta' && typeof ev.index === 'number' && ev.delta) {
        const block = blocks[ev.index]
        const d = ev.delta
        if (d.type === 'text_delta' && typeof d.text === 'string') {
          if (block) block['text'] = `${String(block['text'] ?? '')}${d.text}`
          onDelta(d.text)
        } else if (d.type === 'input_json_delta' && typeof d.partial_json === 'string') {
          partialJson.set(ev.index, (partialJson.get(ev.index) ?? '') + d.partial_json)
        } else if (d.type === 'thinking_delta' && typeof d.thinking === 'string' && block) {
          block['thinking'] = `${String(block['thinking'] ?? '')}${d.thinking}`
        } else if (d.type === 'signature_delta' && typeof d.signature === 'string' && block) {
          block['signature'] = d.signature
        }
        continue
      }
      if (ev.type === 'content_block_stop' && typeof ev.index === 'number') {
        const block = blocks[ev.index]
        const partial = partialJson.get(ev.index)
        if (block?.type === 'tool_use' && partial) {
          try {
            block['input'] = JSON.parse(partial) as unknown
          } catch {
            /* keep the start-event input — runTool reports bad args */
          }
        }
        continue
      }
      if (ev.type === 'message_delta' && typeof ev.delta?.stop_reason === 'string') {
        stopReason = ev.delta.stop_reason
      }
    }
  }
  return { blocks: blocks.filter(Boolean), stopReason }
}

// ——— The agentic loop ———————————————————————————————————————————————————

/** Drive tool_use → execute → tool_result → call again, up to MAX_TOOL_ROUNDS
 * executions; then one last hop with tool_choice: none forces a final answer.
 * Mixed text+tool_use hops keep their text (it streams as narration and joins
 * `allText`); `finalText` is just the last hop, for prose-only consumers. */
async function runToolLoop(
  baseBody: Record<string, unknown>,
  messages: unknown[],
  hop: (body: Record<string, unknown>) => Promise<HopResult>,
  onTool?: (status: ToolStatus) => void,
): Promise<{ allText: string; finalText: string }> {
  const texts: string[] = []
  for (let rounds = 0; ; ) {
    const forced = rounds >= MAX_TOOL_ROUNDS
    const { blocks } = await hop({
      ...baseBody,
      messages: [...messages],
      tools: VAULT_TOOLS,
      ...(forced ? { tool_choice: { type: 'none' } } : {}),
    })
    const hopText = textOf(blocks)
    if (hopText) texts.push(hopText)
    const toolUses = blocks.filter(isToolUse)
    if (forced || toolUses.length === 0) {
      return { allText: texts.join('\n\n').trim(), finalText: hopText }
    }
    rounds++
    // Replay the assistant turn verbatim (tool_use ids, thinking blocks and
    // signatures included), then answer EVERY tool call in one user turn.
    messages.push({ role: 'assistant', content: blocks })
    const results: unknown[] = []
    for (const tu of toolUses) {
      onTool?.(statusFor(tu))
      const r = await runTool(tu.name, tu.input)
      results.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: r.content,
        ...(r.isError ? { is_error: true } : {}),
      })
    }
    messages.push({ role: 'user', content: results })
  }
}

/** One-shot ask for the /ai editor block (plain prose, non-streaming).
 * Same grounding as the panel — starter RAG + the page the block lives in —
 * on one model (Sonnet 5), with the same broad-question effort bump, and the
 * same tool loop (sans whisper rows; the block only shows its monogram). */
export async function askVault(input: AskVaultInput): Promise<string> {
  const { prompt, apiKey, page } = input
  if (!apiKey) throw new AnthropicError('No Anthropic API key set.')

  let notes: Note[] = []
  try {
    notes = await retrieveLean(prompt)
  } catch {
    /* the model can search for itself */
  }
  let system = `${SYSTEM_BLOCK}${SYSTEM_TOOLS_ADDON}\n\n# Vault context (starter)\n\n${contextBlock(notes)}`
  if (page) system += pageBlock(page, 'The page this question was asked INSIDE')

  const baseBody: Record<string, unknown> = {
    model: ASK_MODELS.sonnet.id,
    max_tokens: 2000,
    system,
    output_config: { effort: looksBroad(prompt) ? 'high' : 'medium' },
  }

  let hops = 0
  try {
    const { allText, finalText } = await runToolLoop(
      baseBody,
      [{ role: 'user', content: prompt }],
      (body) => {
        hops++
        return requestHop(apiKey, body)
      },
    )
    // The block inserts prose into a page — prefer the final hop's clean
    // answer over any mid-research narration.
    const text = finalText || allText
    if (!text) throw new AnthropicError('The model returned no text answer.')
    return text
  } catch (e) {
    // v1 fallback: only when the FIRST tools request failed outright —
    // the /ai block must never get worse than the single-shot it replaced.
    if (hops > 1) throw e
    return askVaultV1(input)
  }
}

/** The v1 single-shot /ai block path — full pre-stuffed RAG, no tools. */
async function askVaultV1(input: AskVaultInput): Promise<string> {
  const { prompt, apiKey, page } = input
  const notes = await retrieve(prompt)
  let system = `${SYSTEM_BLOCK}\n\n# Vault context\n\n${contextBlock(notes)}`
  if (page) system += pageBlock(page, 'The page this question was asked INSIDE')
  const { blocks } = await requestHop(apiKey, {
    model: ASK_MODELS.sonnet.id,
    max_tokens: 2000,
    system,
    output_config: { effort: looksBroad(prompt) ? 'high' : 'medium' },
    messages: [{ role: 'user', content: prompt }],
  })
  const text = textOf(blocks)
  if (!text) throw new AnthropicError('The model returned no text answer.')
  return text
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
  onTool?: (status: ToolStatus) => void,
): Promise<string> {
  const { prompt, apiKey, model, history, page } = input
  if (!apiKey) throw new AnthropicError('No Anthropic API key set.')

  // v2 slimmer upfront context: the open page + a handful of top keyword
  // hits. A failed pre-fetch is no longer fatal — the model has tools.
  let notes: Note[] = []
  try {
    notes = await retrieveLean(prompt)
  } catch {
    /* the model can search for itself */
  }
  let system = `${SYSTEM}${SYSTEM_TOOLS_ADDON}\n\n# Vault context (starter)\n\n${contextBlock(notes)}`
  if (page) system += pageBlock(page, 'The page Adam has OPEN right now')

  // Sonnet 5 runs adaptive thinking by default (omit the param); Opus 4.8
  // must opt in explicitly. Effort: medium for quick panel answers, high for
  // vault-wide questions and always on Opus.
  const effort = model === 'opus' || looksBroad(prompt) ? 'high' : 'medium'
  const baseBody: Record<string, unknown> = {
    model: ASK_MODELS[model].id,
    max_tokens: 4096,
    stream: true,
    system,
    output_config: { effort },
  }
  if (model === 'opus') baseBody.thinking = { type: 'adaptive' }

  let hops = 0
  let emitted = false
  try {
    const { allText } = await runToolLoop(
      baseBody,
      [...history, { role: 'user', content: prompt }],
      (body) => {
        hops++
        return streamHop(apiKey, body, (text) => {
          emitted = true
          onDelta(text)
        })
      },
      onTool,
    )
    if (!allText) throw new AnthropicError('The model returned no text answer.')
    return allText
  } catch (e) {
    // v1 fallback: only when the FIRST tools request died with nothing shown
    // and no tool run — Ask AI must never get worse than single-shot was.
    if (hops > 1 || emitted) throw e
    return streamAskV1(input, onDelta)
  }
}

/** The v1 single-shot streaming path — full pre-stuffed RAG, no tools. */
async function streamAskV1(
  input: StreamAskInput,
  onDelta: (text: string) => void,
): Promise<string> {
  const { prompt, apiKey, model, history, page } = input
  const notes = await retrieve(prompt)
  let system = `${SYSTEM}\n\n# Vault context\n\n${contextBlock(notes)}`
  if (page) system += pageBlock(page, 'The page Adam has OPEN right now')

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

  const { blocks } = await streamHop(apiKey, body, onDelta)
  const text = textOf(blocks)
  if (!text) throw new AnthropicError('The model returned no text answer.')
  return text
}
