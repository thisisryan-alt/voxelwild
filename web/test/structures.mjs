// Fixed viewpoints for visual checks: node test/shots.mjs [seed] [hour]
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dist = join(root, 'dist'), out = join(root, 'test', 'out');
mkdirSync(out, { recursive: true });
const seed = process.argv[2] || '20260925', hour = +(process.argv[3] || 10.5);
const server = http.createServer((req, res) => {
  const p = join(dist, new URL(req.url, 'http://x').pathname.replace(/^\/+/, '') || 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  let body = readFileSync(p);
  if (p.endsWith('index.html')) body = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>' + body + '</body></html>';
  res.writeHead(200, { 'content-type': { '.html': 'text/html', '.webp': 'image/webp', '.bin': 'application/octet-stream' }[extname(p)] || 'application/octet-stream' }); res.end(body);
});
await new Promise((r) => server.listen(0, r));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'], defaultViewport: { width: 1280, height: 720 } });
const page = await browser.newPage();
if (process.env.VIEWPORT) { const [w, h] = process.env.VIEWPORT.split('x').map(Number); await page.setViewport({ width: w, height: h, isMobile: !!process.env.MOBILE, hasTouch: !!process.env.MOBILE, deviceScaleFactor: process.env.MOBILE ? 2 : 1 }); }
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn' || m.text().startsWith('upload') || m.text().startsWith('free')) console.log('[' + m.type() + ']', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.evaluateOnNewDocument(() => { window.__trace = '-8,2,6'; });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.voxelwild && (window.voxelwild.game.icons || !document.getElementById('fatal').hidden), { timeout: 30000 });
const fatal = await page.evaluate(() => document.getElementById('fatal').hidden ? '' : document.getElementById('fatalMsg').textContent); if (fatal) { console.log('FATAL', fatal); process.exit(1); }
await page.waitForFunction(() => window.voxelwild.game.state === 'menu', { timeout: 60000 }); await new Promise((r) => setTimeout(r, 1200));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.evaluate(() => window.voxelwild.ui.play({ id: 'st', name: 'T', seed: 20260925, mode: 'creative', unsaved: true, created: 0, lastPlayed: 0 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
// the nearest structure of each kind
const found = await page.evaluate(() => {
  const { structuresIn, terrainFor } = window.voxelwild.structures, g = window.voxelwild.game, T = terrainFor(g.meta.seed);
  const best = {};
  for (let r = 0; r < 3000; r += 400) {
    for (const s of structuresIn(g.meta.seed, T, -r - 400, -r - 400, r + 400, r + 400)) {
      const d = Math.hypot(s.x, s.z);
      if (!best[s.kind] || d < best[s.kind].d) best[s.kind] = { d, x: s.x, y: s.y, z: s.z, kind: s.kind, n: s.pieces ? s.pieces.length : 0, style: s.style };
    }
  }
  return best;
});
console.log(JSON.stringify(found));
const views = { village: [0, 22, 26, -0.55], outpost: [0, 40, 28, -0.6], pyramid: [0, 28, 30, -0.45], well: [0, 12, 8, -0.7], igloo: [0, 10, 9, -0.6], portal: [0, 10, 11, -0.4], hut: [0, 10, 12, -0.4], dungeon: [0, 3, 0, -0.9] };
const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(views);
for (const k of only) {
  const s = found[k]; if (!s) { console.log('none', k); continue; }
  const v = views[k];
  const y = k === 'dungeon' ? s.y + 3 : k === 'pyramid' ? s.y + 14 : k === 'outpost' ? s.y + 4 : s.y;
  await page.evaluate((s, v, y) => { const g = window.voxelwild.game; g.player.flying = true; g.player.teleport([s.x + 0.5 + v[0], y + v[1], s.z + 0.5 + v[2]], 0, v[3]); }, s, v, y);
  await wait(9000);
  await page.screenshot({ path: join(out, `struct-${k}.png`) });
}
console.log('mobs', await page.evaluate(() => window.voxelwild.game.mobs.list.map((m) => m.type).join(',')));
console.log('errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
