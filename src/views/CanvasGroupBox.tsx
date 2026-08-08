// A group — a titled rectangle behind the cards, and the one thing on the
// canvas you drag to move several cards at once.
//
// 🔑 It stores NOTHING about its contents. Membership is read from position on
// every render (lib/canvasGroups), so a group can never disagree with what is
// visibly inside it, and there is no parent pointer to go stale.
//
// Groups live in FREE mode only. In map mode positions are computed, so a
// rectangle cannot hold anything — the layout would move cards straight out of
// it on the next render.

import { useEffect, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import { deleteCanvasGroup, moveCanvasNotes, toast, updateCanvasNote } from '../lib/store'
import { contentsOf, type Placed } from '../lib/canvasGroups'

export const GROUP_TONES = ['blue', 'green', 'purple', 'gold', 'red', 'neutral'] as const
export type GroupTone = (typeof GROUP_TONES)[number]

const MIN_W = 200
const MIN_H = 160

interface Geom {
  x: number
  y: number
  w: number
  h: number
}

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

export function geomOf(n: Note, fw = 320, fh = 240): Geom {
  return {
    x: num(n.metadata?.['x'], 0),
    y: num(n.metadata?.['y'], 0),
    w: num(n.metadata?.['w'], fw),
    h: num(n.metadata?.['h'], fh),
  }
}

export function CanvasGroupBox({
  note,
  cards,
  groups,
  zoom,
  count,
  snap,
  upsert,
  remove,
  onCarry,
}: {
  note: Note
  /** Every card on the board, for working out what this group carries. */
  cards: Note[]
  groups: Note[]
  zoom: number
  count: number
  snap: (v: number) => number
  upsert: (n: Note) => void
  remove: (path: string) => void
  /** Live offsets for carried cards during a drag; {} when idle. */
  onCarry: (m: Record<string, { x: number; y: number }>) => void
}) {
  const base = geomOf(note)
  const [live, setLive] = useState<Geom | null>(null)
  const geom = live ?? base
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(String(note.metadata?.['title'] ?? note.content ?? ''))
  const [menu, setMenu] = useState(false)
  const tone = (String(note.metadata?.['tone'] ?? 'blue') as GroupTone) ?? 'blue'

  const latest = useRef(note)
  latest.current = note
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  // Cards carried by THIS drag, captured on pointerdown. Recomputing mid-drag
  // would pick up cards the group has just been dragged over — the contents
  // must be whatever was inside when the gesture started.
  const carried = useRef<{ note: Note; from: Geom }[]>([])
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; start: Geom } | null>(null)
  // Live positions for the cards this group is carrying, reported upward so the
  // surface can render them following the group before anything is written.
  const setCarryLive = onCarry

  useEffect(() => setTitle(String(note.metadata?.['title'] ?? note.content ?? '')), [note])

  const asPlaced = (n: Note): Placed => ({ path: n.path, ...geomOf(n) })

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / zoomRef.current
    const dy = (e.clientY - d.sy) / zoomRef.current
    if (d.mode === 'move') {
      setLive({ ...d.start, x: Math.max(0, d.start.x + dx), y: Math.max(0, d.start.y + dy) })
      const next: Record<string, { x: number; y: number }> = {}
      for (const c of carried.current) {
        next[c.note.path] = { x: Math.max(0, c.from.x + dx), y: Math.max(0, c.from.y + dy) }
      }
      setCarryLive(next)
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
      if (!cur) return null
      const snapped: Geom = { x: snap(cur.x), y: snap(cur.y), w: snap(cur.w), h: snap(cur.h) }
      const moved =
        snapped.x !== d.start.x ||
        snapped.y !== d.start.y ||
        snapped.w !== d.start.w ||
        snapped.h !== d.start.h
      if (moved) void persist(snapped, d.mode === 'move' ? snapped.x - d.start.x : 0, d.mode === 'move' ? snapped.y - d.start.y : 0)
      else {
        carried.current = []
        setCarryLive({})
        return null
      }
      return snapped
    })
  }

  const persist = async (g: Geom, dx: number, dy: number) => {
    const cur = latest.current
    const moves = [
      {
        path: cur.path,
        updatedAt: cur.updatedAt,
        metadata: { ...cur.metadata, w: g.w, h: g.h },
        x: g.x,
        y: g.y,
      },
      ...carried.current.map((c) => ({
        path: c.note.path,
        updatedAt: c.note.updatedAt,
        metadata: c.note.metadata,
        x: Math.max(0, snap(c.from.x + dx)),
        y: Math.max(0, snap(c.from.y + dy)),
      })),
    ]
    try {
      const res = await moveCanvasNotes(moves)
      if (res.failed > 0) {
        toast(
          'error',
          `Couldn’t move the whole group — ${res.failed} card${res.failed === 1 ? '' : 's'} failed, so nothing moved.`,
        )
      } else {
        for (const n of res.ok) upsert(n)
      }
    } finally {
      carried.current = []
      setCarryLive({})
      setLive(null)
    }
  }

  const beginDrag = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (editing) return
    // Only the action buttons block a drag. The title used to, and since it
    // fills most of the header the group was effectively undraggable.
    if (mode === 'move' && (e.target as HTMLElement).closest('.group-action')) return
    e.preventDefault()
    e.stopPropagation()
    const start = geomOf(latest.current)
    if (mode === 'move') {
      // Snapshot the contents NOW.
      const inside = contentsOf(
        { path: latest.current.path, ...start },
        cards.map(asPlaced),
        groups.map(asPlaced),
      )
      const wanted = new Set([...inside.cards, ...inside.groups])
      carried.current = [...cards, ...groups]
        .filter((n) => wanted.has(n.path) && n.path !== latest.current.path)
        .map((n) => ({ note: n, from: geomOf(n) }))
    }
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
  }

  const commitTitle = async () => {
    setEditing(false)
    const cur = latest.current
    const next = title.trim()
    if (next === String(cur.metadata?.['title'] ?? '')) return
    try {
      const updated = await updateCanvasNote(cur.path, cur.updatedAt, {
        content: next,
        metadata: { ...cur.metadata, title: next },
      })
      upsert(updated)
    } catch (e) {
      toast('error', `Couldn’t rename group — ${e instanceof Error ? e.message : e}`)
    }
  }

  const setTone = async (t: GroupTone) => {
    setMenu(false)
    const cur = latest.current
    try {
      const updated = await updateCanvasNote(cur.path, cur.updatedAt, {
        metadata: { ...cur.metadata, tone: t },
      })
      upsert(updated)
    } catch (e) {
      toast('error', `Couldn’t recolour group — ${e instanceof Error ? e.message : e}`)
    }
  }

  /** Removing a group removes ONLY the rectangle. The cards stay where they are. */
  const del = async () => {
    try {
      await deleteCanvasGroup(latest.current.path)
      remove(latest.current.path)
    } catch (e) {
      toast('error', `Couldn’t delete group — ${e instanceof Error ? e.message : e}`)
    }
  }

  return (
    <>
      <div
        className={`canvas-group tone-${tone}${live ? ' is-live' : ''}`}
        data-testid="canvas-group"
        data-path={note.path}
        style={{ left: geom.x, top: geom.y, width: geom.w, height: geom.h }}
      >
        <div
          className="group-head"
          onPointerDown={beginDrag('move')}
          onDoubleClick={(e) => {
            // Without this the double-click bubbles to the plane, which reads
            // it as "empty canvas" and drops a stray card behind the group.
            e.stopPropagation()
            setEditing(true)
          }}
          title="Drag to move the group and everything in it · double-click to rename"
        >
          {editing ? (
            <input
              autoFocus
              className="group-title-input"
              data-testid="group-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur()
              }}
            />
          ) : (
            <span className="group-title" data-testid="group-title">
              {title || <em>Untitled group</em>}
            </span>
          )}
          <span className="group-count" data-testid="group-count">
            {count}
          </span>
          <button
            className="group-btn group-action group-tone"
            title="Colour"
            aria-label="Colour"
            onClick={() => setMenu((m) => !m)}
          />
          <button
            className="group-btn group-action group-x"
            data-testid="group-delete"
            title="Remove group (cards stay)"
            aria-label="Remove group"
            onClick={() => void del()}
          >
            ✕
          </button>
          {menu && (
            <div className="group-tones" data-testid="group-tones">
              {GROUP_TONES.map((t) => (
                <button
                  key={t}
                  className={`group-tone-swatch tone-${t}`}
                  data-testid={`group-tone-${t}`}
                  title={t}
                  aria-label={t}
                  onClick={() => void setTone(t)}
                />
              ))}
            </div>
          )}
        </div>
        <span
          className="group-resize"
          data-testid="group-resize"
          onPointerDown={beginDrag('resize')}
        />
      </div>
    </>
  )
}
