import json, re, sys, hashlib, importlib
sys.path.insert(0,'/home/claude/work/s3/scans')
S=json.load(open('master.json'))
DROP={'Finals correction · Anatomy 3','Finals 2023 · Vital functions','Midterm 2023 · Vital functions','Finals · Cardiac semiology','Corrected copy · Clinical biochemistry'}
S=[s for s in S if s['label'] not in DROP]
def scan(mod,label,yr,typ,m,file):
    x=importlib.import_module(m); qs=[]
    for i,t in enumerate(x.Q):
        sec=None
        for k,name in getattr(x,'SEC',[]):
            if i>=k: sec=name
        qs.append(dict(s=t[0],o=t[1],case=(t[2] if len(t)>2 else None),n=i+1,sec=sec))
    S.append(dict(mod=mod,label=label,year=yr,type=typ,file=file,note='transcribed from a scan',qs=qs))
scan('anatomy-3','Retake 2022–2023 · Anatomy 3 (neuroanatomy)','2022-2023','retake','anat3_retake','Anatomy 3 Retake (Feb 2023, scan)')
scan('semiology-1','Retake 2022–2023 · Cardiac and respiratory semiology','2022-2023','retake','semio_cr_retake','Semiology I Cardio/Respiratory Retake (2023, scan)')
scan('semiology-1','Retake 2022–2023 · GI and endocrine semiology','2022-2023','retake','semio_ge_retake','Semiology I Gastro/Endocrinology Retake (2023, scan)')
scan('semiology-1','Midterm 2022–2023 · Semiology I','2022-2023','midterm','semio_mid_2022','Semiology I midterm 7 Dec 2022 (scan)')
scan('vital-first-aid','Retake 2022–2023 · Experimental medicine','2022-2023','retake','expmed_retake','Experimental Medicine Retake (Jan 2023, scan)')
# clearer names for the mixed mocks
for s in S:
    if s['label']=='Mock · Respiratory semiology': s['label']='Mock A · Semiology I'
    if s['label']=='Mock · Cardiac and respiratory semiology': s['label']='Mock B · Semiology I'
    if s['label']=='Mock · Physiology': s['label']='Mock · Physiology'
# within-set word-for-word repeats (a page printed twice)
def norm(q): return re.sub(r'[^a-z0-9]+',' ',(q['s']+' | '+' | '.join(q['o'])).lower()).strip()
for s in S:
    seen=set(); keep=[]
    for q in s['qs']:
        k=norm(q)
        if k in seen: continue
        seen.add(k); keep.append(q)
    if len(keep)!=len(s['qs']): print('dedup in set', s['label'], len(s['qs']),'->',len(keep))
    s['qs']=keep
json.dump(S,open('final_sets.json','w'),ensure_ascii=False,indent=1)
print(len(S),'sets', sum(len(s['qs']) for s in S),'questions')
