// Shelves — Obsidian-style VIRTUAL folders for the Pages sidebar. A shelf is a
// named visual group of notes; membership is display-only and lives in ONE
// plain-markdown vault note (desk/shelves), so the layout is hand-editable,
// syncs across devices, and stays rename-proof: members are stored as real
// [[wikilinks]] (full vault path, exactly the form the editor serializes), so
// the vault's link auto-rewrite carries them through path changes. A shelf
// NEVER touches a member note's path, tags, or links.
//
// Canonical format (parse is forgiving — prose and empty shelves are fine):
//
//   # Shelves
//
//   *Sidebar shelves — visual only; paths never change. Edit freely.*
//
//   ## Shelf Name
//   - [[some/note/path]]

export const SHELVES_PATH = 'desk/shelves'

/** Hard cap — the sidebar is a front door, not a filing cabinet. */
export const SHELF_CAP = 15

export const SHELVES_INTRO =
  '*Sidebar shelves — visual only; paths never change. Edit freely.*'

export interface Shelf {
  name: string
  /** Member note paths, in note order. */
  members: string[]
}

// `## Name` — exactly two hashes (H3+ has a third hash where the required
// whitespace would be, so it can't match).
const SHELF_RE = /^##[ \t]+(.*\S)[ \t]*$/
// A list item whose text contains a [[wikilink]] — first link wins; an
// optional `|alias` is dropped so the stored member is always the bare path.
const MEMBER_RE = /^[ \t]*[-*+][ \t]+.*?\[\[([^[\]|\n]+?)(?:\|[^\]\n]*)?\]\]/

/** H2 headings = shelves (in note order); list items carrying a [[wikilink]]
 * = members (in order). Everything else — the H1, intro prose, stray lines —
 * is ignored gracefully. Empty shelves are valid. */
export function parseShelves(content: string): Shelf[] {
  const shelves: Shelf[] = []
  let current: Shelf | null = null
  for (const line of content.split('\n')) {
    const h2 = line.match(SHELF_RE)
    if (h2) {
      current = { name: h2[1]!, members: [] }
      shelves.push(current)
      continue
    }
    if (!current) continue
    const member = line.match(MEMBER_RE)
    if (member) {
      const target = member[1]!.trim()
      if (target) current.members.push(target)
    }
  }
  return shelves
}

/** Regenerate the canonical note body — shelf and member order preserved,
 * links written as bare `[[path]]` (byte-identical to the editor's own
 * serialization, so the vault's rename rewrite keeps working). */
export function serializeShelves(shelves: Shelf[]): string {
  const out: string[] = ['# Shelves', '', SHELVES_INTRO, '']
  for (const s of shelves) {
    out.push(`## ${s.name}`)
    for (const m of s.members) out.push(`- [[${m}]]`)
    out.push('')
  }
  return out.join('\n').replace(/\n*$/, '\n')
}
