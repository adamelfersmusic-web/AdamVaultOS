# Pedal — phased build brief

Build in tiers. **Freeze each one before starting the next.** Nothing collapses
into a single evolving version — every stage stays playable and comparable
forever, because the only honest way to judge a change to sound is to A/B it
against what came before.

---

## The freeze protocol

**The moment a tier is finished and sounds right, freeze it** — before anything
from the next tier is written:

```
cp public/looper/index.html public/looper/vN/index.html
```

So a session's last act is the freeze, not its first. `v1` is already frozen,
which means a tier 2 session starts by building; a tier 3 session starts by
checking that `v2/` exists and creating it from the current file if the tier 2
session forgot.

Frozen copies are **never edited, never cleaned up, never deleted.** They deploy
alongside the live app so any two versions can be opened in adjacent tabs and
switched by ear.

| Version | URL | State |
|---|---|---|
| **v1** | `/AdamVaultOS/looper/v1/` | ✅ frozen — verified on real speakers |
| **v2** | `/AdamVaultOS/looper/v2/` | freeze when tier 2 is done |
| **v3** | `/AdamVaultOS/looper/v3/` | freeze when tier 3 is done |
| **v4** | `/AdamVaultOS/looper/v4/` | freeze when tier 4 is done |
| current | `/AdamVaultOS/looper/` | whatever is being worked on |

---

## The line that governs everything

> **Opening a DAW puts you in producer mode. This keeps you in improviser mode.**

Speed of setup *is* the product. Every decision gets measured against one
question: does this get someone playing sooner, or later? A menu is a decision,
and decisions are producer mode.

**Keep the UI dead simple.** The list below is long; the interface must not grow
in proportion. Tier 2 adds no visible control at all, and across all three tiers
only four things ever appear on screen that aren't there today: a record button,
a line-in level, whatever cycle mode needs, and a single line of latency text.

---

# TIER 2 — the same app, better

The rule for this tier: **fix what's there, and add nothing you can see.** Not
one new control. No panels, no rows, no settings, no buttons. Every item below
either changes how something already on screen sounds, or changes how it
behaves when you touch it.

If a change seems to need a control, it belongs in a later tier.

### 2.1 Percussion — the weakest part, diagnosed

The speaker test verdict was *"the drum tones kind of suck — but they're kind of
nice because they're unobtrusive."*

> **Read that carefully. Do NOT make them punchier.** The original brief was a
> kit that sits in a loop for an hour without fatiguing, and that's the part
> that works. Add **life**, not weight. Velocity variation, ghost notes,
> micro-timing. Never impact.

Four specific causes:

1. **The limiter is chewing the kick.** The master brick-wall has a 3 ms attack;
   one cycle at 55 Hz is 18 ms, so it tracks *inside* the waveform and turns a
   clean sine drop grainy, while pumping the whole mix at the kick's rate.
   Identical bug was measured and fixed in `sound-bath-app/prototype/bed.html`,
   where it took the sub from grit to a −92 dB second harmonic. **Give low
   content its own limiter with an attack longer than one cycle** (~50 ms).
2. **The kick is too simple** — two sines, a 160→51 Hz drop plus a quiet octave.
   Clean in the sense of *empty*. Digital kicks that hold up have a transient, a
   pitched body, and a short noise component.
3. **The shaker's filter is too wide** — bandpass at 6.1 kHz with Q = 0.9 barely
   filters, so it reads as a noise blip rather than beads in a shell, and it
   lacks the two-stage strike-then-rattle shape.
4. **The grooves are correct but not *played*.** The patterns are
   musicologically right — **do not change them.** But velocity varies only ±4%
   on every groove except Dust, there are no ghost notes anywhere, and the
   shaker patterns are fixed grids. Rhythmically accurate, performatively dead.

**Also fix, ported from `bed.html`:** the reverb send is post-fader into a
high-passed reverb, so raising a bus adds proportionally more mid-and-top
content and the timbre shifts as you move the fader. Tap the send **pre-fader**
and soften the glue compressor. Measured drift went from audible to 0%.

### 2.2 Downbeat weight — fixes "hard to tell where you are in the bar"

This is a **sound** fix, not a visual one. Give beat 1 real velocity weight in
every groove. You should *feel* the bar, not read a counter. A counter is
something to look at; the kit is something to play against.

### 2.3 Root changes land on the downbeat

