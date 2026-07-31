# Bed — versions

Frozen snapshots you can open directly in a browser, so two versions can be
played side by side and compared **by ear**. Git already keeps every version
forever; these exist because a file you can double-click is more useful than a
command when the thing you're judging is sound.

The live app is always `../index.html`. These are history.

---

## v1.16 — a code you point a camera at · 2026-07-31

Sync worked. Joining didn't. The only way onto the sheet was for a leader to
**read a URL out loud in a dark room** while people typed it — which nobody
does twice, and which quietly made the whole multi-device product unusable by
anyone who wasn't already holding the laptop.

### A QR code, written by hand

~250 lines of Galois-field arithmetic in `index.html` instead of a script tag,
because this app is one file that works with the wifi off. **A join screen that
needs a CDN to draw itself is the wrong join screen.** Byte mode, versions 1–6,
**error correction level M rather than L** — L is smaller and prettier, M is
the one that survives a phone camera at an angle, at four feet, in candlelight,
held by someone who gets exactly one try.

### Tap it and it fills the screen

The version that actually works in a room: set the phone or the iPad down by
the door and walk away. Wake lock is held while it's up — a code that goes
black after thirty seconds is worse than no code, because the leader thinks
it's working.

### Copy link · Send it to myself

`navigator.share` where it exists, so the link lands in Notes, Messages or
AirDrop with one thumb. Clipboard falls back to the old `execCommand` path,
because Safari withholds the async clipboard over plain http and a facilitator
testing on a LAN address is a real case — failing silently at the one moment
they need the link is not acceptable.

### ⚠️ The bug worth naming: format bits

The first working encoder produced symbols that were **structurally perfect and
completely unreadable.** Finders right, timing right, data byte-identical to a
reference encoder — 12 modules wrong, all of them format info. The two copies
of the format string run in *opposite directions* and each skips a different
lane. Transposed, they look fine and no scanner on earth reads them.

Caught only because the output was decoded back with an independent library
instead of eyeballed. **A wrong QR has no failure mode you can see** — it looks
completely normal and simply never scans, and you find out in front of a room.
Anything that touches that block gets re-verified the same way.

### ⚠️ Colour is the free variable. Shape is not.

Violet-black `#14102a` on moonlight `#e8e4f0` — both from the palette, 14.9:1
contrast. Rounded modules, `--violet` modules and an inverted card were all
built and measured; **all three cost reads** (rounding at radius .25 lost 64 of
360 decodes). Reasoning and numbers in
[`../../brand/the-share-moment.md`](../../brand/the-share-moment.md).

This is law 6 in a different room: *you may tune the colour, never the
geometry.* The change that looks like harmless taste is the one that breaks the
mechanism in public.

---

## v1.15 — the cold start, found by the first real two-device test · 2026-07-31

The relay deployed, a laptop led, a phone followed — and the phone took
**30–60 seconds** to show anything, with a blank sheet the whole time. Three
separate faults stacked, and the app made a hardware-tier limitation worse than
it needed to be.

### 1 · Only the leader woke the relay

`wakeRelay()` fired on Design and BEGIN. **`followerJoin()` never called it** —
so a follower's very first contact with a sleeping free tier was a WebSocket
handshake, which is the slowest possible way to knock. It now sends the HTTP
poke too, in parallel with the socket's own attempt.

### 2 · The backoff was tuned for a dead server, not a waking one

```js
Math.min(1000 * 2**tries, 15000)   →   Math.min(700 * 2**tries, 4000)
```

**Exponential backoff is right for a server that's down. It's wrong for one
that's booting.** Render's free tier takes ~40 seconds, and a 15-second cap
means a client can sit idle for fifteen more seconds *after the relay is already
answering.* A reconnect attempt costs nothing; the old cap was buying politeness
nobody asked for with time that mattered.

### 3 · ⚠️ The worst of the three — the follower said nothing

A joined follower with no session yet rendered an **empty sheet**. No spinner,
no message, no way to tell *still connecting* from *broken* — which is exactly
the judgement someone has to make in a dark room with people arriving.

