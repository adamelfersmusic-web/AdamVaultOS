// NotePage R1 — the rich block editor for the Library note route. The same
// TipTap extension family as the Pages editor (identical markdown
// serialization, zero drift), full-size: real kanban boards and live project
// board embeds render here, unlike the chip-only canvas cards. Adam never
// sees markdown; the vault stores markdown underneath, byte-stable.
//
// Contract with NotePage: `value` is read ONCE on mount (remount via key to
// load external content, e.g. conflict "Load theirs"); every edit reports the
// serialized markdown through onChange so NotePage's existing draft/dirty/
// save/conflict machinery works unchanged.

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
import { TableFilter } from '../editor/extensions/TableFilter'
import { Color } from '@tiptap/extension-text-style'
import { MarkdownLiteral } from '../editor/extensions/markdownLiteral'
import { MarkSpanParser, RichHighlight } from '../editor/extensions/RichHighlight'
import { ColorText } from '../editor/extensions/ColorText'
import {
  ToggleDetails,
  ToggleSummary,
  ToggleContent,
  ToggleSize,
} from '../editor/extensions/ToggleDetails'
import { Kanban } from '../editor/extensions/Kanban'
import { BoardEmbed, convertBoardEmbeds } from '../editor/extensions/BoardEmbed'
import { WikiLink, convertWikiLinks } from '../editor/extensions/WikiLink'
import { WikiLinkSuggest, setContentSilently } from '../editor/extensions/WikiLinkSuggest'
import { SlashCommand } from '../editor/extensions/SlashCommand'
import { BlockTypeGuard } from '../editor/extensions/BlockTypeGuard'
import { handleTabKey } from '../editor/tabKey'
import { isVaultHref } from '../lib/vaultLinks'

export function NoteBodyEditor({
  value,
  onChange,
  onSave,
  onEscape,
}: {
  value: string
  onChange: (markdown: string) => void
  onSave: () => void
  onEscape: () => void
}) {
  const loadingRef = useRef(true)
  const saveRef = useRef(onSave)
  const escapeRef = useRef(onEscape)
  const changeRef = useRef(onChange)
  saveRef.current = onSave
  escapeRef.current = onEscape
  changeRef.current = onChange

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Vault-path links must not escape the SPA — the global interceptor
        // in lib/vaultLinks routes clicks instead of Link's window.open, and
        // bare vault paths must survive as real hrefs (the default URI
        // validator blanks them).
        link: {
          openOnClick: false,
          isAllowedUri: (url, ctx) => ctx.defaultValidate(url) || isVaultHref(url),
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      RichHighlight,
      MarkSpanParser,
      ColorText,
      Color,
      ToggleDetails.configure({ persist: true }),
      ToggleSummary,
      ToggleContent,
      ToggleSize,
      TableKit.configure({ table: { resizable: false } }),
      TableFilter,
      // Full-page surfaces get the REAL kanban + live board (the canvas cards
      // use the chip variants; storage is byte-identical either way).
      Kanban,
      BoardEmbed,
      Markdown,
      MarkdownLiteral,
      WikiLink,
      WikiLinkSuggest,
      SlashCommand.configure({
        // Page-only inserts stay out: images/voice/AI blocks belong to the
        // Pages editor's upload + settings plumbing; subpages are a Pages tree
        // concept.
        exclude: ['image', 'subpage', 'ai', 'voice'],
      }),
      // AFTER StarterKit — its paragraph/heading command overrides must win.
      BlockTypeGuard,
    ],
    editorProps: {
      attributes: { class: 'prose note-editor', 'data-testid': 'note-editor' },
      handleKeyDown: (view, event) => {
        // Tab stays home (indent lists, cell-hop tables) — before ⌘S/Escape.
        if (handleTabKey(view, event)) return true
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          saveRef.current()
          return true
        }
        if (event.key === 'Escape') {
          escapeRef.current()
          return true
        }
        return false
      },
    },
    autofocus: 'start',
    onUpdate: ({ editor: ed }) => {
      if (loadingRef.current) return
      changeRef.current(ed.getMarkdown())
    },
  })

  useEffect(() => {
    if (!editor) return
    loadingRef.current = true
    setContentSilently(editor, value, { contentType: 'markdown' })
    // Same order as the other editors: board markers first, then wikilinks.
    const wiki = convertWikiLinks(convertBoardEmbeds(editor.getJSON()).doc)
    if (wiki.changed) setContentSilently(editor, wiki.doc)
    loadingRef.current = false
    editor.commands.focus('start')
    // Load once per mount — NotePage remounts (key) to load external content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  return <EditorContent editor={editor} className="note-editor-wrap" />
}
