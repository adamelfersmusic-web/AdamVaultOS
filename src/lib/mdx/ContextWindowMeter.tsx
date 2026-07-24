import { useMemo, useState } from 'react'

// <ContextWindowMeter size={40} /> — type text and watch a context window
// fill, then watch the OLDEST tokens fall out of view as it overflows. Module
// 3's hardest idea (a context window is finite, short-term, and rolling)
// taught by feel. Pure client-side — no API calls, nothing to spend.
//
// Token counts are a teaching approximation (~4 characters per token), not a
// real BPE tokenizer — enough to make the concept physical.

interface Tok {
  text: string
  n: number // approx tokens this word costs
}

function tokenize(text: string): Tok[] {
  const words = text.split(/(\s+)/).filter((w) => w.length > 0)
  return words.map((w) => ({
    text: w,
    n: /^\s+$/.test(w) ? 0 : Math.max(1, Math.ceil(w.replace(/\s+/g, '').length / 4)),
  }))
}

const SAMPLE =
  'A context window is the model’s short-term working memory for one conversation. Everything you type, plus everything it has said back, has to fit inside it. When the window fills up, the oldest tokens quietly fall out of view — the model simply can’t see them anymore. That is why a long chat starts to forget how it began.'

export function ContextWindowMeter({ size = 40 }: { size?: number }) {
  const budget = Math.max(4, Math.floor(size))
  const [text, setText] = useState(SAMPLE)

  const { toks, total, cutoffIndex } = useMemo(() => {
    const toks = tokenize(text)
    const total = toks.reduce((s, t) => s + t.n, 0)
    // A rolling window keeps the MOST RECENT `budget` tokens. Walk from the end;
    // everything before the point where the running total exceeds budget has
    // fallen out of view.
    let running = 0
    let cutoffIndex = 0 // first in-window token index
    for (let i = toks.length - 1; i >= 0; i--) {
      running += toks[i].n
      if (running > budget) {
        cutoffIndex = i + 1
        break
      }
    }
    return { toks, total, cutoffIndex }
  }, [text, budget])

  const used = Math.min(total, budget)
  const pct = Math.round((used / budget) * 100)
  const over = total > budget
  const droppedTokens = toks
    .slice(0, cutoffIndex)
    .reduce((s, t) => s + t.n, 0)

  const state = over ? 'over' : pct > 75 ? 'high' : 'ok'

  return (
    <div className="mdx-cwm">
      <div className="mdx-cwm-head">
        <span className="mdx-cwm-count" data-state={state}>
          {Math.min(total, budget)} / {budget} tokens
        </span>
        <span className="mdx-cwm-bar" aria-hidden>
          <span className={`mdx-cwm-fill is-${state}`} style={{ width: `${pct}%` }} />
        </span>
        <span className="mdx-cwm-note">
          {over
            ? `over by ${total - budget} — ${droppedTokens} fell out`
            : `${budget - total} to spare`}
        </span>
      </div>

      <div className="mdx-cwm-stream" role="img" aria-label="context window contents">
        {toks.map((t, i) =>
          /^\s+$/.test(t.text) ? (
            <span key={i}> </span>
          ) : (
            <span key={i} className={`mdx-cwm-tok${i < cutoffIndex ? ' is-dropped' : ''}`}>
              {t.text}
            </span>
          ),
        )}
      </div>
      {over && (
        <div className="mdx-cwm-legend">
          <span className="mdx-cwm-swatch is-dropped" /> fell out of the window
          <span className="mdx-cwm-swatch" /> still in view
        </div>
      )}

      <textarea
        className="mdx-cwm-input"
        value={text}
        rows={3}
        spellCheck={false}
        placeholder="Type or paste text and watch the window fill…"
        onChange={(e) => setText(e.target.value)}
        aria-label="Context window input"
      />
    </div>
  )
}
