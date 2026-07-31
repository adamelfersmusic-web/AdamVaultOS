# Speaker and room tuning — "Bed knows this speaker"

Development of the idea sketched in [`hardware-strategy.md`](hardware-strategy.md).
The short version there: **don't sell the speaker — know it.** This is what
knowing it actually means, in three tiers of increasing ambition, all of which
degrade safely to the one below.

---

## Why this is the highest-leverage thing on the list

The Deep band is the only thing in this product that nothing else in the space
has. And it is the *one* band whose delivery depends entirely on equipment
nobody controls. Everything above 200 Hz plays fine on anything. The floor
either arrives or it doesn't.

So the differentiator has a **hardware dependency**, and until today it was
handled by a toggle asking a question nobody could answer. Every tier below is
about removing that dependency without owning a warehouse.

It also compounds commercially: **"Bed is tuned for this speaker"** turns an
affiliate recommendation from a tax into a service, works in every city
simultaneously, and is a software moat on a hardware problem. A competitor
can't copy it without redoing the measurement work.

---

## Tier 1 — Pitch-scaled reinforcement · **shipped 2026-07-31**

```js
subReinforce(hz) = clamp((70 - hz) / 30, 0.15, 1)
```

Full missing-fundamental reinforcement near 40 Hz, where almost nothing in a
yoga studio reproduces the fundamental; nearly none by 70 Hz, where most
speakers do. Updates on every key migration, so the floor is never wrong by an
octave mid-session.

**Handles:** the fact that the sub moves between 38–74 Hz with the key.
**Doesn't handle:** *which* speaker is in the room.

---

## Tier 2 — Speaker profiles

A profile is a handful of numbers — the model's low-frequency rolloff and
slope:

```js
{ id: 'qsc-ks112', label: 'QSC KS112',  f3: 41, slope: 24, trust: 'measured' }
{ id: 'bose-s1',   label: 'Bose S1 Pro', f3: 62, slope: 18, trust: 'spec' }
{ id: 'phone',     label: 'Phone or laptop', f3: 300, slope: 12, trust: 'spec' }
```

Then reinforcement is computed against what the speaker can *actually deliver*
at the current key, rather than against a generic curve.

**Where profiles come from:** manufacturer specs publish ±3 dB points, which is
a free starting point. Real measurement refines the ones people actually own.
Ten or fifteen models covers most of this scene — the S1 Pro, a couple of JBL
EONs, a QSC or two, "a phone," "a laptop," "a real sub."

**Why asking is legitimate here, when the old toggle wasn't.** The retired
toggle asked *"does your speaker reach 40 Hz?"* — nobody knows that. A picker
asks *"what speaker is that?"* — and the answer is written on the front of it.

> **The rule: ask what they can see, never what they'd have to measure.**

That distinction is worth keeping as a general principle for this product.

**Cost:** a list, a picker in Ensemble, and one extra term in the curve. It is
genuinely small.

---

## Tier 3 — Let the app listen to the room · *the interesting one*

Before anyone arrives, the app plays a slow sine sweep through the actual
speaker, listens on the phone's own microphone, and computes what came back.

**One 60-second step during setup answers everything at once:** which speaker,
where it's placed, how the room's modes behave, and whether the corner it's
sitting in is adding 6 dB. No picker, no list to maintain, no question at all.

**It also fixes the Floor control.** Right now Floor is set by ear. With a
measurement, the app can *propose* a starting point — and the leader still
overrides it, because law 3 says a human's hand always wins.

### The honest engineering problems

Worth stating plainly, because this is the tier that could quietly not work:

- **Phone mics are not measurement mics.** They roll off low and have their own
  response curve. Mitigated by the fact that we don't need absolute accuracy —
  we need *relative*: "is there anything at 45 Hz, and how much less than at
  200 Hz?" A phone can answer that.
- **Voice processing is the real enemy.** Phones apply AGC, noise suppression
  and aggressive high-pass by default — which would eat exactly the band we're
  measuring. Must request `{ echoCancellation: false, autoGainControl: false,
  noiseSuppression: false }` and **verify it actually took effect**, because
  iOS has historically ignored these.
- **Room modes make it position-dependent.** Not a flaw — measure from where
  the people will be lying, which is the answer you actually want.
- **Mic permission is a real ask** in a market suspicious of technology.
  Framing matters: *"let Bed hear the room once"* during setup, never during a
  session, and say plainly that nothing is recorded or sent anywhere. It is
  true: the analysis is local and the audio is discarded.

### Why it degrades safely

If the sweep fails, is refused, or looks implausible, fall back to Tier 2. If
there's no profile, fall back to Tier 1 — which is already shipping and already
correct. **Every tier is an improvement on a floor that already works**, so
none of this is load-bearing.

---

## What to build, in order

1. **Tier 2 profiles** for the ten or fifteen speakers this scene actually
   owns. Small, safe, immediately useful — and it's what makes the affiliate
   recommendation honest.
2. **A "Bed is tuned for this" page** listing them. That page *is* the speaker
   play from `hardware-strategy.md`: it works in a city you've never visited.
3. **Tier 3 as an experiment**, measured against known speakers before anyone
   is asked to trust it. Ship only if it beats the picker.

---

## The line

**Tier 1 makes the floor survive a bad speaker. Tier 2 makes Bed know the
speaker. Tier 3 makes Bed know the room.** Nobody else in this space is
solving a problem they haven't noticed they have.
