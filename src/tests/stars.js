// Stars: a right answer sends a star to its square on the strip, which twinkles; the streak grows in the bar as the
// Great Bear (complete at 7, with a shooting star); the end of a session draws it as a constellation (one star per
// question, right ones lit and joined while in a row) as the score counts up, says what the session added, and doesn't
// replay on a redraw. With reduced motion: no flying or shooting stars, and the end is drawn at once. Also: the quest's
// questions now have their explanations. Screenshots: shots/stars_*.png.
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
fs.mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const errors = [];
const watch = (p, tag) => p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));

async function session(b, opts, pick) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const p = await ctx.newPage(); watch(p, opts.reducedMotion || 'motion');
  await p.goto(URL, { waitUntil: 'load' });
  const bank = await p.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
  const qids = pick(bank);
  await p.evaluate(([K, qids]) => { localStorage.clear(); localStorage.setItem(K, JSON.stringify({ view: 'quiz', session: { topic: '*', type: 'all', set: null, mode: 'all', shuffle: false, qids, order: qids.slice(), idx: 0 } })); }, [KEY, qids]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  return { ctx, p, bank, qids, Q: new Map(bank.questions.map(q => [q.id, q])) };
}
async function answer(p, q, right) {
  const pick = right ? q.answer : [[...q.options.keys()].find(i => !q.answer.includes(i))];
  for (const i of pick) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]');
}

