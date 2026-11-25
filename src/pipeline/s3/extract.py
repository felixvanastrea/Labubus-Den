import re, json, subprocess, sys, docx, glob, os
RAW='/home/claude/work/s3raw'
def lines_of(f):
    if f.endswith('.docx'):
        return [x for p in docx.Document(f).paragraphs for x in p.text.split('\n')]
    if f.endswith('.pdf'):
        return subprocess.run(['pdftotext',f,'-'],capture_output=True,text=True).stdout.split('\n')
    if f.endswith('.txt'):
        return open(f).read().split('\n')
QRE=re.compile(r'^\s*(?:Question\s*)?(\d{1,3})\s*(?:/\s*\d+)?\s*[\.\-\)–]?\s*(.*)$')
ORE=re.compile(r'^\s*\*?\s*([A-Ea-e])\s*[\.\-\)–]\s*(.*)$')
NOISE=re.compile(r'^\s*(\(?not sure\)?|\?\?|[A-E]{1,5}|\d{1,3}|Show Answer|Status|Poor|Great|Good|Modules?.*|→.*|Lectures/Tutorials.*)\s*$',re.I)
def clean(s):
    s=re.sub(r'\(\s*not sure\s*\)','',s,flags=re.I); s=s.replace('++','').replace('??','')
    s=re.sub(r'\s+',' ',s).strip(); return s
def parse_lettered(L, heads=None):
    """numbered stems + lettered options. Lines that aren't Q/opt are continuation, unless they look like a heading."""
    out=[]; cur=None; section=None; other=[]
    for raw in L:
        t=raw.strip()
        if not t: continue
        m=QRE.match(t); o=ORE.match(t)
        if o and cur is not None and (len(o.group(2))>0):
            cur['o'].append(o.group(2)); continue
        if m and (m.group(2) or t.lower().startswith('question')) and not (cur and not cur['o'] and len(m.group(2))<3):
            if m.group(2) or t.lower().startswith('question'):
                cur={'s':m.group(2),'o':[],'sec':section,'n':int(m.group(1))}; out.append(cur); continue
        if heads and heads(t):
            section=t; cur=None; other.append('§ '+t); continue
        if NOISE.match(t): continue
        if cur is None: other.append(t); continue
        if cur['o']: cur['o'][-1]+=' '+t
        else: cur['s']+=' '+t
    for q in out:
        q['s']=clean(q['s']); q['o']=[clean(x) for x in q['o'] if clean(x)]
    return out, other
def parse_blocks(L):
    """Evalbox: blocks separated by blank lines; stem = lines up to the one ending in ':' or '?', the rest options."""
    txt='\n'.join(L); out=[]
    for b in re.split(r'\n\s*\n',txt):
        ls=[x.strip() for x in b.split('\n') if x.strip() and not re.fullmatch(r'\d{1,3}',x.strip())]
        if len(ls)<3: 
            if ls: out.append({'frag':ls}); 
            continue
        k=next((i for i,x in enumerate(ls) if re.search(r'[:?]\s*$',x)),0)
        stem=' '.join(ls[:k+1]); opts=[]
        for x in ls[k+1:]:
            if opts and (x[0].islower() or re.match(r'^(and|or|of|in|the)\b',x)): opts[-1]+=' '+x
            else: opts.append(x)
        out.append({'s':clean(stem),'o':[clean(x) for x in opts]})
    return out
def parse_quiz(L):
    out=[]; cur=None
    for raw in L:
        t=raw.strip().lstrip('●•○').strip()
        if not t or re.fullmatch(r'[A-Da-d]{1,6}',t) or re.fullmatch(r'\d{1,3}',t): continue
        if t.startswith('Anatomy ') and 'Test' in t: continue
        o=re.match(r'^([a-dA-D])\s*[\.\)]\s*(.+)$',t)
        if o and cur is not None: cur['o'].append(o.group(2)); continue
        if cur and not cur['o']: cur['s']+=' '+t; continue
        if cur and cur['o'] and len(cur['o'])<4 and cur['o'][-1].strip() not in ('Yes','No','True','False'): cur['o'][-1]+=' '+t; continue
        cur={'s':t,'o':[]}; out.append(cur)
    for q in out: q['s']=clean(q['s']); q['o']=[clean(x) for x in q['o']]
    return out

