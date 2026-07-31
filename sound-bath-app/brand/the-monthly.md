# The monthly session

Adam's idea, 2026-07-31, plus the reframe worked out with it. It changes the
subscription's payload and sharpens the free tier, so it also amends
[`business-model.md`](business-model.md).

---

## The buyer insight underneath it

> **Most practitioners don't want to design a session. They want to play their
> bowls.**

Designing is what Bed makes *possible* — it is not necessarily what the buyer
*wants to do*. BOOK observed the same thing from the other side: practitioners
build around four sessions a year and repeat them freely, because live cueing
and live players make every run different anyway.

**Variation happens at performance time, not design time.**

That is easy to miss when you've just spent weeks building the design tools.

---

## ⚠️ The frequency assumption is contested

BOOK says practitioners build *"somewhere between four sessions a year and one
every few months, and repeat them freely."* **Adam disputes this from the
scene:** the practitioners he knows are running these **monthly, or every few
weeks.**

This is a premise correction, and several decisions rest on it.

**If the real cadence is 12–26 a year:**

- **Staleness is a real problem, not a hypothetical.** Four a year you repeat
  freely and nobody notices. Twenty a year with an overlapping audience, you
  cannot.
- **A high-frequency practitioner is a *better* subscriber, not a worse one** —
  they are precisely the people who cannot design fast enough to keep up.
- **The economics improve sharply.** $149/yr over twenty sessions is **$7.50 a
  session.** It stops being a purchase decision.
- **Authoring matters more, not less** — the monthly alone won't feed someone
  playing weekly. The library, packs and authoring compound.

**Both numbers are probably true, of different people:**

| Segment | Cadence | What they need |
|---|---|---|
| **The flagship event** — 60–100 people, candlelit, ticketed | a few times a year | structure, ensemble, sync. It is a production. |
| **The regular practice** — 10–30 people, studio, semi-regular | monthly or weekly | **variety without work** |

Same product, different value proposition — and the second group is plausibly
the larger population *and* the better subscriber. That would be a meaningful
change to who the marketing addresses.

→ **Settled by the session review** ([[bed/08-session-review]] in the vault):
"how often did you play" is now one of the questions.

---

## What it solves

The open weakness in the subscription was: *what does a Season visibly deliver,
so that renewal feels obvious rather than like a toll?*

The answer was "packs." **A new session every month, ready to run, is better** —
it is a rhythm, an announcement, and precisely what this buyer wants: something
to play tonight without designing anything.

---

## The reframe — effortless, not imperceptible

Adam's first framing was *"something minimal, hardly noticeable — most of these
people aren't gonna notice."*

**That is the banned line turned inward at our own customer.** *"Your audience
can't tell the difference"* is forbidden because it holds the craft in
contempt; applying the same logic to our releases aims it at the person paying.
If the monthly differences are genuinely imperceptible, we are charging for
nothing and they will eventually feel it.

The correct target is not *imperceptible* — it is **effortless**:

> Different arc, different keys, different textures, different poem. **The
> practitioner absolutely notices** — they play different bowls, in a different
> order, reading a different sentence. The audience gets a different night. And
> it costs the practitioner zero work.

**Real variety, zero effort.** That is honest and it is a better promise.

---

## The version to build: each month is a practitioner's session

> *October — "Seeding and Watering the Soil," by [name], from their harvest
> moon night in Denver.*

One move, four jobs:

- **Genuinely different** — it is someone else's practice, not a parameter tweak
- **The curator packs** BOOK specified, on a schedule
- **Seeds the network** — being the October session is the ask that flatters a
  local legend into joining
- **Twelve marketing beats a year**, each featuring a *practitioner* rather than
  the software

**The hero stays the person, even in the release cadence.** That is the posture
holding at the level of the business model, not just the artwork.

### Cold start

BOOK already solved it: *"the house makes the first inventory — three or four
in-house curator identities is a populated shelf on day one without
pretending."* The two real sessions already seeded are the first two months.

---

## Ship four to six, not two

The app seeds two real sessions today. Going to five or six is nearly free and
does two things:

1. **It makes the free tier a real demo** rather than a teaser.
2. **It fixes the on-ramp, because editing beats creating.** Starting from a
   session someone actually played is far less intimidating than a blank
   timeline, and it teaches the format by example. The wizard exists for this,
   but a real session is a better starting point than a generated one.

---

## What this amends in the business model

**The free tier changes**, and improves:

| | Was | Now |
|---|---|---|
| **Free** | follower sheet + one saved session | **follower sheet + run everything that ships** |
| **Season** | authoring, rooms, packs | **authoring, rooms, and a new curated session every month** |

Free becomes a genuinely working demo — they can run a real session tonight,
solo, forever. **The paywall then lands on the emotional moment rather than an
artificial limit:** the point at which they want *their* arc, *their* poem,
*their* name on it — or want to run it with other people in the room.

**Packs are superseded as a separate concept.** The monthly *is* the pack
programme, with a schedule and a name attached.

---

## Featured musicians — and why the sound can genuinely be theirs

Adam: *"imagine we feature a different musician on the pack — some beautiful,
dreamy electric guitar."*

**The architecture for this already exists in BOOK, and it beats sampling:**

> *"Wavetables for the Bed. `createPeriodicWave()` takes harmonic amplitudes and
> plays them at any pitch — sampled character, synthesised pitch, migration
> intact. Design a pad in a DAW, render a sustained note, extract its spectrum.
> A wavetable is a few hundred bytes, so a curator's signature sound ships as
> JSON."*

So a musician's pack can carry **their actual timbre** — the spectrum of that
guitar-through-pedals sound — and Bed plays it at any pitch, **migrating with
the room.** Not a loop. A named musician's sound, in a few hundred bytes, that
can still travel from C to F over thirty seconds.

That is what makes featured-musician packs a real product rather than a
marketing sticker: **their sound, their sections, their name.**

### The honest constraint

A wavetable captures a *sustained* tone's harmonic content, not behaviour. It
works for the Bed/drone lane; it will not capture picking, feedback swells or
tremolo. This is the same rule BOOK used to reject synthetic flute — *"needs
breath, tonguing and articulation... one bad voice cheapens the whole
palette."*

**Guitar as a pad: yes. Guitar as a melody: no.** Worth saying out loud to any
musician being invited, so the collaboration is scoped honestly from the start.

---

## The risk

**Twelve good sessions a year is a real content obligation.** Miss a few months
and non-renewal becomes correct. Mitigations: bank three or four ahead before
announcing a cadence, and make curation (someone else's session, lightly
produced) the default rather than authorship — which is the whole point of the
curator framing.