(async () => {
  const b = await chromium.launch();

  // 1. nine questions: two right, the star flies; seven in a row, the Great Bear; then one wrong
  const keyed = bank => bank.questions.filter(q => q.answer.length && q.topic === 'digestive-system-disease').slice(0, 9).map(q => q.id);
  let { ctx, p, qids, Q } = await session(b, {}, keyed);
  await answer(p, Q.get(qids[0]), true); await p.waitForTimeout(250);
  check((await p.$$('.flystar')).length >= 1, 'a right answer: a star leaves the right pick');
  await p.waitForTimeout(1100);
  check(!(await p.$('.flystar')) && (await p.$eval('.strip .cell.cur', e => e.className)).includes('twinkle'), 'it lands on the strip, which twinkles');
  check(!(await p.$('.bar .streak')), 'one right: no streak yet');
  for (let k = 1; k < 7; k++) {
    await p.click('[data-act="primary"]'); await p.waitForTimeout(120);
    await answer(p, Q.get(qids[k]), true); await p.waitForTimeout(k === 6 ? 700 : 150);
    if (k === 1) {
      check(await p.$$eval('.bar .streak circle.on', c => c.length) === 2 && await p.$$eval('.bar .streak line', l => l.length) === 1, 'two in a row: two stars of the Great Bear, joined');
      await (await p.$('.bar')).screenshot({ path: OUT + 'stars_streak2.png' });
    }
  }
  check(await p.$$eval('.bar .streak circle.on', c => c.length) === 7 && (await p.getAttribute('.bar .streak', 'class')).includes('full') && /7/.test(await txt(p, '.bar .streak')), 'seven in a row: the Great Bear is complete');
  check((await p.$$('.shoot')).length === 1, 'and a shooting star crosses the screen');
  await p.screenshot({ path: OUT + 'stars_bear.png' });
  await p.waitForTimeout(1200);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(120);
  await answer(p, Q.get(qids[7]), false); await p.waitForTimeout(300);
  check(!(await p.$('.bar .streak')) && !(await p.$('.flystar')), 'a wrong answer: the streak goes quietly, no star');
  await p.click('[data-act="primary"]'); await p.waitForTimeout(120);
  await answer(p, Q.get(qids[8]), true); await p.waitForTimeout(200);

  // the end: the constellation draws, the score counts up
  await p.click('[data-act="primary"]'); await p.waitForTimeout(150);
  const early = await p.textContent('.score b');
  check(await p.evaluate(() => document.body.dataset.view) === 'done' && (await p.$$('.dc path.ds')).length === 8 && (await p.$$('.dc circle.ds.w')).length === 1 && (await p.$$('.dc line.dl')).length === 6,
    'the end: 8 lit stars, 1 dim, joined while in a row (6 lines)');
  await p.waitForTimeout(1500);
  const late = await p.textContent('.score b');
  check(+early < 8 && late === '8', `the score counts up (${early} → ${late})`);
  check(/A constellation of 8 stars, its longest line 7 in a row/.test(await txt(p, '.dc-name')), 'its name: ' + await txt(p, '.dc-name'));
  const gains = await p.$$eval('.dc-gains li', l => l.map(x => x.textContent.trim()));
  check(gains.some(t => /Longest line: 7 right in a row/.test(t)) && gains.some(t => /toward its diagnostic|diagnostic is open/.test(t)) && gains.some(t => /comet comes back tomorrow/.test(t)) && gains.some(t => /moon/.test(t)),
    'what it added: ' + gains.join(' | '));
  await p.screenshot({ path: OUT + 'stars_done.png' });
  // a redraw doesn't replay it
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  check((await p.getAttribute('.dc', 'class')).includes('now') && await p.textContent('.score b') === '8', 'coming back to it: drawn at once, no replay');
  await ctx.close();

  // 2. reduced motion: no stars flying or shooting, the end drawn at once
  ({ ctx, p, qids, Q } = await session(b, { reducedMotion: 'reduce' }, bank => bank.questions.filter(q => q.answer.length).slice(0, 2).map(q => q.id)));
  await answer(p, Q.get(qids[0]), true); await p.waitForTimeout(250);
  check(!(await p.$('.flystar')), 'reduced motion: no flying star');
  await p.click('[data-act="primary"]'); await p.waitForTimeout(120);
  await answer(p, Q.get(qids[1]), true); await p.waitForTimeout(150);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(150);
  check((await p.getAttribute('.dc', 'class')).includes('now') && await p.textContent('.score b') === '2', 'reduced motion: the end is drawn at once');
  await ctx.close();

  // 3. a phone: the end fits
  const ph = await b.newContext({ ...devices['iPhone 13'] });
  const m = await ph.newPage(); watch(m, 'phone');
  await m.goto(URL, { waitUntil: 'load' });
  const bank = await m.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
  const ids = bank.questions.filter(q => q.answer.length).slice(0, 30).map(q => q.id);
  const answers = Object.fromEntries(ids.map((id, i) => { const q = bank.questions.find(x => x.id === id); return [id, { sel: q.answer, checked: true, correct: i % 4 !== 3 }]; }));
  await m.evaluate(([K, ids, answers]) => { localStorage.clear(); localStorage.setItem(K, JSON.stringify({ view: 'done', answers, session: { topic: '*', type: 'all', set: null, mode: 'all', shuffle: false, qids: ids, order: ids.slice(), idx: 29, gain: { best: 3 } } })); }, [KEY, ids, answers]);
  await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(2200);
  const w = await m.evaluate(() => [document.documentElement.scrollWidth - document.documentElement.clientWidth, document.querySelectorAll('.dc .ds').length]);
  check(w[0] === 0 && w[1] === 30, `phone: 30 stars in two rows, no sideways scroll (${w})`);
  await m.screenshot({ path: OUT + 'stars_phone.png' });
  await ph.close();

  // 4. the quest's questions explain themselves now
  const ec = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const e = await ec.newPage(); watch(e, 'exp');
  await e.goto(URL, { waitUntil: 'load' });
  const share = await e.evaluate(() => { const B = JSON.parse(document.getElementById('bank').textContent); const Q = new Map(B.questions.map(q => [q.id, q])); return [B.quest.q.filter(id => Q.get(id).exp).length, B.quest.q.length]; });
  check(share[0] >= 98, `the quest's questions with explanations: ${share[0]} of ${share[1]}`);
  await ec.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
