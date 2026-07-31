# BOOK vs. canon — the comparison pass

Read after the brand kit was finished, deliberately, so the canon had
something settled to be measured against. Everything here is a **proposal**,
not an applied change.

Sources read: `BOOK.html` (full text + all 13 embedded images), `BRAND-BRIEF.md`.
BOOK covers two products — **Bed** and **Pedal** (a shipped drone-first practice
looper at `public/looper/`). Only Bed is in scope here.

---

## The headline

The brief said: *"Where two independent attempts land on the same answer, that
answer is probably determined by the constraints and can stop being debated."*

That test just ran, and it passed hard. The brand extracted from the app in
ignorance of BOOK landed on BOOK's stated aesthetic direction almost
word-for-word:

| BOOK's direction (written before the app) | What the extraction found |
|---|---|
| "Near-black with a violet cast" | `#0a0910` — violet-cast near-black |
| "warm amber reserved exclusively for *this is live*" | THE AMBER RULE, verbatim |
| "Section coding runs cool — indigo, violet, teal, soft rose" | nine cool function hues |
| "Thin high-contrast serif for identity only. A clear sans for everything operational" | serif = the person, sans = the machine |
| "sizes that feel slightly too large on a desk — because they'll be right at four feet" | the performance-size table |
| "Never: chakra rainbow" · "Never: AI dark mode + acid accent" | both independently rejected |

**These can stop being debated.** They are determined by the room, not by taste.

