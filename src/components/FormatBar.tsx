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

// Highlight washes: the same accents at ~40% alpha, so text stays readable
// over them on both the dark and latte themes.
const HL_COLORS: { name: string; value: string }[] = COLORS.map((c) => ({
  name: `${c.name} highlight`,
  value: `${c.value}66`,
}))

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
        <div className="fmt-group" data-testid="fmt-hl-group">
          <button
            className={`fmt-btn fmt-hl${editor.isActive('highlight') ? ' is-on' : ''}`}
            title="Highlight (⌘⇧H) — hover for colors"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            <span className="fmt-hl-swatch">A</span>
          </button>
          <div className="fmt-hl-colors">
            {HL_COLORS.map((c) => (
              <button
                key={c.value}
                className={`fmt-btn fmt-color${
                  editor.isActive('highlight', { color: c.value }) ? ' is-on' : ''
                }`}
                title={c.name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setHighlight({ color: c.value }).run()}
              >
                <span className="fmt-swatch fmt-swatch-hl" style={{ background: c.value }}>
                  A
                </span>
              </button>
            ))}
          </div>
        </div>
        <span className="fmt-sep" />
        {COLORS.map((c) => (
          <button
            key={c.value}
            className={`fmt-btn fmt-color fmt-font-color${
              editor.isActive('textStyle', { color: c.value }) ? ' is-on' : ''
            }`}
            title={`${c.name} text`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setColor(c.value).run()}
          >
            <span className="fmt-swatch" style={{ background: c.value }} />
          </button>
        ))}
        <span className="fmt-sep" />
        <button
          className="fmt-btn fmt-fold"
          title="Wrap selection in a toggle"
          data-testid="fmt-fold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            editor
              .chain()
              .focus()
              .setDetails()
              .command(({ tr }) => {
                // open the wrapping details so the content stays visible
                const { $from } = tr.selection
                for (let d = $from.depth; d > 0; d--) {
                  if ($from.node(d).type.name === 'details') {
                    const pos = $from.before(d)
                    const node = tr.doc.nodeAt(pos)
                    if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, open: true })
                    break
                  }
                }
                return true
              })
              .run()
          }
        >
          ⌄
        </button>
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
