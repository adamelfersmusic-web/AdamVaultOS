import { Extension } from '@tiptap/core'

/**
 * Make raw markdown survive an open → edit → save round-trip.
 *
 * The @tiptap/markdown serializer backslash-escapes `[ ] _` (and HTML-encodes
 * `& < >`) in text nodes. On a Parachute vault that stores raw markdown, that
 * corrupts content on save:
 *   [[Amanda/02-work-log]] → \[\[Amanda/02-work-log\]\]   (breaks the wikilink)
 *   File & Storage         → File &amp; Storage
 *   Adam -> Cassy          → Adam -&gt; Cassy
 *   some_variable_name     → some\_variable\_name
 *
 * We relax the manager's text encoder to NEVER touch `[ ] _ & < >`. Only
 * `\ ` ` * ~` stay escaped so genuinely-literal emphasis/code characters can't
 * be reparsed as formatting. The package exposes no option for this yet — this
 * is a clean candidate to upstream into @tiptap/markdown.
 */
export const MarkdownLiteral = Extension.create({
  name: 'markdownLiteral',

  // onCreate runs after @tiptap/markdown's onBeforeCreate has installed
  // `editor.markdown`, so the serializer manager is present to patch.
  onCreate() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mgr: any = (this.editor as any).markdown
    if (!mgr || typeof mgr.encodeTextForMarkdown !== 'function') return

    mgr.encodeTextForMarkdown = function (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this: any,
      text: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parentNode: any,
    ): string {
      const codeTypes: Set<string> | undefined = this?.codeTypes
      const insideCode =
        (parentNode?.type != null && !!codeTypes?.has(parentNode.type)) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (node?.marks ?? []).some((m: any) =>
          codeTypes?.has(typeof m === 'string' ? m : m.type),
        )
      if (insideCode) return text
      // Raw markdown is sacred: never escape [ ] _ & < >. Keep \ ` * ~ escaped.
      return text.replace(/([\\`*~])/g, '\\$1')
    }
  },
})