Currently a root change fires the instant you tap — measured at step 12.54 of 16,
dead mid-bar. The rhythm does *not* reset (verified), but the change arrives
wherever your finger did.

> **When a groove is running, quantise the root change to the next downbeat.
> When no groove is running, fire immediately.**

No setting, no quantise menu — the behaviour follows from whether there's a
pulse to wait for. **Keep the portamento glide.** Quantise *when* it starts, not
*how* it moves; that glide is the thing loopers and freeze pedals can't do.

### 2.4 A power-chord quality

Drone mode is deliberately third-less — that's what makes it a *permission
structure*: the player's hands decide major or minor. Loop mode then forces a
third on every chord, which quietly contradicts the whole thesis.

**Add `5` (root + fifth, no third) to the chord qualities.** One more chip in a
row of six. Not a mode.

### 2.5 Kit toggles become three-state

Off → soft → full, cycling on tap. **Same three chips, same position, no new
controls.** That covers "the shaker's a bit much" without a mixer appearing —
three faders would be the DAW creeping back in, and a fader asks you to pick a
value where a tap just asks less or more.

### 2.6 MIDI note → root

Plug in any MIDI controller; a note-on sets the drone root. **Zero UI** — nothing
appears on screen that wasn't there before, the root indicator just moves.
Latency-immune, so it works over Bluetooth like everything else in drone mode.

*(In tier 3 this splits at C3 so the upper range plays a Rhodes. In tier 2, all
notes set the root.)*

### 2.7 Level

**Do not add a master volume.** Measured: both faders at max already hits
0.1 dBFS, so a master could only attenuate — which the device's hardware volume
does better. Two gain stages doing the same job just lets people end up in bad
configurations.

**Do raise the drone-only default.** It sits at −8.4 dBFS with the kit off, which
is the most common way this gets used and the quietest thing the app produces.
Target around −4 dBFS for drone-only without clipping the full-kit case.

---

# TIER 3 — the app plays

**Freeze v2 first.**

This tier widens what Pedal *is*: from a bed you play over, to something you can
also play. Do it deliberately.

### 3.1 MIDI splits, and the upper range plays a Rhodes

> **Below C3 sets the drone root. C3 and up plays a Rhodes.**

Left hand moves the room, right hand plays over it. No menu, no mode, no toggle
— it's how live rigs have worked forever and it's learnable in one gesture.

**The Rhodes must be genuinely playable**, not a sparse background voice.
Velocity response, a tine attack that hardens when you dig in, a body that
blooms rather than just decays. `bed.html`'s Voice band is a good starting
architecture — two-op FM with a fast-decaying index — but it was tuned to be
unobtrusive and fires one tone every 9–26 seconds. Different target, same
approach. Consider `createPeriodicWave()`: sampled character, synthesised pitch,
a few hundred bytes.

**The point:** one app, one cable, and you're practicing. Today that takes a
synth app *plus* a drone from somewhere else *plus* five minutes of setup —
which is producer mode before you've played a note.

### 3.2 Latency, measured and reported

Playing needs sub-10 ms to feel connected. Drones don't care — that's why
Bluetooth is fine for everything else — but this one feature inverts the app's
core advantage.

**On first MIDI connect, measure the audio round-trip and report it once in
plain language:** *"18 ms — good"* or *"210 ms — use wired output."* One line, no
setting. Otherwise someone on a Bluetooth speaker concludes the app is broken
when it's their speaker.

### 3.3 Line input — guitar first

Guitar into an interface, through a small channel strip, into **the same reverb
the pads use**.

The latency problem mostly dissolves: the interface provides direct hardware
monitoring, so the dry tone reaches your ears with zero latency and the app only
adds the *tail*. A reverb arriving 30–50 ms late just reads as more pre-delay,
which is a normal parameter, not a defect.

**Do not build an amp sim.** No nonlinear modelling, no cab IRs. Clean electric
needs a channel strip: gentle compression, a small high-shelf to take the
pickup's edge off, and a send to the shared convolver. That's most of the
perceived quality for a fraction of the work.

The real win is *placement*: right now a guitar over a drone sounds like two
separate things — dry instrument in your room, wet pad in a synthetic one. Same
reverb, and the guitar stops sitting on top of the drone and starts sounding
like it's inside it.

### 3.4 Voice — experimental, explicitly optional

