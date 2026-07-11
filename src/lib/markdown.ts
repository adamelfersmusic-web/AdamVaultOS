import { marked } from 'marked'
import DOMPurify from 'dompurify'

// breaks:true — script bodies use single newlines as spoken-word line breaks;
// collapsing them would destroy the rhythm of the writing.
marked.setOptions({ gfm: true, breaks: true, async: false })

// Root-relative vault images (`/api/storage/...`) can't display from an <img>
// src — the browser resolves them against the app origin, not the vault, so
// they 404. Stage them as `data-vault-src` placeholders (no src → no broken
// flash); useVaultImages swaps in an auth-resolved URL after render. External
// http(s)/data images are left untouched.
function stageVaultImages(src: string): string {
  return src.replace(
    /!\[([^\]]*)\]\((\/[^)\s]+)\)/g,
    (_m, alt: string, path: string) =>
      `<img alt="${alt.replace(/"/g, '&quot;')}" data-vault-src="${path}" class="vault-img" />`,
  )
}

export function renderMarkdown(src: string): string {
  const html = marked.parse(stageVaultImages(src)) as string
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style'],
    ADD_ATTR: ['target', 'data-vault-src'],
  })
}
