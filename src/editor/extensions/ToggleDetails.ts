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

import { Extension, type MarkdownToken } from '@tiptap/core'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'

const TOGGLE_RE =
  /^<details((?:\s+(?:open|data-size="h[123]"))*)>\s*\n<summary>([^\n]*?)<\/summary>\s*\n\n([\s\S]*?)\n<\/details>\s*(?:\n+|$)/

interface ToggleToken extends MarkdownToken {
  toggleSize?: string
  summaryTokens?: MarkdownToken[]
  bodyTokens?: MarkdownToken[]
}

const SIZES = new Set(['h1', 'h2', 'h3'])

export const ToggleDetails = Details.extend({
  markdownTokenName: 'detailsBlock',

  // NB: always pass node.content ?? [] — renderChildren(node) on a node with
  // EMPTY content falls back to rendering the node itself → infinite loop.
  renderMarkdown: (node, h) => {
    const size = (node.attrs as { size?: string } | undefined)?.size
    const attr = size && SIZES.has(size) ? ` data-size="${size}"` : ''
    return `<details${attr}>\n${h.renderChildren(node.content ?? [])}</details>\n\n`
  },

  parseMarkdown: (token, h) => {
    const t = token as ToggleToken
    const size = t.toggleSize && SIZES.has(t.toggleSize) ? t.toggleSize : null
    return h.createNode('details', { open: true, size }, [
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
      const size = /data-size="(h[123])"/.exec(match[1])?.[1]
      return {
        type: 'detailsBlock',
        raw: match[0],
        toggleSize: size,
        summaryTokens: lexer.inlineTokens(match[2]),
        bodyTokens: lexer.blockTokens(match[3]),
      } as ToggleToken
    },
  },
})

// T2 — size levels (toggle-H1/H2, Notion-style): a `data-size` attribute on
// the <details> tag. Pure HTML, so other renderers just show a normal details
// block — graceful degradation, zero markdown corruption. Registered as a
// GLOBAL attribute so Details' own attrs (open!) are never clobbered.
export const ToggleSize = Extension.create({
  name: 'toggleSize',
  addGlobalAttributes() {
    return [
      {
        types: ['details'],
        attributes: {
          size: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-size'),
            renderHTML: (attrs: { size?: string | null }) =>
              attrs.size && SIZES.has(attrs.size)
                ? { 'data-size': attrs.size }
                : {},
          },
        },
      },
    ]
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
