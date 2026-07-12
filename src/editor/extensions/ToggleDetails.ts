// #18 — toggle / collapsible blocks with a REAL markdown round-trip. The
// first-party Details extensions ship with no markdown serialization (the
// whole block would be mangled on save), so this adds the canonical HTML
// spelling — the one GitHub/Obsidian render natively:
//
//   <details>
//   <summary>Title</summary>
//
//   …body markdown…
//
//   </details>
//
// Inside the editor it's TipTap's Details node (click the chevron to fold);
// in the vault it's that block, body kept as ordinary markdown so lists,
// todos, and links inside a toggle stay first-class.

import type { MarkdownToken } from '@tiptap/core'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'

const TOGGLE_RE =
  /^<details(?:\s+open)?>\s*\n<summary>([^\n]*?)<\/summary>\s*\n\n([\s\S]*?)\n<\/details>\s*(?:\n+|$)/

interface ToggleToken extends MarkdownToken {
  summaryTokens?: MarkdownToken[]
  bodyTokens?: MarkdownToken[]
}

export const ToggleDetails = Details.extend({
  markdownTokenName: 'detailsBlock',

  // NB: always pass node.content ?? [] — renderChildren(node) on a node with
  // EMPTY content falls back to rendering the node itself → infinite loop.
  renderMarkdown: (node, h) => `<details>\n${h.renderChildren(node.content ?? [])}</details>\n\n`,

  parseMarkdown: (token, h) => {
    const t = token as ToggleToken
    return h.createNode('details', { open: true }, [
      h.createNode('detailsSummary', undefined, h.parseInline(t.summaryTokens ?? [])),
      h.createNode('detailsContent', undefined, h.parseChildren(t.bodyTokens ?? [])),
    ])
  },

  markdownTokenizer: {
    name: 'detailsBlock',
    level: 'block',
    start: (src: string) => src.indexOf('<details'),
    tokenize(src, _tokens, lexer) {
      const match = TOGGLE_RE.exec(src)
      if (!match) return undefined
      return {
        type: 'detailsBlock',
        raw: match[0],
        summaryTokens: lexer.inlineTokens(match[1]),
        bodyTokens: lexer.blockTokens(match[2]),
      } as ToggleToken
    },
  },
})

export const ToggleSummary = DetailsSummary.extend({
  renderMarkdown: (node, h) =>
    `<summary>${h.renderChildren(node.content ?? [])}</summary>\n\n`,
})

export const ToggleContent = DetailsContent.extend({
  renderMarkdown: (node, h) => {
    const body = h.renderChildren(node.content ?? []).replace(/\n+$/, '')
    return `${body}\n`
  },
})
