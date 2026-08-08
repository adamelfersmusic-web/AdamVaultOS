// Group geometry.
//
// 🔑 MEMBERSHIP IS GEOMETRIC. A card is in a group because it SITS inside the
// rectangle — there are no stored parent pointers, so nothing can go stale,
// disagree, or need repairing. Move a card out and it is out; that is the whole
// model, and it is why groups cost no schema.
//
// Pure and DOM-free, so the rules are testable without a browser.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export interface Placed extends Rect {
  path: string
}

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })
export const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h)

/**
 * Is `r` inside `g`?
 *
 * By its CENTRE POINT, not full containment. Full containment sounds stricter
 * but behaves worse: a card overhanging the edge by two pixels would silently
 * fall out of the group, and nudging a group's edge would eject things you can
 * plainly see inside it. The centre rule matches what the eye reports.
 */
export function centreIn(r: Rect, g: Rect): boolean {
  const c = centre(r)
  return c.x >= g.x && c.x <= g.x + g.w && c.y >= g.y && c.y <= g.y + g.h
}

/**
 * Everything a drag of `group` should carry: cards and NESTED GROUPS whose
 * centre lies inside it (and, transitively, those groups' own contents).
 *
 * Dragging an outer group moves the inner ones with it — anything else would
 * tear a nested arrangement apart the first time you moved it.
 */
export function contentsOf(
  group: Placed,
  cards: Placed[],
  groups: Placed[],
): { cards: string[]; groups: string[] } {
  const movedGroups = new Set<string>()
  const frontier: Placed[] = [group]
  while (frontier.length) {
    const g = frontier.pop()!
    for (const other of groups) {
      if (other.path === g.path || movedGroups.has(other.path)) continue
      // A group cannot contain itself, and equal rects must not both claim the
      // other — compare area so the pair can never cycle.
      if (centreIn(other, g) && area(other) <= area(g) && other.path !== group.path) {
        movedGroups.add(other.path)
        frontier.push(other)
      }
    }
  }
  const rects = [group, ...groups.filter((g) => movedGroups.has(g.path))]
  const movedCards = new Set<string>()
  for (const c of cards) {
    if (rects.some((r) => centreIn(c, r))) movedCards.add(c.path)
  }
  return { cards: [...movedCards], groups: [...movedGroups] }
}

/**
 * Which group is a card "in", when groups overlap? The innermost — the
 * smallest one containing it. Same rule as folders: the deepest container that
 * holds it wins.
 */
export function innermostGroup(card: Rect, groups: Placed[]): string | null {
  let best: Placed | null = null
  for (const g of groups) {
    if (!centreIn(card, g)) continue
    if (!best || area(g) < area(best)) best = g
  }
  return best?.path ?? null
}

/** How many cards each group holds, counting only the ones it owns outright. */
export function groupCounts(cards: Placed[], groups: Placed[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const g of groups) out[g.path] = 0
  for (const c of cards) {
    const g = innermostGroup(c, groups)
    if (g) out[g] = (out[g] ?? 0) + 1
  }
  return out
}
