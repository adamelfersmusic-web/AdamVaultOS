# Things only machines read

Adam, 2026-07-31, on being told the first QR encoder produced perfect-looking,
completely unreadable codes:

> *"This would ruin our whole product. How do we prevent this from never, ever
> happening — not once in a hundred thousand times?"*

He's right about the stakes and the question is the right question, so this is
the answer, the reasoning, and the thing that shipped.

---

## What actually happened

The encoder produced symbols with **correct finder patterns, correct timing
patterns, and byte-identical data** to a reference implementation. Twelve
modules out of 841 were wrong — all of them format bits, the two copies
transposed.

No scanner on earth could read it. And:

> **It looked completely normal.**

That is the whole problem in one line. It didn't throw, didn't warn, didn't
render oddly. A person looking at it — including a person who knows what a QR
code is — sees a QR code. You find out when forty strangers point phones at it,
in a dark room, ninety seconds before you were going to begin.

---

## ⚠️ Why the obvious fix isn't enough

The obvious fix is: **have the app check its own work.** Read the finished
symbol back the way a scanner would, and refuse to show anything that doesn't
decode to the string that went in.

That is real, it shipped, and it is genuinely good. It catches a bad string, a
URL that crosses a version boundary nobody tested, a mask branch never taken
before, a block interleave that only breaks at four blocks, an encoder edited
in a hurry two years from now. It runs on the actual device, for the actual
link, forever, and no test suite can say that.

**And it would have shipped the original bug.**

Because a read-back check written by the same person, from the same
understanding, reads the format bits back *from the same wrong coordinates* —
and agrees with itself, confidently, every time.

> ## A misunderstanding cannot audit itself.

This is not a hypothetical. The bug was put back in and measured: the app's own
read-back check **refused 72 of 144 cases and passed the other 72.** It would
have caught this exact bug a coin-flip of the time.

---

## What actually gets you to never

Three layers, each catching what the others structurally cannot. The point is
not "more testing" — it's that the layers are *different in kind*.

### 1 · Self-check — the app reads its own output back

Ships in `app/index.html` as `qrVerify()`. Recovers the format word, checks its
BCH, requires both copies to agree, unmasks, re-walks the zig-zag,
de-interleaves, runs the Reed–Solomon syndromes, compares the decoded payload
to the input. Failure means `qrEncode` returns **null** and the dialog shows
the link instead, out loud.

**Answers: "is this particular code, right now, on this device, correct?"**
Something a test that ran last March cannot answer.

### 2 · An outside opinion, frozen — `tools/qr-golden.json`

144 matrices from an implementation with no relationship to ours, pinning all 6
symbol versions × all 8 masks. With the bug reinstated: **0 of 144 matched.**

**Answers: "is our understanding of the format correct at all?"** The only
layer that can, because it's the only one not written from our understanding.

### 3 · The gate on the deploy path — `netlify.toml`

`node tools/qr-check.cjs` is the first line of the build. Broken encoder → the
build fails → **nothing reaches the CDN.** 0.6 seconds, zero dependencies.

**Answers: "will this be run?"** Which is the question that decides whether the
other two layers exist in practice or only in principle.

### 4 · One phone, before the first session

None of the above proves a real camera reads a real screen. Scan it once, on
the device you'll actually use. This never stops being the last word, and it
never becomes optional.

---

## ⚠️ Three things that look like safety and aren't

Worth naming, because each one is a plausible-sounding version of this that
would have failed.

**"We check it, so we're covered."** The check must be able to *fail*. A
verifier that never says no is decoration. So the gate corrupts the finished
symbol one module at a time — all 2,210 of them across two versions — and
requires a refusal every single time. That claim is exact and it is checked on
every build.

**"The goldens disagree, so let's regenerate them."** This is the one that will
actually happen, one tired evening, and it is indistinguishable from deleting
the check. Regenerating the expected values from our own output turns the
outside opinion into a mirror, and a mirror agrees with everything. It's
written at the top of the generator in the largest warning in the repository.

**"The check runs in the build, so it's enforced."** It wasn't. A multi-line
Netlify build command reports the exit status of its *last* line — a failed
check followed by a successful file copy publishes the broken build **with a
green tick.** `set -e` is load-bearing and is now commented as such. Found by
testing the gate rather than trusting it, which is the same lesson one level up.

---

## The generalisation — this class will come back

The QR is the first thing in Bed whose only reader is a machine we don't own.
It will not be the last:

| Coming | Read by |
|---|---|
| The sync wire format | another copy of Bed, on someone else's phone |
| Exported session files | a version of the app that doesn't exist yet |
| Lumen / WLED packets | an ESP32 across the room |
| MIDI to a Neotone handpan | firmware we didn't write |
| A printed code on a card by the door | a camera, in the dark, one try |

All the same shape: **we write it, someone else's machine reads it, and when
we're wrong nothing complains.** No exception, no stack trace, no red screen —
just a room where the thing quietly doesn't work, and a practitioner standing
in front of it.

> ## The rule
>
> ### Anything whose only reader is a machine you don't own must be read back before it's shown — and held against an opinion formed outside your own head.

Both halves. The read-back proves it works *this time*; the outside opinion
proves you understood the format *at all*. Neither substitutes for the other,
and the one you'd skip is the second, because it's the one that feels redundant
right up until it's the only thing standing between you and a room full of
phones that don't work.

---

## The smaller rule that falls out

> **When something can fail invisibly, the fallback must be loud.**

`qrEncode` returning null doesn't leave a gap where a code should be — the
dialog says *"No code for this link"* in red and puts the link right there.
A missing code and a broken code are the same failure to the person holding the
phone; only one of them is honest about it.

Same instinct as v1.15's cold start, filed then as: *the failure wasn't the
delay, it was the silence.*
