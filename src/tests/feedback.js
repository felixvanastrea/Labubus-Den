// Feedback: "Report a mistake" on every question and "Ask the Labubu" on the homepage, footer and update log.
// The links open the Google Form in feedback.json pre-filled (stubbed here) and the question is copied.
// Without a form the buttons are hidden. Also checks the confirmed R244 fix (corrections.json).
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
const fb = require(path.join(__dirname, '..', 'feedback.json'));
const pre = new globalThis.URL(fb.prefilled);
const FORM = pre.origin + pre.pathname;
const [KIND] = [...pre.searchParams].find(([k, v]) => k.startsWith('entry.') && v === fb.kinds.mistake);
const [ASKED] = [...pre.searchParams].find(([k, v]) => k.startsWith('entry.') && v === 'x');
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const sid = s => `JSON.parse(document.getElementById('bank').textContent).questions.find(q => q.sid === '${s}').id`;

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  };
  const stubForm = ctx => ctx.route('https://docs.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>form</title>stub' }));
  const fresh = async p => {
    await p.clock.install({ time: new Date(2026, 9, 2, 10, 0) });
    await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear());
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  };
  // the quest's acute bronchitis topic, on the question whose stem was fixed
  const openQuestion = async (p, s, tap) => {
    await p.evaluate(() => document.getElementById('quest').scrollIntoView());
    await p[tap ? 'tap' : 'click']('.q-topic[data-qtopic="0"]'); await p.waitForTimeout(250);
    const i = await p.evaluate(`JSON.parse(localStorage.getItem('${KEY}')).session.qids.indexOf(${sid(s)})`);
    check(i >= 0, s + ' is in the acute bronchitis topic of the quest');
    await p[tap ? 'tap' : 'click'](`.strip [data-jump="${i}"]`); await p.waitForTimeout(250);
  };

  // 1. with the form
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new globalThis.URL(URL).origin });
  await stubForm(ctx);
  const p = await ctx.newPage(); watch(p, 'desk');
  await fresh(p);
  const ask = await p.$eval('.intro .ask a', a => ({ text: a.textContent.trim(), href: a.href, target: a.target }));
  const askU = new globalThis.URL(ask.href);
  check(ask.text === 'Ask the Labubu' && ask.target === '_blank', 'homepage button: ' + ask.text);
  check(askU.origin + askU.pathname === FORM && askU.searchParams.get(KIND) === fb.kinds.idea && !askU.searchParams.has(ASKED), 'it ticks “' + fb.kinds.idea + '”: ' + ask.href);
  check(await p.$$eval('.foot [data-ask]', els => els.length) === 1, 'footer has Ask the Labubu');
  const [popA] = await Promise.all([p.waitForEvent('popup'), p.click('.intro .ask a')]);
  check(popA.url() === ask.href, 'it opens the form in a new tab'); await popA.close();
  await p.evaluate(() => document.querySelector('.intro').scrollIntoView()); await p.waitForTimeout(150);
  await p.screenshot({ path: OUT + 'fb_home_intro.png', clip: { x: 0, y: 0, width: 1280, height: 520 } });

  await openQuestion(p, 'R244');
  check((await p.textContent('#stem')).trim() === 'During acute bronchitis:', 'R244 stem reads “During acute bronchitis:”');
  const note = await p.textContent('.fixnote');
  check(/the doc says “During Acute Bronchiectasis”/.test(note), 'R244 shows the typo note');
  const rep = await p.$eval('.report', a => ({ text: a.textContent.trim(), href: a.href, target: a.target }));
  const u = new globalThis.URL(rep.href);
  const filled = u.searchParams.get(ASKED) || '';
  console.log('---- pre-filled question ----\n' + filled + '\n-----------------------------');
  check(rep.text === 'Report a mistake' && rep.target === '_blank', 'report link on the question');
  check(u.origin + u.pathname === FORM && u.searchParams.get('usp') === 'pp_url' && u.searchParams.get(KIND) === fb.kinds.mistake, 'it ticks “' + fb.kinds.mistake + '”');
  check(filled.startsWith('[R244 · Collected questions, Q33 · Respiratory System Diseases] \n'), 'first line names R244, its set and number');
  check(filled.includes(' \nDuring acute bronchitis: \nA. ') && filled.endsWith(' \nProposed answer: B, C'), 'stem, options and the answer shown are in it');
  check(filled.replace(/\n/g, '').includes('Diseases] During acute bronchitis: A. Chest X-ray'), 'still reads apart in a one-line box');
  check(rep.href.length < 3000, 'link length ' + rep.href.length);
  const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('.report')]);
  check(pop.url() === rep.href, 'the form opens in a new tab'); await pop.close();
  check(await p.evaluate(() => navigator.clipboard.readText()) === filled, 'the same text is copied');
  await p.waitForTimeout(100);
  check(/Question copied/.test(await p.textContent('#toast')) && await p.$eval('#toast', el => el.classList.contains('on')), 'toast: ' + await p.textContent('#toast'));
  await p.screenshot({ path: OUT + 'fb_r244.png', fullPage: true });
  await p.focus('.report');
  const [pop2] = await Promise.all([p.waitForEvent('popup'), p.keyboard.press('Enter')]);
  await pop2.close();
  check(await p.$$eval('.verdict', els => els.length) === 0, 'Enter on the link follows it and does not check the question');
  // a question with a long case: the case goes in the report, cut at 400 characters
  const caseQ = await p.evaluate(() => {
    const bank = JSON.parse(document.getElementById('bank').textContent);
    const plain = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.replace(/\s+/g, ' ').trim(); };
    const q = bank.questions.find(x => x.case && plain((bank.cases.find(c => c.id === x.case) || { html: '' }).html).length > 400);
    return q ? { sid: q.sid, topic: q.topic } : null;
  });
  check(!!caseQ, 'found a question with a long case: ' + (caseQ && caseQ.sid));
  if (caseQ) {
    await p.click('.bar [data-act="back"]'); await p.waitForTimeout(250);
    await p.click(`.arch[data-topic="${caseQ.topic}"]`); await p.waitForTimeout(250);
    await p.click(`[data-start="${caseQ.topic}"]`); await p.waitForTimeout(250);
    const ci = await p.evaluate(`JSON.parse(localStorage.getItem('${KEY}')).session.qids.indexOf(${sid(caseQ.sid)})`);
    await p.click(`.strip [data-jump="${ci}"]`); await p.waitForTimeout(200);
    const t = new globalThis.URL(await p.$eval('.report', a => a.href)).searchParams.get(ASKED);
    const caseLine = t.split(' \n')[1] || '';
    check(caseLine.startsWith('Case: ') && caseLine.endsWith('…') && caseLine.length <= 'Case: '.length + 400, 'the case is in the report, cut at 400 characters');
  }
  for (let n = 0; n < 3 && await p.evaluate(() => document.body.dataset.view) !== 'home'; n++) {
    await p.click('.bar [data-act="back"], .bar [data-act="home"]'); await p.waitForTimeout(250);
  }
  await p.click('.navlinks [data-act="updates"]'); await p.waitForTimeout(300);
  check(await p.$$eval('.page-head [data-ask]', els => els.map(e => e.textContent.trim()).join()) === 'Ask the Labubu for a feature', 'update log has Ask the Labubu for a feature');
  await p.screenshot({ path: OUT + 'fb_log.png', clip: { x: 0, y: 0, width: 1280, height: 520 } });
  await ctx.close();

  // 2. without a form: no buttons, the fix still shows
  const ctx0 = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx0.route('**/index.html', async route => {
    const res = await route.fetch(); const html = await res.text();
    const m = html.match(/(<script type="application\/json" id="bank">)([\s\S]*?)(<\/script>)/);
    const bank = JSON.parse(m[2].replace(/<\\\//g, '</')); delete bank.feedback;
    const body = html.replace(m[0], m[1] + JSON.stringify(bank).replace(/<\//g, '<\\/') + m[3]);
    await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-length': String(Buffer.byteLength(body)) } });
  });
  const p0 = await ctx0.newPage(); watch(p0, 'no form');
  await fresh(p0);
  check(await p0.$$eval('[data-ask], .report, .intro .ask', els => els.length) === 0, 'no feedback buttons without a form');
  await openQuestion(p0, 'R244');
  check(await p0.$$eval('.report', els => els.length) === 0 && await p0.$$eval('.fixnote', els => els.length) === 1, 'no report link, fix note still there');
  await p0.click('.strip [data-jump="0"]'); await p0.waitForTimeout(150);
  const firstIsR244 = await p0.evaluate(`JSON.parse(localStorage.getItem('${KEY}')).session.qids[0] === ${sid('R244')}`);
  check(firstIsR244 || await p0.$$eval('.fixnote', els => els.length) === 0, 'questions without a fix have no note');
  await ctx0.close();

  // 3. phone
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await stubForm(mctx);
  const m = await mctx.newPage(); watch(m, 'phone');
  await fresh(m);
  await m.evaluate(() => document.querySelector('.intro').scrollIntoView()); await m.waitForTimeout(150);
  await m.screenshot({ path: OUT + 'fb_m_intro.png' });
  await openQuestion(m, 'R244', true);
  await m.screenshot({ path: OUT + 'fb_m_r244.png', fullPage: true });
  console.log('phone overflow:', await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await mctx.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
