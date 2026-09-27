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
const out2 = {};
// a village: villagers turn up, and one trades
await page.evaluate(() => window.voxelwild.ui.play({ id: 'st2', name: 'T', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await page.evaluate(() => { const g = window.voxelwild.game; g.player.canFly = true; g.player.flying = true; g.player.teleport([627.5, 80, -150.5], 0, -0.4); g.stats.health = 20; });
await wait(14000);
out2.villagers = await page.evaluate(() => window.voxelwild.game.mobs.list.filter((m) => m.def.villager).length);
out2.trade = await page.evaluate(() => {
  const g = window.voxelwild.game, v = g.mobs.list.find((m) => m.def.villager);
  if (!v) return null;
  const trades = g.trades(v.def.villager);
  g.inventory.add(window.voxelwild.items.Emerald, 20); g.inventory.add(window.voxelwild.items.Wheat, 40); g.inventory.add(window.voxelwild.items.Stick, 40); g.inventory.add(window.voxelwild.items.Coal, 40);
  g.openStation({ kind: 'trade', name: v.def.villager, trades });
  const r = trades[1];
  const before = g.inventory.count(r.out);
  document.querySelectorAll('#recipes .recipe')[1].click();
  return { prof: v.def.villager, offers: trades.length, got: g.inventory.count(r.out) - before };
});
await wait(600);
await page.screenshot({ path: join(out, 'trade.png') });
await page.evaluate(() => window.voxelwild.ui.closeInventory());
// villagers in view
await page.evaluate(() => { const g = window.voxelwild.game, v = g.mobs.list.find((m) => m.def.villager); if (v) g.player.teleport([v.body.pos[0], v.body.pos[1] + 1.5, v.body.pos[2] + 5], 0, -0.2); });
await wait(2000);
await page.screenshot({ path: join(out, 'villager.png') });
// slimes: one big slime splits when killed
out2.slimes = await page.evaluate(async () => {
  const g = window.voxelwild.game, p = g.player.body.pos, m = g.mobs.spawnAt('slime_big', [p[0] + 3, p[1], p[2]]);
  g.mobs.hurt(m, 100, g.player);
  return g.mobs.list.filter((q) => q.type === 'slime_medium').length;
});
// the Nether: a bastion, ghast size, striders
await page.evaluate(async () => { await window.voxelwild.game.save(); window.voxelwild.ui.toTitle(); });
await wait(800);
await page.evaluate(() => window.voxelwild.ui.play({ id: 'st3', name: 'N', seed: 20260925, mode: 'creative', unsaved: true, created: 0, lastPlayed: 0, startDim: 1 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing' && window.voxelwild.game.dim === 1, { timeout: 120000 });
const bastion = await page.evaluate(() => {
  const { structuresIn } = window.voxelwild.structures, g = window.voxelwild.game;
  let best = null;
  for (const s of structuresIn(g.meta.seed, null, -1500, -1500, 1500, 1500, 1)) { const d = Math.hypot(s.x, s.z); if (!best || d < best.d) best = { d, x: s.x, z: s.z }; }
  return best;
});
out2.bastion = bastion;
if (bastion) {
  await page.evaluate((b) => { const g = window.voxelwild.game; g.player.flying = true; g.player.teleport([b.x + 0.5, 62, b.z + 30], 0, -0.5); }, bastion);
  await wait(10000);
  await page.screenshot({ path: join(out, 'struct-bastion.png') });
}
out2.ghast = await page.evaluate(() => { const g = window.voxelwild.game; const m = g.mobs.spawnAt('ghast', [0, 80, 0]); return [m.def.height, g.mobModels && g.mobModels.types ? g.mobModels.types.ghast.scale : null]; });
console.log(JSON.stringify(out2));
console.log('errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
