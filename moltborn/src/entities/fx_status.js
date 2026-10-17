// What status effects look like. Every active effect gets a tint over the sprite, particles around the body and, for
// enemies, a row of small icons above the health bar. The player's own list is drawn by the HUD (ui/hud_extra.js).
import { STATUS, statusIcon } from '../systems/status.js';
import { clamp } from '../core/util.js';

const tintCache = new WeakMap();
// a solid-colour silhouette of a frame, cached per colour: drawn over the sprite at low alpha it reads as a tint
function silhouette(f, color) {
  let m = tintCache.get(f.canvas); if (!m) { m = new Map(); tintCache.set(f.canvas, m); }
  let c = m.get(color);
  if (!c) {
    c = document.createElement('canvas'); c.width = f.canvas.width; c.height = f.canvas.height;
    const g = c.getContext('2d'); g.drawImage(f.canvas, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    m.set(color, c);
  }
  return c;
}

// per-effect look: tint colour, strength (0..1) and an optional flicker rate
const LOOK = {
  burn:   { tint: '#ff7a2a', a: 0.28, flicker: 12 },
  bleed:  { tint: '#c01830', a: 0.14 },
  chill:  { tint: '#9adcff', a: 0.36 },
  frail:  { tint: '#d8a0ff', a: 0.22, flicker: 7 },
  weaken: { tint: '#9a9078', a: 0.2 },
  regen:  { tint: '#7aff9a', a: 0.14, flicker: 3 },
  haste:  { tint: '#ffe65a', a: 0.1 },
  might:  { tint: '#ff7a5a', a: 0.14, flicker: 4 },
  ward:   { tint: '#9ad8ff', a: 0.1 },
  focus:  { tint: '#6ab0ff', a: 0.1, flicker: 5 },
  fortune: { tint: '#ffd84a', a: 0.12, flicker: 6 },
  ember:  { tint: '#ff9a3a', a: 0.2, flicker: 9 },
};

// draw the tints for every active effect (at most three, strongest first so a crowd of buffs cannot paint a sprite solid)
export function statusOverlay(ctx, owner, f, x, y, flip, scale = 1) {
  const set = owner.status; if (!set || !set.size) return;
  const t = (owner.t ?? owner.world?.t ?? 0), list = set.entries().slice(0, 3);
  ctx.save();
  for (const s of list) {
    const L = LOOK[s.id]; if (!L) continue;
    let a = L.a * clamp(s.t * 3, 0, 1);
    if (L.flicker) a *= 0.65 + 0.35 * Math.sin(t * L.flicker + s.age);
    if (a < 0.02) continue;
    ctx.globalAlpha = a;
    const cv = silhouette(f, L.tint), px = Math.round(x), py = Math.round(y);
    if (flip) { ctx.save(); ctx.translate(px, py); ctx.scale(-scale, scale); ctx.drawImage(cv, -f.ax, -f.ay); ctx.restore(); }
    else if (scale !== 1) { ctx.save(); ctx.translate(px, py); ctx.scale(scale, scale); ctx.drawImage(cv, -f.ax, -f.ay); ctx.restore(); }
    else ctx.drawImage(cv, px - f.ax, py - f.ay);
  }
  ctx.restore();
}

// particles, called each update while the owner carries effects
export function statusFx(owner, dt) {
  const set = owner.status; if (!set || !set.size) return;
  const w = owner.world, fx = w.fx, hw = (owner.w || 12) / 2, hh = (owner.h || 12) / 2;
  owner._sfxT = (owner._sfxT || 0) - dt; if (owner._sfxT > 0) return; owner._sfxT = 0.09;
  const rx = () => owner.x + (Math.random() - 0.5) * hw * 1.6, ry = () => owner.y + (Math.random() - 0.5) * hh * 1.4;
  for (const s of set.list.values()) {
    switch (s.id) {
      case 'burn': fx.add({ x: rx(), y: owner.y + hh * 0.2, vx: (Math.random() - 0.5) * 10, vy: -26 - Math.random() * 22, life: 0.5, size: Math.random() < 0.4 ? 2 : 1, color: ['#ffd070', '#ff8a3a', '#ff5a2a'][(Math.random() * 3) | 0], drag: 1, shrink: true }); break;
      case 'bleed': if (Math.random() < 0.6) fx.add({ x: rx(), y: ry(), vx: (Math.random() - 0.5) * 8, vy: 6, life: 0.8, size: 1, color: '#b01830', grav: 70, fade: true }); break;
      case 'chill': if (Math.random() < 0.7) fx.add({ x: rx(), y: ry(), vx: 0, vy: 4, life: 0.7, size: 1, color: Math.random() < 0.5 ? '#d8f4ff' : '#9adcff', kind: 'star', drag: 1 }); break;
      case 'frail': if (Math.random() < 0.5) fx.add({ x: rx(), y: ry(), vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.25, size: 1, color: '#e8c8ff', drag: 3 }); break;
      case 'weaken': if (Math.random() < 0.3) fx.add({ x: owner.x + (Math.random() - 0.5) * 6, y: owner.y - hh - 3, vx: 0, vy: 8, life: 0.8, size: 1, color: '#9a9078', fade: true }); break;
      case 'regen': if (Math.random() < 0.45) fx.add({ x: rx(), y: owner.y + hh * 0.4, vx: 0, vy: -18, life: 0.9, size: 1, color: '#7aff9a', kind: 'star', drag: 0.6 }); break;
      case 'haste': if (Math.random() < 0.5) fx.add({ x: owner.x - Math.sign(owner.vx || owner.facing || 1) * hw, y: ry(), vx: -(owner.vx || 0) * 0.25, vy: 0, life: 0.2, size: 1, color: '#fff2a0', kind: 'streak', len: 0.05 }); break;
      case 'might': if (Math.random() < 0.35) fx.add({ x: rx(), y: owner.y + hh * 0.6, vx: 0, vy: -22, life: 0.6, size: 1, color: '#ff8a6a', drag: 0.8, shrink: true }); break;
      case 'ward': if (Math.random() < 0.15) fx.add({ x: owner.x + Math.cos(w.t * 3) * (hw + 4), y: owner.y + Math.sin(w.t * 3) * (hh + 3), vx: 0, vy: 0, life: 0.4, size: 1, color: '#c8f0ff', fade: true }); break;
      case 'focus': if (Math.random() < 0.4) { const a = Math.random() * 6.3; fx.add({ x: owner.x + Math.cos(a) * 16, y: owner.y + Math.sin(a) * 16, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 30, life: 0.5, size: 1, color: '#8ac8ff', shrink: true }); } break;
      case 'fortune': if (Math.random() < 0.35) fx.add({ x: rx(), y: ry(), vx: 0, vy: -12, life: 0.7, size: 1, color: '#ffe680', kind: 'star', drag: 0.5 }); break;
      case 'ember': if (Math.random() < 0.5) fx.add({ x: rx(), y: owner.y + hh * 0.3, vx: (Math.random() - 0.5) * 12, vy: -30, life: 0.45, size: 1, color: '#ffb040', drag: 1.2, shrink: true }); break;
      default: break;
    }
  }
}

// a row of small icons above an enemy: harmful effects only, at most four, with a drain bar under each
export function statusPips(ctx, enemy, cam, barY) {
  const set = enemy.status; if (!set || !set.size) return;
  const list = set.entries().filter((s) => STATUS[s.id].harmful).slice(0, 4); if (!list.length) return;
  const n = list.length, x0 = Math.round(enemy.x - cam.x - (n * 10) / 2), y = barY - 10;
  list.forEach((s, i) => {
    const x = x0 + i * 10;
    ctx.drawImage(statusIcon(s.id, 1), x, y);
    ctx.fillStyle = '#05030a'; ctx.fillRect(x + 1, y + 9, 8, 2);
    ctx.fillStyle = STATUS[s.id].color; ctx.fillRect(x + 1, y + 9, Math.max(1, Math.round(8 * clamp(s.t / s.max, 0, 1))), 1);
    if (s.stacks > 1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 7, y, 2, 2); }
  });
}
