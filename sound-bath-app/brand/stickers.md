# The stickers

2026-07-31. Adam, after a long lap through numbering theory, arriving at the
point:

> *"The whole reason I went down this path — we should have stickers. If people
> have to think 'this is C, this is D, this is E', for some people that's hard,
> that's mental work during a sound bath. But a little sticker on the side that
> says 1 2 3 4 5 6 — you could show up at your first sound bath knowing nothing,
> talk to no one, and crush it. If someone gets the numbers wrong, people aren't
> in sync. The whole thing runs off the number system. That's what allows it to
> sync. So you have to treat the number system seriously — which means stickers."*

**This is the strongest small idea in the product, and it isn't merchandise.**

---

## ⚠️ Why this is infrastructure, not a keychain

Bed's entire output is numbers. `2 6 (3 5 7) [1, 4]` on forty phones. Those
numbers are worth exactly nothing until they point at physical objects, and
right now **the pointing is done in the player's head, silently, under
pressure, in the dark.**

Which makes it the weakest link in the whole chain:

| Link | If it breaks | Who notices |
|---|---|---|
| The relay | no cue arrives | immediately, loudly |
| The QR | nobody joins | immediately |
| **A person's mental map of their own bowls** | **they play the wrong bowl, confidently, all night** | **nobody. Ever.** |

Same failure shape as everything else in
[`things-only-machines-read.md`](things-only-machines-read.md), except the
component is a human being holding a mallet. **The sticker turns the one
uncheckable input in the system into a printed, permanent, verifiable one.**

> ### You don't validate the calibration. You supply it.

---

## What it unlocks — Adam's real point

> *"You could step in for the first time and crush it, knowing nothing, having
> to not talk to anyone."*

That is the on-ramp in one sentence, and it's the same person
[`you-dont-need-seven-bowls.md`](you-dont-need-seven-bowls.md) is about. Today
a first-timer needs to know the notes of their bowls before Bed says anything
useful to them. With stickers they need to know **nothing** — apply eight
stickers once, then read a number and hit that bowl.

**And it makes the room speak one language.** Everyone with Bed stickers has
the same 1. That's not a convenience; it's the difference between a shared
vocabulary and forty private ones.

---

## ✅ The thing that makes this sing — it's already true in the code

There's a comment sitting in `app/index.html` that nobody has ever said out
loud in marketing:

```js
/* Bowl number = chakra number = scale degree in C, all three at once.
   The UI never asks for a key — it asks for a chakra and derives it. */
```

**One number is three things simultaneously.** The sticker on the bowl says
`3`. That is:

- your **third bowl**
- the **Solar Plexus**
- the **third of the key**

The person never learns any of it. They read a number and hit a bowl, and they
are correct on all three axes at once. That's the sticker's copy line and it's
the honest description of the design:

> ## One number. Your bowl, your chakra, your note.
> ### Learn nothing. Play right.

---

## ⚠️ Applying them wrong is a silent failure — so the sheet ships with a check

If someone stickers their bowls out of order, **everything Bed says becomes
confidently wrong and nothing complains.** That is precisely the class of bug
this repo now has a standing gate for
([`how-this-gets-decided.md`](how-this-gets-decided.md) § 6b), and the gate's
answer applies unchanged: *read it back before you trust it.*

So the instruction printed on the sheet is two lines, and the second one is the
gate:

> **1 is your lowest bowl. Work up from there.**
>
> **Then play them 1 → 8 in order. It should sound like a scale going up.
> If it doesn't, they're on wrong.**

A human ear doing a read-back check. It takes fifteen seconds, it requires no
musical knowledge whatsoever — *does it go up?* — and it catches every possible
mis-application. **Nothing ships without it printed on the sheet.**

---

## ⚠️ The sticker forces the numbering decision

[`numbering-and-tuning.md`](numbering-and-tuning.md) left one question open:
does `3` mean *your third bowl* (positional, what the app does today) or *E*
(absolute)? The recommendation was to decide when the first non-C kit turns up
in a real ensemble.

**Stickers end that grace period**, because a sticker is permanent and a
person's bowls get labelled exactly once. You cannot ship them and keep the
question open.

The way through is narrow and clean:

> **Ship the first sheet for C major sets — where positional and absolute are
> the same numbers — and say so on the sheet.**

For a C major 7 or 8 set, 1=C, 2=D, 3=E … under either system. The decision is
deferred honestly rather than dodged, the sheet is correct for what Adam
estimates is nearly everyone, and a D-set owner needs a different sheet later —
by which time there'll be real evidence about what to print on it.

⚠️ **Do not print a general-purpose sheet that claims to work for any kit.**
That's the version that quietly bakes in an unmade decision.

---

## The design

Drawn in [`assets/stickers.html`](assets/stickers.html) — open in a browser;
it prints to A4 at true size.

| | |
|---|---|
| **Size** | 18 mm circles. Big enough to read at arm's length in candlelight, small enough to disappear on a bowl. |
| **Colour** | Violet-black number on moonlight — the same pair as the QR card, for the same reason: it's the palette and it has the contrast. |
| **⚠️ Not amber** | Amber means *live and making sound*. A sticker is not sounding. It never wears amber, on a screen or off one. |
| **⚠️ Not chakra colours** | Red/orange/yellow are a different colour system, they're warm — which the room kills — and orange sits close enough to amber to muddy the one rule the brand has. A cool position ring is offered instead, encoding *order*, not a claimed correspondence. |
| **Placement** | Outer wall, upper third, facing the player. **Never the rim** — that's the striking and rubbing surface, and a sticker there wears off, gets hit, and touches the part that actually vibrates most. |
| **Range** | 1–8. Eight is the octave root, which the standard-8 kit already has. |

### Open questions for the print run

Not decisions I can make from here — they need a supplier and a real bowl:

- **Material.** Matte vinyl, not gloss: gloss catches candlelight and flashes.
- **Adhesive.** Must come off a customer's instrument without residue. This
  matters more than it sounds — these go on objects people love.
- **Acoustic effect.** An 18 mm sticker on the outer wall is almost certainly
  inaudible, but *almost certainly* is not the standard for something we hand a
  practitioner. **Test it before selling it:** record a bowl, apply, record
  again, compare decay and pitch. If there's any measurable damping, move to a
  thinner film or a smaller size.

---

## Where it sits commercially

Cheap to make, near-free to ship, and it is the one piece of merchandise that
is *also* onboarding. Compare it to the list in
[`eye-masks.md`](eye-masks.md): the mask is a lovely object for the room, and
the stickers are the thing that makes the software work.

- **In the box / in the post with the first subscription.** They are the
  physical setup step, so they belong at the start, not in a shop.
- **A handful at every workshop** ([`the-workshop.md`](the-workshop.md)) —
  everyone leaves with their bowls labelled, which means everyone leaves able
  to join anyone's session.
- **⚠️ Don't sell them alone as a first product.** Stickers without Bed are
  stickers. Bed without stickers is a language nobody speaks.

And the quiet thing: **once someone's bowls are numbered, a competitor's app
has to ask them to relabel their instrument.** That's not why to do it, but it
is true.

---

## The rule

> ## The app's output is numbers. The numbers are worthless until they're on the bowls.
> ### So put them on the bowls, and make the person prove they're on right.
