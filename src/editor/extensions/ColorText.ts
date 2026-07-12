// #20 — colored text with a REAL markdown round-trip. TextStyle/Color ship
// with no markdown serialization in @tiptap/markdown 3.26 (the mark would be
// silently DROPPED on save), so this extends TextStyle with the same
// renderMarkdown / markdownTokenizer / parseMarkdown triple the first-party
// Highlight extension uses:
//
//   editor mark  →  <span style="color: #38688d">text</span>  →  editor mark
//
// Inline HTML is the only markdown-compatible spelling for color; it renders
// natively in the read view (DOMPurify allows style attrs) and in most
// markdown renderers, and degrades to visible-but-harmless tags elsewhere.
// The color palette itself is limited to the app's own accent set (see
// FormatBar) — no arbitrary color picker, calm by law.

import type { MarkdownToken } from '@tiptap/core'
import { TextStyle } from '@tiptap/extension-text-style'

// Only #hex / rgb(…) / plain-word colors are ever written by the FormatBar,
// but parse defensively: anything not shaped like a CSS color is rejected so
// hostile note content can't smuggle style payloads through the tokenizer.
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]{3,20})$/

export const ColorText = TextStyle.extend({
  markdownTokenName: 'colorSpan',

  renderMarkdown: (node, h) => {
    const color = (node.attrs as { color?: string } | undefined)?.color
    const children = h.renderChildren(node)
    if (!color || !SAFE_COLOR.test(color)) return children
    return `<span style="color: ${color}">${children}</span>`
  },

  parseMarkdown: (token, h) => {
    const color = ((token as MarkdownToken & { attrs?: { color?: string } }).attrs?.color ?? '')
    return h.applyMark(
      'textStyle',
      h.parseInline(token.tokens ?? []),
      SAFE_COLOR.test(color) ? { color } : undefined,
    )
  },

  markdownTokenizer: {
    name: 'colorSpan',
    level: 'inline',
    start: (src: string) => src.indexOf('<span style="color:'),
    tokenize(src, _tokens, lexer) {
      const rule = /^<span style="color:\s*([^";]+?)\s*;?\s*">([\s\S]+?)<\/span>/
      const match = rule.exec(src)
      if (!match || !SAFE_COLOR.test(match[1])) return undefined
      return {
        type: 'colorSpan',
        raw: match[0],
        attrs: { color: match[1] },
        tokens: lexer.inlineTokens(match[2]),
      } as MarkdownToken
    },
  },
})
