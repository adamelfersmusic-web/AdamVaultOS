# Bed — open questions audit

Captured mid-immersion, right after extracting the brand from the app.
Each entry: the context that raises it → the question → my lean.

**Updated after the BOOK comparison pass** (`book-comparison.md`): M1 and M3
were already answered in the pre-app strategy doc and are retired; A4 is
reversed. **Two blockers remain — M2 and M4** — and M4 now also carries
*where Bed gets published at all*, since `sound-bath-app/` is deliberately
outside the repo's published surface.

---

## App

**A1 · The poem is homework.**
The wizard's last screen says "Each section will carry a phrase — one sentence,
broken across the arc. Write it while shaping." The phrases are the soul of the
product — they become the follower sheet, the closing poem, the session's whole
meaning — and the wizard hands them off as a TODO.
→ Should the wizard's final step ask for the sentence itself and break it
across the arc, making that the moment the session becomes theirs?
**Lean: yes.** This may literally be the "fifteen minutes" the story promises.

**A2 · Amber drift — awaiting ratification.**
The wizard progress dots and keyboard focus outlines are amber, and neither is
sound. Flagged in the brand book as proposed-not-applied: both go violet.
→ Ratify?
**Lean: yes, it's a two-line change.** Same process as the Thursday line.

**A3 · The film promises phones syncing. The app is one device.**
The cue bus is architected for subscribers ("follower views, lights and
projection"), but today the follower view lives on the leader's own screen.
Screen 2 of the film shows three phones changing section together.
→ Is networked follower view committed for v-next, or does the film shoot what
exists (one device propped up, passed around)?
**Lean: don't film a lie.** Either build the sync or reframe shot 4.

**A4 · "432, 528, anything." — REVISED: keep 528.**
Originally I leaned toward dropping it. BOOK reverses me: the reference pitch is
a Hz *field* precisely so 432, 528 and the whole Solfeggio set "fall out of one
control" without the app endorsing any of them. BOOK is blunter than I was —
the chakra-note mapping is a 20th-century Western construction, the competing
systems disagree "which is the tell," and 440 is a 1939 committee decision so
"432 isn't wrong, it's differently arbitrary." The rule it lands on is the
canon's: **treat it as vocabulary, not mechanism — the app labels, it never
explains.** A number in a field is not a claim.

**A5 · The band row is binary; the floor never leaves.**
During a Space section the sub sinks to 0.35 but keeps sounding — so the row
shows SUB filled while the room reads "silence." That's honest (the floor never
leaves is a design principle) but it's the one place filled/hollow loses
information.
→ Does the leader ever need "sounding low" as a third state — say, a half-fill?
**Lean: keep binary.** The brief said filled/hollow; three states is a meter in
disguise. But it deserves a conscious decision.

**A6 · Everything lives in this browser.**
localStorage is the entire library. One cleared cache, one "free up space"
prompt, one borrowed laptop returned — and Saturday's session is gone. Export
exists but is manual.
→ Auto-download a backup on Begin? A quiet "exported 3 days ago" nudge in the
library? Or is that anxiety the brand refuses to introduce?
**Lean: silent safety.** Auto-export the session file when a session begins —
zero UI, the file is just *there* in Downloads if the worst happens.

**A7 · The roster never appears in performance.**
Ensemble collects who's here and what they play; the perform screen never shows
it. Today a leader retypes "Maya — chimes, roaming" into a section's leader
note by hand.
→ Should sections reference roster members, or is the note field the point
(freeform beats structure at 1am)?
**Lean: leave it freeform for v1.** But watch real usage.

**A8 · The warn-dot diagnoses and won't prescribe.**
"Fewer than two usable bowls" warns, full stop. The fix (different mode, or
chakra) is one tap away but unsuggested — consistent with the app never making
musical decisions for the room.
→ Is a gentle "mixolydian would free bowl 7" hint helpful, or the first step
down a slope the five laws exist to prevent?
**Lean: hold the line.** Diagnose, don't prescribe. But I want to hear a
practitioner hit this warning live before I'm sure.

**A9 · Next section is announced; next *sound* isn't.**
The pnext line says what section is coming. It doesn't say "rain enters in
2:00" — lane-level arrivals cross seams on purpose, so the section line
undersells what's about to change. The band row shows *now*; nothing shows
*next* at the band level.
→ Does the leader want arrangement look-ahead (e.g., the next band dot pulsing
before its entry)?
**Lean: maybe — one pulse, 60s before a band enters or exits.** It's the
band-row equivalent of "next — Chimes." Prototype it, feel it live.

**A10 · Landscape and the leader's station.**
Perform is a portrait column. On an iPad lying flat next to the bowls — a
likely prop — landscape may be the natural orientation. Verified portrait only.
→ Worth a landscape pass before anyone performs off an iPad?
**Lean: test it once in the real prop position; fix only what breaks.**

---

## Marketing

