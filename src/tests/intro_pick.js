// The opening's picker: the years as constellations (EFM3 open, EFM2 and EFM4 in progress), then EFM3's semesters
// (S5 open, S6 in progress), "Other years" back; locked ones only shake; clicks on the sky, keys and small wheel
// moves don't skip while picking; Escape, a real scroll and "Skip the intro" do; S5 makes the star fall from where
// it is and the page lands; phone layout. The page clock is faked; CSS animations get real time before screenshots.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html#intro';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const st = pg => pg.evaluate(() => ({
  pick: !!document.querySelector('.pick:not(.out)'),
  stage: (document.querySelector('.pick:not(.out) .pk-stage:last-of-type .pk-t') || {}).textContent || '',
  hint: !!document.querySelector('.intro-hint'),
  canvases: document.querySelectorAll('.intro-sky,.intro-fx').length,
  hold: !!document.querySelector('#title.hold'),
  introOn: document.documentElement.classList.contains('intro-on')
}));

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (pg, tag) => {
    pg.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  };
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage(); watch(pg, 'desk');
  await pg.clock.install({ time: 0 });
  await pg.clock.pauseAt(1000);
  await pg.goto(URL, { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.clock.runFor(1200);
  let s = await st(pg);
  check(s.pick && s.stage === 'Choose your year' && s.canvases === 2 && s.introOn && !s.hint, 'the sky opens on "Choose your year"');
  const years = await pg.$$eval('.pk-year', bs => bs.map(x => `${x.querySelector('.pk-name').textContent}:${x.getAttribute('aria-disabled') ? 'locked' : 'open'}:${x.querySelector('.pk-sub').textContent}`));
  check(years.join(' ') === 'EFM2:locked:in progress EFM3:open:third year EFM4:locked:in progress', 'years: ' + years.join(' '));
  await pg.waitForTimeout(1900);
  await pg.screenshot({ path: OUT + 'pk_years.png' });
  // nothing skips by accident while picking
  await pg.clock.runFor(4000);
  s = await st(pg);
  check(s.pick && s.hold, 'it waits for a choice: no star falls on its own');
  await pg.click('.pk-year[data-year="efm2"]', { force: true }); await pg.clock.runFor(100);
  check((await st(pg)).stage === 'Choose your year' && await pg.$eval('[data-year="efm2"]', e => e.classList.contains('nope')), 'EFM2 is locked: it only shakes');
  await pg.mouse.click(30, 30); await pg.keyboard.press('/'); await pg.mouse.move(700, 450); await pg.mouse.wheel(0, 8);
  await pg.clock.runFor(200);
  check((await st(pg)).pick && await pg.evaluate(() => !document.activeElement || document.activeElement.id !== 'q'), 'a click on the sky, a key and a nudge of the wheel don\'t skip');
  // EFM3: its semesters
  await pg.click('.pk-year[data-year="efm3"]'); await pg.clock.runFor(800);
  check((await st(pg)).stage === 'Choose your semester' && await pg.$$eval('.pk-stage', x => x.length) === 1, 'EFM3 opens its semesters');
  const sems = await pg.$$eval('.pk-sem', bs => bs.map(x => `${x.querySelector('b').textContent}:${x.getAttribute('aria-disabled') ? 'locked' : 'open'}`));
  check(sems.join(' ') === 'S5:open S6:locked', 'semesters: ' + sems.join(' '));
  await pg.waitForTimeout(1300);
  await pg.screenshot({ path: OUT + 'pk_sems.png' });
  await pg.click('.pk-sem[data-sem="s6"]', { force: true }); await pg.clock.runFor(100);
  check((await st(pg)).stage === 'Choose your semester', 'S6 is locked');
  await pg.click('.pk-back'); await pg.clock.runFor(800);
  check((await st(pg)).stage === 'Choose your year', 'Other years goes back');
  await pg.click('.pk-year[data-year="efm3"]'); await pg.clock.runFor(800);
  await pg.waitForTimeout(1000);
  // S5: the star leaves from where S5 is
  const dot = await pg.$eval('.pk-sem[data-sem="s5"] .pk-dot', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await pg.click('.pk-sem[data-sem="s5"]'); await pg.clock.runFor(120);
  s = await st(pg);
  check(!s.pick && s.hint && s.hold, 'S5: the picker fades, "click anywhere to skip", the star falls');
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + 'pk_fire.png' });
  const lit = await pg.evaluate(({ x, y }) => { const c = document.querySelector('.intro-fx'); const g = c.getContext('2d'), k = c.width / innerWidth; const d = g.getImageData(Math.round(x * k) - 30, Math.round(y * k) - 30, 60, 60).data; let m = 0; for (let i = 3; i < d.length; i += 4) m = Math.max(m, d[i]); return m; }, dot);
  check(lit > 0, 'the falling star starts at S5 (light on the effects layer there: ' + lit + ')');
  await pg.clock.runFor(4000);
  s = await st(pg);
  check(!s.hold && !s.introOn && s.canvases === 0 && !s.hint && !(await pg.$('.pick')), 'it lands: the title shows, the sky layers are gone');

  // the ways to skip while picking
  for (const [how, act] of [['Skip the intro', p => p.click('.pk-skip')], ['Escape', p => p.keyboard.press('Escape')], ['a real scroll', async p => { await p.mouse.move(700, 450); await p.mouse.wheel(0, 300); }]]) {
    await pg.reload({ waitUntil: 'load' }); await pg.clock.runFor(1200);
    await act(pg); await pg.clock.runFor(700);
    s = await st(pg);
    check(!s.hold && s.canvases === 0 && !(await pg.$('.pick')), `${how} skips it`);
  }
  await ctx.close();

  // phone
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  watch(m, 'phone');
  await m.clock.install({ time: 0 });
  await m.clock.pauseAt(1000);
  await m.goto(URL, { waitUntil: 'load' });
  await m.evaluate(() => document.fonts.ready);
  await m.clock.runFor(1200); await m.waitForTimeout(1900);
  await m.screenshot({ path: OUT + 'pk_m_years.png' });
  const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const fit = await m.evaluate(() => [...document.querySelectorAll('.pk-year')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  check(over === 0 && fit, 'phone: the three years fit, nothing sideways');
  await m.tap('.pk-year[data-year="efm3"]'); await m.clock.runFor(800); await m.waitForTimeout(1300);
  await m.screenshot({ path: OUT + 'pk_m_sems.png' });
  const semFit = await m.evaluate(() => [...document.querySelectorAll('.pk-lab')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  check(semFit, 'phone: the semester labels fit');
  await m.tap('.pk-sem[data-sem="s5"]'); await m.clock.runFor(3400);
  check(!(await st(m)).hold && !(await m.$('.pick')), 'phone: S5 lands on the page');

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
