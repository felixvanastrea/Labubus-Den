"""Topic dictionary + tagger for the EFM3 bank.

Each concept: (id, module, name, synonyms, abbreviations, parent)
  synonyms      -> used to tag questions AND to match search queries (whole-word, accent/case-insensitive)
  abbreviations -> search-only aliases (too short/ambiguous to tag with: "IDM", "EP", "FA"...)
"""
import json
import re
import unicodedata
from collections import Counter, defaultdict

D, S, R, C, E, T = 'digestive-system-disease', 'dermatology', 'respiratory-system-diseases', \
    'cardio-vascular-system-disease', 'endocrinology', 'technical-communication'

CONCEPTS = [
    # ---------------- RESPIRATORY ----------------
    ('R.pneumonia', R, 'Pneumonia (all types)', ['pneumonia', 'pneumonias', 'pneumopathy', 'pneumopathie', 'pneumonie', 'lower respiratory tract infection'], ['pneumo'], None),
    ('R.cap', R, 'Community-acquired & lobar pneumonia', ['community acquired pneumonia', 'community-acquired pneumonia', 'acute lobar pneumonia', 'lobar pneumonia', 'typical pneumonia', 'pneumococcal pneumonia', 'pneumococcus', 'streptococcus pneumoniae', 'streptococcus pneumonia', 'crb 65', 'crb65', 'crb-65', 'curb 65', 'curb-65', 'mortality risk factors of pneumonia', 'pneumonia in the elderly', 'pneumonie communautaire', 'pneumonie franche lobaire aigue'], ['cap', 'pflа', 'pfla', 'pac'], 'R.pneumonia'),
    ('R.atypical', R, 'Atypical pneumonia', ['atypical pneumonia', 'atypical pneumonias', 'mycoplasma', 'chlamydia psittaci', 'chlamydia psittacci', 'legionella', 'rickettsiae', 'pneumonie atypique'], [], 'R.pneumonia'),
    ('R.viral', R, 'Viral pneumonia & influenza', ['viral pneumonia', 'viral pneumonias', 'influenza', 'myxovirus', 'grippe'], ['flu'], 'R.pneumonia'),
    ('R.covid', R, 'COVID-19', ['covid', 'covid-19', 'covid 19', 'sars-cov-2', 'sars cov 2', 'coronavirus'], [], 'R.pneumonia'),
    ('R.nosocomial', R, 'Nosocomial pneumonia', ['nosocomial pneumonia', 'nosocomial infection', 'nosocomial infections', 'hospital acquired pneumonia', 'hospital-acquired pneumonia', 'ventilator associated', 'pneumonie nosocomiale', 'nosocomial'], ['hap', 'vap', 'pavm'], 'R.pneumonia'),
    ('R.aspiration', R, 'Aspiration pneumonia', ['aspiration pneumonia', 'inhalation pneumonia', "pneumopathie d'inhalation", 'pneumopathie d inhalation'], [], 'R.pneumonia'),
    ('R.abscess', R, 'Lung & amoebic abscess', ['lung abscess', 'pulmonary abscess', 'abces pulmonaire', 'amoebic abscess', 'amebic abscess', 'amoebic', 'amoebiasis'], [], 'R.pneumonia'),
    ('R.bronchitis', R, 'Acute bronchitis', ['acute bronchitis', 'bronchite aigue', 'most common acute lower respiratory tract infection', 'alrti'], [], None),
    ('R.copd', R, 'COPD (BPCO)', ['copd', 'bpco', 'chronic obstructive pulmonary disease', 'chronic bronchitis', 'emphysema', 'emphyseme', 'gold', 'laba', 'lama', 'laba-lama', 'bronchite chronique', 'lung volume reduction', 'endobronchial valve', 'one-way valves', 'hyperinflation'], [], None),
    ('R.asthma', R, 'Asthma', ['asthma', 'asthme', 'asthmatic', 'status asthmaticus', 'acute severe asthma'], [], None),
    ('R.tb', R, 'Tuberculosis (all forms)', ['tuberculosis', 'tuberculose', 'tuberculous', 'tb', 'koch', 'mycobacterium tuberculosis', 'tuberculin', 'igra', 'bcg', 'anti-tuberculosis', 'antibacillary', 'anti-bacillary', 'anti bacillary'], ['bk', 'tst', 'idr'], None),
    ('R.tb-primary', R, 'Primary TB infection', ['primary tuberculosis infection', 'primary tuberculous infection', 'primary tb infection', 'primary tuberculosis', 'primo infection', 'primo-infection', 'primo infection tuberculeuse', 'latent primary infection', 'tuberculosis infection', 'ghon', 'tuberculin conversion', 'erythema nodosum', 'ganglio-bronchial', 'ganglio bronchial'], ['pti', 'pit', 'pit ', 'pio'], 'R.tb'),
    ('R.tb-common', R, 'Common pulmonary TB', ['common pulmonary tuberculosis', 'common pulmonary tb', 'tuberculose pulmonaire commune', 'reactivation tuberculosis', 'reactivation tb', 'cavitary form'], ['tpc'], 'R.tb'),
    ('R.tb-miliary', R, 'Miliary TB', ['miliary', 'miliaire', 'miliary tuberculosis', 'miliary tb'], [], 'R.tb'),
    ('R.tb-caseous', R, 'Caseous pneumonia', ['caseous pneumonia', 'pneumonie caseeuse', 'acute forms of tuberculosis', 'acute pulmonary tb forms'], [], 'R.tb'),
    ('R.tb-drugs', R, 'TB drugs & treatment', ['rifampicin', 'rifampicine', 'ethambutol', 'isoniazid', 'isoniazide', 'pyrazinamide', '2rhze', '2rhz', '2rhze/4rh', '2rhze/7rh', 'rhze', 'anti-tuberculosis treatment', 'anti tuberculosis treatment', 'therapeutic regimen'], [], 'R.tb'),
    ('R.tb-bk', R, 'Mycobacterium tuberculosis (BK)', ['mycobacterium tuberculosis', 'mycobacterium tb', 'mt hominis', 'tb hominis', 'koch bacillus', 'allergic reaction induced by bk', 'concerning bk'], [], 'R.tb'),
    ('R.tb-prev', R, 'TB prevention & programs', ['prevention of tuberculosis', 'bcg vaccination', 'new pulmonary tuberculosis cases', 'contagious tuberculosis'], [], 'R.tb'),
    ('R.hiv', R, 'Lung infections in HIV/AIDS', ['aids', 'hiv', 'pneumocystis', 'pneumocystosis', 'toxoplasmosis', 'opportunistic'], ['sida', 'pcp', 'vih'], None),
    ('R.pleural', R, 'Pleural effusion (pleurisy)', ['pleurisy', 'pleural effusion', 'pleural effusions', 'pleuresie', 'epanchement pleural', 'thoracentesis', 'serofibrinous', 'transudative', 'exudative', 'pleural fluid', 'pleuritis'], [], None),
    ('R.pleural-tb', R, 'Tuberculous pleurisy', ['tuberculous pleurisy', 'pleuresie tuberculeuse', 'pleural tuberculosis', 'tuberculous origin'], [], 'R.pleural'),
    ('R.pleural-malig', R, 'Malignant pleurisy & mesothelioma', ['malignant pleurisy', 'malignant pleural effusion', 'malignant origin', 'malignancy characteristics of a pleurisy', 'malignancy characteristics of pleurisy', 'mesothelioma', 'mesotheliome', 'pleurodesis', 'indwelling pleural catheter'], [], 'R.pleural'),
    ('R.empyema', R, 'Purulent pleurisy (empyema)', ['purulent pleurisy', 'empyema', 'pleuresie purulente', 'pyothorax', 'anaerobic pleuritis', 'parapneumonic', 'decortication', 'gram-negative bacilli', 'loculated'], [], 'R.pleural'),
    ('R.pneumothorax', R, 'Pneumothorax', ['pneumothorax', 'pyopneumothorax', 'pyo-pneumothorax', 'pleural drainage', 'pleural symphysis', 'tension pneumothorax', 'lung re-expansion', 're-expand'], ['ptx'], None),
    ('R.trauma', R, 'Chest trauma', ['chest trauma', 'thoracic trauma', 'rib fracture', 'rib fractures', 'flail chest', 'hemothorax', 'massive hemothorax', 'pulmonary contusion', 'tracheobronchial injury', 'blunt trauma', 'blunt chest trauma', 'polytrauma', 'trauma patient', 'post-traumatic pneumothorax', 'traumatisme thoracique', 'motor vehicle collision'], [], None),
    ('R.cancer', R, 'Lung cancer', ['lung cancer', 'bronchogenic carcinoma', 'bronchogenic cancer', 'bronchial carcinoma', 'bronchial cancer', 'bronchial adenocarcinomas', 'squamous cell bronchial carcinoma', 'cancer bronchopulmonaire', 'non-small cell', 'small cell bronchial carcinoma', 'small cell', 'tnm', 'egfr', 'lung mass', 'lung tumor', 'carcinoid', 'paraneoplastic', 'lung nodule', 'pulmonary nodule', 'peripheral lung nodule', 'lung adenocarcinoma', 'metastatic lung'], ['cbp', 'nsclc', 'sclc', 'cpc', 'cbnpc'], None),
    ('R.surgery', R, 'Thoracic surgery & procedures', ['vats', 'thoracotomy', 'lobectomy', 'pneumonectomy', 'wedge resection', 'segmentectomy', 'sleeve resection', 'mediastinoscopy', 'endobronchial ultrasound', 'navigational bronchoscopy', 'robotic bronchoscopy', 'robotic-guided', 'pleuroscopy', 'thoracoscopy', 'cryotherapy', 'cryobiopsy', 'dlco', 'predicted postoperative', 'lung resection', 'lung cancer surgery', 'complete surgery', 'contraindication for surgery', 'contraindications to surgery', 'surgery is contraindicated', 'pre-operative pulmonary assessment', 'rigid bronchoscopy'], ['ebus'], None),
    ('R.mediastinum', R, 'Mediastinal tumors & cysts', ['mediastinal mass', 'mediastinal tumor', 'mediastinal tumors', 'anterior mediastinal', 'thymoma', 'thymomas', 'thymome', 'bronchogenic cyst', 'bronchogenic cysts', 'myasthenia', 'neurogenic tumor'], [], None),
    ('R.hydatid', R, 'Pulmonary hydatid cyst', ['hydatid', 'hydatidosis', 'echinococcus', 'kyste hydatique', 'hydatid cyst', 'capitonnage', 'barrett technique', 'aydin technique'], ['khp'], None),
    ('R.aspergilloma', R, 'Aspergilloma', ['aspergilloma', 'aspergillomas', 'aspergillus', 'aspergillome', 'fungus ball', 'air crescent'], [], None),
    ('R.bronchiectasis', R, 'Bronchiectasis', ['bronchiectasis', 'dilatation des bronches', 'dilated bronchi', 'bronchorrhea'], ['ddb'], None),
    ('R.ild', R, 'Interstitial lung disease', ['interstitial lung disease', 'diffuse interstitial lung disease', 'diffuse infiltrative pneumopathy', 'chronic interstitial lung disease', 'pneumopathie interstitielle', 'usual interstitial pneumonia', 'interstitial syndrome', 'chronic ild'], ['ild', 'dild', 'pid', 'pild'], None),
    ('R.ipf', R, 'Idiopathic pulmonary fibrosis', ['idiopathic pulmonary fibrosis', 'fibrose pulmonaire idiopathique', 'pulmonary fibrosis'], ['ipf', 'fpi'], 'R.ild'),
    ('R.sarcoidosis', R, 'Sarcoidosis', ['sarcoidosis', 'sarcoidose', 'lofgren', "lofgren's"], [], None),
    ('R.hp', R, 'Hypersensitivity pneumonitis', ['hypersensitivity pneumonitis', 'extrinsic allergic alveolitis', "farmer's lung", 'farmers lung', "farmer's lung disease", "bird breeders' disease", 'bird breeders disease', 'bird breeder', 'alveolite allergique extrinseque', 'precipitins'], ['pha', 'aae'], 'R.ild'),
    ('R.pneumoconiosis', R, 'Pneumoconioses (silicosis, asbestosis)', ['pneumoconiosis', 'pneumoconioses', 'silicosis', 'silicose', 'asbestosis', 'asbestose', 'asbestos', 'occupational respiratory'], [], 'R.ild'),
    ('R.ph', R, 'Pulmonary hypertension', ['pulmonary hypertension', 'pulmonary arterial hypertension', 'hypertension pulmonaire'], ['htap', 'pah'], None),
    ('R.osas', R, 'Sleep apnea (OSAS)', ['sleep apnea', 'obstructive sleep apnea', 'sleep apnea-hypopnea', 'apnea-hypopnea', 'snoring', 'apnee du sommeil'], ['osas', 'sahos', 'saos', 'osa'], None),
    ('R.resp-failure', R, 'Respiratory failure', ['respiratory failure', 'acute respiratory failure', 'chronic respiratory failure', 'respiratory insufficiency', 'insuffisance respiratoire', 'acute decompensation'], ['ira', 'irc', 'ards'], None),
    ('R.smoking', R, 'Smoking cessation', ['smoking cessation', 'nicotine replacement', 'sevrage tabagique', 'nicotine'], [], None),
    ('R.hemoptysis', R, 'Hemoptysis', ['hemoptysis', 'hemoptyses', 'hemoptysie', 'bronchial artery embolization'], [], None),

    # ---------------- DIGESTIVE ----------------
    ('D.gerd', D, 'GERD (reflux)', ['gerd', 'gastroesophageal reflux', 'gastro-esophageal reflux', 'gastro-oesophageal reflux', 'reflux disease', 'reflux', 'heartburn', 'pyrosis', 'regurgitation', 'erosive esophagitis', 'ppis in gerd', 'use of ppis'], ['rgo', 'gord'], None),
    ('D.barrett', D, "Barrett's esophagus", ['barrett', 'barett', 'barrett esophagus', 'barett esophagus', 'endobrachyoesophage'], ['ebo'], 'D.gerd'),
    ('D.achalasia', D, 'Achalasia & dysphagia', ['achalasia', 'achalasie', 'dysphagia', 'dysphagie', 'heller', "heller's myotomy", 'endoscopic myotomy', 'esophageal manometry', 'high resolution esophageal manometry', 'high-resolution manometry', 'functional dysphagia', 'balloon dilation'], ['poem'], None),
    ('D.eso-cancer', D, 'Esophageal cancer', ['esophageal cancer', 'oesophageal cancer', 'cancer of the esophagus', 'esophagus cancer', "cancer de l'oesophage", 'squamous cell carcinoma of the esophagus', 'cancer types in the esophagus'], [], None),
    ('D.caustic', D, 'Caustic ingestion', ['caustic', 'caustics', 'caustique', 'zargar', 'di costanzo', 'bleach', 'caustic ingestion', 'caustic ingestions', 'caustic substances'], [], None),
    ('D.peptic', D, 'Peptic ulcer disease', ['peptic ulcer', 'peptic ulcers', 'duodenal ulcer', 'duodenal ulcers', 'gastric ulcer', 'gastroduodenal peptic ulcer', 'ulcere gastroduodenal', 'ulcer pain', 'duodenal peptic ulcer', 'gastric location of ulcer', 'defending factors', 'aggressive factors'], ['ugd'], None),
    ('D.ugib', D, 'Upper GI bleeding', ['upper gi bleeding', 'upper gastrointestinal bleeding', 'peptic ulcer bleeding', 'bleeding duodenal ulcer', 'gi bleeding', 'hematemesis', 'melena', 'esophageal variceal bleeding', 'variceal bleeding', 'forrest', 'omeprazole dose'], ['hdh'], None),
    ('D.hp', D, 'Helicobacter pylori', ['helicobacter', 'helicobacter pylori', 'h. pylori', 'h pylori', 'hp infection', 'hp infections', 'treat hp', 'eradication of h. pylori', 'eradication', 'urea breath test', 'bismuth quadruple', 'quadruple therapy'], ['hp'], None),
    ('D.gastritis', D, 'Gastritis', ['gastritis', 'gastrite', 'autoimmune gastritis', 'autoimmune chronic gastritis', 'atrophic gastritis', 'chronic gastritis', 'acute gastritis', 'phlegmonous'], [], None),
    ('D.gastric-cancer', D, 'Gastric (stomach) cancer', ['gastric cancer', 'stomach cancer', 'cancer gastrique', 'cancer de l estomac', 'linitis', 'gastric linitis', 'total gastrectomy', 'subtotal gastrectomy', 'gastrectomy', 'exploratory laparoscopy', 'peritoneal carcinomatosis'], [], None),
    ('D.celiac', D, 'Celiac disease', ['celiac', 'coeliac', 'celiac disease', 'gluten', 'maladie coeliaque', 'anti transglutaminase', 'anti-transglutaminase', 'transglutaminase', 'villous atrophy', 'endomysium'], [], None),
    ('D.malabsorption', D, 'Malabsorption', ['malabsorption', 'malabsorptive', 'steatorrhea', 'post-absorptive', 'mucosal phase', 'luminal phase', 'oil droplets'], [], None),
    ('D.ibd', D, "IBD (Crohn's & UC)", ['ibd', 'inflammatory bowel disease', 'inflammatory bowel', 'anti-tnf', 'aminosalicylates', 'mesalamine'], ['mici'], None),
    ('D.crohn', D, "Crohn's disease", ['crohn', "crohn's", "crohn's disease", 'crohns', 'maladie de crohn'], [], 'D.ibd'),
    ('D.uc', D, 'Ulcerative colitis', ['ulcerative colitis', 'rectocolite hemorragique', 'rectocolite', 'colectasis'], ['uc', 'rch'], 'D.ibd'),
    ('D.ibs', D, 'Irritable bowel syndrome', ['irritable bowel syndrome', 'irritable bowel', 'colopathie fonctionnelle', 'functional intestinal disorders'], ['ibs', 'sii', 'sci'], None),
    ('D.parasites', D, 'Digestive parasites (Ascaris, Giardia)', ['parasitosis', 'digestive parasitosis', 'ascaris', 'ascariasis', 'giardia', 'giardiasis', 'lamblia', 'lambliasis'], [], None),
    ('D.hepatitis', D, 'Viral hepatitis (all)', ['hepatitis', 'viral hepatitis', 'hepatite', 'hepatites', 'acute hepatitis', 'transaminases', 'fulminant'], [], None),
    ('D.hav', D, 'Hepatitis A', ['hepatitis a', 'viral hepatitis a', 'hav', 'anti-hav', 'igm anti-hav'], ['vha'], 'D.hepatitis'),
    ('D.hbv', D, 'Hepatitis B', ['hepatitis b', 'viral hepatitis b', 'hbv', 'hbs', 'hbsag', 'anti-hbs', 'anti hbs', 'hbs antibodies', 'hepatitis b virus'], ['vhb'], 'D.hepatitis'),
    ('D.hcv', D, 'Hepatitis C', ['hepatitis c', 'viral hepatitis c', 'hcv', 'anti-hcv', 'hcv rna'], ['vhc'], 'D.hepatitis'),
    ('D.hev', D, 'Hepatitis E', ['hepatitis e', 'viral hepatitis e', 'hev'], ['vhe'], 'D.hepatitis'),
    ('D.cirrhosis', D, 'Cirrhosis', ['cirrhosis', 'cirrhose', 'liver cirrhosis', 'child-pugh', 'child pugh', 'hepatocellular failure'], [], None),
    ('D.portal', D, 'Portal hypertension', ['portal hypertension', 'hypertension portale', 'esophageal varices', 'varices', 'collateral venous circulation', 'sub hepatic portal hypertension', 'budd-chiari', 'portal vein'], ['htp'], 'D.cirrhosis'),
    ('D.peritoneal-tb', D, 'Peritoneal & digestive tuberculosis', ['peritoneal tuberculosis', 'tuberculous peritonitis', 'peritoneal tb', 'ascites fluid', 'ascitis fluid', 'adenosin', 'adenosine deaminase', 'deamidated adenosin', 'deaminated adenosine', 'tb contamination routes', 'digestive tract', 'ileocaecal tuberculosis', 'tuberculosis (tb) contamination'], ['ada'], None),
    ('D.hydatid', D, 'Hepatic hydatid cyst', ['hydatid', 'hydatid disease', 'hydatid cyst', 'hydatidosis', 'echinococcus', 'kyste hydatique', 'gharbi', "gharbi's", 'who-iwge', 'cysto-biliary', 'hepatic hydatid', 'liver hydatic cyst', 'hydatic'], ['khf', 'pair'], None),
    ('D.appendicitis', D, 'Acute appendicitis', ['appendicitis', 'appendicite', 'appendix', 'appendiceal', 'appendectomy', 'mcburney', 'appendiceal abscess'], [], None),
    ('D.peritonitis', D, 'Peritonitis & peritoneum', ['peritonitis', 'peritonite', 'peritoneum', 'peritoneal infection', 'mesocolon', 'inframesocolic'], [], None),
    ('D.hernia', D, 'Hernias', ['hernia', 'hernias', 'hernie', 'inguinal hernia', 'incisional hernias', 'evisceration', 'diastasis recti', 'strangulation', 'hernial sac'], [], None),
    ('D.anal', D, 'Anal fissure & abscess', ['anal fissure', 'fissure anale', 'anal abscess', 'abces anal', 'hemorrhoids', 'hemorrhoid', 'proctological', 'lateral anal fissure'], [], None),
    ('D.pancreas', D, 'Pancreatitis & pancreatic cancer', ['pancreatitis', 'chronic pancreatitis', 'pancreatic cancer', 'pancreatite', 'pancreatic exocrine insufficiency'], [], None),
    ('D.biliary', D, 'Biliary disease & cholestasis', ['biliary lithiasis', 'gallstones', 'cholecystitis', 'cholangitis', 'cholestatic jaundice', 'cholestatic', 'cholestasis', 'mrcp', 'biliary'], ['cpre', 'ercp'], None),
    ('D.colon', D, 'Colon polyps & lower GI bleeding', ['colon polyps', 'polyps', 'colonic polyps', 'diverticular bleeding', 'lower gi bleeding', 'colon cancer', 'colorectal'], [], None),

    # ---------------- DERMATOLOGY ----------------
    ('S.scabies', S, 'Scabies', ['scabies', 'gale', 'sarcoptes', 'sarcoptes scabiei', 'scabious', 'infantile scabies', 'crusted scabies', 'permethrin', 'ivermectin'], [], None),
    ('S.lice', S, 'Pediculosis (lice)', ['lice', 'louse', 'head lice', 'pediculosis', 'pediculus', 'pediculose', 'poux', 'nits', 'pediculicide', 'phtirius', 'pthirus'], [], None),
    ('S.fungal', S, 'Fungal infections (tinea, candida)', ['fungal', 'fungal infection', 'fungal infections', 'mycosis', 'mycoses', 'dermatophyte', 'dermatophytes', 'dermatophytosis', 'tinea', 'tinea capitis', 'tinea pedis', 'tinea corporis', 'tinea cruris', 'ringworm', 'teigne', 'onychomycosis', 'candidiasis', 'candida', 'intertrigo', 'pityriasis versicolor', 'achromic pityriasis', 'trichophyton', 'microsporum', 'epidermophyton', 'mycological', 'epidermomycosis', 'erythrasma'], [], None),
    ('S.herpes', S, 'Herpes, zona & varicella', ['herpes', 'hsv', 'herpes simplex', 'herpetic', 'gingivostomatitis', 'zona', 'zoster', 'herpes zoster', 'shingles', 'varicella', 'chickenpox', 'varicelle', 'vzv', 'postherpetic'], [], None),
    ('S.hpv', S, 'HPV, warts & condylomas', ['hpv', 'papillomavirus', 'human papillomavirus', 'wart', 'warts', 'verrue', 'condyloma', 'condylomas', 'condylomata', 'molluscum'], [], None),
    ('S.bacterial', S, 'Bacterial skin infections', ['bacterial skin', 'bacterial infections', 'superficial bacterial infections', 'common bacterial infections', 'pyoderma', 'staphylococcal', 'infectious + bacterial'], [], None),
    ('S.impetigo', S, 'Impetigo', ['impetigo'], [], 'S.bacterial'),
    ('S.folliculitis', S, 'Folliculitis & furuncle', ['folliculitis', 'furuncle', 'boil', 'carbuncle', 'furoncle', 'anthrax'], [], 'S.bacterial'),
    ('S.erysipelas', S, 'Erysipelas & cellulitis', ['erysipelas', 'erysipele', 'eysipelas', 'cellulitis', 'dermo-hypodermatitis', 'dermohypodermitis', 'necrotizing fasciitis'], [], 'S.bacterial'),
    ('S.tb', S, 'Cutaneous tuberculosis', ['cutaneous tuberculosis', 'skin tuberculosis', 'tuberculous lupus', 'lupus vulgaris', 'scrofuloderma', 'tuberculous gumma', 'verrucous tuberculosis', 'vegetative tuberculosis', 'tuberculous chancre', 'tuberculids', 'lichen scrofulosorum', 'periorificial tuberculosis', 'predisposing factors of tuberculosis', 'bk can be inoculated', 'tuberculosis'], [], None),
    ('S.leprosy', S, 'Leprosy', ['leprosy', 'lepre', 'hansen', 'mycobacterium leprae'], [], None),
    ('S.leish', S, 'Cutaneous leishmaniasis', ['leishmaniasis', 'leishmania', 'leishmaniose', 'phlebotomus', 'pentavalent antimony', 'glucantime', 'nnn medium'], [], None),
    ('S.syphilis', S, 'Syphilis & STIs', ['syphilis', 'syphillis', 'treponema', 'treponema pallidum', 'treponemal', 'syphilitic', 'chancre', 'syphilitic chancre', 'soft chancre', 'chancroid', 'tpha', 'vdrl', 'syphilitic roseola', 'roseola', 'neurosyphilis', 'neurological syphilis', 'tabes', 'congenital syphilis', 'extencillin', 'urethritis', 'gonococcus', 'chlamydia trachomatis', 'sexually transmitted', 'unprotected sexual', 'gums', 'genital ulcer', 'bubo'], ['ist', 'sti', 'std', 'mst'], None),
    ('S.acne', S, 'Acne', ['acne', 'acne vulgaris', 'juvenile acne', 'comedones', 'comedo', 'blackheads', 'whiteheads', 'microcysts', 'seborrhea', 'hyperseborrhea', 'isotretinoin', 'retinoids', 'benzoyl peroxide', 'acne conglobata', 'acne fulminans', 'retentional acne', 'inflammatory acne', 'retention acne'], [], None),
    ('S.eczema', S, 'Eczema & dermatitis', ['eczema', 'dermatitis', 'eczematitis'], [], None),
    ('S.atopic', S, 'Atopic dermatitis', ['atopic dermatitis', 'atopic eczema', 'dermatite atopique', 'atopy'], ['da'], 'S.eczema'),
    ('S.contact', S, 'Contact eczema / dermatitis', ['contact dermatitis', 'contact eczema', 'allergic contact dermatitis', 'patch test', 'patch testing', 'nickel', 'chromium', 'henna', 'ppd', 'detergents', 'eczema de contact'], [], 'S.eczema'),
    ('S.urticaria', S, 'Urticaria & angioedema', ['urticaria', 'urticaire', 'hives', 'wheals', 'angioedema', 'quincke', 'cholinergic urticaria', 'chronic urticaria', 'acute urticaria'], [], None),
    ('S.psoriasis', S, 'Psoriasis', ['psoriasis', 'psoriatic', 'guttate psoriasis', 'erythrodermic psoriasis', 'pustular psoriasis', 'plaque psoriasis', 'scalp psoriasis'], [], None),
    ('S.cancer', S, 'Skin cancers & melanoma', ['skin cancer', 'skin cancers', 'melanoma', 'melanome', 'basal cell carcinoma', 'squamous cell carcinoma', 'merkel', 'actinic keratosis', 'keratosis actinic', 'xeroderma pigmentosum', 'abcde', 'sunscreen', 'dermoscopy', 'phototype', 'melanocytes', 'carcinome basocellulaire', 'spinocellulaire', 'sclerodermiform'], ['bcc', 'scc', 'cbc'], None),

    # ---------------- CARDIO-VASCULAR ----------------
    ('C.arf', C, 'Acute rheumatic fever', ['rheumatic fever', 'acute rheumatic fever', 'rhematic fever', 'jones criteria', 'jones criterion', 'major jones', 'jones', 'chorea', "sydenham's chorea", 'sydenham', 'erythema marginatum', 'subcutaneous nodules', 'anti-streptolysin', 'benzathin', 'benzathine', 'secondary prophylaxis', 'group a streptococcal', 'streptococcus pyogenes', 'antigen mimicry', 'throat infection', 'rheumatic heart disease', 'rheumatic valve disease'], ['raa', 'arf', 'aso', 'asl'], None),
    ('C.valves', C, 'Valvular heart disease (all)', ['valvular', 'valvulopathy', 'valvulopathie', 'heart valve'], [], None),
    ('C.ms', C, 'Mitral stenosis', ['mitral stenosis', 'retrecissement mitral', 'opening snap', 'mitral balloon valvotomy', 'percutaneous mitral', 'mitral ballon valvotomy', 'mitral valve area', 'commissurotomy'], ['rm'], 'C.valves'),
    ('C.mr', C, 'Mitral regurgitation', ['mitral regurgitation', 'mitral insufficiency', 'insuffisance mitrale', 'mitral valve prolapse', 'mitral prolapse', 'mitral apparatus', 'cordage rupture', 'papillary muscle rupture'], ['im'], 'C.valves'),
    ('C.as', C, 'Aortic stenosis', ['aortic stenosis', 'retrecissement aortique', 'crescendo-decrescendo', 'aortic valve area', 'calcific degeneration'], ['ra', 'tavi'], 'C.valves'),
    ('C.ar', C, 'Aortic regurgitation', ['aortic regurgitation', 'aortic insufficiency', 'insuffisance aortique', 'bounding pulse', 'wide pulse pressure', 'head bobbing', 'carotid dancing'], ['ia'], 'C.valves'),
    ('C.valve-surgery', C, 'Valve surgery & prostheses', ['aortic valve replacement', 'valve replacement', 'mechanical substitute', 'biological substitute', 'mechanical prosthesis', 'mitral mechanical prosthesis', 'bioprosthesis', 'heart valve surgery', 'mitral valve repair', 'valve repair'], [], 'C.valves'),
    ('C.ie', C, 'Infective endocarditis', ['infective endocarditis', 'endocarditis', 'endocardite', 'infected endocarditis', 'duke criteria', 'modified duke', 'vegetation', 'valvular vegetation', 'janeway', 'osler'], ['ei'], None),
    ('C.htn', C, 'Hypertension', ['hypertension', 'arterial hypertension', 'hypertensive', 'antihypertensive', 'anti-hypertensive', 'blood pressure', 'hypertensive emergency', 'hypertensive urgency', 'secondary hypertension', 'white coat', 'masked', 'ambulatory bp', 'ambulatory blood pressure', 'coarctation of the aorta', 'high blood pressure'], ['hta', 'htn', 'mapa'], None),
    ('C.acs', C, 'Acute coronary syndrome & MI', ['acute coronary syndrome', 'acute coronary syndromes', 'myocardial infarction', 'stemi', 'nstemi', 'st elevation', 'st-elevation', 'non-st elevation', 'non st elevation', 'troponin', 'troponins', 'pardee', 'thrombolysis', 'thrombolytic', 'primary angioplasty', 'reperfusion', 'unstable angina', 'severe chest pain', 'infarction'], ['sca', 'acs', 'idm', 'mi', 'ima'], None),
    ('C.ccs', C, 'Chronic coronary syndrome (stable angina)', ['chronic coronary syndrome', 'chronic coronary syndromes', 'stable angina', 'angor stable', 'ivabradine'], ['ccs'], None),
    ('C.cabg', C, 'Coronary bypass (CABG) & cardiopulmonary bypass', ['cabg', 'coronary artery bypass', 'coronary artery bypass grafting', 'cardio-pulmonary bypass', 'cardiopulmonary bypass', 'cpb', 'three-vessel', 'energy requirements of the beating myocardium', 'beating myocardium'], ['pontage'], None),
    ('C.athero', C, 'Atherosclerosis, lipids & CV risk', ['atherosclerosis', 'atherosclerotic', 'atherome', 'atheroma', 'vulnerable atherosclerotic plaque', 'cardiovascular risk factors', 'risk factors for cvd', 'risks factors for cvd', 'lipid profiles', 'ldl', 'hdl', 'cholesterol', 'dyslipidemia', 'statins', 'pcsk9', 'ezetimibe', 'apoa1', 'apob', 'epidemiology of cardiovascular', 'modifiable risk factors'], ['cvd', 'frcv'], None),
    ('C.hf', C, 'Heart failure', ['heart failure', 'insuffisance cardiaque', 'left heart failure', 'right heart failure', 'right-sided heart failure', 'global heart failure', 'reduced ef', 'sglt2 inhibitors', 'anti-aldosterone', 'decompensation', 'nt-probnp', 'natriuretic', 'cardiac rehabilitation'], ['ic', 'icd', 'icg', 'hfref'], None),
    ('C.cmp', C, 'Cardiomyopathies', ['cardiomyopathy', 'cardiomyopathies', 'cardiomyopathie', 'dilated cardiomyopathy', 'hypertrophic cardiomyopathy', 'restrictive cardiomyopathy', 'peri-partum cm', 'myocarditis', 'hcm', 'dcm', 'rcm'], ['cmd', 'cmh'], None),
    ('C.pericarditis', C, 'Pericarditis', ['pericarditis', 'pericardite', 'acute pericarditis', 'pericardial', 'tamponade', 'cardiac tamponade', 'constriction', 'friction rub'], [], None),
    ('C.arrhythmia', C, 'Arrhythmias', ['arrhythmia', 'arrhythmias', 'arrythmia', 'supraventricular', 'supraventricular tachycardias', 'junctional tachycardia', 'junctional tachyardia', 'torsades de pointe', 'torsade de pointe', 'extrasystoles', 'atrio-ventricular block', 'atrioventricular block', 'this ecg', 'atrial tachycardias', 'tachycardia'], ['tsv', 'bav'], None),
    ('C.af', C, 'Atrial fibrillation & flutter', ['atrial fibrillation', 'atrial flutter', 'flutter', 'cavotricuspid', 'resinusalization'], ['af', 'fa', 'acfa'], 'C.arrhythmia'),
    ('C.chd', C, 'Congenital heart disease & shunts', ['congenital heart', 'congenital cardiopathies', 'left-right shunts', 'left-right shunt', 'left right shunts', 'left right shunt', 'atrial septal defect', 'ventricular septal defect', 'patent ductus arteriosus', 'tetralogy of fallot', 'tetratology of fallot', 'eisenmenger', 'cyanotic', 'congenital pathologies'], ['asd', 'vsd', 'pda', 'cia', 'civ', 'pca'], None),
    ('C.vte', C, 'Venous thromboembolism (all)', ['venous thromboembolism', 'venous thromboembolic', 'venous thrombosis', "virchow's triad", 'virchow', 'wirchow triad', 'wirchow', 'hypercoagulability'], ['vte', 'mtev'], None),
    ('C.dvt', C, 'Deep vein thrombosis', ['deep vein thrombosis', 'deep venous thrombosis', 'phlebitis', 'phlebite', 'homans', 'homans sign', 'calf', 'thrombose veineuse profonde'], ['dvt', 'tvp'], 'C.vte'),
    ('C.pe', C, 'Pulmonary embolism', ['pulmonary embolism', 'embolie pulmonaire', 'massive pulmonary embolism', 'd-dimer', 'd-dimers', 's1q3', 'pulmonary angiography', 'ventilation-perfusion'], ['ep', 'pe'], 'C.vte'),
    ('C.pad', C, 'Peripheral arterial disease & limb ischemia', ['peripheral arterial disease', 'peripheral artery disease', 'arteriopathie', 'claudication', 'critical ischemia', 'fontaine', 'leriche', 'acute limb ischemia', 'acute ischemia of a lower limb', 'acute ischemia with a lower limb', 'embolectomy', 'ankle brachial', 'lower limb of embolic origin'], ['pad', 'aomi', 'abi', 'ips'], None),
    ('C.aorta', C, 'Aortic aneurysm & dissection', ['aneurysm', 'aneurysms', 'aortic aneurysm', 'aortic aneurysms', 'abdominal aortic aneurysm', 'thoracic aortic aneurysm', 'ascending aorta', 'aortic dissection', 'behcet', "behcet's", 'inflammatory aneurysm', 'tearing', 'aneurysm rupture'], ['aaa'], None),
    ('C.mesenteric', C, 'Mesenteric ischemia', ['mesenteric ischemia', 'entero-mesenteric', 'enteric ischemia', 'intestinal angina', 'ischemie mesenterique', 'chronic mesenteric', 'acute mesenteric'], [], None),
    ('C.carotid', C, 'Carotid stenosis', ['carotid', 'carotid stenosis', 'internal carotid artery', 'endarteriectomy', 'endateriectomy', 'carotid artery stenting'], ['cea', 'cas'], None),
    ('C.syncope', C, 'Syncope', ['syncope', 'vasovagal'], [], None),
    ('C.exam', C, 'Cardiac exam & history', ['normal auscultation', 'anamnesis', "patients' medical history", 'key physical signs', 'heart sounds', 'heart sound'], [], None),

    # ---------------- ENDOCRINOLOGY ----------------
    ('E.diabetes', E, 'Diabetes (all)', ['diabetes', 'diabetic', 'diabetes mellitus', 'type 1 diabetes', 'type 2 diabetes', 'hyperglycemia', 'hba1c', 'glycemic', 'glucose-lowering', 'anti-diabetes', 't1d', 't2d', 'diabete'], ['dt1', 'dt2', 'db'], None),
    ('E.dka', E, 'Ketoacidosis & acute diabetes complications', ['ketoacidosis', 'keto-acidosis', 'diabetes keto-acidosis', 'acidocetose', 'acute complications of diabetes', 'hypoglycemia', 'stopped taking her insulin'], ['dka', 'acd'], 'E.diabetes'),
    ('E.dm-tx', E, 'Diabetes treatment (insulin & drugs)', ['insulin', 'insulins', 'basal insulin', 'prandial insulin', 'insulin regimens', 'insulin dosing', 'functional insulin therapy', 'insulin delivery', 'insulin pump', 'metformin', 'glp-1', 'glp1', 'sglt2', 'dpp-4', 'sulfonylureas', 'biguanides', 'anti-diabetes medication'], [], 'E.diabetes'),
    ('E.neuropathy', E, 'Diabetic neuropathy', ['neuropathy', 'diabetic neuropathy', 'autonomic neuropathy', 'cardiovascular autonomic neuropathy', 'digestive autonomic neuropathy', 'gastroparesis', 'charcot', 'monofilament', 'numbness and burning pain', 'tingling and burning pain'], [], 'E.diabetes'),
    ('E.micro', E, 'Diabetic retinopathy & nephropathy', ['retinopathy', 'fundus', 'fundus examination', 'dilated fundus', 'nephropathy', 'diabetic kidney', 'microalbuminuria', 'abnormal urine tests'], [], 'E.diabetes'),
    ('E.dm-cv', E, 'Diabetes & heart / arteries', ['coronary heart disease in diabetic', 'coronary disease in diabetic', 'silent ischemia', 'peripheral artery disease', 'peripheric artery disease', 'ankle-brachial', 'ankle brachial'], [], 'E.diabetes'),
    ('E.gdm', E, 'Diabetes in pregnancy', ['gestational diabetes', 'diabetes in pregnancy', 'diabetes during pregnancy'], [], 'E.diabetes'),
    ('E.exercise', E, 'Physical activity prescription', ['physical activity', 'start exercising', 'exercising', 'aerobic exercise', 'resistance training'], [], None),
    ('E.thyroid', E, 'Thyroid (all)', ['thyroid', 'thyroide', 'tsh', 'free t4', 'goiter', 'goitre'], [], None),
    ('E.hypothyroid', E, 'Hypothyroidism', ['hypothyroidism', 'hypothyroidie', 'levothyroxine', 'myxedema', 'myxoedema', 'hashimoto', "hashimoto's", 'anti-tpo'], [], 'E.thyroid'),
    ('E.hyperthyroid', E, "Hyperthyroidism & Graves'", ['hyperthyroidism', 'hyperthyroidie', 'thyrotoxicosis', 'graves', "graves'", "grave's", 'basedow', 'basedow-graves', 'antithyroid', 'anthyroid', 'tsh receptor antibodies', 'exophthalmia', 'exophthalmos', 'orbitopathy', 'toxic multinodular goiter', 'thiamazole'], ['trab'], 'E.thyroid'),
    ('E.thyroiditis', E, 'Thyroiditis', ['thyroiditis', 'thyroidite', 'de quervain', 'dequervain', 'subacute thyroiditis', 'post-partum thyroiditis', 'postpartum thyroiditis', 'silent thyroiditis', 'riedel', 'suppurative thyroiditis'], [], 'E.thyroid'),
    ('E.nodule', E, 'Thyroid nodules & cancer', ['thyroid nodule', 'malignant thyroid nodule', 'thyroid cancer', 'papillary', 'follicular', 'medullary', 'anaplastic', 'calcitonin', 'microcalcifications', 'neck swelling'], [], 'E.thyroid'),
    ('E.goiter', E, 'Goiter', ['goiter', 'goitre', 'goitrogenic', 'compressive goiter', 'iodine deficiency'], [], 'E.thyroid'),
    ('E.hyperpara', E, 'Hyperparathyroidism & hypercalcemia', ['hyperparathyroidism', 'hyperparathyroidie', 'hypercalcemia', 'hypercalcemie', 'hypercaclemia', 'parathyroid adenoma', 'brown tumor', 'parathyroid scintigraphy', 'parathyroidectomy'], [], None),
    ('E.hypopara', E, 'Hypoparathyroidism & hypocalcemia', ['hypoparathyroidism', 'hypocalcemia', 'hypocalcemie', 'chvostek', 'trousseau', 'tetany', 'neuromuscular hyperexcitability'], [], None),
    ('E.addison', E, 'Adrenal insufficiency (Addison)', ['adrenal insufficiency', 'addison', "addison's", 'addison disease', 'insuffisance surrenale', 'acth stimulation', 'synacthen', 'hydrocortisone', 'hyperpigmentation', 'melanodermia'], [], None),
    ('E.cushing', E, "Cushing's syndrome", ['cushing', 'cushing syndrome', 'cushing disease', 'hypercortisolism', 'dexamethasone', 'urinary free cortisol', 'purple stretch marks', 'wide purple striae', 'moon face', 'lunar face', 'buffalo'], [], None),
    ('E.pheo', E, 'Pheochromocytoma', ['pheochromocytoma', 'pheochromocytome', 'metanephrines', 'paroxistic hypertension'], [], None),
    ('E.conn', E, 'Primary hyperaldosteronism', ['hyperaldosteronism', 'primary hyperaldosteronism', 'aldosterone', 'renin', 'bilateral adrenal hyperplasia', 'adrenal tumor', 'adrenal hyperplasia'], ['conn'], None),
    ('E.prolactin', E, 'Prolactinoma & hyperprolactinemia', ['prolactinoma', 'prolactin', 'prolactin-secreting', 'hyperprolactinemia', 'galactorrhea', 'cabergoline'], [], None),
    ('E.acromegaly', E, 'Acromegaly', ['acromegaly', 'acromegalie', 'igf-1', 'igf1', 'growth hormone', 'pegvisomant', 'prognathism', 'acrofacial dysmorphism'], [], None),
    ('E.pituitary', E, 'Pituitary adenoma & tumor syndrome', ['pituitary adenoma', 'pituitary tumor', 'pituitary tumors', 'pituitary macro-adenoma', 'macro-adenoma', 'bitemporal', 'hemianopsia', 'visual field', 'tumor syndrome', 'neuro-ophthalmological', 'neuro-ophthalmic'], [], None),
    ('E.hypopit', E, 'Hypopituitarism', ['hypopituitarism', 'panhypopituitarism', 'pituitary insufficiency'], [], None),
    ('E.di', E, 'Diabetes insipidus', ['diabetes insipidus', 'central diabetes insipidus', 'drinking water constantly'], [], None),
    ('E.obesity', E, 'Obesity & metabolic syndrome', ['obesity', 'obese', 'obesite', 'waist circumference', 'waist circumferences', 'metabolic syndrome', 'bariatric', 'monogenic obesity', 'idf criteria'], [], None),
    ('E.gout', E, 'Gout', ['gout', 'goutte', 'uric acid', 'hyperuricemia', 'gout attack'], [], None),
    ('E.gonads', E, 'Hypogonadism, PCOS & hirsutism', ['hypogonadism', 'hypogonadisme', 'testosterone', 'estrogen therapy', 'turner', 'turner syndrome', 'polycystic ovary', 'polycystic ovarian', 'hirsutism', 'hirsutisme', 'virilization', 'female hypogonadism'], ['pcos', 'sopk'], None),

    # ---------------- TECHNICAL COMMUNICATION ----------------
    ('T.defense', T, 'Defense (coping) mechanisms', ['coping mechanism', 'defense mechanism', 'repression', 'denial', 'projection', 'rationalization', 'regression', 'displacement', 'compensation', 'identification'], [], None),
    ('T.listening', T, 'Active listening & paraphrasing', ['active listening', 'paraphrasing', 'paraphrase', 'did i understand that correctly', 'summarizes'], [], None),
    ('T.nonverbal', T, 'Non-verbal communication', ['non-verbal', 'nonverbal', 'eye contact', 'posture', 'leaning', 'open stance', 'attentiveness'], [], None),
    ('T.badnews', T, 'Breaking bad news & reassurance', ['difficult news', 'bad news', 'terminal illness', "don't worry", 'fear of cancer', 'fears cancer', 'fears radiation', 'anxiety', 'reassurance', 'reassuring'], [], None),
    ('T.barriers', T, 'Communication barriers (noise)', ['noise', 'barrier', 'semantic noise', 'psychological noise', 'physical noise', 'culturally specific'], [], None),
    ('T.clarity', T, 'Clarity & the 7 Cs', ['clarity', 'completeness', 'courtesy', 'credibility', 'complex jargon', 'jargon'], [], None),
    ('T.empathy', T, 'Empathy & patient-centred care', ['empathy', 'sympathy', 'shared decision-making', 'shared decision', 'problem-solving tone', 'respecting the boundary', 'chronic illness', 'smoking cessation', 'grieving'], [], None),
]

