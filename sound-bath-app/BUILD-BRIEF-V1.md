# Build Brief — v1

Companion to `VISION.md`. That document is the *why* and the whole picture.
This one is the *what*, precisely scoped, with the facts and algorithms that
cannot be derived from first principles.

**Read `VISION.md` first.** Then build only what's in §1 here.

---

## 1. Scope of v1

Build **the sound engine and perform mode**, with sessions loaded from JSON
fixtures. Nothing else.

### In

- The four-band generative engine (Deep / Bed / Voice / Air)
- Global key migration with common-tone voice leading
- Session playback from a fixture file — sections in order, with cue control
- **Leader view**: current section, intention, time, what's next, GO / HOLD / JUMP
- **Follower view**: the bowl sheet for the current section, one section at a time
- Ensemble setup: bowl kit, reference pitch, who's playing what
- Live players mode (one switch)

### Explicitly out — do not build these

| Not in v1 | Why |
|---|---|
| Design mode / timeline editor | Sessions come from fixtures. Editing is Phase 3. |
| Multi-device sync | Follower view renders on the same device for now. Phase 2. |
| Lights / LED pads | Phase 5. But see §6 — emit the events anyway. |
| Marketplace, packs, accounts | Phase 4+. |
| Structure wizard | Phase 3. |
| Audio input / live instrument routing | Later. |
| Any use of the word "AI" | Never. See VISION.md. |

A shallow version of all six phases is worth nothing. A real version of this
scope is demoable in a room this week.

### The reference implementation

`prototype/bed.html` is a working four-band engine with correct key migration.
It is a **listening prototype** — the synthesis is the deliverable, the UI is
throwaway. Take the audio architecture; throw away everything visual.

---

## 2. Domain facts (cannot be derived — do not invent alternatives)

### 2.1 The chakra ↔ bowl ↔ key table

A standard seven-bowl crystal set means **bowl number = chakra number = scale
degree in C**, all three at once. This is why C, D and F dominate real sessions.

| Bowl | Note | Chakra | Intention |
|---|---|---|---|
| 1 | C | Root | Security + Groundedness |
| 2 | D | Sacral | Creativity + Pleasure |
| 3 | E | Solar Plexus | Courage + Discipline |
| 4 | F | Heart | Love + Compassion |
| 5 | G | Throat | Connection + Expression |
| 6 | A | Third Eye | Intuition + Wisdom |
| 7 | B | Crown | Faith + Excitement |
| 8 | C | (octave) | — |

**The UI never asks for a key.** It asks for a chakra and derives the key. Mode
is an optional refinement (real sessions use both `C MAJOR` and `C MIXO`).

This mapping is a 20th-century Western convention, not a physical property, and
the app treats it accordingly: **it labels, it never explains.** Render
`HEART · F`. Never write copy asserting what a frequency does to a body. No
health claims anywhere.

### 2.2 The bowl sheet notation

Real practitioners already hand out a printed sheet. It encodes four tiers in
**punctuation, not words**:

```
BOWL  1 3 5  (2 4 6)  [7]
      │      │        └── restricted: contradicts the mode
      │      └── sparingly
      └── freely available;  bold = the root
```

Reinforce the tiers **visually** — size and brightness, not vocabulary. Bowl 1
large and bright, 5 medium, 3 small and dim. It has to read at fifteen feet, in
the dark, by someone who reads no music and possibly no English. Words are a
legend, never the mechanism.

**Bowl numbers are physical, not theoretical.** Bowl 4 is the fourth bowl in the
arc regardless of key. Never render "the third" or "the fifth" anywhere a
practitioner can see.

### 2.3 The bracket algorithm

> **Important:** law 2 ("no third in the drone") constrains the **synth Bed
> only**. Bowls are played by humans and *may* state the third — the real
> sheets put it in the free tier. Do not confuse these.

