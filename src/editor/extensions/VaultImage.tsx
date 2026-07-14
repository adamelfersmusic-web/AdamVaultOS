// Vault-aware image node with resize + alignment (#23).
//
// Vault attachments are stored in note bodies as root-relative paths
// (`/api/storage/<date>/<file>`); a plain <img src> resolves those against the
// APP origin, not the vault, so they 404. The node view resolves such paths
// against the vault (authed blob, absolute-URL fallback).
//
// On top of that: corner handles resize the image (width only — aspect ratio
// always preserved), and a small toolbar on the selected image sets `align`
// (float-left / center / float-right, with text wrap on the floats).
//
// SERIALIZATION LAW (byte-stable round-trip):
//   · An image with no width/align stays EXACTLY `![alt](src)` — untouched
//     notes never change by a single byte.
//   · Only when width/align is set does the markdown become a raw HTML tag,
//     in this canonical attribute order:
//       <img src="…" alt="…" width="420" style="float:left;margin:4px 16px 8px 0">
//     width is a plain HTML attribute and align an inline style, so the note
//     renders the same in ANY renderer (the Parachute reference app included).
//   · Parsing is the exact inverse: loading that tag reproduces the same
//     bytes on save. A hand-authored style string is kept VERBATIM (stored in
//     `alignStyleRaw`) until the user touches the align toolbar, and legacy
//     notes that carry the old `data-align` attribute keep re-serializing as
//     `data-align` — neither drifts on an unrelated edit.

import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import { fetchVaultAsset, vaultAssetUrl } from '../../lib/store'

type Align = 'left' | 'center' | 'right'

const MIN_WIDTH = 80

/** The canonical inline styles — NEVER change these strings: they are what
 *  saved notes contain, and byte-stability depends on them staying fixed. */
export const ALIGN_STYLE: Record<Align, string> = {
  left: 'float:left;margin:4px 16px 8px 0',
  center: 'display:block;margin:8px auto',
  right: 'float:right;margin:4px 0 8px 16px',
}

/** Read the alignment intent out of an element's inline style. */
function alignFromStyle(el: HTMLElement): Align | null {
  const float = el.style.float
  if (float === 'left' || float === 'right') return float
  if (el.style.marginLeft === 'auto' && el.style.marginRight === 'auto') {
    return 'center'
  }
  return null
}

function asAlign(v: string | null): Align | null {
  return v === 'left' || v === 'center' || v === 'right' ? v : null
}

const escAttr = (s: string) => s.replace(/"/g, '&quot;')

/** Root-relative vault path (needs resolving). http(s)/data/blob srcs are fine
 *  as-is. */
function needsResolving(src: string): boolean {
  return src.startsWith('/')
}

const CORNERS = ['nw', 'ne', 'sw', 'se'] as const
type Corner = (typeof CORNERS)[number]

function VaultImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const src = (node.attrs.src as string) || ''
  const alt = (node.attrs.alt as string) || ''
  const width = (node.attrs.width as number | string | null) ?? null
  const align = asAlign((node.attrs.align as string | null) ?? null)
  const imgRef = useRef<HTMLImageElement>(null)
  // Live drag preview — the frame follows the pointer; the width attr (and
  // therefore the doc/undo history) is written ONCE, on pointerup.
  const [previewWidth, setPreviewWidth] = useState<number | null>(null)
  const [resolved, setResolved] = useState<string | null>(
    src && !needsResolving(src) ? src : null,
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!src || !needsResolving(src)) {
      setResolved(src || null)
      setFailed(!src)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    setResolved(null)
    setFailed(false)
    fetchVaultAsset(src)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setResolved(url)
      })
      .catch(() => {
        if (cancelled) return
        try {
          setResolved(vaultAssetUrl(src))
        } catch {
          setFailed(true)
        }
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  // Corner-handle resize: pointer capture on the handle (works for touch too —
  // no long-press choreography needed), live preview while dragging, single
  // attr commit on release. Width only; height stays auto (aspect preserved).
  const startResize = (corner: Corner) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const img = imgRef.current
    if (!img) return
    const handle = e.currentTarget as HTMLElement
    try {
      handle.setPointerCapture(e.pointerId)
    } catch {
      /* capture is best-effort — window listeners below still track the drag */
    }
    const startX = e.clientX
    const startW = Math.round(img.getBoundingClientRect().width)
    // Max = the containing column's width in px, measured at drag time.
    const holder = img.closest('.vault-image-wrap')?.parentElement
    const maxW = Math.max(MIN_WIDTH + 40, holder?.clientWidth ?? 4000)
    // West-side handles grow the image when dragged AWAY from it (leftward).
    const dir = corner === 'ne' || corner === 'se' ? 1 : -1
    let finalW = startW
    const onMove = (ev: PointerEvent) => {
      finalW = Math.min(
        maxW,
        Math.max(MIN_WIDTH, Math.round(startW + dir * (ev.clientX - startX))),
      )
      setPreviewWidth(finalW)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setPreviewWidth(null)
      // Only commit a real change — a stray tap on a handle must not add a
      // width attr to an untouched note (byte-stability law).
      if (finalW !== startW) updateAttributes({ width: finalW })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const setAlign = (next: Align | null) =>
    updateAttributes({ align: next, alignStyleRaw: null, alignLegacy: false })

  const shownWidth = previewWidth ?? width
  const frameStyle =
    shownWidth != null
      ? {
          width:
            typeof shownWidth === 'number'
              ? `${shownWidth}px`
              : String(shownWidth),
        }
      : undefined

  return (
    <NodeViewWrapper
      className={`vault-image-wrap${selected ? ' is-selected' : ''}${previewWidth != null ? ' is-resizing' : ''}`}
      data-align={align || undefined}
      contentEditable={false}
    >
      <span className="vault-image-frame" style={frameStyle}>
        {resolved && !failed ? (
          <img
            ref={imgRef}
            src={resolved}
            alt={alt}
            title={alt}
            className="vault-image"
            draggable={false}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="vault-image-fallback" title={src}>
            {failed ? `\u{1F5BC} ${alt || 'image unavailable'}` : '\u{1F5BC} …'}
          </span>
        )}

        {(selected || previewWidth != null) && resolved && !failed && (
          <>
            {CORNERS.map((c) => (
              <span
                key={c}
                className="vault-image-handle"
                data-corner={c}
                data-testid={`vimg-handle-${c}`}
                onPointerDown={startResize(c)}
                title="Drag to resize"
              />
            ))}
            {previewWidth != null && (
              <span className="vault-image-size-badge">{previewWidth}px</span>
            )}
            <span
              className="vault-image-toolbar"
              data-testid="vimg-toolbar"
              contentEditable={false}
            >
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  className="vimg-btn"
                  data-testid={`vimg-align-${a}`}
                  data-active={align === a || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAlign(align === a ? null : a)}
                  title={
                    a === 'left'
                      ? 'Float left (text wraps)'
                      : a === 'center'
                        ? 'Center'
                        : 'Float right (text wraps)'
                  }
                >
                  {a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}
                </button>
              ))}
              {align != null && (
                <button
                  type="button"
                  className="vimg-btn"
                  data-testid="vimg-align-clear"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setAlign(null)}
                  title="Clear alignment"
                >
                  ✕
                </button>
              )}
              {width != null && (
                <button
                  type="button"
                  className="vimg-btn"
                  data-testid="vimg-reset-size"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateAttributes({ width: null })}
                  title="Reset size"
                >
                  ⤢
                </button>
              )}
            </span>
          </>
        )}
      </span>
    </NodeViewWrapper>
  )
}

