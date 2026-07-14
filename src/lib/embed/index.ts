// THE VECTOR INDEX MANAGER — the memory between the Embedder seam and the
// Omnibar's ✨ Related group.
//
//   · Persists one vector per note in IndexedDB (`adamvaultos.vectors.v1`,
//     path → { updatedAt, embedderId, vector }) so a reload re-embeds
//     NOTHING that hasn't changed.
//   · Syncs are diff-only (updatedAt or embedderId mismatch → re-embed, in
//     64-note batches), prune deleted paths, and are serialized — a second
//     sync request queues behind the first, never builds concurrently.
//   · Embedding runs in a module Web Worker; if Worker construction fails
//     (odd embedders, file:// contexts), the same seam runs inline on the
//     main thread.
//   · Search is brute-force cosine over the in-memory matrix — at vault
//     scale (hundreds to a few thousand notes, 384 dims) that is sub-ms and
//     an ANN structure would be pure ceremony.
//
// PRIVACY LAW (restated from types.ts): everything here — embedding,
// storage, search — happens on this device. Nothing leaves it.

import { activeEmbedder } from './types'
import type { Note } from '../types'

// ————————————————————————— tuning —————————————————————————

/**
 * Minimum cosine to count as "related". MEASURED for hash-ngram-v1: honest
 * hits (shared stems + one shared word across a short query and a topical
 * note) land in the 0.20–0.45 band, while unrelated notes sit below ~0.10.
 * A "safer looking" 0.35 would blank most honest hits — sparse signed
 * n-gram vectors simply don't reach the cosines dense model embeddings do.
 * Re-measure before touching this if the active embedder changes.
 */
export const SEMANTIC_FLOOR = 0.18

const BATCH_SIZE = 64
const DB_NAME = 'adamvaultos.vectors.v1'
const STORE = 'vectors'
/** Note text worth embedding: the title carries the most meaning, the body
 * is truncated (~1500 chars covers the thesis of nearly every note), and a
 * metadata summary — when an agent left one — is distilled meaning. */
const BODY_CHARS = 1500

// ————————————————————————— observable status —————————————————————————

export interface SemanticStatus {
  /** At least one sync has completed — the matrix reflects the vault. */
  ready: boolean
  /** A sync (embedding pass) is running right now. */
  building: boolean
  /** This device had NO stored vectors when this session first synced —
   * i.e. the current/most-recent build is the first ever. Drives the
   * one-time "indexing your vault…" foot line. */
  firstEver: boolean
  embedderId: string
  vectorCount: number
  /** Notes actually (re-)embedded since page load — the diff-only proof. */
  embeddedThisSession: number
}

const status: SemanticStatus = {
  ready: false,
  building: false,
  firstEver: false,
  embedderId: activeEmbedder().id,
  vectorCount: 0,
  embeddedThisSession: 0,
}

let version = 0
const listeners = new Set<() => void>()

function emit(): void {
  version++
  for (const fn of listeners) fn()
}

export function semanticStatus(): SemanticStatus {
  return status
}

/** Monotonic change counter — a useSyncExternalStore-friendly snapshot. */
export function semanticVersion(): number {
  return version
}

export function subscribeSemantic(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// The debug window: e2e specs (and curious humans) read the live status
// object — it mutates in place, so this reference never goes stale.
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__semanticDebug = status
}

// ————————————————————————— the worker pipe —————————————————————————

interface EmbedResponse {
  id: number
  vectors: Float32Array[]
}

let worker: Worker | null = null
let workerBroken = false
let nextRequestId = 1
const pending = new Map<
  number,
  { resolve: (v: Float32Array[]) => void; reject: (e: unknown) => void }
>()

function getWorker(): Worker | null {
  if (workerBroken || worker) return worker
  try {
    // Vite-native module worker: this URL form is statically analyzed and
    // emitted as its own chunk in dist/.
    worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    })
    worker.onmessage = (e: MessageEvent<EmbedResponse>) => {
      const p = pending.get(e.data.id)
      if (p) {
        pending.delete(e.data.id)
        p.resolve(e.data.vectors)
      }
    }
    worker.onerror = () => {
      // The worker chunk failed to load or threw at top level — reject
      // everything in flight (callers fall back inline) and stop trying.
      workerBroken = true
      const stuck = [...pending.values()]
      pending.clear()
      worker?.terminate()
      worker = null
      for (const p of stuck) p.reject(new Error('embed worker failed'))
    }
  } catch {
    workerBroken = true
    worker = null
  }
  return worker
}

/** texts → vectors, off-thread when possible, inline when not. */
async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  const w = getWorker()
  if (w) {
    try {
      return await new Promise<Float32Array[]>((resolve, reject) => {
        const id = nextRequestId++
        pending.set(id, { resolve, reject })
        w.postMessage({ id, texts })
      })
    } catch {
      /* fall through to the inline path */
    }
  }
  return activeEmbedder().embed(texts)
}

// ————————————————————————— IndexedDB —————————————————————————

interface StoredVector {
  path: string
  updatedAt: string
  embedderId: string
  vector: Float32Array
}

let dbPromise: Promise<IDBDatabase | null> | null = null