```
For a section with root R, mode M, and a declared kit K:

  scale = pitch classes of M transposed to R
  triad = the section's own triad (1, 3, 5) transposed to R

  For each bowl b in K:
    if b is the octave bowl AND (pc(b) == R OR pc(b) not in triad):
        skip it entirely            // it duplicates bowl 1; only name it when
                                    // the doubling adds a non-root chord tone
    if pc(b) in triad     -> FREE        (plain; bold the root)
    elif pc(b) in scale   -> SPARING     (parens)
    else                  -> RESTRICTED  (brackets)

  Order the free tier by chord degree — root, third, fifth — with the octave
  bowl immediately after its same-pitch partner.

  Then demote to RESTRICTED any bowl forming a minor 2nd, major 7th or tritone
  against ANY chord the section will sound. Bowls ring for 20+ seconds, so a
  tension that would pass on a piano becomes permanent.
```

Scale degrees, for the avoidance of doubt:

```
major       0 2 4 5 7 9 11      dorian      0 2 3 5 7 9 10
mixolydian  0 2 4 5 7 9 10      minor       0 2 3 5 7 8 10
lydian      0 2 4 6 7 9 11
```

**Verified against all three real sections — this implementation reproduces
them exactly:**

| Chakra | Mode | Output | Why the bracket |
|---|---|---|---|
| ROOT | C mixolydian | `1 3 5 (2 4 6) [7]` | mixolydian wants B♭; bowl 7 is B♮ |
| SACRAL | D major | `2 6 (3 5 7) [1, 4]` | D major wants C♯ and F♯; bowls 1 and 4 are C♮ and F♮ |
| HEART | F major | `4 6 1 8 (2 3 5) [7]` | F major wants B♭; bowl 7 is B♮ |

Every bracketed bowl is exactly the one that fights the key. If your output
differs, the implementation is wrong — these are transcribed from sheets used
at real sold-out events.

Sanity output for modes not on the sheets (all white-note, so nothing is ever
restricted — which is why modal sections are so bowl-friendly):

```
D dorian       2 4 6 (1 3 5 7) []
G mixolydian   5 7 2 (1 3 4 6) []
F lydian       4 6 1 8 (2 3 5 7) []
A minor        6 1 8 3 (2 4 5 7) []
```

### 2.4 The bowl constraint binds the instruction, not the engine

Pads and chords may use any pitch. The **only** requirement is that each section
can name at least two bowls consonant against everything in it.

> **Rule: never leave the bowls with nothing to do.**

Check each section at load. If fewer than two bowls survive, warn the leader
*before* the section fires. The same check governs key migration — F♯ with a C
kit is a bad destination not because it's F♯ but because almost nothing in the
kit survives it.

### 2.5 Sections alternate pitched and textural

```
[texture] → ROOT (C) → [texture] → SACRAL (D) → [textures] → SPACE → HEART (F) → [texture]
```

Pitched sections carry chakra + mode + bowls. Textural sections carry neither —
Ocean, Rain, Gong, Chimes, Insects. **Space (near-silence) is a programmed
element in its own right**, not a gap.

### 2.6 Every section carries a phrase

Real sheet, read top to bottom: *The rock / What grows / Will live / And shed /
What's shed / Will burn / What's left / Is Home.* Under the title **LET IT BURN
WHAT IT MUST.** The session is one sentence broken across its sections.

This is how the leader and the whole ensemble know what a section is *for*. The
phrase is a first-class field, not optional metadata, and it belongs on the
follower view.

---

## 3. The four laws (structural, not conventional)

1. **No pulse. Ever.** Nothing is scheduled to a tempo. Sections are measured in
   minutes. There is no BPM anywhere, no metronome, no grid, no quantized cue
   launch. *(This is why cue firing is easy: nothing to quantize to.)*
2. **No third in the drone. Ever.** Root / fifth / octave / ninth only. A
   third-less drone is a **permission structure** — it lets live players choose
   major or minor. Stating a third decides for the whole room.
