"""Make a test copy of the page with local fonts (sandboxes often can't reach Google Fonts).

    python3 src/build.py && python3 src/tests/mk_test.py
    cd src/tests && npm install && python3 -m http.server 8765    # then, in another shell:
    node src/tests/search_repeats.js     (and the other *.js files; screenshots land in src/tests/shots/)
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
page = open(os.path.join(HERE, '..', 'out', 'artifact.html'), encoding='utf8').read()
F = 'node_modules/@fontsource'
faces = []
for st in ('normal', 'italic'):
    faces.append(f"@font-face{{font-family:'Instrument Serif';font-style:{st};font-weight:400;src:url({F}/instrument-serif/files/instrument-serif-latin-400-{st}.woff2) format('woff2')}}")
for w in (400, 500, 600):
    for st in ('normal', 'italic'):
        faces.append(f"@font-face{{font-family:'EB Garamond';font-style:{st};font-weight:{w};src:url({F}/eb-garamond/files/eb-garamond-latin-{w}-{st}.woff2) format('woff2')}}")
    faces.append(f"@font-face{{font-family:'IBM Plex Mono';font-style:normal;font-weight:{w};src:url({F}/ibm-plex-mono/files/ibm-plex-mono-latin-{w}-normal.woff2) format('woff2')}}")
# the themes' faces (Blood moon: Grenze Gotisch, Crimson Pro; Codex: IM Fell English, UnifrakturMaguntia)
for w in (400, 500, 600, 700):
    faces.append(f"@font-face{{font-family:'Grenze Gotisch';font-style:normal;font-weight:{w};src:url({F}/grenze-gotisch/files/grenze-gotisch-latin-{w}-normal.woff2) format('woff2')}}")
for w in (400, 500, 600):
    for st in ('normal', 'italic'):
        faces.append(f"@font-face{{font-family:'Crimson Pro';font-style:{st};font-weight:{w};src:url({F}/crimson-pro/files/crimson-pro-latin-{w}-{st}.woff2) format('woff2')}}")
for st in ('normal', 'italic'):
    faces.append(f"@font-face{{font-family:'IM Fell English';font-style:{st};font-weight:400;src:url({F}/im-fell-english/files/im-fell-english-latin-400-{st}.woff2) format('woff2')}}")
faces.append(f"@font-face{{font-family:'UnifrakturMaguntia';font-style:normal;font-weight:400;src:url({F}/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2) format('woff2')}}")
head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>'
        + ''.join(faces) + '</style></head><body>')
open(os.path.join(HERE, 'index.html'), 'w', encoding='utf8').write(head + page + '</body></html>')
link = os.path.join(HERE, 'img')
if not os.path.exists(link):
    os.symlink(os.path.join('..', '..', 'img'), link)
print('test page written to', os.path.join(HERE, 'index.html'))
