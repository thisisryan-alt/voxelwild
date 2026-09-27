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
await page.evaluate(() => window.voxelwild.ui.play({ id: 'gd', name: 'G', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0, startDim: 1 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing' && window.voxelwild.game.dim === 1, { timeout: 120000 });
await page.evaluate(() => { const g = window.voxelwild.game; g.player.canFly = true; g.player.flying = true; g.settings.mobs = true; g.player.teleport([198.5, 40, -129.5], 0, 0); });
await wait(9000);
res.bastion = await page.evaluate(() => window.voxelwild.game.mobs.list.filter((m) => m.type === 'hollow_king').length);
await page.screenshot({ path: join(out, 'guard-bastion.png') });
await page.evaluate(async () => { await window.voxelwild.game.save(); window.voxelwild.ui.toTitle(); });
await wait(800);
await page.evaluate(() => window.voxelwild.ui.play({ id: 'gd2', name: 'G2', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await page.evaluate(() => { const g = window.voxelwild.game; g.player.canFly = true; g.player.flying = true; g.settings.mobs = true; g.player.teleport([-743.5, 80, -1512.5], 3.14, -0.3); });
await wait(10000);
res.igloo = await page.evaluate(() => window.voxelwild.game.mobs.list.filter((m) => m.type === 'frost_colossus').length);
await page.screenshot({ path: join(out, 'guard-igloo.png') });
console.log(JSON.stringify(res), 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
