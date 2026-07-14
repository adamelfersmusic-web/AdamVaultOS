// Canvas v2 (#5): the block editor inside a canvas card. A slim, purpose-built
// TipTap instance sharing the SAME extension modules as the Pages editor —
// identical markdown serialization, zero drift — with the card-appropriate
// subset: blocks, slash menu, task lists (Tab nests = C3), wikilinks,
// callouts. No image upload / AI / voice / sub-page in a card.
//
// Adam never sees markdown: blocks in, blocks out; markdown stays the vault's
// storage format underneath. Save on blur, Escape cancels.

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Markdown } from '@tiptap/markdown'
import { TableKit } from '@tiptap/extension-table'
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
import { KanbanChip } from '../editor/extensions/Kanban'
import { BoardEmbedChip, convertBoardEmbeds } from '../editor/extensions/BoardEmbed'
import { WikiLink, convertWikiLinks } from '../editor/extensions/WikiLink'
import { WikiLinkSuggest, setContentSilently } from '../editor/extensions/WikiLinkSuggest'
import { SlashCommand } from '../editor/extensions/SlashCommand'

export function CardEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string
  onSave: (markdown: string) => void
  onCancel: () => void
}) {
  // Latest callbacks without re-creating the editor.
  const saveRef = useRef(onSave)
  const cancelRef = useRef(onCancel)
  saveRef.current = onSave
  cancelRef.current = onCancel

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      RichHighlight,
      MarkSpanParser,
      ColorText,
      Color,
      // Round-trip SAFETY set: a canvas card can hold a note that was edited
      // as a full page (kanban, tables, toggles). These MUST be registered
      // here too, or a card edit on the canvas silently deletes them (the
      // bug Adam hit). The kanban renders as a CHIP in cards — the board
      // itself is a full-page thing; storage is byte-identical either way.
      ToggleDetails.configure({ persist: true }),
      ToggleSummary,
      ToggleContent,
      ToggleSize,
      TableKit.configure({ table: { resizable: false } }),
      KanbanChip,
      BoardEmbedChip,
      Markdown,
      MarkdownLiteral,
      WikiLink,
      WikiLinkSuggest,
      SlashCommand.configure({
        // Insertion still page-only for the big blocks; registration above is
        // about PRESERVING them, not authoring them in a little card.
        exclude: ['image', 'subpage', 'ai', 'voice', 'toggle', 'toggle-h1', 'toggle-h2', 'table', 'table-csv', 'board', 'kanban'],
      }),
    ],
    editorProps: {
      attributes: { class: 'card-prose' },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Escape') {
          cancelRef.current()
          return true
        }
        return false
      },
    },
    autofocus: 'end',
    onBlur: ({ editor: ed }) => {
      saveRef.current(ed.getMarkdown())
    },
  })

  useEffect(() => {
    if (!editor) return
    setContentSilently(editor, value, { contentType: 'markdown' })
    // Same order as the Pages editor: board markers FIRST (so ![[board:x]]
    // never gets half-eaten as a wikilink), then wikilink chips.
    const wiki = convertWikiLinks(convertBoardEmbeds(editor.getJSON()).doc)
    if (wiki.changed) setContentSilently(editor, wiki.doc)
    editor.commands.focus('end')
    // Load once per mount — the card remounts per edit session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  return <EditorContent editor={editor} className="card-editor" />
}
