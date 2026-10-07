// The class sky after the intro: someone signed in on this device opens the Den, the intro plays while their account
// wakes up, and once it's over the sky shows today's stars (it used to stay on "Gathering the stars…" until something
// redrew the homepage, like changing theme). The same for a gift's letter. Also when the account can't sync (error).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const src = fs.readFileSync(path.join(__dirname, 'account.js'), 'utf8');
const FAKE = new Function(src.slice(src.indexOf('const FAKE = {'), src.indexOf('\n};\n', src.indexOf('const FAKE = {')) + 3) + '\nreturn FAKE;')();
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();

async function as(b, who, extra) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(([who, extra]) => {
    if (location.protocol === 'about:') return;
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      const dk = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
      const sky = Object.fromEntries(['Salma', 'Yassine', 'Rim'].map((nm, i) => ['s' + i, { nm, c: 20, t: 1000 + i }]));
      localStorage.setItem('fake-user', JSON.stringify({ uid: who.uid, displayName: who.name, email: who.key + '@example.com' }));
      localStorage.setItem('fake-docs', JSON.stringify({ ['users/' + who.uid]: { s: '{}', name: who.name, key: who.key }, ['names/' + who.key]: { uid: who.uid, name: who.name }, ['sky/d' + dk(Date.now())]: sky }));
      localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', who.name);
      if (extra) for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    }
    window.__acctTest = true;
    window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
  }, [who, extra || null]);
  await ctx.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[req.url().match(/firebase-(\w+)\.js$/)[1]] });
  });
  return ctx;
}
// open the Den with the intro, let the account wake up during it, then skip it
async function openWithIntro(ctx, errors) {
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p.goto(URL + '#intro', { waitUntil: 'load' }); await p.waitForTimeout(1500);
  const playing = await p.evaluate(() => !!document.querySelector('.pk, .intro-front, canvas'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(900);
  return [p, playing];
}

(async () => {
  const b = await chromium.launch();
  const errors = [];

  const c1 = await as(b, { uid: 'u1', name: 'Lina', key: 'lina' });
  const [p, playing] = await openWithIntro(c1, errors);
  check(playing, 'the intro was playing while the account woke up');
  await p.evaluate(() => document.getElementById('class-sky').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  const sub = await txt(p, '#class-sky .sky-sub');
  check(!/Gathering/.test(sub) && (await p.$$('#class-sky .ss')).length === 4, 'after the intro, the sky shows today’s 3 stars and the North Star: ' + sub);
  await c1.close();

  const c2 = await as(b, { uid: 'u5', name: 'Amro', key: 'amro' });
  const [a] = await openWithIntro(c2, errors);
  await a.waitForTimeout(1200);
  check(await a.isVisible('.lt-sheet'), 'after the intro, Amro’s letter opens');
  await c2.close();

  // the account can't sync (the save is refused): the sky still shows
  const c3 = await as(b, { uid: 'u2', name: 'Nour', key: 'nour' }, { 'fake-deny-tx': '1' });
  await c3.addInitScript(() => { if (localStorage.getItem('fake-deny-tx')) window.__denyTx = true; });
  const e = await c3.newPage(); e.on('pageerror', x => errors.push('pageerror: ' + x.message));
  await e.goto(URL, { waitUntil: 'load' }); await e.waitForTimeout(1200);
  check(await e.evaluate(() => !window.__fb.calls.some(c => c.startsWith('tx'))), 'the account’s save was refused');
  await e.evaluate(() => document.getElementById('class-sky').scrollIntoView({ block: 'center' })); await e.waitForTimeout(300);
  check(!/Gathering/.test(await txt(e, '#class-sky .sky-sub')) && (await e.$$('#class-sky .ss')).length === 4, 'when syncing fails, the sky still shows: ' + await txt(e, '#class-sky .sky-sub'));
  await c3.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
