// Looks (cosmetics), against the fake Firebase of account.js: only the account named Labubu gets them. Signed in as
// Labubu: the looks in the sheet, Blood moon puts on the crimson palette, the moon, the castles and the bats, saved to
// the account; the intro has the big moon that shrinks into the homepage's and bats after the falling star. Signed out,
// or anyone else: no looks, the classic palette. Screenshots in shots/look_*.png.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
fs.mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const src = fs.readFileSync(path.join(__dirname, 'account.js'), 'utf8');
const FAKE = new Function(src.slice(src.indexOf('const FAKE = {'), src.indexOf('\n};\n', src.indexOf('const FAKE = {')) + 3) + '\nreturn FAKE;')();
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const look = p => p.evaluate(() => document.documentElement.dataset.look || 'gothic');
const wait = ms => new Promise(r => setTimeout(r, ms));

async function context(b, size, user, docs) {
  const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 1 });
  await ctx.addInitScript(([user, docs]) => {
    if (location.protocol === 'about:') return;
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('fake-user', JSON.stringify(user)); localStorage.setItem('fake-docs', JSON.stringify(docs));
      localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', user.displayName);
    }
    window.__acctTest = true;
    window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
  }, [user, docs]);
  await ctx.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    const n = req.url().match(/firebase-(\w+)\.js$/)[1];
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[n] });
  });
  return ctx;
}

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const labubu = { uid: 'u9', displayName: 'Labubu', email: 'abi@example.com' };
  const docs = { 'users/u9': { s: '{}', name: 'Labubu', key: 'labubu', email: 'abi@example.com' }, 'names/labubu': { uid: 'u9', name: 'Labubu' } };

  // Labubu: the looks in the sheet
  let ctx = await context(b, { width: 1280, height: 860 }, labubu, docs);
  let p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(400);
  check(await look(p) === 'gothic', 'Labubu starts on the classic look');
  await p.click('.nav-acct'); await p.waitForTimeout(200);
  check(!!(await p.$('.acct-looks [data-look="blood"]')), 'Labubu: the looks are in the sheet');
  await p.click('[data-look="blood"]'); await p.waitForTimeout(300);
  const saved = await p.evaluate(() => window.__fb.docs['users/u9'].look);
  check(await look(p) === 'blood' && saved === 'blood' && !!(await p.$('.bm-img')) && !!(await p.$('.bm-land .castle')) && (await p.$$('.bats .bat')).length === 7, 'Blood moon: on, saved to the account, with the moon, the castles and the bats');
  await p.screenshot({ path: OUT + 'look_sheet.png' });
  await p.click('[data-acct="close"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + 'look_home.png' });
  await p.screenshot({ path: OUT + 'look_home_full.png', fullPage: true });
  const navBg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(navBg === 'rgb(18, 10, 11)', 'the crimson night palette: ' + navBg);

  // a new visit keeps it (from the account, before Firebase wakes up too); the intro with the moon and the bats
  await p.goto('about:blank'); await p.goto(URL + '#intro', { waitUntil: 'load' }); await p.waitForTimeout(1300);
  check(await look(p) === 'blood' && !!(await p.$('.pick')), 'next visit: still the blood moon, intro playing');
  await p.screenshot({ path: OUT + 'look_intro_pick.png' });
  await p.click('.pk-year.on'); await p.waitForTimeout(900);
  await p.screenshot({ path: OUT + 'look_intro_sems.png' });
  await p.click('.pk-sem.on');
  for (const [ms, n] of [[450, 1], [500, 2], [700, 3], [800, 4]]) { await wait(ms); await p.screenshot({ path: OUT + `look_intro_fall${n}.png` }); }
  await wait(1600);
  check(!(await p.$('.intro-sky')) && await p.evaluate(() => getComputedStyle(document.querySelector('.bm')).opacity) === '1', 'after the intro: the homepage moon shows');
  await ctx.close();

  // a phone
  ctx = await context(b, { width: 390, height: 844 }, labubu, Object.assign({}, docs, { 'users/u9': Object.assign({}, docs['users/u9'], { look: 'blood' }) }));
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(500);
  check(await look(p) === 'blood' && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: blood moon, no sideways scroll');
  await p.screenshot({ path: OUT + 'look_phone.png' });
  await ctx.close();

  // anyone else: no looks, even with the look saved on the device
  const sara = { uid: 'u2', displayName: 'Sara', email: 'sara@example.com' };
  ctx = await context(b, { width: 1280, height: 860 }, sara, { 'users/u2': { s: '{}', name: 'Sara', key: 'sara' }, 'names/sara': { uid: 'u2', name: 'Sara' } });
  await ctx.addInitScript(() => localStorage.setItem('efm3-look', 'blood'));
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(400);
  await p.click('.nav-acct'); await p.waitForTimeout(200);
  check(await look(p) === 'gothic' && !(await p.$('.acct-looks')) && !(await p.$('.bm-img')), 'Sara: no looks, classic palette');
  await ctx.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
