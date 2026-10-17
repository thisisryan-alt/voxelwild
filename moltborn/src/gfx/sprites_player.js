// Hero sprites: five evolutions (+ secret sixth), each painted per pose so animation frames stay pixel-perfect.
import { Painter, flashOf } from './painter.js';
import { R, OUTLINE } from './palette.js';

export const TAU_ = Math.PI * 2;
const TAU = Math.PI * 2;
const sin = Math.sin, cos = Math.cos;

// ---- pose model ------------------------------------------------------------------------
const P0 = () => ({ bob: 0, legs: 'walk', legT: 0, c1: { ext: 0.2, lift: 0, open: 0.3 }, c2: { ext: 0.1, lift: 0.2, open: 0.3 }, squash: 0, eyeY: 0, shut: false, glow: 0, tail: 0, lunge: 0 });
const mk = (o) => { const p = P0(); for (const k in o) p[k] = typeof o[k] === 'object' && !Array.isArray(o[k]) && p[k] ? { ...p[k], ...o[k] } : o[k]; return p; };

export const ANIMS = {};
const def = (name, fps, loop, frames) => { ANIMS[name] = { fps, loop, n: frames.length, frames: frames.map(mk) }; };
const gen = (n, f) => Array.from({ length: n }, (_, i) => f(i / n, i));

def('idle', 4, true, gen(4, (k, i) => ({ legs: 'idle', bob: [0, 0, -1, -1][i], c1: { ext: 0.2, open: 0.25 + 0.2 * sin(k * TAU), lift: 0.05 }, c2: { open: 0.2 + 0.2 * cos(k * TAU) }, eyeY: [0, 0, -1, 0][i] })));
def('walk', 12, true, gen(6, (k) => ({ legs: 'walk', legT: k, bob: -Math.abs(sin(k * TAU * 1)) * 1, c1: { ext: 0.3 + 0.25 * sin(k * TAU), open: 0.3 }, c2: { ext: 0.1 + 0.2 * sin(k * TAU + 3), open: 0.3 } })));
def('swim', 8, true, gen(4, (k, i) => ({ legs: 'trail', legT: k, bob: [0, -1, 0, 1][i], c1: { ext: 0.5, lift: 0.1, open: 0.3 }, c2: { ext: 0.4, lift: 0.2, open: 0.3 } })));
def('stroke', 14, false, [{ legs: 'kick', legT: 0, bob: 1 }, { legs: 'kick', legT: 0.5, bob: -1, c1: { ext: 0.6 } }, { legs: 'kick', legT: 1, bob: -2, c1: { ext: 0.5 } }].map((o) => o));
def('fall', 6, true, [{ legs: 'spread', bob: 0, c1: { ext: 0.4, lift: 0.4, open: 0.6 }, c2: { ext: 0.3, lift: 0.5, open: 0.6 } }, { legs: 'spread', bob: -1, c1: { ext: 0.4, lift: 0.5, open: 0.7 }, c2: { ext: 0.3, lift: 0.6, open: 0.6 } }]);
def('attack1', 22, false, [
  { c1: { ext: -0.2, lift: 0.4, open: 1 }, lunge: -1, legs: 'walk', legT: 0 },
  { c1: { ext: 0.0, lift: 0.3, open: 1 }, lunge: -1 },
  { c1: { ext: 1, lift: 0.1, open: 1 }, lunge: 2 },
  { c1: { ext: 1, lift: 0, open: 0 }, lunge: 2 },
  { c1: { ext: 0.7, lift: 0, open: 0.3 }, lunge: 1 },
  { c1: { ext: 0.4, lift: 0, open: 0.4 } }]);
def('attack2', 22, false, [
  { c2: { ext: -0.2, lift: 0.5, open: 1 }, c1: { ext: 0.3 }, lunge: -1 },
  { c2: { ext: 0.0, lift: 0.4, open: 1 }, lunge: -1 },
  { c2: { ext: 1, lift: 0.0, open: 1 }, lunge: 2 },
  { c2: { ext: 1, lift: -0.1, open: 0 }, lunge: 2 },
  { c2: { ext: 0.7, lift: 0, open: 0.3 }, lunge: 1 },
  { c2: { ext: 0.3, lift: 0, open: 0.4 } }]);
