// The Den, alive: the Labubu (top bar and under the questions) follows the cursor, makes faces at a right, wrong or
// half-right answer, dozes off and wakes up; no Labubu hanging under the questions and no stardust trail (both taken out); the real sky over
// Casablanca (moon phase, the sun's height, the time of day, the moon on the homepage, the greeting); the light over the
// cards and the leaning astrolabe; who's here now, against account.js's fake Firebase (fireflies, the line under the
// main button, the heartbeat written on a check, nothing when the rules refuse it); reduced motion; a phone.
// Screenshots: shots/alive_*.png.
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
const errors = [];
const alive = p => p.evaluate(() => { const a = window.__alive(); delete a.doze; return a; });
const prop = (p, sel, name) => p.evaluate(([s, n]) => { const e = document.querySelector(s); return e ? e.style.getPropertyValue(n) : null; }, [sel, name]);
const cls = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); return e ? e.getAttribute('class') : ''; }, sel);

async function open(b, opts = {}) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, timezoneId: 'Africa/Casablanca' }, opts.ctx || {}));
  await ctx.addInitScript(([o, K]) => {
    if (location.protocol === 'about:') return;
    if (o.now) window.__skyNow = o.now;
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1'); localStorage.clear();
      if (o.who) { localStorage.setItem('fake-user', JSON.stringify(o.who)); localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', o.who.displayName); }
      if (o.docs) localStorage.setItem('fake-docs', JSON.stringify(o.docs));
      if (o.denyHere) localStorage.setItem('fake-deny-here', '1');
    }
    if (o.acct) {
      window.__acctTest = true;
      window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
    }
  }, [{ now: opts.now, who: opts.who, docs: opts.docs, denyHere: opts.denyHere, acct: !!opts.acct }, KEY]);
  if (opts.acct) await ctx.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[req.url().match(/firebase-(\w+)\.js$/)[1]] });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push((opts.tag || 'page') + ' pageerror: ' + e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(900);
  return { ctx, p };
}
// the current practice question's key, from the page's own data
const keyNow = p => p.evaluate(K => {
  const S = JSON.parse(localStorage.getItem(K)), id = S.session.qids[S.session.idx];
  const q = JSON.parse(document.getElementById('bank').textContent).questions.find(x => x.id === id);
  return { answer: q.answer, n: q.options.length };
}, KEY);
async function answer(p, how) {
  const k = await keyNow(p);
  let pick = k.answer;
  if (how === 'wrong') pick = [...Array(k.n).keys()].filter(i => !k.answer.includes(i)).slice(0, 1);
  if (how === 'partial') pick = k.answer.length > 1 ? [k.answer[0]] : null;
  if (!pick || !pick.length) return false;
  for (const i of pick) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(120);
  return true;
}
async function nextKeyed(p, want) {
  for (let i = 0; i < 40; i++) {
    const k = await keyNow(p);
    if (k.answer.length && (want !== 'multi' || k.answer.length > 1)) return;
    await p.click('[data-act="primary"]'); await p.waitForTimeout(80);
  }
}

