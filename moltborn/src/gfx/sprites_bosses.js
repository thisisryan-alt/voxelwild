// Boss body plans (large, hand-composed from painter primitives). Registered into PLANS for enemyFrame().
import { PLANS } from './sprites_enemies.js';
import { claw, legsPose, eye } from './sprites_player.js';
import { Ramp } from './painter.js';
import { R } from './palette.js';

const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos;
const ROCK = new Ramp(['#1e1a12', '#3e3622', '#665a34', '#8e8050', '#c4b678']);
const ROCKFAR = new Ramp(['#12100a', '#2a2416', '#463e24', '#625634', '#8a7c50']);

PLANS.grumbold = (p, t, o) => {
  const pose = o.pose, rage = !!o.rage, cx = 62, by = 50 + (pose === 'idle' ? Math.round(sin(t * TAU)) : pose === 'stagger' ? 5 : 0);
  const C = { idle: { ext: 0.3, lift: 0.2, open: 0.3 }, walk: { ext: 0.4, lift: 0.1, open: 0.3 }, windup: { ext: -0.2, lift: 1, open: 1 }, swipe: { ext: 1, lift: -0.1, open: 0.5 }, slam: { ext: 0.7, lift: -0.9, open: 0.2 }, charge: { ext: 0.2, lift: 0, open: 0 }, stagger: { ext: 0, lift: -0.6, open: 0.8 }, roar: { ext: 0.2, lift: 1, open: 1 }, toss: { ext: 0.2, lift: 1, open: 0.2 } }[pose] || { ext: 0.3, lift: 0.2, open: 0.3 };
  const pl = { legs: pose === 'charge' || pose === 'walk' ? 'walk' : 'idle', legT: t, squash: pose === 'stagger' ? 0.6 : 0 };
  const sq = pl.squash;
  // far legs and claw
  legsPose(p, pl, cx - 24, by + 14, 80, 4, [ROCKFAR.c[2], ROCKFAR.c[3]], 11, 2);
  claw(p, cx + 24, by - 2, C.ext * 0.8, C.lift * 0.8 + 0.2, C.open, 3.6, ROCKFAR, true, { jaw: 1.1, palm: 1.2 });
  // carapace
  p.shape(ROCK, { dither: 0.5, texture: { seed: 4, p: 0.1 } }, (s) => { s.ellipse(cx, by, 31, 20 - sq * 5); });
  p.ellipse(cx - 2, by + 15 - sq * 3, 24, 5, new Ramp(['#3a2e20', '#5a4a30', '#8a7650', '#b4a070', '#d8c898']), { outline: false, dither: 0.3 });
  // armour plates + barnacles
  for (let k = 0; k < 5; k++) { p.line(cx - 22 + k * 11, by - 16, cx - 20 + k * 11, by + 8, ROCK.c[1]); p.px(cx - 23 + k * 11, by - 14, ROCK.c[4]); }
  for (const [bx, bY, r] of [[-20, -4, 3.5], [-8, -12, 3], [10, -13, 3.2], [20, -2, 3.6], [-24, 6, 2.8], [4, 6, 3], [14, 8, 2.6], [26, 8, 2.4]]) { p.shape(new Ramp(['#5a5a62', '#8a8a96', '#b4b4c0', '#dcdce8', '#ffffff']), { dither: 0.3 }, (s) => s.ellipse(cx + bx, by + bY, r, r * 0.8)); }
  for (let i = 0; i < 14; i++) p.px(cx - 26 + (i * 13) % 54, by - 10 + (i * 7) % 20, '#4a8a3a');
  // Brine Core — the weak point
  const coreGlow = pose === 'stagger' ? 1 : 0.5 + (rage ? 0.4 : 0) + 0.2 * sin(t * TAU);
  p.glow(cx - 1, by - 18, 12, '#ff9ad8', 0.5 * coreGlow); p.shape(R.coralPink, { dither: 0.2 }, (s) => s.poly([[cx - 6, by - 14], [cx - 1, by - 24], [cx + 5, by - 14], [cx, by - 10]])); p.px(cx - 1, by - 20, '#ffffff'); p.px(cx, by - 19, '#ffe0f0');
  if (rage) for (let k = 0; k < 6; k++) { p.line(cx - 18 + k * 7, by - 8, cx - 15 + k * 7, by + 2 + (k % 2) * 4, '#ff8a2a'); p.px(cx - 17 + k * 7, by - 4, '#ffe08a'); }
  legsPose(p, pl, cx - 22, by + 15, 81, 4, [ROCK.c[1], ROCK.c[4]], 11, 3);
  // eyes
  const ey = by - 24 + sq * 6; p.line(cx + 12, by - 17, cx + 14, ey + 3, ROCKFAR.c[2]); p.line(cx + 20, by - 15, cx + 21, ey + 3, ROCKFAR.c[2]);
  for (const ex of [cx + 14, cx + 21]) { p.ellipse(ex, ey, 3.2, 3.2, new Ramp(['#8a1010', '#c8301a', '#ffd84a', '#fff6a8', '#ffffff']), { dither: 0 }); p.px(ex + 1, ey, '#170d1c'); p.px(ex + 1, ey + 1, '#170d1c'); }
  p.line(cx + 9, ey - 4, cx + 17, ey - 2, '#170d1c'); p.line(cx + 25, ey - 4, cx + 18, ey - 2, '#170d1c');
  // near claw (big)
  claw(p, cx + 27, by + 2, C.ext, C.lift + 0.1, C.open, 4.4, ROCK, false, { jaw: 1.1, palm: 1.15 });
};

