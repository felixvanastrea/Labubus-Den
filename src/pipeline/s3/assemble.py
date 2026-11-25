import sys, json, re; sys.path.insert(0,'/home/claude/work/s3')
from extract import *
OCR='/home/claude/work/ocr'
H=re.compile(r'^(Respiratory Semiology.*|Cardiac Semiology.*|GI Semiology.*|Endocrin\w* Semiology.*|Experimental Medicine:?|First [Aa]id:?|→ \d+ .*Qu?e?sts.*)$')
def P2(f, **k):
    L=lines_of(RAW+'/'+f); faq=any('Common questions' in x for x in L[:3])
    qs,_=parse2(L,faq=faq,**k); return good(qs)
def L2(f, **k):
    qs,_=parse2(lines_of(RAW+'/'+f),head=H,faq=False,**k); return good(qs)
sets=[]
def add(mod, label, yr, typ, qs, file, note=''):
    sets.append(dict(mod=mod,label=label,year=yr,type=typ,file=file,note=note,qs=[dict(s=q['s'],o=q['o'],case=q.get('case'),n=i+1,sec=q.get('sec')) for i,q in enumerate(qs)]))
def bysec(qs, sec): return [q for q in qs if q.get('sec') and re.match(sec,q['sec'])]
# Anatomy III
na=P2('anat/NeuroAnat Finals.docx')
add('anatomy-3','Finals · Anatomy 3 (neuroanatomy)',None,'finals',bysec(na,'FINALS ANATOMY 3'),'NeuroAnat Finals.docx')
add('anatomy-3','Finals · Anatomy 4 (head and neck)',None,'finals',bysec(na,'FINALS ANATOMY 4'),'NeuroAnat Finals.docx')
add('anatomy-3','Finals correction · Anatomy 3',None,'finals',L2('anat/ANATOMY 3.pdf'),'ANATOMY 3.pdf')
add('anatomy-3','Mock · Anatomy (neuroanatomy)',None,'mock',P2('anat/Anatomy mock.docx'),'Anatomy mock.docx')
add('anatomy-3','Mock · Anatomy 4 (head and neck)',None,'mock',L2('anat/Mock Exam ANATOMY 4.pdf'),'Mock Exam ANATOMY 4.pdf')
add('anatomy-3','Midterm 2023–2024 · Anatomy 4 (maxillofacial)','2023-2024','midterm',L2('anat/ANATOMY 4 MIDTERM 2023-2024 (maxillofacial).pdf'),'ANATOMY 4 MIDTERM 2023-2024.pdf')
add('anatomy-3','Midterm 2024 · ENT anatomy (Pr Hajij, students’ recollection)','2023-2024','midterm',L2('anat/Prof Hajij Midterm 2024 (ENT).pdf'),'Prof Hajij Midterm (2024).pdf')
for w in ('Fliyou','rghioui'):
    for k in (1,2,3):
        f=f'anat/Anatomy {w} Test {k}.pdf'
        add('anatomy-3',f'Practice test {k} · Neuroanatomy (Pr {w.capitalize()})',None,'quiz',parse_quiz(lines_of(RAW+'/'+f)),f.split('/')[-1])
