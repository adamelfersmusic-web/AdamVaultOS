// ONE TASK (#/one-task) — the single-task focus surface ("the ultimate ADHD
// killer"). One task at a time, TYPED FRESH — no picking from existing
// tasks, ever (other tasks live next door in Tasks/Tracker; this surface
// only accepts a freshly typed name). Two states over ONE note
// (desk/one-task — the grammar lives in domain/oneTask.ts):
//
//   EMPTY SLOT  — a single large, calm, centered input. Nothing else.
//   ACTIVE TASK — the name set huge (the hero), live subtask checkboxes
//                 beneath (drag to reorder — line order in the note IS the
//                 order, one write on drop), each with an optional
//                 tucked-away `>` note behind a chevron, a quiet add-a-step
//                 input, and exactly two exits: Done (✅) and the subtler
//                 "let it go" (🕊 renounced-not-failed — the same conscious
//                 drop as the week card's ~~cross-off~~).
//
// While a task is active there is NO way to start another — that's the whole
// point. Resolving stamps desk/one-task-log and empties the slot.
//
// THE KITCHEN TIMER: a small countdown living with the active task. Dialed
// in +10-minute steps (cap 90), end-timestamp-based in localStorage so it
// survives reloads and tab switches, soft WebAudio chime only when a timer
// the human started completes. App-local — never written to the vault.
//
// THE QUEUE: at most three parked NAMES (desk/one-task-queue) so the next
// few tasks stop costing RAM. While a task is active it's one dim line at
// the very bottom, collapsed by default, always. The moment the slot
// empties, the parked names surface as one-click choices beside the (still
// primary) fresh input — pulling one promotes it through startOneTask and
// removes it from the queue note.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  addOneSubtask,
  addToOneTaskQueue,
  fetchOneTaskNote,
  fetchOneTaskQueueNote,
  pullFromOneTaskQueue,
  removeFromOneTaskQueue,
  reorderOneSubtask,
  resolveOneTask,
  setOneSubtaskNote,
  startOneTask,
  toast,
  toggleOneSubtask,
  useStore,
} from '../lib/store'
import {
  formatElapsed,
  ONE_TASK_PATH,
  ONE_TASK_QUEUE_CAP,
  ONE_TASK_QUEUE_PATH,
  parseOneTask,
  parseQueue,
  type OneSubtask,
  type OneTaskOutcome,
} from '../domain/oneTask'

// ————————————————————————— persistence keys —————————————————————————

/** Per-subtask note open/closed — UI state, so localStorage, not the vault. */
const OPEN_KEY = 'adamvaultos.onetask.open'
/** The kitchen timer — app-local, never written to the vault. */
const TIMER_KEY = 'adamvaultos.onetask.timer'

function loadOpen(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OPEN_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

/** Keyed by task + subtask TEXT (not line index) so the open state rides
 * along through reorders and additions above. */
const openKeyOf = (taskName: string, sub: OneSubtask) => `${taskName}::${sub.text}`

// ————————————————————————— the kitchen timer —————————————————————————

const STEP_S = 600 // one +10 tap
const CAP_S = 5400 // 90 minutes — further taps do nothing

interface TimerState {
  /** The dial, seconds — built ONLY in +10 steps, capped at 90m. */
  duration: number
  /** Epoch ms when the running countdown hits zero; null when not running. */
  endAt: number | null
  /** Seconds left while paused; null when idle or running. */
  remaining: number | null
}

function loadTimer(): TimerState {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    const p = raw ? (JSON.parse(raw) as Partial<TimerState>) : null
    if (p && typeof p.duration === 'number') {
      return {
        duration: Math.min(Math.max(Math.round(p.duration), 0), CAP_S),
        endAt: typeof p.endAt === 'number' ? p.endAt : null,
        remaining: typeof p.remaining === 'number' ? p.remaining : null,
      }
    }
  } catch {
    // a garbled stash never blocks the surface
  }
  return { duration: 0, endAt: null, remaining: null }
}

function fmtClock(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Two soft sine notes, envelope-shaped — no audio files, no autoplay traps
 * (the context was created by the Start press, a real user gesture). */
function chime(ctx: AudioContext): void {
  const note = (freq: number, at: number) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.1, at + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.9)
    osc.connect(gain).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 1)
  }
  const t = ctx.currentTime
  note(880, t)
  note(1174.66, t + 0.18)
}