// ---- Mother Moray: segment + head sprites ------------------------------------------------------------------
const MOR = new Ramp(['#0a2a20', '#16503a', '#2a8a52', '#5ac878', '#b8ffb0']);
const MORB = new Ramp(['#5a3a10', '#8a6a24', '#c4a04a', '#e8d080', '#fff4b8']);
export function moraySeg(r, k) {
  const R2 = Math.round(r), s = R2 * 2 + 8, c = s / 2;
  return plainFrameLazy(`mseg${R2}_${k}`, s, s, c, c, (p) => {
    p.poly([[c - r * 0.7, c - r + 1], [c, c - r - 5 - (k % 2) * 2], [c + r * 0.7, c - r + 1]], MOR.tint(0.04, 1, 1.15), {});
    p.shape(MOR, { dither: 0.5, texture: { seed: k, p: 0.06 } }, (a) => a.ellipse(c, c, r, r));
    p.ellipse(c, c + r * 0.4, r * 0.75, r * 0.35, MORB, { outline: false, dither: 0.3 });
    if (k % 3 === 0) for (let i = 0; i < 3; i++) p.px(c - 2 + i * 2, c - r * 0.4, '#d8ffc0');
  });
}
export function morayHead(open, rage) {
  return plainFrameLazy(`mhead${open}${rage}`, 64, 48, 30, 24, (p) => {
    const c = 30, m = 24;
    for (let i = 0; i < 4; i++) p.poly([[c - 12 + i * 5, m - 10], [c - 10 + i * 5, m - 20 - (i % 2) * 3], [c - 6 + i * 5, m - 10]], R.bone, {});
    p.shape(MOR, { dither: 0.5, texture: { seed: 8, p: 0.06 } }, (a) => { a.ellipse(c, m, 15, 11); a.ellipse(c + 12, m + 1, 11, 7.5); });
    const jaw = open ? 8 : 1;
    p.poly([[c + 6, m + 3], [c + 24, m + 2 + jaw], [c + 22, m + 7 + jaw], [c + 4, m + 9]], MOR.tint(0, 1, 0.8), {});
    if (open) { p.poly([[c + 8, m + 2], [c + 25, m + 1], [c + 24, m + 2 + jaw], [c + 6, m + 4]], R.fishRed.tint(0, 1, 0.45), {}); for (let i = 0; i < 5; i++) { p.px(c + 10 + i * 3, m + 2, '#ffffff'); p.px(c + 10 + i * 3, m + 3 + jaw - 2, '#ffffff'); } }
    p.ellipse(c + 7, m - 5, 3, 3, new Ramp([rage ? '#ff3a1a' : '#a8d800', '#c8f000', '#ffff80', '#ffffff', '#ffffff']), { dither: 0 }); p.px(c + 8, m - 5, '#05030a'); p.px(c + 8, m - 4, '#05030a');
    p.line(c + 3, m - 9, c + 11, m - 8, '#05030a');
    p.glow(c + 7, m - 5, 7, rage ? '#ff6a3a' : '#e8ff70', 0.35);
  });
}
import { plainFrame as plainFrameLazy } from './sprites_enemies.js';

// ---- Queen Aurelia, the Coral Regent -----------------------------------------------------------------------------
PLANS.aurelia = (p, t, o) => {
  const cx = 56, cy = 58, bob = Math.round(sin(t * TAU) * 1.5), rage = !!o.rage, pose = o.pose;
  const gown = rage ? new Ramp(['#1a0a2a', '#3a1a5a', '#6a3a9a', '#9a6ac8', '#d8b8ff']) : new Ramp(['#5a2a6a', '#8e4a96', '#c878b0', '#f0a8c8', '#ffe8f0']);
  const gold = R.gold, glow = rage ? '#c060ff' : '#ffd8f0';
  // coral-palace shell behind her
  p.shape(R.coralPink, { dither: 0.5, texture: { seed: 6, p: 0.1 } }, (s) => { s.poly([[cx - 6, cy + 30], [cx - 30, cy + 6], [cx - 24, cy - 24], [cx - 10, cy - 44], [cx - 2, cy - 26], [cx + 8, cy - 40], [cx + 14, cy - 12], [cx + 6, cy + 30]]); });
  for (let k = 0; k < 5; k++) p.px(cx - 24 + k * 4, cy - 10 + (k % 2) * 8, '#ffe8a0');
  // tentacle hair
  for (let i = 0; i < 6; i++) { const a = -0.5 + i * 0.28, sw = sin(t * TAU + i) * 2; p.chain([[cx + 4, cy - 20 + bob], [cx - 6 - i * 3 + sw, cy - 22 - i + bob], [cx - 14 - i * 4 + sw, cy - 10 + i * 3 + bob]], 1.8, 0.7, rage ? R.abyssal : R.jelly, { outline: false, dither: 0.3 });
  }
  // gown / torso
  p.shape(gown, { dither: 0.5, texture: { seed: 3, p: 0.05 } }, (s) => { s.poly([[cx - 14, cy - 8 + bob], [cx + 14, cy - 8 + bob], [cx + 20, cy + 26], [cx - 20, cy + 26]]); });
  for (let k = 0; k < 4; k++) p.line(cx - 10 + k * 7, cy - 4 + bob, cx - 14 + k * 9, cy + 26, gown.c[1]);
  p.line(cx - 14, cy - 8 + bob, cx + 14, cy - 8 + bob, gold.c[3]); p.ellipse(cx, cy - 4 + bob, 3, 3, gold, { dither: 0 });
  // head, crown
  p.shape(new Ramp(['#6a4a5a', '#a87a8a', '#d8aab0', '#f8d8d0', '#fff0e8']), { dither: 0.4 }, (s) => s.ellipse(cx + 2, cy - 18 + bob, 8, 9));
  p.ellipse(cx + 5, cy - 18 + bob, 1.6, 2, R.void, { outline: false }); p.px(cx + 5, cy - 18 + bob, glow); p.px(cx - 1, cy - 18 + bob, glow);
  for (let k = 0; k < 5; k++) p.poly([[cx - 4 + k * 3.4, cy - 26 + bob], [cx - 3 + k * 3.4, cy - 36 - (k === 2 ? 6 : k % 2 * 2) + bob], [cx - 1.5 + k * 3.4, cy - 26 + bob]], gold, {});
  p.px(cx + 2, cy - 31 + bob, '#ffffff');
  // arms: scepter arm + pincer arm
  const th = pose === 'thrust' ? 14 : pose === 'cast' ? -8 : 0;
  p.chain([[cx + 12, cy - 4 + bob], [cx + 24 + th * 0.5, cy - 10 + bob], [cx + 32 + th, cy - 14 + bob]], 3, 2.2, gown, {});
  p.line(cx + 32 + th, cy - 40 + bob, cx + 32 + th, cy + 8 + bob, gold.c[2]); p.line(cx + 33 + th, cy - 40 + bob, cx + 33 + th, cy + 8 + bob, gold.c[3]);
  p.shape(R.glass, { dither: 0.3 }, (s) => s.ellipse(cx + 32.5 + th, cy - 44 + bob, 4, 5)); p.glow(cx + 32 + th, cy - 44 + bob, rage ? 11 : 8, glow, 0.7);
  claw(p, cx - 12, cy + 2 + bob, pose === 'cast' ? 0.8 : 0.3, pose === 'cast' ? 0.9 : 0.2, 0.6, 1.5, gown, true, { jaw: 1.1 });
  if (rage) for (let k = 0; k < 6; k++) p.px(cx - 16 + (k * 9) % 34, cy - 24 + (k * 13) % 50, '#d8a0ff');
};

