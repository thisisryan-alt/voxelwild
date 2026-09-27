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
await page.evaluate(() => { window.voxelwild.game.noVillageStart = true; window.voxelwild.ui.play({ id: 'fish', name: 'Fish', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2500);
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, I = window.voxelwild.items, B = window.voxelwild.blocks;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {}, inv = g.inventory;
  g.settings.mobs = false; g.mobs.list.length = 0;
  const p = g.player.body.pos.map(Math.floor), Y = p[1] + 30;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -10; dz <= 8; dz++) { w.setBlock(p[0] + dx, Y - 1, p[2] + dz, 1); for (let dy = 0; dy < 5; dy++) w.setBlock(p[0] + dx, Y + dy, p[2] + dz, 0); }
  for (let dx = -3; dx <= 3; dx++) for (let dz = -9; dz <= -3; dz++) { w.setBlock(p[0] + dx, Y - 2, p[2] + dz, 1); w.setBlock(p[0] + dx, Y - 1, p[2] + dz, 8); }
  g.player.teleport([p[0] + 0.5, Y, p[2] + 0.5], 0, 0);
  await wait(800);
  out.water = w.getBlock(p[0], Y - 1, p[2] - 6);
  inv.slots[inv.selected] = { item: I.FishingRod, count: 1 };
  g.useRod();
  await wait(1500);
  const f = g.fishing;
  out.cast = f && { inWater: f.inWater, stuck: !!f.stuck, p: f.p.map((v) => +v.toFixed(2)), pl: g.player.body.pos.map((v) => +v.toFixed(2)), fw: g.player.forward().map((v) => +v.toFixed(2)), surface: f.surface };
  if (f) f.wait = 0.05;
  await wait(400);
  out.bite = g.fishing && g.fishing.bite > 0;
  const before = inv.slots.filter(Boolean).reduce((a, s) => a + s.count, 0);
  g.reelIn();
  await wait(2500);
  out.caught = inv.slots.filter(Boolean).map((s) => window.voxelwild.itemsDefs[s.item].name);
  out.gained = inv.slots.filter(Boolean).reduce((a, s) => a + s.count, 0) - before;
  out.xp = [g.stats.level, g.stats.xp];
  // advancements
  inv.slots[5] = { item: B ? 12 : 12, count: 1 };   // an oak log
  inv.slots[6] = { item: I.Diamond, count: 1 };
  inv.armor[0] = { item: I.IronHelmet, count: 1 };
  await wait(1500);
  out.adv = Object.keys(g.meta.advancements || {});
  out.toast = document.getElementById('advToast').textContent;
  // the pause menu list
  window.voxelwild.ui.pause && window.voxelwild.ui.pause();
  await wait(300);
  document.getElementById('btnAdv').click();
  out.listRows = document.querySelectorAll('#advList > div').length;
  out.listHead = document.querySelector('#advList > div').textContent;
  return out;
});
await wait(300);
await page.screenshot({ path: join(out, 'advancements.png') });
await page.evaluate(async () => { const g = window.voxelwild.game; window.voxelwild.ui.resume && window.voxelwild.ui.resume(); g.inventory.selected = 0; g.inventory.slots[0] = { item: window.voxelwild.items.FishingRod, count: 1 }; g.player.pitch = -0.2; g.useRod(); });
await wait(2200);
console.log(await page.evaluate(() => { const g = window.voxelwild.game; return JSON.stringify({ f: g.fishing && { p: g.fishing.p, w: g.fishing.inWater, s: g.fishing.stuck }, state: g.state, parts: g.particles.break.length, held: g.inventory.heldItem && g.inventory.heldItem.name }); }));
await page.screenshot({ path: join(out, 'fishing.png') });
console.log(JSON.stringify(r, null, 1), 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
