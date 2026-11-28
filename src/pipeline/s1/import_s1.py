# Writes the EFM1 S1 questions into src/sem/efm1-s1: bank.json, shortids.json, repeats.json, concepts.json (one tag per
# lecture, S1 only), lectures.json "take" rules, answers.json. Source: Abi's ~300 Year 1 photos in Drive (25 November 2026),
# typed up by hand into raw/*.txt (French ones translated, Abi's order), grouped by parse_raw.py into sets.json.
# The circles, ticks and highlights in the photos are never used (Abi: "don't trust them"): every key is Claude's,
# from knowledge (knowledge/<set>.txt, "N KEY" lines), not yet checked against the S1 lectures.
import json, re, hashlib, html, os, sys
from collections import defaultdict, Counter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from place import place
D = os.path.join(HERE, '../../sem/efm1-s1/')
S = json.load(open(os.path.join(HERE, 'sets.json')))
bank = json.load(open(D + 'bank.json'))
LEC = json.load(open(D + 'lectures.json'))

SETS = {   # key: (module, type, year, label)
 'anat-2022': ('anatomy-1', 'Second session', '', 'Second session I · Anatomy I'),
 'anat-2023': ('anatomy-1', 'Second session', '', 'Second session II · Anatomy I'),
 'anat-mock': ('anatomy-1', 'Mock', '', 'Mock · Anatomy I'),
 'anat-fmc': ('anatomy-1', 'Mock', '', 'French-track mock · Anatomy I (translated)'),
 'anat-review': ('anatomy-1', 'Collected', '', 'Collected · Bones of the limbs'),
 'chem-mock': ('chemistry-biochemistry', 'Mock', '', 'Mock · Chemistry and biochemistry'),
 'chem-2024': ('chemistry-biochemistry', 'Mock', '', 'Older mock · Chemistry and biochemistry'),
 'chem-fr': ('chemistry-biochemistry', 'Mock', '', 'French-track mock · Chemistry and biochemistry (translated)'),
 'chem-fr-exam': ('chemistry-biochemistry', 'Collected', '', 'French-track exam · Organic chemistry (translated)'),
 'chem-en': ('chemistry-biochemistry', 'Collected', '', 'Exam (partial) · Chemistry'),
 'sbio-fr': ('chemistry-biochemistry', 'Collected', '', 'French-track exam · Structural biochemistry (translated)'),
 'sbio-en': ('chemistry-biochemistry', 'Collected', '', 'Collected · Structural biochemistry MCQs'),
 'bg-mock': ('biology-genetics', 'Mock', '', 'Mock · Biology and genetics'),
 'cell-2023': ('biology-genetics', 'Second session', '', 'Second session · Cellular biology'),
 'ph-mock': ('biostatistics-public-health', 'Mock', '', 'Mock · Public health and biostatistics'),
 'ph-fr': ('biostatistics-public-health', 'Mock', '', 'French-track mock · Public health and biostatistics (translated)'),
 'biophys-mock': ('biophysics', 'Mock', '', 'Mock · Biophysics'),
 'bio-review': ('biophysics', 'Collected', '', 'Class review · Biophysics'),
 'lm-mock': ('learning-methods-terminology', 'Mock', '', 'Mock · Learning methods and terminology'),
 # 28 November 2026: the MCQ files in Abi's "S1 lectures" folder (Abi: "add them"); always after the photo sets, so short ids stay
 'cell-2021': ('biology-genetics', 'Exam', '', 'Exam · Cellular biology and genetics', '2026-11-28'),
 'cell-cc1': ('biology-genetics', 'Test', '', 'Test 1 · Cellular biology and cell methods', '2026-11-28'),
 'mb-rev': ('biology-genetics', 'Collected', '', 'Global revision · Molecular biology', '2026-11-28'),
 'by-auto': ('biophysics', 'Test', '', 'Self-test · Radioactivity and dosimetry (Pr Çaoui)', '2026-11-28'),
 'sbio-tut': ('chemistry-biochemistry', 'Tutorial', '', 'Tutorial MCQs · Structural biochemistry (Pr Lahlou)', '2026-11-28'),
 'mbio-tut': ('chemistry-biochemistry', 'Tutorial', '', 'Tutorial MCQs · Metabolic biochemistry (Pr Lahlou)', '2026-11-28'),
}
ORDER = list(SETS)
PFX = {'anatomy-1': 'A', 'chemistry-biochemistry': 'C', 'biology-genetics': 'G', 'biostatistics-public-health': 'P',
       'biophysics': 'Y', 'learning-methods-terminology': 'L'}
