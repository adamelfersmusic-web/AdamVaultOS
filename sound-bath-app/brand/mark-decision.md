# The mark — a second opinion on `mark-comparison.html`

*Review pass, not a new proposal. Read `brand/mark-comparison.html` first — this
agrees with its verdict, overturns one line of its scorecard, and prices two
costs the verdict doesn't.*

---

## Agreed: adopt the stack

The comparison is right, and one line of its scorecard carries the decision —
though not the line it leads with.

Not *"says the name."* True, and it matters, but it's the softest kind of true.

The one that decides it is **"obeys the amber rule cleanly — it's ink."**

The ring needs an *argument* to wear amber: *it depicts a sounding bowl, so it
qualifies.* That argument is sound, and it is still a carve-out — in a system
whose entire power is that amber has no exceptions. The kit is proud, correctly,
that it refused an amber CTA on a marketing page, on the grounds that nothing
there is sounding. That refusal is much harder to defend while the logo wears
amber on a technicality. **The stack removes amber from the identity system
altogether**, which is what makes the rule airtight everywhere it actually gets
tested.

---

## Overturned: "can go live — fills amber *per band*"

The scorecard counts this as a win for the stack. It is the one genuinely
dangerous idea in the document, and it contradicts the document's own closing
section.

That closing section clears the level-meter anti-reference on the grounds that
the shape **widens downward, with the weight at the bottom** — so it reads as
strata and mass, not signal strength. That defence is good. It is also a defence
of a **static** mark.

A four-bar stack whose bars **light up individually** is not strata. That is
precisely what a level meter does. The brand's own rule is *"filled or hollow —
a state, not a meter,"* and the band row earns that by being one row, on one
screen, that a leader is reading deliberately.

A mark gets none of that context:

- **In a browser tab** it gets ~200ms beside a dozen other favicons, where four
  bars of ascending length reads as *wifi* before it reads as anything else.
  That's the one case "never rotated, never boxed" can't protect, because nobody
  at 16px is parsing orientation — they're pattern-matching.
- **On follower devices** — and this is new since the comparison was written —
  the sync build puts the app on phones held by people who are *not* leading. A
  mark that pulses per band means, in a candlelit room, nine small level meters
  glowing at nine different rhythms. The product's entire posture is that the
  room is the visualisation and the screens disappear. An animated mark is the
  most literal possible violation of that, multiplied by the device count the
  product just gained.

**Take the stack. Ship it static, ink only.** A mark that changes state isn't a
mark — it's a UI element, which is exactly the diagnosis that sinks the ring.

---

## Two costs the verdict doesn't price

**1 · The migration isn't "additive."** The ring is live in nine places right
now:

| Where | Instances |
|---|---|
| `app/index.html` | 1 (the favicon data-URI) |
| `site/index.html` | 2 (favicon + footer mark) |
| `brand/index.html` | 6 (§01 *teaches* the ring) |
| `brand/assets/mark.svg` | the file itself |

An hour of work, not a blocker — but *"they are not in conflict, take both"*
reads as though the ring costs nothing to keep, and the brand book currently
**teaches** it as canon. Leaving that unrevised is how a kit starts disagreeing
with its own product, which is the failure mode `M12` already flags.

**2 · The stack ships as a family, not a file.** The comparison's own fix for
16px is a "nudged" variant with widened gaps below 24px. Two optical masters is
completely normal for a real identity — it also means someone maintains both
forever, and every surface that draws the mark by hand is one more place it can
drift. The ring was one stroke at every size. The scorecard marks this as a loss
and then drops it before the verdict.

Neither cost changes the answer. Both should be in the answer.

---

## The reframe that resolves it cleanly

Adopt the stack as the mark. Then **retire the ring as an identity and keep it
as what it always actually was — the GO control.**

The ring's problem was never that it's a weak shape. It's that **a UI element
was doing double duty as a logo**, which is exactly why it needed special
pleading to wear amber. Demote it and both systems get simpler at once:

- Amber leaves the identity system entirely. The rule stops having an exception
  to explain, in the one place a rule is most visible.
- The GO ring keeps its amber for the only honest reason — it is live and making
  sound.

---

## If adopting, the actual worklist

1. `brand/assets/mark.svg` — replace with the stack, ink (`#e8e4f0`) on the dark
   plate. Keep the "never on white" note.
2. Add `brand/assets/mark-small.svg` — the nudged variant, and say in the file
   which size it takes over at.
3. Favicons in `app/index.html` and `site/index.html` — swap the data-URIs.
   **Static.** No per-band fill, no state.
4. `site/index.html` footer mark — swap.
5. `brand/index.html` §01 — rewrite. It currently teaches the ring as canon; it
   needs to teach the stack, and say plainly that the ring was demoted to the GO
   control and why. The *reasoning* is the valuable part to preserve.
6. Leave the wordmark alone. The comparison is right that the didone caps at
   `.28em` are load-bearing — the app's masthead already sets them, and changing
   the type would make the running product wrong on day one.

---

*Written by a review session, not the session that made the comparison. Where
this and `mark-comparison.html` disagree, the disagreement is deliberate and
argued above — resolve it, don't average it.*
