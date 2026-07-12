// Tiny UI-state store for cross-cutting overlays (palette, capture modal).

import { useSyncExternalStore } from 'react'

interface UiState {
  paletteOpen: boolean
  newScriptOpen: boolean
  askAiOpen: boolean
}

let state: UiState = { paletteOpen: false, newScriptOpen: false, askAiOpen: false }
const listeners = new Set<() => void>()

function set(partial: Partial<UiState>): void {
  state = { ...state, ...partial }
  for (const l of listeners) l()
}

export function useUi(): UiState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export const openPalette = () => set({ paletteOpen: true })
export const closePalette = () => set({ paletteOpen: false })
export const openNewScript = () => set({ newScriptOpen: true, paletteOpen: false })
export const closeNewScript = () => set({ newScriptOpen: false })
export const openAskAi = () => set({ askAiOpen: true, paletteOpen: false })
export const closeAskAi = () => set({ askAiOpen: false })
export const toggleAskAi = () => set({ askAiOpen: !state.askAiOpen })

/** Fired when something OUTSIDE the page editor (Ask AI insert) writes to the
 * note that editor has open, so it can re-sync in place. detail:
 * { path, content, updatedAt }. */
export const PAGE_EXTERNAL_UPDATE_EVENT = 'adamvaultos:page-external-update'
export function announcePageUpdate(path: string, content: string, updatedAt: string) {
  window.dispatchEvent(
    new CustomEvent(PAGE_EXTERNAL_UPDATE_EVENT, { detail: { path, content, updatedAt } }),
  )
}
