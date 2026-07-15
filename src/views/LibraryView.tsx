// The note browser — the daily driver. Two panes: a tag rail (left) and a
// searchable, sortable note list (right). Every row opens in the Pages TipTap
// block editor (#/pages/<path>), never a raw-markdown surface.
//
// Search is CLIENT-SIDE full-text: all notes (with bodies) are loaded once, and
// each keystroke matches across title + path + tags + body — the vault's own
// ?search= is title-biased and misses words inside note bodies.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import { createPage, fetchAllNotes, toast } from '../lib/store'
import { hasConstraints, noteMatchesFilters, parseQuery, rankNotes } from '../lib/search'
import { navigate } from '../lib/router'
import { relativeTime, titleFromPath } from '../lib/format'
import { isProtectedNote } from '../domain/scripts'
import { inferNoteType, summaryOf, TYPE_META } from '../domain/noteType'
import { IconPlus, IconShield } from '../components/Icons'
import { NotePage } from './NotePage'

type Sort = 'recent' | 'alpha'

/** Updated-at as epoch ms (0 when missing/invalid) for sorting. */
function ts(n: Note): number {
  const t = new Date(n.updatedAt ?? 0).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Strip markdown syntax (#, *, _, `, > , [[wiki]], [md](links)) to plain text. */
function stripMarkdown(s: string): string {
  return (s ?? '')
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/!?\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1') // [[wiki|alias]] -> wiki
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) -> text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/[*_~`>#]/g, '') // leftover emphasis / quote / hash marks
    .replace(/\s+/g, ' ')
    .trim()
}

/** Clean display title: the note's first heading (sans #), else the de-slugged path. */
function noteTitle(n: Note): string {
  const m = (n.content ?? '').match(/^\s{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/m)
  if (m) {
    const t = stripMarkdown(m[1])
    if (t) return t
  }
  return titleFromPath(n.path)
}

/** A plain-text preview line: body with markdown stripped, minus the title. */
function previewOf(n: Note, title: string): string {
  let body = stripMarkdown(n.content ?? '')
  if (body.toLowerCase().startsWith(title.toLowerCase())) body = body.slice(title.length)
  return body.replace(/\s+/g, ' ').trim().slice(0, 180)
}

/** A note carries `tag` if it has the tag itself or any descendant of it —
 * the vault's own hierarchical-tag semantic (escensus ⊇ escensus/strategy). */
function hasTagDeep(n: Note, tag: string): boolean {
  return (n.tags ?? []).some((t) => t === tag || t.startsWith(`${tag}/`))
}

interface TagNode {
  /** Segment shown at this depth ("strategy"). */
  seg: string
  /** Full tag name ("escensus/strategy"). */
  full: string
  /** Notes carrying this tag or any descendant. */
  total: number
  children: TagNode[]
}

function buildTagTree(all: Note[]): TagNode[] {
  interface Build {
    seg: string
    full: string
    notes: Set<string>
    children: Map<string, Build>
  }
  const roots = new Map<string, Build>()
  for (const n of all) {
    for (const t of n.tags ?? []) {
      const segs = t.split('/').filter(Boolean)
      let level = roots
      let prefix = ''
      for (const seg of segs) {
        prefix = prefix ? `${prefix}/${seg}` : seg
        let node = level.get(seg)
        if (!node) {
          node = { seg, full: prefix, notes: new Set(), children: new Map() }
          level.set(seg, node)
        }
        node.notes.add(n.path) // every ancestor counts this note
        level = node.children
      }
    }
  }
  const finish = (m: Map<string, Build>): TagNode[] =>
    [...m.values()]
      .map((b) => ({ seg: b.seg, full: b.full, total: b.notes.size, children: finish(b.children) }))
      .sort((a, b) => b.total - a.total || a.seg.localeCompare(b.seg))
  return finish(roots)
}

export function LibraryView() {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('recent')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  // Logic-style panels: collapse the tag rail and/or the note browser to
  // slim slivers whenever you want the reading room. Both persisted.
  const [tagsCollapsed, setTagsCollapsed] = useState(
    () => localStorage.getItem('adamvaultos.library.tags.collapsed') === '1',
  )
  const [listCollapsed, setListCollapsed] = useState(
    () => localStorage.getItem('adamvaultos.library.list.collapsed') === '1',
  )
  const toggleTags = () =>
    setTagsCollapsed((c) => {
      localStorage.setItem('adamvaultos.library.tags.collapsed', c ? '0' : '1')
      return !c
    })
  const toggleList = () =>
    setListCollapsed((c) => {
      localStorage.setItem('adamvaultos.library.list.collapsed', c ? '0' : '1')
      return !c
    })
  const seq = useRef(0)

  // ＋ New note born IN CONTEXT (L1): the page inherits the tag you're
  // standing in — or the tag whose ＋ you clicked in the rail — so it's
  // already filed the moment it exists.
  const newNote = async (tagOverride?: string) => {
    if (creating) return
    setCreating(true)
    const tag = tagOverride ?? activeTag
    try {
      const note = await createPage({
        title: 'Untitled',
        extraTags: tag ? [tag] : [],
      })
      navigate({ kind: 'pages', path: note.path })
    } catch (e) {
      toast('error', `Couldn’t create note — ${e instanceof Error ? e.message : e}`)
      setCreating(false)
    }
  }

  // Open the selected note full-screen in its proper editor/view.
  const openFull = (path: string) =>
    navigate(path.startsWith('pages/') ? { kind: 'pages', path } : { kind: 'note', path })

  // Load every note (with content) once, upfront — the corpus for the rail,
  // the list, and instant client-side search.
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

  const all = notes ?? []

  // Tag rail: a HIERARCHICAL tree (N4). The vault's tags are already nested
  // (escensus/strategy, health/labs, capture/voice…) — the rail renders that
  // structure as collapsible parent ▸ children instead of flattening it.
  // A parent's count = notes carrying it OR any descendant.
  const [tagQuery, setTagQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const tagTree = useMemo(() => buildTagTree(all), [all])

  // Flat search over tag names (auto-flattens the tree while filtering).
  const tagMatches = useMemo(() => {
    const q = tagQuery.trim().toLowerCase()
    if (!q) return null
    const out: { name: string; count: number }[] = []
    const walk = (nodes: TagNode[]) => {
      for (const n of nodes) {
        if (n.full.toLowerCase().includes(q)) out.push({ name: n.full, count: n.total })
        walk(n.children)
      }
    }
    walk(tagTree)
    return out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [tagQuery, tagTree])

  // Right pane: client-side full-text search (ranked) OR tag filter, then sort.
  // Ranking lives in lib/search.ts — shared with the Pages sidebar so "good
  // search" means the same thing everywhere.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      // Same operator grammar as the Omnibar (tag:/path:/title:/"phrase") —
      // constraints filter the pool, the free text ranks it. is:/when:/done:
      // are task-group scopes with no meaning in the Library; they fall away.
      const parsed = parseQuery(query.trim())
      const pool = hasConstraints(parsed)
        ? all.filter((n) => noteMatchesFilters(n, parsed, noteTitle))
        : all
      const free = parsed.terms.join(' ')
      if (!free) return [...pool].sort((a, b) => ts(b) - ts(a))
      return rankNotes(free, pool, noteTitle)
    }
    const list = activeTag
      ? all.filter((n) => hasTagDeep(n, activeTag)) // parent tag ⊇ descendants
      : [...all]
    if (sort === 'alpha') {
      list.sort((a, b) => noteTitle(a).localeCompare(noteTitle(b)))
    } else {
      list.sort((a, b) => ts(b) - ts(a))
    }
    return list
  }, [all, query, activeTag, sort])

  const selectTag = (tag: string | null) => {
    setActiveTag(tag)
    setQuery('')
  }
  const onSearch = (text: string) => {
    setQuery(text)
    if (text.trim()) setActiveTag(null)
  }
  const allActive = !activeTag && !query.trim()

  // The list sliver only makes sense with a note open beside it — with
  // nothing selected the browser IS the content, so it stays expanded.
  const listIsCollapsed = listCollapsed && selected !== null

  return (
    <div
      className={`browser${selected ? ' has-detail' : ''}${tagsCollapsed ? ' tags-collapsed' : ''}${listIsCollapsed ? ' list-collapsed' : ''}`}
      data-testid="browser"
    >
      {tagsCollapsed ? (
        <aside className="tag-rail is-collapsed">
          <button
            className="panel-expand"
            data-testid="tags-expand"
            title="Expand tags"
            aria-label="Expand tags"
            onClick={toggleTags}
          >
            »
          </button>
          <span className="panel-collapsed-label">tags</span>
        </aside>
      ) : (
      <aside className="tag-rail">
        <div className="tag-rail-head">
        <button
          className={`tag-rail-item${allActive ? ' is-active' : ''}`}
          onClick={() => selectTag(null)}
        >
          <span className="tag-rail-name">All notes</span>
          <span className="tag-rail-count">{all.length}</span>
        </button>
          <button
            className="panel-collapse"
            data-testid="tags-collapse"
            title="Collapse tags"
            aria-label="Collapse tags"
            onClick={toggleTags}
          >
            «
          </button>
        </div>
        <input
          className="tag-rail-search"
          placeholder="Filter tags…"
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
        />
        <div className="tag-rail-list" data-testid="tag-tree">
          {tagMatches ? (
            tagMatches.length === 0 ? (
              <p className="tag-rail-empty">No tag matches</p>
            ) : (
              tagMatches.map((t) => (
                <button
                  key={t.name}
                  className={`tag-rail-item${activeTag === t.name ? ' is-active' : ''}`}
                  onClick={() => selectTag(activeTag === t.name ? null : t.name)}
                >
                  <span className="tag-rail-name">#{t.name}</span>
                  <span className="tag-rail-count">{t.count}</span>
                </button>
              ))
            )
          ) : (
            tagTree.map((node) => (
              <TagTreeRow
                key={node.full}
                node={node}
                depth={0}
                activeTag={activeTag}
                expanded={expanded}
                onToggle={(full) =>
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    if (next.has(full)) next.delete(full)
                    else next.add(full)
                    return next
                  })
                }
                onSelect={(full) => selectTag(activeTag === full ? null : full)}
                onCreate={(full) => void newNote(full)}
              />
            ))
          )}
        </div>
      </aside>
      )}

      {listIsCollapsed ? (
        <main className="browser-main is-collapsed">
          <button
            className="panel-expand"
            data-testid="list-expand"
            title="Expand the note browser"
            aria-label="Expand the note browser"
            onClick={toggleList}
          >
            »
          </button>
          <span className="panel-collapsed-label">notes</span>
        </main>
      ) : (
      <main className="browser-main">
        <div className="browser-head">
          <input
            autoFocus
            className="browser-search"
            placeholder="Search every note — title, path, tags, and body…"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
          />
          <div className="browser-toolbar">
            <span className="browser-count">
              {rows.length} {rows.length === 1 ? 'note' : 'notes'}
              {activeTag ? ` · #${activeTag}` : ''}
            </span>
            <button
              className="browser-new"
              data-testid="library-new-note"
              title={
                activeTag
                  ? `New note, tagged #${activeTag} — filed where you're standing`
                  : 'New note'
              }
              disabled={creating}
              onClick={() => void newNote()}
            >
              <IconPlus size={13} />
              New note{activeTag ? ` in #${activeTag}` : ''}
            </button>
            {!query.trim() && (
              <div className="sort-toggle" role="group" aria-label="Sort">
                <button
                  className={sort === 'recent' ? 'is-on' : ''}
                  onClick={() => setSort('recent')}
                >
                  Recent
                </button>
                <button
                  className={sort === 'alpha' ? 'is-on' : ''}
                  onClick={() => setSort('alpha')}
                >
                  A–Z
                </button>
              </div>
            )}
          </div>
        </div>

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
        ) : rows.length === 0 ? (
          <div className="db-state">
            <p className="db-state-title">Nothing here</p>
            <p className="db-state-msg">
              {query.trim() ? `No note matches “${query.trim()}”.` : 'No notes yet.'}
            </p>
          </div>
        ) : (
          <div className="browser-list">
            {rows.map((n) => (
              <NoteRow
                key={n.path}
                note={n}
                active={selected === n.path}
                onOpen={() => setSelected(n.path)}
                onEdit={() => openFull(n.path)}
              />
            ))}
          </div>
        )}
      </main>
      )}

      {selected && (
        <section className="browser-detail" data-testid="browser-detail">
          <div className="browser-detail-bar">
            {!listIsCollapsed && (
              <button
                className="panel-collapse"
                data-testid="list-collapse"
                title="Collapse the note browser — reading room"
                aria-label="Collapse the note browser"
                onClick={toggleList}
              >
                «
              </button>
            )}
            <span className="browser-detail-path" title={selected}>
              {selected}
            </span>
            <div className="browser-detail-actions">
              <button
                className="detail-btn"
                onClick={() => openFull(selected)}
                title="Open full-screen editor"
              >
                Open ↗
              </button>
              <button
                className="detail-btn"
                onClick={() => setSelected(null)}
                title="Close"
                aria-label="Close detail"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="browser-detail-body">
            <NotePage path={selected} key={selected} />
          </div>
        </section>
      )}
    </div>
  )
}

