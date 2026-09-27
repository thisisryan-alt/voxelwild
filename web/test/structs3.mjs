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
await page.evaluate(() => { window.voxelwild.game.noVillageStart = true; window.voxelwild.ui.play({ id: 's3', name: 'Structs3', seed: 20260925, mode: 'creative', unsaved: true, created: 0, lastPlayed: 0 }, true); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2000);
const res = {};
const found = await page.evaluate(() => {
  const g = window.voxelwild.game, { structuresIn, terrainFor } = window.voxelwild.structures, T = terrainFor(g.meta.seed), p = g.player.body.pos;
  const out = {};
  for (const kind of ['temple', 'tower', 'shipwreck']) {
    const list = structuresIn(g.meta.seed, T, p[0] - 2500, p[2] - 2500, p[0] + 2500, p[2] + 2500).filter((s) => s.kind === kind);
    list.sort((a, b) => Math.hypot(a.x - p[0], a.z - p[2]) - Math.hypot(b.x - p[0], b.z - p[2]));
    out[kind] = { n: list.length, near: list[0] && { x: list[0].x, z: list[0].z, gy: list[0].gy, rot: list[0].rot } };
  }
  return out;
});
res.found = found;
for (const kind of ['temple', 'tower', 'shipwreck']) {
  const s = found[kind].near; if (!s) continue;
  await page.evaluate((s, kind) => { const g = window.voxelwild.game; g.player.flying = true; const off = kind === 'tower' ? 14 : 16; g.player.teleport([s.x + 0.5, s.gy + (kind === 'shipwreck' ? 6 : 10), s.z + off], 0, kind === 'shipwreck' ? -0.45 : -0.35); }, s, kind);
  await page.waitForFunction((s) => { const w = window.voxelwild.game.world; const c = w.column(s.x >> 5, s.z >> 5); return c && c.state === 'ready'; }, { timeout: 60000 }, s);
  await wait(4000);
  res[kind] = await page.evaluate((s) => { const g = window.voxelwild.game, w = g.world, { C } = window.voxelwild.blocksMod; let chests = 0; for (let y = s.gy - 6; y < s.gy + 24; y++) for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) if (w.getBlock(s.x + dx, y, s.z + dz) === C.chest) chests++; return { chests }; }, s);
  await page.screenshot({ path: join(out, `struct-${kind}.png`) });
}
res.items = await page.evaluate(async () => {
  const g = window.voxelwild.game, I = window.voxelwild.items, inv = g.inventory, wait = (ms) => new Promise((r) => setTimeout(r, ms));
  g.setMode(false); g.player.flying = false; const out = {};
  inv.selected = 0; inv.slots[0] = { item: I.Compass, count: 1 }; await wait(300);
  out.compass = document.getElementById('restedTag').textContent;
  inv.slots[0] = { item: I.Spyglass, count: 1 }; g.mouse.right = true; await wait(900); out.zoom = [g.zoom, !document.getElementById('scope').hidden, g.mouse.right, inv.heldItem && inv.heldItem.name, g.state]; g.mouse.right = false; await wait(100);
  inv.slots[0] = { item: I.Crossbow, count: 1 }; inv.slots[1] = { item: I.Arrow, count: 5 };
  g.mouse.right = true; await wait(1500); out.loaded = [!!inv.slots[0].loaded, inv.count(I.Arrow)]; g.mouse.right = false; await wait(100);
  g.mouse.rightClicked = true; await wait(400); out.fired = [!inv.slots[0].loaded, g.mobs.projectiles.length];
  return out;
});
console.log(JSON.stringify(res), 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
