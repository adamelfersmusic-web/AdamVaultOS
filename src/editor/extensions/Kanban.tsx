// PR3 — the standalone in-page kanban. A fresh little board you start right
// inside a page, with NO project or tracker behind it. Adam's law: everything
// must render PERFECTLY in markdown — so the board is stored as a clean GFM
// pipe table (columns = lanes, cells = cards) behind an invisible marker:
//
//   <!--kanban-->
//   | To do | Doing | Done |
//   | --- | --- | --- |
//   | Buy cables | Mix song |  |
//
// Every other renderer shows a plain table (the HTML comment is invisible);
// OUR editor lifts it into a draggable-lane board. Byte-stable round-trip:
// serialize(parse(x)) === x. Cards are single-line text; `|` is escaped \|.

import type { MarkdownToken } from '@tiptap/core'
import { Node, mergeAttributes } from '@tiptap/core'
import type { NodeViewProps } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useState } from 'react'
import { IconPlus, IconClose } from '../../components/Icons'

export interface KanbanLane {
  title: string
  cards: string[]
}

const esc = (s: string) => s.replace(/\|/g, '\\|')
const unesc = (s: string) => s.replace(/\\\|/g, '|')

/** Split one `| a | b |` table row into trimmed cells, honouring \| escapes. */
function splitRow(row: string): string[] {
  const inner = row.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let cur = ''
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '\\' && inner[i + 1] === '|') {
      cur += '\\|'
      i++
    } else if (ch === '|') {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur.trim())
  return cells
}

export function lanesToMarkdown(lanes: KanbanLane[]): string {
  const safe = lanes.length ? lanes : [{ title: 'To do', cards: [] }]
  const header = `| ${safe.map((l) => esc(l.title) || ' ').join(' | ')} |`
  const sep = `| ${safe.map(() => '---').join(' | ')} |`
  const depth = Math.max(0, ...safe.map((l) => l.cards.length))
  const rows: string[] = []
  for (let i = 0; i < depth; i++) {
    rows.push(`| ${safe.map((l) => esc(l.cards[i] ?? '')).join(' | ')} |`)
  }
  return [header, sep, ...rows].join('\n')
}

export function markdownToLanes(table: string): KanbanLane[] {
  const lines = table
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'))
  if (lines.length < 2) return [{ title: 'To do', cards: [] }]
  const titles = splitRow(lines[0]).map(unesc)
  const lanes: KanbanLane[] = titles.map((t) => ({ title: t.trim(), cards: [] }))
  for (const line of lines.slice(2)) {
    const cells = splitRow(line)
    cells.forEach((cell, i) => {
      if (i < lanes.length && cell) lanes[i].cards.push(unesc(cell))
    })
  }
  return lanes
}

// ——— the node view ————————————————————————————————————————————————————————