Now it says so:

> *finding the session…*
> **the relay may be waking — up to a minute the first time**

Cleared the instant a real cue renders, not when the socket opens — because the
socket opening isn't the thing you're waiting for.

**The lesson is the one this product keeps relearning:** the failure wasn't the
delay, it was the silence. Same shape as the share dialog's *"same device
only"*, and the wake lock chip. **A wait you understand is not a fault.**

---

## v1.14 — making the lamp actually good · 2026-07-31

Adam: *"I want lamp-to-your-bowls to exist and be good."* It existed at v1.13.
**Three things were wrong with it**, and working and good are not the same thing.

### 1 · It ran off the edge of the phone

At `24vmin` the root glyph alone was ~200px, and *"1 3 5 2 4 6 7"* on one line
was ~570px on a 430px screen. **The numbers were literally falling off the
screen** — the exact failure that matters most, since the whole point is reading
it at a glance.

**Now two rows**, stacked: what's yours, then what's also available. That keeps
each row to three or four glyphs, which is what allows them to be this large at
all. It's also better design — the tiers *mean* different things, and stacking
them says so without a bracket.

### 2 · It showed you numbers you must not play

v1.13 rendered the full sheet including the **restricted** group. At sheet size,
`[1 4]` reads as *rest* because the brackets are legible. **At lamp size the
brackets become enormous punctuation and the numbers register long before
them** — so a person on a floor sees a giant "4" and plays it.

**Restricted is gone from the lamp entirely.** The lamp shows only what's yours.
The full picture is one tap away on the sheet, where the brackets work.

### 3 · It fired the crossfade on first paint

The fade exists so a section change isn't a jolt at that scale. It was also
running when the lamp opened, so the numbers **faded in from nothing every
time** — which looks like a bug because it is one. It now only crossfades when
there was something there to leave.

### Also
- **`vmin`, not `vw`.** A phone face-up on a floor is as likely to be landscape,
  where `22vw` was absurd.
- **Tighter ratios than the sheet.** The root is 1.9em on the sheet against
  12–15px text and that reads as emphasis; at lamp scale the same ratio is what
  ran a four-bowl section off the edge. The root still wins, by less.

---

## v1.13 — your bowls, the size of your hand · 2026-07-31

The thing filed in `lumen.md` as *"most of the magic for a small change"*, built.

**Lamp mode now shows your own bowls, enormous, over the section's colour.**

No reading `4 6 1` and mapping it onto metal in the dark. **The number is the
size of your palm and it is already the colour of the room.** Same brackets, same
meanings, same numbers the sheet always showed — only the scale changed, so
there is nothing new to learn while lying on a floor.

### Two lamps, and the difference is who's holding it

| | |
|---|---|
| **Beside a bowl** (`?c=…&lamp=1`) | colour only — it's lighting the bowl, and a number on the floor points at nothing |
| **In a hand** (tap **lamp** on your sheet) | colour **and** your bowls |

**Not a setting.** A spare phone joining with `&lamp=1` is a pad; anything else
is a person. The distinction falls out of how you arrived.

### What it does not do

**It never says *play now*.** It shows what's *available* — large for freely,
dim for sparingly, faint for rest — and changes only when the section changes.
Law 1 is untouched: **the *when* stays yours.** That is the whole line between an
instrument and karaoke, and it's why this is legal at all
(`lumen.md` → *Per-bowl light*).

In a texture or space section it shows **nothing but colour**, because there is
nothing to play. Verified, along with the pad case.

### Why it matters more than it looks

A sound bath is one performer and sixty receivers. **If someone can look at a
glowing number and know it's theirs, being in the ensemble stops requiring
training.** The hard part of a large ensemble was never the playing — it was the
rehearsing, and there is nothing here to rehearse.

---

## v1.12 — the relay is woken forty minutes before it's needed · 2026-07-31

Two numbers that were getting confused, and one of them is a real hazard:

- **15 minutes with nobody connected** → Render's free tier stops the relay.
- **~30–60 seconds** → how long it takes to boot when someone next connects.

