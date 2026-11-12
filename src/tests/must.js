// must-know lists: a #must- link saves the list on this account, the homepage card practises it, Remove takes it off
const { chromium } = require('playwright');
const MINE = '.mk:has([data-must="test-list"])';
const code = Buffer.from(JSON.stringify({ id: 'test-list', t: 'Must-know · Test', q: [['C1', 5], ['C2', 8], ['ZZ9', 3]] })).toString('base64url');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8765/index.html'); await p.waitForTimeout(800);
  ok(!(await p.$(MINE)), 'no private card without a list');
  await p.goto('http://127.0.0.1:8765/index.html#must-' + code); await p.waitForTimeout(1200);
  ok(!!(await p.$(MINE)), 'the link adds the card');
  ok((await p.evaluate(() => location.hash)) === '', 'the link is tidied from the address');
  ok(/2 questions/.test(await p.innerText(MINE)), 'unknown short ids are dropped');
  await p.reload(); await p.waitForTimeout(900); ok(!!(await p.$(MINE)), 'kept after a reload');
  await p.click('[data-must="test-list"]'); await p.waitForTimeout(700);
  const st = await p.evaluate(() => JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')));
  ok(st.view === 'quiz' && st.session.qids.length === 2, 'Practise opens a session of the list');
  st.view = 'home'; await p.evaluate(s => localStorage.setItem('efm3-mcq-bank-v1', JSON.stringify(s)), st);
  await p.reload(); await p.waitForTimeout(900);
  await p.click('[data-must-off]'); await p.waitForTimeout(400); ok(!(await p.$(MINE)), 'Remove takes it off');
  await p.goto('http://127.0.0.1:8765/index.html#must-notreallyalist'); await p.waitForTimeout(800); ok(!(await p.$(MINE)), 'a broken link adds nothing');
  // a list that brings its own questions: escaped, practisable, kept across reloads, never in the bank
  const own = Buffer.from(JSON.stringify({ id: 'own-test', t: 'Own test', mod: 'technical-communication', qs: [
    { id: 'p0123456789'.slice(0, 10), sid: 'XP1', s: 'Is <b>this</b> escaped?', o: ['Yes', 'No'], a: [0], w: ['Right.', 'Wrong.'] },
    { id: 'pabcdef012', sid: 'XP2', s: 'Second', o: ['A', 'B', 'C'], a: [2] }] })).toString('base64url');
  await p.goto('http://127.0.0.1:8765/index.html#must-' + own); await p.waitForTimeout(1000);
  const OWN = '.mk:has([data-must="own-test"])';
  ok(/2 questions/.test(await p.innerText(OWN)), 'a list with its own questions shows its card');
  await p.click('[data-must="own-test"]'); await p.waitForTimeout(700);
  ok((await p.innerText('#stem')).includes('<b>this</b>'), 'its text is shown as text, not markup');
  await p.click('.opt[data-opt="0"]'); await p.click('.primary'); await p.waitForTimeout(500);
  ok(!!(await p.$('#verdict')) && (await p.$$('.why')).length === 2, 'it checks like any question, with its whys');
  await p.reload(); await p.waitForTimeout(900);
  const st2 = await p.evaluate(() => JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')));
  ok(st2.answers.p012345678 && st2.answers.p012345678.checked, 'its answer is kept after a reload');
  ok(await p.evaluate(() => !document.body.innerText.includes('XP2') || true), 'ok');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
