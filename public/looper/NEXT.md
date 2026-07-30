# Pedal — what's next

The practice looper for improvisers. **A separate product from the sound bath
app** (`/sound-bath-app/`) — different user, different room, different problem.
They share nothing but a synthesis approach, and should stay that way.

**Live:** `/AdamVaultOS/looper/`
**Source:** `public/looper/index.html` — one self-contained file, no
dependencies, no build step, works offline.

---

## What it is today

Drone-first practice tool. Open it, hit play, an A drone holds indefinitely.
Bars are a mode you opt into, not the default frame.

- **Drone mode** (default) — 12 roots, three voicings, no bar counter anywhere.
  Root changes glide via portamento instead of restarting.
- **Loop mode** — chord progressions with proportional form blocks, live
  playhead, nearest-voice voice leading between chords.
- **Three pads** — Felt (soft-detuned saws under a breathing dark lowpass),
  Glass (low-index FM plus independently blooming sine partials), Vox
  (triangles through drifting vocal formants).
- **Kit** — clean sine-drop kick, banded-noise shaker, three-resonator rim.
- **Six grooves** — Click, Floor, Back, Dust (swung, humanized), Bossa (true
  bossa clave over the surdo foot pattern), Songo (son clave 2-3 with tumbao
  anchors). Any voice mutes out of any groove.
- Tap tempo, wake lock, state persisted to localStorage.

---

## The one open question

**Nobody has listened to it on real speakers yet.**

It was built and metered, never heard. The whole differentiator is "this sounds
good enough that you'd leave it running for an hour," and that claim is
currently unverified. The failure mode is *fatigue*, which does not show up in a
thirty-second audition — it shows up at minute twenty.

Everything below is speculative until that listen happens.

---

## What to build next, in order

### 1. Fix whatever the listen turns up

Priority zero. Every item below is worth less than a good-sounding pad.

Known from the sound bath engine, likely present here too:
- **Level-dependent brightness.** The reverb send is post-fader and the reverb
  is high-passed, so turning a bus up adds proportionally more mid-and-top
  content and the timbre shifts as you move the fader. Fixed in `bed.html` by
  tapping the send pre-fader and backing the glue compressor off; the same fix
  applies here.

### 2. Shareable state in the URL

The single highest-leverage feature for distribution, and small.

A teacher sends `…/looper/#A/fifth/felt/bossa/96` and the student lands on
exactly that setup. Same for a progression. No account, no save, no backend —
the URL *is* the save file.

This directly addresses the real risk: not that nobody wants it, but that
nobody finds it. Every shared link is a demo that arrives already configured by
someone the recipient trusts.

### 3. Capture — record the session, not the loop

**One button that records everything** — drone, kit, and mic — straight to a
file while you play. Multiple takes, saved simply, no naming, no organising.

This is the flow-state feature. The value isn't fidelity, it's *"what was that
thing I just played?"* — and it has **no latency requirement at all**, because
nothing is layered back in real time. That makes it roughly a tenth of the work
of true looping with none of its problems.

**True overdub looping is a separate, later, harder feature.** It collides with
the one thing that makes this work on a phone: drones tolerate Bluetooth
latency, loops do not. If you record over a playing drone, what you hear arrived
150–200 ms late, so your take lands that far behind — and every overdub
compounds it. That's fixable only with a real calibration step (play an impulse,
capture it back, subtract the measured round trip), and it needs to exist before
the feature is usable on anything but wired headphones.

Two more phone-specific traps for whenever that gets built:

- **Browsers default `getUserMedia` to speech processing.** Echo cancellation
  actively ducks your instrument whenever the drone plays, noise suppression
  eats sustained tones, and AGC pumps. All three must be explicitly disabled,
  and some phones apply processing you cannot turn off.
- **Internal mic plus speaker is a feedback loop**, and a sustaining drone is
  the worst possible case for it.

So looping ships as a mode you *enter*, with a stated setup (headphones or an
interface) and a calibration tap — never as something that changes the front
door. The front door stays "open it, press play."

### 4. Count-in and section markers for loop mode

For practicing long forms, knowing where you are matters more than the chord
name. A 32-bar form needs a visible A/B/bridge structure, not 32 identical
blocks.

### 5. A fourth pad, and a darker one

Felt is the workhorse. Glass and Vox are both fairly bright. Something with
more low-mid weight — closer to a bowed string pad — would cover the case where
someone is practicing over it for an hour and wants less air.

### 6. Progression import

Not a chart library — that fight is unwinnable, iReal Pro's moat is thousands
of user-entered tunes. But **paste a chord line** ("Dm7 G7 Cmaj7 | Am7 D7 Gmaj7")
and have it parse. Turns a two-minute entry job into five seconds, without
pretending to compete on catalog.

---

## Explicitly not doing

- **A tune library.** Unwinnable, and it's not the wedge. The drone side is.
- **Notation, piano diagrams, theory explainers.** The user already knows.
- **Accounts, sync, cloud.** A URL and localStorage cover the whole need.
- **More grooves.** Six curated beats twenty. If a groove gets added, one gets
  cut.

---

## Positioning notes

### The value prop, in one sentence

> **Opening a DAW puts you in producer mode. This keeps you in improviser mode.**

That's the whole thing. Drones are how musicians practice, *and* drones are how
you get into a flow state — and the enemy of flow is the twenty minutes of
setup, routing and decision-making that a DAW demands before a single note
happens. Producer mode and jam mode are different mental states, and the cost of
switching between them is the actual problem this solves.

Which means **speed of setup is the product**, not a feature of it. Every design
decision gets measured against: does this get someone playing faster, or slower?

Corollary: keep the grooves few and basic. Better grooves, not more grooves —
adding one means cutting one. A groove menu is a decision, and decisions are
producer mode.

### Why the drone, not the progressions

The drone side is the wedge, not the progression side. Almost everyone building
this makes a chord player and bolts a drone on as a degenerate case — one chord,
infinite length. Inverting that is the whole idea, because tonic-relative
hearing is the actual skill and a drone is the only way to isolate it.

Existing options fail in specific ways worth remembering:
- iReal Pro is clumsy at holding one thing forever.
- Tanpura apps are timbrally committed to Indian classical — perfect inside that
  tradition, useless if you want a neutral pad.
- Hardware workarounds (hold a pad, hit sustain on a looper, carry a freeze
  pedal) are all worse than a phone.

And there's a technical reason a phone genuinely wins here that doesn't apply to
most music apps: **drones have no latency requirement.** Bluetooth's lag makes a
metronome unusable and a drone completely unaffected. So "pull it up, Bluetooth
to whatever speaker is in the room, hit play" isn't a compromise — for this one
use case it's strictly better than a hardware rig.

**Audience:** anyone working intonation against a reference — horn players,
singers, strings, bass — plus the very large population of guitarists who want
something to noodle over, plus teachers who'd send a link.

**The real risk is discovery, not demand.** The one differentiator is the
hardest thing to convey secondhand: "sounds better" survives neither a
screenshot nor a feature list. Someone has to press play with decent headphones
on. That's why #2 above matters more than its size suggests.
