// Ask AI — the summonable copilot panel (⌘J). Notion's Ask-AI move, the vault
// way: answers are grounded in client-side RAG over Adam's own notes plus the
// page he has open, streamed token-by-token, with one-click insert back into
// the page. Sonnet 5 default / Opus 4.8 toggle (decided 2026-07-12).
//
// The panel NEVER writes to the vault on its own — text only lands in a note
// when Adam clicks Insert (propose-don't-apply, as law).

import { useEffect, useRef, useState } from 'react'
import {
  announcePageUpdate,
  ASK_AI_ASK_EVENT,
  closeAskAi,
  openAskAi,
  useUi,
} from '../lib/ui'
import { useRoute } from '../lib/router'
import { saveContent, toast, useStore } from '../lib/store'
import { useEditorSettings, openPagesSettings } from '../lib/editorSettings'
import { renderMarkdown } from '../lib/markdown'
import { titleFromPath } from '../lib/format'
import {
  ASK_MODELS,
  AnthropicError,
  streamAsk,
  type AskModel,
  type AskTurn,
  type ToolStatus,
} from '../lib/anthropic'
import { IconClose, IconGem, IconSpark, IconSpiral } from './Icons'

interface PanelMsg {
  role: 'user' | 'assistant'
  text: string
  /** Still receiving deltas. */
  streaming?: boolean
  /** The research trail — one whisper row per tool call, kept in the
   * transcript above the answer they produced. */
  steps?: ToolStatus[]
}

/** Whisper copy for one tool call — quiet, one line, never competing. */
function stepLabel(s: ToolStatus): string {
  return s.kind === 'read' ? `📖 reading ${s.label}` : `🔍 searching "${s.label}"`
}

const MODEL_KEY = 'adamvaultos.askai.model'

