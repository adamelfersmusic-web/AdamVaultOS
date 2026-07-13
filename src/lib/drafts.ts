// Draft stash — the "no work lost, ever" layer. When a save dies with an auth
// failure (session expired / token family revoked), the unsaved buffer is
// parked in localStorage under `adamvaultos.draft.<path>` so it survives the
// disconnect/reconnect round-trip. Editors offer to restore it on next mount
// and every successful save of that path clears it.

const PREFIX = 'adamvaultos.draft.'

export interface DraftStash {
  content: string
  /** ISO timestamp of when the buffer was stashed. */
  stashedAt: string
  /** The note's updatedAt the edit was based on (conflict context on restore). */
  baseUpdatedAt: string
}

export function stashDraft(path: string, content: string, baseUpdatedAt: string): void {
  try {
    const stash: DraftStash = {
      content,
      stashedAt: new Date().toISOString(),
      baseUpdatedAt,
    }
    localStorage.setItem(PREFIX + path, JSON.stringify(stash))
  } catch {
    /* storage full/unavailable — nothing more we can do */
  }
}

export function loadDraft(path: string): DraftStash | null {
  try {
    const raw = localStorage.getItem(PREFIX + path)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DraftStash>
    if (typeof parsed.content !== 'string') return null
    return {
      content: parsed.content,
      stashedAt: typeof parsed.stashedAt === 'string' ? parsed.stashedAt : '',
      baseUpdatedAt:
        typeof parsed.baseUpdatedAt === 'string' ? parsed.baseUpdatedAt : '',
    }
  } catch {
    return null
  }
}

export function clearDraft(path: string): void {
  try {
    localStorage.removeItem(PREFIX + path)
  } catch {
    /* ignore */
  }
}
