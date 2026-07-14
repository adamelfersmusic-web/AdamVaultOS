// THE KEYMAP — the one source of truth for every keyboard shortcut the app
// answers to. The Shortcuts panel renders THIS list (and nothing else renders
// a shortcut list), so the panel can never go stale: add a binding here and
// every surface that shows shortcuts already knows it.

export interface Keybinding {
  keys: string
  does: string
  /** Where the binding applies when it isn't global (editor, lists, pickers). */
  where?: string
}

export const KEYMAP: Keybinding[] = [
  { keys: '⌘K', does: 'Omnibar — jump anywhere' },
  { keys: '⌘J', does: 'Ask AI' },
  { keys: '⌘/', does: 'This panel' },
  { keys: 'Esc', does: 'Close / leave' },
  { keys: '/', does: 'Slash menu', where: 'editor' },
  { keys: '[[', does: 'Wikilink', where: 'editor' },
  { keys: 'Tab / ⇧Tab', does: 'Indent / outdent', where: 'lists' },
  { keys: '⌘B / ⌘I / ⌘⇧X', does: 'Bold / italic / strikethrough', where: 'editor' },
  { keys: '⌘⌥1–3', does: 'Headings', where: 'editor' },
  { keys: 'Enter', does: 'Confirm', where: 'pickers' },
]
