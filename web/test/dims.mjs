// The Nether, the End and a stronghold in real Chrome: travel there, look around, screenshot.
//   node test/dims.mjs [seed] [only]      (only: nether | end | stronghold | portal)
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dist = join(root, 'dist'), out = join(root, 'test', 'out');
mkdirSync(out, { recursive: true });
const seed = +(process.argv[2] || 20260925), only = process.argv[3] || '';
const types = { '.html': 'text/html', '.webp': 'image/webp', '.json': 'application/json', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = join(dist, new URL(req.url, 'http://x').pathname.replace(/^\/+/, '') || 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  let body = readFileSync(p);
  if (p.endsWith('index.html')) body = '<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>' + body + '</body></html>';
  res.writeHead(200, { 'content-type': types[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' }); res.end(body);
});
await new Promise((r) => server.listen(0, r));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'], defaultViewport: { width: 1280, height: 720 } });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warn') { console.log('[' + m.type() + ']', m.text()); if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); } });
page.on('pageerror', (e) => { console.log('[pageerror]', e.message); errors.push(e.message); });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.voxelwild && window.voxelwild.game.icons, { timeout: 60000 });
await page.waitForFunction(() => window.voxelwild.game.state === 'menu', { timeout: 90000 });
await page.evaluate((seed) => window.voxelwild.ui.play({ id: 'dims', name: 'Dims', seed, mode: 'creative', created: 0, lastPlayed: 0 }, true), seed);
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
const G = (fn, ...a) => page.evaluate(fn, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitPlaying = () => page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
const settle = async () => { await page.waitForFunction(() => { const g = window.voxelwild.game, p = g.player.body.pos; return g.world.isAreaReady(p[0], p[2], 2); }, { timeout: 90000 }).catch(() => console.log('area not ready')); await sleep(1500); };
const shot = async (name, yaw, pitch) => {
  await G((yaw, pitch) => { const g = window.voxelwild.game; g.player.yaw = yaw; g.player.pitch = pitch; document.getElementById('hud').hidden = true; }, yaw, pitch);
  await sleep(700);
  await page.screenshot({ path: join(out, `dim-${name}.png`) });
  console.log(name, JSON.stringify(await G(() => window.voxelwild.game.debugInfo())));
};
// hover in the open air of a cavern near x,z (the Nether) - the first spot with 6 blocks of air around the eye
const openAir = (x, z) => G((x, z) => {
  const g = window.voxelwild.game, w = g.world;
  for (let r = 0; r < 40; r += 2) for (let a = 0; a < 16; a++) {
    const px = Math.floor(x + Math.cos(a / 16 * 6.283) * r), pz = Math.floor(z + Math.sin(a / 16 * 6.283) * r);
    for (let y = 60; y < 100; y += 2) {
      let ok = true;
      for (let dy = -3; dy <= 3 && ok; dy++) for (const [dx, dz] of [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]]) if (w.getBlock(px + dx, y + dy, pz + dz) !== 0) { ok = false; break; }
      if (ok) { g.player.flying = true; g.player.teleport([px + 0.5, y - 1.6, pz + 0.5]); return [px, y, pz]; }
    }
  }
  return null;
}, x, z);

const results = {};
await G(() => { window.voxelwild.game.player.flying = true; window.voxelwild.game.tod.hour = 11; window.voxelwild.game.tod.running = false; });

if (!only || only === 'portal') {
  // build a frame and light it with flint and steel
  const r = await G(() => {
    const g = window.voxelwild.game, w = g.world, p = g.player.body.pos.map(Math.floor);
    const x0 = p[0] + 3, y0 = p[1], z0 = p[2];
    for (let i = 0; i < 4; i++) for (let k = -1; k <= 4; k++) w.setBlock(x0, y0 + k, z0 + i - 1, i === 0 || i === 3 || k === -1 || k === 4 ? 53 : 0);
    return { lit: g.lightPortal(x0, y0, z0), block: w.getBlock(x0, y0 + 1, z0) };
  });
  results.portal = r;
  await sleep(1200);
  await shot('overworld-portal', -1.57, -0.05);
}

if (!only || only === 'stronghold') {
  const s = await G(() => window.voxelwild.game.findPlace('stronghold'));
  await G((s) => window.voxelwild.game.player.teleport([s.x + 0.5, s.y + 60, s.z + 5.5]), s);
  await settle();
  await G((s) => window.voxelwild.game.player.teleport([s.x + 0.5, s.y + 4.5, s.z + 5.5]), s);
  await sleep(2500);
  await shot('stronghold', 0, -0.45);
  await G((s) => { const w = window.voxelwild.game.world; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(s.x + dx, s.y + 3, s.z + dz, 84); }, s);
  await sleep(1500);
  await shot('stronghold-open', 0, -0.6);
  results.stronghold = s;
}

if (!only || only === 'nether') {
  await G(() => { const g = window.voxelwild.game; g.travel(1, [0.5, 70, 0.5], 0, () => g.arrivePortal(1, 0, 0, null)); });
  await waitPlaying(); await settle();
  await shot('nether-arrival', 0.6, -0.1);
  await shot('nether-arrival-back', 3.5, -0.1);
  for (const b of ['NetherWastes', 'CrimsonForest', 'WarpedForest', 'SoulSandValley', 'BasaltDeltas']) {
    const at = await G((b) => window.voxelwild.game.findPlace('netherBiome', b), b);
    if (!at) { console.log('no', b); continue; }
    await G((at) => window.voxelwild.game.player.teleport([at[0], 80, at[2]]), at);
    await settle();
    const spot = await openAir(at[0], at[2]);
    await sleep(2500);
    await shot(`nether-${b}`, 0.8, -0.2);
    results[b] = spot;
  }
  const f = await G(() => window.voxelwild.game.findPlace('fortress'));
  if (f) {
    await G((f) => window.voxelwild.game.player.teleport([f[0] + 20.5, f[1] + 6, f[2] + 9.5]), f);
    await settle();
    await shot('nether-fortress', 1.1, -0.25);
    results.fortress = f;
  }
}

if (!only || only === 'end') {
  await G(() => { const g = window.voxelwild.game; g.travel(2, [100.5, 49, 0.5], Math.PI / 2, () => g.arriveEnd()); });
  await waitPlaying(); await settle();
  await shot('end-arrival', Math.PI / 2, 0.05);
  await G(() => window.voxelwild.game.player.teleport([30.5, 95, 60.5]));
  await settle();
  await shot('end-island', 2.6, -0.45);
  await G(() => window.voxelwild.game.player.teleport([-1230.5, 90, 20.5]));
  await settle();
  await shot('end-outer', 1.8, -0.35);
}
console.log(JSON.stringify(results));
console.log(errors.length ? `ERRORS ${errors.length}` : 'no errors');
writeFileSync(join(out, 'dims.json'), JSON.stringify({ results, errors }, null, 1));
await browser.close(); server.close();
