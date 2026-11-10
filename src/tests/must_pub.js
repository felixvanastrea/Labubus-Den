// the quest's must-know list is on everyone's homepage, above the quest, and practises its questions
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.__skyNow = Date.parse('2026-11-10T20:00:00Z'); });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(1200);
  const card = await p.$('.mk');
  ok(!!card, 'a guest sees the must-know card');
  ok(card && !(await card.$('[data-must-off]')), 'no Remove on the public card');
  ok(await p.evaluate(() => { const m = document.querySelector('.mk-wrap'), q = document.querySelector('[data-quest]'); return !!(m && q && (m.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING)); }), 'it sits above the quest');
  await p.click('[data-must]'); await p.waitForTimeout(700);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')));
  ok(st.view === 'quiz' && st.session.qids.length > 5, 'Practise opens a session of its ' + (st.session && st.session.qids.length) + ' questions');
  const p2 = await b.newPage(); await p2.addInitScript(() => { window.__skyNow = Date.parse('2026-11-12T10:00:00Z'); });
  await p2.goto('http://127.0.0.1:8765/index.html'); await p2.waitForTimeout(1000);
  ok(!(await p2.$('.mk')), 'gone once the exam has passed');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
