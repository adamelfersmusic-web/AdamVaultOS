# Hardware — what Bed should and shouldn't make

Decided in conversation 2026-07-31. Records a real fork, so nobody is tempted
by a factory quote later.

---

## Not speakers

The instinct is right — **own the sound** — but manufacturing is the wrong
mechanism, and the economics are unusually brutal for this specific product:

- **A sub is heavy.** Freight is $50–100 each way and speaker damage rates are
  high. Every return costs the unit *plus* two-way shipping.
- **MOQs are hundreds of units** — capital in a warehouse instead of in the film.
- **You'd compete with JBL, Bose and QSC at their core competence**, against
  thirty years of amortised tooling.
- **Margins invert.** Software ~95%; hardware ~30% and negative until scale. It
  quietly becomes a different company.

BOOK reached the same conclusion independently: *"Never manufacture a speaker —
heavy freight plus damage economics eats small companies."*

## The speaker play is information, not inventory

**Renting only works where you have gear and hands** — one city, maybe two. But
subs aren't scarce: every city has PA rental, backline rental, and venues that
already own one. **What's scarce is knowing.** A bowl practitioner doesn't know
they need one, what to ask for, what it costs, or how to plug it in.

That's an information problem, and information scales where inventory doesn't.

| Reach | Move |
|---|---|
| **Everywhere, day one** | The spec and the sentence: *"Ask for a powered 12-inch sub — a QSC KS112 or equivalent. ~$40–60 for the night. One cable from your laptop."* Works in a city you've never visited. |
| **Where you have contacts** | Rent for real. **The point was never revenue** — BOOK: *"whoever rents twice is a real customer."* It's market research with a price tag, and a dozen people is enough signal. Your own scene is the correct size. |
| **Later, at scale** | **Local legends become the depot.** BOOK already named them as the affiliate layer: the biggest practitioner in each regional scene already owns gear and already lends it informally. You enable it, you don't operate it. |

**The multiplier: calibration.** `subReinforce(hz)` is already a curve. Make it
per-model and the recommendation stops being generic advice and becomes *"Bed
is tuned for this one."* That's a software moat on a hardware problem — it
ships as a few numbers, works in every city simultaneously, and makes an
affiliate link legitimate rather than a tax. **"Bed knows this speaker" is more
defensible than "Bed makes this speaker."** Worked out in three tiers —
pitch-scaled (shipped), speaker profiles, and letting the app listen to the
room — in [`speaker-and-room-tuning.md`](speaker-and-room-tuning.md).

---

## Yes to lights — LED bowl pads

If anything carries the brand physically, this is it. BOOK flagged it; the
sync build made it concrete.

**The economics invert.** A pad is a pound or two, ships for a few dollars,
barely breaks, and carries real margin. Everything that makes a sub a bad
product makes a pad a good one.

**Demand already exists.** Practitioners already buy LED pads. This takes an
existing line item rather than inventing one.

**And only Bed can make a good one.** Every pad on the market is dumb — an IR
remote, a colour cycle, a fade. A pad that **knows what section the room is in**
is a categorically different object, and it is not copyable without the engine
behind it.

### The architecture already exists

`section:change`, `key:migrate` and `fade:start` have ridden the cue bus since
day one — *"follower views, lights and projection are all just subscribers to
this stream."*

**The pads join the room with a code, exactly like a follower phone.** A cheap
wifi board subscribing to the same state stream the sheets ride. No pairing, no
Bluetooth, no permissions, no app. **The sync shipped on 2026-07-31 is the
lighting system**; a pad is one more listener.

*(This also sidesteps Web Bluetooth, which doesn't exist on iOS Safari — a
dealbreaker when the leader is on an iPad.)*

### What it does to the brand

The section arc stops being a colour system on screens and becomes **the actual
light in the room** — Ground indigo, Wash teal, Bloom rose. It works because
those nine hues were chosen cool *for a candlelit room* in the first place. The
brand was already designed for this without knowing it.

**Constraint:** pads carry **section** colour, never amber. Amber means live and
making sound, and that rule holds in physical light exactly as it holds on
screen.

### Sequencing — software first, as always

1. **Control what's already in the room.** Support common LED products before
   making anything. Proves the idea with zero inventory.
2. **Badge an OEM pad** with a wifi board and Bed's branding. Not manufacturing
   from scratch — the same recommend → affiliate → bundle ladder, one rung further.
3. **Only then** consider anything bespoke.

---

## The one-line version

**Don't sell the speaker — know it. Do sell the light — because it's the only
hardware where the product's architecture is the moat.**
