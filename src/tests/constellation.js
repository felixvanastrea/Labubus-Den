// Constellations in a lecture's practice, as in the quest (copies with the same propositions count once), and
// explanations from the lectures. A module's lecture list groups them like the quest does.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const idOf = s => `JSON.parse(document.getElementById('bank').textContent).questions.find(q => q.sid === '${s}').id`;

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  };
  const fresh = async (p, state) => {
    await p.clock.install({ time: new Date(2026, 9, 2, 12, 0) });
    await p.goto(URL, { waitUntil: 'load' });
    await p.evaluate(([K, st]) => { localStorage.clear(); if (st) localStorage.setItem(K, JSON.stringify(st)); }, [KEY, state || null]);
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  };
  const jumpTo = async (p, s, tap) => {
    const i = await p.evaluate(`JSON.parse(localStorage.getItem('${KEY}')).session.qids.indexOf(${idOf(s)})`);
    await p[tap ? 'tap' : 'click'](`.strip [data-jump="${i}"]`); await p.waitForTimeout(250);
    return i;
  };

  // 1. desktop: a lecture's practice groups copies; the lead shows a constellation chip with a card on hover
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); watch(p, 'desk');
  await fresh(p);
  const lecture = async (pg, id, tap) => {
    await pg[tap ? 'tap' : 'click']('.arch[data-topic="respiratory-system-diseases"]'); await pg.waitForTimeout(250);
    await pg[tap ? 'tap' : 'click']('[data-by="lecture"]'); await pg.waitForTimeout(250);
    await pg[tap ? 'tap' : 'click'](`[data-lec="${id}"]`); await pg.waitForTimeout(250);
  };
  await p.click('.arch[data-topic="respiratory-system-diseases"]'); await p.waitForTimeout(250);
  await p.click('[data-by="lecture"]'); await p.waitForTimeout(250);
  check(/asked again with the same propositions is one constellation/.test(await p.textContent('.lec-note')), 'the lecture list says repeats count once');
  await p.click('.bar .back'); await p.waitForTimeout(250);
  await lecture(p, 'R-bronchitis');
  const ids = await p.evaluate(`JSON.parse(localStorage.getItem('${KEY}')).session.qids.map(id => JSON.parse(document.getElementById('bank').textContent).questions.find(q => q.id === id).sid)`);
  check(ids.includes('R86') && !ids.includes('R244') && !ids.includes('R232'), 'acute bronchitis practises R86 once, not its copies: ' + ids.join(' '));
  await jumpTo(p, 'R86');
  const chip = (await p.textContent('.cst-chip')).trim();
  check(chip === 'Constellation · 3 stars', 'chip: ' + chip);
  check(await p.$$eval('.qmeta .rep', e => e.length) === 0, 'the chip replaces the Asked badge');
  check(!(await p.$eval('#cst-card', el => el.classList.contains('on'))), 'card closed at first');
  await p.hover('.cst-chip'); await p.waitForTimeout(350);
  const card = await p.$eval('#cst-card', el => ({ on: el.classList.contains('on'), t: el.textContent.replace(/\s+/g, ' ').trim(), r: el.getBoundingClientRect().toJSON(), box: el.parentElement.getBoundingClientRect().toJSON() }));
  check(card.on && /came up 3 times with the same propositions/.test(card.t), 'hover opens the card: ' + card.t.slice(0, 110));
  check(/Midterm 2025–2026 · Respiratory Disease · Q10/.test(card.t) && /Collected questions · Q21/.test(card.t) && /Collected questions · Q33/.test(card.t), 'it lists the 3 copies');
  check(card.r.left >= card.box.left && card.r.right <= card.box.right, 'the card stays inside the question card');
  await p.screenshot({ path: OUT + 'cst_card.png', clip: { x: 240, y: 60, width: 800, height: 520 } });
  await p.hover('.cst-card'); await p.waitForTimeout(300);
  check(await p.$eval('#cst-card', el => el.classList.contains('on')), 'moving onto the card keeps it open');
  await p.mouse.move(5, 880); await p.waitForTimeout(400);
  check(!(await p.$eval('#cst-card', el => el.classList.contains('on'))), 'leaving closes it');

  // explanations: check R86 and read the lines
  const ans = await p.evaluate(`JSON.parse(document.getElementById('bank').textContent).questions.find(q => q.sid === 'R86').answer`);
  for (const i of ans) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(300);
  const whys = await p.$$eval('.whys .why-row', rows => rows.map(r => (r.classList.contains('k') ? '✓ ' : '· ') + r.querySelector('.why').textContent));
  console.log('  ' + whys.join('\n  '));
  check(whys.length === 4 && /^✓ Mostly viral/.test(whys[0]), 'four explanation lines, the right ones marked');
  check(/Why, from the lecture: Acute bronchitis/.test(await p.textContent('.ex-src')), 'source line names the lecture');
  await p.evaluate(() => document.querySelector('.ex').scrollIntoView()); await p.waitForTimeout(150);
  await p.screenshot({ path: OUT + 'cst_explained.png' });

  // do all the stars, then Back returns to R86 in the quest
  await p.hover('.cst-chip'); await p.waitForTimeout(300);
  await p.click('#cst-card [data-act="stars"]'); await p.waitForTimeout(300);
  const st = { title: await p.textContent('.bar-title'), count: await p.textContent('.bar-count'), ids: await p.evaluate(`JSON.parse(localStorage.getItem('${KEY}')).session.qids.map(id => JSON.parse(document.getElementById('bank').textContent).questions.find(q => q.id === id).sid)`) };
  check(st.title === 'Constellation · 3 stars' && st.count.trim() === '1/3' && st.ids.join() === 'R86,R232,R244', 'stars session: ' + st.title + ' | ' + st.ids.join(' '));
  check(await p.$$eval('.cst-chip', e => e.length) === 0, 'no chip inside the stars session');
  await p.click('.strip [data-jump="1"]'); await p.waitForTimeout(200);
  check(await p.$$eval('.verdict', e => e.length) === 0, 'R232 starts fresh (only R86 was answered)');
  const ans2 = await p.evaluate(`JSON.parse(document.getElementById('bank').textContent).questions.find(q => q.sid === 'R232').answer`);
  for (const i of ans2) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(250);
  check(await p.$$eval('.whys .why-row', e => e.length) === 4, 'the copy shows the same explanations, matched to its own option order');
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(350);
  const back = { title: await p.textContent('.bar-title'), sid: await p.evaluate(`(() => { const S = JSON.parse(localStorage.getItem('${KEY}')); return JSON.parse(document.getElementById('bank').textContent).questions.find(q => q.id === S.session.qids[S.session.idx]).sid; })()`) };
  check(/Acute bronchitis/.test(back.title) && back.sid === 'R86', 'Back returns to the lecture on R86: ' + back.title + ' ' + back.sid);
  // keyboard: focus the chip, the card opens; Escape closes it
  await p.focus('.cst-chip'); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  check(await p.$eval('#cst-card', el => el.classList.contains('on')), 'keyboard focus opens the card');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  check(!(await p.$eval('#cst-card', el => el.classList.contains('on'))), 'Escape closes it');
  await ctx.close();

  // 2. outside the quest nothing is grouped: the Collected set still has R232 and R244, with explanations
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p2 = await ctx2.newPage(); watch(p2, 'set');
  await fresh(p2);
  await p2.click('.arch[data-topic="respiratory-system-diseases"]'); await p2.waitForTimeout(250);
  const setId = await p2.evaluate(`JSON.parse(document.getElementById('bank').textContent).questions.find(q => q.sid === 'R244').source`);
  await p2.click(`[data-set="${setId}"]`); await p2.waitForTimeout(250);
  const setIds = await p2.evaluate(`JSON.parse(localStorage.getItem('${KEY}')).session.qids.map(id => JSON.parse(document.getElementById('bank').textContent).questions.find(q => q.id === id).sid)`);
  check(setIds.includes('R232') && setIds.includes('R244'), 'the exam set keeps both copies');
  await jumpTo(p2, 'R244');
  check(await p2.$$eval('.cst-chip', e => e.length) === 0 && await p2.$$eval('.qmeta .rep', e => e.length) === 1, 'outside the quest: the usual Asked badge, no chip');
  // an old quest session that still lists copies is trimmed to the current quest
  const old = await p2.evaluate(`(() => { const B = JSON.parse(document.getElementById('bank').textContent);
    const c = B.cst.find(ids => B.quest.q.includes(ids[0])), other = B.quest.q.find(id => !c.includes(id));
    const qids = [other].concat(c); return { session: { topic: B.quest.module, from: 'quest', qall: true, title: 'Quest', type: 'all', set: null, mode: 'all', shuffle: false, qids, order: qids.slice(), idx: 1 }, view: 'quiz' }; })()`);
  await fresh(p2, old);
  check((await p2.$$eval('.strip .cell', e => e.length)) === 2, 'an old quest session with copies is trimmed to the quest’s own questions (the lead, not its copies)');
  await ctx2.close();

  // 3. phone: tap opens and closes the card, which fits the screen
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage();
  watch(m, 'phone');
  await fresh(m);
  await lecture(m, 'R-cap', true);
  await jumpTo(m, 'R2', true);
  check((await m.textContent('.cst-chip')).trim() === 'Constellation · 4 stars', 'R2 is a constellation of 4');
  await m.tap('.cst-chip'); await m.waitForTimeout(350);
  const mc = await m.$eval('#cst-card', el => ({ on: el.classList.contains('on'), r: el.getBoundingClientRect().toJSON() }));
  check(mc.on && mc.r.left >= 0 && mc.r.right <= 390, `tap opens it, inside the screen (${Math.round(mc.r.left)}–${Math.round(mc.r.right)})`);
  await m.screenshot({ path: OUT + 'cst_m_card.png' });
  await m.tap('.cst-chip'); await m.waitForTimeout(350);
  check(!(await m.$eval('#cst-card', el => el.classList.contains('on'))), 'a second tap closes it');
  await m.tap('.cst-chip'); await m.waitForTimeout(300);
  await m.tap('.bar-title'); await m.waitForTimeout(350);
  check(!(await m.$eval('#cst-card', el => el.classList.contains('on'))), 'tapping elsewhere closes it');
  console.log('phone overflow:', await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
