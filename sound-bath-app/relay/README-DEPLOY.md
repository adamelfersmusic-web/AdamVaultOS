# Deploying this relay

**The Blueprint lives at the repository root**, not here — `../render.yaml`.
Render only reads `render.yaml` from the root of a repo; a copy in this folder
would be silently ignored and *New → Blueprint* would report finding nothing.

That file points back here with `rootDir: relay`.

Full instructions: [`../DEPLOY.md`](../DEPLOY.md) step 2.
