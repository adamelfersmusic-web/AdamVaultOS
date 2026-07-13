// T3 — table controls: a slim bar that appears whenever the caret is inside
// a table. Start 3×3, grow/shrink as you go — the engine commands existed,
// this is just the affordance. Plus CSV: copy the table back out for
// Sheets/Notion.

import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { tableRowsToCsv } from '../lib/csv'
import { toast } from '../lib/store'

export function TableBar({ editor }: { editor: Editor }) {
  const inTable = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed.isActive('table'),
  })
  if (!inTable) return null

  const copyCsv = () => {
    // Walk up from the selection to the enclosing table node.
    const { $from } = editor.state.selection
    for (let d = $from.depth; d > 0; d--) {
      const table = $from.node(d)
      if (table.type.name !== 'table') continue
      const rows: string[][] = []
      table.forEach((row) => {
        const cells: string[] = []
        row.forEach((cell) => cells.push(cell.textContent))
        rows.push(cells)
      })
      navigator.clipboard.writeText(tableRowsToCsv(rows)).then(
        () => toast('success', 'Copied as CSV'),
        (e) => toast('error', `Couldn’t copy — ${e instanceof Error ? e.message : e}`),
      )
      return
    }
  }

  return (
    <div className="table-bar" data-testid="table-bar">
      <span className="table-bar-label">table</span>
      <button onClick={() => editor.chain().focus().addRowAfter().run()}>＋ row</button>
      <button onClick={() => editor.chain().focus().addColumnAfter().run()}>＋ col</button>
      <button onClick={() => editor.chain().focus().deleteRow().run()}>− row</button>
      <button onClick={() => editor.chain().focus().deleteColumn().run()}>− col</button>
      <button title="Copy this table as CSV" onClick={copyCsv}>
        CSV
      </button>
      <button
        className="table-bar-danger"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        ✕ table
      </button>
    </div>
  )
}
