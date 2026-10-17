// Surface detail painted onto the baked tile layer after the base pass: sand ripples and shells on the reef, seagrass
// and moss in the forest, mortar glints in the kingdom, barnacles and rust on wrecks, glowing mineral and moss in the
// abyss, ember cracks in the trench, rune ticks in the domain. Everything is deterministic from the zone seed and
// sparse on purpose: it should make the ground feel lived-in without adding clutter.
import { T, TS } from './tiles.js';
import { hash2 } from '../core/util.js';

// the pixel kit shared by every feature --------------------------------------------------------------------------
const dot = (c, x, y, col, a = 1) => { c.globalAlpha = a; c.fillStyle = col; c.fillRect(x, y, 1, 1); };
const hline = (c, x, y, n, col, a = 1) => { c.globalAlpha = a; c.fillStyle = col; c.fillRect(x, y, n, 1); };
const vline = (c, x, y, n, col, a = 1) => { c.globalAlpha = a; c.fillStyle = col; c.fillRect(x, y, 1, n); };

// A feature receives (ctx, x, y, h, env): x,y is the surface pixel in layer coordinates, h a 0..1 hash, and env
// { up, down, lean } tells it which way is "away from the rock" (up from floors, down from ceilings).
const FEATURES = {
  ripple(c, x, y, h) { hline(c, x - 2, y + 2, 4 + ((h * 7) | 0) % 3, '#ffffff', 0.13); },
  shell(c, x, y, h, e) {
    const col = ['#f4d8c4', '#e8b8a8', '#fff0dc'][(h * 3 | 0) % 3], o = e.up > 0 ? -1 : 1;
    hline(c, x, y + o, 3, col); dot(c, x + 1, y + o * 2, col); dot(c, x + 1, y + o, '#8a5a60', 0.5);
  },
  pebble(c, x, y, h, e) { const o = e.up > 0 ? -1 : 1; hline(c, x, y + o, 2, '#8a8296'); dot(c, x, y + o * 2, '#aaa2b4'); dot(c, x + 1, y + o, '#5c5468'); },
  blade(c, x, y, h, e) {
    const n = 3 + ((h * 40) | 0) % 4, col = ['#3a9a58', '#58c070', '#2a7a48'][((h * 9) | 0) % 3], lean = ((h * 5) | 0) % 3 - 1;
    for (let i = 1; i <= n; i++) dot(c, x + Math.round(lean * i * 0.4), y - e.up * i, i === n ? '#a8f0a0' : col);
    if (h > 0.55) for (let i = 1; i <= n - 1; i++) dot(c, x + 1 - Math.round(lean * i * 0.3), y - e.up * i, '#2a7a48', 0.8);
  },
  mossPatch(c, x, y, h, e) { hline(c, x - 1, y, 5, '#5ac06a', 0.55); hline(c, x, y + e.down, 3, '#3a8a50', 0.45); dot(c, x + 1, y - e.up, '#a8f0a0', 0.7); },
  moteGold(c, x, y, h, e) { dot(c, x, y + e.down, '#ffe9a0', 0.7); dot(c, x + 1, y + e.down * 2, '#d8b060', 0.55); },
  chip(c, x, y, h, e) { vline(c, x, y + e.down, 3, '#000000', 0.25); hline(c, x - 1, y + e.down * 3, 3, '#000000', 0.18); },
  barnacle(c, x, y, h, e) {
    const o = e.up > 0 ? -1 : 1; dot(c, x, y + o, '#cfc8b4'); dot(c, x + 1, y + o, '#a8a08c'); dot(c, x, y + o * 2, '#e4ddc8'); dot(c, x + 2, y + o, '#cfc8b4');
  },
  rustDrip(c, x, y, h, e) { const n = 3 + ((h * 30) | 0) % 6; for (let i = 1; i <= n; i++) dot(c, x, y + e.down * i, '#8a4a2a', 0.55 - i * 0.05); },
  glowMoss(c, x, y, h, e) {
    hline(c, x - 1, y, 4, '#4ad8c8', 0.5); dot(c, x, y - e.up, '#8affea', 0.8); dot(c, x + 2, y - e.up * 2, '#4ad8c8', 0.5); hline(c, x - 2, y - e.up, 7, '#2a8aa8', 0.22);
  },
  crystalNub(c, x, y, h, e) {
    const col = ['#a07aff', '#7ab0ff', '#d0a0ff'][((h * 3) | 0) % 3]; vline(c, x, y - e.up * 3, 3, col, 0.9); dot(c, x + 1, y - e.up * 2, col, 0.6); dot(c, x, y - e.up * 3, '#ffffff', 0.8);
  },
  emberPit(c, x, y, h, e) { hline(c, x, y + e.down, 3, '#ff7a3a', 0.8); dot(c, x + 1, y + e.down, '#ffd070'); hline(c, x - 1, y + e.down * 2, 5, '#ff5a2a', 0.22); },
  boneChip(c, x, y, h, e) { const o = e.up > 0 ? -1 : 1; hline(c, x, y + o, 3, '#d8d0bc'); dot(c, x + 2, y + o * 2, '#d8d0bc'); dot(c, x, y + o * 2, '#a89c88'); },
  starDot(c, x, y, h, e) { dot(c, x, y + e.down * 2, '#c8f8ff', 0.8); dot(c, x + 1, y + e.down * 2, '#ffffff', 0.5); dot(c, x, y + e.down * 3, '#7ad0ff', 0.5); },
  runeTick(c, x, y, h, e) { vline(c, x, y + e.down * 2, 3, '#62fff0', 0.5); hline(c, x - 1, y + e.down * 3, 3, '#62fff0', 0.35); },
};

