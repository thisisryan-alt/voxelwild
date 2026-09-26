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
  await waitFor(() => window.voxelwild.game.state === 'menu', 60000, 'title backdrop');
  await new Promise((r) => setTimeout(r, 1500));
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
  const r = await G(async () => {
    const g = window.voxelwild.game; g.player.teleport(g.spawn, 0, -1.55); await new Promise((res) => setTimeout(res, 600)); g.player.pitch = -1.55;
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
    // stand beside the hole the mining step dug, on the highest solid block
    const sx = Math.floor(g.spawn[0]) + 3, sz = Math.floor(g.spawn[2]);
    let sy = 150; while (sy > 0 && !g.world.isSolidAt(sx, sy - 1, sz)) sy--;
    g.player.teleport([sx + 0.5, sy + 0.01, sz + 0.5]); await new Promise((res) => setTimeout(res, 400));
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

await step('creative palette and pause menu', async () => {
  await page.keyboard.press('KeyE');
  await new Promise((r) => setTimeout(r, 300));
  const r = await G(() => {
    const pal = document.getElementById('palette');
    if (pal.hidden) return 'palette hidden in creative';
    const cell = pal.querySelector('[data-item="11"]');
    cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    const slot = document.querySelector('#invMain .slot[data-slot="20"]');
    slot.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    const s = window.voxelwild.game.inventory.slots[20];
    return s ? { item: s.item, count: s.count } : 'nothing placed in slot';
  });
  await shot('11-creative-inventory');
  await page.keyboard.press('KeyE');
  if (typeof r === 'string') throw new Error(r);
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 300));
  const paused = await G(() => window.voxelwild.ui.screen);
  await shot('12-pause');
  await page.click('#btnResume');
  const resumed = await G(() => window.voxelwild.ui.screen);
  if (paused !== 'pause' || resumed !== 'playing') throw new Error(`pause flow: ${paused} -> ${resumed}`);
  return { ...r, paused, resumed };
});

await step('tool tiers: stone needs a pickaxe', async () => {
  const r = await G(async () => {
    const g = window.voxelwild.game, w = g.world;
    g.setMode(false); g.player.flying = false;
    g.player.teleport(g.spawn, 0, 0);
    await new Promise((res) => setTimeout(res, 1500));
    // a stone block right in front of the player, at eye level
    const eye = g.player.eye();
    const bx = Math.floor(eye[0]), by = Math.floor(eye[1]), bz = Math.floor(eye[2]) - 2;
    w.setBlock(bx, by, bz, 1); w.setBlock(bx, by, bz + 1, 0);
    g.player.yaw = 0; g.player.pitch = 0;
    await new Promise((res) => setTimeout(res, 600));
    const hit = g.target && g.target.hit.join(',');
    const mineFor = async (ms) => { g.mouse.left = true; await new Promise((res) => setTimeout(res, ms)); g.mouse.left = false; await new Promise((res) => setTimeout(res, 900)); };
    g.inventory.slots[2] = null; g.select(2);
    const c0 = g.inventory.count(9);
    await mineFor(8000);
    const handBroke = w.getBlock(bx, by, bz) === 0, handDrop = g.inventory.count(9) - c0;
    w.setBlock(bx, by, bz, 1);
    await new Promise((res) => setTimeout(res, 500));
    g.inventory.slots[2] = { item: 270, count: 1, wear: 0 }; g.select(2);
    const t0 = performance.now();
    await mineFor(1400);
    const pickBroke = w.getBlock(bx, by, bz) === 0, pickDrop = g.inventory.count(9) - c0, wear = g.inventory.slots[2] && g.inventory.slots[2].wear;
    return { hit, handBroke, handDrop, pickBroke, pickDrop, wear };
  });
  if (!r.handBroke || r.handDrop !== 0) throw new Error('hand should break stone slowly with no drop: ' + JSON.stringify(r));
  if (!r.pickBroke || r.pickDrop !== 1 || r.wear !== 1) throw new Error('wooden pickaxe should drop cobblestone and wear: ' + JSON.stringify(r));
  return r;
});

await step('torch lights a dark spot', async () => {
  const r = await G(async () => {
    const g = window.voxelwild.game, w = g.world;
    const p = g.player.body.pos.map(Math.floor);
    const before = g.blockLightNear(p[0] + 0.5, p[1] + 0.5, p[2] + 0.5);
    w.setBlock(p[0] + 2, p[1], p[2], 34);
    await new Promise((res) => setTimeout(res, 400));
    const after = g.blockLightNear(p[0] + 0.5, p[1] + 0.5, p[2] + 0.5);
    const placed = w.getBlock(p[0] + 2, p[1], p[2]);
    w.setBlock(p[0] + 2, p[1], p[2], 0);
    return { before, after, placed };
  });
  if (!(r.after > r.before)) throw new Error(JSON.stringify(r));
  return r;
});

