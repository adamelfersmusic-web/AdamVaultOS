// SEMANTIC LINK CANDIDATES — the shared meaning-tail for the two link-entry
// surfaces: the inline `[[` wikilink suggester and the Link picker. Link-time
// is exactly when you can't remember a note's NAME — so after the keyword
// matches, these surfaces append a few notes that match by MEANING (the same
// local vector index behind the Omnibar's ✨ Related group).
//
// Contract (every caller relies on all of it):
//   · resolves [] for queries under 3 chars, when the index isn't ready, or
//     when nothing clears SEMANTIC_FLOOR (enforced inside semanticSearch);
//   · never surfaces a path in `excludePaths` (keyword hits, the current
//     note) — exact matches are sacred, no echoes;
//   · caps at 3 — a link dropdown wants a hint, not a result list;
//   · NEVER throws or rejects — a broken semantic tail must never break
//     link entry itself.

import { semanticSearch, semanticStatus } from './index'
import type { SemanticHit } from './index'

/** Hard ceiling on semantic rows in a link dropdown. */
const LINK_CANDIDATE_CAP = 3
/** Under this many chars a query carries no meaning worth guessing at. */
const MIN_QUERY_CHARS = 3

/**
 * Meaning-ish link targets for `query`, best first. See the contract above.
 *
 * CONSUME-ONLY, by design: if the vector index has never been built this
 * session (`semanticStatus().ready` — the exact flag the Omnibar reads), this
 * resolves [] rather than triggering a build. Index building belongs to the
 * Omnibar's corpus flow (syncSemanticIndex piggybacks its corpus fetch);
 * a link dropdown only ever consumes a ready index — kicking off a
 * whole-vault embedding pass mid-keystroke is not its job.
 */
export async function semanticLinkCandidates(
  query: string,
  excludePaths: Set<string>,
  k: number = LINK_CANDIDATE_CAP,
): Promise<SemanticHit[]> {
  try {
    const q = query.trim()
    if (q.length < MIN_QUERY_CHARS) return []
    if (!semanticStatus().ready) return []
    const cap = Math.min(Math.max(k, 0), LINK_CANDIDATE_CAP)
    if (cap === 0) return []
    // Over-fetch past the cap: exclusions eat candidates after scoring.
    const hits = await semanticSearch(q, cap + excludePaths.size + 4)
    return hits.filter((h) => !excludePaths.has(h.path)).slice(0, cap)
  } catch {
    return []
  }
}
