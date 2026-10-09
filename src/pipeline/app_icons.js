// The home-screen app's icons, drawn from Abi's Labubu (src/labubu.svg): the head in bone on a charcoal square, like
// the tab icon. icon-192.png and icon-512.png for browsers; icon-maskable-512.png keeps the head inside the circle
// Android cuts icons to. Run from the repo root after changing the art:
//   NODE_PATH=$(npm root -g) node src/pipeline/app_icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const art = fs.readFileSync(path.join(ROOT, 'src', 'labubu.svg'), 'utf8');
const box = art.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const d = k => art.match(new RegExp(`<path id="${k}" d="([^"]+)"`))[1];
const BG = '#1b1a18', BONE = '#ece3d1';

// size: the png's side; h: the head's height as a share of it
function svg(size, h) {
  const [x, y, w, hh] = box, side = hh / h, cx = x + w / 2, cy = y + hh / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${cx - side / 2} ${cy - side / 2} ${side} ${side}">
    <rect x="${cx - side / 2}" y="${cy - side / 2}" width="${side}" height="${side}" fill="${BG}"/>
    <path fill="${BONE}" d="${d('face')}"/><path fill="${BG}" d="${d('line')}"/></svg>`;
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [file, size, h] of [['icon-192.png', 192, .72], ['icon-512.png', 512, .72], ['icon-maskable-512.png', 512, .56]]) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:${BG}">${svg(size, h)}</body></html>`);
    await p.screenshot({ path: path.join(ROOT, file), clip: { x: 0, y: 0, width: size, height: size } });
    console.log(file, size);
  }
  await b.close();
})();
