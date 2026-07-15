/**
 * Tiny subsequence fuzzy matcher. Returns a score (higher = better) or null
 * when the query is not a subsequence of the target. Favors word-boundary
 * and consecutive hits.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (!q) return 0
  let score = 0
  let ti = 0
  let lastHit = -2
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]!
    if (ch === ' ') continue
    const found = t.indexOf(ch, ti)
    if (found === -1) return null
    score += 1
    if (found === lastHit + 1) score += 2 // consecutive
    if (found === 0 || t[found - 1] === ' ' || t[found - 1] === '-' || t[found - 1] === '/') {
      score += 3 // word boundary
    }
    lastHit = found
    ti = found + 1
  }
  // Prefer shorter targets when scores tie.
  return score - t.length / 200
}

/**
 * Any-order token prefix matcher for link targets, alongside fuzzyScore in
 * both `[[` autocomplete and the Link picker. The query splits on whitespace;
 * a target matches when EVERY token prefix-matches some word of its title or
 * path (words split on spaces, `-`, `_`, `/`) — so "bree jo" (and "jo bree")
 * hit "Bree Jonathan" / "people/bree-jonathan", where the subsequence matcher
 * gives up. Matches whose tokens all land in the TITLE outscore path-assisted
 * ones. Returns a score (comparable with fuzzyScore's range) or null.
 */
export function tokenPrefixScore(
  query: string,
  title: string,
  path: string,
): number | null {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null
  const titleWords = title.toLowerCase().split(/[\s\-_/]+/).filter(Boolean)
  const pathWords = path.toLowerCase().split(/[\s\-_/]+/).filter(Boolean)
  let score = 0
  let allInTitle = true
  for (const tok of tokens) {
    if (titleWords.some((w) => w.startsWith(tok))) {
      score += 10
    } else if (pathWords.some((w) => w.startsWith(tok))) {
      score += 6
      allInTitle = false
    } else {
      return null // every token must land somewhere
    }
  }
  if (allInTitle) score += 8 // full title coverage beats path-only hits
  // Prefer shorter targets when scores tie (fuzzyScore's own tiebreak).
  return score - title.length / 200
}
