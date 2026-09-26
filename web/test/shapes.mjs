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
// ---- shaped blocks: a showcase platform in the sky, screenshots, and checks of collision / placing / toggling
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world;
  const { FAMS } = window.voxelwild.blocksMod;
  const fams = FAMS;
  const p = g.player.body.pos.map(Math.floor), Y = 150, X = p[0], Z = p[2];
  for (let x = -2; x < 40; x++) for (let z = -2; z < 40; z++) w.setBlock(X + x, Y - 1, Z + z, 88);
  const out = { placed: 0 };
  let i = 0;
  for (const f of fams) {
    const x = X + (i % 18) * 2, z = Z + Math.floor(i / 18) * 2; i++;
    const st = f.kind === 2 ? 6 : f.kind === 7 ? 12 : f.kind === 12 || f.kind === 18 ? 3 : f.kind === 11 ? 4 : 0;
    if (f.kind === 12 || f.kind === 18) w.setBlock(x, Y, z - 1, 88);
    w.setBlock(x, Y, z, f.first + st);
    if (f.kind === 7 || f.kind === 17) w.setBlock(x, Y + 1, z, f.first + st + 1);
    if (f.kind === 3 || f.kind === 5 || f.kind === 6) w.setBlock(x + 1, Y, z, f.first);
    out.placed++;
  }
  return { ...out, X, Y, Z };
});
console.log('placed', r.placed);
await new Promise((res) => setTimeout(res, 6000));
const shot = async (name, pos, yaw, pitch) => {
  await page.evaluate((pos, yaw, pitch) => { const g = window.voxelwild.game; g.player.flying = true; g.player.teleport(pos, yaw, pitch); }, pos, yaw, pitch);
  await new Promise((res) => setTimeout(res, 2500));
  await page.screenshot({ path: join(out, `shape-${name}.png`) });
};
await shot('overview', [r.X + 17, r.Y + 9, r.Z + 36], 0, -0.55);
await shot('close1', [r.X + 6, r.Y + 2.5, r.Z + 7], 0, -0.45);
await shot('close2', [r.X + 22, r.Y + 2.5, r.Z + 13], 0, -0.45);
await shot('close3', [r.X + 12, r.Y + 2.5, r.Z + 25], 0, -0.45);
// behaviour checks
const checks = await page.evaluate(async (r) => {
  const g = window.voxelwild.game, w = g.world, pl = g.player, res = {};
  const fam = (k) => window.voxelwild.blocksMod.FAM[k];
  const X = r.X + 1, Z = r.Z - 8, Y = r.Y;
  for (let x = -3; x < 12; x++) for (let z = -3; z < 3; z++) { w.setBlock(X + x, Y - 1, Z + z, 88); for (let y = 0; y < 6; y++) w.setBlock(X + x, Y + y, Z + z, 0); }
  // a stair run: walking forward (+x) climbs it
  const st = fam('oak_stairs');
  for (let k = 0; k < 4; k++) { w.setBlock(X + 2 + k, Y + k, Z, st.first + 0 * 2); for (let j = 0; j < k; j++) w.setBlock(X + 2 + k, Y + j, Z, 88); }
  w.setBlock(X + 1, Y, Z, fam('stone_slab').first);
  pl.flying = false; pl.teleport([X - 1 + 0.5, Y, Z + 0.5], -Math.PI / 2, 0);
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  await wait(300);
    g.keys.add('KeyW'); let top = 0; for (let t = 0; t < 25; t++) { await wait(100); top = Math.max(top, pl.body.pos[1] - Y); } g.keys.delete('KeyW');
  res.climbed = top; res.x = pl.body.pos[0] - X;
  // standing on a bottom slab: feet at +0.5
  pl.teleport([X + 1.5, Y + 2, Z + 0.5]); await wait(1200);
  res.slabFeet = pl.body.pos[1] - Y;
  // a door: toggling both halves
  const door = fam('oak_door');
  w.setBlock(X + 8, Y, Z, door.first + 12); w.setBlock(X + 8, Y + 1, Z, door.first + 13);
  g.toggle({ hit: [X + 8, Y, Z], block: door.first + 12 });
  res.doorOpen = [w.getBlock(X + 8, Y, Z) - door.first, w.getBlock(X + 8, Y + 1, Z) - door.first];
  // aiming: a ray just above a bottom slab passes it; one into it hits
  const slabId = fam('stone_slab').first; w.setBlock(X + 10, Y, Z, slabId);
  const { raycast, targetable } = window.voxelwild.playerMod;
  const miss = raycast(w, [X + 10.5, Y + 0.8, Z - 2], [0, 0, 1], 6, targetable);
  const hitr = raycast(w, [X + 10.5, Y + 0.3, Z - 2], [0, 0, 1], 6, targetable);
  res.rayAbove = miss ? miss.hit.join(',') + ':' + miss.block : null; res.rayInto = hitr ? hitr.block === slabId && hitr.face : null;
  return res;
}, r);
console.log(JSON.stringify(checks));
const icon = await page.evaluate(() => {
  const g = window.voxelwild.game, ic = g.icons, { FAMS } = window.voxelwild.blocksMod;
  const c = document.createElement('canvas'); c.width = 64 * 16; c.height = 64 * 4; const x = c.getContext('2d');
  const pick = [0, 1, 60, 111, 115, 125, 130, 140, 150, 160, 170, 180, 200, 220, 240, 250, 255, 260, 262, 264, 266, 268, 270, 272, 274, 276, 278, 279, 2, 3, 4, 5, 6, 7, 8, 9, 112, 113, 114, 116, 117, 118, 119, 120, 121, 122, 123, 124, 126, 127, 128, 129, 131, 132, 133, 134, 135, 136, 137, 138, 139, 141, 142, 143];
  pick.forEach((k, i) => { const f = FAMS[k]; if (!f) return; const idx = ic.index.get(f.first); if (idx == null) return; x.drawImage(ic.canvas, (idx % 8) * 64, Math.floor(idx / 8) * 64, 64, 64, (i % 16) * 64, Math.floor(i / 16) * 64, 64, 64); });
  return c.toDataURL('image/png');
});
(await import('node:fs')).writeFileSync(join(out, 'shape-icons.png'), Buffer.from(icon.split(',')[1], 'base64'));
const errs = await page.evaluate(() => window.voxelwild.game.errors || 0);
console.log('errors', errs);
await browser.close(); server.close();
