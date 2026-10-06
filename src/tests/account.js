// Accounts, against a fake Firebase served in place of the real SDK: guests see "Sign in" (top bar and footer) and the
// sheet (Google, or email and password: wrong password, forgot password, create an account with a first name, the same
// email twice); signing in merges the account's copy with this device's (both answers kept) and saves the merge back;
// the name shows; a visit later signs in again on its own; a change is saved 15 s later; sign out; delete my data
// (the copy and the account); the phone's top bar; a database that refuses says so; the claude.ai copy shows nothing.
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

const FAKE = {
  app: `export function initializeApp(c) { window.__fb.config = c; return {}; }`,
  auth: `const fb = window.__fb; const cbs = [];
    const emit = () => cbs.forEach(cb => cb(fb.user));
    const keep = () => { if (fb.user) localStorage.setItem('fake-user', JSON.stringify(fb.user)); else localStorage.removeItem('fake-user'); };
    export function getAuth() { return {}; }
    export function onAuthStateChanged(a, cb) { cbs.push(cb); setTimeout(() => cb(fb.user), 0); }
    export class GoogleAuthProvider {}
    export async function signInWithPopup() { fb.calls.push('popup'); fb.user = { uid: 'u1', displayName: 'Abi Test', email: 'abi@example.com' }; keep(); emit(); }
    export async function signInWithRedirect() { fb.calls.push('redirect'); }
    const accts = () => JSON.parse(localStorage.getItem('fake-accounts') || '{}');
    const fail = c => { const e = new Error(c); e.code = 'auth/' + c; throw e; };
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
      const all = accts(); all[u.email].name = p.displayName; localStorage.setItem('fake-accounts', JSON.stringify(all)); keep();
    }
    export async function sendPasswordResetEmail(a, email) { fb.calls.push('reset ' + email); }
    export async function signOut() { fb.calls.push('signout'); fb.user = null; keep(); emit(); }
    export async function deleteUser() { fb.calls.push('deleteUser'); fb.user = null; keep(); emit(); }`,
  firestore: `const fb = window.__fb;
    const keep = () => localStorage.setItem('fake-docs', JSON.stringify(fb.docs));
    export function getFirestore() { return {}; }
    export function doc(db, col, id) { return col + '/' + id; }
    export async function getDoc(ref) { fb.calls.push('get ' + ref); if (localStorage.getItem('fake-deny')) { const e = new Error('no'); e.code = 'permission-denied'; throw e; } const d = fb.docs[ref]; return { exists: () => !!d, data: () => d }; }
    export async function setDoc(ref, data) { fb.calls.push('set ' + ref); fb.docs[ref] = { s: data.s }; keep(); }
    export async function deleteDoc(ref) { fb.calls.push('delete ' + ref); delete fb.docs[ref]; keep(); }
    export function serverTimestamp() { return 0; }`,
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
  const [qa, qb, qc] = bank.questions.filter(q => q.answer.length).slice(0, 3);
  // this device answered qa; the account's copy has qb
  await p.evaluate(([K, qa, qb]) => {
    localStorage.setItem(K, JSON.stringify({ answers: { [qa.id]: { sel: qa.answer, checked: true, correct: true } } }));
    localStorage.setItem('fake-docs', JSON.stringify({ 'users/u1': { s: JSON.stringify({ answers: { [qb.id]: { sel: qb.answer, checked: true, correct: true } }, clean: { [qb.id]: { s: qb.answer, ok: true, t: 5, x: 0 } }, first: {}, seals: {}, examLog: [] }) } }));
  }, [KEY, qa, qb]);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(200);
  const loaded0 = await p.evaluate(() => window.__fb.calls.length);
  check((await txt(p, '.nav-acct')) === 'Sign in' && /Account: Sign in/.test(await txt(p, '.foot')) && loaded0 === 0, 'guest: Sign in in the top bar and the footer, Firebase not loaded');

  // the sheet
  await p.click('.nav-acct'); await p.waitForTimeout(200);
  check(!!(await p.$('.acct-sheet:not([hidden]) [data-acct="google"]')) && !!(await p.$('#acct-email')) && !!(await p.$('#acct-pw')) && (await txt(p, '#acct-h')) === 'Keep your progress everywhere', 'the sheet: Google, or an email and a password');
  await p.screenshot({ path: OUT + 'acct_sheet.png' });
  await p.fill('#acct-email', 'abi@example.com'); await p.fill('#acct-pw', 'wrong-one'); await p.click('.acct-mail [type="submit"]'); await p.waitForTimeout(200);
  check(/Wrong email or password/.test(await txt(p, '.acct-msg')) && await p.inputValue('#acct-email') === 'abi@example.com', 'a wrong password says so, and the email stays typed');
  await p.click('[data-acct="forgot"]'); await p.waitForTimeout(200);
  let calls = await p.evaluate(() => window.__fb.calls);
  check(calls.includes('reset abi@example.com') && /new password is on its way/.test(await txt(p, '.acct-msg')), 'forgot your password: ' + await txt(p, '.acct-msg'));

  // Google: the two copies merge, and the merge goes back up
  await p.click('[data-acct="google"]'); await p.waitForTimeout(300);
  let S = await state(p);
  check(!!S.answers[qa.id] && !!S.answers[qb.id] && !!S.clean[qb.id], 'signed in: this device\'s answer and the account\'s, both kept');
  const doc = await p.evaluate(() => JSON.parse(window.__fb.docs['users/u1'].s));
  check(!!doc.answers[qa.id] && !!doc.answers[qb.id] && !('view' in doc) && !('session' in doc), 'the merge saved to the account (progress only)');
  check((await txt(p, '#acct-h')) === 'Hi, Abi' && /Signed in as abi@example\.com/.test(await txt(p, '.acct-p')), 'the sheet: Hi, Abi');
  await p.screenshot({ path: OUT + 'acct_in.png' });
  await p.click('[data-acct="close"]');
  check((await txt(p, '.nav-acct')) === 'Abi' && (await txt(p, '.foot-store')) === 'Your answers are saved in this browser and in your account.', 'the top bar says Abi; the footer, saved in your account');

  // a change goes up 15 s later
  await p.click(`[data-topic="${qc.topic}"]`); await p.waitForTimeout(150);
  await p.click(`[data-start="${qc.topic}"]`); await p.waitForTimeout(150);
  S = await state(p);
  const q0 = bank.questions.find(q => q.id === S.session.qids[S.session.idx]);
  for (const i of q0.answer) await p.click(`.opt[data-opt="${i}"]`);
  await p.click('[data-act="primary"]'); await p.waitForTimeout(100);
  const before = await p.evaluate(() => JSON.parse(window.__fb.docs['users/u1'].s));
  await p.clock.fastForward(16000); await p.waitForTimeout(100);
  const after = await p.evaluate(() => JSON.parse(window.__fb.docs['users/u1'].s));
  check(!before.answers[q0.id] && !!after.answers[q0.id], 'an answer is saved to the account 15 s later');

  // the next visit signs in again on its own (back on the homepage, where the top bar has the account button)
  await p.evaluate(K => { const S = JSON.parse(localStorage.getItem(K)); S.view = 'home'; localStorage.setItem(K, JSON.stringify(S)); }, KEY);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300);
  calls = await p.evaluate(() => window.__fb.calls);
  check(calls.includes('get users/u1') && (await txt(p, '.nav-acct')) === 'Abi', 'next visit: signed in again, synced');

  // sign out
  await p.click('.nav-acct'); await p.waitForTimeout(150);
  await p.click('[data-acct="out"]'); await p.waitForTimeout(200);
  check((await txt(p, '.nav-acct')) === 'Sign in' && await p.evaluate(() => localStorage.getItem('efm3-acct')) === null && !!(await state(p)).answers[qa.id], 'signed out: Sign in again, this device keeps its answers');

  // delete my data
  await p.click('.nav-acct'); await p.waitForTimeout(150);
  await p.click('[data-acct="google"]'); await p.waitForTimeout(300);
  await p.click('[data-acct="erase"]'); await p.waitForTimeout(100);
  check(/Delete your account and its saved progress\?/.test(await txt(p, '.acct-card .confirm')), 'Delete my data asks first');
  await p.click('[data-acct="erase-yes"]'); await p.waitForTimeout(250);
  calls = await p.evaluate(() => window.__fb.calls);
  check(calls.includes('delete users/u1') && calls.includes('deleteUser') && await p.evaluate(() => !window.__fb.docs['users/u1']) && (await txt(p, '.nav-acct')) === 'Sign in', 'deleted: the copy and the account');

  // an account made with an email and a password: the name shows, a second try with the same email is refused, then sign in again
  await p.click('.nav-acct'); await p.waitForTimeout(150);
  await p.click('[data-acct="mode-new"]'); await p.waitForTimeout(100);
  check(!!(await p.$('#acct-name')) && (await p.getAttribute('#acct-pw', 'autocomplete')) === 'new-password', 'create an account: first name, email, new password');
  await p.fill('#acct-name', 'Abi'); await p.fill('#acct-email', 'abi2@example.com'); await p.fill('#acct-pw', 'secret1');
  await p.screenshot({ path: OUT + 'acct_new.png' });
  await p.click('.acct-mail [type="submit"]'); await p.waitForTimeout(300);
  calls = await p.evaluate(() => window.__fb.calls);
  check(calls.includes('create abi2@example.com') && calls.includes('name Abi') && calls.includes('set users/u2') && (await txt(p, '#acct-h')) === 'Hi, Abi' && (await txt(p, '.nav-acct')) === 'Abi', 'account created: Hi, Abi, progress saved');
  await p.click('[data-acct="out"]'); await p.waitForTimeout(200);
  await p.click('.nav-acct'); await p.waitForTimeout(150);
  await p.click('[data-acct="mode-new"]'); await p.fill('#acct-email', 'abi2@example.com'); await p.fill('#acct-pw', 'secret1');
  await p.click('.acct-mail [type="submit"]'); await p.waitForTimeout(200);
  check(/already an account with this email/.test(await txt(p, '.acct-msg')), 'the same email twice: sign in instead');
  await p.click('[data-acct="mode-in"]'); await p.fill('#acct-pw', 'secret1');
  await p.click('.acct-mail [type="submit"]'); await p.waitForTimeout(300);
  check((await txt(p, '.nav-acct')) === 'Abi' && calls.length < (await p.evaluate(() => window.__fb.calls)).length && (await p.evaluate(() => window.__fb.calls)).includes('get users/u2'), 'signed in with the password');
  await p.click('[data-acct="out"]'); await p.waitForTimeout(200);

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

  // the claude.ai copy (not GitHub Pages): no account at all
  const c2 = await b.newContext();
  const p2 = await c2.newPage();
  await p2.goto(URL, { waitUntil: 'load' });
  check(!(await p2.$('.nav-acct')) && !/Account:/.test(await txt(p2, '.foot')), 'elsewhere: no Sign in');
  await c2.close();

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
