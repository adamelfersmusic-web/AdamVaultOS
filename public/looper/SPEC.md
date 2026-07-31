# Pedal — full spec

A drone-first practice tool for improvising musicians.

**Live:** https://adamelfersmusic-web.github.io/AdamVaultOS/looper/
**Source:** `public/looper/index.html` — one self-contained file. No
dependencies, no build step, no network, works offline.
**Status:** shipped and **verified on real speakers.** v1 frozen at `/looper/v1/` for A/B.
Tiers 2–4 (see `ROADMAP-TIERS.md`) built and measured headlessly; frozen at
`/looper/v2/`, `/looper/v3/` and `/looper/v4/`, awaiting speaker listens.

> **A separate product from the sound bath app** (`/sound-bath-app/`).
> Different user, different room, different problem. They share a synthesis
> approach and nothing else, and should stay that way.

---

## 1. Why

### The value proposition, in one sentence

> **Opening a DAW puts you in producer mode. This keeps you in improviser mode.**

Drones are how musicians practice, *and* drones are how you get into a flow
state. The enemy of flow is the twenty minutes of setup, routing and
decision-making a DAW demands before a single note happens. Producer mode and
jam mode are different mental states and the switching cost between them is the
real problem being solved.

**Speed of setup is the product, not a feature of it.** Every design decision
gets measured against one question: does this get someone playing sooner, or
later?

### The pain

Every play-along tool for practicing improvisation sounds like a 2004 keyboard
demo. iReal Pro is functionally excellent and sonically embarrassing. The tone
*is* the product — if the pads aren't good enough that someone would leave them
running for an hour, nothing else matters.

And most practice happens **without bars.** An improviser working on ear
training wants one chord droning forever while they feel out where the tones
sit. Almost everyone building this makes a chord player and bolts a drone on as
a degenerate case — one chord, infinite length. Inverting that is the whole
idea, because tonic-relative hearing is the actual skill and a drone is the only
way to isolate it.

### Who it's for

A working improviser who has already made ghetto versions of this — exporting
30-second drones out of Logic and looping them on their phone for a decade. They
don't need to be taught theory. They need something that makes sound in two taps
and gets out of the way.

Concretely: anyone working intonation against a reference (horn players,
singers, strings, bass), the very large population of guitarists who want
something to noodle over, and teachers who would send a link.

### Why a phone genuinely wins

**Drones have no latency requirement.** Bluetooth's 150–200 ms lag makes a
metronome unusable and a drone completely unaffected. So "pull it up, Bluetooth
to whatever speaker is in the room, hit play" isn't a compromise — for this one
use case it is strictly better than a hardware rig.

Existing options fail in specific ways:
- **iReal Pro** — clumsy at holding one thing forever; its moat is a library of
  thousands of user-entered tunes, not its software.
- **Tanpura apps** — timbrally committed to Indian classical. Perfect inside
  that tradition, useless if you want a neutral pad.
- **Hardware workarounds** — hold a pad and hit sustain on a looper, or carry a
  freeze pedal. All worse than a phone in your pocket.

---

## 2. Design

**Aesthetic:** matte hardware. Warm graphite panels, hairline borders, near-
square corners, letterspaced micro-caps. A single amber that behaves like an LED
— it *only* ever means "this is sounding." Active states are an amber underline,
never a filled chip.

**Anti-references, explicitly avoided:** the iReal Pro / Band-in-a-Box look
(skeuomorphic, busy, cheerful, dated); generic "AI dark mode" (near-black plus
one acid accent, rounded cards, gradient headings); anything reading as a
music-theory teaching tool (no staff notation, no piano diagrams, no explainers).

**Motion is functional only** — showing position in a loop, showing what's
active. Never decorative.

**Layout:** single column, sticky transport at the bottom carrying the play
button and a plain-language readout of what's playing ("A · root + fifth /
Felt · 96 bpm · Bossa · full kit"). The wordmark carries a real LED that flashes
the pulse, brighter on downbeats.

---

## 3. What is built

### Modes

**Drone** (default) — 12 chromatic roots, three voicings, **no bar counter or
measure grid anywhere in this mode.** Changing root while running glides via
portamento on every oscillator rather than restarting. Voicings: Root (just the
tone), Fifth (root + fifth), Wide (octave weight).

