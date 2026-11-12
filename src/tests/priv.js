// the private list built into the page: unpacked only for the Labubu account (window.__privTest stands in for it here)
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch();
  const errs = []; const watch = p => p.on('pageerror', e => errs.push(e.message));
  const g = await b.newPage(); watch(g);
  await g.goto('http://127.0.0.1:8765/index.html'); await g.waitForTimeout(1000);
  ok(!(await g.$('[data-must="ai-practice-2026-11"]')), 'anyone else: no private card');
  ok(await g.evaluate(() => !(localStorage.getItem('efm3-mcq-bank-v1') || '').includes('ai-practice')), 'and nothing unpacked into their saved data');
  ok(!(await g.content()).includes('Agadir'), 'the questions are not readable in the page');
  const p = await b.newPage(); watch(p);
  await p.addInitScript(() => { window.__privTest = 1; });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(1200);
  ok(!!(await p.$('[data-must="ai-practice-2026-11"]')), 'the Labubu: the card is there, no link needed');
  ok(await p.evaluate(() => { const m = document.querySelector('.mk-wrap'), q = document.querySelector('[data-quest]'); return !q || !!(m.compareDocumentPosition(q) & 4); }), 'above the quest');
  ok(/30 questions/.test(await p.innerText('.mk:has([data-must="ai-practice-2026-11"])')), '30 questions');
  await p.click('[data-must="ai-practice-2026-11"]'); await p.waitForTimeout(800);
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')).session.qids.length)) === 30, 'Practise opens all 30');
  await p.click('.opt[data-opt="0"]'); await p.click('.primary'); await p.waitForTimeout(500);
  ok(!!(await p.$('#verdict')) && (await p.$$('.why')).length === 4, 'checks with a why for every option');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
