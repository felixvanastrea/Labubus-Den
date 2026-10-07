// Accounts, against a fake Firebase served in place of the real SDK (it keeps the rules' one-name-per-person too).
// Guests: Sign in in the top bar and footer, padlocks on exam mode / weak spots / quests, and a locked button opens the
// sheet (Google, or email and password: wrong password, forgot password). Signing in from it: the account's copy and
// this device's merge, a name is picked, then the weak spots open. Sync: a change goes up 15 s later, merged with what
// the account got meanwhile; another device's change (or deletion) arrives live; the next visit signs in on its own.
// Names: change it; a lookalike of a taken name is refused. Email accounts; sign out; delete my data (the copy, the
// name, the account); the phone's top bar; a database that refuses says so; the claude.ai copy shows nothing.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
fs.mkdirSync(OUT, { recursive: true });
const URL = (process.env.BASE || 'http://127.0.0.1:8765') + '/index.html';
const KEY = 'efm3-mcq-bank-v1';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };
const txt = async (p, sel) => ((await p.textContent(sel)) || '').replace(/\s+/g, ' ').trim();
const state = p => p.evaluate(K => JSON.parse(localStorage.getItem(K)), KEY);
const docs = p => p.evaluate(() => JSON.parse(JSON.stringify(window.__fb.docs)));
const cloud = async (p, id = 'u1') => JSON.parse(((await docs(p))['users/' + id] || {}).s || '{}');