export function AskAi() {
  const { askAiOpen } = useUi()
  const route = useRoute()
  const { notes } = useStore()
  const settings = useEditorSettings()

  const [msgs, setMsgs] = useState<PanelMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [model, setModel] = useState<AskModel>(() =>
    localStorage.getItem(MODEL_KEY) === 'opus' ? 'opus' : 'sonnet',
  )
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sendRef = useRef<(text?: string) => Promise<void>>(async () => {})

  // The page Adam has open right now (Pages view or a Library note).
  const pagePath =
    route.kind === 'pages' && route.path
      ? route.path
      : route.kind === 'note'
        ? route.path
        : null
  const pageNote = pagePath ? notes[pagePath] : null

  useEffect(() => {
    if (askAiOpen) inputRef.current?.focus()
  }, [askAiOpen])

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs])

  // Fresh thread every open — deterministic (previously it depended on which
  // layout you were in) and keeps re-sent history, i.e. cost, at zero between
  // sessions. Adam's call 2026-07-12.
  useEffect(() => {
    if (!askAiOpen) {
      setMsgs([])
      setInput('')
    }
  }, [askAiOpen])

  const pickModel = (m: AskModel) => {
    setModel(m)
    localStorage.setItem(MODEL_KEY, m)
  }

  const send = async (textOverride?: string) => {
    const prompt = (textOverride ?? input).trim()
    if (!prompt || busy) return
    if (!settings.anthropicKey) {
      toast('info', 'Add your Anthropic API key first (opens settings).')
      openPagesSettings()
      return
    }
    setInput('')
    setBusy(true)
    const history: AskTurn[] = msgs
      .filter((m) => !m.streaming && m.text)
      .map((m) => ({ role: m.role, content: m.text }))
    setMsgs((prev) => [
      ...prev,
      { role: 'user', text: prompt },
      { role: 'assistant', text: '', streaming: true },
    ])
    try {
      const full = await streamAsk(
        {
          prompt,
          apiKey: settings.anthropicKey,
          model,
          history,
          page: pageNote
            ? { path: pageNote.path, content: pageNote.content ?? '' }
            : null,
        },
        (delta) => {
          setMsgs((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last?.role === 'assistant' && last.streaming) {
              next[next.length - 1] = { ...last, text: last.text + delta }
            }
            return next
          })
        },
        (step) => {
          // Whisper a status row into the streaming message; the trail stays
          // in the transcript above the final answer.
          setMsgs((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last?.role === 'assistant' && last.streaming) {
              next[next.length - 1] = {
                ...last,
                steps: [...(last.steps ?? []), step],
              }
            }
            return next
          })
        },
      )
      setMsgs((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'assistant') {
          next[next.length - 1] = { role: 'assistant', text: full, steps: last.steps }
        }
        return next
      })
    } catch (e) {
      const msg =
        e instanceof AnthropicError ? e.message : 'Something went wrong.'
      setMsgs((prev) => {
        // Drop an empty streaming stub, but keep the question — and keep the
        // research trail if tools already ran before the failure.
        const next = prev
          .map((m) => (m.streaming ? { ...m, streaming: false } : m))
          .filter((m) => m.text || (m.steps?.length ?? 0) > 0)
        return [...next, { role: 'assistant', text: `⚠️ ${msg}` }]
      })
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const insertIntoPage = async (text: string) => {
    if (!pageNote) return
    try {
      const base = {
        updatedAt: pageNote.updatedAt,
        content: pageNote.content ?? '',
      }
      const body = base.content.trimEnd()
      const updated = await saveContent(
        pageNote.path,
        `${body ? `${body}\n\n` : ''}${text.trim()}\n`,
        base,
      )
      // Tell an open editor to re-sync in place (it won't clobber live edits).
      announcePageUpdate(updated.path, updated.content ?? '', updated.updatedAt)
      toast('success', `Added to ${titleFromPath(pageNote.path)}`)
    } catch {
      toast('error', 'Insert failed — the page changed underneath. Copy instead.')
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('success', 'Copied')
    } catch {
      toast('error', 'Copy failed')
    }
  }

  // The Omnibar's Ask-the-vault handoff: askAiAsk(query) opens the panel and
  // sends the query as one gesture. The listener lives for the component's
  // whole life (the fab keeps us mounted); the ref always points at the
  // freshest send closure.
  sendRef.current = send
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = (e as CustomEvent<{ query?: string }>).detail?.query
      if (typeof q === 'string' && q.trim()) void sendRef.current(q)
    }
    window.addEventListener(ASK_AI_ASK_EVENT, onAsk)
    return () => window.removeEventListener(ASK_AI_ASK_EVENT, onAsk)
  }, [])

  // Closed: a quiet spiral circle folded under the capture dock — same size,
  // same deep-brown/off-white palette, in every layout (incl. full-bleed
  // Pages/Graph, which have no rail). ⌘J works everywhere too.
  if (!askAiOpen) {
    return (
      <button
        className="askai-fab"
        data-testid="askai-fab"
        title="Ask AI (⌘J)"
        aria-label="Ask AI"
        onClick={openAskAi}
      >
        <IconSpiral size={17} />
      </button>
    )
  }

  return (
    <aside className="askai" data-testid="askai-panel">
      <div className="askai-head">
        <span className="askai-title">
          <IconSpark size={14} /> Ask AI
        </span>
        <div className="askai-models" data-testid="askai-models">
          {(Object.keys(ASK_MODELS) as AskModel[]).map((m) => (
            <button
              key={m}
              className={m === model ? 'is-on' : ''}
              data-testid={`askai-model-${m}`}
              title={ASK_MODELS[m].hint}
              onClick={() => pickModel(m)}
            >
              {ASK_MODELS[m].label}
            </button>
          ))}
        </div>
        <button
          className="askai-close"
          data-testid="askai-close"
          title="Close (Esc)"
          onClick={closeAskAi}
        >
          <IconClose size={12} />
        </button>
      </div>

      {pageNote && (
        <div className="askai-context" data-testid="askai-context">
          reading&nbsp;<strong>{titleFromPath(pageNote.path)}</strong>&nbsp;+ your vault
        </div>
      )}

      <div className="askai-thread" ref={threadRef} data-testid="askai-thread">
        {msgs.length === 0 && (
          <div className="askai-empty">
            Ask anything — answers are grounded in your vault
            {pageNote ? ' and the page you have open' : ''}.
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div className="askai-msg askai-user" key={i}>
              {m.text}
            </div>
          ) : (
            <div className="askai-msg askai-assistant" key={i}>
              {(m.steps?.length ?? 0) > 0 && (
                <div className="askai-steps" data-testid="askai-steps">
                  {m.steps!.map((s, j) => (
                    <div className="askai-step" data-testid="askai-step" key={j}>
                      {stepLabel(s)}
                    </div>
                  ))}
                </div>
              )}
              {m.text ? (
                <div
                  className="askai-prose"
                  // renderMarkdown output is DOMPurify-sanitized
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
                />
              ) : m.streaming ? (
                <div className="askai-thinking">
                  <IconGem size={18} className="gem-breathe" />
                </div>
              ) : null}
              {!m.streaming && m.text && !m.text.startsWith('⚠️') && (
                <div className="askai-actions">
                  <button onClick={() => copyText(m.text)}>Copy</button>
                  {pageNote && (
                    <button
                      data-testid="askai-insert"
                      onClick={() => insertIntoPage(m.text)}
                    >
                      Insert into page
                    </button>
                  )}
                </div>
              )}
            </div>
          ),
        )}
      </div>

      <div className="askai-inputrow">
        <textarea
          ref={inputRef}
          data-testid="askai-input"
          placeholder={busy ? 'Answering…' : 'Ask your vault…'}
          value={input}
          disabled={busy}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
            if (e.key === 'Escape') closeAskAi()
          }}
        />
        <button
          className="askai-send"
          data-testid="askai-send"
          disabled={busy || !input.trim()}
          onClick={() => void send()}
        >
          ↑
        </button>
      </div>
    </aside>
  )
}
