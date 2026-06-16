// The note browser — the daily driver. Two panes: a tag rail (left) and a
// searchable, sortable note list (right). Every row opens in the Pages TipTap
// block editor (#/pages/<path>), never a raw-markdown surface.
//
// Search is CLIENT-SIDE full-text: all notes (with bodies) are loaded once, and
// each keystroke matches across title + path + tags + body — the vault's own
// ?search= is title-biased and misses words inside note bodies.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../lib/types'
import { fetchAllNotes } from '../lib/store'
import { navigate } from '../lib/router'
import { relativeTime, titleFromPath } from '../lib/format'
import { isProtectedNote } from '../domain/scripts'
import { IconShield } from '../components/Icons'

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

export function LibraryView() {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('recent')
  const seq = useRef(0)

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

  // Tag rail: occurrence counts across all notes, most-used first.
  const tagRail = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of all) for (const t of n.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [all])

  // Right pane: client-side full-text search (ranked) OR tag filter, then sort.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      const scored: { n: Note; score: number }[] = []
      for (const n of all) {
        const title = noteTitle(n).toLowerCase()
        const path = (n.path ?? '').toLowerCase()
        const tags = (n.tags ?? []).join(' ').toLowerCase()
        const body = (n.content ?? '').toLowerCase()
        let score = -1
        if (title.includes(q)) score = 0 // title match ranks first
        else if (path.includes(q) || tags.includes(q)) score = 1
        else if (body.includes(q)) score = 2 // then anywhere in the body
        if (score >= 0) scored.push({ n, score })
      }
      scored.sort((a, b) => a.score - b.score || ts(b.n) - ts(a.n))
      return scored.map((s) => s.n)
    }
    const list = activeTag
      ? all.filter((n) => (n.tags ?? []).includes(activeTag))
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

  return (
    <div className="browser" data-testid="browser">
      <aside className="tag-rail">
        <button
          className={`tag-rail-item${allActive ? ' is-active' : ''}`}
          onClick={() => selectTag(null)}
        >
          <span className="tag-rail-name">All notes</span>
          <span className="tag-rail-count">{all.length}</span>
        </button>
        <div className="tag-rail-list">
          {tagRail.map((t) => (
            <button
              key={t.name}
              className={`tag-rail-item${activeTag === t.name ? ' is-active' : ''}`}
              onClick={() => selectTag(activeTag === t.name ? null : t.name)}
            >
              <span className="tag-rail-name">#{t.name}</span>
              <span className="tag-rail-count">{t.count}</span>
            </button>
          ))}
        </div>
      </aside>

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
              <NoteRow key={n.path} note={n} onOpen={() => navigate({ kind: 'pages', path: n.path })} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function NoteRow({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const title = noteTitle(note)
  const preview = previewOf(note, title)
  const tags = note.tags ?? []
  return (
    <button className="note-row" onClick={onOpen}>
      <div className="note-row-head">
        <span className="note-row-title">
          {title}
          {isProtectedNote(note) && (
            <span className="canon-mini" title="Founder canon — human-gated">
              <IconShield size={11} />
            </span>
          )}
        </span>
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
