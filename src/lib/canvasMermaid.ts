// Turning a canvas into mermaid.
//
// 🔴 GENERATED, NEVER STORED. Mermaid can hold neither positions nor arrows'
// geometry, so it cannot be the canvas's storage — it is a view produced on
// demand when a readable, portable, GitHub-renderable copy is wanted. Because
// it is generated, it cannot drift from the board.
//
// ⚠️ LOSSY ON LAYOUT, BY DESIGN. Mermaid runs its own layout, so the export
// carries the GRAPH — nodes, hierarchy, links, labels — not the picture. The
// arrangement you built is not what comes out the other side.
//
// 🔴 ALWAYS `flowchart LR`, NEVER `mindmap` — even for a pure tree.
//
// The spec originally said a tree should export as a mindmap. Rendering a real
// 33-node map proved that wrong: mermaid's mindmap renderer lays out RADIALLY,
// branching in every direction, which is the exact shape the map-mode brief
// names as having failed ("~120 nodes, radial, branching every direction —
// unreadable, abandoned"; "anti-goals: radial / spider layouts").
//
// `flowchart LR` renders the same data as a left-to-right spine — one trunk,
// sections in a column, depth to the right — which is what the canvas shows and
// what is actually readable. The init directive makes the edges step at right
// angles rather than curve: "vertical and horizontal, nothing insane".

export interface MermaidCard {
  path: string
  parent: string | null
  order: number
  label: string
}
export interface MermaidEdge {
  from: string
  to: string
  label: string
}

export interface MermaidExport {
  text: string
  /** Always 'flowchart' — a mindmap renders radially, which is unreadable. */
  kind: 'flowchart'
  /** Why this dialect was chosen — shown to the user, not a debug string. */
  reason: string
  nodeCount: number
  linkCount: number
  /** True when nothing is joined to anything — the export is boxes, not a map. */
  structureless: boolean
}

/** Mermaid node text: one line, no quotes that would end the string early. */
function esc(label: string): string {
  const clean = (label ?? '')
    .replace(/\s+/g, ' ')
    .replace(/"/g, "'")
    .trim()
    .slice(0, 120)
  return clean || 'Untitled'
}

interface Node extends MermaidCard {
  id: string
  children: Node[]
}

function buildForest(cards: MermaidCard[]): Node[] {
  const byPath = new Map(cards.map((c) => [c.path, { ...c, id: '', children: [] } as Node]))
  const roots: Node[] = []
  for (const node of byPath.values()) {
    const parent = node.parent ? byPath.get(node.parent) : undefined
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (a: Node, b: Node) => a.order - b.order || a.path.localeCompare(b.path)
  roots.sort(sort)

  // Assign ids in reading order (top to bottom, depth first) so the mermaid
  // source reads in the same order as the map.
  let n = 0
  const seen = new Set<string>()
  const walk = (node: Node) => {
    if (seen.has(node.path)) return
    seen.add(node.path)
    node.id = `n${n++}`
    node.children.sort(sort)
    node.children.forEach(walk)
  }
  roots.forEach(walk)
  // A parent cycle would leave nodes unvisited; surface them as extra trunks
  // rather than dropping them from the export.
  for (const node of byPath.values()) {
    if (!seen.has(node.path)) {
      walk(node)
      roots.push(node)
    }
  }
  return roots
}

export function toMermaid(cards: MermaidCard[], edges: MermaidEdge[]): MermaidExport {
  const roots = buildForest(cards)
  const known = new Set(cards.map((c) => c.path))
  const links = edges.filter((e) => known.has(e.from) && known.has(e.to))
  const idOf = new Map<string, string>()
  const collect = (n: Node) => {
    idOf.set(n.path, n.id)
    n.children.forEach(collect)
  }
  roots.forEach(collect)

  // Kept as a fact about the data, not a dialect switch — see the note above.
  const isTree = links.length === 0 && roots.length === 1
  // Nothing joined to anything: every card is its own trunk. Valid mermaid,
  // but a row of disconnected boxes rather than a diagram — say so plainly
  // instead of reporting the technically-true "more than one trunk".
  const structureless = links.length === 0 && roots.length === cards.length && cards.length > 1
  const reason = isTree
    ? 'One trunk and no cross-links — a tree, exported as a left-to-right flowchart so it reads as a spine rather than a radial burst.'
    : structureless
      ? 'Nothing on this board is connected to anything, so this exports as a row of separate boxes rather than a diagram. Build it in Map mode — Enter for a sibling, Tab for a child — and the export becomes a real tree.'
      : links.length > 0
        ? 'This board has cross-links, and a mindmap is strictly a tree — so it exports as a flowchart, which can hold them.'
        : 'This board has more than one trunk, which a mindmap cannot express — so it exports as a flowchart.'

  const out: string[] = [
    // Right-angle edges. Mermaid's default curve is a bezier.
    '%%{init: {"flowchart": {"curve": "stepBefore"}} }%%',
    'flowchart LR',
  ]
  const decls: string[] = []
  const treeLinks: string[] = []
  const walk = (n: Node) => {
    decls.push(`  ${n.id}["${esc(n.label)}"]`)
    for (const c of n.children) {
      treeLinks.push(`  ${n.id} --> ${c.id}`)
      walk(c)
    }
  }
  roots.forEach(walk)
  out.push(...decls, ...treeLinks)
  for (const e of links) {
    const a = idOf.get(e.from)
    const b = idOf.get(e.to)
    if (!a || !b) continue
    const label = esc(e.label)
    out.push(label === 'Untitled' ? `  ${a} -.-> ${b}` : `  ${a} -.->|"${label}"| ${b}`)
  }
  return {
    text: out.join('\n'),
    kind: 'flowchart',
    reason,
    nodeCount: idOf.size,
    linkCount: links.length,
    structureless,
  }
}

/** The export wrapped in a fence, ready to drop into a note. */
export function toMermaidFence(exp: MermaidExport): string {
  return '```mermaid\n' + exp.text + '\n```'
}