DROP = {('ph-mock', 5), ('chem-fr-exam', 12)}   # an option cut off; the figure carries someone's marks
FIG = {   # (set, n): image, w, h
 ('ph-mock', 15): ('gbd-burkina', 900, 289), ('ph-mock', 19): ('exam-grades', 880, 640),
 ('ph-mock', 24): ('bmi-quartiles', 900, 323), ('ph-fr', 5): ('exam-grades', 880, 640), ('ph-fr', 6): ('bmi-quartiles', 900, 323),
 ('chem-en', 13): ('molecule-1', 620, 330), ('chem-en', 14): ('molecule-1', 620, 330), ('chem-en', 15): ('molecule-2', 490, 320),
 ('chem-fr', 1): ('fr-molecule-1', 240, 150), ('chem-fr', 8): ('fr-molecule-3', 260, 155), ('chem-fr', 9): ('fr-molecules-3-4', 540, 175),
 ('chem-fr', 10): ('fr-molecule-2', 310, 210), ('chem-fr', 11): ('fr-molecule-2', 310, 210),
 ('chem-fr-exam', 13): ('c5-isomers', 520, 57), ('chem-fr-exam', 16): ('fischer-butanediol', 340, 145),
}
STEM = {   # stems that pointed at a figure, written so they read on their own
 ('ph-mock', 15): 'The figure shows the causes of death in Burkina Faso (Global Burden of Disease, both sexes, all ages). Which is true about the comparison of health systems between Morocco and Burkina Faso in terms of conditions leading to deaths?',
 ('ph-mock', 19): 'The lower histogram (density versus exam grades) allows you to:',
 ('ph-mock', 24): 'From this graph (histogram of BMI, from 18 to 30 kg/m², with its quartiles and interquartile range), we can conclude that:',
 ('ph-fr', 1): 'To compare the exam grades of two groups (female and male students), the appropriate test would be:',
 ('ph-fr', 2): 'In a box plot of weight (kg), the points located outside the whiskers represent:',
 ('ph-fr', 5): 'The histogram (density of exam grades, with a theoretical curve drawn over it) allows you to:',
 ('ph-fr', 6): 'From this graph (histogram of BMI with its quartiles and interquartile range), we can conclude that:',
 ('ph-fr', 8): 'Pearson\'s correlation test (between height and weight) assumes that:',
 ('chem-en', 13): 'We consider molecule 1 (figure). Molecule 1:',
 ('chem-en', 15): 'We consider molecule 2 (figure). Molecule 2:',
 ('chem-fr', 1): 'Molecule 1 (figure):', ('chem-fr', 8): 'The number of stereoisomers of molecule 3 (figure) is:',
 ('chem-fr', 9): 'Molecules 3 and 4 (figure):', ('chem-fr', 10): 'The name of molecule 2 (figure) according to the IUPAC rule is:',
 ('chem-fr', 11): 'Molecule 2 (figure):',
 ('chem-fr-exam', 13): 'Among the propositions below about the following molecules (figure), which are correct?',
 ('chem-fr-exam', 16): 'Among the following propositions about the Fischer projections I and II (figure), tick the correct answers:',
 ('sbio-fr', 20): 'Simple lipids (continued). What does the following formula represent? CH3–(CH2)7–CH=CH–(CH2)7–CO–O– esterified on the middle carbon of glycerol, whose two end carbons are CH2–OH.',
}

