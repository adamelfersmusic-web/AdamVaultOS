// The Canvas tab — freeform, Obsidian-style boards. Pick a canvas (or make one),
// then drop markdown cards and drag / resize / reposition them. Every board and
// every card is a real vault note under `canvas/` (tagged `canvas`, excluded
// from the knowledge graph), so a canvas IS your notes — just spatial.
//
// Level 1 (tonight): create canvases · add cards · move · resize · edit · delete.
// Level 2 (later): typed edges between cards, groups/frames, links to real notes.
//
// Nothing is auto-written: a move/resize commits on pointer-up, an edit on save.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import {
  createCanvasBoard,
  createCanvasCard,
  deleteCanvasBoard,
  deleteCanvasCard,
  loadCanvasNotes,
  movePage,
  toast,
  updateCanvasNote,
} from '../lib/store'
import { navigate } from '../lib/router'
import { renderMarkdown } from '../lib/markdown'
import { relativeTime, slugify } from '../lib/format'
import { IconPlus, IconClose, IconBack } from '../components/Icons'
import { CardEditor } from '../components/CardEditor'
import { CanvasMap } from './CanvasMap'

const CANVAS_PREFIX = 'canvas/'
const GRID = 20
const CARD_W = 240
const CARD_H = 150
const MIN_W = 140
const MIN_H = 80
// Zoom is viewport state only — it is never written to a note.
const ZOOM_KEY = 'adamvaultos.canvas.zoom'
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
// The plane grows to fit the furthest card plus a margin. It does NOT grow
// up or left: card x/y stay clamped at 0, so this is a big zoomable board,
// not an infinite one — negative space would be a viewport rewrite.
const PLANE_MIN_W = 3000
const PLANE_MIN_H = 2200
const PLANE_MARGIN = 600

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100))

const snap = (v: number) => Math.round(v / GRID) * GRID
const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

interface BoardMeta {
  id: string
  title: string
  path: string
  updatedAt: string
  count: number
  /** 'map' auto-places from structure; 'free' (default) uses stored x/y. */
  mode: 'map' | 'free'
}

function boardIdOf(note: Note): string {
  return note.path.slice(CANVAS_PREFIX.length).split('/')[0] ?? ''
}
function isBoard(n: Note): boolean {
  return n.metadata?.['ckind'] === 'board'
}
function isCard(n: Note): boolean {
  return n.metadata?.['ckind'] === 'card'
}

// The board you were working on — restored on return so "← Canvas" from a
// card's full page drops you back INTO the board, not at the gallery.
const ACTIVE_BOARD_KEY = 'adamvaultos.canvas.board'

