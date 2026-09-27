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
await page.evaluate(() => { window.voxelwild.game.noVillageStart = true; window.voxelwild.ui.play({ id: 'pets', name: 'Pets', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2500);
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, I = window.voxelwild.items;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {}, inv = g.inventory;
  g.settings.mobs = false;
  const p = g.player.body.pos.map(Math.floor), Y = p[1] + 30;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) { w.setBlock(p[0] + dx, Y - 1, p[2] + dz, 1); for (let dy = 0; dy < 5; dy++) w.setBlock(p[0] + dx, Y + dy, p[2] + dz, 0); }
  g.player.teleport([p[0] + 0.5, Y, p[2] + 0.5], 0, -0.3);
  g.mobs.list.length = 0;
  await wait(500);
  const wolf = g.mobs.spawnAt('wolf', [p[0] + 0.5, Y, p[2] - 3.5]);
  inv.slots[inv.selected] = { item: I.Bone, count: 20 };
  let tries = 0;
  while (wolf.type === 'wolf' && tries < 30) { g.mobs.interactMob(wolf); tries++; }
  out.tamed = [wolf.type, tries, inv.count(I.Bone), (g.meta.pets || []).length];
  // follows
  g.player.teleport([p[0] + 6.5, Y, p[2] + 6.5], 0, -0.3);
  await wait(3000);
  out.followDist = Math.hypot(wolf.body.pos[0] - g.player.body.pos[0], wolf.body.pos[2] - g.player.body.pos[2]);
  // fights a husk near the player
  const h = g.mobs.spawnAt('husk', [p[0] + 3.5, Y, p[2] + 6.5]);
  h.angry = 0;
  const hp0 = h.health;
  await wait(2500);
  out.huskHurt = [hp0, h.health, wolf.target === h || h.dead > 0];
  h.dead = 2; g.mobs.list = g.mobs.list.filter((m) => m !== h);
  // sit
  g.mobs.interactMob(wolf); out.sitting = g.meta.pets[0].sitting;
  const sitPos = [...wolf.body.pos];
  g.player.teleport([p[0] + 0.5, Y, p[2] + 3.5], Math.PI, -0.35);
  await wait(1500);
  out.stayed = Math.hypot(wolf.body.pos[0] - sitPos[0], wolf.body.pos[2] - sitPos[2]);
  // despawned (as when the player goes far) and back
  g.mobs.list = g.mobs.list.filter((m) => m !== wolf);
  await wait(1500);
  const back = g.mobs.list.find((m) => m.pet);
  out.respawned = !!back && back.type;
  out.saved = JSON.stringify(g.meta.pets);
  // boss music hook runs without errors
  const b = g.mobs.spawnAt('king_slime', [p[0] + 0.5, Y, p[2] - 6]);
  await wait(800);
  out.audio = g.audio.ctx ? g.audio.ctx.state : 'none';
  b.dead = 2; g.mobs.list = g.mobs.list.filter((m) => m !== b);
  g.player.teleport([p[0] + 0.5, Y, p[2] + 0.5], 0, -0.3);
  return out;
});
await wait(1500);
await page.evaluate(() => { const g = window.voxelwild.game; const wolf = g.mobs.list.find((m) => m.pet); if (wolf) { const p = g.player.body.pos; wolf.body.pos = [p[0] + 0.3, p[1], p[2] - 2.5]; wolf.yaw = Math.PI / 2; } });
await wait(700);
await page.screenshot({ path: join(out, 'pets-sit.png') });
await page.evaluate(() => { const g = window.voxelwild.game; const wolf = g.mobs.list.find((m) => m.pet); g.mobs.interactMob(wolf); });
await wait(400);
await page.screenshot({ path: join(out, 'pets-stand.png') });
console.log(JSON.stringify(r, null, 1), 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