function TagTreeRow({
  node,
  depth,
  activeTag,
  expanded,
  onToggle,
  onSelect,
  onCreate,
}: {
  node: TagNode
  depth: number
  activeTag: string | null
  expanded: Set<string>
  onToggle: (full: string) => void
  onSelect: (full: string) => void
  onCreate: (full: string) => void
}) {
  const hasKids = node.children.length > 0
  const open = expanded.has(node.full)
  return (
    <>
      <div
        className={`tag-rail-item tag-tree-item${activeTag === node.full ? ' is-active' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
      >
        {hasKids ? (
          <button
            className="tag-tree-chevron"
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(node.full)
            }}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tag-tree-chevron tag-tree-chevron-none" />
        )}
        <button className="tag-tree-name" onClick={() => onSelect(node.full)}>
          <span className="tag-rail-name">#{depth === 0 ? node.full : node.seg}</span>
          <span className="tag-rail-count">{node.total}</span>
        </button>
        <button
          className="tag-tree-add"
          title={`New note tagged #${node.full}`}
          aria-label={`New note tagged #${node.full}`}
          onClick={(e) => {
            e.stopPropagation()
            onCreate(node.full)
          }}
        >
          ＋
        </button>
      </div>
      {hasKids &&
        open &&
        node.children.map((c) => (
          <TagTreeRow
            key={c.full}
            node={c}
            depth={depth + 1}
            activeTag={activeTag}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            onCreate={onCreate}
          />
        ))}
    </>
  )
}

function NoteRow({
  note,
  onOpen,
  onEdit,
  active,
}: {
  note: Note
  onOpen: () => void
  /** Double-click: skip the preview, go straight into the editor. */
  onEdit?: () => void
  active?: boolean
}) {
  // Debounce the single click: opening the detail pane reflows the grid, which
  // would move the row out from under a double-click mid-gesture. A short hold
  // lets the second click land first.
  const clickTimer = useRef<number | null>(null)
  const handleClick = () => {
    if (!onEdit) {
      onOpen()
      return
    }
    if (clickTimer.current) clearTimeout(clickTimer.current)
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null
      onOpen()
    }, 220)
  }
  const handleDouble = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
    onEdit?.()
  }
  const title = noteTitle(note)
  // Prefer the note's own summary (the vault has these on most real notes) —
  // it reads far better than a stripped-body preview. Fall back to the body.
  const preview = summaryOf(note) ?? previewOf(note, title)
  const tags = note.tags ?? []
  const tmeta = TYPE_META[inferNoteType(note)]
  return (
    <button
      className={`note-row${active ? ' is-selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDouble}
      title="Click to preview · double-click to edit"
    >
      <div className="note-row-head">
        <span className="note-row-title">
          <span
            className={`type-dot type-dot-${tmeta.color}`}
            title={tmeta.label}
            aria-label={tmeta.label}
          />
          {title}
          {isProtectedNote(note) && (
            <span className="canon-mini" title="Founder canon — human-gated">
              <IconShield size={11} />
            </span>
          )}
        </span>
        {typeof note.linkCount === 'number' && note.linkCount > 0 && (
          <span
            className="note-rel"
            title={`${note.linkCount} link${note.linkCount === 1 ? '' : 's'} touch this note`}
          >
            {note.linkCount} rel
          </span>
        )}
        <span className="note-row-time">{relativeTime(note.updatedAt)}</span>
      </div>
      <div className="note-row-path">{note.path}</div>
      {preview && <div className="note-row-preview">{preview}</div>}
      {tags.length > 0 && (
        <div className="note-row-tags">
          {tags.slice(0, 5).map((t) => (
            <span key={t} className="note-chip">
              #{t}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
