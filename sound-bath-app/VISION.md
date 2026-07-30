# Sound Bath App — Master Vision

**Status:** v0.1 canonical vision. Working document.
**Name:** undecided. *Atmos is unusable — Dolby owns it in audio.* Naming
territory to explore: the practitioner's own phrase, **"holding space."** The
app holds the space; the humans move the energy through it.

---

## 0. The one-sentence version

**A person who loves sound but can't compose becomes someone who can lead a
room.**

Everything below is downstream of that sentence. If a feature doesn't serve it,
cut it.

---

## A. The Why

### The pain point

Leading an immersive sound bath currently requires four unrelated skill sets:

1. Playing bowls / gongs — **common**, many people have this
2. Charisma and group facilitation — **common**, yoga-teacher types have this
3. Sound design and arrangement in a DAW — **rare**
4. Conducting an ensemble through a structured arc — **rare**

Almost nobody has all four. So the ceiling on who can lead is set by #3 and #4,
which have nothing to do with why anyone got into this. People with genuine love
for the practice, real instruments, and real presence are locked out because they
can't open Ableton and they can't count an ensemble through a form.

Meanwhile the audio side of what they'd produce is a **thin, stable palette** —
drones, pads, a felt-piano motif, ocean, rain, crickets, chimes. Confirmed by
observation of the strongest regional practitioner: the entire sonic vocabulary
is a handful of elements, reused. It is emphatically not a problem that needs a
DAW. It needs the right five things, tuned to the room.

### Customer avatar

**Primary — The Bowl Player Who Wants to Lead.**
Owns a crystal or Tibetan set. Has played in someone else's bath, or plays solo
for friends. Loves this deeply. Cannot compose, cannot sequence, will not learn
a DAW. Has money — routinely spends $200–$2000 on a single bowl. Currently
capped at "one person with bowls."

**Secondary — The Yoga / Meditation Teacher.**
Great voice, great presence, leads rooms already. Uses a Spotify playlist behind
their sessions and knows it's the weak part. Needs a bed that ducks out of the
speech band and follows their pacing rather than the reverse.

**Tertiary — The Solo Clinical Practitioner.**
Hospice, palliative care, integrative medicine. Needs the stripped version:
no sync, no lights, no PA. Pick a bed, press play, play a bowl over it.
*Note: hospitals distinguish sharply between board-certified music therapists
(MT-BC) and sound practitioners. The realistic door is hospice / palliative /
integrative medicine, often volunteer-first. Narrower than it looks.*

### The transformation (the marketing angle)

Not *"make sound baths easier."* The claim is:

> **You already have the love, the instruments, and the presence.
> This is the first thing that lets you lead with them.**

The hero of the brand is always the person, never the software. The app is
furniture. The app **holds the space** so they can move the energy through it.
They're the planet; this is gravity.

Corollary rule for all copy: **never say the audience can't tell the
difference.** It's true and it reads as contempt for the craft to the exact
people whose endorsement is required. The correct framing is: *the sound design
was never the art — leading the room is. This removes what was blocking you from
what you're actually good at.*

### The signature story

Thursday. Musicians you love are passing through town. There's no event planned.
By Saturday there are sixty people on the floor, because you spent fifteen
minutes building a structure and the rest of the evening being present.

**The promise is not "better sound baths." It's "you can say yes on Thursday."**

That makes fifteen minutes a **hard spec**, not a nice-to-have. If a first-time
user can't get to a runnable 50-minute structure in fifteen minutes, the
positioning collapses. Test this with real people before almost anything else.

---

## B. The App

### The core split: Design vs. Perform

Two modes, deliberately unequal in importance.

| | Design mode | Perform mode |
|---|---|---|
| Used | a handful of times | every single session |
| Posture | seated, unhurried, planning | standing, hands full, dark room |
| Interface | timeline, Lego blocks | one enormous button + display |
| Priority | **second** | **first** |

**Field data:** practitioners build somewhere between four sessions a year and a
new one every few months, and repeat them freely — audiences never notice,
because live cueing and live improvisers make every run different. **Variation
happens at performance time, not design time.** That is why perform mode is the
product and design mode is the accessory.

