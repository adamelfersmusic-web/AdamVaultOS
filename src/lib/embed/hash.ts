// hashEmbedder — the ACTIVE implementation behind the Embedder seam.
//
// Signed feature hashing ("the hashing trick"): every word and every
// character 3-/4-gram of a note is FNV-1a-hashed into one of 384 buckets
// with a deterministic ±1 sign, TF-weighted sublinearly, then the whole
// vector is L2-normalized. Cosine similarity between two such vectors is a
// meaning-ISH signal: shared vocabulary and shared word-stems (via the char
// grams: "customize" and "customizable" overlap heavily) pull notes
// together, while stopword filtering keeps "the/and/of" glue from faking
// similarity.
//
// Why this and not a real model: an ONNX/WASM sentence-transformer without
// a new npm dependency is infeasible, and fetching model weights nothing
// here can run would be theater. This embedder is dependency-free,
// deterministic, instant, and fully on-device — and the seam (types.ts)
// makes upgrading it a one-file swap when a real local model is allowed.

import type { Embedder } from './types'

export const HASH_DIMS = 384

/** English glue words — frequency without meaning. Filtered before hashing
 * so a query like "customize AND remix THE interface" keys on the nouns. */
const STOPWORDS = new Set([
  'a', 'about', 'after', 'all', 'also', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each',
  'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he',
  'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into',
  'is', 'it', 'its', 'just', 'me', 'more', 'most', 'my', 'no', 'nor',
  'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
  'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until',
  'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
  'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your',
])

/** FNV-1a 32-bit — tiny, fast, and stable across sessions (determinism is
 * what lets stored vectors be reused forever under the same embedder id). */
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
}

/**
 * Feature stream for one token: the word itself (weight 2 — exact shared
 * vocabulary is the strongest signal) plus boundary-padded char 3- and
 * 4-grams (weight 1 — the stem-overlap net). Padding with '_' makes
 * prefix grams distinct from mid-word grams.
 */
function addToken(counts: Map<string, number>, token: string): void {
  counts.set(`w:${token}`, (counts.get(`w:${token}`) ?? 0) + 2)
  const padded = `_${token}_`
  for (const n of [3, 4]) {
    for (let i = 0; i + n <= padded.length; i++) {
      const g = `g:${padded.slice(i, i + n)}`
      counts.set(g, (counts.get(g) ?? 0) + 1)
    }
  }
}

function embedOne(text: string): Float32Array {
  const vec = new Float32Array(HASH_DIMS)
  const counts = new Map<string, number>()
  for (const token of tokenize(text)) addToken(counts, token)
  for (const [feature, count] of counts) {
    const h = fnv1a(feature)
    const idx = h % HASH_DIMS
    // Independent sign hash — using a bit of `idx`'s own hash would
    // correlate sign with bucket and bias the dot products.
    const sign = fnv1a(`±${feature}`) & 1 ? 1 : -1
    vec[idx]! += sign * (1 + Math.log(count)) // sublinear TF
  }
  // L2 normalize so cosine is a plain dot product downstream.
  let norm = 0
  for (let i = 0; i < HASH_DIMS; i++) norm += vec[i]! * vec[i]!
  norm = Math.sqrt(norm)
  if (norm > 0) for (let i = 0; i < HASH_DIMS; i++) vec[i]! /= norm
  return vec
}

export const hashEmbedder: Embedder = {
  id: 'hash-ngram-v1',
  dims: HASH_DIMS,
  embed(texts: string[]): Promise<Float32Array[]> {
    return Promise.resolve(texts.map(embedOne))
  },
}