const BASE_TITLE = typeof document !== 'undefined' ? document.title : ''

/** ELAPSED — the wall-clock truth under the countdown ("5 hours can feel
 * like 5 min"). Reads metadata.started_at, ticks minutely, and WHISPERS:
 * dimmer than the queue fold, no colors, no warnings — ambient awareness,
 * not a guilt meter. Separate from the timer entirely: top-ups never touch
 * it. A slot without the stamp (pre-feature task) shows nothing. */
function OneElapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="one-elapsed" data-testid="one-elapsed">
      on this: {formatElapsed(now - startedAt)}
    </div>
  )
}

function OneTimer() {
  const [t, setT] = useState<TimerState>(loadTimer)
  const [now, setNow] = useState(() => Date.now())
  // The settled done-state (0:00, is-done) — cleared by any step or reset.
  const [rang, setRang] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)

  const running = t.endAt !== null
  const secondsLeft = running
    ? Math.max(0, Math.ceil(((t.endAt ?? 0) - now) / 1000))
    : (t.remaining ?? t.duration)

  const save = (next: TimerState) => {
    setT(next)
    localStorage.setItem(TIMER_KEY, JSON.stringify(next))
  }

  // The tick — recompute from the END TIMESTAMP, never count intervals, so a
  // throttled background tab or a reload can't drift the clock.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [running])

  // Completion. Chimes only when a HUMAN-started run finishes here (the
  // AudioContext exists only after a Start press) — a reload onto an
  // already-expired timer settles into the done state silently.
  useEffect(() => {
    if (!running || secondsLeft > 0) return
    save({ duration: t.duration, endAt: null, remaining: null })
    setRang(true)
    if (audioRef.current) chime(audioRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, secondsLeft])

  // The countdown mirrored in the tab title while running.
  useEffect(() => {
    if (!running) return
    document.title = `${fmtClock(secondsLeft)} · One Task`
    return () => {
      document.title = BASE_TITLE
    }
  }, [running, secondsLeft])

  useEffect(
    () => () => {
      void audioRef.current?.close().catch(() => {})
    },
    [],
  )

  const step = (delta: number) => {
    setRang(false)
    if (running) {
      // Extending (or trimming) a live run — still capped at 90 total.
      const next = Math.min(Math.max(secondsLeft + delta, 0), CAP_S)
      if (next === 0) save({ duration: t.duration, endAt: null, remaining: null })
      else save({ ...t, endAt: Date.now() + next * 1000, remaining: null })
    } else if (t.remaining !== null) {
      const next = Math.min(Math.max(t.remaining + delta, 0), CAP_S)
      save({ duration: t.duration, endAt: null, remaining: next === 0 ? null : next })
    } else {
      save({
        duration: Math.min(Math.max(t.duration + delta, 0), CAP_S),
        endAt: null,
        remaining: null,
      })
    }
  }

  const startPause = () => {
    if (running) {
      save({ duration: t.duration, endAt: null, remaining: secondsLeft })
      return
    }
    const s = t.remaining ?? t.duration
    if (s <= 0) return
    setRang(false)
    if (!audioRef.current) {
      try {
        audioRef.current = new AudioContext()
      } catch {
        // no audio available — the timer itself still works
      }
    }
    void audioRef.current?.resume().catch(() => {})
    setNow(Date.now())
    save({ ...t, endAt: Date.now() + s * 1000, remaining: null })
  }

  const reset = () => {
    setRang(false)
    save({ duration: t.duration, endAt: null, remaining: null })
  }

  const display = rang ? 0 : secondsLeft
  return (
    <div
      className={`one-timer${running ? ' is-running' : ''}${rang ? ' is-done' : ''}`}
      data-testid="one-timer"
    >
      <span className="one-timer-clock" data-testid="one-timer-clock">
        {fmtClock(display)}
      </span>
      <button
        className="one-timer-step"
        data-testid="one-timer-minus"
        title="Ten minutes less"
        onClick={() => step(-STEP_S)}
      >
        −10
      </button>
      <button
        className="one-timer-step"
        data-testid="one-timer-plus"
        title="Ten minutes more (up to 90)"
        onClick={() => step(STEP_S)}
      >
        +10
      </button>
      <button
        className="one-timer-go"
        data-testid="one-timer-go"
        disabled={!running && secondsLeft === 0}
        onClick={startPause}
      >
        {running ? 'Pause' : 'Start'}
      </button>
      {(running || t.remaining !== null || rang) && (
        <button className="one-timer-reset" data-testid="one-timer-reset" onClick={reset}>
          Reset
        </button>
      )}
    </div>
  )
}

