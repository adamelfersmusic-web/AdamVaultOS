# The numbering system, and the tuner

2026-07-31. Adam, thinking out loud about what the number on a follower's phone
actually means:

> *"The whole system relies on bowls being numbered — and that does happen, some
> people number them, some think in actual notes. But if someone has bowls that
> aren't really in that key… eventually philosophically we'll want to figure out
> our numbering system. And honestly it makes me wonder if Bed should have a
> built-in tuner. Most people aren't musicians — they'll tell me their tuning is
> 432 and it's not at all, it's 440."*

Two things, and they turn out to be **the same thing**.

---

## ⚠️ First: what this is actually about

Everything Bed says to a room is computed from two numbers it never checks:

> **what bowls you have, and at what pitch.**

The bracket algorithm, the free/sparing/restricted sheet, the key migration,
every follower's phone — all of it derives from the kit. **Get the kit wrong and
every single thing Bed says is confidently wrong, and nothing complains.** No
error, no warning. The room just plays bowls that fight the key, and the leader
assumes the app knows something they don't.

That's the same shape as the QR bug ([`things-only-machines-read.md`](things-only-machines-read.md)) with
one difference: **the unreliable reader here is a person.** The rule generalises
cleanly:

> ### The calibration is an input nobody checks. Measure it — don't ask.

Both halves of this note come out of that sentence.

---

# Part 1 — What does "3" mean?

## There are three possible answers, and they are not the same

| | "3" means | Works for |
|---|---|---|
| **A · Absolute pitch** | 3 = E. Always. Everywhere. 1 = C. | shared vocabulary in a room |
| **B · Scale degree** (movable do) | 3 = the third of whatever key we're in now | nothing here — see below |
| **C · Position in your own set** | your third bowl, low to high | any set, any tuning, no musical knowledge |

**The app does C today.** The wizard says so in one line nobody reads:
*"Bowl numbers are physical — bowl 4 is the fourth bowl in the arc."*

## ✅ What's already right and must not move

**B is already dead, structurally, and that's correct.** Numbers are fixed for
the whole session — the key migrates underneath them and nothing renumbers.
Adam got here independently: *"once the sound bath starts it's fucking fixed."*

The reason is the same one behind law 6: **a number is a thing you look at while
your hands are busy.** If the labels moved when the key moved, the sheet would
become something you have to re-read instead of something you glance at. A
person lying on the floor of a dark room does not re-learn their bowls at
minute 34.

> **The number points at an object. Objects don't get renamed mid-session.**

## ⚠️ The collision, stated precisely

Here is the same section — SACRAL, D major — as three real kits see it, run out
of the actual app:

| Their kit | Their labels | What SACRAL tells them |
|---|---|---|
| C major 7 *(the Ohio default)* | 1=C 2=D 3=E 4=F 5=G 6=A 7=B | **2 6** (3 5 7) [1, 4] |
| D major set | 1=D 2=E 3=F♯ 4=G 5=A 6=B 7=C♯ | **1 3 5** (2 4 6 7) |
| D minor handpan | 1=D 2=E 3=F 4=G 5=A 6=B 7=C | **1 5** (2 4 6) |

**Every one of those sheets is correct.** All three people end up playing D and
A. That's the product working — *Bed computes, per player, what that person can
play right now.*

And all three are holding a different number for the same pitch. So:

> ### Numbers work perfectly as a private instruction and fail completely as shared vocabulary.

That is the whole problem, and it is not a bug in the sheet. It's that the same
symbol is doing two jobs. Adam's version:

> *"Now they're playing with you instead of Sara, and their 1 is really their 2,
> and that's confusing for them."*

It only bites when **two different kits are in one room** — which is exactly the
ensemble, which is exactly the business model. Nine practitioners per session is
the flywheel in [`business-model.md`](business-model.md).

## The recommendation — and why it's cheap right now

**Move to A (absolute, 1 = C) when the first non-C kit shows up in a real
ensemble. Not before.**

The thing that makes this a comfortable call:

> **For a C major set, A and C produce identical numbers.** 1=C, 2=D, 3=E…

So for essentially every user today the change is invisible, and the three
shipped notation tests (`verifyNotation()` — ROOT · C mixolydian, SACRAL · D
major, HEART · F major) stay byte-identical, because they're all computed on
the C kit.

**But it gets expensive the moment non-C kits are in the wild**, because by then
people have written numbers on their bowls, and A renumbers them. Stickers are
harder to migrate than code.

| | Cost of switching now | Cost of switching later |
|---|---|---|
| Code | one line in `buildKit` | the same one line |
| Users | ~nobody — C sets are unaffected | every non-C owner re-labels physical objects |

**What decides it:** the first ensemble with a non-C kit in it. Watch whether
people actually say numbers out loud to each other, or whether each person just
reads their own phone and never compares. **If nobody compares, C is fine
forever and this note was insurance.** If they compare — and Adam's instinct is
that they will, because that's how musicians talk — A is required.

⚠️ **The honest counter-argument, which is Adam's own:** *"I guess it's by
region — here everyone's on C, but if you go somewhere everyone's on D…"* A
global C anchor is parochial, and it hands a D-set owner a set of bowls with no
"1" in it. That is a real cost and it's the reason not to do this pre-emptively.

## Accidentals, when they come

Under A, a bowl outside the key needs a name. Two candidates:

- **♯4 / ♭7** — standard, and it's already printed on the bowl by whoever made
  it, so it's not new vocabulary
- **4+ / 4−** — Adam's suggestion; friendlier to non-musicians, but invents a
  notation nobody will see anywhere else

**Recommend ♯/♭.** The person has to read their own bowl's label at some point
regardless, and matching it costs nothing.