const FAKE = {
  app: `export function initializeApp(c) { window.__fb.config = c; return {}; }`,
  auth: `const fb = window.__fb; const cbs = [];
    const emit = () => cbs.forEach(cb => cb(fb.user));
    const keep = () => { if (fb.user) localStorage.setItem('fake-user', JSON.stringify(fb.user)); else localStorage.removeItem('fake-user'); };
    const accts = () => JSON.parse(localStorage.getItem('fake-accounts') || '{}');
    const fail = c => { const e = new Error(c); e.code = 'auth/' + c; throw e; };
    export function getAuth() { return {}; }
    export function onAuthStateChanged(a, cb) { cbs.push(cb); setTimeout(() => cb(fb.user), 0); }
    export class GoogleAuthProvider {}
    export async function signInWithPopup() { fb.calls.push('popup'); fb.user = { uid: 'u1', displayName: 'Abi Test', email: 'abi@example.com' }; keep(); emit(); }
    export async function signInWithRedirect() { fb.calls.push('redirect'); }
    export async function createUserWithEmailAndPassword(a, email, pw) {
      fb.calls.push('create ' + email); const all = accts();
      if (all[email]) fail('email-already-in-use'); if (pw.length < 6) fail('weak-password');
      all[email] = { pw, uid: 'u2' }; localStorage.setItem('fake-accounts', JSON.stringify(all));
      fb.user = { uid: 'u2', displayName: null, email }; keep(); emit(); return { user: fb.user };
    }
    export async function signInWithEmailAndPassword(a, email, pw) {
      fb.calls.push('signin ' + email); const x = accts()[email];
      if (!x || x.pw !== pw) fail('invalid-credential');
      fb.user = { uid: x.uid, displayName: x.name || null, email }; keep(); emit(); return { user: fb.user };
    }
    export async function updateProfile(u, p) {
      fb.calls.push('name ' + p.displayName); Object.assign(u, p);
      const all = accts(); if (all[u.email]) { all[u.email].name = p.displayName; localStorage.setItem('fake-accounts', JSON.stringify(all)); } keep();
    }
    export async function sendPasswordResetEmail(a, email) { fb.calls.push('reset ' + email); }
    export async function signOut() { fb.calls.push('signout'); fb.user = null; keep(); emit(); }
    export async function deleteUser() { fb.calls.push('deleteUser'); fb.user = null; keep(); emit(); }`,
  firestore: `const fb = window.__fb; const subs = {};
    const keep = () => localStorage.setItem('fake-docs', JSON.stringify(fb.docs));
    const no = () => { const e = new Error('no'); e.code = 'permission-denied'; throw e; };
    const deny = () => { if (localStorage.getItem('fake-deny')) no(); };
    const snapOf = r => { const d = fb.docs[r]; return { exists: () => !!d, data: () => d && JSON.parse(JSON.stringify(d)), metadata: { hasPendingWrites: false } }; };
    const notify = r => (subs[r] || []).forEach(cb => cb(snapOf(r)));
    // the rules: a name belongs to whoever has it
    const rules = ops => { for (const [k, r, d] of ops) { if (k === 'set' && r.startsWith('names/') && fb.docs[r] && fb.docs[r].uid !== d.uid) no(); if (k === 'del' && r === 'names/labubu') no(); } };
    // set with merge merges maps deeply, like Firestore; increment() and deleteField() resolve against what's there
    const resolve = (old, d) => { const o = Object.assign({}, old || {}); for (const [k, v] of Object.entries(d)) { if (v && v.__del) delete o[k]; else if (v && v.__inc !== undefined) o[k] = ((old && old[k]) || 0) + v.__inc; else if (v && typeof v === 'object' && !Array.isArray(v)) o[k] = resolve(old && old[k], v); else o[k] = v; } return o; };
    const apply = ([k, r, d, o]) => { if (k === 'del') delete fb.docs[r]; else fb.docs[r] = o && o.merge ? resolve(fb.docs[r], d) : resolve({}, d); };
    const run = ops => { rules(ops); ops.forEach(apply); keep(); ops.forEach(o => notify(o[1])); };
    export function getFirestore() { return {}; }
    export function doc(db, col, id) { return col + '/' + id; }
    export async function getDoc(r) { fb.calls.push('get ' + r); deny(); return snapOf(r); }
    export function serverTimestamp() { return 0; }
    export function increment(n) { return { __inc: n }; }
    export function deleteField() { return { __del: 1 }; }
    export async function setDoc(r, d, o) { fb.calls.push('set ' + r); deny(); run([['set', r, d, o]]); }
    export function writeBatch() { const ops = []; return { set(r, d, o) { ops.push(['set', r, d, o]); }, delete(r) { ops.push(['del', r]); },
      async commit() { fb.calls.push('batch ' + ops.map(o => o[0] + ' ' + o[1]).join(', ')); deny(); run(ops); } }; }
    export async function runTransaction(db, fn) { const ops = []; deny(); if (window.__denyTx) no(); await fn({ get: async r => snapOf(r), set: (r, d, o) => ops.push(['set', r, d, o]) }); fb.calls.push('tx ' + ops.map(o => o[1]).join(', ')); run(ops); }
    // queries: a collection ordered by one field, with a limit; only the owner of names/labubu may list the users
    export function collection(db, col) { return col; }
    export function orderBy(by, dir) { return { by, dir }; }
    export function limit(lim) { return { lim }; }
    export function query(col, ...parts) { return Object.assign({ col }, ...parts); }
    export async function getDocs(q) {
      fb.calls.push('list ' + q.col); deny();
      const lab = fb.docs['names/labubu'];
      if (q.col === 'users' && !(fb.user && lab && lab.uid === fb.user.uid && q.lim && q.lim <= 50)) no();
      const docs = Object.entries(fb.docs).filter(([r, d]) => r.startsWith(q.col + '/') && (!q.by || d[q.by] !== undefined))
        .sort((a, b) => (q.dir === 'desc' ? -1 : 1) * ((a[1][q.by] || 0) - (b[1][q.by] || 0))).slice(0, q.lim || 1e9)
        .map(([r, d]) => ({ id: r.slice(q.col.length + 1), data: () => JSON.parse(JSON.stringify(d)) }));
      return { docs, size: docs.length, empty: !docs.length };
    }
    export function onSnapshot(r, cb) { (subs[r] = subs[r] || []).push(cb); setTimeout(() => cb(snapOf(r)), 0); return () => { subs[r] = subs[r].filter(x => x !== cb); }; }
    fb.remote = (r, data) => { fb.docs[r] = Object.assign({}, fb.docs[r], data); keep(); notify(r); };`,
};

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    window.__acctTest = true;
    window.__fb = { calls: [], user: JSON.parse(localStorage.getItem('fake-user') || 'null'), docs: JSON.parse(localStorage.getItem('fake-docs') || '{}') };
  });
  await ctx.route(/gstatic\.com\/firebasejs\/12\.19\.0\/firebase-(app|auth|firestore)\.js$/, (route, req) => {
    const n = req.url().match(/firebase-(\w+)\.js$/)[1];
    route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: FAKE[n] });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p.clock.install({ time: new Date(2026, 9, 6, 20, 0) });
  await p.goto(URL, { waitUntil: 'load' }); await p.evaluate(() => localStorage.clear());
  const bank = await p.evaluate(() => JSON.parse(document.getElementById('bank').textContent));
  const [qa, qb, qc, qd, qe] = bank.questions.filter(q => q.answer.length).slice(0, 5);
  // this device answered qa; the account's copy (made before names existed) has qb
  await p.evaluate(([K, qa, qb]) => {
    localStorage.setItem(K, JSON.stringify({ answers: { [qa.id]: { sel: qa.answer, checked: true, correct: true } } }));
    localStorage.setItem('fake-docs', JSON.stringify({ 'users/u1': { s: JSON.stringify({ answers: { [qb.id]: { sel: qb.answer, checked: true, correct: true } }, clean: { [qb.id]: { s: qb.answer, ok: true, t: 5, x: 0 } }, first: {}, seals: {}, examLog: [] }) } }));
  }, [KEY, qa, qb]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200);
  const loaded0 = await p.evaluate(() => window.__fb.calls.length);
  check((await txt(p, '.nav-acct')) === 'Sign in' && /Account: Sign in/.test(await txt(p, '.foot')) && loaded0 === 0, 'guest: Sign in in the top bar and the footer, Firebase not loaded');
  check(!!(await p.$('.navlinks [data-act="weak"] .lk')) && !!(await p.$('.hero-cta [data-act="quest-go"] .lk, .qp-actions [data-act="quest-go"] .lk')), 'guest: padlocks on weak spots and the quest');

  // the sheet
  await p.click('.nav-acct'); await p.waitForTimeout(200);
  check(!!(await p.$('.acct-sheet:not([hidden]) [data-acct="google"]')) && !!(await p.$('#acct-email')) && !!(await p.$('#acct-pw')) && (await txt(p, '#acct-h')) === 'Keep your progress everywhere', 'the sheet: Google, or an email and a password');
  await p.screenshot({ path: OUT + 'acct_sheet.png' });
  await p.fill('#acct-email', 'abi@example.com'); await p.fill('#acct-pw', 'wrong-one'); await p.click('.acct-mail [type="submit"]'); await p.waitForTimeout(200);
  check(/Wrong email or password/.test(await txt(p, '.acct-msg')) && await p.inputValue('#acct-email') === 'abi@example.com', 'a wrong password says so, and the email stays typed');
  await p.click('[data-acct="forgot"]'); await p.waitForTimeout(200);
  let calls = await p.evaluate(() => window.__fb.calls);
  check(calls.includes('reset abi@example.com') && /new password is on its way/.test(await txt(p, '.acct-msg')), 'forgot your password: ' + await txt(p, '.acct-msg'));
  await p.click('[data-acct="close"]');

  // a locked feature: the sheet says why; signed in and named, the weak spots open
  await p.click('.navlinks [data-act="weak"]'); await p.waitForTimeout(200);
  check((await txt(p, '#acct-h')) === 'Weak spots need an account' && (await state(p)).view !== 'weak', 'locked: Weak spots asks to sign in');
  await p.click('[data-acct="google"]'); await p.waitForTimeout(300);
  let S = await state(p);
  check(!!S.answers[qa.id] && !!S.answers[qb.id] && !!S.clean[qb.id], 'signed in: this device\'s answer and the account\'s, both kept');
  let doc = await cloud(p);
  check(!!doc.answers[qa.id] && !!doc.answers[qb.id] && !('view' in doc) && !('session' in doc), 'the merge saved to the account (progress only)');
  check((await txt(p, '#acct-h')) === 'One last thing: your name' && await p.inputValue('#acct-newname') === 'Abi', 'then a name to pick, Abi suggested');
  await p.screenshot({ path: OUT + 'acct_name.png' });
  await p.click('.acct-naming [type="submit"]'); await p.waitForTimeout(300);
  let D = await docs(p);
  check(D['names/abi'] && D['names/abi'].uid === 'u1' && D['users/u1'].name === 'Abi' && D['users/u1'].key === 'abi' && D['users/u1'].email === 'abi@example.com' && D['users/u1'].answered >= 2, 'the name is kept: names/abi, and in the account (name, email, answered)');
  check((await state(p)).view === 'weak' && await p.evaluate(() => document.querySelector('.acct-sheet').hidden), 'and the weak spots open');
  await p.click('.bar [data-act="home"]'); await p.waitForTimeout(200);
  check((await txt(p, '.nav-acct')) === 'Abi' && (await txt(p, '.foot-store')) === 'Your answers are saved in this browser and in your account.' && !(await p.$('.navlinks .lk')), 'home: Abi in the top bar, no padlocks, saved in your account');

  // another device: an answer added and one taken back arrive live
  await p.evaluate(([qa, qd]) => {
    const o = JSON.parse(window.__fb.docs['users/u1'].s), t = Date.now();
    o.answers[qd.id] = { sel: qd.answer, checked: true, correct: true }; o.stamps['answers/' + qd.id] = t;
    delete o.answers[qa.id]; o.stamps['answers/' + qa.id] = t;
    window.__fb.remote('users/u1', { s: JSON.stringify(o) });
  }, [qa, qd]);
  await p.waitForTimeout(150);
  S = await state(p);
  check(!!S.answers[qd.id] && !S.answers[qa.id], 'live: another device\'s new answer arrives, and its "try again" too');

  // a change goes up 15 s later, merged with what the account got meanwhile (qe, written by a device the page didn't hear)
  await p.evaluate(qe => {
    const o = JSON.parse(window.__fb.docs['users/u1'].s);
    o.answers[qe.id] = { sel: qe.answer, checked: true, correct: false }; o.stamps['answers/' + qe.id] = Date.now();
    window.__fb.docs['users/u1'].s = JSON.stringify(o);
  }, qe);
  await p.click(`[data-topic="${qc.topic}"]`); await p.waitForTimeout(150);
  await p.click(`[data-start="${qc.topic}"]`); await p.waitForTimeout(150);
  S = await state(p);
  const q0 = bank.questions.find(q => q.id === S.session.qids[S.session.idx]);
  for (const i of q0.answer) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(100);
  const before = await cloud(p);
  await p.clock.fastForward(16000); await p.waitForTimeout(150);
  const after = await cloud(p);
  S = await state(p);
  check(['sure', 'comets', 'moon', 'stamps'].every(k => k in after), 'the game parts sync too: sure / not sure, comets, the moon');
  check(!before.answers[q0.id] && !!after.answers[q0.id] && !!after.answers[qe.id] && !!after.answers[qd.id] && (q0.id === qa.id || !after.answers[qa.id]) && !!S.answers[qe.id], 'saved 15 s later, merged: nothing from either device lost, the taken-back answer stays gone ' + JSON.stringify([!before.answers[q0.id], !!after.answers[q0.id], !!after.answers[qe.id], !!after.answers[qd.id], !after.answers[qa.id], !!S.answers[qe.id], q0.id === qa.id, q0.id]));

  // the next visit signs in again on its own (back on the homepage, where the top bar has the account button)
  await p.evaluate(K => { const S = JSON.parse(localStorage.getItem(K)); S.view = 'home'; localStorage.setItem(K, JSON.stringify(S)); }, KEY);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  calls = await p.evaluate(() => window.__fb.calls);
  check(calls.includes('get users/u1') && (await txt(p, '.nav-acct')) === 'Abi' && !(await p.$('.navlinks .lk')), 'next visit: signed in again, synced, unlocked');

  // change the name
  await p.click('.nav-acct'); await p.waitForTimeout(150);
  check((await txt(p, '#acct-h')) === 'Hi, Abi' && /Your name on the Den: Abi/.test(await txt(p, '.acct-card')), 'the sheet: Hi, Abi, and the name');
  await p.screenshot({ path: OUT + 'acct_in.png' });
  await p.click('[data-acct="rename"]'); await p.fill('#acct-newname', 'Abi M.'); await p.click('.acct-naming [type="submit"]'); await p.waitForTimeout(250);
  D = await docs(p);
  check(D['names/abim'] && D['names/abim'].uid === 'u1' && !D['names/abi'] && D['users/u1'].name === 'Abi M.' && (await txt(p, '.nav-acct')) === 'Abi M.', 'renamed: Abi M. (the old name is free again)');

  // sign out: padlocks are back, this device keeps its answers
  await p.click('[data-acct="out"]'); await p.waitForTimeout(200);
  check((await txt(p, '.nav-acct')) === 'Sign in' && await p.evaluate(() => localStorage.getItem('efm3-acct')) === null && !!(await state(p)).answers[qd.id] && !!(await p.$('.navlinks .lk')), 'signed out: Sign in, padlocks back, this device keeps its answers');

  // an email account: a lookalike of a taken name is refused, another works
  await p.click('.nav-acct'); await p.waitForTimeout(150);
  await p.click('[data-acct="mode-new"]'); await p.waitForTimeout(100);
  check(!!(await p.$('#acct-name')) && (await p.getAttribute('#acct-pw', 'autocomplete')) === 'new-password', 'create an account: name, email, new password');
  await p.fill('#acct-name', 'a.bii-M'); await p.fill('#acct-email', 'sara@example.com'); await p.fill('#acct-pw', 'secret1');
  await p.click('.acct-mail [type="submit"]'); await p.waitForTimeout(300);
  check((await txt(p, '#acct-h')) === 'One last thing: your name' && /too close to a name that is/.test(await txt(p, '.acct-msg')), 'a.bii-M: too close to Abi M., refused');
  await p.fill('#acct-newname', 'Sara'); await p.click('.acct-naming [type="submit"]'); await p.waitForTimeout(300);
  D = await docs(p);
  check(D['names/sara'] && D['names/sara'].uid === 'u2' && D['names/abim'].uid === 'u1' && (await txt(p, '#acct-h')) === 'Hi, Sara' && (await txt(p, '.nav-acct')) === 'Sara', 'Sara: account made and named');
  await p.click('[data-acct="out"]'); await p.waitForTimeout(200);
  await p.click('.nav-acct'); await p.waitForTimeout(150);
  await p.click('[data-acct="mode-new"]'); await p.fill('#acct-name', 'Salma'); await p.fill('#acct-email', 'sara@example.com'); await p.fill('#acct-pw', 'secret1');
  await p.click('.acct-mail [type="submit"]'); await p.waitForTimeout(200);
  check(/already an account with this email/.test(await txt(p, '.acct-msg')), 'the same email twice: sign in instead');
  await p.click('[data-acct="mode-in"]'); await p.fill('#acct-pw', 'secret1');
  await p.click('.acct-mail [type="submit"]'); await p.waitForTimeout(300);
  check((await txt(p, '.nav-acct')) === 'Sara', 'signed in with the password: Sara');
  await p.click('[data-acct="out"]'); await p.waitForTimeout(200);

  // delete my data: the copy, the name and the account
  await p.click('.nav-acct'); await p.waitForTimeout(150);
  await p.click('[data-acct="google"]'); await p.waitForTimeout(300);
  await p.click('[data-acct="erase"]'); await p.waitForTimeout(100);
  check(/Delete your account and its saved progress\?/.test(await txt(p, '.acct-card .confirm')), 'Delete my data asks first');
  await p.click('[data-acct="erase-yes"]'); await p.waitForTimeout(250);
  calls = await p.evaluate(() => window.__fb.calls); D = await docs(p);
  check(calls.includes('deleteUser') && !D['users/u1'] && !D['names/abim'] && !!D['names/sara'] && (await txt(p, '.nav-acct')) === 'Sign in', 'deleted: the copy, the name and the account');

  // the phone's top bar: a small square instead of the word
  await p.setViewportSize({ width: 360, height: 780 }); await p.waitForTimeout(150);
  const sq = await p.evaluate(() => { const b = document.querySelector('.nav-acct').getBoundingClientRect(), n = document.querySelector('.topnav').getBoundingClientRect(); return { w: Math.round(b.width), in: b.right <= n.right + 0.5, wide: document.documentElement.scrollWidth > innerWidth }; });
  check(sq.w === 34 && sq.in && !sq.wide, 'phone: the account square fits the top bar ' + JSON.stringify(sq));
  await p.screenshot({ path: OUT + 'acct_phone.png', clip: { x: 0, y: 0, width: 360, height: 120 } });
  await p.setViewportSize({ width: 1280, height: 900 }); await p.waitForTimeout(100);

  // a database that refuses
  await p.evaluate(() => localStorage.setItem('fake-deny', '1'));
  await p.click('.nav-acct'); await p.waitForTimeout(150);
  await p.click('[data-acct="google"]'); await p.waitForTimeout(300);
  check(/database rules need setting/.test(await txt(p, '.acct-card')), 'rules not set: says so');
  await ctx.close();

  // the claude.ai copy (not GitHub Pages): no account, nothing locked
  const c2 = await b.newContext();
  const p2 = await c2.newPage();
  await p2.goto(URL, { waitUntil: 'load' });
  check(!(await p2.$('.nav-acct')) && !/Account:/.test(await txt(p2, '.foot')) && await p2.evaluate(() => [...document.querySelectorAll('.lk')].every(l => l.closest('.th-wrap'))), 'elsewhere: no Sign in, no padlocks');
  await c2.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
