// THE OMNIBAR (⌘K) — one bar, whole vault. It answers ONE question: "where
// is it?" Commands, notes, tasks, projects, and tags in one ranked surface,
// with a permanent last row that hands the query to Ask AI.
//
// It absorbs the old CommandPalette entirely: every command it offered lives
// in the Commands group, and the `.palette-input` / `.palette-item` selector
// contract is preserved for the existing e2e specs.
//
// Ranking is lib/search.ts's rankNotes — the app's ONE relevance engine —
// extended (not forked) with the operator grammar (tag:/path:/is:/when:/
// done:/"phrase"), best-line snippets, and the edit-distance-1 typo net.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  createPage,
  disconnect,
  fetchAllNotes,
  toast,
  useStore,
} from '../lib/store'
import { askAiAsk, closePalette, openAskAi, openNewScript } from '../lib/ui'
import { navigate } from '../lib/router'
import { fuzzyScore } from '../lib/fuzzy'
import { relativeTime, titleFromPath } from '../lib/format'
import {
  correctTerm,
  escapeRegExp,
  hasConstraints,
  hasFreeText,
  noteMatchesFilters,
  parseQuery,
  rankNotes,
  snippetFor,
  type ParsedQuery,
} from '../lib/search'
import type { Note } from '../lib/types'
import { inferNoteType, TYPE_META } from '../domain/noteType'
import { isTaskNote } from '../domain/tracker'
import { toProjects } from '../domain/projects'
import { PAGE_TAG } from '../domain/pages'
import {
  IconBoard,
  IconDisconnect,
  IconGallery,
  IconGem,
  IconGraph,
  IconLibrary,
  IconPage,
  IconPlus,
  IconSpark,
  IconTable,
} from './Icons'

// ————————————————————————— caps (calm by law) —————————————————————————
const GROUP_CAP = 8
const TOTAL_CAP = 20
const RECENTS_CAP = 6

const RECENTS_KEY = 'adamvaultos.omnibar.recents'

type GroupKey =
  | 'commands'
  | 'notes'
  | 'tasks'
  | 'projects'
  | 'tags'
  | 'recent'
  | 'recent-notes'
  | 'ask'

const GROUP_LABELS: Record<GroupKey, string> = {
  commands: 'Commands',
  notes: 'Notes',
  tasks: 'Tasks',
  projects: 'Projects',
  tags: 'Tags',
  recent: 'Recent searches',
  'recent-notes': 'Recently opened',
  ask: '',
}

interface OmniItem {
  key: string
  group: GroupKey
  label: string
  icon?: ReactNode
  /** type-dot color key (notes/tasks rows). */
  dot?: string
  /** Muted vault path beside the title. */
  path?: string
  /** Best-matching content line (plain text; terms marked at render). */
  snippet?: string
  /** Right-aligned muted hint (status, when, counts, time). */
  hint?: string
  /** Recent-search rows refill the input instead of closing the bar. */
  keepOpen?: boolean
  run: () => void
}

// ————————————————————————— recents —————————————————————————

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list)
      ? list.filter((x): x is string => typeof x === 'string').slice(0, RECENTS_CAP)
      : []
  } catch {
    return []
  }
}

function saveRecent(q: string): void {
  const query = q.trim()
  if (!query) return
  const next = [query, ...loadRecents().filter((r) => r !== query)].slice(0, RECENTS_CAP)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* storage full — recents are a nicety */
  }
}

// ————————————————————————— titles —————————————————————————