That wait is harmless at 6:40 and **awful at 7:15 with forty people already on
the floor.** And it's the likely shape of a real evening: set up early,
everything green, go greet people for twenty minutes, relay sleeps, session
starts, first phone sits red for a minute.

**So the app now knocks on the door as early as it possibly can.** One `GET` to
the health endpoint when a session is opened in **Design**, and again on
**BEGIN** — long before anyone taps Share. Fire and forget: no `await`, nothing
surfaced, and the socket keeps its own retry regardless. Throttled to once a
minute.

By the time it matters, the relay has been awake for half an hour.

### The relay's health check is now readable from the browser

`access-control-allow-origin: *` on `GET /`. It is public by design — it says
only *up* and a room count, never a code — and letting the app read it means a
leader can be **told** the relay is awake rather than inferring it from a socket
that hasn't failed yet.

---

## v1.11 — `&lamp=1`, a phone that is only ever a light · 2026-07-31

Adam: *"how far off is picking up an old phone in my house and having it become
lights for Bed."* **Zero code — but it was four steps, and it should be one.**

A spare phone joining as a lamp was going through the kit picker (*which bowls
do you have?* — it has none) and landing on the sheet (*which it will never
show*) before anyone could tap **lamp**. At 7pm with people arriving, that's the
difference between a thing you'd do and a thing you'd mean to do.

```
…/app/?c=VXZF&lamp=1
```

Opens straight into colour. No kit, no sheet, one motion: **tap the link, put it
face up beside a bowl.** The share dialog hands out the recipe next to the
ordinary link.

### The three practical things, learned the hard way by anyone who tries this
- **Plug it in.** A screen at full brightness for fifty minutes will finish an
  old battery.
- **Turn the phone's brightness up.** Lamp mode errs dark by design (law 5) —
  the phone's own slider is the hand that adds.
- **Auto-Lock → Never** on a dedicated lamp phone. There's no downside on a
  device that is doing nothing else and is plugged in.

---

## v1.10 — it points at the relay already, and says what the relay is doing · 2026-07-31

Adam: *"is it possible to fix it so when I wake up tomorrow I can join my phone."*
Close to it. **The app no longer needs a second edit or a second push** — deploy
the blueprint and it connects.

### RELAY_URL now points at the host the blueprint creates

`relay/render.yaml` names the service `bed-relay`, which on Render becomes
`bed-relay.onrender.com`. So:

```js
const RELAY_URL = 'wss://bed-relay.onrender.com';
```

**Deploy the blueprint and that's it** — no editing, no pushing, no waiting for
another build. And because `_ws` retries with backoff, a device left open will
join **the moment the relay comes up**, without anyone reloading anything.

*(If the service ends up named differently, change that one string.)*

### And the app says what the relay is doing

Pointing at a host that might not exist yet would have been irresponsible
without this. **A leader must never have to infer, from an empty device count,
whether the problem is the relay, the code, or the other phone.** So the share
dialog now carries one line:

| | |
|---|---|
| **relay connected** | it's up, devices can join |
| *reaching the relay…* | trying |
| **relay not answering — retrying** | (red) it isn't deployed, or it's asleep |

**Both states verified against a real server**, not reasoned about: the relay was
run locally, the app pointed at it, and then pointed at a dead port.

> Render's free tier sleeps after 15 minutes idle and takes ~30 seconds to wake.
> *"Relay not answering — retrying"* going green after half a minute is that, not
> a fault. Open the share dialog a minute before anyone arrives.

---

## v1.9 — the relay can actually be deployed · 2026-07-31

`RELAY_URL = ''` is the one line standing between Bed and everything downstream
of it — the ensemble, the workshop, Lumen pads, the first night in Ohio. So the
path to filling it in got cleared.

### The relay would have failed to deploy, and the error wouldn't have said why

`server.js` was a bare `WebSocketServer({ port })`. **Render, Railway and Fly all
detect and health-check a service by making a plain HTTP request to its port** —
and a bare ws server answers nothing on HTTP. The platform concludes the service
never started and kills it, logging *"no open ports detected"* and **nothing at
all about websockets.**

