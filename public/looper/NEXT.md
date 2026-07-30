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

### 3. Count-in and section markers for loop mode

For practicing long forms, knowing where you are matters more than the chord
name. A 32-bar form needs a visible A/B/bridge structure, not 32 identical
blocks.

### 4. A fourth pad, and a darker one

Felt is the workhorse. Glass and Vox are both fairly bright. Something with
more low-mid weight — closer to a bowed string pad — would cover the case where
someone is practicing over it for an hour and wants less air.

### 5. Progression import

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
