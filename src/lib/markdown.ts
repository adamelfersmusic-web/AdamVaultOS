import { marked, type Tokens } from 'marked'
import DOMPurify from 'dompurify'

// breaks:true — script bodies use single newlines as spoken-word line breaks;
// collapsing them would destroy the rhythm of the writing.
marked.setOptions({ gfm: true, breaks: true, async: false })

// E1 — ==highlight== renders as <mark> in the read view. A real marked
// tokenizer (not a regex pre-pass), so text inside code spans/blocks is never
// touched — the same guarantee the editor's Highlight extension gives.
interface HighlightToken extends Tokens.Generic {
  type: 'highlightMark'
  tokens: Tokens.Generic[]
}
marked.use({
  extensions: [
    {
      name: 'highlightMark',
      level: 'inline',
      start(src: string) {
        const i = src.indexOf('==')
        return i === -1 ? undefined : i
      },
      tokenizer(src: string): HighlightToken | undefined {
        const match = /^==([^=\n]+)==/.exec(src)
        if (!match) return undefined
        return {
          type: 'highlightMark',
          raw: match[0],
          tokens: this.lexer.inlineTokens(match[1]),
        }
      },
      renderer(token) {
        return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`
      },
    },
  ],
})

// Root-relative vault images (`/api/storage/...`) can't display from an <img>
// src — the browser resolves them against the app origin, not the vault, so
// they 404. Stage them as `data-vault-src` placeholders (no src → no broken
// flash); useVaultImages swaps in an auth-resolved URL after render. External
// http(s)/data images are left untouched.
function stageVaultImages(src: string): string {
  return src.replace(
    /!\[([^\]]*)\]\((\/[^)\s]+)\)/g,
    (_m, alt: string, path: string) =>
      `<img alt="${alt.replace(/"/g, '&quot;')}" data-vault-src="${path}" class="vault-img" />`,
  )
}

// Obsidian-style callouts: a blockquote whose first line is `[!type] …` renders
// as a colored callout box. This is a READ-VIEW styling pass only — in the raw
// markdown a callout stays an ordinary `> [!type] …` blockquote, so it survives
// the vault round-trip with ZERO corruption risk (if the regex ever misses, it
// just renders as a normal blockquote). Recognized types: note/info/tip/success/
// warning/danger/quote (anything else falls back to the generic callout style).
function styleCallouts(html: string): string {
  return html.replace(
    /<blockquote>(\s*<p>)\s*\[!([a-zA-Z]+)\]\s*/g,
    (_m, pOpen: string, type: string) => {
      const t = type.toLowerCase()
      return `<blockquote class="callout callout-${t}" data-callout="${t}">${pOpen}`
    },
  )
}

// Wikilinks become real in-app links in the read view: `[[path|alias]]` →
// an <a href="#/note/<encoded>"> the hash router understands. Applied on the
// raw markdown BEFORE marked runs (same staging trick as images), so the
// stored note keeps its plain [[...]] — zero round-trip risk. The `[^![`
// guard skips image-embeds (![[..]]) and already-bracketed forms.
function linkWikilinks(src: string): string {
  return src.replace(
    /(^|[^![])\[\[([^\]|#\n]+)(?:\|([^\]\n]+))?\]\]/g,
    (_m, lead: string, target: string, alias?: string) => {
      const t = target.trim()
      const label = (alias ?? t.split('/').pop() ?? t).trim()
      return `${lead}<a class="wikilink" href="#/note/${encodeURIComponent(t)}">${label}</a>`
    },
  )
}

export function renderMarkdown(src: string): string {
  const html = styleCallouts(marked.parse(stageVaultImages(linkWikilinks(src))) as string)
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style'],
    ADD_ATTR: ['target', 'data-vault-src', 'data-callout'],
  })
}
