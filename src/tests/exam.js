// Exam mode: the quest as a timed exam out of 20. The way in (quest card, rules), a shuffled run with no answers
// shown, picks by click and by key, the scoring rule (full point, half a point for at least half the right answers,
// nothing for a wrong tick or a blank), the clock (warnings, the time running out on the page and while it's closed),
// Hand in and its confirm, reload, results by topic, the review, the quest card and hero while it runs, practice
// answers left alone, Reset all, the phone layout, and no errors.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
const MIN = 60000;
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
// Abi's rule, written out as a table: points by number of right answers ticked, for questions with n right answers
// (any wrong tick scores 0; three right answers: 3 ticked → 1, 2 → 0.5, 1 → 0)
const SPEC = { 1: [0, 1], 2: [0, .5, 1], 3: [0, 0, .5, 1], 4: [0, 0, .5, .5, 1], 5: [0, 0, 0, .5, .5, 1] };
const expectPts = (q, sel) => (!sel.length || sel.some(i => !q.answer.includes(i))) ? 0 : SPEC[q.answer.length][sel.length];
const fmt = v => v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const state = p => p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); watch(p, 'desk');
  await p.clock.install({ time: new Date(2026, 9, 4, 14, 0) });
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  const bank = await p.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
  const Q = new Map(bank.questions.map(q => [q.id, q]));
  const quest = bank.quest;

  // the way in: the quest card, then the rules
  await p.evaluate(() => document.getElementById('quest').scrollIntoView());
  check(await txt(p, '.quest [data-act="exam"]') === 'Exam mode', 'the quest card has an Exam mode button');
  check(!(await p.$('.qp-exam')), 'no exam scores on the card before the first exam');
  await p.click('.quest [data-act="exam"]'); await p.waitForTimeout(200);
  check(await p.evaluate(() => document.body.dataset.view) === 'exam' && await txt(p, 'h1') === 'Exam mode', 'it opens the exam rules');
  // how long: 20 like the midterm (the default), 50, or the whole quest
  const sizes = await p.$$eval('[data-exam-n]', bs => bs.map(b => [b.dataset.examN, b.getAttribute('aria-pressed')]));
  check(JSON.stringify(sizes) === JSON.stringify([['20', 'true'], ['50', 'false'], [String(quest.q.length), 'false']]), 'sizes: ' + JSON.stringify(sizes));
  check((await txt(p, '.page-head .eyebrow')).includes('20 questions · 20 minutes'), 'by default 20 questions, like the midterm: ' + await txt(p, '.page-head .eyebrow'));
  await p.click(`[data-exam-n="${quest.q.length}"]`); await p.waitForTimeout(150);
  const eyebrow = await txt(p, '.page-head .eyebrow');
  check(eyebrow.includes(`${quest.q.length} questions · ${quest.q.length} minutes`), 'the whole quest: ' + eyebrow);
  check((await p.$$('.ex-rules li')).length === 3 && (await txt(p, '.ex-rules')).includes('two give 0.5, one gives 0'), 'three rules, with the half-point example');
  check(!!(await p.$('.ph-art .window')), 'an hourglass in the arched window');
  await p.screenshot({ path: OUT + 'ex_intro.png', fullPage: true });

  // start: the clock, a shuffled order, nothing that gives the answer away
  await p.click('[data-act="exam-start"]'); await p.waitForTimeout(200);
  let S = await state(p);
  check(S.exam && S.exam.qids.length === quest.q.length && [...S.exam.qids].sort().join() === [...quest.q].sort().join(), 'the exam holds every quest question once');
  check(S.exam.qids.join() !== quest.q.join(), 'in a shuffled order');
  check(S.exam.end - S.exam.start === quest.q.length * MIN, 'one minute per question');
  check(await txt(p, '.ex-clock') === `${quest.q.length}:00`, 'the clock starts at ' + await txt(p, '.ex-clock'));
  check((await p.$$('.strip .cell')).length === quest.q.length && await txt(p, '.qmeta .qn') === 'Question 1', 'one cell per quest question in the strip, question 1');
  check(!(await p.$('.verdict')) && !(await p.$('.ex')) && !(await p.$('.report')) && !(await p.$('.cst-chip')) && !(await p.$('.key')), 'no verdict, explanations, report link, constellation or key while it runs');
  await p.screenshot({ path: OUT + 'ex_run.png' });

  // a 20-question exam on the quest, in another browser: every topic in it, no question twice
  {
    const c2 = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const p2 = await c2.newPage(); watch(p2, 'short');
    await p2.clock.install({ time: new Date(2026, 9, 4, 14, 0) });
    await p2.goto(URL, { waitUntil: 'load' }); await p2.evaluate(() => localStorage.clear()); await p2.reload({ waitUntil: 'load' }); await p2.waitForTimeout(300);
    await p2.evaluate(() => document.getElementById('quest').scrollIntoView());
    await p2.click('.quest [data-act="exam"]'); await p2.waitForTimeout(200);
    await p2.click('[data-act="exam-start"]'); await p2.waitForTimeout(200);
    const S2 = await state(p2), got = S2.exam.qids;
    const per = quest.topics.map(t => got.filter(id => t.q.includes(id)).length);
    check(got.length === 20 && new Set(got).size === 20 && got.every(id => quest.q.includes(id)) && per.every(n => n >= 1) && S2.exam.end - S2.exam.start === 20 * MIN,
      `20 questions from the quest, every topic in proportion: ${per.join(' ')}`);
    await c2.close();
  }

  // answer the first ten: each case of the rule, by click and by key
  const plan = [];
  const cases = ['full', 'half', 'wrong', 'few', 'blank', 'keys', 'half', 'wrong-only', 'full', 'few'];
  for (let k = 0; k < cases.length; k++) {
    const id = S.exam.qids[k], q = Q.get(id), n = q.answer.length;
    const wrong = [...q.options.keys()].find(i => !q.answer.includes(i));
    let c = cases[k], sel;
    if (c === 'half' && n < 2) c = 'full';
    if (c === 'few' && n < 3) c = 'wrong-only';
    if (c === 'full' || c === 'keys') sel = q.answer.slice();
    else if (c === 'half') sel = q.answer.slice(0, Math.ceil(n / 2));
    else if (c === 'wrong') sel = [...q.answer, wrong];
    else if (c === 'few') sel = q.answer.slice(0, 1);
    else if (c === 'wrong-only') sel = [wrong];
    else sel = [];
    for (const i of sel) {
      if (c === 'keys') await p.keyboard.press('abcde'[i]);
      else await p.click(`.opt[data-opt="${i}"]`);
    }
    plan.push({ id, case: c, sel: [...sel].sort((a, b) => a - b), pts: expectPts(q, sel) });
    if (k === 0) {
      check(await p.$eval('.strip .cell.cur', e => e.classList.contains('ticked')), 'a ticked question is marked in the strip');
      check(await txt(p, '[data-exam-answered]') === `1 of ${quest.q.length} answered`, 'and counted: ' + await txt(p, '[data-exam-answered]'));
    }
    if (k % 3 === 0) await p.click('[data-act="exam-next"]');
    else if (k % 3 === 1) await p.keyboard.press('ArrowRight');
    else await p.keyboard.press('Enter');
    await p.waitForTimeout(60);
  }
  console.log('  plan:', plan.map(x => `${Q.get(x.id).sid}:${x.case}=${x.pts}`).join(' '));
  S = await state(p);
  check(S.exam.idx === 10, 'Next, the right arrow and Enter all move on');
  check(plan.every(x => JSON.stringify(S.exam.picks[x.id] || []) === JSON.stringify(x.sel)), 'the picks are saved as made');
  check(Object.keys(S.answers).length === 0, 'practice answers are left alone');
  // going back and unticking
  await p.click('.strip [data-jump="0"]'); await p.waitForTimeout(80);
  const q0 = Q.get(plan[0].id);
  check(await p.getAttribute(`.opt[data-opt="${q0.answer[0]}"]`, 'aria-pressed') === 'true', 'jumping back shows the picks');
  await p.click(`.opt[data-opt="${q0.answer[0]}"]`); await p.click(`.opt[data-opt="${q0.answer[0]}"]`);
  check(JSON.stringify((await state(p)).exam.picks[plan[0].id]) === JSON.stringify(plan[0].sel), 'untick and tick again');

  // a reload keeps the exam where it was
  await p.click('.strip [data-jump="4"]'); await p.waitForTimeout(80);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  check(await p.evaluate(() => document.body.dataset.view) === 'exam' && await txt(p, '.qmeta .qn') === 'Question 5', 'a reload keeps the exam and the question');

  // leaving: the hero and the quest card show the clock, which keeps going
  await p.click('.bar [data-act="exam-back"]'); await p.waitForTimeout(250);
  check(await p.evaluate(() => document.body.dataset.view) === 'home', 'Back goes home while it runs');
  const hero = await txt(p, '.hero-cta');
  check(/Exam in progress: \d+:\d\d left/.test(hero) && hero.includes('Back to the exam'), 'hero: ' + hero.slice(0, 70));
  const cardBtn = await txt(p, '.quest [data-act="exam-resume"]');
  check(/^Back to the exam · \d+:\d\d$/.test(cardBtn), 'quest card: ' + cardBtn);
  const before = await txt(p, '.hero-cta [data-exam-clock]');
  await p.clock.fastForward(2 * MIN); await p.waitForTimeout(100);
  const after = await txt(p, '.hero-cta [data-exam-clock]');
  const secs = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
  check(secs(before) - secs(after) >= 119 && secs(before) - secs(after) <= 121, `the clock runs on the home page: ${before} → ${after}`);
  await p.click('.hero-cta [data-act="exam-resume"]'); await p.waitForTimeout(200);
  check(await txt(p, '.qmeta .qn') === 'Question 5', 'Back to the exam returns to the same question');

  // five minutes left: a word, and the clock turns
  S = await state(p);
  const now = await p.evaluate(() => Date.now());
  await p.clock.fastForward(S.exam.end - now - 5 * MIN + 2000); await p.waitForTimeout(100);
  await p.clock.fastForward(2500); await p.waitForTimeout(100);
  check(await txt(p, '#toast') === 'Five minutes left' && await p.$eval('#toast', e => e.classList.contains('on')), 'a toast at five minutes');
  check(await p.$eval('.ex-clock', e => e.classList.contains('low')) && await p.$eval('.ex-time', e => e.classList.contains('low')), 'the clock and its line turn: ' + await txt(p, '.ex-clock'));
  await p.screenshot({ path: OUT + 'ex_run_low.png' });

  // hand in: the confirm counts the blanks; Keep going, Escape, then Hand in
  await p.click('.bar [data-act="exam-handin"]'); await p.waitForTimeout(100);
  const blanks = quest.q.length - plan.filter(x => x.sel.length).length;
  const conf = await txt(p, '.exc');
  check(conf.includes(`Hand in your exam? ${blanks} questions are still blank`), 'confirm: ' + conf);
  check(await p.evaluate(() => document.activeElement && document.activeElement.dataset.act) === 'exam-keep', 'the confirm focuses Keep going');
  await p.screenshot({ path: OUT + 'ex_confirm.png' });
  await p.click('[data-act="exam-keep"]'); await p.waitForTimeout(80);
  check(!(await p.$('.exc')), 'Keep going closes it');
  await p.click(`.strip [data-jump="${quest.q.length - 1}"]`); await p.waitForTimeout(80);
  check(await txt(p, '[data-act="exam-next"]') === 'Hand in', 'the last question offers Hand in');
  await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  check(!!(await p.$('.exc')), 'Enter on the last question asks to hand in');
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  check(!(await p.$('.exc')), 'Escape closes it');
  await p.click('.bar [data-act="exam-handin"]'); await p.waitForTimeout(80);
  await p.click('[data-act="exam-handin-yes"]'); await p.waitForTimeout(250);

  // results: the mark out of 20 from the rule, the split, each topic, the log
  const points = plan.reduce((a, x) => a + x.pts, 0);
  const n20 = Math.round(points / quest.q.length * 2000) / 100;
  S = await state(p);
  check(S.exam.handed > 0 && !S.exam.auto && S.examLog.length === 1, 'handed in, logged once');
  check(await txt(p, '#ex-score') === fmt(n20), `score ${await txt(p, '#ex-score')}/20, expected ${fmt(n20)} (${points} points)`);
  check(S.examLog[0].n20 === n20 && S.examLog[0].points === points, 'the log has the same mark');
  const count = c => plan.filter(x => x.sel.length && (c === 'full' ? x.pts === 1 : c === 'half' ? x.pts === .5 : x.pts === 0)).length;
  const tally = await txt(p, '.ex-tally');
  check(tally.includes(`${count('full')} full point`) && tally.includes(`${count('half')} half point`) && tally.includes(`${count('zero')} no point`) && tally.includes(`${blanks} blank`), 'tally: ' + tally);
  check((await txt(p, '.done .d-meta')).startsWith(`${fmt(points)} of ${quest.q.length} points, handed in after`), 'meta: ' + await txt(p, '.done .d-meta'));
  const topicRows = await p.$$eval('.ex-topics .xrow', rows => rows.map(r => r.querySelector('.xr-meta').textContent));
  const topicSum = topicRows.reduce((a, t) => a + parseFloat(t), 0);
  check(topicRows.length === quest.topics.length && Math.abs(topicSum - points) < 1e-9, `by topic: ${topicRows.length} rows adding up to ${topicSum}`);
  check((await p.$$('.ex-past .xl-row')).length === 1, 'one exam in the list');
  const cellCls = await p.$$eval('.ex-res .strip .cell', cs => cs.map(c => c.className));
  const want = x => !x.sel.length ? 'x-blank' : x.pts === 1 ? 'x-full' : x.pts === .5 ? 'x-half' : 'x-zero';
  check(plan.every((x, k) => cellCls[k].includes(want(x))), 'the strip marks each question');
  await p.screenshot({ path: OUT + 'ex_results.png', fullPage: true });

  // review: picks against the key, the point and why, the explanations
  await p.click('[data-act="exam-review"]'); await p.waitForTimeout(150);
  for (let k = 0; k < 5; k++) {
    const x = plan[k], q = Q.get(x.id);
    const v = await p.$eval('#verdict', e => e.className);
    const cls = await p.$$eval('.opts .opt', os => os.map(o => o.className));
    const optOK = q.options.every((_, i) => {
      const pk = x.sel.includes(i), ink = q.answer.includes(i);
      return cls[i].includes(pk && ink ? 'is-hit' : pk ? 'is-miss' : ink ? 'is-missed' : 'is-rest');
    });
    check(v.includes(want(x).slice(2)) && optOK, `review ${k + 1} (${x.case}): ${await txt(p, '#verdict')}`);
    if (k === 0) {
      const hasExp = !!q.exp;
      check((!hasExp ||!!(await p.$('.ex .whys'))) && !!(await p.$('.report')), 'explanations (when the question has some) and Report a mistake in the review');
      await p.screenshot({ path: OUT + 'ex_review.png', fullPage: true });
    }
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(60);
  }
  await p.click('.bar [data-act="exam-back"]'); await p.waitForTimeout(150);
  check(!!(await p.$('.ex-res')), 'Back from the review goes to the results');
  await p.click('.d-actions [data-act="exam-back"]'); await p.waitForTimeout(250);
  const line = await txt(p, '.qp-exam');
  check(line === `Exam mode: last ${fmt(n20)}/20 · see the results` && await txt(p, '.quest [data-act="exam"]') === 'Exam mode', 'quest card after: ' + line);
  check(!(await txt(p, '.hero-cta')).includes('Exam in progress'), 'the hero is back to the quest');
  await p.click('.qp-exam [data-act="exam-results"]'); await p.waitForTimeout(150);
  check(!!(await p.$('.ex-res')), '"see the results" opens them');

  // the time runs out while on the exam
  await p.click('[data-act="exam-new"]'); await p.waitForTimeout(100);
  check(await txt(p, 'h1') === 'Exam mode' && (await p.$$('.ex-past .xl-row')).length === 1, 'New exam shows the rules and the exams so far');
  await p.click('[data-act="exam-start"]'); await p.waitForTimeout(100);
  S = await state(p);
  const fq = Q.get(S.exam.qids[0]);
  for (const i of fq.answer) await p.click(`.opt[data-opt="${i}"]`);
  await p.clock.fastForward(quest.q.length * MIN - 30000); await p.waitForTimeout(100);
  check(await p.$eval('.ex-clock', e => e.classList.contains('last')), 'the last minute pulses: ' + await txt(p, '.ex-clock'));
  await p.clock.fastForward(31000); await p.waitForTimeout(250);
  S = await state(p);
  check(S.exam.handed === S.exam.end && S.exam.auto && !!(await p.$('.ex-timeup')), 'at zero it hands itself in: ' + await txt(p, '.ex-timeup'));
  check(await txt(p, '#ex-score') === fmt(Math.round(1 / quest.q.length * 2000) / 100), 'with what was ticked: ' + await txt(p, '#ex-score'));
  check((await txt(p, '.done .d-meta')).includes(`with all ${quest.q.length} min used`), 'meta: ' + await txt(p, '.done .d-meta'));
  check(S.examLog.length === 2 && (await txt(p, '.ex-past')).includes('the time ran out') && (await txt(p, '.ex-past')).includes('best'), 'two exams, the best one marked');

  // the time runs out while the page is closed
  await p.click('[data-act="exam-new"]'); await p.waitForTimeout(100);
  await p.click('[data-act="exam-start"]'); await p.waitForTimeout(100);
  await p.click('.bar [data-act="exam-back"]'); await p.waitForTimeout(100);
  // as if it had been started 49 minutes ago and the page closed since
  const expire = ([K, view, M]) => {
    const S = JSON.parse(localStorage.getItem(K)), d = S.exam.end - S.exam.start;
    S.exam.start = Date.now() - d - M; S.exam.end = S.exam.start + d; S.exam.handed = 0; S.exam.auto = false; S.view = view;
    localStorage.setItem(K, JSON.stringify(S));
  };
  await p.evaluate(expire, [KEY, 'home', MIN]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  S = await state(p);
  check(S.exam.handed === S.exam.end && S.exam.auto && S.examLog.length === 3 && await p.evaluate(() => document.body.dataset.view) === 'home', 'on load, an exam past its time is handed in');
  await p.evaluate(() => document.getElementById('quest').scrollIntoView());
  check((await txt(p, '.qp-exam')).startsWith('Exam mode: last 0/20 · best'), 'the card shows it: ' + await txt(p, '.qp-exam'));
  await p.evaluate(expire, [KEY, 'exam', MIN]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  check(await p.evaluate(() => document.body.dataset.view) === 'exam' && !!(await p.$('.ex-timeup')) && (await state(p)).examLog.length === 3, 'closed during the exam: it opens on the results, logged once');

  // Reset all answers clears the exams too
  await p.evaluate(K => { const S = JSON.parse(localStorage.getItem(K)); S.answers[S.exam.qids[0]] = { sel: [0], checked: true, correct: false }; S.view = 'home'; localStorage.setItem(K, JSON.stringify(S)); }, KEY);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(250);
  await p.click('.allrow [data-act="reset"]'); await p.click('.allrow [data-act="reset-yes"]'); await p.waitForTimeout(150);
  S = await state(p);
  check(S.exam === null && S.examLog.length === 0 && !(await p.$('.qp-exam')), 'Reset all answers clears the exams');
  await ctx.close();

  // phone
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const m = await mctx.newPage(); watch(m, 'phone');
  await m.clock.install({ time: new Date(2026, 9, 4, 14, 0) });
  await m.goto(URL, { waitUntil: 'load' }); await m.evaluate(() => localStorage.clear());
  await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(300);
  const over = () => m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await m.evaluate(() => document.getElementById('quest').scrollIntoView());
  await m.screenshot({ path: OUT + 'ex_m_card.png' });
  await m.tap('.quest [data-act="exam"]'); await m.waitForTimeout(200);
  await m.screenshot({ path: OUT + 'ex_m_intro.png', fullPage: true });
  let o = await over();
  await m.tap('[data-act="exam-start"]'); await m.waitForTimeout(200);
  const mS = await m.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
  const mq = Q.get(mS.exam.qids[0]);
  await m.tap(`.opt[data-opt="${mq.answer[0]}"]`);
  await m.screenshot({ path: OUT + 'ex_m_run.png' });
  o = Math.max(o, await over());
  const barFits = await m.evaluate(() => { const r = document.querySelector('.bar [data-act="exam-handin"]').getBoundingClientRect(); return r.right <= window.innerWidth && r.width > 40; });
  check(barFits, 'phone: Hand in fits in the bar');
  await m.tap('.bar [data-act="exam-handin"]'); await m.waitForTimeout(100);
  await m.screenshot({ path: OUT + 'ex_m_confirm.png' });
  o = Math.max(o, await over());
  await m.tap('[data-act="exam-handin-yes"]'); await m.waitForTimeout(250);
  await m.screenshot({ path: OUT + 'ex_m_results.png', fullPage: true });
  o = Math.max(o, await over());
  await m.tap('[data-act="exam-review"]'); await m.waitForTimeout(150);
  await m.screenshot({ path: OUT + 'ex_m_review.png' });
  o = Math.max(o, await over());
  check(o === 0, 'phone: no sideways scroll on any exam screen');
  await mctx.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
