// CRAFT-STYLE PROGRESS RINGS — a note's checkbox tally, pure. Craft shows a
// small ring on a doc title counting the tasks inside it; this is that count:
// every `- [ ]` / `- [x]` line in the note, code fences excluded (quotation,
// not work). Deliberately NO think-space EXCLUDES here — a weekly card's ring
// is exactly the point, and locked notes still get one (reading isn't
// writing). Display-only: nothing in this module ever writes.

import { eachCheckboxLine } from './looseTasks'

export interface CheckboxRing {
  done: number
  total: number
}

/** Tally the note's checkbox lines (fence-aware — the same walk the loose
 * scanner uses). No checkboxes at all → null: no ring, not a 0/0 ring. */
export function ringOf(content: string): CheckboxRing | null {
  if (!content.includes('- [')) return null // cheap pre-check before splitting
  let done = 0
  let total = 0
  eachCheckboxLine(content.split('\n'), ({ checked }) => {
    total++
    if (checked) done++
  })
  return total === 0 ? null : { done, total }
}
