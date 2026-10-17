// Bakes a zone's tile grid into one big canvas, pixel by pixel: organic eroded edges, 1px outlines,
// top-lit highlights and per-material textures (sand streaks, bricks, planks, coral bumps...).
// Collision stays on the 16px grid; visuals only ever erode *inside* solid tiles.
import { T, TS, isSolid } from './tiles.js';
import { vnoise, fbm, hash2 } from '../core/util.js';
import { BIOMES } from '../data/biomes.js';
import { Painter, color, pack, unpack } from '../gfx/painter.js';
import { R } from '../gfx/palette.js';

const M = 5; // margin (px) around a region for blur/distance
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
const darken = (c, k) => { const [r, g, b, a] = unpack(c); return pack(r * k, g * k, b * k, a); };
const mixc = (c1, c2, t) => { const a = unpack(c1), b = unpack(c2); return pack(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); };

let spikeCache = null;
function spikeSprite() {
  if (spikeCache) return spikeCache;
  const p = new Painter(16, 16);
  for (const [x, h] of [[3, 11], [8, 14], [13, 10]]) p.poly([[x - 3, 16], [x, 16 - h], [x + 3, 16]], R.void.tint(0.05, 1.4, 1.5), {});
  spikeCache = p.toCanvas(); return spikeCache;
}

export class TileLayer {
  constructor(zone) {
    this.zone = zone; this.grid = zone.grid; this.biome = BIOMES[zone.biome];
    this.canvas = document.createElement('canvas');
    this.canvas.width = zone.w * TS; this.canvas.height = zone.h * TS;
    this.ctx = this.canvas.getContext('2d');
    this.seed = zone.seed | 0;
    this._ramps = {};
  }
  ramp(mat) {
    let r = this._ramps[mat];
    if (!r) {
      const base = mat === T.CRACKED ? T.ROCK : mat === T.SEAL ? T.RUIN : mat === T.TIDEGATE ? T.DIVINE : mat === T.BARRIER ? T.OBSID : mat === T.LOCKED ? T.WOOD : mat;
      const rp = this.biome.mats[base] || this.biome.mats[T.ROCK];
      r = { c: rp.c, edge: darken(rp.c[0], 0.45) }; this._ramps[mat] = r;
    }
    return r;
  }
  renderAll() { this.renderRegion(0, 0, this.zone.w - 1, this.zone.h - 1); }