### Perform mode (build this first)

The screen is not a timeline. It is a cue display.

**Leader view** — four things and nothing else:
- Current section (name + intention phrase)
- Time remaining / elapsed in section
- What's next
- One enormous **GO**

Plus **HOLD** (stay here indefinitely — the room isn't ready, a player is
mid-phrase) and **JUMP** (go anywhere out of order). Without HOLD the app is
driving instead of following, which is the failure that makes a practitioner
resent it.

**Follower view** — this is already designed. It is the printed handout, one
section at a time, on a phone. See §B "The Sheet" below.

**Display-only by default.** Hands hold mallets. The screen sits outside the
bowl arc at ~4 feet, oblique, in a dark room. Optional **Operator** role for
when somebody genuinely is at a laptop.

**Physical constraints, derived from real event photos:**
- Nowhere to put a phone inside the bowl arc; no free hand to touch it
- Read at ~4 feet, oblique angle, low light
- Rooms are washed in warm amber (candles + tungsten). **Warm section colors
  disappear. Cool colors survive.**
- Screens must drop to dim amber / deep red once a session starts. A bright
  white phone in that room is disrespectful and everyone in it knows.

### The Sheet (follower view) — solved, copy it exactly

Real handouts already encode a four-tier system in **punctuation, not words**:

```
BOWL  1 3 5  (2 4 6)  [7]
      ^bold  ^parens   ^brackets
```

- **Bold** = the root of the section
- **Plain** = freely available
- **(Parens)** = sparingly
- **[Brackets]** = restricted — *the notes that contradict the stated mode*

Verified across three real sections:

| Section | Mode | Brackets | Why |
|---|---|---|---|
| ROOT | C mixolydian | `[7]` = B♮ | mixolydian wants B♭ |
| SACRAL | D major | `[1,4]` = C♮, F♮ | D major wants C♯, F♯ |
| HEART | F major | `[7]` = B♮ | F major wants B♭ |

**Every bracket is exactly the bowl that fights the key.** This is a computable
rule, not a taste call. Implement it directly.

Reinforce the tiers **visually** — size and brightness, not vocabulary. Bowl 1
large and bright, 5 medium, 3 small and dim. Readable at fifteen feet, in the
dark, by someone who reads no music and possibly no English. Words become a
legend, not the mechanism.

**Bowl numbers are physical, not theoretical.** Bowl 4 is the fourth bowl in the
arc regardless of key. Never show "the third" or "the fifth" anywhere a
practitioner can see. Leader and follower render the same event in two different
languages.

### Chakras determine keys — not the other way around

Standard seven-bowl mapping means **bowl number = chakra number = scale degree in
C**, all at once:

| Bowl | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Note | C | D | E | F | G | A | B |
| Chakra | Root | Sacral | Solar | Heart | Throat | 3rd Eye | Crown |

This is why C, D and F dominate real sessions — Root, Sacral, Heart. **The app
must never ask for a key.** It asks for a chakra and derives the key, with mode
as an optional refinement (real sheets show both `C MAJOR` and `C MIXO`).

### Sections alternate harmonic and textural

From two real session sheets:

```
[texture] → ROOT (C) → [texture] → SACRAL (D) → [textures] → SPACE → HEART (F) → [texture]
```

Pitched sections (chakra + key + bowls) separated by pure-texture passages
(Ocean, Rain, Gong, Chimes, Insects). **Space is programmed as an element in its
own right.** Both observed sessions ascend C → D → F. Both close on a texture.

Maps cleanly onto the audio bands: harmonic sections are Deep + Bed + bowls;
textural sections are Air alone.

### Every section carries a phrase

Real sheet, read top to bottom:

> The rock / What grows / Will live / And shed / What's shed / Will burn /
> What's left / Is Home

Under a title: **LET IT BURN WHAT IT MUST.** The session is one sentence broken
across its sections. This is not decoration — it is how the leader and the whole
ensemble know what a section is *for*.