# manual overrides after review: qshort-id -> concepts
OVERRIDES = {
    'R244': ['R.bronchitis'],
    'R10': ['R.hp'], 'R181': ['R.ild'], 'R165': ['R.tb-caseous'], 'R141': ['R.pleural-tb'],
    'C120': ['C.ms'], 'C125': ['C.ms'], 'C71': ['C.aorta'], 'C101': ['C.aorta'], 'C102': ['C.aorta'],          # "During Acute Bronchiectasis" is the acute bronchitis question (typo in the doc)
    'R29': ['R.bronchiectasis'], 'R30': ['R.bronchiectasis', 'R.hemoptysis'], 'R65': ['R.bronchiectasis'],
    'R40': ['R.copd', 'R.bronchiectasis'],
    'R25': ['R.hiv'], 'R26': ['R.hiv'], 'R122': ['R.hiv'], 'R169': ['R.hiv', 'R.tb'],
    'R44': ['R.aspergilloma', 'R.hemoptysis'], 'R66': ['R.aspergilloma'], 'R67': ['R.aspergilloma'], 'R106': ['R.aspergilloma'],
    'R33': ['R.pleural'], 'R34': ['R.empyema'], 'R42': ['R.empyema'], 'R74': ['R.empyema'], 'R107': ['R.empyema'], 'R98': ['R.empyema', 'R.surgery'],
    'R76': ['R.pleural-malig'], 'R97': ['R.pleural-malig'], 'R101': ['R.pleural', 'R.surgery'], 'R102': ['R.pleural-malig'], 'R46': ['R.pleural-malig'],
    'R35': ['R.trauma'], 'R36': ['R.trauma', 'R.pneumothorax'], 'R37': ['R.trauma'], 'R39': ['R.trauma'], 'R49': ['R.trauma'], 'R68': ['R.trauma', 'R.pneumothorax'], 'R69': ['R.trauma'],
    'R38': ['R.mediastinum'], 'R32': ['R.mediastinum'],
    'R31': ['R.cancer'], 'R45': ['R.cancer'], 'R47': ['R.cancer'], 'R72': ['R.cancer', 'R.surgery'], 'R75': ['R.cancer', 'R.surgery'],
    'R41': ['R.surgery', 'R.cancer'], 'R93': ['R.surgery'], 'R94': ['R.surgery'], 'R95': ['R.surgery', 'R.cancer'], 'R96': ['R.surgery', 'R.cancer'],
    'R99': ['R.surgery', 'R.cancer'], 'R100': ['R.surgery'], 'R103': ['R.surgery'], 'R104': ['R.surgery'], 'R110': ['R.surgery', 'R.cancer'], 'R111': ['R.surgery'], 'R71': ['R.surgery'],
    'R70': ['R.copd'], 'R105': ['R.copd'],
    'R43': ['R.hydatid'], 'R48': ['R.hydatid'], 'R50': ['R.hydatid'], 'R73': ['R.hydatid'], 'R108': ['R.hydatid'],
    'R109': ['R.bronchiectasis'],
    'R21': ['R.nosocomial'], 'R151': ['R.nosocomial'],
    'R146': ['R.resp-failure'], 'R196': ['R.resp-failure'],
    'R28': ['R.abscess'], 'R81': ['R.abscess'], 'R201': ['R.abscess'], 'R237': ['R.abscess'], 'R265': ['R.abscess'],
    'D14': ['D.malabsorption', 'D.celiac'], 'D19': ['D.hepatitis'], 'D174': ['D.colon'], 'D176': ['D.pancreas'], 'D177': ['D.biliary', 'D.pancreas'],
    'D180': ['D.peritoneal-tb'], 'D182': ['D.ibs'], 'D184': ['D.malabsorption', 'D.pancreas'], 'D183': ['D.biliary'],
    'D59': ['D.pancreas'], 'D62': ['D.hepatitis'], 'D60': ['D.hav', 'D.hcv'],
    'D6': ['D.peritoneal-tb'], 'D1': ['D.peritoneal-tb'], 'D20': ['D.peritoneal-tb'], 'D53': ['D.peritoneal-tb'], 'D118': ['D.peritoneal-tb'], 'D120': ['D.peritoneal-tb'], 'D223': ['D.peritoneal-tb'],
    'D122': ['D.portal'], 'D129': ['D.portal'], 'D162': ['D.portal', 'D.cirrhosis'], 'D214': ['D.portal'], 'D11': ['D.cirrhosis', 'D.portal'], 'D54': ['D.portal', 'D.ugib'],
    'D230': ['D.ugib'], 'D81': ['D.ugib', 'D.peptic'], 'D9': ['D.ugib', 'D.peptic'], 'D117': ['D.ugib', 'D.peptic'],
    'D172': ['D.achalasia'], 'D56': ['D.achalasia'], 'D234': ['D.achalasia'], 'D229': ['D.achalasia'], 'D78': ['D.achalasia'], 'D87': ['D.achalasia'], 'D4': ['D.achalasia'],
    'D140': ['D.barrett'], 'D187': ['D.barrett'],
    'D213': ['D.malabsorption'], 'D238': ['D.malabsorption'], 'D237': ['D.malabsorption'], 'D83': ['D.malabsorption'],
    'D18': ['D.ibs'], 'D89': ['D.ibs'], 'D134': ['D.ibs'], 'D220': ['D.ibs'],
    'D76': ['D.parasites'], 'D222': ['D.parasites'],
    'D39': ['D.caustic'], 'D40': ['D.caustic'], 'D67': ['D.caustic'], 'D141': ['D.caustic'], 'D151': ['D.caustic'], 'D193': ['D.caustic'], 'D27': ['D.caustic'], 'D75': ['D.caustic'], 'D157': ['D.caustic'], 'D200': ['D.caustic'], 'D29': ['D.caustic'],
    'D44': ['D.peritonitis'], 'D74': ['D.peritonitis'], 'D137': ['D.peritonitis'], 'D189': ['D.peritonitis'], 'D210': ['D.peritonitis'], 'D158': ['D.peritonitis'], 'D165': ['D.peritonitis'],
    'D68': ['D.appendicitis'], 'D194': ['D.appendicitis'], 'D152': ['D.appendicitis'], 'D168': ['D.appendicitis'],
    'D65': ['D.hydatid'], 'D136': ['D.hydatid'], 'D185': ['D.hydatid'], 'D186': ['D.hydatid'], 'D196': ['D.hydatid'],
    'D5': ['D.cirrhosis'], 'D61': ['D.cirrhosis'], 'D131': ['D.cirrhosis'], 'D161': ['D.cirrhosis'], 'D178': ['D.cirrhosis'],
    'D25': ['D.hp'], 'D125': ['D.hp'], 'D235': ['D.hp'],
    'D82': ['D.peptic'], 'D219': ['D.peptic'], 'D58': ['D.peptic'], 'D132': ['D.peptic'], 'D111': ['D.peptic'], 'D170': ['D.peptic'], 'D226': ['D.peptic'], 'D123': ['D.peptic'], 'D239': ['D.peptic'], 'D216': ['D.peptic'], 'D21': ['D.peptic'],
    'D17': ['D.gastritis'], 'D84': ['D.gastritis'], 'D90': ['D.gastritis'], 'D218': ['D.gastritis'], 'D228': ['D.gastritis'], 'D231': ['D.gastritis'], 'D232': ['D.gastritis'],
    'D26': ['D.eso-cancer'], 'D43': ['D.eso-cancer'], 'D49': ['D.eso-cancer'], 'D64': ['D.eso-cancer'], 'D70': ['D.eso-cancer'], 'D139': ['D.eso-cancer'], 'D147': ['D.eso-cancer'], 'D188': ['D.eso-cancer'], 'D195': ['D.eso-cancer'],
    'D179': ['D.biliary'], 'D173': ['D.colon'],
    'D10': ['D.celiac'], 'D55': ['D.celiac'], 'D225': ['D.celiac'], 'D236': ['D.celiac'], 'D77': ['D.celiac'], 'D86': ['D.celiac'],
    'D12': ['D.uc'], 'D88': ['D.uc', 'D.crohn'], 'D114': ['D.uc'], 'D124': ['D.uc'], 'D171': ['D.uc'], 'D217': ['D.uc'],
    'D22': ['D.crohn'], 'D119': ['D.crohn'], 'D121': ['D.crohn'], 'D175': ['D.crohn'], 'D80': ['D.ibd'],
    'D13': ['D.gerd'], 'D15': ['D.gerd'], 'D57': ['D.gerd'], 'D79': ['D.gerd'], 'D85': ['D.gerd'], 'D113': ['D.gerd'], 'D126': ['D.gerd'], 'D130': ['D.gerd'], 'D135': ['D.gerd'], 'D181': ['D.gerd'], 'D224': ['D.gerd'], 'D227': ['D.gerd'], 'D233': ['D.gerd'],
    'S8': ['S.bacterial'], 'S66': ['S.bacterial'], 'S136': ['S.bacterial'],
    'S3': ['S.fungal'], 'S54': ['S.fungal'], 'S7': ['S.fungal'], 'S31': ['S.fungal'], 'S46': ['S.fungal'], 'S57': ['S.fungal'], 'S63': ['S.fungal'], 'S74': ['S.fungal'], 'S115': ['S.fungal'], 'S118': ['S.fungal'], 'S122': ['S.fungal'],
    'S104': ['S.lice'], 'S206': ['S.lice'], 'S207': ['S.lice'], 'S208': ['S.lice'], 'S209': ['S.lice'], 'S210': ['S.lice'], 'S211': ['S.lice'],
    'S86': ['S.scabies'], 'S123': ['S.scabies'], 'S212': ['S.scabies'], 'S213': ['S.scabies'], 'S214': ['S.scabies'], 'S215': ['S.scabies'], 'S216': ['S.scabies'], 'S217': ['S.scabies'], 'S218': ['S.scabies'], 'S221': ['S.scabies'], 'S222': ['S.scabies'],
    'S78': ['S.leish'], 'S110': ['S.leish', 'S.tb'], 'S223': ['S.leish'], 'S224': ['S.leish'], 'S225': ['S.leish'], 'S226': ['S.leish'], 'S229': ['S.leish'], 'S231': ['S.leish'], 'S232': ['S.leish'], 'S233': ['S.leish'], 'S234': ['S.leish'], 'S235': ['S.leish'], 'S236': ['S.leish'], 'S237': ['S.leish'],
    'S113': ['S.atopic'], 'S114': ['S.urticaria', 'S.erysipelas'], 'S126': ['S.cancer'], 'S137': ['S.contact'], 'S138': ['S.contact'], 'S145': ['S.contact'],
    'S147': ['S.acne'], 'S148': ['S.acne'], 'S150': ['S.acne'], 'S154': ['S.acne'], 'S157': ['S.acne'],
    'S168': ['S.herpes'], 'S173': ['S.impetigo'], 'S174': ['S.impetigo'], 'S180': ['S.tb'], 'S181': ['S.tb'],
    'S185': ['S.syphilis'], 'S186': ['S.syphilis'], 'S187': ['S.syphilis'], 'S188': ['S.syphilis'], 'S189': ['S.syphilis'], 'S190': ['S.syphilis'], 'S191': ['S.syphilis'], 'S192': ['S.syphilis'], 'S193': ['S.syphilis'], 'S194': ['S.syphilis'], 'S198': ['S.syphilis'], 'S199': ['S.syphilis'], 'S200': ['S.syphilis'], 'S201': ['S.syphilis'],
    'S25': ['S.syphilis', 'S.tb'], 'S90': ['S.syphilis', 'S.tb'], 'S37': ['S.tb'], 'S87': ['S.tb'],
    'S23': ['S.eczema'], 'S62': ['S.eczema'], 'S135': ['S.eczema'], 'S55': ['S.eczema'],
    'S102': ['S.urticaria'],
    'C8': ['C.pe'], 'C65': ['C.pe'], 'C268': ['C.pe'], 'C17': ['C.pe'], 'C183': ['C.pe'], 'C293': ['C.pe'], 'C294': ['C.pe'], 'C291': ['C.pe'],
    'C18': ['C.arrhythmia'], 'C12': ['C.arrhythmia'], 'C186': ['C.arrhythmia'], 'C298': ['C.arrhythmia'], 'C299': ['C.arrhythmia', 'C.af'], 'C62': ['C.arrhythmia', 'C.af'], 'C270': ['C.arrhythmia', 'C.af'],
    'C15': ['C.hf'], 'C59': ['C.hf'], 'C264': ['C.hf'], 'C16': ['C.hf'], 'C63': ['C.hf'], 'C269': ['C.hf'], 'C182': ['C.hf'], 'C218': ['C.hf'], 'C231': ['C.hf'], 'C173': ['C.hf'], 'C174': ['C.hf'], 'C175': ['C.hf'], 'C310': ['C.hf'], 'C311': ['C.hf'], 'C312': ['C.hf'], 'C313': ['C.hf'], 'C315': ['C.hf'], 'C24': ['C.hf'], 'C242': ['C.hf'], 'C307': ['C.hf'],
    'C176': ['C.cmp'], 'C177': ['C.cmp'], 'C178': ['C.cmp'], 'C122': ['C.cmp'], 'C179': ['C.cmp'], 'C180': ['C.cmp'], 'C181': ['C.cmp'], 'C14': ['C.cmp'],
    'C161': ['C.athero'], 'C162': ['C.htn'], 'C163': ['C.htn'], 'C164': ['C.htn'], 'C165': ['C.htn'], 'C166': ['C.htn'], 'C167': ['C.htn'], 'C168': ['C.htn'], 'C169': ['C.htn'], 'C170': ['C.htn', 'C.ccs'], 'C171': ['C.htn'], 'C172': ['C.htn'],
    'C215': ['C.exam'], 'C233': ['C.exam'], 'C222': ['C.exam'], 'C230': ['C.exam'], 'C232': ['C.exam', 'C.ie', 'C.athero'],
    'C216': ['C.athero'], 'C235': ['C.athero'], 'C223': ['C.athero', 'C.acs'], 'C224': ['C.athero'], 'C234': ['C.athero'], 'C225': ['C.athero'], 'C229': ['C.athero'], 'C228': ['C.athero'], 'C241': ['C.athero'], 'C244': ['C.athero'], 'C28': ['C.athero'], 'C32': ['C.athero'], 'C29': ['C.athero', 'C.acs'],
    'C219': ['C.ccs'], 'C220': ['C.ccs'], 'C221': ['C.ccs'], 'C237': ['C.ccs'],
    'C209': ['C.acs'], 'C251': ['C.acs'], 'C226': ['C.acs'], 'C238': ['C.acs'], 'C227': ['C.acs'], 'C236': ['C.acs'], 'C289': ['C.acs'], 'C34': ['C.acs'], 'C30': ['C.acs'], 'C337': ['C.acs'], 'C360': ['C.acs'], 'C361': ['C.acs'], 'C370': ['C.acs'], 'C378': ['C.acs'], 'C367': ['C.acs'], 'C374': ['C.acs'],
    'C324': ['C.cabg', 'C.acs'], 'C344': ['C.cabg', 'C.acs'], 'C363': ['C.cabg', 'C.acs'], 'C369': ['C.cabg', 'C.acs'], 'C379': ['C.cabg', 'C.acs'],
    'C323': ['C.cabg'], 'C333': ['C.cabg'], 'C343': ['C.cabg'], 'C330': ['C.cabg'], 'C332': ['C.cabg'], 'C320': ['C.cabg'], 'C321': ['C.cabg'], 'C322': ['C.cabg'], 'C368': ['C.cabg'], 'C371': ['C.cabg'], 'C376': ['C.cabg'],
    'C362': ['C.aorta'], 'C372': ['C.aorta'], 'C364': ['C.aorta'], 'C375': ['C.aorta'], 'C46': ['C.aorta'], 'C282': ['C.aorta'], 'C325': ['C.aorta'], 'C334': ['C.aorta'], 'C345': ['C.aorta'], 'C355': ['C.aorta'],
    'C50': ['C.carotid'], 'C68': ['C.carotid'], 'C109': ['C.carotid'], 'C278': ['C.carotid'], 'C351': ['C.carotid'],
    'C43': ['C.pad'], 'C73': ['C.pad'], 'C103': ['C.pad'], 'C99': ['C.pad'], 'C286': ['C.pad'], 'C341': ['C.pad'], 'C359': ['C.pad'],
    'C38': ['C.dvt', 'C.vte'], 'C72': ['C.dvt', 'C.vte'], 'C97': ['C.dvt', 'C.vte'], 'C276': ['C.vte'], 'C292': ['C.vte'], 'C290': ['C.vte'], 'C295': ['C.vte'],
    'C11': ['C.ie'], 'C52': ['C.ie'], 'C90': ['C.ie'], 'C267': ['C.ie'], 'C187': ['C.ie'], 'C57': ['C.ie'], 'C89': ['C.ie'], 'C273': ['C.ie'],
    'C123': ['C.ms'], 'C133': ['C.ms'], 'C127': ['C.ms'], 'C144': ['C.mr'], 'C145': ['C.mr'], 'C151': ['C.mr'], 'C152': ['C.mr'], 'C153': ['C.mr'],
    'C139': ['C.as'], 'C140': ['C.as'], 'C141': ['C.as'], 'C132': ['C.as'], 'C136': ['C.as'],
    'C44': ['C.valve-surgery'], 'C36': ['C.valve-surgery', 'C.as'], 'C40': ['C.valve-surgery', 'C.as'], 'C41': ['C.valve-surgery'],
    'C185': ['C.chd'], 'C246': ['C.chd'], 'C56': ['C.chd'], 'C25': ['C.chd'], 'C263': ['C.chd'],
    'C240': ['C.syncope'],
    'C111': ['C.arf'], 'C188': ['C.arf'], 'C189': ['C.arf'], 'C191': ['C.arf'], 'C192': ['C.arf'], 'C193': ['C.arf'], 'C195': ['C.arf'], 'C196': ['C.arf'], 'C197': ['C.arf'], 'C198': ['C.arf'], 'C199': ['C.arf'], 'C202': ['C.arf'], 'C256': ['C.arf'], 'C54': ['C.arf'], 'C61': ['C.arf'],
    'E1': ['E.neuropathy'], 'E52': ['E.neuropathy'], 'E20': ['E.neuropathy'], 'E45': ['E.neuropathy'], 'E64': ['E.neuropathy'],
    'E9': ['E.dka'], 'E4': ['E.dka'], 'E169': ['E.dka'],
    'E5': ['E.dm-tx'], 'E29': ['E.dm-tx', 'E.obesity'], 'E63': ['E.dm-tx'], 'E150': ['E.dm-tx'],
    'E10': ['E.dm-cv'], 'E74': ['E.dm-cv'], 'E143': ['E.dm-cv'], 'E144': ['E.dm-cv'], 'E158': ['E.dm-cv'], 'E162': ['E.dm-cv'],
    'E15': ['E.micro'], 'E49': ['E.micro'], 'E72': ['E.micro'],
    'E22': ['E.gdm'], 'E46': ['E.diabetes'], 'E50': ['E.diabetes', 'E.cushing', 'E.acromegaly'], 'E140': ['E.diabetes'], 'E155': ['E.diabetes'], 'E164': ['E.diabetes'], 'E173': ['E.diabetes'],
    'E39': ['E.exercise', 'E.obesity'], 'E43': ['E.exercise', 'E.diabetes'], 'E59': ['E.exercise', 'E.diabetes'],
    'E3': ['E.hypothyroid'], 'E18': ['E.hypothyroid'], 'E28': ['E.hypothyroid'], 'E55': ['E.hypothyroid'], 'E58': ['E.hypothyroid'], 'E76': ['E.hypothyroid'], 'E77': ['E.hypothyroid'],
    'E97': ['E.hypothyroid'], 'E98': ['E.hypothyroid'], 'E99': ['E.hypothyroid'], 'E100': ['E.hypothyroid'], 'E101': ['E.hypothyroid'], 'E102': ['E.hypothyroid'], 'E103': ['E.hypothyroid'], 'E104': ['E.hypothyroid'],
    'E24': ['E.hypothyroid'],
    'E23': ['E.hyperthyroid'], 'E27': ['E.hyperthyroid'], 'E70': ['E.hyperthyroid'], 'E79': ['E.hyperthyroid'], 'E80': ['E.hyperthyroid'], 'E81': ['E.hyperthyroid'], 'E82': ['E.hyperthyroid'],
    'E110': ['E.hyperthyroid'], 'E111': ['E.hyperthyroid'], 'E112': ['E.hyperthyroid'], 'E148': ['E.hyperthyroid'], 'E160': ['E.hyperthyroid'], 'E168': ['E.hyperthyroid'], 'E172': ['E.hyperthyroid'],
    'E38': ['E.thyroiditis'], 'E78': ['E.thyroiditis'], 'E89': ['E.thyroiditis'], 'E90': ['E.thyroiditis'], 'E105': ['E.thyroiditis'], 'E106': ['E.thyroiditis'], 'E107': ['E.thyroiditis'], 'E108': ['E.thyroiditis'], 'E109': ['E.thyroiditis'],
    'E60': ['E.nodule'], 'E87': ['E.nodule'], 'E93': ['E.nodule'], 'E94': ['E.nodule'], 'E95': ['E.nodule'], 'E96': ['E.nodule'], 'E139': ['E.nodule'], 'E159': ['E.nodule'],
    'E88': ['E.goiter'], 'E91': ['E.goiter'], 'E92': ['E.goiter'],
    'E6': ['E.hyperpara'], 'E47': ['E.hyperpara'], 'E84': ['E.hyperpara'], 'E85': ['E.hyperpara'], 'E86': ['E.hyperpara'], 'E113': ['E.hyperpara'], 'E114': ['E.hyperpara'], 'E115': ['E.hyperpara'], 'E136': ['E.hyperpara'], 'E171': ['E.hyperpara'], 'E175': ['E.hyperpara'],
    'E8': ['E.hypopara'], 'E16': ['E.hypopara'], 'E34': ['E.hypopara'], 'E73': ['E.hypopara'], 'E83': ['E.hypopara'], 'E135': ['E.hypopara'],
    'E12': ['E.addison'], 'E14': ['E.addison'], 'E30': ['E.addison'], 'E65': ['E.addison'], 'E154': ['E.addison'], 'E157': ['E.addison'], 'E161': ['E.addison'], 'E165': ['E.addison'],
    'E17': ['E.cushing'], 'E56': ['E.cushing'], 'E141': ['E.cushing'], 'E151': ['E.cushing'], 'E153': ['E.cushing'],
    'E7': ['E.pheo'], 'E61': ['E.pheo'], 'E152': ['E.pheo'],
    'E11': ['E.conn'], 'E26': ['E.conn'],
    'E36': ['E.prolactin'], 'E41': ['E.prolactin'], 'E51': ['E.prolactin'], 'E40': ['E.prolactin', 'E.gonads'],
    'E35': ['E.acromegaly'], 'E54': ['E.acromegaly'], 'E137': ['E.acromegaly'], 'E166': ['E.acromegaly'], 'E170': ['E.acromegaly'],
    'E21': ['E.pituitary'], 'E69': ['E.pituitary'], 'E145': ['E.pituitary'], 'E163': ['E.pituitary'], 'E167': ['E.pituitary'],
    'E25': ['E.hypopit'], 'E174': ['E.hypopit'],
    'E13': ['E.di'], 'E66': ['E.di'], 'E71': ['E.di'],
    'E2': ['E.obesity'], 'E32': ['E.obesity'], 'E44': ['E.obesity'], 'E53': ['E.obesity'], 'E67': ['E.obesity'], 'E68': ['E.obesity'], 'E138': ['E.obesity'], 'E146': ['E.obesity'], 'E149': ['E.obesity'],
    'E19': ['E.gout'], 'E48': ['E.gout'], 'E57': ['E.gout'], 'E62': ['E.gout'],
    'E31': ['E.gonads'], 'E33': ['E.gonads'], 'E37': ['E.gonads'], 'E42': ['E.gonads'], 'E75': ['E.gonads'], 'E142': ['E.gonads'], 'E147': ['E.gonads'], 'E156': ['E.gonads'],
    'T1': ['T.defense'], 'T11': ['T.defense'], 'T14': ['T.defense'],
    'T2': ['T.listening'], 'T8': ['T.listening', 'T.nonverbal'], 'T16': ['T.listening', 'T.empathy'],
    'T6': ['T.nonverbal'], 'T9': ['T.nonverbal'], 'T18': ['T.nonverbal'],
    'T3': ['T.badnews'], 'T4': ['T.badnews'], 'T13': ['T.badnews'], 'T15': ['T.badnews'], 'T17': ['T.badnews'], 'T19': ['T.badnews'],
    'T5': ['T.barriers'], 'T12': ['T.barriers'], 'T20': ['T.barriers'],
    'T23': ['T.clarity'],
    'T7': ['T.empathy'], 'T10': ['T.empathy'], 'T21': ['T.empathy'], 'T22': ['T.empathy'], 'T24': ['T.empathy'], 'T25': ['T.empathy'],
}

