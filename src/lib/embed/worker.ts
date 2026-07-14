// The embedding worker — a dumb texts→vectors pipe kept OFF the main thread
// so a future heavier embedder (a WASM model behind the same seam) never
// janks typing in the Omnibar. It knows nothing about notes, IndexedDB, or
// ranking: `{ id, texts }` in, `{ id, vectors }` out, buffers transferred.
//
// Built by Vite as a module worker chunk via
// `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`
// in index.ts. If construction fails there, the SAME seam runs inline on
// the main thread — behavior is identical either way.

import { activeEmbedder } from './types'

interface EmbedRequest {
  id: number
  texts: string[]
}

// tsconfig builds against the DOM lib (no WebWorker lib), so `self` types as
// Window here — cast to the two members a dedicated worker actually has.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<EmbedRequest>) => void) | null
  postMessage(message: unknown, transfer: Transferable[]): void
}

ctx.onmessage = (e: MessageEvent<EmbedRequest>) => {
  const { id, texts } = e.data
  void activeEmbedder()
    .embed(texts)
    .then((vectors) => {
      ctx.postMessage(
        { id, vectors },
        vectors.map((v) => v.buffer),
      )
    })
}
