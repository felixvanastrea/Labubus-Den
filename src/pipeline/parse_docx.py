"""Parse an MCQ exam .docx (Google-Docs export) into question-bank JSON.

Conventions found in the EFM3 docs:
  * Title-style paragraph            -> topic section ("1. CARDIAC DISEASES")
  * Heading1-style paragraph         -> question stem
  * lettered list paragraphs          -> options
  * "Notes:" paragraph               -> start of explanation block (text + images)
  * shading fill on option runs      -> answer key
        d9d2e9 purple = official, fce5cd orange = Chica's proposal, d9ead3 green = proposal
  * Word comments                    -> explanations anchored on an option or the stem
"""
import hashlib
import html
import json
import os
import re
import sys
from collections import Counter, defaultdict

from lxml import etree
from PIL import Image

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
NS = {'w': W, 'r': R, 'a': A}
q = lambda tag: '{%s}%s' % (W, tag)

FILL_KIND = {'d9d2e9': 'official', 'fce5cd': 'chica', 'd9ead3': 'proposed'}
FLAG_FILLS = {'ea9999', 'f4cccc'}  # red stems, no legend in the doc
URL_RE = re.compile(r'(https?://[^\s<>"]+)')

log = []


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def linkify(escaped_text):
    def rep(m):
        url = m.group(1)
        trail = ''
        while url and url[-1] in '.,;)':
            trail = url[-1] + trail
            url = url[:-1]
        return '<a href="%s" target="_blank" rel="noopener">%s</a>%s' % (url, url, trail)
    return URL_RE.sub(rep, escaped_text)


class Doc:
    def __init__(self, root_dir):
        self.dir = root_dir
        self.doc = etree.parse(os.path.join(root_dir, 'word/document.xml'))
        rels = etree.parse(os.path.join(root_dir, 'word/_rels/document.xml.rels'))
        self.rels = {r.get('Id'): r.get('Target') for r in rels.getroot()}
        self.numfmt = self._numbering()
        self.comments = self._comments()
        self.anchor_text = self._comment_anchors()

    def _numbering(self):
        path = os.path.join(self.dir, 'word/numbering.xml')
        if not os.path.exists(path):
            return {}
        num = etree.parse(path)
        absmap = {}
        for an in num.findall('w:abstractNum', NS):
            lv = {}
            for l in an.findall('w:lvl', NS):
                fmt = l.find('w:numFmt', NS)
                lv[l.get(q('ilvl'))] = fmt.get(q('val')) if fmt is not None else None
            absmap[an.get(q('abstractNumId'))] = lv
        out = {}
        for n in num.findall('w:num', NS):
            aid = n.find('w:abstractNumId', NS).get(q('val'))
            out[n.get(q('numId'))] = absmap.get(aid, {})
        return out

    def _comments(self):
        path = os.path.join(self.dir, 'word/comments.xml')
        if not os.path.exists(path):
            return {}
        t = etree.parse(path)
        out = {}
        for cm in t.getroot().findall('w:comment', NS):
            paras = []
            for p in cm.findall('.//w:p', NS):
                txt = ''
                for node in p.iter():
                    if node.tag == q('t'):
                        txt += node.text or ''
                    elif node.tag in (q('tab'),):
                        txt += ' '
                    elif node.tag in (q('br'), q('cr')):
                        txt += '\n'
                paras.append(txt)
            text = '\n'.join(paras).strip()
            out[cm.get(q('id'))] = text
        return out

    def _comment_anchors(self):
        active = set()
        anchor = defaultdict(str)
        for node in self.doc.getroot().iter():
            if node.tag == q('commentRangeStart'):
                active.add(node.get(q('id')))
            elif node.tag == q('commentRangeEnd'):
                active.discard(node.get(q('id')))
            elif node.tag == q('t') and active:
                for cid in active:
                    anchor[cid] += node.text or ''
        return dict(anchor)