`ws` is now attached to an `http.createServer`, and `GET /` returns
`{"ok":true,"service":"bed-relay","rooms":N}` — the health check the platform is
looking for, and something a human can open in a browser. Room *count* only,
never codes.

**Verified rather than reasoned about:** the server was started, the health check
fetched, and two clients joined room `VXZF` — one sent, the other received.

### Also in the relay
- **A 30-second ping**, dropping whatever stops answering. Free tiers idle out
  and proxies drop quiet sockets after ~60s — and **a drone holds for fifty
  minutes without anyone sending a thing**, which is exactly the shape that gets
  disconnected.
- **`render.yaml`** — root dir, build, start, health check. New → Blueprint →
  this repo, nothing to type.

### `?relay=wss://…` — prove it before you commit it

A new relay can now be tested from two real devices *before* its address is
written into the app. Test with the param, then paste it into `RELAY_URL` once.

**`RELAY_URL` stays the shipped default, deliberately:** set once, in code, so
every device that loads the app has it. **A follower must never have to configure
anything.** The param is for the ten minutes before you're sure.

---

## v1.8 — a follower's phone doesn't sleep, and it says so · 2026-07-31

Adam: *"we have to take note and make this dead simple so follower apps don't
sleep."* Right — this is the failure that happens **to forty people at once**,
silently, while they're lying on the floor.

### What changed

- **Followers re-request the lock on returning.** The `visibilitychange` handler
  only re-asked when `T.live` — a leader condition. **A follower's phone spends a
  whole session face-up on a mat being ignored, and iOS drops the lock on every
  lock/unlock.** Now `F.net` counts too.
- **The status line moved into normal flow**, centred under the phrase. It was
  absolutely positioned and collided with the next-section cue. **A cue must never
  be overlapped by anything, least of all by a warning about the screen.**
- **When it fails, the line is tappable** and gives the one-time fix in plain
  words.

### The fix we can't make from here, said plainly

`Settings → Display & Brightness → Auto-Lock → Never` — and on iPhone,
**Low Power Mode blocks wake lock outright**, which matters because phones at a
sound bath are frequently low.

**So the second half of the message is the more important half:**

> *If you'd rather not: it costs you nothing. Tap the screen any time and you're
> back on the current cue immediately — this sheet always shows where the room is
> now, never where it was.*

**That is true because of an architecture decision made months ago.** The
follower is **state-synced, not event-streamed** — every message is a full
snapshot, so a sleeping phone has nothing to catch up on. A tap restores it.
Sleeping is an inconvenience, never a loss, and telling people that is worth more
than any amount of fighting the OS.

---

## v1.7 — the join path, and a silent failure made loud · 2026-07-31

Found by Adam trying to do the obvious thing: share a code on a laptop, join
from a phone. **Three problems, and each one alone was enough to stop it.**

### 1 · The join screen had no door

`#scr-join` was reachable **only** via `?join=` or `?c=` in the URL. So the share
dialog's own instruction — *"open this and enter the code"* — led to the library,
where there was nothing to enter a code into.

**Library now has "Join a session"** next to "New session."

### 2 · The link didn't carry the code

The dialog printed the bare app URL and asked you to type four characters into a
screen you couldn't reach. It now prints `…/?c=VXZF` — **one tap, no typing, in
a dark room.**

### 3 · ⚠️ The silent one, and the reason for this release

`RELAY_URL` is `''`, so `Net.join()` falls back to **BroadcastChannel — same
device, across tabs, and nothing else.** A leader on a laptop sharing to a phone
would sit in front of *"Waiting for the first device"* **forever**, with nothing
anywhere saying why.

That is the worst kind of failure this product can have: it happens in the dark,
minutes before a session, to someone who has just told a room it will work.

The share dialog now says so, in red, before it can waste anyone's evening:

> **Same device only.** No relay is configured, so this code works across tabs on
> *this* machine and nowhere else — another phone will never appear below.

