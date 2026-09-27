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
await page.evaluate(() => window.voxelwild.ui.play({ id: 'se', name: 'S', seed: 20260925, mode: 'creative', unsaved: true, created: 0, lastPlayed: 0 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await page.evaluate(() => { const g = window.voxelwild.game, p = g.player.body.pos; g.player.flying = true; g.player.teleport([p[0], p[1] + 25, p[2]], 0.6, -0.35); g.settings.dayCycle = 'fixed'; g.tod.running = false; g.tod.hour = 11; });
await page.evaluate(() => { const g = window.voxelwild.game, w = g.world, p = g.player.body.pos.map(Math.floor); for (let dx = -3; dx <= 3; dx++) for (let dy = -2; dy <= 1; dy++) w.setBlock(p[0] + dx, p[1] + dy, p[2] - 5, dx < 0 ? 16 : dx === 0 ? 3 : 17); g.player.pitch = -0.1; g.player.yaw = 0; });
for (const [name, day] of [['summer', 4.5], ['autumn', 7.6], ['winter', 10.5]]) {
  await page.evaluate((d) => { const g = window.voxelwild.game; g.tod.day = Math.floor(d); g.tod.hour = 11; }, day);
  await wait(2500);
  console.log(name, await page.evaluate(() => { const g = window.voxelwild.game, r = g.renderer, gl = r.gl; const out = {}; for (const [k, p] of Object.entries(r.progs)) { if (p && p.u && p.u.uSeason) { out[k] = Array.from(gl.getUniform(p.p, p.u.uSeason.loc)); } } return JSON.stringify([g.seasonNow(), out]); }));
  await page.screenshot({ path: join(out, `season-${name}.png`) });
}
console.log('errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
