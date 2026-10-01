const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await p.addInitScript(() => { try { delete Document.prototype.startViewTransition; } catch (e) {} });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  console.log('VT available:', await p.evaluate(() => typeof document.startViewTransition));
  await p.tap('button[data-topic="endocrinology"]');
  console.log('enter class right after nav:', await p.evaluate(() => document.getElementById('app').className));
  await p.waitForTimeout(800);
  await p.tap('button[data-start="endocrinology"]'); await p.waitForTimeout(300);
  await p.tap('.opt[data-opt="0"]'); await p.tap('[data-act="primary"]'); await p.tap('[data-act="primary"]');
  console.log('after next:', await p.evaluate(() => document.getElementById('app').className), await p.textContent('.bar-count'));
  await p.waitForTimeout(800);
  console.log('class cleared:', JSON.stringify(await p.evaluate(() => document.getElementById('app').className)), 'errors:', errs);
  await b.close();
})();
