import sys
name  = sys.argv[1] if len(sys.argv) > 1 else 'escensus-poster'
bleed = len(sys.argv) > 2 and sys.argv[2] == 'bleed'

titles = {
  'escensus-poster':   'Escensus &mdash; The First 90-Day Agent Ramp System',
  'signalcraft-poster':'SignalCraft &mdash; The Intelligence Layer',
}

# 0.125in bleed on all four sides. The page and the poster both grow by 0.25in,
# and every padding grows by exactly 0.125in — so the content box is unchanged
# and the layout is identical to the trim version, just with more background
# around it for the cutter to eat.
BLEED_CSS = """
@page{ size:18.25in 24.25in; margin:0; }
.poster{
  width:18.25in; height:24.25in;
  padding:0.905in 0.975in 0.725in;
}
"""

body  = open(f'{name}.body.html').read()
css   = open(f'{name}.css').read()
fonts = open('_fonts.css').read()
out   = f'{name}-bleed.html' if bleed else f'{name}.html'
extra = f'<style>{BLEED_CSS}</style>' if bleed else ''

open(out,'w').write(
f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{titles[name]}</title>
<style>{fonts}</style>
<style>{css}</style>
{extra}
</head>
<body>
{body}
</body>
</html>
""")
print('built', out)
