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
await page.evaluate(() => window.voxelwild.ui.play({ id: 'ex', name: 'Extras', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true));
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2500);
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, w = g.world, I = window.voxelwild.items, { FAM, C } = window.voxelwild.blocksMod, pm = window.voxelwild.playerMod;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {};
  const p = g.player.body.pos.map(Math.floor), X = p[0], Y = p[1], Z = p[2];
  const hold = (id, n = 1) => { g.inventory.slots[g.inventory.selected] = { item: id, count: n }; };
  // timber: a 6-log trunk with leaves; an axe on the bottom log fells it
  const tx = X + 4, tz = Z, TY = Y + 40;
  for (let y = 0; y < 6; y++) w.setBlock(tx, TY + y, tz, 12);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 4; dy <= 6; dy++) if (dx || dz) w.setBlock(tx + dx, TY + dy, tz + dz, 16);
  hold(I.IronAxe);
  g.breakBlock([tx, TY, tz], 12, true);
  await wait(2500);
  out.decayProbe = (() => { let held = 0; for (let ly = -3; ly <= 3; ly++) for (let lz = -3; lz <= 3; lz++) for (let lx = -3; lx <= 3; lx++) { const l = w.getBlock(tx + 2 + lx, Y + 5 + ly, tz + lz); if (l >= 12 && l <= 15) held++; } return held; })();
  let logs = 0, leaves = 0;
  for (let y = 0; y < 7; y++) { if (w.getBlock(tx, TY + y, tz) === 12) logs++; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (w.getBlock(tx + dx, TY + y, tz + dz) === 16) leaves++; }
  out.timber = { logsLeft: logs, leavesLeft: leaves };
  // vein mining: 5 iron ore in a row
  const vy = Y - 6;
  for (let k = 0; k < 5; k++) w.setBlock(X + k, vy, Z + 6, 26);
  hold(I.IronPickaxe);
  g.breakBlock([X, vy, Z + 6], 26, true);
  await wait(500);
  out.veinLeft = [0, 1, 2, 3, 4].filter((k) => w.getBlock(X + k, vy, Z + 6) === 26).length;
  // gravestone: die with items, then recover them
  g.inventory.slots[3] = { item: I.Diamond, count: 5 }; g.inventory.slots[12] = { item: 9, count: 30 };
  g.stats.damage(1000, 'void');
  await wait(300);
  const graves = Object.keys(g.meta.graves || {});
  out.grave = { made: graves.length, emptied: !g.inventory.slots[3] };
  g.respawn(); await wait(1500);
  const gk = graves[0].split(':')[1].split(',').map(Number);
  g.toggle({ hit: gk, block: w.getBlock(...gk) });
  out.grave.back = g.inventory.slots[3] && g.inventory.slots[3].count === 5 && g.inventory.slots[12] && g.inventory.slots[12].count === 30;
  out.grave.blockGone = w.getBlock(...gk) === 0;
  // waystones: two placed, activate both, travel from one to the other
  const q = g.player.body.pos.map(Math.floor);
  const ws1 = [q[0] + 2, q[1], q[2]], ws2 = [q[0] + 30, q[1] + 20, q[2]];
  for (const s of [ws1, ws2]) { w.setBlock(s[0], s[1] - 1, s[2], 1); w.setBlock(...s, FAM.waystone.first); w.setBlock(s[0], s[1] + 1, s[2], FAM.waystone.first + 1); }
  g.state = 'playing';
  g.toggle({ hit: ws2, block: w.getBlock(...ws2) }); window.voxelwild.ui.closeInventory();
  g.toggle({ hit: [ws1[0], ws1[1] + 1, ws1[2]], block: w.getBlock(ws1[0], ws1[1] + 1, ws1[2]) });
  out.waystones = g.meta.waystones.length;
  const buttons = document.querySelectorAll('#recipes .recipe');
  out.waystoneButtons = buttons.length;
  g.stats.hunger = 20;
  buttons[0] && buttons[0].click();
  await wait(1500);
  out.travelled = Math.round(Math.hypot(g.player.body.pos[0] - ws2[0], g.player.body.pos[2] - ws2[2]));
  // backpack
  hold(I.Backpack);
  g.openBackpack();
  g.station.data.slots[0] = { item: I.Coal, count: 10 };
  window.voxelwild.ui.closeInventory();
  const bagId = g.inventory.held.wear;
  out.backpack = { id: bagId, kept: g.meta.bags[bagId].slots[0].count };
  // grappling hook: pull toward a block ahead
  const before = g.player.body.pos.slice();
  const gx = Math.floor(before[0]), gz = Math.floor(before[2]) - 14;
  for (let y = -1; y < 6; y++) w.setBlock(gx, Math.floor(before[1]) + y, gz, 1);
  g.player.yaw = 0; g.player.pitch = 0.1;
  hold(I.GrapplingHook);
  g.fireGrapple();
  out.grappleSet = !!g.grapple;
  await wait(1200);
  out.grapplePulled = +(before[2] - g.player.body.pos[2]).toFixed(1);
  // double doors
  const d = FAM.oak_door.first, dp = g.player.body.pos.map(Math.floor);
  const dx0 = dp[0] + 3, dz0 = dp[2] + 3;
  for (const k of [0, 1]) { w.setBlock(dx0 + k, dp[1], dz0, d + 3 * 4); w.setBlock(dx0 + k, dp[1] + 1, dz0, d + 3 * 4 + 1); }
  g.toggle({ hit: [dx0, dp[1], dz0], block: d + 12 });
  out.doubleDoor = [0, 1].map((k) => ((w.getBlock(dx0 + k, dp[1], dz0) - d) >> 1) & 1);
  // sorting
  g.inventory.slots[20] = { item: 9, count: 10 }; g.inventory.slots[25] = { item: 9, count: 20 }; g.inventory.slots[14] = { item: I.IronPickaxe, count: 1 };
  window.voxelwild.ui.sortSlots(g.inventory.slots, 9, 36);
  out.sorted = [g.inventory.slots[9] && g.inventory.slots[9].item === I.IronPickaxe, g.inventory.slots.filter((s) => s && s.item === 9).map((s) => s.count)];
  // rested: a fire under a roof
  const rp = g.player.body.pos.map(Math.floor);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) w.setBlock(rp[0] + dx, rp[1] + 3, rp[2] + dz, 10);
  w.setBlock(rp[0] + 2, rp[1] - 1, rp[2], 56); w.setBlock(rp[0] + 2, rp[1], rp[2], C.fire);
  for (let k = 0; k < 10; k++) { g.restTimer = 0; g.updateRested(1); }
  out.rested = g.rested > 0;
  // look info on a block
  g.target = { hit: [rp[0] + 2, rp[1] - 1, rp[2]], block: 56 }; g.lookMob = null;
  out.look = g.lookInfo();
  return out;
});
console.log(JSON.stringify(r));
await page.evaluate(() => { const g = window.voxelwild.game; g.state = 'playing'; window.voxelwild.ui.show('playing'); g.player.pitch = -0.3; });
await wait(1500);
await page.screenshot({ path: join(out, 'extras-hud.png') });
await page.evaluate(() => window.voxelwild.ui.openMap());
await wait(800);
await page.screenshot({ path: join(out, 'extras-map.png') });
console.log('errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
