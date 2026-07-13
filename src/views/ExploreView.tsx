// Explore — the vault as a wanderable knowledge layer. ONE view, FIVE MODES
// behind a segmented switch (Atlas · Orbit · Threads · Shuffle · Museum):
//   Atlas   — domain-sectioned topic grid → topic pages grouped by kind
//   Orbit   — any note as the center; calm concentric rings of cites /
//             cited-by / siblings, click to re-center and walk the mycelium
//   Threads — chronological thought-trails: days as strips, colored by domain
//   Shuffle — the serendipity dealer: one card at a time, weighted toward
//             the dusty (longest-untouched) notes, with a trail of recent
//             deals and a hand-off into Orbit
//   Museum  — the trophy room: only the earned best-of notes (pinned,
//             canonical, or locked in metadata), a featured exhibit plus
//             domain wings of quiet plaques
// Strictly read-only: Explore renders the graphNotes() snapshot the Graph
// view already loads and never writes to the vault.

import { useEffect, useMemo, useState } from 'react'
import type { Note } from '../lib/types'
import { fetchGraphNotes } from '../lib/store'
import { hrefFor, navigate } from '../lib/router'
import { titleFromPath } from '../lib/format'
import {
  buildAtlas,
  buildMuseum,
  buildThreads,
  dealShuffle,
  DOMAIN_COLOR,
  domainOf,
  dotColorOf,
  groupByKind,
  hasTagDeep,
  mostLinked,
  museumCredential,
  orbitFor,
  relatedTags,
  takeawayOf,
  TOPIC_KINDS,
  TRAIL_CAP,
} from '../lib/explore'
import { IconGem } from '../components/Icons'

const MODE_KEY = 'adamvaultos.explore.mode'

type Mode = 'atlas' | 'orbit' | 'threads' | 'shuffle' | 'museum'

const MODES: { key: Mode; label: string }[] = [
  { key: 'atlas', label: 'Atlas' },
  { key: 'orbit', label: 'Orbit' },
  { key: 'threads', label: 'Threads' },
  { key: 'shuffle', label: 'Shuffle' },
  { key: 'museum', label: 'Museum' },
]

function loadMode(): Mode {
  const m = localStorage.getItem(MODE_KEY)
  return m === 'orbit' || m === 'threads' || m === 'shuffle' || m === 'museum'
    ? m
    : 'atlas'
}

/** Open a note in its proper full surface (same rule as the Library). */
function openNote(path: string): void {
  navigate(path.startsWith('pages/') ? { kind: 'pages', path } : { kind: 'note', path })
}

