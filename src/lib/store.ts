// Global session store: vault connection (OAuth or pasted token), note cache,
// write pipeline.
//
// Every write is human-initiated and goes through optimistic concurrency:
// the note's last-known updatedAt rides along as if_updated_at, and a 409
// triggers reload → reconcile → retry instead of clobbering. Writes to the
// same note are serialized so rapid edits can't race each other's
// preconditions.

import { useSyncExternalStore } from 'react'
import { VaultApi } from './api'
import { AuthManager, type AuthSession } from './auth'
import {
  beginOAuth,
  clearCachedClients,
  clearPending,
  completeOAuth,
  loadPending,
  normalizeVaultUrl,
  PendingApprovalError,
  resolveVaultUrl,
  storedFromTokenResponse,
} from './oauth'
import { slugify } from './format'
import { clearDraft } from './drafts'
import {
  VaultAuthError,
  VaultConflictError,
  type Note,
  type NoteMetadata,
  type TagInfo,
} from './types'
import { SCRIPTS_DB } from '../domain/scripts'
import { TRACKER_DB } from '../domain/tracker'
import { PROJECT_TAG } from '../domain/projects'
import { WEEK_REVIEW_RE } from '../domain/spine'
import { NEW_PAGE, newPageContent, TASK_TAG } from '../domain/pages'

// Storage keys are namespaced per-app. AdamVaultOS shares ONE origin with
// AtelierVaultOS on github.io (localStorage is keyed by origin, not by the
// /AdamVaultOS/ vs /AtelierVaultOS/ path), so a generic "atelier.*" key would
// let the two apps read each other's saved session and silently cross-wire
// vaults (Adam's app showing Jonathan's notes). The "adamvaultos." prefix keeps
// them fully isolated; we never read or write AtelierVaultOS's keys.
const SESSION_KEY = 'adamvaultos.session.v1'
const LEGACY_CONFIG_KEY = 'adamvaultos.vault' // v1 token-paste config, migrated on load
const LAST_URL_KEY = 'adamvaultos.lastVaultUrl'

export type ConnectionState = 'idle' | 'ok' | 'auth-error'

export interface ToastItem {
  id: number
  kind: 'success' | 'error' | 'info'
  text: string
  action?: { label: string; run: () => void }
}

export interface StoreState {
  session: AuthSession | null
  connection: ConnectionState
  /** A VaultAuthError escaped and auth hasn't recovered — drives the calm
   * "Session expired — your work is safe locally" banner. Cleared by any
   * successful request or a fresh sign-in. */
  authDead: boolean
  /** OAuth return in progress (exchanging the code). */
  oauthStatus: 'idle' | 'completing'
  oauthError: string | null
  /** Hub requires approval of this client — link the human must visit. */
  approveUrl: string | null
  /** Note cache keyed by vault path. */
  notes: Record<string, Note>
  /** Paths of the scripts dataset, in vault order. */
  scripts: string[] | null
  scriptsStatus: 'idle' | 'loading' | 'ready' | 'error'
  scriptsError: string | null
  /** Paths of the tracker (tasks) dataset, in vault order. */
  tracker: string[] | null
  trackerStatus: 'idle' | 'loading' | 'ready' | 'error'
  trackerError: string | null
  /** Paths of the project notes (tag:project) — the Cockpit's card deck. */
  projects: string[] | null
  projectsStatus: 'idle' | 'loading' | 'ready' | 'error'
  projectsError: string | null
  /** Paths of the pages dataset, newest-first. */
  pages: string[] | null
  pagesStatus: 'idle' | 'loading' | 'ready' | 'error'
  pagesError: string | null
  tags: TagInfo[]
  toasts: ToastItem[]
  /** Paths with an in-flight write (drives the saving pulse). */
  saving: Record<string, number>
}

/** Content diverged during a body edit — needs a human decision. */
export class ContentDivergedError extends Error {
  fresh: Note
  constructor(fresh: Note) {
    super('Note content changed in the vault while you were editing.')
    this.name = 'ContentDivergedError'
    this.fresh = fresh
  }
}

// ---------------------------------------------------------------------------
// Session persistence (+ migration from the v1 token-paste config)
// ---------------------------------------------------------------------------

function loadSavedSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AuthSession>
      if (parsed.vaultUrl && parsed.token?.accessToken) return parsed as AuthSession
    }
  } catch {
    /* fall through to legacy */
  }
  try {
    const legacy = localStorage.getItem(LEGACY_CONFIG_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy)
      if (typeof parsed?.url === 'string' && typeof parsed?.token === 'string') {
        const session: AuthSession = {
          vaultUrl: parsed.url,
          mode: 'token',
          token: { accessToken: parsed.token },
        }
        localStorage.setItem(SESSION_KEY, JSON.stringify(session))
        localStorage.removeItem(LEGACY_CONFIG_KEY)
        return session
      }
    }
  } catch {
    /* corrupted config — treat as signed out */
  }
  return null
}

function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function lastVaultUrl(): string | null {
  return localStorage.getItem(LAST_URL_KEY)
}

let api: VaultApi | null = null
let manager: AuthManager | null = null

let state: StoreState = {
  session: null,
  connection: 'idle',
  authDead: false,
  oauthStatus: 'idle',
  oauthError: null,
  approveUrl: null,
  notes: {},
  scripts: null,
  scriptsStatus: 'idle',
  scriptsError: null,
  tracker: null,
  trackerStatus: 'idle',
  trackerError: null,
  projects: null,
  projectsStatus: 'idle',
  projectsError: null,
  pages: null,
  pagesStatus: 'idle',
  pagesError: null,
  tags: [],
  toasts: [],
  saving: {},
}

const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function set(partial: Partial<StoreState>): void {
  state = { ...state, ...partial }
  emit()
}

export function getState(): StoreState {
  return state
}

export function useStore(): StoreState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

function requireApi(): VaultApi {
  if (!api) throw new Error('Vault is not connected')
  return api
}

function handleAuthFailure(e: unknown): void {
  if (e instanceof VaultAuthError) set({ connection: 'auth-error', authDead: true })
}