Same for the words: the promise, the line, the Thursday story, the never-say
list and the film's nine shots are identical, because they came down the same
lineage. **"Say yes on Thursday" is in BOOK too** — as prose ("The promise
isn't 'better sound baths.' It's you can say yes on Thursday"). Ratifying it as
the closer promoted a buried sentence to the line it always was.

---

## 1 · Corrections — the canon or the kit is wrong

**1.1 — `sound-bath-app/` is deliberately unpublished, and my Pages advice broke that.** ⚠️

BOOK, appendix: *"`sound-bath-app/` sits outside `public/`, so it is
intentionally not published. The two products are already cleanly separated —
that folder lifts into its own repository with no untangling."*

Verified: the repo deploys via `.github/workflows/deploy.yml` (Vite build →
`dist` → Pages), and `public/` is the published surface. My advice to enable
"Pages → deploy from a branch → root" would have **published Bed by accident
and broken a deliberate separation.**

→ **Correction:** don't touch Pages. To publish Bed, either move
`sound-bath-app/` into `public/` as a conscious act, or lift it into its own
repo — which is the plan BOOK already anticipated. Blocked behind **M4**
anyway. `brand/README.md` and the vault's `bed/04-repo-and-links` need this fix.

**1.2 — The brand kit is missing a deliverable: the printed artefact.**

The brief asked for six things. I delivered five. **#5 — the printed handout —
was never made,** and it already exists as a prototype (`prototype/sheets.html`,
pictured in BOOK).

It matters more than a checkbox, because it exposes a hole in the canon:

> The kit says **"never white."** The handout is **black on cream, by
> necessity** — it's paper, handed to ten people in a dark room.

→ **Proposed amendment to the amber/never-white rule:** the "never white" law
governs **emitted light**, not reflected. A screen in that room is a light
source and must never be bright. Paper is lit by the same candles as the faces
in the room — a printed sheet is *part of* the room's light, not a hole punched
in it. So: **screens never white; print always is.**

The printed sheet is also the one artefact where the brand's core idea is
provably right rather than asserted — **tiers carried by size, not by
vocabulary**, readable at fifteen feet by someone who reads no music *and
possibly no English*. The app's bowl line and the paper handout are the same
design idea in two media, which is exactly what a brand system is supposed to
produce.

**1.3 — BOOK's status line is stale.** It says *"Bed: engine built & verified,
app unbuilt."* The app is built and running. BOOK is a snapshot, not a live doc.

---

## 2 · Blockers that were already answered — retire them

Two of my four "blockers" were decided in BOOK before I asked. One of my leans
was **wrong**.

**M1 — the unsearchable name. RETIRED. My lean was wrong.**

I flagged "Bed" as an SEO problem needing a handle. BOOK settled it on the
opposite logic:

> *"The constraint here is the opposite of Pedal's. Pedal's main risk is
> discovery, so it needs a searchable name. This sells hand-to-hand inside a
> community, so memorability and meaning matter far more than search volume —
> which makes a generic English word much cheaper here."*

Bed is a **deliberate** choice, not an oversight. Alternatives were considered
and rejected with reasons: *Bath* collides with bathtubs; *bathsound.io*
inverts a compound everyone knows the other way round (they'll type
soundbath.io); *Atmos* is unusable (Dolby owns it in audio).

And the meaning I was missing entirely, which belongs in the brand book:

> **"Bed" means three things at once: the musical bed, the thing people are
> lying on, and the sense of being held.**

→ Still open, much smaller: a URL. But the *name* is settled and the audit
should stop calling it a blocker.

**M3 — price posture. RETIRED. My lean converged, but BOOK is far ahead.**

I proposed "price it like an instrument, not a SaaS." BOOK says **"Price like
gear"** — same answer, independently reached, so it stops being a debate. But
BOOK carries a developed strategy I didn't have:

- **A rig, not an app.** Nobody pays four figures for phone software; they pay
  it for a *system*. **The sub is what makes the price legible.**
- **Rent the sub.** A practitioner needs a sub four or five times a year — the
  textbook rental good. It fixes "half your users can't hear the
  differentiator," puts the app in a room with an audience every time, and $100
  against an event grossing thousands isn't a decision. No manufacturing, no
  freight. Also the cleanest market research: **whoever rents twice is a real
  customer.**
- **Hardware sequencing:** recommend → affiliate → rent → bundle. **Never
  manufacture a speaker.**
- **Packs, not subscriptions.** Four sessions a year makes a pack closer to
  buying another bowl than to a subscription. *"Real revenue, wrong model as
  churn."*
- **Don't raise.** *"A few thousand practitioners at a few hundred dollars is a
  genuinely good business and a genuinely terrible venture business. That's why
  the gap is empty — nobody funded is coming for it."*

→ This directly resolves the tension I flagged: "files you own, no account" and
gear pricing are the *same* posture, not a contradiction. **M3 is answered.**

---

## 3 · Adopt into the canon — genuinely better than what I wrote

**3.1 — "Fade times are ergonomic, not aesthetic."**
> *"The crossfade is the window in which a human sets down one bowl and picks up
> another. Thirty seconds is indulgent as a musical choice and exactly right as
> a physical one."*

This is the missing *why* under my motion rule "never faster than the sound."
The real reason isn't taste — it's a human's hands. Adopt verbatim into the
motion section.

**3.2 — "It's a conducting tool that happens to make sound."**
The sharpest one-line positioning in either document, and it explains the
product's whole shape (why HOLD exists, why follower view exists, why the band
row matters). Adopt.

**3.3 — "The best compliment the bed can get from an improviser is that they
forgot it was there."**
The posture — *the product's job is to disappear* — stated as something a human
would actually say. Adopt into the marketing canon.

**3.4 — Fifteen minutes is a hard spec, not a figure of speech.**
> *"If a first-timer can't reach a runnable 50-minute structure in fifteen
> minutes, the positioning collapses. Test it with real people early."*

The Thursday story makes a testable product claim. This should be a task, not a
sentence.

**3.5 — The tea and tarot detail is product input, not set dressing.**
> *"The evening starts long before the sound does — arrival, settling, talking —
> and that stretch still needs to sound like something. Nobody would think to
> compose it, which is exactly why a template should handle it by default."*

Shot 2 of the film is a **feature brief in disguise.** Strengthens audit **A1**.