def para_info(d, p):
    pPr = p.find('w:pPr', NS)
    style = numid = None
    ilvl = '0'
    if pPr is not None:
        s = pPr.find('w:pStyle', NS)
        if s is not None:
            style = s.get(q('val'))
        npr = pPr.find('w:numPr', NS)
        if npr is not None and npr.find('w:numId', NS) is not None:
            numid = npr.find('w:numId', NS).get(q('val'))
            il = npr.find('w:ilvl', NS)
            ilvl = il.get(q('val')) if il is not None else '0'
    fmt = d.numfmt.get(numid, {}).get(ilvl) if numid and numid != '0' else None

    runs = []   # dicts: text, fill, bold, italic, va, href
    imgs = []

    def walk(node, href=None):
        for ch in node:
            tag = ch.tag
            if tag == q('hyperlink'):
                rid = ch.get('{%s}id' % R)
                target = d.rels.get(rid) if rid else None
                walk(ch, target or href)
            elif tag == q('r'):
                rPr = ch.find('w:rPr', NS)
                fill = va = None
                bold = italic = False
                if rPr is not None:
                    sh = rPr.find('w:shd', NS)
                    if sh is not None:
                        fill = (sh.get(q('fill')) or '').lower() or None
                        if fill in ('auto', 'ffffff'):
                            fill = None
                    hl = rPr.find('w:highlight', NS)
                    if hl is not None and not fill:
                        fill = 'hl:' + hl.get(q('val'))
                    b = rPr.find('w:b', NS)
                    bold = b is not None and b.get(q('val')) not in ('0', 'false')
                    i = rPr.find('w:i', NS)
                    italic = i is not None and i.get(q('val')) not in ('0', 'false')
                    v = rPr.find('w:vertAlign', NS)
                    if v is not None:
                        va = v.get(q('val'))
                txt = ''
                for x in ch:
                    if x.tag == q('t'):
                        txt += x.text or ''
                    elif x.tag == q('tab'):
                        txt += ' '
                    elif x.tag in (q('br'), q('cr')):
                        txt += '\n'
                for b in ch.iter('{%s}blip' % A):
                    emb = b.get('{%s}embed' % R)
                    if emb and d.rels.get(emb):
                        imgs.append(d.rels[emb])
                if txt:
                    runs.append(dict(text=txt, fill=fill, bold=bold, italic=italic, va=va, href=href))
            elif tag in (q('smartTag'), q('ins'), q('fldSimple'), q('sdt'), q('sdtContent')):
                walk(ch, href)
    walk(p)
    text = ''.join(r['text'] for r in runs)
    cms = [c.get(q('id')) for c in p.iter(q('commentRangeStart'))]
    if not cms:
        cms = [c.get(q('id')) for c in p.iter(q('commentReference'))]
    return dict(style=style, numid=numid, ilvl=ilvl, fmt=fmt, runs=runs, text=text, imgs=imgs, cms=cms)


def runs_html(runs, keep_bold=False, strip_prefix=None):
    out = []
    for r in runs:
        t = html.escape(r['text']).replace('\n', '<br>')
        if not r['href']:
            t = linkify(t)
        if r['va'] == 'superscript':
            t = '<sup>%s</sup>' % t
        elif r['va'] == 'subscript':
            t = '<sub>%s</sub>' % t
        if keep_bold and r['bold'] and r['text'].strip():
            t = '<strong>%s</strong>' % t
        if keep_bold and r['italic'] and r['text'].strip():
            t = '<em>%s</em>' % t
        if r['href']:
            t = '<a href="%s" target="_blank" rel="noopener">%s</a>' % (html.escape(r['href'], quote=True), t)
        out.append(t)
    s = ''.join(out)
    s = re.sub(r'</strong><strong>', '', s)
    s = re.sub(r'</em><em>', '', s)
    s = re.sub(r'</sup><sup>', '', s)
    return s.strip()


def clean_inline(s):
    s = re.sub(r'\s+', ' ', s.replace('<br>', ' ')).strip()
    return s


def comment_html(d, cid, context_text):
    raw = d.comments.get(cid, '').strip()
    if not raw:
        return None
    anchor = re.sub(r'\s+', ' ', d.anchor_text.get(cid, '')).strip()
    # split  "quoted passage"Source  into passage + source
    body, source = raw, None
    m = re.match(r'^\s*[“"](.+)[”"]\s*(\S.{0,250})$', raw, re.S)
    if m and '\n' not in m.group(2):
        body, source = m.group(1).strip(), m.group(2).strip()
    paras = [p.strip() for p in body.split('\n') if p.strip()]
    h = ''.join('<p>%s</p>' % linkify(html.escape(p)) for p in paras)
    if source:
        h += '<p class="src">%s</p>' % linkify(html.escape(source))
    ctx = re.sub(r'\s+', ' ', context_text).strip()
    show_anchor = anchor and len(anchor) < 0.8 * len(ctx) and len(anchor) <= 90
    return dict(anchor=anchor if show_anchor else None, html=h)