export const VaultImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const attr = el.getAttribute('width')
          // Plain pixel widths become numbers (`width="420"` ↔ 420 — same
          // bytes on re-serialize); anything else (`50%`) stays verbatim.
          if (attr) return /^\d+$/.test(attr) ? Number(attr) : attr
          // `style="width: 420px"` → 420 (rare hand-authored form).
          const sw = (el as HTMLElement).style?.width
          const m = sw ? /^(\d+(?:\.\d+)?)px$/.exec(sw) : null
          return m ? Math.round(Number(m[1])) : null
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      align: {
        default: null,
        parseHTML: (el) =>
          alignFromStyle(el as HTMLElement) ??
          asAlign(el.getAttribute('data-align')),
        // Editor-DOM/clipboard form carries both the canonical style (so a
        // paste elsewhere keeps rendering) and data-align (styling hook).
        renderHTML: (attrs) => {
          const a = asAlign((attrs.align as string | null) ?? null)
          return a ? { 'data-align': a, style: ALIGN_STYLE[a] } : {}
        },
      },
      // The VERBATIM inline style the note was loaded with (null when none).
      // Re-emitted untouched on save so hand-authored styles never drift;
      // cleared the moment the user picks an alignment from the toolbar.
      alignStyleRaw: {
        default: null,
        rendered: false,
        parseHTML: (el) => el.getAttribute('style') || null,
      },
      // Older notes stored alignment as data-align (no inline style). Keep
      // re-serializing them that way — byte-stable — until the user re-aligns.
      alignLegacy: {
        default: false,
        rendered: false,
        parseHTML: (el) =>
          el.hasAttribute('data-align') &&
          !alignFromStyle(el as HTMLElement) &&
          !(el as HTMLElement).style?.cssText,
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(VaultImageView)
  },

  // Persist width/align by emitting HTML when either is set (markdown image
  // syntax can't carry them); otherwise stay plain `![alt](src)`.
  renderMarkdown(node: {
    attrs?: {
      src?: string
      alt?: string
      title?: string
      width?: unknown
      height?: unknown
      align?: unknown
      alignStyleRaw?: unknown
      alignLegacy?: unknown
    }
  }) {
    const attrs = node.attrs ?? {}
    const src = attrs.src ?? ''
    if (!src) return ''
    const alt = attrs.alt ?? ''
    const title = attrs.title ?? ''
    const { width, height } = attrs
    const align = asAlign(typeof attrs.align === 'string' ? attrs.align : null)
    const styleRaw =
      typeof attrs.alignStyleRaw === 'string' && attrs.alignStyleRaw
        ? attrs.alignStyleRaw
        : null

    if (!width && !height && !align && !styleRaw) {
      // The sacred plain form — untouched images stay byte-identical.
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`
    }

    const parts = [`src="${escAttr(src)}"`]
    if (alt) parts.push(`alt="${escAttr(alt)}"`)
    if (title) parts.push(`title="${escAttr(title)}"`)
    if (width) parts.push(`width="${width}"`)
    if (height) parts.push(`height="${height}"`)
    if (attrs.alignLegacy && align) {
      parts.push(`data-align="${align}"`)
    } else if (styleRaw) {
      parts.push(`style="${escAttr(styleRaw)}"`)
    } else if (align) {
      parts.push(`style="${ALIGN_STYLE[align]}"`)
    }
    return `<img ${parts.join(' ')}>`
  },
})
