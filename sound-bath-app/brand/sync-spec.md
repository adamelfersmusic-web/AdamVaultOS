# Bed — multi-device sync, v1 technical spec

Leader broadcasts; followers render. One device makes sound, every other is
paper that updates.

Line numbers are as of `sound-bath-app/app/index.html` at the commit that added
this file. Verify before editing; the seams are named by function, which is
stable.

---

## 0 · Principles

1. **Broadcast state, not events.** The wire carries a snapshot of *where we
   are*, never a log of *what happened*. This makes late joiners, dropped
   packets and reconnects the same problem, solved once.
2. **Never sync audio.** Only display state crosses the wire. A quarter-second
   of lag on "we're in section 3" is invisible; audio sync is a different and
   brutal problem, and it is not this one.
3. **Followers are read-only.** A follower has no transport, no engine, no
   audio context. It cannot affect the room.
4. **Degrade to paper.** A follower that loses the connection freezes on the
   current section — which is exactly the printed handout it replaced. The
   failure mode is the status quo.
5. **Additive only.** The solo app keeps working with no network, no account
   and no relay. Nothing about the single-device experience changes.

---

## 1 · Roles

| Role | Runs | Publishes | Subscribes |
|---|---|---|---|
| **Leader** | full app: engine, transport, audio | state + session | `need` requests |
| **Follower** | render only | `need` on cold start | state + session |

A device is a follower **only** when it joined via a room code. There is no
mode switch inside a live session.

---

## 2 · Transport

All vendor contact goes behind one interface, so the relay is swappable:

```js
// The ONLY vendor-aware code in the app.
const Net = {
  // returns { send(obj), leave() }; onMsg receives parsed objects
  join(roomCode, onMsg) { /* ... */ }
};
```

**Recommended: Supabase Realtime broadcast channels** — no database writes, no
auth beyond the anon key, no server code to deploy. Channel name
`bed-room-${CODE}`. PartyKit or a ~50-line WebSocket server on Fly are equally
fine; nothing above this interface knows the difference.

**Why a cloud relay beats a local-network scheme here:** every phone uses its
own cellular data, so the venue's wifi is irrelevant. Peer-to-peer would mean
fighting NAT on a guest network, in the dark, while people are arriving.

---

## 3 · Room codes

Four characters from an unambiguous alphabet — `ABCDEFGHJKMNPQRSTUVWXYZ23456789`
(no `0/O`, `1/I/L`). ~900k combinations, case-insensitive on entry.

Generated fresh per performance, discarded on exit. Displayed large, with a QR
encoding `https://<host>/?join=CODE`.

**Security posture, stated honestly:** codes are guessable in principle. The
exposure is that a stranger sees a bowl sheet. There is no auth in v1 and that
is a deliberate, documented trade — the alternative is accounts, which the
product does not have and should not grow for this.

---

## 4 · Wire format

Every message is JSON with `v` (protocol version) and `t` (type). Unknown
types are ignored, so the protocol can grow without breaking old clients.

### 4.1 `state` — leader → room

Sent on every meaningful change **and** on a 2000 ms heartbeat.

```json
{
  "v": 1,
  "t": "state",
  "lid": "l7f3a9",
  "seq": 412,
  "sh": "a3f9c1",
  "sec": "heart",
  "pos": 43.82,
  "hold": false,
  "live": true,
  "end": false
}
```

| Field | Meaning |
|---|---|
| `lid` | leader id — random per performance; guards against two leaders |
| `seq` | monotonic counter; followers ignore `seq <= lastSeq` from the same `lid` |
| `sh` | session hash (see 4.2) — how a follower knows if it has the right session |
| `sec` | current section `id` — authoritative, so a follower never has to derive it |
| `pos` | position in minutes, float |
| `hold` | leader is holding — the plan is waiting |
| `live` | audio has begun (drives the ember palette on followers) |
| `end` | session has ended (drives the after-screen) |

~110 bytes. At 0.5 Hz this is free.

`sec` is sent explicitly rather than derived from `pos` so that the two can
never disagree — the leader's `sectionAt()` result is the truth.

