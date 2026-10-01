"""Build the site: question bank + topic tags + repeated-question clusters, injected into template.html.

    python3 src/build.py          (from anywhere)

Writes
    index.html             the site GitHub Pages serves (a full HTML page, at the repo root next to img/)
    src/out/artifact.html  the same page without the <html>/<head>/<body> wrapper, for the claude.ai artifact
"""
import json
import os
import sys
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
os.chdir(HERE)                      # data files and modules sit next to this script
sys.path.insert(0, HERE)

from concepts import CONCEPTS, ASPECT_NAMES, tag  # noqa: E402
from search_extra import SYN as EXTRA_SYN, ABBR as EXTRA_ABBR  # noqa: E402  (search-only aliases)

SITE_URL = 'https://felixvanastrea.github.io/EFM3-MCQ-BANK/'
TITLE = 'EFM3 MCQ Bank'
DESC = ('Past EFM3 exam questions (midterms, mocks, finals and second sessions), sorted by module and by exam, '
        'with answers, explanations and a topic search.')

bank = json.load(open('bank.json', encoding='utf8'))
shortids = json.load(open('shortids.json', encoding='utf8'))
Q = {q['id']: q for q in bank['questions']}

# Follow-up questions in the dermatology professor set that say "this case" / "your diagnosis" without the case:
# show the vignette they follow as an open case box.
FOLLOW_UPS = {
    'S138': 'S137', 'S174': 'S173', 'S186': 'S185', 'S189': 'S187', 'S192': 'S191', 'S193': 'S191',
    'S199': 'S198', 'S207': 'S206', 'S209': 'S208', 'S211': 'S210', 'S224': 'S223', 'S226': 'S225',
    'S232': 'S231', 'S234': 'S233', 'S236': 'S235',
}
case_ids = {c['id'] for c in bank['cases']}
for f, v in FOLLOW_UPS.items():
    fq, vq = Q[shortids[f]], Q[shortids[v]]
    assert not fq.get('case') and fq['source'] == vq['source'], f
    cid = 'fu-' + vq['id']
    if cid not in case_ids:
        bank['cases'].append({'id': cid, 'html': vq['stem']})
        case_ids.add(cid)
    fq['case'] = cid
    fq['caseOpen'] = True

tags = tag(bank, shortids)
rep = json.load(open('repeats.json', encoding='utf8'))
order = {q['id']: i for i, q in enumerate(bank['questions'])}
cluster_of = {qid: i for i, r in enumerate(rep['repeats']) for qid in r['q']}
for q in bank['questions']:
    q.pop('_stem', None)
    q.pop('_pi', None)
    q['c'] = tags[q['id']]['c']
    q['a'] = tags[q['id']]['a']
# word-for-word copies (same stem, same options) inside one repeated question are practised once
for d, keep in rep['dup'].items():
    if cluster_of.get(d) == cluster_of.get(keep):
        Q[d]['dupOf'] = keep
# rank: number of different sets, then number of distinct versions
repeats = []
for r in rep['repeats']:
    repeats.append(dict(r, v=sum(1 for qid in r['q'] if not Q[qid].get('dupOf'))))
repeats.sort(key=lambda r: (-r['s'], -r['v'], order[r['q'][0]]))
for i, r in enumerate(repeats):
    for qid in r['q']:
        Q[qid]['rep'] = i
bank['repeats'] = repeats
bank['concepts'] = [{'id': cid, 'm': mod, 'n': name,
                     's': list(dict.fromkeys(syn + EXTRA_SYN.get(cid, []))),
                     'ab': list(dict.fromkeys(abbr + EXTRA_ABBR.get(cid, []))), 'p': parent}
                    for cid, mod, name, syn, abbr, parent in CONCEPTS]
bank['aspects'] = ASPECT_NAMES

payload = json.dumps(bank, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
tpl = open('template.html', encoding='utf8').read()
assert '__BANK_JSON__' in tpl and '/*__CSS__*/' in tpl
css = '\n'.join(open(os.path.join('css', f'{name}.css'), encoding='utf8').read() for name in ('base', 'gothic'))
page = tpl.replace('/*__CSS__*/', '\n' + css).replace('__BANK_JSON__', payload)

os.makedirs('out', exist_ok=True)
open(os.path.join('out', 'artifact.html'), 'w', encoding='utf8').write(page)

# the standalone page: the template's title, font links and styles go in <head>, everything else in <body>
FAVICON = 'data:image/svg+xml,' + quote(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#1b1a18'/>"
    "<path d='M32 9l4.2 18.8L55 32l-18.8 4.2L32 55l-4.2-18.8L9 32l18.8-4.2z' fill='#ece3d1'/></svg>", safe=":/'=")
cut = page.index('</style>') + len('</style>')
head, body = page[:cut], page[cut:]
doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{DESC}">
<meta name="theme-color" content="#1b1a18">
<meta property="og:type" content="website">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESC}">
<meta property="og:url" content="{SITE_URL}">
<meta property="og:image" content="{SITE_URL}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{FAVICON}">
<link rel="apple-touch-icon" href="icon-180.png">
{head}
</head>
<body>{body}
</body>
</html>
'''
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf8').write(doc)
print('questions', len(bank['questions']), '| repeated clusters', len(repeats),
      '| dups', sum(1 for q in bank['questions'] if q.get('dupOf')), '| index.html bytes', len(doc.encode()))
