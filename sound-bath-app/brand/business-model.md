# The business model

Rewritten 2026-07-31 around Adam's paywall line, which is better than the one
this note originally proposed. What changed and why is recorded at the bottom.

---

## The one line

> **Watching is free. Making is paid.**

You can follow a session forever without an account. The moment you build and
keep your own sessions, you're a practitioner — and practitioners pay.

---

## Where the paywall sits, and why there

**At authorship — not at sync.**

Creating a session *is* the product. It's where the fifteen minutes happen,
where the arc and the keys and the poem get decided, and where every hour of
engineering in this app has been spent. Charging there is charging for the
thing.

| Paywall at | Who pays | When revenue starts |
|---|---|---|
| Rooms / sync | only people running groups | after sync ships and gets adopted |
| **Authoring** | **everyone who leads** | **today** |

Free-to-consume, paid-to-create is a well-understood shape — Figma, Canva,
Ableton. Followers stay free either way, so the growth loop is untouched.

---

## Why recurring, not one-time

The market is small and finite. That is what decides it.

Assume ~3,000 serious practitioners and 20% conversion over five years — 600
customers.

| Model | Five years | Year six |
|---|---|---|
| One-time at $300 | **$180k total** | **$0.** The market is sold. |
| Annual at $149 | ~$89k/yr, growing | **still ~$89k/yr** |

**In a finite market, one-time is a ceiling and recurring is an annuity.**

That inverts BOOK's instinct, and the inversion is legitimate: BOOK reasoned
from a product with no ongoing costs. There is now a relay to run, a network to
curate, calibration data to maintain and packs to make. **Charging recurrently
for things that genuinely recur is honest; charging recurrently for a file you
own is not.**

**The churn objection is about *monthly*, not about *recurring*.** Someone who
plays five times a year and pays monthly spends seven months paying for
nothing, and cancels correctly. The same person renewing once a year — around
when they plan their season — is entirely natural. Gear, insurance and studio
time already work that way.

---

## The tiers

| Tier | Price | What it is |
|---|---|---|
| **Follow** | **free, no account** | The follower sheet, forever — plus **run every session that ships with the app**. A real demo, not a teaser. |
| **Season** | **$149/yr** (or $19/mo) | Unlimited sessions of your own. Rooms — sync and follower devices. **A new curated session every month.** The network. |
| **Perpetual** | **$400 one-time** | The instrument, kept: author, save and perform solo, forever, on the version you bought. No rooms, no new packs. |

**The Season/Perpetual split is honest rather than arbitrary.** Rooms need a
relay and packs need making, so those are a *service* and recur. Authoring
locally needs nothing from us ever again, so it can be owned. **Perpetual is
the instrument; Season is the instrument plus the service.**

Perpetual is a **pressure valve, not a concession** — a higher number that
gives a subscription-hostile buyer somewhere to land instead of walking away.
It must sit at **2.5–3× the annual**, or everyone buys once and leaves.

---

## The retention mechanism is the same thing as the paywall

This is what makes the model unusually sturdy.

**A practitioner with twelve sessions built over three years does not cancel.**
Not because of features — because their work lives there. The thing you charge
for (authoring and keeping sessions) is the same thing that makes renewal
obvious. Those are normally two different problems.

### The condition that keeps it ethical

**First, what export actually is.** A session file — a few kilobytes of JSON:
sections, phrases, chakras, minutes, lane blocks. Not audio. The app already
says it: *"a few kilobytes of parameters, never audio."* Export must always be
free, always work, and never be degraded, including on the free tier.

**But export alone is a weak guarantee, and it shouldn't be oversold.** A JSON
file with no Bed to open it is a record, not a working instrument. You'd keep
your *work* but not your *tool*.

**The genuinely fair version is a perpetual fallback.** After twelve months
paid, the practitioner keeps the right to author, save and perform **locally,
forever, on the version they had.** Rooms stop — that's a relay we pay to run.
New packs stop — we have to make them. The instrument they paid for does not
stop.

| If they stop paying | They keep | They lose |
|---|---|---|
| Before 12 months | Export of everything; the free tier | authoring beyond one session |
| **After 12 months paid** | **Author, save, perform — forever, that version** | rooms, new packs, the network |

This costs less than it's worth. For a buyer who spends $800 on a bowl and
expects to own it, **it changes a subscription from renting into buying** —
which for this audience is close to load-bearing. It is also the JetBrains
model, which has held for years against a famously subscription-hostile
professional audience.

Retention through accumulated value is legitimate; retention through
hostage-taking is not, and the difference is whether the door is open.
**People who can leave mostly don't.**

### Audio export — a considered no

A WAV or MP3 render of a session **is the playlist we're competing with.** It
can't hold, can't jump, can't respond to the room — a strictly worse version of
our own product, infinitely shareable, and it would quietly become the thing
people pass around instead of buying. BOOK refused audio in packs for the
adjacent reason: *it would break key migration on first purchase.*

