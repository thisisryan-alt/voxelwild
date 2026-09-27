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
if (process.env.THROTTLE) { const cdp = await page.createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.THROTTLE }); }
if (process.env.SHAPES) await page.evaluate(() => { window.SHAPES = 1; });
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, pl = g.player;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  g.creative = false; pl.canFly = false; pl.flying = false; g.stats.health = 20;
  const out = { stuck: 0, samples: 0, worst: 0, events: [] };
  const inside = () => {
    const b = pl.body, mn = b.min(), mx = b.max(), boxes = [];
    for (let y = Math.floor(mn[1]); y <= Math.floor(mx[1]); y++) for (let z = Math.floor(mn[2]); z <= Math.floor(mx[2]); z++) for (let x = Math.floor(mn[0]); x <= Math.floor(mx[0]); x++) w.collisionBoxes(x, y, z, boxes);
    let depth = 0;
    for (const q of boxes) {
      const ox = Math.min(mx[0], q[3]) - Math.max(mn[0], q[0]), oy = Math.min(mx[1], q[4]) - Math.max(mn[1], q[1]), oz = Math.min(mx[2], q[5]) - Math.max(mn[2], q[2]);
      if (ox > 0.01 && oy > 0.01 && oz > 0.01) depth = Math.max(depth, Math.min(ox, oy, oz));
    }
    return depth;
  };
  const keys = ['KeyW', 'KeyA', 'KeyD', 'KeyS'];
  if (window.SHAPES) {
    const { FAM } = window.voxelwild.blocksMod, p0 = pl.body.pos.map(Math.floor);
    const fams = ['oak_stairs', 'stone_slab', 'white_carpet', 'snow', 'dirt_path', 'oak_fence', 'cobblestone_wall', 'oak_trapdoor', 'red_bed'];
    for (let dz = -14; dz <= 14; dz++) for (let dx = -14; dx <= 14; dx++) {
      if (Math.random() > 0.35) continue;
      const x = p0[0] + dx, z = p0[2] + dz, h = w.heightmapAt(x, z);
      if (h == null || w.getBlock(x, h + 1, z) !== 0) continue;
      const f = FAM[fams[Math.floor(Math.random() * fams.length)]];
      w.setBlock(x, h + 1, z, f.first + Math.floor(Math.random() * Math.min(f.states, 8)));
    }
  }
  for (let t = 0; t < 1200; t++) {
    if (t % 40 === 0) { g.keys.clear(); g.keys.add('KeyW'); if (Math.random() < 0.5) g.keys.add(keys[1 + Math.floor(Math.random() * 3)]); if (Math.random() < 0.4) g.keys.add('ControlLeft'); pl.yaw = Math.random() * 6.28; }
    if (t % 7 === 0) { if (Math.random() < 0.5) g.keys.add('Space'); else g.keys.delete('Space'); }
    await wait(50);
    const d = inside();
    out.samples++;
    if (d > 0.02) { out.stuck++; out.worst = Math.max(out.worst, d); if (out.events.length < 6) out.events.push([pl.body.pos.map((v) => +v.toFixed(3)), +d.toFixed(3)]); }
    if (g.state !== 'playing') { g.stats.health = 20; if (g.state === 'dead') g.respawn(); }
  }
  g.keys.clear();
  // a house built over the spawn: respawning must not leave the player inside it
  const sp = g.spawn.map(Math.floor);
  for (let y = 0; y < 4; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(sp[0] + dx, sp[1] + y, sp[2] + dz, 1);
  g.stats.damage(1000, 'void');
  await wait(300);
  g.respawn();
  await wait(1500);
  out.afterRespawnInside = pl.body.overlapping(w).length;
  out.respawnY = +(pl.body.pos[1] - sp[1]).toFixed(2);
  // a block placed into the player's feet by a piston-like edit
  const f = pl.body.pos.map(Math.floor);
  w.setBlock(f[0], f[1], f[2], FAM_SLAB());
  await wait(300);
  out.afterSlabInside = pl.body.overlapping(w).length;
  return out;
  function FAM_SLAB() { return window.voxelwild.blocksMod.FAM.stone_slab.first; }
});
console.log(JSON.stringify(r));
await browser.close(); server.close();
