// The Rift Warden: the keeper of the tear at the bottom of every Tidal Rift. A hooded body of violet crystal with a slit of
// open water down its chest, a single eye, a halo of broken-off shards and a trailing hem of loose glass. Faces right.
import { PLANS } from './sprites_enemies.js';
import { Ramp } from './painter.js';
import { R } from './palette.js';

const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, rd = Math.round;
const GLASS = new Ramp(['#0a0618', '#241048', '#4a2a90', '#8a60d8', '#e0ccff']);
const TEAR = new Ramp(['#06143a', '#1a5aa8', '#38b8ff', '#a8ecff', '#ffffff']);
const EYE = new Ramp(['#400a60', '#a030d0', '#ff80ff', '#ffe0ff', '#ffffff']);

// one shard of the halo: a thin kite of crystal pointing along its orbit
function shard(p, x, y, a, len, ramp) {
  const dx = cos(a) * len, dy = sin(a) * len, nx = -sin(a) * len * 0.28, ny = cos(a) * len * 0.28;
  p.poly([[x - dx, y - dy], [x + nx, y + ny], [x + dx * 0.7, y + dy * 0.7], [x - nx, y - ny]], ramp, { dither: 0.2 });
  p.px(rd(x + nx * 0.2), rd(y + ny * 0.2), ramp.c[4]);
}

PLANS.riftwarden = (p, t, o) => {
  const pose = o.pose, rage = !!o.rage, cx = 60, cy = 58, hover = pose === 'idle' || pose === 'walk' ? rd(sin(t * TAU) * 2) : 0;
  const open = pose === 'open' || pose === 'roar' || pose === 'windup', stag = pose === 'stagger' ? 7 : 0;
  const glass = rage ? GLASS.tint(0.06, 1.15, 1.08) : GLASS, tear = rage ? TEAR.tint(0.62, 1.1, 1.0) : TEAR;
  const by = cy + hover + stag;
  p.glow(cx, by, 56, rage ? '#ff60c0' : '#8a50ff', 0.16 + (open ? 0.1 : 0), 5);
  // the halo: six shards turning around the shoulders, faster once enraged
  const spin = t * TAU * (rage ? 2 : 1);
  for (let i = 0; i < 6; i++) {
    const a = spin + i * TAU / 6, rx = 42, ry = 14, x = cx + cos(a) * rx, y = by - 18 + sin(a) * ry, far = sin(a) < 0;
    if (far) shard(p, x, y, a + Math.PI / 2, 8, glass.tint(0, 0.9, 0.7));
  }
  // the hem: loose glass trailing below the body, in place of legs
  for (let i = 0; i < 5; i++) {
    const hx = cx - 20 + i * 10, sway = sin(t * TAU + i * 1.2) * 3, len = 16 + (i % 2 ? 6 : 0) + (pose === 'stagger' ? -6 : 0);
    p.poly([[hx - 4, by + 18], [hx + sway, by + 18 + len], [hx + 4, by + 18]], glass.tint(0, 1, 0.85), { dither: 0.3 });
  }
  // the hooded body
  p.shape(glass, { dither: 0.45, texture: { seed: 4, p: 0.07 } }, (s) => {
    s.ellipse(cx, by - 4, 26, 30); s.poly([[cx - 22, by - 4], [cx, by - 52], [cx + 22, by - 4]]); s.rect(cx - 24, by + 2, 48, 20, 6);
  });
  // facets: lit edges on the near side of the crystal
  for (let k = 0; k < 6; k++) p.line(cx - 18 + k * 7, by - 10 + (k % 3) * 8, cx - 12 + k * 7, by + 14, glass.c[1]);
  for (let k = 0; k < 4; k++) p.line(cx + 8 + k * 3, by - 36 + k * 6, cx + 20 + k, by - 6 + k * 5, glass.c[4]);
  // the rift down the chest: a slit of open sea
  const w = open ? 7 : 3 + rd(sin(t * TAU) * 1);
  p.poly([[cx - 1, by - 22], [cx - w, by - 4], [cx - 1, by + 20], [cx + w, by - 4]], tear, { dither: 0.15 });
  p.glow(cx, by - 2, open ? 26 : 16, rage ? '#ff90e0' : '#60d8ff', open ? 0.7 : 0.4);
  for (let k = 0; k < 4; k++) p.px(rd(cx - 1 + sin(t * TAU + k * 1.7) * (w - 1)), by - 16 + k * 8, '#ffffff');
  // the hood and the eye
  p.shape(glass.tint(0, 1, 1.12), { dither: 0.3 }, (s) => s.poly([[cx - 13, by - 24], [cx, by - 50], [cx + 13, by - 24], [cx + 6, by - 18], [cx - 6, by - 18]]));
  p.ellipse(cx + 2, by - 30, 6, 5, EYE, { dither: 0 });
  p.ellipse(cx + 4, by - 30, 2.2, 3.4, R.void, { outline: false }); p.px(cx + 1, by - 32, '#ffffff');
  p.line(cx - 6, by - 36, cx + 9, by - 34, '#0a0618');
  p.glow(cx + 2, by - 30, 12, rage ? '#ff60c0' : '#c070ff', 0.45);
  // a crown of three crystal spikes
  for (const [dx, h] of [[-7, 12], [0, 18], [7, 12]]) p.poly([[cx + dx - 3, by - 44], [cx + dx, by - 44 - h], [cx + dx + 3, by - 44]], glass.tint(0, 1, 1.2), {});
  // the near half of the halo passes in front of the body
  for (let i = 0; i < 6; i++) {
    const a = spin + i * TAU / 6, x = cx + cos(a) * 42, y = by - 18 + sin(a) * 14;
    if (sin(a) >= 0) shard(p, x, y, a + Math.PI / 2, 10, glass.tint(0, 1, 1.15));
  }
  // arms: two floating gauntlets of crystal that follow the pose
  const lift = pose === 'windup' ? -14 : pose === 'roar' ? -8 : pose === 'stagger' ? 10 : 0;
  for (const d of [-1, 1]) {
    const hx = cx + d * 34, hy = by + 6 + lift + (d > 0 ? rd(sin(t * TAU + 1) * 2) : rd(sin(t * TAU) * 2));
    p.poly([[hx - 5, hy - 5], [hx + d * 6, hy], [hx - 5, hy + 7], [hx - d * 5, hy]], glass.tint(0, 1, 1.1), { dither: 0.2 });
    p.px(hx, hy, glass.c[4]);
  }
};