// ---- Captain Rust (The Drowned Captain) -----------------------------------------------------------------------------------
PLANS.captain = (p, t, o) => {
  const cx = 60, cy = 52, bob = Math.round(sin(t * TAU) * 1.5), pose = o.pose, rage = !!o.rage;
  const bone = R.bone.tint(0, 0.5, 1.1), coat = rage ? new Ramp(['#0a1a2a', '#183448', '#2e5a74', '#4a88a0', '#8ad0e0']) : R.rust, ghost = R.ghost;
  // spectral lower body: tattered wisps
  for (let i = 0; i < 6; i++) { const a = sin(t * TAU + i * 1.1) * 3; p.chain([[cx - 10 + i * 4, cy + 12 + bob], [cx - 12 + i * 4 + a, cy + 28], [cx - 14 + i * 4 + a * 1.5, cy + 44]], 3.4, 0.6, ghost, { outline: false, dither: 0.6 }); }
  // coat + ribs
  p.shape(coat, { dither: 0.5, texture: { seed: 2, p: 0.06 } }, (s) => { s.poly([[cx - 16, cy - 8 + bob], [cx + 16, cy - 8 + bob], [cx + 20, cy + 20 + bob], [cx - 20, cy + 20 + bob]]); });
  for (let k = 0; k < 4; k++) { p.line(cx - 8, cy - 2 + k * 4 + bob, cx + 8, cy - 2 + k * 4 + bob, bone.c[3]); } p.line(cx, cy - 6 + bob, cx, cy + 14 + bob, bone.c[2]);
  for (let k = 0; k < 3; k++) { p.px(cx - 12 + k * 12, cy + 2, gold(1)); }
  // skull + hat
  p.shape(bone, { dither: 0.4 }, (s) => { s.ellipse(cx + 2, cy - 18 + bob, 8, 9); s.rect(cx - 3, cy - 12 + bob, 10, 5); });
  p.ellipse(cx - 1, cy - 19 + bob, 2, 2.4, R.void, { outline: false }); p.ellipse(cx + 6, cy - 19 + bob, 2, 2.4, R.void, { outline: false }); p.px(cx - 1, cy - 19 + bob, '#9affff'); p.px(cx + 6, cy - 19 + bob, '#9affff');
  for (let k = 0; k < 4; k++) p.px(cx - 1 + k * 2, cy - 11 + bob, '#05030a');
  p.shape(new Ramp(['#0a0a14', '#1a1a2a', '#2a2a40', '#44445a', '#6a6a80']), { dither: 0.3 }, (s) => { s.poly([[cx - 14, cy - 24 + bob], [cx + 18, cy - 24 + bob], [cx + 10, cy - 34 + bob], [cx - 6, cy - 34 + bob]]); }); p.line(cx - 14, cy - 24 + bob, cx + 18, cy - 24 + bob, gold(3));
  // lantern arm (left) with ghost-fire
  p.chain([[cx - 14, cy - 4 + bob], [cx - 24, cy + 2 + bob], [cx - 26, cy + 10 + bob]], 2.4, 1.8, coat, {}); p.glow(cx - 26, cy + 14 + bob, rage ? 14 : 9, '#9affff', 0.8); p.ellipse(cx - 26, cy + 14 + bob, 3, 3.5, R.glass, {});
  // anchor arm (right): pose decides the anchor angle
  const anchor = (ax, ay, ang) => { const dx = cos(ang), dy = sin(ang); const x2 = ax + dx * 34, y2 = ay + dy * 34; p.capsule(ax, ay, x2, y2, 2.2, 2.2, R.rust.tint(0, 0.7, 0.9), {}); p.ellipse(x2, y2, 3, 3, R.rust, {}); const px_ = -dy, py_ = dx; p.chain([[ax + dx * 8 + px_ * 9, ay + dy * 8 + py_ * 9], [ax + dx * 4, ay + dy * 4], [ax + dx * 8 - px_ * 9, ay + dy * 8 - py_ * 9]], 1.8, 1.8, R.rust, {}); p.chain([[x2 + px_ * 8 - dx * 8, y2 + py_ * 8 - dy * 8], [x2, y2], [x2 - px_ * 8 - dx * 8, y2 - py_ * 8 - dy * 8]], 2, 2, R.rust, {}); };
  const A = { idle: [cx + 14, cy + 2, 1.2], windup: [cx + 14, cy - 4, -1.5], swing: [cx + 14, cy - 2, 0.05], slam: [cx + 16, cy - 4, 1.35], roar: [cx + 14, cy - 4, -1.0] }[pose] || [cx + 14, cy + 2, 1.2];
  p.chain([[cx + 14, cy - 6 + bob], [A[0] + 4, A[1] + bob]], 2.6, 2.2, coat, {});
  anchor(A[0] + 4, A[1] + bob, A[2]);
  p.glow(cx, cy, 30, '#7affff', rage ? 0.25 : 0.12);
};
const gold = (i) => R.gold.hex[i];

