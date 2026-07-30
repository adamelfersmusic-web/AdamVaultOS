# Build handoff — Bed

Paste the fenced block below into a fresh session. It's deliberately short: it
points at the documents rather than restating them, so the facts stay in one
place and the design decisions stay open.

**The principle behind how it's written:**

> Give it every fact it cannot derive. Give it no decision it can make.

Domain knowledge maximal, visual and interaction prescription minimal. The
failure mode to avoid is over-specifying the *solution* — that removes the
ability to make coherent design decisions, which is exactly where a strong model
beats us. The other failure mode is under-specifying the *world*, which produces
plausible, confident, wrong domain logic that nobody catches until a
practitioner does.

---

## The prompt

```
I'm building Bed — a tool for sound bath practitioners, the people who play
crystal singing bowls and lead group sessions for rooms of 40–100 people lying
on the floor. The premise: someone who loves sound but can't compose becomes
someone who can lead a room.

Repo: sound-bath-app/

Read these, in order:
  1. VISION.md            — the why, the whole picture, the market
  2. BUILD-BRIEF-V1.md    — exactly what to build, and what not to
  3. prototype/bed.html   — a working, measured four-band audio engine
  4. prototype/sheets.html — the printed handout generator, and its notation
  5. prototype/fixtures/  — two real sessions, transcribed from real handouts

This is an EXPLORATORY build, not a shipping release. I want to see and feel
the whole shape of the app. I fully expect to rebuild from scratch afterwards,
so build wide — cover the whole surface rather than perfecting one screen.
Build it as a self-contained web app: no backend, no accounts, localStorage.

Scope is §1 of the build brief. Perform mode is the priority, design mode
second. Skip everything in the "explicitly out" table.

Three things are non-negotiable, because they came from real practitioners and
real rooms rather than from reasoning:

- The domain facts in §2. The chakra/bowl/key table, the bowl sheet notation,
  and the bracket algorithm. That algorithm is verified against three sheets
  used at real sold-out events — if your output differs from the table in §2.3,
  you're wrong, not the table. Never ask the user for a key; ask for a chakra
  and derive it.

- The five laws in §3. No pulse, no third in the drone, no automated dynamics,
  no competing melody, never bright by default. They're structural, and they
  answer most design questions on their own.

- The physical constraints in §5. This runs in a candlelit room, read at four
  feet, by someone holding a mallet in each hand. Warm colours vanish in that
  light. A bright white screen is disrespectful and everyone in the room knows
  it.

For the audio: take the architecture from prototype/bed.html — the four bands,
the frequency carving, the common-tone key migration, the measured fixes
documented in its comments. Throw away its interface entirely; it's a listening
test, not a design.

Everything visual and interactive is YOURS. Layout, typography, exact palette,
motion, component structure, how the GO control feels, how the lanes and blocks
are manipulated, how the bowl sheet renders. §8 is direction, not specification
— take a real position and commit to it. Make it beautiful enough that a
practitioner would want it visible in their space.

The bar, from §9: fifteen minutes from opening the app to a runnable
fifty-minute structure. If a feature doesn't serve that, cut it.
```

---

## Notes for whoever runs this

**Don't paste the documents inline.** Let them be read from the repo. Inlining
costs context and invites paraphrase drift on exactly the facts that must stay
exact.

**Don't add visual direction beyond §8, and don't show it your own sketch.**
That's the point of a blind run: where you and it independently land on the same
answer, the design is *determined by the constraints* and you can stop
deliberating it forever. Where you diverge, you've found a real decision worth
arguing about. Showing your sketch first destroys exactly that signal — you'd
get your own idea back with better typography, which teaches you nothing.

**Four things to compare afterwards**, decided in advance so the comparison is
diagnostic rather than vibes:
1. What's on the first screen
2. Where the cue control lives and how it feels
3. How the bowl sheet renders
4. How the session arc is represented

**Do add anything new you learn from practitioners.** Facts belong in
`BUILD-BRIEF-V1.md` §2, not in the prompt. The prompt should stay this short
permanently.