3. **No automated dynamics.** Nothing swells on its own. The arc is built from
   **arrangement** — a layer *entering* is a discrete event humans can play
   against; a slow crescendo is something they must fight or follow blindly.
4. **No competing melody.** Voice is sparse, quiet and register-separated. A
   motif layer and a live improviser in the same register is two soloists.

> These four answer most future feature requests without a discussion.

*One deliberate exception:* the Deep band may breathe at ~0.1 Hz (six cycles a
minute, the coherent-breathing rate). It is a timbral property of the sub, not
an arrangement dynamic, and it is user-defeatable.

---

## 4. Sound design

### 4.1 Bowls are first class

Crystal bowls occupy roughly **200 Hz – 4 kHz** with long sustain and produce
essentially nothing below ~200 Hz. That's physics.

> **The bowls own the mids and the top. The app owns the floor.**

There is **no PA and no microphones** at these events — bowls are acoustically
loud on their own. The app is the only thing needing amplification. One source,
one speaker, no mixer, no feedback.

**Frequency carving, non-negotiable:**
- App content in the bowl range is **sustained and static**. The bowls provide
  all the motion. If both move, they mask each other, and the reflex fix —
  turning the pads down — makes them useless.
- Sparse and still in the middle. Rich below and above.
- Talk-over mode (yoga / guided meditation) carves 300 Hz – 4 kHz for speech.

### 4.2 The four bands

| Band | Range | Content | Constraints |
|---|---|---|---|
| **Deep** | 20–80 Hz | sub | nothing else lives here; optional 0.1 Hz breath; harmonic reinforcement fallback for small speakers |
| **Bed** | low–mid | drone (always) + chords (optional) | one drone only — two is mud by definition; never a third |
| **Voice** | mid | FM Rhodes motif, harp, chime | one tone every 9–26 s; never a melody |
| **Air** | 1 kHz+ | crickets, waves, wind, rain | 2–3 elements may coexist; high-pass waves or they fight the Bed |

Allocate by **band, not track count** — amateur mixes turn to mud through
frequency collision, not track quantity. Bands cannot collide by construction.

### 4.3 Key migration — the signature gesture

The demo. Ten seconds sells the whole product, and it is impossible acoustically
and impossible with recorded material.

- **True common tones do not move at all.** Match by pitch class across the whole
  voice set, not positionally. F→C shares C and G; three of five voices must sit
  perfectly still.
- Stagger the rest, one voice every few seconds, over 20–30 s total.
- **Never glide everything simultaneously** — that is a portamento swoop, which
  is a cool effect twice and nauseating on a floor of closed eyes.
- The Deep band moves last and slowest.

Reference implementation and a verified test matrix are in `prototype/bed.html`.

### 4.4 Palette

**Yes:** drones, pads, sub, felt/Rhodes motif (Steven Halpern's *Spectrum Suite*
is the reference timbre), harp and toy plucks, chimes, crickets, waves, wind,
rain, rain stick, wave drum.

**No:** flute — needs breath, tonguing and articulation; synthetic flute is one
of the most instantly fake sounds there is, and one bad voice makes the whole
palette feel cheap. Real sessions use a *human* flute player; leave it there.

**Probably no:** birds — fast pitch-swept and formant-heavy, goes uncanny fast.
Cutting them keeps the product fully generated, which preserves instant load,
offline operation and tiny pack sizes.

### 4.5 Never exactly the same

Structure fixed, surface never. Same design, same arc, same key — but the
crickets never repeat, motifs land differently, the pad breathes differently.
Free with a generative engine, impossible with rendered audio, and it is what
makes a small repertoire survivable when someone runs the same four designs
forty times a year.

---

## 5. Physical constraints (from real event photography)

These are not style preferences. They are the room.

- **Nowhere to put a phone** inside the bowl arc; bowls are packed edge to edge
  with candles filling the gaps.