Same mechanism as 3.3. **Not a priority** and not the main function; this app is
for instrumentalists. Worth trying because the latency case is interesting:
**you hear yourself through your own skull**, so the dry signal is zero-latency
by physics and the app only adds the tail.

Two real problems, both of which may make it not worth shipping:
- **Feedback.** A mic in a room with a speaker playing a sustained drone is the
  textbook worst case. Headphones fine; speaker squeals.
- **Browser DSP.** Browsers apply echo cancellation, noise suppression and
  auto-gain to `getUserMedia` by default, and AEC will actively duck the voice
  whenever the drone plays, because it thinks the drone is echo. All three must
  be explicitly disabled. See SPEC §6.3.

If it doesn't work cleanly, cut it. Plugging a voice into a mixer instead is a
perfectly good answer.

### 3.5 Cycle mode

Drones moving by a fixed interval every N bars. Genuinely useful for scales and
ear training — being *forced* to a new key is the practice value.

**Intervals:** 4ths, 5ths, half step, whole step, minor third. That list is
complete; it covers the Coltrane thing without a customiser.
**Bars:** 4, 8, 16.

> **This is the only item in either tier that costs real UI, so it has to be
> the tightest thing in the app.**

Suggested shape, but take a better one if you find it: long-press the current
root → a small row appears with the five intervals and three bar counts →
confirm and it collapses. **While cycling, the root strip itself is the
visualiser** — the active note walks the twelve you're already looking at. The
transport line gains "· 4ths · 8 bars" and says nothing when cycling is off.
Tap any root to take manual control and stop.

No new panel. No counter. Nothing on screen when it's off.

**Why it earns its place despite the cost:** MIDI makes root changes hands-free
*only for keyboard players*. A horn player, a singer, a guitarist with both
hands occupied can't hit a key either. Cycle mode is the hands-free version for
everyone else — same need, different input.

---

# TIER 4 — the app keeps

**Freeze v3 first.**

Both of these were originally sketched into tier 2 and deliberately moved back.
Everything before this tier is about the hour you spend playing. This tier is
about what survives it.

### 4.1 Recording

**One button** captures everything the app is making — drone, kit, and by this
tier the Rhodes and the guitar too — to a file while you play. Multiple takes
kept and playable back. An optional single line of text per take, because
*"what was that thing I just played"* is the real need and a label covers it.
**Not a notes app.**

No latency requirement at all, since nothing is layered back in real time.

> **This is why it waits until tier 4.** Built in tier 2 it could only capture a
> drone, a kit, and a bare mic — then tier 3 adds two instruments and it has to
> be reopened. Built here it is built once, and it records the whole app.

> **Do NOT build overdub looping.** It needs round-trip latency calibration, and
> it walks into the browser-DSP trap described in 3.4. Capture covers the real
> need; overdubbing is a different product.

### 4.2 Shareable URL state

`…/looper/#A/fifth/felt/bossa/96` and someone lands on exactly that setup;
progressions too. No account, no backend — **the URL is the save file.**

This targets the real risk: not that nobody wants it, but that nobody finds it,
and "sounds better" survives neither a screenshot nor a feature list. Every
shared link is a demo arriving pre-configured from someone the recipient trusts.

> It sits last because it's about distribution rather than playing, and because
> the more the app can do, the more a link is worth sharing. But it is **small,
> self-contained, and depends on nothing in tier 3** — so if tier 3 sprawls,
> this is the one item worth pulling forward on its own.

---

## Never build

| | Why |
|---|---|
| A tune library | Unwinnable — iReal Pro's moat is thousands of user-entered charts. And it isn't the wedge; the drone side is. |
| Notation, piano diagrams, theory explainers | The user already knows. An instrument, not a teacher. |
| Accounts, sync, cloud | A URL plus localStorage covers the entire need. |
| More grooves | Six beats twenty. If one is added, one is cut. |
| A mixer, effect racks, automation | That's a DAW — the thing being escaped. |
| Overdub looping | Latency calibration plus browser DSP. Capture covers the real need. |
| A master volume | Measured — there's nothing for it to do. |
| Per-chord pad switching in loop mode | A decision per chord is producer mode. |

## And a note on jam sessions

Nothing here was designed for jamming. But no bars, no tempo decisions, no
arrangement, two taps to sound — those constraints happen to be exactly what a
jam wants.

**Let it be hackable for jams. Never build for them.** The moment a second
input, a mixer, or longer loops appear, the thing that makes it good for jamming
is gone. It's good *because* it refuses.
