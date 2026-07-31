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

**None of this was decided by taste.** The encoder was checked byte-for-byte
against an independent reference encoder across 32 join URLs, then the app's
own rendered screen was screenshotted at phone resolution and decoded back
out. The rounding and colour numbers above are measurements, not opinions. If
someone wants to make the code prettier later, that's the bar: re-run it.

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

## Adam's considerations — filed, not built

From the same message. All good, none of them shipped in v1.16; this is the
list to work from next.

### Save the code to the camera roll
> *"Can you actually save the QR to your camera roll as facilitator, or do you
> have to keep it on screen?"*

**Worth building, and it's small.** A saved image is a code that survives the
app being closed, the phone locking, the battery dying, and the leader wanting
their screen back for something else. It also makes the code postable — into
the event's group chat, onto a story, printed on a card by the door. Render the
SVG to a canvas, `toBlob`, and either `navigator.share({files})` (iOS gives
*Save Image*) or a plain `download` attribute.

**The catch worth knowing before it's built:** a saved image is a code that
outlives its session. Room codes are per-session, so a screenshot from last
month is a dead code and looks like a broken product. Whatever ships should put
the date on the image.

### Screenshot it
Already works, for free, today. Worth saying out loud in the note above the
button rather than building anything.

### Send the link out beforehand
> *"You could even send out the link to people beforehand, so as soon as they
> arrive they just click it."*

**This is the strongest one on the list and it isn't a feature — it's a
sentence in the event description.** It also fixes the cold-relay wait for
free: people who tapped the link in the parking lot are already connected. The
thing that would make it real is a **code that survives being made in advance**
— today the code is minted when the session opens. Filed as the actual
requirement behind this: *a leader should be able to get tomorrow's link
today.*

### Set the iPad down / pass the phone
Both are the full-screen mode, which shipped. The iPad-on-a-stand version is
the one to design for: it's the only one that scales past about eight people,
and it needs the screen to stay awake — which it now does.

### ⚠️ Always test before it starts
> *"You should always do a brief test, probably before it starts, to make sure
> everything syncs."*

**This is a product requirement disguised as advice.** If the leader has to
remember to test, some night one of them won't, and the failure lands in front
of a room. The share dialog already says *"Waiting for the first device"* and
then counts them — that's the test, and it's passive. What's missing is the
other end: **the follower should be able to tell that they're connected before
anything is happening.** Filed alongside the waiting state added in v1.15.

---

## The rule

> ## Getting in is part of the instrument.
> ### If a stranger can't join without being told how, it isn't built yet.

Everything in Bed is designed for the moment the room is dark. This is the one
part designed for the moment it isn't — and it's the part that decides whether
any of the rest ever gets used.
