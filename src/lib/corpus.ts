// The shared full-vault corpus cache — ONE cache, 60s staleness, extracted
// from the Omnibar (Craft Phase B) so the Tasks tab's loose-checkbox scanner
// reads the SAME corpus the Omnibar searches, never a second fork. Callers
// keep whatever list they already rendered while a refresh is in flight —
// stale results beat a blank surface (the Omnibar's original law).

import { fetchAllNotes } from './store'
import type { Note } from './types'

const STALE_MS = 60_000

let cache: { at: number; notes: Note[] } | null = null

/** Whatever we hold right now (possibly stale), or null before first load. */
export function cachedCorpus(): Note[] | null {
  return cache?.notes ?? null
}

/** True while the cache is younger than the 60s staleness rule. */
export function corpusFresh(): boolean {
  return cache !== null && Date.now() - cache.at <= STALE_MS
}

/** Fetch every note WITH content and stamp the cache. Rejections bubble —
 * each surface decides how quietly to fail. */
export async function refreshCorpus(): Promise<Note[]> {
  const notes = await fetchAllNotes()
  cache = { at: Date.now(), notes }
  return notes
}
