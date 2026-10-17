// Parallax backgrounds: gradient + wrap-tiled silhouette layers per biome, light rays and drifting fish.
import { Painter, color, hexToRgb, rgbHex } from './painter.js';
import { rng, lerp, TAU } from '../core/util.js';
import { BIOMES } from '../data/biomes.js';

const LW = 512, LH = 300;
const cache = new Map();
const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); };

// Draw helpers working directly on a 2D context (flat colours, no outline: these are distant)
function wrapDraw(g, x, fn) { for (const dx of [-LW, 0, LW]) { g.save(); g.translate(x + dx, 0); fn(); g.restore(); } }
function blob(g, cx, by, w, h, col) { g.fillStyle = col; g.beginPath(); g.ellipse(cx, by, w / 2, h, 0, Math.PI, 0); g.fill(); g.fillRect(cx - w / 2, by, w, LH - by); }
function stalk(g, x, by, h, w, col, sway) { g.fillStyle = col; for (let y = 0; y < h; y += 2) { const xx = x + Math.sin(y * 0.09 + sway) * 3; g.fillRect(Math.round(xx), by - y, w, 2); } }
function rock(g, x, by, w, h, col, hi) { g.fillStyle = col; g.beginPath(); g.moveTo(x - w / 2, by); g.lineTo(x - w * 0.3, by - h * 0.7); g.lineTo(x - w * 0.05, by - h); g.lineTo(x + w * 0.25, by - h * 0.6); g.lineTo(x + w / 2, by); g.fill(); if (hi) { g.fillStyle = hi; g.fillRect(x - w * 0.05, by - h, 2, h * 0.5); } }

