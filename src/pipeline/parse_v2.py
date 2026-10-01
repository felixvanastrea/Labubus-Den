"""Line-based parser for the EFM3 'All MCQs' doc, which mixes several question formats:

  * inline:  one list paragraph "Stem?<br>a. opt<br>b. opt ..." (Finals / collected sets)
  * list:    decimal list stem + lettered list options (Mock / professor sets)
  * heading: Heading1 stem + lettered list options (Midterm sets)
  * manual:  bold "14. Stem" paragraph + "a. opt" paragraphs

Structure: Title paragraph = module (topic); plain header line such as
"Finals Dermatology 2025-2026" = exam set; "Notes:" = explanation block.
Answer key = shading on option text (purple d9d2e9 official, green d9ead3 proposed,
orange fce5cd treated as official at the user's request).
"""
import hashlib
import html
import json
import os
import re
import sys
from collections import Counter

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parse_docx import Doc, para_info, runs_html, clean_inline, NS, q, slug  # noqa: E402

FILL_KIND = {'d9d2e9': 'official', 'd9ead3': 'proposed', 'fce5cd': 'official'}
FLAG_FILLS = {'ea9999', 'f4cccc'}
HEADER_RE = re.compile(r'^(finals?|mock|midterms?|second session|questions collected|collected questions|'
                       r'practice questions|in-class|past questions|mcq training|spec[ei]fic .*collected questions)\b', re.I)
ROMAN = re.compile(r'^\s*(?:i|ii|iii|iv|v|vi|vii|viii)\s*[.)]\s*(?=\S)', re.I)
CASE_PREFIX = re.compile(r'^\s*(case|vignette|clinical case)\s*:|^\s*[•·]\s*', re.I)
MANUAL_Q = re.compile(r'^\s*(\d{1,3})\s*[.)-]\s*(?=\S)')
MANUAL_OPT = re.compile(r'^\s*([a-hA-H])\s*[.)]\s*(?=\S)')
NOTES_RE = re.compile(r'^\s*notes?\s*:', re.I)
TYPE_ORDER = ['Midterms', 'Mock', 'Finals', 'Second session', 'Collected']

log = []


def parse_header(text, topic_name):
    t = re.sub(r'\s+', ' ', text).strip()
    m = re.search(r'(20\d\d)\s*[-–]\s*(20\d\d)', t)
    year = '%s–%s' % (m.group(1), m.group(2)) if m else None
    low = t.lower()
    if low.startswith('final'):
        typ = 'Finals'
    elif low.startswith('mock'):
        typ = 'Mock'
    elif low.startswith('midterm'):
        typ = 'Midterms'
    elif low.startswith('second session'):
        typ = 'Second session'
    else:
        typ = 'Collected'
    # subtopic = header minus the type words, the year and the module name
    rest = re.sub(r'(20\d\d)\s*[-–]\s*(20\d\d)', '', t)
    rest = re.sub(r'^(finals?|mock|midterms?|second session)\s*', '', rest, flags=re.I).strip()
    if typ == 'Collected':
        if re.match(r'questions collected from the professor', rest, re.I):
            sub = re.sub(r'questions collected from the professor\s*', '', rest, flags=re.I).strip()
            label = "Professor's questions" + (' · ' + sub if sub and sub.lower() not in topic_name.lower() else '')
        elif re.match(r'practice questions', rest, re.I):
            m2 = re.match(r'practice questions\s*(.*?)\s*of\s*(dr\.?\s*\S+)', rest, re.I)
            label = ('Practice · %s (%s)' % (m2.group(1), m2.group(2).replace('Dr.', 'Dr. ').replace('  ', ' '))) if m2 else rest
        elif re.match(r'in-class', rest, re.I):
            m2 = re.search(r'from\s+(.+)$', rest, re.I)
            label = 'In-class questions' + (' (%s)' % m2.group(1) if m2 else '')
        elif re.match(r'past questions', rest, re.I):
            label = 'Past questions'
        elif re.match(r'mcq training', rest, re.I):
            m2 = re.search(r'(\d+)\s*-\s*(\d+)\s*$', rest)
            label = 'MCQ training' + (' %s–%s' % (m2.group(1), m2.group(2)) if m2 else '')
        elif re.match(r'spec[ei]fic', rest, re.I):
            m2 = re.match(r'spec[ei]fic\s+(.*?)\s+collected questions', rest, re.I)
            sub = m2.group(1).strip() if m2 else ''
            label = "Professor's questions" + (' · ' + sub[:1].upper() + sub[1:].lower() if sub else '')
        else:
            label = 'Collected questions'
    else:
        sub = rest
        generic = {topic_name.lower(), topic_name.lower().rstrip('s')}
        name = {'Midterms': 'Midterm', 'Finals': 'Finals', 'Mock': 'Mock', 'Second session': 'Second session'}[typ]
        label = name + (' ' + year if year else '')
        if sub and sub.lower() not in generic and sub.lower().rstrip('s') not in generic:
            label += ' · ' + sub
    return dict(type=typ, year=year, label=label, header=t)


