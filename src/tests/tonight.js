// Tonight: sure / not sure before checking (a second tap clears it; the verdict says how it went; first tries feed the
// instinct line on the weak spots page); comets (a miss comes back the next day, then after 3, 7 and 14 days when
// caught, gone after the fourth catch, back to tomorrow when missed again; a catch is a clean try; exams make comets;
// a lecture's diagnostic offers its own; old misses are queued once, 20 a night); the moon (a night counts at 5
// different questions, a night off only pauses it, full at 14); the Tonight card on the home page; phone layout.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
const DAY = 864e5, H = 3600e3;
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const state = p => p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
const view = p => p.evaluate(() => document.body.dataset.view);

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); watch(p, 'desk');
  await p.clock.install({ time: new Date(2026, 9, 6, 21, 0) });   // Tuesday 9 pm
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const bank = await p.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
  const Q = new Map(bank.questions.map(q => [q.id, q]));
  const lead = new Map(); (bank.cst || []).forEach(ids => ids.forEach(id => lead.set(id, ids[0])));
  const canon = id => { const k = Q.get(id).dupOf || id; return lead.get(k) || k; };
  const cur = async () => { const S = await state(p); return Q.get(S.session.qids[S.session.idx]); };
  const wrongOf = q => [...q.options.keys()].find(i => !q.answer.includes(i));
  // answer the question on screen: right, wrong, or leave it; then Next unless told not to
  const answer = async (how, sure, next = true) => {
    const q = await cur();
    if (sure !== undefined) await p.click(`.sure-b[data-sure="${sure ? 1 : 0}"]`);
    const sel = how === 'right' ? q.answer : [wrongOf(q)];
    for (const i of sel) await p.click(`.opt[data-opt="${i}"]`);
    await p.click('[data-act="primary"]'); await p.waitForTimeout(60);
    const out = { q, verdict: await txt(p, '#verdict'), moon: (await p.$('.moonl')) ? await txt(p, '.moonl') : '' };
    if (next) { await p.click('[data-act="primary"]'); await p.waitForTimeout(60); }
    return out;
  };

  // the Tonight card, before anything
  check((await txt(p, '#tn-h')) === 'A new moon' && (await txt(p, '.tn-comets')).startsWith('No comets yet') && !!(await p.$('.tn-how')), 'home: a new moon, no comets yet, how it works');
  await (await p.$('.tn')).screenshot({ path: OUT + 'tn_home_new.png' });

  // sure / not sure
  await p.click('[data-topic="respiratory-system-diseases"]'); await p.waitForTimeout(200);
  await p.click('[data-start="respiratory-system-diseases"]'); await p.waitForTimeout(200);
  check(!!(await p.$('.sure')) && (await p.$$('.sure-b[aria-pressed="false"]')).length === 2, 'the quiz: How sure? Sure / Not sure, none picked');
  await p.click('.sure-b[data-sure="1"]'); await p.click('.sure-b[data-sure="1"]');
  check((await p.$$('.sure-b[aria-pressed="true"]')).length === 0, 'a second tap clears it');
  await p.screenshot({ path: OUT + 'tn_quiz_sure.png' });
  const r1 = await answer('wrong', true, false);
  check(/You were sure, and wrong\. Back tomorrow as a comet\./.test(r1.verdict) && !(await p.$('.sure')), 'wrong and sure: ' + r1.verdict.replace(/.*Try again/, ''));
  await p.screenshot({ path: OUT + 'tn_quiz_verdict.png' });
  let S = await state(p);
  const c1 = S.comets[canon(r1.q.id)];
  check(!!c1 && c1.l === 0 && new Date(c1.d).getDate() === 7 && new Date(c1.d).getHours() === 17, 'its comet: back tomorrow at 5 pm');
  check(JSON.stringify(S.sure[r1.q.id]) === JSON.stringify([1, 0, S.sure[r1.q.id][2]]), 'sure and wrong recorded');
  // a retry right after seeing the answer doesn't feed the instinct and doesn't catch anything
  await p.click('[data-act="again"]'); await p.waitForTimeout(50);
  await answer('right', false, false);
  S = await state(p);
  check(S.sure[r1.q.id][0] === 1 && S.comets[canon(r1.q.id)].l === 0, 'a retry changes neither the instinct nor the comet');
  await p.click('[data-act="primary"]'); await p.waitForTimeout(60);

  // the moon: the fifth different question tonight counts the night
  const r2 = await answer('right', false);
  const r3 = await answer('right', true);
  const r4 = await answer('wrong', false);
  check(/You weren’t sure, and it was wrong\./.test(r4.verdict), 'not sure and wrong: said so');
  const r5 = await answer('right', true, false);
  check(r5.moon === 'Tonight counts: the moon grows to night 1 of 14.' && /You were sure, and right\./.test(r5.verdict), 'the fifth question: ' + r5.moon);
  await p.screenshot({ path: OUT + 'tn_quiz_moon.png' });
  await p.click('[data-act="primary"]'); await p.waitForTimeout(60);
  const r6 = await answer('right', true, false);
  check(r6.moon === '', 'the night counts once');
  S = await state(p);
  check(S.moon.n === 1 && S.moon.last === '2026-10-06', 'the moon: night 1');

  // the home card now
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(150);
  await p.click('.bar [data-act="home"]'); await p.waitForTimeout(250);
  check((await txt(p, '#tn-h')) === 'Night 1 of 14' && (await txt(p, '.tn-mt .tn-sub')).startsWith('Tonight counts.'), 'home: night 1, tonight counts');
  check((await txt(p, '.tn-big')) === 'No comets tonight' && (await txt(p, '.tn-comets .tn-sub')) === 'Next: 2 tomorrow.', 'two misses: ' + await txt(p, '.tn-comets .tn-sub'));

  // instinct: shows after five marked answers
  S = await state(p);
  const marked = Object.keys(S.sure).length;
  await p.click('.navlinks [data-act="weak"]'); await p.waitForTimeout(200);
  check(marked < 5 ? (await txt(p, 'p.ins')).startsWith('Your instinct Tap Sure or Not sure') : true, `instinct: a hint before five (${marked} marked)`);
  await p.evaluate(K => { const S = JSON.parse(localStorage.getItem(K)); const ids = Object.keys(JSON.parse(document.getElementById('bank').textContent).questions.reduce((o, q) => (o[q.id] = 1, o), {})).slice(500, 512);
    ids.forEach((id, i) => { S.sure[id] = [i < 8 ? 1 : 0, i < 5 ? 1 : 0, 1]; }); localStorage.setItem(K, JSON.stringify(S)); }, KEY);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  S = await state(p);
  const su = Object.values(S.sure).filter(x => x[0] === 1), un = Object.values(S.sure).filter(x => x[0] === 0);
  const pct = a => Math.round(100 * a.filter(x => x[1]).length / a.length);
  const ins = await txt(p, '.ins');
  check(ins.startsWith(`Your instinct when you’re sure, you’re right ${pct(su)}% of the time (${su.length}) · when you’re not, ${pct(un)}% (${un.length}).`), 'instinct: ' + ins);
  check(pct(su) < 70 ? ins.includes('tick only the propositions you’d bet on') : true, 'with a tip when "sure" isn’t solid');
  await p.screenshot({ path: OUT + 'tn_weak_instinct.png' });

  // the next day: the comets are due
  await p.clock.fastForward(DAY - 2 * H);   // Wednesday 7 pm
  await p.click('.bar [data-act="home"]'); await p.waitForTimeout(250);
  check((await txt(p, '.tn-big')) === '2 comets tonight' && (await txt(p, '.tn-mt .tn-sub')).startsWith('5 more questions and tonight counts.'), 'Wednesday: 2 comets tonight, the moon waits for 5 questions');
  await (await p.$('.tn')).screenshot({ path: OUT + 'tn_home_due.png' });
  await p.click('[data-act="comets"]'); await p.waitForTimeout(200);
  S = await state(p);
  check(await view(p) === 'quiz' && S.session.comets && S.session.qids.length === 2 && (await txt(p, '.bar-title')) === 'Comets', 'Catch them: the 2 comets');
  const firstComet = S.session.qids[0], cleanBefore = S.clean[firstComet] ? S.clean[firstComet].t : 0;
  const k1 = await answer('right', undefined, false);
  check(/Comet caught: back on Saturday\./.test(k1.verdict), 'caught: ' + k1.verdict.replace(/.*Try again/, ''));
  S = await state(p);
  check(S.comets[firstComet].l === 1 && (!cleanBefore || S.clean[firstComet].t > cleanBefore), 'a catch moves it to 3 days and counts as a clean try');
  await p.click('[data-act="primary"]'); await p.waitForTimeout(60);
  const k2 = await answer('wrong', undefined, false);
  check(/Back tomorrow as a comet\./.test(k2.verdict), 'missed again: back tomorrow');
  await p.click('[data-act="primary"]'); await p.waitForTimeout(150);
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(200);
  check(await view(p) === 'home', 'Back: home');

  // caught three more times, it's gone
  for (const [days, when] of [[3, 'back on Wednesday'], [7, 'back on Wednesday'], [14, 'for good']]) {
    await p.evaluate(([K, id]) => { const S = JSON.parse(localStorage.getItem(K)); S.comets[id].d = Date.now() - 1; localStorage.setItem(K, JSON.stringify(S)); }, [KEY, firstComet]);
    await p.clock.fastForward(days * DAY); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200);
    await p.click('[data-act="comets"]'); await p.waitForTimeout(150);
    S = await state(p);
    const i = S.session.qids.indexOf(firstComet);
    if (i > 0) { await p.click(`.strip [data-jump="${i}"]`); await p.waitForTimeout(80); }
    const r = await answer('right', undefined, false);
    check(new RegExp(when === 'for good' ? 'Comet caught for good\\.' : 'Comet caught: ').test(r.verdict), `after ${days} days: ${r.verdict.replace(/.*Try again/, '')}`);
    await p.click('.bar [data-act="back"]'); await p.waitForTimeout(150);
  }
  S = await state(p);
  check(!S.comets[firstComet], 'gone after the fourth catch');

  // the moon pauses on a night off and fills at 14
  S = await state(p);
  const n0 = S.moon.n;
  await p.evaluate(K => { const S = JSON.parse(localStorage.getItem(K)); S.moon.n = 13; S.moon.last = '2026-01-01'; localStorage.setItem(K, JSON.stringify(S)); }, KEY);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200);
  check((await txt(p, '#tn-h')) === 'Night 13 of 14', `nights off didn't reset it (was ${n0})`);
  await p.click('[data-topic="cardio-vascular-system-disease"]'); await p.waitForTimeout(150);
  await p.click('[data-start="cardio-vascular-system-disease"]'); await p.waitForTimeout(150);
  let full = '';
  for (let k = 0; k < 5; k++) { const r = await answer('right', undefined, k < 4); full = r.moon || full; }
  check(full === 'Full moon: 14 study nights.', 'night 14: ' + full);
  await p.screenshot({ path: OUT + 'tn_quiz_full.png' });
  S = await state(p);
  check(S.moon.full === 1 && S.moon.n === 14, 'one full moon');

  // an exam makes comets for its misses, and a lecture's diagnostic offers its own
  await p.evaluate(K => { const S = JSON.parse(localStorage.getItem(K)); S.comets = {}; localStorage.setItem(K, JSON.stringify(S)); }, KEY);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200);
  const T = bank.diag.find(d => d.n === 'Acute bronchitis');
  await p.evaluate(([K, id]) => { const S = JSON.parse(localStorage.getItem(K)); S.view = 'diag'; S.diag = id; localStorage.setItem(K, JSON.stringify(S)); }, [KEY, T.id]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200);
  await p.click('[data-act="diag-exam"]'); await p.waitForTimeout(150);
  await p.click('[data-act="exam-start"]'); await p.waitForTimeout(150);
  S = await state(p);
  const eq = S.exam.qids;
  for (let k = 0; k < eq.length; k++) {
    const q = Q.get(eq[k]);
    for (const i of (k < 2 ? [wrongOf(q)] : q.answer)) await p.click(`.opt[data-opt="${i}"]`);
    if (k < eq.length - 1) { await p.click('[data-act="exam-next"]'); await p.waitForTimeout(40); }
  }
  await p.click('.bar [data-act="exam-handin"]'); await p.click('[data-act="exam-handin-yes"]'); await p.waitForTimeout(250);
  S = await state(p);
  check(eq.slice(0, 2).every(id => S.comets[canon(id)] && S.comets[canon(id)].l === 0) && Object.keys(S.comets).length === 2, 'the exam\'s 2 misses are comets');
  await p.click('.d-actions [data-act="exam-back"]'); await p.waitForTimeout(200);
  check(!(await p.$('[data-act="drill"]')) && !(await p.$('[data-act="diag-comets"]')) && /come back as comets/.test(await txt(p, '.dg-note')), 'the diagnostic: no drill, comets explained, none due yet');
  await p.clock.fastForward(DAY); await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200);
  check((await txt(p, '[data-act="diag-comets"]')) === 'Catch its 2 comets', 'a day later: Catch its 2 comets');
  await p.click('[data-act="diag-comets"]'); await p.waitForTimeout(150);
  S = await state(p);
  check(S.session.comets && S.session.from === 'diag' && S.session.qids.length === 2, 'its comets only');
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(150);
  check(await view(p) === 'diag', 'Back: the diagnostic');
  await ctx.close();

  // old misses are queued once, 20 a night, the latest first
  const c2 = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p2 = await c2.newPage(); watch(p2, 'backfill');
  await p2.goto(URL, { waitUntil: 'load' });
  const ids = bank.questions.filter(q => q.answer.length && !q.dupOf && !lead.has(q.id)).slice(0, 45).map(q => q.id);
  await p2.evaluate(([K, ids]) => { localStorage.setItem(K, JSON.stringify({ clean: Object.fromEntries(ids.map((id, i) => [id, { s: null, ok: false, t: 1000 + i, x: 0 }])) })); }, [KEY, ids]);
  await p2.reload({ waitUntil: 'load' }); await p2.waitForTimeout(250);
  check((await txt(p2, '.tn-big')) === '20 comets tonight', 'old misses: ' + await txt(p2, '.tn-big'));
  await p2.click('[data-act="comets"]'); await p2.waitForTimeout(150);
  const S2 = await state(p2);
  check(S2.cometsInit === 1 && Object.keys(S2.comets).length === 45 && S2.session.qids[0] === ids[44], '45 queued, the latest miss first, 20 tonight');
  await c2.close();

  // phone
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const m = await mctx.newPage(); watch(m, 'phone');
  await m.goto(URL, { waitUntil: 'load' });
  await m.evaluate(K => localStorage.setItem(K, JSON.stringify({ moon: { n: 9, full: 1, last: '', day: '', ids: [] }, cometsInit: 1, comets: { x: 1 } })), KEY);
  await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(300);
  await m.evaluate(() => document.querySelector('.tn').scrollIntoView()); await m.waitForTimeout(100);
  await m.screenshot({ path: OUT + 'tn_m_home.png' });
  const o = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await m.tap(`[data-topic="respiratory-system-diseases"]`); await m.waitForTimeout(200);
  await m.tap(`[data-start="respiratory-system-diseases"]`); await m.waitForTimeout(200);
  await m.tap('.sure-b[data-sure="0"]');
  await m.screenshot({ path: OUT + 'tn_m_quiz.png' });
  const o2 = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(o === 0 && o2 === 0, 'phone: nothing sideways');
  await mctx.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
