// The path rail — a folder tree over note paths, the mirror of the tag rail.
//
// This is a deliberate COPY of the tag tree in LibraryView, not a shared
// abstraction. Tags and paths are the same shape (slash-delimited hierarchies
// of strings with counts, filtering the same note list) but the tag rail is the
// daily driver and works; duplicating one small component is cheaper and safer
// than refactoring it. Do not "unify" these.
//
// Difference from the tag tree: a tag's last segment IS the tag, but a path's
// last segment is the note's own filename — so folders come from the path minus
// its final segment. Notes at the root (no "/") have no folder and collect
// under "Unfiled".

import type { Note } from '../lib/types'

/** Root bucket for notes whose path carries no folder at all. */
export const UNFILED = 'Unfiled'

export interface PathNode {
  /** Segment shown at this depth ("strategy"). */
  seg: string
  /** Full path prefix ("_priority/escensus/strategy"). */
  full: string
  /** Notes filed at this prefix or below it. */
  total: number
  children: PathNode[]
}

/** A note lives under `prefix` if it sits directly in it or in any descendant. */
export function noteInPath(n: Note, prefix: string): boolean {
  if (prefix === UNFILED) return !(n.path ?? '').includes('/')
  const p = n.path ?? ''
  return p.startsWith(`${prefix}/`)
}

export function buildPathTree(all: Note[]): PathNode[] {
  interface Build {
    seg: string
    full: string
    notes: Set<string>
    children: Map<string, Build>
  }
  const roots = new Map<string, Build>()
  const add = (segs: string[], notePath: string) => {
    let level = roots
    let prefix = ''
    for (const seg of segs) {
      prefix = prefix ? `${prefix}/${seg}` : seg
      let node = level.get(seg)
      if (!node) {
        node = { seg, full: prefix, notes: new Set(), children: new Map() }
        level.set(seg, node)
      }
      node.notes.add(notePath) // every ancestor folder counts this note
      level = node.children
    }
  }
  for (const n of all) {
    const segs = (n.path ?? '').split('/').filter(Boolean)
    // Drop the filename — the folders are everything above it.
    const folders = segs.slice(0, -1)
    if (folders.length === 0) add([UNFILED], n.path)
    else add(folders, n.path)
  }
  const finish = (m: Map<string, Build>): PathNode[] =>
    [...m.values()]
      .map((b) => ({ seg: b.seg, full: b.full, total: b.notes.size, children: finish(b.children) }))
      .sort((a, b) => b.total - a.total || a.seg.localeCompare(b.seg))
  return finish(roots)
}

export function PathTreeRow({
  node,
  depth,
  activePath,
  expanded,
  onToggle,
  onSelect,
}: {
  node: PathNode
  depth: number
  activePath: string | null
  expanded: Set<string>
  onToggle: (full: string) => void
  onSelect: (full: string) => void
}) {
  const hasKids = node.children.length > 0
  const open = expanded.has(node.full)
  return (
    <>
      <div
        className={`tag-rail-item tag-tree-item${activePath === node.full ? ' is-active' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
      >
        {hasKids ? (
          <button
            className="tag-tree-chevron"
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.full)
            }}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tag-tree-chevron tag-tree-chevron-none" />
        )}
        <button className="tag-tree-name" onClick={() => onSelect(node.full)}>
          <span className="tag-rail-name">{depth === 0 ? node.full : node.seg}</span>
          <span className="tag-rail-count">{node.total}</span>
        </button>
      </div>
      {hasKids &&
        open &&
        node.children.map((c) => (
          <PathTreeRow
            key={c.full}
            node={c}
            depth={depth + 1}
            activePath={activePath}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}
