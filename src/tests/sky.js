// The class sky, live on a canvas (against account.js's fake Firebase): today's stars appear one by one the first time
// it's on screen; dragging pans it (and it glides back inside its edges); hovering a star, or a name under the sky, says
// who it is; a classmate reaching 10 questions rises live from behind the hills; tapping a star pins it with "Send a
// spark", which writes sparks/{d}_{to}_{from} under your name and flies a spark across; a spark sent to you flies in,
// toasts once and says so under the sky; without the rules for sparks, no button; reduced motion draws it still;
// phones get the tall layout; a guest sees the North Star and a sign in. Screenshots: shots/sky_*.png.
const { chromium, devices } = require('playwright');
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
const sky = p => p.evaluate(() => window.__classSky());
const errors = [];

async function open(b, opts, who, extra = {}) {
  const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts));
  const [day, today] = await (async () => { const pg = await ctx.newPage(); await pg.goto('about:blank'); const r = await pg.evaluate(() => { const d = new Date(); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return ['d' + k, k]; }); await pg.close(); return r; })();
  const names = ['Salma', 'Yassine', 'Omar', 'Hiba', 'Ilyas', 'Nour', 'Adam', 'Sara', 'Rim', 'Zeineb', 'Amro'];
  const skyDoc = Object.fromEntries(names.map((nm, i) => ['u' + (i === 8 ? 2 : i + 30), { nm, c: [30, 10, 50, 20, 10, 100, 10, 20, 20, 75, 150][i], t: 1000 + i }]));
  skyDoc.u9 = { nm: 'Labubu', c: 40, t: 500 };
  const seed = Object.assign({
    'users/u2': { s: JSON.stringify({ days: { [today]: 20 } }), name: 'Rim', key: 'rim' }, 'names/rim': { uid: 'u2', name: 'Rim' },
    'users/u9': { s: '{}', name: 'Labubu', key: 'labubu' }, 'names/labubu': { uid: 'u9', name: 'Labubu' },
    ['sky/' + day]: skyDoc
  }, extra.docs || {});
  await ctx.addInitScript(([seed, who, K, today, deny]) => {
    if (location.protocol === 'about:') return;
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1'); localStorage.clear();
      if (who) { localStorage.setItem('fake-user', JSON.stringify(who)); localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', who.displayName); }
      localStorage.setItem('fake-docs', JSON.stringify(seed)); localStorage.setItem(K, JSON.stringify({ days: { [today]: 20 } }));
      if (deny) localStorage.setItem('fake-deny-sparks', '1');
    }
    window.__acctTest = true;
    window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
  }, [seed, who, KEY, today, !!extra.deny]);
  await ctx.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[req.url().match(/firebase-(\w+)\.js$/)[1]] });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push((opts.tag || 'page') + ' pageerror: ' + e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(900);
  return { ctx, p, day };
}
const RIM = { uid: 'u2', displayName: 'Rim', email: 'rim@example.com' };
const toSky = async p => { await p.evaluate(() => document.getElementById('class-sky').scrollIntoView({ block: 'center' })); };
const box = p => p.evaluate(() => { const r = document.querySelector('#class-sky .sky-cv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });

(async () => {
  const b = await chromium.launch();

  // 1. a desktop, with motion
  let { ctx, p, day } = await open(b, { tag: 'desk' }, RIM);
  await toSky(p); await p.waitForTimeout(300);
  let s = await sky(p);
  check(s.mode === 'live' && s.layout === 'w', 'the sky is live, the wide layout');
  const early = s.stars.filter(x => x.uid !== 'labubu').length;
  await p.waitForTimeout(2600);
  s = await sky(p);
  const cls = s.stars.filter(x => x.uid !== 'labubu');
  check(early < 11 && cls.length === 11, `the first time on screen, the stars appear one by one (${early} → ${cls.length})`);
  check(s.stars.some(x => x.uid === 'labubu') && s.full.includes('the Little Bear') && s.lines === 7 && s.dashed > 0 && s.ghosts > 0, `the North Star, the Little Bear complete (${s.full}), the Great Bear forming (${s.dashed} dashed, ${s.ghosts} empty places)`);
  check(/11 of you did 10 questions or more today\. The Little Bear is complete\. 2 more stars and the Great Bear is complete\./.test(await txt(p, '#class-sky .sky-sub')), 'the line: ' + await txt(p, '#class-sky .sky-sub'));
  check(/Drag the sky to look around · tap a star to send a spark/.test(await txt(p, '#class-sky .sky-hint')), 'the hint: ' + await txt(p, '#class-sky .sky-hint'));
  await (await p.$('#class-sky')).screenshot({ path: OUT + 'sky_desk.png' });
  // hovering a star says who it is
  let bx = await box(p);
  const salma = s.stars.find(x => x.nm === 'Salma');
  await p.mouse.move(bx.x + salma.x, bx.y + salma.y); await p.waitForTimeout(250);
  check(/^Salma · 30\+ questions today · in the Little Bear/.test(await txt(p, '#class-sky .sky-tip')) && (await sky(p)).hover === salma.uid, 'hovering a star: ' + await txt(p, '#class-sky .sky-tip'));
  // a name under the sky lights its star
  await p.mouse.move(5, 5);
  await p.hover('#class-sky .sky-nm:has-text("Amro")'); await p.waitForTimeout(200);
  check(/^Amro · 150\+ questions today/.test(await txt(p, '#class-sky .sky-tip')) && (await sky(p)).hover === 'u40', 'hovering a name lights its star: ' + await txt(p, '#class-sky .sky-tip'));
  // dragging pans it, and it glides back inside its edges
  await toSky(p); await p.waitForTimeout(200); bx = await box(p);
  const before = (await sky(p)).stars.find(x => x.nm === 'Salma');
  await p.mouse.move(bx.x + bx.w * .5, bx.y + bx.h * .5); await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(bx.x + bx.w * .5 - i * 26, bx.y + bx.h * .5 + i * 6); await p.waitForTimeout(16); }
  let mid = await sky(p);
  await p.mouse.up();
  const moved = mid.stars.find(x => x.nm === 'Salma');
  check(mid.cam.x < -150 && moved.x < before.x - 150, `dragging moves the sky (camera ${mid.cam.x.toFixed(0)}, Salma ${before.x.toFixed(0)} → ${moved.x.toFixed(0)})`);
  check(await p.evaluate(() => document.querySelector('#class-sky .sky-hint').classList.contains('gone')), 'the hint goes once you drag');
  await p.mouse.move(bx.x + bx.w * .5, bx.y + bx.h * .5); await p.mouse.down();
  for (let i = 1; i <= 16; i++) { await p.mouse.move(bx.x + bx.w * .5 - i * 60, bx.y + bx.h * .5); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(1500);
  const settled = await sky(p);
  check(settled.cam.x >= -281 && settled.cam.x <= -270, `past the edge, it glides back inside (${settled.cam.x.toFixed(0)})`);
  await (await p.$('#class-sky')).screenshot({ path: OUT + 'sky_dragged.png' });
  // live: Lina reaches 10 questions and rises from behind the hills
  await p.evaluate(([d]) => window.__fb.remote('sky/' + d, { u50: { nm: 'Lina', c: 10, t: Date.now() } }), [day]); await p.waitForTimeout(1100);
  s = await sky(p);
  check(s.fx.includes('rise') && !s.stars.some(x => x.nm === 'Lina'), 'live: a newcomer rises (on the way)');
  await (await p.$('#class-sky')).screenshot({ path: OUT + 'sky_rising.png' });
  await p.waitForTimeout(1400);
  s = await sky(p);
  check(s.stars.some(x => x.nm === 'Lina' && x.ci === 1) && s.fx.includes('label') && s.fx.includes('burst'), 'and lands in the Great Bear, with a burst and her name');
  check(/12 of you/.test(await txt(p, '#class-sky .sky-sub')) && /Lina/.test(await txt(p, '#class-sky .sky-names')), 'the line and the names follow');
  await (await p.$('#class-sky')).screenshot({ path: OUT + 'sky_landed.png' });
  // a spark: tap Salma, send one
  await p.waitForTimeout(400); bx = await box(p); s = await sky(p);
  let sal = s.stars.find(x => x.nm === 'Salma');
  await p.mouse.click(bx.x + sal.x, bx.y + sal.y); await p.waitForTimeout(200);
  check(await p.$eval('#class-sky .sky-tip', e => e.classList.contains('pinned')) && !!(await p.$('#class-sky .sky-tip [data-act="sky-spark"]')), 'a click pins the star, with Send a spark');
  await (await p.$('#class-sky')).screenshot({ path: OUT + 'sky_pinned.png' });
  await p.click('#class-sky .sky-tip [data-act="sky-spark"]'); await p.waitForTimeout(500);
  let D = await docs(p), sp = D[`sparks/${day}_u30_u2`];
  check(sp && sp.from === 'u2' && sp.to === 'u30' && sp.nm === 'Rim' && sp.k === 'rim' && sp.d === day, 'the spark is written under my name: ' + JSON.stringify(sp));
  check(/Spark sent/.test(await txt(p, '#class-sky .sky-tip')) && !(await p.$('#class-sky .sky-tip [data-act="sky-spark"]')) && (await sky(p)).fx.includes('spark'), 'it flies; the tooltip says Spark sent');
  await (await p.$('#class-sky')).screenshot({ path: OUT + 'sky_spark.png' });
  await p.waitForTimeout(1400);
  check(/· 1 spark/.test(await txt(p, '#class-sky .sky-tip')), 'Salma has 1 spark tonight: ' + await txt(p, '#class-sky .sky-tip'));
  // a click elsewhere lets go
  await p.mouse.click(5, 5); await p.waitForTimeout(150);
  check(await p.$eval('#class-sky .sky-tip', e => e.hidden), 'a click elsewhere lets go of it');
  // a spark for me: it flies in, a toast once, a line under the sky
  await toSky(p);
  await p.evaluate(([d]) => window.__fb.remote(`sparks/${d}_u2_u40`, { d, to: 'u2', from: 'u40', nm: 'Amro', k: 'amro', t: Date.now() }), [day]); await p.waitForTimeout(500);
  check((await sky(p)).fx.includes('spark') && /Amro sent you a spark/.test(await txt(p, '.toast')), 'a spark for me flies in, and a toast: ' + await txt(p, '.toast'));
  check(/Amro sent you a spark tonight\./.test(await txt(p, '#class-sky .sky-mine')), 'and a line under the sky: ' + await txt(p, '#class-sky .sky-mine'));
  await p.waitForTimeout(1300);
  await (await p.$('#class-sky')).screenshot({ path: OUT + 'sky_got.png' });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(900);
  check(!/sent you a spark/.test(await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')), 'no toast again on the next visit');
  await ctx.close();

  // 2. before the rules for sparks: no button, no promise in the hint
  ({ ctx, p, day } = await open(b, { tag: 'norules' }, RIM, { deny: true }));
  await toSky(p); await p.waitForTimeout(2600);
  bx = await box(p); s = await sky(p); sal = s.stars.find(x => x.nm === 'Salma');
  await p.mouse.click(bx.x + sal.x, bx.y + sal.y); await p.waitForTimeout(200);
  check(!(await p.$('#class-sky .sky-tip [data-act="sky-spark"]')) && /^Salma/.test(await txt(p, '#class-sky .sky-tip')) && !/spark/.test(await txt(p, '#class-sky .sky-hint')), 'sparks refused: no button, the hint only says drag');
  await ctx.close();

  // 3. reduced motion: everyone at once, nothing moving by itself
  ({ ctx, p, day } = await open(b, { tag: 'still', reducedMotion: 'reduce' }, RIM));
  await toSky(p); await p.waitForTimeout(300);
  s = await sky(p);
  check(s.stars.length === 12 && !s.fx.length, 'reduced motion: all 11 stars and the North Star at once, no effects');
  await p.evaluate(([d]) => window.__fb.remote('sky/' + d, { u50: { nm: 'Lina', c: 10, t: Date.now() } }), [day]); await p.waitForTimeout(300);
  s = await sky(p);
  check(s.stars.some(x => x.nm === 'Lina') && !s.fx.length, 'a newcomer is simply there');
  await ctx.close();

  // 4. a phone: the tall layout; a tap pins a star
  ({ ctx, p, day } = await open(b, Object.assign({ tag: 'phone' }, devices['iPhone 13']), RIM));
  await toSky(p); await p.waitForTimeout(2800);
  s = await sky(p);
  check(s.layout === 'n' && s.stars.length === 12 && await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) === 0, 'phone: the tall layout, no sideways scroll');
  check(/Swipe to look around/.test(await txt(p, '#class-sky .sky-hint')), 'phone hint: ' + await txt(p, '#class-sky .sky-hint'));
  bx = await box(p); const om = s.stars.find(x => x.nm === 'Omar');
  await p.touchscreen.tap(bx.x + om.x, bx.y + om.y); await p.waitForTimeout(250);
  check(/^Omar · 50\+ questions today/.test(await txt(p, '#class-sky .sky-tip')) && !!(await p.$('#class-sky .sky-tip [data-act="sky-spark"]')), 'a tap pins the star, with its spark button');
  await (await p.$('#class-sky')).screenshot({ path: OUT + 'sky_phone.png' });
  await ctx.close();

  // 5. a guest: the North Star and a sign in
  ({ ctx, p } = await open(b, { tag: 'guest' }, null));
  await toSky(p); await p.waitForTimeout(800);
  s = await sky(p);
  check(s.mode === 'guest' && s.stars.length === 1 && s.stars[0].uid === 'labubu' && !!(await p.$('#class-sky .sky-in[data-act="account"]')), 'guest: the North Star, and a sign in to join');
  await (await p.$('#class-sky')).screenshot({ path: OUT + 'sky_guest.png' });
  await ctx.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
