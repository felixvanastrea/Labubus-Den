"""Build the site: question bank + topic tags + repeated-question clusters, injected into template.html.

    python3 src/build.py          (from anywhere)

Writes
    index.html             the site GitHub Pages serves (a full HTML page, at the repo root next to img/)
    src/out/artifact.html  the same page without the <html>/<head>/<body> wrapper, for the claude.ai artifact
"""
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
os.chdir(HERE)                      # data files and modules sit next to this script
sys.path.insert(0, HERE)

from concepts import CONCEPTS, ASPECT_NAMES, tag  # noqa: E402
import constellations  # noqa: E402
from search_extra import SYN as EXTRA_SYN, ABBR as EXTRA_ABBR  # noqa: E402  (search-only aliases)

SITE_URL = 'https://felixvanastrea.github.io/Labubus-Den/'
TITLE = 'Labubu’s Den'
DESC = ('Past EFM3 exam questions (midterms, mocks, finals and second sessions), sorted by module and by exam, '
        'with answers, explanations and a topic search.')

bank = json.load(open('bank.json', encoding='utf8'))
shortids = json.load(open('shortids.json', encoding='utf8'))
Q = {q['id']: q for q in bank['questions']}
rev_sid = {v: k for k, v in shortids.items()}
for sid, qid in shortids.items():
    Q[qid]['sid'] = sid             # shown in mistake reports, so a report names the question

# Mistakes in the docs that Abi confirmed (corrections.json). Applied before tagging, so search and quests use
# the fixed text. "from" must still match the bank; "also" sets other fields. Nothing is shown about the fix.
LETTERS = 'ABCDE'
for f in json.load(open('corrections.json', encoding='utf8'))['fixes']:
    q, field = Q[shortids[f['q']]], f['field']
    if field == 'stem':
        old, put = q['stem'], lambda v: q.__setitem__('stem', v)
    elif field.startswith('option '):
        i = LETTERS.index(field[-1])
        old, put = q['options'][i], lambda v, i=i: q['options'].__setitem__(i, v)
    elif field == 'answer':
        old = ''.join(LETTERS[i] for i in q['answer'])
        put = lambda v: q.__setitem__('answer', [LETTERS.index(c) for c in v])
    else:
        raise ValueError(f"correction {f['q']}: unknown field {field!r}")
    assert old == f['from'], f"correction {f['q']} {field}: the bank says {old!r}, not {f['from']!r}"
    put(f['to'])
    q.update(f.get('also', {}))
    assert all(0 <= i < len(q['options']) for i in q['answer']), f"correction {f['q']}: answer outside the options"

# Answers checked against the lectures (checked.json): the "Checked against lecture" label, only when the key is
# still the one the check confirmed. The per-option evidence stays in the file for us; nothing else is shown.
# A Claude-suggested answer that was checked drops Claude's reasoning note, which argued for the old key.
for s, c in json.load(open('checked.json', encoding='utf8'))['questions'].items():
    q = Q[shortids[s]]
    if not c['label']:
        continue
    if ''.join(LETTERS[i] for i in q['answer']) != c['key']:
        print(f"checked.json {s}: the key is {''.join(LETTERS[i] for i in q['answer'])}, not {c['key']}: no label")
        continue
    if q.get('key') == 'claude':
        q['qNotes'] = [n for n in q.get('qNotes', []) if n.get('by') != 'claude']
    q['key'] = 'checked'

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
# constellations (constellations.py): copies of a repeated question with the same propositions and the same key.
# Only the quest groups them, as one question (the lead, listed first) whose copies can be done one by one.
cst, cst_conflicts = constellations.find(bank, [r['q'] for r in rep['repeats']])
for x, y, _ in cst_conflicts:
    print('  key conflict between copies, left ungrouped (show Abi):', rev_sid[x], rev_sid[y])
for i, ids in enumerate(cst):
    for qid in ids:
        Q[qid]['cst'] = i
bank['cst'] = cst

