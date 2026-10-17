// Body plans for the creatures that came through the rifts: a crystal Shardling, the blood-ringed Latchleech, the
// robed Tidecaller and the slab-built Glass Golem. Registered into PLANS like the other enemy files; sprites face RIGHT.
import { PLANS } from './sprites_enemies.js';
import { Ramp } from './painter.js';
import { R } from './palette.js';

const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, rd = Math.round;
const GLASS = new Ramp(['#0a0618', '#241048', '#4a2a90', '#8a60d8', '#e0ccff']);
const LEECH = new Ramp(['#1a0608', '#4a1018', '#8a2030', '#c84050', '#ffa0a8']);
const ROBE = new Ramp(['#06202a', '#0e4a60', '#1a8aa8', '#60d0e0', '#d8fbff']);

// ---- Shardling: a diamond of violet glass with one eye, and three bits of itself orbiting ------------------------------------------------
PLANS.shardling = (p, t, o) => {
  const cx = p.w / 2, cy = p.h / 2, pose = o.pose, wind = pose === 'windup', glass = o.ramp || GLASS, pulse = sin(t * TAU) * 0.8, k = wind ? 1.25 : 1;
  p.glow(cx, cy, 12, wind ? '#ffffff' : '#a070ff', wind ? 0.55 : 0.3);
  for (let i = 0; i < 3; i++) { const a = t * TAU + i * TAU / 3, x = cx + cos(a) * 11, y = cy + sin(a) * 6; p.poly([[x - 1.5, y], [x, y - 2.6], [x + 1.5, y], [x, y + 2.6]], glass.tint(0, 1, 1.1), { dither: 0.2 }); }
  p.shape(glass, { dither: 0.45, texture: { seed: 3, p: 0.06 } }, (s) => s.poly([[cx - 7 * k, cy], [cx, cy - 11 - pulse], [cx + 7 * k, cy], [cx, cy + 11 + pulse]]));
  p.line(cx, cy - 10, cx, cy + 10, glass.c[1]); p.line(cx - 6, cy, cx + 6, cy, glass.c[1]);
  p.line(cx - 3, cy - 5, cx + 1, cy - 8, glass.c[4]);
  p.ellipse(cx + 1, cy, 3.2, 3.2, new Ramp(['#400a60', '#a030d0', '#ff80ff', '#ffe0ff', '#ffffff']), { dither: 0 }); p.px(cx + 2, cy, '#05030a'); p.px(cx + 2, cy + 1, '#05030a');
};

// ---- Latchleech: a ringed worm, wide sucker-mouth in front, a ruffled fin behind --------------------------------------------------------
PLANS.latchleech = (p, t, o) => {
  const pose = o.pose, cy = p.h / 2, wind = pose === 'windup', leech = o.ramp || LEECH, n = 7;
  const pts = []; for (let i = 0; i < n; i++) { const x = p.w - 10 - i * 4.2, w = sin(t * TAU - i * 0.8) * (wind ? 1 : 3); pts.push([x, cy + w * (i / n + 0.3)]); }
  for (let i = n - 1; i >= 0; i--) { const [x, y] = pts[i], r = 3.6 - i * 0.28 + (i === 1 ? 0.6 : 0); p.shape(leech, { dither: 0.45 }, (s) => s.ellipse(x, y, Math.max(1.2, r), Math.max(1.2, r * 0.9))); if (i % 2 === 0) p.line(rd(x), rd(y - r + 0.5), rd(x), rd(y + r - 0.5), leech.c[1]); }
  const tx = pts[n - 1][0] - 3, ty = pts[n - 1][1]; p.poly([[tx + 3, ty], [tx - 3, ty - 4], [tx - 1, ty], [tx - 3, ty + 4]], leech.tint(0, 1, 0.85), {});
  const [hx, hy] = pts[0], open = pose === 'leap' || wind ? 3.4 : 2;
  p.shape(leech.tint(0, 1, 1.1), { dither: 0.3 }, (s) => s.ellipse(hx + 3, hy, 4.8, 4.2));
  p.ellipse(hx + 6.5, hy, 2, open, R.void, { outline: false });
  for (let i = 0; i < 5; i++) { const a = -1.1 + i * 0.55; p.px(rd(hx + 6.5 + cos(a) * 2.2), rd(hy + sin(a) * (open + 0.8)), '#ffffff'); }
  p.px(rd(hx + 2), rd(hy - 2), '#ffe040'); p.px(rd(hx + 2), rd(hy - 1), '#05030a');
  p.px(rd(hx), rd(hy + 2), leech.c[4]);
};

