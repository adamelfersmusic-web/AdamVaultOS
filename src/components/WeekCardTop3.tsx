// Tier 2 — the week card's Top 3 as a VERB-GATED WIDGET (the three-tier
// surface model: lenses you read · widgets you press · think-space everywhere
// else). A structured thing offering ONLY sanctioned moves:
//   ✅ check    — flips `- [ ]` ↔ `- [x]` on that ONE line of the card note
//   ✏️ cross off — wraps/unwraps the item text in ~~…~~ (renounced-not-done;
//                  the box is untouched)
//   ＋ bonus win — the EARNED SLOT: appears only when all three original
//                  items are resolved (checked OR crossed); appends one
//                  `- [ ] <text>` line under ## Top 3. Hard cap 4 — a card
//                  holding 4 items never shows the affordance again, and the
//                  bonus item never unlocks a fifth.
// No delete, no edit-text, no reorder. Every press is a targeted line write
// via surgicalLineEdit — the app never regenerates the doc. Shared by every
// surface that renders a weekly card's Top 3 (today: the world week band).

import { useState } from 'react'
import { surgicalLineEdit, toast } from '../lib/store'
import { announcePageUpdate } from '../lib/ui'
import { top3SectionRange, type Top3Item } from '../domain/spine'

const CHECKBOX_RE = /^\s*(?:[-*+]|\d+[.)])\s*\[( |x|X)\]\s*(.*)$/
/** prefix (marker + box + spacing) · body · trailing whitespace. */
const LINE_SHAPE = /^(\s*(?:[-*+]|\d+[.)])\s*\[(?: |x|X)\]\s*)(.*?)(\s*)$/

/** The item's exact line, searched inside the card's Top 3 section only. */
function findItemLine(lines: string[], raw: string): number {
  const range = top3SectionRange(lines)
  if (!range) return -1
  for (let i = range.start; i < range.end; i++) {
    const m = CHECKBOX_RE.exec(lines[i]!)
    if (m && m[2]!.trim() === raw) return i
  }
  return -1
}

export function WeekCardTop3({
  cardPath,
  items,
}: {
  cardPath: string
  items: Top3Item[]
}) {
  const [busy, setBusy] = useState(false)
  // Optimistic overlays keyed by the item's raw text — the verb reads the
  // moment it's pressed; the vault's truth takes back over on settle.
  const [pendingCheck, setPendingCheck] = useState<Record<string, boolean>>({})
  const [pendingCross, setPendingCross] = useState<Record<string, boolean>>({})
  const [bonusOpen, setBonusOpen] = useState(false)
  const [bonusText, setBonusText] = useState('')

  const write = async (mutate: (lines: string[]) => string[]) => {
    const updated = await surgicalLineEdit(cardPath, mutate)
    // An open editor on the card re-syncs in place.
    announcePageUpdate(updated.path, updated.content ?? '', updated.updatedAt)
  }

  const toggleCheck = async (item: Top3Item) => {
    if (busy) return
    setBusy(true)
    setPendingCheck((p) => ({ ...p, [item.raw]: !item.checked }))
    try {
      await write((lines) => {
        const idx = findItemLine(lines, item.raw)
        if (idx === -1) throw new Error('that line changed in the vault — try again')
        lines[idx] = lines[idx]!.replace(/\[( |x|X)\]/, (_m, c: string) =>
          c === ' ' ? '[x]' : '[ ]',
        )
        return lines
      })
    } catch (e) {
      toast('error', `Couldn’t save the check — ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
      setPendingCheck((p) => {
        const next = { ...p }
        delete next[item.raw]
        return next
      })
    }
  }

  const toggleCross = async (item: Top3Item) => {
    if (busy) return
    setBusy(true)
    setPendingCross((p) => ({ ...p, [item.raw]: !item.crossed }))
    try {
      await write((lines) => {
        const idx = findItemLine(lines, item.raw)
        if (idx === -1) throw new Error('that line changed in the vault — try again')
        const nextText = item.crossed ? item.text : `~~${item.raw}~~`
        lines[idx] = lines[idx]!.replace(
          LINE_SHAPE,
          (_m, pre: string, _body: string, tail: string) => `${pre}${nextText}${tail}`,
        )
        return lines
      })
    } catch (e) {
      toast('error', `Couldn’t cross it off — ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
      setPendingCross((p) => {
        const next = { ...p }
        delete next[item.raw]
        return next
      })
    }
  }

  const addBonus = async () => {
    const text = bonusText.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      await write((lines) => {
        const range = top3SectionRange(lines)
        if (!range) throw new Error('the card has no Top 3 section')
        let count = 0
        let last = -1
        for (let i = range.start; i < range.end; i++) {
          if (CHECKBOX_RE.test(lines[i]!)) {
            count++
            last = i
          }
        }
        // The cap is sacred: 3 + 1 earned, re-checked against the FRESH note.
        if (count >= 4) throw new Error('the card already holds its earned slot')
        lines.splice(last === -1 ? range.start : last + 1, 0, `- [ ] ${text}`)
        return lines
      })
      setBonusOpen(false)
      setBonusText('')
    } catch (e) {
      toast('error', `Couldn’t add the win — ${e instanceof Error ? e.message : e}`)
    } finally {
      setBusy(false)
    }
  }

  const isChecked = (t: Top3Item) => pendingCheck[t.raw] ?? t.checked
  const isCrossed = (t: Top3Item) => pendingCross[t.raw] ?? t.crossed
  // The earned slot: exactly the three originals, all resolved. Four items —
  // however they got there — means the slot is spent, forever this week.
  const earnedSlot = items.length === 3 && items.every((t) => isChecked(t) || isCrossed(t))

  return (
    <div className="week-card-top3">
      {items.map((t) => {
        const checked = isChecked(t)
        const crossed = isCrossed(t)
        return (
          <div
            key={t.raw}
            className={`week-top3-item${checked ? ' is-done' : ''}${crossed ? ' is-crossed' : ''}`}
            data-testid="week-top3-item"
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={busy}
              onChange={() => void toggleCheck(t)}
              aria-label={t.text}
            />
            <span>{t.text}</span>
            <button
              className="top3-cross"
              data-testid="top3-cross"
              disabled={busy}
              title={
                crossed
                  ? 'Take it back — un-cross this item'
                  : 'Cross off — renounced, not done'
              }
              aria-label={crossed ? `Un-cross ${t.text}` : `Cross off ${t.text}`}
              onClick={() => void toggleCross(t)}
            >
              ✏️
            </button>
          </div>
        )
      })}
      {earnedSlot &&
        (bonusOpen ? (
          <input
            autoFocus
            className="top3-bonus-input"
            data-testid="top3-bonus-input"
            placeholder="One bonus win — Enter to add…"
            value={bonusText}
            onChange={(e) => setBonusText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addBonus()
              if (e.key === 'Escape') {
                setBonusOpen(false)
                setBonusText('')
              }
            }}
          />
        ) : (
          <button
            className="top3-bonus"
            data-testid="top3-bonus"
            title="All three are resolved — completion buys one slot of headroom"
            onClick={() => setBonusOpen(true)}
          >
            ＋ bonus win
          </button>
        ))}
    </div>
  )
}