await step('drowning and death, then respawn', async () => {
  const r = await G(async () => {
    const g = window.voxelwild.game, w = g.world;
    const p = g.player.body.pos.map(Math.floor);
    // a sealed water column over the player's head
    for (let y = p[1]; y <= p[1] + 3; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(p[0] + dx, y, p[2] + dz, dx || dz ? 1 : 8, false);
    g.player.teleport([p[0] + 0.5, p[1] + 0.01, p[2] + 0.5]);
    g.stats.air = 1.5; g.stats.health = 4;
    await new Promise((res) => setTimeout(res, 5000));
    const dead = g.state === 'dead', screen = window.voxelwild.ui.screen;
    document.getElementById('btnRespawn').click();
    await new Promise((res) => { const t = setInterval(() => { if (g.state === 'playing') { clearInterval(t); res(); } }, 100); setTimeout(res, 15000); });
    for (let y = p[1]; y <= p[1] + 3; y++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(p[0] + dx, y, p[2] + dz, 0, false);
    return { dead, screen, after: g.state, health: g.stats.health, dropped: g.entities.length };
  });
  if (!r.dead || r.screen !== 'death' || r.after !== 'playing' || r.health !== 20) throw new Error(JSON.stringify(r));
  return r;
});

await step('water flows into a dug channel', async () => {
  const r = await G(async () => {
    const g = window.voxelwild.game, w = g.world;
    const p = g.player.body.pos.map(Math.floor);
    const y = p[1] + 6, x = p[0] + 3, z = p[2];
    // a stone trough with a source at one end
    for (let dx = -1; dx <= 6; dx++) for (let dz = -1; dz <= 1; dz++) { w.setBlock(x + dx, y - 1, z + dz, 1, false); w.setBlock(x + dx, y, z + dz, dz ? 1 : 0, false); }
    w.setBlock(x - 1, y, z, 1, false); w.setBlock(x + 6, y, z, 1, false);
    w.setBlock(x, y, z, 8);
    await new Promise((res) => setTimeout(res, 3500));
    const row = []; for (let dx = 0; dx <= 5; dx++) row.push(w.getBlock(x + dx, y, z));
    return { row };
  });
  const flowing = r.row.slice(1).filter((b) => b >= 38 && b <= 44).length;
  if (flowing < 4) throw new Error('water did not spread: ' + JSON.stringify(r));
  return r;
});

await step('drops and cracks render', async () => {
  await G(async () => {
    const g = window.voxelwild.game;
    g.player.teleport(g.spawn, 0.8, -0.35);
    const e = g.player.eye(), f = g.player.forward();
    for (const [i, item] of [[0, 3], [1, 12], [2, 257], [3, 271], [4, 261], [5, 30]].entries()) g.spawnItem(item[1], 1, [e[0] + f[0] * 2.5 + (i - 2.5) * 0.4, e[1], e[2] + f[2] * 2.5], [0, 0, 0], 0, 60);
    await new Promise((res) => setTimeout(res, 1500));
  });
  await shot('10-drops');
  return await G(() => ({ entities: window.voxelwild.game.entities.length }));
});

await step('props: placed, lit, removed with their support', async () => {
  const r = await G(async () => {
    const g = window.voxelwild.game, w = g.world, f = w.props;
    let best = null;
    for (const sp of f.sections.values()) for (const it of sp.items) if (it.kind === 2 || it.kind === 6 || it.kind === 7 || it.kind === 5) { best = it; break; }
    if (!best) return { skipped: 'no boulder/stump/log loaded', loaded: f.loaded };
    const lit = [...f.sections.values()].filter((s) => s.lit).length;
    const cells = []; const core = w.getBlock(best.x, best.y, best.z);
    w.setBlock(best.x, best.y - 1, best.z, 0);
    const still = [...f.sections.values()].some((sp) => sp.items.includes(best));
    const after = w.getBlock(best.x, best.y, best.z);
    return { kind: best.kind, at: [best.x, best.y, best.z], coreBefore: core, coreAfter: after, still, removed: f.removed.size, loaded: f.loaded, litSections: lit };
  });
  if (r.skipped) throw new Error(JSON.stringify(r));
  if (r.still || !(r.coreAfter === 0 || r.coreAfter === 1 && r.kind === 2)) throw new Error(JSON.stringify(r));
  return r;
});

await step('save and reload', async () => {
  await G(() => window.voxelwild.game.save());
  const worlds = await G(() => window.voxelwild.game.store.listWorlds().then((w) => w.length));
  if (!worlds) throw new Error('no saved world listed');
  return { worlds };
});

await step('LBPR textures by default, switch to the originals and back', async () => {
  const before = await G(() => {
    const g = window.voxelwild.game, b = g.builtin;
    return { set: b.name, layers: Math.round(b.albedo.height / b.albedo.width), variants: b.variants && b.variants.length,
      items: b.items && b.items.size, credit: b.credit && b.credit.author, sounds: Object.keys(b.sounds || {}).length,
      decoded: g.audio.samples ? Object.values(g.audio.samples).reduce((a, l) => a + l.length, 0) : 0 };
  });
  if (before.set !== 'lbpr' || before.layers < 100 || !before.items || !before.credit) throw new Error(JSON.stringify(before));
  await page.keyboard.press('Escape');
  await page.click('#btnSettingsP');
  const credit = await G(() => document.getElementById('texCredit').textContent);
  if (!/1LotS/.test(credit) || !(await G(() => !!document.querySelector('#texCredit a[href*="curseforge"]')))) throw new Error('credit missing: ' + credit);
  await page.click('#btnTexOriginal');
  await waitFor(() => window.voxelwild.game.builtin.name === 'original' && document.getElementById('btnTexOriginal').classList.contains('on'), 30000, 'original textures');
  await page.click('#btnTexLbpr');
  await waitFor(() => window.voxelwild.game.builtin.name === 'lbpr', 30000, 'LBPR textures');
  const stored = await G(() => JSON.parse(localStorage.getItem('voxelwild.settings') || '{}').textures);
  await page.click('#btnSettingsDone');
  await page.click('#btnResume');
  if (stored !== 'lbpr') throw new Error('setting not stored: ' + stored);
  return { ...before, stored };
});

await step('resource pack: load a LabPBR pack ZIP', async () => {
  await G(async () => {
    const g = window.voxelwild.game, w = g.world;
    g.setMode(true); g.player.flying = true;
    const p = g.player.body.pos.map(Math.floor);
    // a small wall of stone and cobblestone to look at
    for (let dx = -2; dx <= 2; dx++) for (let dy = 0; dy < 3; dy++) w.setBlock(p[0] + dx, p[1] + dy, p[2] - 3, (dx + dy) & 1 ? 1 : 9);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 0; dz++) w.setBlock(p[0] + dx, p[1] - 1, p[2] + dz, 3);
    g.player.teleport([p[0] + 0.5, p[1] + 0.2, p[2] + 0.5], 0.35, -0.3);
  });
  await page.keyboard.press('Escape');
  await page.click('#btnSettingsP');
  const input = await page.$('#packFile');
  await input.uploadFile(join(root, 'test', 'fixtures', 'labpbr-test-pack.zip'));
  await waitFor(() => /Using|Could not/.test(document.getElementById('packStatus').textContent), 30000, 'pack import');
  const status = await G(() => document.getElementById('packStatus').textContent);
  if (!/^Using/.test(status)) throw new Error(status);
  await shot('13-pack-settings');
  await page.click('#btnSettingsDone');
  await page.click('#btnResume');
  await new Promise((r) => setTimeout(r, 2500));
  await shot('14-pack-pom');
  const pack = await G(() => window.voxelwild.game.pack);
  for (const l of ['Stone', 'Cobblestone', 'GrassTop', 'Leaves', 'Dirt']) if (!pack.found.includes(l)) throw new Error(`layer ${l} not taken from the pack: ${pack.found}`);
  return { status, found: pack.found, size: pack.size };
});

await step('edits persist across a page reload', async () => {
  const mark = await G(async () => {
    const g = window.voxelwild.game, w = g.world;
    const p = g.player.body.pos.map(Math.floor);
    const at = [p[0] + 1, p[1] + 3, p[2] + 1];
    w.setBlock(at[0], at[1], at[2], 11);
    await g.save();
    return at;
  });
  await page.reload({ waitUntil: 'load' });
  await waitFor(() => window.voxelwild && window.voxelwild.game.icons && !document.getElementById('btnContinue').hidden, 30000, 'title with a saved world');
  await page.click('#btnContinue');
  await waitFor(() => window.voxelwild.game.state === 'playing', 120000, 'reload into world');
  const b = await G((at) => window.voxelwild.game.world.getBlock(at[0], at[1], at[2]), mark);
  if (b !== 11) throw new Error(`expected bricks at ${mark}, found ${b}`);
  const pack = await G(() => window.voxelwild.game.pack && window.voxelwild.game.pack.name);
  if (pack !== 'labpbr-test-pack') throw new Error('resource pack not restored after reload: ' + pack);
  await G(() => window.voxelwild.game.removePack());
  return { bricksAt: mark, packRestored: pack };
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
