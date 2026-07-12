// W1 — the tab rail for WORK DOCS (build log PART 30). Any doc under desk/
// (the daily note, a project's work docs) gets a thin, collapsible rail of
// Google-Docs-style tabs on its left: each tab is a real sub-note
// (desk/<x>/<tab>), searchable and linkable like everything else. "＋" adds
// a tab. Minimal and quiet — tabs are for the FEW parallel threads of a
// working session, never a filing system.

import { useEffect, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import {
  createWorkTab,
  fetchWorkspaceTabs,
  toast,
  useStore,
  workspaceRootFor,
} from '../lib/store'
import { hrefFor } from '../lib/router'
import { navigate } from '../lib/router'
import { titleFromPath } from '../lib/format'
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

  const items: { path: string; label: string }[] = []
  if (tabs?.root) items.push({ path: root, label: tabTitle(root, notes[root] ?? tabs.root) })
  for (const c of tabs?.children ?? []) {
    items.push({ path: c.path, label: tabTitle(c.path, notes[c.path] ?? c) })
  }

  return (
    <aside className="worktabs" data-testid="worktabs">
      <div className="worktabs-head">
        <span className="worktabs-label">Tabs</span>
        <button className="worktabs-hide" title="Hide tabs" onClick={toggle}>
          ◂
        </button>
      </div>
      <div className="worktabs-list">
        {tabs === null ? (
          <span className="worktabs-loading">…</span>
        ) : (
          items.map((it) => (
            <a
              key={it.path}
              className={`worktabs-item${it.path === path ? ' is-active' : ''}`}
              href={hrefFor({ kind: 'pages', path: it.path })}
              title={it.path}
            >
              {it.label}
            </a>
          ))
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
