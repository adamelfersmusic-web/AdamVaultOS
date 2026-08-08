// Map mode's layout engine — the part that guarantees a spine.
//
// Auto-placement is not a convenience that saves dragging. A hand-dragged board
// drifts into a blob within twenty nodes; this is what makes a 150-node map
// readable every time without anyone thinking about position.
//
// The five checkable properties of "calm", from the brief:
//   1. every node at a given depth shares the same x   → columns, not a staircase
//   2. one vertical gap value between siblings         → consistent rhythm
//   3. edges are horizontal/vertical only              → drawn by the caller
//   4. a pure tree has zero crossing lines             → guaranteed by construction
//   5. a collapsed branch leaves no gap                → the column closes up
//
// Pure and DOM-free on purpose: heights are measured by the caller and passed
// in, so the whole engine is testable without a browser.

/** One card, as the layout needs to see it. */
export interface LayoutInput {
  path: string
  /** Parent card's path; null/absent makes it a trunk. */
  parent: string | null
  /** Sibling ordering, 10-spaced. Ties break on path so it is never random. */
  order: number
  /** Measured height. Cards wrap and grow, so this varies wildly per node. */
  height: number
  collapsed: boolean
}

export interface Placed {
  path: string
  x: number
  y: number
  depth: number
  /** Children exist but are hidden — the caller draws a collapsed affordance. */
  collapsedWithChildren: boolean
  hasChildren: boolean
}

export interface LayoutResult {
  placed: Placed[]
  /** Parent→child pairs that are actually visible, for the caller to draw. */
  links: { from: string; to: string }[]
  width: number
  height: number
}

/** One fixed card width in map mode — uniform columns need a uniform width. */
export const MAP_CARD_W = 240
// The map starts well into the plane, not at its corner. There is no negative
// space (card x/y are clamped at 0), so a tree laid out at the origin can never
// be scrolled into the middle of the screen — it just sits against the edge.
export const MAP_X0 = 640
export const MAP_Y0 = 420
/** Horizontal gap between columns, vertical gap between siblings. One value
 * each: the rhythm has to be consistent or the map reads as a staircase. */
export const MAP_H_GAP = 90
export const MAP_V_GAP = 24

/**
 * Place a forest of cards as left-to-right tidy trees.
 *
 * A node's children sit in a column to its right; the parent centres against
 * that column. Depth determines x alone, so every node at a depth shares it.
 */
export function layoutMap(cards: LayoutInput[]): LayoutResult {
  const byPath = new Map(cards.map((c) => [c.path, c]))
  const children = new Map<string, LayoutInput[]>()
  const roots: LayoutInput[] = []

  for (const c of cards) {
    // A parent that no longer exists (deleted card) must not orphan its
    // subtree into invisibility — treat it as a trunk instead.
    const p = c.parent && byPath.has(c.parent) ? c.parent : null
    if (p === null) roots.push(c)
    else children.set(p, [...(children.get(p) ?? []), c])
  }

  const bySort = (a: LayoutInput, b: LayoutInput) =>
    a.order - b.order || a.path.localeCompare(b.path)
  roots.sort(bySort)
  for (const list of children.values()) list.sort(bySort)

  // A cycle (only reachable through a corrupted parent) must not hang the app.
  const seen = new Set<string>()
  const kidsOf = (path: string): LayoutInput[] =>
    (children.get(path) ?? []).filter((c) => !seen.has(c.path))

  const placed: Placed[] = []
  const links: { from: string; to: string }[] = []
  // Depth → x. Every column is one card wide, so x is a pure function of depth.
  const xAt = (depth: number) => MAP_X0 + depth * (MAP_CARD_W + MAP_H_GAP)

  let cursorY = MAP_Y0

  /** Place `node` and its visible subtree; returns the node's own y. */
  const walk = (node: LayoutInput, depth: number): number => {
    seen.add(node.path)
    const kids = kidsOf(node.path)
    const hasChildren = kids.length > 0
    const showKids = hasChildren && !node.collapsed

    if (!showKids) {
      // A collapsed node's descendants are deliberately unplaced. Mark them
      // seen anyway, or the cycle-recovery pass below adopts every one of them
      // as a loose trunk and collapsing a branch scatters it across the board.
      if (hasChildren) {
        const hide = (p: string) => {
          for (const k of children.get(p) ?? []) {
            if (seen.has(k.path)) continue
            seen.add(k.path)
            hide(k.path)
          }
        }
        hide(node.path)
      }
      // Leaf (or collapsed): take the next slot. A collapsed branch consumes
      // exactly one node's worth of space — the column closes up.
      const y = cursorY
      cursorY += node.height + MAP_V_GAP
      placed.push({
        path: node.path,
        x: xAt(depth),
        y,
        depth,
        hasChildren,
        collapsedWithChildren: hasChildren && node.collapsed,
      })
      return y
    }

    const childYs = kids.map((k) => {
      const cy = walk(k, depth + 1)
      links.push({ from: node.path, to: k.path })
      return { y: cy, h: k.height }
    })
    // Centre the parent against the band its children occupy.
    const first = childYs[0]
    const last = childYs[childYs.length - 1]
    const bandTop = first.y
    const bandBottom = last.y + last.h
    const y = Math.max(MAP_Y0, bandTop + (bandBottom - bandTop) / 2 - node.height / 2)
    placed.push({
      path: node.path,
      x: xAt(depth),
      y,
      depth,
      hasChildren: true,
      collapsedWithChildren: false,
    })
    // A parent taller than its whole child band would otherwise overlap the
    // next trunk — keep the cursor below it.
    cursorY = Math.max(cursorY, y + node.height + MAP_V_GAP)
    return y
  }

  for (const r of roots) {
    if (seen.has(r.path)) continue
    walk(r, 0)
  }
  // Anything left unvisited sat in a parent cycle; place it as its own trunk
  // so a corrupted field can never make a card disappear from the board.
  for (const c of cards) {
    if (seen.has(c.path)) continue
    walk(c, 0)
  }

  let width = 0
  let height = 0
  for (const p of placed) {
    width = Math.max(width, p.x + MAP_CARD_W)
    const card = byPath.get(p.path)
    height = Math.max(height, p.y + (card?.height ?? 0))
  }
  return { placed, links, width, height }
}

/** Next sibling `order`, 10-spaced, inserted directly after `afterOrder`. */
export function orderAfter(siblings: { order: number }[], afterOrder: number | null): number {
  const sorted = [...siblings].map((s) => s.order).sort((a, b) => a - b)
  if (afterOrder === null) return (sorted[0] ?? 10) - 10
  const next = sorted.find((o) => o > afterOrder)
  return next === undefined ? afterOrder + 10 : (afterOrder + next) / 2
}
