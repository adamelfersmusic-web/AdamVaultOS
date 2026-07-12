// #11 — inline linking: type `[[` and pick a note from anywhere in the vault.
// Built on @tiptap/suggestion (same machinery as the slash menu) with its own
// plugin key so both can coexist. Picking inserts a real wikiLink node (the
// clickable chip) — markdown serializes to `[[path]]`, a real graph edge.
//
// The list is the WHOLE vault (lean fetch, cached in the store), fuzzy-matched
// on title + path. The top row when you've typed something that matches
// nothing exactly: "link as typed" — wikilinks may point at notes that don't
// exist yet; that's how gardens grow.

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { fetchLinkTargets } from '../../lib/store'
import { fuzzyScore } from '../../lib/fuzzy'
import { titleFromPath } from '../../lib/format'
import { IconPage, IconPlus } from '../../components/Icons'

interface WikiItem {
  target: string
  title: string
  meta: string
  asTyped?: boolean
}

const MAX_ITEMS = 8

async function wikiItems(query: string): Promise<WikiItem[]> {
  const q = query.trim()
  const all = await fetchLinkTargets()
  let list: WikiItem[]
  if (!q) {
    // Nothing typed yet: most recently touched notes.
    list = [...all]
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, MAX_ITEMS)
      .map((n) => ({ target: n.path, title: titleFromPath(n.path), meta: n.path }))
  } else {
    list = all
      .map((n) => {
        const title = titleFromPath(n.path)
        const s = Math.max(
          fuzzyScore(q, title) ?? -Infinity,
          (fuzzyScore(q, n.path) ?? -Infinity) - 1, // title match beats path match
        )
        return { n, title, s }
      })
      .filter((x) => x.s !== -Infinity)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_ITEMS)
      .map(({ n, title }) => ({ target: n.path, title, meta: n.path }))
  }
  // Escape hatch: link exactly what was typed (a future note is a valid target).
  if (q && !list.some((it) => it.target === q)) {
    list.push({ target: q, title: `Link “${q}”`, meta: 'as typed — note may not exist yet', asTyped: true })
  }
  return list
}

// ——— the floating menu ———

interface WikiMenuProps {
  items: WikiItem[]
  command: (item: WikiItem) => void
}
interface WikiMenuRef {
  onKeyDown: (e: KeyboardEvent) => boolean
}

const WikiMenu = forwardRef<WikiMenuRef, WikiMenuProps>((props, ref) => {
  const [active, setActive] = useState(0)
  useEffect(() => setActive(0), [props.items])

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: (e) => {
        const n = props.items.length
        if (n === 0) return false
        if (e.key === 'ArrowDown') {
          setActive((a) => (a + 1) % n)
          return true
        }
        if (e.key === 'ArrowUp') {
          setActive((a) => (a - 1 + n) % n)
          return true
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          const it = props.items[active]
          if (it) props.command(it)
          return true
        }
        return false
      },
    }),
    [props, active],
  )

  if (props.items.length === 0) {
    return <div className="slash-menu slash-menu-empty">No notes match</div>
  }
  return (
    <div className="slash-menu wiki-menu" role="listbox" data-testid="wiki-menu">
      {props.items.map((it, i) => (
        <button
          key={`${it.target}·${it.asTyped ? 'typed' : 'note'}`}
          className={`slash-item${it.asTyped ? ' wiki-as-typed' : ''}`}
          role="option"
          aria-selected={i === active}
          data-active={i === active}
          onMouseEnter={() => setActive(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => props.command(it)}
        >
          <span className="slash-icon">{it.asTyped ? <IconPlus /> : <IconPage />}</span>
          <span className="slash-text">
            <span className="slash-title">{it.title}</span>
            <span className="slash-sub">{it.meta}</span>
          </span>
        </button>
      ))}
    </div>
  )
})
WikiMenu.displayName = 'WikiMenu'

function place(el: HTMLElement, clientRect?: (() => DOMRect | null) | null): void {
  const rect = clientRect?.()
  if (!rect) return
  el.style.position = 'fixed'
  el.style.zIndex = '1500'
  const h = el.offsetHeight || 300
  const below = rect.bottom + 8
  const flipUp = below + h > window.innerHeight - 12
  el.style.top = `${flipUp ? Math.max(12, rect.top - h - 8) : below}px`
  el.style.left = `${Math.min(rect.left, window.innerWidth - 296)}px`
}

export const WikiLinkSuggest = Extension.create({
  name: 'wikiLinkSuggest',

  addProseMirrorPlugins() {
    return [
      Suggestion<WikiItem, WikiItem>({
        editor: this.editor,
        pluginKey: new PluginKey('wikiLinkSuggest'),
        char: '[[',
        startOfLine: false,
        allowSpaces: true,
        items: ({ query }) => wikiItems(query),
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              { type: 'wikiLink', attrs: { target: props.target } },
              { type: 'text', text: ' ' },
            ])
            .run()
        },
        render: () => {
          let renderer: ReactRenderer<WikiMenuRef, WikiMenuProps> | null = null
          return {
            onStart: (props: SuggestionProps<WikiItem, WikiItem>) => {
              renderer = new ReactRenderer<WikiMenuRef, WikiMenuProps>(WikiMenu, {
                editor: props.editor,
                props: {
                  items: props.items,
                  command: (it: WikiItem) => props.command(it),
                },
              })
              document.body.appendChild(renderer.element)
              place(renderer.element, props.clientRect)
            },
            onUpdate: (props: SuggestionProps<WikiItem, WikiItem>) => {
              renderer?.updateProps({
                items: props.items,
                command: (it: WikiItem) => props.command(it),
              })
              if (renderer) place(renderer.element, props.clientRect)
            },
            onKeyDown: (props: SuggestionKeyDownProps) =>
              renderer?.ref?.onKeyDown(props.event) ?? false,
            onExit: () => {
              renderer?.element.remove()
              renderer?.destroy()
              renderer = null
            },
          }
        },
      }),
    ]
  },
})
