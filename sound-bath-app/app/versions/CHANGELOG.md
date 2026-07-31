# Bed — versions

Frozen snapshots you can open directly in a browser, so two versions can be
played side by side and compared **by ear**. Git already keeps every version
forever; these exist because a file you can double-click is more useful than a
command when the thing you're judging is sound.

The live app is always `../index.html`. These are history.

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