  renderRegion(tx0, ty0, tx1, ty1) {
    const g = this.grid, zw = this.zone.w, zh = this.zone.h;
    tx0 = Math.max(0, tx0); ty0 = Math.max(0, ty0); tx1 = Math.min(zw - 1, tx1); ty1 = Math.min(zh - 1, ty1);
    const px0 = tx0 * TS, py0 = ty0 * TS, cw = (tx1 - tx0 + 1) * TS, ch = (ty1 - ty0 + 1) * TS;
    const W = cw + M * 2, H = ch + M * 2, ox = px0 - M, oy = py0 - M;
    const mask = new Uint8Array(W * H), vis = new Uint8Array(W * H), near = new Uint8Array(W * H);
    // tile-level mask + "has open neighbour tile" flags
    for (let ty = ty0 - 1; ty <= ty1 + 1; ty++) for (let tx = tx0 - 1; tx <= tx1 + 1; tx++) {
      const s = isSolid(g.get(tx, ty)) ? 1 : 0;
      let nb = 0;
      for (let dy = -1; dy <= 1 && !nb; dy++) for (let dx = -1; dx <= 1; dx++) if (!isSolid(g.get(tx + dx, ty + dy))) { nb = 1; break; }
      const bx = tx * TS - ox, by = ty * TS - oy;
      for (let y = 0; y < TS; y++) { const yy = by + y; if (yy < 0 || yy >= H) continue; for (let x = 0; x < TS; x++) { const xx = bx + x; if (xx < 0 || xx >= W) continue; mask[yy * W + xx] = s; near[yy * W + xx] = nb; } }
    }
    // summed-area table for a box blur (radius 4)
    const sw = W + 1, sat = new Int32Array(sw * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += mask[y * W + x]; sat[(y + 1) * sw + x + 1] = sat[y * sw + x + 1] + row; } }
    const box = (x, y, r) => {
      const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(W, x + r + 1), y1 = Math.min(H, y + r + 1);
      const a = (sat[y1 * sw + x1] - sat[y0 * sw + x1] - sat[y1 * sw + x0] + sat[y0 * sw + x0]);
      return a / ((2 * r + 1) * (2 * r + 1));
    };
    const seed = this.seed;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!mask[i]) continue;
      if (!near[i]) { vis[i] = 1; continue; }
      const f = box(x, y, 4);
      const px = ox + x, py = oy + y;
      const n = fbm(px / 4.5, py / 4.5, seed, 2);
      vis[i] = f + (n - 0.5) * 0.55 >= 0.5 ? 1 : 0;
    }
    // colour pass
    const img = this.ctx.createImageData(cw, ch), out = new Uint32Array(img.data.buffer);
    const V = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 1 : vis[y * W + x]);
    for (let y = M; y < M + ch; y++) for (let x = M; x < M + cw; x++) {
      const i = y * W + x;
      if (!vis[i]) continue;
      const px = ox + x, py = oy + y;
      const mat = g.get(Math.floor(px / TS), Math.floor(py / TS));
      const rp = this.ramp(mat), c = rp.c;
      let u = 4, d = 4, l = 4, r = 4;
      if (near[i]) {
        for (let k = 1; k <= 3; k++) { if (u === 4 && !V(x, y - k)) u = k; if (d === 4 && !V(x, y + k)) d = k; if (l === 4 && !V(x - k, y)) l = k; if (r === 4 && !V(x + k, y)) r = k; }
        if (!V(x - 1, y - 1) || !V(x + 1, y - 1) || !V(x - 1, y + 1) || !V(x + 1, y + 1)) { u = Math.min(u, 1); }
      }
      const e = Math.min(u, d, l, r);
      let col;
      if (e === 1) col = rp.edge;
      else if (u <= 3 && u === e && u < 4) col = u === 2 ? c[4] : c[3];
      else if (d === e && d <= 2) col = c[0];
      else if ((l === e || r === e) && e <= 2) col = c[1];
      else col = this.texture(mat, px, py, c);
      // slight darkening away from open water so caves read as dense rock
      out[(y - M) * cw + (x - M)] = col;
    }
    this.ctx.putImageData(img, px0, py0);
    // non-solid decor tiles: platforms & spikes
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = g.get(tx, ty);
      if (t === T.PLATFORM) this.drawPlatform(tx, ty);
      else if (t === T.SPIKE) this.ctx.drawImage(spikeSprite(), tx * TS, ty * TS);
    }
  }

  drawPlatform(tx, ty) {
    const c = this.ctx, wood = this.biome.mats[T.WOOD] || R.wood, x = tx * TS, y = ty * TS;
    const stone = this.biome.id === 'kingdom' || this.biome.id === 'domain';
    const rp = stone ? this.biome.mats[T.RUIN] : wood;
    c.fillStyle = rp.hex[0]; c.fillRect(x, y, TS, 6);
    c.fillStyle = rp.hex[2]; c.fillRect(x, y + 1, TS, 3);
    c.fillStyle = rp.hex[4]; c.fillRect(x, y + 1, TS, 1);
    c.fillStyle = rp.hex[1]; c.fillRect(x, y + 4, TS, 1);
    c.fillStyle = rp.hex[0]; c.fillRect(x + 7, y + 1, 1, 4);
  }

  // interior material textures — returns a packed colour
  texture(mat, px, py, c) {
    const seed = this.seed, b = BAYER[(py & 3) * 4 + (px & 3)];
    const pick = (t, lo = 1, hi = 3, dith = 0.5) => c[Math.max(lo, Math.min(hi, Math.round(lo + t * (hi - lo) + b * dith)))];
    switch (mat) {
      case T.GROUND: {
        const s = vnoise((px + py * 0.6) / 9, (py - px * 0.25) / 2.4, seed + 5);
        const n = fbm(px / 14, py / 14, seed, 2);
        return pick(s * 0.75 + n * 0.25, 1, 3, 0.45);
      }
      case T.ROCK: case T.CRACKED: {
        const n = fbm(px / 6, py / 6, seed + 3, 3);
        let col = pick(n, 1, 3, 0.6);
        const crack = Math.abs(vnoise(px / 9, py / 9, seed + 11) - 0.5);
        if (crack < 0.018) col = c[0];
        if (mat === T.CRACKED) { const k = Math.abs(vnoise(px / 5, py / 5, seed + 21) - 0.5); if (k < 0.045) return color('#fff0c0'); if (k < 0.07) return color('#d08a4a'); }
        return col;
      }
      case T.RUIN: case T.SEAL: {
        const row = Math.floor(py / 8), offs = (row & 1) * 8;
        if (py % 8 === 0 || (px + offs) % 16 === 0) return c[0];
        if (py % 8 === 1) return c[3];
        let col = pick(vnoise(px / 5, py / 5, seed + row) * 0.7 + 0.15, 1, 3, 0.3);
        if (mat === T.SEAL) {
          const cx = (px % 16) - 8, cy = (py % 16) - 8, rr = Math.hypot(cx, cy);
          if ((rr > 3.2 && rr < 5) || (Math.abs(cx) < 1 && Math.abs(cy) < 6) || (Math.abs(cy) < 1 && Math.abs(cx) < 6)) return color('#62fff0');
        }
        return col;
      }
      case T.WOOD: case T.LOCKED: {
        if (py % 6 === 0) return c[0];
        const grain = vnoise(px / 14, py * 1.3, seed + 2);
        if (px % 16 === 3 && py % 6 === 2) return c[4];
        if (mat === T.LOCKED) { const cx = (px % 16), cy = (py % 16); if (cx >= 5 && cx <= 10 && cy >= 5 && cy <= 11) return color(cy === 5 || cx === 5 ? '#fff6a8' : '#ffb21a'); }
        return pick(grain, 1, 3, 0.4);
      }
      case T.CORAL: {
        const n = fbm(px / 3.2, py / 3.2, seed + 7, 2);
        return pick(n * 1.1 - 0.05, 1, 4, 0.6);
      }
      case T.BONE: {
        const s = Math.sin((px + py * 0.5) * 0.5) * 0.5 + 0.5;
        return pick(s * 0.5 + vnoise(px / 5, py / 5, seed) * 0.5, 1, 3, 0.3);
      }
      case T.DIVINE: case T.TIDEGATE: {
        if (py % 16 === 3 && mat === T.DIVINE) return color('#ffd84a');
        const vein = Math.abs(Math.sin(vnoise(px / 12, py / 12, seed) * 9));
        if (mat === T.TIDEGATE) { const cx = (px % 16) - 8, cy = (py % 16) - 8; if (Math.abs(cx) + Math.abs(cy) < 4) return color('#9af0ff'); }
        return vein < 0.12 ? c[4] : pick(fbm(px / 8, py / 8, seed, 2), 1, 3, 0.3);
      }
      case T.OBSID: {
        if (hash2(px, py, seed) > 0.992) return c[4];
        return pick(fbm(px / 7, py / 7, seed, 2), 0, 2, 0.4);
      }
      case T.BARRIER: {
        const s = (px + py + 0) % 8 < 3;
        return s ? color('#c07aff') : color('#5a2a9a');
      }
      default: return c[2];
    }
  }
}
