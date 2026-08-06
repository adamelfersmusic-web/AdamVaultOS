# Posters — 18×24in, print-ready

Two companion wall posters on one design system, meant to hang as a pair.

| PDF | What it says | Built from |
| --- | --- | --- |
| `escensus-poster-18x24.pdf` | **Escensus** — the first 90-day agent ramp system. The customer-facing product: the beat map, the film room, the two reports. | [`escensus-site`](https://github.com/adamelfersmusic-web/escensus-site) `index.html` |
| `signalcraft-poster-18x24.pdf` | **SignalCraft** — the intelligence layer. The north star: the loop, the ownership model, the method, the sequence. | Parachute vault `adam`, `_priority/escensus/the-intelligence-layer` (canonical, locked 2026-08-02) + `vision/signalcraft-method-jazz-drumming-songcircles` |

The SignalCraft one is the artifact the vault has an open task for —
`print-the-north-star-for-the-wall`. The 13-chapter vision site prints to 15+
pages and isn't hangable; this is the one-page version. It follows the north
star doc's own instruction for a cut-down: *"keep the loop and the ownership
model. Everything else is implementation."*

Each preview PNG is a low-res look, not for print.

## Printing

Four PDFs — a trim-exact and a bleed version of each. Send whichever the shop
asks for; if they don't say, send the bleed one.

| File | Page size | Use |
| --- | --- | --- |
| `<name>-18x24.pdf` | 18 × 24in exactly | Shops that trim to the page, and home/large-format printing. |
| `<name>-18x24-bleed.pdf` | 18.25 × 24.25in | Standard 0.125in bleed on all four sides. Trims down to 18 × 24. |

Both are 1 page, no margins, full-bleed dark field. The bleed version has an
identical content box — only the background grows — so the two are the same
poster, not two layouts.

**Specs for the order form:** 18 × 24in · portrait · color · full bleed ·
1 page · no crop marks (add them at the shop if they want them) · fonts
embedded · no spot colors.

**Stock:** ask for matte or satin. Uncoated goes chalky across this much solid
navy, and gloss will mirror every lamp in the room. If they offer it, a heavier
weight (100lb+ cover) hangs flat instead of rippling.

**Color:** these are built in RGB with a dark navy field. Any shop converting to
CMYK will shift the navy slightly and may render it a touch flatter than the
screen. That's normal and looks fine — but if you want it exact, ask for a
proof before the full run.

## Source

Each poster is three files plus a shared font bundle:

| File | What it is |
| --- | --- |
| `<name>.body.html` | Content and structure. Edit copy here. |
| `<name>.css` | Layout. Edit design here. |
| `_fonts.css` | Spectral / Inter / IBM Plex Mono, latin subsets, base64-inlined so the build needs no network and the PDF embeds real fonts. Shared by both. |
| `build.py` | Concatenates the three into `<name>.html`. |
| `render.mjs` | Renders that to `<name>-18x24.pdf`, and prints per-section heights. |
| `preview.mjs` | Writes `<name>-preview.png`. |

## Rebuild

```sh
cd posters
python3 build.py  signalcraft-poster   # or escensus-poster
node render.mjs   signalcraft-poster
node preview.mjs  signalcraft-poster
```

`render.mjs` uses the Chromium that ships with `playwright` and prints a height
report. Keep `contentH` at or under `posterH` (2304px) or the poster clips —
`.poster` is `overflow:hidden` on purpose so an overrun fails loudly instead of
spilling onto a second page. Both posters currently sit at exactly 2304.

## The design system

Lifted from `escensus-site/index.html` so the posters, the site, and the app all
read as one thing.

```
bg #0A1626   surface #15263B   line #26384E
cream #EEF1F6 / #D2DAE5 / #9AA9BC
gold #C9A85E   gold-bright #D9B96E   steel #6E9AC9
good #9DB287   warn #CF9B45   stuck #D08A72

Spectral (serif headlines) · Inter (UI/body) · IBM Plex Mono (labels, data)
```

Gold is the primary accent on both. On the SignalCraft poster steel carries the
loop and the sequence, so the two sheets read as siblings rather than duplicates.

## Notes on content

- **Escensus poster:** figures and agent names are illustrative sample-report
  data, carrying the same disclaimer the live site does.
- **SignalCraft poster:** client and staff names are omitted; the examples use
  the placeholder names already anonymized in the vision site, and the sequence
  section says "the first instance" rather than naming the pilot agency. Safe to
  hang where someone else might see it.
