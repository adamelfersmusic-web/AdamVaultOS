import sys
name = sys.argv[1] if len(sys.argv) > 1 else 'escensus-poster'
titles = {
  'escensus-poster':   'Escensus &mdash; The First 90-Day Agent Ramp System',
  'signalcraft-poster':'SignalCraft &mdash; The Intelligence Layer',
}
body  = open(f'{name}.body.html').read()
css   = open(f'{name}.css').read()
fonts = open('_fonts.css').read()
open(f'{name}.html','w').write(
f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{titles[name]}</title>
<style>{fonts}</style>
<style>{css}</style>
</head>
<body>
{body}
</body>
</html>
""")
print('built', name)
