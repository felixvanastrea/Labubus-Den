const { chromium } = require('playwright');
const OUT = process.env.OUT || require('path').join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await p.fill('#q', 'lice');
  const rows = await p.$$eval('[data-res]', els => els.map((e, i) => i + ': ' + e.innerText.replace(/\s+/g, ' ').slice(0, 110)));
  console.log(rows.join('\n'));
  const idx = rows.findIndex(r => /causative agent in this case/.test(r));
  await (await p.$$('[data-res]'))[idx].tap();
  await p.screenshot({ path: OUT + 'v5_m_followup.png' });
  console.log('case box:', await p.evaluate(() => (document.querySelector('.case') || {}).innerText));
  // answer it and check, then check "done" + retry mistakes for list sessions
  await p.tap('button[data-opt="0"]'); await p.tap('button[data-act="primary"]');
  console.log('verdict:', await p.textContent('.verdict .v-main'));
  // jump to end
  const n = await p.$$eval('.strip .cell', c => c.length);
  await p.tap(`.strip .cell[data-jump="${n - 1}"]`);
  await p.tap('button[data-opt="0"]'); await p.tap('button[data-act="primary"]'); await p.tap('button[data-act="primary"]');
  console.log('view after finish:', await p.evaluate(() => document.querySelector('.done') ? 'done' : 'quiz'), await p.textContent('.bar-title'));
  const mis = await p.$('button[data-act="mistakes"]');
  if (mis) { await mis.tap(); console.log('mistakes session:', await p.textContent('.bar-title'), await p.textContent('.bar-count')); }
  await p.tap('button[data-act="back"]');
  console.log('back to home with query:', await p.inputValue('#q'), (await p.$$('[data-res]')).length, 'rows; status on rows:', await p.$$eval('[data-res] .st', e => e.map(x => x.textContent).join(',')));
  // reload: fresh visit should show modules (query cleared)
  await p.reload({ waitUntil: 'networkidle' });
  console.log('after reload on home: query =', JSON.stringify(await p.inputValue('#q')), 'body visible', await p.evaluate(() => !document.getElementById('home-body').hidden));
  // '/' shortcut on desktop
  console.log('ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
