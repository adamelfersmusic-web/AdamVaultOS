// THE EMBEDDER SEAM — one interface between "text goes in, meaning-vectors
// come out" and everything else (the worker, the IndexedDB index, the
// Omnibar's ✨ Related group). Swapping the brain is a ONE-FILE change:
// point `activeEmbedder()` at a different implementation and the index
// manager notices the new `id`, throws away stale vectors, and re-embeds.
//
// Futures this seam is shaped for (documented, deliberately NOT built):
//
//   · localEmbedder — transformers.js running a small sentence-transformer
//     (e.g. all-MiniLM-L6-v2) fully in-browser via WASM/WebGPU. Same
//     interface: `{ id: 'minilm-l6-v2', dims: 384, embed }`. Requires adding
//     the @huggingface/transformers dependency; until that dependency is
//     allowed, shipping a model-download probe would be theater — there is
//     nothing here that could run the weights.
//
//   · hubEmbedder — a Parachute hub endpoint that embeds server-side. Same
//     interface again, but NOTE THE PRIVACY LAW below before wiring it up.
//
// THE PRIVACY LAW: semantic search must work with NOTHING leaving the
// device. The active embedder must be local — no network calls, no
// telemetry, no model-hub fetches at query time. A future hubEmbedder may
// only ever be offered as an explicit, opt-in choice; it must never become
// the silent default.

import { hashEmbedder } from './hash'

export interface Embedder {
  /** Stable identity stamped on every stored vector — a changed id is how
   * the index knows every vector is stale and must be rebuilt. */
  id: string
  /** Vector dimensionality (all vectors from one embedder share it). */
  dims: number
  /** Batch text → unit-length vectors. Pure and deterministic for the hash
   * embedder; async so heavier implementations (WASM models) fit the same
   * seam without an interface change. */
  embed(texts: string[]): Promise<Float32Array[]>
}

/** The registry — THE one line to change when a better brain arrives. */
export function activeEmbedder(): Embedder {
  return hashEmbedder
}
