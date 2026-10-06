// Screenshots of each theme for a design review (not a pass/fail test): node review_looks.js [blood|codex]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'shots') + '/';
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const acc = fs.readFileSync(path.join(__dirname, 'account.js'), 'utf8');
const FAKE = new Function(acc.slice(acc.indexOf('const FAKE = {'), acc.indexOf('\n};\n', acc.indexOf('const FAKE = {')) + 3) + '\nreturn FAKE;')();
const looks = process.argv.slice(2).length ? process.argv.slice(2) : ['blood', 'codex'];
(async () => {
  const b = await chromium.launch();
  for (const lk of looks) for (const [vw, vh, tag] of [[1280, 860, 'd'], [390, 844, 'm']]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await ctx.addInitScript(lk => {
      if (location.protocol === 'about:') return;
      const docs = { 'users/u9': { s: JSON.stringify({ moon: { n: 6, full: 1, last: '', day: '', ids: [] }, stamps: {} }), name: 'Labubu', key: 'labubu', look: lk }, 'names/labubu': { uid: 'u9', name: 'Labubu' } };
      if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('fake-user', JSON.stringify({ uid: 'u9', displayName: 'Labubu', email: 'a@x' })); localStorage.setItem('fake-docs', JSON.stringify(docs)); localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', 'Labubu'); localStorage.setItem('efm3-look', lk); }
      window.__acctTest = true; window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user')), docs: JSON.parse(localStorage.getItem('fake-docs')) };
    }, lk);
    await ctx.route(/firebase-(app|auth|firestore)\.js$/, (r, q) => r.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[q.url().match(/firebase-(\w+)\.js$/)[1]] }));
    const p = await ctx.newPage(); p.on('pageerror', e => console.log('pageerror', e.message));
    await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}rv_${lk}_${tag}_home.png` });
    if (tag === 'd') {
      await p.evaluate(() => document.getElementById('quest').scrollIntoView()); await p.waitForTimeout(300);
      await p.screenshot({ path: `${OUT}rv_${lk}_${tag}_cards.png` });
      const bank = await p.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
      await p.evaluate(() => window.scrollTo(0, 0));
      const q = bank.questions.find(q => q.answer.length === 1 && q.topic === bank.topics[2].id);
      await p.click(`[data-topic="${q.topic}"]`); await p.waitForTimeout(300);
      await p.screenshot({ path: `${OUT}rv_${lk}_${tag}_module.png` });
      await p.click(`[data-start="${q.topic}"]`); await p.waitForTimeout(400);
      const S = await p.evaluate(() => JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')));
      const q0 = bank.questions.find(x => x.id === S.session.qids[S.session.idx]);
      const wrong = [0, 1, 2, 3, 4].find(i => !q0.answer.includes(i) && i < q0.options.length);
      await p.click(`.opt[data-opt="${wrong}"]`); await p.waitForTimeout(150);
      await p.screenshot({ path: `${OUT}rv_${lk}_${tag}_pick.png` });
      await p.click('[data-act="primary"]'); await p.waitForTimeout(2600);
      await p.screenshot({ path: `${OUT}rv_${lk}_${tag}_wrong.png` });
    }
    await ctx.close();
  }
  await b.close();
})();