export function ExploreView({ tag }: { tag?: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [mode, setModeState] = useState<Mode>(loadMode)
  const [center, setCenter] = useState<string | null>(null)
  // Shuffle's session-only state lives up here (like Orbit's center) so a
  // detour into another mode doesn't lose the dealt card or the trail.
  const [dealt, setDealt] = useState<Note | null>(null)
  const [trail, setTrail] = useState<Note[]>([])

  const setMode = (m: Mode) => {
    setModeState(m)
    localStorage.setItem(MODE_KEY, m)
    // The topic page belongs to Atlas — switching modes returns to the grid.
    if (tag) navigate({ kind: 'explore' })
  }

  const load = () => {
    setStatus('loading')
    setError(null)
    fetchGraphNotes()
      .then((list) => {
        setNotes(list)
        setStatus('ready')
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  return (
    <div className="explore" data-testid="explore-view">
      <header className="explore-head">
        <div className="explore-head-lead">
          <h1 className="explore-title">Explore</h1>
          <p className="explore-sub">
            {mode === 'atlas' && 'The vault as topics, world by world.'}
            {mode === 'orbit' && 'One note at the center — walk its connections.'}
            {mode === 'threads' && 'Where was my head? Days as thought-trails.'}
            {mode === 'shuffle' && 'One card off the top — the dusty ones first.'}
            {mode === 'museum' && 'The trophy room — only the earned hang here.'}
          </p>
        </div>
        <div className="explore-modes" role="tablist" aria-label="Explore mode">
          {MODES.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={mode === m.key && !tag}
              className={`explore-mode-btn${mode === m.key && !tag ? ' is-active' : ''}`}
              onClick={() => setMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {status === 'loading' && (
        <div className="explore-loading" data-testid="explore-loading">
          <IconGem size={30} className="gem-breathe" />
        </div>
      )}

      {status === 'error' && (
        <div className="db-state">
          <p className="db-state-title">Couldn’t load the vault</p>
          <p className="db-state-msg">{error}</p>
          <button className="btn btn-gold" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' &&
        (tag ? (
          <TopicPage notes={notes} tag={tag} />
        ) : mode === 'atlas' ? (
          <Atlas notes={notes} />
        ) : mode === 'orbit' ? (
          <OrbitMode
            notes={notes}
            center={center}
            onCenter={(p) => setCenter(p)}
          />
        ) : mode === 'shuffle' ? (
          <ShuffleMode
            notes={notes}
            dealt={dealt}
            trail={trail}
            onDealt={setDealt}
            onTrail={setTrail}
            onOrbit={(p) => {
              setCenter(p)
              setMode('orbit')
            }}
          />
        ) : mode === 'museum' ? (
          <MuseumMode
            notes={notes}
            onOrbit={(p) => {
              setCenter(p)
              setMode('orbit')
            }}
          />
        ) : (
          <Threads notes={notes} />
        ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mode 1 — Atlas: the domain-sectioned topic grid.
// ---------------------------------------------------------------------------

function Atlas({ notes }: { notes: Note[] }) {
  const sections = useMemo(() => buildAtlas(notes), [notes])
  if (sections.length === 0) {
    return (
      <div className="db-state">
        <p className="db-state-title">Nothing to explore yet</p>
        <p className="db-state-msg">Tag a few notes and the atlas will form.</p>
      </div>
    )
  }
  return (
    <div className="atlas" data-testid="atlas">
      {sections.map((s) => (
        <section key={s.domain} className="atlas-domain" data-domain={s.domain}>
          <h2 className="atlas-domain-head">
            <i
              className="atlas-domain-dot"
              style={{ background: DOMAIN_COLOR[s.domain] }}
              aria-hidden="true"
            />
            {s.domain}
          </h2>
          <div className="atlas-grid">
            {s.topics.map((t) => (
              <a
                key={t.tag}
                className="topic-card"
                href={hrefFor({ kind: 'explore-tag', tag: t.tag })}
              >
                <span className="topic-card-name">#{t.tag}</span>
                <span className="topic-card-count">
                  {t.count} {t.count === 1 ? 'note' : 'notes'}
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Topic page — #/explore/tag/<tag>: notes by kind + the related-tags rail.
// ---------------------------------------------------------------------------

function TopicPage({ notes, tag }: { notes: Note[]; tag: string }) {
  const carrying = useMemo(
    () => notes.filter((n) => hasTagDeep(n, tag)),
    [notes, tag],
  )
  const groups = useMemo(() => groupByKind(carrying), [carrying])
  const related = useMemo(() => relatedTags(notes, tag), [notes, tag])

  return (
    <div className="topic" data-testid="topic-page">
      <a className="topic-back" href="#/explore">
        ← All topics
      </a>
      <header className="topic-head">
        <h2 className="topic-head-tag">#{tag}</h2>
        <span className="topic-head-count">
          {carrying.length} {carrying.length === 1 ? 'note' : 'notes'}
        </span>
      </header>

      <div className="topic-layout">
        <div className="topic-main">
          {carrying.length === 0 && (
            <div className="db-state">
              <p className="db-state-title">No notes carry #{tag}</p>
              <p className="db-state-msg">
                If a topic looks thin, that’s the vault saying where filing
                needs love.
              </p>
            </div>
          )}
          {TOPIC_KINDS.map(({ kind, label }) => {
            const list = groups[kind]
            if (list.length === 0) return null
            return (
              <section key={kind} className="topic-section" data-kind={kind}>
                <h3 className="explore-section-head">{label}</h3>
                <div className="explore-cards">
                  {list.map((n) => (
                    <NoteCard key={n.path} note={n} onOpen={() => openNote(n.path)} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {related.length > 0 && (
          <aside className="related-rail" data-testid="related-rail">
            <h3 className="explore-section-head">Related tags</h3>
            {related.map((r) => (
              <a
                key={r.tag}
                className="related-item"
                href={hrefFor({ kind: 'explore-tag', tag: r.tag })}
              >
                <span className="related-item-name">#{r.tag}</span>
                <span className="related-item-count">{r.count}</span>
              </a>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}

function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const takeaway = takeawayOf(note)
  return (
    <button className="explore-card" onClick={onOpen} title={note.path}>
      <span className="explore-card-title">
        <span className={`type-dot type-dot-${dotColorOf(note)}`} aria-hidden="true" />
        {titleFromPath(note.path)}
      </span>
      {takeaway && <span className="explore-card-takeaway">{takeaway}</span>}
      {typeof note.linkCount === 'number' && note.linkCount > 0 && (
        <span className="note-rel explore-card-rel">{note.linkCount} rel</span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Mode 2 — Orbit: concentric ring bands around a chosen center.
// ---------------------------------------------------------------------------

function OrbitMode({
  notes,
  center,
  onCenter,
}: {
  notes: Note[]
  center: string | null
  onCenter: (path: string) => void
}) {
  const [query, setQuery] = useState('')

  // Seed from the vault's biggest hub until a center is chosen.
  const centerPath = center ?? mostLinked(notes)?.path ?? null
  const orbit = useMemo(
    () => (centerPath ? orbitFor(notes, centerPath) : null),
    [notes, centerPath],
  )

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return notes
      .filter(
        (n) =>
          titleFromPath(n.path).toLowerCase().includes(q) ||
          n.path.toLowerCase().includes(q),
      )
      .sort((a, b) => (b.linkCount ?? 0) - (a.linkCount ?? 0))
      .slice(0, 8)
  }, [notes, query])

  const pick = (path: string) => {
    onCenter(path)
    setQuery('')
  }

  if (!orbit) {
    return (
      <div className="db-state">
        <p className="db-state-title">Nothing to orbit yet</p>
        <p className="db-state-msg">The vault has no notes to circle.</p>
      </div>
    )
  }

  const rings: { key: string; label: string; items: Note[] }[] = [
    { key: 'cites', label: 'cites', items: orbit.cites },
    { key: 'cited-by', label: 'cited by', items: orbit.citedBy },
    { key: 'siblings', label: 'siblings', items: orbit.siblings },
  ]

  const centerTakeaway = takeawayOf(orbit.center)

  return (
    <div className="orbit" data-testid="orbit">
      <div className="orbit-picker" data-testid="orbit-picker">
        <input
          placeholder="Center any note…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Pick an orbit center"
        />
        {matches.length > 0 && (
          <div className="orbit-pick-menu">
            {matches.map((n) => (
              <button
                key={n.path}
                className="orbit-pick-item"
                onClick={() => pick(n.path)}
              >
                <span className={`type-dot type-dot-${dotColorOf(n)}`} aria-hidden="true" />
                {titleFromPath(n.path)}
                <span className="orbit-pick-path">{n.path}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className="orbit-center"
        data-testid="orbit-center"
        title={`Open ${orbit.center.path}`}
        onClick={() => openNote(orbit.center.path)}
      >
        <span className="orbit-center-title">
          <span
            className={`type-dot type-dot-${dotColorOf(orbit.center)}`}
            aria-hidden="true"
          />
          {titleFromPath(orbit.center.path)}
        </span>
        {centerTakeaway && (
          <span className="orbit-center-takeaway">{centerTakeaway}</span>
        )}
        {typeof orbit.center.linkCount === 'number' && orbit.center.linkCount > 0 && (
          <span className="note-rel">{orbit.center.linkCount} rel</span>
        )}
      </button>

      <div className="orbit-rings">
        {rings.map((ring, i) => (
          <section
            key={ring.key}
            className={`orbit-ring orbit-ring-${i + 1}`}
            data-ring={ring.key}
          >
            <h3 className="orbit-ring-label">{ring.label}</h3>
            {ring.items.length === 0 ? (
              <p className="orbit-ring-empty">— quiet out here —</p>
            ) : (
              <div className="orbit-ring-cards">
                {ring.items.map((n) => (
                  <button
                    key={n.path}
                    className="orbit-card"
                    title={n.path}
                    onClick={() => onCenter(n.path)}
                  >
                    <span className={`type-dot type-dot-${dotColorOf(n)}`} aria-hidden="true" />
                    <span className="orbit-card-title">{titleFromPath(n.path)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mode 3 — Threads: days as strips of small domain-colored cards.
// ---------------------------------------------------------------------------

function Threads({ notes }: { notes: Note[] }) {
  const days = useMemo(() => buildThreads(notes), [notes])
  if (days.length === 0) {
    return (
      <div className="db-state">
        <p className="db-state-title">No trails yet</p>
        <p className="db-state-msg">Notes will thread here day by day.</p>
      </div>
    )
  }
  return (
    <div className="threads" data-testid="threads">
      {days.map((day) => (
        <section key={day.key} className="thread-day">
          <h3 className="thread-date">{day.label}</h3>
          <div className="thread-strip">
            {day.notes.map((n) => {
              const d = domainOf(n.path)
              return (
                <button
                  key={n.path}
                  className="thread-card"
                  style={{ borderLeftColor: DOMAIN_COLOR[d] }}
                  title={n.path}
                  onClick={() => openNote(n.path)}
                >
                  <span className="thread-card-title">{titleFromPath(n.path)}</span>
                  <span className="thread-card-domain">{d}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mode 4 — Shuffle: the serendipity dealer. One full, calm card at a time,
// dealt dusty-first (see dealShuffle), with a trail of recent deals and
// three moves: deal again, orbit this, open.
// ---------------------------------------------------------------------------

function ShuffleMode({
  notes,
  dealt,
  trail,
  onDealt,
  onTrail,
  onOrbit,
}: {
  notes: Note[]
  dealt: Note | null
  trail: Note[]
  onDealt: (n: Note | null) => void
  onTrail: (t: Note[]) => void
  onOrbit: (path: string) => void
}) {
  // Auto-deal the first card when the snapshot is in and no card is face-up.
  useEffect(() => {
    if (!dealt && notes.length > 0) {
      onDealt(dealShuffle(notes, Math.random))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, dealt])

  if (!dealt) {
    return (
      <div className="db-state">
        <p className="db-state-title">Nothing to deal</p>
        <p className="db-state-msg">The deck is empty — write a few notes first.</p>
      </div>
    )
  }

  const dealAgain = () => {
    const exclude = new Set([dealt.path, ...trail.map((t) => t.path)])
    const next = dealShuffle(notes, Math.random, exclude)
    if (!next || next.path === dealt.path) return
    onTrail([dealt, ...trail.filter((t) => t.path !== dealt.path)].slice(0, TRAIL_CAP))
    onDealt(next)
  }

  /** A trail chip re-deals that exact note back to the big card. */
  const recall = (note: Note) => {
    const rest = trail.filter((t) => t.path !== note.path && t.path !== dealt.path)
    onTrail(
      dealt.path === note.path ? rest : [dealt, ...rest].slice(0, TRAIL_CAP),
    )
    onDealt(note)
  }

  const domain = domainOf(dealt.path)
  const takeaway = takeawayOf(dealt)
  const tags = (dealt.tags ?? []).slice(0, 8)

  return (
    <div className="shuffle" data-testid="shuffle">
      <article
        className="shuffle-card"
        data-testid="shuffle-card"
        data-path={dealt.path}
      >
        <span className="shuffle-domain" style={{ color: DOMAIN_COLOR[domain] }}>
          <i
            className="shuffle-domain-dot"
            style={{ background: DOMAIN_COLOR[domain] }}
            aria-hidden="true"
          />
          {domain}
        </span>
        <h2 className="shuffle-card-title">
          <span
            className={`type-dot type-dot-${dotColorOf(dealt)}`}
            aria-hidden="true"
          />
          {titleFromPath(dealt.path)}
        </h2>
        {takeaway && <p className="shuffle-takeaway">{takeaway}</p>}
        {tags.length > 0 && (
          <div className="shuffle-tags">
            {tags.map((t) => (
              <span key={t} className="shuffle-tag">
                #{t}
              </span>
            ))}
          </div>
        )}
      </article>

      <div className="shuffle-actions">
        <button className="btn btn-gold" data-testid="shuffle-deal" onClick={dealAgain}>
          Deal again
        </button>
        <button
          className="btn btn-ghost"
          data-testid="shuffle-orbit"
          onClick={() => onOrbit(dealt.path)}
        >
          Orbit this
        </button>
        <button
          className="btn btn-ghost"
          data-testid="shuffle-open"
          onClick={() => openNote(dealt.path)}
        >
          Open
        </button>
      </div>

      {trail.length > 0 && (
        <div className="shuffle-trail" data-testid="shuffle-trail">
          {trail.map((n) => (
            <button
              key={n.path}
              className="shuffle-trail-chip"
              title={n.path}
              onClick={() => recall(n)}
            >
              <span
                className={`type-dot type-dot-${dotColorOf(n)}`}
                aria-hidden="true"
              />
              <span className="shuffle-trail-title">{titleFromPath(n.path)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mode 5 — Museum: the trophy room. Only the earned best-of hang here
// (pinned / canonical / status-locked in metadata — see museumPieces). The
// most-linked piece takes the featured wall; the rest hang in domain wings
// of quiet plaques. Read-only, like all of Explore.
// ---------------------------------------------------------------------------

function MuseumMode({
  notes,
  onOrbit,
}: {
  notes: Note[]
  onOrbit: (path: string) => void
}) {
  const museum = useMemo(() => buildMuseum(notes), [notes])

  if (!museum) {
    return (
      <p className="museum-empty" data-testid="museum-empty">
        Nothing hangs here yet — pin or canonize your best notes and they
        appear.
      </p>
    )
  }

  const featured = museum.featured
  const featuredDomain = domainOf(featured.path)
  const featuredTakeaway = takeawayOf(featured)
  const featuredCred = museumCredential(featured)

  return (
    <div className="museum" data-testid="museum">
      <button
        className="museum-featured"
        data-testid="museum-featured"
        data-path={featured.path}
        title={featured.path}
        onClick={() => openNote(featured.path)}
      >
        <span
          className="museum-featured-domain"
          style={{ color: DOMAIN_COLOR[featuredDomain] }}
        >
          <i
            className="museum-domain-dot"
            style={{ background: DOMAIN_COLOR[featuredDomain] }}
            aria-hidden="true"
          />
          {featuredDomain}
        </span>
        <span className="museum-featured-title">
          <span
            className={`type-dot type-dot-${dotColorOf(featured)}`}
            aria-hidden="true"
          />
          {titleFromPath(featured.path)}
        </span>
        {featuredTakeaway && (
          <span className="museum-featured-takeaway">{featuredTakeaway}</span>
        )}
        {featuredCred && <span className="museum-cred">{featuredCred}</span>}
      </button>

      {museum.wings.map((wing) => (
        <section
          key={wing.domain}
          className="museum-wing"
          data-testid="museum-wing"
          data-domain={wing.domain}
        >
          <h2 className="museum-wing-head">
            <i
              className="museum-domain-dot"
              style={{ background: DOMAIN_COLOR[wing.domain] }}
              aria-hidden="true"
            />
            {wing.domain}
          </h2>
          <div className="museum-wing-row">
            {wing.pieces.map((n) => (
              <MuseumPlaque key={n.path} note={n} onOrbit={onOrbit} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function MuseumPlaque({
  note,
  onOrbit,
}: {
  note: Note
  onOrbit: (path: string) => void
}) {
  const takeaway = takeawayOf(note)
  const cred = museumCredential(note)
  return (
    <article
      className="museum-plaque"
      data-testid="museum-plaque"
      data-path={note.path}
      title={note.path}
      onClick={() => openNote(note.path)}
    >
      <span className="museum-plaque-title">
        <span
          className={`type-dot type-dot-${dotColorOf(note)}`}
          aria-hidden="true"
        />
        {titleFromPath(note.path)}
      </span>
      {takeaway && <span className="museum-plaque-takeaway">{takeaway}</span>}
      <span className="museum-plaque-foot">
        {cred ? <span className="museum-cred">{cred}</span> : <span />}
        <button
          className="museum-orbit-btn"
          data-testid="museum-orbit"
          onClick={(e) => {
            e.stopPropagation()
            onOrbit(note.path)
          }}
        >
          Orbit
        </button>
      </span>
    </article>
  )
}
