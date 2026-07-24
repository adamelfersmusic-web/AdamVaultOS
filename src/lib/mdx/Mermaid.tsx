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
