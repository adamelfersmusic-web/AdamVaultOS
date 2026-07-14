// TOUCH DRAG — the pointer-events fallback for every house drag surface.
// HTML5 drag events (dragstart/dragover/drop) never fire on iOS Safari, so
// phone users couldn't reorder/refile/schedule by drag at all. This module
// adds a SECOND INPUT BACKEND over the SAME behavior contract the HTML5
// handlers use: the call-site exposes {accepts, enter, leave, drop} on its
// drop targets and {onStart, onEnd} on its sources, and both backends drive
// those — one write path, never forked.
//
// THE GESTURE (never hijacks scrolling — the law):
//   · pointerdown (touch/pen only) starts a 350ms long-press timer;
//   · moving > 8px BEFORE the timer fires cancels arming — the page scrolls
//     exactly as it always did (we never preventDefault before arming);
//   · once ARMED: the source lifts (scale + dim), a floating mirror chip
//     follows the finger, and registered drop targets receive enter/leave
//     exactly like dragover would give them;
//   · pointerup over an accepting target → drop (the ONLY writing gesture);
//   · pointerup anywhere else, a second finger, or pointercancel → cancel:
//     nothing is written, every affordance is swept (the Escape of touch).

import { useCallback, useRef } from 'react'
import type * as React from 'react'

const ARM_MS = 350
const SLOP_PX = 8

/** What a drop target exposes — the same contract its HTML5 handlers wrap:
 * `accepts` mirrors the dragover payload check, `enter`/`leave` the hover
 * affordance, `drop` the one writing gesture. Coordinates are viewport
 * clientX/clientY, so slot math matches the HTML5 path byte for byte. */
export interface TouchDropHandlers {
  /** May the in-flight payload land here? (Reads the module mirror the
   * HTML5 dragover path already keeps.) */
  accepts(): boolean
  enter(x: number, y: number): void
  leave(): void
  drop(x: number, y: number): void
}

interface TargetEntry {
  el: HTMLElement
  h: TouchDropHandlers
}

// The registry of live drop targets. Deepest-container wins on hit-test so a
// row target inside a list target resolves to the row's own handlers.
const targets = new Set<TargetEntry>()

export function registerTouchDropTarget(
  el: HTMLElement,
  h: TouchDropHandlers,
): () => void {
  const entry: TargetEntry = { el, h }
  targets.add(entry)
  return () => {
    targets.delete(entry)
  }
}

/** React sugar over the registry: returns a ref callback for the target
 * element. Handlers are read through a ref so the registration survives
 * re-renders while always seeing the freshest closures. */
export function useTouchDropTarget(
  h: TouchDropHandlers,
): (el: HTMLElement | null) => void {
  const live = useRef(h)
  live.current = h
  const unregister = useRef<(() => void) | null>(null)
  return useCallback((el: HTMLElement | null) => {
    unregister.current?.()
    unregister.current = null
    if (el) {
      unregister.current = registerTouchDropTarget(el, {
        accepts: () => live.current.accepts(),
        enter: (x, y) => live.current.enter(x, y),
        leave: () => live.current.leave(),
        drop: (x, y) => live.current.drop(x, y),
      })
    }
  }, [])
}

/** What a drag source provides when the long-press arms. */
export interface TouchDragSpec {
  /** The floating mirror's label (the row/chip title). */
  label: string
  /** Arm: set the module payload mirror — the exact dragstart body. */
  onStart(): void
  /** Drop OR cancel: clear the mirror + sweep hover affordances — the exact
   * window-dragend sweep. Always fires once per armed drag. */
  onEnd(): void
}

let sessionActive = false

/** Find the deepest registered target under the point. The mirror is
 * pointer-events:none, so elementFromPoint sees through it. */
function targetAt(x: number, y: number): TargetEntry | null {
  const el = document.elementFromPoint(x, y)
  if (!el) return null
  let best: TargetEntry | null = null
  for (const t of targets) {
    if (!t.el.contains(el)) continue
    if (!best || best.el.contains(t.el)) best = t
  }
  return best
}