# Physiology II
pr=P2('physio/Physio Renal + Neuro + Muscle.docx')
add('physiology-2','Exam · Physiology II (renal, neuro, muscle)',None,'finals',pr,'Physio Renal + Neuro + Muscle.docx')
pm=P2('physio/Physio mock.docx')
add('physiology-2','Mock · Physiology',None,'mock',pm,'Physio mock.docx')
add('physiology-2','Midterm · Physiology II (Pr Covasa, students’ recollection)',None,'midterm',L2('physio/Prof Covasa Midterm Q&A.pdf'),'Prof. Covasa Midterm Q&A.pdf')
add('physiology-2','Midterm · Physiology II (Pr Covasa and Pr Tuan, students’ recollection)',None,'midterm',L2('physio/Prof Covasa & Tuan Midterm Q&A.pdf'),'Prof Covasa & Tuan Midterm Q&A (2).pdf')
# Semiology I
add('semiology-1','Finals 2022–2023 · Respiratory and cardiac semiology','2022-2023','finals',L2('semio/Semiology I Cardio-Respiratory.pdf'),'Semiology I - Cardio/Respiratory (Jan 2023)')
add('semiology-1','Finals 2022–2023 · GI and endocrine semiology','2022-2023','finals',L2('semio/Semiology I Gastro-Endocrinology.pdf'),'Semiology I - Gastro/Endocrinology (Jan 2023)')
add('semiology-1','Midterm 2023 · GI semiology','2023-2024','midterm',L2('semio/GI Semiology Midterm 2023.pdf'),'GI Semiology MidTerm 2023')
add('semiology-1','Mock · Respiratory semiology',None,'mock',P2('semio/Semio mock.docx'),'Semio (mock)')
qs,_=parse2([x for x in subprocess.run(['pdftotext','-layout',RAW+'/semio/Mock semio.pdf','-'],capture_output=True,text=True).stdout.split('\n')],head=H,faq=False)
add('semiology-1','Mock · Cardiac and respiratory semiology',None,'mock',good(qs),'Mock semio.pdf')
cd=P2('other/Cardio finals + retake + midterm.docx')
add('semiology-1','Midterm · Cardiac semiology',None,'midterm',bysec(cd,'MIDTERM'),'Cardio (finals + retake + midterm)')
add('semiology-1','Retake · Cardiac semiology',None,'retake',bysec(cd,'SECOND SESSION'),'Cardio (finals + retake + midterm)')
add('semiology-1','Finals · Cardiac semiology',None,'finals',bysec(cd,'FINALS'),'Cardio (finals + retake + midterm)')
# Clinical biochemistry
bf=P2('biochem/Biochem finals + mock.docx')
add('clinical-biochemistry','Finals · Clinical biochemistry',None,'finals',bysec(bf,'FINALS'),'Biochem (finals + mock)')
add('clinical-biochemistry','Mock · Clinical biochemistry',None,'mock',bysec(bf,'MOCK'),'Biochem (finals + mock)')
qs,_=parse_anchor(lines_of(RAW+'/biochem/CLINICAL BIOCHEMISTRY FINAL 2023-2024.pdf'))
add('clinical-biochemistry','Finals 2023–2024 · Clinical biochemistry','2023-2024','finals',qs,'CLINICAL BIOCHEMISTRY FINAL EXAM 2023-2024.pdf')
qs,_=parse_anchor(lines_of(RAW+'/biochem/Clinical biochemistry mcqs 2.pdf'),skip=('Clinical biochemistry mcqs',))
add('clinical-biochemistry','Exam · Clinical biochemistry (set 2)',None,'finals',qs,'Clinical biochemistry mcqs 2.pdf')
add('clinical-biochemistry','Exam · Clinical biochemistry (English version)',None,'finals',L2('biochem/Clinical biochemistry1.pdf'),'Clinical biochemistry1.pdf')
add('clinical-biochemistry','Mock · Clinical biochemistry (30 May)',None,'mock',L2('biochem/Mock Exam CLINICAL BIOCHEM 3005.pdf'),'Mock Exam CLINICAL BIOCHEM. on 3005.pdf')
add('clinical-biochemistry','Midterm · Clinical biochemistry (Pr Kamal, students’ recollection)',None,'midterm',L2('biochem/ProfKamalBiochem.pdf'),'ProfKamalBiochem.pdf')
add('clinical-biochemistry','Corrected copy · Clinical biochemistry',None,'finals',P2('biochem/Clinical_Biochemistry_MCQ_Rewritten.docx'),'Clinical_Biochemistry_MCQ_Rewritten.docx')
# Vital functions and first aid
add('vital-first-aid','Finals 2022–2023 · Experimental medicine','2022-2023','finals',L2('vital/Experimental Medicine.pdf'),'Experimental Medicine (Jan 2023)')
add('vital-first-aid','Finals 2022–2023 · First aid','2022-2023','finals',L2('vital/First Aid.pdf'),'First Aid (Jan 2023)')
qs,_=parse2(lines_of(OCR+'/First Aid Retake.txt'),head=H,faq=False)
add('vital-first-aid','Retake 2022–2023 · First aid','2022-2023','retake',good(qs),'First Aid - Retake (Jan 2023)')
add('vital-first-aid','Midterm 2023–2024 · Experimental medicine','2023-2024','midterm',L2('vital/Medex Midterm.pdf'),'Medex Midterm (Oct 2023)')
vm=P2('vital/Vital func + first aid Mock + Midterm.docx')
add('vital-first-aid','Mock · Vital functions and first aid',None,'mock',bysec(vm,'Mock'),'Vital func + first aid (Mock + Midterm)')
add('vital-first-aid','Midterm · Vital functions',None,'midterm',bysec(vm,'Midterm'),'Vital func + first aid (Mock + Midterm)')
v23=P2('vital/Vital func 2023 Finals + midterm.docx')
add('vital-first-aid','Finals 2023 · Vital functions',None,'finals',bysec(v23,'Finals'),'Vital func 2023 (Finals + midterm)')
add('vital-first-aid','Midterm 2023 · Vital functions',None,'midterm',bysec(v23,'Midterm'),'Vital func 2023 (Finals + midterm)')
json.dump(sets,open('master.json','w'),ensure_ascii=False,indent=1)
for s in sets: print(f"{len(s['qs']):3d}  {s['mod']:22s} {s['label']}")
print('total',sum(len(s['qs']) for s in sets))
