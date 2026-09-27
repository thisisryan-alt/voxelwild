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
const t0 = Date.now();
await page.evaluate(() => window.voxelwild.ui.play({ id: 'sk', name: 'Sky', seed: 20260925, mode: 'creative', unsaved: true, created: 0, lastPlayed: 0, startDim: 3 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 180000 });
console.log('load s', (Date.now() - t0) / 1000);
await wait(4000);
const r = await page.evaluate(() => { const g = window.voxelwild.game, p = g.player.body.pos, { FAM } = window.voxelwild.blocksMod; return { dim: g.dim, pos: p.map((v) => +v.toFixed(1)), portals: g.meta.portals.filter((q) => q.kind === 'sky').length, below: g.world.getBlock(Math.floor(p[0]), Math.floor(p[1] - 0.1), Math.floor(p[2])), cols: g.debugInfo().columns, ms: g.debugInfo().ms }; });
console.log(JSON.stringify(r));
await page.evaluate(() => { const g = window.voxelwild.game; g.player.flying = true; const p = g.player.body.pos; g.player.teleport([p[0], p[1] + 20, p[2] + 30], 0.3, -0.25); });
await wait(4000);
await page.screenshot({ path: join(out, 'sky-1.png') });
await page.evaluate(() => { const g = window.voxelwild.game; const p = g.player.body.pos; g.player.teleport([p[0] + 60, p[1] - 30, p[2] + 60], 2.4, 0.05); });
await wait(5000);
await page.screenshot({ path: join(out, 'sky-2.png') });
// a floating temple: the Storm Ghast rises when the player arrives
const temple = await page.evaluate(async () => {
  const g = window.voxelwild.game, wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const mod = await import('/dummy').catch(() => null); void mod;
  return null;
});
void temple;
const tpl = await page.evaluate(() => window.voxelwild.skyTemples ? window.voxelwild.skyTemples(window.voxelwild.game.meta.seed, -1200, -1200, 1200, 1200).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0] : null);
if (tpl) {
  await page.evaluate((t) => { const g = window.voxelwild.game; g.settings.mobs = true; g.player.flying = true; g.player.teleport([t.x + 0.5, t.y + 18, t.z + 22], 0, -0.55); }, tpl);
  await wait(9000);
  await page.screenshot({ path: join(out, 'sky-temple.png') });
  await page.evaluate((t) => { const g = window.voxelwild.game; g.player.teleport([t.x + 0.5, t.y + 2, t.z + 6], 0, 0.3); }, tpl);
  await wait(4000);
  console.log('temple', JSON.stringify(tpl), 'storm', await page.evaluate(() => window.voxelwild.game.mobs.list.filter((m) => m.type === 'storm_ghast').length));
  await page.screenshot({ path: join(out, 'sky-temple-boss.png') });
  await page.evaluate(() => { const g = window.voxelwild.game; g.mobs.list.forEach((m) => { m.dead = 2; }); });
}
// back home through the portal
await page.evaluate(() => { const g = window.voxelwild.game; g.skyTravel(0); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing' && window.voxelwild.game.dim === 0, { timeout: 120000 });
await wait(1500);
const home = await page.evaluate(() => { const g = window.voxelwild.game, p = g.player.body.pos.map(Math.floor), { FAM } = window.voxelwild.blocksMod; let portal = 0; for (let dx = -4; dx <= 4; dx++) for (let dz = -5; dz <= 2; dz++) for (let dy = -2; dy <= 5; dy++) if (g.world.getBlock(p[0] + dx, p[1] + dy, p[2] + dz) === FAM.sky_portal.first) portal++; return { dim: g.dim, portal }; });
console.log(JSON.stringify(home));
// lighting a portal with water in a glowstone frame
const lit = await page.evaluate(() => {
  const g = window.voxelwild.game, w = g.world, I = window.voxelwild.items, { FAM } = window.voxelwild.blocksMod, p = g.player.body.pos.map(Math.floor);
  const X = p[0] + 6, Y = p[1] + 20, Z = p[2];
  for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 3; dy++) w.setBlock(X + dx, Y + dy, Z, dx === -1 || dx === 2 || dy === -1 || dy === 3 ? 59 : 0);
  g.player.teleport([X + 0.5, Y, Z + 3.5], 0, -0.5); g.player.flying = true;
  g.inventory.slots[g.inventory.selected] = { item: I.WaterBucket, count: 1 };
  return new Promise((res) => setTimeout(() => { const pm = window.voxelwild.playerMod; const h = pm.raycast(w, g.player.eye(), g.player.forward(), 6, (b) => b !== 0); g.useBucket(window.voxelwild.itemsDefs[I.WaterBucket]); res([w.getBlock(X, Y, Z) === FAM.sky_portal.first, h && h.hit.map((v, i) => v - [X, Y, Z][i]), h && h.face, h && h.block, w.getBlock(X, Y, Z)]); }, 500));
});
console.log('lit', lit, 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