def split_lines(p):
    lines = [[]]
    for r in p['runs']:
        parts = r['text'].split('\n')
        for k, part in enumerate(parts):
            if k:
                lines.append([])
            if part:
                lines[-1].append(dict(r, text=part))
    return lines


def mostly_bold(runs):
    tot = sum(len(r['text'].strip()) for r in runs)
    b = sum(len(r['text'].strip()) for r in runs if r['bold'])
    return tot > 0 and b / tot >= 0.6


def fill_of(runs, skip_prefix=0):
    """majority shading over the visible characters (after an optional manual letter prefix)"""
    chars = Counter()
    total = 0
    pos = 0
    for r in runs:
        t = r['text']
        start = max(0, skip_prefix - pos)
        pos += len(t)
        seg = t[start:]
        n = len(seg.strip())
        if not n:
            continue
        total += n
        if r['fill']:
            chars[r['fill']] += n
    if not total or not chars:
        return None, 0.0
    f, n = chars.most_common(1)[0]
    return f, n / total


def strip_prefix_runs(runs, n):
    out, pos = [], 0
    for r in runs:
        t = r['text']
        if pos + len(t) <= n:
            pos += len(t)
            continue
        cut = max(0, n - pos)
        out.append(dict(r, text=t[cut:]))
        pos += len(t)
    if out:
        out[0]['text'] = out[0]['text'].lstrip()
    return out


def build_lines(d):
    body = d.doc.getroot().find('w:body', NS)
    L = []
    for pi, el in enumerate(body):
        if el.tag != q('p'):
            continue
        p = para_info(d, el)
        parts = split_lines(p)
        for li, runs in enumerate(parts):
            text = ''.join(r['text'] for r in runs)
            L.append(dict(pi=pi, li=li, runs=runs, text=text.strip(),
                          style=p['style'] if li == 0 else None,
                          fmt=p['fmt'] if li == 0 else None,
                          imgs=p['imgs'] if li == len(parts) - 1 else [],
                          bold=mostly_bold(runs)))
    for x in L:
        t = x['text']
        k = None
        if x['style'] == 'Title':
            k = 'title'
        elif not t:
            k = 'empty'
        elif t.startswith('[') and 'answers' in t.lower():
            k = 'legend'
        elif NOTES_RE.match(t):
            k = 'notes'
        elif HEADER_RE.match(t) and not x['bold'] and not x['fmt'] and len(t) < 120:
            k = 'header'
        elif x['style'] == 'Heading1' or (x['fmt'] == 'decimal' and x['li'] == 0) or (MANUAL_Q.match(t) and x['bold']):
            k = 'stem?'
        elif ROMAN.match(t) and not x['fmt']:
            k = 'roman'
        elif (x['fmt'] in ('lowerLetter', 'upperLetter') and x['li'] == 0) or MANUAL_OPT.match(t):
            k = 'opt?'
        else:
            k = 'text'
        x['kind'] = k
    # compound cases: "case / a. sub-question / i. ii. iii. options"
    for i, x in enumerate(L):
        if x['kind'] == 'opt?':
            j = i + 1
            while j < len(L) and L[j]['kind'] == 'empty':
                j += 1
            if j < len(L) and L[j]['kind'] == 'roman':
                x['kind'] = 'substem'
                for b in range(i - 1, max(-1, i - 12), -1):
                    if L[b]['kind'] == 'stem?' and L[b]['pi'] == x['pi']:
                        L[b]['kind'] = 'case'
                        break
    return L


