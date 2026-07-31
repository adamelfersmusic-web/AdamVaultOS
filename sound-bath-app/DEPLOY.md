# Deploying Bed

Two steps, both small. Nothing here copies files — **the live site is built
from this folder**, so everything you push stays in sync automatically.

---

## 1 · The site (~10 minutes, free)

1. Go to Netlify → **Add new site → Import an existing project** → pick
   `adamelfersmusic-web/AdamVaultOS`.
2. Set **Branch** to whichever branch you're working on.
3. Leave the build command empty. Netlify reads `netlify.toml` at the repo
   root, which already sets `publish = "sound-bath-app"`.
4. Deploy.

You get:

| URL | What |
|---|---|
| `/` | the landing page |
| `/app/` | the app |
| `/brand/` | the brand book |
| `/join?c=ABCD` | short follower link |

**Staying in sync:** every `git push` redeploys in ~30 seconds. There is no
second copy of the app anywhere, so it cannot drift. `index.html` is served
`no-cache`, and the service worker is deliberately **network-first**, so an
open device always picks up the newest build rather than a stale cache.

**This does not touch the repo's existing GitHub Pages deploy** — that's a
different service building `public/` via Actions for a different product.
`sound-bath-app/` stays outside `public/`, exactly as intended.

---

## 2 · The relay — what makes two devices work (~10 minutes, free)

Without it the app still runs completely; sync just stays same-device (across
tabs). With it, phones in the room follow the leader.

It is ~40 lines and **stores nothing**: a room exists only while someone is in
it. No database, no accounts, no session data at rest.

1. **Render → New → Blueprint**, point it at this repo. `relay/render.yaml`
   already sets root dir, build command, start command and health check —
   there is nothing to type. *(Railway and Fly work the same way: Node, root
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
