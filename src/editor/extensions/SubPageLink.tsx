// Sub-page link — an inline chip that mentions another note and navigates to
// it within the editor. It SERIALIZES as a plain markdown link to the note's
// vault path (`[Title](path)`) so Library search, Graph, and NotePage keep
// seeing an ordinary link. On load we convert vault-path link-marks back into
// chips (see convertPageLinks) — the round-trip stays byte-stable because a
// non-`pages/` link only becomes a chip when its text is EXACTLY the title
// the chip itself would serialize.

import { Node, mergeAttributes } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/core'
import { hrefFor } from '../../lib/router'
import { titleFromPath } from '../../lib/format'
import { isVaultHref, openVaultPath } from '../../lib/vaultLinks'
import { IconPage } from '../../components/Icons'

/** The house note-opening rule: pages/* lives in the Pages editor, everything
 * else opens as a note. */
const routeFor = (path: string) =>
  path.startsWith('pages/')
    ? ({ kind: 'pages', path } as const)
    : ({ kind: 'note', path } as const)

function SubPageLinkView({ node }: NodeViewProps) {
  const path = (node.attrs.path as string) || ''
  return (
    <NodeViewWrapper as="span" className="subpage-wrap">
      <button
        type="button"
        className="subpage-link"
        contentEditable={false}
        // Don't let the click steal the editor selection before we navigate.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          // House rule + missing-target guard (quiet "Page not found" toast) —
          // never a silent fall-through to the app's default route.
          if (path) void openVaultPath(path)
        }}
        title={path}
      >
        <IconPage size={13} />
        <span className="subpage-title">
          {titleFromPath(path) || 'Untitled page'}
        </span>
      </button>
    </NodeViewWrapper>
  )
}

export const SubPageLink = Node.create({
  name: 'subPageLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      path: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-path') ?? '',
        renderHTML: (attrs) => ({ 'data-path': attrs.path }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-subpage]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const path = (node.attrs.path as string) || ''
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-subpage': '',
        class: 'subpage-link',
        href: hrefFor(routeFor(path)),
      }),
      titleFromPath(path) || 'Untitled page',
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SubPageLinkView)
  },

  renderMarkdown: (node) => {
    const path = (node.attrs?.path as string) ?? ''
    if (!path) return ''
    return `[${titleFromPath(path)}](${path})`
  },
})

// ——— load-time conversion: vault-path link-marks → subPageLink nodes ———

const PAGE_HREF = /^(?:#\/pages\/|pages\/)/

/** Normalize a legacy `pages/` link href to the vault path form, or null. */
export function pagePathFromHref(href: string): string | null {
  if (!PAGE_HREF.test(href)) return null
  const rest = href.replace(/^#\//, '') // '#/pages/...' → 'pages/...'
  return rest
    .split('/')
    .map((s) => {
      try {
        return decodeURIComponent(s)
      } catch {
        return s
      }
    })
    .join('/')
}

/**
 * The path a chip round-trips through, or null when the link must stay plain.
 *
 * - `pages/` (and `#/pages/`) hrefs ALWAYS convert, whatever their text —
 *   that's the legacy form every chip in the vault serialized to before
 *   chips could point outside pages/; none of them may be orphaned.
 * - Any other vault-relative href converts ONLY when the link text is exactly
 *   `titleFromPath(href)` — the one form the chip itself writes. A converted
 *   chip therefore re-serializes to the same `[Title](path)` bytes, and a
 *   hand-authored link with custom text (or an external URL) is left alone.
 */
export function chipPathFromLink(href: string, text: string): string | null {
  const legacy = pagePathFromHref(href)
  if (legacy) return legacy
  if (!isVaultHref(href)) return null
  return text === titleFromPath(href) ? href : null
}

/**
 * Walk a ProseMirror JSON doc and replace any text node carrying a vault-path
 * link mark (per chipPathFromLink) with a subPageLink node. Returns the
 * (possibly new) doc and a flag so callers can skip a needless re-set when
 * nothing changed.
 */
export function convertPageLinks(doc: JSONContent): {
  doc: JSONContent
  changed: boolean
} {
  let changed = false
  const walk = (node: JSONContent): JSONContent => {
    if (!Array.isArray(node.content)) return node
    const next: JSONContent[] = []
    for (const child of node.content) {
      if (child.type === 'text' && Array.isArray(child.marks)) {
        const link = child.marks.find((m) => m.type === 'link')
        const href = link?.attrs?.href as string | undefined
        // A link nested in other formatting (bold, highlight…) never converts
        // outside the legacy pages/ form: the chip serializes without those
        // marks, which would silently rewrite the stored bytes.
        const bare = child.marks.length === 1
        const path = href
          ? bare
            ? chipPathFromLink(href, child.text ?? '')
            : pagePathFromHref(href)
          : null
        if (path) {
          next.push({ type: 'subPageLink', attrs: { path } })
          changed = true
          continue
        }
      }
      next.push(walk(child))
    }
    return { ...node, content: next }
  }
  return { doc: walk(doc), changed }
}
