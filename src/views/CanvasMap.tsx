// Map mode — the auto-placed half of the canvas.
//
// 🔑 WHY AUTO-PLACEMENT: a hand-dragged board drifts into a blob within twenty
// nodes. Placement is what makes a 150-node map readable every time, without
// anyone spending attention on position. Enter/Tab/Shift+Tab build the tree;
// the layout engine (lib/canvasLayout) decides where everything goes.
//
// 🔴 MAP MODE NEVER REWRITES x/y ON AN EXISTING CARD. Free mode owns positions;
// map mode owns structure and recomputes positions on every render. That makes
// the toggle lossless in both directions — baking computed positions on exit
// would silently overwrite anything hand-placed in free mode. Only a card
// CREATED here gets an x/y, once, so free mode has somewhere sane to show it.
//
// This is a separate component from the free-mode surface on purpose. Free mode
// is the daily driver and works; map mode is additive beside it, not a refactor
// running through it.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import {
  canvasCardPath,
  createCanvasCard,
  createCanvasEdge,
  deleteCanvasEdge,
  newCanvasEdgeId,
  newCanvasCardId,
  toast,
  updateCanvasNote,
} from '../lib/store'
import {
  layoutMap,
  orderAfter,
  MAP_CARD_W,
  type LayoutInput,
} from '../lib/canvasLayout'
import { refOf, resolveRef, type RefLookup } from '../lib/canvasRefs'
import { navigate } from '../lib/router'

/** Height assumed before a card has been measured — one frame, then corrected. */
const EST_HEIGHT = 84

interface CardStruct {
  path: string
  parent: string | null
  order: number
  collapsed: boolean
}

function structOf(n: Note, index: number): CardStruct {
  const p = n.metadata?.['parent']
  const o = n.metadata?.['order']
  return {
    path: n.path,
    parent: typeof p === 'string' && p ? p : null,
    // A board built in free mode has no order at all; fall back to a stable
    // one so those cards don't shuffle on every render.
    order: typeof o === 'number' && Number.isFinite(o) ? o : (index + 1) * 10,
    collapsed: n.metadata?.['collapsed'] === true,
  }
}

