// Links to one part of the Den: #set-<slug> opens that exam set's practice (Back to its module), #module-, #lecture-,
// #quest-; the share buttons copy the link. Test: the 2026–2027 dermatology midterm.
const { chromium } = require('playwright');
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
let fails = 0; const check = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL); await p.evaluate(() => localStorage.clear());
  await p.goto(URL + '#set-dermatology-midterm-2026-2027'); await p.waitForTimeout(800);
  let S = await p.evaluate(() => JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')));
  check(S.view === 'quiz' && S.session.set === 's5-2627-dermatology-midterm-dermatology-2026-2027' && S.session.qids.length === 20, 'the link opens the 2026–2027 dermatology midterm');
  check(!/#/.test(p.url()), 'the address is tidied');
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(300);
  check(await p.evaluate(() => document.body.dataset.view) === 'topic', 'Back: the dermatology page');
  await p.click('[data-share^="set:s5-2627-dermatology"]'); await p.waitForTimeout(300);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  check(/index\.html#set-dermatology-midterm-2026-2027$/.test(clip) && /Link copied/.test(await p.textContent('#toast')), 'share copies it: ' + clip);
  await p.evaluate(() => { location.hash = '#module-endocrinology'; }); await p.waitForTimeout(500);
  check((await p.textContent('h1')).trim() === 'Endocrinology', '#module- opens a module');
  await p.evaluate(() => { location.hash = '#lecture-S-acne'; }); await p.waitForTimeout(500);
  S = await p.evaluate(() => JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')));
  check(S.view === 'quiz' && S.session.lec === 'S-acne', '#lecture- opens a lecture');
  await p.evaluate(() => { location.hash = '#quest-gi-midterm-2026'; }); await p.waitForTimeout(500);
  S = await p.evaluate(() => JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')));
  check(S.session.qid === 'gi-midterm-2026', '#quest- opens a quest');
  await p.evaluate(() => { location.hash = '#set-nothing-here'; }); await p.waitForTimeout(300);
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none'); console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close(); process.exit(fails || errors.length ? 1 : 0);
})();