function KanbanView({ node, updateAttributes }: NodeViewProps) {
  const lanes = (node.attrs.lanes as KanbanLane[]) ?? []
  const write = (next: KanbanLane[]) => updateAttributes({ lanes: next })

  // Which card is being edited: "lane:index", or `new:lane` for the add-row.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const clone = () => lanes.map((l) => ({ title: l.title, cards: [...l.cards] }))

  const commitCard = (li: number, ci: number | 'new') => {
    const text = draft.trim().replace(/\n/g, ' ')
    const next = clone()
    if (ci === 'new') {
      if (text) next[li].cards.push(text)
    } else if (text) {
      next[li].cards[ci] = text
    } else {
      next[li].cards.splice(ci, 1)
    }
    setEditing(null)
    setDraft('')
    write(next)
  }

  const moveCard = (li: number, ci: number, dir: -1 | 1) => {
    const to = li + dir
    if (to < 0 || to >= lanes.length) return
    const next = clone()
    const [card] = next[li].cards.splice(ci, 1)
    next[to].cards.push(card)
    write(next)
  }

  const removeCard = (li: number, ci: number) => {
    const next = clone()
    next[li].cards.splice(ci, 1)
    write(next)
  }

  const renameLane = (li: number, title: string) => {
    const next = clone()
    next[li].title = title.trim() || next[li].title
    setEditing(null)
    write(next)
  }

  const addLane = () => {
    write([...clone(), { title: `Lane ${lanes.length + 1}`, cards: [] }])
  }

  const removeLane = (li: number) => {
    if (lanes.length <= 1) return
    if (lanes[li].cards.length > 0 && !window.confirm(`Delete “${lanes[li].title}” and its ${lanes[li].cards.length} card(s)?`)) {
      return
    }
    const next = clone()
    next.splice(li, 1)
    write(next)
  }

  return (
    <NodeViewWrapper className="kanban-wrap" contentEditable={false}>
      <div className="kanban" data-testid="kanban">
        {lanes.map((lane, li) => (
          <div className="kanban-lane" key={li} data-testid="kanban-lane">
            <div className="kanban-lane-head">
              {editing === `lane:${li}` ? (
                <input
                  autoFocus
                  className="kanban-input"
                  defaultValue={lane.title}
                  onBlur={(e) => renameLane(li, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameLane(li, (e.target as HTMLInputElement).value)
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <button
                  className="kanban-lane-title"
                  title="Rename lane"
                  onClick={() => setEditing(`lane:${li}`)}
                >
                  {lane.title}
                  <span className="kanban-count">{lane.cards.length}</span>
                </button>
              )}
              <button
                className="kanban-lane-del"
                title="Delete lane"
                onClick={() => removeLane(li)}
              >
                <IconClose size={10} />
              </button>
            </div>

            {lane.cards.map((card, ci) =>
              editing === `${li}:${ci}` ? (
                <input
                  key={ci}
                  autoFocus
                  className="kanban-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitCard(li, ci)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitCard(li, ci)
                    if (e.key === 'Escape') setEditing(null)
                  }}
                />
              ) : (
                <div className="kanban-card" key={ci} data-testid="kanban-card">
                  <button
                    className="kanban-card-text"
                    title="Click to edit"
                    onClick={() => {
                      setEditing(`${li}:${ci}`)
                      setDraft(card)
                    }}
                  >
                    {card}
                  </button>
                  <span className="kanban-card-tools">
                    <button title="Move left" disabled={li === 0} onClick={() => moveCard(li, ci, -1)}>
                      ◀
                    </button>
                    <button title="Move right" disabled={li === lanes.length - 1} onClick={() => moveCard(li, ci, 1)}>
                      ▶
                    </button>
                    <button title="Delete card" onClick={() => removeCard(li, ci)}>
                      <IconClose size={9} />
                    </button>
                  </span>
                </div>
              ),
            )}

            {editing === `new:${li}` ? (
              <input
                autoFocus
                className="kanban-input"
                placeholder="Card text…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commitCard(li, 'new')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCard(li, 'new')
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <button
                className="kanban-add"
                data-testid="kanban-add-card"
                onClick={() => {
                  setEditing(`new:${li}`)
                  setDraft('')
                }}
              >
                <IconPlus size={11} /> Add
              </button>
            )}
          </div>
        ))}
        <button className="kanban-add-lane" data-testid="kanban-add-lane" title="Add lane" onClick={addLane}>
          <IconPlus size={12} /> Lane
        </button>
      </div>
    </NodeViewWrapper>
  )
}

// ——— the node + markdown round-trip ————————————————————————————————————————

const KANBAN_RE = /^<!--kanban-->\n((?:\|[^\n]*\|(?:\n|$))+)(?:\n+|$)/

interface KanbanToken extends MarkdownToken {
  lanes?: KanbanLane[]
}

export const Kanban = Node.create({
  name: 'kanban',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      lanes: {
        default: [] as KanbanLane[],
        parseHTML: (el) => {
          try {
            return JSON.parse(el.getAttribute('data-lanes') ?? '[]') as KanbanLane[]
          } catch {
            return []
          }
        },
        renderHTML: (attrs) => ({ 'data-lanes': JSON.stringify(attrs.lanes ?? []) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-kanban]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-kanban': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(KanbanView)
  },

  renderMarkdown: (node) => {
    const lanes = ((node.attrs as { lanes?: KanbanLane[] })?.lanes ?? []) as KanbanLane[]
    return `<!--kanban-->\n${lanesToMarkdown(lanes)}\n\n`
  },

  markdownTokenName: 'kanban',
  parseMarkdown: (token, h) => {
    const t = token as KanbanToken
    return h.createNode('kanban', { lanes: t.lanes ?? [] }, [])
  },
  markdownTokenizer: {
    name: 'kanban',
    level: 'block',
    start: (src: string) => src.indexOf('<!--kanban-->'),
    tokenize(src) {
      const match = KANBAN_RE.exec(src)
      if (!match) return undefined
      return {
        type: 'kanban',
        raw: match[0],
        lanes: markdownToLanes(match[1]),
      } as KanbanToken
    },
  },
})
