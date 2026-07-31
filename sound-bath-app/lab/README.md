# lab/

Experiments that answer a question, kept because the *answer* is worth having —
including when the answer is no.

## `wavetables.html` — what a producer's sound becomes inside Bed

**Question:** could a named producer or musician ship their sound as a Bed pack?
BOOK proposed wavetables as the mechanism — a spectrum is a few hundred bytes,
so a curator's signature sound could ship as JSON and still migrate key with the
room.

**Built:** eight harmonic spectra (cello, clean electric, glass, harmonium reed,
voices, Rhodes, soft brass, plus Bed's current sound as reference) played
through Bed's real Bed-lane chain — dark lowpass tracking pitch, the slow filter
breath, stereo spread, the 7.5 s room. Switching crossfades so they can be A/B'd
in place. Plus a **celestial choir** built as architecture rather than data.

**Answer: mostly no, and the reason is structural.**

They don't sound different enough, for three compounding reasons:

1. **The lowpass eats the difference.** The Bed lane filters at
   `min(f × 5.5, 1450 Hz)`. On an F session the root voice sits at 87 Hz →
   a 480 Hz cutoff → **about five harmonics survive.** The tables differ mainly
   above the 5th.
2. **Timbre lives in the attack, and a drone has none.** Sustained tones with no
   onset are the hardest possible case for distinguishing instruments.
3. **It is deliberate.** Law 5 (never bright by default) and the carving rule
   (*app content in the bowl range stays sustained and static*) exist so the
   bowls own the motion. **The engine is designed to make instruments
   indistinguishable.** That is the drone doing its job, not a defect.

**The redirect this produced — the useful output:**

> The drone is the wrong lane for a producer's sound. Character reads in
> **Voice** (struck, has an attack) and **Air** (texture — rain, crickets and
> waves are unmistakable from each other). A curator pack should be **a session
> plus its motif and air character**, not a drone timbre.

Which is where BOOK had it: packs as *sections*. Wavetables stay useful for
giving the drone a family — glass vs reed vs brass is audible — just not for
carrying a name.

**A second finding, from the choir:** a choir **cannot** be a wavetable. Vowels
are fixed frequencies; wavetable harmonics travel with the note, so a choir
shipped as a spectrum would chipmunk as the key migrates. It's built here as
architecture — singers a few cents apart through fixed formant filters, plus
breath. **So packs split in two: sounds that ship as data, and sounds that need
code.** Worth knowing before commissioning anyone.

*Nothing here is sampled. Every voice is arithmetic.*
