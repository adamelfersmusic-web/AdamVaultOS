// Block-type commands must convert exactly the block(s) the user means —
// never a neighbor the selection merely grazes. A selection made with
// Shift+Down / triple-click / a mouse drag routinely ENDS at offset 0 of the
// next block (or STARTS at the very end of the previous one) without covering
// any of that block's content; ProseMirror's setBlockType converts every
// block the range touches, so "make this a Heading 2" bled into the paragraph
// below — and "back to paragraph" then bled into the heading above.
//
// The fix is one helper: trim zero-content boundary blocks off the selection
// before any block-type command runs. Genuinely multi-block selections (real
// content covered in each block) still convert every covered block. The
// extension re-declares the paragraph/heading commands (it registers after
// StarterKit, so its declarations win) so every entry point — the slash menu,
// ⌘⌥0–3 keyboard shortcuts, future UI — goes through the clamp.

import { Extension } from '@tiptap/core'
import type { CommandProps, Editor } from '@tiptap/core'
import type { Level } from '@tiptap/extension-heading'
import { Selection, TextSelection } from '@tiptap/pm/state'
import type { Transaction } from '@tiptap/pm/state'

/** The selection with zero-content boundary blocks trimmed off, or null when
 * it already targets exactly the blocks whose content it covers. */
export function trimBlockBoundaries(tr: Transaction): TextSelection | null {
  const sel = tr.selection
  if (sel.empty || !(sel instanceof TextSelection)) return null
  const { doc } = tr
  let { from, to } = sel

  // Selection END at the very start of a textblock (offset 0 — none of its
  // content covered): that block isn't part of the intent. Pull the end back
  // to the end of the previous textblock.
  const $to = doc.resolve(to)
  if ($to.parent.isTextblock && $to.parentOffset === 0 && to > from) {
    const prev = Selection.findFrom(doc.resolve($to.before()), -1, true)
    if (prev) to = Math.max(prev.to, from)
  }

  // Selection START at the very end of a textblock: same story upward — push
  // the start forward to the beginning of the next textblock.
  const $from = doc.resolve(from)
  if ($from.parent.isTextblock && $from.parentOffset === $from.parent.content.size && from < to) {
    const next = Selection.findFrom(doc.resolve($from.after()), 1, true)
    if (next) from = Math.min(next.from, to)
  }

  if (from === sel.from && to === sel.to) return null
  // The selection only grazed boundaries — no real content anywhere. Collapse
  // to the anchor so the command targets the block the user started in.
  if (from >= to) return TextSelection.create(doc, sel.anchor)
  return TextSelection.create(doc, from, to)
}

/** Chainable step: run right before any block-type command so it targets only
 * the blocks whose content the selection actually covers. Always succeeds. */
export function clampBlockTypeSelection({ tr, dispatch }: CommandProps): boolean {
  if (dispatch) {
    const trimmed = trimBlockBoundaries(tr)
    if (trimmed) tr.setSelection(trimmed)
  }
  return true
}

function allowedLevel(editor: Editor, level: Level): boolean {
  const heading = editor.extensionManager.extensions.find((e) => e.name === 'heading')
  const levels = (heading?.options as { levels?: Level[] } | undefined)?.levels
  return !levels || levels.includes(level)
}

export const BlockTypeGuard = Extension.create({
  name: 'blockTypeGuard',

  addCommands() {
    return {
      // Mirrors of Paragraph.setParagraph / Heading.setHeading+toggleHeading,
      // with the boundary clamp in front. Same behavior otherwise.
      setParagraph:
        () =>
        ({ chain }) =>
          chain().command(clampBlockTypeSelection).setNode('paragraph').run(),
      setHeading:
        (attributes: { level: Level }) =>
        ({ editor, chain }) => {
          if (!allowedLevel(editor, attributes.level)) return false
          return chain().command(clampBlockTypeSelection).setNode('heading', attributes).run()
        },
      toggleHeading:
        (attributes: { level: Level }) =>
        ({ editor, chain }) => {
          if (!allowedLevel(editor, attributes.level)) return false
          return chain()
            .command(clampBlockTypeSelection)
            .toggleNode('heading', 'paragraph', attributes)
            .run()
        },
    }
  },
})
