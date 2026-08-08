// Files — a full-screen Finder over the vault's paths. You enter it and you're
// IN the vault: breadcrumb, double-click a folder to descend, back/forward/up,
// grid or list. Phase 2 of atelier/parachute/ui-ideas/finder-mode.
//
// 🔴 READ-ONLY, DELIBERATELY. Nothing here writes a path, a tag, or a link.
// Moving a note would break every inbound wikilink pointing at its old address,
// silently — so move/rename is phase 3 and stays parked. This screen cannot
// damage the vault.
//
// 🔑 The folder tree comes from buildPathTree() in PathTree.tsx — the SAME
// function the Library's path rail uses. Do not add a second one here: two
// implementations drift, and one day the rail and this screen would disagree
// about a folder count with no way to tell which is lying.
//
// No new fetch either: fetchAllNotes() is the call the Library already makes.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import { fetchAllNotes } from '../lib/store'
import { navigate } from '../lib/router'
import { relativeTime } from '../lib/format'
import { buildPathTree, noteInPath, UNFILED, type PathNode } from './PathTree'

type Sort = 'name' | 'updated' | 'size'
type View = 'grid' | 'list'

const SORT_KEY = 'adamvaultos.files.sort'
const VIEW_KEY = 'adamvaultos.files.view'

interface Entry {
  kind: 'folder' | 'note'
  /** Segment shown on the card ("strategy", "deal-memo"). */
  name: string
  /** Folders: notes inside, nested included. Notes: 0. */
  count: number
  bytes: number
  updatedAt: string
  /** Notes only — the vault path to open. */
  path?: string
}

/** Bytes on disk. `byteSize` is not guaranteed on this list shape, so fall back
 * to the content's real UTF-8 length rather than reporting every note as 0 B. */
function sizeOf(n: Note): number {
  if (typeof n.byteSize === 'number' && n.byteSize > 0) return n.byteSize
  const c = n.content ?? ''
  return c ? new TextEncoder().encode(c).length : 0
}

