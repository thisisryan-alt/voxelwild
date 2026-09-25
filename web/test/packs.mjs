// Built-in resource packs in real Chrome: boots the built page, starts a world, switches through every pack in
// assets/packs.json from the Settings screen, screenshots a test wall and the landscape with each, checks the choice
// survives a reload, and fails on any console error. Usage: node test/packs.mjs  (CHROME=path to use another browser)
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'test', 'out');
mkdirSync(out, { recursive: true });
const headful = process.argv.includes('--headful');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.bin': 'application/octet-stream', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
  if (req.url.startsWith('/favicon')) { res.writeHead(204); res.end(); return; }
  if (!p.startsWith(dist) || !existsSync(p)) { res.writeHead(404); res.end(); return; }
  const headers = { 'content-type': types[extname(p)] || 'application/octet-stream' };
  // mirror the artifact frame's restrictions: no eval, workers only from blob:/self, same-origin fetch, Google Fonts
  if (process.env.CSP) headers['content-security-policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com";
  res.writeHead(200, headers);
  let body = readFileSync(p);
  // the artifact viewer wraps the page in this skeleton; mirror it locally
  if (p.endsWith('index.html')) body = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui;background:#fafaf7}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + body + '</body></html>';
  res.end(body);
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const exe = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean).find(existsSync);
const gpuArgs = process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog', '--disable-gpu-process-crash-limit', ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [])];
const browser = await puppeteer.launch({
  executablePath: exe, headless: !headful,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', ...gpuArgs, '--enable-webgl', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,760'],
  defaultViewport: { width: 960, height: 540 },
});
const page = await browser.newPage();
const errors = [], logs = [];
page.on('console', (m) => { const t = `[${m.type()}] ${m.text()}`; logs.push(t); if (m.type() === 'error') errors.push(t); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const results = [];
const step = async (name, fn) => {
  const t0 = Date.now();
  try { const r = await fn(); results.push({ name, ok: true, ms: Date.now() - t0, info: r }); console.log(`PASS ${name}${r ? ' - ' + JSON.stringify(r) : ''}`); }
  catch (e) { results.push({ name, ok: false, error: String(e && e.message || e) }); console.log(`FAIL ${name}: ${e && e.message || e}`); }
};
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
const G = (fn, ...a) => page.evaluate(fn, ...a);
const waitFor = async (fn, timeout, what) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await G(fn)) return; await new Promise((r) => setTimeout(r, 250)); }
  throw new Error(`timed out waiting for ${what}`);
};
const hold = async (setup, ms, teardown) => { await G(setup); await new Promise((r) => setTimeout(r, ms)); await G(teardown); };


await step('boot and start a world', async () => {
  await page.goto(url, { waitUntil: 'load' });
  await waitFor(() => window.voxelwild && window.voxelwild.game.icons && window.voxelwild.game.state === 'menu', 300000, 'title');
  await waitFor(() => document.querySelectorAll('#builtinPacks button').length > 1, 20000, 'built-in pack buttons');
  // software rendering (no GPU): keep frames short so the GPU process isn't reset mid-test
  if (process.platform !== 'win32') await G(() => { const g = window.voxelwild.game; g.applySettings({ ...g.settings, renderScale: 0.6, shadows: 0, bloom: false, godRays: false, viewDistance: 4 }); });
  await page.click('#btnNew');
  await page.$eval('#nwSeed', (el) => { el.value = '20260925'; });
  await page.click('#newForm button[type=submit]');
  await waitFor(() => window.voxelwild.game.state === 'playing', 300000, 'world load');
  await new Promise((r) => setTimeout(r, 3000));
  await shot('pack-00-loaded');
  if (process.env.STOP_AFTER_LOAD) { writeFileSync(join(out, 'packs-console.txt'), logs.join('\n')); await browser.close(); server.close(); process.exit(0); }
  // a test wall of every main block, lit from the front, at noon
  return await G(() => {
    const g = window.voxelwild.game, w = g.world;
    g.setMode(true); g.player.flying = true;
    g.tod.hour = 11.5; g.tod.running = false;
    const p = g.player.body.pos.map(Math.floor);
    const ids = [1, 9, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 20, 21, 25, 26, 27, 28];
    ids.forEach((id, k) => { for (let dy = 0; dy < 2; dy++) w.setBlock(p[0] - 9 + k, p[1] + 1 + dy, p[2] - 5, id); });
    g.player.teleport([p[0] + 0.5, p[1] + 2.2, p[2] + 0.5], 0, -0.12);
    return { at: p, buttons: [...document.querySelectorAll('#builtinPacks button')].map((b) => b.textContent) };
  });
});

const packs = await G(() => [...document.querySelectorAll('#builtinPacks button')].map((b) => b.dataset.pack));
for (const id of packs) {
  await step(`pack: ${id || 'default'}`, async () => {
    const t0 = Date.now();
    await G((id) => window.voxelwild.ui.useBuiltin(id), id);
    const status = await G(() => document.getElementById('packStatus').textContent);
    if (/Could not/.test(status)) throw new Error(status);
    const pack = await G(() => window.voxelwild.game.pack);
    if (id && (!pack || pack.builtin !== id)) throw new Error('pack not applied: ' + JSON.stringify(pack));
    await new Promise((r) => setTimeout(r, 2500));
    await shot(`pack-${id || 'default'}-wall`);
    await G(() => { const g = window.voxelwild.game; const p = g.player.body.pos; g.player.teleport([p[0], p[1] + 14, p[2] + 6], 0.6, -0.45); });
    await new Promise((r) => setTimeout(r, 3000));
    await shot(`pack-${id || 'default'}-land`);
    await G(() => { const g = window.voxelwild.game; const p = g.player.body.pos; g.player.teleport([p[0], p[1] - 14, p[2] - 6], 0, -0.12); });
    return { seconds: ((Date.now() - t0) / 1000).toFixed(1), found: pack ? pack.found.length : 0, size: pack && pack.size, status };
  });
}

await step('choice survives a reload', async () => {
  await G(() => window.voxelwild.ui.useBuiltin('photoreal'));
  await G(() => window.voxelwild.game.save());
  await page.reload({ waitUntil: 'load' });
  await waitFor(() => window.voxelwild && window.voxelwild.game.icons && window.voxelwild.game.state === 'menu', 120000, 'title after reload');
  const pack = await G(() => window.voxelwild.game.pack && window.voxelwild.game.pack.builtin);
  if (pack !== 'photoreal') throw new Error('pack after reload: ' + pack);
  await G(() => window.voxelwild.game.removePack());
  return { restored: pack };
});

await step('no console errors', async () => {
  const bad = errors.filter((e) => !/favicon|fonts\.g|GPU stall|WebGL-/.test(e));
  if (bad.length) throw new Error(bad.slice(0, 5).join(' | '));
});

await browser.close();
server.close();
writeFileSync(join(out, 'packs-results.json'), JSON.stringify(results, null, 1));
writeFileSync(join(out, 'packs-console.txt'), logs.join('\n'));
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
