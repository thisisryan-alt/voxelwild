// Imports a resource pack ZIP through Options > Textures like a player, reports what was used, screenshots.
//   node test/pack-import.mjs "<pack.zip>" [name]
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dist = join(root, 'dist'), out = join(root, 'test', 'out');
mkdirSync(out, { recursive: true });
const zip = process.argv[2], tag = process.argv[3] || 'pack';
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
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.voxelwild && window.voxelwild.game.state === 'menu', { timeout: 90000 });
await page.evaluate(() => window.voxelwild.ui.play({ id: 'packs', name: 'Packs', seed: 20260925, mode: 'creative', created: 0, lastPlayed: 0 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await page.keyboard.press('Escape');
await page.click('#btnSettingsP');
await page.evaluate(() => window.voxelwild.ui.showTab('Textures'));
const t0 = Date.now();
await (await page.$('#packFile')).uploadFile(zip);
await page.waitForFunction(() => /Using|Could not/.test(document.getElementById('packStatus').textContent), { timeout: 600000 });
console.log('seconds', ((Date.now() - t0) / 1000).toFixed(1));
console.log('status', await page.evaluate(() => document.getElementById('packStatus').textContent));
console.log('pack', JSON.stringify(await page.evaluate(() => { const p = window.voxelwild.game.pack; return { found: p.found.length, size: p.size, stats: p.stats, items: p.items, sounds: p.sounds }; })));
await page.click('#btnSettingsDone');
await page.click('#btnResume');
for (const [name, yaw, pitch, dy] of [['a', 0.6, -0.2, 3], ['b', 2.4, -0.35, 12]]) {
  await page.evaluate((yaw, pitch, dy) => { const g = window.voxelwild.game; g.player.flying = true; const p = g.player.body.pos; g.player.teleport([p[0], p[1] + dy, p[2]], yaw, pitch); document.getElementById('hud').hidden = true; g.tod.hour = 11; g.tod.running = false; }, yaw, pitch, dy);
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: join(out, `pack-${tag}-${name}.png`) });
}
await browser.close(); server.close();
