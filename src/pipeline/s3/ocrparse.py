import re,sys,json
sys.path.insert(0,'/home/claude/work/s3')
from extract import clean
def fix(line):
    t=line.strip()
    t=re.sub(r'^[\(\[\{|\'"‘’`°«»\-~_ ]*([A-Ea-e])\s*[\)\]\}\.,_:\-]+\s*',lambda m:m.group(1).upper()+'. ',t)   # (A) / A) / C. / "D.
    t=re.sub(r'^([A-E])\s+(?=[A-Z])',r'\1. ',t)
    t=re.sub(r'^Cc\.\s*','C. ',t); t=re.sub(r'^\)\.?[’\']?\s*','D. ',t)
    # trailing scribbles: drop tail tokens that aren't words
    toks=t.split(' ')
    while toks and (len(re.sub(r'[^A-Za-z]','',toks[-1]))<=1 and not re.fullmatch(r'[\d%°/<>=.,:)]+',toks[-1]) or re.fullmatch(r'[a-z]{1,2}|[\\/|<>—=_~«»¥‘’]+.*',toks[-1])):
        toks.pop()
    return ' '.join(toks)
def parse(path):
    L=[fix(x) for x in open(path).read().split('\n')]
    out=[]; cur=None
    for t in L:
        if not t: continue
        m=re.match(r'^(\d{1,2})\s*[\.\-\)]\s*(.{8,})$',t)
        o=re.match(r'^([A-E])\.\s+(.+)$',t)
        if o and cur is not None and len(cur['o'])<5: cur['o'].append(o.group(2)); continue
        if m and not re.search(r'(exam lasts|exam includes|ballpoint|white-out)',t,re.I):
            cur={'n':int(m.group(1)),'s':m.group(2),'o':[]}; out.append(cur); continue
        if cur is None: continue
        if len(t)<4 or not re.search(r'[a-z]{3}',t): continue
        if cur['o']: 
            if len(cur['o'])<5 and t[0].islower(): cur['o'][-1]+=' '+t
        else: cur['s']+=' '+t
    for q in out: q['s']=clean(q['s']); q['o']=[clean(x) for x in q['o']]
    return out
if __name__=='__main__':
    for f in sys.argv[1:]:
        qs=parse(f); print('==',f,len(qs))
        for q in qs: print(f" {q['n']}. {q['s'][:110]}"); [print('     -',x[:100]) for x in q['o']]
