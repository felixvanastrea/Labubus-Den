const { chromium } = require('playwright');
const OUT = process.env.OUT || require('path').join(__dirname, 'shots') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const QUERIES = ['pneumonia', 'acute bronchitis', 'bronchitis', 'BPCO', 'IDM', 'bronchitsi', 'acute bronchitsi', 'pneumonia treatment', 'pnemonia',
  'tb', 'tuberculosis', 'diabetes', 'hydatid cyst', 'graves', 'Basedow', 'scabies', 'gale', 'aortic stenosis', 'rétrécissement aortique',
  'GERD', 'RGO', 'EP', 'embolie pulmonaire', 'crohn', "crohn's disease", 'hernia surgery', 'risk factors gastric cancer', 'signs', 'zzzz', 'mitral'];
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'networkidle' });
  await p.screenshot({ path: OUT + 'v5_home.png', fullPage: false });
  const summary = async () => p.evaluate(() => {
    const t = s => (document.querySelector(s) || {}).textContent;
    return {
      count: (t('.sr-count') || '').replace(/\s+/g, ' ').trim(),
      topics: [...document.querySelectorAll('.tchip')].map(x => x.textContent.trim()),
      aspects: [...document.querySelectorAll('[data-aspect]')].map(x => x.textContent.replace(/\s+/g, ' ').trim() + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')),
      rows: document.querySelectorAll('[data-res]').length,
      groups: [...document.querySelectorAll('#search-results .group > h2')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
      bodyHidden: document.getElementById('home-body').hidden
    };
  });
  for (const q of QUERIES) {
    await p.fill('#q', '');
    await p.type('#q', q, { delay: 5 });
    await p.waitForTimeout(30);
    const s = await summary();
    console.log(`\n[${q}] ${s.count} | topics: ${s.topics.join(' ; ')} | rows ${s.rows}\n   groups: ${s.groups.join(' | ')}\n   aspects: ${s.aspects.join(' · ')}`);
  }
  // focus kept while typing?
  await p.fill('#q', '');
  await p.type('#q', 'acute bronchitis', { delay: 20 });
  console.log('\nfocus still in input:', await p.evaluate(() => document.activeElement && document.activeElement.id), 'value:', await p.inputValue('#q'));
  await p.screenshot({ path: OUT + 'v5_search_bronchitis.png', fullPage: true });
  // aspect filter
  await p.fill('#q', ''); await p.type('#q', 'bronchitis', { delay: 5 });
  const asp = await p.$('[data-aspect]:not([data-aspect="all"])');
  if (asp) { await asp.click(); console.log('after aspect click:', JSON.stringify(await summary())); await p.click('[data-aspect="all"]'); }
  // open a result (3rd)
  const rows = await p.$$('[data-res]');
  await rows[2].click();
  const quiz = await p.evaluate(() => ({
    title: document.querySelector('.bar-title').textContent, count: document.querySelector('.bar-count').textContent,
    rep: (document.querySelector('.qmeta .rep') || {}).textContent || '', also: (document.querySelector('.alsoin') || {}).textContent || ''
  }));
  console.log('quiz from search:', JSON.stringify(quiz));
  await p.screenshot({ path: OUT + 'v5_quiz_from_search.png' });
  await p.click('button[data-act="back"]');
  console.log('back -> query kept:', await p.inputValue('#q'), '| rows:', (await p.$$('[data-res]')).length);
  // clear
  await p.click('button[data-act="clear-search"]');
  console.log('cleared: body visible', await p.evaluate(() => !document.getElementById('home-body').hidden), 'examples', (await p.$$('[data-example]')).length);
  // example chip
  await p.click('[data-example="IDM"]');
  console.log('example IDM:', JSON.stringify(await summary()));
  await p.click('button[data-act="clear-search"]');
  // repeats view
  await p.click('button[data-act="repeats"]');
  await p.screenshot({ path: OUT + 'v5_repeats.png', fullPage: false });
  const top = await p.evaluate(() => [...document.querySelectorAll('.entry.ranked')].slice(0, 8).map(b => b.innerText.replace(/\s+/g, ' ').slice(0, 150)));
  console.log('\nrepeats top:\n ' + top.join('\n '));
  console.log('repeat rows:', (await p.$$('.entry.ranked')).length);
  await p.click('[data-repmod="respiratory-system-diseases"]');
  console.log('respiratory rows:', (await p.$$('.entry.ranked')).length, '| button:', (await p.textContent('[data-act="practice-top"]')).trim());
  await (await p.$$('.entry.ranked'))[0].click();
  console.log('cluster quiz:', await p.textContent('.bar-title'), await p.textContent('.bar-count'));
  await p.screenshot({ path: OUT + 'v5_cluster_quiz.png' });
  await p.click('button[data-act="back"]');
  console.log('back from cluster ->', await p.textContent('.bar-title'));
  await p.click('button[data-act="practice-top"]');
  console.log('top quiz:', await p.textContent('.bar-title'), await p.textContent('.bar-count'));
  await p.click('button[data-act="back"]');
  await p.click('button[data-act="home"]');
  // module page repeated-only
  await p.click('button[data-topic="cardio-vascular-system-disease"]');
  console.log('\nmodule buttons:', (await p.textContent('.page-head .row')).replace(/\s+/g, ' ').trim());
  await p.screenshot({ path: OUT + 'v5_module.png' });
  await p.click('button[data-act="practice-repeated"]');
  console.log('repeated-only quiz:', await p.textContent('.bar-title'), await p.textContent('.bar-count'));
  await p.click('button[data-act="back"]');
  console.log('back ->', await p.textContent('.bar-title'));
  // mobile + dark
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', reducedMotion: 'reduce' })).newPage();
  m.on('pageerror', e => errors.push('mobile: ' + e.message));
  await m.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await m.screenshot({ path: OUT + 'v5_m_home_dark.png' });
  await m.tap('#q');
  await m.type('#q', 'pneumonia treatment', { delay: 10 });
  await m.screenshot({ path: OUT + 'v5_m_search_dark.png' });
  console.log('\nmobile overflow (search):', await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await (await m.$$('[data-res]'))[0].tap();
  await m.screenshot({ path: OUT + 'v5_m_quiz_dark.png' });
  console.log('mobile overflow (quiz):', await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await m.tap('button[data-act="back"]');
  await m.tap('button[data-act="clear-search"]');
  await m.tap('.feature button[data-act="repeats"]');
  await m.screenshot({ path: OUT + 'v5_m_repeats_dark.png' });
  console.log('mobile overflow (repeats):', await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  console.log('\nERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
