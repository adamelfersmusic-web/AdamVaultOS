# Sessions travel

2026-07-31. Adam, on seeing what Import does:

> *The idea that people could make their own Bed sessions and share them and
> import them is cool as fuck. Like — hey! practice with this at your house.
> This is our session for the bath!*

That second line is the important one. It isn't a sharing feature. **It's
rehearsal**, and it's the strongest use case anyone has named for this product.

---

## It already works

No infrastructure, today, in the shipped app:

```
Export  →  a few KB of JSON  →  email it  →  Import  →  it's in their library
```

`normalizeSession()` gives the import a **new id** (so nothing overwrites) and
back-fills anything an older build didn't have (so a session made months ago
still opens). Nothing uploads, no account, no server.

**And it renders for *their* kit, not yours.** Verified: every call that builds
a bowl sheet reads `store.settings.kit` — the device's *own* kit — never the
one in the file. A 7-bowl author and an 8-bowl player open the same session and
each sees their own bowls. That was already built and nobody had named what it
was for. **It's for this.**

*(The file does carry the author's `kit` and `refHz`. Nothing reads them for
the sheet, so they function as provenance — a record of what this was made on,
which is genuinely useful to a player: "she wrote this for eight.")*

**Levels travel too.** `b.level` is written into the session on every drag of
the block slider and saved immediately — there is no save button anywhere in
Bed. Export is `{...S, refHz, kit}` with the id deliberately stripped, so every
block's level, fade-in and fade-out crosses intact, and `respine()` on import
only rewrites section boundaries from durations — it never touches a lane
block. **The mix you shaped is part of what you hand over.**

---

## The use case: rehearsal, not marketing

Everything in `ecosystem.md` and `business-model.md` treats a shared session as
a *demo* — a way to show someone the product. Rehearsal is better on every axis,
because it isn't marketing at all. It's operationally necessary.

> Four people are playing a bath together in three weeks. One of them builds
> the session. Everyone else gets the file, and for three weeks they each run
> it **alone, at home, with their own bowls**, learning where the key changes
> and what the Heart section wants.
>
> Then they show up and play it together.

### Why this is worth more than the follower flywheel

The flywheel in `business-model.md` is: *each session puts Bed in ten hands, for
fifty minutes, in candlelight.* Fifty minutes of holding a sheet.

Rehearsal puts Bed in ten hands **for three weeks, alone, at home, with the
instruments out** — which is precisely the situation in which someone starts
wanting the session to be *theirs*. It's the same funnel, an order of magnitude
longer, and pointed at the moment the paywall is designed for.

It is also the first thing in this entire product that literally delivers the
line. *One violin player becomes a symphony* was about one person sounding like
many. **An ensemble that rehearsed the same session is many people sounding like
one** — and that's a better version of the claim, made real by a file.

---

## The paywall question this raises, and its clean answer

Frictionless sharing looks like it cuts against paid authoring: build one
session, send it to five hundred practitioners, nobody buys.

**It doesn't, because the paywall is already in the right place.**

> **Running a session you were given is free. Changing it is authoring.**

Import it, run it forever, no account, no charge — that's the free tier doing
exactly what it says. Move a section, change a key, put your own poem in it,
save it under your name? That's authorship, and that's the paid thing.

This makes sharing the **best** acquisition channel in the plan, not a leak:

- Every shared session is a fully working demo of the real product
- It arrives from a person the recipient already trusts
- It lands in their hands **at home, alone, repeatedly**
- And it converts at the exact moment the model was built for — when they want
  it to be theirs

Nothing needs to change in the business model. It needed one sentence added.

---

## What it needs to feel like a thing

Three items, all small, none requiring a server.

### 1 · A link, not a file

Emailing a `.json` means: download, find it in Files, open Bed, tap Import,
locate it. That's five steps and a file manager, and it's where ordinary people
fall off.

A session is a few kilobytes. **Put it in the URL fragment:**

```
bed.holdingspace/s#<gzip + base64url of the session>
```

- The fragment after `#` is **never sent to any server**. Private by
  construction — no storage, no accounts, nothing to leak, nothing to run.
- `CompressionStream('gzip')` is native in browsers now. A ~6 KB session
  compresses to roughly 1.5 KB of URL — comfortably inside every messaging app.
- Tap the link on a phone → Bed opens with the session in the library.
- It works exactly as well when there is no network and no relay, which is the
  same promise the rest of the app makes.

This is the payoff of a decision made long ago and stated on the landing page:
*a session is a few kilobytes of parameters, never audio.* Sessions are small
enough to be **links**. Audio never would have been.

### 2 · Authorship travels with the session

The schema has `title`, `subtitle`, `refHz`, `kit`, `sections`, `lanes` — and
**no author**. If sessions move between people, the name has to move with them,
and it should be visible: *"from Adam Elfers"* on the library card.

This is the same instinct as the monthly: **feature a person, never the
software.** It also quietly builds the network — you learn who makes good
sessions by receiving them, which is how every real scene works.

Add `author` and `sharedFrom` to format 2, defaulting empty. `normalizeSession`
already back-fills missing fields, so nothing breaks.

### 3 · Rehearsal mode is a copy problem, not a code problem

Nothing needs building. Someone running a shared session at home **is already
running the app normally.** What's missing is that nobody knows they can.

One line on the landing page and one in the share sheet:

> *Send it to whoever's playing with you. They can practise it at home, on their
> own bowls, before the night.*

---

## Sequencing

| | | |
|---|---|---|
| 1 | `author` on the session, shown on the card | tiny, and everything else assumes it |
| 2 | Share link via URL fragment | no server, no accounts — the whole feature is a compress and a parse |
| 3 | Say it out loud in the copy | free |
| 4 | The monthly ships as a link | the subscription payload becomes a URL |

Item 4 is worth noticing: **the monthly curated session, the payload the whole
Season tier rests on, is just item 2 pointed at a mailing list.** No delivery
infrastructure ever gets built.
