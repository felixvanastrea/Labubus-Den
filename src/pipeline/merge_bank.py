"""Build the final bank from the All-MCQs doc (master) + the midterm doc (comments, old ids).

* midterm questions keep their old ids (so saved progress survives) and gain the comment explanations
* orange ("Chica") answers from the midterm doc are labelled Official, as the user asked
* unkeyed questions: copy the answer from an identical keyed question elsewhere in the doc ("twin"),
  otherwise use Claude's suggestion from suggestions.json (key 'claude')
"""
import html
import json
import re
import sys
from collections import Counter, defaultdict

NEW = json.load(open('all.json'))
OLD_TOPICS = json.load(open('midterms.json'))
OLD = [q for t in OLD_TOPICS for q in t['questions']]
SUGG = json.load(open('suggestions.json')) if len(sys.argv) < 2 else json.load(open(sys.argv[1]))

TYPE_ORDER = ['Midterms', 'Mock', 'Finals', 'Second session', 'Collected']
log = []


def norm(s):
    s = html.unescape(re.sub(r'<[^>]+>', '', s or ''))
    return re.sub(r'[^a-z0-9]+', '', s.lower())


sets = {s['id']: s for s in NEW['sets']}
questions = NEW['questions']

# ---- 0. stable, unique ids (set id + text); midterm matches get their old ids below
import hashlib
seen_ids = Counter()
for q in questions:
    base = hashlib.sha1((q['source'] + '|' + q['_stem'] + '|' + '|'.join(q['options'])).encode()).hexdigest()[:10]
    seen_ids[base] += 1
    q['id'] = base if seen_ids[base] == 1 else '%s-%d' % (base, seen_ids[base])

# ---- 1. match midterm-doc questions to the new doc's Midterm sets
by_stem = defaultdict(list)
for q in questions:
    if sets[q['source']]['type'] == 'Midterms':
        by_stem[norm(q['_stem'])].append(q)

matched, unmatched = 0, []
agree = Counter()
for o in OLD:
    cands = by_stem.get(norm(re.sub(r'<[^>]+>', '', o['stem'])), [])
    hit, perm = None, None
    for c in cands:
        if [norm(x) for x in c['options']] == [norm(x) for x in o['options']]:
            hit, perm = c, list(range(len(o['options'])))
            break
    if not hit:
        for c in cands:
            if sorted(norm(x) for x in c['options']) == sorted(norm(x) for x in o['options']):
                hit = c
                perm = [[norm(x) for x in c['options']].index(norm(ox)) for ox in o['options']]
                break
    if not hit:
        unmatched.append(o)
        continue
    matched += 1
    new_ans_from_old = sorted(perm[i] for i in o['answer'])
    # keys
    if o['key'] == 'chica':
        if hit['answer'] != new_ans_from_old:
            log.append('ANSWER DIFFERS (orange vs new doc) "%s": old %s new %s' % (o['stem'][:60], new_ans_from_old, hit['answer']))
        agree['chica->official same' if hit['answer'] == new_ans_from_old else 'chica->official DIFF'] += 1
        hit['answer'], hit['key'] = new_ans_from_old, 'official'
    elif o['key'] and hit['key']:
        same = hit['answer'] == new_ans_from_old
        agree['%s/%s %s' % (o['key'], hit['key'], 'same' if same else 'DIFF')] += 1
        if not same:
            log.append('ANSWER DIFFERS %s vs %s "%s": old %s new %s' % (o['key'], hit['key'], o['stem'][:60], new_ans_from_old, hit['answer']))
    elif not o['key'] and hit['key']:
        agree['old unkeyed -> new %s' % hit['key']] += 1
        hit['_old_unkeyed_id'] = o['id']
    # keep old id + comments
    hit['id'] = o['id']
    if o.get('optNotes'):
        hit['optNotes'] = {str(perm[int(i)]): v for i, v in o['optNotes'].items()}
    if o.get('qNotes'):
        hit['qNotes'] = o['qNotes']
    if o.get('flag') and not hit.get('flag'):
        hit['flag'] = o['flag']
print('midterm questions matched', matched, 'of', len(OLD), '| unmatched', len(unmatched))
for u in unmatched:
    print('   UNMATCHED:', u['stem'][:80])
print('key agreement', dict(agree))

# ---- 2. twins for unkeyed questions
keyed_index = defaultdict(list)
for q in questions:
    if q['key']:
        keyed_index[(norm(q['_stem']), tuple(sorted(norm(x) for x in q['options'])))].append(q)
twins = 0
for q in questions:
    if q['key']:
        continue
    k = (norm(q['_stem']), tuple(sorted(norm(x) for x in q['options'])))
    if keyed_index.get(k):
        t = keyed_index[k][0]
        qn = [norm(x) for x in q['options']]
        q['answer'] = sorted(qn.index(norm(t['options'][i])) for i in t['answer'])
        q['key'] = t['key']
        q['twinOf'] = sets[t['source']]['label']
        twins += 1
print('unkeyed filled from identical keyed twins:', twins)

# ---- 3. Claude suggestions for the rest
applied, missing = 0, []
for q in questions:
    if q['key']:
        continue
    s_ = SUGG.get(q['id'])
    if s_:
        q['answer'], q['key'] = sorted(s_['answer']), 'claude'
        q.setdefault('qNotes', []).append({'by': 'claude', 'anchor': None, 'html': '<p>' + html.escape(s_['why']) + '</p>'})
        applied += 1
    else:
        missing.append(q)
print('claude suggestions applied', applied, '| still unkeyed', len(missing))
json.dump([dict(id=q['id'], set=sets[q['source']]['label'], stem=q['_stem'], options=q['options']) for q in missing],
          open('unkeyed.json', 'w'), ensure_ascii=False, indent=1)

# ---- 4. write bank
topic_order = [t['id'] for t in NEW['topics']]
sources = []
for s in NEW['sets']:
    sources.append(dict(id=s['id'], topic=s['topic'], type=s['type'], year=s['year'], label=s['label']))
for q in questions:
    q.pop('_old_unkeyed_id', None)
bank = dict(types=[t for t in TYPE_ORDER if any(s['type'] == t for s in sources)],
            topics=NEW['topics'], sources=sources, cases=NEW['cases'], questions=questions)
json.dump(bank, open('bank.json', 'w'), ensure_ascii=False)
ids = Counter(q['id'] for q in questions)
dups = [i for i, c in ids.items() if c > 1]
print('duplicate ids', len(dups))
print('final keys', dict(Counter(q['key'] for q in questions)))
for line in log:
    print('LOG:', line)