**M1 · ✅ RETIRED — the name was already decided, and my lean was wrong.**
See `book-comparison.md` §2. BOOK settled this on the opposite logic: Bed sells
hand-to-hand inside a community, so memorability and meaning beat search volume
— the reverse of Pedal's constraint. Alternatives were rejected with reasons
(Bath collides with bathtubs; bathsound.io inverts a compound; Atmos is Dolby's).
And the meaning I'd missed: **Bed means the musical bed, the thing people are
lying on, and the sense of being held, all at once.**
→ Still open, much smaller: a URL to print. Not a blocker.

**M2 · ⛔ Documentary or staged?**
The film's insider shot only lands with real hands, and the brand's honesty
leans toward documenting an actual Thursday-to-Saturday. But cameras in a real
session violate the very sanctity the film celebrates — sixty people came to
lie in candlelight, not to be b-roll.
→ Stage it with real practitioners and an invited room that knows, or document
a real night with consent built into the invitation?
**Blocking: production planning.** My lean: the invited room — real
practitioners, real session, everyone came knowing. Staged honesty.

**M3 · ✅ RETIRED — answered in BOOK, and my lean converged with it.**
See `book-comparison.md` §2. BOOK: **"Price like gear."** A rig, not an app —
the sub is what makes the price legible. **Packs, not subscriptions** (four
sessions a year makes a pack closer to buying another bowl). **Don't raise.**
Hardware sequencing: recommend → affiliate → rent → bundle; never manufacture.
The strongest move, which I didn't have: **rent the sub** — needed 4–5×/year,
$100 against an event grossing thousands, and whoever rents twice is a real
customer. Resolves the tension I flagged: "files you own" and gear pricing are
the same posture, not a contradiction.

**M4 · ⛔ What does the landing page want — and where does Bed live?**
"Open Bed" currently opens the free app, no gate. Is the conversion event
direct use, a waitlist, or booking a first session with a founding
practitioner? **Now bigger than a CTA:** `sound-bath-app/` sits outside
`public/` and is intentionally unpublished, so this question also decides
whether Bed moves into `public/` or lifts into its own repo.
**Blocking: the CTA and the deploy.** My lean: keep "Open Bed" ungated, add one
quiet secondary action for the founding circle (M5), and lift Bed into its own
repo rather than mixing it into the other product's published surface.

**M5 · The endorsement path. — MERGED with BOOK's growth loop.**
My founding-circle idea (ten practitioners, free forever, their real sessions
become seed fixtures with credit) still stands, but BOOK has the stronger
mechanic: **one leader licence, N follower devices** — "nine practitioners
experience the app from the inside every session, and some fraction will want
to lead their own." Plus **local legends**: the biggest practitioner in each
regional scene writes a pack and becomes an affiliate — "that's how it starts,
not with a marquee signing." **The product's multiplayer shape IS the
distribution.** Also BOOK's validation test: ten warm sales validate your
relationships, not a market — **the real signal is buyer eleven.**

**M6 · May we say "sold-out"?**
The code itself says the seed sessions were "transcribed from handouts used at
sold-out events." That's the strongest honest proof available and it's sitting
in a comment.
→ Will you put it on the page — "built from the handouts of sold-out sessions"
— and are the events nameable?
**Lean: use the line, name nothing.** Specificity of *artifact* (handouts)
beats specificity of *venue*.

**M7 · How wide is the tent?**
"One violin player becomes a symphony" — the line itself reaches past bowls.
Is v1 marketing strictly sound-bath practitioners (the brief's buyer), with
the violin as poetry? Or is the ambient-ensemble musician a second audience
now?
**Lean: one buyer for v1.** The violin line works *because* it's aspirational
inside a narrow tent. Widen after the film.

**M8 · Lead image hierarchy, post-film.**
The kit's lead screenshot is the live perform screen. Once the film exists,
shot 7 (eighty seconds of the room) yields stills where the hero is
unmistakably the person.
→ Confirmed order going forward: the room first, the screen second, the
timeline third — everywhere?
**Lean: yes.** The screenshot was always a stand-in for the room we couldn't
photograph yet.

**M9 · The vertical cut.**
Two minutes, three screen cuts, tungsten — the film is shootable small. But
this market watches vertically.
→ Does the shot list need vertical-safe framing noted per shot, and is there a
30-second cut (shots 1, 4, 7, 8, 9) planned from day one?
**Lean: yes — decide before the shoot, not in the edit.** Shot 8 must survive
the crop; it's the whole insider payload.

**M10 · The repost boundary.**
Practitioners will say frequency-healing things next to Bed — in testimonials,
tags, and stories. "Labels only, no health claims" governs what *we* say.
→ Does Bed's own account repost claims Bed can't make? Where exactly is the
line?
**Lean: never repost a claim, always repost a room.** Share their candlelight,
their full floors, their poems — mute the pseudoscience without policing it.

---

*Captured 2026-07-31, same session as the kit. When one of these gets decided,
move the decision into the brand book or the app — don't let this file become
a second source of truth.*
