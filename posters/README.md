# Escensus poster — 18×24in

Print-ready one-sheet for **Escensus**, the first 90-day agent ramp system
(a SignalCraft product).

All copy, structure, and the visual system are pulled from
[`adamelfersmusic-web/escensus-site`](https://github.com/adamelfersmusic-web/escensus-site)
(`index.html`) so the poster and the site stay in the same voice.

## Deliverable

| File | What it is |
| --- | --- |
| `escensus-poster-18x24.pdf` | **The print file.** 1 page, 1296×1728pt = exactly 18×24in, no margins, full-bleed background. |
| `preview-small.png` | Low-res look at the layout. |

Printed on a dark full-bleed field, so ask the printer for a stock and press
that hold a solid — matte or satin, not uncoated. There is no bleed margin
baked in: the trim is 18×24 exactly. If your printer wants 0.125in bleed,
change `@page{ size:18in 24in }` and `.poster{ width:18in; height:24in }`
in `escensus-poster.css` to `18.25in × 24.25in` and rebuild.

## Source

| File | What it is |
| --- | --- |
| `escensus-poster.body.html` | Content and structure. Edit copy here. |
| `escensus-poster.css` | Layout and brand system. Edit design here. |
| `_fonts.css` | Spectral / Inter / IBM Plex Mono, latin subsets, base64-inlined so the build needs no network. |
| `build.py` | Concatenates the three above into `escensus-poster.html`. |
| `render.mjs` | Renders that to PDF, and prints per-section heights so you can see whether the content still fits the page. |
| `preview.mjs` | Writes `preview-small.png`. |

## Rebuild

```sh
cd posters
python3 build.py     # -> escensus-poster.html (single self-contained file)
node render.mjs      # -> escensus-poster-18x24.pdf
node preview.mjs     # -> preview-small.png
```

`render.mjs` uses the Chromium that ships with `playwright`. It prints a
height report; keep `contentH` at or under `posterH` (2304px) or the poster
will clip — the `.poster` element is `overflow:hidden` by design so an
overrun fails loudly instead of spilling onto a second page.

## Brand values (from the site)

```
bg #0A1626   surface #15263B   line #26384E
cream #EEF1F6 / #D2DAE5 / #9AA9BC
gold #C9A85E   gold-bright #D9B96E   steel #6E9AC9
good #9DB287   warn #CF9B45   stuck #D08A72

Spectral (serif headlines) · Inter (UI/body) · IBM Plex Mono (labels, data)
```

Figures and agent names on the poster are illustrative sample-report data,
matching the same disclaimer the site carries.