### 4.2 `session` — leader → room

Sent in reply to a `need`, debounced to at most once per 2000 ms (it is a
broadcast, so one reply serves every follower that just joined).

```json
{ "v": 1, "t": "session", "sh": "a3f9c1", "session": { /* normalized format-2 session */ } }
```

`sh` is a cheap 24-bit hash of `JSON.stringify(session)`, hex-encoded. Its only
jobs are cache validity and detecting that the leader switched sessions.

**`refHz` is deliberately not sent.** The bowl sheet is computed from pitch
classes only (`bowlSheet()` never touches frequency), so reference pitch cannot
change what a follower reads.

**The kit is deliberately not sent.** Per BOOK's rule, broadcast the *pitch
set*, not per-person assignments: each phone filters the section against the
kit its owner declared once. No server-side roster, and it self-corrects when
someone doesn't show up.

### 4.3 `need` — follower → room

```json
{ "v": 1, "t": "need", "sh": "a3f9c1" }
```

Sent when a follower receives a `state` whose `sh` it cannot satisfy from
cache. Followers cache sessions in `localStorage` under `bed.sync.<sh>`, so a
rejoin is silent.

---

## 5 · Join flow

**Leader**
1. On the perform screen, taps **Share sheet** (new, beside the existing
   `#pSheet` button).
2. Client generates `CODE` + `lid`, calls `Net.join`, begins publishing.
3. An overlay shows the code and QR. Dismissible; publishing continues.

**Follower**
1. Opens `?join=CODE` (QR or typed).
2. If no kit is stored, a one-time question: *what bowls do you have?* — reuses
   the wizard's kit step, writes `store.settings.kit`, never asked again.
3. `Net.join(CODE)`, then wait.
4. First `state` arrives (≤2 s). If `sh` is uncached → send `need`; the
   `session` arrives; render.
5. Screen goes to follower view and stays there for the session.

**A follower never sends anything after `need`.** No presence, no heartbeat, no
acknowledgement — nothing that could turn ten phones into traffic.

---

## 6 · Reconnect, staleness, edge cases

**Reconnect** — the transport reconnects itself. On resubscribe the follower
does nothing and waits for the next heartbeat (≤2 s). No catch-up path exists
because none is needed; that is the point of broadcasting state.

**Out-of-order delivery** — ignore any `state` with `seq <= lastSeq` for the
current `lid`.

**Two leaders** — a follower locks to the first `lid` it sees and ignores
others until that leader sends `end:true` or goes silent for 60 s. Prevents
chaos if someone opens leader mode twice.

**Staleness** — the follower does **not** react to a brief gap; a frozen sheet
is a correct handout. After **30 s** with no `state`, show one quiet line in
`--ink4` at the bottom: *not receiving — showing the last cue.* Honest, and it
tells a practitioner whether to trust the screen. Clear it on the next `state`.

**Position interpolation** — not needed in v1. The follower view shows no
clock, and sections are minutes long. If a countdown is ever added, advance
`pos` locally from `requestAnimationFrame` and hard-correct on every heartbeat.

**Leader exits** — publish one final `state` with `end:true`, then `leave()`.

---

## 7 · Seams in `index.html`

### 7.1 Leader — almost entirely additive

The cue bus already emits every semantic moment. **The leader needs one edit to
existing logic; everything else is a subscription.**

```js
// after the bus is defined (~line 1445)
const publish = () => { /* build snapshot from T, Net.send */ };
['section:change', 'hold', 'hold:release', 'session:start', 'session:end']
  .forEach(ev => bus.on(ev, publish));
```

