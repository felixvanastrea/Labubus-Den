// A gift from the Labubu (GIFTS), against account.js's fake Firebase: the account named AMRO gets her letter once on the
// homepage, can wear the Blood moon without a full moon ("A gift from the Labubu" under Themes), the letter is marked
// read in the account (synced), and can be read again from the account sheet; another account gets nothing.
// Screenshots: shots/gift_*.png.
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
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();

async function as(b, who, viewport) {
  const ctx = await b.newContext({ viewport: viewport || { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(who => {
    if (location.protocol === 'about:') return;
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('fake-user', JSON.stringify({ uid: who.uid, displayName: who.name, email: who.key + '@example.com' }));
      localStorage.setItem('fake-docs', JSON.stringify({ ['users/' + who.uid]: { s: '{}', name: who.name, key: who.key }, ['names/' + who.key]: { uid: who.uid, name: who.name } }));
      localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', who.name);
    }
    window.__acctTest = true;
    window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
  }, who);
  await ctx.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[req.url().match(/firebase-(\w+)\.js$/)[1]] });
  });
  return ctx;
}

(async () => {
  const b = await chromium.launch();
  const errors = [];

  // Amro: the letter, once
  const ctx = await as(b, { uid: 'u5', name: 'AMRO', key: 'amro' });
  const p = await ctx.newPage(); p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  check(await p.isVisible('.lt-sheet') && /^Congratulations, Amro$/.test(await txt(p, '#lt-h')) && /answered the most questions/.test(await txt(p, '.lt')), 'Amro: the letter from the Labubu opens on the homepage');
  check(!(await p.$('.toast')) || !/New theme unlocked/.test(await txt(p, '.toast')), 'no "new theme unlocked" toast on top of it');
  await p.screenshot({ path: OUT + 'gift_letter.png' });
  await p.click('[data-letter="wear"]'); await p.waitForTimeout(600);
  const look = await p.evaluate(() => document.documentElement.dataset.look);
  check(!(await p.isVisible('.lt-sheet')) && look === 'blood', 'Wear it now: the letter closes and the Den turns Blood moon (' + look + ')');
  await p.evaluate(() => document.querySelector('.th-wrap').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
  const rows = await p.$$eval('.th-wrap .th-card', cs => cs.map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  check(/Blood moon.*A gift from the Labubu.*Wearing/.test(rows[2]) && /Preview/.test(rows[1]), 'Themes: the Blood moon is his, a gift; Codex still locked');
  await (await p.$('.th-wrap')).screenshot({ path: OUT + 'gift_themes.png' });
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(400);
  const doc = await p.evaluate(() => window.__fb.docs['users/u5']);
  check(doc && doc.look === 'blood', 'the Blood moon is kept on his account');

  // back again: no letter; it can be read again from the account sheet
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1500);
  check(!(await p.isVisible('.lt-sheet')), 'on the next visit, the letter doesn’t open again');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('.nav-acct'); await p.waitForTimeout(200);
  await p.click('[data-acct="letter"]'); await p.waitForTimeout(400);
  check(await p.isVisible('.lt-sheet') && !(await p.$('[data-letter="wear"]')), 'Read the Labubu’s letter again: it opens, with nothing more to wear');
  await p.screenshot({ path: OUT + 'gift_letter_blood.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check(!(await p.isVisible('.lt-sheet')), 'Escape closes it');
  await ctx.close();

  // on a phone, the letter fits
  const c3 = await as(b, { uid: 'u5', name: 'Amro', key: 'amro' }, { width: 390, height: 844 });
  const ph = await c3.newPage(); ph.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await ph.goto(URL, { waitUntil: 'load' }); await ph.waitForTimeout(1500);
  const box = await ph.evaluate(() => { const r = document.querySelector('.lt').getBoundingClientRect(); return [r.left, r.right, document.documentElement.scrollWidth]; });
  check(await ph.isVisible('.lt-sheet') && box[0] >= 15 && box[1] <= 375 && box[2] <= 390, 'phone: the letter fits the screen ' + JSON.stringify(box));
  await ph.screenshot({ path: OUT + 'gift_letter_phone.png' });
  await c3.close();

  // Zeineb: her own letter
  const c4 = await as(b, { uid: 'u7', name: 'Zeineb', key: 'zeineb' });
  const z = await c4.newPage(); z.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await z.goto(URL, { waitUntil: 'load' }); await z.waitForTimeout(1500);
  check(await z.isVisible('.lt-sheet') && /^Congratulations, Zeineb$/.test(await txt(z, '#lt-h')) && !!(await z.$('[data-letter="wear"][data-id="blood"]')), 'Zeineb: her letter, with the Blood moon');
  await z.screenshot({ path: OUT + 'gift_letter_zeineb.png' });
  await c4.close();

  // anyone else: no letter, no Blood moon
  const c2 = await as(b, { uid: 'u6', name: 'Sara', key: 'sara' });
  const s = await c2.newPage(); s.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await s.goto(URL, { waitUntil: 'load' }); await s.waitForTimeout(1500);
  const srows = await s.$$eval('.th-wrap .th-card', cs => cs.map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  check(!(await s.isVisible('.lt-sheet')) && /Complete a full moon/.test(srows[2]) && !/gift/.test(srows.join(' ')), 'Sara: no letter, and the Blood moon still asks for a full moon');
  await c2.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