def('attack3', 20, false, [
  { c1: { ext: 0.2, lift: 1, open: 1 }, c2: { ext: 0.2, lift: 1, open: 1 }, lunge: -1, bob: 1, tail: -1 },
  { c1: { ext: 0.3, lift: 1, open: 1 }, c2: { ext: 0.3, lift: 1, open: 1 }, lunge: -2, bob: 2, tail: -1.4 },
  { c1: { ext: 0.8, lift: -0.5, open: 1 }, c2: { ext: 0.8, lift: -0.5, open: 1 }, lunge: 2, bob: -1, tail: 1.2 },
  { c1: { ext: 1, lift: -0.8, open: 0 }, c2: { ext: 1, lift: -0.8, open: 0 }, lunge: 3, bob: -1, tail: 1.6 },
  { c1: { ext: 0.8, lift: -0.4, open: 0.2 }, c2: { ext: 0.6, lift: -0.2, open: 0.2 }, lunge: 1 },
  { c1: { ext: 0.4 }, c2: { ext: 0.3 } }]);
def('heavy_charge', 10, true, gen(4, (k, i) => ({ legs: 'idle', squash: 0.3, bob: i % 2, c1: { ext: -0.2, lift: 0.9, open: 1 }, c2: { ext: -0.2, lift: 0.9, open: 1 }, glow: 0.4 + 0.3 * sin(k * TAU), lunge: -1 })));
def('heavy', 16, false, [
  { c1: { ext: 0.2, lift: 1, open: 1 }, c2: { ext: 0.2, lift: 1, open: 1 }, bob: 1, lunge: -2, tail: -1.5 },
  { c1: { ext: 1, lift: -0.2, open: 1 }, c2: { ext: 1, lift: -0.2, open: 1 }, lunge: 3, glow: 0.8, tail: 1.5 },
  { c1: { ext: 1, lift: -0.4, open: 0 }, c2: { ext: 1, lift: -0.4, open: 0 }, lunge: 4, glow: 1, tail: 2 },
  { c1: { ext: 1, lift: -0.4, open: 0 }, c2: { ext: 1, lift: -0.4, open: 0 }, lunge: 3, glow: 0.5 },
  { c1: { ext: 0.6, open: 0.3 }, c2: { ext: 0.5, open: 0.3 }, lunge: 1 }, { c1: { ext: 0.4 } }]);
def('dash', 14, true, [{ legs: 'trail', legT: 0, lunge: 3, c1: { ext: 1, open: 0.1 }, c2: { ext: 1, open: 0.1 }, squash: 0.2 }, { legs: 'trail', legT: 0.5, lunge: 3, c1: { ext: 1, open: 0.1 }, c2: { ext: 1, open: 0.1 }, squash: 0.2 }]);
def('block', 8, true, [{ legs: 'idle', squash: 0.7, c1: { ext: 0.8, lift: 0.5, open: 0 }, c2: { ext: 0.8, lift: 0.7, open: 0 } }, { legs: 'idle', squash: 0.7, bob: 0, c1: { ext: 0.85, lift: 0.5, open: 0 }, c2: { ext: 0.85, lift: 0.7, open: 0 } }]);
def('parry', 18, false, [{ legs: 'idle', squash: 0.4, c1: { ext: 1, lift: 0.6, open: 0 }, c2: { ext: 1, lift: 0.8, open: 0 }, glow: 1 }, { legs: 'idle', squash: 0.2, c1: { ext: 1, lift: 0.2, open: 1 }, c2: { ext: 0.9, lift: 0.4, open: 1 }, glow: 0.6 }, { legs: 'idle', c1: { ext: 0.7 }, glow: 0.2 }]);
def('hurt', 8, false, [{ legs: 'spread', shut: true, bob: 1, lunge: -2, c1: { ext: -0.3, lift: 0.4, open: 0.8 }, c2: { ext: -0.2, lift: 0.4, open: 0.8 } }, { legs: 'spread', shut: true, bob: 0, lunge: -1, c1: { ext: 0, lift: 0.2, open: 0.6 } }]);
def('death', 6, false, [{ legs: 'spread', shut: true, bob: 1, lunge: -2 }, { legs: 'spread', shut: true, bob: 2, squash: 0.3, lunge: -2 }, { legs: 'tuck', shut: true, bob: 3, squash: 0.6, lunge: -1 }, { legs: 'tuck', shut: true, bob: 4, squash: 0.8, c1: { ext: 0 } }]);
def('cast', 12, false, [{ legs: 'idle', c1: { ext: 0.2, lift: 0.8, open: 0.6 }, c2: { ext: 0.2, lift: 0.9, open: 0.6 }, glow: 0.4, squash: 0.1 }, { legs: 'idle', c1: { ext: 0.5, lift: 0.9, open: 1 }, c2: { ext: 0.5, lift: 1, open: 1 }, glow: 0.9 }, { legs: 'idle', c1: { ext: 0.9, lift: 0.4, open: 1 }, c2: { ext: 0.9, lift: 0.5, open: 1 }, glow: 1, lunge: 2 }, { legs: 'idle', c1: { ext: 0.6, lift: 0.2, open: 0.5 }, glow: 0.4 }]);
def('collect', 10, false, [{ legs: 'idle', squash: 0.2, c1: { ext: 0.5, lift: -0.5, open: 1 } }, { legs: 'idle', squash: 0.1, c1: { ext: 0.3, lift: 0.8, open: 0.2 }, bob: -1 }, { legs: 'idle', c1: { ext: 0.2, lift: 0.3, open: 0.4 } }]);
def('interact', 8, false, [{ legs: 'idle', c1: { ext: 0.6, lift: 0.2, open: 1 } }, { legs: 'idle', c1: { ext: 0.9, lift: 0.1, open: 0.2 } }, { legs: 'idle', c1: { ext: 0.5, lift: 0.1, open: 0.5 } }]);
def('respawn', 8, false, [{ legs: 'tuck', squash: 0.8, glow: 1, shut: true }, { legs: 'tuck', squash: 0.5, glow: 0.7, shut: true }, { legs: 'idle', squash: 0.2, glow: 0.4 }, { legs: 'idle', glow: 0.1 }]);