**Loop** — chord progressions drawn as blocks with width proportional to
duration, a live playhead, and a bar counter. Tap a block to edit: root, six
qualities (maj, min, 7, maj7, m7, ø7), lengths from ½ to 8 bars, plus
move/duplicate/delete. "Add" stays open and pre-advances the root a fourth for
fast entry. Ships seeded with Dm7–G7–CΔ.

Chords connect by **nearest-voice voice leading** — bass on the root, three
upper voices placed to minimise motion — so long forms move smoothly.

### Sound

**Three pads,** deliberately different, all designed for hours of sustain:
- **Felt** — soft-detuned saws under a slowly breathing dark lowpass. Juno
  blanket territory.
- **Glass** — low-index two-op FM plus sine partials at the octave and twelfth,
  each blooming on its own slow cycle. Nothing above a sine, so harshness is
  structurally impossible.
- **Vox** — detuned triangles through fixed vocal formants with a drifting
  second formant, so the vowel slowly turns.

Detune never exceeds 3.5 cents and no LFO runs faster than 0.1 Hz — so there is
no wobble over an hour.

**Kit:**
- **Kick** — clean sine drop with a 3 ms soft attack. Neutral and digital: not
  acoustic, not an 808, not a clicky EDM kick.
- **Shaker** — banded noise whose filter centre wanders per hit, so a long run
  never sounds stamped. Tempo-independent envelopes.
- **Rim** — three tuned resonators struck by a 4 ms noise chirp.

**Six grooves,** curated not exhaustive:

| Groove | What it is |
|---|---|
| Click | straight per-beat metronome, accented downbeats |
| Floor | four-on-the-floor, rim answering 2 and 4 |
| Back | backbeat, kick on 1 and 3 with an and-of-4 pickup |
| Dust | lo-fi, swung sixteenths, humanised timing and velocity |
| Bossa | **true bossa clave** (1, 2&, 4 \| 2, 3&) over the surdo foot pattern |
| Songo | **son clave 2-3** (2, 3 \| 1, 2&, 4) with tumbao kick anchors |

**Any kit voice mutes out of any groove** — strip to just shaker, shaker and
rim, whatever. That is the only customisation that matters.

### Controls

- **Tone** — a tilt EQ. Two opposing shelves pivoting at 900 Hz, ±6 dB, so dark
  means *more body* rather than merely less treble. Double-click resets.
  Verified monotonic: 181 / 242 / 366 Hz spectral centroid at dark / flat /
  bright.
- Pad and Kit level faders.
- **BPM** — steppers, vertical drag, and tap tempo. 40–220.
- Space toggles play; arrow keys walk the root chromatically in drone mode.
- Screen wake lock while playing.
- Full state persisted to localStorage.

---

## 4. What is NOT built, deliberately

| Not building | Why |
|---|---|
| **A tune library** | Unwinnable — iReal Pro's moat is thousands of user-entered charts. And it isn't the wedge; the drone side is. |
| **Notation, piano diagrams, theory explainers** | The user already knows. This is an instrument, not a teacher. |
| **Accounts, sync, cloud** | A URL plus localStorage covers the entire need. |
| **More grooves** | Six curated beats twenty. A groove menu is a decision, and decisions are producer mode. Adding one means cutting one. |
| **A mixer, effect racks, automation** | That is a DAW, which is the thing being escaped. |

---

## 5. Verified on speakers ✅

**Tested in a real room. It works.** *"Actually really cool"* — and separately,
*"cool and fun to use."* That was the one thing gating everything: the whole
differentiator is "good enough that you'd leave it running for an hour," and it
now has an answer from someone with ears.

What the listen turned up, in the practitioner's own ranking:

| | Verdict |
|---|---|
| **Overall** | Works. Fun to use. The framing holds. |
| **Pads / tones** | *"Could be a bit better — not bad, but not incredible."* Good enough to keep, not yet the thing the pitch claims. |
| **Percussion** | **The weakest part** — both the sounds and the grooves. This is the priority. |
| **Missing** | Recording. Wants to keep motifs and loop files. |

### Why the percussion is weak — diagnosed, not guessed

1. **The limiter is chewing the kick.** The master brick-wall has a 3 ms attack;
   one cycle at 55 Hz is 18 ms, so it tracks *inside* the waveform and turns a
   clean sine drop grainy. Identical bug to the one measured and fixed in
   `bed.html`, where it took the sub from grit to a −92 dB second harmonic.
2. **The kick is too simple.** Two sines — a 160→51 Hz drop plus a quiet
   octave. Clean in the sense of *empty*. Digital kicks that hold up have a
   transient, a pitched body and a short noise component.
