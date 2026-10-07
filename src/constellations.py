"""Constellations: copies of one repeated question that ask the same thing with the same propositions.

Inside each repeated-question cluster (repeats.json), two versions are the same question when their stems agree
(same polarity, same subject) and their propositions pair up one to one: in any order, with small wording
differences (punctuation, "ATB" for "antibiotic", a dropped "Is the"), but never a difference that can flip the
meaning (not, without, acute/chronic, left/right, a number...). Their answer keys must agree too; when they don't,
the pair is reported as a conflict for Abi to look at instead of being grouped.

    python3 src/constellations.py      lists the constellations and any key conflicts
"""
import html
import re
import unicodedata

STOP = set('a an the of is are be to in on and or with for by its it this that as at from was were has have can its '
           'which what who following regarding concerning about during among statement statements proposition '
           'propositions true correct right exact answer answers check select choose'.split())
# words whose difference changes what a proposition says
FLIP = set('not no without never always only all none any never neither nor except false incorrect wrong inexact '
           'increase increased increases decrease decreased decreases high higher low lower elevated reduced normal '
           'abnormal left right upper lower acute chronic subacute bacterial viral fungal positive negative sudden '
           'progressive gradual dry productive wet unilateral bilateral rare frequent common uncommon often seldom '
           'major minor primary secondary early late before after above below less more most least first last '
           'typical atypical benign malignant severe mild absent present absence presence urgency emergency '
           'contraindicated indicated systematic systematically necessary unnecessary useful useless'.split())
# abbreviations and plain synonyms, so "BP" and "blood pressure" or "insidious" and "progressive" onset read the same
ABBR = {'atb': 'antibiotic', 'atbs': 'antibiotic', 'antibiotics': 'antibiotic', 'alrti': 'acute lower respiratory tract infection',
        'ild': 'interstitial lung disease', 'cap': 'community acquired pneumonia', 'cxr': 'chest x ray',
        'xray': 'x ray', 'tb': 'tuberculosis', 'bal': 'bronchoalveolar lavage', 'bp': 'blood pressure',
        'chf': 'congestive heart failure', 'pneumococcus': 'streptococcus pneumoniae', 'pneumococci': 'streptococcus pneumoniae',
        'insidious': 'progressive', 'gradual': 'progressive', 'aetiology': 'etiology'}
NEG = re.compile(r"\b(not|except|false|incorrect|wrong|inexact|untrue|inaccurate|mistakes?|avoid)\b", re.I)


def plain(h):
    t = html.unescape(re.sub(r'<[^>]+>', ' ', h))
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', t).strip()


def words(h):
    t = plain(h).lower()
    t = re.sub(r'\(([a-z0-9]{2,8})\)', ' ', t)          # "(ALRTI)" after the words it abbreviates
    t = re.sub(r'(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)', ' ', t)   # "80mmHg" -> "80 mmhg"
    out = []
    for w in re.findall(r'[a-z0-9]+', t):
        out += ABBR.get(w, w).split()
    return [w[:-1] if len(w) > 4 and w.endswith('s') and not w.endswith('ss') else w for w in out]


def key(h):
    return set(w for w in words(h) if w not in STOP)


def near(a, b):
    """Typos: "Hoemophilus" and "Haemophilus", "psittacci" and "psittaci". Never across hyper/hypo or a meaning word."""
    if a == b:
        return True
    if a in FLIP or b in FLIP or a.isdigit() or b.isdigit() or min(len(a), len(b)) < 5:
        return False
    if a[:4] != b[:4] and (a.startswith(('hyper', 'hypo')) or b.startswith(('hyper', 'hypo'))):
        return False
    if abs(len(a) - len(b)) > 2:
        return False
    limit = 1 if max(len(a), len(b)) < 9 else 2
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1]))
        prev = cur
    return prev[-1] <= limit


def overlap(ka, kb):
    """Words of ka found in kb, allowing typos; returns (shared, only in a, only in b)."""
    shared, rest_b = set(), set(kb)
    for w in sorted(ka):
        hit = w if w in rest_b else next((v for v in sorted(rest_b) if near(w, v)), None)
        if hit:
            shared.add(w)
            rest_b.discard(hit)
    return shared, ka - shared, rest_b


