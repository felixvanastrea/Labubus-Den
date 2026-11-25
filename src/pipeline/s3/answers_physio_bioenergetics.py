# EFM2 S3 physiology, Pr Dinh-Xuan's bioenergetics lectures 1-3 (25 November 2026), from the slides in Abi's Drive.
import json, os
D = '/home/claude/efm3-mcq-bank/src/sem/efm2-s3/'
LEC = {'bio-1': 'Bioenergetics 1: Introduction (Pr Dinh-Xuan)', 'bio-2': 'Bioenergetics 2: Regulation of energy metabolism (Pr Dinh-Xuan)',
       'bio-3': 'Bioenergetics 3: Lipids metabolism (Pr Dinh-Xuan)'}
A = {
 'P60': ('AC', 'bio-1', ['Yes: carbohydrates are macronutrients, eaten in large amounts.', 'CO2 is a waste product, not a nutrient.',
   'Yes: proteins are macronutrients.', 'Vitamins are micronutrients, needed in small amounts.']),
 'P61': ('AD', 'bio-1', ['Yes: minerals are micronutrients.', 'Water is a macronutrient on the slides.', 'Carbohydrates are macronutrients.',
   'Yes: vitamins are micronutrients.']),
 'P62': ('AD', 'bio-3', ['Yes: a triglyceride is three fatty acids on a glycerol backbone.', 'Triglycerides are themselves lipids (fats), made of glycerol and fatty acids.',
   'Cholesterol is a lipid (a sterol), not a building block of fats.', 'Yes: glycerol is the backbone of triglycerides.']),
 'P63': ('ACD', 'bio-2', ['Yes: starch is a glucose polymer we digest.', 'No: cellulose is a glucose polymer we cannot digest (no enzyme).',
   'Yes: maltose (glucose + glucose) is split by maltase.', 'Yes: sucrose (glucose + fructose) is split by sucrase.']),
 'P64': ('BC', 'bio-3', ['No: that describes carbohydrates; being hydrophobic makes fat compact.',
   'Yes: fat is less oxidized (more reduced) than carbohydrate, so it holds more energy, 9 kcal/g against 4.',
   'Yes: a well-nourished adult meets 80 to 90% of resting energy needs from fat.', 'No: it is the reverse, about 15% in men and 25% in women.']),
 'P65': ('AC', 'bio-2', ['Yes: the Krebs cycle runs in the mitochondrial matrix.', 'No: glycolysis happens in the cytoplasm.',
   'Yes: the electron transport chain sits in the inner mitochondrial membrane.', 'No: pyruvate is made by glycolysis, in the cytoplasm.']),
 'P66': ('ABC', 'bio-1', ['Yes: too much of some vitamins (the fat-soluble ones above all) is harmful.',
   'Yes: vitamins are micronutrients, needed only in small quantities.', 'Yes: carbohydrates are the major source of energy.',
   'No: proteins mostly build and repair; they are not the main fuel.']),
 'P67': ('BCD', 'bio-2', ['No: glycolysis does not need oxygen.', 'Yes: aerobic respiration is the matrix and membrane reactions of the mitochondria.',
   'Yes: the Krebs cycle is part of aerobic respiration.', 'Yes: oxygen is the final electron acceptor, forming water.']),
 'P68': ('ABC', 'bio-2', ['Yes: ribose and deoxyribose form the backbone of nucleic acids.', 'Yes: carbohydrates are major sources of energy.',
   'Yes: they are cellular structural components.']),
}
ans = json.load(open(D + 'answers.json')) if os.path.exists(D + 'answers.json') else {}
ex = json.load(open(D + 'explanations.json'))
for k, t in LEC.items():
    ex['lectures'].setdefault(k, {'title': t, 'added': '2026-11-25'})
for sid, (key, lec, lines) in A.items():
    ans[sid] = {'key': key, 'by': 'lecture', 'lecture': lec}
    ex['questions'][sid] = dict({'lecture': lec}, **{'ABCDE'[i]: l for i, l in enumerate(lines)})
json.dump(ans, open(D + 'answers.json', 'w'), ensure_ascii=False, indent=1)
json.dump(ex, open(D + 'explanations.json', 'w'), ensure_ascii=False, indent=2)
print(len(ans), 'answers')
