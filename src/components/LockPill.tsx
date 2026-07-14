// Tier 2 — the sacred-handful lock's ONE deliberate door. A note carrying
// metadata.locked === true renders read-only in the editing surfaces; this
// pill is how a human gets through on purpose: click → the pill flips to
// "Unlock for this visit?" → click again → editable until you navigate away.
// Nothing is persisted — the next visit is locked again. A seatbelt, not a
// safe: API / mint / MCP writes never see it (it's a client-side render rule).

import { useState } from 'react'

export function LockPill({
  unlocked,
  onUnlock,
}: {
  unlocked: boolean
  onUnlock: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  if (unlocked) {
    return (
      <span
        className="lock-pill is-unlocked"
        data-testid="lock-pill"
        title="Unlocked until you navigate away — nothing is persisted"
      >
        🔓 Unlocked this visit
      </span>
    )
  }
  return (
    <button
      className={`lock-pill${confirm ? ' is-confirm' : ''}`}
      data-testid="lock-pill"
      title="One of the sacred handful — unlocking takes a deliberate second click"
      onClick={() => {
        if (confirm) {
          setConfirm(false)
          onUnlock()
        } else {
          setConfirm(true)
        }
      }}
      onBlur={() => setConfirm(false)}
    >
      {confirm ? 'Unlock for this visit?' : '🔒 Locked — the sacred handful'}
    </button>
  )
}
