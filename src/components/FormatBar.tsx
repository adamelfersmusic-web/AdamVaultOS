// The selection format bar (supervised editor drop): select text in the page
// editor → a small floating bar with highlight + the app's own accent colors.
// Deliberately tiny — no arbitrary color picker, no font controls. Calm by law.

import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'

// Literal hexes (not CSS vars): the color is STORED in the markdown, so it has
// to mean the same thing everywhere the note is read. These are the app's own
// accent hexes — readable on both the dark and latte themes.
const COLORS: { name: string; value: string }[] = [
  { name: 'Teal', value: '#2fa39b' },
  { name: 'Red', value: '#c4445a' },
  { name: 'Blue', value: '#4a7fa5' },
  { name: 'Green', value: '#4a8c5c' },
  { name: 'Purple', value: '#7a5c9e' },
]

export function FormatBar({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ editor: ed, state }) => {
        const { from, to, empty } = state.selection
        if (empty || to - from === 0) return false
        // Text selections only — not node selections (images, wikilink chips).
        if (!ed.isEditable) return false
        return state.doc.textBetween(from, to).trim().length > 0
      }}
    >
      <div className="format-bar" data-testid="format-bar">
        <button
          className={`fmt-btn fmt-hl${editor.isActive('highlight') ? ' is-on' : ''}`}
          title="Highlight (⌘⇧H)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <span className="fmt-hl-swatch">A</span>
        </button>
        <span className="fmt-sep" />
        {COLORS.map((c) => (
          <button
            key={c.value}
            className={`fmt-btn fmt-color${
              editor.isActive('textStyle', { color: c.value }) ? ' is-on' : ''
            }`}
            title={`${c.name} text`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setColor(c.value).run()}
          >
            <span className="fmt-swatch" style={{ background: c.value }} />
          </button>
        ))}
        <button
          className="fmt-btn fmt-clear"
          title="Clear color + highlight"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            editor.chain().focus().unsetColor().unsetHighlight().run()
          }
        >
          ✕
        </button>
      </div>
    </BubbleMenu>
  )
}
