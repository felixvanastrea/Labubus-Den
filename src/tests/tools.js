// Crossing out, marks and what the class ticked. Crossing out: a right-click, Shift + a letter, or a long press on a
// phone strikes an option through, unpicks it, and isn't graded; picking it brings it back. Marks: the Mark button (or
// M) marks a question; it shows on the strip, on the homepage's Tonight card and the module page, which practise the
// marked ones afresh; in an exam a mark shows on the strip and in "Hand in". The class: a first try's picks are counted
// on the lead's options (a copy in another order is mapped), and a checked question shows the share of the class who
// ticked each option (against account.js's fake Firebase). Screenshots: shots/tools_*.png.
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
fs.mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
const src = fs.readFileSync(path.join(__dirname, 'account.js'), 'utf8');
const FAKE = new Function(src.slice(src.indexOf('const FAKE = {'), src.indexOf('\n};\n', src.indexOf('const FAKE = {')) + 3) + '\nreturn FAKE;')();
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const state = p => p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
const cls = (p, sel) => p.$eval(sel, e => e.className);
const errors = [];
const watch = (p, tag) => p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
const MOD = 'digestive-system-disease';

(async () => {
  const b = await chromium.launch();

  // ---- practice on a computer ----
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); watch(p, 'desk');
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const bank = await p.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
  await p.click(`[data-topic="${MOD}"]`); await p.waitForTimeout(200);
  await p.click(`[data-start="${MOD}"]`); await p.waitForTimeout(250);
  check(/right-click one to cross it out/.test(await txt(p, '.hint')), 'the hint says how to cross out: ' + await txt(p, '.hint'));
  await p.click('.opt[data-opt="0"]', { button: 'right' }); await p.waitForTimeout(150);
  check((await cls(p, '.opt[data-opt="0"]')).includes('is-out') && await p.getAttribute('.opt[data-opt="0"]', 'aria-pressed') === 'false', 'a right-click crosses A out, unpicked');
  check(!(await p.$('.hint-x')), 'then the hint stops explaining it');
  await p.click('.opt[data-opt="0"]'); await p.waitForTimeout(150);
  check(!(await cls(p, '.opt[data-opt="0"]')).includes('is-out') && await p.getAttribute('.opt[data-opt="0"]', 'aria-pressed') === 'true', 'picking it brings it back, picked');
  await p.click('.opt[data-opt="0"]', { button: 'right' }); await p.waitForTimeout(150);
  check((await cls(p, '.opt[data-opt="0"]')).includes('is-out') && await p.getAttribute('.opt[data-opt="0"]', 'aria-pressed') === 'false', 'crossing out a picked option unpicks it');
  await p.keyboard.press('Shift+KeyB'); await p.waitForTimeout(150);
  check((await cls(p, '.opt[data-opt="1"]')).includes('is-out'), 'Shift + B crosses B out');
  let S = await state(p);
  const q1 = S.session.qids[0];
  check(JSON.stringify(S.cross[q1]) === '[0,1]' && !(S.answers[q1] && S.answers[q1].sel.length), 'kept for this question: A and B crossed out, nothing picked');
  await p.screenshot({ path: OUT + 'tools_cross.png' });

  // marks
  await p.click('[data-act="mark"]'); await p.waitForTimeout(150);
  check(await p.getAttribute('[data-act="mark"]', 'aria-pressed') === 'true' && await txt(p, '[data-act="mark"]') === 'Marked' && (await cls(p, '.strip .cell.cur')).includes('mk'), 'Mark: pressed, "Marked", a ribbon on the strip');
  await p.keyboard.press('m'); await p.waitForTimeout(120);
  check(await p.getAttribute('[data-act="mark"]', 'aria-pressed') === 'false', 'M unmarks it');
  await p.keyboard.press('m'); await p.waitForTimeout(120);
  S = await state(p);
  check(!!S.marks[q1], 'and marks it again (kept in S.marks)');
  // check it: crossed-out options stay struck through on the answer
  const q = bank.questions.find(x => x.id === q1);
  for (const i of q.answer) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(300);
  const outs = await p.$$eval('.opts .opt.is-out', os => os.map(o => +o.dataset.opt));
  check(!!(await p.$('#verdict')) && outs.join() === [0, 1].filter(i => !q.answer.includes(i)).join(), 'after checking, the crossed-out ones still show: ' + outs.join());
  await p.screenshot({ path: OUT + 'tools_checked.png' });

  // the homepage: marked questions on the Tonight card; practising them starts afresh
  await p.click('.bar .back'); await p.waitForTimeout(250);
  await p.click('.bar .back'); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('.tn-marked').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  check(/1 marked question, to see again/.test(await txt(p, '.tn-marked')), 'Tonight: ' + await txt(p, '.tn-marked'));
  await (await p.$('.tn')).screenshot({ path: OUT + 'tools_tonight.png' });
  await p.click('.tn-marked [data-act="practice-marked"]'); await p.waitForTimeout(300);
  S = await state(p);
  check(S.view === 'quiz' && S.session.qids.join() === q1 && /Marked questions/.test(await txt(p, '.bar-title')) && !(await p.$('#verdict')) && !S.answers[q1] && S.first[q1] === true,
    'Practise them: the marked question afresh, its first try kept');
  // the module page
  await p.click('.bar .back'); await p.waitForTimeout(250);
  await p.click(`[data-topic="${MOD}"]`); await p.waitForTimeout(250);
  check(/Marked 1/.test(await txt(p, '.page-head [data-act="practice-marked"]')), 'the module page: Marked 1');

  // ---- an exam: cross out, mark, and "Hand in" counts the marks ----
  await p.click('.bar .back'); await p.waitForTimeout(250);
  await p.evaluate(() => document.getElementById('quest').scrollIntoView()); await p.click('.quest [data-act="exam"]'); await p.waitForTimeout(200);
  await p.click('[data-act="exam-start"]'); await p.waitForTimeout(250);
  await p.click('.opt[data-opt="0"]', { button: 'right' }); await p.waitForTimeout(120);
  await p.click('[data-act="mark"]'); await p.waitForTimeout(120);
  S = await state(p);
  const e1 = S.exam.qids[0];
  check((await cls(p, '.opt[data-opt="0"]')).includes('is-out') && JSON.stringify(S.exam.cross[e1]) === '[0]' && !S.exam.picks[e1], 'exam: A crossed out, not picked');
  check((await cls(p, '.strip .cell.cur')).includes('mk') && !!S.marks[e1], 'exam: marked, on the strip too');
  await p.click('[data-act="exam-handin"]'); await p.waitForTimeout(150);
  check(/You marked one question to come back to/.test(await txt(p, '#exc-d')), 'Hand in: ' + await txt(p, '#exc-d'));
  await p.screenshot({ path: OUT + 'tools_exam.png' });
  await ctx.close();

  // ---- a phone: a long press crosses out, and the tap that ends it doesn't pick ----
  const ph = await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const m = await ph.newPage(); watch(m, 'phone');
  await m.goto(URL, { waitUntil: 'load' }); await m.evaluate(() => localStorage.clear()); await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(300);
  await m.tap(`[data-topic="${MOD}"]`); await m.waitForTimeout(200);
  await m.tap(`[data-start="${MOD}"]`); await m.waitForTimeout(250);
  check(/long-press one to cross it out/.test(await txt(m, '.hint')), 'phone hint: ' + await txt(m, '.hint'));
  const box = await (await m.$('.opt[data-opt="2"]')).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await m.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); }, [x, y]);
  await m.waitForTimeout(650);
  await m.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); el.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); el.click(); }, [x, y]);
  await m.waitForTimeout(150);
  check((await cls(m, '.opt[data-opt="2"]')).includes('is-out') && await m.getAttribute('.opt[data-opt="2"]', 'aria-pressed') === 'false', 'a long press crosses C out; the tap after it doesn’t pick it');
  await m.waitForTimeout(800);
  await m.tap('.opt[data-opt="3"]'); await m.waitForTimeout(150);
  check(await m.getAttribute('.opt[data-opt="3"]', 'aria-pressed') === 'true' && !(await cls(m, '.opt[data-opt="3"]')).includes('is-out'), 'a normal tap still picks');
  const w = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(w === 0, 'phone: no sideways scroll with the Mark button');
  await m.screenshot({ path: OUT + 'tools_phone.png' });
  await ph.close();

  // ---- the class: what was ticked, on the lead's options ----
  const lead = new Map(); (bank.cst || []).forEach(ids => ids.forEach(id => lead.set(id, ids[0])));
  const canon = q => { const k = q.dupOf || q.id; return lead.get(k) || k; };
  const cq = bank.questions.find(x => Array.isArray(x.om) && x.answer.length && x.options.length >= 4);
  const c = canon(cq), cMod = cq.topic;
  // the class so far: 20 first tries with their picks, on the lead's options
  const o = { 0: 10, 1: 4, 2: 2, 3: 16 };
  const seed = { 'users/u5': { s: '{}', name: 'Amro', key: 'amro' }, 'names/amro': { uid: 'u5', name: 'Amro' }, ['stats/' + cMod]: { [c]: { n: 20, r: 9, p: 20, o } } };
  const local = { view: 'quiz', session: { topic: '*', type: 'all', set: null, mode: 'all', shuffle: false, qids: [cq.id], order: [cq.id], idx: 0 } };
  const ac = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ac.addInitScript(([seed, local, K]) => {
    if (location.protocol === 'about:') return;
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('fake-user', JSON.stringify({ uid: 'u5', displayName: 'Amro', email: 'amro@example.com' }));
      localStorage.setItem('fake-docs', JSON.stringify(seed)); localStorage.setItem(K, JSON.stringify(local));
      localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', 'Amro');
    }
    window.__acctTest = true;
    window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
  }, [seed, local, KEY]);
  await ac.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[req.url().match(/firebase-(\w+)\.js$/)[1]] });
  });
  const a = await ac.newPage(); watch(a, 'class');
  await a.goto(URL, { waitUntil: 'load' }); await a.waitForTimeout(1200);
  // tick the option that is the lead's D (index 3), and check
  const mine = cq.om.indexOf(3);
  await a.click(`.opt[data-opt="${mine}"]`); await a.click('[data-act="primary"]'); await a.waitForTimeout(400);
  const shown = await a.$$eval('.opts .opt', os => os.map(o => (o.querySelector('.opct') || {}).textContent || ''));
  const want = cq.options.map((_, i) => Math.round(100 * (o[cq.om[i]] || 0) / 20) + '% of the class ticked it');
  check(shown.join('|') === want.join('|'), `each option shows what the class ticked, mapped from the lead's order (${shown.map(s => s.split('%')[0] + '%').join(' ')})`);
  check(/how many in the class ticked it on their first try \(20 first tries\)/.test(await txt(a, '.v-picks')), 'the verdict says what the figures are');
  await a.screenshot({ path: OUT + 'tools_class.png' });
  // the page hides: the account and the class counts go up
  await a.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await a.waitForTimeout(800);
  const st = await a.evaluate(([m, c]) => window.__fb.docs['stats/' + m][c], [cMod, c]);
  check(st.n === 21 && st.p === 21 && st.o[3] === 17 && st.o[0] === 10, `my first try counted on the lead's D: ${JSON.stringify(st)}`);
  const S2 = await state(a);
  check(!S2.firstSel[cq.id], 'and the pick is no longer waiting on this device');
  await ac.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
