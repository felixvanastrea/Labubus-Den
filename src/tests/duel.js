// Duels and parties, against account.js's fake Firebase (the other players are played by writing their parts of the
// challenge's doc, as their devices would): the homepage card and the colours of the sky; challenging Amro to the quest
// from exam mode (the doc: one draw for both, the invitation's tags); the challenge's page; playing it; Amro hands in a
// worse exam; I win and take a colour, which my star wears in the class sky; an invitation from Amro arrives live and is
// accepted; another is declined; a live party starts for everyone at once; a link opens a challenge; losing a duel gives
// my colour back to the sky. Screenshots: shots/duel_*.png.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8765', URL = BASE + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
const src = fs.readFileSync(path.join(__dirname, 'account.js'), 'utf8');
const FAKE = new Function(src.slice(src.indexOf('const FAKE = {'), src.indexOf('\n};\n', src.indexOf('const FAKE = {')) + 3) + '\nreturn FAKE;')();
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const docs = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__fb.docs)));
const errors = [];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const pre = await ctx.newPage(); await pre.goto(URL, { waitUntil: 'load' });
  const [day, today, bank] = await pre.evaluate(() => { const d = new Date(), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return ['d' + k, k, JSON.parse(document.getElementById('bank').textContent)]; });
  await pre.close();
  const Q = new Map(bank.questions.map(q => [q.id, q]));
  const seed = {
    'users/u2': { s: '{}', name: 'Rim', key: 'rim' }, 'names/rim': { uid: 'u2', name: 'Rim' },
    'users/u40': { s: '{}', name: 'Amro', key: 'amro' }, 'names/amro': { uid: 'u40', name: 'Amro' },
    'names/salma': { uid: 'u30', name: 'Salma' },
    ['sky/' + day]: { u40: { nm: 'Amro', c: 20, t: 1000 }, u30: { nm: 'Salma', c: 10, t: 1001 }, u2: { nm: 'Rim', c: 10, t: 1002 } }
  };
  await ctx.addInitScript(([seed, K, today]) => {
    if (location.protocol === 'about:') return;
    if (!localStorage.getItem('seeded')) {
      localStorage.clear(); localStorage.setItem('seeded', '1');
      localStorage.setItem('fake-user', JSON.stringify({ uid: 'u2', displayName: 'Rim', email: 'rim@example.com' }));
      localStorage.setItem('efm3-acct', '1'); localStorage.setItem('efm3-acct-name', 'Rim');
      localStorage.setItem('fake-docs', JSON.stringify(seed)); localStorage.setItem(K, JSON.stringify({ days: { [today]: 10 } }));
    }
    window.__acctTest = true;
    window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
  }, [seed, KEY, today]);
  await ctx.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[req.url().match(/firebase-(\w+)\.js$/)[1]] });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(1000);
  const remote = (r, v) => p.evaluate(([r, v]) => window.__fb.remote(r, v), [r, v]);
  const duelIds = async () => Object.keys(await docs(p)).filter(k => k.startsWith('duels/')).map(k => k.slice(6));

  // 1. the homepage card
  await p.evaluate(() => document.getElementById('duels').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  check(/Duels and parties/.test(await txt(p, '#duels')) && (await p.$$('#duels .dl-c')).length === 7 && (await p.$$('#duels .dl-c.held')).length === 0, 'the card: duels and parties, the seven colours, all free');
  await (await p.$('#duels')).screenshot({ path: OUT + 'duel_card.png' });

  // 2. challenge Amro to the quest, from exam mode
  await p.click('#duels [data-act="challenge"]'); await p.waitForTimeout(250);
  check(await p.isVisible('.ch-sheet') && /Challenge the class/.test(await txt(p, '.ch-sheet')) && /20 questions/.test(await txt(p, '.ch-sheet .eyebrow')), 'the challenge sheet, on the quest, 20 questions');
  check((await p.$$eval('.ch-sheet .ch-p', b => b.map(x => x.textContent.trim()))).join() === 'Amro,Salma', 'it suggests tonight’s sky: ' + (await p.$$eval('.ch-sheet .ch-p', b => b.map(x => x.textContent.trim()))).join());
  await p.fill('#ch-name', 'nobody'); await p.click('.ch-add button'); await p.waitForTimeout(200);
  check(/No one is called nobody/.test(await txt(p, '.ch-sheet')), 'a name no one has: said so');
  await p.click('.ch-sheet .ch-p:has-text("Amro")');
  await (await p.$('.ch-sheet .acct-card')).screenshot({ path: OUT + 'duel_sheet.png' });
  await p.click('.ch-sheet [data-ch="make"]'); await p.waitForTimeout(400);
  let ids = await duelIds(), D = await docs(p), d1 = ids[0], doc = D['duels/' + d1];
  check(ids.length === 1 && doc.kind === 'duel' && doc.qids.length === 20 && doc.ix.join() === `u2@${day},u40@${day}` && doc.inm.u40 === 'Amro' && doc.p.u2.s === 'in' && doc.p.u2.nm === 'Rim', 'the duel is made: one draw of 20, Amro invited');
  check(/Sent to Amro/.test(await txt(p, '.ch-sheet')) && (await p.inputValue('#ch-url')).endsWith('#duel-' + d1), 'sent, with its link');
  await p.click('.ch-sheet [data-ch="open"]'); await p.waitForTimeout(300);
  check(await p.evaluate(() => document.body.dataset.view) === 'duel' && /Rim against Amro/.test(await txt(p, '.dl-h1')) && /The winner takes a colour from the sky/.test(await txt(p, '.dl-stake')), 'its page: Rim against Amro, a colour from the sky at stake');
  check(/invited/.test(await txt(p, '.dl-players')) && !!(await p.$('[data-act="duel-play"]')), 'Amro is invited; I can start mine');
  // Amro accepts
  await remote('duels/' + d1, { p: Object.assign({}, doc.p, { u40: { nm: 'Amro', s: 'in', j: Date.now() } }) }); await p.waitForTimeout(300);
  check(/Amro\s*ready/.test(await txt(p, '.dl-players')), 'Amro accepts: he shows as ready');
  await p.screenshot({ path: OUT + 'duel_page.png' });

  // 3. I play it, every answer right
  await p.click('[data-act="duel-play"]'); await p.waitForTimeout(300);
  let ex = await p.evaluate(K => JSON.parse(localStorage.getItem(K)).exam, KEY);
  check(ex && ex.duel === d1 && ex.qids.join() === doc.qids.filter(id => Q.get(id).answer.length).join() && /not started/.test(await txt(p, '[data-duel-run]')), 'my exam: the duel’s questions, in its order; Amro “not started”');
  for (let i = 0; i < ex.qids.length; i++) {
    for (const k of Q.get(ex.qids[i]).answer) await p.click(`.opt[data-opt="${k}"]`);
    await p.click('[data-act="exam-next"]'); await p.waitForTimeout(40);
  }
  await p.click('[data-act="exam-handin-yes"]'); await p.waitForTimeout(500);
  D = await docs(p); doc = D['duels/' + d1];
  check(doc.p.u2.end > 0 && doc.p.u2.n20 === 20 && Object.keys(doc.p.u2.picks).length === 20, 'handed in: my mark and picks go up (20/20)');
  await p.waitForTimeout(1800);
  check(/A gift for your first duel: the Blood moon/.test(await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')), 'my first duel handed in: the Blood moon, a gift');
  check(!!(await p.$(`[data-duel="${d1}"]`)), 'the results offer the duel');
  await p.click(`[data-duel="${d1}"]`); await p.waitForTimeout(300);
  check(/You handed in: 20\/20/.test(await txt(p, '.dl-acts-row')) && !(await p.$('.dl-grid')) === false, 'its page: waiting for Amro, and my answers question by question');
  // Amro hands in a worse exam: he wins nothing
  const half = Object.fromEntries(doc.qids.slice(0, 10).map(id => [id, Q.get(id).answer]));
  await remote('duels/' + d1, { p: Object.assign({}, doc.p, { u40: { nm: 'Amro', s: 'in', j: 1, at: Date.now() - 6e5, end: Date.now(), n: 10, pts: 10, n20: 10, used: 6e5, picks: half } }) });
  await p.waitForTimeout(600);
  check(/You win the duel, 20 to 10/.test(await txt(p, '.ph-lead')), 'Amro handed in 10/20: I win, 20 to 10');
  D = await docs(p);
  const mine = Object.entries(D).filter(([k, v]) => k.startsWith('colours/') && v.uid === 'u2');
  check(mine.length === 1 && mine[0][1].duel === d1 && mine[0][1].nm === 'Rim', 'I take a colour from the sky: ' + (mine[0] || [''])[0]);
  const cname = mine.length ? mine[0][0].slice(8) : '';
  await p.waitForTimeout(200);
  check(new RegExp('You take ' + cname, 'i').test(await txt(p, '.dl-stake')) && /You take/.test(await p.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')), 'the page and a toast say which');
  await p.screenshot({ path: OUT + 'duel_won.png', fullPage: true });
  // my star wears it
  await p.click('.bar [data-act="home"]'); await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById('class-sky').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
  await p.hover('#class-sky .sky-nm:has-text("Rim")'); await p.waitForTimeout(200);
  check(new RegExp('wears ' + cname, 'i').test(await txt(p, '#class-sky .sky-tip')), 'my star in the class sky wears it: ' + await txt(p, '#class-sky .sky-tip'));
  await (await p.$('#class-sky .sky-field')).screenshot({ path: OUT + 'duel_sky.png' });
  await p.evaluate(() => document.getElementById('duels').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
  check((await p.$$('#duels .dl-c.held')).length === 1 && /Rim \(you\)/.test(await txt(p, '#duels .dl-legend')) && /you won/.test(await txt(p, '#duels .dl-list')), 'the card: my colour held, the duel won');
  await (await p.$('#duels')).screenshot({ path: OUT + 'duel_card_won.png' });

  // 4. Amro challenges me: a live invitation, accepted
  const mk = (id, o) => Object.assign({ by: 'u40', kind: 'duel', live: false, title: 'Endocrinology · mock exam', what: 'Endocrinology · mock exam', scope: { kind: 'module', id: 'endocrinology' },
    qids: bank.questions.filter(q => q.topic === 'endocrinology' && q.answer.length).slice(0, 5).map(q => q.id), ms: 5 * 60000, t: Date.now(), d: day, until: Date.now() + 864e5, go: 0,
    ix: [`u40@${day}`, `u2@${day}`], inm: { u2: 'Rim' }, p: { u40: { nm: 'Amro', s: 'in', j: Date.now() } } }, o || {});
  await remote('duels/amroduel01', mk('amroduel01')); await p.waitForTimeout(500);
  check(await p.isVisible('.inv-sheet') && /Amro challenges you to a duel/.test(await txt(p, '.inv-sheet')) && new RegExp(`At stake: ${cname}, yours`, 'i').test(await txt(p, '.inv-sheet')), 'Amro’s invitation shows at once, my colour at stake: ' + await txt(p, '.inv-sheet .acct-p'));
  await (await p.$('.inv-sheet .acct-card')).screenshot({ path: OUT + 'duel_invite.png' });
  await p.click('.inv-sheet [data-inv="yes"]'); await p.waitForTimeout(400);
  D = await docs(p);
  check(D['duels/amroduel01'].p.u2 && D['duels/amroduel01'].p.u2.s === 'in' && await p.evaluate(() => document.body.dataset.view) === 'duel' && /Amro against Rim/.test(await txt(p, '.dl-h1')), 'accepted: I’m in, on its page');
  // 5. another, declined from the card
  await p.click('.bar [data-act="home"]'); await p.waitForTimeout(200);
  await remote('duels/amroduel02', mk('amroduel02')); await p.waitForTimeout(500);
  await p.click('.inv-sheet [data-inv="no"]'); await p.waitForTimeout(400);
  D = await docs(p);
  check(D['duels/amroduel02'].p.u2.s === 'no' && /declined/.test(await txt(p, '#duels .dl-list')), 'declined: no duel, said so on the card');

  // 6. a live party: it starts for everyone at once
  await remote('duels/partylive01', mk('partylive01', { kind: 'party', live: true, ix: [`u40@${day}`, `u2@${day}`, `u30@${day}`], inm: { u2: 'Rim', u30: 'Salma' } })); await p.waitForTimeout(500);
  check(/Amro challenges you to a party/.test(await txt(p, '.inv-sheet')) && /Live/.test(await txt(p, '.inv-sheet .eyebrow')), 'a live party invitation');
  await p.click('.inv-sheet [data-inv="yes"]'); await p.waitForTimeout(300);
  check(/Amro starts it once everyone’s here/.test(await txt(p, '.ph-lead')), 'waiting for Amro to start it');
  D = await docs(p);
  await remote('duels/partylive01', { go: Date.now() + 1500 }); await p.waitForTimeout(400);
  check(/Starting in/.test(await txt(p, '.ph-lead')), 'Amro starts it: a countdown');
  await p.waitForTimeout(1600);
  ex = await p.evaluate(K => JSON.parse(localStorage.getItem(K)).exam, KEY);
  check(ex && ex.duel === 'partylive01' && !ex.handed && await p.evaluate(() => document.body.dataset.view) === 'exam', 'at the start, my exam begins on its own');
  await remote('duels/partylive01', { p: Object.assign({}, (await docs(p))['duels/partylive01'].p, { u40: { nm: 'Amro', s: 'in', j: 1, at: Date.now(), n: 3 } }) }); await p.waitForTimeout(300);
  check(/Amro 3\/5/.test(await txt(p, '[data-duel-run]')), 'I see how far Amro is: ' + await txt(p, '[data-duel-run]'));
  await p.screenshot({ path: OUT + 'duel_live_run.png' });
  await p.click('[data-act="exam-handin"]'); await p.waitForTimeout(150); await p.click('[data-act="exam-handin-yes"]'); await p.waitForTimeout(300);

  // 7. a link: someone's open party, joined from it
  await remote('duels/openparty1', mk('openparty1', { by: 'u30', kind: 'party', ix: [`u30@${day}`], inm: {}, p: { u30: { nm: 'Salma', s: 'in', j: 1 } } }));
  await p.goto(URL + '#duel-openparty1', { waitUntil: 'load' }); await p.waitForTimeout(1200);
  check(await p.evaluate(() => document.body.dataset.view) === 'duel' && /Salma’s party/.test(await txt(p, '.dl-h1')) && !!(await p.$('[data-duel-yes="openparty1"]')) && !/#duel/.test(await p.evaluate(() => location.href)), 'the link opens Salma’s party, with Join (and leaves the address clean)');
  await p.click('[data-duel-yes="openparty1"]'); await p.waitForTimeout(400);
  D = await docs(p);
  check(D['duels/openparty1'].p.u2.s === 'in' && D['duels/openparty1'].ix.includes(`u2@${day}`), 'joined from the link');

  // 8. losing a duel gives my colour back to the sky
  await remote('duels/amroduel01', { p: Object.assign({}, D['duels/amroduel01'].p, {
    u2: { nm: 'Rim', s: 'in', j: 1, at: Date.now() - 1e5, end: Date.now(), n: 0, pts: 0, n20: 0, used: 1e5, picks: {} },
    u40: { nm: 'Amro', s: 'in', j: 1, at: Date.now() - 2e5, end: Date.now(), n: 5, pts: 5, n20: 20, used: 2e5, picks: Object.fromEntries(D['duels/amroduel01'].qids.map(id => [id, Q.get(id).answer])) } }) });
  await p.waitForTimeout(700);
  D = await docs(p);
  check(D['colours/' + cname].uid === '' && D['colours/' + cname].duel === 'amroduel01', 'Amro beat me: my colour goes back to the sky (for him to take)');
  await p.click('.bar [data-act="home"]').catch(() => {}); await p.waitForTimeout(300);

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