3. **The shaker's filter is far too wide.** Bandpass at 6.1 kHz with Q = 0.9 is
   barely filtering — it reads as a noise blip rather than beads in a shell, and
   it lacks the two-stage strike-then-rattle shape.
4. **The grooves are correct but not *played*.** The patterns are
   musicologically right — the bossa and son claves are accurate. But velocity
   varies by only ±4% on every groove except Dust, there are no ghost notes
   anywhere, and the shaker patterns are fixed grids. Rhythmically accurate,
   performatively dead.

The fix is not new patterns. It is velocity life and micro-timing across *all*
grooves rather than only the lo-fi one, ghost notes on the kick, and a real
two-stage shaker.

### Tier 2 — built, measured (v2)

All four diagnoses above are addressed, plus roadmap items 2.2–2.7. Headless
measurements (Playwright + AudioWorklet capture, deterministic seeded runs):

1. **Sub limiter.** The master safety stage is band-split at 150 Hz (LR4,
   sums flat within 0.6 dB): lows get a limiter with a 50 ms attack — longer
   than one cycle at 40 Hz — highs keep the fast brick. Nonlinear residual on
   kick-like 50 Hz hits: **−36.3 dB → −46.2 dB**, mid-band grit component
   −63 → −78 dB. Two Web Audio traps found on the way, both handled in code:
   DynamicsCompressor's spec-mandated makeup gain, and lowpass/highpass `Q`
   being specified in dB.
2. **Kick.** Velocity now shapes pitch drop and decay; a 30 ms lowpassed
   noise breath adds the felt contact. Spectral centroid unchanged
   (116.8 → 116.7 Hz) — character, not punch. Peak 1 dB lower than v1's.
3. **Shaker.** Two-gesture envelope (strike, then the beads settling),
   band Q 0.9 → 3.0. Per-hit −6 dB bandwidth **3.8 kHz → 2.0 kHz**.
4. **Grooves played, not stamped.** Per-slot repeat velocity variation
   2% → 5–8% (Dust wider), gaussian micro-timing ~±3 ms, per-voice feel
   (bossa shaker rides ~3 ms ahead, backbeat rim lays back ~4 ms),
   probabilistic ghost kicks. Patterns untouched. Click is exempt — a click
   that drifts is broken. Downbeats carry +12–16% weight (roadmap 2.2).

Also: root changes quantise to the next bar line while a groove runs
(portamento untouched; immediate when free), a `5` chord quality, three-state
kit chips (off → soft → full), MIDI note-on sets the drone root, drone-only
default raised ~2 dB (peak −6.5 → −4.7 dBFS) with every groove still peaking
below −0.49 dBFS at default faders.

**One deliberate deviation from the roadmap:** the pre-fader reverb send port
from `bed.html` was built and measured — and it made fader-position timbre
drift *worse* here (0.45% → 2.8% centroid shift), because this reverb darkens
rather than being high-passed: constant wet under a moving dry *is* a timbre
change. Sends stay post-fader; the softened glue (the other half of that fix)
stayed and cut kick-rate pumping from +4.1 dB to +3.1 dB.

### Tier 3 — built, measured (v3)

The app plays. Measured headlessly; Tier 2's sound is untouched when the new
paths are idle (drone and groove levels bit-identical to v2).

1. **MIDI splits at C3.** Below C3 a note-on sets the drone root (same
   downbeat quantise as a tap); C3 and up plays a **Rhodes** — two-op 1:1 FM
   with a seventh-partial tine that hardens with velocity. Measured: 21 dB
   velocity-to-level range; attack brightness grades 293 → 501 Hz centroid
   across velocity while the sustain stays warm (2nd partial ≈ −12 dB);
   ~1.4 s decay at C4, longer low. Sustain pedal (CC64) honoured, 12-voice
   polyphony with oldest-note stealing, keys panned by position. Fortissimo
   four-note chord over full kit and drone peaks −0.91 dBFS.
2. **Latency, reported once** — first time a keyboard appears, one line under
   the transport: "*N* ms — good / fine for drones, late for keys / use wired
   output", from `baseLatency + outputLatency`. A true impulse round-trip
   needs mic calibration and stays out of scope. No setting.
3. **Line in** — one `In` fader (the sanctioned line-in level). At zero
   nothing is requested; the first move asks for the input with **all speech
   DSP disabled** (echo cancellation would duck the instrument whenever the
   drone plays). Channel strip: 70 Hz highpass, gentle 2.2:1 compression
   (makeup gain cancelled), −3 dB shelf at 3.4 kHz, into the master **and the
   same reverb the pads use** — the instrument sits inside the room instead
   of on top of it. No amp sim, deliberately. Verified with a fake input
   device: +17 dB signal over the fader-zero floor.
