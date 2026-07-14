// The mini progress ring (Craft's doc-title ring) — a 15px SVG sweep +
// "done/total" beside it. Pure display: the arc is the house accent, the
// track a hairline, and a finished ring goes quiet green (--green, the
// semantic success tone) instead of celebrating. Used by the Pages topbar
// and the Tasks tab's "In your notes" note-group headers.

import type { CheckboxRing } from '../domain/checkboxRing'

export function ProgressRing({ ring, size = 15 }: { ring: CheckboxRing; size?: number }) {
  const { done, total } = ring
  const stroke = 2
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const frac = total > 0 ? Math.min(done / total, 1) : 0
  const full = total > 0 && done >= total
  return (
    <span
      className={`checkbox-ring${full ? ' is-full' : ''}`}
      data-testid="checkbox-ring"
      data-done={done}
      data-total={total}
      title={`${done} of ${total} done`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="checkbox-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="checkbox-ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="checkbox-ring-count">
        {done}/{total}
      </span>
    </span>
  )
}
