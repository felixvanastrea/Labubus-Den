// the practice list built into the page: shown to everyone, after the quest, saying the quest's questions come first
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch();
  const errs = []; const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { if (sessionStorage.getItem('once')) return; sessionStorage.setItem('once', 1); localStorage.setItem('efm3-mcq-bank-v1', JSON.stringify({ musts: { 'ai-practice-2026-11': { t: 'old copy', vip: 1, mod: 'technical-communication', q: [['AP1', 0]], qs: [], at: 1 } } })); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(1200);
  ok((await p.$$('[data-must="ai-practice-2026-11"]')).length === 1, 'anyone: one card, no link needed (an old private copy is dropped)');
  ok(await p.evaluate(() => { const m = document.querySelector('.pr-wrap'), q = [...document.querySelectorAll('[data-quest]')].pop(); return !q || !!(q.compareDocumentPosition(m) & 4); }), 'after the quest');
  const txt = await p.innerText('.pr-wrap');
  ok(/Not the priority/.test(txt) && /quest's questions first/.test(txt), 'says the quest comes first');
  ok(/30 extra questions/.test(txt), '30 questions');
  ok(!(await p.content()).includes('Agadir'), 'the questions are not stored as text in the page');
  await p.click('[data-must="ai-practice-2026-11"]'); await p.waitForTimeout(800);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')));
  ok(st.session.qids.length === 30, 'Practise opens all 30');
  ok(!st.musts['ai-practice-2026-11'], 'not copied into the saved data');
  await p.click('.opt[data-opt="0"]'); await p.click('.primary'); await p.waitForTimeout(500);
  ok(!!(await p.$('#verdict')) && (await p.$$('.why')).length === 4, 'checks with a why for every option');
  await p.reload(); await p.waitForTimeout(1000);
  ok(await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')).answers).some(id => /^p[0-9a-f]{9}$/.test(id))), 'its answer is kept after a reload');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