# explanations (explanations.json): why each proposition is right or wrong, from Abi's lecture summaries. An entry
# also covers its constellation's other stars and word-for-word copies, matched option by option.
ex = json.load(open('explanations.json', encoding='utf8'))
n_exp = 0
for sid, e in ex['questions'].items():
    q = Q[shortids[sid]]
    lines = [e.get(LETTERS[i]) for i in range(len(q['options']))]
    assert all(lines) and len([k for k in e if len(k) == 1]) == len(lines), f'explanations {sid}: one line per option'
    lec = ex['lectures'][e['lecture']]['title']
    targets = [q['id']] + [i for i in (cst[q['cst']] if 'cst' in q else []) if i != q['id']]
    targets += [d for d, keep in rep['dup'].items() if keep in targets and d not in targets]
    for t in targets:
        m = {i: i for i in range(len(lines))} if t == q['id'] else constellations.pair_options(q, Q[t])
        assert m, f'explanations {sid}: the options of {rev_sid[t]} do not pair up'
        if 'exp' in Q[t] and t != q['id']:
            continue   # that copy has an entry of its own
        o = [None] * len(Q[t]['options'])
        for i, j in m.items():
            o[j] = lines[i]
        Q[t]['exp'] = {'lec': lec, 'o': o}
        n_exp += 1
print('explanations:', len(ex['questions']), 'entries, on', n_exp, 'questions')
bank['concepts'] = [{'id': cid, 'm': mod, 'n': name,
                     's': list(dict.fromkeys(syn + EXTRA_SYN.get(cid, []))),
                     'ab': list(dict.fromkeys(abbr + EXTRA_ABBR.get(cid, []))), 'p': parent}
                    for cid, mod, name, syn, abbr, parent in CONCEPTS]
bank['aspects'] = ASPECT_NAMES

# lectures (lectures.json): each module split into its lectures, in course order, one weak-spot topic each (a lecture
# with under 3 past questions shares a topic with the closest one). A question goes to the topic of its first concept
# that a topic takes ("concept@T": only with that aspect), unless "q" moves it. Word-for-word copies and constellation
# stars go with their lead, so a topic holds every copy. Sizes count a question once with its copies.
LEC = json.load(open('lectures.json', encoding='utf8'))
LEC_MIN = 3
c_name = {c[0]: c[2] for c in CONCEPTS}


def canon(q):
    k = q.get('dupOf') or q['id']
    return cst[Q[k]['cst']][0] if 'cst' in Q[k] else k


assert set(LEC['modules']) == {t['id'] for t in bank['topics']}, 'lectures.json: one entry per module'
tid_mod = {d['id']: m for m, ds in LEC['modules'].items() for d in ds}
assert len(tid_mod) == sum(len(ds) for ds in LEC['modules'].values()), 'lectures.json: topic ids must be unique'
moved = {}
for sid, tid in LEC['q'].items():
    q = Q[shortids[sid]]
    assert tid_mod.get(tid) == q['topic'], f'lectures.json q: {sid} cannot go to {tid}'
    moved[canon(q)] = tid
diag = []
for t in bank['topics']:
    spec = LEC['modules'][t['id']]
    rules = []
    for d in spec:
        for r in d['take']:
            c, _, asp = r.partition('@')
            assert c in c_name, f"lectures.json {d['id']}: unknown concept {c}"
            rules.append((c, asp, d['id']))

    def by_rule(q):
        for c in q['c']:
            for rc, asp, tid in rules:
                if rc == c and asp and q['a'] in asp:
                    return tid
            for rc, asp, tid in rules:
                if rc == c and not asp:
                    return tid
        return None

    members = defaultdict(list)
    lost = []
    for q in bank['questions']:
        if q['topic'] != t['id']:
            continue
        k = canon(q)
        assert Q[k]['topic'] == q['topic'], f"{q['sid']}: its lead {Q[k]['sid']} is in another module"
        tid = moved.get(k) or by_rule(Q[k])
        if tid:
            members[tid].append(q['id'])
        else:
            lost.append(q['sid'])
    assert not lost, f"lectures.json: no topic takes {', '.join(lost)} ({t['id']}): add a rule or a 'q' entry"
    sizes = []
    for d in spec:
        ids = members.get(d['id'], [])
        n = len({canon(Q[i]) for i in ids})
        assert n, f"lectures.json {d['id']}: no question"
        sizes.append(f"{d['name'][:24]} {n}{' (small)' if n < LEC_MIN else ''}")
        e = {'id': d['id'], 'm': t['id'], 'n': d['name'], 'q': ids}
        if len(d['lectures']) > 1:
            e['l'] = list(dict.fromkeys(x['t'] for x in d['lectures']))
        diag.append(e)
    print(f"lectures {t['id'][:22]}: {len(spec)} topics |", ', '.join(sizes))