// ——— SUBTASK DRAG & DROP — the house DnD in miniature (WorkTabs/Shelves):
// native HTML5, payload in dataTransfer with a module mirror for dragover
// (which can't read dataTransfer in protected mode), the thin gold insertion
// line, and ONE write on drop — a cancelled drag leaves no trace. ———

const SUB_DND_MIME = 'application/x-adamvaultos-onetask-dnd'
let liveSubDrag: number | null = null

/** Top or bottom half of the hovered row → insert before it or after it. */
function slotFor(e: React.DragEvent, index: number): number {
  const r = e.currentTarget.getBoundingClientRect()
  return e.clientY > r.top + r.height / 2 ? index + 1 : index
}

// ————————————————————————— the view —————————————————————————

export function OneTaskView() {
  const { notes } = useStore()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [step, setStep] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>(loadOpen)
  // Optimistic check overlays keyed by the line's raw bytes — the box reads
  // the moment it's pressed; the vault's truth takes back over on settle.
  const [pendingCheck, setPendingCheck] = useState<Record<string, boolean>>({})
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [slot, setSlot] = useState<number | null>(null)
  // THE QUEUE's fold — collapsed by DEFAULT, always (never persisted): it
  // must never draw the eye from the hero task.
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueText, setQueueText] = useState('')

  // One fresh read on mount (slot + queue) — after that the store's merged
  // notes are truth.
  useEffect(() => {
    let alive = true
    Promise.all([fetchOneTaskNote(), fetchOneTaskQueueNote()])
      .then(() => {
        if (alive) setStatus('ready')
      })
      .catch((e) => {
        if (alive) {
          setStatus('error')
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      })
    return () => {
      alive = false
    }
  }, [])

  const note = notes[ONE_TASK_PATH]
  const task = useMemo(() => parseOneTask(note?.content), [note?.content])
  const queueNote = notes[ONE_TASK_QUEUE_PATH]
  const queue = useMemo(() => parseQueue(queueNote?.content), [queueNote?.content])
  // The wall-clock stamp — a string ISO in metadata, else no elapsed line.
  const startedRaw = note?.metadata['started_at']
  const startedMs = typeof startedRaw === 'string' ? Date.parse(startedRaw) : NaN
  const startedAt = Number.isFinite(startedMs) ? startedMs : null

  // A lean list-shape can shoulder the cached content aside (external edit +
  // background listAll) — a content-less note must re-hydrate, never read as
  // an empty slot (or an empty queue).
  useEffect(() => {
    if (status !== 'ready') return
    if (note && note.content === undefined) void fetchOneTaskNote().catch(() => {})
    if (queueNote && queueNote.content === undefined) {
      void fetchOneTaskQueueNote().catch(() => {})
    }
  }, [status, note, queueNote])

  const setOpenFor = (key: string, on: boolean) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: on }
      localStorage.setItem(OPEN_KEY, JSON.stringify(next))
      return next
    })
  }

  const guard = async (verb: string, run: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    try {
      await run()
    } catch (e) {
      toast('error', `Couldn’t ${verb} — ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  const start = () =>
    guard('start it', async () => {
      const title = name.trim()
      if (!title) return
      await startOneTask(title)
      setName('')
    })

  const addStep = () =>
    guard('add the step', async () => {
      const text = step.trim()
      if (!text) return
      await addOneSubtask(text)
      setStep('')
    })

  const toggle = (sub: OneSubtask) =>
    guard('save the check', async () => {
      setPendingCheck((p) => ({ ...p, [sub.raw]: !sub.checked }))
      try {
        await toggleOneSubtask(sub)
      } finally {
        setPendingCheck((p) => {
          const next = { ...p }
          delete next[sub.raw]
          return next
        })
      }
    })

  const commitNote = (sub: OneSubtask, text: string) =>
    guard('save the note', () => setOneSubtaskNote(sub, text))

  const resolve = (outcome: OneTaskOutcome) =>
    guard(outcome === 'done' ? 'finish it' : 'let it go', async () => {
      await resolveOneTask(outcome)
      toast(
        'success',
        outcome === 'done' ? 'Done ✅ — stamped onto the log' : 'Let go 🕊 — stamped onto the log',
      )
    })

  const drop = (from: number, to: number) => {
    const subs = task?.subtasks ?? []
    const moved = subs[from]
    if (!moved || to === from || to === from + 1) return
    const before = subs[to] ?? null
    void guard('reorder', () => reorderOneSubtask(moved, before))
  }

  const parkInQueue = () =>
    guard('queue it', async () => {
      const text = queueText.trim()
      if (!text) return
      await addToOneTaskQueue(text)
      setQueueText('')
    })

  const dropFromQueue = (queued: string) =>
    guard('drop it from the queue', () => removeFromOneTaskQueue(queued))

  const pull = (queued: string) =>
    guard('pull it from the queue', () => pullFromOneTaskQueue(queued))

  if (status === 'loading' || (note && note.content === undefined)) {
    return (
      <div className="one-task" data-testid="one-task-view">
        <div className="spinner" aria-hidden="true" />
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="one-task" data-testid="one-task-view">
        <p className="one-quiet">Couldn’t reach the vault — {loadError}</p>
      </div>
    )
  }

  // ——— STATE 1 — the empty slot: one large calm question, nothing else.
  // Deliberately NO list, NO suggestions, NO picker of existing tasks. The
  // ONE exception is the queue's moment: names ADAM parked earlier are
  // offered as one-click choices — the fresh input stays primary, and with
  // an empty queue this state is exactly the bare question. ———
  if (!task) {
    return (
      <div className="one-task" data-testid="one-task-view">
        <div className="one-empty">
          <input
            autoFocus
            className="one-empty-input"
            data-testid="one-input"
            placeholder="What’s the one task?"
            aria-label="What’s the one task?"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void start()
            }}
          />
          <p className="one-quiet">Type it fresh · Enter to begin</p>
          {queue.length > 0 && (
            <div className="one-queue-offer" data-testid="one-queue-offer">
              <span className="one-queue-offer-head">or pull from the queue</span>
              {queue.map((q) => (
                <button
                  key={q}
                  className="one-queue-pull"
                  data-testid="one-queue-pull"
                  disabled={busy}
                  title="Make this the one task"
                  onClick={() => void pull(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ——— STATE 2 — the active task. No way to start another. ———
  const subs = task.subtasks
  const done = subs.filter((s) => pendingCheck[s.raw] ?? s.checked).length
  const dragging = dragIdx !== null

  return (
    <div className="one-task is-active" data-testid="one-task-view">
      <div className="one-active">
        <h1 className="one-hero" data-testid="one-hero">
          {task.name}
        </h1>

        <OneTimer />

        {startedAt !== null && <OneElapsed key={startedAt} startedAt={startedAt} />}

        {subs.length > 0 && (
          <div className="one-progress" data-testid="one-progress">
            <span className="one-progress-count">
              {done} of {subs.length}
            </span>
            <div className="one-progress-track" aria-hidden="true">
              <div
                className="one-progress-fill"
                style={{ width: `${(done / subs.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="one-subs">
          {subs.map((sub, i) => {
            const key = openKeyOf(task.name, sub)
            const isOpen = Boolean(open[key])
            const checked = pendingCheck[sub.raw] ?? sub.checked
            return (
              <Fragment key={`${sub.lineIndex}:${sub.raw}`}>
                {dragging && slot === i && <div className="tasks-drop-line" />}
                <div
                  className={`one-sub${checked ? ' is-done' : ''}`}
                  data-testid="one-sub"
                  data-line={sub.lineIndex}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(SUB_DND_MIME, String(i))
                    e.dataTransfer.effectAllowed = 'move'
                    liveSubDrag = i
                    setDragIdx(i)
                  }}
                  onDragOver={(e) => {
                    if (liveSubDrag === null) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setSlot(slotFor(e, i))
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const raw = e.dataTransfer.getData(SUB_DND_MIME)
                    const from = raw ? Number(raw) : liveSubDrag
                    // The slot comes from the EVENT, not state — the render
                    // indicator may lag a dispatch-fast drop.
                    const to = slotFor(e, i)
                    liveSubDrag = null
                    setDragIdx(null)
                    setSlot(null)
                    if (from !== null && Number.isInteger(from)) drop(from, to)
                  }}
                  onDragEnd={() => {
                    liveSubDrag = null
                    setDragIdx(null)
                    setSlot(null)
                  }}
                >
                  <input
                    type="checkbox"
                    className="task-check"
                    data-testid="one-sub-check"
                    checked={checked}
                    disabled={busy}
                    aria-label={sub.text}
                    onChange={() => void toggle(sub)}
                  />
                  <span className="one-sub-text">{sub.text}</span>
                  <button
                    className={`one-sub-notetoggle${isOpen ? ' is-open' : ''}${sub.noteText ? ' has-note' : ''}`}
                    data-testid="one-sub-notetoggle"
                    title={isOpen ? 'Tuck the note away' : sub.noteText ? 'Show the note' : 'Add a note'}
                    aria-label={isOpen ? `Hide note for ${sub.text}` : `Note for ${sub.text}`}
                    onClick={() => setOpenFor(key, !isOpen)}
                  >
                    ›
                  </button>
                </div>
                {isOpen && (
                  <input
                    key={`${sub.lineIndex}:${sub.noteText}`}
                    className="one-sub-note"
                    data-testid="one-sub-note"
                    placeholder="A sentence to your future self — Enter saves"
                    aria-label={`Note for ${sub.text}`}
                    defaultValue={sub.noteText}
                    disabled={busy}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitNote(sub, e.currentTarget.value)
                      if (e.key === 'Escape') setOpenFor(key, false)
                    }}
                  />
                )}
              </Fragment>
            )
          })}
          {dragging && slot === subs.length && <div className="tasks-drop-line" />}
          <input
            className="one-add"
            data-testid="one-add"
            placeholder="Add a step — Enter appends"
            aria-label="Add a step"
            value={step}
            disabled={busy}
            onChange={(e) => setStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addStep()
            }}
          />
        </div>

        <div className="one-exits">
          <button
            className="one-done"
            data-testid="one-done"
            disabled={busy}
            title="Complete the task — stamped ✅ onto the log"
            onClick={() => void resolve('done')}
          >
            Done
          </button>
          <button
            className="one-letgo"
            data-testid="one-letgo"
            disabled={busy}
            title="Consciously drop it — stamped 🕊 renounced, not failed"
            onClick={() => void resolve('renounced')}
          >
            let it go
          </button>
        </div>

        {/* THE QUEUE — parked at the very bottom, nearly invisible: one dim
            line you hardly see unless you know it's there. Names only; the
            fold never persists open. */}
        <div className="one-queue" data-testid="one-queue">
          <button
            className="one-queue-toggle"
            data-testid="one-queue-toggle"
            title="The queue — up to three names waiting their turn"
            onClick={() => setQueueOpen((o) => !o)}
          >
            {queue.length > 0 ? `queue · ${queue.length}` : 'queue'}
          </button>
          {queueOpen && (
            <div className="one-queue-panel" data-testid="one-queue-panel">
              {queue.map((q) => (
                <div key={q} className="one-queue-item" data-testid="one-queue-item">
                  <span className="one-queue-name">{q}</span>
                  <button
                    className="one-queue-remove"
                    data-testid="one-queue-remove"
                    disabled={busy}
                    title="Drop it from the queue"
                    aria-label={`Remove ${q} from the queue`}
                    onClick={() => void dropFromQueue(q)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <input
                className="one-queue-add"
                data-testid="one-queue-add"
                placeholder={
                  queue.length >= ONE_TASK_QUEUE_CAP
                    ? 'The queue holds three'
                    : 'Park a name — Enter queues it'
                }
                aria-label="Park a task name in the queue"
                value={queueText}
                disabled={busy}
                onChange={(e) => setQueueText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void parkInQueue()
                  if (e.key === 'Escape') setQueueOpen(false)
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