**Therefore the design flow asks "what is this section about?" before it asks
anything musical.** Name and phrase first, chakra second, bowls derived. That is
a completely different UI from "add a chord, set a duration," and it is the one
that matches how these actually get made.

### Configure your ensemble (setup, once per event)

- **What bowls does the group have?** Default to standard 7; allow an arbitrary
  pitch list (people collect odd bowls; Tibetan bowls often aren't tuned to any
  standard).
- **432 or 440.** Implement as an **editable reference pitch in Hz**, not a
  toggle — then 432, 528, the whole solfeggio set, and anything else ever
  requested all fall out of one field and you never ship another tuning feature.
- **Who's here and what are they playing?** A **roster, not a mixer**. Someone
  roaming with chimes → the chime layer mutes automatically. Nobody on rain
  stick → that layer stays on. One setup screen adapts a single design to three
  people or ten without anyone touching a fader.

### Live players mode — one switch

Flip on: chord layer mutes, motif layer pulls back, the app plays only what
humans physically can't (Deep + drone + Air).
Flip off: the app fills in the harmony for someone working alone.

**This single toggle encodes the entire philosophy.** With people in the room,
get out of the way. Without them, be the ensemble.

### Never exactly the same

Structure fixed, surface never. Same design, same arc, same key — but the
crickets never repeat, motifs land differently, the pad breathes differently.
Free with a generative engine, impossible with rendered audio, and it's what
makes a small repertoire survivable when someone runs the same four designs
forty times a year.

### Structure Wizard

Four or five questions → a complete runnable structure:

- How long? (default 50 min; offer 30 / 50 / 90)
- Does someone speak at the top?
- What bowls does your group have?
- How deep does the middle go?
- How long do people marinate at the end?

**This should not be an LLM.** It's a decision tree over a taxonomy. Instant,
works offline in a studio basement, costs nothing, can never say anything weird
— and *feels more magical*, because magic in an interface is immediacy.

**Never use the word "AI" anywhere in this product.** In this market it signals
inauthentic, extractive, machine-made spirituality. Call it planning the arc, or
call it nothing and just ask the questions.

### Multi-user sync

One device makes all the sound. Every other device is a display. **Syncing
displays is trivial; syncing audio across devices is brutal.** A quarter-second
of lag on "we're in section 3" is invisible. Never sync audio.

Ship suggested **hand signals** alongside it. Partly because phones in a dark
room are light pollution, partly because hands are more beautiful than screens
in that setting, and partly because if the app defines the signals, the app
becomes the standard. That's a social moat, not a technical one.

**Economics:** one leader license, N follower devices. Group product, not
individual. Nine practitioners experience the app from the inside every session,
and some fraction will want to lead their own.

### Ambient screen mode

Between sessions / during arrival, the screen becomes the atmosphere — the four
bands rendered as slow drifting fields that respond to what's sounding and
visibly migrate when the key changes. Decoration becomes instrument.

*Tension: this must stay dark enough not to pollute the room. Ambient mode is
not bright mode.*

---

## C. Sound Design

### Bowls are first class

**The bowls are the thing. The app is the missing half of the spectrum.**

Crystal bowls occupy roughly 200 Hz – 4 kHz with long sustain and rich
harmonics, and produce essentially nothing below ~200 Hz. That's physics, not
technique. So:

> **The bowls own the mids and the top. The app owns the floor.**

There is no PA at these events and no mics — bowls are acoustically loud on
their own. The app is the *only* thing needing amplification: one source, one
speaker, no mixer, no feedback. "Your bowls and one speaker."

**Frequency carving:**
- App content in the bowl range must be **sustained and static**. The bowls
  provide all the motion. If both move they mask each other, and the reflex fix
  — turning the pads down — makes them useless.
- Sparse and still in the middle. Rich underneath and overhead.
- Talk-over mode (yoga/meditation) carves 300 Hz – 4 kHz for speech.

### The four bands

Allocate by **frequency band, not track count**. Amateur mixes turn to mud
through frequency collision, not track quantity. Bands can't collide by
construction.