ASPECTS = [
    ('V', 'Prevention & screening', r'\b(prevent\w*|prophyla\w*|screening|vaccin\w*|protection measures|control programs?|protective)\b'),
    ('T', 'Treatment & management', r'\b(treat\w*|therap\w*|management|manage\w*|drugs?|medications?|surgery|surgical|dose|dosage|prescri\w*|regimens?|indicat\w*|antibiotic\w*|insulins?|recommended|procedures?|reflexes|mistakes to avoid|replacement|substitute|protocols?|lifestyle measures|dietetic|options|hospitali[sz]ation)\b'),
    ('E', 'Causes & risk factors', r'(\brisk factors?|increases? the risk|higher risk|risk of [a-z ]+ increases|factors (that )?(increase|contribute|promote|worsen|favou?r))'),
    ('K', 'Complications, severity & prognosis', r'\b(complicat\w*|prognos\w*|severity|severe forms?|mortality|evolution|outcome|poor prognostic|bad prognostic|signs of severity|recovery|risks? (\(s\) )?associated|at risk)\b'),
    ('X', 'Diagnosis & investigations', r'\b(diagnos\w*|tests?|work ?-?up|investigations?|imaging|confirm\w*|serology|biops\w*|ecg|scan|ultrasound|laborator\w*|lab|criteria|criterion|scores?|classifications?|interpretation|staging|sampling|explorations?|findings? (on|at)|modalit\w*|biological)\b'),
    ('P', 'Definition & mechanisms', r'\b(pathophysiolog\w*|physiopatholog\w*|mechanisms?|definitions?|define[sd]?)\b'),
    ('E', 'Causes & risk factors', r'\b(causes?|caused|etiolog\w*|predispos\w*|favou?r(s|ing)? the development|promot\w*|transmi\w*|contamination|routes?|trigger\w*|aggravat\w*|worsen\w*|agents?|responsible|germs?|pathogens?|contribute)\b'),
    ('C', 'Clinical signs & symptoms', r'\b(signs?|symptoms?|clinical|manifest\w*|features?|presents?|findings?|characteri[sz]\w*|lesions?|auscultat\w*|murmurs?|triad|sounds?|in favou?r of|pattern|expressions?)\b'),
]
ASPECT_NAMES = {'V': 'Prevention & screening', 'T': 'Treatment & management', 'E': 'Causes & risk factors',
                'K': 'Complications & prognosis', 'X': 'Diagnosis & tests', 'P': 'Definition & mechanisms',
                'C': 'Signs & symptoms', 'G': 'General statements'}


