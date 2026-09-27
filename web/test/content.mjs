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
await page.evaluate(() => { window.voxelwild.game.noVillageStart = true; window.voxelwild.ui.play({ id: 'ct', name: 'Content', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2500);
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, I = window.voxelwild.items, inv = g.inventory, st = g.stats;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
  const use = async () => { g.mouse.rightClicked = true; g.useCooldown = 0; await wait(150); };
  g.settings.mobs = false; g.mobs.list.length = 0;
  const p0 = g.player.body.pos.map(Math.floor), Y = p0[1] + 40;
  for (let dx = -10; dx <= 10; dx++) for (let dz = -30; dz <= 6; dz++) { w.setBlock(p0[0] + dx, Y - 1, p0[2] + dz, 1); for (let dy = 0; dy < 8; dy++) w.setBlock(p0[0] + dx, Y + dy, p0[2] + dz, 0); }
  g.player.teleport([p0[0] + 0.5, Y, p0[2] + 0.5], 0, 0.6);   // looking up: no block in reach
  await wait(600);
  // potions
  inv.selected = 0;
  for (const [id, key] of [[I.PotionSwiftness, 'speed'], [I.PotionNightVision, 'night'], [I.PotionLeaping, 'jump'], [I.PotionStrength, 'strength']]) { inv.slots[0] = { item: id, count: 1 }; await use(); out[key] = Math.round(st.fx[key] || 0); }
  out.bottle = inv.slots[0] && window.voxelwild.itemsDefs[inv.slots[0].item].name;
  out.mults = [g.player.speedMul, g.player.jumpHeight];
  st.health = 10; inv.slots[0] = { item: I.PotionHealing, count: 1 }; await use(); out.healed = st.health;
  // milk
  const cow = g.mobs.spawnAt('cow', [p0[0] + 2, Y, p0[2] - 2]);
  inv.slots[0] = { item: I.Bucket, count: 1 };
  g.mobs.interactMob(cow); out.milk = inv.slots[0].item === I.MilkBucket;
  await use(); out.cleared = [st.fx.speed || 0, inv.slots[0] && inv.slots[0].item === I.Bucket];
  // shears
  const sheep = g.mobs.spawnAt('sheep', [p0[0] - 2, Y, p0[2] - 2]);
  inv.slots[0] = { item: I.Shears, count: 1 };
  g.mobs.interactMob(sheep); out.sheared = [sheep.woolly, g.entities.length];
  // snowball knocks a mob
  g.player.pitch = 0; g.player.yaw = 0;
  const h = g.mobs.spawnAt('husk', [p0[0] + 0.5, Y, p0[2] - 5]); h.angry = 0; const hz0 = h.body.pos[2];
  inv.slots[0] = { item: I.Snowball, count: 4 }; await use();
  out.thrown = g.mobs.projectiles.length; 
  await wait(600);
  out.snowHit = [inv.slots[0].count, +(hz0 - h.body.pos[2]).toFixed(2), g.mobs.projectiles.length];
  g.mobs.list = g.mobs.list.filter((m) => m !== h);
  // pearl teleports forward
  const z0 = g.player.body.pos[2];
  inv.slots[0] = { item: I.EnderPearl, count: 2 }; g.player.pitch = 0.3; await use();
  await wait(1500);
  out.pearl = [+(z0 - g.player.body.pos[2]).toFixed(1), st.health, Object.keys(g.meta.advancements || {}).includes('pearl')];
  // glider: fall from high up and glide
  inv.armor[1] = { item: I.Glider, count: 1 };
  g.player.teleport([p0[0] + 0.5, Y + 60, p0[2] + 0.5], 0, -0.25);
  await wait(700);
  g.keys.add('Space'); await wait(80); g.keys.delete('Space');
  const y1 = g.player.body.pos[1], zA = g.player.body.pos[2];
  await wait(1500);
  out.glide = [g.gliding, +(zA - g.player.body.pos[2]).toFixed(1), +(y1 - g.player.body.pos[1]).toFixed(1)];
  g.gliding = false; inv.armor[1] = null;
  // chickens lay eggs
  const ch = g.mobs.spawnAt('chicken', [p0[0] + 3, Y, p0[2]]); ch.eggT = 0.01;
  await wait(400);
  out.egg = g.entities.some((e) => e.item === I.Egg);
  // music
  try { g.audio.playPiece(); out.music = true; } catch (e) { out.music = e.message; }
  out.recipes = ['Glass Bottle', 'Potion of Healing', 'Glider', 'Shears'].map((n) => window.voxelwild.recipes.some((rr) => rr.name === n || window.voxelwild.itemsDefs[rr.out] && window.voxelwild.itemsDefs[rr.out].name === n));
  return out;
});
await page.screenshot({ path: join(out, 'content.png') });
console.log(JSON.stringify(r), 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
