// Lectures: every question sits in exactly one lecture of its module (lectures.json), in course order; a module page
// lists its questions by exam set (default) or by lecture, kept across reloads; a lecture row practises its questions
// once each like the quest (the midterm's lectures match the quest's topics; a constellation lead offers its stars;
// the exam-type filter applies) and Back returns to the list; a lecture that gathers several shows them;
// the button on the right opens its diagnostic, whose Back returns to the module; exam results group by lecture.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
const MOD = 'respiratory-system-diseases';
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
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const bank = await p.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
  const Q = new Map(bank.questions.map(q => [q.id, q]));
  const src = new Map(bank.sources.map(s => [s.id, s]));
  const lead = new Map(); (bank.cst || []).forEach(ids => ids.forEach(id => lead.set(id, ids[0])));
  const canon = id => { const k = Q.get(id).dupOf || id; return lead.get(k) || k; };
  const typeOf = id => src.get(Q.get(id).source).type;
  // what a lecture practises: each question once (its lead), or with an exam type, that type's copies once each
  const once = (d, type) => { const seen = new Set(), out = []; for (const id of d.q) { const k = canon(id); if (seen.has(k) || (type && typeOf(id) !== type)) continue; seen.add(k); out.push(!type || typeOf(k) === type ? k : id); } return out; };

  // the data: one lecture per question, in its own module
  const seen = new Map(); bank.diag.forEach(d => d.q.forEach(id => seen.set(id, (seen.get(id) || 0) + 1)));
  check(bank.questions.every(q => seen.get(q.id) === 1) && bank.diag.every(d => d.q.every(id => Q.get(id).topic === d.m)), `${bank.diag.length} lectures, each question in one, in its module`);
  const lecs = bank.diag.filter(d => d.m === MOD);
  const copd = lecs.find(d => d.n === 'COPD and cor pulmonale');
  check(!!copd && JSON.stringify(copd.l) === '["COPD","Cor pulmonale"]', 'a lecture with few questions joins the closest one: ' + (copd && copd.l));

  // the module page: by exam set first
  await p.click(`[data-topic="${MOD}"]`); await p.waitForTimeout(250);
  check(await p.getAttribute('[data-by="set"]', 'aria-selected') === 'true' && !!(await p.$('[data-set]')) && !(await p.$('[data-lec]')), 'module page: by exam set by default');
  await p.click('[data-by="lecture"]'); await p.waitForTimeout(250);
  const rows = await p.$$eval('[data-lec]', bs => bs.map(x => x.dataset.lec));
  check(rows.join() === lecs.map(d => d.id).join() && !(await p.$('[data-set]')), `by lecture: ${rows.length} lectures in course order`);
  check((await txt(p, `[data-lec="${copd.id}"] .e-lecs`)) === 'Both lectures: COPD · Cor pulmonale', 'the lectures it gathers: ' + await txt(p, `[data-lec="${copd.id}"] .e-lecs`));
  const tb = lecs.find(d => d.n === 'Tuberculosis infection');
  check((await txt(p, `[data-lec="${tb.id}"] .e-count`)) === `${once(tb).length} Qs` && (await txt(p, `[data-diag="${tb.id}"]`)) === `0/8`, `Tuberculosis infection: ${once(tb).length} questions, 0 of 8 toward its diagnostic`);
  // the midterm's six lectures count like the quest's six topics
  const qc = bank.quest.topics.map(t => t.q.length).join(), lc = [];
  for (const id of ['R-bronchitis', 'R-cap', 'R-abscess', 'R-viral', 'R-nosocomial', 'R-bronchiectasis']) lc.push((await txt(p, `[data-lec="${id}"] .e-count`)).replace(' Qs', ''));
  check(lc.join() === qc && bank.quest.q.length === lecs.slice(0, 6).reduce((a, d) => a + once(d).length, 0), `the midterm's lectures match the quest: ${lc.join(' ')} (quest ${qc.replace(/,/g, ' ')})`);
  await p.screenshot({ path: OUT + 'lec_list.png', fullPage: true });

  // a lecture: its questions, every copy, in exam order
  await p.click(`[data-lec="${tb.id}"]`); await p.waitForTimeout(250);
  let S = await state(p);
  check(await view(p) === 'quiz' && S.session.qids.join() === once(tb).join() && S.session.lec === tb.id && (await txt(p, '.bar-title')) === 'Tuberculosis infection', `practise it: ${S.session.qids.length} questions, "${await txt(p, '.bar-title')}"`);
  const q0 = Q.get(S.session.qids[0]);
  for (const i of q0.answer) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(100);
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(250);
  check(await view(p) === 'topic' && !!(await p.$('[data-lec]')) && (await txt(p, `[data-lec="${tb.id}"] .e-meta`)).startsWith('1 right'), 'Back: the lecture list, one right: ' + await txt(p, `[data-lec="${tb.id}"] .e-meta`));
  check((await txt(p, `[data-diag="${tb.id}"]`)) === '1/8', 'its diagnostic: 1 of 8');

  // a constellation lead in a lecture session offers its stars, and Back from them returns to the lecture
  const capL = lecs.find(d => d.id === 'R-cap'), capQs = once(capL), ci = capQs.findIndex(id => (bank.cst || []).some(c => c[0] === id && c.length > 1));
  await p.click(`[data-lec="${capL.id}"]`); await p.waitForTimeout(200);
  await p.click(`.strip [data-jump="${ci}"]`); await p.waitForTimeout(150);
  const chip = await p.$('.cst-chip');
  check(ci >= 0 && !!chip, 'a constellation in the lecture: its chip shows');
  await p.click('.cst-chip'); await p.waitForTimeout(100);
  check(/the lecture list groups the copies/.test(await txt(p, '.cst-card')), 'its card: ' + (await txt(p, '.cst-card')).slice(0, 90));
  await p.click('[data-act="stars"]'); await p.waitForTimeout(200);
  check((await state(p)).session.from === 'stars', 'Do all its stars');
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(200);
  check((await state(p)).session.lec === capL.id, 'Back from the stars: the lecture');
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(200);
  // kept across a reload
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  check(await view(p) === 'topic' && !!(await p.$('[data-lec]')), 'still by lecture after a reload');

  // the exam-type filter applies to the lectures
  const type = 'Midterms';
  await p.click(`[data-type="${type}"]`); await p.waitForTimeout(200);
  const mids = lecs.map(d => [d, once(d, type)]).filter(([, ids]) => ids.length);
  const shown = await p.$$eval('[data-lec]', bs => bs.map(x => x.dataset.lec));
  check(shown.join() === mids.map(([d]) => d.id).join(), `${type}: ${shown.length} lectures with midterm questions`);
  const [md, mq] = mids[0];
  await p.click(`[data-lec="${md.id}"]`); await p.waitForTimeout(250);
  S = await state(p);
  check(S.session.qids.join() === mq.join() && (await txt(p, '.bar-title')) === `${md.n} · ${type}`, `a lecture's ${type.toLowerCase()} only: ${mq.length}, "${await txt(p, '.bar-title')}"`);
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(200);
  await p.click('[data-type="all"]'); await p.waitForTimeout(200);

  // its diagnostic from the list, and back to the module
  await p.click(`[data-diag="${copd.id}"]`); await p.waitForTimeout(250);
  check(await view(p) === 'diag' && (await txt(p, '.dg-lecs')) === 'Both lectures: COPD · Cor pulmonale' && (await txt(p, '.bar .back')) === 'Respiratory', 'its diagnostic, with the lectures it gathers; Back says the module: ' + await txt(p, '.bar .back'));
  await p.screenshot({ path: OUT + 'lec_diag.png' });
  await p.click('.bar [data-act="diag-back"]'); await p.waitForTimeout(250);
  check(await view(p) === 'topic' && !!(await p.$('[data-lec]')), 'Back: the module\'s lectures');
  // opened from anywhere else (weak spots, a verdict), Back goes to weak spots
  await p.evaluate(([K, id]) => { const S = JSON.parse(localStorage.getItem(K)); Object.assign(S, { view: 'diag', diag: id, diagFrom: 'weak' }); localStorage.setItem(K, JSON.stringify(S)); }, [KEY, copd.id]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  check((await txt(p, '.bar .back')) === 'Weak spots', 'opened from weak spots, Back says Weak spots');
  await p.click('.bar [data-act="weak"]'); await p.waitForTimeout(250);
  check((await p.$$('.dg-row')).length === lecs.length, `the weak spots page lists the ${lecs.length} lectures`);

  // a module mock exam groups its results by lecture
  await p.click('.bar [data-act="home"]'); await p.waitForTimeout(250);
  await p.click(`[data-topic="${MOD}"]`); await p.waitForTimeout(250);
  await p.click('[data-act="exam-module"]'); await p.waitForTimeout(250);
  await p.click('[data-act="exam-start"]'); await p.waitForTimeout(150);
  S = await state(p);
  for (let k = 0; k < 3; k++) {
    for (const i of Q.get(S.exam.qids[k]).answer) await p.click(`.opt[data-opt="${i}"]`);
    await p.click('[data-act="exam-next"]'); await p.waitForTimeout(40);
  }
  await p.click('.bar [data-act="exam-handin"]'); await p.click('[data-act="exam-handin-yes"]'); await p.waitForTimeout(250);
  check((await txt(p, '#xt-h')) === 'By lecture' && (await p.$$('.ex-topics .xrow')).length > 1, `the results by lecture: ${(await p.$$('.ex-topics .xrow')).length} rows`);
  await ctx.close();

  // phone
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const m = await mctx.newPage(); watch(m, 'phone');
  await m.goto(URL, { waitUntil: 'load' }); await m.evaluate(() => localStorage.clear());
  await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(300);
  await m.tap(`[data-topic="cardio-vascular-system-disease"]`); await m.waitForTimeout(250);
  await m.tap('[data-by="lecture"]'); await m.waitForTimeout(250);
  await m.screenshot({ path: OUT + 'lec_m_list.png', fullPage: true });
  const o = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const fit = await m.evaluate(() => [...document.querySelectorAll('.lec-dg, .entry[data-lec]')].every(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; }));
  check(o === 0 && fit, 'phone: the lecture rows fit, nothing sideways');
  await mctx.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