- **No free hand** — a mallet in each one. Perform mode is **display-only** by
  default. Optional Operator role for when someone genuinely is at a laptop.
- Screens are read at **~4 feet, at an oblique angle, in low light**.
- Rooms are **washed in warm amber** (candles + tungsten). **Warm section colors
  disappear into it. Cool colors survive.**
- Screens must drop to **dim amber / deep red** once a session starts. A bright
  white phone in that room is disrespectful and everyone in it knows.
- Fade times are **ergonomic, not aesthetic** — the crossfade is the window in
  which a human sets down one bowl and picks up another. Thirty seconds is
  indulgent as a musical choice and exactly right as a physical one.

---

## 6. Architecture requirements

### 6.1 The cue engine is an event broadcaster

From day one, emit events — `section:change`, `key:migrate`, `fade:start`.
Follower views, lighting and projection are all **subscribers** to that stream.
Nearly free to design in now; genuinely painful to retrofit.

**Lights must never hang off the audio path.** Analyzing a signal is fuzzy and
dumb when the app already knows it is entering section 4 in F.

### 6.2 Sync model (when it lands in Phase 2)

**One device makes all the sound. Every other device is a display.** Syncing
audio across devices is brutal — clock drift, jitter. Syncing display state is
trivial, and a quarter-second of lag on "we're in section 3" is invisible.
Never sync audio.

### 6.3 Reference pitch

An **editable Hz field**, not a 432/440 toggle. Then 432, 528, the whole
solfeggio set and every future request fall out of one control and you never
ship another tuning feature.

### 6.4 The session format is the pack format

Get this right now. **Templates are packs** — same file type. A session is
**parameters, not audio**: kilobytes not megabytes, no CDN, tuning is a field,
and purchased material migrates with the room because it isn't a recording.
Rendered audio would break key migration on first purchase.

```jsonc
{
  "format": 1,
  "title": "Full Moon in Leo",
  "subtitle": "Let it burn what it must",
  "refHz": 440,
  "kit": { "type": "standard7" },        // or { "type":"custom", "pitches":[...] }
  "sections": [
    {
      "id": "root",
      "name": "Root Chakra",
      "phrase": "The rock",              // the poem — first class, not metadata
      "kind": "pitched",                 // "pitched" | "texture" | "space"
      "chakra": 1,                       // derives key C
      "mode": "mixolydian",
      "minutes": 8,
      "fadeIn": 30,                      // seconds — ergonomic, see §5
      "bands": {
        "deep":  { "on": true,  "level": 0.7 },
        "bed":   { "on": true,  "level": 0.8, "chords": false },
        "voice": { "on": true,  "level": 0.4 },
        "air":   { "on": true,  "level": 0.5, "elements": ["crickets"] }
      },
      "liveChords": ["C", "F", "Bb"]     // leader view only — never shown to followers
    },
    {
      "id": "ocean",
      "name": "Ocean",
      "phrase": "What grows",
      "kind": "texture",
      "minutes": 5,
      "fadeIn": 40,
      "bands": {
        "deep":  { "on": true,  "level": 0.5 },
        "bed":   { "on": false },
        "voice": { "on": false },
        "air":   { "on": true,  "level": 0.75, "elements": ["waves", "wind"] }
      }
    }
  ]
}
```

Bowl assignments are **computed at load** from `chakra` + `mode` + `kit` using
§2.3 — never stored. That way one session file works with any kit.

---

## 7. Fixtures — two real sessions

Transcribed verbatim from handouts used at real sold-out events. Build against
these, not against an invented example. `prototype/fixtures/` holds them as JSON;
the source sheets are reproduced here for reference.

### 7.1 "Full Moon in Leo — Let it burn what it must"

