// Screenshots of the options screen, one per tab: node test/ui-shots.mjs
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), dist = join(root, 'dist'), out = join(root, 'test', 'out');
mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.webp': 'image/webp', '.json': 'application/json', '.ogg': 'audio/ogg' };
const server = http.createServer((req, res) => {
  const p = join(dist, new URL(req.url, 'http://x').pathname.replace(/^\/+/, '') || 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  let body = readFileSync(p);
  if (p.endsWith('index.html')) body = '<!doctype html><html><head><meta charset="utf-8"><style>[hidden]{display:none!important}body{margin:0}</style></head><body>' + body + '</body></html>';
  res.writeHead(200, { 'content-type': types[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' }); res.end(body);
});
await new Promise((r) => server.listen(0, r));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'], defaultViewport: { width: 1280, height: 800 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
await page.waitForFunction(() => window.voxelwild && window.voxelwild.game.state === 'menu', { timeout: 90000 });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: join(out, 'ui-title.png') });
await page.click('#btnSettingsT');
for (const t of ['Video', 'Quality', 'Sky & Time', 'Audio', 'Controls', 'Textures']) {
  await page.evaluate((t) => window.voxelwild.ui.showTab(t), t);
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: join(out, `ui-${t.replace(/\W+/g, '')}.png`) });
}
await browser.close(); server.close();