**None of this is a fix for the relay.** It's a fix for not being told. Deploying
`relay/` and setting `RELAY_URL` is still `DEPLOY.md` step 2, ten minutes, and it
remains the one thing standing between the app and everything downstream of it.

---

## v1.6 — lamp mode, and a wake lock that tells you the truth · 2026-07-31

### A screen is a light

Tap **lamp** on the follower sheet and the phone becomes a light: full-bleed
section colour, no text, wake lock held. Face up beside a bowl, **any phone in a
drawer is now a Lumen pad** — no hardware, no pairing, no cost, and it works
offline exactly as well as everything else, because followers already run on
their own data.

It changes when the section changes, on the 0.8s crossfade `#followerView` has
always had. **Nothing pulses, nothing reacts to audio, nothing moves on its
own** — the light inherits laws 1 and 3 like everything else.

**It errs dark on purpose** (law 5). The field is the section colour *darkened*,
brightest at the centre — a glow, not a slab. The phone's own brightness slider
is the hand that adds, which is exactly law 3's rule about who is allowed to
change a level.

A tap anywhere returns to the sheet — never out of the view, because the phone
is on the floor beside a bowl and a stray touch must not cost anyone their cues.

### The wake lock now says whether it worked

`requestWake()` was fire-and-forget: `catch (e) {}` and hope. But wake lock is
best-effort and **some phones ignore it**, which is why `DEPLOY.md` has always
said *"say keep your screens on once, out loud."*

Now it reports:

| | |
|---|---|
| held | *screen stays on* |
| refused or unsupported | ***screen may sleep — set it manually*** (in red) |
| not asked yet | hidden |

It also re-checks on release, because iOS drops the lock when the app
backgrounds. **A leader shouldn't have to guess about the one thing that would
quietly ruin a follower's night.**

### Changed since v1.5
| | |
|---|---|
| `toggleLamp()` | new |
| `renderFollower()` | paints the lamp field from `fnColor(sec.function)` |
| `requestWake()` | tracks `wakeOk`, re-checks on release, renders a chip |
| `#followerView.lamp` | hides everything, kills padding |

---

## v1.5 — held sections · 2026-07-31

**You can now hear a section while you edit it, and you still cannot play your
session back.** Those two facts have to stay true together, so law 6 grew a
sharper edge:

> ### You may tune the vertical. Never the horizontal.

**Vertical is balance** — four lanes at once, is the motif too loud under that
drone. That's a chord, and holding a chord while you pull a stop is what an
instrument *is*. **Horizontal is arc** — how it arrives, what section two feels
like after section one. That's the fifty minutes, and it stays unheard until GO.
Everything dangerous lives in the horizontal; nothing dangerous lives in the
vertical.

### What a held section is

Tap **hold** on a section card (or **Hold** in its drawer) and it *sustains*:
its key, its four lanes, at their plateau levels. Open any block and change a
level, a character, an element — you hear it move, because `syncHeld()` is
called from `renderTimeline()`, so the picture and the sound cannot disagree.

Deliberately absent, and **to be refused when asked for by name**:

- **No fades.** Not in, not out. A fade is time, and *"but I want to hear how it
  arrives"* is the most reasonable-sounding request that would turn this into a
  transport. `HELD_RAMP` is declick, not a fade.
- **No advance to the next section. No repeat** — nothing ended.
- **No position**, because there is no position. Nothing to scrub.

### Why it's called "held"

The app already owned the word. **HOLD** on the perform screen means the sound
continues and the plan waits — which is exactly this. And in this room, *"I felt
really held tonight"* means safe. A bed is the thing that holds you.

So a brand-new feature ships with **zero new vocabulary**: not *preview*, not
*audition*, not *solo*, not *loop* — all four borrowed from software that isn't
this.

### Amber, and why that's the rule rather than an exception

A held section wears the amber border. Amber means *live and making sound*, and
a held section is making sound. **First time the rule has told us what to do
instead of what not to do.**

### It stops, three ways, verified

