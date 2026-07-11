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
  toast,
  updateCanvasNote,
} from '../lib/store'
import { renderMarkdown } from '../lib/markdown'
import { relativeTime } from '../lib/format'
import { IconPlus, IconClose, IconBack } from '../components/Icons'

const CANVAS_PREFIX = 'canvas/'
const GRID = 20
const CARD_W = 240
const CARD_H = 150
const MIN_W = 140
const MIN_H = 80

const snap = (v: number) => Math.round(v / GRID) * GRID
const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

interface BoardMeta {
  id: string
  title: string
  path: string
  updatedAt: string
  count: number
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

export function CanvasView() {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
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
  useEffect(() => setTitle(board.title), [board.title, board.path])

  const addCard = async () => {
    const el = scrollRef.current
    // Drop the card near the top-left of what's currently in view.
    const x = snap((el?.scrollLeft ?? 0) + 48)
    const y = snap((el?.scrollTop ?? 0) + 48)
    try {
      const note = await createCanvasCard(board.id, { x, y, w: CARD_W, h: CARD_H })
      upsert(note)
    } catch (e) {
      toast('error', `Couldn’t add card — ${e instanceof Error ? e.message : e}`)
    }
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
        <div className="canvas-bar-actions">
          <button className="btn btn-gold" onClick={() => void addCard()}>
            <IconPlus size={13} /> Add card
          </button>
          <button className="btn btn-ghost canvas-danger" onClick={() => void removeBoard()}>
            Delete canvas
          </button>
        </div>
      </header>

      <div className="canvas-scroll" ref={scrollRef}>
        <div className="canvas-plane">
          {cards.length === 0 && (
            <div className="canvas-empty-hint">
              Hit <b>Add card</b> and start writing. Drag the header to move · drag the corner to resize.
            </div>
          )}
          {cards.map((card) => (
            <CanvasCard key={card.path} note={card} upsert={upsert} remove={remove} />
          ))}
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
  upsert,
  remove,
}: {
  note: Note
  upsert: (n: Note) => void
  remove: (path: string) => void
}) {
  const base: Geom = {
    x: num(note.metadata?.['x'], 40),
    y: num(note.metadata?.['y'], 40),
    w: num(note.metadata?.['w'], CARD_W),
    h: num(note.metadata?.['h'], CARD_H),
  }
  // Live geometry while dragging/resizing (avoids a vault write per frame).
  const [live, setLive] = useState<Geom | null>(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.content ?? '')
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; start: Geom } | null>(null)
  const latest = useRef<Note>(note)
  latest.current = note

  useEffect(() => {
    if (!editing) setText(note.content ?? '')
  }, [note.content, editing])

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
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
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

  const saveText = async () => {
    setEditing(false)
    const next = text
    if (next === (latest.current.content ?? '')) return
    const cur = latest.current
    try {
      const updated = await updateCanvasNote(cur.path, cur.updatedAt, { content: next })
      upsert(updated)
    } catch (e) {
      toast('error', `Couldn’t save card — ${e instanceof Error ? e.message : e}`)
      setText(cur.content ?? '')
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

  return (
    <article
      className={`canvas-card${live ? ' is-live' : ''}${editing ? ' is-editing' : ''}`}
      style={{ left: geom.x, top: geom.y, width: geom.w, height: geom.h }}
    >
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
        <textarea
          className="canvas-card-textarea"
          autoFocus
          value={text}
          placeholder="Write markdown…"
          onChange={(e) => setText(e.target.value)}
          onBlur={() => void saveText()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setText(note.content ?? '')
              setEditing(false)
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void saveText()
          }}
        />
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