| Band | Content | Rules |
|---|---|---|
| **Deep** | sub | 20–80 Hz, nothing else allowed here |
| **Bed** | drone (always) + chords (optional) | one drone only; two drones is mud by definition |
| **Voice** | Rhodes/Halpern motif, harp, toy-box plucks, chimes | sparse, register-separated |
| **Air** | crickets, waves, wind, leaves, rain stick, wave drum | can hold 2–3 elements; they coexist in nature |

Ocean waves carry real low content — filter them or they fight the Bed.

### The four laws (subtractive — these answer most future feature requests)

1. **No pulse. Ever.** Free time always. Sections are measured in minutes, not
   bars. No BPM, no metronome, no grid, no quantized cue launch.
2. **No third in the drone. Ever.** Root–fifth–octave or root–fifth–ninth. A
   third-less drone is a *permission structure* — it lets live players choose
   major or minor. The moment the drone states a third it decides for the whole
   room. This is why tanpuras and shruti boxes are root-and-fifth and always
   have been.
3. **No automated dynamics.** Nothing swells on its own. The arc is built from
   **arrangement, not automation** — you get bigger by a layer *entering*, which
   is a discrete event humans can play against, not a slow crescendo they have
   to fight or follow blindly.
4. **No competing melody.** A motif layer and a live improviser in the same
   register is two soloists.

> **The best compliment the bed can get from an improviser is that they forgot
> it was there.** Every instinct in music software pushes toward impressive.
> That instinct is the enemy of this layer.

### Harmony and the bowl constraint

The bowl set constrains **the instruction, not the engine.** Pads and chords may
use B♭, E♭, anything — the only requirement is that each section can name 2–3
bowls consonant against *everything in it*.

Rule: **never leave the bowls with nothing to do.** For each section, test every
pitch in the declared kit against every chord; if fewer than two survive, warn
the leader before the section fires. Same check governs key migration — F♯ with
a C set is a bad destination not because it's F♯ but because almost nothing in
the kit survives it.

**Weight sustain, not just interval.** A bowl rings for 20+ seconds. A tone
that's a passing tension on a piano becomes a permanent one on a bowl. A major
seventh ringing for half a minute isn't color, it's a problem.

Typical live-instrument movement is **I → IV over a static root drone** (real
sheets: `C, F, (B♭)` and `D MAJOR (D, G)`). The drone holds; the humans move.

### Global key migration — the signature gesture

The demo. Someone holding a session in D taps F♯ and over ~30 seconds the entire
room becomes F♯ — bed, texture, motifs, sub, all of it — seamlessly.

Impossible with acoustic instruments, impossible with recorded material. Only
works because everything is generated. **This is the moat in one move.**

How it must be done:
- **Common tones don't move at all.** Notes shared between old and new key sit
  still.
- Stagger the rest, one voice every few seconds, over 20–30 seconds.
- **Never glide everything simultaneously** — that's a portamento swoop, which
  is a cool effect twice and nauseating on a floor full of people with their
  eyes closed.

Machinery already exists: the nearest-voice voice-leading engine in the practice
looper solves exactly this problem.

### Palette

- **Yes:** drones, pads, sub, felt/Rhodes motif (Steven Halpern's *Spectrum
  Suite* is the reference timbre), harp/toy plucks, chimes, crickets, waves,
  wind, rain, rain stick, wave drum. All synthesizable.
- **No:** flute. Needs breath, tonguing, articulation — synthetic flute is one
  of the most instantly fake sounds there is, and one bad voice makes the whole
  palette feel cheap. Real sheets show flute played by a *human*; leave it there.
- **Maybe not:** birds. Fast pitch-swept and formant-heavy; goes uncanny fast.
  Cutting it keeps the product fully generated, which preserves instant load,
  offline operation, and tiny pack sizes.

---

## D. Future

### Lights

Not v1 — but not optional at the high end either; every real event photo has
designed light.

**Architecture now, implementation later:** the cue engine broadcasts events
(section change, key migration, fade start) from day one. Follower phones,
lights, and projection are all just *subscribers* to that stream. Nearly free to
design in; genuinely painful to retrofit.

