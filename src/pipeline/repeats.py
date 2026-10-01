"""Find repeated questions: the same question asked again (reworded / options changed) in 2+ different sets.

Link two questions of the same module when they share a topic and
  * are exact copies, or
  * test the same facts (options overlap a lot), or
  * have nearly the same stem, or
  * have a similar stem AND the same aspect (signs / treatment / causes...)
Clusters = connected components; a cluster counts as "repeated" when it spans 2+ different sets.
"""
import json
import re
import sys
from collections import defaultdict, Counter

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

sys.path.insert(0, '.')
from concepts import norm  # noqa: E402

STOP = set('''a an the of in on at to for with and or is are be was were by as it its this that these those which what
who whom whose when where why how following statement statements correct true false exact accurate right answer answers
proposition propositions regarding concerning about among during case cases select choose check specify identify correspond
corresponding those following one ones can may often most usually typically commonly common main primary classic
is are (are) (s) s mention we cite following: following? include includes including based be being there their
patient patients mr mrs miss m year old man woman male female presents presenting consult consults consultation
will would should could do does did has have had not no any all none best more less very'''.split())


def toks(text):
    t = norm(text)
    out = []
    for w in re.findall(r"[a-z0-9][a-z0-9'+\-/]*", t):
        w = w.strip("'-/")
        if not w or w in STOP or len(w) < 2:
            continue
        if len(w) > 4 and w.endswith('ies'):
            w = w[:-3] + 'y'
        elif len(w) > 3 and w.endswith('s') and not w.endswith('ss'):
            w = w[:-1]
        out.append(w)
    return ' '.join(out)


def cos_matrix(docs):
    if not any(d.strip() for d in docs):
        return np.zeros((len(docs), len(docs)))
    v = TfidfVectorizer(token_pattern=r"[^ ]+", sublinear_tf=True, min_df=1)
    X = v.fit_transform(docs)
    return (X @ X.T).toarray()


def find(bank, tags):
    sets = {s['id']: s for s in bank['sources']}
    by_mod = defaultdict(list)
    for q in bank['questions']:
        by_mod[q['topic']].append(q)
    parent = {}

    def root(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = root(a), root(b)
        if ra != rb:
            parent[rb] = ra

    for q in bank['questions']:
        parent[q['id']] = q['id']
    links = []
    for mod, qs in by_mod.items():
        stems = [toks(q['stem']) for q in qs]
        opts = [toks(' '.join(q['options'])) for q in qs]
        full = [s + ' ' + o for s, o in zip(stems, opts)]
        S = cos_matrix(stems)
        O = cos_matrix(opts)
        exact = {}
        for i, q in enumerate(qs):
            key = (norm(q['stem']).strip(), tuple(sorted(norm(o).strip() for o in q['options'])))
            if key in exact:
                union(exact[key], q['id'])
                links.append((exact[key], q['id'], 'exact', 1, 1))
            else:
                exact[key] = q['id']
        n = len(qs)
        for i in range(n):
            ci = set(tags[qs[i]['id']]['c'])
            ai = tags[qs[i]['id']]['a']
            for j in range(i + 1, n):
                cj = set(tags[qs[j]['id']]['c'])
                if not (ci & cj):
                    continue
                aj = tags[qs[j]['id']]['a']
                s, o = S[i, j], O[i, j]
                why = None
                if o >= 0.62 and s >= 0.25:
                    why = 'same facts'
                elif s >= 0.88 and o >= 0.12:
                    why = 'same stem'
                elif s >= 0.6 and ai == aj and ai != 'G' and o >= 0.18:
                    why = 'reworded'
                elif s >= 0.5 and o >= 0.45:
                    why = 'similar'
                if why:
                    union(qs[i]['id'], qs[j]['id'])
                    links.append((qs[i]['id'], qs[j]['id'], why, round(float(s), 2), round(float(o), 2)))
    clusters = defaultdict(list)
    for q in bank['questions']:
        clusters[root(q['id'])].append(q['id'])
    return [v for v in clusters.values() if len(v) > 1], links


if __name__ == '__main__':
    bank = json.load(open('bank.json'))
    tags = json.load(open('tags.json'))
    clusters, links = find(bank, tags)
    Q = {q['id']: q for q in bank['questions']}
    sets = {s['id']: s for s in bank['sources']}
    rep = [c for c in clusters if len({Q[i]['source'] for i in c}) >= 2]
    print('clusters', len(clusters), '| spanning 2+ sets', len(rep), '| questions in repeated clusters', sum(len(c) for c in rep))
    print('size distribution', Counter(len(c) for c in rep))
    print('distinct-set counts', Counter(len({Q[i]['source'] for i in c}) for c in rep))
    json.dump({'clusters': clusters, 'links': links}, open('clusters_raw.json', 'w'))
