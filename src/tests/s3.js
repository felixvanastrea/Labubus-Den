// EFM2 S3 (25 November 2026): its questions have no answers yet (Abi: answers come lecture by lecture), so a set or a
// lecture opens on its first question instead of the end screen; search finds them by tag; figures load.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765') + '/efm2-s3/index.html';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
  ok(/1,179 questions/.test(await p.textContent('button.navstat')), 'the count shows 1,179 questions');
  ok(/lecture by lecture/.test(await p.textContent('body')), 'About says answers come lecture by lecture');
  await p.fill('input[type=search]', 'thyroid'); await p.waitForTimeout(700);
  const hits = await p.evaluate(() => (document.body.innerText.match(/(\d+) questions? match/) || document.body.innerText.match(/(\d+) questions/) || [])[1]);
  ok(+hits > 20, 'search "thyroid" finds questions (' + hits + ')');
  await p.goto(BASE + '#set-anatomy-3-finals-anatomy-4-head-and-neck'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => document.body.dataset.view) === 'quiz', 'an unkeyed set opens on a question, not the end screen');
  for (let i = 0; i < 9; i++) { await p.click('button.primary'); await p.waitForTimeout(300); }
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => { const i = document.querySelector('figure.fig img'); return !!i && i.complete && i.naturalWidth > 100; }), 'Q10 shows its figure');
  await p.goto(BASE + '#module-clinical-biochemistry'); await p.waitForTimeout(1200);
  const by = await p.$('[data-by="lecture"], [data-topic-by="lecture"]'); if (by) { await by.click(); await p.waitForTimeout(500); }
  ok(/Pre-analytical phase/.test(await p.textContent('body')), 'biochemistry lists the pre-analytical phase');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
