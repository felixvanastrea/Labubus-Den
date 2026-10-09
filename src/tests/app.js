// Installing the Den as an app: the manifest and its icons, the "Install the app" buttons (homepage and footer) on
// phones, the browser's own prompt where there is one (faked here), the steps sheet on an iPhone, and nothing once
// the Den runs as the app. window.__appTest stands in for GitHub Pages. Screenshots: shots/app_*.png.
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || path.join(__dirname, 'shots') + '/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const URL = BASE + '/index.html';
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) fails++; };

async function open(b, opts, init) {
  const ctx = await b.newContext({ reducedMotion: 'reduce', ...opts });
  await ctx.addInitScript(init || (() => { window.__appTest = true; }));
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await p.goto(URL, { waitUntil: 'load' }); await p.waitForTimeout(500);
  return [ctx, p];
}
const errors = [];

(async () => {
  const b = await chromium.launch();

  // the manifest and its icons
  {
    const [ctx, p] = await open(b, { viewport: { width: 1280, height: 900 } });
    // the head tags are in the real index.html (the test copy is built without its head)
    const head = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').split('</head>')[0];
    const href = (head.match(/<link rel="manifest" href="([^"]+)">/) || [])[1];
    check(!!href && /apple-mobile-web-app-capable" content="yes"/.test(head) && /apple-touch-icon/.test(head), 'index.html links the manifest and the iPhone app tags');
    const res = await p.request.get(BASE + '/' + (href || 'manifest.webmanifest'));
    const m = await res.json();
    const icons = await Promise.all(m.icons.map(async i => (await p.request.get(BASE + '/' + i.src)).status()));
    check(res.ok() && m.display === 'standalone' && m.start_url === './' && m.icons.some(i => i.purpose === 'maskable') && icons.every(s => s === 200),
      `manifest: ${m.short_name}, ${m.display}, ${m.icons.length} icons (${icons.join(' ')})`);
    // a computer with no install prompt: no buttons
    check(!(await p.isVisible('.app-ask')) && !(await p.isVisible('.foot-app')), 'a computer without the browser’s prompt: no install button');
    // the browser offers its prompt (Chrome, Edge): the buttons appear and use it
    await p.evaluate(() => {
      const e = new Event('beforeinstallprompt'); window.__prompted = 0;
      e.prompt = () => { window.__prompted++; return Promise.resolve(); };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
    await p.waitForTimeout(100);
    check(await p.isVisible('.app-ask') && /Install the app/.test(await p.textContent('.app-ask')), 'the browser offers to install: the button appears on the homepage');
    await (await p.$('.app-ask')).screenshot({ path: OUT + 'app_home.png' });
    await p.click('.app-ask [data-act="install-app"]'); await p.waitForTimeout(200);
    check(await p.evaluate(() => window.__prompted) === 1 && !(await p.isVisible('.app-sheet')), 'it opens the browser’s own install prompt');
    await ctx.close();
  }

  // an iPhone: the buttons, and the steps from the Share menu
  {
    const [ctx, p] = await open(b, { ...devices['iPhone 13'] });
    check(await p.isVisible('.app-ask'), 'iPhone: "Install the app" on the homepage');
    check(!!(await p.$('.foot-app:not([hidden])')), 'and in the footer');
    await p.tap('.app-ask [data-act="install-app"]'); await p.waitForTimeout(300);
    const t = ((await p.textContent('.app-sheet')) || '').replace(/\s+/g, ' ');
    check(await p.isVisible('.app-sheet') && /Share/.test(t) && /Add to Home Screen/.test(t) && /sign in once/.test(t), 'the steps: Share, Add to Home Screen, sign in once');
    const box = await p.evaluate(() => { const r = document.querySelector('.app-sheet .acct-card').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), innerWidth]; });
    check(box[0] >= 0 && box[1] <= box[2], 'the sheet fits the screen ' + JSON.stringify(box));
    await p.screenshot({ path: OUT + 'app_iphone.png' });
    await p.tap('[data-app="ok"]'); await p.waitForTimeout(200);
    check(!(await p.isVisible('.app-sheet')), 'Got it closes it');
    await ctx.close();
  }

  // an Android phone whose browser has no prompt: the steps from the browser's menu
  {
    const [ctx, p] = await open(b, { ...devices['Pixel 7'] });
    await p.tap('.app-ask [data-act="install-app"]'); await p.waitForTimeout(300);
    const t = ((await p.textContent('.app-sheet')) || '').replace(/\s+/g, ' ');
    check(/Install app/.test(t) && /menu/.test(t), 'Android without the prompt: the steps from the browser’s menu');
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    check(!(await p.isVisible('.app-sheet')), 'Escape closes it');
    await ctx.close();
  }

  // already the app: no buttons
  {
    const [ctx, p] = await open(b, { ...devices['iPhone 13'] }, () => { window.__appTest = true; Object.defineProperty(navigator, 'standalone', { value: true }); });
    check(!(await p.$('.app-ask')) && !(await p.$('.foot-app')), 'opened from the home screen: no install buttons');
    await ctx.close();
  }

  // not on GitHub Pages (the claude.ai link): nothing
  {
    const [ctx, p] = await open(b, { ...devices['iPhone 13'] }, () => {});
    check(!(await p.$('.app-ask')) && !(await p.$('.foot-app')), 'off GitHub Pages: no install buttons');
    await ctx.close();
  }

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  console.log(fails ? `${fails} FAILED` : 'all passed');
  await b.close();
  process.exitCode = fails || errors.length ? 1 : 0;
})();
