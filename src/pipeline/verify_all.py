"""Independent re-read with python-docx: for each question, look at the paragraphs from its stem up to the
next question's stem, find each option's line by text, and read that line's shading directly."""
import docx, json, re, html
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from collections import Counter

d = docx.Document('efm3_all.docx')
body = list(d.element.body.iterchildren())
B = json.load(open('bank.json'))
S = {s['id']: s for s in B['sources']}
KIND = {'d9d2e9': 'official', 'd9ead3': 'proposed', 'fce5cd': 'official'}

def norm(s):
    return re.sub(r'[^a-z0-9]+', '', html.unescape(re.sub(r'<[^>]+>', '', s)).lower())

def lines_of(el):
    if el.tag != qn('w:p'):
        return []
    p = Paragraph(el, d)
    out = [[]]
    for r in p.runs:
        rPr = r._r.rPr
        shd = rPr.find(qn('w:shd')) if rPr is not None else None
        fill = shd.get(qn('w:fill')) if shd is not None else None
        for k, part in enumerate(r.text.split('\n')):
            if k:
                out.append([])
            if part:
                out[-1].append((part, fill))
    return out

def line_fill(segs, text_norm_len_skip=0):
    tot = Counter(); n = 0
    txt = ''.join(t for t, _ in segs)
    m = re.match(r'^\s*(?:[a-hA-H]|i{1,3}|iv|v|vi{0,3})\s*[.)]\s*', txt)
    skip = m.end() if m else 0
    pos = 0
    for t, f in segs:
        seg = t[max(0, skip - pos):]; pos += len(t)
        c = len(seg.strip())
        if not c: continue
        n += c
        if f and f != 'ffffff': tot[f] += c
    if not n or not tot: return None
    f, c = tot.most_common(1)[0]
    return f if c / n >= 0.5 else None

qs = [q for q in B['questions']]
starts = sorted(q['_pi'] for q in qs)
bad = 0; checked = 0; skipped = Counter()
for q in qs:
    if q['key'] == 'claude' or q.get('twinOf'):
        skipped[q['key'] if q['key'] == 'claude' else 'twin'] += 1
        continue
    p0 = q['_pi']
    later = [s for s in starts if s > p0]
    p1 = later[0] if later else len(body)
    # compound sub-questions share one paragraph: search just that paragraph
    if p1 == p0:
        p1 = p0 + 1
    L = []
    for i in range(p0, min(p1 if p1 > p0 else p0 + 1, len(body))):
        L.extend(lines_of(body[i]))
    if p1 == p0 + 0: pass
    got = []
    ok_found = True
    for i, o in enumerate(q['options']):
        on = norm(o)
        def body_norm(segs):
            txt = ''.join(t for t, _ in segs)
            m = re.match(r'^\s*(?:[a-hA-H]|i{1,3}|iv|v|vi{0,3})\s*[.)]\s*', txt)
            return norm(txt[m.end():] if m else txt), norm(txt)
        exact = [segs for segs in L if on and on in body_norm(segs)]
        cand = exact or [segs for segs in L if on and body_norm(segs)[1].endswith(on)]
        if not cand:
            ok_found = False
            break
        f = line_fill(cand[0])
        if f in KIND:
            got.append((i, KIND[f]))
    if not ok_found:
        skipped['option not found'] += 1
        print('NOT FOUND', S[q['source']]['label'][:30], '|', q['_stem'][:60], '|', q['options'][i][:60])
        continue
    checked += 1
    ans = sorted(i for i, _ in got)
    if ans != q['answer']:
        # midterm orange answers were relabelled but must still equal the doc's highlight
        bad += 1
        print('DIFF', S[q['source']]['label'][:30], '|', q['_stem'][:60], '| bank', q['answer'], 'docx', ans)
print('checked', checked, 'mismatches', bad, 'skipped', dict(skipped))
