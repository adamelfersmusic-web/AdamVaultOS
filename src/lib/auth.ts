// Holds the live session and owns the token lifecycle: hands the API a valid
// access token (refreshing proactively when one is near expiry), refreshes
// reactively on a 401, and persists every rotation. Ported from the proven
// JonathanParachuteSurface AuthManager.
//
// Multi-tab discipline: the hub rotates refresh tokens on every refresh and
// treats reuse of a superseded refresh token as theft (it revokes the whole
// token family). With one AuthManager per tab, two tabs refreshing
// independently WILL trip that tripwire. So the persisted localStorage
// session is the cross-tab source of truth for token material:
//   · adopt-from-storage — before refreshing (and on any 401), re-read the
//     persisted session; if another tab already rotated, adopt its tokens
//     instead of burning our now-stale refresh token.
//   · single-flight across tabs — the actual refresh runs under a Web Lock
//     ('adamvaultos-token-refresh') so only one tab ever refreshes at a time;
//     the first thing done under the lock is another adopt check, because the
//     previous holder probably already rotated.
//   · environments without navigator.locks just skip the lock (adoption still
//     de-races the common case).

import {
  refreshAccessToken,
  storedFromTokenResponse,
  type StoredToken,
} from './oauth'

export interface AuthSession {
  /** Base for /api calls, e.g. https://hub/vault/jonathan */
  vaultUrl: string
  /** 'oauth' sessions carry refresh material; 'token' = pasted bearer. */
  mode: 'oauth' | 'token'
  issuer?: string
  tokenEndpoint?: string
  clientId?: string
  token: StoredToken
}

export interface AuthManagerOptions {
  /** Re-read the persisted session — the shared cross-tab source of truth.
   * Absent (e.g. the connect-screen probe manager) → adoption is a no-op. */
  loadPersisted?: () => AuthSession | null
  /** Fired when another tab's rotation is adopted (already persisted by the
   * rotating tab — the listener only needs to update live state). */
  onAdopt?: (session: AuthSession) => void
}

const REFRESH_LOCK = 'adamvaultos-token-refresh'

export class AuthManager {
  private session: AuthSession
  private onRotate: (session: AuthSession) => void
  private options: AuthManagerOptions
  private refreshing: Promise<boolean> | null = null

  constructor(
    session: AuthSession,
    onRotate: (s: AuthSession) => void,
    options: AuthManagerOptions = {},
  ) {
    this.session = session
    this.onRotate = onRotate
    this.options = options
  }

  get current(): AuthSession {
    return this.session
  }

  get vaultBase(): string {
    return this.session.vaultUrl
  }

  private canRefresh(): boolean {
    const t = this.session.token
    return Boolean(t.refreshToken && this.session.tokenEndpoint && this.session.clientId)
  }

  private nearExpiry(): boolean {
    const exp = this.session.token.expiresAt
    // 30s skew. No expiry recorded (e.g. a pasted token) → never proactively refresh.
    return typeof exp === 'number' && Date.now() > exp - 30_000
  }

  /**
   * Adopt the persisted session when it carries DIFFERENT token material than
   * memory — i.e. another tab already rotated (or re-authenticated). Returns
   * true when something was adopted. Never touches storage itself.
   */
  adoptFromStorage(): boolean {
    const persisted = this.options.loadPersisted?.()
    if (!persisted?.token?.accessToken) return false
    // A different vault's session is not ours to adopt.
    if (persisted.vaultUrl !== this.session.vaultUrl) return false
    if (persisted.token.accessToken === this.session.token.accessToken) return false
    this.session = persisted
    this.options.onAdopt?.(persisted)
    return true
  }

  /** Returns a usable access token, refreshing first if it's about to expire. */
  async getAccessToken(): Promise<string> {
    if (this.canRefresh() && this.nearExpiry()) await this.tryRefresh()
    return this.session.token.accessToken
  }

  /**
   * Get a live token by any means: adopt a sibling tab's rotation when one
   * exists, otherwise refresh (single-flight within the tab AND across tabs).
   * Returns true when the session now holds fresher token material.
   */
  async tryRefresh(): Promise<boolean> {
    if (this.refreshing) return this.refreshing
    const flight = this.refreshOrAdopt().finally(() => {
      this.refreshing = null
    })
    this.refreshing = flight
    return flight
  }

  private async refreshOrAdopt(): Promise<boolean> {
    // Another tab may already have rotated — adopting beats spending our
    // (likely superseded) refresh token, which the hub would read as theft.
    if (this.adoptFromStorage() && !this.nearExpiry()) return true
    if (!this.canRefresh()) return false
    return this.withRefreshLock(async () => {
      // First thing under the lock: the previous holder probably rotated
      // while we waited. If the persisted tokens moved on, adopt, don't refresh.
      if (this.adoptFromStorage() && !this.nearExpiry()) return true
      return this.refreshNow()
    })
  }

  /** Cross-tab mutual exclusion via the Web Locks API, when available. */
  private async withRefreshLock(fn: () => Promise<boolean>): Promise<boolean> {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    if (!locks?.request) return fn() // no Web Locks — adopt-from-storage still guards
    try {
      return await locks.request(REFRESH_LOCK, fn)
    } catch {
      // fn() itself never rejects (refreshNow catches) — a rejection here is
      // the lock machinery failing; fall back to the unlocked path.
      return fn()
    }
  }

  private async refreshNow(): Promise<boolean> {
    try {
      const res = await refreshAccessToken(
        this.session.tokenEndpoint!,
        this.session.clientId!,
        this.session.token.refreshToken!,
      )
      const stored = storedFromTokenResponse(res)
      // Rotation: keep the prior refresh token if the response omits one.
      if (!stored.refreshToken) stored.refreshToken = this.session.token.refreshToken
      this.session = { ...this.session, token: stored }
      this.onRotate(this.session)
      return true
    } catch {
      return false
    }
  }
}
