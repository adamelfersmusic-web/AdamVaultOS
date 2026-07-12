// T3 — table controls: a slim bar that appears whenever the caret is inside
// a table. Start 3×3, grow/shrink as you go — the engine commands existed,
// this is just the affordance.

import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'

export function TableBar({ editor }: { editor: Editor }) {
  const inTable = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed.isActive('table'),
  })
  if (!inTable) return null
  return (
    <div className="table-bar" data-testid="table-bar">
      <span className="table-bar-label">table</span>
      <button onClick={() => editor.chain().focus().addRowAfter().run()}>＋ row</button>
      <button onClick={() => editor.chain().focus().addColumnAfter().run()}>＋ col</button>
      <button onClick={() => editor.chain().focus().deleteRow().run()}>− row</button>
      <button onClick={() => editor.chain().focus().deleteColumn().run()}>− col</button>
      <button
        className="table-bar-danger"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        ✕ table
      </button>
    </div>
  )
}