def compact(h):
    """The words that matter, run together: "anti-viral" and "antiviral" or "intra- parenchymal" read the same."""
    return ''.join(w for w in words(h) if w not in STOP)


def same_text(a, b, need=.8):
    if compact(a) and compact(a) == compact(b):
        return True
    ka, kb = key(a), key(b)
    if not ka or not kb:
        return plain(a).lower() == plain(b).lower()
    shared, only_a, only_b = overlap(ka, kb)
    diff = only_a | only_b
    if diff & FLIP or any(w.isdigit() for w in diff):
        return False
    return len(shared) / (len(shared) + len(only_a) + len(only_b)) >= need


def pair_options(x, y):
    """One-to-one pairing of x's options with y's, or None if they don't all pair up."""
    if len(x['options']) != len(y['options']):
        return None
    left = set(range(len(y['options'])))
    out = {}
    for i, ox in enumerate(x['options']):
        best = None
        for j in sorted(left):
            if same_text(ox, y['options'][j]):
                shared, oa, ob = overlap(key(ox), key(y['options'][j]))
                s = 1.0 if compact(ox) == compact(y['options'][j]) else len(shared) / max(1, len(shared) + len(oa) + len(ob))
                if best is None or s > best[0]:
                    best = (s, j)
        if best is None:
            return None
        out[i] = best[1]
        left.discard(best[1])
    return out


def same_stem(x, y, cases):
    sx = x['stem'] + ' ' + cases.get(x.get('case'), '')
    sy = y['stem'] + ' ' + cases.get(y.get('case'), '')
    if bool(NEG.search(plain(sx))) != bool(NEG.search(plain(sy))):
        return False
    return same_text(sx, sy, need=.5)


def find(bank, clusters):
    """Returns (constellations, conflicts). A constellation is a list of question ids, the lead first."""
    Q = {q['id']: q for q in bank['questions']}
    cases = {c['id']: c['html'] for c in bank.get('cases', [])}
    types = bank['types']
    src_rank = {s['id']: (types.index(s['type']) if s['type'] in types else 99, i) for i, s in enumerate(bank['sources'])}
    key_rank = {'official': 0, 'checked': 1, 'proposed': 1, 'claude': 2, 'none': 3}
    # a set added after the first build ("added": its date) never takes the lead from an older question: the lead is
    # the canonical id everyone's progress hangs on (clean tries, comets, class stats), so it must not move
    added = {s['id']: s.get('added', '') for s in bank['sources']}
    lead_order = lambda q: (1 if q.get('dupOf') else 0, 0 if q['answer'] else 1, added[q['source']],
                            key_rank.get(q.get('key') or 'none', 3), src_rank[q['source']], q['n'])
    out, conflicts = [], []
    for ids in clusters:
        qs = [Q[i] for i in ids]
        parent = {q['id']: q['id'] for q in qs}

        def root(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i
        for a in range(len(qs)):
            for b in range(a + 1, len(qs)):
                x, y = qs[a], qs[b]
                if not same_stem(x, y, cases):
                    continue
                m = pair_options(x, y)
                if m is None:
                    continue
                if x['answer'] and y['answer'] and any((i in x['answer']) != (j in y['answer']) for i, j in m.items()):
                    conflicts.append((x['id'], y['id'], m))
                    continue
                parent[root(x['id'])] = root(y['id'])
        groups = {}
        for q in qs:
            groups.setdefault(root(q['id']), []).append(q)
        for g in groups.values():
            if len(g) > 1:
                lead = min(g, key=lead_order)
                rest = sorted((q for q in g if q is not lead), key=lambda q: (src_rank[q['source']], q['n']))
                out.append([lead['id']] + [q['id'] for q in rest])
    return out, conflicts


if __name__ == '__main__':
    import json
    import os
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    bank = json.load(open('bank.json', encoding='utf8'))
    sid = {v: k for k, v in json.load(open('shortids.json', encoding='utf8')).items()}
    rep = json.load(open('repeats.json', encoding='utf8'))
    cst, bad = find(bank, [r['q'] for r in rep['repeats']])
    print(len(cst), 'constellations,', sum(len(c) for c in cst), 'questions in them;', len(bad), 'key conflicts')
    for x, y, m in bad:
        print('  conflict', sid[x], sid[y])
