// The Pages writing surface — the block editor over Adam's real notes.
//
// LISTING vs CREATING are two different scopes here:
//   • Listing (the sidebar) shows ALL of Adam's notes — every folder
//     (Amanda/, Atelier/, atelier/, …) — EXCEPT the productivity layer
//     (`tag:task`), which lives on its own board. See store.loadPages().
//   • Creating ("New page") still mints a freeform note under `pages/`,
//     tagged `type/page`, so brand-new pages have a clean, flat home.
//
// The editor (PageEditor) loads ANY note by path and edits it in Tiptap with
// markdown stored under the hood — so a folder note like Amanda/00-home opens
// as blocks, never raw markdown.

import type { NoteMetadata } from '../lib/types'

export const PAGES_PREFIX = 'pages/'
export const PAGE_TAG = 'type/page'

/**
 * The productivity-layer tag. Notes carrying it are first-class tasks
 * (Tier 2's Board/Table/Gallery) and are kept OUT of the Pages knowledge
 * listing so the two layers never bleed into each other.
 */
export const TASK_TAG = 'task'

/** Tags + metadata + path prefix stamped onto notes created as pages. */
export const NEW_PAGE: {
  pathPrefix: string
  tags: string[]
  metadata: NoteMetadata
} = {
  pathPrefix: PAGES_PREFIX,
  tags: [PAGE_TAG],
  metadata: {},
}

/** Body seed for a brand-new page: just an H1 of the title. */
export function newPageContent(title: string): string {
  return `# ${title.trim()}\n`
}