The interesting case Adam found, worth keeping because it's the argument *for*
absolute numbering: a session modulating to F♯ minor tells the one person in the
room who owns an F♯ bowl to play **♯4**, and tells nobody else anything. Then the
progression moves to D major and the 2 and 6 come back in. **You can only write
that down at all if the numbers are absolute.**

## The overlap fact worth writing down

Adam: *"most hang drums are D minor, most bowls are C — just avoid the flat or
the B, they're all the same pitches based around a different low note."*

That's exactly right, and worth being precise about because it's the most common
real mixed-instrument case:

- **D natural minor and C major are the same seven pitches.** A D-minor handpan
  and a C-major bowl set are the same notes. No conflict at all, ever.
- **F major is C major with B → B♭.** So C bowls work in F major *if you avoid
  the B bowl.*

And the algorithm already knows: the shipped test `HEART · F major` produces
**`4 6 1 8 (2 3 5) [7]`** — bowl 7 is B, and it's bracketed. That's not a
coincidence; it's the bracket rule doing its job. **Bed already handles the
handpan case correctly and nobody has ever said so out loud.**

## ⚠️ Market claims to check before they become assumptions in code

Adam's field observation, Ohio, 2026 — *"everyone I know has C major bowls, and
handpans are D minor or F major."* Almost certainly right for his region and it
is the right default to build on. **It is not researched, and this note is not
evidence.** Before the numbering decision is made permanent, look at what
manufacturers actually ship most. A default chosen from a sample of one town is
still a good default; it just shouldn't be mistaken for a fact.

---

# Part 2 — The tuner

Adam:

> *"What people do if they need to change the pitch, they put a bit of water in
> the bowl and use a tuning app. Most people aren't musicians — they'll tell me
> their tuning is 432 or a certain key and it's not at all, it's 440. You should
> be able to save your profile."*

## This is not a nice-to-have. It's the calibration problem.

Bed already has `refHz` in the Ensemble screen — 440 / 432 / type anything. So
the app **asks**. And the answer it gets is, by Adam's direct experience,
frequently wrong.

> **An app that asks an unreliable narrator for the one input everything depends
> on has a silent failure at its foundation.**

Wrong `refHz` → every generated tone is off against the bowls, and the beating
gets blamed on the bowls, the room, or the speaker. Wrong kit → the sheet
recommends bowls that fight the key, with total confidence, and the leader
trusts it over their own ears because *the app said so.* That last part is the
dangerous bit: **Bed's authority makes a calibration error worse, not better.**

So the tuner's job is not "tell me the note." It is:

> ### Stop the leader from telling Bed something false.

Its output isn't a reading — it's a **saved kit profile**: measured pitch per
bowl, cents off, and the reference the whole set implies. That profile is the
thing every sheet is computed from, and right now it's a guess.

## ⚠️ Why a naive tuner would be WORSE than no tuner

This is the part that must not be skipped, and it is the same lesson as the QR
one level down.

**Singing bowls are inharmonic.** Their partials are not integer multiples of
the fundamental, the fundamental is often *quieter* than the second partial, and
a struck bowl has two close modes that beat against each other and wander as it
decays. A standard autocorrelation / YIN pitch detector — the thing you'd reach
for in an afternoon — will lock onto a partial and **confidently report the
wrong note**, usually a fifth or an octave high.

> **A tuner that lies with authority manufactures the exact error it was built
> to fix — and now the error has a number next to it.**

So, before any of this ships:

- **Show the candidates, don't commit silently.** *"I heard C, 261.9 Hz — is
  that your bowl 1?"* The human confirms. Measurement proposes; the person
  disposes.
- **Show the confidence.** A weak or ambiguous read says so instead of picking.
- **Test against real recordings of real bowls**, not synthesised sines — a sine
  will pass a broken bowl-tuner every time.
- **Hold it against an outside opinion** — the same gate as everything else
  ([`how-this-gets-decided.md`](how-this-gets-decided.md) § 6b). A known-pitch
  reference recording set, checked in, and the detector must agree.

**If it can't be made trustworthy, ship no tuner** and keep asking. An honest
question beats a confident lie.

## What the profile should hold

- measured pitch per bowl, and cents off equal temperament
- the reference pitch the set actually implies (not the one someone typed)
- when it was measured — **bowls drift**, water changes them, and Adam's whole
  point is that people forget
- ⚠️ **and it belongs to the person, not the session.** Same lesson as the room
  code in v1.17a: a kit profile baked into an exported session file would tell
  the next leader that their bowls are someone else's.

## The education piece

Adam: *"we can also provide some education materials — your tuning should
generally go with the people you're playing with. And I'm available for support,
I understand tuning systems."*

Both true, and the second one is a real asset for the first ten events — but
**a founder answering tuning questions by text is not a feature, it's a
measurement.** What he learns answering them is the spec for the tuner and for
the one page of explanation that replaces him. Worth writing down what people
actually ask.

---

## What ships when

| | |
|---|---|
| **Now** | Nothing. The app is already fixed-within-a-session, which is the part that matters, and C sets are unaffected by the open question. |
| **Soon, cheap** | Say what a number means somewhere a user will actually see it. Today it's one line in the wizard and nowhere else — a follower's phone shows `2 6 (3 5 7)` with a legend explaining the *brackets* and never the *numbers*. |
| **When the first mixed-kit ensemble happens** | Decide absolute vs positional, with people in a room, watching whether they say numbers to each other. |
| **Before any hardware or ensemble scale** | The tuner — built to the standard above, or not at all. |

---

## The rule

> ## Everything Bed says is computed from what it was told about the bowls.
> ### So the one thing it must never simply believe is what it was told about the bowls.

Numbering and tuning look like two features. They're one question: **is the
calibration true, and does everyone in the room mean the same thing by it?**