function fmtSize(b: number): string {
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`
  if (b >= 1024) return `${Math.round(b / 1024)} KB`
  return `${b} B`
}

function ts(v: string | undefined): number {
  const t = new Date(v ?? 0).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Walk the tree to the node addressed by `parts`. null at the root. */
function nodeAt(tree: PathNode[], parts: string[]): PathNode | null {
  let level = tree
  let node: PathNode | null = null
  for (const seg of parts) {
    const next = level.find((n) => n.seg === seg)
    if (!next) return null
    node = next
    level = next.children
  }
  return node
}

const IconFolder = () => (
  <svg className="files-ico files-ico-folder" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M3 7a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.6.8L11.5 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
      fill="currentColor"
      opacity=".2"
    />
    <path
      d="M3 7a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.6.8L11.5 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
)

const IconFile = () => (
  <svg className="files-ico files-ico-file" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <path d="M13 3v5h5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8.5 13h7M8.5 16.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
)

export function FilesView() {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>(() => {
    const v = localStorage.getItem(SORT_KEY)
    return v === 'updated' || v === 'size' ? v : 'name'
  })
  const [view, setView] = useState<View>(() =>
    localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid',
  )
  const [selected, setSelected] = useState<string | null>(null)
  // Finder's back/forward: a history of visited folders plus a cursor into it.
  // Navigating from anywhere but the end truncates the forward entries.
  const [history, setHistory] = useState<string[][]>([[]])
  const [hi, setHi] = useState(0)
  const seq = useRef(0)

  const cwd = history[hi] ?? []

  useEffect(() => {
    const id = ++seq.current
    setError(null)
    fetchAllNotes()
      .then((all) => {
        if (seq.current === id) setNotes(all)
      })
      .catch((e) => {
        if (seq.current === id) setError(e instanceof Error ? e.message : String(e))
      })
  }, [])

  const all = useMemo(() => notes ?? [], [notes])
  const tree = useMemo(() => buildPathTree(all), [all])

  const go = (parts: string[]) => {
    setHistory((prev) => [...prev.slice(0, hi + 1), parts])
    setHi((i) => i + 1)
    setSelected(null)
  }
  const goBack = () => {
    if (hi > 0) {
      setHi(hi - 1)
      setSelected(null)
    }
  }
  const goForward = () => {
    if (hi < history.length - 1) {
      setHi(hi + 1)
      setSelected(null)
    }
  }
  const goUp = () => {
    if (cwd.length) go(cwd.slice(0, -1))
  }

  const pickSort = (s: Sort) => {
    localStorage.setItem(SORT_KEY, s)
    setSort(s)
  }
  const pickView = (v: View) => {
    localStorage.setItem(VIEW_KEY, v)
    setView(v)
  }

  // Everything on screen, in Finder's order: folders first, then notes.
  const entries = useMemo<Entry[]>(() => {
    const here = nodeAt(tree, cwd)
    const folderNodes = cwd.length === 0 ? tree : (here?.children ?? [])
    const folders: Entry[] = folderNodes.map((n) => ({
      kind: 'folder',
      name: n.seg,
      count: n.total,
      bytes: 0,
      updatedAt: '',
    }))

    // Notes sitting DIRECTLY in this folder. Unfiled is the tree's bucket for
    // notes carrying no folder at all, so it reuses the same helper the rail
    // filters with rather than re-deriving what "unfiled" means.
    const prefix = cwd.join('/')
    const files: Entry[] = all
      .filter((n) => {
        const p = n.path ?? ''
        if (cwd.length === 1 && cwd[0] === UNFILED) return noteInPath(n, UNFILED)
        if (cwd.length === 0) return false // root-level notes live under Unfiled
        const cut = p.lastIndexOf('/')
        return cut > 0 && p.slice(0, cut) === prefix
      })
      .map((n) => ({
        kind: 'note' as const,
        name: (n.path ?? '').split('/').pop() ?? n.path ?? '',
        count: 0,
        bytes: sizeOf(n),
        updatedAt: n.updatedAt ?? '',
        path: n.path,
      }))

    const byName = (a: Entry, b: Entry) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    const noteSort =
      sort === 'size'
        ? (a: Entry, b: Entry) => b.bytes - a.bytes || byName(a, b)
        : sort === 'updated'
          ? (a: Entry, b: Entry) => ts(b.updatedAt) - ts(a.updatedAt) || byName(a, b)
          : byName
    // A folder has no honest date or size of its own, so under Updated/Size it
    // sorts by how much is inside it — the prototype's behaviour.
    const folderSort =
      sort === 'name' ? byName : (a: Entry, b: Entry) => b.count - a.count || byName(a, b)

    return [...folders.sort(folderSort), ...files.sort(noteSort)]
  }, [tree, cwd, all, sort])

  const open = (e: Entry) => {
    if (e.kind === 'folder') {
      go([...cwd, e.name])
      return
    }
    if (!e.path) return
    navigate(e.path.startsWith('pages/') ? { kind: 'pages', path: e.path } : { kind: 'note', path: e.path })
  }

  const folderCount = entries.filter((e) => e.kind === 'folder').length
  const noteCount = entries.length - folderCount
  const branch = cwd.length === 0 ? all.length : (nodeAt(tree, cwd)?.total ?? 0)

  const metaOf = (e: Entry) =>
    e.kind === 'folder'
      ? `${e.count} ${e.count === 1 ? 'note' : 'notes'}`
      : sort === 'updated'
        ? relativeTime(e.updatedAt)
        : fmtSize(e.bytes)

  return (
    <div className="files" data-testid="files">
      <header className="files-bar">
        <div className="files-nav">
          <button onClick={goBack} disabled={hi <= 0} title="Back" aria-label="Back" data-testid="files-back">
            ←
          </button>
          <button
            onClick={goForward}
            disabled={hi >= history.length - 1}
            title="Forward"
            aria-label="Forward"
            data-testid="files-forward"
          >
            →
          </button>
          <button
            onClick={goUp}
            disabled={cwd.length === 0}
            title="Up one folder"
            aria-label="Up one folder"
            data-testid="files-up"
          >
            ↑
          </button>
        </div>

        <nav className="files-crumbs" data-testid="files-crumbs" aria-label="Breadcrumb">
          {cwd.length === 0 ? (
            <span className="files-crumb-here">vault</span>
          ) : (
            <button className="files-crumb" onClick={() => go([])}>
              vault
            </button>
          )}
          {cwd.map((seg, i) => (
            <span key={`${seg}-${i}`} className="files-crumb-wrap">
              <span className="files-crumb-sep">›</span>
              {i === cwd.length - 1 ? (
                <span className="files-crumb-here">{seg}</span>
              ) : (
                <button className="files-crumb" onClick={() => go(cwd.slice(0, i + 1))}>
                  {seg}
                </button>
              )}
            </span>
          ))}
        </nav>

        <div className="files-spacer" />

        <div className="files-seg" role="group" aria-label="Sort" data-testid="files-sort">
          <button
            className={sort === 'name' ? 'is-on' : ''}
            aria-pressed={sort === 'name'}
            onClick={() => pickSort('name')}
          >
            Name
          </button>
          <button
            className={sort === 'updated' ? 'is-on' : ''}
            aria-pressed={sort === 'updated'}
            onClick={() => pickSort('updated')}
          >
            Updated
          </button>
          <button
            className={sort === 'size' ? 'is-on' : ''}
            aria-pressed={sort === 'size'}
            onClick={() => pickSort('size')}
          >
            Size
          </button>
        </div>

        <div className="files-seg" role="group" aria-label="View" data-testid="files-view">
          <button
            className={view === 'grid' ? 'is-on' : ''}
            aria-pressed={view === 'grid'}
            onClick={() => pickView('grid')}
          >
            Grid
          </button>
          <button
            className={view === 'list' ? 'is-on' : ''}
            aria-pressed={view === 'list'}
            onClick={() => pickView('list')}
          >
            List
          </button>
        </div>
      </header>

      <div className="files-pane" data-testid="files-pane">
        {error ? (
          <div className="db-state">
            <p className="db-state-title">Couldn’t load notes</p>
            <p className="db-state-msg">{error}</p>
          </div>
        ) : notes === null ? (
          <div className="db-skeleton">
            <div className="skel-row" />
            <div className="skel-row" />
            <div className="skel-row" />
          </div>
        ) : entries.length === 0 ? (
          <div className="files-empty">This folder is empty.</div>
        ) : view === 'grid' ? (
          <div className="files-grid">
            {entries.map((e) => (
              <button
                key={`${e.kind}:${e.name}`}
                className={`files-card${selected === e.name ? ' is-selected' : ''}`}
                data-kind={e.kind}
                title={e.kind === 'folder' ? `${e.name} — ${e.count} notes` : e.path}
                onClick={() => setSelected(e.name)}
                onDoubleClick={() => open(e)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') {
                    ev.preventDefault()
                    open(e)
                  }
                }}
              >
                {e.kind === 'folder' ? <IconFolder /> : <IconFile />}
                <span className="files-card-name">{e.name}</span>
                <span className="files-card-meta">{metaOf(e)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="files-list">
            <div className="files-list-head">
              <span />
              <span>Name</span>
              <span className="files-r">Updated</span>
              <span className="files-r">Size</span>
            </div>
            {entries.map((e) => (
              <button
                key={`${e.kind}:${e.name}`}
                className={`files-row${selected === e.name ? ' is-selected' : ''}`}
                data-kind={e.kind}
                title={e.kind === 'folder' ? `${e.name} — ${e.count} notes` : e.path}
                onClick={() => setSelected(e.name)}
                onDoubleClick={() => open(e)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') {
                    ev.preventDefault()
                    open(e)
                  }
                }}
              >
                {e.kind === 'folder' ? <IconFolder /> : <IconFile />}
                <span className="files-row-name">{e.name}</span>
                <span className="files-row-cell files-r">
                  {e.kind === 'folder'
                    ? `${e.count} ${e.count === 1 ? 'note' : 'notes'}`
                    : relativeTime(e.updatedAt)}
                </span>
                <span className="files-row-cell files-r">
                  {e.kind === 'folder' ? '—' : fmtSize(e.bytes)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="files-status" data-testid="files-status">
        {folderCount} {folderCount === 1 ? 'folder' : 'folders'} · {noteCount}{' '}
        {noteCount === 1 ? 'note' : 'notes'} here · {branch} in this branch
      </footer>
    </div>
  )
}