4. **Voice** rides the identical path (3.4): headphones fine; a mic in a
   room with a speaker playing a sustained drone is the textbook feedback
   case, and that is the room's problem, not a setting's.
5. **Cycle mode** — long-press the root strip, pick one of five intervals
   (4ths, 5ths, half, whole, m3) and 4/8/16 bars; the row collapses and the
   root strip itself is the visualiser. Verified: roots walk exactly by the
   interval on exact bar boundaries (measured 4.36–4.42 s against a 4.36 s
   grid at 220 bpm); tapping any root takes manual control and stops; nothing
   is on screen when it's off. Works with the kit silent — the scheduler
   counts bars either way.

### Post-v4 — the ears overruled two numbers (current)

The first real listen said the new version was **brighter, less deep, drums
in-your-face**. Measured and confirmed: the tier-2 level raise (+1.3–2.6 dB)
was most of it, plus a real ~0.45 dB low-band shortfall from the sub
limiter's knee-softened makeup gain. Reverted on `/looper/` (v2–v4 stay
frozen as built):

- Pad bus and glue back to **v1's exact values**; output re-tuned so the
  drone-only default is **byte-level v1 loudness** (−12.82 dBFS rms, exact).
- Spectrum now matches v1 within 0.06 dB in every band, both pads measured.
- Kit loudness within 0.4 dB of v1; downbeat weight halved (+8%, felt not
  heard).
- Roadmap 2.7 (raise the drone) is therefore **deliberately not shipped** —
  the device volume knob does that job without costing the mix its depth.
- Full-groove mixes read ~+1.4 dB over v1 with everything matched: that is
  v1's kick-rate pad-ducking no longer happening, not added level.
- Honest ledger: with v1's glue restored, whole-chain nonlinearity measures
  ≈ v1. What the band-split still buys: low tops rounded ~1 dB smoothly
  instead of clamped 16:1 at 2 ms, lows no longer modulate the highs, and
  the crossover sums flat.

### Tier 4 — built, measured (v4)

The app keeps. Tier 2/3 sound untouched (levels bit-identical to v2/v3).

1. **Recording.** One button in the transport captures everything the app is
   making — drone, kit, Rhodes, line in — from a tap on the final output.
   Takes land as **16-bit WAV** (chosen over webm/opus because takes need to
   open in whatever the player edits with), kept in IndexedDB with one
   optional line of text each, playable back, downloadable. Capture runs on
   the audio thread (AudioWorklet; ScriptProcessor fallback on `file://`).
   Verified: a 3.15 s take produced a byte-exact 44.1 kHz RIFF/WAVE with the
   mix at −13.7 dBFS inside it. Not a notes app; **no overdub looping.**
2. **The URL is the save file.** `#A/fifth/felt/bossa/96` lands on exactly
   that drone; `#loop/Dm7,G7,CM7-2/felt/bossa/96` on exactly that form
   (`-N` = bars, `M7`/`m7`/`h7`/`5` = Δ/m7/ø7/power chord, `Cs`/`Eb` for
   accidentals). A shared hash beats localStorage on load; every change
   rewrites it in place via `replaceState`, so the address bar is always a
   shareable snapshot. Round-trip and garbage-rejection verified. No account,
   no backend.

---

## 6. What to build next, in order

### 1. Whatever the listen turns up

Priority zero. Every item below is worth less than a good-sounding pad.

Known from the sound bath engine and likely present here too:
- **Level-dependent brightness.** The reverb send is post-fader into a
  high-passed reverb, so raising a bus adds proportionally more mid-and-top
  content and the timbre shifts as you move the fader. Fixed in `bed.html` by
  tapping the send pre-fader and backing off the glue compressor; measured drift
  went from audible to 0%. The same fix applies here.
- **Sub-range limiter distortion.** The master brick-wall has a 3 ms attack;
  one cycle at 45 Hz is 22 ms, so it tracks *inside* the waveform and adds grit
  to low content. Fixed in `bed.html` by giving low material its own limiter
  with an attack longer than one cycle.

### 2. Shareable state in the URL

The highest-leverage feature for distribution, and small.