Tapping it again · leaving Design (hooked in `nav()`) · **BEGIN** (first line of
`startPerform`). Sound left running after you walk away would be the worst bug
this product could have, so all three paths were tested rather than reasoned
about.

### The phrases now say what they are — without asking anyone to be a poet

The assembled line under the timeline had no label, so a first-timer could fill
in seven phrases and never notice what they'd made. It now carries one:

| | |
|---|---|
| some sections filled | *carried across the arc* |
| **every** section filled | ***a poem, carried across the whole arc*** |

The field still asks for **"its phrase — the line it carries."** Nobody is ever
*asked* to write a poem; the caption names the **mechanism**, which is true
whether you wrote one word or a sonnet and demands nothing of either.

**The word "poem" appears exactly once in the product, and only after the thing
is finished** — recognition, never an instruction. Plenty of people in this
scene write. None of them need to be told to at an empty field, and the ones who
don't think of themselves as writers get to find out they just did.

### Also
- **Fade edits now redraw the block** — v1.4 made blocks draw their fades and
  `bdFadeIn`/`bdFadeOut` only called `save()`. The picture went stale.
- The **hold** chip appears only on cards wide enough to carry it without eating
  the section's name; narrow sections are held from the drawer. The name never
  gets traded for an affordance.

---

## v1.4 — blocks draw their envelope · 2026-07-31

A block used to draw its **level** — a rectangle filled from the bottom. It now
draws its **envelope**: the fill rises over the fade-in, holds at the level, and
falls over the fade-out.

The gap this closes is real. In the demo session the Root floor departs over 45
seconds and the gong floor arrives in 6; those feel nothing alike in a room, and
a timeline whose entire job is time was drawing them identically.

**Proportional on purpose.** A short fade *should* read as near-vertical — this
is a clock, and putting a taper somewhere other than where it happens would be a
nicer picture and a false one. So on a 4-minute gong block a 6-second entry is a
2.5% bevel and a 45-second exit is a 19% slope, and the difference between them
is exactly the thing you can now see. Fades that would overlap on a short block
scale down together into a triangle rather than crossing over.

One `clip-path` polygon; no new markup. `.lv` became full-bleed and the clip does
what the height used to.

### Changed since v1.3
| | |
|---|---|
| `envelope(b)` | new — returns the polygon for a block's fade-in / level / fade-out |
| `.blk .lv` | `inset: 0` + `clip-path`, was `bottom: 0` + `height` |

---

## v1.3 — a readable Floor, and no more wizard · 2026-07-31

**Floor now says where it is.** A `0 dB` / `−4 dB` / `+3 dB` readout sits on
the label line in The room, and a thin mark on the track shows neutral.

The problem it fixes is real and was invisible until someone opened the panel
in a room: Floor's range is deliberately asymmetric — `−12 … +6`, because a
room far more often needs *less* floor than more — so **zero sits two-thirds
along the track and a slider parked at neutral looks boosted.** The one control
you'd actually reach for mid-session was the one you couldn't read.

The mark is derived from the input's own `min`/`max`, so it can't drift out of
true if the range is ever changed. At neutral the thumb covers it, so there is
never a stray second mark on the track.

**Snap-to-zero was considered and dropped.** Floor steps in 1 dB, and a snap
wide enough to feel would swallow `−1` and `+1` — which are real corrections, not
rounding error. On an eighteen-step slider with the number right there, the
readout *is* the snap. Double-tap already returns to neutral, and the hint now
says so in those words.

**"Wizard" is gone from the interface.** Two strings — *"Let the wizard shape
it"* and *"Start with the wizard"*. The word is software's, not this room's, and
it promises magic where the app is actually offering a short conversation. Both
now name what the thing is: **"Let five questions shape it"** and *"Five
questions and you have a session you can run."* Internal identifiers are
untouched; this was a copy change, not a rename.

### Changed since v1.2
| | |
|---|---|
| The room | Floor value readout on the label line; neutral marked on the track |
| `setFloor()` | calls `renderFloorVal()`, so the number can't fall out of sync |
| `.capline` / `.slidewrap` | new, and reusable by any control that needs a value or a detent |
| copy | two "wizard" strings replaced |

