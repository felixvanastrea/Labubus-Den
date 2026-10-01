"""Final repeated-question clusters = automatic links (repeats.py) + manual review edits.

DETACH: drop every automatic link touching these questions (wrongly merged).
JOIN:   groups found by hand (reworded versions the similarity pass missed).
A cluster is "repeated" when its questions come from 2+ different sets.
Writes repeats.json: {repeats: [{q: [qids], s: n_sets, v: n_versions}], dup: {qid: representative_qid}}
"""
import json
import re
from collections import defaultdict

from concepts import norm

DETACH = '''
R4 R252 R59 R263 R19 R177 R188 R231 R153
D83 D148
S10 S68 S183 S215
C77 C312
E108
'''.split()

JOIN = '''
R4 R252 | R59 R263 R19 | R11 R175 | R5 R158 | R184 R160 | R17 R163 | R113 R164 | R62 R223 R116 R117
R7 R118 R213 | R16 R119 | R80 R200 | R12 R128 R10 R178 | R13 R131 R181 | R143 R214 R259 | R180 R254
R139 R189 | R124 R174 R246 R270 | R66 R106 | R41 R75 | R72 R99 | R74 R98 | R76 R101 | R70 R105 | R48 R73
R71 R111 | R36 R68 | R29 R65
D20 D53 | D8 D128 D164 | D2 D116 D215 | D1 D118 | D12 D114 D171 D88 | D58 D132 | D111 D170
D61 D131 D161 | D11 D129 | D49 D64 | D75 D157 D27 | D89 D134 D220 | D17 D218 D84 | D76 D222 | D22 D121
S14 S58 | S15 S101 S158 S164 | S75 S131 S162 S109 S151 S153 | S8 S66 S136 | S26 S95 | S51 S107 S108
S88 S16 | S119 S6 | S65 S133 | S47 S105 | S78 S110 S225 | S12 S77 | S49 S80 S207 S211 | S36 S112
S2 S98 | S27 S93 | S83 S212 | S86 S215 | S69 S128 | S18 S67 | S68 S183
C3 C53 C118 | C31 C211 | C33 C210 C255 C275 | C34 C227 C236 C289 | C46 C362 | C92 C188 | C2 C60 C198
C61 C192 | C193 C202 | C95 C199 | C1 C94 C200 C248 C54 | C5 C55 C116 | C82 C141 | C29 C161 | C56 C25
C21 C302 | C296 C48 | C16 C182 C218 C313 | C24 C307 | C164 C305 | C172 C7 | C317 C57 | C22 C187
C105 C42 | C9 C119 | C10 C121 | C78 C124 | C204 C120 | C79 C130 | C80 C131 | C243 C214
E35 E166 | E54 E137 | E30 E65 | E56 E151 | E5 E63 | E19 E62 | E28 E55 | E10 E74 | E15 E72 | E87 E94 E93
E60 E95 | E41 E51 | E25 E174 | E90 E108 | E27 E70 E79 | E23 E172 E168 | E80 E111 | E8 E83 E135
E3 E58 E76 E77 E98 E99 | E18 E100 | E6 E115 E175 | E47 E84 E136 | E45 E64 E130 | E20 E132 | E7 E152
E21 E145 E163 E167 | E39 E43 E59
'''
JOIN = [g.split() for line in JOIN.strip().splitlines() for g in line.split('|') if g.strip()]

KEY_RANK = {'official': 0, 'proposed': 1, 'claude': 2}


def dup_key(q):
    def clean(t):
        t = norm(re.sub(r'<[^>]+>', ' ', t))
        return re.sub(r'[^a-z0-9]+', '', t)
    return (clean(q['stem']), tuple(sorted(clean(o) for o in q['options'])))


def build(bank):
    idx = json.load(open('shortids.json'))
    raw = json.load(open('clusters_raw.json'))
    Q = {q['id']: q for q in bank['questions']}
    order = {q['id']: i for i, q in enumerate(bank['questions'])}
    parent = {i: i for i in Q}

    def root(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = root(a), root(b)
        if ra != rb:
            parent[rb] = ra

    detached = {idx[k] for k in DETACH}
    for a, b, *_ in raw['links']:
        if a in detached or b in detached:
            continue
        union(a, b)
    for g in JOIN:
        ids = [idx[k] for k in g]
        assert len({Q[i]['topic'] for i in ids}) == 1, g
        for other in ids[1:]:
            union(ids[0], other)

    groups = defaultdict(list)
    for i in Q:
        groups[root(i)].append(i)
    types = bank['types']
    repeats = []
    for members in groups.values():
        sets = {Q[i]['source'] for i in members}
        if len(sets) < 2:
            continue
        members.sort(key=lambda i: order[i])
        repeats.append({'q': members, 's': len(sets), 'v': len(members)})
    repeats.sort(key=lambda r: (-r['s'], -r['v'], order[r['q'][0]]))

    # exact duplicates (same stem + same options, any order): keep one representative for "repeated only" practice
    by_key = defaultdict(list)
    for q in bank['questions']:
        by_key[dup_key(q)].append(q['id'])
    dup = {}
    for ids in by_key.values():
        if len(ids) < 2:
            continue
        rep = min(ids, key=lambda i: (KEY_RANK.get(Q[i]['key'], 3), order[i]))
        for i in ids:
            if i != rep:
                dup[i] = rep
    return repeats, dup


if __name__ == '__main__':
    bank = json.load(open('bank.json'))
    repeats, dup = build(bank)
    json.dump({'repeats': repeats, 'dup': dup}, open('repeats.json', 'w'))
    from collections import Counter
    print('repeated clusters', len(repeats), '| questions', sum(r['v'] for r in repeats),
          '| exact duplicates', len(dup))
    print('by distinct sets', sorted(Counter(r['s'] for r in repeats).items()))
    Q = {q['id']: q for q in bank['questions']}
    print('by module', Counter(Q[r['q'][0]]['topic'] for r in repeats))
