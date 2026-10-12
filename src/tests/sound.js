// Sounds and haptics: which sound plays for which action (play() tags each source with its name), the keys' notes and
// the streak's climbing pitch, the recorded takes (snd/*.mp3) loading, the tactile sounds (page turns, marks, crossing
// out, crumpling, typing, switches), the on/off switches and their memory, vibration on touch phones, no errors.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const spy = () => {
  window.__plays = []; window.__buzz = [];
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when) {
    window.__plays.push({ name: this.sfx, rate: this.playbackRate.value });
    return start.apply(this, arguments);
  };
  if (navigator.vibrate) { const v = navigator.vibrate.bind(navigator); navigator.vibrate = p => { window.__buzz.push(p); return v(p); }; }
};
// the four keys are one sound (key0..key3), the two releases another
const plays = async p => (await p.evaluate(() => window.__plays.splice(0))).map(x => ({ name: String(x.name).replace(/^(key|keyup)\d$/, '$1'), rate: Math.round(x.rate * 1000) / 1000 }));
const answerOf = (p, right) => p.evaluate(({ KEY, right }) => {
  const S = JSON.parse(localStorage.getItem(KEY)); const id = S.session.qids[S.session.idx];
  const q = JSON.parse(document.getElementById('bank').textContent).questions.find(x => x.id === id);
  return right ? q.answer : [[...q.options.keys()].find(i => !q.answer.includes(i))];
}, { KEY, right });

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(spy);
  const p = await ctx.newPage(); watch(p, 'desk');
  let pl;
  const takes = [];
  p.on('response', r => { if (/\/snd\/\w+\.mp3$/.test(r.url())) takes.push(r.status()); });
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear());
  takes.length = 0;   // only this visit's
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  check((await p.textContent('.foot')).includes('Sounds: on') && !(await p.textContent('.foot')).includes('Vibration'), 'footer: Sounds on, no vibration switch on a desktop');
  await p.waitForTimeout(1500);
  check(takes.length === 28 && takes.every(c => c === 200), `the 28 recordings load once the page has settled (${takes.length}, ${[...new Set(takes)]})`);
  await p.click('.q-topic[data-qtopic="0"]'); await p.waitForTimeout(250);
  pl = await plays(p);
  check(pl.length === 1 && pl[0].name === 'flip', 'opening a quiz, the first tap: a page turns: ' + pl.map(x => x.name));
  check(await p.getAttribute('[data-act="sound"]', 'aria-pressed') === 'true', 'the quiz bar has a sound switch, on');
  // picking options: a key each, unpicking its release
  await p.click('.opt[data-opt="0"]'); await p.click('.opt[data-opt="2"]'); await p.click('.opt[data-opt="2"]');
  pl = await plays(p);
  console.log('  picks:', JSON.stringify(pl));
  check(pl.length === 3 && pl[0].name === 'key' && pl[1].name === 'key' && pl[2].name === 'keyup', 'key, key, release');
  check(Math.abs(pl[0].rate - 1) < 0.01 && Math.abs(pl[1].rate - 1.02) < 0.01 && pl[1].rate > pl[0].rate, 'option C sits a touch higher than A');
  // crossing out: a pencil stroke; the mark: a card slipped in, and out
  await p.keyboard.press('Shift+B'); await p.waitForTimeout(80);
  pl = await plays(p);
  check(pl.length === 1 && pl[0].name === 'cross', 'Shift+B crosses B out with a pencil stroke: ' + pl.map(x => x.name));
  await p.keyboard.press('Shift+B'); await p.waitForTimeout(80);
  check((await plays(p)).map(x => x.name).join() === 'keyup', 'and back: a release');
  await p.keyboard.press('m'); await p.waitForTimeout(80);
  check((await plays(p)).map(x => x.name).join() === 'mark', 'M marks it: a card slipped in');
  await p.keyboard.press('m'); await p.waitForTimeout(80);
  check((await plays(p)).map(x => x.name).join() === 'unmark', 'M again: slid out');
  // right answers in a row climb; a wrong one knocks and resets the streak
  await p.click('.opt[data-opt="0"]');   // clear
  await plays(p);
  const rates = [];
  for (let k = 0; k < 3; k++) {
    for (const i of await answerOf(p, true)) await p.click(`.opt[data-opt="${i}"]`);
    await plays(p);
    await p.click('[data-act="primary"]'); await p.waitForTimeout(120);
    pl = await plays(p);
    const r = pl.find(x => x.name === 'right'); rates.push(r ? r.rate : pl.map(x => x.name).join('+'));
    await p.click('[data-act="primary"]'); await p.waitForTimeout(150);
    const nav = await plays(p);
    if (k === 0) check(nav.length === 1 && nav[0].name === 'nav', 'Next plays a detent');
  }
  console.log('  streak rates:', rates.join(' '));
  check(rates[0] === 1 && rates[1] === 1.125 && rates[2] === 1.25, 'the chime climbs with the streak');
  for (const i of await answerOf(p, false)) await p.click(`.opt[data-opt="${i}"]`);
  await plays(p);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(120);
  pl = await plays(p);
  check(pl.length === 1 && (pl[0].name === 'wrong' || pl[0].name === 'partial'), 'a wrong answer knocks: ' + pl.map(x => x.name));
  await p.click('[data-act="again"]'); await p.waitForTimeout(120);
  pl = await plays(p);
  check(pl.length === 1 && pl[0].name === 'crumple', 'Try again crumples the wrong try: ' + pl.map(x => x.name));
  for (const i of await answerOf(p, true)) await p.click(`.opt[data-opt="${i}"]`);
  await plays(p);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(120);
  pl = await plays(p);
  check(pl.some(x => x.name === 'right' && x.rate === 1), 'after a miss the streak starts again at the root');
  // the strip jumps with a detent
  await p.click('.strip [data-jump="0"]'); await p.waitForTimeout(150);
  pl = await plays(p);
  check(pl.length === 1 && pl[0].name === 'nav', 'jumping in the strip: a detent');
  // sound off: the switch, then silence, remembered after a reload
  await p.click('[data-act="sound"]'); await p.waitForTimeout(100);
  check(await p.getAttribute('[data-act="sound"]', 'aria-pressed') === 'false', 'switched off');
  await plays(p);
  await p.click('.strip [data-jump="1"]'); await p.waitForTimeout(150);
  check((await plays(p)).length === 0, 'no sound while off');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  check(await p.getAttribute('[data-act="sound"]', 'aria-pressed') === 'false', 'still off after a reload');
  await p.click('[data-act="sound"]'); await p.waitForTimeout(150);
  pl = await plays(p);
  check(pl.length === 1 && /^(toggle|keyup)$/.test(pl[0].name), 'switching it back on clicks (a key\'s release until the recordings are in): ' + pl.map(x => x.name));
  await p.screenshot({ path: OUT + 'snd_bar.png', clip: { x: 0, y: 0, width: 1280, height: 70 } });
  // back home: a swish; typing in the search: keys, the space bar, a release for a deletion
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(300);
  pl = await plays(p);
  check(pl.length === 1 && pl[0].name === 'back', 'back home: a swish: ' + pl.map(x => x.name));
  const box = await p.$('input[type="search"]');
  if (box) {
    await box.type('ab c', { delay: 40 }); await p.keyboard.press('Backspace'); await p.waitForTimeout(150);
    pl = (await plays(p)).map(x => x.name);
    check(pl.join() === 'key,key,space,key,keyup', 'typing in the search: ' + pl.join());
    await box.fill(''); await p.waitForTimeout(150); await plays(p);
  } else check(false, 'the search box is there');
  // footer switches click
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(100);
  await p.click('.foot [data-act="sound-toggle"]'); await p.waitForTimeout(80);
  check((await plays(p)).length === 0, 'the footer switch: off is silent');
  await p.click('.foot [data-act="sound-toggle"]'); await p.waitForTimeout(80);
  check((await plays(p)).map(x => x.name).join() === 'toggle', 'and on clicks');
  // finishing a session that went well plays the arpeggio
  const one = await p.evaluate(() => { const B = JSON.parse(document.getElementById('bank').textContent); return B.quest.q[0]; });
  await p.evaluate(([K, id]) => { const S = JSON.parse(localStorage.getItem(K)); S.session = { topic: 'respiratory-system-diseases', type: 'all', set: null, mode: 'all', shuffle: false, from: 'search', qids: [id], order: [id], idx: 0 }; S.view = 'quiz'; delete S.answers[id]; localStorage.setItem(K, JSON.stringify(S)); }, [KEY, one]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  for (const i of await answerOf(p, true)) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(120);
  await plays(p);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(250);
  pl = await plays(p);
  check(pl.length === 1 && pl[0].name === 'finish', 'finishing with 100% right: the arpeggio');
  await ctx.close();

  // phone: vibration with the ticks, a switch for it in the footer
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await mctx.addInitScript(spy);
  const m = await mctx.newPage(); watch(m, 'phone');
  await m.goto(URL, { waitUntil: 'load' }); await m.evaluate(() => localStorage.clear());
  await m.reload({ waitUntil: 'load' }); await m.waitForTimeout(300);
  check((await m.textContent('.foot')).includes('Vibration: on'), 'phone footer: Vibration on');
  await m.evaluate(() => document.getElementById('quest').scrollIntoView());
  await m.tap('.q-topic[data-qtopic="0"]'); await m.waitForTimeout(250);
  await m.evaluate(() => window.__buzz.splice(0));
  await m.tap('.opt[data-opt="1"]');
  const bz = await m.evaluate(() => window.__buzz.splice(0));
  check(bz.length === 1 && bz[0] === 8, 'a tap on an option vibrates 8 ms: ' + JSON.stringify(bz));
  await m.screenshot({ path: OUT + 'snd_m_bar.png', clip: { x: 0, y: 0, width: 390, height: 70 } });
  await m.tap('.bar [data-act="back"]'); await m.waitForTimeout(300);
  await m.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await m.waitForTimeout(150);
  await m.tap('[data-act="haptic-toggle"]'); await m.waitForTimeout(100);
  check((await m.textContent('.foot')).includes('Vibration: off'), 'vibration switched off');
  await m.screenshot({ path: OUT + 'snd_m_foot.png' });
  await m.evaluate(() => document.getElementById('quest').scrollIntoView());
  await m.tap('.q-topic[data-qtopic="0"]'); await m.waitForTimeout(250);
  await m.evaluate(() => window.__buzz.splice(0));
  await m.tap('.opt[data-opt="2"]');
  check((await m.evaluate(() => window.__buzz.splice(0))).length === 0, 'no vibration while off');
  console.log('phone overflow:', await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await mctx.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
