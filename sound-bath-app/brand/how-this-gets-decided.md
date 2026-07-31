# How this gets decided

Not what was decided — that's in the other files. **This is the method**, pulled
out of one long session on 2026-07-31 in which a dozen calls got made and most
of them held up.

Every pattern below is followed by the actual thing that happened, because a
principle with no scar on it is just a preference.

---

## 1 · Before choosing between two options, check whether they want the same slot

Most either/or fights are two right answers to two different questions, and the
work is finding the second question.

> **Guide vs hold.** Argued for hours as a single choice. They were never
> competing: **guide** is the *tagline*, because a tagline names the person's
> half; **hold** is the *feature*, the *control*, and the *product's own verb*.
> Both kept, each with a home.

The tell: when you like both and can't say why, you're holding two answers, not
one problem.

---

## 2 · A decision is safe when the objection is *answered*, not *overruled*

Overruling an objection means betting it won't matter. Answering it means it
stopped applying.

> **"Holding space is what every practitioner's bio already says."** That was a
> real objection and preference couldn't beat it. It **dissolved** once *hold*
> was established as the brand's central verb — the tag isn't trying to
> differentiate, it's the shortest possible instance of the verb, and it's
> trying to be *recognised*. Different job, objection gone.

If you find yourself saying "yes, but I still think —", stop. You haven't
finished.

---

## 3 · A collision that keeps coming back is usually the mechanism

Three times the two-holdings problem returned: *if Bed holds the structure and
you hold the room, who's holding?* Twice it got engineered around.

> The answer was to **put it in the sentence**: *the instrument that holds you,
> so you can hold the room.* The collision wasn't a bug in the language, it was
> the product described accurately. Bed holds you, you hold the room, the room
> holds the people.

Same shape, same night: **the amber "exception."** A held section wears amber,
which looked like a violation of *amber means live and making sound* — until you
notice a held section **is** making sound. The rule wasn't bent; it was the
first time the rule said what to *do* rather than what not to.

> **When something keeps refusing to be smoothed over, describe it instead.**

---

## 4 · Ship a rule, not a verdict

A verdict drifts the moment someone tired and unfamiliar reads it. A rule
survives contact.

| Verdict (drifts) | Rule (holds) |
|---|---|
| "Guide is retired." | *When the sentence contains Bed, the person **guides** — the software is already the one holding.* |
| "Don't build a DAW." | *You may tune the vertical. Never the horizontal.* |
| "Amber is special." | *Amber means live and making sound. Nothing else may ever wear it.* |
| "Use instrument, not app." | *Instrument in anything a practitioner reads; app only where it means the literal software artefact.* |

The test: **could a stranger apply it on a deadline without asking you?**

---

## 5 · Name the request that will kill it, in writing, before it's made

The dangerous request is never the obviously bad one. It's the reasonable one.

> Law 6 forbids a transport. The thing that would actually erode it isn't
> someone asking for a playhead — nobody would. It's **"but I want to hear how
> it arrives,"** which is a completely sane thing to want. So *"no fades in a
> held section"* is written into the engine header **with that sentence quoted**
> and marked *refuse it by name.*

Write down the reasonable-sounding request. That's the one that gets through.

---

## 6 · If the failure mode is invisible, it goes in the code

A design note gets inherited and read as a suggestion. A comment beside the
thing it governs gets read by whoever is about to break it.

> Law 6 lives in the engine header next to *no pulse ever*, not in a brand doc,
> **because nothing would sound wrong if it were violated.** Bed would simply
> become a DAW, quietly, over three reasonable tickets.
>
> Same reason `setChords()` carries a ⚠️ pointing at ear-test E1: the levels
> look tunable from the numbers, and they aren't.

Loud failures can live in documentation. Silent ones can't.

---

## ⚠️ 6b · THE MACHINE-READ GATE — a standing check, not a principle

Rule 6 says put invisible failures in the code. This is the case where **the
code can't see it either**, and it gets a gate rather than a paragraph.

### When it applies

Ask one question about anything being built:

> ### If this were wrong, what would complain?

If the honest answer is *"nothing, until it's in front of people"* — because
the only thing that reads it is **a machine we don't own** — this gate is on.
It is not a judgement call and it is not proportional to how important the
thing feels. It's on or it's off.

### The two questions it forces

Both. Neither substitutes for the other, and the one that gets skipped is
always the second, because it feels redundant right up until it's the only
thing between you and a room where nothing works.

| | Question | What it catches | What it cannot |
|---|---|---|---|
| **1 · Read it back** | *Does my own output decode, right now, into exactly what went in?* | this instance, this device, this input — forever, including cases nobody thought to test | **a shared misunderstanding.** It reads from the same wrong assumption and agrees with itself |
| **2 · An outside opinion** | *Does something I didn't build agree with what I produced?* | being confidently wrong about the format itself | whether it works today, on this phone, for this input |

