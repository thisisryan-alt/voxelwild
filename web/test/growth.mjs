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
await page.evaluate(() => { window.voxelwild.game.noVillageStart = true; window.voxelwild.ui.play({ id: 'gr', name: 'Growth', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2500);
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, I = window.voxelwild.items, { C } = window.voxelwild.blocksMod;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
  g.settings.mobs = false; g.mobs.list.length = 0;
  const p = g.player.body.pos.map(Math.floor), Y = p[1] + 30;
  for (let dx = -12; dx <= 12; dx++) for (let dz = -14; dz <= 4; dz++) { w.setBlock(p[0] + dx, Y - 1, p[2] + dz, 3); for (let dy = 0; dy < 14; dy++) w.setBlock(p[0] + dx, Y + dy, p[2] + dz, 0); }
  g.player.teleport([p[0] + 0.5, Y, p[2] + 3.5], 0, 0.1);
  await wait(500);
  // saplings of each wood, grown by the clock
  const saps = ['oak', 'birch', 'spruce', 'jungle', 'acacia', 'cherry'];
  saps.forEach((s, i) => { const x = p[0] - 10 + i * 4, z = p[2] - 8; w.setBlock(x, Y, z, C[s + '_sapling']); g.meta.saplings = { ...(g.meta.saplings || {}), [g.bkey(x, Y, z)]: -1000 }; });
  g.updateSaplings();
  out.grown = saps.map((s, i) => w.getBlock(p[0] - 10 + i * 4, Y + 1, p[2] - 8));
  // bone meal on grass and on a crop
  const I2 = I;
  g.inventory.slots[g.inventory.selected] = { item: I2.BoneMeal, count: 10 };
  g.useBoneMeal({ hit: [p[0], Y - 1, p[2] - 2], block: 3 });
  let plants = 0; for (let dx = -3; dx <= 3; dx++) for (let dz = -5; dz <= 1; dz++) if (w.getBlock(p[0] + dx, Y, p[2] + dz) > 0) plants++;
  out.plants = plants; out.left = g.inventory.held.count;
  return out;
});
await wait(1500);
await page.screenshot({ path: join(out, 'growth.png') });
console.log(JSON.stringify(r), 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
