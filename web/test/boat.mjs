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
await page.evaluate(() => { window.voxelwild.game.noVillageStart = true; window.voxelwild.ui.play({ id: 'bt', name: 'Boat', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2500);
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, I = window.voxelwild.items, inv = g.inventory, wait = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
  g.settings.mobs = false; g.mobs.list.length = 0;
  const p = g.player.body.pos.map(Math.floor), Y = p[1] + 30;
  for (let dx = -12; dx <= 12; dx++) for (let dz = -30; dz <= 4; dz++) { w.setBlock(p[0] + dx, Y - 1, p[2] + dz, 1); for (let dy = 0; dy < 6; dy++) w.setBlock(p[0] + dx, Y + dy, p[2] + dz, 0); }
  for (let dx = -10; dx <= 10; dx++) for (let dz = -28; dz <= -2; dz++) { w.setBlock(p[0] + dx, Y - 3, p[2] + dz, 1); w.setBlock(p[0] + dx, Y - 2, p[2] + dz, 8); w.setBlock(p[0] + dx, Y - 1, p[2] + dz, 8); }
  g.player.teleport([p[0] + 0.5, Y, p[2] + 2.5], 0, -0.6);
  await wait(800);
  inv.selected = 0; inv.slots[0] = { item: I.Boat, count: 1 };
  out.placed = g.placeBoat();
  const boat = g.mobs.list.find((m) => m.type === 'boat');
  await wait(1200);
  out.boatY = boat && +(boat.body.pos[1] - Y).toFixed(2);
  g.mount(boat); g.player.pitch = -0.15;
  const z0 = boat.body.pos[2];
  g.keys.add('KeyW'); await wait(2500); g.keys.delete('KeyW');
  out.rowed = +(z0 - boat.body.pos[2]).toFixed(1); out.riding = !!g.riding; out.seat = +(g.player.body.pos[1] - boat.body.pos[1]).toFixed(2);
  return out;
});
await page.screenshot({ path: join(out, 'boat-ride.png') });
const r2 = await page.evaluate(async () => {
  const g = window.voxelwild.game, wait = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
  g.keys.add('ShiftLeft'); await wait(400); g.keys.delete('ShiftLeft');
  out.dismounted = !g.riding;
  const boat = g.mobs.list.find((m) => m.type === 'boat'), b = boat.body.pos;
  g.setMode(true); g.player.flying = true; g.player.teleport([b[0] + 2.5, b[1] + 2.5, b[2] + 2.5], Math.PI * 0.25, -0.55);
  return out;
});
await wait(1200);
await page.screenshot({ path: join(out, 'boat.png') });
const r3 = await page.evaluate(async () => {
  const g = window.voxelwild.game, wait = (ms) => new Promise((res) => setTimeout(res, ms)), p = g.player.body.pos;
  const v = g.mobs.spawnAt('void_phantom', [p[0], p[1] + 8, p[2] - 16]); g.player.yaw = 0; g.player.pitch = 0.35;
  await wait(4000);
  return { alive: !v.dead, hp: v.health, bossBar: !document.getElementById('bossBar').hidden };
});
await page.screenshot({ path: join(out, 'void-phantom.png') });
console.log(JSON.stringify({ ...r, ...r2, ...r3 }), 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
