# Instrument, not app — the pass

Adam, 2026-07-31: *"I think we should use the word 'instrument' more than 'app'.
It will crossover but I like thinking of it that way."*

Adopted. This note is the pass itself — every occurrence, judged one at a time —
because **a find-and-replace would break the ones that are correct.**

---

## Why this is commercial and not cosmetic

`business-model.md`: **always present Bed next to a bowl, never next to
software** — *"nobody pays four figures for software they open on a phone; they
do pay it for a system."* And the casting rule filed the same night: the
practitioner is the hero, **the bowl is the trusty companion**, Bed is the thing
that gets them over.

Every stray *"the app"* quietly reprices the product and demotes the bowl. It's
one word and it's doing real damage at scale.

---

## The rule

> **Instrument** — in anything a practitioner reads.
> **App** — only where it means the literal software artefact and nothing else
> would be true: "add to home screen," a browser instruction, a file path.

### The exception that matters, and it's not a loophole

**Keep "app" where the sentence is specifically about the machine's *role* in a
room that contains humans.**

> *"With people in the room the **app** plays only what humans physically
> can't."*
> *"Someone roaming with chimes — the **app's** motif yields."*

These are the strongest sentences in the product **because** they use the small
word. They're drawing a line between the person and the machine, and *"the
instrument's motif yields"* blurs exactly the distinction the sentence exists to
make — the bowls in that room are instruments too. **The machine's word belongs
where the point is that it's the machine.**

That is the whole reason this can't be a find-and-replace.

---

## The pass — 20 occurrences, judged

### ✏️ Change — 4

| Where | Now | Becomes |
|---|---|---|
| `app/index.html:13` | `BED — the app that holds the space.` | `BED — the instrument that holds you, so you can hold the room.` *(source comment; also the one place the old descriptor still survives)* |
| `app/index.html:3507` | *"Just you for now. The app fills the harmony in."* | *"Just you for now. Bed fills the harmony in."* |
| `site/index.html:284` | *"this page is lit for the same rooms the app is"* | *"…the same rooms Bed is"* |
| `taglines.md` social post | *"before the app existed"* | *"before any of this was built"* |

Note the pattern in three of four: **the fix is usually the product's name, not
the word "instrument."** *Bed fills the harmony in* is better than either
alternative — it's warmer, shorter, and it makes the thing a character rather
than a category.

### ✅ Keep — the role sentences · 5

`app/index.html` 605, 606, 615 · `site/index.html` 220, 258 — all of the
*"the app's motif yields"* / *"plays only what humans physically can't"* family.
Correct as written, per the exception above. **Do not touch these.**

### ✅ Keep — engineering comments · 8

`app/index.html` 1146, 1489, 2036, 2544, 3757 · `site/index.html` 12, 77 —
addressed to whoever is reading the code, where "app" is the precise word for
the artefact. Nobody buying anything reads these.

### ✅ Keep — file paths · 3

`site/index.html` 169, 183, 276 — `href="../app/index.html"`. It's a directory.

---

## Where to *add* it, which matters more than where to remove it

Removing "app" only stops a leak. The positioning is won by saying **instrument**
where there is currently no word at all:

- **The landing page has no sentence calling Bed an instrument.** The descriptor
  now does it in the meta description, where only a search engine sees it.
- **The Ensemble screen** introduces the whole live-players model and never names
  what Bed is.
- **Anywhere the price eventually appears** — that's the sentence the anchoring
  rule was written for, and it doesn't exist yet.

---

## Status

**Documented, not executed.** Four edits, each small, none urgent, and all of
them safe to do in one sitting when someone is fresh. Filed rather than done
because the four sit next to sixteen that must not move, and that's exactly the
situation where a tired pass does damage.


---

## The same problem, a different word: **drone**

2026-07-31. Adam: *"'drone' is a weird word here — people who aren't musicians
might get a military vibe."*

**He's right about half the product, and the half matters.**

### Keep it in the app

*Drone* is completely native to this world — tanpura drones, vocal drones,
harmonium. A practitioner reads it correctly and instantly, and it's the precise
word for what the Bed lane does. It's also load-bearing in the laws
(*"no third in the drone"*), the lane labels, and the block names. **Do not
touch any of it.**

### Avoid it on first contact

A stranger skimming a marketing page has no context, and the first thing the
word means outside music is an aircraft. **That's a risk with no upside on a
page whose job is to be warm in four seconds.**

Changed on the landing page:

> ~~Whatever a small kit can't reach, the floor and **the drone** are already
> holding.~~
> Whatever a small kit can't reach, **the floor of sound underneath** is already
> holding.

That phrase is already established two paragraphs above it, so it reads as a
callback rather than a definition.

### The three that stay, and why

| Line | Why it keeps the word |
|---|---|
| The device frame's band row — `Drone` | It's a **screenshot of the app**. Changing it would be a lie about the product. |
| *"only what humans physically can't: the floor, the drone, the air"* | Lifted verbatim from the app's own Ensemble screen. It's a quotation, and by then the reader has seen the frame. |
| *"No third in the drone"* | **A law.** Stated in the app's language on purpose. |

### The rule

> **Name the lanes where the reader has already seen them. Describe what they do
> where they haven't.**

Same shape as *instrument, not app*: the word isn't wrong, it's **early**.
