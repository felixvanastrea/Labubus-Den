// The class, against account.js's fake Firebase: first tries are counted once per question for the class (stats/{module});
// a checked question says how the class did on its first try (from 10 answers); the class sky has a star for each
// classmate who did 10 questions today, in order of arrival, filling the constellations (the Little Bear first, around
// the North Star); the North Star is the Labubu's, gold, always there; hovering a star or a name says who it is; Hide my
// star takes it out; the Labubu's sheet lists the questions the class fails most and goes through them; a guest is asked
// to sign in. Screenshots: shots/class_*.png.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
fs.mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
const src = fs.readFileSync(path.join(__dirname, 'account.js'), 'utf8');
const FAKE = new Function(src.slice(src.indexOf('const FAKE = {'), src.indexOf('\n};\n', src.indexOf('const FAKE = {')) + 3) + '\nreturn FAKE;')();
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const docs = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__fb.docs)));

(async () => {
  const b = await chromium.launch();
  const errors = [];
  // the bank, the week and today, as the page counts them
  const pre = await b.newPage();
  await pre.goto(URL, { waitUntil: 'load' });
  const bank = await pre.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
  const [week, today, d3, d10] = await pre.evaluate(() => {
    const dk = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    return ['d' + dk(Date.now()), dk(Date.now()), dk(Date.now() - 3 * 864e5), dk(Date.now() - 10 * 864e5)];
  });
  await pre.close();
  const endo = bank.questions.filter(q => q.topic === 'endocrinology' && q.answer.length).slice(0, 3);
  const resp = bank.questions.filter(q => q.topic === 'respiratory-system-diseases');
  const derm = bank.questions.filter(q => q.topic === 'dermatology' && q.answer.length).slice(0, 3);
  const seed = {
    'users/u9': { s: '{}', name: 'Labubu', key: 'labubu', email: 'abi@example.com' }, 'names/labubu': { uid: 'u9', name: 'Labubu' },
    // three classmates' accounts, for the most questions done: Rim did 30 today and 20 three days ago (and 99 too long ago)
    'users/u2': { s: JSON.stringify({ days: { [today]: 30, [d3]: 20, [d10]: 99 } }), name: 'Rim', key: 'rim', answered: 640, t: Date.now() - 2 * 864e5 },
    'users/u0': { s: JSON.stringify({ days: { [today]: 12 } }), name: 'Salma', key: 'salma', answered: 412, t: Date.now() },
    'users/u3': { s: '{}', name: 'Omar', key: 'omar', answered: 120, t: Date.now() - 10 * 864e5 },
    'stats/respiratory-system-diseases': Object.fromEntries(resp.map(q => [q.id, { n: 20, r: 12 }])),
    'stats/dermatology': Object.fromEntries(derm.map((q, i) => [q.id, { n: 15 + i, r: 2 + i }])),
    ['sky/' + week]: Object.fromEntries(['Salma', 'Yassine', 'Rim', 'Omar', 'Hiba', 'Ilyas', 'Nour', 'Adam', 'Sara'].map((nm, i) => ['u' + i, { nm, c: [30, 10, 50, 20, 10, 10, 75, 10, 20][i], t: 1000 + i }]))
  };
  const local = { answers: Object.fromEntries(endo.map((q, i) => [q.id, { sel: q.answer, checked: true, correct: i !== 1 }])), first: Object.fromEntries(endo.map((q, i) => [q.id, i !== 1])) };

  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(([seed, local, K]) => {
    if (location.protocol === 'about:') return;
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('fake-user', JSON.stringify({ uid: 'u9', displayName: 'Labubu', email: 'abi@example.com' }));
      localStorage.setItem('fake-docs', JSON.stringify(seed)); localStorage.setItem(K, JSON.stringify(local));
      localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', 'Labubu');
    }
    window.__acctTest = true;
    window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
  }, [seed, local, KEY]);
  await ctx.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[req.url().match(/firebase-(\w+)\.js$/)[1]] });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(900);

  // first tries counted for the class, once
  let D = await docs(p);
  const st = D['stats/endocrinology'] || {}, n = Object.values(st).reduce((a, x) => a + x.n, 0), r = Object.values(st).reduce((a, x) => a + x.r, 0);
  const sent = Object.keys((await p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY)).statSent || {}).length;
  check(n === 3 && r === 2 && sent === 3, `this device's 3 first tries counted for the class (${n} tries, ${r} right)`);
  check(!D['sky/' + week].u9, 'no star of mine written before 10 questions today');

  // the sky: four stars, the Labubu's gold; who studied tonight
  await p.evaluate(() => document.getElementById('class-sky').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  check((await p.$$('#class-sky .ss')).length === 10 && !!(await p.$('#class-sky .ss.gold .slb')), 'the class sky: 9 stars and the North Star, gold, with the Labubu');
  check(/the Little Bear/.test(await txt(p, '#class-sky .cns')) && (await p.$$('#class-sky .cl line.on')).length === 7 && (await p.$$('#class-sky .cl line:not(.on)')).length === 2, 'the Little Bear is complete and drawn; the Great Bear is forming');
  check(/9 of you did 10 questions or more today\. The Little Bear is complete\. 4 more stars and the Great Bear is complete\./.test(await txt(p, '#class-sky .sky-sub')), 'the line: ' + await txt(p, '#class-sky .sky-sub'));
  await p.hover('#class-sky .sky-nm:has-text("Salma")'); await p.waitForTimeout(150);
  check(/Salma · 30\+ questions today · in the Little Bear/.test(await txt(p, '#class-sky .sky-tip')) && !!(await p.$('#class-sky .ss.hl')), 'hovering a name lights its star and says who: ' + await txt(p, '#class-sky .sky-tip'));
  await p.hover('#class-sky .ss.gold .sc'); await p.waitForTimeout(150);
  check(/^Labubu · the North Star, always shining/.test(await txt(p, '#class-sky .sky-tip')) && /Your star is the North Star/.test(await txt(p, '#class-sky .sky-foot')), 'the North Star: ' + await txt(p, '#class-sky .sky-tip'));
  await (await p.$('#class-sky')).screenshot({ path: OUT + 'class_sky.png' });

  // how the class did, under the verdict
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('[data-topic="respiratory-system-diseases"]'); await p.waitForTimeout(250);
  await p.click('[data-start="respiratory-system-diseases"]'); await p.waitForTimeout(400);
  const S = await p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
  const q0 = bank.questions.find(q => q.id === S.session.qids[S.session.idx]);
  for (const i of q0.answer) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(500);
  check(/60% of the class got this right on their first try · 20 answers/.test(await txt(p, '#verdict')), 'under the verdict: ' + await txt(p, '#verdict .v-class'));
  await (await p.$('#verdict')).screenshot({ path: OUT + 'class_verdict.png' });

  // the Labubu's list of the questions the class fails
  const home = async () => { for (let i = 0; i < 4 && !(await p.$('.nav-acct')); i++) { await p.click('.bar [data-act="home"], .bar [data-act="back"]'); await p.waitForTimeout(300); } };
  await home();
  await p.click('.nav-acct'); await p.waitForTimeout(200);
  await p.click('[data-acct="hard"]'); await p.waitForTimeout(400);
  check((await p.$$('.acct-card .hard li')).length === 3 && /13% of 15/.test(await txt(p, '.acct-card .hard')), 'class stats: the 3 questions most fail, worst first: ' + (await txt(p, '.acct-card .hard')).slice(0, 60));
  // and who has done the most questions
  await p.click('[data-acct="top"]'); await p.waitForTimeout(400);
  const tops = await p.$$eval('.acct-card .top li', ls => ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()));
  check(tops.length === 4 && /^Rim 640 questions · 50 in the last 7 days, last active 2 days ago$/.test(tops[0]) && /^Salma 412 questions · 12 in the last 7 days, last active today$/.test(tops[1])
    && /^Omar 120 questions · none in the last 7 days, last active 10 days ago$/.test(tops[2]) && /^Labubu \(you\) 3 questions/.test(tops[3]), 'most questions done, top first: ' + tops.join(' | '));
  await p.screenshot({ path: OUT + 'class_hard.png' });
  await p.evaluate(() => { window.__fb.user = { uid: 'u2' }; });   // anyone else asking for the list is refused by the rules
  check(await p.evaluate(async () => { const f = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'); try { await f.getDocs(f.query(f.collection({}, 'users'), f.orderBy('answered', 'desc'), f.limit(10))); return false; } catch (e) { return e.code === 'permission-denied'; } }), 'the fake rules refuse the list to anyone but the Labubu');
  await p.evaluate(() => { window.__fb.user = { uid: 'u9', displayName: 'Labubu', email: 'abi@example.com' }; });
  await p.click('[data-acct="hard-go"]'); await p.waitForTimeout(400);
  const S2 = await p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
  check(S2.view === 'quiz' && S2.session.qids.length === 3, 'and goes through them');

  await ctx.close();

  // a classmate with 12 questions today: her star rises, and Hide my star takes it down
  const c3 = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await c3.addInitScript(([seed, K, today]) => {
    if (location.protocol === 'about:') return;
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('fake-user', JSON.stringify({ uid: 'u8', displayName: 'Lina', email: 'lina@example.com' }));
      localStorage.setItem('fake-docs', JSON.stringify(Object.assign({}, seed, { 'users/u8': { s: '{}', name: 'Lina', key: 'lina' }, 'names/lina': { uid: 'u8', name: 'Lina' } })));
      localStorage.setItem(K, JSON.stringify({ days: { [today]: 12 } }));
      localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', 'Lina');
    }
    window.__acctTest = true;
    window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
  }, [seed, KEY, today]);
  await c3.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[req.url().match(/firebase-(\w+)\.js$/)[1]] });
  });
  const l = await c3.newPage(); l.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await l.goto(URL, { waitUntil: 'load' }); await l.waitForTimeout(900);
  D = await docs(l);
  check(D['sky/' + week].u8 && D['sky/' + week].u8.c === 10 && D['sky/' + week].u8.nm === 'Lina', 'Lina did 12 today: her star rises (10+)');
  await l.evaluate(() => document.getElementById('class-sky').scrollIntoView({ block: 'center' })); await l.waitForTimeout(400);
  check(/Your star shines in the Great Bear/.test(await txt(l, '#class-sky .sky-foot')) && !!(await l.$('#class-sky .ss.me')), 'she sees where her star is: ' + await txt(l, '#class-sky .sky-foot'));
  await (await l.$('#class-sky')).screenshot({ path: OUT + 'class_sky_lina.png' });
  await l.click('#class-sky [data-act="sky-hide"]'); await l.waitForTimeout(400);
  D = await docs(l);
  check(!D['sky/' + week].u8 && /Your star is hidden/.test(await txt(l, '#class-sky .sky-foot')) && D['users/u8'].skyHide === true, 'Hide my star: gone from the sky, remembered in the account');
  await c3.close();

  // a guest
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 } });
  await c2.addInitScript(() => { window.__acctTest = true; });
  const g = await c2.newPage(); g.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await g.goto(URL, { waitUntil: 'load' }); await g.waitForTimeout(400);
  check(!!(await g.$('#class-sky [data-act="account"]')) && (await g.$$('#class-sky .ss')).length === 1 && !!(await g.$('#class-sky .ss.gold')), 'guest: the North Star, and a sign in to join');
  await (await g.$('#class-sky')).screenshot({ path: OUT + 'class_sky_phone_guest.png' });
  await c2.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
