# Sync is the product

Decided 2026-07-31, in conversation. Recorded because it re-ranks the roadmap.

## The reframe

Multi-device sync was filed as a v-next feature, surfaced only because the film
depicts phones syncing (shot 4) and the app can't do it. That framing was wrong.

**Sync is the group product, and the group product is where the money is.**
BOOK's model: *one leader licence, N follower devices* — "nine practitioners
experience the app from the inside every session, and some fraction will want
to lead their own."

The single-device app is the demo. The room is the business.

## What this resolves

**The backend tension disappears.** The audit worried that "files you own, no
account" forbids a server. It doesn't — that promise belongs to the
**instrument**. A practitioner working alone keeps the sovereign, offline,
no-account app forever, unchanged. The **group product** is legitimately a
service: room code, relay, leader licence. Two products, two promises, one
of them needs a server. Sync is not a compromise of the brand; it's the
paid tier.

**It answers what to build next.** Not the wizard's poem step, not landscape —
sync is the only open item that is simultaneously the film's missing shot, the
group product, and the revenue mechanic.

## The follower device is the acquisition surface

Nine practitioners hold the product in their hands for fifty minutes, in
candlelight, during a peak experience. That is the highest-converting demo
available, and it costs nothing.

**Today the follower view is an unbranded fullscreen overlay.** It never says
what it is, and there is no path from holding it to leading with it.

**The fix, and its constraint.** Nothing may interrupt the room — the posture
forbids it. So the invitation lives *only in the after*: when the session ends,
the follower phone is already showing the closing poem. That is the moment it
can quietly identify itself. Never during. One screen, and the growth loop
closes.

## The build

The hard part is done: the cue engine has emitted `section:change`,
`key:migrate`, `fade:start`, `session:start` and `hold` since day one —
"follower views, lights and projection are all just subscribers to this
stream."

**What can't work:** deterministic clock sync (every device computes position
from a shared start time, no network). It breaks immediately, because GO
advancing early is the *normal* case — the leader moves when the room is ready.
Add HOLD and JUMP and the timelines diverge at the first section.

**What works:** a cloud relay carrying display state only — never audio. One
device makes sound; the rest are paper that updates. A quarter-second of lag on
"we're in section 3" is invisible.

**Why it's safe in a bad venue:** a follower that loses connection freezes on
the current section — which is exactly the printed handout they would otherwise
be holding. The degraded state is the status quo.

**Design rule from BOOK:** broadcast the active *pitch set*, not per-person
assignments. Each phone filters against the kit its owner declared once. No
server-side roster, and it self-corrects when someone doesn't show.

**Minimum that makes money:** leader broadcasts section state; followers join by
room code and see the sheet. Roughly a week. Everything else — lights,
projection, live inputs — is the same subscriber pattern afterwards.

## Consequences elsewhere

- **The film:** shot 4 stops being an atmospheric beat and becomes the money
  shot. Keep it in the 30-second cut.
- **The landing page:** the multi-device story was removed as an overclaim. It
  comes back when sync ships — and as a section, not a clause.
- **Pricing (M3):** the leader licence is the gear-priced item; the follower
  devices are what make that price legible, alongside the sub.
- **Hand signals:** BOOK notes that if the app defines the signals, the app
  becomes the standard — a social moat. Ship them with sync.

---

## Why twenty players works — and it's law 1, not the network

2026-07-31. Adam: *"are you telling me you could lead a Bed session with like 20
practitioners and it would still stay in sync?"*

Yes, and the reason is worth writing down because it isn't the obvious one.

### The network half is boring, deliberately

State **snapshots**, not event streaming. Every message is the whole picture, so
a device that misses ten messages is corrected by the eleventh, a dropped packet
needs no replay, someone joining at minute 30 is right within one heartbeat, and
a phone that slept is right the moment it's tapped. No per-device state on the
leader — one broadcast to N sockets. **21 sockets and a few hundred bytes every
few minutes. The relay wouldn't notice 200.**

### The half that actually matters

**"In sync" here does not mean locked to a beat.** There is no beat. Twenty
people are synchronised to a *context* — which section, which key, which of
their own bowls right now.

> **Nobody plays together. Everybody plays *within*.**

Gamelan, or a raga ensemble. Not an orchestra with a conductor's downbeat.

### The finding

> ### The absence of a pulse is what makes an ensemble scale.

With a beat, twenty players would have to lock to it across Bluetooth latency,
wifi jitter and human reaction time, and it would be a shambles. **Without one,
latency is irrelevant** — a phone half a second behind is still in the right
section, the right key, on the right bowl. `DEPLOY.md` already says this about
Bluetooth speakers without noticing it generalises.

**Law 1 was written for the room's calm. It turns out to be the thing that lets
twenty people play at once.** Nobody designed that; it fell out.

### The real limit is mud, and the sheet is the answer

Twenty people playing bowls freely is an enormous amount of sound. What stops it
turning to porridge is the other half of the sheet — **freely / sparingly /
rest, it fights the key**, computed per person against the current section.

**At twenty players the sheet stops being a convenience and becomes the
arrangement.** Some are playing freely, some sparingly, some resting, and none
of them had to be told by the leader.

> **You could lead twenty, and the reason you could is that you would not have to
> conduct them.**
