# Distribution and saving — how Bed reaches people and keeps their work

The plan for getting Bed onto other people's devices, and for what happens to
the sessions they build there. Written 2026-07-31.

---

## Where we already are — better than it looks

**Twenty practitioners in twenty cities can use Bed today, each building their
own sessions, and it works.**

There is no server, so there is nothing to scale, nothing to log into, and
nothing that costs money. Each person opens a URL; the app runs entirely in
their browser; their sessions save to their own device. **Twenty users and
twenty thousand are the same amount of infrastructure: none.** No accounts, no
instances, no database, no per-user cost.

That is not a stopgap — it's a genuine architectural advantage, and it's why
the product can be given away and still be sustainable.

**How it saves today:** `localStorage`. Sessions persist across visits with no
save button. Export/import as JSON — a few kilobytes of parameters, never
audio.

**What's genuinely weak:**

- Clear browser data → sessions gone
- New phone → sessions don't follow
- Sharing means emailing a file
- **No accounts means nothing can be sold** — the real one

---

## Deploying: three separate things, only the first required

| | What | Effort |
|---|---|---|
| **1 · A URL** | Lift `sound-bath-app/` into its own repo → Netlify or GitHub Pages. Static files, zero dependencies, no build step. | **~an hour** |
| **2 · Cross-device sync** | Swap `Net.join()` from `BroadcastChannel` to a relay (Supabase Realtime free tier / PartyKit). The interface exists; it is one function. | **~a day** |
| **3 · Saving across devices** | Accounts + cloud. Where the brand tension lives — see below. | later |

**Do not** switch the existing repo's Pages to deploy from root. `sound-bath-app/`
sits outside `public/` deliberately, and the repo already deploys a different
product via `.github/workflows/deploy.yml`. Lifting Bed into its own repo is
the move BOOK anticipated: *"that folder lifts into its own repository with no
untangling."*

**#1 unblocks #2.** Followers need a URL to open — a `file://` path can't be
joined. So the deploy decision and the sync work are the same decision, which
is what M4 has been holding.

---

## Saving: three stages, and the middle one needs no server

### Now — make local storage trustworthy

`localStorage` plus **silent auto-export** (audit item A6): when a session
begins, the file quietly lands in Downloads. Zero UI, zero anxiety, and if the
worst happens the session is simply *there*. Anxiety is not something this
brand introduces.

Plus **PWA install** — manifest and service worker so the app can be added to a
home screen, opens offline, and has a real icon. This matters more than
accounts do right now, because the actual risk isn't "I can't log in," it's
"I didn't realise it saved" or "I lost it."

### Next — a session as a link

Sessions are a few kilobytes of JSON, which is small enough to **compress into
the URL itself** (`CompressionStream` → base64url → fragment). Send someone a
link; they open it; they have the session. **No account, no backend, no
upload, nothing to host.**

This is the most on-brand feature available to us: the app already says *a
session is a few kilobytes of parameters, never audio* — so it can literally
**be** a link. It also becomes the shipping format for curator packs later,
exactly as BOOK envisaged: *"Splice ships gigabytes; this ships JSON."*

### Then — accounts, but only on the paid side

This is where the tension appears to be, and it dissolves once the two products
are named:

> **Solo stays sovereign and free forever.** Local, no account, works offline.
> **The group product is the service.** Leader licence, relay, cloud save.

The "files you own, no account" promise belongs to the **instrument**, and a
practitioner working alone keeps it unchanged, permanently. The **ensemble
layer** is legitimately a service — it has a room code, a relay, and a licence
to enforce. Two products, two promises, and nobody's sovereignty is removed to
enable the business.

---

## Is it intuitive?

Extremely — it's a URL. No install, no signup, no onboarding. The risk runs the
*opposite* direction from most software: not "I can't get in," but "I didn't
know it saved" and "I lost my work."

Which is why the ranking is: **auto-export and PWA install before accounts.**

---

## Recommended order

1. **Lift Bed into its own repo and deploy it.** Unblocks everything, ~an hour.
2. **Auto-export on begin** (A6) + **PWA manifest and service worker.**
3. **Swap the relay in** — cross-device sync goes live; the group product exists.
4. **Session-as-a-link** sharing.
5. **Accounts and cloud save** — only when there is a leader licence to sell.

Steps 1–4 require no accounts, no database and no recurring cost. The business
only needs a backend at step 5, by which point it is being paid for.