// ---- The Lurelord (abyssal anglerfish) ----------------------------------------------------------------------------------------
PLANS.lurelord = (p, t, o) => {
  const cx = 76, cy = 62, pose = o.pose, open = pose === 'open' || pose === 'charge' || pose === 'roar' ? 1 : 0, sw = sin(t * TAU) * 3;
  const B = new Ramp(['#07060f', '#120e28', '#241c4a', '#3a2e72', '#5a4aa0']), F = B.tint(0.02, 1, 0.8);
  p.poly([[cx - 40, cy], [cx - 70, cy - 22 + sw], [cx - 64, cy + sw * 0.4], [cx - 70, cy + 22 + sw]], F, { dither: 0.4 });
  for (let i = 0; i < 6; i++) p.poly([[cx - 26 + i * 9, cy - 28], [cx - 22 + i * 9, cy - 40 - (i % 2) * 6], [cx - 16 + i * 9, cy - 28]], F, {});
  p.poly([[cx - 4, cy + 28], [cx - 14, cy + 44 - sw], [cx - 22, cy + 28]], F, {});
  p.shape(B, { dither: 0.5, texture: { seed: 12, p: 0.07 } }, (s) => { s.ellipse(cx, cy, 46, 33); });
  p.ellipse(cx + 2, cy + 20, 36, 10, new Ramp(['#2a2250', '#4a3e88', '#6a5ec0', '#8a80e0', '#b8b0ff']), { outline: false, dither: 0.3 });
  for (let i = 0; i < 12; i++) p.px(cx - 36 + (i * 17) % 70, cy - 20 + (i * 11) % 34, '#8a80e0');
  // jaws
  const jaw = open ? 20 : 3;
  p.shape(B, { dither: 0.4 }, (s) => s.poly([[cx + 6, cy + 4 + jaw], [cx + 52, cy + 6 + jaw * 1.2], [cx + 50, cy + 18 + jaw], [cx + 4, cy + 26 + jaw]]));
  p.shape(B, { dither: 0.4 }, (s) => s.poly([[cx + 6, cy - 14], [cx + 54, cy - 6], [cx + 52, cy + 2], [cx + 6, cy + 4]]));
  if (open) { p.poly([[cx + 10, cy + 4], [cx + 52, cy + 2], [cx + 50, cy + 6 + jaw], [cx + 6, cy + 4 + jaw]], new Ramp(['#2a0410', '#5a0a20', '#8a1030', '#c02040', '#ff4060']), {}); }
  for (let i = 0; i < 9; i++) { const tx = cx + 12 + i * 4.6; p.poly([[tx, cy + 3], [tx + 2.2, cy + 3 + 8 + (i % 2) * 3], [tx + 4, cy + 3]], R.bone, {}); if (open) p.poly([[tx + 1, cy + 5 + jaw], [tx + 3, cy - 4 + jaw], [tx + 5, cy + 5 + jaw]], R.bone, {}); }
  // eye
  const red = pose === 'charge';
  p.ellipse(cx + 26, cy - 16, 8, 8, new Ramp([red ? '#8a0a0a' : '#8a7a10', red ? '#d02a1a' : '#d8c020', '#fff6a0', '#ffffff', '#ffffff']), { dither: 0 }); p.rect(cx + 27, cy - 21, 2, 10, R.void, { outline: false, flat: 0 });
  p.glow(cx + 26, cy - 16, 12, red ? '#ff3a2a' : '#fff6a0', 0.4);
};