bank['diag'] = diag

# the current quest (quests.json): every question in its module tagged with one of each topic's concepts,
# plus hand-picked extras ("add") minus exclusions ("drop"), by short id. Word-for-word copies are left out, and
# a constellation counts once, as its lead. Within a topic, versions of the most repeated questions come first.
quests = json.load(open('quests.json', encoding='utf8'))
cur = next((x for x in quests['quests'] if x['id'] == quests.get('current')), None)
if cur:
    rank = lambda q: (Q[q['id']].get('rep', 10 ** 6), order[q['id']])
    # a set added on or after the quest's due date (the exam itself, typed up afterwards) isn't part of it
    after = {s['id'] for s in bank['sources'] if s.get('added', '') >= cur['due']}
    topics, seen, flat = [], set(), []
    for t in cur['topics']:
        want = set(t.get('concepts', []))
        add = {shortids[s] for s in t.get('add', [])}
        drop = {shortids[s] for s in t.get('drop', [])}
        picked = [q for q in bank['questions']
                  if q['topic'] == cur['module'] and not q.get('dupOf') and q['id'] not in drop and q['source'] not in after
                  and (want & set(q['c']) or q['id'] in add)]
        picked.sort(key=rank)
        ids = list(dict.fromkeys(cst[q['cst']][0] if 'cst' in q else q['id'] for q in picked))
        assert ids, f"quest topic {t['name']!r} has no questions"
        topics.append({'name': t['name'], 'q': ids})
        flat += [i for i in ids if i not in seen]
        seen.update(ids)
    bank['quest'] = {k: cur[k] for k in ('id', 'title', 'module', 'due', 'goal', 'note', 'end') if k in cur}
    bank['quest'].update(topics=topics, q=flat)
    print('quest', cur['id'], '|', len(flat), 'questions |',
          ', '.join(f"{t['name']} {len(t['q'])}" for t in topics),
          '| without a key:', sum(1 for i in flat if not Q[i]['answer']),
          '| constellations:', sum(1 for i in flat if 'cst' in Q[i]), f'(of {len(cst)} in the bank)')

# the spotlight (quests.json "spotlight"): a set just added, today's exam, on the homepage in the quest's place from
# "from" to "until" (inclusive), with its practice and its timed exam
spot = quests.get('spotlight')
if spot:
    s_ = next(s for s in bank['sources'] if s['id'] == spot['set'])
    n_ = sum(1 for q in bank['questions'] if q['source'] == spot['set'])
    assert n_, f"spotlight: the set {spot['set']} has no questions"
    bank['spotlight'] = dict(spot, module=s_['topic'], label=s_['label'], n=n_)
    print('spotlight', s_['label'], '|', n_, 'questions |', spot['from'], 'to', spot['until'])

