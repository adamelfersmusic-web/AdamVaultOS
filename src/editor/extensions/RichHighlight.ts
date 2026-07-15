// Colored highlights (Adam: "same colors as fonts, as highlights — amazing
// for visual organization"). The first-party Highlight serializer writes
// `==text==` unconditionally, which would silently DROP the color on save —
// so the colored case gets the HTML spelling instead:
//
//   plain highlight   →  ==text==                                  (unchanged)
//   colored highlight →  <mark style="background-color: #2fa39b55">text</mark>
//
// Both parse back losslessly; the read view renders both natively.

import { Extension, type MarkdownToken } from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'

// Swatch values are 8-digit hex (accent + alpha) so the wash reads on BOTH
// themes; parse defensively like ColorText.
const SAFE_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)|[a-zA-Z]{3,20})$/

export const RichHighlight = Highlight.extend({
  // Canonical mark-nesting order: the colour span/mark serializes OUTERMOST,
  // wrapping the inline `**`/`*` markdown — the form a human authors and the
  // one `marked` emits in the read view (`<mark><strong>…`). TextStyle already
  // defaults to priority 101; Highlight defaults to 100, which put it INSIDE
  // bold and rewrote a stored `<mark …>**x**</mark>` to `**<mark …>x</mark>**`
  // on save (a byte-stability break). Matching 101 makes both style marks
  // outermost and deterministic, so highlight+bold/italic round-trips clean.
  priority: 101,

  renderMarkdown: (node, h) => {
    const color = (node.attrs as { color?: string } | undefined)?.color
    const children = h.renderChildren(node)
    if (color && SAFE_COLOR.test(color)) {
      return `<mark style="background-color: ${color}">${children}</mark>`
    }
    return `==${children}==`
  },
}).configure({ multicolor: true })

// The parse side of the colored spelling. A separate tiny extension because
// RichHighlight keeps Highlight's own `==` tokenizer — one tokenizer per
// extension — and this one only routes <mark style> back onto the same mark.
export const MarkSpanParser = Extension.create({
  name: 'markSpanParser',
  markdownTokenName: 'markSpan',

  parseMarkdown: (token, h) => {
    const color = ((token as MarkdownToken & { attrs?: { color?: string } }).attrs?.color ?? '')
    return h.applyMark(
      'highlight',
      h.parseInline(token.tokens ?? []),
      SAFE_COLOR.test(color) ? { color } : undefined,
    )
  },

  markdownTokenizer: {
    name: 'markSpan',
    level: 'inline',
    start: (src: string) => src.indexOf('<mark'),
    tokenize(src, _tokens, lexer) {
      const rule = /^<mark style="background-color:\s*([^";]+?)\s*;?\s*">([\s\S]+?)<\/mark>/
      const match = rule.exec(src)
      if (!match || !SAFE_COLOR.test(match[1])) return undefined
      return {
        type: 'markSpan',
        raw: match[0],
        attrs: { color: match[1] },
        tokens: lexer.inlineTokens(match[2]),
      } as MarkdownToken
    },
  },
})
