# Ear tests — only Adam can run these

Things the code cannot answer. Each one is written so it can be run cold, months
later, without reconstructing the reasoning: what to do, what to listen for, and
what we change in each outcome.

**Rig:** the system with a real sub. Not headphones, not a laptop — the point of
every test here is what a body in a room feels.

---

## E1 · Does the fourth rub against the fifth? · **critical, not urgent**

Filed 2026-07-31. Adam: *"we have to take a note for me to test the fourth thing
by ear — it's critical, just not now."*

### What to do

1. Any session. Open a **Bed** block in Design and turn on **Colour — a fourth
   under the drone.**
2. Run it. Listen in the low end, on the sub, from the middle of the room.
3. Do it in **C** and again in **F** or **G** — the effect changes with key,
   and the room changes with it.

### What you're listening for

With Colour on, the drone contains a **whole tone in the bass**: the fourth
(`root+5`) sitting directly beneath the fifth (`root+7`). On a C root that's
**F2 at 87 Hz against G2 at 98 Hz — about 11 Hz apart**, which is well inside a
single critical band. Two tones that close *beat*. The upper pair does the same
thing an octave up (F3 175 Hz against G3 196 Hz, ~21 Hz apart) at a much lower
level.

**The question is whether that beating reads as warmth or as mud.**

- **Warmth** — a harmonium-like breathing thickness; the drone feels alive
  without anything moving. **Pass.**
- **Mud** — the low end loses definition, the root stops being identifiable,
  it sounds like a problem rather than a colour. **Fail.**

### Why this matters more than it looks

**Law 3 forbids automated dynamics — nothing in this engine may move on its own.**
So acoustic beating between fixed tones is the *only* movement Bed is permitted
to have. If it works, it's the smartest thing in the engine: motion with no
modulation, physics doing what an LFO isn't allowed to. If it doesn't, we're
shipping roughness in the one band that has no competition and calling it a
feature.

It is also **the only place in the whole app where the fourth appears.** Law 2
permits root / 4th / 5th / 8ve / 9th; the default drone spends four of those and
holds the fourth in reserve. This toggle is the entire reserve.

### What we do with each answer

| Outcome | Change |
|---|---|
| **Warmth** | Nothing. Fix only the copy — *"a fourth **under** the drone"* is ambiguous: `+5` is above the root and sits *under the fifth*, inside the stack, not below everything. |
| **Mud in the low octave only** | Drop the low fourth's level (currently **0.30** against the fifth's 0.46) or move it up an octave, keeping the 11th at 0.12 as a tint. |
| **Mud everywhere** | The interval is wrong in the bass. Voice the fourth *above* the octave only, or retire the toggle — the drone was designed without a fourth and works. |

**Reference numbers** (`bedPitches` + `setChords`):

```
root      0.62      root+5   0.30   ← the colour
root+7    0.46      root+17  0.12   ← the colour, an octave up
root+12   0.40
root+19   0.24
root+26   0.11
```

---

## E2 · Does the low end sound unchanged with automatic sub reinforcement?

Filed earlier, still open. The "Small speaker" toggle was replaced with
pitch-scaled reinforcement — `clamp((70 - hz) / 30, 0.15, 1)` — that runs
always, including through key migration.

**Listen for:** on a rig that *does* reach 40 Hz, you should hear the
fundamental and not the help. If sessions in low keys now sound thicker or
honkier than they did in v1.0, the floor of 0.15 is too high.

---

## E3 · Does the choir make room for a live player, or compete?

Filed with v1.1. Choir is formant-filtered — fixed vowel resonances rather than
harmonics that travel with pitch.

**Listen for:** play bowls over it. Law 4 says the Voice yields to any melodic
human in the room; the drone has no such rule, and a choir is closer to a human
voice than a pad is. If it crowds a live player, the character needs a level
trim, not a new filter.
