// World dressing sprites (plants, corals, rocks, ruins...). Painted procedurally from a seed so every
// instance varies, then swayed via pixel-perfect row shears. Returns {frames,w,h,ax,ay,fps}.
import { Painter, shear, makeSprite } from './painter.js';
import { R, OUTLINE } from './palette.js';
import { rng } from '../core/util.js';

const cache = new Map();
const TAU = Math.PI * 2;

function swayFrames(canvas, amp, n = 4, baseY) {
  const fr = [];
  for (let i = 0; i < n; i++) fr.push(shear(canvas, Math.round(Math.sin((i / n) * TAU) * amp * 10) / 10, baseY));
  return fr;
}

const PAINT = {
  seaweed(v, rand) {
    const h = 18 + (v % 3) * 6, w = 28;
    const p = new Painter(w, h + 2);
    const n = 3 + (v % 3);
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2));
    for (const i of order) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5, hh = h * (1 - Math.abs(t) * 0.35) * (0.85 + rand() * 0.2);
      const x0 = w / 2 + t * 4, y0 = h;
      const x1 = w / 2 + t * 16 + (rand() - 0.5) * 3, y1 = h - hh;
      const pts = [[x0, y0], [x0 + t * 6, y0 - hh * 0.4], [x1, y1]];
      p.chain(pts, 2.2, 0.8, R.seaweed, { dither: 0.5 });
    }
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 2.5 };
  },
  kelp(v, rand) {
    const h = 40 + (v % 3) * 12, w = 20;
    const p = new Painter(w, h + 2);
    const pts = []; for (let i = 0; i <= 8; i++) pts.push([w / 2 + Math.sin(i * 0.9 + v) * 2.5, h - (i / 8) * (h - 2)]);
    p.chain(pts, 1.6, 1.0, R.seaweed.tint(0.03, 0.9, 0.85), { dither: 0.3 });
    for (let i = 2; i <= 8; i += 2) { const [x, y] = pts[i], s = i % 4 === 0 ? 1 : -1; p.chain([[x, y], [x + s * 4, y - 2], [x + s * 6, y - 5]], 1.5, 0.7, R.seaweed, { dither: 0.4 }); }
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 4 };
  },
  brain(v, rand) {
    const w = 34, h = 22 + (v % 2) * 4, p = new Painter(w, h + 2);
    const ramp = [R.coralPink, R.coralPink.tint(0.06, 1, 1), R.coralOrange.tint(-0.02, 0.9, 1)][v % 3];
    p.shape(ramp, { texture: { seed: v + 3, p: 0.14 }, dither: 0.55 }, (s) => {
      s.ellipse(17, h - 8, 14, 8); s.ellipse(9, h - 7, 8, 6); s.ellipse(25, h - 7, 8, 6.5); s.ellipse(15, h - 12, 8, 7); s.ellipse(22, h - 12, 6, 5);
    });
    // dark crevices, like the reference
    const dk = ramp.c[0];
    for (let k = 0; k < 5; k++) { let x = 6 + rand() * 22, y = h - 14 + rand() * 9; for (let j = 0; j < 4 + rand() * 4; j++) { p.px(x, y, dk); x += rand() < 0.6 ? 1 : 0; y += rand() < 0.5 ? 1 : (rand() < 0.5 ? -1 : 0); } }
    for (let k = 0; k < 10; k++) p.px(8 + rand() * 18, h - 18 + rand() * 7, ramp.c[4]);
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0 };
  },
  branch(v, rand) {
    const w = 30, h = 34 + (v % 3) * 4, p = new Painter(w, h + 2);
    const ramp = [R.coralRed, R.coralOrange, R.coralBlue, R.coralPink][v % 4];
    p.shape(ramp, { dither: 0.45, texture: { seed: v, p: 0.06 } }, (s) => {
      const grow = (x, y, ang, len, r, depth) => {
        const x2 = x + Math.sin(ang) * len, y2 = y - Math.cos(ang) * len;
        s.capsule(x, y, x2, y2, r, Math.max(0.9, r * 0.75));
        if (depth > 0) {
          grow(x2, y2, ang - 0.55 - rand() * 0.3, len * 0.72, r * 0.75, depth - 1);
          grow(x2, y2, ang + 0.5 + rand() * 0.3, len * 0.7, r * 0.75, depth - 1);
          if (rand() < 0.4) grow(x2, y2, ang + (rand() - 0.5) * 0.3, len * 0.8, r * 0.7, depth - 1);
        }
      };
      grow(w / 2, h, (rand() - 0.5) * 0.2, h * 0.38, 3.2, 2);
    });
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0.8 };
  },
  fan(v, rand) {
    const w = 30, h = 30, p = new Painter(w, h + 2);
    const ramp = [R.coralPink.tint(0.1), R.coralBlue, R.coralOrange][v % 3];
    p.shape(ramp, { dither: 0.6, texture: { seed: 9 + v, p: 0.1 } }, (s) => {
      s.capsule(w / 2, h, w / 2, h - 8, 1.4, 1.2);
      s.poly([[w / 2, h - 7], [3, h - 20], [7, h - 28], [w / 2, h - 30], [w - 7, h - 28], [w - 3, h - 20]]);
    });
    for (let k = 0; k < 6; k++) p.line(w / 2, h - 8, 5 + k * 4, h - 26 + (k % 2) * 3, ramp.c[1]);
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 1.2 };
  },
  rocks(v, rand) {
    const w = 34, h = 18, p = new Painter(w, h + 1);
    const R_ = v % 2 ? R.rock : R.rock.tint(0.02, 0.8, 1);
    const stones = [[8, h - 5, 7, 4], [20, h - 4, 8, 3.5], [28, h - 7, 4.5, 3], [14, h - 9, 5, 3]];
    stones.forEach(([x, y, rx, ry], i) => p.ellipse(x, y, rx * (0.85 + rand() * 0.3), ry, R_, { dither: 0.35 }));
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0 };
  },
  pebbles(v, rand) {
    const w = 22, h = 12, p = new Painter(w, h + 1);
    for (let i = 0; i < 4; i++) p.ellipse(4 + i * 4.5 + rand() * 2, h - 3 - rand() * 3, 2.8 + rand(), 2 + rand() * 0.6, R.rock, { dither: 0.3 });
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0 };
  },
  shell(v, rand) {
    const w = 16, h = 12, p = new Painter(w, h + 1);
    const r = [R.pearl, R.coralPink, R.sand][v % 3];
    p.shape(r, { dither: 0.4 }, (s) => s.poly([[w / 2, h - 1], [1, h - 7], [3, h - 11], [w / 2, h - 12], [w - 3, h - 11], [w - 1, h - 7]]));
    for (let k = 0; k < 5; k++) p.line(w / 2, h - 2, 3 + k * 2.5, h - 10, r.c[1]);
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0 };
  },
  anemone(v, rand) {
    const w = 24, h = 22, p = new Painter(w, h + 1);
    const r = [R.coralPink.tint(0.05), R.jelly, R.coralOrange][v % 3];
    p.ellipse(w / 2, h - 3, 5, 3.5, R.sand, {});
    for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2; p.chain([[w / 2 + a * 2, h - 5], [w / 2 + a * 6, h - 10 - Math.cos(a) * 3], [w / 2 + a * 9, h - 15 - Math.cos(a) * 3]], 1.5, 0.6, r, { dither: 0.3 }); }
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 2 };
  },
  glowcap(v, rand) {
    const w = 18, h = 18, p = new Painter(w, h + 1);
    p.capsule(w / 2, h, w / 2, h - 8, 1.8, 1.4, R.bone, {});
    p.shape(R.lumen.tint(0.08, 1, 1.1), { dither: 0.5 }, (s) => s.ellipse(w / 2, h - 10, 7, 5));
    for (let k = 0; k < 4; k++) p.px(5 + rand() * 9, h - 13 + rand() * 4, '#d0ffff');
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0.5, glow: '#58d0e8' };
  },
  vine(v, rand) {
    const h = 26 + (v % 3) * 8, w = 14, p = new Painter(w, h + 1);
    const pts = []; for (let i = 0; i <= 6; i++) pts.push([w / 2 + Math.sin(i * 1.1 + v) * 2, (i / 6) * (h - 2)]);
    p.chain(pts, 1.3, 0.6, R.seaweed.tint(0.02, 0.8, 0.8), { dither: 0.3 });
    for (let i = 1; i < 6; i += 2) p.chain([pts[i], [pts[i][0] + (i % 4 ? 4 : -4), pts[i][1] + 3]], 1.1, 0.6, R.seaweed, {});
    return { cv: p.toCanvas(), ax: w / 2, ay: 0, amp: -3, hang: true };
  },
  stalactite(v, rand) {
    const w = 14, h = 14 + (v % 3) * 6, p = new Painter(w, h + 1);
    p.poly([[1, 0], [w - 1, 0], [w / 2 + 1, h]], R.rockDark.tint(0, 1, 1.15), {});
    return { cv: p.toCanvas(), ax: w / 2, ay: 0, amp: 0, hang: true };
  },
  pillar(v, rand) {
    const w = 18, h = 48 + (v % 3) * 16, p = new Painter(w, h + 1);
    p.rect(2, 0, w - 4, h, R.marble, { dither: 0.3 });
    p.rect(0, 0, w, 6, R.marble, {}); p.rect(0, h - 6, w, 6, R.marble, {});
    for (let k = 0; k < 3; k++) p.line(5 + k * 4, 8, 5 + k * 4, h - 8, R.marble.c[1]);
    if (v % 2) { p.rect(3, 12, 5, 10, R.marble.tint(0, 0, 0.6), { outline: false, flat: 0 }); }
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0 };
  },
  lamp(v, rand) {
    const w = 12, h = 20, p = new Painter(w, h + 1);
    p.capsule(w / 2, h, w / 2, h - 11, 1.2, 1, R.chain, {});
    p.shape(R.glass, { dither: 0.3 }, (s) => s.ellipse(w / 2, h - 13, 4, 4.5));
    p.glow(w / 2, h - 13, 10, '#c0ffff', 0.5);
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0, glow: '#80e8ff' };
  },
  bones(v, rand) {
    const w = 28, h = 14, p = new Painter(w, h + 1);
    p.capsule(3, h - 3, 25, h - 5, 2, 1.6, R.bone, {});
    for (let i = 0; i < 4; i++) p.capsule(7 + i * 5, h - 5, 9 + i * 5, h - 12 + i % 2, 1, 1, R.bone, {});
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0 };
  },
  anchor(v, rand) {
    const w = 26, h = 34, p = new Painter(w, h + 1);
    p.shape(R.rust, {}, (s) => { s.capsule(13, 3, 13, h - 4, 1.8, 1.8); s.capsule(5, 8, 21, 8, 1.4, 1.4); s.capsule(4, h - 10, 13, h - 3, 1.6, 1.6); s.capsule(22, h - 10, 13, h - 3, 1.6, 1.6); s.ellipse(13, 3, 3, 3); });
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0 };
  },
  barrel(v, rand) {
    const w = 16, h = 18, p = new Painter(w, h + 1);
    p.shape(R.wood, { dither: 0.3 }, (s) => s.ellipse(8, h - 9, 7, 8.5));
    p.line(2, h - 13, 14, h - 13, R.rust.c[1]); p.line(1, h - 6, 15, h - 6, R.rust.c[1]);
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0 };
  },
  ribs(v, rand) {
    const w = 40, h = 44, p = new Painter(w, h + 1);
    for (let i = 0; i < 4; i++) { const x = 6 + i * 9; p.chain([[x, h], [x - 2, h - 18], [x + 6, h - 36]], 2.2, 1.1, R.wood, { dither: 0.3 }); }
    p.chain([[2, h - 6], [20, h - 12], [38, h - 6]], 1.6, 1.6, R.wood, {});
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0 };
  },
  statue(v, rand) {
    const w = 26, h = 44, p = new Painter(w, h + 1);
    p.rect(3, h - 8, w - 6, 8, R.marble, {});
    p.shape(R.marble, { dither: 0.3 }, (s) => { s.rect(8, h - 30, 10, 22); s.ellipse(13, h - 34, 5, 5.5); s.capsule(8, h - 28, 3, h - 16, 2, 1.6); s.capsule(18, h - 28, 23, h - 40, 2, 1.6); });
    p.capsule(23, h - 40, 23, h - 6, 0.8, 0.8, R.trident, { outline: false });
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0 };
  },
  crystal(v, rand) {
    const w = 22, h = 28, p = new Painter(w, h + 1);
    const r = [R.lumen, R.venom, R.abyssal][v % 3];
    p.shape(r, { dither: 0.3 }, (s) => { s.poly([[4, h], [7, h - 16], [10, h]]); s.poly([[8, h], [12, h - 26], [17, h]]); s.poly([[14, h], [17, h - 12], [20, h]]); });
    p.glow(11, h - 12, 14, r.hex[4], 0.4);
    return { cv: p.toCanvas(), ax: w / 2, ay: h, amp: 0, glow: r.hex[3] };
  },
  chainhang(v, rand) {
    const h = 30 + (v % 3) * 10, w = 8, p = new Painter(w, h + 1);
    for (let y = 1; y < h; y += 4) p.ellipse(4, y + 1.5, 2, 2.2, R.chain, {});
    return { cv: p.toCanvas(), ax: 4, ay: 0, amp: -1.2, hang: true };
  },
};

