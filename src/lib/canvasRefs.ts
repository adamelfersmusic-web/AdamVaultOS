// Ref cards — a card that points at a note you already wrote.
//
// 🔑 THE POINTER IS AN ID, NOT A PATH. A path says where a note is today; an
// id says which note it is. Re-file the target — in the Files browser, in
// Parachute, anywhere — and a path-keyed card is silently dead, which you'd
// discover weeks later with a map full of blanks. An id-keyed card follows the
// note and shows its new home. The path is stored too, but for exactly one
// job: naming the target if it is ever DELETED, when there is no note left to
// ask where it went.
//
// A ref is still `ckind: 'card'`. That is the whole trick: groups, map layout,
// mermaid export, plane extents, board counts and the clutter filter all keep
// working with no new branch. Only the rendering and the double-click differ.
//
// Pure and DOM-free, so the resolution rules are testable without a browser.

/** What a card stores when it points somewhere. */
export interface CardRef {
  /** The target note's id — the durable half. */
  id: string
  /** Where it lived when you linked it. A fallback label, never a lookup key. */
  path: string
}

/** The lean note shape this module needs — a list row, no content required. */
export interface RefLookup {
  id: string
  path: string
  preview?: string
  metadata?: Record<string, unknown>
}

/** A resolved ref, ready to render. `missing` still names what it pointed at,
 * because a card that goes blank tells you nothing about what you lost. */
export type ResolvedRef =
  | { status: 'ok'; path: string; title: string; summary: string; moved: boolean }
  | { status: 'missing'; path: string; title: string }
  | { status: 'loading'; path: string; title: string }

/** The ref a card carries, or null if it is an ordinary card.
 * Both halves must be present — a ref with no id could only be resolved by
 * path, which is the failure mode this whole module exists to avoid. */
export function refOf(metadata: Record<string, unknown> | undefined): CardRef | null {
  const id = metadata?.['ref']
  const path = metadata?.['refPath']
  if (typeof id !== 'string' || !id) return null
  return { id, path: typeof path === 'string' ? path : '' }
}

/** The display title for a vault path — the last segment, de-slugged.
 * The same rule the [[ menu and the link picker use, so a note is called the
 * same thing wherever you meet it. */
export function titleForPath(path: string): string {
  const slug = path.split('/').filter(Boolean).pop() ?? path
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Look the target up BY ID and describe what to draw.
 *
 * `byId` is the vault's own list — the cached one the [[ menu already loads,
 * so a board full of refs costs no extra fetch. Pass null while it is still
 * loading: a ref is then 'loading', NOT 'missing'. Reporting a note as gone
 * because the index hasn't arrived yet would be a lie the user has no way to
 * check.
 */
export function resolveRef(ref: CardRef, byId: Map<string, RefLookup> | null): ResolvedRef {
  if (byId === null) {
    return { status: 'loading', path: ref.path, title: titleForPath(ref.path) }
  }
  const found = byId.get(ref.id)
  if (!found) {
    return { status: 'missing', path: ref.path, title: titleForPath(ref.path) }
  }
  const summaryRaw = found.metadata?.['summary']
  const summary =
    typeof summaryRaw === 'string' && summaryRaw.trim()
      ? summaryRaw.trim()
      : (found.preview ?? '').trim()
  return {
    status: 'ok',
    path: found.path,
    title: titleForPath(found.path),
    summary,
    // The note has been re-filed since you linked it. Not an error — the point
    // of keying by id — but worth showing, because the map's label changed.
    moved: ref.path !== '' && found.path !== ref.path,
  }
}

/** Index a note list by id, for resolveRef. */
export function indexById(notes: readonly RefLookup[]): Map<string, RefLookup> {
  return new Map(notes.map((n) => [n.id, n]))
}
