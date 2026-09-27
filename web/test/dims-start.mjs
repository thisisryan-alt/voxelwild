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
const res = {};
for (const [name, extra] of [['nether', { startDim: 1 }], ['end', { startDim: 2 }], ['flat', { flat: true }]]) {
  await page.evaluate((extra) => window.voxelwild.ui.play({ id: 'x' + Math.random(), name: 'T', seed: 20260925, mode: 'creative', unsaved: true, created: 0, lastPlayed: 0, ...extra }, true), extra);
  await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
  await wait(2500);
  res[name] = await page.evaluate(() => { const g = window.voxelwild.game, p = g.player.body.pos; return { dim: g.dim, pos: p.map((v) => +v.toFixed(1)), below: g.world.getBlock(Math.floor(p[0]), Math.floor(p[1] - 0.1), Math.floor(p[2])), inside: g.player.body.overlapping(g.world).length, portals: (g.meta.portals || []).length }; });
  await page.screenshot({ path: join(out, `start-${name}.png`) });
  await page.evaluate(async () => { await window.voxelwild.game.save(); window.voxelwild.ui.toTitle(); });
  await wait(1000);
}
// creative travel from the pause menu
await page.evaluate(() => window.voxelwild.ui.play({ id: 'y1', name: 'T', seed: 7, mode: 'creative', unsaved: true, created: 0, lastPlayed: 0 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await page.evaluate(() => window.voxelwild.game.goToDimension(2));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing' && window.voxelwild.game.dim === 2, { timeout: 120000 });
res.travelEnd = await page.evaluate(() => window.voxelwild.game.dim);
console.log(JSON.stringify(res));
await browser.close(); server.close();