export function CanvasView() {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActiveRaw] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_BOARD_KEY) || null,
  )
  const setActive = (id: string | null) => {
    if (id) localStorage.setItem(ACTIVE_BOARD_KEY, id)
    else localStorage.removeItem(ACTIVE_BOARD_KEY)
    setActiveRaw(id)
  }
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    setError(null)
    loadCanvasNotes()
      .then((all) => {
        if (seq.current === id) setNotes(all)
      })
      .catch((e) => {
        if (seq.current === id) setError(e instanceof Error ? e.message : String(e))
      })
  }, [])

  const upsert = (n: Note) =>
    setNotes((prev) => {
      const m = new Map((prev ?? []).map((x) => [x.path, x]))
      m.set(n.path, n)
      return [...m.values()]
    })
  const remove = (path: string) =>
    setNotes((prev) => (prev ?? []).filter((x) => x.path !== path))

  const boards = useMemo<BoardMeta[]>(() => {
    const all = notes ?? []
    const counts = new Map<string, number>()
    for (const n of all) if (isCard(n)) counts.set(boardIdOf(n), (counts.get(boardIdOf(n)) ?? 0) + 1)
    return all
      .filter(isBoard)
      .map((n) => ({
        id: boardIdOf(n),
        title: String(n.metadata?.['title'] ?? n.content ?? 'Untitled canvas').trim() || 'Untitled canvas',
        path: n.path,
        updatedAt: n.updatedAt,
        count: counts.get(boardIdOf(n)) ?? 0,
        mode: (n.metadata?.['mode'] === 'map' ? 'map' : 'free') as 'map' | 'free',
      }))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }, [notes])

  const activeCards = useMemo<Note[]>(
    () => (notes ?? []).filter((n) => isCard(n) && boardIdOf(n) === active),
    [notes, active],
  )
  const activeBoard = boards.find((b) => b.id === active) ?? null

  const newCanvas = async () => {
    try {
      const note = await createCanvasBoard('Untitled canvas')
      upsert(note)
      setActive(boardIdOf(note))
    } catch (e) {
      toast('error', `Couldn’t create canvas — ${e instanceof Error ? e.message : e}`)
    }
  }

  if (error) {
    return (
      <div className="db-state">
        <p className="db-state-title">Couldn’t load canvases</p>
        <p className="db-state-msg">{error}</p>
      </div>
    )
  }
  if (notes === null) {
    return (
      <div className="db-skeleton" aria-label="Loading">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="skel-row" key={i} style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
    )
  }

  if (active && activeBoard) {
    return (
      <CanvasSurface
        board={activeBoard}
        cards={activeCards}
        onBack={() => setActive(null)}
        upsert={upsert}
        remove={remove}
        onRenamed={(n) => upsert(n)}
      />
    )
  }

  // Gallery of canvases.
  return (
    <div className="canvas-home">
      <header className="canvas-home-head">
        <div>
          <h1 className="db-title">Canvas</h1>
          <p className="canvas-home-sub">
            Freeform boards — write cards and drag them around. Each canvas lives in your vault.
          </p>
        </div>
        <button className="btn btn-gold" onClick={() => void newCanvas()}>
          <IconPlus size={13} /> New canvas
        </button>
      </header>

      {boards.length === 0 ? (
        <div className="db-state">
          <p className="db-state-title">No canvases yet</p>
          <p className="db-state-msg">Make your first one — a blank space to think in.</p>
          <button className="btn btn-gold" onClick={() => void newCanvas()}>
            <IconPlus size={13} /> New canvas
          </button>
        </div>
      ) : (
        <div className="canvas-grid">
          {boards.map((b) => (
            <button key={b.id} className="canvas-tile" onClick={() => setActive(b.id)}>
              <div className="canvas-tile-preview" aria-hidden="true">
                <span className="canvas-tile-dots" />
              </div>
              <div className="canvas-tile-title">{b.title}</div>
              <div className="canvas-tile-meta">
                {b.count} {b.count === 1 ? 'card' : 'cards'} · {relativeTime(b.updatedAt)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The board surface
// ---------------------------------------------------------------------------

function CanvasSurface({
  board,
  cards,
  onBack,
  upsert,
  remove,
  onRenamed,
}: {
  board: BoardMeta
  cards: Note[]
  onBack: () => void
  upsert: (n: Note) => void
  remove: (path: string) => void
  onRenamed: (n: Note) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState(board.title)
  // The card that should open straight into edit mode (just created).
  const [freshPath, setFreshPath] = useState<string | null>(null)
  useEffect(() => setTitle(board.title), [board.title, board.path])

  // ── Zoom ────────────────────────────────────────────────────────────────
  // The plane is scaled with a CSS transform; everything stored stays in PLANE
  // units, so zoom is pure viewport state and never reaches the vault. Every
  // screen→plane conversion below divides by `zoom` — miss one and a card
  // lands somewhere you didn't drop it.
  const [zoom, setZoom] = useState<number>(() => {
    const v = Number(localStorage.getItem(ZOOM_KEY))
    return Number.isFinite(v) && v >= MIN_ZOOM && v <= MAX_ZOOM ? v : 1
  })
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const setZoomPersisted = (z: number) => {
    const next = clampZoom(z)
    localStorage.setItem(ZOOM_KEY, String(next))
    setZoom(next)
  }

  /** Zoom about a screen point, keeping whatever is under it exactly there. */
  const zoomAt = (nextRaw: number, clientX: number, clientY: number) => {
    const el = scrollRef.current
    const z0 = zoomRef.current
    const z1 = clampZoom(nextRaw)
    if (z1 === z0 || !el) {
      setZoomPersisted(z1)
      return
    }
    const rect = el.getBoundingClientRect()
    // Where the cursor sits in PLANE units — invariant across the zoom.
    const px = (el.scrollLeft + clientX - rect.left) / z0
    const py = (el.scrollTop + clientY - rect.top) / z0
    setZoomPersisted(z1)
    // Re-anchor after the new scale has been laid out.
    requestAnimationFrame(() => {
      const s = scrollRef.current
      if (!s) return
      s.scrollLeft = px * z1 - (clientX - rect.left)
      s.scrollTop = py * z1 - (clientY - rect.top)
    })
  }

  // ⌘/ctrl + wheel zooms. A bare wheel keeps scrolling the board, as it does
  // today. Non-passive so the browser's own page zoom can be prevented.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomAt(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Pan ─────────────────────────────────────────────────────────────────
  // Hold space (or use the middle button) and drag the board around. Space is
  // ignored while typing, so it can't hijack the space bar inside a card.
  const [spaceDown, setSpaceDown] = useState(false)
  useEffect(() => {
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      return !!el?.closest?.('input, textarea, [contenteditable="true"], .ProseMirror')
    }
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !typing(e.target)) {
        e.preventDefault()
        setSpaceDown(true)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    const blur = () => setSpaceDown(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const beginPan = (e: React.PointerEvent<HTMLDivElement>) => {
    const middle = e.button === 1
    if (!middle && !spaceDown) return
    e.preventDefault()
    const el = scrollRef.current
    if (!el) return
    const sx = e.clientX
    const sy = e.clientY
    const left = el.scrollLeft
    const top = el.scrollTop
    const move = (ev: PointerEvent) => {
      el.scrollLeft = left - (ev.clientX - sx)
      el.scrollTop = top - (ev.clientY - sy)
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  // Map vs free. Stored on the board note, so the board reopens the way you
  // left it. Map mode computes positions; free mode owns the stored x/y and
  // map mode never overwrites them — the toggle is lossless both ways.
  const mapMode = board.mode === 'map'
  const setMode = async (mode: 'map' | 'free') => {
    if (mode === (board.mode ?? 'free')) return
    try {
      const note = await updateCanvasNote(board.path, board.updatedAt, {
        metadata: { ckind: 'board', title: board.title, mode },
      })
      onRenamed(note)
    } catch (e) {
      toast('error', `Couldn’t switch mode — ${e instanceof Error ? e.message : e}`)
    }
  }

  // Plane extents follow the furthest card, so the board grows as work spreads
  // instead of stopping at a hard edge.
  const { planeW, planeH } = useMemo(() => {
    let right = 0
    let bottom = 0
    for (const c of cards) {
      right = Math.max(right, num(c.metadata?.['x'], 0) + num(c.metadata?.['w'], CARD_W))
      bottom = Math.max(bottom, num(c.metadata?.['y'], 0) + num(c.metadata?.['h'], CARD_H))
    }
    return {
      planeW: Math.max(PLANE_MIN_W, right + PLANE_MARGIN),
      planeH: Math.max(PLANE_MIN_H, bottom + PLANE_MARGIN),
    }
  }, [cards])

  const createAt = async (x: number, y: number) => {
    try {
      // In map mode a card dropped on empty plane is a new trunk: it needs a
      // parent (none) and a place among the other trunks, or the layout engine
      // has nothing to read.
      const trunkOrder = mapMode
        ? Math.max(
            0,
            ...cards
              .filter((c) => !c.metadata?.['parent'])
              .map((c) => Number(c.metadata?.['order']) || 0),
          ) + 10
        : undefined
      const note = await createCanvasCard(board.id, {
        x: Math.max(0, snap(x)),
        y: Math.max(0, snap(y)),
        w: CARD_W,
        h: CARD_H,
        ...(mapMode ? { parent: null, order: trunkOrder } : {}),
      })
      upsert(note)
      setFreshPath(note.path) // open it in edit immediately
    } catch (e) {
      toast('error', `Couldn’t add card — ${e instanceof Error ? e.message : e}`)
    }
  }

  const addCard = async () => {
    const el = scrollRef.current
    // Drop the card near the top-left of what's currently in view — scroll is
    // in screen px, the card's x/y are plane units.
    await createAt((el?.scrollLeft ?? 0) / zoom + 48, (el?.scrollTop ?? 0) / zoom + 48)
  }

  // C1 — double-click empty canvas → a card right there, already in edit.
  const onPlaneDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.canvas-card')) return
    // The plane's rect is already scaled, so the offset within it is screen px.
    const rect = e.currentTarget.getBoundingClientRect()
    void createAt((e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom)
  }

  const commitTitle = async () => {
    const next = title.trim() || 'Untitled canvas'
    if (next === board.title) return
    try {
      const note = await updateCanvasNote(board.path, board.updatedAt, {
        content: next,
        metadata: { ckind: 'board', title: next },
      })
      onRenamed(note)
    } catch {
      setTitle(board.title) // conflict / error — revert the field
    }
  }

  const removeBoard = async () => {
    if (!window.confirm(`Delete “${board.title}” and its ${cards.length} card(s)? This can’t be undone.`)) {
      return
    }
    try {
      await deleteCanvasBoard(board.id)
      onBack()
    } catch (e) {
      toast('error', `Couldn’t delete canvas — ${e instanceof Error ? e.message : e}`)
    }
  }

  return (
    <div className="canvas-shell">
      <header className="canvas-bar">
        <button className="canvas-back" onClick={onBack} title="All canvases">
          <IconBack size={13} /> Canvases
        </button>
        <input
          className="canvas-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          aria-label="Canvas title"
        />
        <span className="canvas-bar-count">
          {cards.length} {cards.length === 1 ? 'card' : 'cards'}
        </span>
        <div className="canvas-mode" role="group" aria-label="Layout" data-testid="canvas-mode">
          <button
            className={!mapMode ? 'is-on' : ''}
            aria-pressed={!mapMode}
            data-testid="mode-free"
            title="Free canvas — you place the cards"
            onClick={() => void setMode('free')}
          >
            Free
          </button>
          <button
            className={mapMode ? 'is-on' : ''}
            aria-pressed={mapMode}
            data-testid="mode-map"
            title="Map — Enter for a sibling, Tab for a child; placement is automatic"
            onClick={() => void setMode('map')}
          >
            Map
          </button>
        </div>
        <div className="canvas-zoom" role="group" aria-label="Zoom" data-testid="canvas-zoom">
          <button
            title="Zoom out"
            aria-label="Zoom out"
            data-testid="zoom-out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoomPersisted(zoom / 1.25)}
          >
            −
          </button>
          <button
            className="canvas-zoom-level"
            title="Reset to 100%"
            data-testid="zoom-reset"
            onClick={() => setZoomPersisted(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            title="Zoom in"
            aria-label="Zoom in"
            data-testid="zoom-in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoomPersisted(zoom * 1.25)}
          >
            +
          </button>
        </div>
        <div className="canvas-bar-actions">
          <button className="btn btn-gold" onClick={() => void addCard()}>
            <IconPlus size={13} /> Add card
          </button>
          <button className="btn btn-ghost canvas-danger" onClick={() => void removeBoard()}>
            Delete canvas
          </button>
        </div>
      </header>

      <div
        className={`canvas-scroll${spaceDown ? ' is-pannable' : ''}`}
        ref={scrollRef}
        onPointerDown={beginPan}
      >
        {/* The sizer carries the SCALED extents — a CSS transform doesn't
            change layout size, so without it the scrollbars would describe the
            un-zoomed plane and half the board would be unreachable. */}
        <div
          className="canvas-sizer"
          style={{ width: planeW * zoom, height: planeH * zoom }}
        >
        <div
          className="canvas-plane"
          onDoubleClick={onPlaneDoubleClick}
          data-testid="canvas-plane"
          style={{
            width: planeW,
            height: planeH,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {cards.length === 0 && (
            <div className="canvas-empty-hint">
              {mapMode ? (
                <>
                  <b>Double-click anywhere</b> to start the trunk. Then <kbd>Enter</kbd> for a
                  sibling, <kbd>Tab</kbd> for a child, <kbd>⇧Tab</kbd> to outdent — placement is
                  automatic.
                </>
              ) : (
                <>
                  <b>Double-click anywhere</b> to drop a card. Drag the header to move · drag the
                  corner to resize · <code>/todo</code> for checkboxes, Tab to nest.
                </>
              )}
            </div>
          )}
          {mapMode ? (
            <CanvasMap
              boardId={board.id}
              cards={cards}
              upsert={upsert}
              autoEditPath={freshPath}
              onAutoEditConsumed={() => setFreshPath(null)}
              onOpenCard={(path) => navigate({ kind: 'pages', path })}
            />
          ) : (
            cards.map((card) => (
              <CanvasCard
                key={card.path}
                note={card}
                zoom={zoom}
                upsert={upsert}
                remove={remove}
                autoEdit={card.path === freshPath}
                onEditClosed={() => setFreshPath((p) => (p === card.path ? null : p))}
              />
            ))
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// A single card — drag (header), resize (corner), edit (body), delete.
// ---------------------------------------------------------------------------

interface Geom {
  x: number
  y: number
  w: number
  h: number
}

function CanvasCard({
  note,
  zoom,
  upsert,
  remove,
  autoEdit = false,
  onEditClosed,
}: {
  note: Note
  /** Plane scale. Pointer deltas arrive in SCREEN px and must be divided by
   * it — without this a card at 50% zoom moves twice as far as the cursor. */
  zoom: number
  upsert: (n: Note) => void
  remove: (path: string) => void
  /** Freshly created via double-click — open straight into edit. */
  autoEdit?: boolean
  onEditClosed?: () => void
}) {
  const base: Geom = {
    x: num(note.metadata?.['x'], 40),
    y: num(note.metadata?.['y'], 40),
    w: num(note.metadata?.['w'], CARD_W),
    h: num(note.metadata?.['h'], CARD_H),
  }
  // Live geometry while dragging/resizing (avoids a vault write per frame).
  const [live, setLive] = useState<Geom | null>(null)
  const [editing, setEditing] = useState(autoEdit)
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; start: Geom } | null>(null)
  const latest = useRef<Note>(note)
  latest.current = note
  // The pointermove listener lives on window, so it would close over a stale
  // zoom. Read it through a ref that tracks the prop instead.
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const closeEdit = () => {
    setEditing(false)
    onEditClosed?.()
  }

  const geom = live ?? base

  const persist = async (g: Geom) => {
    const cur = latest.current
    try {
      const updated = await updateCanvasNote(cur.path, cur.updatedAt, {
        metadata: { ckind: 'card', board: boardIdOf(cur), x: g.x, y: g.y, w: g.w, h: g.h },
      })
      upsert(updated)
    } catch {
      /* conflict/error — the base geometry (from props) stays authoritative */
    } finally {
      setLive(null)
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / zoomRef.current
    const dy = (e.clientY - d.sy) / zoomRef.current
    if (d.mode === 'move') {
      setLive({ ...d.start, x: Math.max(0, d.start.x + dx), y: Math.max(0, d.start.y + dy) })
    } else {
      setLive({
        ...d.start,
        w: Math.max(MIN_W, d.start.w + dx),
        h: Math.max(MIN_H, d.start.h + dy),
      })
    }
  }

  const endDrag = () => {
    const d = drag.current
    drag.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    if (!d) return
    setLive((cur) => {
      if (cur) {
        const snapped: Geom = { x: snap(cur.x), y: snap(cur.y), w: snap(cur.w), h: snap(cur.h) }
        // Only write if something actually changed.
        if (snapped.x !== d.start.x || snapped.y !== d.start.y || snapped.w !== d.start.w || snapped.h !== d.start.h) {
          void persist(snapped)
          return snapped
        }
      }
      return null
    })
  }

  const beginDrag = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (editing) return
    // A pointerdown on a header button must reach its click handler — starting
    // a drag (and preventDefault) here would swallow Edit/Delete.
    if (mode === 'move' && (e.target as HTMLElement).closest('.canvas-card-btn')) return
    e.preventDefault()
    e.stopPropagation()
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: geom }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
  }

  const saveMarkdown = async (md: string) => {
    closeEdit()
    const cur = latest.current
    if (md.trim() === (cur.content ?? '').trim()) return
    try {
      const updated = await updateCanvasNote(cur.path, cur.updatedAt, { content: md })
      upsert(updated)
    } catch (e) {
      toast('error', `Couldn’t save card — ${e instanceof Error ? e.message : e}`)
    }
  }

  const del = async () => {
    try {
      await deleteCanvasCard(latest.current.path)
      remove(latest.current.path)
    } catch (e) {
      toast('error', `Couldn’t delete card — ${e instanceof Error ? e.message : e}`)
    }
  }

  const empty = !(note.content ?? '').trim()

  // Right-click → promote menu. A card is a canvas thing until YOU choose:
  // open it as a full page (stays on the canvas) or move it into Pages.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [menu])

  const moveToPages = async () => {
    const cur = latest.current
    const firstLine = (cur.content ?? '')
      .split('\n')
      .map((s) => s.trim())
      .find(Boolean)
    const slug =
      slugify((firstLine ?? '').replace(/^#{1,6}\s+/, '')) ||
      cur.path.split('/').pop() ||
      'card'
    try {
      const moved = await movePage(cur.path, `pages/${slug}`, cur.updatedAt)
      remove(cur.path)
      navigate({ kind: 'pages', path: moved.path })
    } catch (e) {
      toast('error', `Couldn’t move card — ${e instanceof Error ? e.message : e}`)
    }
  }

  return (
    <article
      className={`canvas-card${live ? ' is-live' : ''}${editing ? ' is-editing' : ''}`}
      style={{ left: geom.x, top: geom.y, width: geom.w, height: geom.h }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {menu && (
        <div
          className="card-menu"
          data-testid="card-menu"
          style={{ position: 'fixed', left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="card-menu-item"
            data-testid="card-open-page"
            onClick={() => {
              setMenu(null)
              navigate({ kind: 'pages', path: note.path })
            }}
          >
            Open as full page ↗
          </button>
          <button
            className="card-menu-item"
            data-testid="card-move-pages"
            onClick={() => {
              setMenu(null)
              void moveToPages()
            }}
          >
            Turn into a page (moves to Pages)
          </button>
        </div>
      )}
      <header className="canvas-card-head" onPointerDown={beginDrag('move')}>
        <span className="canvas-card-grip" aria-hidden="true">⠿</span>
        <div className="canvas-card-tools">
          {!editing && (
            <button className="canvas-card-btn" title="Edit" onClick={() => setEditing(true)}>
              ✎
            </button>
          )}
          <button className="canvas-card-btn" title="Delete card" onClick={() => void del()}>
            <IconClose size={11} />
          </button>
        </div>
      </header>

      {editing ? (
        <div className="canvas-card-edit">
          <CardEditor
            value={note.content ?? ''}
            onSave={(md) => void saveMarkdown(md)}
            onCancel={closeEdit}
          />
        </div>
      ) : (
        <div
          className={`canvas-card-body${empty ? ' is-empty' : ''}`}
          onDoubleClick={() => setEditing(true)}
          dangerouslySetInnerHTML={{
            __html: empty ? '<span class="canvas-card-placeholder">Double-click to write…</span>' : renderMarkdown(note.content ?? ''),
          }}
        />
      )}

      <span
        className="canvas-card-resize"
        title="Drag to resize"
        onPointerDown={beginDrag('resize')}
        aria-hidden="true"
      />
    </article>
  )
}
