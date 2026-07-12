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
import { MarkdownLiteral } from '../editor/extensions/markdownLiteral'
import { MarkSpanParser, RichHighlight } from '../editor/extensions/RichHighlight'
import { WikiLink, convertWikiLinks } from '../editor/extensions/WikiLink'
import { WikiLinkSuggest } from '../editor/extensions/WikiLinkSuggest'
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
      Markdown,
      MarkdownLiteral,
      WikiLink,
      WikiLinkSuggest,
      SlashCommand.configure({
        // No toggle/table either — those nodes aren't registered in cards.
        exclude: ['image', 'subpage', 'ai', 'voice', 'toggle', 'toggle-h1', 'toggle-h2', 'table', 'board', 'kanban'],
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
    editor.commands.setContent(value, { contentType: 'markdown' })
    const wiki = convertWikiLinks(editor.getJSON())
    if (wiki.changed) editor.commands.setContent(wiki.doc)
    editor.commands.focus('end')
    // Load once per mount — the card remounts per edit session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  return <EditorContent editor={editor} className="card-editor" />
}
