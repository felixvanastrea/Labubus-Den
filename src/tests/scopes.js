// Exam mode beyond the quest: an exam button on every past exam set (in its own order, all its questions, Back to the
// module, the best mark on the button), a mock exam per module (20, 25 or 50 questions drawn from every past question,
// one per repeated question, by-topic results), a running exam taking precedence, marks kept per scope, phone layout.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
const MOD = 'cardio-vascular-system-disease';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const state = p => p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); watch(p, 'desk');
  await p.clock.install({ time: new Date(2026, 9, 5, 21, 0) });
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const bank = await p.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
  const Q = new Map(bank.questions.map(q => [q.id, q]));
  const lead = new Map(); (bank.cst || []).forEach(ids => ids.forEach(id => lead.set(id, ids[0])));
  const canon = id => { const k = Q.get(id).dupOf || id; return lead.get(k) || k; };
  const sets = bank.sources.filter(s => s.topic === MOD);

  // the module page: an exam button on every set, exam mode and weak spots for the module
  await p.click(`.arch[data-topic="${MOD}"]`); await p.waitForTimeout(250);
  check((await p.$$('.set-exam')).length === sets.length, `an exam button on each of the ${sets.length} sets`);
  check(!!(await p.$('[data-act="exam-module"]')) && !!(await p.$('[data-act="weak-module"]')), 'Exam mode and Weak spots for the module');

  // a past exam set: all its questions, in the order they were set
  const set = sets.find(s => s.type === 'Midterms');
  const setQs = bank.questions.filter(q => q.source === set.id).map(q => q.id);
  await p.click(`[data-exam-set="${set.id}"]`); await p.waitForTimeout(200);
  const eb = await txt(p, '.page-head .eyebrow');
  check(eb.includes(set.label) && eb.includes(`${setQs.length} questions · ${setQs.length} minutes`), 'set exam rules: ' + eb);
  check((await txt(p, '.ex-rules li')).includes('in the order they were set') && !(await p.$('[data-exam-n]')), 'in its own order, no size to pick');
  check((await txt(p, '.bar .back')) === 'Cardio-Vascular', 'Back says where it goes: ' + await txt(p, '.bar .back'));
  await p.click('[data-act="exam-start"]'); await p.waitForTimeout(200);
  let S = await state(p);
  check(S.exam.qids.join() === setQs.join() && S.exam.scope.kind === 'set' && S.exam.scope.id === set.id, 'the exam is the set, as set');
  check((await txt(p, '.bar-title')).startsWith('Exam · Cardio-Vascular · ' + set.label), 'bar: ' + await txt(p, '.bar-title'));
  // answer the first three right, hand in
  for (let k = 0; k < 3; k++) {
    for (const i of Q.get(S.exam.qids[k]).answer) await p.click(`.opt[data-opt="${i}"]`);
    await p.click('[data-act="exam-next"]'); await p.waitForTimeout(60);
  }
  // another set's button while this one runs: the running exam comes back
  await p.click('.bar [data-act="exam-back"]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => document.body.dataset.view) === 'topic', 'Back from the running exam: the module page');
  const other = sets.find(s => s.id !== set.id);
  await p.click(`[data-exam-set="${other.id}"]`); await p.waitForTimeout(200);
  S = await state(p);
  check(S.exam.scope.id === set.id && !!(await p.$('.ex-clock')), 'another exam button while one runs: back to the running exam');
  await p.click('.bar [data-act="exam-handin"]'); await p.click('[data-act="exam-handin-yes"]'); await p.waitForTimeout(250);
  const n20 = Math.round(3 / setQs.length * 2000) / 100;
  check(await txt(p, '#ex-score') === n20.toLocaleString('en-US', { maximumFractionDigits: 2 }), `mark ${await txt(p, '#ex-score')}/20 (3 of ${setQs.length})`);
  check((await p.$$('.ex-topics .xrow')).length > 1, `results by the diagnostic's topics: ${(await p.$$('.ex-topics .xrow')).length} rows`);
  await p.screenshot({ path: OUT + 'sc_set_results.png', fullPage: true });
  await p.click('.d-actions [data-act="exam-back"]'); await p.waitForTimeout(250);
  check(await p.evaluate(() => document.body.dataset.view) === 'topic', 'Back from the results: the module page');
  check((await txt(p, `[data-exam-set="${set.id}"]`)) === `${n20.toLocaleString('en-US', { maximumFractionDigits: 2 })}/20` && (await txt(p, `[data-exam-set="${other.id}"]`)) === 'Exam', 'the set\'s button shows its best mark, the others still say Exam');
  await p.screenshot({ path: OUT + 'sc_module.png' });

  // a mock exam on the whole module: 20, 25 or 50, one per repeated question, by topic
  await p.click('[data-act="exam-module"]'); await p.waitForTimeout(200);
  const sizes = await p.$$eval('[data-exam-n]', bs => bs.map(x => [x.dataset.examN, x.getAttribute('aria-pressed')]));
  check(JSON.stringify(sizes) === '[["20","true"],["25","false"],["50","false"]]', 'sizes 20, 25, 50; 20 first: ' + JSON.stringify(sizes));
  await p.click('[data-exam-n="50"]'); await p.waitForTimeout(150);
  check((await txt(p, '.page-head .eyebrow')).includes('50 questions · 50 minutes') && await p.getAttribute('[data-exam-n="50"]', 'aria-pressed') === 'true', 'picking 50');
  await p.screenshot({ path: OUT + 'sc_mock_intro.png', fullPage: true });
  await p.click('[data-act="exam-start"]'); await p.waitForTimeout(200);
  S = await state(p);
  const ids = S.exam.qids;
  check(ids.length === 50 && ids.every(id => Q.get(id).topic === MOD) && new Set(ids.map(canon)).size === 50 && ids.every(id => canon(id) === id), '50 questions from the module, one per repeated question');
  check(S.exam.scope.kind === 'module' && (await txt(p, '.bar-title')) === 'Exam · Cardio-Vascular · mock exam', 'bar: ' + await txt(p, '.bar-title'));
  await p.click('.bar [data-act="exam-handin"]'); await p.click('[data-act="exam-handin-yes"]'); await p.waitForTimeout(250);
  const rows = await p.$$eval('.ex-topics .xr-meta', r => r.map(x => parseInt(x.textContent.split(' of ')[1], 10)));
  check(rows.length > 2 && rows.reduce((a, x) => a + x, 0) === 50, `by topic: ${rows.length} topics adding up to 50`);
  S = await state(p);
  check(S.examLog.length === 2 && S.examLog[0].scope === 'module:' + MOD && S.examLog[1].scope === 'set:' + set.id, 'marks kept per scope');
  await p.click('[data-act="exam-new"]'); await p.waitForTimeout(200);
  check((await txt(p, '.page-head .eyebrow')).includes('mock exam · 50 questions') && (await p.$$('.ex-past .xl-row')).length === 1, 'New exam: the same mock, its own past marks');
  await ctx.close();

  // phone
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage();
  watch(m, 'phone');
  await m.goto(URL, { waitUntil: 'load' }); await m.evaluate(() => localStorage.clear());
  await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(300);
  await m.evaluate(m => document.querySelector(`.arch[data-topic="${m}"]`).scrollIntoView(), MOD);
  await m.tap(`.arch[data-topic="${MOD}"]`); await m.waitForTimeout(250);
  await m.evaluate(() => document.querySelector('.group').scrollIntoView()); await m.waitForTimeout(100);
  await m.screenshot({ path: OUT + 'sc_m_module.png' });
  let o = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await m.tap('[data-act="exam-module"]'); await m.waitForTimeout(250);
  await m.screenshot({ path: OUT + 'sc_m_mock_intro.png', fullPage: true });
  o = Math.max(o, await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  check(o === 0, 'phone: no sideways scroll');
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