// ---- Tidecaller: a tall conch hood over a floating robe, a spiral of current held in one hand ----------------------------------------------
PLANS.tidecaller = (p, t, o) => {
  const cx = p.w / 2, pose = o.pose, call = pose === 'attack', wind = pose === 'windup', robe = o.ramp || ROBE, bob = rd(sin(t * TAU) * 1.4), by = p.h - 14 + bob;
  p.glow(cx, by - 6, 22, '#60e0ff', call ? 0.4 : 0.18);
  for (let i = 0; i < 4; i++) { const hx = cx - 8 + i * 5, sw = sin(t * TAU + i * 1.4) * 2; p.poly([[hx - 3, by + 4], [hx + sw, by + 13], [hx + 3, by + 4]], robe.tint(0, 1, 0.8), { dither: 0.3 }); }
  p.shape(robe, { dither: 0.45, texture: { seed: 8, p: 0.06 } }, (s) => { s.ellipse(cx, by - 2, 11, 12); s.rect(cx - 10, by - 2, 20, 8, 4); });
  p.shape(new Ramp(['#3a2a30', '#8a6a68', '#d8b0a0', '#f8e0d0', '#ffffff']), { dither: 0.4 }, (s) => s.poly([[cx - 9, by - 8], [cx - 2, by - 31], [cx + 8, by - 8], [cx + 2, by - 3], [cx - 5, by - 3]]));
  for (let k = 0; k < 4; k++) p.line(cx - 6 + k, by - 8 - k * 5, cx + 5 - k, by - 6 - k * 4, '#8a6a68');
  p.ellipse(cx + 1, by - 6, 3, 3, new Ramp(['#06202a', '#1a8aa8', '#60d0e0', '#d8fbff', '#ffffff']), { dither: 0 }); p.px(cx + 2, by - 6, '#05030a');
  // the held current: arcs that spin faster when it is about to be thrown
  const hx = cx + 12, hy = by - 4 - (wind ? 4 : 0), spin = t * TAU * (wind || call ? 3 : 1);
  for (let i = 0; i < 6; i++) { const a = spin + i * 0.8, r = 2 + i * 0.9; p.px(rd(hx + cos(a) * r), rd(hy + sin(a) * r * 0.8), i % 2 ? '#d8fbff' : '#60d0e0'); }
  p.line(cx + 8, by, hx - 1, hy + 1, robe.c[3]);
  if (call) for (let k = 0; k < 4; k++) p.line(hx + 4, hy - 4 + k * 3, hx + 12 + k * 2, hy - 4 + k * 3, '#d8fbff');
};

// ---- Glass Golem: slabs of violet crystal stacked into a figure, a crack of light down the middle -----------------------------------------
PLANS.glassgolem = (p, t, o) => {
  const cx = p.w / 2, base = p.h - 2, pose = o.pose, wind = pose === 'windup', slam = pose === 'attack', glass = o.ramp || GLASS, walk = pose === 'move' ? sin(t * TAU) * 2 : 0;
  const top = base - 40 + (slam ? 5 : 0), arm = wind ? -14 : slam ? 8 : 0;
  for (const [lx, d] of [[cx - 7, -1], [cx + 7, 1]]) p.shape(glass.tint(0, 1, 0.85), { dither: 0.35 }, (s) => s.poly([[lx - 5, base - 17], [lx + 5, base - 17], [lx + 4 + d * walk, base], [lx - 4 + d * walk, base]]));
  p.shape(glass, { dither: 0.45, texture: { seed: 5, p: 0.06 } }, (s) => { s.poly([[cx - 13, top + 14], [cx - 8, top + 3], [cx + 8, top + 3], [cx + 14, top + 14], [cx + 9, base - 15], [cx - 9, base - 15]]); });
  p.shape(glass.tint(0, 1, 1.12), { dither: 0.3 }, (s) => s.poly([[cx - 6, top + 4], [cx - 3, top - 7], [cx + 3, top - 7], [cx + 6, top + 4]]));
  for (const d of [-1, 1]) {
    const sx = cx + d * 15, sy = top + 10, hx = sx + d * 5, hy = sy + 12 + arm * (d > 0 ? 1 : 0.2);
    p.shape(glass.tint(0, 1, 1.05), { dither: 0.35 }, (s) => { s.poly([[sx - 5, sy - 4], [sx + 5, sy - 4], [hx + 4, hy], [hx - 4, hy + 4]]); });
    p.px(hx, hy, glass.c[4]);
  }
  p.line(cx, top + 4, cx - 1, top + 12, '#ffffff'); p.line(cx - 1, top + 12, cx + 2, top + 22, '#a8ecff'); p.line(cx + 2, top + 22, cx, base - 18, '#60d8ff');
  p.glow(cx, top + 14, 16, wind ? '#ffffff' : '#60d8ff', wind ? 0.6 : 0.3);
  for (let k = 0; k < 4; k++) p.line(cx - 10 + k * 5, top + 8 + k % 2 * 6, cx - 6 + k * 5, top + 20 + k % 2 * 5, glass.c[1]);
  p.ellipse(cx + 1, top - 2, 2.2, 2.2, R.eyeWhite, { outline: false, dither: 0 }); p.px(cx + 2, top - 2, '#ff40c0');
};