/**
 * Wire this to a source's onPointerDown. Mouse pointers return immediately —
 * they already have real HTML5 drag. One session at a time; a second finger
 * cancels the running one (writing nothing).
 */
export function startTouchDrag(e: React.PointerEvent, spec: TouchDragSpec): void {
  if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
  if (!e.isPrimary || sessionActive) return
  sessionActive = true

  const sourceEl = e.currentTarget as HTMLElement
  const pointerId = e.pointerId
  const startX = e.clientX
  const startY = e.clientY
  let x = startX
  let y = startY
  let armed = false
  let mirror: HTMLElement | null = null
  let over: TargetEntry | null = null

  const place = () => {
    if (!mirror) return
    mirror.style.left = `${x}px`
    mirror.style.top = `${y}px`
  }

  const arm = () => {
    armed = true
    spec.onStart()
    // Inline styles, not a class — React re-renders during the drag (hover
    // slots are state) and would reconcile className right back.
    sourceEl.style.transform = 'scale(1.02)'
    sourceEl.style.opacity = '0.55'
    sourceEl.style.transition = 'transform 0.12s ease, opacity 0.12s ease'
    mirror = document.createElement('div')
    mirror.className = 'touch-drag-mirror'
    mirror.setAttribute('data-testid', 'touch-drag-mirror')
    mirror.textContent = spec.label
    document.body.appendChild(mirror)
    place()
  }

  const timer = window.setTimeout(arm, ARM_MS)

  const setOver = (t: TargetEntry | null) => {
    if (over === t) return
    over?.h.leave()
    over = t
  }

  const dispose = () => {
    window.clearTimeout(timer)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('pointerdown', onSecondFinger)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('contextmenu', onContextMenu)
    mirror?.remove()
    sourceEl.style.transform = ''
    sourceEl.style.opacity = ''
    sourceEl.style.transition = ''
    if (armed) spec.onEnd()
    sessionActive = false
  }

  const cancel = () => {
    setOver(null)
    dispose()
  }

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    x = ev.clientX
    y = ev.clientY
    if (!armed) {
      // A real swipe before the long-press fires: stand down and let the
      // page scroll — arming NEVER steals an in-progress scroll.
      if (Math.hypot(x - startX, y - startY) > SLOP_PX) dispose()
      return
    }
    place()
    const t = targetAt(x, y)
    if (t && t.h.accepts()) {
      setOver(t)
      t.h.enter(x, y)
    } else {
      setOver(null)
    }
  }

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    // Re-resolve at drop time: hover state changes re-render (and can
    // re-register) the target between the last move and the lift, so the
    // cached `over` may point at a stale registration — the registry always
    // holds the live one.
    const t = armed ? targetAt(x, y) : null
    if (t && t.h.accepts()) {
      if (over && over !== t) over.h.leave()
      over = null
      t.h.drop(x, y) // the one writing gesture
    } else {
      setOver(null) // let go outside any target — writes nothing
    }
    dispose()
  }

  const onCancel = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    cancel()
  }

  /** A second finger is the touch Escape — cancel, write nothing. */
  const onSecondFinger = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) cancel()
  }

  /** Once armed, the drag owns the finger: block the scroll the browser
   * would otherwise start (registered non-passive from the gesture's start,
   * but a no-op until armed — scrolling stays native before that). */
  const onTouchMove = (ev: TouchEvent) => {
    if (armed && ev.cancelable) ev.preventDefault()
  }
  /** Swallow the synthetic click after an armed drag (iOS would otherwise
   * "tap" whatever the finger lifted over, e.g. select a calendar day). */
  const onTouchEnd = (ev: TouchEvent) => {
    if (armed && ev.cancelable) ev.preventDefault()
  }
  /** Long-press context menus (Android) never open mid-drag. */
  const onContextMenu = (ev: Event) => {
    if (armed) ev.preventDefault()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('pointerdown', onSecondFinger)
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd, { passive: false })
  window.addEventListener('contextmenu', onContextMenu)
}
