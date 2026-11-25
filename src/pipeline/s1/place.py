# Which lecture each EFM1 S1 question belongs to, read one by one against Abi's lecture list (25 November 2026).
import re
def R(spec):
    out = {}
    for part in spec.split(','):
        part = part.strip()
        if not part: continue
        nums, lec = part.split(':')
        for r in nums.split('+'):
            a, _, b = r.partition('-')
            for n in range(int(a), int(b or a) + 1):
                out[n] = lec.strip()
    return out
P = {
 'chem-mock': R('1-6:CB-01, 7-12:CB-07, 13:CB-17, 14:CB-17, 15:CB-14, 16:CB-11, 17-18:CB-17, 19:CB-15, 20-22:CB-19, 23:CB-17, 24:CB-12, 25:CB-13'),
 'chem-2024': R('1-6:CB-01, 7-12:CB-07, 13:CB-11, 14:CB-13, 15:CB-17, 16:CB-15, 17:CB-11, 18:CB-19, 19:CB-17, 20:CB-14, 21:CB-17, 22:CB-14, 23:CB-17'),
 'chem-fr': R('1:CB-07, 2-6:CB-02, 8-9:CB-07, 10:CB-06, 11:CB-07, 12-13:CB-02, 15:CB-19, 16:CB-11, 17:CB-17, 18:CB-19, 19:CB-12, 20:CB-15, 21:CB-16, 22:CB-13, 23:CB-14, 24:CB-17, 25:CB-19'),
 'chem-fr-exam': R('12-13:CB-07, 14:CB-03, 15-16:CB-07'),
 'chem-en': R('10:CB-02, 11-12:CB-05, 13:CB-07, 14:CB-06, 15:CB-07'),
 'sbio-fr': R('1-14:CB-14, 15-30:CB-15, 34:CB-11'),
 'sbio-en': R('7-9:CB-11, 10:CB-12, 14-16:CB-14'),
 'biophys-mock': R('1:BY-13, 2:BY-12, 3:BY-20, 4:BY-15, 5:BY-12, 6:BY-13, 7-8:BY-14, 9:BY-16, 10:BY-20, 11-12:BY-19, 13:BY-13, 14:BY-07, 15:BY-08, 16:BY-01, 17:BY-03, 18:BY-08, 19:BY-06, 20:BY-08, 21:BY-07, 22:BY-10, 23:BY-11, 24:BY-08, 25:BY-01'),
 'bio-review': R('1-3:BY-01, 4:BY-02, 5-6:BY-04, 7:BY-01, 8-9:BY-02, 10-12:BY-03, 13-14:BY-04, 15-16:BY-03, 17-19:BY-01, 20-30:BY-08'),
 'bg-mock': R('1:BG-03, 2:BG-05, 3:BG-08, 4:BG-02, 5:BG-08, 6:BG-07, 7:BG-10, 8-9:BG-06, 10:BG-05, 11:BG-10, 12:BG-01, 13:BG-07, 14-15:BG-16, 16-18:BG-18, 19:BG-13, 20-21:BG-14, 22:BG-15, 23:BG-12, 24:BG-16, 25:BG-18'),
 'cell-2023': R('1:BG-01, 2-3:BG-02, 4:BG-03, 5-10:BG-05, 11-16:BG-07, 17-19:BG-08, 20-23:BG-09, 24-25:BG-11'),
 'ph-mock': R('1:BP-14, 2-3:BP-05, 4:BP-04, 5:BP-07, 7:BP-05, 8:BP-07, 9:BP-05, 10:BP-07, 11:BP-11, 12:BP-07, 13:BP-04, 14:BP-12, 15:BP-13, 16:BP-05, 17:BP-07, 19-25:BP-03'),
 'ph-fr': R('1-2:BP-03, 3:BP-01, 4-8:BP-03, 9:BP-07, 10:BP-04, 11:BP-12, 12:BP-07, 13-15:BP-05, 16:BP-04, 17:BP-05, 18:BP-14, 19:BP-05, 20:BP-04, 21:BP-11, 22-25:BP-07'),
 'lm-mock': R('1-12:LM-09, 13-15:LM-05, 16:LM-07, 17:LM-03, 18:LM-02, 19:LM-06, 20-25:LM-10'),
}
def anat(s):
    if re.search(r'ventricle|atrium|coronary|aort|vena cava|azygos|pulmonary artery|surface of the heart', s, re.I): return 'AN-03'
    if re.search(r'trachea|lung|bronch|hilum|mediastinum', s, re.I): return 'AN-04'
    return 'AN-02'
def place(key, n, stem):
    if key.startswith('anat'):
        if key == 'anat-2022' and n >= 41: return 'AN-01'
        return anat(stem)
    return P[key][n]
