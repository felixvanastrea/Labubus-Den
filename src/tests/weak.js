// Weak spots: every question in exactly one lecture (in course order); the stars fill with clean tries only (a first try, an exam, a drill
// a day later; never a retry), the diagnostic unlocks at 8 tries (all of a smaller lecture) with a star line under the
// verdict; the diagnostic's mark by the exam's rule, what wrong ticks cost, every proposition got wrong with its why;
// drill, untried and lecture-exam actions; answers from before the update count; Reset all clears it; phone layout.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
const DAY = 864e5;
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const state = p => p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
// Abi's rule as a table (points by right answers ticked, for n right answers; any wrong tick scores 0)
const SPEC = { 1: [0, 1], 2: [0, .5, 1], 3: [0, 0, .5, 1], 4: [0, 0, .5, .5, 1], 5: [0, 0, 0, .5, .5, 1] };
const pts = (q, sel) => (!sel.length || sel.some(i => !q.answer.includes(i))) ? 0 : SPEC[q.answer.length][sel.length];
const fmt = v => v.toLocaleString('en-US', { maximumFractionDigits: 2 });

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

  // the lectures: every question in exactly one; respiratory in course order, tuberculosis as its four lectures
  const seen = new Map(); bank.diag.forEach(d => d.q.forEach(id => seen.set(id, (seen.get(id) || 0) + 1)));
  check(bank.questions.every(q => seen.get(q.id) === 1) && new Set(bank.diag.map(d => d.id)).size === bank.diag.length, `${bank.diag.length} lectures, every question in exactly one`);
  const resp = bank.diag.filter(d => d.m === 'respiratory-system-diseases').map(d => d.n);
  check(resp.slice(0, 6).join() === 'Acute bronchitis,Community-acquired pneumonia,Lung abscess,Viral pneumonia,Nosocomial pneumonia,Bronchiectasis'
    && ['Tuberculosis infection', 'Tuberculosis disease', 'Acute forms of tuberculosis', 'Treatment of tuberculosis'].every(n => resp.includes(n)), 'respiratory: ' + resp.slice(0, 6).join(', ') + '…');

  // the home card and the page, before anything is tried
  check((await txt(p, '.wsc-stat')) === 'No lecture diagnosed yet.' && (await p.$$('.wsc-row')).length === 3, 'home card: nothing yet, three lectures to start');
  await p.click('.navlinks [data-act="weak"]'); await p.waitForTimeout(250);
  check(await p.getAttribute('[data-weakmod="respiratory-system-diseases"]', 'aria-selected') === 'true' && (await p.$$('.dg-fresh .dg-row')).length === resp.length, 'opens on the quest\'s module, every lecture not started');

  // Bronchiectasis: its questions not tried yet, a star each
  const T = bank.diag.find(d => d.n === 'Bronchiectasis');
  const groups = new Map(); T.q.forEach(id => { const c = canon(id); if (!groups.has(c)) groups.set(c, []); groups.get(c).push(id); });
  const need = Math.min(8, groups.size);
  await p.click(`[data-diag-go="${T.id}"]`); await p.waitForTimeout(200);
  let S = await state(p);
  check(S.session.qids.length === groups.size && (await txt(p, '.bar-title')) === 'Bronchiectasis · toward its diagnostic', `practise its ${groups.size} questions`);
  // a plan per question: right, a wrong tick added to right ones, half, only a wrong one...
  const plan = [];
  for (let k = 0; k < need; k++) {
    const id = S.session.qids[k], q = Q.get(id), wrong = [...q.options.keys()].find(i => !q.answer.includes(i));
    const kind = ['right', 'plus-wrong', 'half', 'wrong', 'right', 'plus-wrong', 'right', 'half'][k];
    let sel = kind === 'right' ? q.answer.slice() : kind === 'plus-wrong' ? [...q.answer, wrong] : kind === 'half' ? q.answer.slice(0, Math.max(1, Math.ceil(q.answer.length / 2))) : [wrong];
    sel = [...new Set(sel)].sort((a, c) => a - c);
    plan.push({ id, sel });
    for (const i of sel) await p.click(`.opt[data-opt="${i}"]`);
    await p.click('[data-act="primary"]'); await p.waitForTimeout(80);
    const line = await txt(p, '.xpl');
    if (k < need - 1) check(line.includes(`${k + 1} of ${need} toward its diagnostic`) && (await p.$$('.xpl .xp-s.on')).length === k + 1, `try ${k + 1}: ${line}`);
    else check(line.startsWith('Diagnostic unlocked: Bronchiectasis') && !!(await p.$('.xpl [data-diag]')), 'the last try unlocks it: ' + line);
    if (k === 2) await p.screenshot({ path: OUT + 'wk_quiz_xp.png' });
    if (k === need - 1) await p.screenshot({ path: OUT + 'wk_quiz_unlock.png' });
    // a retry right after seeing the answer doesn't count
    if (k === 0) {
      await p.click('[data-act="again"]'); await p.waitForTimeout(60);
      const q = Q.get(id), wrong = [...q.options.keys()].find(i => !q.answer.includes(i));
      await p.click(`.opt[data-opt="${wrong}"]`); await p.click('[data-act="primary"]'); await p.waitForTimeout(80);
      const c = (await state(p)).clean[id];
      check(JSON.stringify(c.s) === JSON.stringify(sel) && !(await p.$('.xpl')), 'a retry doesn\'t count and lights nothing');
    }
    if (k < need - 1) { await p.click('[data-act="primary"]'); await p.waitForTimeout(80); }
  }
  // the diagnostic: mark, habits, propositions
  await p.click('.xpl [data-diag]'); await p.waitForTimeout(250);
  const got = plan.map(x => pts(Q.get(x.id), x.sel)), mark = Math.round(got.reduce((a, v) => a + v, 0) / need * 2000) / 100;
  check(await txt(p, '.dg-hero .score b') === fmt(mark), `mark ${await txt(p, '.dg-hero .score b')}/20, expected ${fmt(mark)}`);
  const status = mark >= 15 ? 'Solid' : mark >= 10 ? 'Shaky' : 'Weak spot';
  check(await txt(p, '.dg-hero .dg-chip') === status, 'status: ' + status);
  const cost = plan.reduce((a, x) => { const q = Q.get(x.id); return a + (x.sel.some(i => !q.answer.includes(i)) ? pts(q, x.sel.filter(i => q.answer.includes(i))) : 0); }, 0);
  const cost20 = Math.round(cost / need * 2000) / 100;
  const habit = await txt(p, '.dg-habit');
  check(habit.startsWith(`Wrong ticks cost you ${fmt(cost20)} of the ${fmt(Math.round((20 - mark) * 100) / 100)} points`) && habit.includes(`you’d be at ${fmt(mark + cost20)}/20`), 'habits: ' + habit);
  let wantItems = 0; plan.forEach(x => { const q = Q.get(x.id); q.options.forEach((_, i) => { if (x.sel.includes(i) !== q.answer.includes(i)) wantItems++; }); });
  const kinds = await p.$$eval('.fx', fs => fs.map(f => f.classList.contains('tick') ? 't' : 'm').join(''));
  check(kinds.length === Math.min(10, wantItems) && /^t*m*$/.test(kinds), `what to fix: ${kinds.length} shown of ${wantItems}, wrong ticks first`);
  if (wantItems > 10) { await p.click('[data-act="diag-all"]'); await p.waitForTimeout(100); check((await p.$$('.fx')).length === wantItems, 'Show all'); }
  check((await p.$$('.fx .fx-why')).length > 0, 'with the lecture\'s why');
  await p.screenshot({ path: OUT + 'wk_diag.png', fullPage: true });

  // drill: the missed ones, answered again; it counts only a day after the last try
  const missed = plan.filter(x => pts(Q.get(x.id), x.sel) < 1).map(x => x.id);
  check((await txt(p, '[data-act="drill"]')) === `Drill the ${missed.length} you missed`, 'drill button: ' + await txt(p, '[data-act="drill"]'));
  await p.click('[data-act="drill"]'); await p.waitForTimeout(200);
  S = await state(p);
  const d0 = S.session.qids[0];
  check(S.session.qids.slice().sort().join() === missed.slice().sort().join() && S.session.drill && !S.answers[d0], 'the drill: the missed questions, cleared');
  const before = S.clean[d0];
  for (const i of Q.get(d0).answer) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(80);
  check(JSON.stringify((await state(p)).clean[d0]) === JSON.stringify(before), 'a drill the same day doesn\'t count');
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => document.body.dataset.view) === 'diag', 'Back from the drill: the diagnostic');
  await p.clock.fastForward(DAY + 3600e3);
  await p.click('[data-act="drill"]'); await p.waitForTimeout(200);
  const m1 = (await state(p)).session.qids[0];
  for (const i of Q.get(m1).answer) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(80);
  const after = (await state(p)).clean[m1];
  check(JSON.stringify(after.s) === JSON.stringify(Q.get(m1).answer.slice().sort((a, c) => a - c)) && after.t > before.t, 'a day later, the drill counts');
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(200);

  // an exam on the lecture: all its questions, its answers count, Back to the diagnostic
  await p.click('[data-act="diag-exam"]'); await p.waitForTimeout(200);
  check((await txt(p, '.ph-lead')).startsWith(`All ${groups.size} of its questions`) && (await txt(p, '.bar .back')) === 'Diagnostic', 'lecture exam rules: ' + await txt(p, '.ph-lead'));
  await p.click('[data-act="exam-start"]'); await p.waitForTimeout(150);
  S = await state(p);
  check(S.exam.qids.length === groups.size && S.exam.scope.kind === 'topic', 'the exam is the lecture');
  for (let k = 0; k < S.exam.qids.length; k++) {
    for (const i of Q.get(S.exam.qids[k]).answer) await p.click(`.opt[data-opt="${i}"]`);
    if (k < S.exam.qids.length - 1) { await p.click('[data-act="exam-next"]'); await p.waitForTimeout(50); }
  }
  await p.click('.bar [data-act="exam-handin"]'); await p.click('[data-act="exam-handin-yes"]'); await p.waitForTimeout(250);
  check(await txt(p, '#ex-score') === '20' && !(await p.$('.ex-topics')), 'all right: 20, no by-lecture for a single lecture');
  await p.click('.d-actions [data-act="exam-back"]'); await p.waitForTimeout(250);
  check(await p.evaluate(() => document.body.dataset.view) === 'diag' && await txt(p, '.dg-hero .score b') === '20' && await txt(p, '.dg-hero .dg-chip') === 'Solid', 'back on the diagnostic: the exam\'s answers are the latest, 20/20, solid');
  check((await txt(p, '.dg-habit')) === 'Every question right. Nothing lost here.' && !(await p.$('.fx')), 'nothing to fix');

  // the page and the home card now
  await p.click('.bar [data-act="weak"]'); await p.waitForTimeout(250);
  check((await p.$$('.dg-group:not(.dg-fresh) [data-diag]')).length === 1 && (await txt(p, '.dg-sum')).startsWith('1 of '), 'the page: one diagnosed');
  await p.screenshot({ path: OUT + 'wk_page.png', fullPage: true });
  await p.click('.bar [data-act="home"]'); await p.waitForTimeout(250);
  check((await txt(p, '.wsc-stat')).startsWith('1 lecture diagnosed · weakest: Bronchiectasis, 20/20'), 'home card: ' + await txt(p, '.wsc-stat'));

  // answers from before the diagnostic count: a first try kept with its picks, a retried one as right or wrong only
  const [a1, a2] = bank.diag.find(d => d.n === 'Tuberculosis infection').q;
  await p.evaluate(([K, a1, a2, sel]) => {
    const S = JSON.parse(localStorage.getItem(K)); delete S.clean;
    S.answers[a1] = { sel, checked: true, correct: false }; S.first[a2] = false;
    localStorage.setItem(K, JSON.stringify(S));
  }, [KEY, a1, a2, [0]]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  await p.click('.navlinks [data-act="weak"]'); await p.waitForTimeout(200);   // anything that saves
  await p.click('.bar [data-act="home"]'); await p.waitForTimeout(200);
  S = await state(p);
  check(JSON.stringify(S.clean[a1].s) === '[0]' && S.clean[a2].s === null && S.clean[a2].ok === false && Object.keys(S.clean).length > need, 'old answers: picks kept where known, right or wrong otherwise');

  // Reset all answers clears it
  await p.click('.allrow [data-act="reset"]'); await p.click('.allrow [data-act="reset-yes"]'); await p.waitForTimeout(200);
  S = await state(p);
  check(Object.keys(S.clean).length === 0 && (await txt(p, '.wsc-stat')) === 'No lecture diagnosed yet.', 'Reset all answers clears the diagnostic');
  await ctx.close();

  // phone
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const m = await mctx.newPage(); watch(m, 'phone');
  await m.goto(URL, { waitUntil: 'load' }); await m.evaluate(() => localStorage.clear());
  await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(300);
  await m.evaluate(() => document.querySelector('.wsc').scrollIntoView()); await m.waitForTimeout(100);
  await m.screenshot({ path: OUT + 'wk_m_card.png' });
  let o = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await m.tap('.wsc [data-act="weak"]'); await m.waitForTimeout(250);
  await m.screenshot({ path: OUT + 'wk_m_page.png' });
  o = Math.max(o, await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  // unlock acute bronchitis (5 questions) and open its diagnostic
  await m.tap('[data-diag-go="R-bronchitis"]'); await m.waitForTimeout(200);
  for (let k = 0; k < 5; k++) {
    const sel = await m.evaluate(K => { const S = JSON.parse(localStorage.getItem(K)); const id = S.session.qids[S.session.idx]; const q = JSON.parse(document.getElementById('bank').textContent).questions.find(x => x.id === id); return [[...q.options.keys()].find(i => !q.answer.includes(i))]; }, KEY);
    await m.tap(`.opt[data-opt="${sel[0]}"]`); await m.tap('[data-act="primary"]'); await m.waitForTimeout(100);
    if (k < 4) { await m.tap('[data-act="primary"]'); await m.waitForTimeout(100); }
  }
  await m.screenshot({ path: OUT + 'wk_m_unlock.png' });
  await m.tap('.xpl [data-diag]'); await m.waitForTimeout(250);
  await m.screenshot({ path: OUT + 'wk_m_diag.png', fullPage: true });
  o = Math.max(o, await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  check(o === 0, 'phone: no sideways scroll');
  await mctx.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