// feature lists per realm: p is the chance per surface pixel, `on` limits a feature to floors/ceilings/walls
const KITS = {
  reef: [{ f: 'ripple', p: 0.05, on: 'floor' }, { f: 'shell', p: 0.012, on: 'floor' }, { f: 'pebble', p: 0.012, on: 'floor' }, { f: 'blade', p: 0.004, on: 'floor' }],
  forest: [{ f: 'blade', p: 0.07, on: 'floor' }, { f: 'mossPatch', p: 0.03, on: 'floor' }, { f: 'mossPatch', p: 0.02, on: 'ceil' }, { f: 'pebble', p: 0.008, on: 'floor' }],
  kingdom: [{ f: 'moteGold', p: 0.015, on: 'any' }, { f: 'chip', p: 0.03, on: 'floor' }, { f: 'pebble', p: 0.006, on: 'floor' }],
  graveyard: [{ f: 'barnacle', p: 0.02, on: 'any' }, { f: 'rustDrip', p: 0.016, on: 'ceil' }, { f: 'boneChip', p: 0.006, on: 'floor' }],
  abyss: [{ f: 'glowMoss', p: 0.016, on: 'floor' }, { f: 'crystalNub', p: 0.008, on: 'any' }, { f: 'glowMoss', p: 0.006, on: 'ceil' }],
  trench: [{ f: 'emberPit', p: 0.006, on: 'floor' }, { f: 'boneChip', p: 0.014, on: 'floor' }, { f: 'crystalNub', p: 0.004, on: 'any' }],
  domain: [{ f: 'starDot', p: 0.018, on: 'any' }, { f: 'runeTick', p: 0.01, on: 'any' }, { f: 'moteGold', p: 0.008, on: 'floor' }],
};

// which materials accept growth (stone slabs and wood take less than sand and soil)
const SOFT = new Set([T.GROUND, T.CORAL, T.ROCK, T.CRACKED]);
const HARD = new Set([T.RUIN, T.WOOD, T.BONE, T.DIVINE, T.OBSID]);

// Paint detail for one baked region. `r` carries the bake buffers: vis (visible-solid mask), W/H (buffer size incl. margin M),
// ox/oy (layer position of buffer origin), px0/py0/cw/ch (region in layer pixels), g (tile grid), seed, biome id.
export function paintDetail(ctx, r) {
  const kit = KITS[r.biome]; if (!kit) return;
  const { vis, W, H, M, ox, oy, g, seed, cw, ch } = r;
  const V = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : vis[y * W + x]);
  ctx.save();
  for (let y = M; y < M + ch; y++) for (let x = M; x < M + cw; x++) {
    if (!vis[y * W + x]) continue;
    const surf = !V(x, y - 1) ? 'floor' : !V(x, y + 1) ? 'ceil' : null;
    if (!surf) continue;
    const px = ox + x, py = oy + y, tx = Math.floor(px / TS), ty = Math.floor(py / TS), mat = g.get(tx, ty);
    if (!SOFT.has(mat) && !HARD.has(mat)) continue;
    const h = hash2(px, py, seed + 977), env = surf === 'floor' ? { up: 1, down: 1 } : { up: -1, down: 1 };
    const k = HARD.has(mat) ? 0.45 : 1;
    let acc = 0;
    for (const e of kit) {
      if (e.on !== 'any' && e.on !== surf) continue;
      acc += e.p * k;
      if (h < acc) {
        // keep features off the margins of the region so a re-bake after a tile breaks never leaves half a blade behind
        if (px < r.px0 + 2 || px > r.px0 + r.cw - 3 || py < r.py0 + 3 || py > r.py0 + r.ch - 4) break;
        FEATURES[e.f](ctx, px, py, hash2(px * 3, py * 7, seed + 13), env);
        break;
      }
    }
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
