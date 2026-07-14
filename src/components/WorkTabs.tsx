// W1 — the tab rail for WORK DOCS (build log PART 30). Any doc under desk/
// (the daily note, a project's work docs) gets a thin, collapsible rail of
// Google-Docs-style tabs on its left: each tab is a real sub-note
// (desk/<x>/<tab>), searchable and linkable like everything else. "＋" adds
// a tab. Minimal and quiet — tabs are for the FEW parallel threads of a
// working session, never a filing system.
//
// Tabs drag-to-reorder vertically (same house DnD as the sidebar shelves:
// native HTML5, payload in dataTransfer with a module mirror for dragover,
// a thin gold insertion line, window-level dragend sweep). Dropping is the
// only gesture that writes — the new order lands in the vault as 10-spaced
// metadata.tab_order on the sibling notes; a cancelled drag leaves no trace.

import { Fragment, useEffect, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import {
  createWorkTab,
  fetchWorkspaceTabs,
  persistTabOrder,
  toast,
  useStore,
  workspaceRootFor,
} from '../lib/store'
import { hrefFor } from '../lib/router'
import { navigate } from '../lib/router'
import { titleFromPath } from '../lib/format'
import { startTouchDrag, useTouchDropTarget } from '../lib/touchDrag'
import { IconPlus } from './Icons'

const COLLAPSE_KEY = 'adamvaultos.worktabs.collapsed'

/** Tab label: the note's H1 when cached, else the de-slugged path tail. */
function tabTitle(path: string, n?: Note): string {
  const c = n?.content
  if (c) {
    const m = c.match(/^\s{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/m)
    if (m?.[1]) {
      const t = m[1].replace(/[*_`#\[\]]/g, '').trim()
      if (t) return t
    }
  }
  return titleFromPath(path)
}

// ——— DRAG & DROP — mirrors the shelves pattern in PagesView. dragover can't
// read dataTransfer (HTML5 protected mode), so the in-flight payload is
// mirrored here for hover affordances; drop still prefers the real
// dataTransfer JSON. Cleared on dragend — a cancelled drag leaves no trace. ———

type TabDragPayload = { kind: 'worktab'; path: string; root: string }

const TAB_DND_MIME = 'application/x-adamvaultos-worktab-dnd'
let liveTabDrag: TabDragPayload | null = null

function isTabDragPayload(p: unknown): p is TabDragPayload {
  if (!p || typeof p !== 'object') return false
  const d = p as Record<string, unknown>
  return d.kind === 'worktab' && typeof d.path === 'string' && typeof d.root === 'string'
}

/** The drop-time payload: the dataTransfer JSON when it parses, else the live
 * mirror. Malformed/foreign data (someone dropping random text) → null. */
function readTabDragPayload(e: React.DragEvent): TabDragPayload | null {
  try {
    const raw = e.dataTransfer.getData(TAB_DND_MIME)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isTabDragPayload(parsed)) return parsed
    }
  } catch {
    // fall through to the mirror
  }
  return liveTabDrag
}

/** Top or bottom half of the hovered tab → insert before it or after it. */
function slotFor(e: React.DragEvent, index: number): number {
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientY > r.top + r.height / 2 ? index + 1 : index
}

export function WorkTabs({ path }: { path: string }) {
  const { notes } = useStore()
  const root = workspaceRootFor(path)
  const [tabs, setTabs] = useState<{ root: Note | null; children: Note[] } | null>(null)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  // Reorder hover slot (index into `children`; a gold line renders there).
  // Window-level dragend/drop is the safety net for cancelled drags.
  const [dropSlot, setDropSlot] = useState<number | null>(null)
  useEffect(() => {
    const clear = () => setDropSlot(null)
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  useEffect(() => {
    if (!root) return
    const id = ++seq.current
    fetchWorkspaceTabs(root)
      .then((t) => {
        if (seq.current === id) setTabs(t)
      })
      .catch(() => {
        if (seq.current === id) setTabs({ root: null, children: [] })
      })
  }, [root, path])

  if (!root) return null

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }

  const addTab = async () => {
    const t = newTitle.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      const note = await createWorkTab(root, t)
      setTabs((prev) =>
        prev ? { ...prev, children: [...prev.children, note] } : prev,
      )
      setAdding(false)
      setNewTitle('')
      navigate({ kind: 'pages', path: note.path })
    } catch (e) {
      toast('error', `Couldn’t add tab — ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  /** A drop landed: move the dragged tab into `slot` (an insertion index in
   * the CURRENT children), reflect it instantly, persist tab_order. A drop
   * that lands the tab where it already sits writes nothing. */
  const applyReorder = (dragPath: string, slot: number) => {
    const children = tabs?.children ?? []
    const from = children.findIndex((c) => c.path === dragPath)
    if (from === -1) return
    const next = [...children]
    const [moved] = next.splice(from, 1)
    const at = Math.max(0, Math.min(slot > from ? slot - 1 : slot, next.length))
    if (at === from) return
    next.splice(at, 0, moved!)
    setTabs((prev) => (prev ? { ...prev, children: next } : prev))
    void persistTabOrder(next.map((c) => c.path))
  }

  const acceptsHere = () => liveTabDrag?.kind === 'worktab' && liveTabDrag.root === root

  // ——— THE SHARED BEHAVIOR CONTRACT — the drop write as a plain closure;
  // the HTML5 handlers and the touch backend (lib/touchDrag.ts — HTML5 drag
  // never fires on iOS Safari) both call THIS. One write path. ———
  const performTabDrop = (payload: TabDragPayload | null, slot: number) => {
    setDropSlot(null)
    if (!payload || payload.root !== root) return
    applyReorder(payload.path, slot)
  }

  const onTabDrop = (e: React.DragEvent, slot: number) => {
    const payload = readTabDragPayload(e)
    if (payload && payload.root === root) {
      e.preventDefault()
      e.stopPropagation()
    }
    performTabDrop(payload, slot)
  }

  // The touch backend: the rail is ONE registered drop target; the hovered
  // slot comes from the pointer's y against the live tab rects (the same
  // top/bottom-half rule as slotFor).
  const listRef = useRef<HTMLDivElement | null>(null)
  const slotFromPoint = (clientY: number): number => {
    const list = listRef.current
    const count = tabs?.children.length ?? 0
    if (!list) return count
    const els = list.querySelectorAll<HTMLElement>('.worktabs-item-draggable')
    for (let i = 0; i < els.length; i++) {
      const r = els[i]!.getBoundingClientRect()
      if (clientY < r.top + r.height / 2) return i
      if (clientY < r.bottom) return i + 1
    }
    return els.length
  }
  const touchListRef = useTouchDropTarget({
    accepts: acceptsHere,
    enter: (_x, y) => setDropSlot(slotFromPoint(y)),
    leave: () => setDropSlot(null),
    drop: (_x, y) => performTabDrop(liveTabDrag, slotFromPoint(y)),
  })

  if (collapsed) {
    return (
      <button
        className="worktabs-collapsed"
        title="Show tabs"
        aria-label="Show tabs"
        onClick={toggle}
        data-testid="worktabs-expand"
      >
        ▸
      </button>
    )
  }

  const children = tabs?.children ?? []

  return (
    <aside className="worktabs" data-testid="worktabs">
      <div className="worktabs-head">
        <span className="worktabs-label">Tabs</span>
        <button className="worktabs-hide" title="Hide tabs" onClick={toggle}>
          ◂
        </button>
      </div>
      <div
        className="worktabs-list"
        ref={(el) => {
          listRef.current = el
          touchListRef(el)
        }}
        onDragOver={(e) => {
          // The gap under the last tab — append.
          if (!acceptsHere()) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDropSlot(children.length)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
          setDropSlot(null)
        }}
        onDrop={(e) => onTabDrop(e, children.length)}
      >
        {tabs === null ? (
          <span className="worktabs-loading">…</span>
        ) : (
          <>
            {tabs.root && (
              <a
                className={`worktabs-item${root === path ? ' is-active' : ''}`}
                href={hrefFor({ kind: 'pages', path: root })}
                title={root}
              >
                {tabTitle(root, notes[root] ?? tabs.root)}
              </a>
            )}
            {children.map((c, i) => (
              <Fragment key={c.path}>
                {dropSlot === i && (
                  <div className="worktabs-drop-line" data-testid="drop-line" />
                )}
                <a
                  className={`worktabs-item worktabs-item-draggable${c.path === path ? ' is-active' : ''}`}
                  href={hrefFor({ kind: 'pages', path: c.path })}
                  title={c.path}
                  draggable
                  onDragStart={(e) => {
                    const payload: TabDragPayload = { kind: 'worktab', path: c.path, root }
                    liveTabDrag = payload
                    e.dataTransfer.setData(TAB_DND_MIME, JSON.stringify(payload))
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    liveTabDrag = null
                  }}
                  onDragOver={(e) => {
                    if (!acceptsHere()) return
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = 'move'
                    setDropSlot(slotFor(e, i))
                  }}
                  onDrop={(e) => onTabDrop(e, slotFor(e, i))}
                  onPointerDown={(e) =>
                    startTouchDrag(e, {
                      label: tabTitle(c.path, notes[c.path] ?? c),
                      onStart: () => {
                        liveTabDrag = { kind: 'worktab', path: c.path, root }
                      },
                      onEnd: () => {
                        liveTabDrag = null
                        setDropSlot(null)
                      },
                    })
                  }
                >
                  {tabTitle(c.path, notes[c.path] ?? c)}
                </a>
              </Fragment>
            ))}
            {dropSlot === children.length && children.length > 0 && (
              <div className="worktabs-drop-line" data-testid="drop-line" />
            )}
          </>
        )}
        {adding ? (
          <input
            autoFocus
            className="worktabs-input"
            placeholder="Tab name…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={() => !newTitle.trim() && setAdding(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addTab()
              if (e.key === 'Escape') setAdding(false)
            }}
          />
        ) : (
          <button
            className="worktabs-add"
            onClick={() => setAdding(true)}
            data-testid="worktabs-add"
          >
            <IconPlus size={11} /> tab
          </button>
        )}
      </div>
    </aside>
  )
}
