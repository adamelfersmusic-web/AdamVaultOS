# Posters — 18×24in, print-ready

Two projects, two treatments. Everything is 18×24, one page, full bleed.

## The minimal pair — gold field, black ink

The wall pieces. One idea at scale and almost nothing else. These are the ones
to hang.

| PDF | The idea |
| --- | --- |
| `signalcraft-minimal-18x24.pdf` | **Nobody else can run this loop.** The six stages in a single line beneath it, a closed ring bled off the corner. |
| `escensus-minimal-18x24.pdf` | **We find the one moment the sale breaks.** The eight beats in a single line with the banking ask marked in ember, and a *broken* ring answering SignalCraft's closed one. |

The two marks are the pair's whole argument: SignalCraft's ring closes,
Escensus's ring has a gap with the break marked. Same geometry, opposite
meaning. Hang them side by side and that reads before any of the type does.

## The dense pair — navy field

The full information posters. More reference sheet than wall piece — good above
a desk you actually work at.

| PDF | What it says | Built from |
| --- | --- | --- |
| `escensus-poster-18x24.pdf` | **Escensus** — the first 90-day agent ramp system. The customer-facing product: the beat map, the film room, the two reports. | [`escensus-site`](https://github.com/adamelfersmusic-web/escensus-site) `index.html` |
| `signalcraft-poster-18x24.pdf` | **SignalCraft** — the intelligence layer. The north star: the loop, the ownership model, the method, the sequence. | Parachute vault `adam`, `_priority/escensus/the-intelligence-layer` (canonical, locked 2026-08-02) + `vision/signalcraft-method-jazz-drumming-songcircles` |
| `signalcraft-poster-gold-18x24.pdf` | The same SignalCraft poster in the **gold-on-black** theme. Same content, same layout — palette only. | ditto |

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

Themed builds slot the theme name in the middle:
`signalcraft-poster-gold-18x24-bleed.pdf`.

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
| `<name>.css` | Layout and base palette. Edit design here. |
| `minimal.css` | Shared by both minimal posters (they're the same object with different words). `build.py` maps them to it via `SHARED_CSS`. |
| `theme-<t>.css` | Optional palette override, loaded *after* the base sheet. Changes color only — never layout. |
| `_fonts.css` | Spectral / Inter / IBM Plex Mono, latin subsets, base64-inlined so the build needs no network and the PDF embeds real fonts. Shared by both. |
| `build.py` | Concatenates the three into `<name>.html`. |
| `render.mjs` | Renders that to `<name>-18x24.pdf`, and prints per-section heights. |
| `preview.mjs` | Writes `<name>-preview.png`. |

## Rebuild

```sh
cd posters
python3 build.py  signalcraft-poster                     # -> signalcraft-poster.html
node render.mjs   signalcraft-poster                     # -> signalcraft-poster-18x24.pdf
node preview.mjs  signalcraft-poster                     # -> signalcraft-poster-preview.png

python3 build.py  signalcraft-poster --theme gold --bleed
node render.mjs   signalcraft-poster --theme gold --bleed
```

`--theme <t>` loads `theme-<t>.css`; `--bleed` switches to the 18.25 × 24.25
page. Both flags are optional and compose. Pass the same flags to `build.py`
and `render.mjs` — the first writes the HTML, the second reads it.

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

### theme-gold — gold on black

An override of the above, strictly warm: a warm-black field, gold primary,
**antique gold** where the base sheet uses steel (so the loop reads as a
progression that brightens toward the payoff rather than switching hue), and a
single ember `#C4735A` reserved for the one warning — the gate. The grid behind
the field goes gold too.

It overrides the palette tokens *and* every hardcoded navy in the base sheet
(the field gradients, the panel gradient, the baked hairlines, the fine print),
which is why it's a real theme and not just a `:root` swap. Layout is untouched
— both builds land at exactly 2304px.

### minimal.css — gold field, black ink

Its own sheet, not a theme, because it's a different object: a gold field with
near-black ink, one statement at 236px Spectral, and a mono rule of stages. The
statement is `white-space:nowrap` on purpose — a wrapped line would wreck the
composition silently, so instead it overflows and the height check catches it.
Escensus runs `.statement.tight` (198px) and `.seq.dense` because its lines are
longer; that's the only per-poster divergence.

The field is a soft gradient rather than a flat fill — large flat areas of gold
band on a cheap press, and a gradient gives the rasteriser something to work
with.

## Notes on content

- **Escensus poster:** figures and agent names are illustrative sample-report
  data, carrying the same disclaimer the live site does.
- **SignalCraft poster:** client and staff names are omitted; the examples use
  the placeholder names already anonymized in the vision site, and the sequence
  section says "the first instance" rather than naming the pilot agency. Safe to
  hang where someone else might see it.
