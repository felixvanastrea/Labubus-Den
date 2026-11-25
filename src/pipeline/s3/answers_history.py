# EFM2 S3 art, culture and history of medicine: the history part (H1-H25) of the June 2023 exam, from Pr Fourtassi's
# History of medicine deck (parts 1-3 read in full; the rest of the 31 MB deck didn't come through, so H14-H25 lean on
# Duffin's History of Medicine, the deck's stated source). H11, H16, H19, H21 left until the slides settle them.
import json, os
D = '/home/claude/efm3-mcq-bank/src/sem/efm2-s3/'
LEC = {'hist-med': 'History of medicine (Pr Fourtassi)'}
A = {
 'H1': ('E', ['True: the slides credit him with great discoveries in neuroanatomy.', 'True: he experimented on animals.',
   'True: he observed humans (gladiators) even though human dissection was forbidden.', 'True: Galen was physician of gladiators.',
   'Not true, so this is the answer: medieval Europe took Galen as the reference; his ideas suited the Church.']),
 'H2': ('D', ['In Antiquity human dissection was forbidden and anatomy little used by practitioners.', 'In the early modern period anatomy was an art, seen as useless to medicine.',
   'Medieval Europe allowed dissection only on executed criminals, and Galen was the reference.',
   'Yes: in modern history diseases became anatomical (percussion, auscultation) and anatomy chairs entered every medical school.',
   'The Renaissance brought great drawings (Vesalius, Da Vinci), not anatomy as the key to disease.']),
 'H3': ('B', ['Not the reason given.', 'Yes: the trade in fresh bodies led to murders (Burke and Hare), hence the anatomy laws.',
   'By then the Church was not the obstacle.', 'Art and anatomy belong to the Renaissance.', 'Not a reason on the slides.']),
 'H4': ('C', ['Empiricism is a method of inquiry: knowledge by pure observation.', 'Holism is not on the slides.',
   'Yes: mechanism explains life by physical and chemical forces, existence as tangible matter.', 'Positivism uses numbers and correlations.',
   'Vitalism is the opposite: peculiar life forces not reduced to physics.']),
 'H5': ('A', ['Yes: empiricism is knowledge through pure observation, with no higher purpose.', 'Mechanism is a concept of life, not a method.',
   'Positivism relies on measurement, numbers and correlations.', 'Teleology is the doctrine of causes and purpose.', 'Theology is not a method of physiology.']),
 'H6': ('B', ['Not a humour.', 'Yes: phlegm is one of the four humours with blood, yellow bile and black bile.', 'Not a humour.', 'Not a humour.', 'Not a humour.']),
 'H7': ('B', ['Galen: blood is formed in the liver.', 'Not Galen, so this is the answer: Ibn Nafis described the pulmonary circulation in the 13th century.',
   'Galen: each organ had faculties in a teleological framework.', 'Galen: life is the strength of three forces (natural, vital, animal spirits).',
   'Galen postulated pores in the heart.']),
 'H8': ('E', ['Supernatural explanations are the opposite of positivism.', 'Mind-body dualism is Descartes.', 'The doctrine of causes is teleology.',
   'Church rules are not science.', 'Yes: positive knowledge measures, using numbers and correlations.']),
 'H9': ('C', ['No.', 'No.', 'Yes: the Nuremberg code (1947) came from the trial of Nazi doctors.', 'No.', 'No.']),
 'H10': ('E', ['A function: explain suffering.', 'A function: identify the ailment (diagnosis).', 'A function: justify treatment.',
   'A function: predict outcomes (prognosis).', 'Not one of them, so this is the answer.']),
 'H12': ('A', ['Yes: with pathology moving to the morgue, anatomical lesions explained disease and anatomy became clinically useful.',
   'Epidemiology grew with statistics, not with pathology.', 'Pharmacology is not the field meant.', 'Physiology was already linked to disease.', 'Not on the slides.']),
 'H13': ('C', ['True of germ theory: the lab coat came with it.', 'True: the microscope made germs visible.',
   'Not true, so this is the answer: germ theory is ontological (an outside cause the patient has), not physiological.',
   'True: Pasteur, Koch and Lister converged on it.', 'True: bacteriology became its own discipline.']),
 'H14': ('D', ['That is similia similibus curantur (homeopathy).', 'No.', 'No.',
   'Yes: contraria contrariis curantur means opposites are cured by opposites (cool a fever, dry the wet).', 'One option is right.']),
 'H15': ('E', ['Antidotes (theriac) go back to Antiquity.', 'Bloodletting was used since Antiquity.', 'Diet was a main remedy in Antiquity.',
   'Exercise was prescribed in Antiquity.', 'Not used then, so this is the answer: metals came with Paracelsus in the Renaissance.']),
 'H17': ('D', ['Anaesthetics are 19th century.', 'Not a magic bullet of the time.', 'Aspirin dates from 1899.',
   'Yes: insulin (Banting, Best, Collip, 1922) was hailed as a magic bullet.', 'Steroids came later and were not the one meant.']),
 'H18': ('E', ['No.', 'No.', 'Germany was where thalidomide was made.', 'No.',
   'Yes: the USA was spared because the FDA (Frances Kelsey) refused the licence.']),
 'H20': ('A', ['Yes: the Black Death (bubonic plague) killed about a third of Europe in the 14th century.', 'Cholera came in the 19th century.',
   'Leprosy was endemic, not a sudden killer.', 'Not the medieval one.', 'Syphilis came at the end of the 15th century.']),
 'H22': ('A', ['Yes: blaming the victims (lifestyle) delayed the investigation of AIDS.', 'No.', 'No.', 'No.', 'No.']),
 'H23': ('E', ['No.', 'No.', 'No.', 'No.', 'Yes: the 1959 Meknes poisoning came from cooking oil mixed with aircraft engine oil.']),
 'H24': ('E', ['Fleming discovered penicillin.', 'Ruska built the electron microscope.', 'Collip helped purify insulin.',
   'Laennec invented the stethoscope.', 'Yes: Wilhelm Röntgen discovered X-rays in 1895.']),
 'H25': ('C', ['No.', 'Compensation applied to slaves, not to free men.', 'Yes: the Code of Hammurabi cut off the surgeon’s hands.', 'No.', 'No.']),
}
ans = json.load(open(D + 'answers.json')) if os.path.exists(D + 'answers.json') else {}
ex = json.load(open(D + 'explanations.json'))
for k, t in LEC.items():
    ex['lectures'].setdefault(k, {'title': t, 'added': '2026-11-25'})
for sid, (key, lines) in A.items():
    ans[sid] = {'key': key, 'by': 'lecture', 'lecture': 'hist-med'}
    ex['questions'][sid] = dict({'lecture': 'hist-med'}, **{'ABCDE'[i]: l for i, l in enumerate(lines)})
json.dump(ans, open(D + 'answers.json', 'w'), ensure_ascii=False, indent=1)
json.dump(ex, open(D + 'explanations.json', 'w'), ensure_ascii=False, indent=2)
print(len(ans), 'answers')
