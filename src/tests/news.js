// The news sheet (duels and parties): shown once per device on the homepage, after a moment; Later closes it and it
// doesn't come back; "See the colours" scrolls to the duels card; never in automated browsers unless __newsTest.
const { chromium, devices } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const errors = [];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.__newsTest = true; window.__acctTest = true; });
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(500);
  check(!(await p.isVisible('.news-sheet')), 'not at once');
  await p.waitForTimeout(1200);
  check(await p.isVisible('.news-sheet') && /Duels and parties/.test(await p.textContent('.news-sheet')), 'after a moment: the news');
  await (await p.$('.news-sheet .acct-card')).screenshot({ path: OUT + 'news.png' });
  await p.click('.news-sheet [data-news="see"]'); await p.waitForTimeout(800);
  check(!(await p.isVisible('.news-sheet')) && await p.evaluate(() => Math.abs(document.getElementById('duels').getBoundingClientRect().top) < 120), 'See the colours: closed, at the duels card');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2000);
  check(!(await p.isVisible('.news-sheet')), 'once only');
  const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
  await m.addInitScript(() => { window.__newsTest = true; });
  await m.goto(URL, { waitUntil: 'load' }); await m.evaluate(() => localStorage.clear()); await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(1800);
  check(await m.isVisible('.news-sheet') && await m.evaluate(() => document.querySelector('.news-sheet .acct-card').scrollWidth <= innerWidth), 'phone: it fits');
  await m.screenshot({ path: OUT + 'news_phone.png' });
  await m.click('.news-sheet [data-news="close"] >> nth=-1'); await m.waitForTimeout(200);
  check(!(await m.isVisible('.news-sheet')), 'Later closes it');
  const n = await (await b.newContext()).newPage();
  await n.goto(URL, { waitUntil: 'load' }); await n.waitForTimeout(1800);
  check(!(await n.isVisible('.news-sheet')), 'an automated browser without __newsTest: no sheet');
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close(); process.exitCode = fails || errors.length ? 1 : 0;
})();