// ---- Krael, the Chained Titan (large ancient sea-scorpion) ------------------------------------------------------------------------------
PLANS.krael = (p, t, o) => {
  const S = 1, cx = 120, cy = 84, pose = o.pose, bob = Math.round(sin(t * TAU) * 2), br = o.broken || 0;
  const B = new Ramp(['#14101c', '#2e2438', '#54465e', '#847486', '#b8aabc']), F = B.tint(0, 1, 0.75), glow = '#ff7a3a';
  const tail = pose === 'tail' ? 1 : pose === 'windup' ? -1 : 0;
  const tailPts = [[cx - 70, cy + 6], [cx - 98, cy + 8], [cx - 118, cy - 6 + tail * 12], [cx - 124, cy - 34 + tail * 26], [cx - 104, cy - 58 + tail * 36]];
  p.chain(tailPts, 12, 4, B, { dither: 0.5 });
  const tp = tailPts[4]; p.poly([[tp[0] - 6, tp[1] + 2], [tp[0] + 22, tp[1] - 22 - tail * 6], [tp[0] + 4, tp[1] - 2]], R.coralOrange, {}); p.glow(tp[0] + 20, tp[1] - 20, 12, glow, 0.5);
  // far claw arm
  const cl = pose === 'smash' ? 1 : pose === 'windup' ? -1 : 0;
  p.chain([[cx + 28, cy - 4], [cx + 62, cy - 14 + cl * 20], [cx + 88, cy + 4 + cl * 30]], 9, 7, F, {});
  for (let i = 5; i >= 0; i--) { const sx = cx - 62 + i * 22, rx = 22 - Math.abs(i - 2.5) * 1.6, ry = 28 - Math.abs(i - 2) * 2.2; p.shape(i % 2 ? B : B.tint(0, 1, 0.9), { dither: 0.5, texture: { seed: i + 1, p: 0.05 } }, (s) => s.ellipse(sx, cy + bob, rx, ry)); p.line(sx - 8, cy - ry + 6 + bob, sx - 8, cy + ry - 6 + bob, B.c[1]); p.px(sx - 9, cy - ry + 7 + bob, B.c[4]); }
  for (let i = 0; i < 5; i++) { const lx = cx - 50 + i * 24, wav = sin(t * TAU + i) * 4; p.chain([[lx, cy + 22 + bob], [lx - 6, cy + 38 + wav], [lx - 14, cy + 50 + wav]], 5, 3, F, { outline: false }); }
  p.shape(B, { dither: 0.5, texture: { seed: 9, p: 0.05 } }, (s) => { s.ellipse(cx + 58, cy - 2 + bob, 36, 28); });
  p.poly([[cx + 30, cy - 22 + bob], [cx + 58, cy - 54 + bob], [cx + 78, cy - 20 + bob]], F, {}); p.line(cx + 58, cy - 52 + bob, cx + 58, cy - 24 + bob, B.c[4]);
  for (const ex of [cx + 46, cx + 70]) { p.ellipse(ex, cy - 14 + bob, 8, 9, new Ramp(['#8a2a0a', '#d85a1a', '#ffb070', '#fff0d0', '#ffffff']), { dither: 0 }); p.ellipse(ex + 2, cy - 12 + bob, 3, 4, R.void, { outline: false }); }
  p.glow(cx + 58, cy - 14 + bob, 22, glow, pose === 'gaze' ? 0.7 : 0.3);
  // chains: four glowing shackle-chains to the floor/walls; broken ones hang limp
  const ch = [[cx - 10, cy + 18, 20, 150], [cx + 40, cy + 24, 60, 156], [cx + 90, cy + 20, 150, 150], [cx + 20, cy - 24, 40, 6]];
  ch.forEach(([x, y, ex, ey], i) => { const gone = i < br; for (let k = 0; k < 11; k++) { const u = k / 10, xx = x + (ex - x) * u + (gone ? Math.sin(k) * 3 : 0), yy = y + (ey - y) * u * (gone ? 0.5 : 1) + (gone ? u * u * 20 : 0); p.ellipse(xx, yy, 2.6, 1.8, gone ? R.chain : new Ramp(['#2a1a08', '#8a4a10', '#ffa030', '#ffd870', '#ffffff']), { outline: !gone }); } });
  claw(p, cx + 74, cy + 8 + bob, pose === 'smash' ? 1 : 0.4, pose === 'smash' ? -0.8 : pose === 'windup' ? 1 : 0.1, 0.5, 6.5, B, false, { jaw: 1.2, palm: 1.1, edge: '#f8f0d8' });
};

// ---- Kyros the Unsleeping (triton guardian) ---------------------------------------------------------------------------------------
PLANS.kyros = (p, t, o) => {
  const cx = 52, base = 100, bob = Math.round(sin(t * TAU) * 1), pose = o.pose, rage = !!o.rage;
  const M = rage ? new Ramp(['#0a2a3a', '#14506a', '#2a8ab0', '#6ad0e8', '#d0ffff']) : R.divine, G = R.trident;
  // tail
  p.chain([[cx, base - 44 + bob], [cx - 12, base - 22], [cx + 4, base - 6], [cx - 8, base + 6]], 11, 5, M.tint(0, 0.8, 0.8), { dither: 0.5 });
  p.poly([[cx - 8, base + 4], [cx - 26, base + 14 + sin(t * TAU) * 3], [cx - 12, base - 2], [cx - 30, base - 10 + sin(t * TAU) * 3]], M, {});
  // torso
  p.shape(M, { dither: 0.4 }, (s) => { s.poly([[cx - 16, base - 82 + bob], [cx + 16, base - 82 + bob], [cx + 12, base - 42 + bob], [cx - 12, base - 42 + bob]]); });
  p.shape(G, { dither: 0.3 }, (s) => { s.poly([[cx - 12, base - 78 + bob], [cx + 12, base - 78 + bob], [cx + 8, base - 54 + bob], [cx - 8, base - 54 + bob]]); }); p.line(cx, base - 76 + bob, cx, base - 56 + bob, G.c[4]);
  p.shape(M, { dither: 0.4 }, (s) => { s.ellipse(cx - 18, base - 80 + bob, 9, 7); s.ellipse(cx + 18, base - 80 + bob, 9, 7); }); for (const sx of [-1, 1]) p.poly([[cx + sx * 18 - 3, base - 85 + bob], [cx + sx * 18, base - 96 + bob], [cx + sx * 18 + 3, base - 85 + bob]], G, {});
  // head + helm
  p.shape(M, { dither: 0.3 }, (s) => { s.ellipse(cx, base - 94 + bob, 11, 12); }); p.rect(cx - 8, base - 96 + bob, 16, 4, R.void, { outline: false, flat: 0 }); p.px(cx - 4, base - 94 + bob, '#9affff'); p.px(cx + 3, base - 94 + bob, '#9affff');
  p.poly([[cx - 4, base - 104 + bob], [cx, base - 120 + bob], [cx + 4, base - 104 + bob]], G, {}); p.poly([[cx - 10, base - 100 + bob], [cx - 22, base - 106 + bob + sin(t * TAU) * 2], [cx - 8, base - 94 + bob]], M, {});
  // shield arm
  const guard = pose === 'guard';
  p.chain([[cx - 14, base - 76 + bob], [cx - 24, base - 64 + bob], [cx - 22 + (guard ? 18 : 0), base - 56 + bob]], 5, 4, M, {});
  p.shape(R.steel, { dither: 0.3 }, (s) => s.ellipse(cx - 22 + (guard ? 26 : 0), base - 62 + bob, guard ? 9 : 7, guard ? 20 : 15)); p.glow(cx - 22 + (guard ? 26 : 0), base - 62 + bob, 10, '#9af0ff', 0.4);
  // trident arm
  const T0 = { idle: [18, -70, -1.55], windup: [4, -74, -2.6], thrust: [34, -70, 0], guard: [14, -66, -1.2], throw: [30, -80, -0.4], spin: [20, -72, -0.8], cast: [10, -90, -1.57] }[pose] || [18, -70, -1.55];
  p.chain([[cx + 14, base - 76 + bob], [cx + T0[0] * 0.6 + 8, base + T0[1] * 0.9 + bob], [cx + T0[0] + 6, base + T0[1] + bob]], 5, 4, M, {});
  const hx = cx + T0[0] + 6, hy = base + T0[1] + bob, dx = cos(T0[2]), dy = sin(T0[2]);
  p.capsule(hx - dx * 22, hy - dy * 22, hx + dx * 46, hy + dy * 46, 1.5, 1.5, G, {});
  const ex = hx + dx * 46, ey = hy + dy * 46, nx = -dy, ny = dx;
  p.poly([[ex - nx * 7, ey - ny * 7], [ex - nx * 7 + dx * 12, ey - ny * 7 + dy * 12], [ex - nx * 5 + dx * 3, ey - ny * 5 + dy * 3]], G, {}); p.poly([[ex + nx * 7, ey + ny * 7], [ex + nx * 7 + dx * 12, ey + ny * 7 + dy * 12], [ex + nx * 5 + dx * 3, ey + ny * 5 + dy * 3]], G, {}); p.poly([[ex - nx * 2, ey - ny * 2], [ex + dx * 18, ey + dy * 18], [ex + nx * 2, ey + ny * 2]], G, {});
  p.glow(ex + dx * 14, ey + dy * 14, 10, '#9af0ff', pose === 'thrust' || pose === 'throw' ? 0.7 : 0.35);
};