**Lights never hang off the audio path.** Analyzing a signal is fuzzy and dumb.
The app already knows it's entering section 4 in F.

**Start with LED bowl pads, not venue rigs.** They're already in the room,
already bought, spatially perfect (they light the instrument and the
practitioner's face from below — exactly the look in the photos), and a handful
of Bluetooth pucks is a completely different engineering problem from DMX. If
section color broadcasts to the pads, **the bowls themselves become the light
show.**

### Sub / speaker

The sub is the differentiator because it's the band the acoustic instruments
physically cannot produce — not merely because nobody has one.

**Be opinionated: name one speaker.** It's now the only hardware in the entire
system; if it can't reproduce the Deep layer, the app's unique contribution is
inaudible. Leave it open and half the users hear nothing special and conclude
the app is fine-not-magic.

Caveat: typical Bluetooth speakers roll off around 80–100 Hz. For small
speakers, generate the *harmonics* of the missing fundamental (80/120/160 for a
40 Hz) — the ear reconstructs it. Reads as depth rather than nothing.

The sub should **pulse, not sit** — a slow swell near six cycles per minute,
which sits at the coherent-breathing rate that world already talks about.

**Hardware sequencing: recommend → affiliate → bundle.** Never manufacture a
speaker; powered speakers are heavy and freight-plus-damage economics will eat a
small company alive. If a physical product ever carries the brand, make it the
**LED pads**: light, cheap to ship, cheap to replace, high margin, central to
the aesthetic, and nobody else is integrating them.

### Live instrument inputs — pull this forward

Not future, and not hardware. An iPad plus a ~$100 class-compliant USB interface
is already two inputs.

**The win is shared reverb.** Run the live violin or didge through the *same*
reverb as the generated bed and the player stops sounding like they're on top of
the track and starts sounding like they're inside the piece. Right now those two
things live in different spaces and every ear in the room knows it without being
able to name it.

### Collaboration

Designs save, customize, and (later) share with other users and collaborators.

---

## E. Sound Pack Marketplace

### The critical architectural decision: packs are presets, not audio

If a pack is a downloaded track, the **key migration breaks** — rendered audio
can't transpose with the room, so purchased material clashes the moment someone
changes key. Your signature feature dies on first purchase.

If a pack is a set of engine parameters:

- kilobytes instead of hundreds of megabytes; no CDN bill, no storage problem
- 432 and 440 aren't two products, they're a number in a field
- instant download on studio wifi
- purchased material migrates with everything else, because it isn't a recording
  — it's instructions for the synths already running

Splice ships gigabytes. This ships JSON.

**Act on this now:** build the pack format immediately, even though the
marketplace is years away. **Your templates *are* packs** — same file type. Get
it right once and the marketplace later is a storefront and a payment flow
rather than a re-architecture.

### Pack structure

A pack is not a track. It's a **coherent set of sections** across one sonic
identity — closer to how drum-loop libraries ship a master groove plus
variations, but organized around sound bath *function* rather than musical
variation.

```
ATMOSFLY  (curator identity)
├── Venus
│   ├── Opening      (C)
│   ├── Grounding
│   ├── Unwinding
│   ├── Release
│   ├── Restore
│   └── Return
└── Mars
    └── … same sonic identity, different journey
```

Then repeat across ~8 designers, and eventually open it up.

### The taxonomy is the intelligence of the whole product

**This is the most important open item in this document.**

Packs, templates, the wizard, and the design UI all derive from a canonical set
of sound bath *functions*. That taxonomy has to come from studying real sessions
— it cannot be invented at a desk.

**v0, extracted from two real sheets (n=2, treat as a hypothesis):**

| Function | Pitched? | Observed as |
|---|---|---|
| Arrival / gathering | no | Insects, poem, chiming bowls |
| Grounding | **yes** — Root chakra, C | `BOWL 1 3 5 (2 4 6) [7]` |
| Transition / wash | no | Gongs, Ocean |
| Opening / flow | **yes** — Sacral, D | `BOWL 2 6 (3 5 7) [1,4]` |
| Expression | no | Drone & flute, shakers |
| Release | no | Rain |
| **Space** | no | programmed silence |
| Bloom / heart | **yes** — Heart, F | `BOWL 4 6 1 8 (2 3 5) [7]` |
| Return / close | no | Chimes |

Both observed sessions ascend **C → D → F** and close on a texture. Collect
20–30 more real session sheets before hardening this.

### Revenue model note

Practitioners build somewhere between four sessions a year and one every few
months. That means packs are **closer to buying another bowl than to a
subscription** — occasional, considered, a genuine expansion of capability. Real
revenue; wrong model if planned as monthly churn.

### Artist strategy

The names that matter here (East Forest, Jon Hopkins territory) aren't on Splice
and never will be. They sell direct, and there is no format anywhere for
*interactive, modular ambient by a known artist.* Genuine white space — and
genuine unproven-ness.

Start with **local legends**: the biggest practitioner in each regional scene
writes a pack, becomes an affiliate, and brings their audience. That's how it
starts, not with a marquee signing.

Cold-start fix: **the house makes the first inventory.** Three or four in-house
curator identities with genuinely distinct sonic personalities gives a populated
shelf on day one without pretending anyone else is there.

---

## F. Branding

### Direction

Modern and hip, but wellness. Draw from yoga, tea sharing, tarot, ceremony —
not from music software and not from spa clichés.

**Reference to steal from:** Lumen (Kompose Audio) — the four-strip anatomy, the
near-monochrome restraint, the thin high-contrast serif over a plain functional
sans. That pairing says *beautiful object* and *actual tool* simultaneously,
which is the register.

**What to invert from it:** the value. Lumen is a light UI built for a bright
studio. This runs in a candlelit room; light UI is disqualifying.

**What to kill:** fantasy sample-library naming (Aeonis Pad, Mystivox Pad).
Tab bars. Keyboard graphics. Anything that says "music production software."

### Palette

Near-black ground with a violet cast. Atmosphere fields in muted violet and
silver. **Warm amber reserved exclusively as the "this is live" accent** — same
discipline as the practice looper, where amber only ever means sounding. Amber
is also the most legible color in a dark room, so the functional and aesthetic
answers agree.

Section coding runs **cool** (indigo → violet → teal → soft rose), because the
rooms are already washed warm and warm codes vanish into them.

Never: the near-black + acid-accent "AI dark mode." Never: chakra rainbow at
full saturation on a screen.

### Typography

Thin high-contrast serif (Didone family) for the wordmark and identity only.
A clear sans for everything operational, **at sizes that feel slightly too large
on a desk** — because they'll be right on a floor, at four feet, in the dark.

### The hero

Always the person. Never the app.

- The bowl player who becomes someone who can lead ten practitioners.
- The meditation teacher who becomes someone who designs a whole experience.
- *One violin player becomes a symphony.* ← keep this line

The film is a two-minute piece about a Thursday that turned into something, with
**three cuts of a screen in it.** Plants, tea, two friends over a laptop, the
syncing pulse, bowls out of a canvas bag — then eighty seconds of the room.
Closing line: **"We made it happen."** Keep that pronoun.

One insider shot: someone raises a hand mid-session and the room changes. No
caption. Outsiders read atmosphere; practitioners sit up, because they know
exactly how hard that is and that they can't currently do it.

---

## Open tensions (unresolved, decide deliberately)

1. **Chakra color vs. legibility.** Chakra hues are semantically perfect and
   half of them vanish in a candlelit room. Proposed resolution: chakra color
   lives on the **LED pads** (light source), cool arc lives on **screens** (read
   at distance). Not yet decided.
2. **Ecstatic dance has a pulse.** That breaks law #1. Recommendation: let the
   law win. It's a different mode at best and probably a different product;
   bending the primary rule for a secondary market is how coherent things become
   everything-apps.
3. **Web vs. native.** Money favors web (no 30% cut on a four-figure product
   sold hand-to-hand). Engineering favors native: iOS Safari suspends audio on
   backgrounding, phone calls interrupt the context, Bluetooth route changes can
   kill it outright. Recoverable on a practice tool; **catastrophic when the room
   goes silent at minute thirty of a ticketed event.** Reliability probably wins.
4. **Design mode scope.** Real risk of the timeline quietly becoming a DAW.
   Guardrail: four bands, fixed roles, no track adding, no automation lanes.
5. **Ambient screen mode vs. dark room discipline.** Must be reconciled.

---

## Risks

1. **The sound is unvalidated.** Everything above rests on generated material
   sounding world-class over a real speaker to someone with taste. In a sound
   bath the pad *is* the art — forty minutes, nothing else happening, people
   lying on the floor specifically to listen to it. There is no margin for
   "good enough," and it fails *quietly*: nobody says it sounded synthetic, they
   just stop opening it. **Test this before building anything else.**
2. **Founder-market fit de-risks messaging, not product.** Spanning two mutually
   suspicious communities (wellness distrusts tech; music-tech doesn't take
   sound healing seriously) is a real and rare asset. It does not make the thing
   good.
3. **Musician builds for non-musicians.** The consistent failure mode is adding
   flexibility. It feels like generosity to the builder and reads as a wall to
   the user. Discipline: **dictator about timbre, tuning, fade curves, palette —
   cowardly about interface.** Whatever seems like the minimum adjustable, it's
   less than that.
4. **Ten warm sales validate relationships, not a market.** The real signal is
   buyer eleven — someone who found it cold and paid anyway. Ten warm sales are
   still worth doing; just read the result correctly.
5. **Scope.** Engine + timeline + cue + sync + templates + lights + hardware +
   marketplace is many products. See sequencing.

---

## Competitive landscape (researched)

Three crowded categories, none of them this:

- **Consumer listening** — The Sound Bath App, PAUSE (Sara Auster), Insight
  Timer, Sound Bath Journeys. All *lie down and receive*.
- **Business software for healers** — Flowdara, Breely, Acuity, ZenPass.
  Somebody already noticed these practitioners pay for tools; they built for the
  calendar.
- **Generative engines for musicians** — **Wotja**, which is the closest thing
  and ships with *130+ engine parameters*. That number is the entire thesis in
  one object: the technology has been solved for years and packaged for exactly
  the person who isn't the customer. **Endel** went the other way — fully
  automatic, biometric, zero authorship, made for earbuds not a room.

**Nothing exists for the fifty minutes a practitioner is standing in front of
sixty people.** Not failing — empty.

Why it's empty: everyone chased listeners, rationally, because that market is
millions and facilitators are thousands. Run the numbers — a few thousand
practitioners at a few hundred dollars is a genuinely good business and a
genuinely terrible venture business. **Nobody funded is coming for this.** It
requires fluency in both bowls and code, which is an unusually specific keyhole.

Strategic consequence: build lean, sell direct, don't raise, and never let
anyone reframe it as a consumer play — that's the version that forces a pivot to
listeners and becomes the eleventh app in category one.

---

## Sequencing

**Phase 0 — Validate the sound.** Four bands, key migration, crude UI, no
timeline, no sync, no lights. Run it loud through a real speaker in a real room
in front of the strongest practitioner available. *Everything else is downstream
of this answer.*

**Phase 1 — The sheet generator.** Enter sections and keys, print the handouts.
No audio engine required. A weekend. Immediately useful, and the fastest test of
whether this reads as *made by someone who's been in the room.*

**Phase 2 — Templates + perform mode.** Cue list, HOLD/NEXT/JUMP, follower sync.
Performable without a designer existing.

**Phase 3 — Design mode.** Four-band Lego timeline, the wizard, ensemble config.

**Phase 4 — Pack format hardening + in-house curator packs.**

**Phase 5 —** Lights (LED pads), live inputs, marketplace, hardware bundle.

---

## Appendix: research still owed

- **20–30 real session sheets** from multiple practitioners → harden the
  taxonomy. Highest-leverage research in the project.
- Do practitioners actually want to compose, or do they want to *run* good
  designs? (Suspicion: more of the latter than a musician would assume.)
- Fifteen-minute test with a non-musician: can they reach a runnable structure?
- What speaker to recommend, tested against the Deep layer.
