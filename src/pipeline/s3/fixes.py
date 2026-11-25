import json, re
S=json.load(open('final_sets.json'))
def find(label): return next(s for s in S if s['label']==label)
def q_by(s, start):
    return next(q for q in s['qs'] if q['s'].startswith(start))
# footers of the Notion exports caught in a stem or an option
for s in S:
    for q in s['qs']:
        q['o']=[re.sub(r'\s*Prof\.? [A-Z][a-z]+.{0,25}Midterm Q&A.*$','',o).strip() for o in q['o']]
        q['s']=re.sub(r'\s*Prof\.? [A-Z][a-z]+.{0,25}Midterm Q&A.*$','',q['s']).strip()
        q['o']=[o for o in q['o'] if o]
b=find('Finals 2023–2024 · Clinical biochemistry')
qs=b['qs']; out=[]
for q in qs:
    if q['s'].startswith('It is recommended to protect, from light rays'):
        out.append(dict(q,o=q['o'][:4])); out.append(dict(q,s='Variation in one of the following parameters causes a variation in serum calcium:',o=q['o'][5:9])); continue
    if q['s'].startswith('Uric acid'):
        q['o']=['Is synthesized by the kidney','Its serum concentration increases in cases of renal failure','Its concentration in the blood does not vary depending on diet','Is a final catabolite of purine bases']
    if q['s'].startswith('Among the causes of hemolysis'):
        q['o']=q['o'][:2]+['Delivery of the blood sample to the laboratory one hour after its collection','Blood sampling from a small vein']
    if q['s'].startswith('Concerning iodides'):
        q['o']=['They are internalized into follicular cells by passive transport','They are not provided exogenously through food','They are oxidized in the thyrocyte by the thyroid peroxidase enzyme','They are transformed in the thyrocyte into active organic iodine']
    if q['s'].startswith('Bone osteodystrophy'):
        q['o']=q['o'][:2]+['Is linked to the inability to activate vitamin D','Manifested by secondary hypoparathyroidism']
    if q['s'].startswith('0f'):
        q['s']='Each band of the proteinogram, after serum protein electrophoresis, is made up of:'
        if out and out[-1]['o'] and out[-1]['o'][-1].startswith('Each band of the proteinogram'): out[-1]['o']=out[-1]['o'][:-1]
    out.append(q)
for i,q in enumerate(out): q['n']=i+1
b['qs']=out
p=find('Exam · Physiology II (renal, neuro, muscle)')
for q in p['qs']:
    if q['s'].startswith('Indicate the correct answer(s). The kidneys maintain acid-base balance'):
        o=q['o']; q['o']=[o[0], o[1].rstrip()+' HCO3- and H+']+o[3:]
    if q['s'].startswith('In skeletal muscle which of the following events occurs before depolarization'):
        o=q['o']; q['o']=o[:2]+['Uptake of Ca2+ into the SR by Ca2+-adenosine triphosphatase (ATPase)']+o[4:]
c=find('Midterm · Physiology II (Pr Covasa and Pr Tuan, students’ recollection)')
out=[]
for q in c['qs']:
    if q['s'].startswith('Aerobic reactions'):
        out.append(dict(q,o=['Glycolysis','Membranous & Matrix reactions (mitochondrial reactions)','Krebs cycle','O2 is the final acceptor of e-']))
        out.append(dict(q,s='The importance of carbs relies on them:',o=['Backbone of nucleic acid','Major source of energy','Cellular structural components'])); continue
    out.append(q)
for i,q in enumerate(out): q['n']=i+1
c['qs']=out
json.dump(S,open('final_sets.json','w'),ensure_ascii=False,indent=1)
bad=[(s['label'],q['s'][:60],len(q['o'])) for s in S for q in s['qs'] if len(q['o'])>5 or len(q['o'])<2]
print('still odd:',bad); print(sum(len(s['qs']) for s in S))
