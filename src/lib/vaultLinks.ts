// Vault-path links — the ONE place that decides what a stored link means and
// how it opens. Notes carry plain markdown links whose destinations are bare
// vault paths (`[Title](people/arianne/00-profile)`). Those must NEVER escape
// the SPA: a raw <a> click would resolve against the host origin and hard-
// navigate to a 404 (which on GitHub Pages reloads the app hashless — dumping
// the user on the Projects front door). Everything here is click-time routing
// only; the stored markdown is never rewritten.

import { navigate } from './router'
import { fetchNote, getState, toast } from './store'

/** Real scheme (https:, mailto:, tel:, …) or protocol-relative — external. */
const EXTERNAL_HREF = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

/** A link destination counts as a vault path when it is a bare relative path:
 * no scheme, not an in-app `#…` hash, not host-absolute (`/api/storage/…`),
 * not dotted-relative, no query, no whitespace. */
export function isVaultHref(href: string): boolean {
  if (!href) return false
  if (href.startsWith('#')) return false // in-app hash routes work as-is
  if (EXTERNAL_HREF.test(href)) return false
  if (/^[/.?]/.test(href)) return false
  if (/\s/.test(href)) return false
  return true
}

/** Open a vault path by the house note-opening rule (same as the Library,
 * Explore, and Backlinks): `pages/*` opens in the Pages editor, everything
 * else in the note view. A target that provably doesn't exist gets a quiet
 * toast instead of a navigation — never a silent dump onto a default route. */
export async function openVaultPath(path: string): Promise<void> {
  let missing = false
  if (!getState().notes[path]) {
    try {
      missing = (await fetchNote(path)) === null
    } catch {
      // Can't tell (offline, auth hiccup) — navigate and let the route's own
      // missing/error state present it.
      missing = false
    }
  }
  if (missing) {
    toast('info', 'Page not found')
    return
  }
  navigate(path.startsWith('pages/') ? { kind: 'pages', path } : { kind: 'note', path })
}

/** Decode a stored href defensively (a hand-written `%20` should still find
 * the note); a malformed escape falls back to the raw text. */
function decodeHref(href: string): string {
  try {
    return decodeURIComponent(href)
  } catch {
    return href
  }
}

/**
 * One document-level interceptor for every prose surface — the Pages editor,
 * the note/card editors, and all read-only renderMarkdown views (NotePage,
 * Ask AI, canvas cards). Behavior:
 *
 * - vault-path href            → preventDefault, route by the house rule
 * - `#…` hash href             → untouched outside editors; inside a
 *                                contenteditable (where the browser suppresses
 *                                anchor defaults) it is applied manually
 * - external scheme            → untouched in read views (normal browser
 *                                behavior); inside a contenteditable it opens
 *                                in a new tab — the same UX TipTap's
 *                                openOnClick used to provide
 *
 * Returns the uninstaller.
 */
export function installVaultLinkInterceptor(): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const target = e.target instanceof Element ? e.target : null
    const a = target?.closest('a[href]')
    if (!(a instanceof HTMLAnchorElement)) return
    const href = a.getAttribute('href') ?? ''
    if (isVaultHref(href)) {
      e.preventDefault()
      void openVaultPath(decodeHref(href))
      return
    }
    // Inside a live editor the browser suppresses anchor defaults (and we
    // disabled TipTap Link's window.open) — restore the expected behavior.
    if (a.closest('.ProseMirror[contenteditable="true"]')) {
      if (href.startsWith('#')) {
        e.preventDefault()
        window.location.hash = href
      } else if (EXTERNAL_HREF.test(href)) {
        e.preventDefault()
        window.open(a.href, '_blank', 'noopener')
      }
    }
  }
  document.addEventListener('click', onClick)
  return () => document.removeEventListener('click', onClick)
}
