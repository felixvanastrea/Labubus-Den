# Reads the hand transcriptions of Abi's Year 1 photos (one .txt per photo, "# SET: ..." header, then
# "N. stem" / "A. option" lines) and groups them into exam sets: /home/claude/work/s1/sets.json.
# Marks in the photos (circles, ticks, highlights) were never transcribed as answers (Abi, 25 Nov 2026).
import json, re, glob, os, sys
RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'raw')
# header prefix -> (set key); first match wins
SETS = [
 ('Anatomy1 Jan 2022', 'anat-2022'), ('Anatomy1 exam, 2d session Jan 2022', 'anat-2022'), ('# = photo PHOTO-2025-12-27', 'anat-2022'),
 ('SET: Anatomy I mock Dec 29', 'anat-mock'), ('SET: EFM1 – Mock Exam – Anatomy I', 'anat-mock'),
 ('SET: Public health FR', 'ph-fr'), ('SET: Public health', 'ph-mock'),
 ('SET: Biophysics review', 'bio-review'), ('SET: Biophysics', 'biophys-mock'),
 ('SET: Chemistry & biochemistry, Evalbox Fri Dec 27', 'chem-2024'),
 ('SET: Chemistry & biochemistry FR', 'chem-fr'),
 ('SET: Chem/biochem', 'chem-mock'), ('SET: Chemistry/biochemistry', 'chem-mock'),
 ('SET: Biology & genetics', 'bg-mock'),
 ('SET: Learning methods', 'lm-mock'), ('SET: Medical terminology', 'lm-mock'),
 ('SET: Cellular Biology', 'cell-2023'),
 ('SET: Anatomy 1, 1st Year, 2nd Session', 'anat-2023'),
 ('SET: Structural biochemistry FR', 'sbio-fr'),
 ('SET: Chemistry FR exam', 'chem-fr-exam'),
 ('SET: chemistry organic doc', 'chem-en'), ('chemistry (organic) doc', 'chem-en'), ('chemistry exam, page 2', 'chem-en'),
 ('SET: FMC1 blanc anat', 'anat-fmc'),
 ('structural+biochemistry+MC', 'sbio-en'), ('structural biochemistry MCQ doc', 'sbio-en'),
 ('Anatomy doc (screen), answers in RED', 'anat-review'),
]
out = {}
for f in sorted(glob.glob(RAW + '/*.txt')):
    txt = open(f).read()
    head = txt.split('\n', 1)[0]
    if 'DUP' in head or 'see ' in head[:12] or 'TITLE for' in head:
        continue
    key = next((k for p, k in SETS if p in head), None)
    if key is None:
        if re.search(r'^\s*(\d+|Q)\.', txt, re.M):
            print('NO SET:', os.path.basename(f), head[:80])
        continue
    cur = None
    auto = len(out.get(key, []))
    for line in txt.split('\n')[1:]:
        line = line.rstrip()
        if not line or line.startswith('#'):
            continue
        m = re.match(r'^(\d+|Q)\s*[.\-]\s*(.*)$', line)
        if m:
            n = int(m.group(1)) if m.group(1) != 'Q' else None
            if n is None:
                auto += 1
            cur = {'n': n, 'ord': (n if n is not None else auto), 's': m.group(2), 'o': [], 'file': os.path.basename(f)}
            out.setdefault(key, []).append(cur)
            continue
        m = re.match(r'^\*?([A-E])\.\s*(.*)$', line)
        if m and cur is not None:
            cur['o'].append(m.group(2))
            continue
        if line.startswith('['):   # an editor's bracket line (professor's name, a cut)
            cur = None if not (cur and line.startswith('[') and 'cut' in line) else cur
            continue
        if cur is not None and not cur['o']:
            cur['s'] += ' ' + line
        elif cur is not None:
            cur['o'][-1] += ' ' + line
res = {}
for k, qs in out.items():
    seen = {}
    for q in sorted(qs, key=lambda q: q['ord']):
        q['s'] = q['s'].strip()
        q['o'] = [o.strip() for o in q['o']]
        if len(q['o']) < 2 or '[stem' in q['s'] or 'options next' in q['s'] or 'options on next' in q['s']:
            print('skip', k, q['ord'], q['s'][:60], len(q['o'])); continue
        if q['ord'] in seen:
            if len(q['o']) > len(seen[q['ord']]['o']):
                seen[q['ord']] = q
            print('dup number', k, q['ord'], q['file'], seen[q['ord']]['file']); continue
        seen[q['ord']] = q
    res[k] = list(seen.values())
    print(k, len(res[k]), [q['ord'] for q in res[k]])
json.dump(res, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sets.json'), 'w'), ensure_ascii=False, indent=1)