| # | Section | Phrase | Kind | Key | Bowls |
|---|---|---|---|---|---|
| 1 | Root Chakra | The rock | pitched | C mixo | `1 3 5 (2 4 6) [7]` |
| 2 | Ocean | What grows | texture | — | — |
| 3 | Sacral | Will live | pitched | D maj | `2 6 (3 5 7) [1, 4]` |
| 4 | Rain | And shed | texture | — | — |
| 5 | Gong | What's shed | texture | — | — |
| 6 | Flute & Shakers | Will burn | texture | — | — |
| 7 | Space | — | space | — | — |
| 8 | Heart Chakra | What's left | pitched | F maj | `4 6 1 8 (2 3 5) [7]` |
| 9 | Chimes | Is Home | texture | — | — |

*Leader annotations (handwritten on the original, follower-invisible):*
Root — acoustic, `C, F, (B♭)`. Ocean — `D major (D, G)`, "reaching for light",
B minor. Sacral — `+ electric / E-bow`.

### 7.2 "Seeding and watering the soil"

| # | Section | Phrase | Kind | Key | Bowls |
|---|---|---|---|---|---|
| 1 | Insects / Poem | — | texture | — | — |
| 2 | Root | Earth, Seeding | pitched | C maj | `1 3 5 (2 4 6) [7]` |
| 3 | Gongs | Trust, Buried | texture | — | — |
| 4 | Ocean | Water, Watering the soil | texture | — | — |
| 5 | Sacral | Flow, The blood of my life | pitched | D maj | `2 6 (3 5 7) [1, 4]` |
| 6 | Drone & Flute | Express, from the seed | texture | — | — |
| 7 | Rain | Release and Receive | texture | — | — |
| 8 | Heart | Bloom, from the soil I grow | pitched | F maj | `4 6 1 8 (2 3 5) [7]` |

Both sessions ascend **C → D → F** and close on a texture. Note section 2's
annotation on the original: *"2nd half some walk and chime"* — roaming
instructions are real and belong on the follower view.

---

## 8. Aesthetic direction

**Own every visual and interaction decision.** Layout, typography, exact
palette, motion, component structure, what the GO button feels like, how the
bands are visualized — all yours. What follows is direction, not specification.

**Register:** modern and hip, but wellness. Draw from yoga, tea ceremony, tarot.
Not from music software, not from spa clichés.

**Steal:** Lumen by Kompose Audio — the four-strip anatomy, the near-monochrome
restraint, a thin high-contrast serif over a plain functional sans. That pairing
says *beautiful object* and *actual tool* simultaneously.

**Invert:** its value. Lumen is a light UI for a bright studio; this runs in a
candlelit room.

**Kill:** fantasy sample-library naming ("Aeonis Pad"). Tab bars. Keyboard
graphics. Anything that reads as music production software.

**Palette direction:** near-black ground with a violet cast; atmosphere in muted
violet and silver; **warm amber reserved exclusively for "this is live."**
Section coding runs cool (indigo → violet → teal → soft rose) because the rooms
are already warm.

**Never:** near-black with an acid accent ("AI dark mode"). Chakra rainbow at
full saturation on a screen — half of those hues vanish in candlelight. *(Open
question: chakra color may belong on the LED bowl pads, where it is a light
source rather than a screen read at distance.)*

**Typography:** thin high-contrast serif for identity only. A clear sans for
everything operational, at sizes that feel slightly too large on a desk —
because they will be right on a floor, at four feet, in the dark.

**Motion** is functional: showing where you are in a session, showing what's
active, showing a key migrating. Never decorative.

---

## 9. The bar

> Someone who loves sound but cannot compose becomes someone who can lead a room.

Fifteen minutes from opening the app to a runnable fifty-minute structure. If a
feature doesn't serve that, cut it.

And the sound has to be good enough that a practitioner with real ears would
willingly lie on the floor inside it for forty minutes. **In a sound bath the
pad is not furniture — it is the art.** There is no margin for "good enough,"
and it fails quietly: nobody says it sounded synthetic, they just stop opening
it.
