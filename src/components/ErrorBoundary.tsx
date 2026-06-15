import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Root error boundary. The app has many render paths (OAuth return, vault data
 * of every shape) and no other safety net — without this, a single render throw
 * unmounts everything and leaves a blank page. This catches it and shows a
 * readable message plus recovery actions instead of a blank crash.
 *
 * Recovery only ever clears AdamVaultOS's OWN namespaced storage — it never
 * touches another app's keys on the shared github.io origin, and never the vault.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Adam · Vault OS crashed during render:', error, info.componentStack)
  }

  private reload = (): void => {
    window.location.reload()
  }

  private resetSession = (): void => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('adamvaultos.')) localStorage.removeItem(key)
      }
      sessionStorage.removeItem('adamvaultos.oauth.pending')
    } catch {
      /* ignore storage errors */
    }
    window.location.assign(`${window.location.pathname}#/connect`)
    window.location.reload()
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="connect">
        <div className="connect-glow" aria-hidden="true" />
        <div className="connect-card" role="alert" data-testid="error-boundary">
          <div className="connect-brand">
            <h1 className="connect-title">Something broke</h1>
            <p className="connect-sub">Adam · Vault OS hit an unexpected error</p>
          </div>
          <div className="connect-error" style={{ whiteSpace: 'pre-wrap' }}>
            {error.message || String(error)}
          </div>
          <button className="btn btn-gold connect-btn" onClick={this.reload}>
            Reload
          </button>
          <button className="btn btn-ghost connect-btn" onClick={this.resetSession}>
            Reset session &amp; reconnect
          </button>
          <p className="connect-note">
            “Reset” clears only this app’s saved session in this browser, then
            returns you to the connect screen. Your vault is untouched.
          </p>
        </div>
      </div>
    )
  }
}
