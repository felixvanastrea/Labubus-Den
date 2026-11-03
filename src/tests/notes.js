// Fireflies with messages on the homepage (Abi, 3 November 2026), against account.js's fake Firebase: the class's
// messages show (only the last 24 hours, the most starred first), the name on hover, a star given and taken back, the
// sparkle by stars, writing one (80 characters at most) replaces your own, deleting yours, the Labubu deleting anyone's,
// a guest asked to sign in, a phone. Screenshots: shots/notes_*.png.
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
const errors = [];
const H = 36e5, now = Date.now();
const people = { u1: 'Abi', u2: 'Zeineb', u3: 'Amro', u4: 'Nada', u5: 'Old', u9: 'Labubu' };
function docs(extra = {}) {
  const d = {};
  for (const [u, nm] of Object.entries(people)) { const k = nm.toLowerCase(); d['names/' + k] = { uid: u, name: nm }; d['users/' + u] = { name: nm, key: k, s: '{}' }; }
  d['notes/u2'] = { nm: 'Zeineb', k: 'zeineb', txt: 'Good luck for Thursday everyone!', t: now - 2 * H, up: { u3: true, u4: true, u9: true } };
  d['notes/u3'] = { nm: 'Amro', k: 'amro', txt: 'Who else is doing hepatitis tonight?', t: now - 30 * 6e4, up: {} };
  d['notes/u4'] = { nm: 'Nada', k: 'nada', txt: 'The achalasia slides are on the Drive', t: now - 5 * H, up: { u2: true, u3: true, u5: true, u9: true, u1: true, a: true, b: true, c: true, d: true, e: true } };
  d['notes/u5'] = { nm: 'Old', k: 'old', txt: 'This one is from yesterday', t: now - 26 * H, up: {} };
  return Object.assign(d, extra);
}
async function open(b, opts = {}) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts.ctx || {}));
  await ctx.addInitScript(o => {
    if (location.protocol === 'about:') return;
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1'); localStorage.clear();
      if (o.who) { localStorage.setItem('fake-user', JSON.stringify(o.who)); localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', o.who.displayName); }
      localStorage.setItem('fake-docs', JSON.stringify(o.docs));
    }
    window.__acctTest = true;
    window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
  }, { who: opts.who, docs: opts.docs || docs() });
  await ctx.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[req.url().match(/firebase-(\w+)\.js$/)[1]] });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push((opts.tag || 'page') + ' pageerror: ' + e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  return { ctx, p };
}
const flies = p => p.$$eval('#ffs .ff', els => els.map(e => ({ uid: e.dataset.uid, cls: e.className, txt: e.querySelector('.ff-txt').textContent, n: +e.querySelector('.ff-up .num').textContent, pressed: e.querySelector('.ff-up').getAttribute('aria-pressed'), del: !!e.querySelector('.ff-del') })));
const fdoc = (p, r) => p.evaluate(r => window.__fb.docs[r] || null, r);