/** Label text — markdown stripped to something readable at a glance. */
function labelOf(n: Note): string {
  return (n.content ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, '')
    // Emphasis and quote marks only. NOT '#' — headings are already stripped
    // above, and a blanket strip turns "Pilot call #1" into "Pilot call 1".
    .replace(/[*_~`>]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function CanvasMap({
  boardId,
  cards,
  edges,
  zoom,
  upsert,
  onRemove,
  refIndex,
  autoEditPath,
  onAutoEditConsumed,
}: {
  boardId: string
  cards: Note[]
  /** Cross-link notes on this board — the links a tree cannot express. */
  edges: Note[]
  /** Plane scale, so a pointer position can be read back in plane units. */
  zoom: number
  upsert: (n: Note) => void
  /** Drop a deleted note (an edge) from the board's local state. */
  onRemove: (path: string) => void
  /** Vault notes by id, for resolving ref nodes. null = not loaded yet. */
  refIndex?: Map<string, RefLookup> | null
  /** A card just created on the plane — open its label editor straight away. */
  autoEditPath?: string | null
  onAutoEditConsumed?: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [heights, setHeights] = useState<Record<string, number>>({})
  // Dragging a new link: the source node, and where the pointer is in PLANE
  // units so the preview line tracks under any zoom.
  const [linking, setLinking] = useState<{ from: string; x: number; y: number } | null>(null)
  const [edgeEditing, setEdgeEditing] = useState<string | null>(null)
  const [edgeDraft, setEdgeDraft] = useState('')
  const edgeInputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const byPath = useMemo(() => new Map(cards.map((c) => [c.path, c])), [cards])
  // Reads that happen AFTER an await must not use the closure's stale copy.
  const cardsRef = useRef(byPath)
  cardsRef.current = byPath
  // One write queue per note. Two writes to the same card from the same base
  // version collide and the loser is rejected — which is exactly what Shift+Tab
  // does, firing a structure write and a label write together. Chaining them
  // means each starts from the version the previous one produced.
  const queues = useRef(new Map<string, Promise<unknown>>())
  const enqueue = <T,>(path: string, fn: () => Promise<T>): Promise<T> => {
    const prev = queues.current.get(path) ?? Promise.resolve()
    const next = prev.then(
      () => fn(),
      () => fn(),
    )
    queues.current.set(
      path,
      next.catch(() => undefined),
    )
    return next
  }
  // The newest version of each note we've seen, updated SYNCHRONOUSLY on every
  // write. Render state lags a tick behind an await, and a write that carries a
  // stale updatedAt is rejected — so version tracking cannot depend on render
  // timing.
  const latest = useRef(new Map<string, Note>())
  const remember = (n: Note) => {
    latest.current.set(n.path, n)
    upsert(n)
  }
  // What the vault currently holds for each node's label. Compared against
  // instead of the local note, because the local note is updated optimistically
  // the moment you commit — otherwise the write would look redundant and be
  // skipped, and the label would never actually persist.
  const savedText = useRef(new Map<string, string>())
  const structs = useMemo(() => cards.map((c, i) => structOf(c, i)), [cards])
  const structsRef = useRef(structs)
  structsRef.current = structs

  // Cards wrap and grow, so heights are measured rather than assumed — a
  // three-word node next to a forty-word one has to stay calm.
  //
  // 🔴 Measured in a layout effect that runs after EVERY render, not only from
  // a ResizeObserver created on mount. An observer built inside an effect does
  // not exist yet when the ref callbacks of that first render fire, so on a
  // fresh load every node would go unobserved and the layout would run on
  // estimates — producing overlapping cards until something happened to resize.
  const els = useRef(new Map<string, HTMLElement>())
  const observer = useRef<ResizeObserver | null>(null)

  const measureRef = useCallback((el: HTMLElement | null) => {
    const path = el?.dataset['path']
    if (el && path) els.current.set(path, el)
  }, [])

  const readHeights = useCallback(() => {
    setHeights((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [path, el] of els.current) {
        if (!el.isConnected) continue
        const h = el.offsetHeight
        if (h > 0 && next[path] !== h) {
          next[path] = h
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [])

  useLayoutEffect(() => {
    if (!observer.current && typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(() => readHeights())
    }
    for (const el of els.current.values()) {
      if (el.isConnected) observer.current?.observe(el)
      else els.current.delete(el.dataset['path'] ?? '')
    }
    readHeights()
  })

  useEffect(() => () => observer.current?.disconnect(), [])

  const inputs = useMemo<LayoutInput[]>(
    () =>
      structs.map((s) => ({
        ...s,
        height: heights[s.path] ?? EST_HEIGHT,
      })),
    [structs, heights],
  )
  const { placed, links } = useMemo(() => layoutMap(inputs), [inputs])
  const posOf = useMemo(() => new Map(placed.map((p) => [p.path, p])), [placed])
  const heightOf = (path: string) => heights[path] ?? EST_HEIGHT

  const siblingsOf = (parent: string | null) =>
    structsRef.current.filter((s) => s.parent === parent)

  /**
   * Create a card and drop straight into its label editor.
   *
   * 🔑 OPTIMISTIC, and that is the point. Typing 150 nodes means an Enter every
   * couple of seconds; if each one waited for a server round-trip before its
   * editor existed, a fast typist would outrun it and lose characters. The id
   * is generated here, so the path — and therefore any child's `parent` — is
   * valid immediately. The write follows behind.
   */
  const addNode = (parent: string | null, order: number) => {
    if (busy.current) return
    busy.current = true
    const id = newCanvasCardId()
    const path = canvasCardPath(boardId, id)
    const now = new Date(0).toISOString()
    // A brand-new card gets an x/y so free mode has somewhere sane to show it.
    // Existing cards are never repositioned from here.
    const optimistic = {
      id: path,
      path,
      content: '',
      tags: ['canvas'],
      metadata: { ckind: 'card', board: boardId, x: 40, y: 40, w: MAP_CARD_W, h: EST_HEIGHT, parent, order },
      createdAt: now,
      updatedAt: now,
    } as Note
    remember(optimistic)
    savedText.current.set(path, '')
    setSelected(path)
    setDraft('')
    setEditing(path)
    busy.current = false

    const p: Promise<Note> = createCanvasCard(boardId, {
      x: 40,
      y: 40,
      w: MAP_CARD_W,
      h: EST_HEIGHT,
      parent,
      order,
      cardId: id,
    })
      .then((note) => {
        remember(note)
        return note
      })
      .catch((e) => {
        toast('error', `Couldn’t add node — ${e instanceof Error ? e.message : e}`)
        throw e
      })
    queues.current.set(
      path,
      p.catch(() => undefined),
    )
  }

  const patch = (path: string, metadata: Record<string, unknown>) => {
    // Apply locally FIRST. A structure change that only lands when the write
    // returns leaves the very next keystroke reading the old parent — so an
    // outdent followed immediately by Enter would file the new node back in the
    // branch you just left.
    const now = latest.current.get(path) ?? cardsRef.current.get(path)
    if (now) remember({ ...now, metadata: { ...now.metadata, ...metadata } })
    return enqueue(path, async () => {
      const cur = latest.current.get(path) ?? cardsRef.current.get(path)
      if (!cur) return
      try {
        const updated = await updateCanvasNote(cur.path, cur.updatedAt, {
          metadata: { ...cur.metadata, ...metadata },
        })
        remember(updated)
      } catch (e) {
        toast('error', `Couldn’t update node — ${e instanceof Error ? e.message : e}`)
      }
    })
  }

  /** Save a node's label behind whatever write is already in flight for it. */
  const saveContent = (path: string, text: string) =>
    enqueue(path, async () => {
      // The queue guarantees the create (and any earlier write) already landed,
      // so `latest` holds a version the vault will accept.
      const cur = latest.current.get(path) ?? cardsRef.current.get(path)
      if (!cur) return
      if (text.trim() === (savedText.current.get(path) ?? '').trim()) return
      try {
        const updated = await updateCanvasNote(cur.path, cur.updatedAt, { content: text.trim() })
        savedText.current.set(path, updated.content ?? '')
        remember(updated)
      } catch (e) {
        toast('error', `Couldn’t save node — ${e instanceof Error ? e.message : e}`)
      }
    })

  /**
   * Commit the label and chain into the next structural move.
   *
   * 🔴 SYNCHRONOUS UP FRONT. The editor must move to the new node in this very
   * keydown, before any await: leave a gap and the next characters land in the
   * previous node's textarea, so its label gets the following node's text
   * appended and then wiped. The save runs behind, keyed to the old path.
   */
  const commit = (then?: 'sibling' | 'child' | 'outdent' | null) => {
    const path = editing
    if (!path) return
    const text = draft
    const me = structsRef.current.find((s) => s.path === path)
    // Paint the label now. Waiting for the round-trip leaves the node blank
    // (so the layout measures it short) and then jumps when the write lands.
    const before = latest.current.get(path) ?? cardsRef.current.get(path)
    if (before && (before.content ?? '') !== text) remember({ ...before, content: text })

    if (then === 'sibling' && me) {
      addNode(me.parent, orderAfter(siblingsOf(me.parent), me.order))
    } else if (then === 'child' && me) {
      const kids = siblingsOf(me.path)
      addNode(me.path, orderAfter(kids, kids.length ? Math.max(...kids.map((k) => k.order)) : null))
    } else if (then === 'outdent' && me) {
      // Outdent MOVES this node rather than creating one, so the editor stays
      // put — otherwise the next thing typed lands nowhere.
      void outdent(me)
    } else {
      setEditing(null)
    }

    void saveContent(path, text)
  }

  const outdent = async (me: CardStruct) => {
    if (!me.parent) return
    const parent = structs.find((s) => s.path === me.parent)
    if (!parent) return
    await patch(me.path, {
      parent: parent.parent,
      order: orderAfter(siblingsOf(parent.parent), parent.order),
    })
    setSelected(me.path)
  }

  const startEdit = (path: string) => {
    const note = byPath.get(path)
    // A ref node has no text of its own — its label is the note it points at.
    // Letting F2 open an editor over it would offer an edit that cannot stick.
    if (note && refOf(note.metadata)) {
      setSelected(path)
      return
    }
    setDraft(note?.content ?? '')
    setSelected(path)
    setEditing(path)
  }

  // A card created by double-clicking the plane arrives from the surface —
  // drop into its editor so the keyboard flow starts without another click.
  useEffect(() => {
    if (!autoEditPath) return
    if (!byPath.has(autoEditPath)) return
    setDraft(byPath.get(autoEditPath)?.content ?? '')
    setSelected(autoEditPath)
    setEditing(autoEditPath)
    onAutoEditConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEditPath, byPath])

  // Keep the node being edited on screen. The tree grows rightward, so a couple
  // of Tabs can put the new node past the viewport edge — and typing into a node
  // you cannot see is the flow failing quietly.
  useEffect(() => {
    if (!editing) return
    const el = els.current.get(editing)
    if (el?.isConnected) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [editing, placed])

  const wasEditing = useRef(false)
  useEffect(() => {
    const open = editing !== null
    // Focus only on the transition into editing. While chaining, the element
    // never unmounts and already holds focus — refocusing would fight typing.
    if (open && !wasEditing.current) {
      const el = inputRef.current
      el?.focus()
      el?.setSelectionRange(el.value.length, el.value.length)
    }
    wasEditing.current = open
  }, [editing])

  // ── Keyboard, only when a card is SELECTED and not being edited ──────────
  // The block editor binds Tab to nest todos; map mode must never steal that,
  // so these listeners bail the moment focus is inside any editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, [contenteditable="true"], .ProseMirror')) return
      if (!selected) return
      const me = structs.find((s) => s.path === selected)
      if (!me) return

      const ordered = [...placed].sort((a, b) => a.y - b.y || a.x - b.x)
      const idx = ordered.findIndex((p) => p.path === selected)

      if (e.key === 'Enter') {
        e.preventDefault()
        addNode(me.parent, orderAfter(siblingsOf(me.parent), me.order))
      } else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        const kids = siblingsOf(me.path)
        addNode(
          me.path,
          orderAfter(kids, kids.length ? Math.max(...kids.map((k) => k.order)) : null),
        )
      } else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        void outdent(me)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(ordered[Math.min(ordered.length - 1, idx + 1)]?.path ?? selected)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(ordered[Math.max(0, idx - 1)]?.path ?? selected)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (me.parent) setSelected(me.parent)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        const kids = siblingsOf(me.path).sort((a, b) => a.order - b.order)
        if (kids.length) {
          if (me.collapsed) void patch(me.path, { collapsed: false })
          setSelected(kids[0].path)
        }
      } else if (e.key === 'F2') {
        e.preventDefault()
        startEdit(selected)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ── Cross-links ─────────────────────────────────────────────────────────
  /** Pointer position in PLANE units, so the preview tracks under any zoom. */
  const planePoint = (clientX: number, clientY: number) => {
    const host = rootRef.current?.parentElement
    if (!host) return { x: 0, y: 0 }
    const r = host.getBoundingClientRect()
    return { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom }
  }

  const beginLink = (from: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const start = planePoint(e.clientX, e.clientY)
    setLinking({ from, ...start })
    const move = (ev: PointerEvent) => setLinking({ from, ...planePoint(ev.clientX, ev.clientY) })
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setLinking(null)
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const to = el?.closest<HTMLElement>('[data-path]')?.dataset['path']
      if (!to || to === from) return
      addEdge(from, to)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /**
   * Create the link, then open its label input AT ONCE.
   *
   * 🔑 That auto-open is the whole design. An unlabelled arrow only says
   * "related somehow", which the tree already says by being a tree. Labelling
   * has to be the default and skipping it has to take effort — every tool does
   * the reverse, which is why boards fill up with meaningless lines.
   */
  const addEdge = (from: string, to: string) => {
    // Optimistic, for the same reason node creation is: the input has to be
    // ready for the very next keystroke. Waiting for the write means the first
    // few characters of the label are typed into nothing — which would quietly
    // defeat the one behaviour this feature exists to encourage.
    const edgeId = newCanvasEdgeId()
    const path = canvasCardPath(boardId, edgeId)
    const now = new Date(0).toISOString()
    remember({
      id: path,
      path,
      content: '',
      tags: ['canvas'],
      metadata: { ckind: 'edge', board: boardId, from, to, label: '' },
      createdAt: now,
      updatedAt: now,
    } as Note)
    setEdgeDraft('')
    setEdgeEditing(path)

    const p: Promise<Note> = createCanvasEdge(boardId, { from, to, edgeId })
      .then((note) => {
        remember(note)
        return note
      })
      .catch((e) => {
        toast('error', `Couldn’t link — ${e instanceof Error ? e.message : e}`)
        throw e
      })
    queues.current.set(
      path,
      p.catch(() => undefined),
    )
  }

  const saveEdgeLabel = (path: string, label: string) =>
    enqueue(path, async () => {
      const cur = latest.current.get(path) ?? edges.find((x) => x.path === path)
      if (!cur) return
      try {
        const updated = await updateCanvasNote(cur.path, cur.updatedAt, {
          content: label.trim(),
          metadata: { ...cur.metadata, label: label.trim() },
        })
        remember(updated)
      } catch (e) {
        toast('error', `Couldn’t label link — ${e instanceof Error ? e.message : e}`)
      }
    })

  const removeEdge = async (path: string) => {
    setEdgeEditing((p) => (p === path ? null : p))
    try {
      await deleteCanvasEdge(path)
      onRemove(path)
    } catch (e) {
      toast('error', `Couldn’t remove link — ${e instanceof Error ? e.message : e}`)
    }
  }

  useEffect(() => {
    if (edgeEditing) edgeInputRef.current?.focus()
  }, [edgeEditing])

  /** A straight-sided elbow between two nodes: out, one turn, in. No routing,
   * no curves. Crossings are allowed — untangling them is a different tool. */
  const linkGeom = (from: string, to: string) => {
    const a = posOf.get(from)
    const b = posOf.get(to)
    if (!a || !b) return null
    const ah = heightOf(from)
    const bh = heightOf(to)
    const rightward = b.x >= a.x
    const sx = rightward ? a.x + MAP_CARD_W : a.x
    const ex = rightward ? b.x : b.x + MAP_CARD_W
    const sy = a.y + ah / 2
    const ey = b.y + bh / 2
    const mid = sx + (ex - sx) / 2
    const d =
      Math.abs(sy - ey) < 0.5
        ? `M ${sx} ${sy} H ${ex}`
        : `M ${sx} ${sy} H ${mid} V ${ey} H ${ex}`
    return { d, lx: mid, ly: (sy + ey) / 2 }
  }

  // Edges: right edge of the parent, into the left edge of the child. Out
  // horizontal, turn, in horizontal — no diagonals, no curves.
  const edgePath = (from: string, to: string): string | null => {
    const p = posOf.get(from)
    const c = posOf.get(to)
    if (!p || !c) return null
    const sx = p.x + MAP_CARD_W
    const sy = p.y + heightOf(from) / 2
    const ex = c.x
    const ey = c.y + heightOf(to) / 2
    const mid = sx + (ex - sx) / 2
    if (Math.abs(sy - ey) < 0.5) return `M ${sx} ${sy} H ${ex}`
    return `M ${sx} ${sy} H ${mid} V ${ey} H ${ex}`
  }

  return (
    <div className="map-layer" ref={rootRef}>
      <svg className="map-edges" data-testid="map-edges" aria-hidden="true">
        <defs>
          <marker
            id="map-arrowhead"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--gold)" />
          </marker>
        </defs>
        {links.map((l) => {
          const d = edgePath(l.from, l.to)
          return d ? <path key={`${l.from}->${l.to}`} d={d} className="map-edge" /> : null
        })}
        {edges.map((e) => {
          const from = String(e.metadata?.['from'] ?? '')
          const to = String(e.metadata?.['to'] ?? '')
          const g = linkGeom(from, to)
          return g ? (
            <path
              key={e.path}
              d={g.d}
              className="map-link"
              data-testid="map-link"
              markerEnd="url(#map-arrowhead)"
            />
          ) : null
        })}
        {linking &&
          (() => {
            const a = posOf.get(linking.from)
            if (!a) return null
            const sx = a.x + MAP_CARD_W
            const sy = a.y + heightOf(linking.from) / 2
            return (
              <path
                className="map-link is-preview"
                data-testid="map-link-preview"
                d={`M ${sx} ${sy} H ${(sx + linking.x) / 2} V ${linking.y} H ${linking.x}`}
              />
            )
          })()}
      </svg>

      {placed.map((p) => {
        const note = byPath.get(p.path)
        if (!note) return null
        const isEditing = editing === p.path
        const label = labelOf(note)
        // A ref node shows the note it points at, live. Its stored label is
        // only the fallback the layout engine measured; the vault is the truth.
        const ref = refOf(note.metadata)
        const resolved = ref ? resolveRef(ref, refIndex ?? null) : null
        return (
          <div
            key={p.path}
            ref={measureRef}
            data-path={p.path}
            data-testid="map-node"
            className={`map-node${selected === p.path ? ' is-selected' : ''}${
              isEditing ? ' is-editing' : ''
            }${resolved ? ' is-ref' : ''}`}
            style={{ left: p.x, top: p.y, width: MAP_CARD_W }}
            onClick={() => setSelected(p.path)}
            onDoubleClick={(ev) => {
              ev.stopPropagation()
              // 🔴 A plain node edits HERE. This used to navigate to the page
              // editor, which threw you out of the canvas mid-thought.
              // A REF node is the one case where leaving IS the point: it has
              // no text of its own, so double-click opens the note it names.
              if (resolved) {
                const target = resolved.status === 'ok' ? resolved.path : ''
                if (target) {
                  navigate(
                    target.startsWith('pages/')
                      ? { kind: 'pages', path: target }
                      : { kind: 'note', path: target },
                  )
                }
                return
              }
              startEdit(p.path)
            }}
          >
            {p.hasChildren && (
              <button
                className="map-node-chevron"
                data-testid="map-collapse"
                title={p.collapsedWithChildren ? 'Expand branch' : 'Collapse branch'}
                aria-expanded={!p.collapsedWithChildren}
                onClick={(e) => {
                  e.stopPropagation()
                  void patch(p.path, { collapsed: !p.collapsedWithChildren })
                }}
              >
                {p.collapsedWithChildren ? '▸' : '▾'}
              </button>
            )}
            <div className="map-node-label">
              {resolved ? (
                <span className="map-node-ref" data-testid="map-ref" data-ref-status={resolved.status}>
                  <span className="map-node-ref-title">{resolved.title}</span>
                  {resolved.status === 'missing' && (
                    <span className="map-node-ref-gone" data-testid="map-ref-gone">
                      gone from the vault
                    </span>
                  )}
                </span>
              ) : (
                label || <span className="map-node-empty">Untitled</span>
              )}
            </div>
            {p.collapsedWithChildren && <span className="map-node-badge">…</span>}
            <span
              className="map-node-port"
              data-testid="map-port"
              title="Drag to another node to link them"
              onPointerDown={beginLink(p.path)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )
      })}

      {/* Cross-link labels — a small box at the midpoint, editable in place. */}
      {edges.map((e) => {
        const g = linkGeom(String(e.metadata?.['from'] ?? ''), String(e.metadata?.['to'] ?? ''))
        if (!g) return null
        const label = String(e.metadata?.['label'] ?? e.content ?? '')
        const isEditing = edgeEditing === e.path
        return (
          <div
            key={`label:${e.path}`}
            className={`map-link-label${isEditing ? ' is-editing' : ''}`}
            data-testid="map-link-label"
            style={{ left: g.lx, top: g.ly }}
          >
            {isEditing ? (
              <input
                ref={edgeInputRef}
                className="map-link-input"
                data-testid="map-link-input"
                placeholder="how are they related?"
                value={edgeDraft}
                onChange={(ev) => setEdgeDraft(ev.target.value)}
                onBlur={() => {
                  setEdgeEditing(null)
                  void saveEdgeLabel(e.path, edgeDraft)
                }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === 'Escape') {
                    ev.preventDefault()
                    setEdgeEditing(null)
                    void saveEdgeLabel(e.path, edgeDraft)
                  }
                }}
              />
            ) : (
              <>
                <button
                  className="map-link-text"
                  onClick={() => {
                    setEdgeDraft(label)
                    setEdgeEditing(e.path)
                  }}
                >
                  {label || <em>unlabelled</em>}
                </button>
                <button
                  className="map-link-x"
                  data-testid="map-link-remove"
                  title="Remove link"
                  aria-label="Remove link"
                  onClick={() => void removeEdge(e.path)}
                >
                  ×
                </button>
              </>
            )}
          </div>
        )
      })}

      {/* 🔑 ONE textarea for the whole map, moved rather than re-created.
          A per-node editor unmounts on every Enter/Tab, and the focus gap that
          opens while the next one mounts silently swallows keystrokes — which
          is fatal for a flow whose whole promise is typing without pausing. */}
      {editing && posOf.get(editing) && (
        <div
          className="map-node is-editing map-node-editor"
          style={{
            left: posOf.get(editing)!.x,
            top: posOf.get(editing)!.y,
            width: MAP_CARD_W,
          }}
        >
          <textarea
            ref={inputRef}
            className="map-node-input"
            data-testid="map-node-input"
            value={draft}
            rows={Math.min(8, Math.max(1, draft.split('\n').length))}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commit('sibling')
              } else if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault()
                commit('child')
              } else if (e.key === 'Tab' && e.shiftKey) {
                e.preventDefault()
                commit('outdent')
              } else if (e.key === 'Escape') {
                e.preventDefault()
                commit(null)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