> ## A misunderstanding cannot audit itself.

Not a slogan — a measurement. The QR read-back check, run against the real bug
that nearly shipped, **refused 72 of 144 cases and passed the other 72.** The
outside reference caught 144 of 144.

### The three sub-rules, all learned by getting them wrong

- **The check must be able to fail.** A verifier that never says no is
  decoration. Prove it refuses: corrupt the output — exhaustively, if you can —
  and require a refusal every time. My first version hand-picked seven spots
  and three of them sailed through.
- **The gate goes on the deploy path, not in a habit.** `qr-check` is the first
  line of the Netlify build; a broken encoder cannot reach the CDN. A check
  that depends on remembering will, one night, not be run. And **verify the
  gate actually blocks** — a multi-line build command reports the exit status
  of its *last* line, so a failed check followed by a successful copy publishes
  the broken build with a green tick.
- **⚠️ Never regenerate the expected values to make a failing check pass.** This
  is the one that will actually happen, one tired evening. It converts the
  outside opinion into a mirror, and a mirror agrees with everything. If the
  reference disagrees, **we are wrong until proven otherwise** — and if it turns
  out we're right, that belongs in a commit message, not in a quiet re-run.

### The surfaces this is already on, or will be

The QR was the first, not the last. Every one of these has the same shape — we
write it, someone else's machine reads it, and when we're wrong nothing
complains:

| Surface | Read by | Gate |
|---|---|---|
| **QR join code** | a stranger's camera, in the dark, one try | ✅ shipped — `tools/qr-check.cjs`, in the build |
| **Sync wire format** | another copy of Bed, on someone else's phone | ⬜ owed. A follower silently on the wrong schema shows a wrong sheet, not an error |
| **Exported sessions** | a version of the app that doesn't exist yet | ⬜ owed. Round-trip every shipped session through export → import → compare |
| **Lumen / WLED packets** | an ESP32 across the room | ⬜ owed before any light ships |
| **MIDI to the Neotone** | firmware we didn't write | ⬜ owed |
| **A printed code on a card** | a camera, and no way to fix it after printing | ⬜ owed — the one with no undo at all |

**Nothing on that list ships without both questions answered.** Add a row when
a new surface appears; never remove one.

### The sentence, for the top of a ticket

> **Anything whose only reader is a machine you don't own must be read back
> before it's shown — and held against an opinion formed outside your own head.**

---

## 7 · A rule is only worth having once it has cost something

> The amber rule survived tonight because it had already been expensive: **the
> mark gave up its amber ring, and the landing page CTA is deliberately not
> amber.** Having paid those, a free exception on a slider thumb was
> incoherent — so the thumb changed too.

**An unenforced rule isn't a rule, it's a preference with good branding.** If a
principle has never made you delete something you liked, it hasn't been tested.

---

## 8 · When you're defending the implementation instead of the principle, you're wrong

Two reversals tonight, both mine, both the same shape.

> **"Hold is the spine of the system, so use it in the tagline."** Backwards.
> Being the spine makes it *unavailable*, because the software already owns it.
>
> **"Press-and-hold, so audition can't be left running — and not being able to
> drag a level while listening is the feature."** That was defending my
> *mechanism*, not law 6. Changing a level while you hear it is the most basic
> act of musical judgment. The law needed a sharper edge (vertical vs
> horizontal), not a clumsier gesture.

**The tell:** you're arguing that a limitation is good *because* it makes
enforcement easy. Enforcement convenience is never a reason.

---

## 9 · Keep the losers, with the reasoning

Not politeness. A line that fails one job supplies the word that wins another.

> *Hold the room* lost the tagline — and became the name of the feature, the
> label on the control, and the reason the whole vocabulary is coherent.

Every rejected candidate stays in `taglines.md` with why it lost. Twice already,
the next good idea came out of one.

---

## 10 · Some questions can only be answered by a body in a room

Write those down separately, with what a pass and a fail sound like, and then
**stop reasoning about them.**

> `ear-tests.md` E1: the fourth against the fifth beats at ~11 Hz in the bass.
> It might be the smartest thing in the engine — law 3 forbids automated
> dynamics, so acoustic beating is the only movement Bed is *permitted* to have
> — or it might be mud. **No amount of analysis settles it.** Filed with the
> levels to reach for in each outcome, and left alone.

Confusing "I have a good argument" with "I know" is how careful products get
quietly wrong.

---

## The one underneath all of them

> **Say plainly when you were wrong, correct it, and keep going.**

Tonight that happened about six times — two reversals of mine, a landing-page
overclaim, a self-contradiction in the mark comparison, a false-negative test
result, and a business-model argument that was a growth argument wearing brand
clothes. Every one of them made the next decision better, and none of them cost
anything except a sentence.

The work gets good when being wrong is cheap.
