// EFM1 S1: its own page and storage, no sky, every module drawn, the switch back to S5; since 25 November 2026 its 436
// questions (Year 1 photos), every answer Claude's and said so; a set opens, its figure loads, search finds by lecture.
const { chromium } = require('playwright');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765') + '/efm1-s1/index.html';
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1500);
  const st = await p.evaluate(() => ({
    keys: Object.keys(localStorage), sem: localStorage.getItem('den-sem'),
    sky: !!document.getElementById('class-sky'), wins: document.querySelectorAll('.arch svg.window').length,
    sw: [...document.querySelectorAll('[data-sem-go]')].map(a => a.getAttribute('href')),
  }));
  check(st.sem === 'efm1-s1', 'remembers the semester');
  check(!st.keys.includes('efm3-mcq-bank-v1'), 'never touches the S5 store');
  check(!st.sky, 'no class sky');
  check(st.wins === 6, 'a window for each of the 6 modules (no foreign languages): ' + st.wins);
  check(st.sw.includes('../'), 'the switch leads back to S5');
  check(+((await p.textContent('button.navstat')).match(/([\d,]+) questions/)[1].replace(/,/g, '')) >= 436, 'the count shows the S1 questions');
  check(/Claude’s for now/.test(await p.textContent('body')), 'About says the answers are Claude’s, not yet checked');
  await p.fill('#q', ''); await p.type('#q', 'isomers', { delay: 5 }); await p.waitForTimeout(900);
  const hits = await p.evaluate(() => document.querySelectorAll('#search-results [data-qid], #search-results .q-row, #search-results li').length);
  check(+hits >= 10, 'search "isomers" finds questions (' + hits + ')');
  await p.goto(BASE + '#set-biostatistics-public-health-mock-public-health-and-biostatistics'); await p.waitForTimeout(1500);
  check(await p.evaluate(() => document.body.dataset.view) === 'quiz', 'a set opens on a question');
  await p.evaluate(() => { const b = [...document.querySelectorAll('.strip button, [data-jump]')].find(x => x.textContent.trim() === '13'); if (b) b.click(); }); await p.waitForTimeout(1400);
  check(await p.evaluate(() => { const i = document.querySelector('figure.fig img'); return !!i && i.complete && i.naturalWidth > 100; }), 'the GBD question shows its figure');
  await p.goto(BASE + '#module-biophysics'); await p.waitForTimeout(1200);
  const by = await p.$('[data-by="lecture"], [data-topic-by="lecture"]'); if (by) { await by.click(); await p.waitForTimeout(500); }
  check(/Hearing/.test(await p.textContent('body')), 'biophysics lists the hearing topic');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'all passed'); await b.close(); process.exit(fails ? 1 : 0);
})();
