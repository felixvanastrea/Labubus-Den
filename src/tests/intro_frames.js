// Frames of the opening animation at fixed times (the page clock is faked, so every frame is exact).
const { chromium } = require('playwright');
const OUT = process.env.OUT || require('path').join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const TIMES = (process.env.TIMES || '0,500,900,1150,1500,1900,2300,2700,3100,3450,3650,3850,4300,5200').split(',').map(Number);
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [tag, opts] of [['d', { viewport: { width: 1440, height: 900 } }], ['m', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    if (process.env.ONLY && process.env.ONLY !== tag) continue;
    const ctx = await browser.newContext(opts);
    const pg = await ctx.newPage();
    pg.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
    await pg.clock.install({ time: 0 });
    await pg.clock.pauseAt(1000);
    await pg.goto('http://127.0.0.1:8765/index.html#intro', { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    let now = 0;
    for (const t of TIMES) {
      await pg.clock.runFor(t - now); now = t;
      await pg.screenshot({ path: `${OUT}in_${tag}_${String(t).padStart(4, '0')}.png` });
    }
    const st = await pg.evaluate(() => ({
      canvases: document.querySelectorAll('.intro-sky,.intro-fx').length,
      introOn: document.documentElement.classList.contains('intro-on'),
      transform: document.getElementById('app').style.transform,
      titleHold: document.getElementById('title').classList.contains('hold'),
      pixel: document.getElementById('title').classList.contains('pixel-ready'),
      scrollY: window.scrollY,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    console.log(tag, JSON.stringify(st));
    await ctx.close();
  }
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
