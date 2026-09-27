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
const res = {};
await page.evaluate(() => { window.voxelwild.ui.show('arenaMenu'); document.querySelector('#arenaMenu [data-arena="rush"]').click(); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing' && window.voxelwild.game.arena, { timeout: 120000 });
await wait(1500);
res.start = await page.evaluate(() => { const g = window.voxelwild.game, w = g.world; return { floor: w.getBlock(0, 64, 0), wall: w.getBlock(23, 66, 0), sword: g.inventory.slots[0] && g.inventory.slots[0].item, armor: g.inventory.defense, tag: g.arenaStatus(), creative: g.creative }; });
await wait(6500);
res.wave1 = await page.evaluate(() => { const g = window.voxelwild.game; const b = g.mobs.list.find((m) => m.def.boss); return { boss: b && b.type, state: g.arena.state, tag: g.arenaStatus() }; });
await page.evaluate(() => { const g = window.voxelwild.game; g.player.yaw = 0; g.player.pitch = 0.15; });
await wait(1500);
await page.screenshot({ path: join(out, 'arena-fight.png') });
// clear the wave: next boss queued
res.cleared = await page.evaluate(async () => { const g = window.voxelwild.game; g.mobs.list.forEach((m) => { m.dead = 2; }); g.mobs.list.length = 0; await new Promise((r) => setTimeout(r, 600)); return { wave: g.arena.wave, state: g.arena.state, tag: g.arenaStatus() }; });
// die: retry the wave
res.retry = await page.evaluate(async () => { const g = window.voxelwild.game; g.stats.damage(1000, 'void'); await new Promise((r) => setTimeout(r, 300)); const dead = g.state; g.respawn(); await new Promise((r) => setTimeout(r, 300)); return { dead, state: g.state, arena: g.arena.state, deaths: g.arena.deaths, items: g.inventory.slots.filter(Boolean).length }; });
// a single-boss arena to the end
await page.evaluate(async () => { window.voxelwild.ui.toTitle(); });
await wait(800);
await page.evaluate(() => { window.voxelwild.ui.show('arenaMenu'); document.querySelector('#arenaMenu [data-arena="king_slime"]').click(); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing' && window.voxelwild.game.arena, { timeout: 120000 });
await wait(7500);
res.single = await page.evaluate(async () => { const g = window.voxelwild.game; const b = g.mobs.list.find((m) => m.def.boss); g.mobs.hurt(b, 99999, g.player); await new Promise((r) => setTimeout(r, 300)); g.mobs.list.forEach((m) => { if (!m.def.boss) m.dead = 2; }); g.mobs.list = g.mobs.list.filter((m) => m.def.boss); await new Promise((r) => setTimeout(r, 2500)); return { state: g.arena.state, won: !document.getElementById('arenaWon').hidden, text: document.getElementById('arenaWonText').textContent }; });
await page.screenshot({ path: join(out, 'arena-won.png') });
console.log(JSON.stringify(res), 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
