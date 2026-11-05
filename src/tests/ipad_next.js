// Next on an iPad (5 November 2026): a tap that never becomes a click still presses Next; a crash while drawing shows its
// error on screen and, if the plain redraw crashes too, the page reloads onto the next question (everything is saved).
const { chromium, devices } = require('playwright');
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPad Pro 11'], reducedMotion: 'reduce' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  const mod = await p.$eval('[data-topic]', e => e.dataset.topic);
  await p.tap(`[data-topic="${mod}"]`); await p.waitForTimeout(250);
  await p.tap(`[data-start="${mod}"]`); await p.waitForTimeout(300);
  const idx = () => p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /mcq/.test(k) && /session/.test(localStorage.getItem(k) || '')))).session.idx);
  await p.tap('.opt[data-opt="0"]'); await p.waitForTimeout(150);
  await p.tap('[data-act="primary"]'); await p.waitForTimeout(250);   // check
  check(await p.isVisible('#verdict'), 'checked: the verdict shows');
  // a tap on Next that never becomes a click
  const i0 = await idx();
  await p.evaluate(() => { const b = document.querySelector('[data-act="primary"]'), r = b.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    for (const t of ['pointerdown', 'pointerup']) b.dispatchEvent(new PointerEvent(t, { pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); });
  await p.waitForTimeout(700);
  check(await idx() === i0 + 1, `a tap with no click still goes on (${i0} → ${await idx()})`);
  // drawing crashes once: the error shows, the plain redraw works
  await p.tap('.opt[data-opt="0"]'); await p.waitForTimeout(100);
  await p.evaluate(() => { window.__breakPaint = 1; });
  await p.tap('[data-act="primary"]'); await p.waitForTimeout(300);
  check(/Something broke: test break/.test(await p.textContent('#toast')) && await p.isVisible('#verdict'), 'a crash: the error on screen, then the verdict');
  // crashes twice: it reloads onto the next question
  const i1 = await idx();
  await p.evaluate(() => { window.__breakPaint = 2; });
  await Promise.all([p.waitForNavigation({ timeout: 5000 }).catch(() => null), p.tap('[data-act="primary"]')]);
  await p.waitForTimeout(800);
  check(await idx() === i1 + 1 && await p.isVisible('.qcard'), `crashes twice: reloaded onto the next question (${i1} → ${await idx()})`);
  check(!errs.filter(e => !/test break/.test(e)).length, 'no other page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
})();