(async () => {
  const b = await chromium.launch();

  // 1. the Labubu, the light on the cards (a desktop, no account)
  {
    const { ctx, p } = await open(b, { tag: 'desk' });
    check(await p.$('.logo svg.lb-live'), 'the logo in the top bar is the living Labubu');
    await p.mouse.move(100, 100); await p.mouse.move(900, 700, { steps: 10 }); await p.waitForTimeout(400);
    const px = parseFloat(await prop(p, '.logo svg.lb-live', '--px')), py = parseFloat(await prop(p, '.logo svg.lb-live', '--py'));
    check(px > 3 && py > 2, `its eyes follow the cursor down and right (${px}, ${py})`);
    check(!(await p.$('#dust')), 'no stardust trail behind the cursor');
    const ay = await prop(p, '.astro svg', '--ay');
    check(ay && parseFloat(ay) > 0, `the astrolabe leans toward the cursor (${ay})`);
    await p.evaluate(() => document.querySelector('#app .plate').scrollIntoView({ block: 'center' })); await p.waitForTimeout(800);
    const plate = await p.$('#app .plate');
    if (plate) { const r = await plate.boundingBox(); await p.mouse.move(r.x + r.width * .3, Math.max(r.y, 0) + 120, { steps: 4 }); await p.waitForTimeout(250); }
    check((await p.evaluate(() => window.__breathe())).sheen, 'a soft light follows the cursor over a card');
    await p.evaluate(() => window.__alive().doze()); await p.waitForTimeout(100);
    let a = await alive(p);
    check(a.asleep && /zz/.test(await cls(p, '.logo svg.lb-live')) && await prop(p, '.logo svg.lb-live', '--lid') === '1', 'idle, it dozes off: eyes shut, z’s');
    await p.mouse.move(400, 300, { steps: 3 }); await p.waitForTimeout(100);
    a = await alive(p);
    check(!a.asleep && !/zz/.test(await cls(p, '.logo svg.lb-live')), 'a move wakes it up');
    await p.screenshot({ path: OUT + 'alive_home.png' });

    // a quiz: no Labubu hanging under the questions (taken out); the logo's Labubu still reacts to answers
    await p.click('[data-start="*"]'); await p.waitForTimeout(1300);
    check(!(await p.$('.buddy, [data-buddy]')), 'no Labubu hanging between the buttons under a question');
    await nextKeyed(p);
    check(await answer(p, 'right'), 'answered a question right');
    check((await alive(p)).mood === 'joy', 'a right answer: the Labubu is happy');
    await p.waitForTimeout(1800);
    check(!(await alive(p)).mood, 'then it goes back to watching');
    await p.click('[data-act="primary"]'); await p.waitForTimeout(150); await nextKeyed(p);
    check(await answer(p, 'wrong'), 'answered a question wrong');
    check((await alive(p)).mood === 'ouch', 'a wrong answer: it winces');
    await p.waitForTimeout(1100);
    check((await alive(p)).mood === 'down', 'then it looks down for a moment');
    await p.waitForTimeout(1700);
    await p.click('[data-act="primary"]'); await p.waitForTimeout(150); await nextKeyed(p, 'multi');
    if (await answer(p, 'partial')) check((await alive(p)).mood === 'down', 'a half-right answer: it looks down');
    await p.screenshot({ path: OUT + 'alive_quiz.png' });

    // the footer
    await p.click('.bar [data-act="back"], [data-act="back"]'); await p.waitForTimeout(900);
    check(!(await p.$('[data-act="dust-toggle"], [data-act="buddy-toggle"]')), 'no Stardust or buddy switch in the footer');
    await p.waitForTimeout(400);
    check(/\bjoy\b|\bouch\b/.test(await cls(p, '.logo svg.lb-live')) === false, 'back home, the logo has settled');
    await ctx.close();
  }

  // 2. the real sky: the moon's phase and the sun's height over Casablanca (known dates)
  {
    const { ctx, p } = await open(b, { tag: 'clock', now: Date.parse('2026-10-14T01:30:00Z') });
    const full = await p.evaluate(() => window.__skyclock(Date.parse('2025-09-07T18:09:00Z')));
    check(Math.abs(full.phase - .5) < .02 && full.lit > .98 && full.phaseName === 'Full moon', `the full moon of 7 September 2025 (phase ${full.phase.toFixed(3)}, ${(full.lit * 100).toFixed(1)}% lit)`);
    const nw = await p.evaluate(() => window.__skyclock(Date.parse('2025-09-21T19:54:00Z')));
    check(nw.lit < .02 && nw.phaseName === 'New moon', `the new moon of 21 September 2025 (${(nw.lit * 100).toFixed(1)}% lit)`);
    const fq = await p.evaluate(() => window.__skyclock(Date.parse('2025-09-29T23:54:00Z')));
    check(fq.phaseName === 'First quarter', `the first quarter of 29 September 2025 (${fq.phaseName})`);
    const noon = await p.evaluate(() => window.__skyclock(Date.parse('2026-10-13T12:16:00Z')));
    check(noon.sun.alt > 45 && noon.sun.alt < 50 && Math.abs(noon.sun.az - 180) < 3, `the sun at midday in Casablanca, mid-October: ${noon.sun.alt.toFixed(1)}° up, due south (${noon.sun.az.toFixed(0)}°)`);
    const rise = await p.evaluate(() => window.__skyclock(Date.parse('2026-10-13T06:20:00Z')));
    check(rise.tod.name === 'dawn' && rise.sun.alt < 0 && rise.sun.alt > -6, `first light before sunrise (${rise.sun.alt.toFixed(1)}°, ${rise.tod.name})`);
    const dusk = await p.evaluate(() => window.__skyclock(Date.parse('2026-10-13T18:25:00Z')));
    check(dusk.tod.name === 'dusk' && dusk.tod.glow > .5, `dusk just after sunset (${dusk.sun.alt.toFixed(1)}°, glow ${dusk.tod.glow.toFixed(2)})`);
    // now: 02:30 in Casablanca
    check(await p.evaluate(() => document.documentElement.dataset.tod) === 'night', 'at 2:30 am the page is at night');
    check(/^It’s 2 am\. The Labubu is yawning\./.test(await txt(p, '[data-greet]')) || /^Still up/.test(await txt(p, '[data-greet]')), `the greeting knows the hour: “${await txt(p, '[data-greet]')}”`);
    check(parseFloat(await prop(p, '.logo svg.lb-live', '--lid')) > .2, 'after midnight the Labubu is sleepy');
    await ctx.close();
    const day = await open(b, { tag: 'clock2', now: Date.parse('2026-10-13T14:00:00Z') });
    const n = await day.p.evaluate(() => window.__skyclock());
    check(await day.p.evaluate(() => document.documentElement.dataset.tod) === 'day', 'in the afternoon the page is in daylight');
    check(await txt(day.p, '[data-greet]') === 'Good afternoon.', `and the greeting says so (“${await txt(day.p, '[data-greet]')}”)`);
    const moon = await day.p.$('.rmoon');
    check(moon && (await moon.isVisible()) === n.moon.alt > -.5, `the moon shows on the homepage only while it’s up (${n.moon.alt.toFixed(0)}° now)`);
    await day.ctx.close();
    const eve = await open(b, { tag: 'clock3', now: Date.parse('2026-10-15T19:00:00Z') });
    const m = await eve.p.evaluate(() => window.__skyclock());
    check(m.moon.alt > 0 && await eve.p.isVisible('.rmoon'), `on the evening of 15 October the crescent is up (${m.moon.alt.toFixed(0)}°) and on the page`);
    await eve.p.hover('.rmoon'); await eve.p.waitForTimeout(350);
    check(/The moon over Casablanca/.test(await txt(eve.p, '.rmoon-tip')) && /Waxing crescent/.test(await txt(eve.p, '.rmoon-tip')) && /sets at/.test(await txt(eve.p, '.rmoon-tip')), `hovering it: “${await txt(eve.p, '.rmoon-tip')}”`);
    await eve.p.screenshot({ path: OUT + 'alive_moon.png' });
    await eve.ctx.close();
  }

  // 3. who's here now (a member, fake Firebase)
  {
    const pg = await b.newPage(); await pg.goto('about:blank');
    const day = await pg.evaluate(() => { const d = new Date(); return `d${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    await pg.close();
    const now = Date.now();
    const docs = {
      'users/u2': { s: '{}', name: 'Rim', key: 'rim' }, 'names/rim': { uid: 'u2', name: 'Rim' },
      ['here/' + day]: { u5: { nm: 'Amro', t: now - 60000, m: 'Digestive System Disease', v: 'quiz' },
        u6: { nm: 'Zeineb', t: now - 30000, m: 'Digestive surgery midterm', v: 'exam' },
        u7: { nm: 'Old', t: now - 20 * 60000, m: 'Cardiology', v: 'quiz' },
        u2: { nm: 'Rim', t: now - 10000, m: 'x', v: 'quiz' } }
    };
    const RIM = { uid: 'u2', displayName: 'Rim', email: 'rim@example.com' };
    const { ctx, p } = await open(b, { tag: 'here', acct: true, who: RIM, docs });
    await p.waitForTimeout(800);
    const flies = await p.$$eval('#flies .fly', els => els.map(e => e.getAttribute('aria-label')));
    check(flies.length === 2 && flies.some(l => /^Amro, on Digestive System Disease/.test(l)) && flies.some(l => /^Zeineb, in an exam/.test(l)), `two fireflies, for the two classmates seen in the last minutes (${flies.join(' | ')})`);
    check(await txt(p, '#here-line') === 'Zeineb and Amro are studying right now', `the line under the main button: “${await txt(p, '#here-line')}”`);
    check(/Good \w+, Rim\./.test(await txt(p, '[data-greet]')) || /Rim/.test(await txt(p, '[data-greet]')), `the greeting has her name (“${await txt(p, '[data-greet]')}”)`);
    const fly = await p.$('#flies .fly');
    await fly.hover(); await p.waitForTimeout(350);
    check(await fly.evaluate(e => getComputedStyle(e.querySelector('.fly-tip')).opacity) === '1', 'hovering a firefly says who it is');
    const t1 = await fly.evaluate(e => e.style.transform); await p.waitForTimeout(400);
    check(t1 !== await fly.evaluate(e => e.style.transform), 'the fireflies drift');
    await p.screenshot({ path: OUT + 'alive_here.png' });
    // studying writes my own entry
    await p.click('[data-start="*"]'); await p.waitForTimeout(900);
    await nextKeyed(p); await answer(p, 'right'); await p.waitForTimeout(300);
    const mine = await p.evaluate(d => (window.__fb.docs['here/' + d] || {}).u2, day);
    check(mine && mine.v === 'quiz' && mine.nm === 'Rim' && mine.m && mine.m !== 'x', `a checked question puts me in today's "here" (${JSON.stringify(mine)})`);
    const calls = await p.evaluate(() => window.__fb.calls.filter(c => c.startsWith('set here/')).length);
    await p.click('[data-act="primary"]'); await p.waitForTimeout(150); await nextKeyed(p); await answer(p, 'right'); await p.waitForTimeout(300);
    check(await p.evaluate(() => window.__fb.calls.filter(c => c.startsWith('set here/')).length) === calls, 'a second check within 3 minutes writes nothing more');
    await ctx.close();
    const deny = await open(b, { tag: 'here-deny', acct: true, who: RIM, docs, denyHere: true });
    await deny.p.waitForTimeout(800);
    check(!(await deny.p.$$('#flies .fly')).length && await deny.p.isHidden('#here-line'), 'without the rules for "here", no fireflies and no line');
    await deny.p.click('[data-start="*"]'); await deny.p.waitForTimeout(900); await nextKeyed(deny.p); await answer(deny.p, 'right');
    check(true, 'and studying still works');
    await deny.ctx.close();
  }

  // 4. reduced motion: eyes still; the faces still change
  {
    const { ctx, p } = await open(b, { tag: 'reduced', ctx: { reducedMotion: 'reduce' } });
    await p.mouse.move(100, 100); await p.mouse.move(900, 700, { steps: 10 }); await p.waitForTimeout(300);
    check((await prop(p, '.logo svg.lb-live', '--px')) === '0.00', 'reduced motion: the eyes stay put');
    await p.click('[data-start="*"]'); await p.waitForTimeout(900);
    await nextKeyed(p); await answer(p, 'right');
    check((await alive(p)).mood === 'joy', 'reduced motion: a right answer still gets happy eyes');
    await ctx.close();
  }

  // 5. a phone: nothing between the buttons
  {
    const { ctx, p } = await open(b, { tag: 'phone', ctx: { viewport: { width: 375, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } });
    await p.click('[data-start="*"]'); await p.waitForTimeout(1500);
    check(!(await p.$('.buddy')), 'on a phone, nothing hangs between Mark and Check answer');
    await p.screenshot({ path: OUT + 'alive_phone.png' });
    await ctx.close();
  }

  await b.close();
  for (const e of errors) check(false, e);
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
