// Global capture dock — a floating widget (bottom-right) with three tabs:
//   ⚡ Capture  → drops a raw note into the vault (tag capture/quick)
//   ☑ Todos    → a lightweight global checklist (localStorage)
//   ✎ Pad      → an ephemeral scratchpad (localStorage)
// Ported from AdamAtelierDashboard's GlobalPanel, wired to AdamVaultOS's real
// vault API (the dashboard's captureToVault was a stub). Opens with ⌘⇧K
// (⌘K is the command palette).

import { useEffect, useRef, useState } from 'react'
import { createCapture, promotePadToToday, toast } from '../lib/store'
import { navigate } from '../lib/router'

type Tab = 'capture' | 'todos' | 'pad'
interface Todo {
  id: string
  text: string
  done: boolean
}

const TODOS_KEY = 'adamvault.dock.todos'
const PAD_KEY = 'adamvault.dock.pad'

function readTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(TODOS_KEY)
    return raw ? (JSON.parse(raw) as Todo[]) : []
  } catch {
    return []
  }
}

export function CaptureDock() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('capture')
  const [captureText, setCaptureText] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [todos, setTodos] = useState<Todo[]>(readTodos)
  const [newTodo, setNewTodo] = useState('')
  const [pad, setPad] = useState(() => localStorage.getItem(PAD_KEY) ?? '')
  const [promoting, setPromoting] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const captureRef = useRef<HTMLTextAreaElement>(null)

  // Persist todos + pad.
  useEffect(() => {
    localStorage.setItem(TODOS_KEY, JSON.stringify(todos))
  }, [todos])
  useEffect(() => {
    localStorage.setItem(PAD_KEY, pad)
  }, [pad])

  // ⌘⇧K opens the capture tab from anywhere (⌘K is the palette).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        setTab('capture')
        setTimeout(() => captureRef.current?.focus(), 60)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Click-outside closes.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const submitCapture = async () => {
    const text = captureText.trim()
    if (!text || saving) return
    setSaving(true)
    try {
      await createCapture(text)
      setSavedFlash(true)
      setCaptureText('')
      setTimeout(() => setSavedFlash(false), 1800)
    } catch (e) {
      toast('error', `Capture failed — ${e instanceof Error ? e.message : e}`)
    } finally {
      setSaving(false)
    }
  }

  const promotePad = async () => {
    const text = pad.trim()
    if (!text || promoting) return
    setPromoting(true)
    try {
      const path = await promotePadToToday(text)
      setPad('')
      // Also write through synchronously — navigation can remount the dock
      // before the persist effect fires, resurrecting the old jot.
      localStorage.setItem(PAD_KEY, '')
      setOpen(false)
      toast('success', 'Pad moved into today’s note')
      navigate({ kind: 'pages', path })
    } catch (e) {
      toast('error', `Couldn’t move the pad — ${e instanceof Error ? e.message : e}`)
    } finally {
      setPromoting(false)
    }
  }

  const addTodo = () => {
    const text = newTodo.trim()
    if (!text) return
    setTodos((t) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, done: false },
      ...t,
    ])
    setNewTodo('')
  }

  const openTab = (t: Tab) => {
    setOpen(true)
    setTab(t)
    if (t === 'capture') setTimeout(() => captureRef.current?.focus(), 60)
  }

  return (
    <div className="dock">
      {!open && (
        <div className="dock-fabs">
          <button className="dock-fab dock-fab-accent" title="Capture to vault (⌘⇧K)" onClick={() => openTab('capture')}>
            ⚡
          </button>
          <button className="dock-fab" title="Todos" onClick={() => openTab('todos')}>
            ☑
          </button>
          <button className="dock-fab" title="Scratch pad" onClick={() => openTab('pad')}>
            ✎
          </button>
        </div>
      )}

      {open && (
        <div ref={panelRef} className="dock-panel" role="dialog" aria-label="Capture dock">
          <div className="dock-tabs">
            <button className="dock-tab" data-active={tab === 'pad' || undefined} onClick={() => setTab('pad')}>
              ✎ Pad
            </button>
            <button className="dock-tab" data-active={tab === 'todos' || undefined} onClick={() => setTab('todos')}>
              ☑ Todos
            </button>
            <button className="dock-tab" data-active={tab === 'capture' || undefined} onClick={() => setTab('capture')}>
              ⚡ Capture
            </button>
            <button className="dock-close" title="Close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          {tab === 'capture' && (
            <div className="dock-body">
              <p className="dock-hint">
                Drop a thought into the vault — lands as a note tagged <code>capture/quick</code>.
              </p>
              <textarea
                ref={captureRef}
                className="dock-textarea"
                placeholder="What's on your mind…"
                value={captureText}
                onChange={(e) => setCaptureText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submitCapture()
                }}
                rows={5}
              />
              <button className="dock-send" onClick={() => void submitCapture()} disabled={saving || !captureText.trim()}>
                {savedFlash ? '✓ Sent to vault' : saving ? 'Sending…' : '⚡ Send to vault'}
              </button>
            </div>
          )}

          {tab === 'todos' && (
            <div className="dock-body">
              <div className="dock-todos">
                {todos.length === 0 && <p className="dock-empty">No todos yet.</p>}
                {todos.map((t) => (
                  <label key={t.id} className="dock-todo" data-done={t.done || undefined}>
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() =>
                        setTodos((list) => list.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
                      }
                    />
                    <span>{t.text}</span>
                    <button
                      className="dock-todo-x"
                      title="Remove"
                      onClick={() => setTodos((list) => list.filter((x) => x.id !== t.id))}
                    >
                      ✕
                    </button>
                  </label>
                ))}
              </div>
              <div className="dock-todo-add">
                <input
                  className="dock-input"
                  placeholder="Add to global list…"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTodo()}
                />
                <button className="dock-add-btn" onClick={addTodo}>
                  +
                </button>
              </div>
            </div>
          )}

          {tab === 'pad' && (
            <div className="dock-body">
              <textarea
                className="dock-textarea dock-pad"
                placeholder="// Scratch pad — anything goes here"
                value={pad}
                onChange={(e) => setPad(e.target.value)}
                rows={10}
              />
              <button
                className="dock-send"
                data-testid="pad-promote"
                disabled={promoting || !pad.trim()}
                title="Append this to today's daily note and open it — backed up, searchable, linkable"
                onClick={() => void promotePad()}
              >
                {promoting ? 'Moving…' : '⤢ Open as doc — into today’s note'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
