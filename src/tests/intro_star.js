// The opening without the picker (Abi, 27 October 2026: start straight with the falling star): no "Choose your year",
// the star falls from the corner of the sky at once, the skip hint shows, a tap skips once it falls, and the title
// lands on the page. The picker itself is parked behind a URL ending in #pick#intro (intro_pick.js).
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html#intro';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const st = pg => pg.evaluate(() => ({
  pick: !!document.querySelector('.pick'),
  hint: !!document.querySelector('.intro-hint'),
  canvases: document.querySelectorAll('.intro-sky,.intro-fx').length,
  hold: !!document.querySelector('#title.hold'),
  introOn: document.documentElement.classList.contains('intro-on')
}));
(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const [w, h, tag] of [[1440, 900, 'desk'], [390, 844, 'phone']]) {
    const pg = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    pg.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    await pg.clock.install({ time: 0 }); await pg.clock.pauseAt(1000);
    await pg.goto(URL, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.clock.runFor(300);
    let s = await st(pg);
    check(s.introOn && s.canvases === 2 && !s.pick, `${tag}: the intro plays with no year picker (${JSON.stringify(s)})`);
    await pg.clock.runFor(900);
    s = await st(pg);
    check(s.hint && !s.pick, `${tag}: the star is falling, the skip hint shows`);
    await pg.screenshot({ path: OUT + `intro_star_${tag}.png` });
    await pg.clock.runFor(9000);
    s = await st(pg);
    check(!s.introOn && s.canvases === 0 && !s.hold, `${tag}: it lands and hands over to the page (${JSON.stringify(s)})`);
    // replay from the footer goes the same way
    const p2 = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await p2.clock.install({ time: 0 }); await p2.clock.pauseAt(1000);
    await p2.goto(URL, { waitUntil: 'load' }); await p2.clock.runFor(1500);
    await p2.mouse.click(w / 2, h / 2); await p2.clock.runFor(1200);
    s = await st(p2);
    check(!s.introOn && !s.pick, `${tag}: a tap once it falls skips it`);
  }
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