def key_kind(runs):
    chars = Counter()
    total = 0
    for r in runs:
        n = len(r['text'].strip())
        if not n:
            continue
        total += n
        if r['fill']:
            chars[r['fill']] += n
    if not total or not chars:
        return None, 0.0
    fill, n = chars.most_common(1)[0]
    return fill, n / total


def parse(docx_dir, source_id, img_out_dir, img_url_prefix):
    d = Doc(docx_dir)
    body = d.doc.getroot().find('w:body', NS)
    topics = []
    topic = None
    cur = None          # current question
    mode = None         # 'options' | 'notes'
    img_jobs = []

    def close_question():
        nonlocal cur
        if cur is not None:
            topic['questions'].append(cur)
        cur = None

    def add_note_image(target, where):
        if cur is None and not (topic and topic['questions']):
            log.append('orphan image %s' % target)
            return
        holder = cur if cur is not None else topic['questions'][-1]
        holder['notes'].append({'img': target})
        if where:
            log.append('image %s attached from %s to Q "%s"' % (target, where, holder['stem'][:50]))

    for el in body:
        if el.tag != q('p'):
            if el.tag == q('tbl'):
                log.append('TABLE found (not handled): ' + ''.join(el.itertext())[:80])
            continue
        p = para_info(d, el)
        text = p['text'].strip()

        # --- topic heading
        if p['style'] == 'Title':
            for im in p['imgs']:
                add_note_image(im, 'title paragraph')
            if text:
                close_question()
                name = re.sub(r'^\s*\d+\s*[.)-]\s*', '', text).strip()
                topics.append(dict(name=name, legend=[], questions=[]))
                topic = topics[-1]
                mode = None
            continue
        if topic is None:
            continue

        # --- legend lines
        if text.startswith('[') and 'answers' in text.lower() and cur is None:
            topic['legend'].append(text.strip('[]. '))
            continue

        # --- question stem
        if p['style'] == 'Heading1' and text:
            close_question()
            stem_runs = p['runs']
            stem = runs_html(stem_runs)
            stem = re.sub(r'^\s*\d+\s*[.)]\s*', '', clean_inline(stem))
            flag = None
            fk, frac = key_kind(stem_runs)
            if fk in FLAG_FILLS:
                flag = 'red'
            cur = dict(stem=stem, options=[], notes=[], comments=[], flag=flag,
                       _stem_text=text)
            for cid in p['cms']:
                c = comment_html(d, cid, text)
                if c:
                    cur['comments'].append(c)
            for im in p['imgs']:
                cur['notes'].append({'img': im})
            mode = 'options'
            continue

        # --- option
        if cur is not None and mode == 'options' and p['fmt'] in ('lowerLetter', 'upperLetter') and text:
            fk, frac = key_kind(p['runs'])
            kind = FILL_KIND.get(fk) if fk else None
            if fk and fk not in FILL_KIND:
                log.append('unknown option fill %s on "%s"' % (fk, text[:60]))
            if fk and frac < 0.999:
                log.append('partial highlight %.0f%% (%s) on "%s"' % (frac * 100, fk, text[:60]))
            bold = any(r['bold'] for r in p['runs'] if r['text'].strip())
            if bold and kind != 'official':
                log.append('bold without purple on "%s" (kind=%s)' % (text[:60], kind))
            opt = dict(html=clean_inline(runs_html(p['runs'])), kind=kind, comments=[])
            for cid in p['cms']:
                c = comment_html(d, cid, text)
                if c:
                    opt['comments'].append(c)
            cur['options'].append(opt)
            for im in p['imgs']:
                cur['notes'].append({'img': im})
            continue

        # --- notes
        if cur is not None and re.match(r'^\s*notes?\s*:', text, re.I):
            mode = 'notes'
            rest = re.sub(r'^\s*notes?\s*:\s*', '', text, flags=re.I)
            if rest:
                cur['notes'].append({'html': html.escape(rest)})
            for im in p['imgs']:
                cur['notes'].append({'img': im})
            for cid in p['cms']:
                c = comment_html(d, cid, text)
                if c:
                    cur['comments'].append(c)
            continue

        if cur is not None and mode == 'notes':
            if text:
                cur['notes'].append({'html': runs_html(p['runs'], keep_bold=True)})
            for im in p['imgs']:
                cur['notes'].append({'img': im})
            for cid in p['cms']:
                c = comment_html(d, cid, text)
                if c:
                    cur['comments'].append(c)
            continue

        # stray paragraph after options (not inside a Notes block)
        if text and text not in ('.', '-'):
            log.append('stray text ignored: "%s"' % text[:80])
        for im in p['imgs']:
            add_note_image(im, 'stray paragraph')

    close_question()

    # ---- finalize: answer keys, ids, image conversion
    out_topics = []
    for t in topics:
        tid = slug(t['name'])
        qs = []
        for n, qd in enumerate(t['questions'], 1):
            kinds = [o['kind'] for o in qd['options']]
            present = [k for k in ('official', 'chica', 'proposed') if k in kinds]
            if len(present) > 1:
                log.append('MIXED key kinds %s in "%s"' % (present, qd['_stem_text'][:60]))
            key_src = present[0] if present else None
            answer = [i for i, k in enumerate(kinds) if k == key_src] if key_src else []
            alt = {}
            for k in present[1:]:
                alt[k] = [i for i, kk in enumerate(kinds) if kk == k]
            if len(qd['options']) != 4:
                log.append('%d options in "%s"' % (len(qd['options']), qd['_stem_text'][:60]))
            if not key_src:
                log.append('NO KEY: [%s] %s' % (t['name'], qd['_stem_text'][:70]))
            # squash note text: drop empties, merge consecutive
            notes = []
            for nt in qd['notes']:
                if 'img' in nt:
                    notes.append(nt)
                elif nt['html'].strip():
                    notes.append(nt)
            hid = hashlib.sha1((source_id + '|' + qd['_stem_text'] + '|' + '|'.join(o['html'] for o in qd['options'])).encode()).hexdigest()[:10]
            item = dict(
                id=hid,
                n=n,
                topic=tid,
                source=source_id,
                stem=qd['stem'],
                options=[o['html'] for o in qd['options']],
                answer=answer,
                key=key_src,
            )
            if alt:
                item['alt'] = alt
            if qd['flag']:
                item['flag'] = qd['flag']
            oc = {str(i): o['comments'] for i, o in enumerate(qd['options']) if o['comments']}
            if oc:
                item['optNotes'] = oc
            if qd['comments']:
                item['qNotes'] = qd['comments']
            if notes:
                item['notes'] = notes
            qs.append(item)
        out_topics.append(dict(id=tid, name=t['name'], legend=t['legend'], questions=qs))

    # images -> webp
    os.makedirs(img_out_dir, exist_ok=True)
    seen = {}
    for t in out_topics:
        for item in t['questions']:
            for nt in item.get('notes', []):
                if 'img' in nt:
                    src = nt['img']
                    if src not in seen:
                        base = os.path.splitext(os.path.basename(src))[0]
                        out_name = '%s-%s.webp' % (source_id, base)
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
                        im.save(os.path.join(img_out_dir, out_name), 'WEBP', quality=82, method=6)
                        seen[src] = dict(src=img_url_prefix + out_name, w=im.width, h=im.height)
                    nt.update(seen[src])
                    del nt['img']
    return out_topics


if __name__ == '__main__':
    docx_dir, source_id, img_dir, out_json = sys.argv[1:5]
    topics = parse(docx_dir, source_id, img_dir, 'img/')
    json.dump(topics, open(out_json, 'w'), ensure_ascii=False, indent=1)
    for line in log:
        print('LOG:', line)
    for t in topics:
        kinds = Counter(qq['key'] for qq in t['questions'])
        print('%-32s %3d questions  keys=%s' % (t['name'], len(t['questions']), dict(kinds)))
