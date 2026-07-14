import { useEffect } from 'react'
import type { RefObject } from 'react'
import { fetchVaultAsset, vaultAssetUrl } from './store'

/**
 * After a markdown body renders, resolve the `data-vault-src` image
 * placeholders staged by renderMarkdown (vault `/api/storage/...` attachments)
 * into real, displayable URLs. Fetches WITH the bearer token and shows a blob
 * URL when storage is auth-gated, falling back to a plain absolute URL when it
 * is public. Object URLs are revoked on cleanup.
 *
 * The rendered body can be re-created with IDENTICAL markup while a fetch is
 * in flight (loading→ready flips, store refreshes after an SPA navigation…) —
 * in that case the dep never changes, the effect never re-fires, and a
 * one-shot `img.src =` assignment lands on a detached node. So this hook
 * keeps a path→URL cache and re-applies it through a MutationObserver:
 * whenever the subtree is replaced, every `img[data-vault-src]` gets its
 * resolved URL back.
 *
 * Pass the rendered container ref and a dependency (usually the note content)
 * so it re-runs when the body changes.
 */
export function useVaultImages(
  ref: RefObject<HTMLElement | null>,
  dep: unknown,
): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let cancelled = false
    const created: string[] = []
    const resolved = new Map<string, string>() // vault path → displayable URL
    const pending = new Set<string>() // fetches in flight (no duplicates)

    const apply = () => {
      const imgs = el.querySelectorAll<HTMLImageElement>('img[data-vault-src]')
      for (const img of imgs) {
        const path = img.getAttribute('data-vault-src')
        if (!path) continue
        const url = resolved.get(path)
        if (url) {
          if (img.getAttribute('src') !== url) img.src = url
          continue
        }
        if (pending.has(path)) continue
        pending.add(path)
        fetchVaultAsset(path)
          .then((u) => {
            if (cancelled) {
              URL.revokeObjectURL(u)
              return
            }
            created.push(u)
            resolved.set(path, u)
            apply()
          })
          .catch(() => {
            if (cancelled) return
            try {
              resolved.set(path, vaultAssetUrl(path))
              apply()
            } catch {
              /* not connected — leave the placeholder */
            }
          })
      }
    }

    apply()
    // Re-apply whenever the rendered subtree changes (attribute changes are
    // NOT observed, so our own src assignments can't re-trigger this).
    const observer = new MutationObserver(apply)
    observer.observe(el, { childList: true, subtree: true })

    return () => {
      cancelled = true
      observer.disconnect()
      created.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [ref, dep])
}
