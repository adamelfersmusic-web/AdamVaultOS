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
import type { Editor, ChainedCommands } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import { fetchLinkTargets } from '../../lib/store'
import { fuzzyScore } from '../../lib/fuzzy'
import { titleFromPath } from '../../lib/format'
import { semanticLinkCandidates } from '../../lib/embed/suggest'
import { IconPage, IconPlus } from '../../components/Icons'

interface WikiItem {
  target: string
  title: string
  meta: string
  asTyped?: boolean
  /** A ✨ meaning-match from the vector index, not a keyword hit. */
  semantic?: boolean
}

// Suggestion state lives under this key; hoisted so onStart can re-check
// "still active?" after the async items fetch resolves.
const wikiSuggestKey = new PluginKey('wikiLinkSuggest')

/** Is the wikilink suggester currently live? The shared Tab handler asks so
 * it can step aside — this menu accepts its highlighted entry with Tab. */
export function isWikiSuggestOpen(state: EditorState): boolean {
  return Boolean((wikiSuggestKey.getState(state) as { active?: boolean } | undefined)?.active)
}

/** Transactions carrying this meta never wake the suggester. Loading a note
 * whose markdown still contains literal `[[…]]` text used to look exactly
 * like typing to @tiptap/suggestion (setContent parks the caret at the end of
 * the doc, right after the last wikilink) — the menu must only ever open for
 * real keystrokes. */
export const PREVENT_SUGGEST = 'preventSuggest'

/** setContent for programmatic loads: same call, but the transaction is
 * tagged with PREVENT_SUGGEST so a doc that already contains `[[…]]` can't
 * pop the "No notes match" ghost over content nobody is typing in. */
export function setContentSilently(
  editor: Editor,
  ...args: Parameters<ChainedCommands['setContent']>
): void {
  editor.chain().setMeta(PREVENT_SUGGEST, true).setContent(...args).run()
}

const MAX_ITEMS = 8

// Monotonic call counter for wikiItems — the same drop-stale-results idea as
// PR #50's onStart active-check, one layer down: semanticLinkCandidates is a
// second await inside items(), so a slow tail from an OLD query could resolve
// after a newer call already started. Stale calls skip their semantic append
// (only the newest call may add ✨ rows); the plugin still renders newest-last.
let wikiItemsSeq = 0

async function wikiItems(query: string): Promise<WikiItem[]> {
  const seq = ++wikiItemsSeq
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
  // ✨ Semantic tail: up to 3 meaning-matches AFTER the keyword rows —
  // link-time is when you can't remember the note's name. Never throws,
  // never builds the index, dedups against the keyword hits above.
  if (q) {
    const sem = await semanticLinkCandidates(q, new Set(list.map((it) => it.target)))
    // Stale call (the query changed while semanticSearch was in flight):
    // skip the tail — only the newest call may append ✨ rows. The render
    // layer's own stale-query check drops the whole stale frame anyway.
    if (seq === wikiItemsSeq) {
      for (const hit of sem) {
        list.push({
          target: hit.path,
          title: titleFromPath(hit.path),
          meta: hit.path,
          semantic: true,
        })
      }
    }
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
          key={`${it.target}·${it.asTyped ? 'typed' : it.semantic ? 'sem' : 'note'}`}
          className={`slash-item${it.asTyped ? ' wiki-as-typed' : ''}${it.semantic ? ' wiki-semantic' : ''}`}
          role="option"
          aria-selected={i === active}
          data-active={i === active}
          data-semantic={it.semantic ? 'true' : undefined}
          onMouseEnter={() => setActive(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => props.command(it)}
        >
          <span className="slash-icon">
            {it.asTyped ? <IconPlus /> : it.semantic ? <span aria-hidden>✨</span> : <IconPage />}
          </span>
          <span className="slash-text">
            <span className="slash-title">{it.title}</span>
            <span className="slash-sub">
              {it.meta}
              {it.semantic && <span className="wiki-related-hint"> · related</span>}
            </span>
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

  // Navigating away mid-suggestion destroys the editor before onExit runs,
  // stranding the floating menu on document.body ("No notes match" ghost box).
  onDestroy() {
    document.querySelectorAll('.slash-menu').forEach((el) => el.remove())
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<WikiItem, WikiItem>({
        editor: this.editor,
        pluginKey: wikiSuggestKey,
        char: '[[',
        startOfLine: false,
        allowSpaces: true,
        // Only genuine typing opens (or keeps open) the menu — content loads
        // tag their transactions with PREVENT_SUGGEST, which also force-closes
        // an open menu if a programmatic replacement lands mid-suggestion.
        shouldShow: ({ transaction }) => !transaction.getMeta(PREVENT_SUGGEST),
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
              // onStart fires AFTER the async items fetch. If a transaction
              // deactivated the suggestion meanwhile (a load's second
              // setContent, say), mounting now would strand the menu on
              // document.body with nothing left to ever remove it.
              if (!wikiSuggestKey.getState(props.editor.state)?.active) return
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
              // Same race, one frame later: the semantic tail makes items()
              // latency VARY per call, so an old query's update can resolve
              // after a newer one already rendered. If the query this frame
              // was built for is no longer the live one, drop it — the call
              // that matches the live query renders (or already has).
              const live = wikiSuggestKey.getState(props.editor.state) as
                | { active?: boolean; query?: string | null }
                | undefined
              if (live?.active && (live.query ?? '') !== (props.query ?? '')) return
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
