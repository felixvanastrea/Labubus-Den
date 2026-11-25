# EFM2 S3 physiology, renal lectures 1-5 (25 November 2026): answers from the slides in Abi's Drive
# (S3 lectures > Physiology 2), written into answers.json and explanations.json.
import json
D = '/home/claude/efm3-mcq-bank/src/sem/efm2-s3/'
LEC = {'ren-1': 'Renal physiology 1: Introduction', 'ren-2': 'Renal physiology 2: Physiology of the nephron',
       'ren-3': 'Renal physiology 3: Glomerular filtration', 'ren-4': 'Renal physiology 4: Regulation of GFR',
       'ren-5': 'Renal physiology 5: Tubular reabsorption'}
A = {
 'P1': ('ABCD', 'ren-1', ['Yes: urea, uric acid and creatinine are removed.', 'Yes: the kidneys clear hormones from the blood.',
        'Yes: toxic substances are among the exogenous chemicals removed.', 'Yes: therapeutic medications are exogenous chemicals the kidneys remove.',
        'No: blood cells are too big to pass the filter; red cells in urine are abnormal (hematuria).']),
 'P2': ('ACDE', 'ren-1', ['Yes: urea, made by the liver from ammonia, is the main nitrogenous waste.',
        'No: glucose in urine (glucosuria) is abnormal; all filtered glucose is normally reabsorbed.',
        'Yes: creatinine, from creatine phosphate breakdown, is a normal waste.', 'Yes: uric acid, from nucleic acid breakdown, is a normal waste.',
        'Yes: the kidneys regulate electrolytes, so sodium is normally excreted.']),
 'P3': ('ABD', 'ren-1', ['Abnormal: albumin in urine is albuminuria.', 'Abnormal: glucose in urine is glucosuria.',
        'Normal: sodium is an electrolyte the kidneys excrete every day.', 'Abnormal: red cells in urine is hematuria.',
        'Normal: potassium is an electrolyte the kidneys excrete every day.']),
 'P4': ('ABD', 'ren-1', ['Yes: osmolarity is on the slide for blood homeostasis.', 'Yes: blood volume and pressure are on the slide for blood homeostasis.',
        'No: calcitriol synthesis is listed under general (whole-body) homeostasis, not blood homeostasis.',
        'Yes: electrolyte concentrations are on the slide for blood homeostasis.',
        'No: gluconeogenesis in starvation is listed under general homeostasis, not blood homeostasis.']),
 'P46': ('BCD', 'ren-1', ['No: gluconeogenesis is listed under general (whole-body) homeostasis, not blood homeostasis.',
        'Yes: blood volume and pressure are on the slide for blood homeostasis.', 'Yes: electrolyte concentrations are on the slide for blood homeostasis.',
        'Yes: blood volume is on the slide for blood homeostasis.']),
 'P47': ('ABD', 'ren-1', ['Yes: toxic substances are among the exogenous chemicals removed.', 'Yes: urea, uric acid and creatinine are removed.',
        'No: blood cells are not filtered; red cells in urine are abnormal.', 'Yes: the kidneys clear hormones from the blood.']),
 'P48': ('BC', 'ren-1', ['No: glucose is filtered but all of it is normally reabsorbed; in urine it is abnormal.',
        'Yes: uric acid, from nucleic acid breakdown, is a waste the kidneys remove.', 'Yes: creatinine, from creatine phosphate breakdown, is a waste the kidneys remove.',
        'No: albumin is held back by the negatively charged filter; in urine it is abnormal.']),
 'P49': ('ABC', 'ren-1', ['Yes: the kidneys regulate blood volume and pressure.', 'Yes: they regulate acid-base balance (H+ and HCO3-).',
        'Yes: they regulate osmolarity.', 'No: PaCO2 is set by breathing, the lungs, not the kidneys.']),
 'P5': ('ABCE', 'ren-3', ['Yes: GFR is about 2 mL per second, 120 mL per minute.', 'Yes: about 170 L a day, which is the body fluids filtered about 4 times a day.',
        'Yes: of 120 mL/min filtered, 119 are reabsorbed and about 1 mL becomes urine.', 'No: ADH reduces urine by increasing water reabsorption in the collecting duct, not by lowering filtration.',
        'Yes: molecules under 3 nm (glucose, nitrogenous wastes) pass freely through the filter.']),
 'P6': ('ABCD', 'ren-5', ['Yes: glucose is small (under 3 nm) and passes the filter freely.', 'Yes: normally all filtered glucose is reabsorbed.',
        'Yes: glucose is co-transported with Na+ by SGLT proteins.', 'Yes: basal Na+–K+ pumps push Na+ out so it does not build up in the cells.',
        'No: glucosuria comes when blood glucose is too high and the carriers are saturated, not when it is low.']),
 'P7': ('AD', 'ren-4', ['Yes: ADH is made in the hypothalamus and released by the posterior pituitary.', 'No: ADH (vasopressin) is a vasoconstrictor.',
        'No: ADH does not act on filtration.', 'Yes: it inserts aquaporins so more water is reabsorbed.',
        'No: ADH acts on the collecting duct, not the proximal tubule.']),
 'P8': ('ACE', 'ren-4', ['Yes: renin starts the chain to angiotensin II, a potent vasoconstrictor.', 'No: ACE inhibitors block angiotensin II formation, so they lower pressure.',
        'Yes: aldosterone makes the DCT and collecting duct reabsorb Na+ and water, raising plasma volume.', 'No: diuretics increase urine and lower plasma volume.',
        'Yes: ADH increases water reabsorption and constricts vessels.']),
 'P9': ('AE', 'ren-4', ['Yes: ACE inhibitors stop angiotensin II, so vessels dilate and less aldosterone is made.', 'No: renin leads to angiotensin II, a vasoconstrictor.',
        'No: angiotensin II is a potent vasoconstrictor.', 'No: ADH increases water reabsorption and plasma volume.',
        'Yes: ANP dilates vessels and makes the kidneys lose Na+ and water.']),
 'P10': ('ACDE', 'ren-4', ['Yes: renin leads to angiotensin II and aldosterone.', 'No: inulin is a marker used to measure GFR; it has no effect on pressure.',
        'Yes: angiotensin II is a potent vasoconstrictor raising blood pressure.', 'Yes: aldosterone raises Na+ and water reabsorption, so volume and pressure rise.',
        'Yes: ADH raises water reabsorption and constricts vessels.']),
}
ans = json.load(open(D + 'answers.json')) if __import__('os').path.exists(D + 'answers.json') else {}
ex = json.load(open(D + 'explanations.json'))
for k, t in LEC.items():
    ex['lectures'].setdefault(k, {'title': t, 'added': '2026-11-25'})
for sid, (key, lec, lines) in A.items():
    ans[sid] = {'key': key, 'by': 'lecture', 'lecture': lec}
    e = {'lecture': lec}
    for i, l in enumerate(lines):
        e['ABCDE'[i]] = l
    ex['questions'][sid] = e
json.dump(ans, open(D + 'answers.json', 'w'), ensure_ascii=False, indent=1)
json.dump(ex, open(D + 'explanations.json', 'w'), ensure_ascii=False, indent=2)
print(len(ans), 'answers')
