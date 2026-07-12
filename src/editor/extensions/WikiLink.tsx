// First-class [[wikilink]] node. Parachute notes link with `[[Target]]`; the
// markdown serializer must NOT escape the brackets, and the editor should show
// the link as a clickable chip. This node SERIALIZES back to exactly
// `[[Target]]` (byte-identical, never escaped) and renders as a chip that
// navigates to that note in the Pages editor.
//
// Parsing markdown → node is done at load time by convertWikiLinks() (mirrors
// SubPageLink's convertPageLinks): `[[…]]` inside a text node is replaced with
// a wikiLink node, leaving surrounding text untouched.

import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import type { NodeViewProps } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { navigate } from '../../lib/router'
import { IconPage } from '../../components/Icons'

function WikiLinkView({ node }: NodeViewProps) {
  const target = (node.attrs.target as string) || ''
  return (
    <NodeViewWrapper as="span" className="wikilink-wrap">
      <button
        type="button"
        className="wikilink"
        contentEditable={false}
        // Don't let the click steal the editor selection before we navigate.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const t = target.trim()
          if (t) navigate({ kind: 'pages', path: t })
        }}
        title={target}
      >
        <IconPage size={12} />
        <span className="wikilink-text">{target}</span>
      </button>
    </NodeViewWrapper>
  )
}

export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      target: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-target') ?? '',
        renderHTML: (attrs) => ({ 'data-target': attrs.target }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-wikilink]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const target = (node.attrs.target as string) || ''
    return [
      'a',
      mergeAttributes(HTMLAttributes, { 'data-wikilink': '', class: 'wikilink' }),
      `[[${target}]]`,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView)
  },

  // Typing a full `[[target]]` by hand converts to the chip the moment the
  // closing brackets land — same shape convertWikiLinks() produces at load.
  // NO capture group: nodeInputRule would then replace only the group and
  // leave the brackets behind; we slice the target out of the whole match.
  addInputRules() {
    return [
      nodeInputRule({
        find: /\[\[[^[\]\n]+?\]\]$/,
        type: this.type,
        getAttributes: (match) => ({ target: match[0].slice(2, -2) }),
      }),
    ]
  },

  // @tiptap/markdown: write back EXACTLY `[[target]]` — never escaped. `target`
  // is stored verbatim (no trimming) so the round-trip is byte-identical.
  renderMarkdown: (node) => {
    const target = (node.attrs?.target as string) ?? ''
    return target ? `[[${target}]]` : ''
  },
})

// `[[Target]]` — target is any run that isn't a bracket or newline.
const WIKILINK_RE = /\[\[([^[\]\n]+?)\]\]/g

/**
 * Walk a ProseMirror JSON doc and replace `[[Target]]` occurrences inside text
 * nodes with wikiLink nodes, preserving the surrounding text (and its marks).
 * Returns the (possibly new) doc and a `changed` flag so callers can skip a
 * needless re-set. Mirrors convertPageLinks.
 */
export function convertWikiLinks(doc: JSONContent): {
  doc: JSONContent
  changed: boolean
} {
  let changed = false
  const walk = (node: JSONContent): JSONContent => {
    if (!Array.isArray(node.content)) return node
    const next: JSONContent[] = []
    for (const child of node.content) {
      if (
        child.type === 'text' &&
        typeof child.text === 'string' &&
        child.text.includes('[[')
      ) {
        const pieces = splitWikiText(child)
        if (pieces.length > 1) changed = true
        next.push(...pieces)
      } else {
        next.push(walk(child))
      }
    }
    return { ...node, content: next }
  }
  return { doc: walk(doc), changed }
}

function splitWikiText(textNode: JSONContent): JSONContent[] {
  const text = textNode.text ?? ''
  const out: JSONContent[] = []
  let last = 0
  WIKILINK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = WIKILINK_RE.exec(text)) !== null) {
    if (m.index > last) out.push({ ...textNode, text: text.slice(last, m.index) })
    // Target stored verbatim so renderMarkdown reproduces the source exactly.
    out.push({ type: 'wikiLink', attrs: { target: m[1] } })
    last = m.index + m[0].length
  }
  if (out.length === 0) return [textNode]
  if (last < text.length) out.push({ ...textNode, text: text.slice(last) })
  return out
}
