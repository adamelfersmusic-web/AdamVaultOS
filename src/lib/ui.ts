// Tiny UI-state store for cross-cutting overlays (palette, capture modal).

import { useSyncExternalStore } from 'react'

interface UiState {
  paletteOpen: boolean
  newScriptOpen: boolean
  askAiOpen: boolean
  shortcutsOpen: boolean
}

let state: UiState = {
  paletteOpen: false,
  newScriptOpen: false,
  askAiOpen: false,
  shortcutsOpen: false,
}
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
export const openShortcuts = () => set({ shortcutsOpen: true, paletteOpen: false })
export const closeShortcuts = () => set({ shortcutsOpen: false })
export const toggleShortcuts = () => set({ shortcutsOpen: !state.shortcutsOpen })

/** The Omnibar's "🔮 Ask the vault" handoff: open the Ask AI panel AND send
 * the query — one continuous gesture. AskAi is always mounted (it renders the
 * fab when closed), so it listens for this event for the panel's lifetime. */
export const ASK_AI_ASK_EVENT = 'adamvaultos:askai-ask'
export function askAiAsk(query: string): void {
  set({ askAiOpen: true, paletteOpen: false })
  window.dispatchEvent(new CustomEvent(ASK_AI_ASK_EVENT, { detail: { query } }))
}

/** Fired by the slash menu's "Table — from CSV" item; the focused PageEditor
 * listens and opens its paste-CSV modal (the slash command itself stays dumb —
 * it neither parses nor inserts). */
export const CSV_IMPORT_EVENT = 'adamvaultos:csv-import'

/** Fired when something OUTSIDE the page editor (Ask AI insert) writes to the
 * note that editor has open, so it can re-sync in place. detail:
 * { path, content, updatedAt }. */
export const PAGE_EXTERNAL_UPDATE_EVENT = 'adamvaultos:page-external-update'
export function announcePageUpdate(path: string, content: string, updatedAt: string) {
  window.dispatchEvent(
    new CustomEvent(PAGE_EXTERNAL_UPDATE_EVENT, { detail: { path, content, updatedAt } }),
  )
}
