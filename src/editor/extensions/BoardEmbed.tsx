// T6 — a live kanban board INSIDE a page (the Notion move, done the vault
// way). In markdown the embed is ONE harmless line:
//
//   ![[board:amanda]]
//
// Every other renderer shows that line as text; our editor renders the real
// Tracker board scoped to the project — the SAME task notes, zero duplicated
// data. Drag a card here and the vault task updates, same as the Tracker tab.

import type { JSONContent, MarkdownToken } from '@tiptap/core'
import { Node, mergeAttributes } from '@tiptap/core'
import type { NodeViewProps } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useEffect, useMemo } from 'react'
import { loadProjects, useStore } from '../../lib/store'
import { toProjects } from '../../domain/projects'
import { TRACKER_DB } from '../../domain/tracker'
import { DatabaseView } from '../../views/DatabaseView'

const MARKER_RE = /^!\[\[board:([a-z0-9-]*)(?::(table|board|gallery))?\]\]$/
const LENSES = ['table', 'board', 'gallery'] as const
type EmbedLens = (typeof LENSES)[number]

function BoardEmbedView({ node, updateAttributes }: NodeViewProps) {
  const project = ((node.attrs.project as string) || '').trim()
  const lens = (LENSES as readonly string[]).includes(node.attrs.lens as string)
    ? (node.attrs.lens as EmbedLens)
    : 'board'
  const { projects, projectsStatus, notes } = useStore()

  useEffect(() => {
    if (!project && projectsStatus === 'idle') void loadProjects()
  }, [project, projectsStatus])

  const options = useMemo(
    () => toProjects((projects ?? []).map((p) => notes[p]).filter(Boolean)),
    [projects, notes],
  )

  return (
    <NodeViewWrapper className="board-embed-wrap" contentEditable={false}>
      {project ? (
        <div className="board-embed" data-testid="board-embed">
          <div className="board-embed-head">
            <span className="board-embed-title">📊 {project}</span>
            <div className="board-embed-lenses" data-testid="board-embed-lenses">
              {LENSES.map((l) => (
                <button
                  key={l}
                  className={l === lens ? 'is-on' : ''}
                  onClick={() => updateAttributes({ lens: l })}
                >
                  {l}
                </button>
              ))}
            </div>
            <a className="board-embed-open" href="#/tracker/board">
              open tracker →
            </a>
          </div>
          <div className="board-embed-body">
            <DatabaseView
              def={TRACKER_DB}
              dataset="tracker"
              presetFilter={{ project: [project] }}
              lensOverride={lens}
              embedded
            />
          </div>
        </div>
      ) : (
        <div className="board-embed board-embed-picker" data-testid="board-embed-picker">
          <span className="board-embed-title">📊 Board of which project?</span>
          <div className="board-embed-choices">
            {options.map((p) => (
              <button key={p.key} onClick={() => updateAttributes({ project: p.key })}>
                {p.title}
              </button>
            ))}
            {options.length === 0 && <span className="board-embed-none">no projects yet</span>}
          </div>
        </div>
      )}
    </NodeViewWrapper>
  )
}

export const BoardEmbed = Node.create({
  name: 'boardEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      project: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-project') ?? '',
        renderHTML: (attrs) => ({ 'data-project': attrs.project }),
      },
      // The embed's view lives in the MARKER (![[board:key:table]]), so each
      // embed remembers its own lens and it round-trips as plain text.
      lens: {
        default: 'board',
        parseHTML: (el) => el.getAttribute('data-lens') ?? 'board',
        renderHTML: (attrs) => ({ 'data-lens': attrs.lens }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-board-embed]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-board-embed': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BoardEmbedView)
  },

  renderMarkdown: (node) => {
    const project = ((node.attrs?.project as string) ?? '').trim()
    const lens = (node.attrs?.lens as string) ?? 'board'
    const suffix = lens && lens !== 'board' ? `:${lens}` : ''
    return `![[board:${project}${suffix}]]\n\n`
  },

  // Parse the marker straight from markdown so reloads restore the board.
  markdownTokenName: 'boardEmbed',
  parseMarkdown: (token, h) => {
    const t = token as MarkdownToken & { project?: string; lens?: string }
    return h.createNode('boardEmbed', { project: t.project ?? '', lens: t.lens ?? 'board' }, [])
  },
  markdownTokenizer: {
    name: 'boardEmbed',
    level: 'block',
    start: (src: string) => src.indexOf('![[board:'),
    tokenize(src) {
      const match = /^!\[\[board:([a-z0-9-]*)(?::(table|board|gallery))?\]\]\s*(?:\n+|$)/.exec(src)
      if (!match) return undefined
      return {
        type: 'boardEmbed',
        raw: match[0],
        project: match[1],
        lens: match[2] ?? 'board',
      } as MarkdownToken
    },
  },
})

/** Belt-and-braces for docs loaded through paths that skip the tokenizer:
 * convert a paragraph whose whole text is the marker into the node. */
export function convertBoardEmbeds(doc: JSONContent): {
  doc: JSONContent
  changed: boolean
} {
  let changed = false
  const walk = (node: JSONContent): JSONContent => {
    if (!Array.isArray(node.content)) return node
    const next: JSONContent[] = node.content.map((child) => {
      if (
        child.type === 'paragraph' &&
        child.content?.length === 1 &&
        child.content[0].type === 'text'
      ) {
        const m = MARKER_RE.exec(child.content[0].text ?? '')
        if (m) {
          changed = true
          return { type: 'boardEmbed', attrs: { project: m[1], lens: m[2] ?? 'board' } }
        }
      }
      return walk(child)
    })
    return { ...node, content: next }
  }
  return { doc: walk(doc), changed }
}