A teacher sends `…/looper/#A/fifth/felt/bossa/96` and the student lands on
exactly that setup. Same for a progression. No account, no save, no backend —
**the URL is the save file.**

This targets the real risk directly. The problem was never that nobody wants it;
it's that nobody finds it, and "sounds better" survives neither a screenshot nor
a feature list. Every shared link is a demo arriving pre-configured from someone
the recipient already trusts.

### 3. Capture — record the session, not the loop

**One button that records everything** — drone, kit and mic — to a file while
you play. Multiple takes, saved simply, no naming, no organising.

This is the flow-state feature. The value isn't fidelity, it's *"what was that
thing I just played?"* And it has **no latency requirement at all**, because
nothing is layered back in real time — roughly a tenth of the work of true
looping with none of its problems.

**True overdub looping is a separate, later, harder feature.** It collides with
the one thing that makes this work on a phone: drones tolerate Bluetooth
latency, loops do not. Record over a playing drone and what you heard arrived
150–200 ms late, so the take lands that far behind, and every overdub compounds
it. Fixable only with real calibration — play an impulse, capture it back,
subtract the measured round trip — which must exist before the feature is usable
on anything but wired headphones.

Two more phone-specific traps for whenever that gets built:
- **Browsers default `getUserMedia` to speech processing.** Echo cancellation
  actively ducks your instrument whenever the drone plays, noise suppression
  eats sustained tones, AGC pumps. All three must be explicitly disabled, and
  some phones apply processing you cannot turn off.
- **Internal mic plus speaker is a feedback loop**, and a sustaining drone is
  the worst possible case.

So looping ships as a mode you *enter*, with a stated setup (headphones or an
interface) and a calibration tap — never as something that changes the front
door. The front door stays "open it, press play."

### 4. Wavetable pads

Web Audio's `createPeriodicWave()` takes harmonic amplitudes and builds a
band-limited oscillator playable at any pitch. That means **sampled character
with synthesised pitch**: design a pad in a DAW, render a sustained note,
extract its harmonic spectrum, and that becomes the oscillator.

A wavetable is a few hundred bytes. Unlimited timbre, no file size, no loop
points, full pitch freedom.

### 5. Count-in and section markers for loop mode

For long forms, knowing where you are matters more than the chord name. A 32-bar
form needs visible A / B / bridge structure, not 32 identical blocks.

### 6. A fourth pad, darker

Felt is the workhorse; Glass and Vox are both fairly bright. Something with more
low-mid weight — closer to a bowed string pad — covers the hour-long practice
case where someone wants less air.

### 7. Progression import

Not a chart library. But **paste a chord line** — `Dm7 G7 Cmaj7 | Am7 D7 Gmaj7`
— and parse it. Turns a two-minute entry job into five seconds without
pretending to compete on catalogue.

---

## 7. Naming

Working name is **Pedal**. Candidates raised: DroneFlow, FlowSound.io,
DroneLoop.io.

One caution worth knowing before committing: **"drone" means UAV to the general
internet.** Search results and ad keywords are dominated by quadcopters, which
is a real discoverability tax on a product whose main risk is already discovery.
It's a tradeoff rather than a dealbreaker — the target audience knows the
musical meaning — but it should be a decision, not an accident.

Of the three, **DroneFlow** is strongest, because "flow" encodes the actual
value proposition rather than the mechanism. `DroneLoop` describes the least
important half of the product, and `FlowSound` is generic enough to be invisible.

The naming territory worth mining is the positioning itself: staying in
improviser mode, never entering producer mode, an instrument rather than a
studio.

---

## 8. Comparing versions

The version verified on speakers is frozen and deployed alongside the live one,
so two browser tabs can be A/B'd directly — which is the only way to judge a
sound change.

| | URL |
|---|---|
| **Current / evolving** | `/AdamVaultOS/looper/` |
| **v1 — verified on speakers** | `/AdamVaultOS/looper/v1/` |
| **v2 — tier 2, measured, awaiting listen** | `/AdamVaultOS/looper/v2/` |
| **v3 — tier 3, measured, awaiting listen** | `/AdamVaultOS/looper/v3/` |
| **v4 — tier 4, measured, awaiting listen** | `/AdamVaultOS/looper/v4/` |

`v1/index.html` is a frozen copy and must never be edited. Freeze another
snapshot the same way before any change big enough to need comparing.

Git also tags it as `pedal-v1`, so the exact state is recoverable by name
rather than by hash:

```
git show pedal-v1:public/looper/index.html > /tmp/pedal-v1.html
```
