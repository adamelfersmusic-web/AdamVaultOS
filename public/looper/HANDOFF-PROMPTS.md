# Pedal — handoff prompts

Copy one of these into a fresh session, verbatim. One tier per session.

Each is written to stand alone: a session that has never seen this project
should be able to act on it without asking anything first.

---

## TIER 2 — use this one now

```
I'm building a browser practice tool for improvising musicians called Pedal.
It's live and working: public/looper/index.html in this repo, one self-contained
HTML file, all sound synthesized with Web Audio, no samples anywhere.

Read these three, in order:
  1. public/looper/ROADMAP-TIERS.md — the plan. Build TIER 2 only.
  2. public/looper/SPEC.md — what exists and why
  3. public/looper/index.html — the app

Do not edit public/looper/v1/. It's a frozen reference kept for A/B listening.

Two things govern every decision. The tone is the product — this has to sound
good enough that someone leaves it running for an hour. And speed of setup is
the product — every change is measured against whether it gets someone playing
sooner or later.

TIER 2 ADDS NO VISIBLE CONTROL AT ALL. Not one. Every item either changes how
something already on screen sounds, or how it behaves when you touch it. If a
change seems to need a new control, it belongs in a later tier — leave it.

The percussion instruction is the one that gets read backwards, so read it
twice: DO NOT MAKE THE DRUMS PUNCHIER. They're weak, but they're unobtrusive,
and unobtrusive is the correct target — the whole point is a kit that sits in a
loop for an hour without fatiguing. Add life, not weight. Velocity variation,
ghost notes, micro-timing. Never impact.

Test what you can headlessly with Playwright and report real measurements —
dBFS, spectra, timing — not descriptions of what you imagine it sounds like. If
something is inconclusive, say it's inconclusive. I'll listen on speakers.

When it's done and it sounds right, freeze it as your last act:
  cp public/looper/index.html public/looper/v2/index.html
Then commit and push.
```

---

## TIER 3 — the app plays

```
I'm continuing work on Pedal, a browser practice tool for improvising
musicians: public/looper/index.html in this repo, one self-contained HTML file,
Web Audio, no samples.

Read these three, in order:
  1. public/looper/ROADMAP-TIERS.md — the plan. Build TIER 3 only.
  2. public/looper/SPEC.md — what exists and why
  3. public/looper/index.html — the app

First, check that public/looper/v2/ exists. If it doesn't, the previous session
forgot to freeze — create it from the current index.html before changing
anything. Never edit public/looper/v1/ or v2/; they're frozen references kept
for A/B listening.

The tone is the product. This tier adds two instruments to an app whose whole
claim is that it sounds good, so a Rhodes that sounds like a cheap FM preset
costs more than it adds.

Four things this tier gets wrong if you're not careful:
- The Rhodes has to be genuinely playable — velocity response, a tine attack
  that hardens when you dig in, a body that blooms rather than just decays. Not
  a sparse background voice.
- Do not build an amp sim for the guitar. No nonlinear modelling, no cab IRs. A
  channel strip into the same reverb the pads already use.
- Voice is explicitly optional. If it doesn't work cleanly, cut it and say so.
- Cycle mode is the only item in the entire roadmap that costs real UI, so it
  has to be the tightest thing in the app. Nothing on screen when it's off.

Test what you can headlessly with Playwright and report real measurements, not
impressions. I'll play through it and listen on speakers.

When it's done and it sounds right, freeze it as your last act:
  cp public/looper/index.html public/looper/v3/index.html
Then commit and push.
```

---

## TIER 4 — the app keeps

```
I'm continuing work on Pedal, a browser practice tool for improvising
musicians: public/looper/index.html in this repo, one self-contained HTML file,
Web Audio, no samples.

Read these three, in order:
  1. public/looper/ROADMAP-TIERS.md — the plan. Build TIER 4 only.
  2. public/looper/SPEC.md — what exists and why
  3. public/looper/index.html — the app

First, check that public/looper/v3/ exists. If it doesn't, create it from the
current index.html before changing anything. Never edit the frozen v1/, v2/ or
v3/ directories.

This tier is two features and both have a sharp edge:

Recording captures everything the app is making, to a file, while I play. One
button. Multiple takes, one optional line of text each. It is not a notes app,
and it is NOT an overdub looper — do not build overdub looping under any
framing, including "just a simple version."

URL state means the URL is the save file. No account, no backend, no storage
service. Someone opens a link and lands on exactly that setup.

Speed of setup is the product, so neither of these gets a settings panel.

When it's done, freeze it as your last act:
  cp public/looper/index.html public/looper/v4/index.html
Then commit and push.
```

---

## If you only want URL state

It depends on nothing in tier 3 and it's the only feature that makes the app
findable. Pulling it forward on its own is legitimate:

```
In this repo, public/looper/index.html is a working browser practice tool
called Pedal. Read public/looper/ROADMAP-TIERS.md and build section 4.2
(shareable URL state) and nothing else. Do not edit the frozen v1/, v2/ or v3/
directories. The URL is the save file — no account, no backend, no settings
panel. Commit and push; no freeze needed for a single feature.
```
