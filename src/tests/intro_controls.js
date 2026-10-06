// Skipping, replaying and turning off the opening animation; reduced motion; no stray errors.
const { chromium } = require('playwright');
const OUT = process.env.OUT || require('path').join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:8765/index.html';
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (pg, tag) => {
    pg.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/fonts\.googleapis|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
  };
  const state = pg => pg.evaluate(() => ({
    canvases: document.querySelectorAll('.intro-sky,.intro-fx').length,
    hint: !!document.querySelector('.intro-hint'),
    transform: document.getElementById('app').style.transform,
    hold: !!document.querySelector('#title.hold'),
    view: document.body.dataset.view
  }));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pg = await ctx.newPage();
  watch(pg, 'main');
  await pg.clock.install({ time: 0 });
  await pg.clock.pauseAt(1000);

  // 1. the picker first (EFM3, then S5), then a click skips: the page lands at once, the title shows, the layers clear
  await pg.goto(URL + '#intro', { waitUntil: 'load' });
  await pg.clock.runFor(1200);
  console.log('picking       ', JSON.stringify(await state(pg)), 'picker:', await pg.$$eval('.pk-year', b => b.map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' | ')));
  await pg.click('.pk-year[data-year="efm3"]'); await pg.clock.runFor(800);
  await pg.click('.pk-sem[data-sem="s5"]');
  await pg.clock.runFor(1500);
  console.log('mid-intro     ', JSON.stringify(await state(pg)));
  await pg.mouse.click(640, 400);
  await pg.clock.runFor(60);
  console.log('just skipped  ', JSON.stringify(await state(pg)));
  await pg.clock.runFor(600);
  console.log('after skip    ', JSON.stringify(await state(pg)), 'view stays home:', await pg.evaluate(() => document.body.dataset.view));

  // 2. while picking, a key doesn't skip ("/" doesn't focus the search either); once the star falls, a key skips
  await pg.reload({ waitUntil: 'load' });
  await pg.clock.runFor(1200);
  await pg.keyboard.press('/');
  await pg.clock.runFor(100);
  console.log('key, picking  ', JSON.stringify(await state(pg)), 'picker still there:', !!(await pg.$('.pick')));
  await pg.click('.pk-year[data-year="efm3"]'); await pg.clock.runFor(800);
  await pg.click('.pk-sem[data-sem="s5"]'); await pg.clock.runFor(600);
  await pg.keyboard.press('/');
  await pg.clock.runFor(600);
  console.log('key skip      ', JSON.stringify(await state(pg)), 'focused:', await pg.evaluate(() => document.activeElement && document.activeElement.id));

  // 3. wheel skips
  await pg.reload({ waitUntil: 'load' });
  await pg.clock.runFor(2000);
  await pg.mouse.move(600, 400);
  await pg.mouse.wheel(0, 300);
  await pg.clock.runFor(600);
  console.log('wheel skip    ', JSON.stringify(await state(pg)));

  // 4. replay from the footer (scrolled to the bottom), then let it run to the end
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await pg.clock.runFor(100);
  console.log('footer text   ', await pg.evaluate(() => [...document.querySelectorAll('.foot p')].map(p => p.textContent.trim()).join(' | ')));
  await pg.click('[data-act="intro-replay"]');
  await pg.clock.runFor(300);
  console.log('replaying     ', JSON.stringify(await state(pg)), 'scrollY', await pg.evaluate(() => scrollY), 'picker:', !!(await pg.$('.pick')));
  await pg.clock.runFor(900);
  await pg.click('.pk-year[data-year="efm3"]'); await pg.clock.runFor(800);
  await pg.click('.pk-sem[data-sem="s5"]');
  await pg.clock.runFor(2000);
  console.log('replay mid    ', JSON.stringify(await state(pg)));
  await pg.clock.runFor(3000);
  console.log('replay done   ', JSON.stringify(await state(pg)));

  // 5. turn it off: the next visit opens straight on the page
  const sw = '[data-act="intro-toggle"]';
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await pg.click(sw);
  console.log('switch        ', await pg.getAttribute(sw, 'aria-checked'), await pg.textContent(sw), 'stored:', await pg.evaluate(() => localStorage.getItem('efm3-mcq-intro')));
  await pg.reload({ waitUntil: 'load' });
  await pg.clock.runFor(300);
  console.log('off, reloaded ', JSON.stringify(await state(pg)));
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await pg.click(sw);
  console.log('switch again  ', await pg.getAttribute(sw, 'aria-checked'), 'stored:', await pg.evaluate(() => localStorage.getItem('efm3-mcq-intro')));

  // 6. opening on another page (a quiz in progress) never plays it
  await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('efm3-mcq-bank-v1') || '{}'); s.view = 'repeats'; localStorage.setItem('efm3-mcq-bank-v1', JSON.stringify(s)); });
  await pg.reload({ waitUntil: 'load' });
  await pg.clock.runFor(300);
  console.log('repeats page  ', JSON.stringify(await state(pg)));
  await ctx.close();

  // 7. reduced motion: no animation, no switch in the footer
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage();
  watch(rp, 'reduced');
  await rp.goto(URL + '#intro', { waitUntil: 'load' });
  await rp.waitForTimeout(400);
  console.log('reduced       ', JSON.stringify(await state(rp)), 'switch:', await rp.$$eval('[data-act="intro-toggle"]', b => b.length));
  await rctx.close();

  // 8. without the #intro flag an automated browser skips it (page captures and thumbnails)
  const pctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pp = await pctx.newPage();
  watch(pp, 'plain');
  await pp.goto(URL, { waitUntil: 'load' });
  await pp.waitForTimeout(1500);
  console.log('plain load    ', JSON.stringify(await state(pp)));
  await pp.screenshot({ path: OUT + 'plain_home.png', fullPage: true });
  await pctx.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
