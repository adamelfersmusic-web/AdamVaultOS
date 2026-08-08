import { useEffect, useRef, useState, type ReactNode } from 'react'

// Renders a Mermaid diagram from a text definition. Authored in MDX either as
// an explicit component:
//   <Mermaid chart="graph LR; A-->B" />
// or as a fenced ```mermaid block (wired via the `pre` override in MdxNote).
//
// Mermaid is heavy (pulls in d3 + dagre), so it is dynamically imported the
// first time a diagram mounts — it never lands in the app's main bundle.
// Invalid diagram syntax degrades to the raw definition in a <pre> rather than
// crashing the note.

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, text: string) => Promise<{ svg: string }>
}

let mermaidPromise: Promise<MermaidApi> | null = null

/** Load + initialise Mermaid once, lazily. Theme follows the OS/app colour
 * scheme so diagrams read in both light and dark. */
function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const mermaid = m.default as unknown as MermaidApi
      const dark =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: dark ? 'dark' : 'default',
        fontFamily: 'inherit',
      })
      return mermaid
    })
  }
  return mermaidPromise
}

// Module-local counter for unique render ids. (Math.random is intentionally
// avoided — a stable, monotonic id is all Mermaid needs.)
let renderSeq = 0

/**
 * Render every ```mermaid fence inside an already-rendered markdown container.
 *
 * The read view (NotePage, Canvas cards, Ask AI answers) builds its HTML with
 * renderMarkdown + dangerouslySetInnerHTML, so a fence lands as a plain
 * <pre><code class="language-mermaid">. There is no React tree to hang the
 * <Mermaid> component off, so this walks the container and swaps the <pre> for
 * the rendered SVG instead.
 *
 * 🔑 FREE WHEN THERE IS NOTHING TO DO: a container with no mermaid fence costs
 * one querySelectorAll that matches nothing — Mermaid itself (a ~114 kB gzip
 * lazy chunk) is never even requested. Only a note that actually holds a
 * diagram pays anything.
 *
 * Invalid syntax leaves the original <pre> untouched, which IS the fallback.
 */
export function useMermaidFences(
  ref: { current: HTMLElement | null },
  deps: unknown[],
) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    // Cheap probe first: on a note with no diagram this matches nothing and we
    // return before Mermaid is ever requested.
    if (root.querySelector('code.language-mermaid') === null) return

    let cancelled = false
    void loadMermaid().then(async (mermaid) => {
      // Re-query AFTER the await, never before it. The container is filled by
      // dangerouslySetInnerHTML, so any re-render between the probe above and
      // the module landing detaches the nodes a captured list would hold —
      // which showed up as diagrams silently never appearing at all.
      while (!cancelled) {
        const code = root.querySelector<HTMLElement>('code.language-mermaid')
        if (!code) return
        const pre = code.parentElement
        if (!pre || pre.tagName !== 'PRE') return
        const def = (code.textContent ?? '').trim()
        const holder = document.createElement('div')
        try {
          if (!def) throw new Error('empty definition')
          const { svg } = await mermaid.render(`md-mermaid-${renderSeq++}`, def)
          if (cancelled || !pre.isConnected) return
          holder.className = 'mdx-mermaid'
          holder.setAttribute('role', 'img')
          holder.setAttribute('aria-label', 'diagram')
          holder.innerHTML = svg
        } catch {
          // Bad syntax: keep the definition on screen as readable text. It has
          // to replace the <pre> either way — leaving it would re-match the
          // query above and spin this loop forever.
          if (cancelled || !pre.isConnected) return
          holder.className = 'mdx-mermaid-fallback'
          const codeEl = document.createElement('code')
          codeEl.textContent = def
          holder.appendChild(codeEl)
        }
        pre.replaceWith(holder)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

/** Flatten MDX children (strings, arrays, elements) down to their text — a
 * fenced code block arrives as nested nodes, not a bare string. */
export function mermaidText(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(mermaidText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return mermaidText((children as { props?: { children?: ReactNode } }).props?.children)
  }
  return ''
}

export function Mermaid({ chart, children }: { chart?: string; children?: ReactNode }) {
  const def = (chart ?? mermaidText(children)).trim()
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!def) return
    let cancelled = false
    setError(false)
    const id = `mdx-mermaid-${renderSeq++}`
    loadMermaid()
      .then((mermaid) => mermaid.render(id, def))
      .then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [def])

  if (!def) return null
  if (error) {
    return (
      <pre className="mdx-mermaid-fallback">
        <code>{def}</code>
      </pre>
    )
  }
  return <div className="mdx-mermaid" ref={ref} role="img" aria-label="diagram" />
}
