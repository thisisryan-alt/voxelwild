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
await page.evaluate(() => window.voxelwild.ui.play({ id: 'bs', name: 'B', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2000);
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, I = window.voxelwild.items, wait = (ms) => new Promise((res) => setTimeout(res, ms));
  g.settings.mobs = true; g.stats.health = 20;
  g.inventory.slots[g.inventory.selected] = { item: I.SlimeCrown, count: 1 };
  g.useItem(window.voxelwild.itemsDefs[I.SlimeCrown], null);
  const boss = g.mobs.list.find((m) => m.type === 'king_slime');
  g.stats.health = 20; g.player.canFly = true; g.player.flying = true;
  const p = g.player.body.pos; g.player.teleport([p[0], p[1] + 3, p[2]], g.player.yaw, -0.25);
  await wait(2500);
  g.mobs.hurt(boss, 60, g.player);
  const minions = g.mobs.list.filter((m) => m.type.startsWith('slime_')).length;
  return { boss: !!boss, health: boss && boss.health, minions };
});
console.log(JSON.stringify(r));
await wait(800);
await page.screenshot({ path: join(out, 'boss.png') });
const k = await page.evaluate(async () => {
  const g = window.voxelwild.game, boss = g.mobs.list.find((m) => m.type === 'king_slime');
  const before = g.entities.length;
  g.mobs.hurt(boss, 1000, g.player);
  return { dead: !!boss.dead, dropped: g.entities.length - before };
});
console.log(JSON.stringify(k));
console.log('errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
