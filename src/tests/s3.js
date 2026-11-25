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
  ok(+((await p.textContent('button.navstat')).match(/([\d,]+) questions/)[1].replace(/,/g, '')) >= 1179, 'the count shows the S3 questions');
  ok(/lecture by lecture/.test(await p.textContent('body')), 'About says answers come lecture by lecture');
  await p.fill('#q', ''); await p.type('#q', 'thyroid', { delay: 5 }); await p.waitForTimeout(900);
  const hits = await p.evaluate(() => document.querySelectorAll('#search-results [data-qid], #search-results .q-row, #search-results li').length);
  ok(+hits > 20, 'search "thyroid" finds questions (' + hits + ')');
  await p.goto(BASE + '#set-anatomy-3-finals-anatomy-4-head-and-neck'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => document.body.dataset.view) === 'quiz', 'a set opens on a question');
  await p.evaluate(() => { const b = [...document.querySelectorAll('.strip button, [data-jump]')].find(x => x.textContent.trim() === '10'); if (b) b.click(); }); await p.waitForTimeout(600);
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => { const i = document.querySelector('figure.fig img'); return !!i && i.complete && i.naturalWidth > 100; }), 'Q10 shows its figure');
  await p.goto(BASE + '#module-clinical-biochemistry'); await p.waitForTimeout(1200);
  const by = await p.$('[data-by="lecture"], [data-topic-by="lecture"]'); if (by) { await by.click(); await p.waitForTimeout(500); }
  ok(/Pre-analytical phase/.test(await p.textContent('body')), 'biochemistry lists the pre-analytical phase');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