def h(*a):
    return hashlib.sha1('|'.join(map(str, a)).encode()).hexdigest()[:10]
def slugify(t):
    return re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')
def esc(t):
    return html.escape(t.strip(), quote=False)

ANS = {}
for k in ORDER:
    f = os.path.join(HERE, 'knowledge', k + '.txt')
    for line in open(f):
        p = line.split()
        if p:
            ANS[(k, int(p[0]))] = p[1]

# answers checked against Abi's S1 lecture slides (25 November 2026): slides/<module>.txt, "@ id | title" lectures,
# then "SID KEY lecture" and one " Yes:/No: why" line per option. They replace the knowledge key.
SL, SLEC = {}, {}
for f in sorted(os.listdir(os.path.join(HERE, 'slides'))):
    cur = None
    for line in open(os.path.join(HERE, 'slides', f)):
        if line.startswith('#') or not line.strip():
            continue
        if line.startswith('@ '):
            k, t = line[2:].split('|', 1)
            SLEC[k.strip()] = t.strip()
        elif line.startswith(' '):
            cur[2].append(line.strip())
        else:
            sid_, key_, lec_ = line.split()
            assert lec_ in SLEC, line
            cur = SL[sid_] = (key_, lec_, [])

sources, questions, short, answers = [], [], {}, {}
nxt = Counter()
CHANGED = []
EXP = {'lectures': {k: {'title': t, 'added': '2026-11-25'} for k, t in SLEC.items()}, 'questions': {}}
lec_of = {}
for k in ORDER:
    mod, typ, year, label = SETS[k][:4]
    sid_src = 's1-' + slugify(mod + '-' + label)
    sources.append({'id': sid_src, 'topic': mod, 'type': typ, 'year': year, 'label': label, 'added': SETS[k][4] if len(SETS[k]) > 4 else '2026-11-25'})
    n = 0
    for q in S[k]:
        if (k, q['ord']) in DROP:
            continue
        n += 1
        stem = STEM.get((k, q['ord']), re.sub(r'\s*\[[^\]]*\]\s*', ' ', q['s']).strip())
        qid = h('s1', k, q['ord'], q['s'])   # by set key, so a relabel keeps saved answers
        e = {'id': qid, 'n': n, 'topic': mod, 'source': sid_src, 'stem': esc(stem),
             'options': [esc(o) for o in q['o']], 'answer': [], 'key': 'none'}
        if (k, q['ord']) in FIG:
            f, w, hh = FIG[(k, q['ord'])]
            e['stemImgs'] = [{'src': f'img/efm1-s1-{f}.webp', 'w': w, 'h': hh}]
        lec = place(k, q['ord'], q['s'])
        e['c'] = [lec]
        p = PFX[mod]
        nxt[p] += 1
        sid = f'{p}{nxt[p]}'
        short[sid] = qid
        key = ANS[(k, q['ord'])]
        note = 'Claude’s answer.'
        by = {'key': key, 'by': 'knowledge', 'set': k, 'n': q['ord']}
        if sid in SL:
            key, lec_, why = SL[sid]
            assert len(why) == len(q['o']), (sid, len(why), len(q['o']))
            assert all(w.startswith(('Yes', 'No')) for w in why), sid
            assert [i for i, w in enumerate(why) if w.startswith('Yes')] == ['ABCDE'.index(c) for c in key], sid
            if key != by['key']:
                CHANGED.append((sid, by['key'], key))
            note = 'Answered by Claude from the lecture slides (' + SLEC[lec_] + ').'
            by = {'key': key, 'by': 'lecture', 'lecture': lec_, 'set': k, 'n': q['ord']}
            EXP['questions'][sid] = dict({'lecture': lec_}, **{'ABCDE'[i]: w for i, w in enumerate(why)})
        e['answer'] = ['ABCDE'.index(c) for c in key]
        e['key'] = 'claude'
        e['qNotes'] = [{'by': 'claude', 'anchor': None, 'html': '<p>' + note + '</p>'}]
        answers[sid] = by
        questions.append(e)
