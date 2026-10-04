// Sounds and haptics: which sound plays for which action (told apart by buffer length), option notes and the
// streak's climbing pitch, the on/off switches and their memory, vibration on touch phones, no errors.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
// the buffers' lengths, in seconds, name each sound
const NAMES = { 0.05: 'tick', 0.038: 'untick', 0.025: 'nav', 1.6: 'right', 0.42: 'wrong', 0.3: 'partial', 2: 'seal', 0.8: 'sparkle', 2.2: 'finish' };
const spy = () => {
  window.__plays = []; window.__buzz = [];
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when) {
    window.__plays.push({ dur: Math.round(this.buffer.duration * 1000) / 1000, rate: this.playbackRate.value });
    return start.apply(this, arguments);
  };
  if (navigator.vibrate) { const v = navigator.vibrate.bind(navigator); navigator.vibrate = p => { window.__buzz.push(p); return v(p); }; }
};
const plays = async p => (await p.evaluate(() => window.__plays.splice(0))).map(x => ({ name: NAMES[x.dur] || x.dur, rate: Math.round(x.rate * 1000) / 1000 }));
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
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  check((await p.textContent('.foot')).includes('Sounds: on') && !(await p.textContent('.foot')).includes('Vibration'), 'footer: Sounds on, no vibration switch on a desktop');
  await p.click('.q-topic[data-qtopic="0"]'); await p.waitForTimeout(250);
  await plays(p);
  check(await p.getAttribute('[data-act="sound"]', 'aria-pressed') === 'true', 'the quiz bar has a sound switch, on');
  // picking options: a note each, unpicking a softer click
  await p.click('.opt[data-opt="0"]'); await p.click('.opt[data-opt="2"]'); await p.click('.opt[data-opt="2"]');
  let pl = await plays(p);
  console.log('  picks:', JSON.stringify(pl));
  check(pl.length === 3 && pl[0].name === 'tick' && pl[1].name === 'tick' && pl[2].name === 'untick', 'tick, tick, untick');
  check(Math.abs(pl[0].rate - 1) < 0.01 && Math.abs(pl[1].rate - 1.25) < 0.012 && Math.abs(pl[2].rate - 1.25) < 0.012, 'option A plays the root, option C a major third up');
  // right answers in a row climb; a wrong one knocks and resets the streak
  await p.click('.opt[data-opt="0"]');   // clear
  await plays(p);
  const rates = [];
  for (let k = 0; k < 3; k++) {
    for (const i of await answerOf(p, true)) await p.click(`.opt[data-opt="${i}"]`);
    await plays(p);
    await p.click('[data-act="primary"]'); await p.waitForTimeout(120);
    pl = await plays(p);
    const r = pl.find(x => x.name === 'right'); rates.push(r ? r.rate : null);
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
  check(pl.length === 1 && pl[0].name === 'tick', 'switching it back on plays a tick');
  await p.screenshot({ path: OUT + 'snd_bar.png', clip: { x: 0, y: 0, width: 1280, height: 70 } });
  // finishing a session that went well plays the arpeggio
  await p.click('.bar [data-act="back"]'); await p.waitForTimeout(300);
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
