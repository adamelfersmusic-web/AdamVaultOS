// Canvas machinery vs. notes you wrote.
//
// A board stores every card, group and arrow as its own vault note under
// `canvas/<board-id>/`. That is the right storage — each card IS a real note,
// which is what lets a card hold a checklist or a kanban, and what a ref-card
// would build on — but it means one mind map with 40 nodes adds 40 rows to
// every surface that lists "all notes". The Signalcraft map alone put 33 of
// them in front of 1,577 real notes; five maps that size would bury the vault.
//
// So the parts are FILTERED, not stored differently: the surfaces you browse
// (Library, Omnibar, the [[ menu, the graph) drop them, and the surface whose
// whole job is to show what's really on disk (the Files browser) keeps them.
// The board note itself is never filtered — a board is a thing you made and
// want to find.
//
// The test is `ckind`, the same field CanvasView switches on, not the path: a
// card's identity is what it IS, not where it happens to live.
//
// Pure and DOM-free, with its own structural input type rather than an import
// of Note, so it stays testable without a browser or the app around it.

export interface Kinded {
  metadata?: Record<string, unknown>
}

/** A card, a group rectangle, or an arrow — canvas machinery, not a note. */
export function isCanvasPart(n: Kinded): boolean {
  const kind = n.metadata?.['ckind']
  return kind === 'card' || kind === 'group' || kind === 'edge'
}

/** The list minus canvas machinery. Boards survive. */
export function withoutCanvasParts<T extends Kinded>(notes: T[]): T[] {
  return notes.filter((n) => !isCanvasPart(n))
}

/** True when a query explicitly asks about canvas storage — `path:canvas/…`.
 * Typing that is a deliberate act, so the parts come back for that one search
 * and no card is ever permanently unreachable. */
export function asksForCanvas(pathConstraints: readonly string[]): boolean {
  return pathConstraints.some((p) => p.toLowerCase().startsWith('canvas'))
}