/** Open (or create) the vector store; resolves null when IndexedDB is
 * unavailable/broken — the index then lives for the session in memory. */
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE, { keyPath: 'path' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function idbGetAll(db: IDBDatabase): Promise<StoredVector[]> {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
      req.onsuccess = () => resolve(req.result as StoredVector[])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

function idbWrite(
  db: IDBDatabase,
  puts: StoredVector[],
  deletes: string[],
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const rec of puts) store.put(rec)
      for (const path of deletes) store.delete(path)
      tx.oncomplete = () => resolve()
      tx.onabort = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

// ————————————————————————— the index —————————————————————————

/** In-memory matrix: path → unit vector (active embedder only). */
const matrix = new Map<string, Float32Array>()
/** Diff bookkeeping mirror of the store: path → stamp/embedder. */
const stored = new Map<string, { updatedAt: string; embedderId: string }>()
let loadedFromDb = false

/** What we embed for a note: title line + first ~1500 body chars + the
 * metadata summary (when present). */
function embeddingText(n: Note): string {
  const content = n.content ?? ''
  const heading = content.match(/^\s{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/m)?.[1]
  const title =
    heading ?? (n.path.split('/').pop() ?? n.path).replace(/[-_]+/g, ' ')
  const summary = n.metadata?.['summary']
  return [title, content.slice(0, BODY_CHARS), typeof summary === 'string' ? summary : '']
    .filter(Boolean)
    .join('\n')
}

async function doSync(notes: Note[]): Promise<void> {
  const embedder = activeEmbedder()
  const db = await openDb()

  if (!loadedFromDb) {
    loadedFromDb = true
    const records = db ? await idbGetAll(db) : []
    status.firstEver = records.length === 0
    for (const rec of records) {
      stored.set(rec.path, { updatedAt: rec.updatedAt, embedderId: rec.embedderId })
      // Only same-embedder vectors are searchable; stale ones re-embed below.
      if (rec.embedderId === embedder.id && rec.vector instanceof Float32Array) {
        matrix.set(rec.path, rec.vector)
      }
    }
    status.vectorCount = matrix.size
  }

  const wanted = new Map(notes.map((n) => [n.path, n]))

  // Prune vectors for notes that no longer exist.
  const gone = [...stored.keys()].filter((p) => !wanted.has(p))
  if (gone.length > 0) {
    for (const p of gone) {
      stored.delete(p)
      matrix.delete(p)
    }
    if (db) await idbWrite(db, [], gone)
  }

  // Diff: new note, content changed (updatedAt), or embedder changed.
  const stale = notes.filter((n) => {
    const rec = stored.get(n.path)
    return !rec || rec.updatedAt !== n.updatedAt || rec.embedderId !== embedder.id
  })

  if (stale.length > 0) {
    status.building = true
    emit()
    for (let i = 0; i < stale.length; i += BATCH_SIZE) {
      const batch = stale.slice(i, i + BATCH_SIZE)
      const vectors = await embedTexts(batch.map(embeddingText))
      const puts: StoredVector[] = []
      batch.forEach((n, j) => {
        const vector = vectors[j]
        if (!vector) return
        matrix.set(n.path, vector)
        stored.set(n.path, { updatedAt: n.updatedAt, embedderId: embedder.id })
        puts.push({ path: n.path, updatedAt: n.updatedAt, embedderId: embedder.id, vector })
      })
      if (db) await idbWrite(db, puts, [])
      status.embeddedThisSession += puts.length
      status.vectorCount = matrix.size
      emit()
    }
  }

  status.building = false
  status.ready = true
  status.vectorCount = matrix.size
  emit()
  // The first-ever build is over the moment a build completes; the foot
  // line must never reappear for routine incremental syncs.
  if (status.firstEver && stale.length > 0) status.firstEver = false
}

// Serialized syncs: every request queues behind the previous one, and the
// diff makes a queued repeat effectively free. No polling anywhere — the
// Omnibar calls this when its (60s-cached) corpus lands.
let tail: Promise<void> = Promise.resolve()

export function syncSemanticIndex(notes: Note[]): Promise<void> {
  const run = tail.then(() => doSync(notes)).catch(() => {
    status.building = false
    emit()
  })
  tail = run
  return run
}

// ————————————————————————— search —————————————————————————

export interface SemanticHit {
  path: string
  /** Cosine similarity in [−1, 1]; always ≥ SEMANTIC_FLOOR here. */
  score: number
}

/**
 * Brute-force cosine of the query against every indexed note. Waits for any
 * in-flight sync first so "type immediately after opening" still gets the
 * freshest matrix rather than racing it.
 */
export async function semanticSearch(query: string, k: number): Promise<SemanticHit[]> {
  await tail
  const q = query.trim()
  if (!q || matrix.size === 0) return []
  const [qv] = await embedTexts([q])
  if (!qv) return []
  const hits: SemanticHit[] = []
  for (const [path, vec] of matrix) {
    let dot = 0
    for (let i = 0; i < qv.length; i++) dot += qv[i]! * vec[i]!
    if (dot >= SEMANTIC_FLOOR) hits.push({ path, score: dot })
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, k)
}
