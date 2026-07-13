// Excel-style row filtering for in-page tables — VIEW state only. The note's
// markdown never changes: non-matching rows are hidden with a decoration
// class, the way a spreadsheet filter is a lens, not an edit. Ephemeral by
// design (never persisted; cleared per session).

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

export interface TableFilterState {
  /** Document position of the table node being filtered. */
  pos: number
  query: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableFilter: {
      /** Set (or clear, with null) the active table row filter. */
      setTableFilter: (filter: TableFilterState | null) => ReturnType
    }
  }
}

export const tableFilterKey = new PluginKey<TableFilterState | null>('tableFilter')

function rowDecorations(doc: PMNode, filter: TableFilterState | null): DecorationSet {
  if (!filter || !filter.query.trim()) return DecorationSet.empty
  const table = doc.nodeAt(filter.pos)
  if (!table || table.type.name !== 'table') return DecorationSet.empty
  const q = filter.query.trim().toLowerCase()
  const decos: Decoration[] = []
  let rowIndex = 0
  let offset = filter.pos + 1
  table.forEach((row) => {
    // Row 0 is the header — always visible, like a frozen header row.
    if (rowIndex > 0 && !row.textContent.toLowerCase().includes(q)) {
      decos.push(
        Decoration.node(offset, offset + row.nodeSize, { class: 'pm-row-filtered' }),
      )
    }
    offset += row.nodeSize
    rowIndex += 1
  })
  return DecorationSet.create(doc, decos)
}

export const TableFilter = Extension.create({
  name: 'tableFilter',

  addCommands() {
    return {
      setTableFilter:
        (filter) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(tableFilterKey, filter ?? false))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<TableFilterState | null>({
        key: tableFilterKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(tableFilterKey)
            if (meta !== undefined) return meta === false ? null : (meta as TableFilterState)
            if (!value) return null
            // Keep tracking the same table as the doc shifts around it.
            const pos = tr.mapping.map(value.pos)
            return { ...value, pos }
          },
        },
        props: {
          decorations(state) {
            return rowDecorations(state.doc, tableFilterKey.getState(state) ?? null)
          },
        },
      }),
    ]
  },
})
