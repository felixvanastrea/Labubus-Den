# Writes the EFM2 S3 questions into src/sem/efm2-s3: bank.json (no answers: Abi, 25 November 2026), shortids.json,
# repeats.json, concepts.json (the S3 tag dictionary) and lectures.json "take" rules + "q" overrides.
import json, re, hashlib, html, sys
from collections import defaultdict, Counter
sys.path.insert(0, '/home/claude/work/s3')
from s3concepts import C
from tagger import tag, LECT
from overrides import O

D = '/home/claude/efm3-mcq-bank/src/sem/efm2-s3/'
S = json.load(open('/home/claude/work/s3/final_sets.json'))
S += json.load(open('/home/claude/efm3-mcq-bank/src/pipeline/s3/extra_sets.json'))   # sets added later, straight from a doc
bank = json.load(open(D + 'bank.json'))
LEC = json.load(open(D + 'lectures.json'))

TYPE = {'finals': 'Finals', 'mock': 'Mock', 'midterm': 'Midterms', 'retake': 'Second session', 'quiz': 'Collected'}
PFX = {'anatomy-3': 'A', 'physiology-2': 'P', 'semiology-1': 'S', 'clinical-biochemistry': 'B', 'vital-first-aid': 'V', 'art-history-medicine': 'H'}
FIG = {('Finals · Anatomy 4 (head and neck)', 10): ('efm2-s3-orbit-sphenoid', 477, 186),
       ('Finals · Anatomy 4 (head and neck)', 12): ('efm2-s3-cornea-layers', 478, 146),
       ('Finals · Anatomy 4 (head and neck)', 15): ('efm2-s3-visual-path-1', 595, 315),
       ('Mock · Anatomy (neuroanatomy)', 23): ('efm2-s3-visual-path-2', 428, 251),
       ('Mock · Anatomy (neuroanatomy)', 24): ('efm2-s3-optic-canal', 635, 337)}

def h(*a):
    return hashlib.sha1('|'.join(map(str, a)).encode()).hexdigest()[:10]

def slugify(t):
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')

def esc(t):
    return html.escape(t.strip(), quote=False)

def clean_case(t):
    t = re.sub(r'^\s*(clinical\s+)?case\s*(for|\(|:)?\s*(questions?|q)\s*[\d\s,–\-to&and]+\)?\s*[:.\-–]?\s*', '', t, flags=re.I)
    return t.strip()

sources, cases, questions, short = [], [], [], {}
nxt = Counter()
aside = []
import os
ANS = json.load(open(D + 'answers.json')) if os.path.exists(D + 'answers.json') else {}
lec_by_mod = {m: [d['id'] for d in ds] for m, ds in LEC['modules'].items()}
moves = {}
for s in S:
    sid_src = 's3-' + slugify(s['mod'] + '-' + s['label'])
    src = {'id': sid_src, 'topic': s['mod'], 'type': TYPE[s['type']], 'year': (s['year'] or '').replace('-', '–'),
           'label': s['label'], 'added': '2026-11-25'}
    sources.append(src)
    case_ids = {}
    n = 0
    for q in s['qs']:
        if q.get('aside'):
            aside.append(dict(q, set=s['label'])); continue
        n += 1
        qid = h(s['label'], q['n'], q['s'])
        e = {'id': qid, 'n': n, 'topic': s['mod'], 'source': sid_src, 'stem': esc(q['s']),
             'options': [esc(o) for o in q['o']], 'answer': [], 'key': 'none'}
        if q.get('case'):
            ct = clean_case(q['case'])
            if ct not in case_ids:
                case_ids[ct] = sid_src + '-c' + str(len(case_ids) + 1)
                cases.append({'id': case_ids[ct], 'html': esc(ct).replace('\n', '<br>')})
            e['case'] = case_ids[ct]
        if (s['label'], q['n']) in FIG:
            f, w, hh = FIG[(s['label'], q['n'])]
            e['stemImgs'] = [{'src': f'img/{f}.webp', 'w': w, 'h': hh}]
        tg = tag(q, s['mod'])
        e['c'] = tg
        p = PFX[s['mod']]
        nxt[p] += 1
        sid = f'{p}{nxt[p]}'
        short[sid] = qid
        want = O.get((s['label'], q['n']))
        first = LECT[tg[0]] if tg else None
        if want and want != first:
            moves[sid] = want
        elif not tg:
            print('untagged:', sid, s['label'], q['n'], q['s'][:70])
        if sid in ANS:   # answered from the lecture Abi sent (answers.json), never from the docs' own marks
            e['answer'] = ['ABCDE'.index(c) for c in ANS[sid]['key']]
            e['key'] = 'claude'
            e['qNotes'] = [{'by': 'claude', 'anchor': None, 'html': '<p>Answered from the lecture slides; the exam docs’ own marks were not used.</p>'
                            if ANS[sid].get('by') == 'lecture' else
                            '<p>Claude’s answer, not yet checked against the lecture slides; the exam docs’ own marks were not used.</p>'}]
        questions.append(e)
assert len({q['id'] for q in questions}) == len(questions), 'id clash'
assert all(v in lec_by_mod[Q['topic']] for k, v in moves.items() for Q in questions if Q['id'] == short[k])

# repeated questions: same module, near-identical stem and mostly the same propositions
def words(t):
    return set(re.findall(r'[a-z0-9]+', t.lower()))
def ow(q):
    return [frozenset(words(o)) for o in q['options']]