(async () => {
  const b = await chromium.launch();

  // signed in as Abi (u1, not the Labubu)
  let { ctx, p } = await open(b, { who: { uid: 'u1', displayName: 'Abi', email: 'a@x' } });
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + 'notes_desk0.png' });
  let f = await flies(p);
  check(f.length === 3, `the last 24 hours only (${f.map(x => x.uid)})`);
  check(f[0].uid === 'u4' && f[1].uid === 'u2' && f[2].uid === 'u3', 'the most starred first');
  check(/\bt4\b/.test(f[0].cls) && /\bt2\b/.test(f[1].cls) && /\bt0\b/.test(f[2].cls), `sparkle by stars (${f.map(x => x.cls)})`);
  check(f[0].pressed === 'true' && f[1].pressed === 'false', 'my own star shows as given');
  check(!f.some(x => x.del), 'no delete on other people’s');
  const who0 = await p.$eval('.ff[data-uid="u3"] .ff-more', e => getComputedStyle(e).opacity);
  await p.hover('.ff[data-uid="u3"] .ff-bub', { force: true }); await p.waitForTimeout(450);
  const who1 = await p.$eval('.ff[data-uid="u3"] .ff-more', e => getComputedStyle(e).opacity);
  const whoTxt = await p.$eval('.ff[data-uid="u3"] .ff-who', e => e.textContent);
  check(+who0 < .1 && +who1 > .9 && /Amro/.test(whoTxt), `the name on hover (${who0} → ${who1}, "${whoTxt.trim()}")`);
  await p.screenshot({ path: OUT + 'notes_desk.png' });

  // a star given, then taken back
  await p.hover('.ff[data-uid="u3"] .ff-bub', { force: true }); await p.waitForTimeout(400);
  await p.click('.ff[data-uid="u3"] .ff-up', { force: true }); await p.waitForTimeout(300);
  let d = await fdoc(p, 'notes/u3');
  check(d && d.up && d.up.u1 === true && (await flies(p)).find(x => x.uid === 'u3').n === 1, 'a star given');
  check(/\bt1\b/.test((await flies(p)).find(x => x.uid === 'u3').cls), 'one star: brighter');
  await p.hover('.ff[data-uid="u3"] .ff-bub', { force: true }); await p.waitForTimeout(400);
  await p.click('.ff[data-uid="u3"] .ff-up', { force: true }); await p.waitForTimeout(300);
  d = await fdoc(p, 'notes/u3');
  check(d && !d.up.u1, 'a second tap takes it back');

  // writing one: 80 characters at most
  const long = 'x'.repeat(120);
  await p.click('.ff-open'); await p.waitForTimeout(300);
  check(await p.isVisible('#ff-in'), 'Release a firefly opens the bubble');
  await p.fill('#ff-in', long);
  check((await p.inputValue('#ff-in')).length === 80, 'at most 80 characters');
  check(/80\/80/.test(await p.textContent('.ff-count')), 'the counter');
  await p.fill('#ff-in', 'Hepatitis E is fecal-oral, remember it');
  await p.click('.ff-pop button[type="submit"]'); await p.waitForTimeout(500);
  d = await fdoc(p, 'notes/u1');
  check(d && d.txt === 'Hepatitis E is fecal-oral, remember it' && d.nm === 'Abi' && d.k === 'abi' && JSON.stringify(d.up) === '{}', 'mine written, under my name');
  f = await flies(p);
  const mine = f.find(x => x.uid === 'u1');
  check(mine && mine.del && /\bmine\b/.test(mine.cls), 'mine shows, with Delete mine');
  await p.click('.ff-open'); await p.waitForTimeout(300);
  await p.fill('#ff-in', 'A second one'); await p.click('.ff-pop button[type="submit"]'); await p.waitForTimeout(500);
  d = await fdoc(p, 'notes/u1');
  f = await flies(p);
  check(d.txt === 'A second one' && f.filter(x => x.uid === 'u1').length === 1 && f.find(x => x.uid === 'u1').txt === 'A second one', 'a new one replaces the old');
  await p.hover('.ff[data-uid="u1"] .ff-bub', { force: true }); await p.waitForTimeout(400);
  await p.click('.ff[data-uid="u1"] .ff-del', { force: true }); await p.waitForTimeout(500);
  check(!(await fdoc(p, 'notes/u1')) && !(await flies(p)).some(x => x.uid === 'u1'), 'deleting mine');
  await ctx.close();

  // the Labubu deletes anyone's
  ({ ctx, p } = await open(b, { who: { uid: 'u9', displayName: 'Labubu', email: 'l@x' }, tag: 'labubu' }));
  await p.waitForTimeout(400);
  f = await flies(p);
  check(f.length === 3 && f.every(x => x.del), 'the Labubu can delete every one');
  await p.hover('.ff[data-uid="u3"] .ff-bub', { force: true }); await p.waitForTimeout(400);
  await p.click('.ff[data-uid="u3"] .ff-del', { force: true }); await p.waitForTimeout(500);
  check(!(await fdoc(p, 'notes/u3')), 'the Labubu deleted one');
  await ctx.close();

  // a guest
  ({ ctx, p } = await open(b, { tag: 'guest' }));
  check(!(await p.$('#ffs .ff')) && !(await p.$('.ff-send')), 'a guest sees no messages and no button');
  await ctx.close();

  // a phone
  ({ ctx, p } = await open(b, { who: { uid: 'u1', displayName: 'Abi', email: 'a@x' }, ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, tag: 'phone' }));
  await p.waitForTimeout(500);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(over <= 0, `no sideways scroll on a phone (${over})`);
  const boxes = await p.$$eval('#ffs .ff-bub', els => els.map(e => e.getBoundingClientRect()).map(r => [r.left, r.right]));
  check(boxes.every(([l, r]) => l >= 0 && r <= 390), 'every box on screen');
  await p.tap('.ff[data-uid="u2"] .ff-txt', { force: true }); await p.waitForTimeout(400);
  check(+(await p.$eval('.ff[data-uid="u2"] .ff-more', e => getComputedStyle(e).opacity)) > .9, 'a tap shows the name');
  await p.screenshot({ path: OUT + 'notes_phone.png' });
  await ctx.close();

  check(!errors.length, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'all passed');
  process.exit(fails ? 1 : 0);
})();
