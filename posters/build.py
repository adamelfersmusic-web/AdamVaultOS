body = open('escensus-poster.body.html').read()
css  = open('escensus-poster.css').read()
fonts= open('_fonts.css').read()
open('escensus-poster.html','w').write(
f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Escensus &mdash; The First 90-Day Agent Ramp System</title>
<style>{fonts}</style>
<style>{css}</style>
</head>
<body>
{body}
</body>
</html>
""")
