// Looks (cosmetics), against the fake Firebase of account.js: only the account named Labubu gets them. Signed in as
// Labubu: the looks in the sheet, Blood moon puts on the crimson palette, the moon, the castles and the bats, saved to
// the account; the intro has the big moon that shrinks into the homepage's and bats after the falling star. Signed out,
// or anyone else: no looks, the classic palette. Golden phase: light, the painting behind the page, its intro.
// Screenshots in shots/look_*.png.
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
  check(!!(await p.$('.acct-looks [data-theme="blood"]')) && /Wear it/.test(await p.textContent('.acct-looks [data-theme="codex"]')), 'Labubu: every theme is hers to wear, in the sheet');
  await p.click('.acct-looks [data-theme="blood"]'); await p.waitForTimeout(300);
  const saved = await p.evaluate(() => window.__fb.docs['users/u9'].look);
  check(await look(p) === 'blood' && saved === 'blood' && !!(await p.$('.bm-img')) && !!(await p.$('.bm-land .castle')) && (await p.$$('.bats .bat')).length === 7, 'Blood moon: on, saved to the account, with the moon, the castles and the bats');
  await p.screenshot({ path: OUT + 'look_sheet.png' });
  await p.click('[data-acct="close"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + 'look_home.png' });
  await p.screenshot({ path: OUT + 'look_home_full.png', fullPage: true });
  const navBg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const h2f = await p.evaluate(() => getComputedStyle(document.querySelector('.h2')).fontFamily);
  check(navBg === 'rgb(16, 8, 9)' && /Grenze Gotisch/.test(h2f), 'Blood moon: the crimson night, blackletter headings: ' + navBg);

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

  // Codex: picked in the sheet, then the intro with the gilded halo, and a phone
  ctx = await context(b, { width: 1280, height: 860 }, labubu, docs);
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(400);
  await p.click('.nav-acct'); await p.waitForTimeout(200);
  await p.click('.acct-looks [data-theme="codex"]'); await p.waitForTimeout(300);
  check(await look(p) === 'codex' && await p.evaluate(() => window.__fb.docs['users/u9'].look) === 'codex' && !!(await p.$('.bm-codex .bm-img')) && !!(await p.$('.masthead .cx-strip .cx-snail')) && !!(await p.$('.cx-motto')) && !(await p.$('.bm-land')) && await p.evaluate(() => getComputedStyle(document.querySelector('.quest-plate')).clipPath.startsWith('polygon')), 'Codex: the halo, the folio with its motto and snail, parchment leaves with deckled edges, saved');
  await p.click('[data-acct="close"]'); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + 'look_codex_home.png' });
  await p.goto('about:blank'); await p.goto(URL + '#intro', { waitUntil: 'load' }); await p.waitForTimeout(1300);
  await p.screenshot({ path: OUT + 'look_codex_pick.png' });
  await p.click('.pk-year.on'); await p.waitForTimeout(900); await p.click('.pk-sem.on');
  await wait(1200); await p.screenshot({ path: OUT + 'look_codex_fall.png' });
  await wait(3000);
  check(!(await p.$('.intro-sky')) && await look(p) === 'codex', 'Codex: the intro lands on the halo');
  await ctx.close();
  ctx = await context(b, { width: 390, height: 844 }, labubu, Object.assign({}, docs, { 'users/u9': Object.assign({}, docs['users/u9'], { look: 'codex' }) }));
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(1600);
  check(await look(p) === 'codex' && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Codex on a phone: no sideways scroll');
  await p.screenshot({ path: OUT + 'look_codex_phone.png' });
  await ctx.close();

  // Golden phase: a light page, the lovers of The Kiss as the background, the title in gold leaf; the intro lands the
  // painting on the page; scrolling down, it becomes a watermark
  ctx = await context(b, { width: 1280, height: 860 }, labubu, docs);
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(400);
  await p.click('.nav-acct'); await p.waitForTimeout(200);
  await p.click('.acct-looks [data-theme="klimt"]'); await p.waitForTimeout(300);
  await p.click('[data-acct="close"]'); await p.waitForTimeout(800);
  const km = await p.evaluate(() => { const bg = getComputedStyle(document.querySelector('.km-bg')); return { d: bg.display, img: bg.backgroundImage, o: +bg.opacity, body: getComputedStyle(document.body).backgroundColor, h2: getComputedStyle(document.querySelector('.h2')).fontFamily }; });
  check(await look(p) === 'klimt' && await p.evaluate(() => window.__fb.docs['users/u9'].look) === 'klimt' && km.d === 'block' && /klimt-kiss\.webp/.test(km.img) && km.o > .9 && /Playfair Display/.test(km.h2) && !!(await p.$('.km-meadow')) && !!(await p.$('.km-leaves')),
    'Golden phase: the painting behind the page, Playfair headings, the meadow and the falling leaf, saved: ' + JSON.stringify({ o: km.o, body: km.body }));
  check(/rgb\(2[2-5]\d, 2[2-4]\d, 2[01]\d\)/.test(km.body) || km.body === 'rgba(0, 0, 0, 0)', 'Golden phase is light: ' + km.body);
  await p.screenshot({ path: OUT + 'look_klimt_home.png' });
  await p.evaluate(() => window.scrollTo(0, innerHeight * 1.2)); await p.waitForTimeout(300);
  check(await p.evaluate(() => +getComputedStyle(document.querySelector('.km-bg')).opacity) < .4, 'scrolled into the page, the painting is a watermark');
  await p.goto('about:blank'); await p.goto(URL + '#intro', { waitUntil: 'load' }); await p.waitForTimeout(1300);
  check(!!(await p.$('.pick')) && await p.evaluate(() => getComputedStyle(document.querySelector('.pk-t')).color) !== 'rgb(43, 30, 14)', 'the intro picker keeps the night\'s colours on a light theme');
  await p.click('.pk-year.on'); await p.waitForTimeout(900); await p.click('.pk-sem.on');
  await wait(1200); await p.screenshot({ path: OUT + 'look_klimt_fall.png' });
  await wait(3000);
  check(!(await p.$('.intro-sky')) && await look(p) === 'klimt' && await p.evaluate(() => +getComputedStyle(document.querySelector('.km-bg')).opacity) > .9, 'Golden phase: the intro lands the painting on the page');
  await ctx.close();
  ctx = await context(b, { width: 390, height: 844 }, labubu, Object.assign({}, docs, { 'users/u9': Object.assign({}, docs['users/u9'], { look: 'klimt' }) }));
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(1600);
  check(await look(p) === 'klimt' && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Golden phase on a phone: no sideways scroll');
  await p.screenshot({ path: OUT + 'look_klimt_phone.png' });
  await ctx.close();

  // a phone
  ctx = await context(b, { width: 390, height: 844 }, labubu, Object.assign({}, docs, { 'users/u9': Object.assign({}, docs['users/u9'], { look: 'blood' }) }));
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(500);
  check(await look(p) === 'blood' && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: blood moon, no sideways scroll');
  await p.screenshot({ path: OUT + 'look_phone.png' });
  await ctx.close();

  // anyone else: themes are earned. Sara has had a full moon (Blood moon is hers), no Solid lecture (Codex is locked)
  const sara = { uid: 'u2', displayName: 'Sara', email: 'sara@example.com' };
  const saraS = JSON.stringify({ moon: { n: 2, full: 1, last: '', day: '', ids: [] }, stamps: {} });
  ctx = await context(b, { width: 1280, height: 860 }, sara, { 'users/u2': { s: saraS, name: 'Sara', key: 'sara' }, 'names/sara': { uid: 'u2', name: 'Sara' } });
  await ctx.addInitScript(() => { if (location.protocol !== 'about:' && !sessionStorage.getItem('lk')) { sessionStorage.setItem('lk', '1'); localStorage.setItem('efm3-look', 'codex'); } });
  p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(900);
  check(await look(p) === 'gothic', 'Sara: a theme she hasn\'t earned isn\'t worn, even saved on the device');
  check(/New theme unlocked: Blood moon/.test(await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')), 'Sara: told she unlocked Blood moon');
  const card = id => p.evaluate(id => { const b = document.querySelector(`.th-wrap [data-theme="${id}"]`); return b ? b.closest('.th-card').textContent.replace(/\s+/g, ' ') : ''; }, id);
  check(/Wear it/.test(await card('blood')) && /Preview/.test(await card('codex')) && /Solid: 15\/20/.test(await card('codex')) && /No lecture diagnosed yet/.test(await card('codex')), 'Themes section: Blood moon to wear, Codex locked with its requirement');
  check(/Preview/.test(await card('klimt')) && /golden exam: 16\/20 or more in exam mode, on 20 questions or more/.test(await card('klimt')) && /No exam of 20 questions or more yet/.test(await card('klimt')), 'Golden phase locked: a golden exam, 16/20 on 20 questions or more');
  await p.evaluate(() => document.querySelector('.th-wrap').scrollIntoView());
  await p.screenshot({ path: OUT + 'look_themes.png' });
  await p.click('.th-wrap [data-theme="codex"]'); await p.waitForTimeout(300);
  const during = await look(p);
  await p.waitForTimeout(6300);
  check(during === 'codex' && await look(p) === 'gothic', 'a locked theme previews for a few seconds, then goes');
  await p.click('.th-wrap [data-theme="blood"]'); await p.waitForTimeout(300);
  check(await look(p) === 'blood' && await p.evaluate(() => window.__fb.docs['users/u2'].look) === 'blood', 'Sara wears Blood moon, saved to her account');
  await ctx.close();

  // a guest: the section shows, with a way to sign in; a preview works
  const c3 = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await c3.addInitScript(() => { window.__acctTest = true; });
  p = await c3.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(400);
  check(!!(await p.$('.th-guest [data-act="account"]')) && /Preview/.test(await p.textContent('.th-wrap [data-theme="blood"]')), 'guest: themes locked, Sign in offered');
  await c3.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