/** Display title: the note's first heading, else the de-slugged path. */
function noteTitle(n: Note): string {
  const m = (n.content ?? '').match(/^\s{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/m)
  if (m?.[1]) {
    const t = m[1].replace(/[*_`#]+/g, '').trim()
    if (t) return t
  }
  return titleFromPath(n.path)
}

/** Task title: the body's first line IS the title (tracker convention). */
function taskTitle(n: Note): string {
  const first = (n.content ?? '').split('\n')[0]?.replace(/^#+\s*/, '').trim()
  return first || titleFromPath(n.path)
}

/** Task body minus its title line — the snippet source. */
function taskBody(n: Note): string {
  const i = (n.content ?? '').indexOf('\n')
  return i >= 0 ? (n.content ?? '').slice(i + 1) : ''
}

/** House note-opening rule (same as Library/Explore/Backlinks). */
function openNote(path: string): void {
  navigate(path.startsWith('pages/') ? { kind: 'pages', path } : { kind: 'note', path })
}

// ————————————————————————— corpus (lazy, like the Library) —————————————————————————

let corpusCache: { at: number; notes: Note[] } | null = null

// ————————————————————————— highlighting —————————————————————————

/** Term-marked text built from PLAIN strings — React spans, never innerHTML. */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.filter(Boolean)
  if (clean.length === 0) return <>{text}</>
  const re = new RegExp(
    `(${[...clean].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|')})`,
    'gi',
  )
  const parts = text.split(re)
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))}
    </>
  )
}

// ————————————————————————— the component —————————————————————————

export function Omnibar() {
  const { tracker, projects, notes: storeNotes } = useStore()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const [corpus, setCorpus] = useState<Note[] | null>(corpusCache?.notes ?? null)
  const [recents] = useState<string[]>(loadRecents)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Full-text corpus, lazily on first open — the Library's own pattern.
  useEffect(() => {
    let alive = true
    if (!corpusCache || Date.now() - corpusCache.at > 60_000) {
      fetchAllNotes()
        .then((list) => {
          corpusCache = { at: Date.now(), notes: list }
          if (alive) setCorpus(list)
        })
        .catch(() => {
          /* an empty notes group beats a broken bar */
        })
    }
    return () => {
      alive = false
    }
  }, [])

  // ~80ms debounce: instant feel, no wasted ranking passes while typing.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 80)
    return () => window.clearTimeout(id)
  }, [query])

  // ——— Commands: everything the old palette offered, and the missing verbs ———
  const commands = useMemo<OmniItem[]>(() => {
    const go = (run: () => void) => run
    const list: Array<Omit<OmniItem, 'group'>> = [
      {
        key: 'new-page',
        label: 'New page',
        icon: <IconPlus size={14} />,
        run: go(() => {
          void createPage({ title: 'Untitled' })
            .then((note) => navigate({ kind: 'pages', path: note.path }))
            .catch((e) =>
              toast('error', `Couldn’t create page — ${e instanceof Error ? e.message : e}`),
            )
        }),
      },
      {
        key: 'new-script',
        label: 'New script',
        icon: <IconPlus size={14} />,
        run: () => openNewScript(),
      },
      {
        key: 'new-task',
        label: 'New task',
        hint: 'tracker',
        icon: <IconPlus size={14} />,
        run: () => navigate({ kind: 'tracker' }),
      },
      {
        key: 'projects',
        label: 'Projects — the Cockpit',
        icon: <IconSpark size={14} />,
        run: () => navigate({ kind: 'projects' }),
      },
      {
        key: 'pages',
        label: 'Pages — the writing desk',
        icon: <IconPage size={14} />,
        run: () => navigate({ kind: 'pages' }),
      },
      {
        key: 'tracker',
        label: 'Tracker — every task',
        icon: <IconBoard size={14} />,
        run: () => navigate({ kind: 'tracker' }),
      },
      {
        key: 'library',
        label: 'Library — search the vault',
        icon: <IconLibrary size={14} />,
        run: () => navigate({ kind: 'library' }),
      },
      {
        key: 'graph',
        label: 'Graph — the vault as a constellation',
        icon: <IconGraph size={14} />,
        run: () => navigate({ kind: 'graph' }),
      },
      {
        key: 'explore',
        label: 'Explore — wander the vault',
        icon: <IconGem size={14} />,
        run: () => navigate({ kind: 'explore' }),
      },
      {
        key: 'canvas',
        label: 'Canvas — freeform boards',
        icon: <IconGallery size={14} />,
        run: () => navigate({ kind: 'canvas' }),
      },
      {
        key: 'table',
        label: 'Scripts · Table',
        icon: <IconTable size={14} />,
        run: () => navigate({ kind: 'scripts', lens: 'table' }),
      },
      {
        key: 'board',
        label: 'Scripts · Board',
        icon: <IconBoard size={14} />,
        run: () => navigate({ kind: 'scripts', lens: 'board' }),
      },
      {
        key: 'gallery',
        label: 'Scripts · Gallery',
        icon: <IconGallery size={14} />,
        run: () => navigate({ kind: 'scripts', lens: 'gallery' }),
      },
      {
        key: 'askai',
        label: 'Ask AI',
        hint: '⌘J',
        icon: <IconSpark size={14} />,
        run: () => openAskAi(),
      },
      {
        key: 'disconnect',
        label: 'Disconnect vault',
        icon: <IconDisconnect size={14} />,
        run: () => {
          disconnect()
          navigate({ kind: 'connect' })
        },
      },
    ]
    return list.map((c) => ({ ...c, group: 'commands' as const }))
  }, [])

  // ——— The pipeline: parse → filter → rank → group → cap ———
  const build = useMemo(() => {
    const taskPool = (): Note[] => {
      if (tracker && tracker.length > 0) {
        return tracker.map((p) => storeNotes[p]).filter((n): n is Note => Boolean(n))
      }
      return (corpus ?? []).filter(isTaskNote)
    }
    const projectPool = (): Note[] =>
      (projects ?? []).map((p) => storeNotes[p]).filter((n): n is Note => Boolean(n))

    /** Deep tag counts over the corpus (escensus ⊇ escensus/strategy). */
    const tagCounts = (): Map<string, number> => {
      const owners = new Map<string, Set<string>>()
      for (const n of corpus ?? []) {
        for (const t of n.tags ?? []) {
          const segs = t.split('/').filter(Boolean)
          let prefix = ''
          for (const seg of segs) {
            prefix = prefix ? `${prefix}/${seg}` : seg
            let set = owners.get(prefix)
            if (!set) owners.set(prefix, (set = new Set()))
            set.add(n.path)
          }
        }
      }
      const counts = new Map<string, number>()
      for (const [tag, set] of owners) counts.set(tag, set.size)
      return counts
    }

    interface Groups {
      commands: OmniItem[]
      notes: OmniItem[]
      tasks: OmniItem[]
      projects: OmniItem[]
      tags: OmniItem[]
      /** Data hits (everything except commands) — the typo-net trigger. */
      dataCount: number
    }

    const computeGroups = (parsed: ParsedQuery): Groups => {
      const free = hasFreeText(parsed)
      const constrained = hasConstraints(parsed)
      const rankQ = [...parsed.terms, ...parsed.phrases].join(' ')
      const markTerms = [...parsed.terms, ...parsed.phrases]
      const taskScoped = parsed.when !== null || parsed.done !== null

      // Commands — free-text only; operator queries are about the data.
      let commandItems: OmniItem[] = []
      if (free && !constrained) {
        commandItems = commands
          .map((c) => ({ c, s: fuzzyScore(rankQ, c.label) }))
          .filter((x): x is { c: OmniItem; s: number } => x.s !== null)
          .sort((a, b) => b.s - a.s)
          .slice(0, GROUP_CAP)
          .map((x) => x.c)
      }

      // Notes — the knowledge layer (tasks live in their own group).
      let noteItems: OmniItem[] = []
      const notesVisible =
        (parsed.is === null || parsed.is === 'note' || parsed.is === 'page') && !taskScoped
      if (notesVisible && corpus && (free || constrained)) {
        let pool = corpus.filter((n) => !isTaskNote(n))
        if (parsed.is === 'page') {
          pool = pool.filter(
            (n) => (n.tags ?? []).includes(PAGE_TAG) || n.path.startsWith('pages/'),
          )
        }
        pool = pool.filter((n) => noteMatchesFilters(n, parsed, noteTitle))
        const ranked = free
          ? rankNotes(rankQ, pool, noteTitle)
          : [...pool].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        noteItems = ranked.slice(0, GROUP_CAP).map((n) => ({
          key: `note:${n.path}`,
          group: 'notes' as const,
          label: noteTitle(n),
          dot: TYPE_META[inferNoteType(n)].color,
          path: n.path,
          snippet: snippetFor(n.content, markTerms) ?? undefined,
          hint: relativeTime(n.updatedAt),
          run: () => openNote(n.path),
        }))
      }

      // Tasks — open by default; done:/when: refine.
      let taskItems: OmniItem[] = []
      const tasksVisible = parsed.is === null || parsed.is === 'task'
      if (tasksVisible && (free || constrained)) {
        let pool = taskPool().filter((n) =>
          parsed.done === null
            ? n.metadata['done'] !== true
            : (n.metadata['done'] === true) === parsed.done,
        )
        if (parsed.when) {
          pool = pool.filter((n) => String(n.metadata['when'] ?? '') === parsed.when)
        }
        pool = pool.filter((n) => noteMatchesFilters(n, parsed, taskTitle))
        const ranked = free
          ? rankNotes(rankQ, pool, taskTitle)
          : [...pool].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        taskItems = ranked.slice(0, GROUP_CAP).map((n) => {
          const project = String(n.metadata['project'] ?? '')
          const when = String(n.metadata['when'] ?? '')
          return {
            key: `task:${n.path}`,
            group: 'tasks' as const,
            label: taskTitle(n),
            dot: TYPE_META.task.color,
            path: n.path,
            snippet: snippetFor(taskBody(n), markTerms) ?? undefined,
            hint: [project, when].filter(Boolean).join(' · ') || undefined,
            run: () => navigate({ kind: 'pages', path: n.path }),
          }
        })
      }

      // Projects — the spine's worlds.
      let projectItems: OmniItem[] = []
      const projectsVisible =
        (parsed.is === null || parsed.is === 'project') && !taskScoped
      if (projectsVisible && (free || constrained)) {
        let pool = toProjects(projectPool())
        pool = pool.filter((p) => noteMatchesFilters(p.note, parsed, () => p.title))
        if (free) {
          pool = pool.filter((p) => {
            const hay = `${p.title} ${p.key} ${p.tag} ${p.path}`.toLowerCase()
            return (
              parsed.terms.every((t) => hay.includes(t)) &&
              parsed.phrases.every((ph) => hay.includes(ph))
            )
          })
        }
        projectItems = pool.slice(0, GROUP_CAP).map((p) => ({
          key: `project:${p.path}`,
          group: 'projects' as const,
          label: p.title,
          dot: TYPE_META.project.color,
          path: p.path,
          hint: p.status,
          run: () => navigate({ kind: 'project', path: p.path }),
        }))
      }

      // Tags — names with deep counts; Enter explores the tag.
      let tagItems: OmniItem[] = []
      const tagsVisible = parsed.is === null && !taskScoped
      if (tagsVisible && free && corpus) {
        const matches: { name: string; count: number }[] = []
        for (const [name, count] of tagCounts()) {
          const hay = name.toLowerCase()
          if (
            parsed.terms.every((t) => hay.includes(t)) &&
            parsed.phrases.every((ph) => hay.includes(ph))
          ) {
            matches.push({ name, count })
          }
        }
        matches.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        tagItems = matches.slice(0, GROUP_CAP).map((t) => ({
          key: `tag:${t.name}`,
          group: 'tags' as const,
          icon: <IconGem size={14} />,
          label: `#${t.name}`,
          hint: `${t.count} ${t.count === 1 ? 'note' : 'notes'}`,
          run: () => navigate({ kind: 'explore-tag', tag: t.name }),
        }))
      }

      return {
        commands: commandItems,
        notes: noteItems,
        tasks: taskItems,
        projects: projectItems,
        tags: tagItems,
        dataCount:
          noteItems.length + taskItems.length + projectItems.length + tagItems.length,
      }
    }

    return (raw: string): { items: OmniItem[]; markTerms: string[] } => {
      const q = raw.trim()

      // ——— Zero-state: recents + recently touched notes + top commands ———
      if (!q) {
        const items: OmniItem[] = []
        for (const r of recents.slice(0, RECENTS_CAP)) {
          items.push({
            key: `recent:${r}`,
            group: 'recent',
            label: r,
            keepOpen: true,
            run: () => {
              setQuery(r)
              setDebounced(r)
              inputRef.current?.focus()
            },
          })
        }
        const fresh = (corpus ?? [])
          .filter((n) => !isTaskNote(n))
          .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
          .slice(0, 6)
        for (const n of fresh) {
          items.push({
            key: `note:${n.path}`,
            group: 'recent-notes',
            label: noteTitle(n),
            dot: TYPE_META[inferNoteType(n)].color,
            path: n.path,
            hint: relativeTime(n.updatedAt),
            run: () => openNote(n.path),
          })
        }
        for (const c of commands.slice(0, 6)) items.push(c)
        return { items: items.slice(0, TOTAL_CAP), markTerms: [] }
      }

      const parsed = parseQuery(q)
      let groups = computeGroups(parsed)
      let markTerms = [...parsed.terms, ...parsed.phrases]

      // ——— Typo net: a term ≥4 chars that hits NOTHING gets one ≤1-edit retry ———
      if (
        groups.dataCount === 0 &&
        corpus &&
        parsed.terms.some((t) => t.length >= 4)
      ) {
        const corrected = parsed.terms.map((t) =>
          t.length >= 4 ? (correctTerm(t, corpus, noteTitle) ?? t) : t,
        )
        if (corrected.join(' ') !== parsed.terms.join(' ')) {
          const retried = computeGroups({ ...parsed, terms: corrected })
          if (retried.dataCount > 0) {
            groups = retried
            markTerms = [...corrected, ...parsed.phrases]
          }
        }
      }

      const items = [
        ...groups.commands,
        ...groups.notes,
        ...groups.tasks,
        ...groups.projects,
        ...groups.tags,
      ].slice(0, TOTAL_CAP)

      // 🔮 The permanent last row: hand the query to Ask AI, already sent.
      items.push({
        key: 'ask',
        group: 'ask',
        label: q,
        run: () => askAiAsk(q),
      })
      return { items, markTerms }
    }
  }, [commands, corpus, tracker, projects, storeNotes, recents])

  const { items, markTerms } = useMemo(() => build(debounced), [build, debounced])

  useEffect(() => setActive(0), [query])
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, items])

  const run = (item: OmniItem | undefined) => {
    if (!item) return
    if (item.keepOpen) {
      item.run()
      return
    }
    saveRecent(query)
    closePalette()
    item.run()
  }

  /** Enter mustn't act on a stale (pre-debounce) list — flush synchronously. */
  const liveItems = () => (query === debounced ? items : build(query).items)

  return createPortal(
    <div
      className="overlay overlay-top"
      onPointerDown={(e) => e.target === e.currentTarget && closePalette()}
    >
      <div className="palette omnibar" role="dialog" aria-label="Omnibar" data-testid="omnibar">
        <input
          ref={inputRef}
          autoFocus
          className="palette-input"
          data-testid="omnibar-input"
          placeholder="Search everything — notes, tasks, commands…  (tag: path: is: when: “phrase”)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => (items.length === 0 ? 0 : (a + 1) % items.length))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) =>
                items.length === 0 ? 0 : (a - 1 + items.length) % items.length,
              )
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const list = liveItems()
              run(list[Math.min(active, list.length - 1)])
            } else if (e.key === 'Escape') {
              closePalette()
            }
          }}
        />
        <div className="palette-list" ref={listRef}>
          {items.length === 0 && (
            <div className="palette-empty">
              {corpus === null ? 'Reading the vault…' : 'No matches'}
            </div>
          )}
          {items.map((item, i) => {
            const prev = items[i - 1]
            const label = GROUP_LABELS[item.group]
            const showHeader = label && (!prev || prev.group !== item.group)
            return (
              <div key={item.key} className="omni-block">
                {showHeader && <div className="palette-group">{label}</div>}
                {item.group === 'ask' ? (
                  <button
                    className="palette-item palette-ask"
                    data-testid="omnibar-ask"
                    data-group="ask"
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(item)}
                  >
                    <span className="palette-icon" aria-hidden="true">🔮</span>
                    <span className="palette-label">
                      Ask the vault: <em>“{item.label}”</em>
                    </span>
                    <span className="palette-hint">↵ asks AI</span>
                  </button>
                ) : (
                  <button
                    className="palette-item"
                    data-group={item.group}
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(item)}
                  >
                    {item.dot ? (
                      <span className={`type-dot type-dot-${item.dot}`} aria-hidden="true" />
                    ) : (
                      <span className="palette-icon">
                        {item.icon ?? (item.group === 'recent' ? '↩' : <IconPage size={14} />)}
                      </span>
                    )}
                    <span className="omni-main">
                      <span className="omni-title-line">
                        <span className="palette-label">
                          <Highlighted text={item.label} terms={markTerms} />
                        </span>
                        {item.path && <span className="omni-path">{item.path}</span>}
                      </span>
                      {item.snippet && (
                        <span className="omni-snippet">
                          <Highlighted text={item.snippet} terms={markTerms} />
                        </span>
                      )}
                    </span>
                    {item.hint && <span className="palette-hint">{item.hint}</span>}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="palette-foot">
          <kbd>↑↓</kbd> navigate · <kbd>↵</kbd> open · <kbd>esc</kbd> close ·{' '}
          <span className="palette-foot-ops">tag: path: is: when: done: “phrase”</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
