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
await page.evaluate(() => { window.voxelwild.game.noVillageStart = true; window.voxelwild.ui.play({ id: 'bn', name: 'Bounty', seed: 20260925, mode: 'survival', unsaved: true, created: 0, lastPlayed: 0 }, true); });
await page.waitForFunction(() => window.voxelwild.game.state === 'playing', { timeout: 120000 });
await wait(2500);
const r = await page.evaluate(async () => {
  const g = window.voxelwild.game, I = window.voxelwild.items;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {}, inv = g.inventory;
  g.settings.mobs = false; g.mobs.list.length = 0;
  const hunt = g.bountyOffer('weaponsmith');
  out.hunt = hunt.text;
  out.accepted = g.acceptBounty(hunt);
  const p = g.player.body.pos;
  for (let k = 0; k < hunt.n; k++) { const m = g.mobs.spawnAt(hunt.mob || 'husk', [p[0] + 3, p[1], p[2]]); g.mobs.hurt(m, 999, g.player); }
  out.huntDone = [!g.meta.bounty, inv.count(I.Emerald), g.meta.bountyCount, Object.keys(g.meta.advancements || {}).includes('bounty')];
  // a bring bounty handed in at the trade screen
  let offer = null;
  for (const prof of ['farmer', 'toolsmith', 'butcher', 'shepherd']) { const o = g.bountyOffer(prof); if (o.kind === 'bring') { offer = { prof, o }; break; } }
  out.bring = offer && offer.o.text;
  g.acceptBounty(offer.o);
  await wait(300);
  out.tag = document.getElementById('bountyTag').textContent;
  inv.add(offer.o.item, offer.o.n);
  g.openStation({ kind: 'trade', prof: offer.prof, name: 'Villager', trades: g.trades(offer.prof) });
  await wait(400);
  const btn = document.querySelector('#recipes button.bounty');
  out.btn = btn && [btn.textContent, btn.disabled];
  btn.click();
  await wait(200);
  out.bringDone = [!g.meta.bounty, inv.count(offer.o.item), inv.count(I.Emerald)];
  out.again = document.querySelector('#recipes button.bounty').textContent;
  return out;
});
await page.screenshot({ path: join(out, 'bounty.png') });
const fx = await page.evaluate(async () => {
  const g = window.voxelwild.game, I = window.voxelwild.items, inv = g.inventory, st = g.stats;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  window.voxelwild.ui.closeInventory();
  const out = {};
  st.health = 10; st.hunger = 20;
  inv.selected = 0; inv.slots[0] = { item: I.GoldenApple, count: 2 };
  g.mouse.rightClicked = true; g.useCooldown = 0;
  await wait(200);
  out.ate = [inv.slots[0] && inv.slots[0].count, st.absorb, st.fx.regen > 0];
  await wait(1500);
  out.healed = st.health;
  st.damage(3, 'husk'); out.afterHit = [st.health, st.absorb];
  inv.slots[3] = { item: I.Totem, count: 1 };
  st.absorb = 0; st.damage(100, 'husk');
  out.totem = [st.health, st.dead, !!inv.slots[3], st.absorb, g.state];
  out.tag = document.getElementById('restedTag').textContent;
  st.fx.fireRes = 10; const h = st.health; st.damage(4, 'lava'); out.fireRes = st.health === h;
  return out;
});
console.log('effects', JSON.stringify(fx));

console.log(JSON.stringify(r, null, 1), 'errors', await page.evaluate(() => window.voxelwild.game.errors || 0));
await browser.close(); server.close();