export function propSprite(type, variant = 0) {
  const key = type + ':' + variant;
  let s = cache.get(key);
  if (s) return s;
  const fn = PAINT[type];
  if (!fn) throw new Error('unknown prop ' + type);
  const rand = rng(variant * 7919 + type.length * 131 + 1);
  const o = fn(variant, rand);
  const frames = o.amp ? swayFrames(o.cv, o.amp, 4, o.hang ? 0 : o.cv.height - 1) : [o.cv];
  if (o.hang && o.amp) { /* hanging props sway from the top: shear about row 0 mirrored */ frames.length = 0; for (let i = 0; i < 4; i++) frames.push(shearTop(o.cv, Math.sin((i / 4) * TAU) * Math.abs(o.amp))); }
  s = { frames, w: o.cv.width, h: o.cv.height, ax: o.ax + (frames[0].pad || 0), ay: o.ay, fps: 3, glow: o.glow || null, hang: !!o.hang };
  cache.set(key, s);
  return s;
}
function shearTop(canvas, amp) {
  const cv = document.createElement('canvas'); const pad = Math.ceil(Math.abs(amp)) + 1; cv.width = canvas.width + pad * 2; cv.height = canvas.height; cv.pad = pad;
  const g = cv.getContext('2d');
  for (let y = 0; y < canvas.height; y++) { const k = y / Math.max(1, canvas.height - 1); g.drawImage(canvas, 0, y, canvas.width, 1, pad + Math.round(amp * k * k), y, canvas.width, 1); }
  return cv;
}
export const PROP_TYPES = Object.keys(PAINT);