/** Any successful vault round-trip proves auth is alive again. */
function clearAuthDead(): void {
  if (state.authDead || state.connection === 'auth-error') {
    set({ authDead: false, connection: 'ok' })
  }
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

let toastSeq = 1

export function toast(
  kind: ToastItem['kind'],
  text: string,
  action?: ToastItem['action'],
): void {
  const item: ToastItem = { id: toastSeq++, kind, text, action }
  set({ toasts: [...state.toasts, item].slice(-4) })
}

export function dismissToast(id: number): void {
  set({ toasts: state.toasts.filter((t) => t.id !== id) })
}

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

// Cross-tab rotation transport: BroadcastChannel when available, with the
// storage event (fired by saveSession's localStorage write) as the fallback.
// Live sibling tabs adopt a rotation the moment it happens instead of waiting
// to trip a 401 with a dead token.
let authChannel: BroadcastChannel | null = null
let crossTabWired = false

function wireCrossTabAuth(): void {
  if (crossTabWired || typeof window === 'undefined') return
  crossTabWired = true
  try {
    authChannel = new BroadcastChannel('adamvaultos-auth')
    authChannel.onmessage = (e: MessageEvent) => {
      if ((e.data as { type?: string } | null)?.type === 'rotated') {
        manager?.adoptFromStorage()
      }
    }
  } catch {
    /* no BroadcastChannel — the storage-event fallback below still covers us */
  }
  window.addEventListener('storage', (e) => {
    if (e.key === SESSION_KEY && e.newValue) manager?.adoptFromStorage()
  })
}

function adoptSession(session: AuthSession): void {
  saveSession(session)
  wireCrossTabAuth()
  manager = new AuthManager(
    session,
    (rotated) => {
      // Persist every refresh-token rotation the moment it happens…
      saveSession(rotated)
      set({ session: rotated })
      // …and tell live sibling tabs to adopt it immediately.
      try {
        authChannel?.postMessage({ type: 'rotated' })
      } catch {
        /* channel closed — storage event already covered it */
      }
    },
    {
      // The persisted session is the cross-tab source of truth for tokens.
      loadPersisted: loadSavedSession,
      onAdopt: (adopted) => set({ session: adopted }),
    },
  )
  api = new VaultApi(manager)
  set({
    session,
    connection: 'ok',
    authDead: false,
    oauthError: null,
    approveUrl: null,
    scriptsStatus: 'idle',
    trackerStatus: 'idle',
    projectsStatus: 'idle',
    pages: null,
    pagesStatus: 'idle',
    notes: {},
  })
  void loadScripts()
  void loadTracker()
  void loadProjects()
  void loadTags()
}

/** Synchronous boot: restore a saved session (called before first render). */
export function init(): void {
  const session = loadSavedSession()
  if (session) adoptSession(session)
}

/**
 * Handle an OAuth return (?code&state or ?error) if one is present in the
 * URL. Mirrors the proven reference wiring: strip the params immediately so a
 * refresh doesn't re-run the exchange, then complete the code → token swap.
 */
export async function processOAuthReturn(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const oauthState = params.get('state')
  const hubError = params.get('error')
  if (!((code && oauthState) || hubError)) return

  const cleanUrl = window.location.origin + window.location.pathname
  window.history.replaceState(null, '', cleanUrl)

  if (hubError) {
    const description = params.get('error_description')
    set({ oauthError: `The hub returned: ${description || hubError}` })
    return
  }
  if (!loadPending()) {
    // Stale or bookmarked callback — init() already restored any saved session.
    return
  }

  set({ oauthStatus: 'completing', oauthError: null, approveUrl: null })
  try {
    const { pending, token } = await completeOAuth(code!, oauthState!)
    const vaultUrl = resolveVaultUrl(token, pending.issuerUrl)
    adoptSession({
      vaultUrl,
      mode: 'oauth',
      issuer: pending.issuer,
      tokenEndpoint: pending.tokenEndpoint,
      clientId: pending.clientId,
      token: storedFromTokenResponse(token),
    })
    set({ oauthStatus: 'idle' })
  } catch (e) {
    if (e instanceof PendingApprovalError) {
      set({ oauthStatus: 'idle', approveUrl: e.approveUrl })
    } else {
      set({
        oauthStatus: 'idle',
        oauthError: e instanceof Error ? e.message : String(e),
      })
    }
  }
}

/** Primary path: kick off the OAuth redirect dance. */
export async function startOAuth(vaultInput: string): Promise<void> {
  set({ oauthError: null, approveUrl: null })
  const url = normalizeVaultUrl(vaultInput)
  localStorage.setItem(LAST_URL_KEY, url)
  const authorizeUrl = await beginOAuth(url) // throws with a precise message
  window.location.assign(authorizeUrl)
}

/** Advanced path: paste a bearer token (kept from v1). */
export async function connectWithToken(url: string, token: string): Promise<void> {
  const vaultUrl = normalizeVaultUrl(url)
  const session: AuthSession = {
    vaultUrl,
    mode: 'token',
    token: { accessToken: token.trim() },
  }
  const probeManager = new AuthManager(session, () => {})
  await new VaultApi(probeManager).ping() // throws with a precise message
  localStorage.setItem(LAST_URL_KEY, vaultUrl)
  adoptSession(session)
}

/** Clears ALL stored auth: session, refresh material, pending flow, client ids. */
export function disconnect(): void {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(LEGACY_CONFIG_KEY)
  clearPending()
  clearCachedClients()
  api = null
  manager = null
  set({
    session: null,
    connection: 'idle',
    authDead: false,
    oauthStatus: 'idle',
    oauthError: null,
    approveUrl: null,
    notes: {},
    scripts: null,
    scriptsStatus: 'idle',
    scriptsError: null,
    tracker: null,
    trackerStatus: 'idle',
    trackerError: null,
    projects: null,
    projectsStatus: 'idle',
    projectsError: null,
    pages: null,
    pagesStatus: 'idle',
    pagesError: null,
    tags: [],
  })
}

export function dismissOAuthNotices(): void {
  set({ oauthError: null, approveUrl: null })
}

// ---------------------------------------------------------------------------
// Note cache
// ---------------------------------------------------------------------------

/** Merge a server note into the cache, preserving cached content when the
 * incoming shape is lean and the note hasn't moved on. */
function mergeNote(incoming: Note): Note {
  const prev = state.notes[incoming.path]
  let next = incoming
  if (
    prev?.content !== undefined &&
    incoming.content === undefined &&
    prev.updatedAt === incoming.updatedAt
  ) {
    next = { ...incoming, content: prev.content }
  }
  state = { ...state, notes: { ...state.notes, [incoming.path]: next } }
  emit()
  clearAuthDead() // a note arrived — the session is provably alive
  return next
}

function mergeNotes(incoming: Note[]): void {
  const notes = { ...state.notes }
  for (const n of incoming) {
    const prev = notes[n.path]
    notes[n.path] =
      prev?.content !== undefined &&
      n.content === undefined &&
      prev.updatedAt === n.updatedAt
        ? { ...n, content: prev.content }
        : n
  }
  set({ notes })
  clearAuthDead() // notes arrived — the session is provably alive
}

export async function loadScripts(): Promise<void> {
  if (!api || state.scriptsStatus === 'loading') return
  set({ scriptsStatus: 'loading', scriptsError: null })
  try {
    const list = await requireApi().listByPrefix(SCRIPTS_DB.pathPrefix)
    mergeNotes(list)
    set({
      scripts: list.map((n) => n.path),
      scriptsStatus: 'ready',
    })
  } catch (e) {
    handleAuthFailure(e)
    set({
      scriptsStatus: 'error',
      scriptsError: e instanceof Error ? e.message : String(e),
    })
  }
}

export async function loadTracker(): Promise<void> {
  if (!api || state.trackerStatus === 'loading') return
  set({ trackerStatus: 'loading', trackerError: null })
  try {
    // WITH content: task bodies are one-liners and become the row titles.
    const list = await requireApi().listByPrefix(TRACKER_DB.pathPrefix, 500, true)
    mergeNotes(list)
    set({
      tracker: list.map((n) => n.path),
      trackerStatus: 'ready',
    })
  } catch (e) {
    handleAuthFailure(e)
    set({
      trackerStatus: 'error',
      trackerError: e instanceof Error ? e.message : String(e),
    })
  }
}

export async function loadProjects(): Promise<void> {
  if (!api || state.projectsStatus === 'loading') return
  set({ projectsStatus: 'loading', projectsError: null })
  try {
    // WITH content — project notes are small and their H1/body feed the cards
    // and the world Overview fallback.
    const list = await requireApi().listByTag(PROJECT_TAG, 100, true)
    mergeNotes(list)
    set({ projects: list.map((n) => n.path), projectsStatus: 'ready' })
  } catch (e) {
    handleAuthFailure(e)
    set({
      projectsStatus: 'error',
      projectsError: e instanceof Error ? e.message : String(e),
    })
  }
}

/** Weekly cards (THE SYSTEM's heartbeat mint): notes at
 * projects/<key>/weekly/YYYY-MM-DD, fetched WITH content — the Priority
 * paragraph and Top 3 task list ARE the card. One prefix fetch covers a
 * single world (`projects/<key>/weekly/`) or every world's card stream at
 * once (the default `projects/`). */
export async function fetchWeeklyCards(prefix = 'projects/'): Promise<Note[]> {
  try {
    const list = await requireApi().listByPrefix(prefix, 500, true)
    const cards = list.filter((n) =>
      /^projects\/.+\/weekly\/\d{4}-\d{2}-\d{2}$/.test(n.path),
    )
    mergeNotes(cards)
    return cards
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/** The latest weekly REVIEW — desk/weekly/YYYY-MM-DD, the whole-week mint
 * (dated paths only; the template beside them never counts). Greatest date
 * wins; fetched WITH content so the Projects page can whisper its Top 3. */
export async function fetchLatestWeeklyReview(): Promise<Note | null> {
  try {
    const list = await requireApi().listByPrefix('desk/weekly/', 100, true)
    let best: Note | null = null
    for (const n of list) {
      if (!WEEK_REVIEW_RE.test(n.path)) continue
      if (!best || n.path > best.path) best = n
    }
    if (best) mergeNote(best)
    return best
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/** Lean notes carrying a project's knowledge tag (the world's Notes section).
 * Tasks are excluded — they live on the world's Board, not among the notes. */
export async function fetchProjectNotes(tag: string): Promise<Note[]> {
  try {
    const list = (await requireApi().listByTag(tag, 500)).filter(
      (n) => !(n.tags ?? []).includes(TASK_TAG),
    )
    mergeNotes(list)
    return [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/** Create a task inside a project's world: tasks/<key>/<slug>, tagged `task`,
 * carrying the tracker defaults. Returns the note (caller opens row-as-page).
 * A null projectKey mints a PROJECT-LESS task under tasks/inbox/ — `project`
 * stays unset, so it shows in the Tracker's All view but claims no world.
 * `extra` metadata (e.g. when:"today" from the Today picker) wins over the
 * defaults. */
export async function createTask(
  projectKey: string | null,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<Note> {
  const a = requireApi()
  const folder = projectKey || 'inbox'
  const slug = slugify(title) || 'task'
  let path = `tasks/${folder}/${slug}`
  for (let n = 2; (await a.getNote(path)) !== null; n++) {
    path = `tasks/${folder}/${slug}-${n}`
    if (n > 30) throw new Error('Could not find a free path for this task')
  }
  try {
    const note = await a.createNote({
      path,
      content: title.trim(),
      tags: [TASK_TAG],
      metadata: {
        ...(projectKey ? { project: projectKey } : {}),
        state: 'next',
        done: false,
        ...extra,
      },
    })
    mergeNote(note)
    if (state.tracker && !state.tracker.includes(note.path)) {
      set({ tracker: [...state.tracker, note.path] })
    }
    return note
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/**
 * Create a project (a `project`-tagged note under projects/). The Cockpit
 * caps the deck at 6 — a deliberate constraint so the front door stays calm —
 * enforced here as well as in the UI.
 */
export async function createProject(name: string): Promise<Note> {
  const a = requireApi()
  if ((state.projects?.length ?? 0) >= 6) {
    throw new Error('The Cockpit holds 6 projects max — finish or park one first.')
  }
  const slug = slugify(name) || 'project'
  let path = `projects/${slug}`
  for (let n = 2; (await a.getNote(path)) !== null; n++) {
    path = `projects/${slug}-${n}`
    if (n > 30) throw new Error('Could not find a free path for this project')
  }
  const order =
    Math.max(
      0,
      ...(state.projects ?? []).map((p) => {
        const v = state.notes[p]?.metadata['order']
        return typeof v === 'number' ? v : 0
      }),
    ) + 1
  try {
    const note = await a.createNote({
      path,
      content: `# ${name.trim()}\n`,
      tags: ['project'],
      metadata: { type: 'project', key: slug, tag: slug, status: 'active', order, summary: '' },
    })
    mergeNote(note)
    set({ projects: [...(state.projects ?? []), note.path] })
    return note
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/**
 * F1a — auto-slug: once an `pages/untitled-N` placeholder gets a real title,
 * its path follows (pages/<slug-of-title>). Only ever fires on untitled
 * placeholders — a brand-new page has no inbound links, so the rename is
 * risk-free. Returns the renamed note, or null when no rename applies.
 */
export async function renameUntitledPage(
  oldPath: string,
  title: string,
  ifUpdatedAt: string,
): Promise<Note | null> {
  if (!/^pages\/untitled(-\d+)?$/.test(oldPath)) return null
  const a = requireApi()
  const slug = slugify(title)
  if (!slug || slug.startsWith('untitled')) return null
  let target = `${NEW_PAGE.pathPrefix}${slug}`
  for (let n = 2; (await a.getNote(target)) !== null; n++) {
    target = `${NEW_PAGE.pathPrefix}${slug}-${n}`
    if (n > 30) return null
  }
  try {
    const renamed = await a.updateNote(oldPath, { path: target, ifUpdatedAt })
    const notes = { ...state.notes }
    delete notes[oldPath]
    notes[renamed.path] = renamed
    set({
      notes,
      pages: (state.pages ?? []).map((p) => (p === oldPath ? renamed.path : p)),
    })
    return renamed
  } catch (e) {
    handleAuthFailure(e)
    return null // rename is best-effort; the save itself already succeeded
  }
}

/** All-vault lean note list for link targets ([[ autocomplete, Link picker).
 * Cached briefly so every keystroke doesn't refetch; 743 notes is nothing to
 * filter client-side. */
let linkTargetsCache: { at: number; list: Note[] } | null = null

export async function fetchLinkTargets(): Promise<Note[]> {
  if (linkTargetsCache && Date.now() - linkTargetsCache.at < 60_000) {
    return linkTargetsCache.list
  }
  try {
    const list = await requireApi().listAll({ limit: 2000 })
    linkTargetsCache = { at: Date.now(), list }
    return list
  } catch (e) {
    handleAuthFailure(e)
    // A stale cache beats an empty menu mid-typing.
    return linkTargetsCache?.list ?? []
  }
}

/** F1b — move/re-file a note to a new path. The CALLER is responsible for the
 * inbound-link guard (fetchNoteLinks) and any [[old]]→[[new]] rewrites; this
 * just performs the rename and re-keys every store slice that indexes by path. */
export async function movePage(
  oldPath: string,
  newPath: string,
  ifUpdatedAt: string,
): Promise<Note> {
  const a = requireApi()
  if ((await a.getNote(newPath)) !== null) {
    throw new Error(`A note already lives at ${newPath}`)
  }
  try {
    const moved = await a.updateNote(oldPath, { path: newPath, ifUpdatedAt })
    const notes = { ...state.notes }
    delete notes[oldPath]
    notes[moved.path] = moved
    const rekey = (list: string[] | null) =>
      list ? list.map((p) => (p === oldPath ? moved.path : p)) : list
    set({
      notes,
      pages: rekey(state.pages),
      tracker: rekey(state.tracker),
      projects: rekey(state.projects),
    })
    linkTargetsCache = null
    return moved
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/** Rewrite `[[oldPath]]` / `[[oldPath|alias]]` to the new path inside one
 * linking note. Returns true if the note changed. Best-effort per note — the
 * caller reports how many succeeded. */
export async function rewriteLinksIn(
  linkerPath: string,
  oldPath: string,
  newPath: string,
): Promise<boolean> {
  const a = requireApi()
  const note = await a.getNote(linkerPath)
  const content = note?.content
  if (!note || typeof content !== 'string') return false
  const esc = oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\[\\[${esc}(\\|[^\\]\\n]*)?\\]\\]`, 'g')
  const next = content.replace(re, (_m, alias: string | undefined) =>
    `[[${newPath}${alias ?? ''}]]`,
  )
  if (next === content) return false
  const updated = await a.updateNote(linkerPath, {
    content: next,
    ifUpdatedAt: note.updatedAt,
  })
  mergeNote(updated)
  return true
}

// ---------------------------------------------------------------------------
// Today layer (PART 25) — the now-surface. `desk/current` is a tiny pointer
// note whose metadata.target = "what Adam is working on RIGHT NOW"; the daily
// note lives at desk/<yyyy-mm-dd>; today's to-dos are tasks with when:"today".
// ---------------------------------------------------------------------------

const CURRENT_PATH = 'desk/current'

export async function fetchCurrentTarget(): Promise<string | null> {
  try {
    const n = await requireApi().getNote(CURRENT_PATH)
    const t = n?.metadata['target']
    return typeof t === 'string' && t ? t : null
  } catch (e) {
    handleAuthFailure(e)
    return null
  }
}

export async function setCurrentNote(targetPath: string): Promise<void> {
  const a = requireApi()
  try {
    const existing = await a.getNote(CURRENT_PATH)
    if (!existing) {
      const note = await a.createNote({
        path: CURRENT_PATH,
        content: '# Current\n\nPointer to what Adam is working on right now.',
        tags: ['desk'],
        metadata: { type: 'note', target: targetPath },
      })
      mergeNote(note)
    } else {
      await mutateNote(CURRENT_PATH, () => ({ metadata: { target: targetPath } }))
    }
    toast('success', 'Pinned as current 📍')
  } catch (e) {
    handleAuthFailure(e)
    toast('error', `Couldn’t pin — ${e instanceof Error ? e.message : e}`)
  }
}

/** Local date key — the daily note follows Adam's clock, not UTC. */
export function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Open (create if needed) today's daily note; returns its path. */
export async function ensureTodayNote(): Promise<string> {
  const a = requireApi()
  const path = `desk/${todayKey()}`
  const existing = await a.getNote(path)
  if (existing) {
    mergeNote(existing)
    return path
  }
  const title = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const note = await a.createNote({
    path,
    content: `# ${title}\n\n`,
    tags: ['desk'],
    metadata: { type: 'note', summary: `Daily note — ${title}.` },
  })
  mergeNote(note)
  if (state.pages && !state.pages.includes(note.path)) {
    set({ pages: [note.path, ...state.pages] })
  }
  return path
}

/** Dock Pad "⤢ Open as doc" (#15 remnant): the jot graduates from ephemeral
 * localStorage into TODAY's daily note (appended), where it's backed up,
 * searchable, and linkable. Returns the daily note's path for navigation. */
export async function promotePadToToday(text: string): Promise<string> {
  const a = requireApi()
  const path = await ensureTodayNote()
  const fresh = await a.getNote(path)
  if (!fresh) throw new Error('daily note vanished mid-promote')
  const body = (fresh.content ?? '').replace(/\s+$/, '')
  const updated = await a.updateNote(path, {
    content: `${body}\n\n${text.trim()}\n`,
    ifUpdatedAt: fresh.updatedAt,
  })
  mergeNote(updated)
  return path
}

/** Promote a task onto today's list (when:"today") or send it back to later. */
export async function setTaskToday(path: string, on: boolean): Promise<boolean> {
  return setMetadata(
    path,
    { when: on ? 'today' : 'later' },
    { undo: { when: on ? 'later' : 'today' } },
  )
}

// ---------------------------------------------------------------------------
// Work docs (W1, build log PART 30) — Google-Docs-style tabbed workspaces.
// A WORKSPACE is a spot under desk/: the daily note (desk/<date>) or a
// project's doc folder (desk/<project-key>). TABS are its sub-notes
// (desk/<x>/<tab>), plus the root note itself when it exists.
// ---------------------------------------------------------------------------

/** The workspace root for a path under desk/, else null. */
export function workspaceRootFor(path: string): string | null {
  if (!path.startsWith('desk/')) return null
  const segs = path.split('/')
  if (segs.length < 2 || !segs[1]) return null
  return `desk/${segs[1]}`
}

/** A tab's persisted rail position: metadata.tab_order when it's a finite
 * number (written 10-spaced — 10, 20, 30… — so later inserts don't cascade
 * rewrites), else null. */
function tabOrderOf(n: Note): number | null {
  const v = n.metadata?.tab_order
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Rail order: tabs carrying tab_order first (ascending), then the rest in
 * creation order — a stable mix, so vaults from before the reorder feature
 * (or tabs minted elsewhere) keep their familiar Google-Docs order. */
export function sortWorkTabs(children: Note[]): Note[] {
  const byCreated = [...children].sort((x, y) => (x.createdAt < y.createdAt ? -1 : 1))
  const ordered = byCreated.filter((n) => tabOrderOf(n) !== null)
  const rest = byCreated.filter((n) => tabOrderOf(n) === null)
  ordered.sort((a, b) => tabOrderOf(a)! - tabOrderOf(b)!) // stable → created-at tiebreak
  return [...ordered, ...rest]
}

export async function fetchWorkspaceTabs(
  root: string,
): Promise<{ root: Note | null; children: Note[] }> {
  const a = requireApi()
  try {
    const [rootNote, children] = await Promise.all([
      a.getNote(root),
      a.listByPrefix(`${root}/`),
    ])
    if (rootNote) mergeNote(rootNote)
    mergeNotes(children)
    return { root: rootNote, children: sortWorkTabs(children) }
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/** Persist a rail reorder: stamp 10-spaced metadata.tab_order onto the
 * sibling tabs in their new order. Every write funnels through setMetadata —
 * the store's conflict-safe merge patch — and notes already holding the
 * right value are skipped, so an unchanged tail costs nothing. */
export async function persistTabOrder(orderedPaths: string[]): Promise<boolean> {
  const writes: Promise<boolean>[] = []
  orderedPaths.forEach((p, i) => {
    const want = (i + 1) * 10
    if (state.notes[p]?.metadata?.tab_order !== want) {
      writes.push(setMetadata(p, { tab_order: want }, { silent: true }))
    }
  })
  return (await Promise.all(writes)).every(Boolean)
}

/** Add a tab (sub-note) to a workspace; returns the new note. */
export async function createWorkTab(root: string, title: string): Promise<Note> {
  const a = requireApi()
  const slug = slugify(title) || 'tab'
  let path = `${root}/${slug}`
  for (let n = 2; (await a.getNote(path)) !== null; n++) {
    path = `${root}/${slug}-${n}`
    if (n > 30) throw new Error('Could not find a free path for this tab')
  }
  // A new tab lands at the END of the rail. When every sibling already has a
  // tab_order, appending means max+10; in a mixed/legacy rail the unordered
  // group sorts by creation anyway, so the newest note is last without one.
  const metadata: NoteMetadata = { type: 'note' }
  const siblings = await a.listByPrefix(`${root}/`)
  const orders = siblings.map(tabOrderOf)
  if (siblings.length > 0 && orders.every((o) => o !== null)) {
    metadata.tab_order = Math.max(...(orders as number[])) + 10
  }
  try {
    const note = await a.createNote({
      path,
      content: `# ${title.trim()}\n\n`,
      tags: ['desk'],
      metadata,
    })
    mergeNote(note)
    if (state.pages && !state.pages.includes(note.path)) {
      set({ pages: [note.path, ...state.pages] })
    }
    return note
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

export async function loadTags(): Promise<void> {
  if (!api) return
  try {
    set({ tags: await requireApi().listTags() })
  } catch (e) {
    handleAuthFailure(e)
  }
}

export async function searchVault(query: string): Promise<Note[]> {
  try {
    const results = await requireApi().search(query)
    mergeNotes(results)
    return results
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/** Search the vault WITH note bodies — the retrieval step for the /ai block's
 * client-side RAG grounding. Reuses the active authenticated session. */
export async function searchVaultContext(
  query: string,
  limit = 50,
): Promise<Note[]> {
  try {
    const results = await requireApi().searchWithContent(query, limit)
    mergeNotes(results)
    return results
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/** Most-linked notes WITH bodies — baseline context for the /ai block, so a
 * vague query still has the vault's hub notes to ground against. */
export async function mostLinkedContext(limit = 20): Promise<Note[]> {
  try {
    const results = await requireApi().mostLinkedWithContent(limit)
    mergeNotes(results)
    return results
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/** Absolute URL for a vault storage asset (image) path like `/api/storage/...`. */
export function vaultAssetUrl(relPath: string): string {
  return requireApi().assetUrl(relPath)
}

/** Auth-safe object URL for a vault storage asset. Caller must revoke it. */
export function fetchVaultAsset(relPath: string): Promise<string> {
  return requireApi().fetchAssetObjectUrl(relPath)
}

/** Upload a file to vault storage → `{ path, size, mimeType }`. */
export function uploadImage(
  file: File,
  signal?: AbortSignal,
): Promise<{ path: string; size: number; mimeType: string }> {
  return requireApi().uploadStorageFile(file, signal)
}

/** Attach an uploaded storage file to a note (shows in its Attachments). */
export function linkNoteAttachment(
  noteId: string,
  path: string,
  mimeType: string,
): Promise<void> {
  return requireApi().linkAttachment(noteId, path, mimeType)
}

export async function recentNotes(): Promise<Note[]> {
  try {
    const results = await requireApi().listRecent()
    mergeNotes(results)
    return results
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/** Every note WITH content — the Library browser loads this once for its tag
 * rail and instant client-side full-text search (title + path + tags + body). */
export async function fetchAllNotes(): Promise<Note[]> {
  try {
    const results = await requireApi().listAllWithContent()
    mergeNotes(results)
    return results
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

export async function fetchGraphNotes(): Promise<Note[]> {
  try {
    const results = await requireApi().graphNotes()
    // Warm the note cache (lean shapes) so clicking a node opens fast.
    mergeNotes(results)
    return results
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

export async function fetchNote(
  path: string,
  opts: { refresh?: boolean } = {},
): Promise<Note | null> {
  const cached = state.notes[path]
  if (!opts.refresh && cached?.content !== undefined) return cached
  try {
    const note = await requireApi().getNote(path)
    if (!note) return null
    return mergeNote(note)
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

// ---------------------------------------------------------------------------
// Writes — serialized per note, conflict-reconciled
// ---------------------------------------------------------------------------

const writeQueue = new Map<string, Promise<unknown>>()

function markSaving(path: string, delta: number): void {
  const count = (state.saving[path] ?? 0) + delta
  const saving = { ...state.saving }
  if (count <= 0) delete saving[path]
  else saving[path] = count
  set({ saving })
}

/** Serialize writes per path so OC preconditions never race each other. */
function enqueue<T>(path: string, job: () => Promise<T>): Promise<T> {
  const prev = writeQueue.get(path) ?? Promise.resolve()
  const next = prev.then(job, job)
  writeQueue.set(
    path,
    next.catch(() => {}),
  )
  return next
}

type PatchOf = Pick<
  Parameters<VaultApi['updateNote']>[1],
  'content' | 'metadata' | 'tags'
>

/**
 * Core conflict-reconciling write. `makePatch` derives the patch from the
 * freshest known note, so on a 409 the intent is re-applied to the live
 * note rather than blindly retried. A second consecutive conflict bubbles.
 * `baseOverride` lets callers pin the pre-optimistic note as the first
 * attempt's base (diffs must never be computed against their own optimism).
 */
async function mutateNote(
  path: string,
  makePatch: (base: Note) => PatchOf | null,
  baseOverride?: Note,
): Promise<Note> {
  return enqueue(path, async () => {
    markSaving(path, 1)
    try {
      const base = baseOverride ?? state.notes[path] ?? (await fetchNote(path))
      if (!base) throw new Error(`Note not found: ${path}`)
      let patch = makePatch(base)
      if (!patch) return base
      try {
        const updated = await requireApi().updateNote(path, {
          ...patch,
          ifUpdatedAt: base.updatedAt,
        })
        return mergeNote(updated)
      } catch (e) {
        if (!(e instanceof VaultConflictError)) throw e
        // Reload → reconcile → retry once.
        const fresh = await requireApi().getNote(path)
        if (!fresh) throw new Error(`Note disappeared: ${path}`)
        mergeNote(fresh)
        patch = makePatch(fresh)
        if (!patch) return fresh
        const updated = await requireApi().updateNote(path, {
          ...patch,
          ifUpdatedAt: fresh.updatedAt,
        })
        return mergeNote(updated)
      }
    } catch (e) {
      handleAuthFailure(e)
      throw e
    } finally {
      markSaving(path, -1)
    }
  })
}

/**
 * Metadata-only write (table cells, board moves, property chips). Only the
 * changed keys are sent; the vault merges them server-side. Optimistic UI
 * with revert + toast on failure.
 */
export async function setMetadata(
  path: string,
  patch: NoteMetadata,
  opts: { undo?: NoteMetadata; silent?: boolean } = {},
): Promise<boolean> {
  const before = state.notes[path]
  if (before) {
    mergeNote({ ...before, metadata: { ...before.metadata, ...patch } })
  }
  try {
    await mutateNote(path, () => ({ metadata: patch }))
    if (!opts.silent && opts.undo) {
      const undoPatch = opts.undo
      toast('success', describeMetadataPatch(patch), {
        label: 'Undo',
        run: () => void setMetadata(path, undoPatch, { silent: true }),
      })
    }
    return true
  } catch (e) {
    if (before) mergeNote(before)
    toast('error', `Couldn’t save — ${e instanceof Error ? e.message : e}`)
    return false
  }
}

function describeMetadataPatch(patch: NoteMetadata): string {
  const entries = Object.entries(patch)
  if (entries.length === 1) {
    const [k, v] = entries[0]!
    return `${k} → ${String(v)}`
  }
  return 'Saved to vault'
}

/** Full-replace tag edit, expressed to the vault as an add/remove diff. */
export async function replaceTags(
  path: string,
  nextTags: string[],
): Promise<boolean> {
  const target = [...new Set(nextTags)]
  const before = state.notes[path]
  if (before) mergeNote({ ...before, tags: target })
  try {
    await mutateNote(
      path,
      (base) => {
        const current = new Set(base.tags)
        const wanted = new Set(target)
        const add = target.filter((t) => !current.has(t))
        const remove = base.tags.filter((t) => !wanted.has(t))
        if (add.length === 0 && remove.length === 0) return null
        return { tags: { add, remove } }
      },
      // Diff against the pre-optimistic note, never our own optimism.
      before,
    )
    return true
  } catch (e) {
    if (before) mergeNote(before)
    toast('error', `Couldn’t save tags — ${e instanceof Error ? e.message : e}`)
    return false
  }
}

/**
 * Body save. On conflict: if only metadata/tags moved (content identical to
 * our editing base) the save is replayed onto the live note; if the content
 * itself diverged, surface a ContentDivergedError for a human decision.
 */
export async function saveContent(
  path: string,
  content: string,
  base: { updatedAt: string; content: string },
): Promise<Note> {
  return enqueue(path, async () => {
    markSaving(path, 1)
    try {
      try {
        const updated = await requireApi().updateNote(path, {
          content,
          ifUpdatedAt: base.updatedAt,
        })
        clearDraft(path) // the buffer made it to the vault — no stash needed
        return mergeNote(updated)
      } catch (e) {
        if (!(e instanceof VaultConflictError)) throw e
        const fresh = await requireApi().getNote(path)
        if (!fresh) throw new Error(`Note disappeared: ${path}`)
        mergeNote(fresh)
        if ((fresh.content ?? '') !== base.content) {
          throw new ContentDivergedError(fresh)
        }
        const updated = await requireApi().updateNote(path, {
          content,
          ifUpdatedAt: fresh.updatedAt,
        })
        clearDraft(path)
        return mergeNote(updated)
      }
    } catch (e) {
      handleAuthFailure(e)
      throw e
    } finally {
      markSaving(path, -1)
    }
  })
}

/**
 * Tier 2 — the verb-gated widgets' write primitive. Re-fetch the note fresh,
 * hand its exact lines to `mutate` (which changes or inserts ONLY the lines
 * it means to and throws when its target vanished), and save through the
 * conflict-safe saveContent flow (optimistic concurrency against the fresh
 * updatedAt). The doc is never regenerated or re-serialized — every byte the
 * mutation didn't touch survives. Returning the lines unchanged is a no-op.
 */
export async function surgicalLineEdit(
  path: string,
  mutate: (lines: string[]) => string[],
): Promise<Note> {
  const fresh = await fetchNote(path, { refresh: true })
  if (!fresh || fresh.content === undefined) {
    throw new Error(`${path} is missing from the vault`)
  }
  const next = mutate(fresh.content.split('\n')).join('\n')
  if (next === fresh.content) return fresh
  return saveContent(path, next, {
    updatedAt: fresh.updatedAt,
    content: fresh.content,
  })
}

/** Explicit human overwrite after reviewing a content conflict. */
export async function forceContent(
  path: string,
  content: string,
  liveUpdatedAt: string,
): Promise<Note> {
  return enqueue(path, async () => {
    markSaving(path, 1)
    try {
      const updated = await requireApi().updateNote(path, {
        content,
        ifUpdatedAt: liveUpdatedAt,
      })
      clearDraft(path)
      return mergeNote(updated)
    } catch (e) {
      handleAuthFailure(e)
      throw e
    } finally {
      markSaving(path, -1)
    }
  })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createScript(input: {
  title: string
  body: string
  metadata: NoteMetadata
}): Promise<Note> {
  const a = requireApi()
  const slug = slugify(input.title) || 'untitled'
  const prefix = SCRIPTS_DB.newNote.pathPrefix
  let path = `${prefix}${slug}`
  for (let n = 2; (await a.getNote(path)) !== null; n++) {
    path = `${prefix}${slug}-${n}`
    if (n > 30) throw new Error('Could not find a free path for this title')
  }
  const heading = input.title.trim()
  const body = input.body.trim()
  const content = body ? `# ${heading}\n\n${body}\n` : `# ${heading}\n`
  try {
    const note = await a.createNote({
      path,
      content,
      tags: SCRIPTS_DB.newNote.tags,
      metadata: { ...SCRIPTS_DB.newNote.metadata, ...input.metadata },
    })
    mergeNote(note)
    if (state.scripts && !state.scripts.includes(note.path)) {
      set({ scripts: [...state.scripts, note.path] })
    }
    return note
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

// ---------------------------------------------------------------------------
// Pages — the block editor over ALL of Adam's real notes (the knowledge
// layer). The sidebar lists every note in the vault EXCEPT the productivity
// layer (tag:task); creation still mints freeform notes under pages/.
// ---------------------------------------------------------------------------

export async function loadPages(): Promise<void> {
  if (!api || state.pagesStatus === 'loading') return
  set({ pagesStatus: 'loading', pagesError: null })
  try {
    // Server-side excludes tag:task; the client-side filter is a backstop in
    // case a deployment ignores the param, so a task can never leak into Pages.
    const list = (await requireApi().listAll({ excludeTags: [TASK_TAG] })).filter(
      (n) => !(n.tags ?? []).includes(TASK_TAG),
    )
    mergeNotes(list)
    const sorted = [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    set({ pages: sorted.map((n) => n.path), pagesStatus: 'ready' })
  } catch (e) {
    handleAuthFailure(e)
    set({
      pagesStatus: 'error',
      pagesError: e instanceof Error ? e.message : String(e),
    })
  }
}

export async function createPage(input: {
  title: string
  /** Extra tags stamped on creation — e.g. a project's knowledge tag when the
   * page is born inside a Cockpit world. */
  extraTags?: string[]
}): Promise<Note> {
  const a = requireApi()
  const slug = slugify(input.title) || 'untitled'
  const prefix = NEW_PAGE.pathPrefix
  let path = `${prefix}${slug}`
  for (let n = 2; (await a.getNote(path)) !== null; n++) {
    path = `${prefix}${slug}-${n}`
    if (n > 30) throw new Error('Could not find a free path for this title')
  }
  try {
    const note = await a.createNote({
      path,
      content: newPageContent(input.title),
      tags: [...new Set([...NEW_PAGE.tags, ...(input.extraTags ?? [])])],
      metadata: { ...NEW_PAGE.metadata },
    })
    mergeNote(note)
    // Newest-first in the sidebar.
    set({
      pages: [note.path, ...(state.pages ?? []).filter((p) => p !== note.path)],
    })
    return note
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/**
 * Create a note at an EXACT path — for app-owned convention notes (e.g. the
 * desk/shelves layout note) where the path is the contract, so no slug hunt.
 * A 409 (someone else created it first) bubbles to the caller, whose next
 * read picks up the winner.
 */
export async function createNoteAt(
  path: string,
  content: string,
  tags: string[] = [],
  metadata: NoteMetadata = {},
): Promise<Note> {
  const a = requireApi()
  try {
    const note = await a.createNote({ path, content, tags, metadata })
    mergeNote(note)
    if (state.pages && !state.pages.includes(note.path)) {
      set({ pages: [note.path, ...state.pages] })
    }
    return note
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/**
 * Quick capture — drop a raw thought straight into the vault, tagged
 * `capture/quick`. Stays raw (the inbox layer); filed/synthesized later. Powers
 * the global CaptureDock.
 */
export async function createCapture(text: string): Promise<Note> {
  const a = requireApi()
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  let path = `capture/${stamp}`
  for (let n = 2; (await a.getNote(path)) !== null; n++) {
    path = `capture/${stamp}-${n}`
    if (n > 30) break
  }
  try {
    const note = await a.createNote({
      path,
      content: text.trim(),
      tags: ['capture/quick'],
      metadata: {},
    })
    mergeNote(note)
    return note
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

// ---------------------------------------------------------------------------
// Backlinks — the link graph around one note (#10). Real [[wikilinks]] register
// vault edges; this reads them so a note can show what it CITES (outgoing) and
// what CITES it (incoming). One request — the vault hydrates both endpoints.
// ---------------------------------------------------------------------------

export interface LinkedNote {
  path: string
  relationship: string
  tags: string[]
  metadata: NoteMetadata
}

function toLinked(ep: { path: string; tags?: string[]; metadata?: NoteMetadata }, rel: string): LinkedNote {
  return { path: ep.path, relationship: rel, tags: ep.tags ?? [], metadata: ep.metadata ?? {} }
}

export async function fetchNoteLinks(
  path: string,
): Promise<{ outgoing: LinkedNote[]; incoming: LinkedNote[] }> {
  const anchor = await requireApi().getNoteWithLinks(path)
  const id = anchor?.id
  const links = anchor?.links ?? []
  const outgoing: LinkedNote[] = []
  const incoming: LinkedNote[] = []
  const seenOut = new Set<string>()
  const seenIn = new Set<string>()
  for (const l of links) {
    if (id && l.sourceId === id && l.targetNote) {
      const t = l.targetNote
      if (t.path && t.path !== path && !seenOut.has(t.path)) {
        seenOut.add(t.path)
        outgoing.push(toLinked(t, l.relationship))
      }
    } else if (id && l.targetId === id && l.sourceNote) {
      const s = l.sourceNote
      if (s.path && s.path !== path && !seenIn.has(s.path)) {
        seenIn.add(s.path)
        incoming.push(toLinked(s, l.relationship))
      }
    }
  }
  return { outgoing, incoming }
}

// ---------------------------------------------------------------------------
// Canvas layer — freeform boards. Each board and each card is a real vault note
// under `canvas/`, tagged `canvas` (excluded from the knowledge graph like
// tasks). A board is `canvas/<id>`; its cards are `canvas/<id>/<cardId>`, with
// position/size carried in metadata (x/y/w/h). Nothing is auto-written — every
// drag/resize/edit is an explicit user action.
// ---------------------------------------------------------------------------

const CANVAS_PREFIX = 'canvas/'

function slugStamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

/** Load every canvas note (boards + cards) in one lean pass, WITH content
 * (cards are tiny) so the board renders immediately without per-card fetches. */
export async function loadCanvasNotes(): Promise<Note[]> {
  try {
    const list = await requireApi().listByPrefix(CANVAS_PREFIX)
    // listByPrefix is content-lean. Board titles live in metadata (no body
    // needed); only card bodies must be hydrated to render their markdown.
    const withContent = await Promise.all(
      list.map(async (n) => {
        if (n.metadata?.['ckind'] !== 'card' || n.content !== undefined) return n
        const full = await requireApi().getNote(n.path)
        return full ?? n
      }),
    )
    mergeNotes(withContent)
    return withContent
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

export async function createCanvasBoard(title: string): Promise<Note> {
  const a = requireApi()
  const base = `${CANVAS_PREFIX}${slugStamp()}`
  let path = base
  for (let n = 2; (await a.getNote(path)) !== null; n++) {
    path = `${base}-${n}`
    if (n > 30) break
  }
  try {
    const note = await a.createNote({
      path,
      content: title.trim() || 'Untitled canvas',
      tags: ['canvas'],
      metadata: { ckind: 'board', title: title.trim() || 'Untitled canvas' },
    })
    mergeNote(note)
    return note
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

export async function createCanvasCard(
  boardId: string,
  card: { x: number; y: number; w: number; h: number; content?: string },
): Promise<Note> {
  const a = requireApi()
  const cardId = `${slugStamp()}-${Math.random().toString(36).slice(2, 6)}`
  try {
    const note = await a.createNote({
      path: `${CANVAS_PREFIX}${boardId}/${cardId}`,
      content: card.content ?? '',
      tags: ['canvas'],
      metadata: { ckind: 'card', board: boardId, x: card.x, y: card.y, w: card.w, h: card.h },
    })
    mergeNote(note)
    return note
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

export async function updateCanvasNote(
  path: string,
  ifUpdatedAt: string,
  patch: { content?: string; metadata?: NoteMetadata },
): Promise<Note> {
  try {
    const note = await requireApi().updateNote(path, { ...patch, ifUpdatedAt })
    mergeNote(note)
    return note
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
}

/** Delete a board and every card filed beneath it. */
export async function deleteCanvasBoard(boardId: string): Promise<void> {
  const a = requireApi()
  try {
    const list = await a.listByPrefix(`${CANVAS_PREFIX}${boardId}`)
    await Promise.all(list.map((n) => a.deleteNote(n.path)))
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
  const notes = { ...state.notes }
  for (const p of Object.keys(notes)) {
    if (p === `${CANVAS_PREFIX}${boardId}` || p.startsWith(`${CANVAS_PREFIX}${boardId}/`)) {
      delete notes[p]
    }
  }
  set({ notes })
}

export async function deleteCanvasCard(path: string): Promise<void> {
  try {
    await requireApi().deleteNote(path)
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
  const notes = { ...state.notes }
  delete notes[path]
  set({ notes })
}

export async function deletePage(path: string): Promise<void> {
  try {
    await requireApi().deleteNote(path)
  } catch (e) {
    handleAuthFailure(e)
    throw e
  }
  const notes = { ...state.notes }
  delete notes[path]
  set({ notes, pages: (state.pages ?? []).filter((p) => p !== path) })
}

// ---------------------------------------------------------------------------
// Vault access for the /ai block's MCP connection — exposes a token + base
// URL only, never the AuthManager itself.
// ---------------------------------------------------------------------------

/** The active vault's base URL (e.g. https://hub/vault/jonathan), or null. */
export function vaultBaseUrl(): string | null {
  return manager ? manager.vaultBase : null
}

/** A live vault access token for the MCP connection, refreshed if near expiry. */
export async function vaultAccessToken(): Promise<string | null> {
  if (!manager) return null
  try {
    return await manager.getAccessToken()
  } catch {
    return null
  }
}
