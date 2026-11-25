import json, re, sys
sys.path.insert(0,'/home/claude/work/s3')
import importlib, s3concepts; importlib.reload(s3concepts)
C=s3concepts.C
RX={c[0]:re.compile(c[5],re.I) for c in C}
LECT={c[0]:c[6] for c in C}
def tag(q, mod):
    cs=[c for c in C if c[1]==mod]
    stem=q['s']+' '+(q.get('case') or '')
    opts=' '.join(q['o'])
    a=[c[0] for c in cs if RX[c[0]].search(stem)]
    b=[c[0] for c in cs if c[0] not in a and RX[c[0]].search(opts)]
    return (a+b)[:4]