// ---- form painters -------------------------------------------------------------------
// Each: { w, h, ax, ay, hit:[w,h], paint(p, pose, o) } ; sprite faces RIGHT; (ax,ay) = feet anchor.
export const eye = (p, x, y, shut, look = 0, big = 1.8) => {
  if (shut) { p.line(x - 1, y, x + 1, y, OUTLINE); return; }
  p.ellipse(x, y, big, big, R.eyeWhite, { dither: 0 });
  p.px(x, y, '#170d1c'); p.px(x + 1, y, '#170d1c'); p.px(x, y + 1, '#170d1c'); p.px(x - 1, y - 1, '#ffffff');
};

export function legsPose(p, pose, hipX, hipY, footY, n, col, spacing, thick = 1) {
  // short bent legs; near legs 2px wide. col=[main, foot-tip]
  for (let i = 0; i < n; i++) {
    let lift = 0, stride = 0, spreadX = 0;
    const ph = pose.legT + i / n;
    if (pose.legs === 'walk') { stride = sin(ph * TAU) * 2.2; lift = Math.max(0, cos(ph * TAU)) * 2; }
    else if (pose.legs === 'trail') { stride = -3 - (i % 2); lift = -1 + sin((pose.legT + i * 0.2) * TAU) * 0.6; }
    else if (pose.legs === 'kick') { stride = -2 - pose.legT * 3; lift = -pose.legT * 2; }
    else if (pose.legs === 'spread') { spreadX = (i - (n - 1) / 2) * 1.6; lift = 1 + (i % 2); stride = (i - (n - 1) / 2); }
    else if (pose.legs === 'tuck') { lift = 3; stride = 0; }
    const hx = Math.round(hipX + i * spacing), hy = Math.round(hipY);
    const side = (i - (n - 1) / 2);
    const fx = Math.round(hx + side * 1.8 + stride + spreadX), fy = Math.round(footY - lift);
    const kx = Math.round(hx + side * 2.6 + stride * 0.5), ky = Math.round(hy + 2);
    for (let t = 0; t < thick; t++) { p.line(hx + t, hy, kx + t, ky, col[0]); p.line(kx + t, ky, fx + t, fy, col[0]); }
    p.px(fx, fy, col[1]); if (thick > 1) p.px(fx + 1, fy, col[1]);
  }
}

export function claw(p, sx, sy, ext, lift, open, scale, ramp, back, st = {}) {
  sx = Math.round(sx); sy = Math.round(sy);
  const jm = st.jaw || 1, th = st.thin || 1;
  const reach = (2.5 + ext * 4.5) * scale * (st.reach || 1), up = -lift * 5 * scale, wx = Math.round(sx + reach), wy = Math.round(sy + up - 1 * scale);
  p.shape(ramp, {}, (s) => { s.capsule(sx, sy, wx, wy, 1.5 * scale * th, 2 * scale * th); });
  const a = 0.2 + open * 0.6, L = 6 * scale * jm;
  p.shape(ramp, {}, (s) => s.capsule(wx, wy + 1, wx + L * cos(a * 0.6), wy + 1 + L * sin(a * 0.6) * 0.8, 1.8 * scale * th, 0.8 * scale * th));
  p.shape(ramp, {}, (s) => s.capsule(wx, wy - 1, wx + L * cos(-a) * 1.05, wy - 1 + L * sin(-a), 2.2 * scale * th, 0.9 * scale * th));
  p.shape(ramp, {}, (s) => s.ellipse(wx, wy, 3.2 * scale * (st.palm || 1), 3 * scale * (st.palm || 1)));
  if (!back) { p.px(wx - 1, wy - 2, ramp.c[4]); p.px(wx, wy - 2, ramp.c[4]); }
  if (st.edge) { p.line(wx + 2, wy - 1, wx + L * cos(-a), wy - 1 + L * sin(-a), st.edge); }
  return [wx, wy];
}

