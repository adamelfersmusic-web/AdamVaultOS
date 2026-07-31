# Bed — brand & marketing kit

Extracted from `../app/index.html` — the app is the source of truth; when the
kit and the app disagree, the app wins, then fix the app.

**The one rule that governs everything:** amber `#d9a544` means *live and
making sound*. Nothing else may ever wear it.

| Piece | Where |
|---|---|
| Brand book — wordmark, palette, type, section arc, motion, judgment calls | [`index.html`](index.html) (open in a browser; it demonstrates what it states, including the live/ember shift) |
| Marketing kit — film treatment, copy, lead screenshot, rationale | [`marketing-kit.md`](marketing-kit.md) |
| Landing page | [`../site/index.html`](../site/index.html) |
| Compact mark / favicon | [`assets/mark.svg`](assets/mark.svg) |
| Wordmark lockup | [`assets/wordmark.svg`](assets/wordmark.svg) |
| Open questions | [`audit-questions.md`](audit-questions.md) |
| BOOK comparison pass | [`book-comparison.md`](book-comparison.md) |

## ⚠️ Publishing

`sound-bath-app/` sits **outside** `public/` and is **intentionally not
published.** The repo already deploys to GitHub Pages via
`.github/workflows/deploy.yml` (Vite build → `dist`), and `public/` is the
published surface. Do **not** switch Pages to deploy from the branch root —
that would publish Bed by accident and break a deliberate separation between
this and the other product in the repo.

To publish Bed, do it as a conscious act: move `sound-bath-app/` into
`public/`, or lift it into its own repository (it has no dependencies to
untangle). Either way, that decision is gated behind the landing-page
question — see `audit-questions.md` M4.

For local viewing, just open the HTML files in a browser; everything is
self-contained.
