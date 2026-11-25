# EFM2 S3 answers Claude gave without a lecture to check them against (Abi, 25 November 2026: "just answer with whatever you
# can"). Keys only, by short id; the site's note says they're not checked against the slides yet. Run with the batch files
# in knowledge/*.txt ("SID KEY" per line, # comments).
import json, os, glob, re
D = '/home/claude/efm3-mcq-bank/src/sem/efm2-s3/'
H = os.path.dirname(os.path.abspath(__file__))
ans = json.load(open(D + 'answers.json')) if os.path.exists(D + 'answers.json') else {}
n = 0
for f in sorted(glob.glob(os.path.join(H, 'knowledge', '*.txt'))):
    for line in open(f, encoding='utf8'):
        line = line.split('#')[0].strip()
        if not line:
            continue
        for sid, key in re.findall(r'([A-Z]\d+)\s*[:=]?\s*([A-E]+)', line):
            if ans.get(sid, {}).get('by') == 'lecture':
                continue          # an answer from the slides stays
            ans[sid] = {'key': key, 'by': 'knowledge'}
            n += 1
json.dump(ans, open(D + 'answers.json', 'w'), ensure_ascii=False, indent=1)
print(n, 'knowledge answers;', len(ans), 'in all')