export const FORMS = {};

FORMS.shore = {
  w: 42, h: 30, ax: 21, ay: 27, hit: [14, 10],
  paint(p, pose, o) {
    const r = o.ramp, far = o.far, sq = pose.squash;
    const lun = Math.round(pose.lunge * 0.5), by = Math.round(18 + pose.bob + sq * 3), bx = 18 + lun;
    legsPose(p, pose, bx - 7, by + 4, 27, 4, [far.c[1], far.c[2]], 4, 1);
    claw(p, bx + 7, by - 1, pose.c2.ext, pose.c2.lift + 0.2, pose.c2.open, 0.85, far, true);
    p.shape(r, { texture: { seed: 3, p: 0.05 } }, (s) => { s.ellipse(bx, by, 10.5, 6.5 - sq * 1.5); });
    p.ellipse(bx - 1, by + 4 - sq, 7, 2.2, R.belly, { outline: false, dither: 0.25 });
    p.px(bx - 6, by - 3, r.c[4]); p.px(bx - 5, by - 4, r.c[4]); p.px(bx - 4, by - 4, r.c[3]); p.px(bx - 7, by - 2, r.c[3]);
    p.px(bx + 3, by - 1, r.c[1]); p.px(bx + 6, by, r.c[1]); p.px(bx + 1, by + 1, r.c[1]);
    legsPose(p, pose, bx - 6, by + 5, 28, 4, [r.c[1], r.c[4]], 4, 2);
    const ey = Math.round(by - 9 + sq * 2), shut = pose.shut || sq > 0.6;
    p.line(bx + 3, by - 4, bx + 3, ey + 2, far.c[1]); p.line(bx + 8, by - 3, bx + 8, ey + 2, far.c[1]);
    eye(p, bx + 3, ey, shut, 0, 2); eye(p, bx + 8, ey, shut, 0, 2);
    claw(p, bx + 9, by + 1, pose.c1.ext, pose.c1.lift + 0.15, pose.c1.open, 1, r, false);
    if (pose.glow > 0) p.glow(bx + 4, by, 15, '#ffd8a0', 0.35 * pose.glow);
  },
};

// ---- cache + API -----------------------------------------------------------------------
const cache = new Map();
import { DYES } from '../data/items.js';
// Palette variant from branches + dye. Each form paints with variant.ramp / variant.far.
export function variantFor(state) {
  const key = state.form + '|' + Object.values(state.branches).join(',') + '|' + state.dye;
  let v = variantCache.get(key); if (v) return v;
  const base = (FORM_RAMPS[state.form] || FORM_RAMPS.shore)(state);
  const dye = DYES[state.dye];
  let ramp = base.ramp, far = base.far;
  if (dye) { ramp = ramp.tint(dye.hue, dye.sat, dye.light); far = far.tint(dye.hue, dye.sat, dye.light * 0.9); }
  v = { key, ramp, far, branch: base.branch, accent: base.accent, glow: base.glow, form: state.form }; variantCache.set(key, v); return v;
}
const variantCache = new Map();
const FORM_RAMPS = {
  shore: () => ({ ramp: R.shore, far: R.shoreFar }),
};
export function registerFormRamps(m) { Object.assign(FORM_RAMPS, m); }
export function playerFrame(form, variant, anim, i) {
  const key = `${form}|${variant.key}|${anim}|${i}`;
  let f = cache.get(key);
  if (f) return f;
  const F = FORMS[form] || FORMS.shore, A = ANIMS[anim] || ANIMS.idle;
  const pose = A.frames[Math.min(i, A.n - 1)];
  const p = new Painter(F.w, F.h, OUTLINE);
  F.paint(p, pose, variant);
  f = { canvas: p.toCanvas(), w: F.w, h: F.h, ax: F.ax, ay: F.ay, _flash: null };
  cache.set(key, f);
  return f;
}
export const defaultVariant = () => ({ key: 'base', ramp: R.shore, far: R.shoreFar });
export const FORM_PAINTERS = FORMS;
export { flashOf };