*(A microphone recording of the actual night — real bowls, real room, real
people — is a different thing entirely and is fine. That's a memento, not a
substitute.)*

---

## The flywheel

```
the network makes sessions happen
        ↓
each session puts Bed in ten hands, for fifty minutes, in candlelight
        ↓
some fraction of those hands want to make their own
        ↓
they hit the authoring paywall — at the exact moment they want to lead
```

Every step is a physical event in a room, not a marketing assumption. BOOK saw
the middle of it: *"nine practitioners experience the app from the inside every
session, and some fraction will want to lead their own."*

**The paywall lands at the moment of highest intent**, which is the only place
a paywall ever works.

---

## Never charged for

- **Following.** Follower devices are the marketing. Charging per seat would be
  charging for your own distribution.
- **Export**, and **the perpetual fallback after twelve months paid.** Together
  they are what make the retention honest.
- **The introduction.** Charge for the instrument, never for the connection.
  Couchsurfing's asset was trust and it damaged itself monetising that trust
  directly; this is the same asset and the same trap.

---

## The numbers, and the anchoring rule

Treat these as the anchor for test #2, not a decision. No price survives ten
real conversations.

**What this buyer already spends:** a crystal bowl $200–800 (BOOK: up to
$2000) · a gong $500–2000 · a mallet set $60–100 · a powered speaker
$500–1500. **One event grosses 40–100 × $25–45 = $1,000–4,500.**

At $149/yr, a practitioner playing five times a year pays **~$30 per event —
under 3% of one event's gross**, and less per year than a mallet set.

### The rule that matters more than the number

**Always present it next to gear, never next to software.**

Beside a bowl, $149 a year is obviously cheap. Beside an app, it's expensive.
Same number, opposite reaction, and the framing is entirely ours to choose.
This is why the descriptor is *an instrument for holding space*, and why BOOK
insists on **a rig, not an app**: *"nobody pays four figures for software they
open on a phone; they do pay it for a system."*

The corollary is the ceiling — **software alone cannot be four figures here.**
The sub is what would make a bigger number legible, which is the honest
commercial reason the rental and speaker-tuning work matter.

### Other lines

- **LED pads** — $70 each, $400 for seven. Sold as a set; practitioners light
  the whole arc, not one bowl. Real hardware margin, ships anywhere.
- **Sub rental** — $100/event, local only. BOOK's figure. The point was never
  revenue: *"whoever rents twice is a real customer."*

---

## The risks, stated plainly

- **The free tier may be too thin.** Follow-plus-one-session might not be
  enough to evaluate. Watch it closely; a 14-day full trial is the fallback.
- **The Season must keep delivering.** A year with no new packs and no new
  features makes non-renewal *correct*, and the buyer will be right.
- **Two SKUs forever**, and Perpetual cannibalises if priced too close.
- **Marketing never stops** — but far less than under one-time, which is the
  point of the change.
- **A small market caps the ceiling.** BOOK: *"a few thousand practitioners at
  a few hundred dollars is a genuinely good business and a genuinely terrible
  venture business."* Still the reason not to raise. Recurring makes it a
  better small business; it does not make it a venture business.

---

## What to test, in order

1. **Can a first-timer reach a runnable 50-minute structure in fifteen
   minutes?** BOOK calls it a hard spec — if not, the positioning collapses.
   Costs nothing and settles the most load-bearing claim in the product.
2. **Will ten practitioners pay $149/yr?** Not a survey. A price.
3. **Does a follower become an author?** The one number the flywheel rests on.
   Visible the first time a session runs with real follower devices.
4. **Buyer eleven.** *"Ten warm sales validate your relationships, not a
   market."*

---

## Amended by the monthly session

See [`the-monthly.md`](the-monthly.md). Two changes, both improvements:

- **Packs are superseded by the monthly.** A new curated session each month —
  authored by a named practitioner — is a better subscription payload than
  packs sold or bundled: a rhythm, an announcement, and twelve marketing beats
  a year that feature a person rather than the software.
- **The free tier becomes "run everything that ships."** A genuinely working
  demo rather than a one-session teaser, which moves the paywall onto the
  emotional moment — wanting *your* arc, *your* poem, *your* name on it — and
  off an artificial limit.

---

## Superseded — what this rewrite changed

- **"Solo is free forever" is withdrawn.** It was a growth argument dressed as
  a brand argument. The brand promise is *"files you own, no account"* — that
  is about **sovereignty, not price**. Ableton costs $750 and your files are
  still yours. Free authoring was never required by the brand.
- **The paywall moved from sync to authorship.** Bigger paying population,
  revenue that doesn't wait on sync adoption, and it lands at the moment of
  highest intent.
- **Packs are included in the Season rather than sold separately.** A
  subscription has to visibly deliver something new or it reads as a toll, and
  quarterly curator packs are that. It also converts packs from lumpy
  transactional revenue into the reason renewal feels obvious.
- **One-time-only is withdrawn** as the primary model, on the finite-market
  math above. It survives as Perpetual — deliberately priced as the expensive
  option.
