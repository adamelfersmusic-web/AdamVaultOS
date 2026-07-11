// Backlinks panel (#10). Below a note, two lists: what it CITES (outgoing
// [[wikilinks]]) and what CITES it (incoming). Each entry is a card with a
// type dot + the linked note's own summary, so you can walk your thinking in
// both directions. One request — the vault hydrates both endpoints.

import { useEffect, useRef, useState } from 'react'
import { fetchNoteLinks, type LinkedNote } from '../lib/store'
import { navigate } from '../lib/router'
import { titleFromPath } from '../lib/format'
import type { Note } from '../lib/types'
import { inferNoteType, summaryOf, TYPE_META } from '../domain/noteType'

function LinkCard({ item }: { item: LinkedNote }) {
  const pseudo = { path: item.path, tags: item.tags, metadata: item.metadata } as Note
  const meta = TYPE_META[inferNoteType(pseudo)]
  const summary = summaryOf(pseudo)
  const open = () =>
    navigate(item.path.startsWith('pages/') ? { kind: 'pages', path: item.path } : { kind: 'note', path: item.path })
  return (
    <button className="link-card" onClick={open} title={item.path}>
      <span className={`type-dot type-dot-${meta.color}`} title={meta.label} />
      <span className="link-card-body">
        <span className="link-card-title">{titleFromPath(item.path)}</span>
        {summary && <span className="link-card-summary">{summary}</span>}
      </span>
      {item.relationship && item.relationship !== 'wikilink' && (
        <span className="link-card-rel">{item.relationship}</span>
      )}
    </button>
  )
}

export function Backlinks({ path }: { path: string }) {
  const [state, setState] = useState<
    { outgoing: LinkedNote[]; incoming: LinkedNote[] } | 'loading' | 'error'
  >('loading')
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    setState('loading')
    fetchNoteLinks(path)
      .then((r) => {
        if (seq.current === id) setState(r)
      })
      .catch(() => {
        if (seq.current === id) setState('error')
      })
  }, [path])

  // Stay silent while loading, on error, or when a note has no links —
  // backlinks should never add noise to an unlinked note.
  if (state === 'loading' || state === 'error') return null
  const { outgoing, incoming } = state
  if (outgoing.length === 0 && incoming.length === 0) return null

  return (
    <section className="backlinks" data-testid="backlinks">
      {outgoing.length > 0 && (
        <div className="backlinks-group">
          <h3 className="backlinks-head">
            Links from this note <span className="backlinks-count">{outgoing.length}</span>
          </h3>
          <div className="backlinks-list">
            {outgoing.map((l) => (
              <LinkCard key={`o:${l.path}`} item={l} />
            ))}
          </div>
        </div>
      )}
      {incoming.length > 0 && (
        <div className="backlinks-group">
          <h3 className="backlinks-head">
            Linked from <span className="backlinks-count">{incoming.length}</span>
          </h3>
          <div className="backlinks-list">
            {incoming.map((l) => (
              <LinkCard key={`i:${l.path}`} item={l} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
