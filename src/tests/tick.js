// The extra tick (Abi, 28 October 2026): when a habit shows in the last 40 clean tries (the right answers ticked,
// plus a wrong one, which the exam's rule turns into 0), the Labubu says so: a card on the homepage for a day ("Got it"
// puts it away; "Redo those N" practises them), and a speech bubble right after a question lost that way. No habit, no
// card. Phone layout.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { window.__tickTest = true; });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const bank = await p.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
  const pool = bank.questions.filter(q => q.answer.length && q.options.length > q.answer.length && !q.dupOf);
  const over = pool.slice(0, 10), right = pool.slice(10, 30);
  const seed = async (overN) => {
    await p.evaluate(([K, over, right, n]) => {
      const S = JSON.parse(localStorage.getItem(K) || '{}'); S.clean = {}; let t = Date.now() - 1e6;
      over.slice(0, n).forEach(q => { const w = [...q.options.keys()].find(i => !q.answer.includes(i)); S.clean[q.id] = { s: [...q.answer, w], ok: false, t: t++, x: 0 }; });
      right.forEach(q => { S.clean[q.id] = { s: q.answer.slice(), ok: true, t: t++, x: 0 }; });
      localStorage.setItem(K, JSON.stringify(S));
      localStorage.removeItem('efm3-tick-home'); localStorage.removeItem('efm3-tick-pop');
    }, [KEY, over, right, overN]);
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  };

  // no habit: everything right, no card
  await seed(0);
  check(!(await p.$('.tk')), 'no extra ticks: no word from the Labubu');
  // a habit: 10 of 30 lost to one extra tick
  await seed(10);
  const card = (await p.$('.tk')) ? await txt(p, '.tk') : '';
  check(/One tick too many/.test(card) && /10 of your last 30/.test(card) && /20\/20 instead of 13\.33/.test(card) && /Redo those 10/.test(card), 'the homepage card: ' + card.slice(0, 260));
  check(!!(await p.$('.tk svg.lb-live')), 'with the Labubu, eyes and all');
  await p.evaluate(() => document.querySelector('.tk').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + 'tick_home.png' });
  // a day later it's gone, and it doesn't come back the same week
  await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('efm3-tick-home')); r.at -= 25 * 3600e3; localStorage.setItem('efm3-tick-home', JSON.stringify(r)); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  check(!(await p.$('.tk')), 'a day later, the card is gone');
  // Got it puts it away for good (till the next week)
  await p.evaluate(() => localStorage.removeItem('efm3-tick-home'));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  await p.click('[data-act="tick-gone"]'); await p.waitForTimeout(300);
  const gone1 = !(await p.$('.tk'));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  check(gone1 && !(await p.$('.tk')), '"Got it" puts it away, after a reload too');
  // Redo those 10
  await p.evaluate(() => localStorage.removeItem('efm3-tick-home'));
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  await p.click('[data-act="tick-practise"]'); await p.waitForTimeout(400);
  const S1 = await p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
  check(S1.session && S1.session.qids.length === 10 && S1.session.qids.every(id => over.some(q => q.id === id)) && (await p.evaluate(() => document.body.dataset.view)) === 'quiz', `"Redo those 10": a session of exactly those (${S1.session && S1.session.qids.length})`);
  // in the quiz: the right answers plus one more, and the Labubu speaks
  const q = bank.questions.find(x => x.id === S1.session.qids[0]);
  const w = [...q.options.keys()].find(i => !q.answer.includes(i));
  for (const i of [...q.answer, w]) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(1200);
  const say = (await p.$('.lb-say.on')) ? await txt(p, '.lb-say') : '';
  const L = 'ABCDE';
  check(new RegExp(`You had ${q.answer.map(i => L[i]).join(', ')}\\.`).test(say) && new RegExp(`Then ${L[w]}, and on the exam`).test(say) && /half a point beats zero/.test(say), 'after the question, the Labubu speaks: ' + say.slice(0, 200));
  await p.screenshot({ path: OUT + 'tick_say.png' });
  await p.click('[data-say="ok"]'); await p.waitForTimeout(500);
  check(!(await p.$('.lb-say')), '"Got it" closes it');
  // a plain wrong answer (no right one ticked) says nothing
  await p.click('[data-act="primary"]'); await p.waitForTimeout(300);
  const S2 = await p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
  const q2 = bank.questions.find(x => x.id === S2.session.qids[1]);
  await p.click(`.opt[data-opt="${[...q2.options.keys()].find(i => !q2.answer.includes(i))}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(1200);
  check(!(await p.$('.lb-say')), 'a plain wrong answer: no bubble');
  // phone
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage();
  m.on('pageerror', e => errors.push('phone pageerror: ' + e.message));
  await m.goto(URL, { waitUntil: 'load' });
  await m.evaluate(([K, over, right]) => {
    const S = JSON.parse(localStorage.getItem(K) || '{}'); S.clean = {}; let t = Date.now() - 1e6;
    over.forEach(q => { const w = [...q.options.keys()].find(i => !q.answer.includes(i)); S.clean[q.id] = { s: [...q.answer, w], ok: false, t: t++, x: 0 }; });
    right.forEach(q => { S.clean[q.id] = { s: q.answer.slice(), ok: true, t: t++, x: 0 }; });
    localStorage.setItem(K, JSON.stringify(S));
  }, [KEY, over, right]);
  await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(500);
  await m.evaluate(() => document.querySelector('.tk').scrollIntoView({ block: 'center' })); await m.waitForTimeout(200);
  const ow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(!!(await m.$('.tk')) && ow === 0, 'phone: the card fits, no sideways scroll');
  await m.screenshot({ path: OUT + 'tick_phone.png' });
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
