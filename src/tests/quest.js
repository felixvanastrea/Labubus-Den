// The current quest: homepage card, topic practice, first tries, seals, reset and the countdown on different days.
const { chromium } = require('playwright');
const OUT = process.env.OUT || require('path').join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:8765/index.html';
const KEY = 'efm3-mcq-bank-v1';
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const watch = (p, tag) => {
    p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  };
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); watch(p, 'd');
  await p.clock.install({ time: new Date(2026, 9, 1, 16, 30) });
  await p.goto(URL, { waitUntil: 'load' });
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500);
  console.log('hero:', (await p.textContent('.hero-cta')).replace(/\s+/g, ' ').trim());
  await p.screenshot({ path: OUT + 'q_home_top.png' });
  await p.evaluate(() => document.getElementById('quest').scrollIntoView());
  await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + 'q_card.png' });
  console.log('topics:', await p.$$eval('.q-topic .e-name', els => els.map(e => e.textContent).join(' | ')));
  console.log('stats:', await p.textContent('.qp-stats'));

  // answer the acute bronchitis topic: all right except the first, which is wrong, then fixed with "Try again"
  const answerCurrent = async right => {
    const ans = await p.evaluate(({ KEY, right }) => {
      const S = JSON.parse(localStorage.getItem(KEY)); const id = S.session.qids[S.session.idx];
      const q = JSON.parse(document.getElementById('bank').textContent).questions.find(x => x.id === id);
      if (right) return q.answer;
      const wrong = [...q.options.keys()].find(i => !q.answer.includes(i)); return [wrong];
    }, { KEY, right });
    for (const i of ans) await p.click(`.opt[data-opt="${i}"]`);
    await p.click('[data-act="primary"]');
  };
  await p.click('.q-topic[data-qtopic="0"]');
  await p.waitForTimeout(200);
  console.log('quiz title:', await p.textContent('.bar-title'), '|', await p.textContent('.bar-count'));
  await answerCurrent(false);
  await p.click('[data-act="again"]');
  await answerCurrent(true);
  await p.click('[data-act="primary"]');
  const nTopic = await p.evaluate(() => JSON.parse(document.getElementById('bank').textContent).quest.topics[0].q.length);
  for (let k = 1; k < nTopic; k++) { await answerCurrent(true); await p.click('[data-act="primary"]'); }
  await p.waitForTimeout(300);
  console.log('done view:', await p.evaluate(() => document.body.dataset.view), '|', (await p.textContent('.qd-line')).trim());
  await p.screenshot({ path: OUT + 'q_done_partial.png' });
  const first = await p.evaluate(KEY => { const S = JSON.parse(localStorage.getItem(KEY)); return Object.values(S.first); }, KEY);
  console.log('first tries recorded:', first.length, 'wrong first:', first.filter(x => !x).length);
  await p.click('[data-act="back"]');
  await p.waitForTimeout(400);
  console.log('back to home, near quest:', await p.evaluate(() => { const r = document.getElementById('quest').getBoundingClientRect(); return Math.round(r.top) + ' ' + Math.round(window.scrollY); }));
  console.log('topic 0 done star:', await p.$eval('.q-topic[data-qtopic="0"]', e => e.classList.contains('is-done')), '| stats:', await p.textContent('.qp-stats'));
  console.log('hero now:', (await p.textContent('.hero-cta .btn.primary')).trim());

  // finish the whole quest: every answer right (first tries right too, except the one above)
  await p.evaluate(KEY => {
    const S = JSON.parse(localStorage.getItem(KEY));
    const bank = JSON.parse(document.getElementById('bank').textContent);
    for (const id of bank.quest.q) { const q = bank.questions.find(x => x.id === id); S.answers[id] = { sel: q.answer.slice(), checked: true, correct: true }; if (!(id in S.first)) S.first[id] = true; }
    S.view = 'home'; localStorage.setItem(KEY, JSON.stringify(S));
  }, KEY);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400);
  console.log('hero after done:', (await p.textContent('.hero-cta')).replace(/\s+/g, ' ').trim().slice(0, 90));
  await p.evaluate(() => document.getElementById('quest').scrollIntoView());
  await p.waitForTimeout(900);
  console.log('seals:', await p.$$eval('.seal-wrap', els => els.map(e => e.className + ' / ' + e.querySelector('figcaption').textContent).join(' || ')));
  console.log('stamped flags:', await p.evaluate(KEY => JSON.stringify(JSON.parse(localStorage.getItem(KEY)).seals), KEY));
  await p.screenshot({ path: OUT + 'q_card_done.png' });

  // reset the quest
  await p.click('[data-act="reset"][data-scope="quest"]');
  console.log('confirm:', (await p.textContent('.quest .confirm')).replace(/\s+/g, ' ').trim());
  await p.click('.quest [data-act="reset-yes"]');
  await p.waitForTimeout(300);
  console.log('after reset:', await p.textContent('.qp-stats'), '| seals flags:', await p.evaluate(KEY => JSON.stringify(JSON.parse(localStorage.getItem(KEY)).seals), KEY));
  await ctx.close();

  // the countdown on different days
  for (const [label, d] of [['Oct 6', new Date(2026, 9, 6, 9)], ['Oct 7', new Date(2026, 9, 7, 9)], ['Oct 8', new Date(2026, 9, 8, 9)]]) {
    const c = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const q = await c.newPage(); watch(q, label);
    await q.clock.install({ time: d });
    await q.goto(URL, { waitUntil: 'load' }); await q.waitForTimeout(300);
    console.log(label, '| eyebrow:', await q.textContent('.quest .eyebrow'), '| count:', await q.$eval('.qp-side', e => (e.querySelector('.qp-count') || { textContent: '(none)' }).textContent.replace(/\s+/g, ' ')), '| hero:', (await q.textContent('.hero-cta .cta-note')).replace(/\s+/g, ' ').trim().slice(0, 60));
    await c.close();
  }

  // phone
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })).newPage();
  watch(m, 'm');
  await m.clock.install({ time: new Date(2026, 9, 1, 16, 30) });
  await m.goto(URL, { waitUntil: 'load' }); await m.waitForTimeout(400);
  await m.screenshot({ path: OUT + 'q_m_top.png' });
  await m.evaluate(() => document.getElementById('quest').scrollIntoView());
  await m.waitForTimeout(300);
  await m.screenshot({ path: OUT + 'q_m_card.png' });
  await m.evaluate(() => window.scrollBy(0, 700));
  await m.waitForTimeout(200);
  await m.screenshot({ path: OUT + 'q_m_card2.png' });
  console.log('mobile overflow:', await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
