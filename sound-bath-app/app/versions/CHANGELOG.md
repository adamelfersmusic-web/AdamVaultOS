# Bed — versions

Frozen snapshots you can open directly in a browser, so two versions can be
played side by side and compared **by ear**. Git already keeps every version
forever; these exist because a file you can double-click is more useful than a
command when the thing you're judging is sound.

The live app is always `../index.html`. These are history.

---

## v1.4 — blocks draw their envelope · 2026-07-31

A block used to draw its **level** — a rectangle filled from the bottom. It now
draws its **envelope**: the fill rises over the fade-in, holds at the level, and
falls over the fade-out.

The gap this closes is real. In the demo session the Root floor departs over 45
seconds and the gong floor arrives in 6; those feel nothing alike in a room, and
a timeline whose entire job is time was drawing them identically.

**Proportional on purpose.** A short fade *should* read as near-vertical — this
is a clock, and putting a taper somewhere other than where it happens would be a
nicer picture and a false one. So on a 4-minute gong block a 6-second entry is a
2.5% bevel and a 45-second exit is a 19% slope, and the difference between them
is exactly the thing you can now see. Fades that would overlap on a short block
scale down together into a triangle rather than crossing over.

One `clip-path` polygon; no new markup. `.lv` became full-bleed and the clip does
what the height used to.

### Changed since v1.3
| | |
|---|---|
| `envelope(b)` | new — returns the polygon for a block's fade-in / level / fade-out |
| `.blk .lv` | `inset: 0` + `clip-path`, was `bottom: 0` + `height` |

---

## v1.3 — a readable Floor, and no more wizard · 2026-07-31

**Floor now says where it is.** A `0 dB` / `−4 dB` / `+3 dB` readout sits on
the label line in The room, and a thin mark on the track shows neutral.

The problem it fixes is real and was invisible until someone opened the panel
in a room: Floor's range is deliberately asymmetric — `−12 … +6`, because a
room far more often needs *less* floor than more — so **zero sits two-thirds
along the track and a slider parked at neutral looks boosted.** The one control
you'd actually reach for mid-session was the one you couldn't read.

The mark is derived from the input's own `min`/`max`, so it can't drift out of
true if the range is ever changed. At neutral the thumb covers it, so there is
never a stray second mark on the track.

**Snap-to-zero was considered and dropped.** Floor steps in 1 dB, and a snap
wide enough to feel would swallow `−1` and `+1` — which are real corrections, not
rounding error. On an eighteen-step slider with the number right there, the
readout *is* the snap. Double-tap already returns to neutral, and the hint now
says so in those words.

**"Wizard" is gone from the interface.** Two strings — *"Let the wizard shape
it"* and *"Start with the wizard"*. The word is software's, not this room's, and
it promises magic where the app is actually offering a short conversation. Both
now name what the thing is: **"Let five questions shape it"** and *"Five
questions and you have a session you can run."* Internal identifiers are
untouched; this was a copy change, not a rename.

### Changed since v1.2
| | |
|---|---|
| The room | Floor value readout on the label line; neutral marked on the track |
| `setFloor()` | calls `renderFloorVal()`, so the number can't fall out of sync |
| `.capline` / `.slidewrap` | new, and reusable by any control that needs a value or a detent |
| copy | two "wizard" strings replaced |

---

## v1.2 — shimmer · 2026-07-31

**A third drone character: Shimmer.** Pad · Choir · Shimmer, on the same Bed
block control added in v1.1 — no new surface, one more entry in a list that
already existed.

**It is not a new layer.** A barely-there shimmer two octaves up has been in
every Bed voice since the beginning, at gain `0.007` — about −43 dB, the only
thing above ~3 kHz. Shimmer brings it forward and adds a fifth and a third
octave above it (`f×4`, `f×6`, `f×8`), while the body pulls back to 62% so the
voice gets **brighter, never louder**.

**Why it doesn't fatigue.** Brightness is the one variable BOOK calls
asymmetric — *"slightly dark is pleasant, slightly bright is fatiguing within
minutes and ruins a room."* Two things keep this on the right side: the extra
energy is high *partials* at low level rather than a raised filter cutoff, and
each glint breathes on its own slow cycle so they never pulse together. That
independence is what reads as light moving instead of tremolo. All of it rides
the pre-fader reverb send, so the shimmer is mostly room.

**Law 5 is intact.** *Never bright by default* is a statement about defaults.
Shimmer is opt-in, per block, and every default is still `pad`.

---

## v1.1 — the choir · 2026-07-31

**Drone character on bed blocks.** Each Bed-lane block can now be **Pad** (the
original — two saws and a triangle) or **Choir**. Set it in the block drawer;
the timeline label shows which. Different sections can carry different
characters, and moving between them crossfades over ten seconds.

**Why the choir is built the way it is.** The wavetable lab
(`../../lab/wavetables.html`) tested whether a producer's sound could ship as a
harmonic spectrum. It mostly can't: the Bed lane filters at
`min(f × 5.5, 1450 Hz)`, so on an F session only about five harmonics survive,
and the tables differ above the 5th. Timbre also lives in the attack, and a
drone has none. **The one that did sound different was the choir — because it
is architecture, not data:** four singers a few cents apart per part, through
*fixed* formant filters, plus breath. Vowels are fixed frequencies; wavetable
harmonics travel with the note, so a choir shipped as a spectrum would chipmunk
as the key migrates. `retune()` deliberately leaves formants alone.

**Floor is now visible on the perform screen.** When it isn't neutral, a small
`floor −4` sits beside the clock — and tapping it opens The room. It was
previously discoverable only by knowing the ☰ menu held it, which meant nobody
would have found it.

**Open question for v1.2:** the human voice is the most attention-grabbing
sound there is, and the drone's job is to disappear. The choir sits slightly
lower and darker than the pad for that reason. Whether it makes room for a live
flute or competes with one is a judgment only a musician in a real room can
make.

### Changed since v1.0
| | |
|---|---|
| `BedVoice` | takes a `character`; `buildChoir()` adds the formant path |
| `Bed` | `setCharacter()` crossfades voice sets over 10 s, pitch logic untouched |
| `evaluate()` | applies the governing bed block's character |
| block drawer | Character chips on Bed blocks |
| timeline | Bed blocks read `choir` instead of `drone` |
| perform screen | the floor readout beside the clock, tappable |
| `retune()` | guards `this.lp` and never moves formants |

---

## v1.0 — 2026-07-31

The build the brand kit was extracted from, plus that day's work:

- **Band status row** on the perform screen — SUB / DRONE / MOTIF / TEXTURE,
  filled when sounding, hollow when silent
- **Multi-device sync** — leader broadcasts state snapshots, followers render
  the sheet; BroadcastChannel locally, a WebSocket relay for real devices
- **Floor** — a room control for the sub, independent of the arrangement
- **Automatic sub reinforcement**, scaled by how low the key sits and updating
  on every migration. Replaced the "Small speaker" toggle, which asked a
  question nobody could answer and failed silently
- **The stack mark** replaced the amber ring; the ring stayed as the GO control
- Wizard option layout fix (label and subtitle ran together)
