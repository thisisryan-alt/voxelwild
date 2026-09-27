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
await page.evaluate(() => { window.voxelwild.game.noVillageStart = true; window.voxelwild.ui.play({ id: 'en', name: 'Enchant', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2500);
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, I = window.voxelwild.items, { FAM, C } = window.voxelwild.blocksMod, ITEMS = window.voxelwild.itemsDefs;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {}, inv = g.inventory;
  g.mobs.list.length = 0;
  // xp curve
  g.stats.level = 0; g.stats.xp = 0; g.giveXp(7); out.lv1 = [g.stats.level, g.stats.xp];
  g.giveXp(1600); out.lvMany = g.stats.level;
  // enchanting a sword
  inv.slots[0] = { item: I.DiamondSword, count: 1 }; inv.slots[1] = { item: I.LapisLazuli, count: 10 }; inv.selected = 0;
  g.openStation({ kind: 'enchant', name: 'Enchanting Table', slot: 0 });
  await wait(300);
  out.offers = g.enchantOffersFor(0).map((o) => [o.levels, JSON.stringify(o.ench)]);
  out.panelButtons = document.querySelectorAll('#recipes button.recipe').length;
  const before = g.stats.level;
  document.querySelectorAll('#recipes button.recipe')[2].click();
  out.ench = inv.slots[0].ench; out.cost = before - g.stats.level; out.lapisLeft = inv.count(I.LapisLazuli);
  out.glint = !!document.querySelector('#hotbar .glint');
  // drop and pick up keeps enchantments (and armour keeps wear)
  const s = inv.slots[0]; inv.slots[0] = null;
  const pp = g.player.body.pos;
  g.spawnItem(s.item, 1, [pp[0], pp[1] + 0.5, pp[2]], [0, 0, 0], s, 0);
  inv.slots[5] = null; g.spawnItem(I.IronHelmet, 1, [pp[0], pp[1] + 0.5, pp[2]], [0, 0, 0], { wear: 50 }, 0);
  await wait(600);
  const sw = inv.slots.find((x) => x && x.item === I.DiamondSword), hl = inv.slots.find((x) => x && x.item === I.IronHelmet);
  out.pickedEnch = sw && JSON.stringify(sw.ench); out.helmetWear = hl && hl.wear;
  // anvil repair + combine
  inv.slots[3] = { item: I.IronPickaxe, count: 1, wear: 200 }; inv.slots[4] = { item: I.IronIngot, count: 5 };
  inv.slots[6] = { item: I.IronPickaxe, count: 1, wear: 10, ench: { efficiency: 3 } };
  out.anvilOpts = g.anvilOptions(3).map((o) => o.label + ' L' + o.levels);
  g.anvilUse(3, 0); out.repaired = inv.slots[3].wear;
  g.anvilUse(3, 0 + (g.anvilOptions(3).length > 1 ? 1 : 0)); out.combined = [inv.slots[3].wear, JSON.stringify(inv.slots[3].ench), !!inv.slots[6]];
  // an efficiency pickaxe mines faster; fortune gives more
  // kill xp + looting + damage numbers
  const lv0 = g.stats.level, xp0 = g.stats.xp;
  const z = g.mobs.spawnAt('husk', [pp[0] + 2, pp[1], pp[2]]);
  inv.selected = inv.slots.indexOf(sw);
  g.mobs.hurt(z, 3, g.player, true);
  out.dmgNums = document.querySelectorAll('#dmgNums b').length;
  g.mobs.hurt(z, 999, g.player);
  out.killXp = (g.stats.level - lv0) * 1000 + (g.stats.xp - xp0);
  // protection lowers damage
  inv.armor[0] = { item: I.IronHelmet, count: 1, ench: { protection: 4 } };
  g.stats.health = 20; g.stats.damage(10, 'zombie'); out.protectedHealth = g.stats.health;
  inv.armor[3] = { item: I.IronBoots, count: 1, ench: { feather_falling: 4 } };
  g.stats.health = 20; g.stats.damage(10, 'fall'); out.ffHealth = g.stats.health;
  // saved
  out.saved = JSON.stringify(g.stats.toJSON());
  // placing the new blocks
  out.fams = [!!FAM.enchanting_table, !!FAM.anvil, !!ITEMS[FAM.enchanting_table.first], ITEMS[FAM.anvil.first] && ITEMS[FAM.anvil.first].name];
  const X = Math.floor(pp[0]) + 2, Y = Math.floor(pp[1]), Z = Math.floor(pp[2]) + 2;
  w.setBlock(X, Y, Z, FAM.enchanting_table.first); w.setBlock(X + 1, Y, Z, FAM.anvil.first + 1);
  g.player.yaw = 0; g.player.pitch = 0.3;
  return out;
});
await wait(1500);
await page.evaluate(() => { window.voxelwild.ui.closeInventory(); const g = window.voxelwild.game, w = g.world, { FAM } = window.voxelwild.blocksMod, p = g.player.body.pos.map(Math.floor), Y = p[1] + 30;
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { w.setBlock(p[0] + dx, Y - 1, p[2] + dz, 1); for (let dy = 0; dy < 5; dy++) w.setBlock(p[0] + dx, Y + dy, p[2] + dz, 0); }
  w.setBlock(p[0] - 1, Y, p[2] - 2, FAM.enchanting_table.first); w.setBlock(p[0] + 1, Y, p[2] - 2, FAM.anvil.first + 1);
  g.player.teleport([p[0] + 0.5, Y, p[2] + 1.5], 0, -0.45); g.mobs.list.length = 0; });
await wait(2500);
await page.screenshot({ path: join(out, 'enchant-blocks.png') });
await page.evaluate(() => { const g = window.voxelwild.game; g.openStation({ kind: 'enchant', name: 'Enchanting Table', slot: g.inventory.selected }); });
await wait(600);
await page.screenshot({ path: join(out, 'enchant-panel.png') });
console.log(JSON.stringify(r, null, 1), 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