| Seam | Line | Change |
|---|---|---|
| `const bus` | 1445 | none — subscribe only |
| `const T` | 2071 | add `net: null, lid: null, seq: 0, lastPub: 0` |
| `tick()` | 2222 | **the one real edit** — heartbeat: `if (T.net && now()*1000 - T.lastPub > 2000) publish();` |
| `sectionChange()` | 2204 | none — already emits `section:change` |
| `toggleHold()` | 2298 | none — already emits `hold` / `hold:release` |
| `setPos()` | 2290 | none — GO and JUMP both land on a section boundary, which fires `sectionChange` |
| `beginLive()` | 2257 | none — already emits `session:start` |
| `endSession()` | 2306 | none — already emits `session:end` |
| `exitPerform()` | 2326 | add `T.net?.leave(); T.net = null;` |
| `.pfoot` markup | ~630 | add the **Share sheet** button beside `#pSheet` |

That is **two edits and one subscription block** for the entire leader side.
The bus was designed for this: *"Follower views, lights and projection are all
just subscribers to this stream."*

### 7.2 Follower — the whole integration is three assignments

`renderFollower()` (line 2436) reads exactly three things: `T.S`, `T.pos`, and
`store.settings.kit`. Nothing else. So:

```js
function applyState(msg, session) {
  if (session) T.S = session;          // normalizeSession() it on receipt
  T.pos = msg.pos;
  document.body.classList.toggle('live', msg.live);
  renderFollower();                     // the existing function, unmodified
}
```

| Seam | Line | Change |
|---|---|---|
| `renderFollower()` | 2436 | **none** — works as written |
| `#followerView` markup | ~639 | add the after-screen block (§8) |
| `followerView` onclick | 3158 | **guard it** — in follower mode the tap must not dismiss the view |
| `requestWake()` | ~2455 | call it on follower join too; these phones sleep |
| `nav()` | 2471 | add a `follower` screen state, or open `#followerView` directly and skip `nav` |
| boot (`wire()` / bottom) | 3064+ | if `?join=` is present, enter follower mode and **skip** `seedLibrary()`, audio init and `tick()` |

**A follower must never call `initAudio()` or `tick()`.** Assert it in code.

---

## 8 · The after-screen

When `state.end === true`, the follower replaces the sheet with the closing
poem — `S.sections.map(s => s.phrase).filter(Boolean).join(' / ')`, the same
line the leader's complete state shows.

Beneath it, and **only here**, the app identifies itself and offers a path to
leading. Nine practitioners have just held this product through a peak
experience; this is the entire growth loop, and it costs one screen.

**It may never appear during a session.** Nothing interrupts the room. The
after-screen is the single sanctioned exception, and it appears only on
`end:true`.

---

## 9 · Out of scope for v1

- Audio sync of any kind
- Per-person bowl assignments (broadcast the pitch set; phones filter)
- Any server-side roster or presence
- Accounts, auth, persistence of rooms
- Lights and projection — same subscriber pattern, later
- Follower-initiated anything

---

## 10 · Test plan

1. **Late join** — follower joins at minute 30; correct within 2 s.
2. **Airplane mode for 60 s** — sheet freezes, staleness line appears at 30 s,
   recovers within 2 s of reconnect with no stale render.
3. **Hold** — leader holds; every follower reflects it within 2 s.
4. **Jump backwards** — followers follow; no follower runs ahead on a local clock.
5. **Ten followers, one leader** — bandwidth stays flat (broadcast, not per-peer).
6. **Two leaders** — followers lock to the first and ignore the second.
7. **Different kits** — three followers with 7-bowl, 8-bowl and custom kits each
   render a correct and *different* sheet from the same wire message.
8. **Leader quits mid-session** — followers freeze, staleness line, no crash.
9. **Solo regression** — with no network at all, the app behaves exactly as
   before. This is the one that must never break.

---

## 11 · Honest risks

- **Venue connectivity.** Mitigated by cellular data and by the freeze-to-paper
  failure mode, not eliminated.
- **Room codes are unauthenticated.** Documented above; the exposure is a
  stranger seeing a bowl sheet.
- **Relay dependency.** The solo app must remain fully functional offline —
  this is a brand promise, not a technical preference. Any change that couples
  the single-device app to a network is a defect.
- **Ten sleeping phones.** Wake lock is best-effort; iOS may still sleep. Worth
  telling leaders to say "keep your screen on" once, out loud.
