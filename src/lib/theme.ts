// L2 — light mode (build log PART 30). One boolean of state: dark (default)
// or the "latte" light theme. The entire theme lives in tokens.css under
// [data-theme='light']; this module just flips the attribute, persists the
// choice, and lets React subscribe.

import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'adamvaultos.theme'
const listeners = new Set<() => void>()
let current: Theme = 'dark'

function apply(theme: Theme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light'
  else delete document.documentElement.dataset.theme
}

/** Read the stored choice and stamp the <html> attribute — call before render
    so the first paint is already the right theme (no flash). */
export function initTheme() {
  try {
    if (localStorage.getItem(KEY) === 'light') current = 'light'
  } catch {
    // storage unavailable — stay dark
  }
  apply(current)
}

export function getTheme(): Theme {
  return current
}

export function setTheme(theme: Theme) {
  if (theme === current) return
  current = theme
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // non-fatal — theme just won't persist
  }
  apply(theme)
  listeners.forEach((fn) => fn())
}

export function toggleTheme() {
  setTheme(current === 'dark' ? 'light' : 'dark')
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme)
}