def osim(a, b):
    A, B = ow(a), ow(b)
    hit = sum(1 for x in A if any(len(x & y) / max(1, len(x | y)) >= .75 for y in B))
    return hit / max(len(A), len(B), 1)
def ssim(a, b):
    x, y = words(a['stem']), words(b['stem'])
    return len(x & y) / max(1, len(x | y))
MEANING = set('not except only central peripheral cns pns acute chronic left right anterior posterior superior inferior medial lateral increase increased decrease decreased high low upper lower internal external afferent efferent sympathetic parasympathetic true false correct incorrect wrong motor sensory first second third primary secondary type male female adult child infant before after'.split())
parent = {q['id']: q['id'] for q in questions}
def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]; x = parent[x]
    return x
by_mod = defaultdict(list)
for q in questions:
    by_mod[q['topic']].append(q)
for m, qs in by_mod.items():
    for i, a in enumerate(qs):
        for b in qs[i + 1:]:
            if a['source'] == b['source'] or a.get('case') or b.get('case'):
                continue
            dw = words(a['stem']) ^ words(b['stem'])
            if dw & MEANING or any(w.isdigit() or w.startswith(('hyper', 'hypo')) for w in dw):
                continue   # a meaning word differs (central / peripheral, only, not...): another question
            st = ssim(a, b)
            if st >= .5 and osim(a, b) >= .6 or st >= .85 and osim(a, b) >= .4:
                parent[find(a['id'])] = find(b['id'])
groups = defaultdict(list)
order = {q['id']: i for i, q in enumerate(questions)}
for q in questions:
    groups[find(q['id'])].append(q['id'])
Qi = {q['id']: q for q in questions}
reps, dup = [], {}
norm = lambda t: ' '.join(re.findall(r'[a-z0-9]+', t.lower()))
for g in groups.values():
    if len(g) < 2:
        continue
    g.sort(key=order.get)
    nsets = len({Qi[x]['source'] for x in g})
    if nsets < 2:
        continue
    reps.append({'q': g, 's': nsets, 'v': len(g)})
    seen = {}
    for x in g:
        k = norm(Qi[x]['stem']) + '||' + '|'.join(sorted(norm(o) for o in Qi[x]['options']))
        if k in seen:
            dup[x] = seen[k]
        else:
            seen[k] = x
print('repeated questions:', len(reps), 'clusters covering', sum(len(r['q']) for r in reps), '| word-for-word copies', len(dup))

# lecture rules: each concept goes to its lecture
take = defaultdict(list)
for c in C:
    take[c[6]].append(c[0])
mods = LEC['modules']
if not any(d['id'] == 'BC-00' for d in mods['clinical-biochemistry']):
    mods['clinical-biochemistry'].insert(0, {'id': 'BC-00', 'name': 'Pre-analytical phase', 'p': 'General',
                                             'lectures': [{'t': 'Pre-analytical phase'}], 'take': []})
for m, ds in mods.items():
    for d in ds:
        d['take'] = take.get(d['id'], [])
LEC['q'] = moves
LEC['note'] = LEC['note'].split(' Questions are placed')[0] + (
    ' Questions are placed by their first tag (concepts.json, S3 only); "q" moves the few the tags would misplace, '
    'read one by one (25 November 2026). BC-00, the pre-analytical phase, has questions in every biochemistry exam '
    'but is not on the sheet: ask Abi where it belongs.')

GENERIC = r'\b(hormones?|markers?|semiology|balance|anatomy|physiology|exploration of( an?)?|general|disorders?|syndromes?)\b'
def syns(c):
    out = list(c[3])
    for x in (c[2].lower(), re.sub(r'\s+', ' ', re.sub(GENERIC, '', c[2].lower())).strip(' ,')):
        if len(x) > 3 and x not in [s.lower() for s in out]:
            out.append(x)   # the name, and its core word: "thyroid" finds Thyroid hormones too
    return out
concepts = [{'id': c[0], 'm': c[1], 'n': c[2], 's': syns(c), 'ab': c[4], 'rx': c[5]} for c in C]
# a word that is a topic's whole name somewhere ("pituitary") also finds the topics that have it as a first word
# ("pituitary gland" under Diencephalon), so one search gathers every module's questions on it
ONE = {s.lower() for c in concepts for s in c['s'] if ' ' not in s}
for c in concepts:
    low = [s.lower() for s in c['s']]
    for s in list(c['s']):
        w = s.lower().split()[0]
        if ' ' in s and w in ONE and w not in low and c['n'].lower().startswith(w):   # only a topic named by that word
            c['s'].append(w); low.append(w)
bank['sources'] = sources
bank['cases'] = cases
bank['questions'] = questions
json.dump(bank, open(D + 'bank.json', 'w'), ensure_ascii=False, indent=1)
json.dump(short, open(D + 'shortids.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'repeats': reps, 'dup': dup}, open(D + 'repeats.json', 'w'), ensure_ascii=False, indent=1)
json.dump(concepts, open(D + 'concepts.json', 'w'), ensure_ascii=False, indent=1)
json.dump(LEC, open(D + 'lectures.json', 'w'), ensure_ascii=False, indent=1)
json.dump(aside, open('/home/claude/work/s3/aside_s2_s4.json', 'w'), ensure_ascii=False, indent=1)
print('questions', len(questions), Counter(q['topic'] for q in questions), '| sources', len(sources), '| cases', len(cases), '| moves', len(moves), '| aside', len(aside))
