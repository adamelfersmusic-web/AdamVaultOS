#!/usr/bin/env python3
"""Assemble a poster into one self-contained HTML file.

    python3 build.py <name> [--theme <t>] [--bleed]

Output: <name>[-<theme>][-bleed].html
"""
import sys

argv  = sys.argv[1:]
name  = argv[0] if argv and not argv[0].startswith('-') else 'escensus-poster'
bleed = '--bleed' in argv or 'bleed' in argv[1:]
theme = None
if '--theme' in argv:
    theme = argv[argv.index('--theme') + 1]

titles = {
  'escensus-poster':   'Escensus &mdash; The First 90-Day Agent Ramp System',
  'signalcraft-poster':'SignalCraft &mdash; The Intelligence Layer',
}

# 0.125in bleed on all four sides. The page and the poster both grow by 0.25in
# and every padding grows by exactly 0.125in — so the content box is unchanged
# and the bleed build is the same layout, just with more background around it.
BLEED_CSS = """
@page{ size:18.25in 24.25in; margin:0; }
.poster{
  width:18.25in; height:24.25in;
  padding:0.905in 0.975in 0.725in;
}
"""

sheets = [open('_fonts.css').read(), open(f'{name}.css').read()]
if theme:
    sheets.append(open(f'theme-{theme}.css').read())   # after the base sheet
if bleed:
    sheets.append(BLEED_CSS)

stem = name + (f'-{theme}' if theme else '') + ('-bleed' if bleed else '')
open(f'{stem}.html', 'w').write(
"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{title}</title>
{styles}
</head>
<body>
{body}
</body>
</html>
""".format(
    title  = titles[name],
    styles = '\n'.join(f'<style>{s}</style>' for s in sheets),
    body   = open(f'{name}.body.html').read(),
))
print('built', f'{stem}.html')