assert len({q['id'] for q in questions}) == len(questions), 'id clash'

# repeated questions (as in S3): same module, near-identical stem and mostly the same propositions, no meaning word apart
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
MEANING = set('not except only acute chronic left right anterior posterior superior inferior medial lateral proximal distal increase increased decrease decreased high low upper lower internal external primary secondary tertiary first second third biological behavioural behavioral modifiable systematic random molar molal mass btps stpd'.split())
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
            if a['source'] == b['source']:
                continue
            dw = words(a['stem']) ^ words(b['stem'])
            if dw & MEANING or any(w.isdigit() for w in dw):
                continue
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
        kk = norm(Qi[x]['stem']) + '||' + '|'.join(sorted(norm(o) for o in Qi[x]['options']))
        if kk in seen:
            dup[x] = seen[kk]
        else:
            seen[kk] = x
print('repeated questions:', len(reps), 'clusters covering', sum(len(r['q']) for r in reps), '| word-for-word copies', len(dup))

# topics not on Abi's list, for questions her exams ask (flagged to her)
EXTRA = {'learning-methods-terminology': [{'id': 'LM-09', 'name': 'Medical terminology', 'p': 'Terminology'},
                                          {'id': 'LM-10', 'name': 'Clinical basics: vital signs, fever, nutrition, history taking', 'p': 'Terminology'}],
         'biophysics': [{'id': 'BY-20', 'name': 'Hearing'}]}
mods = LEC['modules']
for m, extra in EXTRA.items():
    for d in extra:
        if not any(x['id'] == d['id'] for x in mods[m]):
            mods[m].append(dict(d, lectures=[{'t': d['name']}], take=[]))
for m, ds in mods.items():
    for d in ds:
        d['take'] = [d['id']]
LEC['q'] = {}
LEC['note'] = LEC['note'].split(' Questions are placed')[0] + (
    ' Questions are placed by their tag, which is their lecture (concepts.json, S1 only: one tag per lecture), '
    'read one by one (25 November 2026). LM-09, LM-10 and BY-20 are not on Abi\'s list: her exams ask about them.')

# one tag per lecture, so search finds a lecture's questions by its name
STOP = set('and the of a an to in its their for with from on by introducing introduction basic concepts'.split())
concepts = []
for m, ds in mods.items():
    for d in ds:
        nm = d['name']
        parts = [x.strip() for x in re.split(r'[:,;()]| and ', nm.lower()) if len(x.strip()) > 3 and x.strip() not in STOP]
        concepts.append({'id': d['id'], 'm': m, 'n': nm, 's': list(dict.fromkeys([nm.lower()] + parts)), 'ab': [], 'rx': ''})
bank['sources'] = sources
bank['cases'] = []
bank['questions'] = questions
json.dump(bank, open(D + 'bank.json', 'w'), ensure_ascii=False, indent=1)
json.dump(short, open(D + 'shortids.json', 'w'), ensure_ascii=False, indent=1)
json.dump({'repeats': reps, 'dup': dup}, open(D + 'repeats.json', 'w'), ensure_ascii=False, indent=1)
json.dump(concepts, open(D + 'concepts.json', 'w'), ensure_ascii=False, indent=1)
json.dump(LEC, open(D + 'lectures.json', 'w'), ensure_ascii=False, indent=1)
json.dump(answers, open(D + 'answers.json', 'w'), ensure_ascii=False, indent=1)
json.dump(EXP, open(D + 'explanations.json', 'w'), ensure_ascii=False, indent=1)
missing = set(SL) - set(EXP['questions'])
assert not missing, missing
print('from the slides:', len(EXP['questions']), '| keys changed from the knowledge answer:', CHANGED)
print('questions', len(questions), Counter(q['topic'] for q in questions), '| sources', len(sources))
print('per lecture', sorted(Counter(q['c'][0] for q in questions).items()))
