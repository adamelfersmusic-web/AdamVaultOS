// Vault-aware image node with resize + alignment.
//
// Vault attachments are stored in note bodies as root-relative paths
// (`/api/storage/<date>/<file>`); a plain <img src> resolves those against the
// APP origin, not the vault, so they 404. The node view resolves such paths
// against the vault (authed blob, absolute-URL fallback).
//
// On top of that: a drag handle (bottom-right) resizes the image (sets a `width`
// attr), and a toolbar on the selected image sets `align` (left/center/right).
// Width/align round-trip through markdown as an HTML `<img src alt width
// data-align>` (markdown allows raw HTML, and Parachute renders it the same); a
// plain image with no width/align still serializes as `![alt](src)`.

import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import { fetchVaultAsset, vaultAssetUrl } from '../../lib/store'

/** Root-relative vault path (needs resolving). http(s)/data/blob srcs are fine
 *  as-is. */
function needsResolving(src: string): boolean {
  return src.startsWith('/')
}

function VaultImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const src = (node.attrs.src as string) || ''
  const alt = (node.attrs.alt as string) || ''
  const width = (node.attrs.width as number | string | null) ?? null
  const align = (node.attrs.align as string | null) ?? null
  const imgRef = useRef<HTMLImageElement>(null)
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

  // Drag the bottom-right handle to resize (pointer events → width attr).
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const img = imgRef.current
    if (!img) return
    const startX = e.clientX
    const startW = img.getBoundingClientRect().width
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(60, Math.round(startW + (ev.clientX - startX)))
      updateAttributes({ width: next })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const frameStyle =
    width != null
      ? { width: typeof width === 'number' ? `${width}px` : String(width) }
      : undefined

  return (
    <NodeViewWrapper
      className={`vault-image-wrap${selected ? ' is-selected' : ''}`}
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

        {selected && resolved && !failed && (
          <>
            <span
              className="vault-image-resize"
              onPointerDown={startResize}
              title="Drag to resize"
            />
            <span className="vault-image-toolbar" contentEditable={false}>
              {(['left', 'center', 'right'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  className="vimg-btn"
                  data-active={align === a || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => updateAttributes({ align: align === a ? null : a })}
                  title={`Align ${a}`}
                >
                  {a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}
                </button>
              ))}
              {width != null && (
                <button
                  type="button"
                  className="vimg-btn"
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
        parseHTML: (el) =>
          el.getAttribute('width') || (el as HTMLElement).style?.width || null,
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-align') || null,
        renderHTML: (attrs) =>
          attrs.align ? { 'data-align': attrs.align } : {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(VaultImageView)
  },

  // Persist width/align by emitting HTML when either is set (markdown image
  // syntax can't carry them); otherwise stay plain `![alt](src)`.
  renderMarkdown(node: {
    attrs?: { src?: string; alt?: string; width?: unknown; align?: unknown }
  }) {
    const src = node.attrs?.src ?? ''
    if (!src) return ''
    const alt = node.attrs?.alt ?? ''
    const width = node.attrs?.width
    const align = node.attrs?.align
    if (width || align) {
      const parts = [`src="${src}"`]
      if (alt) parts.push(`alt="${alt}"`)
      if (width) parts.push(`width="${width}"`)
      if (align) parts.push(`data-align="${align}"`)
      return `<img ${parts.join(' ')}>`
    }
    return `![${alt}](${src})`
  },
})
