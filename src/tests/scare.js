// The good-luck jumpscare (14 October 2026): once per device, a minute after the Den opens (here 1.5 s), the face
// fills the screen, then "Gotcha" with a button back; it never shows again on that device; automated browsers skip it
// unless window.__scareTest. Screenshots: shots/scare_*.png.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
fs.mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const errors = [];
(async () => {
  const b = await chromium.launch();
  for (const [tag, vp] of [['desk', { width: 1280, height: 800 }], ['phone', { width: 390, height: 780 }]]) {
    const ctx = await b.newContext({ viewport: vp });
    await ctx.addInitScript(() => { window.__scareTest = true; window.__scareWait = 1500; });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(tag + ': ' + e.message));
    await p.goto(URL); await p.waitForTimeout(600);
    check(!(await p.$('#scare')), `${tag}: nothing at first`);
    await p.mouse.click(5, 300);   // a tap, so the scream can play
    await p.waitForTimeout(2200);
    check(await p.isVisible('#scare .sc-face'), `${tag}: after the wait, the face fills the screen`);
    await p.screenshot({ path: OUT + `scare_${tag}.png` });
    await p.waitForTimeout(2200);
    check(await p.isVisible('#scare .sc-after') && /Gotcha/.test(await p.textContent('#scare .sc-after')), `${tag}: then "Gotcha" and good luck`);
    await p.screenshot({ path: OUT + `scare_${tag}_after.png` });
    await p.click('[data-scare-close]'); await p.waitForTimeout(700);
    check(!(await p.$('#scare')), `${tag}: the button closes it`);
    await p.reload(); await p.waitForTimeout(2600);
    check(!(await p.$('#scare')), `${tag}: it never comes back on that device`);
    await ctx.close();
  }
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.addInitScript(() => { window.__scareWait = 800; });
  await p.goto(URL); await p.waitForTimeout(2000);
  check(!(await p.$('#scare')), 'automated browsers (the other tests) never get it');
  await ctx.close();
  await b.close();
  for (const e of errors) check(false, e);
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
