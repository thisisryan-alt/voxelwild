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
await page.evaluate(() => window.voxelwild.ui.play({ id: 'b2', name: 'B', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2000);
const out2 = {};
for (const [item, type] of [['BlazingCore', 'inferno_spirit'], ['BoneCrown', 'hollow_king'], ['StormTear', 'storm_ghast'], ['FrozenHeart', 'frost_colossus']]) {
  const r = await page.evaluate(async (item, type) => {
    const g = window.voxelwild.game, I = window.voxelwild.items, wait = (ms) => new Promise((res) => setTimeout(res, ms));
    g.stats.health = 20; g.settings.mobs = true;
    g.player.canFly = true; g.player.flying = true;
    if (g.state === 'dead') { g.respawn(); await wait(1500); } g.state = 'playing'; g.stats.health = 20; const p0 = g.player.body.pos; g.player.teleport([p0[0], p0[1] + (type === 'frost_colossus' ? 0.5 : 12), p0[2]], 0, 0.05); if (type === 'frost_colossus') { g.player.flying = false; }
    g.inventory.slots[g.inventory.selected] = { item: I[item], count: 1 };
    g.useItem(window.voxelwild.itemsDefs[I[item]], null);
    const boss = g.mobs.list.find((m) => m.type === type);
    await wait(3500);
    const hp0 = boss.health;
    g.mobs.hurt(boss, boss.def.health * 0.55, g.player);
    await wait(4000);
    const slowed = g.player.slowT > 0 || g.stats.health < 20; const summoned = g.mobs.list.filter((m) => !m.def.boss && !m.dead && (m.type === 'blaze' || m.type === 'wither_skeleton')).length;
    return { hp0, slowed, projectiles: g.mobs.projectiles.length, summoned, health: g.stats.health };
  }, item, type);
  await page.screenshot({ path: join(out, `boss-${type}.png`) });
  const k = await page.evaluate((type) => { const g = window.voxelwild.game, boss = g.mobs.list.find((m) => m.type === type), n = g.entities.length; g.mobs.hurt(boss, 5000, g.player); const got = g.entities.slice(n).map((e) => window.voxelwild.itemsDefs[e.item] && window.voxelwild.itemsDefs[e.item].name); g.mobs.list.filter((m) => !m.def.boss).forEach((m) => { m.dead = 2; }); return got; }, type);
  out2[type] = { ...r, drops: k };
  await wait(1500);
}
// double jump with a Cloud in a Bottle
out2.doubleJump = await page.evaluate(async () => {
  const g = window.voxelwild.game, I = window.voxelwild.items, pl = g.player, wait = (ms) => new Promise((res) => setTimeout(res, ms));
  if (g.state === 'dead') { g.respawn(); await wait(2000); }
  g.stats.health = 20; g.state = 'playing'; window.voxelwild.ui.show('playing');
  pl.flying = false; pl.canFly = false; g.creative = false;
  g.inventory.add(I.CloudBottle, 1);
  const p = pl.body.pos.map(Math.floor); let y = p[1] + 20; while (!g.world.isSolidAt(p[0], y - 1, p[2])) y--; pl.teleport([p[0] + 0.5, y, p[2] + 0.5]);
  await wait(500);
  const out = {};
  g.keys.add('Space'); g.pressed.add('Space'); let top1 = 0; for (let k = 0; k < 6; k++) { await wait(50); top1 = Math.max(top1, pl.body.pos[1] - y); } g.keys.delete('Space');
  g.pressed.add('Space'); g.keys.add('Space'); await wait(80); g.keys.delete('Space');
  out.first = +top1.toFixed(2);
  let top = 0; for (let k = 0; k < 12; k++) { await wait(60); top = Math.max(top, pl.body.pos[1] - y); }
  out.total = +top.toFixed(2);
  return out;
});
console.log(JSON.stringify(out2));
console.log('errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
