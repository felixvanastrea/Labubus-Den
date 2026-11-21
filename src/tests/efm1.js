// EFM1 S1: its own page, its own storage, no sky, every module drawn, lectures listed, the switch back to S5.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = []; let fails = 0;
  const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/efm1-s1/index.html'); await p.waitForTimeout(1500);
  const st = await p.evaluate(() => ({
    keys: Object.keys(localStorage), sem: localStorage.getItem('den-sem'),
    sky: !!document.getElementById('class-sky'), wins: document.querySelectorAll('.arch svg.window').length,
    search: document.querySelector('.skyband') && document.querySelector('.skyband').hidden,
    idle: !!document.querySelector('.s-idle'), sw: [...document.querySelectorAll('[data-sem-go]')].map(a => a.getAttribute('href')),
  }));
  check(st.sem === 'efm1-s1', 'remembers the semester');
  check(!st.keys.includes('efm3-mcq-bank-v1'), 'never touches the S5 store');
  check(!st.sky, 'no class sky');
  check(st.wins === 7, 'a window for each of the 7 modules: ' + st.wins);
  check(st.search && !st.idle, 'no search while it has no questions');
  check(st.sw.includes('../'), 'the switch leads back to S5');
  await p.click('.arch[data-topic="biophysics"]'); await p.waitForTimeout(600);
  const rows = await p.$$eval('.lec-none', r => r.length);
  check(rows === 19, 'Biophysics lists its 19 lectures: ' + rows);
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'all passed'); await b.close(); process.exit(fails ? 1 : 0);
})();