const SCENES = {
  reef(g, layer, r, B) {
    if (layer === 0) { for (let i = 0; i < 9; i++) { const x = i * 60 + r.range(-10, 10); blob(g, x, LH - 20, r.range(60, 120), r.range(30, 80), mix(B.top, B.bottom, 0.3)); } for (let i = 0; i < 6; i++) stalk(g, r.range(0, LW), LH - 20, r.range(60, 120), 6, mix(B.top, B.bottom, 0.25), i); }
    else if (layer === 1) { for (let i = 0; i < 12; i++) { const x = r.range(0, LW); const c = i % 3 === 0 ? '#2a6a9a' : i % 3 === 1 ? '#34789a' : '#2a8a8a'; rock(g, x, LH - 10, r.range(30, 60), r.range(30, 70), mix(c, B.bottom, 0.25)); stalk(g, x + 10, LH - 10, r.range(30, 60), 4, mix('#3aa07a', B.bottom, 0.4), i); } }
    else { for (let i = 0; i < 16; i++) { const x = r.range(0, LW); stalk(g, x, LH, r.range(20, 50), 5, mix('#3a9a5a', B.bottom, 0.35), i); blob(g, r.range(0, LW), LH - 2, r.range(18, 36), r.range(10, 20), mix('#c8579a', B.bottom, 0.45)); } }
  },
  forest(g, layer, r, B) {
    const trunk = (x, h, w, c) => { g.fillStyle = c; g.fillRect(x, LH - h, w, h); g.fillRect(x - 3, LH - 12, w + 6, 12); };
    if (layer === 0) { for (let i = 0; i < 8; i++) trunk(i * 64 + r.range(-8, 8), r.range(180, 280), r.range(14, 24), mix('#0e4a4a', B.bottom, 0.4)); }
    else if (layer === 1) { for (let i = 0; i < 12; i++) { const x = r.range(0, LW); stalk(g, x, LH, r.range(120, 260), 8, mix('#1e7a4a', B.bottom, 0.45), i); for (let k = 0; k < 4; k++) { g.fillStyle = mix('#2a9a5a', B.bottom, 0.4); g.fillRect(x - 10, LH - r.range(60, 230), 24, 3); } } }
    else { for (let i = 0; i < 20; i++) stalk(g, r.range(0, LW), LH, r.range(40, 120), 5, mix('#34aa5a', B.bottom, 0.3), i * 1.3); }
  },
  kingdom(g, layer, r, B) {
    const tower = (x, w, h, col, win) => { g.fillStyle = col; g.fillRect(x - w / 2, LH - h, w, h); g.beginPath(); g.moveTo(x - w / 2 - 3, LH - h); g.lineTo(x, LH - h - w * 0.9); g.lineTo(x + w / 2 + 3, LH - h); g.fill(); if (win) { g.fillStyle = '#ffd8f0'; for (let y = LH - h + 10; y < LH - 14; y += 16) g.fillRect(x - 2, y, 4, 6); } };
    if (layer === 0) { for (let i = 0; i < 6; i++) tower(i * 90 + r.range(-10, 10), r.range(28, 50), r.range(120, 230), mix('#5a4a98', B.bottom, 0.45), false); }
    else if (layer === 1) { for (let i = 0; i < 9; i++) { const x = r.range(0, LW); tower(x, r.range(18, 30), r.range(60, 150), mix('#8a62b8', B.bottom, 0.4), true); if (i % 2) { g.strokeStyle = mix('#a888d8', B.bottom, 0.4); g.lineWidth = 3; g.beginPath(); g.arc(x + 40, LH - 60, 28, Math.PI, 0); g.stroke(); } } }
    else { for (let i = 0; i < 14; i++) { stalk(g, r.range(0, LW), LH, r.range(20, 60), 5, mix(i % 2 ? '#e87e90' : '#c85a96', B.bottom, 0.45), i); } }
  },
  graveyard(g, layer, r, B) {
    const hull = (x, by, w, h, col, tilt) => { g.save(); g.translate(x, by); g.rotate(tilt); g.fillStyle = col; g.beginPath(); g.moveTo(-w / 2, -h); g.lineTo(w / 2, -h * 0.8); g.lineTo(w * 0.35, 0); g.lineTo(-w * 0.4, 0); g.fill(); g.fillRect(-2, -h - 70, 4, 74); g.fillRect(-18, -h - 55, 36, 3); g.restore(); };
    if (layer === 0) { for (let i = 0; i < 4; i++) hull(i * 140 + r.range(-20, 20), LH - 10, r.range(120, 180), r.range(40, 70), mix('#1e4a4e', B.bottom, 0.55), r.range(-0.2, 0.2)); }
    else if (layer === 1) { for (let i = 0; i < 5; i++) hull(r.range(0, LW), LH - 4, r.range(80, 140), r.range(30, 56), mix('#2a5a5a', B.bottom, 0.5), r.range(-0.3, 0.3)); }
    else { for (let i = 0; i < 12; i++) { const x = r.range(0, LW); g.fillStyle = mix('#4a6a6a', B.bottom, 0.5); g.fillRect(x, LH - r.range(10, 40), 3, 40); g.fillRect(x - 6, LH - 30, 15, 2); } }
  },
  abyss(g, layer, r, B) {
    if (layer === 0) { for (let i = 0; i < 6; i++) blob(g, i * 90, LH, r.range(80, 140), r.range(60, 140), mix('#0c1840', '#000000', 0.4)); }
    else if (layer === 1) { for (let i = 0; i < 40; i++) { g.fillStyle = ['#58d0e8', '#c07aff', '#6aff9a'][i % 3]; g.globalAlpha = r.range(0.15, 0.6); g.fillRect(r.range(0, LW), r.range(20, LH - 20), 2, 2); } g.globalAlpha = 1; }
    else { for (let i = 0; i < 8; i++) { stalk(g, r.range(0, LW), LH, r.range(30, 90), 4, '#0a1230', i); } }
  },
  trench(g, layer, r, B) {
    const spire = (x, h, w, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x - w / 2, LH); g.lineTo(x - w * 0.1, LH - h); g.lineTo(x + w * 0.15, LH - h * 0.8); g.lineTo(x + w / 2, LH); g.fill(); };
    if (layer === 0) { for (let i = 0; i < 8; i++) spire(i * 66 + r.range(-10, 10), r.range(120, 270), r.range(40, 80), mix('#2a1038', '#000', 0.5)); }
    else if (layer === 1) { for (let i = 0; i < 6; i++) { const x = r.range(0, LW); g.strokeStyle = mix('#8a6a98', '#000', 0.55); g.lineWidth = 4; g.beginPath(); g.arc(x, LH + 20, r.range(40, 90), Math.PI, TAU * 0.98); g.stroke(); } for (let i = 0; i < 6; i++) { g.fillStyle = '#ff3a6a'; g.globalAlpha = 0.5; g.fillRect(r.range(0, LW), r.range(30, LH - 30), 2, 3); } g.globalAlpha = 1; }
    else { for (let i = 0; i < 10; i++) spire(r.range(0, LW), r.range(30, 90), r.range(14, 28), mix('#1a0a24', '#000', 0.2)); }
  },
  domain(g, layer, r, B) {
    const col = (x, w, h, c) => { g.fillStyle = c; g.fillRect(x - w / 2, LH - h, w, h); g.fillRect(x - w / 2 - 4, LH - h, w + 8, 5); g.fillRect(x - w / 2 - 4, LH - 6, w + 8, 6); };
    if (layer === 0) { for (let i = 0; i < 6; i++) col(i * 90 + 20, 26, r.range(160, 290), mix('#1e6a7a', B.bottom, 0.5)); g.strokeStyle = mix('#2a8a9a', B.bottom, 0.5); g.lineWidth = 6; g.beginPath(); g.arc(135, 40, 60, Math.PI, 0); g.stroke(); }
    else if (layer === 1) { for (let i = 0; i < 8; i++) col(r.range(0, LW), r.range(14, 22), r.range(80, 170), mix('#2a9aa0', B.bottom, 0.45)); for (let i = 0; i < 5; i++) { g.fillStyle = '#9af0e0'; g.globalAlpha = 0.5; g.fillRect(r.range(0, LW), r.range(40, LH - 40), 2, 2); } g.globalAlpha = 1; }
    else { for (let i = 0; i < 10; i++) stalk(g, r.range(0, LW), LH, r.range(20, 60), 4, mix('#40c8c8', B.bottom, 0.4), i); }
  },
};

