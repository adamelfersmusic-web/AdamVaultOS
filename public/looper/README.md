# Pedal

A browser practice tool for improvising musicians. One self-contained HTML file,
all sound synthesized live with Web Audio, no samples anywhere.

**Live:** `/AdamVaultOS/looper/`

> Opening a DAW puts you in producer mode. This keeps you in improviser mode.

A drone holds indefinitely — no bars, no counter, nothing to set up — because
most practice happens without bars. Rhythm is opt-in. Two taps to sound.

---

## What's in here

| File | What it is |
|---|---|
| `index.html` | The app. Everything — markup, styles, synthesis, sequencing. |
| `SPEC.md` | What exists and why. The reasoning, the deliberate omissions, the backlog. |
| `ROADMAP-TIERS.md` | **The plan.** Tiers 2–4 and the freeze protocol. Hand this to a build session. |
| `HANDOFF-PROMPTS.md` | Copy-paste prompts, one per tier. |
| `v1/` | Frozen. Never edit. |

If you're picking this up cold, read `ROADMAP-TIERS.md` first — it's the only
document that says what to do next.

## The frozen versions

Every tier is frozen before the next one starts, and frozen copies are never
edited, cleaned up, or deleted. They deploy alongside the live app so any two
versions can be opened in adjacent tabs and switched by ear.

The reason is narrow and non-negotiable: **the only honest way to judge a change
to sound is to A/B it against what came before.** Memory for timbre is bad, and
a change that measures better can sound worse.

| | | |
|---|---|---|
| **v1** | `/AdamVaultOS/looper/v1/` | ✅ verified on real speakers |
| v2 | `/AdamVaultOS/looper/v2/` | after tier 2 |
| v3 | `/AdamVaultOS/looper/v3/` | after tier 3 |
| v4 | `/AdamVaultOS/looper/v4/` | after tier 4 |

## Not to be confused with

`sound-bath-app/` in this repo — **Bed** — is a different product for a
different person, and the two stay separate. Bed is a generative engine for
sound bath practitioners; Pedal is a practice tool for improvisers. They share
some DSP lessons and nothing else.