def valid_stem(L, i):
    """a stem candidate must be followed (after at most 2 continuation lines) by >= 2 options"""
    j, cont, opts = i + 1, 0, 0
    while j < len(L):
        k = L[j]['kind']
        if k == 'empty':
            j += 1
            continue
        if k == 'opt?':
            opts += 1
            j += 1
            continue
        if opts:
            break
        if k == 'text' and cont < 2:
            cont += 1
            j += 1
            continue
        break
    return opts >= 2



def next_nonempty(L, i):
    j = i + 1
    while j < len(L) and L[j]['kind'] == 'empty':
        j += 1
    return j


def leads_to_stem(L, i):
    """after line i (skipping empties and further case-like text), does a real question start?"""
    j = next_nonempty(L, i)
    hops = 0
    while j < len(L) and hops < 8:
        k = L[j]['kind']
        if k in ('stem?',) and valid_stem(L, j):
            return True
        if k in ('case', 'substem'):
            return True
        if k in ('text', 'stem?') and L[j]['bold']:
            j = next_nonempty(L, j)
            hops += 1
            continue
        return False
    return False

def parse(docx_dir, source_prefix):
    d = Doc(docx_dir)
    L = build_lines(d)
    topics, topic, cur_set, cur, mode = [], None, None, None, None
    cases = []            # [{'id', 'html'}]
    case_id, case_fresh, chapter = None, False, None
    case_compound = False
    DEPENDENT = re.compile(r"\b(most likely diagnosis|this (patient|case|woman|man|child|nodule)|the patient|her|his|she|he|"
                           r"expected evolution|best treatment|treatment approach|first (laboratory|lab|test|investigation|exam)|"
                           r"next step|initial (test|management|step)|to perform)\b", re.I)
    SELF_CONTAINED = re.compile(r'^\s*(\d{1,3}\s*[.)-]\s*)?(a|an)\s+\d{1,3}[- ]?(y|year)|^\s*(\d{1,3}\s*[.)-]\s*)?(mr|mrs|miss|ms|m)\.?\s+[A-Z]', re.I)

    def close():
        nonlocal cur
        if cur is not None:
            if len(cur['options']) >= 2:
                cur_set['questions'].append(cur)
            else:
                log.append('dropped question with %d options: %s' % (len(cur['options']), cur['_stem'][:70]))
        cur = None

    def last_q():
        if cur is not None:
            return cur
        for s in reversed(topic['sets'] if topic else []):
            if s['questions']:
                return s['questions'][-1]
        return None

    for i, x in enumerate(L):
        k, t = x['kind'], x['text']
        if k == 'title':
            if x['imgs']:
                lq = last_q()
                if lq is not None:
                    lq['notes'].extend({'img': im} for im in x['imgs'])
                    log.append('title-paragraph image -> notes of "%s"' % lq['_stem'][:50])
            if t:
                close()
                name = re.sub(r'^\s*\d+\s*[.)-]\s*', '', t).strip()
                topic = dict(name=name, sets=[])
                topics.append(topic)
                cur_set, mode = None, None
                case_id, chapter = None, None
            continue
        if topic is None:
            continue
        if k == 'header':
            close()
            cur_set = dict(parse_header(t, topic['name']), questions=[])
            topic['sets'].append(cur_set)
            mode = None
            case_id, chapter = None, None
            continue
        # compound case paragraph (first line) and explicit case vignettes
        if k == 'case' or (k in ('text', 'stem?') and mode != 'stem' and not (k == 'stem?' and valid_stem(L, i))
                           and ((mode != 'notes' and x['bold'] and len(t) > 45) or CASE_PREFIX.match(t))
                           and leads_to_stem(L, i)):
            close()
            html_line = clean_inline(runs_html(x['runs'], keep_bold=False))
            html_line = CASE_PREFIX.sub('', html_line).strip()
            if case_fresh and cases and mode == 'case':
                cases[-1]['html'] += '<br>' + html_line
            else:
                cases.append({'id': 'c%d' % (len(cases) + 1), 'html': html_line})
                case_id, case_fresh = cases[-1]['id'], True
            case_compound = (k == 'case')
            mode = 'case'
            continue
        # chapter labels inside a set ("1. Eczema", "SCABIES")
        if (k in ('text', 'stem?') and mode in (None, 'options', 'case') and len(t) <= 45 and '?' not in t
                and not (k == 'stem?' and valid_stem(L, i)) and leads_to_stem(L, i)):
            close()
            name = re.sub(r'^\s*\d{1,3}\s*[.)-]\s*', '', t).strip().rstrip(':')
            chapter = name.capitalize() if name.isupper() else name
            if not re.search(r'[A-Za-z]{3,}', chapter):
                chapter = None
            case_id = None
            mode = None
            continue
        if k == 'legend':
            continue
        if k == 'stem?' and valid_stem(L, i):
            if cur_set is None:
                log.append('question before any exam header in %s: %s' % (topic['name'], t[:60]))
                cur_set = dict(type='Collected', year=None, label='Questions', header='', questions=[])
                topic['sets'].append(cur_set)
            close()
            if case_id and not case_fresh and (case_compound or SELF_CONTAINED.match(t)):
                case_id = None
            runs = x['runs']
            stem_html = clean_inline(runs_html(runs))
            stem_html = re.sub(r'^\s*\d{1,3}\s*[.)-]\s*', '', stem_html)
            fk, _ = fill_of(x['runs'])
            use_case = case_id if (case_id and (case_fresh or DEPENDENT.search(t))) else None
            cur = dict(_stem=re.sub(r'^\s*\d{1,3}\s*[.)-]\s*', '', t), stem=stem_html, options=[], kinds=[], notes=[], stemImgs=[],
                       flag='red' if fk in FLAG_FILLS else None, pi=x['pi'], case=use_case, caseOpen=case_fresh, chapter=chapter)
            case_fresh = False
            if x['imgs']:
                cur['stemImgs'].extend(x['imgs'])
            mode = 'stem'
            continue
        if k == 'substem':
            close()
            m = MANUAL_OPT.match(t)
            raw = ''.join(r['text'] for r in x['runs'])
            pre = (len(raw) - len(raw.lstrip())) + (m.end() if m else 0)
            runs = strip_prefix_runs(x['runs'], pre)
            cur = dict(_stem=t[m.end():].strip() if m else t, stem=clean_inline(runs_html(runs)), options=[], kinds=[], notes=[],
                       stemImgs=[], flag=None, pi=x['pi'], case=case_id, caseOpen=True, chapter=chapter)
            case_fresh = False
            mode = 'stem'
            continue
        if cur is not None and mode in ('stem', 'options') and k == 'roman':
            m = ROMAN.match(t)
            raw = ''.join(r['text'] for r in x['runs'])
            pre = (len(raw) - len(raw.lstrip())) + m.end()
            fk, frac = fill_of(x['runs'], skip_prefix=pre)
            cur['options'].append(clean_inline(runs_html(strip_prefix_runs(x['runs'], pre))))
            cur['kinds'].append(FILL_KIND.get(fk) if fk else None)
            mode = 'options'
            continue
        if cur is not None and mode in ('stem', 'options') and k in ('opt?',):
            # auto-numbered list items carry no typed letter: never strip "H. pylori", "E. coli"...
            m = MANUAL_OPT.match(t) if not x['fmt'] else None
            pre = 0
            runs = x['runs']
            if m:
                # length of the manual "a. " prefix inside the raw runs text
                raw = ''.join(r['text'] for r in runs)
                lead = len(raw) - len(raw.lstrip())
                pre = lead + m.end()
                runs = strip_prefix_runs(runs, pre)
            fk, frac = fill_of(x['runs'], skip_prefix=pre)
            kind = FILL_KIND.get(fk) if fk else None
            if fk and fk not in FILL_KIND and fk != 'ffffff':
                log.append('odd option fill %s on "%s"' % (fk, t[:60]))
            if fk in FILL_KIND and frac < 0.999:
                log.append('partial highlight %.0f%% on "%s"' % (frac * 100, t[:60]))
            cur['options'].append(clean_inline(runs_html(runs)))
            cur['kinds'].append(kind)
            if x['imgs']:
                cur['notes'].extend({'img': im} for im in x['imgs'])
            mode = 'options'
            continue
        if cur is not None and mode == 'stem' and k == 'text':
            cur['stem'] += ' ' + clean_inline(runs_html(x['runs']))
            cur['_stem'] += ' ' + t
            if x['imgs']:
                cur['stemImgs'].extend(x['imgs'])
            continue
        if cur is not None and mode == 'stem' and k == 'empty' and x['imgs']:
            cur['stemImgs'].extend(x['imgs'])
            log.append('image between stem and options: "%s"' % cur['_stem'][:60])
            continue
        if k == 'notes':
            lq = last_q()
            if lq is None:
                continue
            if lq is not cur:
                log.append('Notes: after a closed question? "%s"' % lq['_stem'][:50])
            mode = 'notes'
            rest = NOTES_RE.sub('', t).strip()
            if rest and rest != ':':
                lq['notes'].append({'html': html.escape(rest)})
            lq['notes'].extend({'img': im} for im in x['imgs'])
            continue
        # anything else after the options
        lq = cur if cur is not None else None
        if lq is not None and mode in ('options', 'notes'):
            if mode == 'notes':
                if t and t != ':':
                    lq['notes'].append({'html': runs_html(x['runs'], keep_bold=True)})
                lq['notes'].extend({'img': im} for im in x['imgs'])
            else:
                if x['imgs']:
                    lq['notes'].extend({'img': im} for im in x['imgs'])
                    log.append('image after options without Notes: label -> notes of "%s"' % lq['_stem'][:50])
                if t and t not in ('.', '-', ':'):
                    if k == 'opt?':
                        log.append('extra option-like line after options ignored: "%s" (q: %s)' % (t[:60], lq['_stem'][:40]))
                    else:
                        log.append('stray text after options (kept as note): "%s"' % t[:80])
                        lq['notes'].append({'html': runs_html(x['runs'], keep_bold=True)})
            continue
        if t and k not in ('empty',):
            log.append('ignored line [%s]: "%s"' % (k, t[:80]))
        elif x['imgs']:
            log.append('ignored image(s) %s' % x['imgs'])
    close()

    out = []
    for tp in topics:
        sets = [s for s in tp['sets'] if s['questions']]
        if not sets:
            continue
        out.append(dict(name=tp['name'], sets=sets))
    return out, cases