def norm(s):
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    s = s.lower().replace('’', "'").replace('`', "'")
    s = re.sub(r'<[^>]+>', ' ', s)
    s = re.sub(r'&[a-z#0-9]+;', ' ', s)
    s = re.sub(r"[^a-z0-9'+\-/ ]+", ' ', s)
    return ' ' + re.sub(r'\s+', ' ', s).strip() + ' '


def term_re(term):
    t = norm(term).strip()
    # allow simple plural on the last word
    return re.compile(r'(?<![a-z0-9])' + re.escape(t) + r"(?:s|es)?(?![a-z0-9])")


def build_matchers():
    out = []
    for cid, mod, name, syn, abbr, parent in CONCEPTS:
        pats = [(term_re(t), len(norm(t).strip())) for t in set(syn)]
        out.append((cid, mod, pats))
    return out


def aspect_of(stem):
    s = norm(stem)
    for code, _, rx in ASPECTS:
        if re.search(rx, s):
            return code
    return 'G'


def tag(bank, shortids):
    rev = {v: k for k, v in shortids.items()}
    by_id = {c[0]: c for c in CONCEPTS}
    matchers = build_matchers()
    cases = {c['id']: c['html'] for c in bank.get('cases', [])}
    tags = {}
    for q in bank['questions']:
        sid = rev[q['id']]
        if sid in OVERRIDES:
            cs = OVERRIDES[sid]
        else:
            stem = norm(q['stem'] + ' ' + (cases.get(q.get('case'), '') if q.get('case') else ''))
            opts = norm(' '.join(q['options']))
            scores = Counter()
            for cid, mod, pats in matchers:
                if mod != q['topic']:
                    continue
                for rx, ln in pats:
                    if rx.search(stem):
                        scores[cid] += 3 + ln / 100.0
                    n = len(rx.findall(opts))
                    if n:
                        scores[cid] += min(n, 2) * 1.0
            if not scores:
                cs = []
            else:
                top = scores.most_common()
                best = top[0][1]
                cs = [c for c, s in top if s >= 3 or (best < 3 and s >= best)]
                # prefer specific children over their parent when both matched in the stem
                children = {c for c in cs if by_id[c][5]}
                cs = [c for c in cs if not any(by_id[ch][5] == c for ch in children)] or cs
                cs = cs[:3]
        tags[q['id']] = {'c': cs, 'a': aspect_of(q['stem'])}
    return tags


if __name__ == '__main__':
    bank = json.load(open('bank.json'))
    shortids = json.load(open('shortids.json'))
    tags = tag(bank, shortids)
    json.dump(tags, open('tags.json', 'w'))
    rev = {v: k for k, v in shortids.items()}
    untagged = [rev[q] for q, t in tags.items() if not t['c']]
    print('tagged', sum(1 for t in tags.values() if t['c']), 'of', len(tags), '| untagged', len(untagged))
    print(' '.join(sorted(untagged, key=lambda s: (s[0], int(s[1:])))))
    print('aspects', Counter(t['a'] for t in tags.values()))
    cnt = Counter(c for t in tags.values() for c in t['c'])
    print('concepts used', len(cnt), 'of', len(CONCEPTS))
    print('unused:', [c[0] for c in CONCEPTS if c[0] not in cnt])
