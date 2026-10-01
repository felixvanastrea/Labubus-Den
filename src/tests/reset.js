const { chromium } = require('playwright');
const OUT = process.env.OUT || require('path').join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await ctx.newPage();
  m.on('pageerror', e => errors.push(e.message));
  await m.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  console.log('reset visible with no answers:', !!(await m.$('button[data-act="reset"]')));
  // answer 2 questions in cardio, 1 in derm
  await m.tap('button[data-topic="cardio-vascular-system-disease"]');
  await m.tap('button[data-start="cardio-vascular-system-disease"]');
  for (let i = 0; i < 2; i++) { await m.tap('button[data-opt="0"]'); await m.tap('button[data-act="primary"]'); await m.tap('button[data-act="primary"]'); }
  await m.tap('button[data-act="back"]');
  await m.screenshot({ path: OUT + 'v4_topic_reset.png' });
  await m.tap('button[data-act="home"]');
  await m.tap('button[data-topic="dermatology"]');
  await m.tap('button[data-start="dermatology"]');
  await m.tap('button[data-opt="1"]'); await m.tap('button[data-act="primary"]');
  await m.tap('button[data-act="back"]'); await m.tap('button[data-act="home"]');
  await m.screenshot({ path: OUT + 'v4_home.png' });
  const count = () => m.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('efm3-mcq-bank-v1')).answers).length);
  console.log('saved answers before:', await count());
  // module reset (cardio)
  await m.tap('button[data-topic="cardio-vascular-system-disease"]');
  await m.tap('button[data-act="reset"]');
  console.log('module confirm:', (await m.textContent('.confirm')).replace(/\s+/g, ' ').trim());
  await m.tap('button[data-act="reset-yes"]');
  console.log('after module reset:', await count());
  // global reset
  await m.tap('button[data-act="home"]');
  await m.tap('button[data-act="reset"]');
  await m.screenshot({ path: OUT + 'v4_home_confirm.png' });
  console.log('global confirm:', (await m.textContent('.confirm')).replace(/\s+/g, ' ').trim());
  await m.tap('button[data-act="reset-yes"]');
  console.log('after global reset:', await count(), 'resume card:', !!(await m.$('.resume')));
  console.log('overflow', await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