---

## v1.2 — shimmer · 2026-07-31

**A third drone character: Shimmer.** Pad · Choir · Shimmer, on the same Bed
block control added in v1.1 — no new surface, one more entry in a list that
already existed.

**It is not a new layer.** A barely-there shimmer two octaves up has been in
every Bed voice since the beginning, at gain `0.007` — about −43 dB, the only
thing above ~3 kHz. Shimmer brings it forward and adds a fifth and a third
octave above it (`f×4`, `f×6`, `f×8`), while the body pulls back to 62% so the
voice gets **brighter, never louder**.

**Why it doesn't fatigue.** Brightness is the one variable BOOK calls
asymmetric — *"slightly dark is pleasant, slightly bright is fatiguing within
minutes and ruins a room."* Two things keep this on the right side: the extra
energy is high *partials* at low level rather than a raised filter cutoff, and
each glint breathes on its own slow cycle so they never pulse together. That
independence is what reads as light moving instead of tremolo. All of it rides
the pre-fader reverb send, so the shimmer is mostly room.

**Law 5 is intact.** *Never bright by default* is a statement about defaults.
Shimmer is opt-in, per block, and every default is still `pad`.

---

## v1.1 — the choir · 2026-07-31

**Drone character on bed blocks.** Each Bed-lane block can now be **Pad** (the
original — two saws and a triangle) or **Choir**. Set it in the block drawer;
the timeline label shows which. Different sections can carry different
characters, and moving between them crossfades over ten seconds.

**Why the choir is built the way it is.** The wavetable lab
(`../../lab/wavetables.html`) tested whether a producer's sound could ship as a
harmonic spectrum. It mostly can't: the Bed lane filters at
`min(f × 5.5, 1450 Hz)`, so on an F session only about five harmonics survive,
and the tables differ above the 5th. Timbre also lives in the attack, and a
drone has none. **The one that did sound different was the choir — because it
is architecture, not data:** four singers a few cents apart per part, through
*fixed* formant filters, plus breath. Vowels are fixed frequencies; wavetable
harmonics travel with the note, so a choir shipped as a spectrum would chipmunk
as the key migrates. `retune()` deliberately leaves formants alone.

**Floor is now visible on the perform screen.** When it isn't neutral, a small
`floor −4` sits beside the clock — and tapping it opens The room. It was
previously discoverable only by knowing the ☰ menu held it, which meant nobody
would have found it.

**Open question for v1.2:** the human voice is the most attention-grabbing
sound there is, and the drone's job is to disappear. The choir sits slightly
lower and darker than the pad for that reason. Whether it makes room for a live
flute or competes with one is a judgment only a musician in a real room can
make.

### Changed since v1.0
| | |
|---|---|
| `BedVoice` | takes a `character`; `buildChoir()` adds the formant path |
| `Bed` | `setCharacter()` crossfades voice sets over 10 s, pitch logic untouched |
| `evaluate()` | applies the governing bed block's character |
| block drawer | Character chips on Bed blocks |
| timeline | Bed blocks read `choir` instead of `drone` |
| perform screen | the floor readout beside the clock, tappable |
| `retune()` | guards `this.lp` and never moves formants |

---

## v1.0 — 2026-07-31

The build the brand kit was extracted from, plus that day's work:

- **Band status row** on the perform screen — SUB / DRONE / MOTIF / TEXTURE,
  filled when sounding, hollow when silent
- **Multi-device sync** — leader broadcasts state snapshots, followers render
  the sheet; BroadcastChannel locally, a WebSocket relay for real devices
- **Floor** — a room control for the sub, independent of the arrangement
- **Automatic sub reinforcement**, scaled by how low the key sits and updating
  on every migration. Replaced the "Small speaker" toggle, which asked a
  question nobody could answer and failed silently
- **The stack mark** replaced the amber ring; the ring stayed as the GO control
- Wizard option layout fix (label and subtitle ran together)
