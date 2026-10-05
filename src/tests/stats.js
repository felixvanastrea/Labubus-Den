// Anonymous stats (PostHog): nothing outside GitHub Pages; the banner once, on a page without a question; nothing
// loads before a yes; "No thanks" and the footer switch; the events sent (features used, never which options);
// switching off removes PostHog's storage; the phone layout. PostHog's script is replaced by a recorder.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1', PREF = 'efm3-mcq-stats';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
// stands in for https://eu-assets.i.posthog.com/static/array.js: replays the queue and records every call
const FAKE = `(function () {
  var stub = window.posthog, calls = window.__ph = [];
  var api = { __loaded: true,
    init: function (t, c) { calls.push(['init', t, c]); try { localStorage.setItem('ph_' + t + '_posthog', '{"distinct_id":"x"}'); document.cookie = 'ph_' + t + '_posthog=1; path=/'; } catch (e) {} },
    capture: function (n, p) { calls.push(['capture', n, p]); },
    opt_out_capturing: function () { calls.push(['opt_out']); },
    opt_in_capturing: function () { calls.push(['opt_in']); },
    reset: function () { calls.push(['reset']); } };
  (stub._i || []).forEach(function (a) { api.init(a[0], a[1]); });
  for (var i = 0; i < stub.length; i++) { var c = stub[i]; if (api[c[0]]) api[c[0]].apply(api, c.slice(1)); }
  window.posthog = api;
})();`;
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const captured = p => p.evaluate(() => (window.__ph || []).filter(c => c[0] === 'capture').map(c => ({ name: c[1], props: c[2] })));
const names = async p => (await captured(p)).map(c => c.name);

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  };
  const open = async (opts, flag) => {
    const ctx = await b.newContext(Object.assign({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }, opts || {}));
    if (flag) await ctx.addInitScript(() => { window.__statsTest = true; });
    await ctx.route(/posthog\.com/, r => r.abort());   // nothing real goes out
    await ctx.route('https://eu-assets.i.posthog.com/static/array.js', r => r.fulfill({ contentType: 'application/javascript', body: FAKE }));
    const p = await ctx.newPage(); watch(p, (opts && opts.isMobile ? 'phone' : 'desk') + (flag ? '' : ' (no flag)'));
    await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear());
    await p.reload({ waitUntil: 'load' });
    return { ctx, p };
  };

  // anywhere but GitHub Pages (here: the test server, like the claude.ai link): nothing at all
  let { ctx, p } = await open(null, false);
  await p.waitForTimeout(2000);
  check(!(await p.$('#consent')) && !(await txt(p, '.foot')).includes('Anonymous stats') && await p.evaluate(() => window.posthog === undefined), 'off GitHub Pages: no banner, no switch, no PostHog');
  await ctx.close();

  // on the site: the banner once, nothing loaded before an answer
  ({ ctx, p } = await open(null, true));
  await p.waitForTimeout(300);
  check(!(await p.$('#consent')), 'the banner waits a moment after the page opens');
  await p.waitForTimeout(1300);
  check(await txt(p, '.cs-t') === 'Can the Labubu count your visits?' && (await txt(p, '.cs-d')).includes('no names and no answers'), 'then it asks: ' + await txt(p, '.cs-t'));
  check(await p.evaluate(() => window.posthog === undefined), 'nothing is loaded before an answer');
  await p.screenshot({ path: OUT + 'stats_banner.png' });
  await p.click('[data-stats="no"]'); await p.waitForTimeout(500);
  check(!(await p.$('#consent')) && await p.evaluate(k => localStorage.getItem(k), PREF) === 'off' && await p.evaluate(() => window.posthog === undefined), '"No thanks": gone, remembered, nothing loaded');
  check((await txt(p, '.foot')).includes('Anonymous stats: off'), 'the footer says off');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1800);
  check(!(await p.$('#consent')), 'it doesn\'t ask again');

  // the footer switch turns it on: PostHog with autocapture, heatmaps and recordings off
  await p.click('[data-act="stats-toggle"]'); await p.waitForTimeout(400);
  const init = await p.evaluate(() => (window.__ph || []).find(c => c[0] === 'init'));
  check(!!init && init[1] === 'phc_mHpUpY9vB8ET9xkUtkdDdaQ78RooCv52PeDuy5xFR9LM' && init[2].api_host === 'https://eu.i.posthog.com', 'switched on: PostHog loads, EU, this project');
  check(init && init[2].autocapture === false && init[2].disable_session_recording === true && init[2].capture_heatmaps === false && init[2].disable_surveys === true, 'autocapture, recordings, heatmaps and surveys off');
  check((await txt(p, '.foot')).includes('Anonymous stats: on'), 'the footer says on');

  // what gets sent
  await p.click('.arch[data-topic="respiratory-system-diseases"]'); await p.waitForTimeout(150);
  await p.click('.page-head [data-start]'); await p.waitForTimeout(150);
  const q0 = await p.evaluate(K => { const S = JSON.parse(localStorage.getItem(K)); return S.session.qids[S.session.idx]; }, KEY);
  const qa = await p.evaluate(id => JSON.parse(document.getElementById('bank').textContent).questions.find(q => q.id === id), q0);
  for (const i of qa.answer) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(100);
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(200);
  await p.click('.bar [data-act="home"]').catch(() => {}); await p.waitForTimeout(200);
  await p.fill('#q', 'acute bronchitis'); await p.waitForTimeout(1800);
  await p.click('[data-act="clear-search"]'); await p.waitForTimeout(100);
  await p.evaluate(() => document.getElementById('quest').scrollIntoView());
  await p.click('.quest [data-act="exam"]'); await p.waitForTimeout(150);
  await p.click('[data-act="exam-start"]'); await p.waitForTimeout(150);
  await p.click('.bar [data-act="exam-handin"]'); await p.click('[data-act="exam-handin-yes"]'); await p.waitForTimeout(200);
  await p.click('[data-act="exam-review"]'); await p.waitForTimeout(150);
  const ev = await captured(p);
  console.log('  sent:', ev.map(e => e.name).join(', '));
  const want = ['module_opened', 'practice_started', 'question_checked', 'search', 'exam_mode_opened', 'exam_started', 'exam_handed_in', 'exam_review_opened'];
  check(want.every(n => ev.some(e => e.name === n)), 'module, practice, check, search and exam events');
  const chk = ev.find(e => e.name === 'question_checked');
  check(chk && JSON.stringify(Object.keys(chk.props).sort()) === '["module","quest"]', 'a checked question says only its module and whether it\'s in the quest: ' + JSON.stringify(chk && chk.props));
  const srch = ev.find(e => e.name === 'search');
  check(srch && srch.props.query === 'acute bronchitis' && srch.props.results > 0 && ev.filter(e => e.name === 'search').length === 1, 'one search event once typing stops: ' + JSON.stringify(srch && srch.props));
  const hand = ev.find(e => e.name === 'exam_handed_in');
  check(hand && hand.props.time_ran_out === false && hand.props.answered === 0 && hand.props.questions === 48, 'handing in: ' + JSON.stringify(hand && hand.props));
  const all = JSON.stringify(ev);
  const optionTexts = qa.options.map(o => o.replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 12);
  check(!/"sel"|"picks"|"answer"/.test(all) && !optionTexts.some(t => all.includes(t)), 'no picks, answers or option texts anywhere in what was sent');

  // switched off: opted out, PostHog's storage and cookie gone, nothing after a reload
  await p.click('.bar [data-act="exam-back"]'); await p.waitForTimeout(150);
  await p.click('.bar [data-act="exam-back"]').catch(() => {}); await p.waitForTimeout(200);
  const before = await p.evaluate(() => ({ ls: Object.keys(localStorage).filter(k => k.startsWith('ph_')).length, ck: document.cookie.includes('ph_') }));
  await p.click('[data-act="stats-toggle"]'); await p.waitForTimeout(150);
  const calls = await p.evaluate(() => window.__ph.map(c => c[0]));
  const after = await p.evaluate(() => ({ ls: Object.keys(localStorage).filter(k => k.startsWith('ph_')).length, ck: document.cookie.includes('ph_') }));
  check(calls.includes('opt_out') && calls.includes('reset') && before.ls > 0 && before.ck && after.ls === 0 && !after.ck, `switched off: opted out, storage ${before.ls}→${after.ls}, cookie ${before.ck}→${after.ck}`);
  const n = (await names(p)).length;
  await p.click('.arch[data-topic="dermatology"]'); await p.waitForTimeout(150);
  check((await names(p)).length === n, 'nothing is sent once off');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  check(await p.evaluate(() => window.posthog === undefined), 'and nothing loads after a reload');
  await ctx.close();

  // Allow; and a first visit that opens on a question gets asked only back on a page without one
  ({ ctx, p } = await open(null, true));
  await p.waitForTimeout(1700);
  await p.click('[data-stats="yes"]'); await p.waitForTimeout(400);
  check(await p.evaluate(k => localStorage.getItem(k), PREF) === 'on' && (await txt(p, '#toast')).startsWith('Thank you') && await p.evaluate(() => !!(window.__ph || []).find(c => c[0] === 'init')), 'Allow: on, a thank-you, PostHog loaded');
  await p.evaluate(([K, P]) => {
    localStorage.removeItem(P);
    const id = JSON.parse(document.getElementById('bank').textContent).questions[0].id;
    const S = JSON.parse(localStorage.getItem(K)); S.session = { topic: '*', type: 'all', set: null, mode: 'all', shuffle: false, from: 'search', qids: [id], order: [id], idx: 0 }; S.view = 'quiz';
    localStorage.setItem(K, JSON.stringify(S));
  }, [KEY, PREF]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1800);
  check(!(await p.$('#consent')), 'not asked over a question');
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(1700);
  check(!!(await p.$('#consent')), 'asked once back on the home page');
  await ctx.close();

  // phone
  ({ ctx, p } = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true));
  await p.waitForTimeout(1700);
  await p.screenshot({ path: OUT + 'stats_m_banner.png' });
  const box = await p.evaluate(() => { const r = document.getElementById('consent').getBoundingClientRect(); return { l: r.left, r: window.innerWidth - r.right, b: window.innerHeight - r.bottom }; });
  check(box.l >= 15 && box.r >= 15 && box.b >= 15, 'phone: the banner keeps its margins ' + JSON.stringify(box));
  check(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) === 0, 'phone: no sideways scroll');
  await p.tap('[data-stats="no"]'); await p.waitForTimeout(500);
  check(!(await p.$('#consent')), 'phone: No thanks closes it');
  await ctx.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
