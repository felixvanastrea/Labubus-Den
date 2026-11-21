// the AI practice list built into the page: it shows only while a quest of its module is on.
// Since 21 November 2026 the AI quest is off the homepage (Abi), so the card must stay hidden.
const { chromium } = require('playwright');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch();
  const errs = []; const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({ time: new Date('2026-11-21T12:00:00Z') });
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(1200);
  ok(!(await p.$('.pr-wrap')), 'no extra practice card while no AI quest is on');
  ok(!(await p.content()).includes('Agadir'), 'the questions are not stored as text in the page');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