export class Background {
  constructor(biomeId, seed = 1) {
    this.B = BIOMES[biomeId]; this.biome = biomeId; this.seed = seed;
    const r = rng(seed * 31 + biomeId.length);
    this.layers = [];
    for (let i = 0; i < 3; i++) {
      const cv = document.createElement('canvas'); cv.width = LW; cv.height = LH; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      (SCENES[biomeId] || SCENES.reef)(g, i, r, this.B);
      this.layers.push({ cv, px: [0.12, 0.28, 0.55][i], py: [0.1, 0.2, 0.32][i], alpha: [0.55, 0.75, 0.95][i] });
    }
    // light-ray strip
    this.rays = this.B.rays ? Array.from({ length: 6 }, () => ({ x: r.range(0, LW), w: r.range(10, 28), a: r.range(0.04, 0.1), s: r.range(0.1, 0.3) })) : null;
    this.fish = Array.from({ length: 14 }, () => ({ x: r.range(0, 480), y: r.range(40, 230), s: r.range(10, 24) * (r() < 0.5 ? -1 : 1), sz: r() < 0.3 ? 2 : 1 }));
  }
  draw(ctx, cam, zone, t) {
    const B = this.B, ph = Math.max(0, Math.min(1, cam.y / Math.max(1, zone.h * 16 - 270)));
    const g = ctx.createLinearGradient(0, 0, 0, 270);
    g.addColorStop(0, mix(B.top, B.bottom, Math.min(1, ph * 0.9))); g.addColorStop(1, mix(B.top, B.bottom, Math.min(1, 0.45 + ph * 0.55)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 480, 270);
    // god rays
    if (this.rays && ph < 0.7) {
      ctx.save(); for (const r of this.rays) { const x = ((r.x - cam.x * 0.2 + Math.sin(t * r.s) * 12) % LW + LW) % LW - 40; ctx.globalAlpha = r.a * (1 - ph * 1.4); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + r.w, 0); ctx.lineTo(x + r.w * 2.4 - 40, 270); ctx.lineTo(x - 40, 270); ctx.fill(); } ctx.restore(); ctx.globalAlpha = 1;
    }
    for (const L of this.layers) {
      const ox = -(cam.x * L.px) % LW, oy = Math.round(-cam.y * L.py * 0.4 - ph * 30 + 0);
      ctx.globalAlpha = L.alpha;
      for (let x = ox - LW; x < 480; x += LW) ctx.drawImage(L.cv, Math.round(x), 270 - LH + 40 + oy + 0);
    }
    ctx.globalAlpha = 1;
    // drifting fish silhouettes
    if (this.B.id !== 'abyss' && this.B.id !== 'trench') {
      ctx.fillStyle = mix(B.top, B.bottom, 0.65);
      for (const f of this.fish) { const x = ((f.x + t * f.s - cam.x * 0.4) % 520 + 520) % 520 - 20, y = Math.round(f.y - cam.y * 0.1 + Math.sin(t + f.x) * 3); ctx.fillRect(Math.round(x), y, 4 * f.sz, 2 * f.sz); ctx.fillRect(Math.round(x) + (f.s > 0 ? -2 : 4 * f.sz), y, 2, 2); }
    }
  }
}
export function getBackground(biome, seed) { const k = biome + seed; let b = cache.get(k); if (!b) { b = new Background(biome, seed); cache.set(k, b); } return b; }
