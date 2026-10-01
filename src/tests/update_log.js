// The update log: no badge on a first visit, "+N new" for returning visitors, the log page, practising an entry.
const { chromium } = require('playwright');
const OUT = process.env.OUT || require('path').join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  };
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); watch(p, 'd');
  await p.goto(URL, { waitUntil: 'load' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  console.log('first visit chip:', JSON.stringify(await p.textContent('.navstat')), '| nav:', await p.$$eval('.navlinks button', b => b.map(x => x.textContent).join(', ')));
  console.log('footer:', await p.$$eval('.foot p', ps => ps.map(x => x.textContent.trim().replace(/\s+/g, ' ')).join(' | ')));
  // a returning visitor who last saw the log before the rest of S5 came in
  await p.evaluate(KEY => { const S = JSON.parse(localStorage.getItem(KEY) || '{}'); S.seenUpdate = '2026-09-29-open'; localStorage.setItem(KEY, JSON.stringify(S)); }, KEY);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  console.log('returning chip:', JSON.stringify(await p.textContent('.navstat')));
  await p.screenshot({ path: OUT + 'log_chip.png', clip: { x: 900, y: 0, width: 540, height: 80 } });
  await p.click('.navstat');
  await p.waitForTimeout(400);
  console.log('view:', await p.evaluate(() => document.body.dataset.view), '| title:', await p.textContent('.bar-title'));
  console.log('entries:', await p.$$eval('.log-entry', els => els.map(e => (e.classList.contains('is-new') ? '[new] ' : '') + e.querySelector('.le-title').textContent + ' (' + e.querySelector('.le-kind').textContent.split('·')[0].trim() + ')').join(' | ')));
  console.log('mix lines:', await p.$$eval('.le-mix', els => els.map(e => e.textContent).join(' | ')));
  await p.screenshot({ path: OUT + 'log_page.png', fullPage: true });
  // practise the midterm entry, then come back to the log
  await p.click('[data-upd="2026-09-29-open"]');
  await p.waitForTimeout(300);
  console.log('practice:', await p.textContent('.bar-title'), '|', await p.textContent('.bar-count'));
  await p.click('.bar [data-act="back"]');
  await p.waitForTimeout(400);
  console.log('back to:', await p.evaluate(() => document.body.dataset.view));
  await p.click('.bar [data-act="home"]');
  await p.waitForTimeout(300);
  console.log('chip after seeing the log:', JSON.stringify(await p.textContent('.navstat')));
  await ctx.close();
  // phone
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage();
  watch(m, 'm');
  await m.goto(URL, { waitUntil: 'load' });
  await m.evaluate(KEY => { localStorage.setItem(KEY, JSON.stringify({ seenUpdate: '2026-09-30-search' })); }, KEY);
  await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(300);
  console.log('phone chip:', JSON.stringify(await m.textContent('.navstat')));
  await m.screenshot({ path: OUT + 'log_m_top.png', clip: { x: 0, y: 0, width: 390, height: 120 } });
  await m.tap('.navstat'); await m.waitForTimeout(400);
  await m.screenshot({ path: OUT + 'log_m_page.png' });
  await m.evaluate(() => window.scrollBy(0, 1300)); await m.waitForTimeout(200);
  await m.screenshot({ path: OUT + 'log_m_page2.png' });
  console.log('phone overflow:', await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
