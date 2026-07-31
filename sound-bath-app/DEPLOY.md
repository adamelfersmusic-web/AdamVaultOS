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

1. Deploy `sound-bath-app/relay/` to Render, Railway or Fly — pick "Node", the
   start command is `npm start`. It is ~30 lines and **stores nothing**: a room
   exists only while someone is in it. No database, no accounts, no session
   data at rest.
2. Copy the resulting host.
3. In `app/index.html`, set:

   ```js
   const RELAY_URL = 'wss://your-relay-host';
   ```

4. Push. Done.

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
