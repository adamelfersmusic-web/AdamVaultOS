// T3 — table controls, floating DIRECTLY above the table the caret is in
// (Adam: "it should show up right next to the table", 2026-07-13). Row/col
// ops, CSV copy-out, and an Excel-style row filter (view-only — the stored
// markdown never changes; see editor/extensions/TableFilter.ts).

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import { tableRowsToCsv } from '../lib/csv'
import { tableFilterKey } from '../editor/extensions/TableFilter'
import { toast } from '../lib/store'

/** Doc position of the table node enclosing the selection, or null. */
function enclosingTablePos(editor: Editor): number | null {
  const { $from } = editor.state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') return $from.before(d)
  }
  return null
}

export function TableBar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      const pos = ed.isActive('table') ? enclosingTablePos(ed) : null
      const filter = tableFilterKey.getState(ed.state) ?? null
      return {
        tablePos: pos,
        activeQuery: filter && filter.pos === pos ? filter.query : '',
      }
    },
    equalityFn: (a, b) =>
      !!b && a.tablePos === b.tablePos && a.activeQuery === b.activeQuery,
  })
  const tablePos = state?.tablePos ?? null
  const activeQuery = state?.activeQuery ?? ''
  const [query, setQuery] = useState('')

  // Adopt the plugin's query when the caret enters a (possibly filtered) table.
  useEffect(() => {
    setQuery(activeQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablePos])

  if (tablePos === null) return null

  // Straddle the table's top edge (half over its header row) so the bar
  // never fully covers — or steals clicks from — the text above the table.
  // nodeDOM returns TipTap's full-width wrapper; measure the real <table>.
  let top = 0
  let left = 0
  const dom = editor.view.nodeDOM(tablePos)
  if (dom instanceof HTMLElement) {
    const tableEl = dom.matches('table') ? dom : (dom.querySelector('table') ?? dom)
    const anchor = dom.closest('.page-canvas') ?? editor.view.dom
    const tableRect = tableEl.getBoundingClientRect()
    const anchorRect = anchor.getBoundingClientRect()
    top = tableRect.top - anchorRect.top - 15
    left = tableRect.left - anchorRect.left + 8
  }

  const applyFilter = (q: string) => {
    setQuery(q)
    editor.commands.setTableFilter(q.trim() ? { pos: tablePos, query: q } : null)
  }

  const copyCsv = () => {
    const table = editor.state.doc.nodeAt(tablePos)
    if (!table) return
    const rows: string[][] = []
    table.forEach((row) => {
      const cells: string[] = []
      row.forEach((cell) => cells.push(cell.textContent))
      rows.push(cells)
    })
    navigator.clipboard.writeText(tableRowsToCsv(rows)).then(
      () => toast('success', 'Copied as CSV'),
      (e) => toast('error', `Couldn\u2019t copy — ${e instanceof Error ? e.message : e}`),
    )
  }

  return (
    <div className="table-bar table-bar-float" data-testid="table-bar" style={{ top, left }}>
      <button onClick={() => editor.chain().focus().addRowAfter().run()}>＋ row</button>
      <button onClick={() => editor.chain().focus().addColumnAfter().run()}>＋ col</button>
      <button onClick={() => editor.chain().focus().deleteRow().run()}>− row</button>
      <button onClick={() => editor.chain().focus().deleteColumn().run()}>− col</button>
      <button title="Copy this table as CSV" onClick={copyCsv}>
        CSV
      </button>
      <input
        className="table-filter"
        data-testid="table-filter"
        placeholder="filter rows…"
        value={query}
        onChange={(e) => applyFilter(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') applyFilter('')
        }}
      />
      {query.trim() && (
        <button
          className="table-filter-clear"
          data-testid="table-filter-clear"
          title="Clear filter (view only — no rows were changed)"
          onClick={() => applyFilter('')}
        >
          ✕ filter
        </button>
      )}
      <button
        className="table-bar-danger"
        title="Delete table"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        ✕
      </button>
    </div>
  )
}
