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
await page.screenshot({ path: join(out, 'shot-title.png') });
await page.evaluate((seed) => window.voxelwild.ui.play({ id: 'shots', name: 'Shots', seed: +seed, mode: 'creative', created: 0, lastPlayed: 0 }, true), seed);
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
const views = process.argv[4] ? JSON.parse(process.argv[4]) : [
  { name: 'a-north', dy: 0, yaw: 0, pitch: -0.1 }, { name: 'b-east', dy: 0, yaw: -1.57, pitch: -0.1 }, { name: 'c-south', dy: 0, yaw: 3.14, pitch: -0.1 },
  { name: 'd-west', dy: 0, yaw: 1.57, pitch: -0.1 }, { name: 'e-high', dy: 40, yaw: 0.6, pitch: -0.45 }, { name: 'f-down', dy: 6, yaw: 0.6, pitch: -1.2 },
];
// ---- redstone circuits, furnace, crops and beds on a platform in the sky
const res = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, { FAM, C } = window.voxelwild.blocksMod;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const p = g.player.body.pos.map(Math.floor), Y = 150, X = p[0], Z = p[2], out = {};
  const set = (x, y, z, id) => { w.setBlock(X + x, Y + y, Z + z, id); g.redstone.track(X + x, Y + y, Z + z); };
  const get = (x, y, z) => w.getBlock(X + x, Y + y, Z + z);
  for (let x = -2; x < 30; x++) for (let z = -2; z < 20; z++) { w.setBlock(X + x, Y - 1, Z + z, 88); for (let y = 0; y < 5; y++) w.setBlock(X + x, Y + y, Z + z, 0); }
  g.player.flying = true; g.player.teleport([X + 8, Y + 6, Z + 16], 0, -0.6);
  // 1) lever -> 6 dust -> lamp
  const wire = FAM.redstone_wire.first;
  set(0, 0, 0, FAM.lever.first + 4);
  for (let x = 1; x <= 6; x++) set(x, 0, 0, wire);
  set(7, 0, 0, C.redstone_lamp);
  await wait(400);
  out.lampOffBefore = get(7, 0, 0) === C.redstone_lamp;
  g.toggle({ hit: [X, Y, Z], block: get(0, 0, 0) });
  await wait(600);
  out.wireLevels = [1, 2, 3, 4, 5, 6].map((x) => get(x, 0, 0) - wire);
  out.lampLit = get(7, 0, 0) === C.lit_redstone_lamp;
  // 2) inverter: a block powered by the lever line, a torch on its far side, a lamp beside the torch
  set(0, 0, 3, FAM.lever.first + 4); set(1, 0, 3, wire); set(2, 0, 3, 88); set(3, 0, 3, FAM.redstone_torch.first + 2 + 1 * 2); set(4, 0, 3, C.redstone_lamp);
  await wait(600);
  out.inverterLitWhenOff = get(4, 0, 3) === C.lit_redstone_lamp;
  g.toggle({ hit: [X, Y, Z + 3], block: get(0, 0, 3) });
  await wait(600);
  out.inverterOffWhenOn = get(4, 0, 3) === C.redstone_lamp && (get(3, 0, 3) - FAM.redstone_torch.first) === 5;
  // 3) repeater carries a signal 15 more blocks
  set(0, 0, 6, C.redstone_block);
  for (let x = 1; x <= 14; x++) set(x, 0, 6, wire);
  set(15, 0, 6, FAM.repeater.first + 0);            // facing east
  for (let x = 16; x <= 20; x++) set(x, 0, 6, wire);
  set(21, 0, 6, C.redstone_lamp);
  await wait(1200);
  out.repeaterOn = get(15, 0, 6) - FAM.repeater.first >= 16; out.farLamp = get(21, 0, 6) === C.lit_redstone_lamp;
  // 4) pistons: a sticky piston pushes a block and pulls it back
  set(0, 0, 10, FAM.sticky_piston.first + 0); set(1, 0, 10, 88); set(-1, 0, 10, FAM.lever.first + 4);
  await wait(300);
  g.toggle({ hit: [X - 1, Y, Z + 10], block: get(-1, 0, 10) });
  await wait(600);
  out.pushed = get(2, 0, 10) === 88 && FAM.piston_head.first <= get(1, 0, 10) && get(1, 0, 10) < FAM.piston_head.first + 12;
  g.toggle({ hit: [X - 1, Y, Z + 10], block: get(-1, 0, 10) });
  await wait(600);
  out.pulled = get(1, 0, 10) === 88 && get(2, 0, 10) === 0;
  // 5) a button opens an iron door for a moment
  const door = FAM.iron_door.first;
  set(5, 0, 10, door + 0); set(5, 1, 10, door + 1); set(4, 1, 10, 88); set(4, 1, 11, FAM.stone_button.first + 3);
  set(4, 0, 10, 88);
  await wait(300);
  g.toggle({ hit: [X + 4, Y + 1, Z + 11], block: get(4, 1, 11) });
  await wait(500);
  out.doorOpened = ((get(5, 0, 10) - door) & 2) !== 0;
  await wait(1500);
  out.doorClosedAgain = ((get(5, 0, 10) - door) & 2) === 0;
  // 6) TNT from a lever
  set(10, 0, 12, C.tnt); set(10, 0, 13, FAM.lever.first + 4); set(10, 0, 15, 88);
  g.toggle({ hit: [X + 10, Y, Z + 13], block: get(10, 0, 13) });
  await wait(4800);
  out.tntExploded = get(10, 0, 12) === 0;
  return out;
});
console.log(JSON.stringify(res));
await page.screenshot({ path: join(out, 'redstone.png') });
// ---- survival blocks
const surv = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, { FAM, C } = window.voxelwild.blocksMod, I = window.voxelwild.items;
  const p = g.player.body.pos.map(Math.floor), out = {};
  const fx = p[0] + 3, fy = p[1] - 2, fz = p[2] - 3;
  w.setBlock(fx, fy, fz, C.furnace);
  g.openStation({ kind: 'furnace', pos: [fx, fy, fz] });
  const d = g.station.data;
  d.slots[0] = { item: I.IronChunk, count: 2 }; d.slots[1] = { item: I.Coal, count: 1 };
  for (let k = 0; k < 90; k++) g.updateBlocks(0.26);
  out.ingots = d.slots[2] && d.slots[2].item === I.IronIngot ? d.slots[2].count : 0;
  out.furnaceLit = w.getBlock(fx, fy, fz) === C.lit_furnace;
  g.station = null;
  // wheat grows on farmland
  w.setBlock(fx, fy, fz + 2, FAM.farmland.first);
  w.setBlock(fx, fy + 1, fz + 2, 0);
  g.place({ hit: [fx, fy, fz + 2], prev: [fx, fy + 1, fz + 2], face: 2, block: FAM.farmland.first, point: [fx + 0.5, fy + 1, fz + 2.5] }, FAM.wheat.first);
  out.planted = w.getBlock(fx, fy + 1, fz + 2) === FAM.wheat.first;
  g.meta.clock += 400; g.blockTimer = 1; g.updateBlocks(0.01);
  out.grown = w.getBlock(fx, fy + 1, fz + 2) === FAM.wheat.first + 7;
  // a bed skips the night
  g.tod.hour = 23; g.settings.dayCycle = 'normal';
  w.setBlock(fx + 2, fy, fz, FAM.red_bed.first + 1);
  g.sleep([fx + 2, fy, fz]);
  await new Promise((r) => setTimeout(r, 1800));
  out.morning = g.tod.hour > 5 && g.tod.hour < 8;
  // armour: an iron chestplate takes 24% of a mob's hit
  g.creative = false; g.stats.health = 20;
  g.inventory.slots[g.inventory.selected] = { item: I.LeatherHelmet + 2 * 4 + 1, count: 1 };
  g.wear();
  g.stats.damage(10, 'husk');
  out.armorHealth = +g.stats.health.toFixed(2); out.defense = g.inventory.defense; out.wear = g.inventory.armor[1] && g.inventory.armor[1].wear;
  g.creative = true;
  // crafting: hand-only recipes vs a crafting table
  const R = window.voxelwild.recipes;
  out.handRecipes = R.filter((r) => !r.table).length; out.tableRecipes = R.filter((r) => r.table).length;
  return out;
});
console.log(JSON.stringify(surv));
await page.evaluate(() => { const g = window.voxelwild.game, I = window.voxelwild.items, p = g.player.body.pos.map(Math.floor); g.state = 'playing'; window.voxelwild.ui.screen = 'playing';
  const pos = [p[0] + 3, p[1] - 2, p[2] - 3]; g.openStation({ kind: 'furnace', pos }); g.station.data.slots[0] = { item: I.Beef, count: 5 }; g.station.data.slots[1] = { item: I.Coal, count: 3 }; g.station.data.cook = 4; g.station.data.burn = 40; g.station.data.burnMax = 80; window.voxelwild.ui.renderStation(); });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: join(out, 'ui-furnace.png') });
await page.evaluate(() => { const ui = window.voxelwild.ui, g = window.voxelwild.game; ui.closeInventory(); g.meta.mode = 'survival'; g.creative = false; g.inventory.add(window.voxelwild.blocksMod.C.oak_planks || 10, 20); g.inventory.add(10, 30); g.openStation({ kind: 'table' }); });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: join(out, 'ui-table.png') });
await page.evaluate(() => { window.voxelwild.ui.closeInventory(); const g = window.voxelwild.game; g.creative = true; g.player.teleport([g.player.body.pos[0] - 8, g.player.body.pos[1] - 3, g.player.body.pos[2] - 12], 0.3, -0.7); });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: join(out, 'redstone-close.png') });
console.log('errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
