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

  // Nada, "étoile filante" on the Den: just a gift, no message, the Golden phase to wear
  const c6 = await as(b, { uid: 'u4', name: 'étoile filante', key: 'etoilefilante' });
  const ns = await c6.newPage(); ns.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await ns.goto(URL, { waitUntil: 'load' }); await ns.waitForTimeout(1500);
  check(await ns.isVisible('.lt-sheet') && /^A gift for you$/.test(await txt(ns, '#lt-h')) && /^A gift from the Labubu/.test(await txt(ns, '.lt .eyebrow')) && !(await ns.$('.lt-p')) && !(await ns.$('.lt-sign')) && !!(await ns.$('[data-letter="wear"][data-id="klimt"]')),
    'étoile filante (Nada): just a gift, the Golden phase to wear');
  await ns.screenshot({ path: OUT + 'gift_nada.png' });
  await ns.click('[data-letter="wear"]'); await ns.waitForTimeout(600);
  check(await ns.evaluate(() => document.documentElement.dataset.look) === 'klimt', 'she wears it');
  await c6.close();

  // Labubu's handler: the Birth of Venus first (a theme only ever given), then every other theme, one letter per visit
  const c7 = await as(b, { uid: 'u8', name: 'Labubu’s handler', key: 'labubushandler' });
  const hd = await c7.newPage(); hd.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await hd.goto(URL, { waitUntil: 'load' }); await hd.waitForTimeout(1500);
  check(await hd.isVisible('.lt-sheet') && /^A gift for you$/.test(await txt(hd, '#lt-h')) && /Birth of Venus.*Blood moon.*Codex.*Golden phase/.test(await txt(hd, '.lt')) && !!(await hd.$('[data-letter="wear"][data-id="venus"]')),
    'Labubu’s handler: one gift, the Birth of Venus first and every other theme, Venus to wear');
  await hd.screenshot({ path: OUT + 'gift_venus.png' });
  await hd.click('[data-letter="wear"]'); await hd.waitForTimeout(1500);
  check(!(await hd.isVisible('.lt-sheet')), 'no other letter follows');
  const vn = await hd.evaluate(() => { const e = document.querySelector('.vn-bg'), cs = getComputedStyle(e); return { look: document.documentElement.dataset.look, d: cs.display, img: cs.backgroundImage, h: getComputedStyle(document.querySelector('.h2, .h1')).fontFamily, swans: document.querySelectorAll('.vn-sea .vn-swan').length, roses: !!document.querySelector('.vn-roses') }; });
  check(vn.look === 'venus' && vn.d === 'block' && /venus\.webp/.test(vn.img) && /Special Elite/.test(vn.h) && vn.swans === 5 && vn.roses, 'wearing it: the painting behind the page, the typewriter face, five swans on the sea, roses ' + JSON.stringify(vn));
  await hd.evaluate(() => document.querySelector('.vn-sea').scrollIntoView({ block: 'center' })); await hd.waitForTimeout(200);
  await hd.click('.vn-lane:nth-of-type(4) .vn-swan', { force: true }); await hd.waitForTimeout(100);
  check(await hd.evaluate(() => !!document.querySelector('.vn-swan.ruffle')), 'tap a swan: it ruffles');
  await hd.evaluate(() => document.querySelector('.th-wrap').scrollIntoView({ block: 'center' })); await hd.waitForTimeout(300);
  const hrows = await hd.$$eval('.th-wrap .th-card', cs => cs.map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  check(hrows.some(r => /Birth of Venus.*A gift from the Labubu.*Wearing/.test(r)), 'Themes: the Birth of Venus is theirs, worn');
  check(['Blood moon', 'Codex', 'Golden phase'].every(n => hrows.some(r => new RegExp(n + '.*A gift from the Labubu').test(r))), 'every other theme is theirs too, a gift');
  await hd.reload({ waitUntil: 'load' }); await hd.waitForTimeout(1500);
  check(!(await hd.isVisible('.lt-sheet')) && await hd.evaluate(() => document.documentElement.dataset.look) === 'venus', 'next visit: no letter, still the Birth of Venus');
  await c7.close();

  // anyone else: no letter, no Blood moon, and no Birth of Venus at all, even saved on the device
  const c2 = await as(b, { uid: 'u6', name: 'Sara', key: 'sara' });
  await c2.addInitScript(() => { if (location.protocol !== 'about:') localStorage.setItem('efm3-look', 'venus'); });
  const s = await c2.newPage(); s.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await s.goto(URL, { waitUntil: 'load' }); await s.waitForTimeout(1500);
  const srows = await s.$$eval('.th-wrap .th-card', cs => cs.map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  check(!(await s.isVisible('.lt-sheet')) && /Complete a full moon/.test(srows[2]) && !/gift/.test(srows.join(' ')), 'Sara: no letter, and the Blood moon still asks for a full moon');
  check(!/Birth of Venus/.test(srows.join(' ')) && srows.length === 4 && await s.evaluate(() => !document.documentElement.dataset.look), 'Sara: the Birth of Venus isn’t listed, and isn’t worn even saved on her device');
  await c2.close();

  // El Psy Kongroo in the search: every theme for good, the Birth of Venus too, kept on the account
  const c9 = await as(b, { uid: 'u3', name: 'Okabe', key: 'okabe' });
  const ok = await c9.newPage(); ok.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await ok.goto(URL, { waitUntil: 'load' }); await ok.waitForTimeout(1500);
  await ok.fill('#q', 'el psy'); await ok.type('#q', ' Kongroo'); await ok.waitForTimeout(400);
  const t9 = await ok.evaluate(() => ({ toast: (document.querySelector('.toast') || {}).textContent || '', q: document.getElementById('q') ? document.getElementById('q').value : '?' }));
  check(/El Psy Kongroo\. Every theme is yours now/.test(t9.toast) && t9.q === '', 'El Psy Kongroo: every theme unlocked, the search cleared ' + JSON.stringify(t9));
  await ok.evaluate(() => document.querySelector('.th-wrap').scrollIntoView({ block: 'center' })); await ok.waitForTimeout(300);
  const orows = await ok.$$eval('.th-wrap .th-card', cs => cs.map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  check(orows.length === 6 && orows.slice(1).every(r => /Wear it/.test(r)) && /Birth of Venus/.test(orows[4]) && /Water lilies/.test(orows[5]), 'Themes: all six to wear');
  await ok.click('.th-wrap [data-theme="codex"]'); await ok.waitForTimeout(400);
  await ok.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await ok.waitForTimeout(400);
  check(await ok.evaluate(() => document.documentElement.dataset.look) === 'codex' && await ok.evaluate(() => /"unlocks"/.test(window.__fb.docs['users/u3'].s || '')), 'wears the Codex, and the unlock is on the account');
  await ok.reload({ waitUntil: 'load' }); await ok.waitForTimeout(1200);
  check(await ok.evaluate(() => document.documentElement.dataset.look) === 'codex', 'still hers after a reload');
  await c9.close();

  // the Labubu has every theme, the Birth of Venus too
  const c8 = await as(b, { uid: 'u9', name: 'Labubu', key: 'labubu' });
  const lb = await c8.newPage(); lb.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await lb.goto(URL, { waitUntil: 'load' }); await lb.waitForTimeout(1200);
  const lrows = await lb.$$eval('.th-wrap .th-card', cs => cs.map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  // RedaReda in the search: the Venus painting becomes Reda's photo, on this device; again, and it's back
  await lb.click('.th-wrap [data-theme="venus"]'); await lb.waitForTimeout(500);
  await lb.evaluate(() => window.scrollTo(0, 0));
  await lb.fill('#q', 'RedaRed'); await lb.type('#q', 'a'); await lb.waitForTimeout(300);
  const rd = await lb.evaluate(() => ({ img: getComputedStyle(document.querySelector('.vn-bg')).backgroundImage, t: (document.querySelector('.toast') || {}).textContent || '', q: document.getElementById('q').value, ls: localStorage.getItem('efm3-reda') }));
  check(/reda\.webp/.test(rd.img) && /painting has changed/.test(rd.t) && rd.q === '' && rd.ls === '1', 'RedaReda: the painting becomes the photo ' + JSON.stringify(rd));
  await lb.evaluate(() => window.scrollTo(0, 0)); await lb.waitForTimeout(1200);
  await lb.screenshot({ path: OUT + 'gift_reda.png' });
  await lb.fill('#q', 'redareda'); await lb.waitForTimeout(300);
  check(await lb.evaluate(() => /venus\.webp/.test(getComputedStyle(document.querySelector('.vn-bg')).backgroundImage) && !localStorage.getItem('efm3-reda')), 'typed again: the painting is back');
  check(lrows.length === 6 && /Birth of Venus.*Wear it/.test(lrows[4]) && /Water lilies.*Wear it/.test(lrows[5]), 'the Labubu: the Birth of Venus and Water lilies listed, to wear');
  await c8.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