HEAD=re.compile(r'^(MUSCLE|Muscle|NEURO|FINALS?( ANATOMY ?\d)?|MIDTERM|MOCK|Mock|Midterm|Finals?|SECOND SESSION|RETAKE|Retake|CARDIOLOGY|Vital Functions and First Aid|Physiology [A-Z][a-z]+:?|Neuro(physiology)?:?|Muscle( physiology)?:?|Renal( physiology)?:?)\s*$')
STOP=re.compile(r'^((CORRECTION|Correction|ANSWER SHEET|Answers?)\s*:?|→\s*Answers.*)\s*$')
QRE2=re.compile(r'^\s*(?:Question\s*|Q)?(\d{1,3})\s*(?:/\s*\d+)?\s*[\.\-\):–]\s*(.*)$')
CASE=re.compile(r'^(Clinical case|Case for|Case \d|Clinical Case|CLINICAL CASE)',re.I)
def parse2(L, head=HEAD, faq=True, stop=STOP, keep_first_correction=True):
    out=[]; cur=None; sec=None; case=None; incase=False; started=not faq; other=[]
    for raw in L:
        t=raw.strip()
        if not t: continue
        if faq and not started:
            if head.match(t): started=True; sec=t; continue
            if t.startswith('Common questions') or re.match(r'^\d-',t) or True:
                if head.match(t): started=True
                continue
        if stop.match(t):
            if keep_first_correction and not out: continue
            break
        if head.match(t): sec=t; cur=None; case=None; incase=False; continue
        if CASE.match(t): case=t; incase=True; cur=None; continue
        mq=re.match(r'^Question\s*(\d+)\s*/\s*\d+\s*$',t)
        if mq: cur={'s':'','o':[],'sec':sec,'n':int(mq.group(1)),'case':case}; out.append(cur); incase=False; continue
        m=QRE2.match(t)
        if m and re.fullmatch(r'[A-Ea-e]{1,5}',m.group(2).strip() or 'x'): continue   # key line like 3-BC
        o=ORE.match(t) or (re.match(r'^\s*[-–•]\s*(.+)$',t) if cur is not None else None)
        if o and cur is not None:
            txt=o.group(o.lastindex); cur['o'].append(txt); continue
        if m and m.group(2) and cur is not None and not cur['o'] and int(m.group(1))!=cur['n']+1 and int(m.group(1))<=8:
            cur['s']+='\n'+t; continue      # a numbered list inside the stem (matching questions)
        if m and m.group(2):
            cur={'s':m.group(2),'o':[],'sec':sec,'n':int(m.group(1)),'case':case}; out.append(cur); incase=False; continue
        if NOISE.match(t): continue
        if incase: case+='\n'+t; 
            # case text continues
        elif cur is None: other.append(t)
        elif cur['o']: cur['o'][-1]+=' '+t
        else: cur['s']+=' '+t
    for q in out:
        q['s']=clean(q['s']); opts=[]
        for x in q['o']:
            # options run together on one line: "Pregnenolone B. Cortisol"
            parts=re.split(r'\s+(?=[B-E]\.\s)',x)
            opts+= [re.sub(r'^[B-E]\.\s*','',y) if i else y for i,y in enumerate(parts)]
        q['o']=[clean(x) for x in opts if clean(x) and clean(x) not in ('?',)]
        if q.get('case'): q['case']=re.sub(r'[ \t]+',' ',q['case']).strip()
    return out, other

JUNK=re.compile(r"(exam lasts|exam includes|ballpoint pen|white-out|Number of pages|Can.t recall|^\??$)",re.I)
def good(qs): return [q for q in qs if not JUNK.search(q['s']) and len(q['o'])>=2]

def parse_seq(L, nopt=4, skip=()):
    items=[]
    for raw in L:
        t=raw.strip().lstrip('•').strip()
        if not t or re.fullmatch(r'\d{1,3}',t) or t in skip: continue
        items.append(t)
    out=[]; i=0
    while i<len(items):
        stem=[items[i]]; i+=1
        while not re.search(r'[:?]\s*$',stem[-1]) and i<len(items) and items[i][0].islower():
            stem.append(items[i]); i+=1
        opts=[]
        while i<len(items) and len(opts)<nopt:
            x=items[i]; i+=1
            if opts and (x[0].islower() or x[0] in '(,'): opts[-1]+=' '+x; continue
            opts.append(x)
        while i<len(items) and (items[i][0].islower()): opts[-1]+=' '+items[i]; i+=1
        out.append({'s':clean(' '.join(stem)),'o':[clean(x) for x in opts]})
    return out

def parse_anchor(L, skip=()):
    items=[]
    for raw in L:
        t=raw.strip().lstrip('•').strip()
        if not t or re.fullmatch(r'\d{1,3}',t) or t in skip: continue
        items.append(t)
    ends=[i for i,x in enumerate(items) if re.search(r'[:?]\s*$',x)]
    starts=[]
    for j in ends:
        k=j
        while k>0 and items[k][0].islower() and (k-1) not in ends: k-=1
        starts.append(k)
    out=[]
    for n,(s,e) in enumerate(zip(starts,ends)):
        nxt=starts[n+1] if n+1<len(starts) else len(items)
        opts=[]
        for x in items[e+1:nxt]:
            if opts and (x[0].islower() or x[0] in '(,'): opts[-1]+=' '+x
            else: opts.append(x)
        out.append({'s':clean(' '.join(items[s:e+1])),'o':[clean(x) for x in opts]})
    return out, items[:starts[0]] if starts else items
