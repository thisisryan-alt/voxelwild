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
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, { FAM, C } = window.voxelwild.blocksMod, I = window.voxelwild.items, pm = window.voxelwild.playerMod;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const p = g.player.body.pos.map(Math.floor), Y = 150, X = p[0], Z = p[2], out = {};
  for (let x = -4; x < 8; x++) for (let z = -4; z < 8; z++) { w.setBlock(X + x, Y - 1, Z + z, 88); for (let y = 0; y < 5; y++) w.setBlock(X + x, Y + y, Z + z, 0); }
  g.player.flying = false; g.player.teleport([X + 0.5, Y, Z + 4.5], 0, 0);   // looking north (-z)
  await wait(500);
  const aim = (pitch, yaw = 0) => { g.player.pitch = pitch; g.player.yaw = yaw; return pm.raycast(w, g.player.eye(), g.player.forward(), 6, pm.targetable); };
  const hold = (id) => { g.inventory.slots[g.inventory.selected] = { item: id, count: 64 }; };
  // place a piston on the floor two blocks ahead: look down at the floor block
  hold(FAM.piston.first);
  let hit = aim(-0.55);
  out.aimAt = hit && hit.hit.map((v, i) => v - [X, Y, Z][i]);
  g.place(hit, FAM.piston.first);
  const pp = hit.prev;
  out.piston = w.getBlock(...pp) - FAM.piston.first;
  // a stone block in front of the piston face (the face points at the player: +z)
  w.setBlock(pp[0], pp[1], pp[2] + 1, 1);
  // a lever on the floor beside it
  hold(FAM.lever.first);
  w.setBlock(pp[0] + 1, pp[1] - 1, pp[2], 88);
  g.place({ hit: [pp[0] + 1, pp[1] - 1, pp[2]], prev: [pp[0] + 1, pp[1], pp[2]], face: 2, block: 88, point: [pp[0] + 1.5, pp[1], pp[2] + 0.5] }, FAM.lever.first);
  out.lever = w.getBlock(pp[0] + 1, pp[1], pp[2]) - FAM.lever.first;
  out.tracked = JSON.stringify(g.meta.redstone);
  await wait(300);
  g.toggle({ hit: [pp[0] + 1, pp[1], pp[2]], block: w.getBlock(pp[0] + 1, pp[1], pp[2]) });
  await wait(800);
  out.afterPiston = w.getBlock(...pp) - FAM.piston.first;
  out.front = [w.getBlock(pp[0], pp[1], pp[2] + 1), w.getBlock(pp[0], pp[1], pp[2] + 2)];
  // the real input path: right mouse clicks through interact()
  for (let x = -4; x < 8; x++) for (let z = -4; z < 8; z++) for (let y = 0; y < 5; y++) w.setBlock(X + x, Y + y, Z + z, 0);
  g.state = 'playing'; g.creative = true;
  g.player.teleport([X + 0.5, Y, Z + 4.5], 0, 0);
  await wait(300);
  const click = async () => { g.mouse.rightClicked = true; g.useCooldown = 0; await wait(120); };
  hold(FAM.sticky_piston.first); aim(-0.55); await click();
  const t = aim(-0.55); out.real = t && t.block - FAM.sticky_piston.first;
  const pp2 = t.hit;
  w.setBlock(pp2[0], pp2[1], pp2[2] + 1, 1);
  hold(FAM.redstone_wire ? 0 : 0);
  // dust line from a lever to the piston's side
  g.inventory.slots[g.inventory.selected] = { item: I.Redstone, count: 64 };
  g.player.teleport([pp2[0] + 2.5, Y, pp2[2] + 3.5], 0, 0);
  await wait(200);
  for (const [dx, dz] of [[1, 0], [2, 0]]) {
    const r2 = pm.raycast(w, [pp2[0] + dx + 0.5, Y + 1.5, pp2[2] + dz + 0.5], [0, -1, 0], 4, pm.targetable);
    g.place(r2, window.voxelwild.itemsDefs[I.Redstone].places);
  }
  hold(FAM.lever.first);
  const r3 = pm.raycast(w, [pp2[0] + 3.5, Y + 1.5, pp2[2] + 0.5], [0, -1, 0], 4, pm.targetable);
  g.place(r3, FAM.lever.first);
  out.parts = [1, 2, 3].map((dx) => w.getBlock(pp2[0] + dx, Y, pp2[2]));
  // right-click the lever for real
  g.player.teleport([pp2[0] + 3.5, Y, pp2[2] + 2.5], 0, 0);
  await wait(200);
  const e = g.player.eye(), pitch = Math.atan2((Y + 0.2) - e[1], Math.hypot(pp2[0] + 3.5 - e[0], pp2[2] + 0.5 - e[2]));
  const lv = aim(pitch); out.aimLever = lv && lv.block - FAM.lever.first;
  await click();
  await wait(800);
  out.wire = [1, 2].map((dx) => w.getBlock(pp2[0] + dx, Y, pp2[2]) - FAM.redstone_wire.first);
  out.realAfter = w.getBlock(...pp2) - FAM.sticky_piston.first;
  return out;
});
console.log(JSON.stringify(r));
await browser.close(); server.close();
