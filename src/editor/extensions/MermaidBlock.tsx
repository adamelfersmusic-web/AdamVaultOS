// The /diagram block — a Mermaid diagram that renders IN PLACE inside the
// TipTap editor, so a note can hold both a picture and editable prose without
// becoming a read-only .mdx.
//
// Modelled on BoardEmbed/AiBlock: a custom node with a React nodeview, plus the
// markdown round-trip triple (markdownTokenizer → parseMarkdown → renderMarkdown).
//
// 🔑 THE POINT: its markdown form is an ORDINARY ```mermaid fence. Nothing
// exotic is written to the vault — the same note renders as a diagram in the
// .mdx viewer, on GitHub, and in any other markdown tool. Open a note that
// already has a mermaid fence and it simply becomes editable and rendered.
// Save without touching it and the bytes are identical.
//
// Click the diagram to edit the definition; click away to see the picture.

import { useEffect, useRef, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import type { JSONContent, NodeViewProps } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { Mermaid } from '../../lib/mdx/Mermaid'
import { IconGraph, IconClose } from '../../components/Icons'

interface MarkdownToken {
  type: string
  raw: string
  [key: string]: unknown
}

/** A ```mermaid fence, tolerant of ~~~ and trailing spaces on the info string. */
const FENCE_RE = /^(?:```|~~~)[ \t]*mermaid[ \t]*\r?\n([\s\S]*?)(?:\r?\n)?(?:```|~~~)[ \t]*(?:\r?\n|$)/

const PLACEHOLDER = `graph TD
  A[Start] --> B[Next]`

function MermaidBlockView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const code = (node.attrs.code as string) ?? ''
  // A freshly-inserted block has no definition yet, so it opens in edit mode.
  const [editing, setEditing] = useState(() => !code.trim())
  const [draft, setDraft] = useState(code)
  const ref = useRef<HTMLTextAreaElement>(null)

  // Keep the draft in step when the node changes underneath us (undo, a
  // collaborative set, a fresh doc load reusing this view).
  useEffect(() => {
    if (!editing) setDraft(code)
  }, [code, editing])

  // Focus on the next frame: TipTap restores selection to the doc after a
  // nodeview mounts, and a same-tick focus() loses that race — leaving the
  // textarea unfocused, so blur (and therefore commit) would never fire.
  useEffect(() => {
    if (!editing) return
    const id = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
    return () => cancelAnimationFrame(id)
  }, [editing])

  /** Leave edit mode, writing the draft back. An abandoned empty block removes
   * itself rather than saving an empty fence. */
  const commit = () => {
    const next = draft.replace(/\r\n?/g, '\n').trim()
    if (!next) {
      deleteNode()
      return
    }
    if (next !== code) updateAttributes({ code: next })
    setEditing(false)
  }

  if (editing) {
    return (
      <NodeViewWrapper className="mermaid-block is-editing">
        <div className="mermaid-edit" contentEditable={false}>
          <div className="mermaid-edit-head">
            <IconGraph size={13} />
            Mermaid diagram
            <a
              className="mermaid-edit-help"
              href="https://mermaid.js.org/intro/syntax-reference.html"
              target="_blank"
              rel="noreferrer"
            >
              syntax ↗
            </a>
            <button
              className="mermaid-edit-x"
              title="Remove diagram"
              aria-label="Remove diagram"
              onClick={() => deleteNode()}
            >
              <IconClose size={12} />
            </button>
          </div>
          <textarea
            ref={ref}
            className="mermaid-input"
            data-testid="mermaid-input"
            placeholder={PLACEHOLDER}
            value={draft}
            rows={Math.min(18, Math.max(4, draft.split('\n').length + 1))}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              // Enter must reach the textarea — a diagram is multi-line.
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
                e.preventDefault()
                commit()
              }
            }}
          />
          <div className="mermaid-edit-foot">
            <span>Click away to render · ⌘↵</span>
            <button className="btn btn-gold" onClick={commit}>
              Done
            </button>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className={`mermaid-block${selected ? ' is-selected' : ''}`}>
      <div
        className="mermaid-render"
        data-testid="mermaid-render"
        contentEditable={false}
        role="button"
        tabIndex={0}
        title="Click to edit this diagram"
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            setEditing(true)
          }
        }}
      >
        <Mermaid chart={code} key={code} />
        <span className="mermaid-edit-hint">
          <IconGraph size={11} /> edit
        </span>
      </div>
    </NodeViewWrapper>
  )
}

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-code') ?? '',
        renderHTML: (attrs) => ({ 'data-code': attrs.code }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-mermaid-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-mermaid-block': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockView)
  },

  // Back to an ordinary fence — the whole point. An empty block (inserted then
  // abandoned) writes nothing rather than leaving an empty fence behind.
  // No trailing newlines: the serializer already separates blocks, and adding
  // our own leaves a growing gap below every diagram.
  renderMarkdown: (node) => {
    const code = String(node.attrs?.code ?? '').trim()
    return code ? `\`\`\`mermaid\n${code}\n\`\`\`` : ''
  },

  // Parse the fence straight from markdown, so an existing note's diagram
  // arrives as a live block instead of grey code text.
  markdownTokenName: 'mermaidBlock',
  parseMarkdown: (token, h) => {
    const t = token as MarkdownToken & { code?: string }
    return h.createNode('mermaidBlock', { code: t.code ?? '' }, [])
  },
  markdownTokenizer: {
    name: 'mermaidBlock',
    level: 'block',
    // Runs ahead of marked's built-in fence rule, which would otherwise claim
    // this as a plain code block.
    // `m` so ^ anchors to a line start: the index returned must be the fence
    // itself, not the newline before it. -1 when absent, as marked expects.
    start: (src: string) => src.search(/^(?:```|~~~)[ \t]*mermaid[ \t]*\r?$/m),
    tokenize(src: string) {
      const match = FENCE_RE.exec(src)
      if (!match) return undefined
      return {
        type: 'mermaidBlock',
        raw: match[0],
        code: (match[1] ?? '').trim(),
      } as MarkdownToken
    },
  },
})

/** Belt-and-braces for docs loaded through paths that skip the tokenizer (the
 * same guard BoardEmbed carries): turn a codeBlock whose language is `mermaid`
 * into a live diagram node. */
export function convertMermaidBlocks(doc: JSONContent): {
  doc: JSONContent
  changed: boolean
} {
  let changed = false
  const walk = (node: JSONContent): JSONContent => {
    if (!Array.isArray(node.content)) return node
    const next: JSONContent[] = node.content.map((child) => {
      const lang = (child.attrs?.language ?? '') as string
      if (child.type === 'codeBlock' && lang.toLowerCase() === 'mermaid') {
        const code = (child.content ?? [])
          .map((c) => (typeof c.text === 'string' ? c.text : ''))
          .join('')
          .trim()
        if (code) {
          changed = true
          return { type: 'mermaidBlock', attrs: { code } }
        }
      }
      return walk(child)
    })
    return { ...node, content: next }
  }
  return { doc: walk(doc), changed }
}