def finalize(topics, cases, source_prefix, docx_dir, img_dir, img_prefix='img/'):
    """answer keys, ids, image conversion; returns (topics_meta, sets_meta, questions)"""
    os.makedirs(img_dir, exist_ok=True)
    seen_imgs = {}

    def conv(src):
        if src in seen_imgs:
            return seen_imgs[src]
        base = os.path.splitext(os.path.basename(src))[0]
        out_name = '%s-%s.webp' % (source_prefix, base)
        im = Image.open(os.path.join(docx_dir, 'word', src))
        if im.mode in ('RGBA', 'LA', 'P'):
            im = im.convert('RGBA')
            bg = Image.new('RGB', im.size, 'white')
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert('RGB')
        if im.width > 1600:
            im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        im.save(os.path.join(img_dir, out_name), 'WEBP', quality=82, method=6)
        seen_imgs[src] = dict(src=img_prefix + out_name, w=im.width, h=im.height)
        return seen_imgs[src]

    topics_meta, sets_meta, questions = [], [], []
    for tp in topics:
        tid = slug(tp['name'])
        topics_meta.append(dict(id=tid, name=tp['name']))
        for s in tp['sets']:
            sid = slug('%s-%s-%s' % (source_prefix, tid, s['header'] or s['label']))
            sets_meta.append(dict(id=sid, topic=tid, type=s['type'], year=s['year'], label=s['label'], header=s['header']))
            for n, qd in enumerate(s['questions'], 1):
                kinds = qd['kinds']
                present = [k for k in ('official', 'proposed') if k in kinds]
                if len(present) > 1:
                    log.append('MIXED official+proposed in "%s" -> official only' % qd['_stem'][:60])
                key = present[0] if present else None
                answer = [i for i, k in enumerate(kinds) if k == key] if key else []
                hid = hashlib.sha1(('all|' + qd['_stem'] + '|' + '|'.join(qd['options'])).encode()).hexdigest()[:10]
                item = dict(id=hid, n=n, topic=tid, source=sid, stem=qd['stem'], options=qd['options'],
                            answer=answer, key=key, _stem=qd['_stem'], _pi=qd['pi'])
                if qd['flag']:
                    item['flag'] = qd['flag']
                if qd.get('case'):
                    item['case'] = source_prefix + '-' + qd['case']
                    if qd.get('caseOpen'):
                        item['caseOpen'] = True
                if qd.get('chapter'):
                    item['chapter'] = qd['chapter']
                notes = []
                for nt in qd['notes']:
                    if 'img' in nt:
                        notes.append(conv(nt['img']))
                    elif nt['html'].strip():
                        notes.append(nt)
                if notes:
                    item['notes'] = notes
                if qd['stemImgs']:
                    item['stemImgs'] = [conv(im) for im in qd['stemImgs']]
                questions.append(item)
    used = {q['case'] for q in questions if q.get('case')}
    cases_meta = [dict(id=source_prefix + '-' + c['id'], html=c['html']) for c in cases if source_prefix + '-' + c['id'] in used]
    return topics_meta, sets_meta, questions, cases_meta


if __name__ == '__main__':
    docx_dir, prefix, img_dir, out_json = sys.argv[1:5]
    topics, cases = parse(docx_dir, prefix)
    tm, sm, qs, cm = finalize(topics, cases, prefix, docx_dir, img_dir)
    json.dump(dict(topics=tm, sets=sm, questions=qs, cases=cm), open(out_json, 'w'), ensure_ascii=False, indent=1)
    for line in log:
        print('LOG:', line)
    print()
    for t in tm:
        tq = [x for x in qs if x['topic'] == t['id']]
        print('%-34s %4d  keys=%s' % (t['name'], len(tq), dict(Counter(x['key'] for x in tq))))
        for s in [s for s in sm if s['topic'] == t['id']]:
            sq = [x for x in qs if x['source'] == s['id']]
            print('     %-15s %-55s %3d  keys=%s' % (s['type'], s['label'][:55], len(sq), dict(Counter(x['key'] for x in sq))))
    print('TOTAL', len(qs))