// ---- Poseidon ----------------------------------------------------------------------------------------------------------------------------
PLANS.poseidon = (p, t, o) => {
  const cx = 100, cy = 104, pose = o.pose, ph = o.phase || 0, bob = Math.round(sin(t * TAU) * 2), ph2 = ph >= 2;
  const ARM = ph === 0 ? new Ramp(['#0e3a4e', '#1e6a82', '#38a0b8', '#78d8d8', '#d8fff4']) : ph === 1 ? new Ramp(['#10202e', '#1e3e58', '#34688a', '#68a4c8', '#c0e4ff']) : ph === 2 ? new Ramp(['#04060c', '#0a1a2e', '#123a58', '#1e6a8a', '#40c0d0']) : new Ramp(['#8a7a4a', '#d8b860', '#ffe890', '#fff6c0', '#ffffff']);
  const SKIN = ph2 ? new Ramp(['#04060c', '#0a2030', '#124a5e', '#2a8a9a', '#7ae8e8']) : R.pearl.tint(0.0, 0.6, 0.95);
  const GOLD = ph === 3 ? new Ramp(['#ffffff', '#fff6c0', '#fff6c0', '#ffffff', '#ffffff']) : R.trident, glow = ph === 3 ? '#fff6c0' : ph2 ? '#40e0ff' : ph === 1 ? '#b0e0ff' : '#9af0e0';
  const TIDE = ph === 3 ? new Ramp(['#a89048', '#e8d080', '#fff0b0', '#fffbe0', '#ffffff']) : ph === 2 ? new Ramp(['#020a12', '#06222e', '#0e4258', '#1a7088', '#38c0d0']) : R.divine;
  // aura
  p.glow(cx, cy - 10, ph === 3 ? 90 : 70, glow, ph === 3 ? 0.35 : 0.18, 6);
  // tide-cape (streaming behind) and a coiling spout for a lower body
  for (let i = 0; i < 6; i++) { const y0 = cy - 40 + i * 9, sw = sin(t * TAU + i * 0.9) * 5; p.chain([[cx - 24, y0 + bob], [cx - 52 + sw, y0 + 6], [cx - 78 + sw * 1.5, y0 + 22 + i * 2], [cx - 96 + sw, y0 + 40 + i * 3]], 6.5 - i * 0.5, 1, TIDE, { outline: false, dither: 0.6, bias: -0.1 }); }
  p.chain([[cx, cy + 4 + bob], [cx - 6 + sin(t * TAU) * 3, cy + 38], [cx + 8 - sin(t * TAU) * 3, cy + 70], [cx - 4, cy + 98]], 26, 2, TIDE, { dither: 0.6, bias: -0.1 });
  for (let k = 0; k < 5; k++) p.ellipse(cx - 12 + k * 6 + sin(t * TAU + k) * 2, cy + 30 + k * 12, 4, 1.6, ph2 ? R.divine : R.pearl, { outline: false, dither: 0 });
  // torso
  p.shape(ARM, { dither: 0.5, texture: { seed: 5, p: 0.05 } }, (s) => { s.poly([[cx - 30, cy - 46 + bob], [cx + 30, cy - 46 + bob], [cx + 24, cy + 10 + bob], [cx - 24, cy + 10 + bob]]); });
  p.shape(SKIN, { dither: 0.5 }, (s) => s.poly([[cx - 12, cy - 44 + bob], [cx + 12, cy - 44 + bob], [cx + 8, cy - 4 + bob], [cx - 8, cy - 4 + bob]]));
  for (let k = 0; k < 4; k++) p.line(cx - 22 + k * 15, cy - 40 + bob, cx - 18 + k * 12, cy + 6 + bob, ARM.c[1]);
  p.line(cx - 28, cy - 30 + bob, cx + 28, cy - 30 + bob, GOLD.c[3]); p.line(cx - 24, cy - 4 + bob, cx + 24, cy - 4 + bob, GOLD.c[3]);
  p.ellipse(cx, cy - 12 + bob, 5, 5, ph === 3 ? GOLD : new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']), { dither: 0 }); p.glow(cx, cy - 12 + bob, 12, glow, 0.5);
  if (ph2) for (let k = 0; k < 7; k++) { p.line(cx - 24 + k * 8, cy - 40 + bob, cx - 20 + k * 8, cy - 14 + (k % 3) * 8 + bob, '#7ae8e8'); }
  // pauldrons
  for (const sx of [-1, 1]) { p.shape(ARM, { dither: 0.4 }, (s) => s.ellipse(cx + sx * 34, cy - 44 + bob, 15, 11)); for (let k = 0; k < 3; k++) p.poly([[cx + sx * (26 + k * 8) - 3, cy - 53 + bob], [cx + sx * (28 + k * 8), cy - 66 + bob - k * 2], [cx + sx * (30 + k * 8) + 3, cy - 53 + bob]], GOLD, {}); }
  // head: beard of water, crown
  const hy = cy - 66 + bob;
  for (let i = 0; i < 5; i++) { const sw = sin(t * TAU + i) * 2; p.chain([[cx - 8 + i * 4, hy + 8], [cx - 10 + i * 4 + sw, hy + 24], [cx - 12 + i * 5 + sw, hy + 40]], 3.2, 0.8, ph2 ? R.divine : R.pearl, { outline: false, dither: 0.4 }); }
  p.shape(SKIN, { dither: 0.4 }, (s) => s.ellipse(cx, hy, 13, 15));
  for (const ex of [-6, 6]) { p.rect(cx + ex - 3, hy - 6, 6, 3, R.void, { outline: false, flat: 0 }); p.px(cx + ex - 1, hy - 5, glow); p.px(cx + ex, hy - 5, '#ffffff'); }
  p.line(cx - 9, hy - 9, cx - 2, hy - 7, '#05030a'); p.line(cx + 9, hy - 9, cx + 2, hy - 7, '#05030a');
  // hair
  for (let i = 0; i < 7; i++) { const a = -2.4 + i * 0.4, sw = sin(t * TAU + i) * 3; p.chain([[cx + cos(a) * 10, hy - 6 + sin(a) * 8], [cx + cos(a) * 22 + sw, hy - 14 + sin(a) * 18], [cx + cos(a) * 32 + sw * 1.5, hy - 6 + sin(a) * 30 - (ph >= 1 ? 8 : 0)]], 3, 1, ph2 ? R.pearl : R.divine, { outline: false, dither: 0.4 }); }
  for (let i = 0; i < 7; i++) { const sx = cx - 12 + i * 4, hh = 12 + (i === 3 ? 10 : (i % 2) * 4) + (ph2 ? -5 + (i % 3) * 3 : 0); p.poly([[sx - 2, hy - 10], [sx + 0.5, hy - 10 - hh], [sx + 3, hy - 10]], GOLD, {}); } p.line(cx - 13, hy - 10, cx + 13, hy - 10, GOLD.c[1]);
  // left arm (orb hand)
  const castUp = pose === 'cast' || pose === 'roar';
  p.chain([[cx - 30, cy - 40 + bob], [cx - 50, cy - 34 - (castUp ? 30 : 0) + bob], [cx - 58, cy - 18 - (castUp ? 50 : 0) + bob]], 8, 6, ARM, {});
  p.shape(SKIN, { dither: 0.4 }, (s) => s.ellipse(cx - 60, cy - 16 - (castUp ? 50 : 0) + bob, 7, 7)); p.glow(cx - 60, cy - 22 - (castUp ? 52 : 0) + bob, 14, glow, 0.7); p.ellipse(cx - 60, cy - 24 - (castUp ? 52 : 0) + bob, 5, 5, new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']), { dither: 0 });
  // trident arm
  const Tr = { idle: [44, -22, -1.5], thrust: [60, -34, 0], raise: [44, -60, -1.57], slam: [48, -40, 1.5], cast: [48, -70, -1.57], roar: [48, -70, -1.57], sweep: [58, -30, -0.3] }[pose] || [44, -22, -1.5];
  p.chain([[cx + 30, cy - 40 + bob], [cx + 46, cy - 36 + bob], [cx + Tr[0], cy + Tr[1] + bob]], 8, 6, ARM, {});
  p.shape(SKIN, { dither: 0.4 }, (s) => s.ellipse(cx + Tr[0], cy + Tr[1] + bob, 7, 7));
  const hx = cx + Tr[0], hy2 = cy + Tr[1] + bob, dx = cos(Tr[2]), dy = sin(Tr[2]), nx = -dy, ny = dx;
  p.capsule(hx - dx * 36, hy2 - dy * 36, hx + dx * 70, hy2 + dy * 70, 2.2, 2.2, GOLD, {});
  const ex = hx + dx * 70, ey = hy2 + dy * 70;
  p.shape(GOLD, { dither: 0.3 }, (s) => { s.poly([[ex - nx * 13, ey - ny * 13], [ex - nx * 13 + dx * 26, ey - ny * 13 + dy * 26], [ex - nx * 9 + dx * 6, ey - ny * 9 + dy * 6]]); s.poly([[ex + nx * 13, ey + ny * 13], [ex + nx * 13 + dx * 26, ey + ny * 13 + dy * 26], [ex + nx * 9 + dx * 6, ey + ny * 9 + dy * 6]]); s.poly([[ex - nx * 3, ey - ny * 3], [ex + dx * 34, ey + dy * 34], [ex + nx * 3, ey + ny * 3]]); s.capsule(ex - nx * 13, ey - ny * 13, ex + nx * 13, ey + ny * 13, 2, 2); });
  p.glow(ex + dx * 22, ey + dy * 22, ph === 3 ? 16 : 12, glow, 0.7);
  // restraints: chains from wrists to the canvas edges until phase 2 (then broken links hang)
  const cp = [[cx - 58, cy - 8 + bob, 0, 40], [cx + Tr[0], cy + Tr[1] + 8 + bob, 199, 40], [cx - 20, cy + 60, 10, 190], [cx + 20, cy + 60, 190, 190]];
  cp.forEach(([x, y, ex2, ey2], i) => { for (let k = 0; k < 9; k++) { const u = k / 8, broken = ph2, xx = x + (ex2 - x) * u * (broken ? 0.25 : 1), yy = y + (ey2 - y) * u * (broken ? 0.3 : 1) + (broken ? u * u * 30 : 0); p.ellipse(xx, yy, 3, 2, ph2 ? R.chain : new Ramp(['#06161e', '#1a4a5a', '#40a0b0', '#9af0e0', '#ffffff']), { outline: true }); } });
};

// ---- The Hollow Maw (void horror) ------------------------------------------------------------------------------------------------------
PLANS.maw = (p, t, o) => {
  const cx = 88, cy = 70, pose = o.pose, open = pose === 'open' || pose === 'roar' || pose === 'charge' ? 1 : 0, pul = sin(t * TAU) * 2;
  for (let i = 0; i < 9; i++) { const a = -Math.PI + i * 0.4, sw = sin(t * TAU + i) * 5; p.chain([[cx + cos(a) * 30, cy + sin(a) * 24], [cx + cos(a) * 52 + sw, cy + sin(a) * 40], [cx + cos(a) * 74 + sw * 1.5, cy + sin(a) * 56 + 6]], 7, 1.5, R.void, { dither: 0.5 }); }
  p.shape(R.void, { dither: 0.5, texture: { seed: 3, p: 0.08 } }, (s) => s.ellipse(cx, cy, 44 + pul, 36 + pul));
  const mouth = open ? 22 : 8; p.ellipse(cx, cy + 8, 26, mouth, new Ramp(['#000000', '#05010a', '#10041e', '#240a3a', '#3a1058']), { dither: 0.2 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, tx = cx + cos(a) * 26, ty = cy + 8 + sin(a) * mouth; p.poly([[tx - 2, ty], [tx + cos(a + 3.14) * 9, ty + sin(a + 3.14) * 9], [tx + 2, ty]], R.bone, {}); }
  for (const [ex, ey, r] of [[cx - 26, cy - 14, 6], [cx + 24, cy - 16, 7], [cx, cy - 26, 8], [cx - 36, cy + 6, 4], [cx + 38, cy + 2, 4]]) { p.ellipse(ex, ey, r, r, new Ramp(['#400a60', '#8a30c8', '#d8a0ff', '#ffffff', '#ffffff']), { dither: 0 }); p.ellipse(ex + 1, ey, r * 0.4, r * 0.7, R.void, { outline: false }); p.glow(ex, ey, r + 6, '#c060ff', 0.4); }
  p.glow(cx, cy, 70, '#8a30c8', 0.2, 5);
};

// ---- Pearl Tyrant (giant clam) ------------------------------------------------------------------------------------------------------------------
PLANS.tyrant = (p, t, o) => {
  const cx = 60, cy = 62, pose = o.pose, open = pose === 'open' || pose === 'spray' ? 1 : pose === 'slam' ? 0 : 0;
  const S = new Ramp(['#2a1a3a', '#5a3a6a', '#9a6a98', '#d89ac0', '#ffd8e8']);
  p.shape(S, { dither: 0.5, texture: { seed: 4, p: 0.06 } }, (s) => s.ellipse(cx, cy + 10, 42, 22));
  p.ellipse(cx, cy + 6, 36, 14, new Ramp(['#5a0a2a', '#9a1a4a', '#d8407a', '#ff80a8', '#ffc8d8']), { outline: true, dither: 0.3 });
  p.ellipse(cx, cy + 6, 11, 11, R.pearl, { dither: 0.2 }); p.px(cx - 3, cy + 2, '#ffffff'); p.glow(cx, cy + 6, open ? 26 : 14, '#ffd8f0', open ? 0.6 : 0.3);
  const lift = open ? 26 : 2;
  p.shape(S, { dither: 0.5, texture: { seed: 8, p: 0.06 } }, (s) => s.poly([[cx - 46, cy + 2], [cx - 36, cy - 24 - lift], [cx, cy - 34 - lift], [cx + 36, cy - 24 - lift], [cx + 46, cy + 2], [cx, cy - 6 - lift * 0.2]]));
  for (let k = 0; k < 6; k++) p.line(cx, cy - 6 - lift * 0.2, cx - 40 + k * 16, cy - 26 - lift + (k % 2) * 3, S.c[1]);
  for (let i = 0; i < 12; i++) { const x = cx - 40 + i * 7; p.poly([[x, cy + 2], [x + 3.5, cy - 4 - (i % 2) * 3], [x + 7, cy + 2]], R.bone, {}); }
  for (const ex of [cx - 22, cx + 22]) { p.ellipse(ex, cy - 14 - lift * 0.5, 4, 4, R.eyeWhite, { dither: 0 }); p.px(ex + 1, cy - 14 - lift * 0.5, '#170d1c'); p.line(ex - 5, cy - 19 - lift * 0.5, ex + 4, cy - 17 - lift * 0.5, '#170d1c'); }
};
