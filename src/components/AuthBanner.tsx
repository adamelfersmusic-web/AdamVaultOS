// Slim, calm reconnect banner shown at the top of the content area when a
// VaultAuthError has escaped and auth hasn't recovered. Not a toast — it stays
// put until the session is alive again. The draft-stash layer has already
// parked any unsaved buffers, hence the "your work is safe locally" promise.

import { disconnect, lastVaultUrl, startOAuth, toast, useStore } from '../lib/store'
import { navigate } from '../lib/router'

export function AuthBanner() {
  const { authDead, session } = useStore()
  if (!authDead || !session) return null

  const reconnect = () => {
    if (session.mode === 'oauth') {
      // Re-run the OAuth dance against the same hub (navigates away on success).
      void startOAuth(lastVaultUrl() ?? session.vaultUrl).catch((e) =>
        toast('error', `Couldn’t reach the hub — ${e instanceof Error ? e.message : e}`),
      )
    } else {
      // Pasted-token session: no refresh material — back to the connect screen.
      disconnect()
      navigate({ kind: 'connect' })
    }
  }

  return (
    <div className="auth-banner" data-testid="auth-banner" role="status">
      <span className="auth-banner-dot" aria-hidden="true" />
      <span className="auth-banner-text">
        Session expired — your work is safe locally.
      </span>
      <button
        className="btn btn-gold auth-banner-btn"
        data-testid="auth-reconnect"
        onClick={reconnect}
      >
        Reconnect
      </button>
    </div>
  )
}
