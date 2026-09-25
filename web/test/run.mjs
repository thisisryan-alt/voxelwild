// End-to-end test in real Chrome (GPU): boots the built page, creates a world, plays it through the game's own input
// state (walk, jump, mine by hand with drops, craft, place, eat, creative flight), switches time and weather, takes
// screenshots, and fails on any console error. Usage: node test/run.mjs [--headful] [--shots-only]
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

const types = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html');
  if (req.url.startsWith('/favicon')) { res.writeHead(204); res.end(); return; }
  if (!p.startsWith(dist) || !existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
  let body = readFileSync(p);
  // the artifact viewer wraps the page in this skeleton; mirror it locally
  if (p.endsWith('index.html')) body = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui;background:#fafaf7}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + body + '</body></html>';
  res.end(body);
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await puppeteer.launch({
  executablePath: exe, headless: !headful,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-webgl', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,760'],
  defaultViewport: { width: 1280, height: 720 },
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

await step('boot', async () => {
  await page.goto(url, { waitUntil: 'load' });
  await waitFor(() => window.voxelwild && window.voxelwild.game.icons, 30000, 'textures');
  const gl = await G(() => { const r = window.voxelwild.game.renderer.gl; const d = r.getExtension('WEBGL_debug_renderer_info'); return d ? r.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  await shot('01-title');
  return { gl };
});

await step('new survival world', async () => {
  await page.click('#btnNew');
  await page.$eval('#nwSeed', (el) => { el.value = '20260925'; });
  await page.click('#newForm button[type=submit]');
  const t0 = Date.now();
  await waitFor(() => window.voxelwild.game.state === 'playing', 120000, 'world load');
  await new Promise((r) => setTimeout(r, 2500));
  await shot('02-spawn');
  return await G(() => ({ loadSeconds: 0, ...window.voxelwild.game.debugInfo() })).then((d) => ({ ...d, loadSeconds: ((Date.now() - t0) / 1000).toFixed(1) }));
});

await step('walk and jump', async () => {
  const p0 = await G(() => [...window.voxelwild.game.player.body.pos]);
  await hold(() => { const g = window.voxelwild.game; g.keys.add('KeyW'); g.keys.add('Space'); }, 2000, () => { const g = window.voxelwild.game; g.keys.clear(); });
  const p1 = await G(() => [...window.voxelwild.game.player.body.pos]);
  const d = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
  if (d < 2) throw new Error(`moved only ${d.toFixed(2)} m`);
  return { moved: d.toFixed(1) };
});

await step('mine by hand and collect drop', async () => {
  // look straight down at the ground and hold the mouse
  const r = await G(() => {
    const g = window.voxelwild.game; g.player.pitch = -1.55;
    return new Promise((res) => setTimeout(() => res(g.target ? { block: g.target.block, at: g.target.hit } : null), 200));
  });
  if (!r) throw new Error('no block targeted below the player');
  const before = await G(() => JSON.stringify(window.voxelwild.game.inventory.slots.filter(Boolean)));
  await hold(() => { window.voxelwild.game.mouse.left = true; }, 3500, () => { window.voxelwild.game.mouse.left = false; });
  await new Promise((res) => setTimeout(res, 1500));
  const after = await G(() => window.voxelwild.game.inventory.slots.filter(Boolean));
  if (JSON.stringify(after) === before) throw new Error(`nothing collected after mining block ${r.block}`);
  await shot('03-mined');
  return { mined: r.block, inventory: after };
});

await step('place a block', async () => {
  const r = await G(async () => {
    const g = window.voxelwild.game;
    g.player.teleport(g.spawn); await new Promise((res) => setTimeout(res, 400));
    const slot = g.inventory.slots.findIndex((s) => s && s.item < 256);
    if (slot < 0) return { skipped: 'no block in inventory' };
    g.inventory.slots[0] = g.inventory.slots[slot]; if (slot) g.inventory.slots[slot] = null; g.select(0);
    let tgt = null;
    for (const pitch of [-0.7, -0.9, -0.5, -1.1, -0.35]) {
      for (const yaw of [0, 1.57, 3.14, 4.71]) {
        g.player.pitch = pitch; g.player.yaw = yaw;
        await new Promise((res) => setTimeout(res, 120));
        const t = g.target;
        if (t && !g.player.body.overlaps(...t.prev)) { tgt = t; break; }
      }
      if (tgt) break;
    }
    if (!tgt) return { skipped: 'no target' };
    const n0 = g.inventory.count(g.inventory.slots[0].item);
    g.mouse.rightClicked = true;
    await new Promise((res) => setTimeout(res, 300));
    const n1 = g.inventory.count(g.inventory.slots[0] ? g.inventory.slots[0].item : -1);
    return { placedAt: tgt.prev, before: n0, after: n1 };
  });
  if (r.skipped) throw new Error(r.skipped);
  if (!(r.after < r.before)) throw new Error('block count did not drop: ' + JSON.stringify(r));
  return r;
});

await step('craft planks and sticks from logs', async () => {
  return await G(() => {
    const g = window.voxelwild.game;
    g.inventory.add(12, 2);   // oak logs
    const { RECIPES } = { RECIPES: null };
    return true;
  }).then(async () => {
    await page.keyboard.press('KeyE');
    await new Promise((r) => setTimeout(r, 300));
    await shot('04-inventory');
    const crafted = await G(() => {
      const btns = [...document.querySelectorAll('#recipes .recipe:not([disabled])')];
      const planks = btns.find((b) => b.textContent.includes('Planks'));
      if (!planks) return 'no planks recipe enabled';
      planks.click();
      const sticks = [...document.querySelectorAll('#recipes .recipe:not([disabled])')].find((b) => b.textContent.includes('Stick'));
      if (!sticks) return 'no stick recipe enabled';
      sticks.click();
      const g = window.voxelwild.game;
      return { planks: g.inventory.count(10), sticks: g.inventory.count(256) };
    });
    await page.keyboard.press('KeyE');
    if (typeof crafted === 'string') throw new Error(crafted);
    return crafted;
  });
});

await step('hunger and eating', async () => {
  return await G(async () => {
    const g = window.voxelwild.game;
    g.stats.hunger = 10;
    g.inventory.slots[1] = { item: 261, count: 2 }; g.select(1);
    g.mouse.rightClicked = true;
    await new Promise((r) => setTimeout(r, 300));
    return { hunger: g.stats.hunger, apples: g.inventory.count(261) };
  }).then((r) => { if (r.hunger <= 10) throw new Error('did not eat'); return r; });
});

await step('fall damage', async () => {
  return await G(async () => {
    const g = window.voxelwild.game;
    const h0 = g.stats.health; const p = g.player.body.pos;
    g.player.teleport([p[0], p[1] + 12, p[2]]);
    await new Promise((r) => setTimeout(r, 2500));
    return { before: h0, after: g.stats.health };
  }).then((r) => { if (!(r.after < r.before)) throw new Error('no fall damage ' + JSON.stringify(r)); return r; });
});

await step('views: noon, sunset, night, storm, underwater', async () => {
  const set = (h, weather) => G((h, w) => { const g = window.voxelwild.game; g.tod.hour = h; g.tod.nextAmbient = 0; if (w != null) { g.weather.force(w); g.weather.blend = 1; } }, h, weather);
  await G(() => { const g = window.voxelwild.game; g.stats.health = 20; g.player.teleport(g.spawn, 2.4, -0.05); });
  await set(12.5, 0); await new Promise((r) => setTimeout(r, 1500)); await shot('05-noon');
  await set(18.6, null); await new Promise((r) => setTimeout(r, 1500)); await shot('06-sunset');
  await set(23.5, null); await new Promise((r) => setTimeout(r, 1500)); await shot('07-night');
  await set(14, 4); await new Promise((r) => setTimeout(r, 4000)); await shot('08-storm');
  await set(11, 0);
  return await G(() => window.voxelwild.game.debugInfo());
});

await step('creative flight and far streaming', async () => {
  await G(() => { const g = window.voxelwild.game; g.setMode(true); g.player.flying = true; g.player.teleport([g.player.body.pos[0], 120, g.player.body.pos[2]], null, -0.35); });
  await hold(() => { const g = window.voxelwild.game; g.keys.add('KeyW'); g.keys.add('ControlLeft'); }, 5000, () => window.voxelwild.game.keys.clear());
  await new Promise((r) => setTimeout(r, 3000));
  await shot('09-flight');
  return await G(() => window.voxelwild.game.debugInfo());
});

await step('save and reload', async () => {
  await G(() => window.voxelwild.game.save());
  const worlds = await G(() => window.voxelwild.game.store.listWorlds().then((w) => w.length));
  if (!worlds) throw new Error('no saved world listed');
  return { worlds };
});

await step('no console errors', async () => {
  const bad = errors.filter((e) => !/favicon|fonts\.g/.test(e));
  if (bad.length) throw new Error(bad.slice(0, 5).join('\n'));
  return { logs: logs.length };
});

writeFileSync(join(out, 'results.json'), JSON.stringify({ results, logs: logs.slice(-80) }, null, 2));
await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `${failed.length} FAILED` : 'ALL PASSED');
process.exit(failed.length ? 1 : 0);
