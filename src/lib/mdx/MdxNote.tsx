import {
  Component,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { evaluate } from '@mdx-js/mdx'
import type { MDXComponents } from 'mdx/types'
import { renderMarkdown } from '../markdown'
import { Term } from './Term'
import { Checklist } from './Checklist'
import { LayerStack } from './LayerStack'
import { LayerQuiz } from './LayerQuiz'
import { AskThePrimer } from './AskThePrimer'
import { ContextWindowMeter } from './ContextWindowMeter'
import { QuizMe } from './QuizMe'
import { ObjectionSim } from './ObjectionSim'
import { Mermaid, mermaidText } from './Mermaid'

// Runtime MDX rendering. The MDX comes from a REST fetch at page load, not
// from files in the repo, so it is compiled in the browser here — no
// build-time MDX pipeline. `evaluate` compiles the source to a component
// against the React JSX runtime.
//
// SECURITY: `evaluate` runs the source through `new Function` and will
// execute any `{expression}` embedded in the MDX. That is acceptable only
// because the content is the user's own authenticated vault. Do not point
// this renderer at untrusted third-party MDX.

/** Fenced-code override: a ```mermaid block renders as a diagram; every other
 * fenced block passes through to a normal <pre> untouched. This is what makes
 * plain ```mermaid fences "just work" in a note, alongside the <Mermaid> tag. */
function Pre(props: { children?: ReactNode }) {
  const child = props.children
  const className =
    child && typeof child === 'object' && 'props' in child
      ? (child as { props?: { className?: string } }).props?.className
      : undefined
  if (typeof className === 'string' && className.includes('language-mermaid')) {
    const code = (child as { props?: { children?: ReactNode } }).props?.children
    return <Mermaid chart={mermaidText(code)} />
  }
  return <pre {...props} />
}

// The component registry — the vocabulary a course note can draw on. Any
// capitalized tag not listed here degrades to plain text via the error
// boundary rather than crashing the note.
const COMPONENTS: MDXComponents = {
  Term,
  Checklist,
  LayerStack,
  LayerQuiz,
  AskThePrimer,
  ContextWindowMeter,
  QuizMe,
  ObjectionSim,
  Mermaid,
  pre: Pre,
}

type Compiled = ComponentType<{ components?: MDXComponents }>

/** Render the MDX source as plain markdown — the graceful fallback when
 * runtime compilation or rendering fails. Component tags collapse to their
 * text content, so a broken note still reads. */
function MarkdownFallback({ source }: { source: string }) {
  return (
    <div
      className="mdx-fallback"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  )
}

/** Catches errors thrown while *rendering* the compiled MDX (compile-time
 * errors are caught in the effect below) and falls back to markdown. */
class MdxErrorBoundary extends Component<
  { source: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) return <MarkdownFallback source={this.props.source} />
    return this.props.children
  }
}

export function MdxNote({ source }: { source: string }) {
  const [state, setState] = useState<{
    Content?: Compiled
    error?: boolean
  }>({})

  useEffect(() => {
    let cancelled = false
    setState({})
    evaluate(source, { ...jsxRuntime, baseUrl: import.meta.url })
      .then((mod) => {
        if (!cancelled) setState({ Content: mod.default as Compiled })
      })
      .catch(() => {
        if (!cancelled) setState({ error: true })
      })
    return () => {
      cancelled = true
    }
  }, [source])

  if (state.error) return <MarkdownFallback source={source} />
  if (!state.Content) return <div className="mdx-loading" aria-hidden />

  const Content = state.Content
  return (
    <MdxErrorBoundary source={source}>
      <Content components={COMPONENTS} />
    </MdxErrorBoundary>
  )
}