# the update log (updates.json, newest first): what changed and when. An entry that brought questions names
# its exam sets ("sets": set ids, or "types": exam types) and/or single questions ("questions": short ids);
# the build stores the set ids, any single question ids, and the question count. "kind" relabels an entry
# without questions (the default label is "New on the site").
updates = json.load(open('updates.json', encoding='utf8'))
assert len({u['id'] for u in updates}) == len(updates), 'update ids must be unique'
assert [u['date'] for u in updates] == sorted((u['date'] for u in updates), reverse=True), 'updates must be newest first'
src_ids = {s['id'] for s in bank['sources']}
log = []
for u in updates:
    sets = list(u.get('sets', [])) + [s['id'] for s in bank['sources'] if s['type'] in u.get('types', [])]
    assert all(s in src_ids for s in sets), f"unknown exam set in update {u['id']}"
    single = [shortids[s] for s in u.get('questions', [])]
    n = sum(1 for q in bank['questions'] if q['source'] in set(sets)) + sum(1 for i in single if Q[i]['source'] not in set(sets))
    log.append({k: v for k, v in {'id': u['id'], 'date': u['date'], 'title': u['title'], 'kind': u.get('kind'),
                                  'items': u.get('items', []), 'sets': sets, 'q': single, 'n': n}.items()
                if v or k in ('n', 'items')})
bank['updates'] = log
print('update log:', len(log), 'entries |', ', '.join(f"{u['id']} +{u['n']}" for u in log if u['n']))

# the feedback form (feedback.json): its pre-filled link gives the form address and the ids of the two fields we
# fill, "What is it about?" (ticked with the mistake option) and "The question" (an x)
fb = json.load(open('feedback.json', encoding='utf8'))
if fb.get('prefilled'):
    from urllib.parse import urlsplit, parse_qsl
    u = urlsplit(fb['prefilled'].strip())
    entries = {k: v for k, v in parse_qsl(u.query) if k.startswith('entry.')}
    kind = [k for k, v in entries.items() if v.strip() == fb['kinds']['mistake']]
    asked = [k for k, v in entries.items() if v.strip().lower() == 'x']
    assert u.netloc == 'docs.google.com' and u.path.endswith('/viewform'), 'feedback: not a Google Form link'
    assert len(kind) == 1 and len(asked) == 1, f'feedback: expected the mistake option and an x in the link, got {entries}'
    bank['feedback'] = {'form': f'https://{u.netloc}{u.path}', 'kind': kind[0], 'question': asked[0], 'kinds': fb['kinds']}
print('feedback form:', bank['feedback']['form'] if bank.get('feedback') else 'none yet, buttons hidden')

payload = json.dumps(bank, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
tpl = open('template.html', encoding='utf8').read()
assert '__BANK_JSON__' in tpl and '/*__CSS__*/' in tpl
css = '\n'.join(open(os.path.join('css', f'{name}.css'), encoding='utf8').read() for name in ('base', 'gothic'))
# Labubu's head: a symbol for the logo in the top bar, and the tab icon next to index.html
art = open('labubu.svg', encoding='utf8').read()
art_box = re.search(r'viewBox="([^"]+)"', art).group(1)
art_d = {k: re.search(rf'<path id="{k}" d="([^"]+)"', art).group(1) for k in ('face', 'line')}
symbol = (f'<symbol id="labubu" viewBox="{art_box}"><path fill="currentColor" d="{art_d["face"]}"/>'
          f'<path style="fill: var(--lb-line, #1b1a18)" d="{art_d["line"]}"/></symbol>')
assert '<!--__LABUBU__-->' in tpl
page = (tpl.replace('/*__CSS__*/', '\n' + css).replace('<!--__LABUBU__-->', symbol)
        .replace('__BANK_JSON__', payload))
# the tab icon: the head in bone on a charcoal tile
favicon = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="142.5 146.6 698 698">'
           '<rect x="142.5" y="146.6" width="698" height="698" rx="150" fill="#1b1a18"/>'
           f'<path fill="#ece3d1" d="{art_d["face"]}"/><path fill="#1b1a18" d="{art_d["line"]}"/></svg>\n')
open(os.path.join(ROOT, 'favicon.svg'), 'w', encoding='utf8').write(favicon)

os.makedirs('out', exist_ok=True)
open(os.path.join('out', 'artifact.html'), 'w', encoding='utf8').write(page)

# the standalone page: the template's title, font links and styles go in <head>, everything else in <body>
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
<link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
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
