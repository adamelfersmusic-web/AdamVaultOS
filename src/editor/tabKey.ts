// Tab must never walk out of an editor. Raw contenteditable lets Tab fall
// through to the browser's focus navigation — one keystroke and the caret is
// suddenly on the Ask AI fab. Shared by the Pages, Library-note and canvas
// card editors (each calls this first from its editorProps.handleKeyDown,
// which runs before every plugin keymap). Per context:
//
//   list item (bullet/ordered/task) — Tab indents (sinkListItem), Shift-Tab
//     outdents (liftListItem); an impossible sink is still swallowed
//   table — return false: TipTap's own Tab/Shift-Tab cell navigation handles it
//   code block — Tab inserts two spaces (real content, still never leaves)
//   wikilink suggester open — return false: its menu accepts with Tab
//   anywhere else — swallowed whole; no literal tab characters are ever
//     inserted (a stray \t in a paragraph would change the note's bytes on
//     the markdown round-trip)

import { liftListItem, sinkListItem } from '@tiptap/pm/schema-list'
import type { EditorView } from '@tiptap/pm/view'
import { isWikiSuggestOpen } from './extensions/WikiLinkSuggest'

export function handleTabKey(view: EditorView, event: KeyboardEvent): boolean {
  if (event.key !== 'Tab') return false
  const { state } = view
  const { $from } = state.selection

  // The wikilink suggester accepts its highlighted entry with Tab; its
  // (plugin-level) handler runs after this one, so step aside while open.
  if (isWikiSuggestOpen(state)) return false

  // Tables: leave TipTap's built-in cell hopping (and row-growing) in charge.
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name
    if (name === 'tableCell' || name === 'tableHeader') return false
  }

  // From here on the event never reaches the browser: handled or swallowed.
  event.preventDefault()

  // List items: Tab indents, Shift-Tab outdents. taskItem and listItem are
  // distinct node types — sink/lift need the one the caret is actually in.
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name
    if (name === 'listItem' || name === 'taskItem') {
      const item = state.schema.nodes[name]
      const command = event.shiftKey ? liftListItem(item) : sinkListItem(item)
      command(state, view.dispatch)
      return true
    }
  }

  // Code blocks: Tab types two spaces of indentation.
  if (!event.shiftKey && $from.parent.type.name === 'codeBlock') {
    view.dispatch(state.tr.insertText('  '))
    return true
  }

  return true
}
