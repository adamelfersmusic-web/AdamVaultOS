# Lumen — the arc, made physical

2026-07-31. Adam: *"section arc made physical — holy shit. If we could design
something that syncs with their flow this would be incredible."*

We can, and the first version costs nothing and exists today. What follows is
how it actually works, in three tiers, plus the one honest limitation.

---

## What makes this not a lighting product

**Lumen inherits the laws.** That is the whole differentiator, and it's why
nobody else in stage lighting can copy it — they'd have to want to.

| Law | What it means for light |
|---|---|
| **1 · No pulse ever** | It never flashes, never breathes to a beat, never chases. |
| **3 · No automated dynamics** | Brightness changes **only** when a section changes, or when a human's hand moves it. Nothing drifts on its own. |
| **5 · Never bright by default** | Every default errs dark. A sound bath room is lit by candles; a light that competes with the ceiling has already failed. |

Every other light on the market is trying to *do something*. This one holds
still and changes when the music does.

### The timing rule, and it's already written

A key migration takes **~30 seconds**, and the sub moves last and slowest.
**The light moves on the same clock.** Colour crossfades over the section
change, at the speed the room is already changing.

> **The light is never the first thing to move, and never the last thing to
> settle.**

---

## Tier 1 · A screen is a light · **buildable this week, costs nothing**

**Any old phone or tablet, face up beside a bowl, is a light.**

The follower view already receives section changes over sync. Add a **lamp
mode**: full-bleed section colour, no text, wake lock on, brightness pinned.
That's it — a follower device that shows colour instead of bowls.

- **Zero hardware, zero cost, zero risk.**
- **Works offline exactly as well as everything else** — followers already run
  on their own data or on BroadcastChannel.
- Every practitioner and every friend has a phone in a drawer.
- **It proves the entire concept before anyone builds anything.** If a room lit
  by eight old phones changing colour with the arc doesn't move people, no
  hardware would have.

**Do this first, no matter what happens with the rest.** It is a day of work and
it answers the only question that matters.

---

## Tier 2 · Real pads, and they join as followers

The trick that makes this cheap: **the pads don't need any new infrastructure —
they join the room exactly like a phone does.**

**WLED** is mature open-source firmware for ESP32 + addressable LEDs, and an
ESP32 can hold a `wss://` connection. So a pad:

1. connects to the same relay,
2. joins with the same four-character room code,
3. receives the same state snapshots the phones get,
4. reads `section.function` → the section colour, and crossfades to it.

**It is another follower. No local networking, no pairing, no app.**

| | |
|---|---|
| ESP32 + LED ring + diffuser + USB-C | **~$12–18 in parts** |
| Sells at | $70 each / $400 for seven *(the figures already in `hardware-strategy.md`)* |
| Firmware | WLED, with a small custom module — not a from-scratch project |

**Degradation is already designed.** A pad that loses the relay holds its last
colour — the same behaviour as a follower phone freezing on the last cue, which
`DEPLOY.md` already describes as *"exactly the printed handout it replaced."*
Nothing crashes, nothing goes dark mid-session, and the leader is never affected.

---

## ⚠️ The honest limitation, stated plainly

**Tier 2 needs internet in the room, and Bed's entire promise is that it
doesn't.**

Followers get around this by using their own cell data. A light pad can't. So:

- **Leader's hotspot** is the practical answer, and it works — but it's a step,
  and it's a step in a dark room five minutes before a session.
- **Web Bluetooth would solve it** — no internet at all — and **iOS doesn't
  support it.** In a market that is overwhelmingly iPhone, that's disqualifying,
  not inconvenient.

**Do not hide this.** The one part of the rig that needs a network is the one
part that isn't essential, and saying so plainly is more credible than
pretending otherwise. *"The sound never needs a network. The lights do."*

The offline fix is a **local bridge** — a small box that runs the relay itself
on its own wifi — which is a real product with real support burden, and it is a
Tier 3 problem, not a launch problem.

---

## Tier 3 · Later, if it earns it

- A local bridge, so the lights work with no internet.
- Per-bowl addressing: light **only the bowl the sheet is asking for** — the
  bowl-sheet already computes exactly that, per kit, per section. **In a room of
  eight players, everyone's next bowl lights up.** That is a genuinely new thing
  and it is pure software on top of hardware that already exists.

Note what tier 3 implies: **the light stops being decoration and becomes
notation.** That's the version worth building toward, and it's reachable from
tier 2 without new hardware.

---

## What to build, in order

1. **Lamp mode.** A day. Answers the only real question, costs nothing, and
   makes a room look extraordinary with junk drawer phones.
2. **Run it at the Ohio monthly** (`the-workshop.md`). Real room, real people,
   free footage. If it lands there, it lands.
3. **One WLED prototype pad**, driven by the relay, as a proof.
4. Seven of them, at one event, before a single word of marketing.

**Step 1 makes step 4 optional.** That's the point of doing it first — the
concept gets proven before the inventory exists, and if the answer is *"the
phones were already enough,"* that's a good answer too.
