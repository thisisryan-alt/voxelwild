// Enemy & boss body plans. Each plan paints one frame: (painter, phase t in [0,1), options). Sprites face RIGHT.
import { Painter, color } from './painter.js';
import { R, OUTLINE } from './palette.js';
import { FORMS as HERO } from './sprites_player.js';

const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos;
const eyeAt = (p, x, y, r = 1.6, angry = false, glow = null) => {
  p.ellipse(x, y, r, r, glow ? new (R.gold.constructor)([glow, glow, glow, '#fff', '#fff']) : R.eyeWhite, { dither: 0 });
  p.px(x + 0.5, y, '#170d1c'); if (r > 1.4) p.px(x + 0.5, y + 1, '#170d1c');
  if (angry) p.line(x - r - 0.5, y - r - 1, x + r + 1, y - r + 0.5, '#170d1c');
};

export const PLANS = {
  // ---- fish family ------------------------------------------------------------------
  fish(p, t, o) {
    const L = o.len, H = o.hgt, cx = p.w / 2 - 1, cy = p.h / 2, sw = sin(t * TAU) * (o.tail ?? 2);
    const fr = o.fin || o.ramp.tint(0.02, 1, 0.9), tl = o.tailLen ?? L * 0.35;
    if (o.dorsal !== false) p.poly([[cx - L * 0.1, cy - H / 2 + 1], [cx - L * 0.28, cy - H * 0.95 + (o.dorsalH ?? 0)], [cx - L * 0.38, cy - H / 2 + 2]], fr, {});
    p.poly([[cx - L * 0.4, cy], [cx - L * 0.5 - tl, cy - H * 0.55 + sw], [cx - L * 0.5 - tl * 0.7, cy + sw * 0.6], [cx - L * 0.5 - tl, cy + H * 0.55 + sw], [cx - L * 0.4, cy + 1]], fr, { dither: 0.3 });
    p.poly([[cx - L * 0.05, cy + H / 2 - 2], [cx - L * 0.2, cy + H * 0.9 - sw * 0.5], [cx - L * 0.28, cy + H / 2 - 1]], fr, {});
    p.shape(o.ramp, { dither: 0.5, texture: o.spots ? { seed: 4, p: 0.08 } : undefined }, (s) => { s.ellipse(cx, cy, L / 2, H / 2); });
    if (o.belly) p.ellipse(cx + 1, cy + H * 0.22, L * 0.4, H * 0.2, o.belly, { outline: false, dither: 0.3 });
    if (o.stripes) for (let i = 0; i < o.stripes; i++) { const sx = cx - L * 0.22 + i * (L * 0.22); for (let y = -H * 0.35; y < H * 0.35; y += 1) p.px(sx + (i % 2), cy + y, o.ramp.c[0]); }
    // gill
    p.line(cx + L * 0.12, cy - H * 0.2, cx + L * 0.1, cy + H * 0.18, o.ramp.c[1]);
    // mouth / jaw
    const open = o.pose === 'attack' || o.pose === 'windup';
    const mx = cx + L / 2 - 1;
    if (open) { p.poly([[mx - 3, cy], [mx + 3, cy - H * 0.35], [mx + 3, cy + H * 0.35]], R.fishRed.tint(0, 1, 0.5), {}); if (o.teeth !== false) { for (let k = -1; k <= 1; k++) p.px(mx + 1, cy + k * 2, '#ffffff'); } }
    else p.line(mx - 3, cy + H * 0.1, mx, cy + H * 0.15, '#170d1c');
    if (o.teeth && !open) { p.px(mx - 2, cy + H * 0.1 + 1, '#ffffff'); p.px(mx - 4, cy + H * 0.1 + 1, '#ffffff'); }
    eyeAt(p, cx + L * 0.27, cy - H * 0.12, Math.max(1.2, H * 0.14), o.angry !== false);
    if (o.spines) for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3 + Math.PI, x1 = cx + cos(a) * L * 0.42, y1 = cy + sin(a) * H * 0.42; p.line(x1, y1, x1 + cos(a) * 4, y1 + sin(a) * 4, '#f8f0d8'); }
    if (o.lure) { const lx = cx + L * 0.15, ly = cy - H * 0.5; p.chain([[cx + L * 0.05, cy - H * 0.45], [lx + 4, ly - 7], [cx + L * 0.5 + 3, ly - 6 + sin(t * TAU) * 1.5]], 0.7, 0.5, R.chain, { outline: false }); p.glow(cx + L * 0.5 + 3, ly - 6 + sin(t * TAU) * 1.5, 6, '#9affff', 0.8); p.ellipse(cx + L * 0.5 + 3, ly - 6 + sin(t * TAU) * 1.5, 1.6, 1.6, R.glass, {}); }
  },
  // ---- crab family (reuses the hero crab painter with new colours & gear) -----------------
  crab(p, t, o) {
    const pose = { bob: Math.abs(sin(t * TAU)) * -1, legs: 'walk', legT: t, c1: { ext: o.pose === 'attack' ? 1 : o.pose === 'windup' ? -0.2 : 0.3, lift: o.pose === 'windup' ? 0.8 : 0.1, open: o.pose === 'attack' ? 0.3 : o.pose === 'windup' ? 1 : 0.3 }, c2: { ext: 0.1, lift: 0.2, open: 0.3 }, squash: o.pose === 'guard' ? 0.7 : 0, eyeY: 0, shut: false, glow: 0, tail: 0, lunge: o.pose === 'attack' ? 2 : 0 };
    HERO.shore.paint(p, pose, { ramp: o.ramp, far: o.far || o.ramp.tint(0, 1, 0.7) });
    const bx = 22, by = 19 + Math.round(pose.bob || 0);
    if (o.helm) { p.shape(R.steel, {}, (s2) => { s2.ellipse(bx - 1, by - 5, 10, 5.5); s2.rect(bx - 11, by - 5, 21, 2); }); p.px(bx + 4, by - 7, R.steel.c[4]); p.px(bx + 3, by - 7, R.steel.c[4]); p.line(bx - 6, by - 9, bx + 2, by - 10, R.steel.c[4]); }
    if (o.shield && o.pose !== 'attack') { p.shape(R.steel, { dither: 0.4 }, (s2) => s2.ellipse(bx + 14, by + 2, 4, 8)); p.line(bx + 14, by - 5, bx + 14, by + 9, R.steel.c[4]); }
  },
  // ---- jelly family ------------------------------------------------------------------
  jelly(p, t, o) {
    const cx = p.w / 2, bell = o.bell ?? 8, pulse = sin(t * TAU) * 1.2, by = bell + 2 - (o.pose === 'windup' ? 1.5 : 0);
    const n = o.tent ?? 5;
    for (let i = 0; i < n; i++) {
      const x0 = cx - bell * 0.75 + (i / (n - 1)) * bell * 1.5, ph = t * TAU + i * 1.2;
      const len = o.len ?? 14;
      const pts = [[x0, by + 3], [x0 + sin(ph) * 1.5, by + 3 + len * 0.5], [x0 + sin(ph + 1.4) * 2.5, by + 3 + len]];
      p.chain(pts, 0.9, 0.5, o.tentRamp || o.ramp, { outline: false, dither: 0 });
    }
    p.shape(o.ramp, { dither: 0.55, texture: { seed: 2, p: 0.06 } }, (s) => { s.ellipse(cx, by, bell, bell * (0.72 + pulse * 0.05) - pulse * 0.4); });
    p.rect(cx - bell + 1, by + 1.5, bell * 2 - 2, 2, o.ramp, { outline: false, flat: 1 });
    for (let i = 0; i < 3; i++) p.px(cx - bell * 0.5 + i * bell * 0.5, by - bell * 0.35, o.ramp.c[4]);
    if (o.eyes) { p.px(cx - 2, by, '#170d1c'); p.px(cx + 2, by, '#170d1c'); }
    if (o.glow) p.glow(cx, by, bell + 5, o.glow, 0.35);
  },
  // ---- eel / serpent (segmented) ----------------------------------------------------------
  eel(p, t, o) {
    const n = o.segs ?? 9, sp = o.seg ?? 4.5, r0 = o.r ?? 4, cy = p.h / 2, x0 = p.w - r0 - 6;
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([x0 - i * sp, cy + sin(t * TAU - i * 0.7) * (o.amp ?? 3) * (0.4 + i / n)]);
    const rad = (i) => r0 * (1 - i / n * 0.55);
    for (let i = n - 1; i >= 1; i--) p.shape(o.ramp, { dither: 0.5, texture: o.spots ? { seed: i, p: 0.05 } : undefined }, (s) => s.capsule(pts[i][0], pts[i][1], pts[i - 1][0], pts[i - 1][1], rad(i), rad(i - 1)));
    if (o.fin) p.chain(pts.slice(0, n - 1).map((q, i) => [q[0], q[1] - rad(i) - 1]), 1, 1, o.fin, { outline: false });
    const [hx, hy] = pts[0], open = o.pose === 'attack' || o.pose === 'windup';
    p.shape(o.ramp, { dither: 0.5 }, (s) => { s.ellipse(hx + 2, hy, r0 + 1.5, r0 * 0.85); });
    if (open) p.poly([[hx + r0, hy - 1], [hx + r0 + 5, hy - r0 * 0.8], [hx + r0 + 5, hy + r0 * 0.8], [hx + r0, hy + 1]], R.fishRed.tint(0, 1, 0.45), {});
    else p.line(hx + 2, hy + 2, hx + r0 + 2, hy + 1, '#170d1c');
    eyeAt(p, hx + 3, hy - 1.5, 1.4, true);
    if (o.teeth && open) for (let k = 0; k < 3; k++) p.px(hx + r0 + 2 + k, hy + (k % 2 ? -1 : 1), '#fff');
  },
  // ---- turtle / armoured ----------------------------------------------------------------
  turtle(p, t, o) {
    const cx = p.w / 2, cy = p.h / 2 + 1, tuck = o.pose === 'guard', fl = sin(t * TAU) * 2;
    if (!tuck) {
      p.chain([[cx - 8, cy + 3], [cx - 13, cy + 7 + fl], [cx - 15, cy + 5 + fl]], 2, 1.2, o.skin, {});
      p.shape(o.skin, {}, (s) => { s.ellipse(cx + 12, cy - 1, 4.5, 3.8); });
      eyeAt(p, cx + 13.5, cy - 2, 1.2, true);
      p.line(cx + 14, cy + 1, cx + 17, cy + 1, '#170d1c');
      p.chain([[cx + 6, cy + 4], [cx + 10, cy + 8 - fl], [cx + 13, cy + 7 - fl]], 2, 1.2, o.skin, {});
    }
    p.shape(o.shell, { dither: 0.5, texture: { seed: 5, p: 0.07 } }, (s) => s.ellipse(cx, cy, 13, tuck ? 9 : 8.5));
    for (const x of [-7, 0, 7]) p.line(cx + x, cy - 7, cx + x, cy + 5, o.shell.c[1]);
    p.line(cx - 11, cy - 1, cx + 11, cy - 1, o.shell.c[1]);
    if (o.spikes) for (const x of [-8, -3, 3, 8]) p.poly([[cx + x - 2, cy - 7], [cx + x, cy - 12], [cx + x + 2, cy - 7]], R.bone, {});
  },
  // ---- urchin ----------------------------------------------------------------------------
  urchin(p, t, o) {
    const cx = p.w / 2, cy = p.h / 2, r = o.r ?? 6, n = o.spikes ?? 14, pul = o.pose === 'windup' ? 3 : 0;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + sin(t * TAU) * 0.04, L = r + 5 + (i % 2) * 2 + pul; p.line(cx + cos(a) * r * 0.6, cy + sin(a) * r * 0.6, cx + cos(a) * L, cy + sin(a) * L, o.spike || '#2a1a3a'); p.px(cx + cos(a) * L, cy + sin(a) * L, o.tip || '#e8b8ff'); }
    p.shape(o.ramp, { dither: 0.5, texture: { seed: 7, p: 0.1 } }, (s) => s.ellipse(cx, cy, r, r));
    eyeAt(p, cx + 2, cy - 1, 1.5, true);
  },
  // ---- plant turret ----------------------------------------------------------------------
  plant(p, t, o) {
    const cx = p.w / 2, base = p.h - 2, sw = sin(t * TAU) * 1.2, open = o.pose === 'attack' || o.pose === 'windup';
    p.chain([[cx, base], [cx + sw, base - 8], [cx + sw * 1.5 + 1, base - 15]], 2.6, 1.6, o.stalk || R.seaweed, {});
    for (const s of [-1, 1]) p.chain([[cx, base - 3], [cx + s * 6, base - 6 + sw], [cx + s * 9, base - 3]], 1.6, 0.8, o.stalk || R.seaweed, {});
    const px = cx + sw * 1.5 + 1, py = base - 17;
    p.shape(o.ramp, { dither: 0.5 }, (s) => s.ellipse(px, py, open ? 6 : 5.5, open ? 6.5 : 5));
    if (open) { p.ellipse(px, py, 3, 3.5, R.void, { outline: false }); p.glow(px, py, 8, o.glow || '#d8ff70', 0.6); } else p.ellipse(px, py + 1, 2.5, 1.5, o.ramp.tint(0, 1, 0.6), { outline: false });
    for (let i = 0; i < 4; i++) p.px(px - 4 + i * 2.5, py - 3 + (i % 2), o.ramp.c[4]);
  },
  // ---- cannon / turret --------------------------------------------------------------------
  cannon(p, t, o) {
    const cx = p.w / 2, cy = p.h / 2 + 3, rec = o.pose === 'attack' ? -3 : 0;
    p.shape(R.wood, { dither: 0.3 }, (s) => s.rect(cx - 12, cy + 2, 24, 7));
    p.shape(R.chain, { dither: 0.4 }, (s) => { s.capsule(cx - 8 + rec, cy - 2, cx + 12 + rec, cy - 2, 5.5, 4.5); s.ellipse(cx - 10 + rec, cy - 2, 5, 5); });
    p.px(cx + 12 + rec, cy - 2, '#050308'); p.ellipse(cx + 12 + rec, cy - 2, 2, 2.5, R.void, { outline: false });
    p.shape(R.wood, {}, (s) => { s.ellipse(cx - 4, cy + 7, 4, 4); s.ellipse(cx + 8, cy + 7, 4, 4); });
    if (o.pose === 'windup') p.glow(cx + 14, cy - 2, 9, '#ffb040', 0.7);
  },
  // ---- ghost sailor ------------------------------------------------------------------------
  ghost(p, t, o) {
    const cx = p.w / 2, cy = p.h / 2, bob = sin(t * TAU) * 1;
    p.shape(R.ghost, { dither: 0.6, outline: '#183038' }, (s) => { s.ellipse(cx, cy - 3 + bob, 6.5, 7); s.poly([[cx - 6.5, cy - 1 + bob], [cx - 7, cy + 11 + bob], [cx - 3, cy + 8 + bob], [cx, cy + 12 + bob], [cx + 3, cy + 8 + bob], [cx + 7, cy + 11 + bob], [cx + 6.5, cy - 1 + bob]]); });
    p.ellipse(cx - 2.5, cy - 4 + bob, 1.4, 2, R.void, { outline: false }); p.ellipse(cx + 2.5, cy - 4 + bob, 1.4, 2, R.void, { outline: false });
    p.px(cx - 2.5, cy - 4 + bob, '#9affff'); p.px(cx + 2.5, cy - 4 + bob, '#9affff');
    p.line(cx - 7, cy - 8 + bob, cx + 7, cy - 8 + bob, R.rust.c[2]); p.line(cx - 5, cy - 10 + bob, cx + 5, cy - 10 + bob, R.rust.c[1]);
    // lantern
    const open = o.pose === 'attack' || o.pose === 'windup';
    p.line(cx + 8, cy - 1 + bob, cx + 11, cy + 2 + bob, R.chain.c[3]); p.ellipse(cx + 12, cy + 4 + bob, 2.4, 2.8, R.gold, {}); p.glow(cx + 12, cy + 4 + bob, open ? 11 : 7, '#ffe8a0', 0.5);
  },
  // ---- squid -----------------------------------------------------------------------------
  squid(p, t, o) {
    const cx = p.w / 2, cy = p.h / 2, pulse = sin(t * TAU);
    for (let i = 0; i < 5; i++) { const y = cy - 5 + i * 2.5; p.chain([[cx - 3, y], [cx - 10 - pulse, y + sin(t * TAU + i) * 1.5], [cx - 17 - pulse * 2, y + 1 + sin(t * TAU + i + 1) * 2]], 1.1, 0.5, o.ramp, { outline: false }); }
    p.shape(o.ramp, { dither: 0.5 }, (s) => { s.ellipse(cx + 2, cy, 10, 6 - pulse * 0.5); s.poly([[cx - 6, cy - 2], [cx - 14, cy], [cx - 6, cy + 2]]); });
    eyeAt(p, cx + 7, cy - 1, 2, true, o.glow);
    p.glow(cx - 2, cy, 8, o.glow || '#ffffff', 0.15);
  },
  // ---- wisp ------------------------------------------------------------------------------
  wisp(p, t, o) {
    const cx = p.w / 2, cy = p.h / 2, r = (o.r ?? 5) + sin(t * TAU) * 0.7;
    for (let i = 0; i < 5; i++) p.ellipse(cx - 4 - i * 3, cy + sin(t * TAU + i) * 2, Math.max(1, r - 1 - i * 0.9), Math.max(1, r - 1 - i * 0.9), o.ramp, { outline: false, dither: 0 });
    p.shape(o.ramp, { dither: 0.5 }, (s) => s.ellipse(cx + 3, cy, r, r));
    p.glow(cx + 3, cy, r + 8, o.glow || '#c8a0ff', 0.5);
    p.ellipse(cx + 5, cy - 1, 1.5, 1.5, R.eyeWhite, { outline: false }); p.px(cx + 5.5, cy - 1, '#170d1c');
  },
  // ---- armoured guardian (humanoid) -------------------------------------------------------
  knight(p, t, o) {
    const cx = p.w / 2, base = p.h - 2, bob = sin(t * TAU) * 0.8, atk = o.pose === 'attack', wnd = o.pose === 'windup', grd = o.pose === 'guard';
    const m = o.ramp, g = R.trident;
    // legs / tail of foam
    p.chain([[cx - 3, base - 12 + bob], [cx - 6, base - 5], [cx - 7, base]], 2.8, 2, m, {}); p.chain([[cx + 3, base - 12 + bob], [cx + 5, base - 5], [cx + 7, base]], 2.8, 2, m, {});
    p.shape(m, { dither: 0.4 }, (s) => { s.ellipse(cx, base - 17 + bob, 8, 9); });
    p.line(cx - 7, base - 19 + bob, cx + 7, base - 19 + bob, m.c[0]); p.line(cx, base - 25 + bob, cx, base - 10 + bob, m.c[1]);
    p.shape(m, { dither: 0.3 }, (s) => { s.ellipse(cx + 1, base - 29 + bob, 5.5, 5.5); });
    p.rect(cx - 1, base - 30 + bob, 8, 2, R.void, { outline: false, flat: 0 }); p.px(cx + 3, base - 29 + bob, '#9affff'); p.px(cx + 5, base - 29 + bob, '#9affff');
    p.poly([[cx - 2, base - 34 + bob], [cx + 1, base - 40 + bob], [cx + 4, base - 34 + bob]], g, {});
    // spear arm
    const ay = wnd ? -10 : atk ? 6 : 0, ax = atk ? 18 : wnd ? -4 : 6;
    p.capsule(cx + 6, base - 21 + bob, cx + 10 + ax * 0.3, base - 19 + bob + ay * 0.4, 2.2, 2, m, {});
    const hx = cx + 10 + ax * 0.5, hy = base - 19 + bob + ay * 0.4;
    p.line(hx - 8, hy + 2, hx + 18, hy - 2, g.c[1]); p.line(hx - 8, hy + 1, hx + 18, hy - 3, g.c[3]);
    p.poly([[hx + 18, hy - 5], [hx + 24, hy - 2.5], [hx + 18, hy]], g, {}); p.poly([[hx + 16, hy - 6], [hx + 18, hy - 5], [hx + 17, hy - 4]], g, {});
    if (grd) p.shape(R.steel, { dither: 0.4 }, (s) => s.ellipse(cx + 12, base - 18 + bob, 4, 10));
    else p.capsule(cx - 6, base - 20 + bob, cx - 10, base - 14 + bob, 2, 1.8, m, {});
    if (atk) p.glow(hx + 20, hy - 2, 8, '#9af0ff', 0.6);
  },
};

// ---- sprite cache ------------------------------------------------------------------------
const cache = new Map();
export function plainFrame(key, w, h, ax, ay, paint) {
  let f = cache.get(key); if (f) return f;
  const p = new Painter(w, h, OUTLINE); paint(p);
  f = { canvas: p.toCanvas(), w, h, ax, ay, _flash: null }; cache.set(key, f); return f;
}
// def.sprite = {plan, w, h, ax, ay, o:{...}, frames}
export function enemyFrame(typeKey, sprite, pose, frame) {
  const key = `${typeKey}|${pose}|${frame}`;
  let f = cache.get(key); if (f) return f;
  const p = new Painter(sprite.w, sprite.h, sprite.outline || OUTLINE);
  const n = sprite.frames || 4, t = (frame % n) / n;
  PLANS[sprite.plan](p, t, { ...sprite.o, pose });
  f = { canvas: p.toCanvas(), w: sprite.w, h: sprite.h, ax: sprite.ax, ay: sprite.ay, _flash: null };
  cache.set(key, f); return f;
}