**3.6 — The growth loop is better than my founding circle (M5).**
BOOK: **one leader licence, N follower devices** — *"nine practitioners
experience the app from the inside every session, and some fraction will want to
lead their own."* Plus **local legends**: the biggest practitioner in each
regional scene writes a pack and becomes an affiliate — *"that's how it starts,
not with a marquee signing."* The product's own multiplayer shape is the
distribution. Merge into M5.

**3.7 — "Read the first sales correctly."**
> *"Ten warm sales in Ohio validate your relationships, not a market. The real
> signal is buyer eleven — someone who found it cold and paid anyway."*

**3.8 — Recorded provenance: the visual reference was Lumen by Kompose Audio** —
"the four-strip anatomy, near-monochrome restraint, a thin high-contrast serif
over a plain functional sans," with its light UI explicitly **inverted** because
a bright UI is disqualifying here. Worth recording as history: the pairing the
extraction found was seeded, not spontaneous.

---

## 4 · Where the canon wins — BOOK is superseded

- **The section taxonomy.** BOOK hypothesised five functions (Arrive → Ground →
  Journey → Release → Return) and called it *"the most important open item."*
  The app shipped **nine** with hexes and defaults. The canon is the resolved
  version. *(The underlying research ask — 20–30 more real session sheets —
  remains genuinely open and is nobody's shortcut.)*
- **The ember palette, the band status row, the nine-hue arc with values, the
  performance-size table.** All post-BOOK. Canon.
- **The amber rule as an enforced system.** BOOK states the principle; the canon
  carries the audit — including that it costs us the amber CTA.

---

## 5 · Audit items BOOK reinforces (no change, more confidence)

- **A3 (phones syncing).** BOOK: sync is *display state only*, broadcast the
  active pitch set, and it is **"still unbuilt."** Film shot 4 depicts a planned
  feature. My lean — build it or reframe the shot — stands, and BOOK adds a
  reason to build: **ship suggested hand signals too, and the app becomes the
  standard. That's a social moat.**
- **A5 (binary band row).** BOOK: *"Space is a programmed element in its own
  right, not a gap."* The floor sinking under Space is deliberate composition,
  so SUB reading filled is *correct*. Keep it binary.
- **A4 (528 Hz).** BOOK is blunter than I was: the chakra-note mapping is a
  20th-century Western construction, the competing systems disagree *"which is
  the tell,"* and 440 is itself a 1939 committee decision so *"432 isn't wrong,
  it's differently arbitrary."* The rule it lands on is exactly the canon's:
  **treat it as vocabulary, not mechanism — the app labels, it never explains.**
  Reference pitch stays a Hz field precisely so 432/528/Solfeggio all fall out of
  one control without endorsing any of them. **Revised lean: keep 528 in the
  example.** It's a number in a field, not a claim — and the field's whole design
  intent is to absorb these requests neutrally.

---

## Recommended actions

1. **Fix the Pages advice** in `brand/README.md` + `bed/04-repo-and-links` — do
   not publish `sound-bath-app/` from root. *(correction, do now)*
2. **Amend "never white"** to "screens never white; print always is," and add
   the printed handout as the kit's sixth deliverable. *(needs Adam)*
3. **Add to the brand book:** the name's threefold meaning; fades are
   ergonomic; the Lumen provenance.
4. **Add to the marketing canon:** "a conducting tool that happens to make
   sound"; "they forgot it was there"; the gear-pricing posture incl. renting
   the sub; buyer eleven.
5. **Retire M1 and M3 as blockers.** Two remain: **M2** (film: documentary vs
   staged) and **M4** (landing conversion) — and M4 now also carries *where Bed
   is published at all.*
6. **Revise A4** to keep 528.
7. **New task:** run the fifteen-minute test with a real first-timer. It is the
   cheapest possible validation of the entire positioning.

---

*The pre-app docs remain history, not canon — with the exceptions itemised
above, each proposed rather than applied.*
