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
  res.writeHead(200, { 'content-type': { '.html': 'text/html', '.webp': 'image/webp' }[extname(p)] || 'application/octet-stream' }); res.end(body);
});
await new Promise((r) => server.listen(0, r));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'], defaultViewport: { width: 1280, height: 720 } });
const page = await browser.newPage();
if (process.env.VIEWPORT) { const [w, h] = process.env.VIEWPORT.split('x').map(Number); await page.setViewport({ width: w, height: h, isMobile: !!process.env.MOBILE, hasTouch: !!process.env.MOBILE, deviceScaleFactor: process.env.MOBILE ? 2 : 1 }); }
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn' || m.text().startsWith('upload') || m.text().startsWith('free')) console.log('[' + m.type() + ']', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.evaluateOnNewDocument(() => { window.__trace = '-8,2,6'; });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.voxelwild && window.voxelwild.game.icons, { timeout: 30000 });
await page.waitForFunction(() => window.voxelwild.game.state === 'menu', { timeout: 60000 }); await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: join(out, 'shot-title.png') });
await page.evaluate((seed) => window.voxelwild.ui.play({ id: 'shots', name: 'Shots', seed: +seed, mode: 'creative', created: 0, lastPlayed: 0 }, true), seed);
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
const views = process.argv[4] ? JSON.parse(process.argv[4]) : [
  { name: 'a-north', dy: 0, yaw: 0, pitch: -0.1 }, { name: 'b-east', dy: 0, yaw: -1.57, pitch: -0.1 }, { name: 'c-south', dy: 0, yaw: 3.14, pitch: -0.1 },
  { name: 'd-west', dy: 0, yaw: 1.57, pitch: -0.1 }, { name: 'e-high', dy: 40, yaw: 0.6, pitch: -0.45 }, { name: 'f-down', dy: 6, yaw: 0.6, pitch: -1.2 },
];
const base = await page.evaluate(() => [...window.voxelwild.game.player.body.pos]);
for (let v of views) {
  if (v.cave) {
    const at = await page.evaluate(() => {
      const g = window.voxelwild.game, w = g.world, p = g.player.body.pos.map(Math.floor);
      for (let r = 0; r < 60; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        for (let y = 50; y > -40; y--) {
          const x = p[0] + dx, z = p[2] + dz;
          if (w.getBlock(x, y, z) === 0 && w.getBlock(x, y + 1, z) === 0 && w.getBlock(x, y + 2, z) === 0 && w.isSolidAt(x, y - 1, z) && (w.heightmapAt(x, z) ?? 0) > y + 12) {
            let open = 0; for (let k = 1; k < 6; k++) if (w.getBlock(x + k, y + 1, z) === 0) open++;
            if (open >= 4) { w.setBlock(x + 2, y, z + 1, 34); w.setBlock(x - 1, y, z - 2, 34); return [x + 0.5, y, z + 0.5]; }
          }
        }
      }
      return null;
    });
    if (!at) { console.log('no cave found'); continue; }
    v = { ...v, abs: at };
  }
  if (v.biome) {
    const at = await page.evaluate((v) => window.voxelwild.game.findBiome(v.biome), v);
    if (!at) { console.log('no biome', v.biome); continue; }
    await page.evaluate((at, v) => { const g = window.voxelwild.game; g.player.flying = true; g.player.teleport([at[0], at[1] + v.dy, at[2]], v.yaw, v.pitch); }, at, v);
    await page.waitForFunction(() => window.voxelwild.game.world.isAreaReady(window.voxelwild.game.player.body.pos[0], window.voxelwild.game.player.body.pos[2], 2), { timeout: 90000 }).catch(() => console.log('area not ready'));
    v = { ...v, abs: await page.evaluate(() => [...window.voxelwild.game.player.body.pos]) };
  }
  await page.evaluate((v, base, hour) => {
    const g = window.voxelwild.game; g.player.flying = true; g.tod.hour = v.hour ?? hour; g.tod.running = false; g.tod.nextAmbient = 0; if (v.weather != null) { g.weather.force(v.weather); g.weather.blend = 1; g.weather.frozen = true; g.weather.nextLightning = 1e9; g.flash = 0; }
    g.player.teleport(v.abs || [base[0] + (v.dx || 0), base[1] + v.dy, base[2] + (v.dz || 0)], v.yaw, v.pitch); g.player.body.vel = [0, 0, 0];
    if (!v.hud) document.getElementById('hud').hidden = true; g.renderer.debugView = v.debug || 0;
  }, v, base, hour);
  await new Promise((r) => setTimeout(r, v.dy > 20 ? 6000 : 2500));
  await page.screenshot({ path: join(out, `shot-${v.name}.png`) });
}
console.log(JSON.stringify(await page.evaluate(() => ({ ...window.voxelwild.game.debugInfo(), dyn: window.voxelwild.game.renderer.dynScale, px: window.voxelwild.game.renderer.width + 'x' + window.voxelwild.game.renderer.height }))));
if (process.env.PROBE) console.log(await page.evaluate(() => {
  const g = window.voxelwild.game, w = g.world, p = g.player.body.pos.map(Math.floor), counts = {};
  for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) for (let y = p[1] - 4; y <= p[1] + 1; y++) { const b = w.getBlock(p[0] + dx, y, p[2] + dz); counts[y + ':' + b] = (counts[y + ':' + b] || 0) + 1; }
  const secs = []; const cx = p[0] >> 5, cz = p[2] >> 5;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = w.column(cx + dx, cz + dz); if (!c) continue; for (const s of c.render) if (s.sy >= 1 && s.sy <= 2) secs.push(`${s.key} vis=${s.visible} gl=${s.gl ? [s.gl.n0, s.gl.n1, s.gl.n2].join('/') : 'none'} v=${s.version}/${s.meshedVersion} fancy=${s.fancy}`); }
  const t = g.target; return JSON.stringify({ p, secs, counts, target: t && t.block, water: [...w.columns.values()].reduce((a, c) => a + c.render.reduce((b, s) => b + (s.gl ? s.gl.n2 : 0), 0), 0) });
}));
await browser.close(); server.close();
