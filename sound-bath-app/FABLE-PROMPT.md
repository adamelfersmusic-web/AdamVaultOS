# Handoff prompt

Paste the block below into a fresh chat. Keep it short on purpose — it points
at the documents instead of restating them, so the facts stay in one place and
the design decisions stay open.

**The principle behind how this is written:**

> Give it every fact it cannot derive. Give it no decision it can make.

Domain knowledge maximal, visual and interaction prescription minimal. The
failure mode to avoid is over-specifying the *solution* — that removes the
ability to make coherent design decisions, which is exactly where a strong
model beats us. The other failure mode is under-specifying the *world*, which
produces plausible, confident, wrong domain logic that nobody catches until a
practitioner does.

---

## The prompt

```
I'm building a tool for sound bath practitioners — people who play crystal
singing bowls and lead group sessions. The premise: someone who loves sound but
can't compose becomes someone who can lead a room.

Repo: sound-bath-app/

Read these three, in order:
  1. VISION.md            — the why, the whole picture, the market
  2. BUILD-BRIEF-V1.md    — exactly what to build, and what not to
  3. prototype/bed.html   — a working four-band audio engine, verified

Build the v1 scope defined in §1 of the build brief. Nothing outside it — a
shallow version of everything is worth less than a real version of this.

Three things are non-negotiable because they came from real practitioners and
real rooms, not from reasoning:

- The domain facts in §2. The chakra/bowl/key table, the bracket notation, and
  the bracket algorithm. That algorithm is verified against three sheets used
  at real sold-out events; if your output differs from the table, you're wrong,
  not the table.

- The four laws in §3. No pulse, no third in the drone, no automated dynamics,
  no competing melody. They're structural, and they answer most design
  questions on their own.

- The physical constraints in §5. This runs in a candlelit room, read at four
  feet, by someone holding a mallet in each hand. Warm colors vanish in that
  light. A bright white screen is disrespectful and everyone in the room knows
  it.

For the audio: take the architecture from prototype/bed.html — the four bands,
the frequency carving, the common-tone key migration. Throw away its interface
entirely; it's a listening test, not a design.

Everything visual and interactive is YOURS. Layout, typography, exact palette,
motion, component structure, how the cue control feels, how the bands are
visualized, how the follower sheet is rendered. §8 is direction, not
specification — take a real position and commit to it. Make it beautiful enough
that a practitioner would want it visible in their space.

The bar, from §9: fifteen minutes from opening the app to a runnable
fifty-minute structure. If a feature doesn't serve that, cut it.
```

---

## Notes for whoever runs this

**Don't paste the documents inline.** Let them be read from the repo. Inlining
them costs context and invites paraphrase drift on exactly the facts that must
stay exact.

**Don't add visual direction beyond §8.** The temptation will be to describe
the screen you're picturing. Resist it — a described screen gets built, and a
built-from-scratch one is usually better. §8 already sets the register (dark,
restrained, wellness-not-spa, no music-software signifiers) and rules out the
specific wrong answers.

**Do add anything new you learn from practitioners.** Facts belong in
`BUILD-BRIEF-V1.md` §2, not in the prompt. The prompt should stay this short
permanently.

**If the sound needs work first**, fix `prototype/bed.html` before the handoff
rather than after. Everything downstream inherits that engine, and it's much
cheaper to change now than once an app is wrapped around it.
