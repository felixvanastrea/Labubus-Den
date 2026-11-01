// A new version reaches open tabs (Abi, 1 November 2026): the page knows its version (the build's hash) and checks
// version.json past the cache. Newer and nothing open: it reloads itself with ?v=, lands back where it was (the same
// question), the address tidied and no opening animation, and it won't loop if the newer page isn't served yet.
// Typing or a sheet open: a note offers it, and the next screen takes it. The same version: nothing happens.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const VJ = path.join(process.env.TESTDIR || __dirname, 'version.json');
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
(async () => {
  const page = fs.readFileSync(path.join(process.env.TESTDIR || __dirname, 'index.html'), 'utf8');
  const mine = (page.match(/const V = '([^'_]+)'/) || [])[1];
  check(!!mine, 'the page carries its version: ' + mine);
  const b = await chromium.launch(); const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { window.__freshTest = true; });
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  let navs = 0; p.on('framenavigated', f => { if (f === p.mainFrame()) navs++; });
  fs.writeFileSync(VJ, JSON.stringify({ v: mine }));
  await p.goto(URL); await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); await p.waitForTimeout(500);
  await p.click('[data-topic="dermatology"]'); await p.waitForTimeout(300);
  await p.click('[data-start="dermatology"]'); await p.waitForTimeout(300);
  await p.click('.strip [data-jump="3"]'); await p.waitForTimeout(300);
  navs = 0;
  await p.evaluate(() => window.__fresh.check(true)); await p.waitForTimeout(800);
  check(navs === 0, 'the same version: nothing happens');
  // a newer one, with the search focused: a note, no reload
  fs.writeFileSync(VJ, JSON.stringify({ v: 'abcdef123456' }));
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'tmpin'; document.body.appendChild(i); i.focus(); });
  await p.evaluate(() => window.__fresh.check(true)); await p.waitForTimeout(800);
  check(navs === 0 && !!(await p.$('.fresh-note')), 'typing: a note instead of a reload');
  await p.screenshot({ path: path.join(__dirname, 'shots', 'fresh_note.png') });
  // the next screen, nothing focused: it reloads, back to the same question, address tidied
  await p.evaluate(() => { document.getElementById('tmpin').remove(); });
  await Promise.all([p.waitForNavigation({ timeout: 8000 }).catch(() => null), p.click('[data-act="primary"]').catch(() => p.click('.strip [data-jump="4"]'))]);
  await p.waitForTimeout(1200);
  const S = await p.evaluate(() => JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')));
  check(navs >= 1 && p.url().endsWith('/index.html') && !/\?v=/.test(p.url()), 'it reloaded itself, address tidied: ' + p.url());
  check(S.view === 'quiz' && (await p.evaluate(() => document.body.dataset.view)) === 'quiz', `back on the quiz (question ${S.session.idx + 1})`);
  check(!(await p.$('.intro-fx')), 'no opening animation after it');
  // the CDN still serves the old page: no loop
  const n0 = navs;
  await p.evaluate(() => window.__fresh && window.__fresh.check(true)); await p.waitForTimeout(1200);
  await p.click('.strip [data-jump="1"]').catch(() => {}); await p.waitForTimeout(1200);
  check(navs === n0, 'one try per version: no reload loop');
  fs.writeFileSync(VJ, JSON.stringify({ v: mine }));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close(); process.exit(fails ? 1 : 0);
})();
