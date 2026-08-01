# Deploying Bed

<!-- ⚠️ brand/HANDOFF.md diverges between the repos for the SAME reason
     as this file — one repo is private and one is not, so the "how to
     hand this to another session" instructions differ. Two files are on
     the never-mirror list now: DEPLOY.md and brand/HANDOFF.md. -->
<!-- ⚠️ DO NOT copy this file between repos. The bed and AdamVaultOS copies
     diverge on purpose — different repo name, different Netlify setup, and
     one publishes an allowlist the other doesn't. This copy is AdamVaultOS.
     Mirror every other file freely; edit this one in place, twice. -->

Two steps, both small. Nothing here copies files — **the live site is built
from this folder**, so everything you push stays in sync automatically.

---

## 1 · The site (~10 minutes, free)

1. Go to Netlify → **Add new site → Import an existing project** → pick
   `adamelfersmusic-web/AdamVaultOS`.
2. Set **Branch** to whichever branch you're working on.
3. **Leave every build field alone** — base directory, build command, publish
   directory. Netlify reads `netlify.toml` at the repo root and overrides all
   of them. It builds an **allowlist** into `_site/` and publishes that.
4. Deploy.

**Live:** <https://bed-holdingspace.netlify.app> — Netlify project
`bed-holdingspace`.

You get:

| URL | What |
|---|---|
| `/` | the landing page |
| `/app/` | the app |
| `/join?c=ABCD` | short follower link |
| `/guide.html` | *Running a night* — the user guide (published, not linked from anywhere yet) |

**Those four URLs are the entire public surface.** Every published file is named individually in `netlify.toml` — adding an asset means adding it there. ⚠️ `site/versions/` and `app/versions/` are deliberately NOT published: they are working history and design rationale, not pages anyone should land on.

⚠️ **`/brand/` is NOT published, and must not be.** An earlier version of this
table listed it, which was wrong: the brand folder holds `business-model.md`
and the pricing strategy. Verified — `/brand/business-model.md` returns 404.

**Staying in sync:** every `git push` redeploys in ~30 seconds — the site is
built from the repo, so the deployed app can never drift from the source.
⚠️ There IS, however, a second copy of the source: Bed lives in both
`adamelfersmusic-web/bed` (which deploys) and `AdamVaultOS` under
`sound-bath-app/` (which doesn't), mirrored **by hand**. That is a
migration that was started and not finished, and it is the one real drift
hazard in this project. Finish it by deleting `sound-bath-app/`.

**Caching:** `index.html` is served `no-cache` and the service worker is
deliberately **network-first**, so an open device always picks up the newest
build rather than a stale cache.

**This does not touch the repo's existing GitHub Pages deploy** — that's a
different service building `public/` via Actions for a different product.
`sound-bath-app/` stays outside `public/`, exactly as intended.

---

## 2 · The relay — what makes two devices work (~10 minutes, free)

Without it the app still runs completely; sync just stays same-device (across
tabs). With it, phones in the room follow the leader.

It is ~40 lines and **stores nothing**: a room exists only while someone is in
it. No database, no accounts, no session data at rest.

1. **Render → New → Blueprint**, point it at this repo. **`render.yaml` at the
   repo root** already sets root dir, build command, start command and health
   check — there is nothing to type. *(It has to be at the root: Render reads
   Blueprints from there and nowhere else.)* *(Railway and Fly work the same way: Node, root
   `relay/`, `npm start`.)*
2. **Check it came up.** Open `https://<your-host>/` in a browser. You should
   see `{"ok":true,"service":"bed-relay","rooms":0}`. That endpoint exists so a
   failure is visible in one click instead of in a dark room.
3. **Prove it with two real devices before committing the address.** Open the
   app on both, with the relay passed in:

   ```
   …/app/?relay=wss://your-relay-host
   ```

   Share the sheet on one, join on the other. If the follower's sheet follows,
   the relay works.
4. **Then make it permanent** — in `app/index.html`:

   ```js
   const RELAY_URL = 'wss://your-relay-host';
   ```

   Set once, here, so every device that loads the app has it. **A follower must
   never have to configure anything.**
5. Push. Done.

> **Why there is an HTTP server inside a websocket relay:** Render, Railway and
> Fly detect and health-check a service by making a plain HTTP request to its
> port. A bare `WebSocketServer({ port })` answers nothing on HTTP, so the
> platform concludes the service never started and kills it — logging *"no open
> ports detected"* and nothing at all about websockets. That is a genuinely
> confusing hour, and the http server is what avoids it.

---

## Trying it on two devices

1. Open `/app/` on the device connected to the speaker. Begin a session, then
   tap **Share the sheet** — a four-character code appears.
2. On a phone, open `/join`, enter the code, pick which bowls you have.
3. The phone now shows the sheet for the current section, in your kit, and
   follows every GO, HOLD and JUMP.

**If the phone loses signal** it freezes on the current section — which is
exactly the printed handout it replaced. Nothing crashes and the leader is
never affected.

---

## Notes for the room

- **Speakers.** Anything works — the leader's device makes all the sound, so
  it's one source, one speaker, no mixer. Bluetooth is fine: the engine has no
  pulse, so latency genuinely does not matter here. On a speaker that can't
  reach ~40 Hz, turn on **Small speaker** in Ensemble — it reinforces the sub's
  harmonics so the floor still reads as depth.
- **Followers use their own data.** They do not need venue wifi.
- **Say "keep your screens on" once, out loud.** Wake lock is best-effort and
  some phones ignore it.
- **Add to Home Screen** on the leader's device: it opens fullscreen, offline,
  with its own icon.
