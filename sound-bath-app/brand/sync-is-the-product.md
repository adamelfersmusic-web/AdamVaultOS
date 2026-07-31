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
