# The share moment

How forty people get onto the sheet in the ninety seconds before a session
starts. Everything else in this product is designed for the dark; this is
designed for the doorway.

Adam, 2026-07-31, after the first working two-device session:

> *"It's a little clunky the way you have to share the link, because you can't
> click it and share it. There's no QR code, so you have to literally copy and
> paste some link — and then how are you even going to get that to people?
> That part is so, so, so important. It cannot be overstated how important it
> is from an experiential design perspective."*

He's right, and it's worse than clunky. Before this, the only way in was for a
leader to **read a URL out loud in a dark room** while people typed it into
their phones. Nobody does that twice. A sync feature nobody can join is not a
feature.

---

## What shipped — v1.16

Four things, in the order they matter:

1. **A QR code**, drawn by the app itself, in the share dialog. Point a camera,
   you're on the sheet. No typing, no dictation, no spelling `netlify` out loud.
2. **Tap it and it fills the screen.** This is the version that works in a
   room: set the phone or the iPad down by the door, walk away, and people scan
   it on their way in. Screen stays awake — a lamp that sleeps is not a lamp,
   and neither is a code.
3. **Copy link** — one tap, into any group chat that already exists.
4. **Send it to myself** — the native share sheet, so the link lands in Notes,
   Messages, or AirDrop with one thumb. This is Adam's *"get the link and the
   code into a note to themselves automatically"*, done by the OS instead of by
   us.

The code itself (`VXZF`) stays underneath, big and in Didot, because the QR is
the fast path and the code is the one that still works when someone's camera
won't focus.

---

## Why the QR is written by hand

Two hundred and fifty lines of Galois-field arithmetic instead of a script tag.
That looks like the wrong trade until you remember what this app is: **one
file, no build, works with the wifi off.** A CDN dependency in the join path
means the one screen that exists to get people connected is the one screen that
needs a connection to draw. Absurd. So it's inlined, and the whole encoder is
in `app/index.html` next to `showShare()`.

**Error correction level M, not L.** L is smaller and prettier. M survives a
phone camera at an angle, at four feet, in candlelight, held by someone who has
never scanned anything, who gets one try before they give up and sit down.

---

## ⚠️ Colour is the free variable. Shape is not.

Adam: *"Could we do the QR in the brand colours — the exact moonlight and
purple? Something a little less terrible than a normal QR."*

Yes — and the answer turned out to have a hard edge, so it's worth writing
down rather than rediscovering.

**What shipped:** violet-black `#14102a` modules on moonlight `#e8e4f0`. Both
straight out of the palette. Contrast 14.9:1. It reads as Bed and it scans like
a bank code. Amber is nowhere near it — amber still means *sounding*.

**What was built, measured against a decoder, and thrown away:**

| Tried | Result |
|---|---|
| Rounded modules, radius .1–.5 | 360/360 reads at radius 0. **Every** radius above 0 lost reads — .25 lost 64 of 360. Rounding is what makes a designed QR look designed, and it is exactly what costs you the person standing in the doorway. |
| Modules in `--violet` `#8b7ab8` | 3.0:1 contrast. Failed 5 of 8. The prettiest option and it does not work. |
| Inverted — moonlight code on the app's near-black | Decodes in the lab, and it would be *beautiful* in that room. But inverted codes are a coin flip across scanners, and forty people each get one try. Ruled out on risk, not on looks. |
| A Bed mark in the centre | Level M would probably survive it. "Probably" is the wrong word for the join path. The mark sits outside the code instead. |

> **The rule: you may tune the colour. Never the geometry.**

That is law 6's shape, in a different room — *tune the vertical, never the
horizontal.* Same instinct, same reason: the thing that looks like a harmless
aesthetic choice is the thing that quietly breaks the mechanism, and it breaks
it in front of people.

**None of this was decided by taste.** The rounding and colour numbers above
are measurements, not opinions — decoder runs, not judgement calls. If someone
wants to make the code prettier later, that's the bar: re-run it.

The encoder itself is checked on every deploy against an independent
implementation, and the app reads every code back before it shows it. That
whole apparatus, and the bug that caused it, is in
[`things-only-machines-read.md`](things-only-machines-read.md) — read it before
touching the encoder.

---

## ⚠️ The one bright surface in the product

The room constraint says a bright screen at a sound bath is disrespectful, and
this is a full moonlight rectangle. It earns the exception on three counts and
it should never be extended past them:

- It is the **setup**, not the session. Lights are still on. Nobody is lying
  down yet.
- It is **two deliberate taps deep**. Nothing gets bright by default.
- **Correct polarity is not decorative.** A dark QR is a QR that doesn't scan,
  and a code nobody can scan sends the leader back to reading a URL aloud.

If it ever needs to be dimmer, dim the ground toward `#d8d3e4` — contrast is
still ~12:1. Do not invert it.

---

## Adam's dissemination notes — all four shipped in v1.17

Filed from his message the same night, then built.

### Save the code to the camera roll ✅
> *"Can you actually save the QR to your camera roll as facilitator, or do you
> have to keep it on screen?"*

**Save the code** renders the card to a canvas and hands it to the OS —
`navigator.share({files})`, which on iOS offers *Save Image*; a plain download
on desktop. Now it can go in the event's group chat, on a story, or printed and
taped by the door, and it survives the app being closed and the phone locking.

**⚠️ The date on the image is not decoration.** A saved image outlives its
session — a screenshot found six weeks later is a dead code that looks like a
broken product. The card carries *31 Jul 2026* under the URL, and the filename
is `bed-VXZF-2026-07-31.png`. Anything that ever renders this card carries the
date or it doesn't ship.

### Screenshot it ✅
Worked for free the whole time. Now there's a real button, which is better,
because a screenshot has the browser chrome in it.

### Send the link out beforehand ✅ — this was the biggest one
> *"You could even send out the link to people beforehand, so as soon as they
> arrive they just click it."*

Adam called it a sentence in the event description rather than a feature. It
was both — the feature underneath was that **the code didn't exist until the
leader pressed BEGIN.**

Now the room code belongs to the **session**, not to the broadcast: minted the
first time it's asked for and kept, through reloads, through re-runs, until
someone deliberately taps **New code**. *Share the sheet* moved to the Design
screen, before BEGIN, so tomorrow's link can be posted today.

And it fixes the cold-relay wait for the whole room for free — people who
tapped the link in the car park are already connected before anyone lies down.

### Set the iPad down / pass the phone ✅
The full-screen mode, shipped in v1.16, with the wake lock held. Still the only
one of these that scales past about eight people.

### ⚠️ Always test before it starts ✅
> *"You should always do a brief test, probably before it starts, to make sure
> everything syncs."*

**A product requirement wearing advice's clothes.** If the leader has to
remember, one night one of them won't, and it fails in front of a room. So the
test is now a thing they're already looking at, from both ends:

- **The leader**, in the share dialog they're holding up anyway: *"2 devices
  connected — scan one more to be sure, then begin."*
- **The follower**, which is the half that was missing: *"You're in"*, with the
  session's name, and *the sheet appears when the session begins*.

Connected-but-not-begun is now its own state rather than a blank sheet — which
is also exactly what an early joiner sees, so one piece of design answers both
the pre-flight and the link sent out yesterday.

> **A check nobody has to remember is the only kind that survives contact with
> a real night.**

---

## The rule

> ## Getting in is part of the instrument.
> ### If a stranger can't join without being told how, it isn't built yet.

Everything in Bed is designed for the moment the room is dark. This is the one
part designed for the moment it isn't — and it's the part that decides whether
any of the rest ever gets used.
