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
await page.screenshot({ path: join(out, 'shot-title.png') });
await page.evaluate((seed) => window.voxelwild.ui.play({ id: 'shots', name: 'Shots', seed: +seed, mode: 'creative', created: 0, lastPlayed: 0 }, true), seed);
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
const views = process.argv[4] ? JSON.parse(process.argv[4]) : [
  { name: 'a-north', dy: 0, yaw: 0, pitch: -0.1 }, { name: 'b-east', dy: 0, yaw: -1.57, pitch: -0.1 }, { name: 'c-south', dy: 0, yaw: 3.14, pitch: -0.1 },
  { name: 'd-west', dy: 0, yaw: 1.57, pitch: -0.1 }, { name: 'e-high', dy: 40, yaw: 0.6, pitch: -0.45 }, { name: 'f-down', dy: 6, yaw: 0.6, pitch: -1.2 },
];
const res = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, { FAM, C } = window.voxelwild.blocksMod, I = window.voxelwild.items;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const p = g.player.body.pos.map(Math.floor), Y = 150, X = p[0], Z = p[2], out = {};
  const set = (x, y, z, id) => { w.setBlock(X + x, Y + y, Z + z, id); g.redstone.track(X + x, Y + y, Z + z); };
  const get = (x, y, z) => w.getBlock(X + x, Y + y, Z + z);
  for (let x = -2; x < 30; x++) for (let z = -2; z < 20; z++) { w.setBlock(X + x, Y - 1, Z + z, 88); for (let y = 0; y < 5; y++) w.setBlock(X + x, Y + y, Z + z, 0); }
  g.player.flying = true; g.player.teleport([X + 8, Y + 6, Z + 18], 0, -0.6);
  // comparator reads a chest: 1 stack of 64 cobblestone in 27 slots -> strength 1; full chest -> 15
  set(0, 0, 0, C.chest); const chest = g.blockData([X, Y, Z], 'chest');
  chest.slots[0] = { item: 9, count: 64 };
  set(1, 0, 0, FAM.comparator.first + 0); for (let x = 2; x <= 4; x++) set(x, 0, 0, FAM.redstone_wire.first);
  await wait(600);
  out.compWire = get(2, 0, 0) - FAM.redstone_wire.first;
  for (let i = 0; i < 27; i++) chest.slots[i] = { item: 9, count: 64 };
  await wait(600);
  out.compWireFull = get(2, 0, 0) - FAM.redstone_wire.first;
  // observer: watches a block to its east; a lamp behind it flashes when that block changes
  set(10, 0, 0, FAM.observer.first + 0); set(9, 0, 0, C.redstone_lamp);
  await wait(400);
  set(11, 0, 0, 88);
  await wait(150);
  out.observerFired = get(10, 0, 0) - FAM.observer.first >= 6 || get(9, 0, 0) === C.lit_redstone_lamp;
  await wait(800);
  out.observerReset = get(10, 0, 0) - FAM.observer.first < 6;
  // dropper feeds a chest in front of it when a lever turns on
  set(0, 0, 4, FAM.dropper.first + 0); g.blockData([X, Y, Z + 4], 'chest', 9).slots[0] = { item: I.Coal, count: 5 };
  set(1, 0, 4, C.chest); set(0, 1, 4, FAM.lever.first + 4);
  await wait(300);
  g.toggle({ hit: [X, Y + 1, Z + 4], block: get(0, 1, 4) });
  await wait(500);
  const c2 = g.blockData([X + 1, Y, Z + 4], 'chest');
  out.dropped = c2.slots[0] ? c2.slots[0].count : 0;
  // dispenser shoots an arrow at a cow
  set(0, 0, 8, FAM.dispenser.first + 0); g.blockData([X, Y, Z + 8], 'chest', 9).slots[0] = { item: I.Arrow, count: 3 };
  set(0, 1, 8, FAM.lever.first + 4);
  await wait(300);
  g.toggle({ hit: [X, Y + 1, Z + 8], block: get(0, 1, 8) });
  await wait(200);
  out.arrowsFlying = g.mobs.projectiles.filter((q) => q.owner === 'dispenser').length;
  // hoppers: chest -> hopper -> furnace input
  set(5, 2, 12, C.chest); g.blockData([X + 5, Y + 2, Z + 12], 'chest').slots[3] = { item: I.IronChunk, count: 4 };
  set(5, 1, 12, FAM.hopper.first + 0); g.blockData([X + 5, Y + 1, Z + 12], 'chest', 5);
  set(5, 0, 12, C.furnace); g.blockData([X + 5, Y, Z + 12], 'furnace');
  for (let k = 0; k < 16; k++) { g.blockTimer = 0.3; g.updateBlocks(0.2); }
  const fd = g.blockData([X + 5, Y, Z + 12], 'furnace');
  out.hopperToFurnace = fd.slots[0] ? fd.slots[0].count : 0;
  // fire burns planks
  for (let x = 20; x < 23; x++) set(x, 0, 12, C.oak_planks || 10);
  const lit = g.ignite(X + 21, Y + 1, Z + 12);
  out.fireLit = lit && get(21, 1, 12) === C.fire;
  g.meta.clock += 60; for (let k = 0; k < 20; k++) { g.blockTimer = 0.3; g.updateBlocks(0.3); }
  out.fireOut = get(21, 1, 12) !== C.fire;
  // stairs make an outer corner
  const st = FAM.oak_stairs.first;
  set(15, 0, 4, st + 3 * 2); set(15, 0, 3, st + 0 * 2);      // north-facing with an east-facing stair behind it
  out.cornerBoxes = w.modelBoxesAt(X + 15, Y, Z + 4, st + 6, false).length;
  out.cornerTop = JSON.stringify(w.modelBoxesAt(X + 15, Y, Z + 4, st + 6, false)[1]);
  // buckets
  set(18, 0, 16, 8);
  g.inventory.slots[g.inventory.selected] = { item: I.Bucket, count: 1 }; g.creative = false;
  g.player.teleport([X + 18.5, Y + 2.2, Z + 16.5], 0, -1.55);
  await wait(200);
  g.useBucket(window.voxelwild.itemsDefs[I.Bucket]);
  out.scooped = g.inventory.held && g.inventory.held.item === I.WaterBucket && get(18, 0, 16) === 0;
  // TNT flashes while primed
  set(25, 0, 2, C.tnt); g.redstone.prime(X + 25, Y, Z + 2, 3);
  const seen = new Set();
  for (let k = 0; k < 10; k++) { await wait(120); seen.add(get(25, 0, 2)); }
  out.tntFlashes = seen.has(C.tnt_flash) && seen.has(C.tnt);
  g.creative = true;
  // animated textures are rows of mode 3
  const L = window.voxelwild.layerNames;

  return out;
});
console.log(JSON.stringify(res));
await page.evaluate(() => {
  const g = window.voxelwild.game, w = g.world, { FAM, C } = window.voxelwild.blocksMod;
  const p = g.player.body.pos.map(Math.floor), X = p[0] + 40, Y = 150, Z = p[2];
  for (let x = -3; x < 16; x++) for (let z = -3; z < 12; z++) { w.setBlock(X + x, Y - 1, Z + z, 88); for (let y = 0; y < 4; y++) w.setBlock(X + x, Y + y, Z + z, 0); }
  const S = (x, y, z, id) => w.setBlock(X + x, Y + y, Z + z, id);
  // pistons and observers in all six facings
  for (let f = 0; f < 6; f++) { S(f * 2, 0, 0, FAM.piston.first + f); S(f * 2, 0, 2, FAM.sticky_piston.first + 6 + f); S(f * 2, 0, 4, FAM.observer.first + f); S(f * 2, 2, 4, FAM.dispenser.first + f); }
  // beds
  ['white', 'red', 'blue', 'lime', 'yellow', 'purple'].forEach((c, i) => { S(i * 2, 0, 7, FAM[`${c}_bed`].first + 2 * 2); S(i * 2, 0, 8, FAM[`${c}_bed`].first + 2 * 2 + 1); });
  // stair corners
  const st = FAM.stone_brick_stairs.first;
  S(13, 0, 0, st + 6); S(14, 0, 0, st + 6); S(15, 0, 0, st + 6); S(15, 0, 1, st + 0); S(15, 0, 2, st + 0); S(13, 0, 1, st + 2); S(12, 0, 1, st + 6);
  // hopper, comparator, animated blocks, fire
  S(13, 0, 4, FAM.hopper.first); S(14, 0, 4, FAM.comparator.first + 8); S(15, 0, 4, C.sea_lantern); S(13, 0, 6, C.prismarine); S(15, 0, 6, C.redstone_block);
  w.setBlock(X + 14, Y, Z + 7, 56); g.ignite(X + 14, Y + 1, Z + 7);
  g.player.flying = true; g.player.teleport([X + 7, Y + 5.5, Z + 15], 0, -0.55);
});
await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: join(out, 'more.png') });
await page.evaluate(() => { const g = window.voxelwild.game, p = g.player.body.pos; g.player.teleport([p[0] - 1, p[1] - 2.5, p[2] - 9.5], 0.25, -0.35); });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: join(out, 'more2.png') });
await page.evaluate(() => { const g = window.voxelwild.game, p = g.player.body.pos; g.player.teleport([p[0] + 7, p[1], p[2] + 3], 0.5, -0.45); });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: join(out, 'more3.png') });
console.log('errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
