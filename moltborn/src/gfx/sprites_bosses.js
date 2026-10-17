// Boss body plans (large, hand-composed from painter primitives). Registered into PLANS for enemyFrame().
import { PLANS } from './sprites_enemies.js';
import { claw, legsPose, eye } from './sprites_player.js';
import { legs as kitLegs, claw as kitClaw, eyeStalk as kitEye, shell as kitShell } from './crab_kit.js';
import { Ramp } from './painter.js';
import { R } from './palette.js';

const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos;
const ROCK = new Ramp(['#1e1a12', '#3e3622', '#665a34', '#8e8050', '#c4b678']);
const ROCKFAR = new Ramp(['#12100a', '#2a2416', '#463e24', '#625634', '#8a7c50']);

PLANS.grumbold = (p, t, o) => {
  const pose = o.pose, rage = !!o.rage, cx = 64, by = 50 + (pose === 'idle' ? Math.round(sin(t * TAU)) : pose === 'stagger' ? 6 : pose === 'windup' ? 3 : 0);
  const C = { idle: { ext: 0.3, lift: 0.2, open: 0.3 }, walk: { ext: 0.4, lift: 0.1, open: 0.3 }, windup: { ext: -0.2, lift: 1, open: 1 }, swipe: { ext: 1, lift: -0.1, open: 0.5 }, slam: { ext: 0.7, lift: -0.9, open: 0.2 }, charge: { ext: 0.2, lift: 0, open: 0 }, stagger: { ext: 0, lift: -0.6, open: 0.8 }, roar: { ext: 0.2, lift: 1, open: 1 }, toss: { ext: 0.2, lift: 1, open: 0.2 } }[pose] || { ext: 0.3, lift: 0.2, open: 0.3 };
  const pl = { legs: pose === 'charge' || pose === 'walk' ? 'walk' : 'idle', legT: t, squash: pose === 'stagger' ? 0.6 : 0 }, sq = pl.squash;
  const body = rage ? ROCK.tint(-0.03, 1.2, 1.0) : ROCK, far = rage ? ROCKFAR.tint(-0.03, 1.2, 1) : ROCKFAR;
  // far legs and claw
  kitLegs(p, pl, { n: 4, hipX: cx - 24, hipY: by + 12, footY: 84, span: 46, splay: 12, ramp: far, tip: far.c[3], r0: 4.2, r1: 2.2, kneeUp: 10, kneeOut: 12 });
  kitClaw(p, cx + 24, by - 2, C.ext * 0.8, C.lift * 0.8 + 0.2, C.open, 3.1, far, true, { jaw: 1.1, palm: 1.2 });
  // the hoard: shiny rocks, glass and a stolen pearl stuck all over his back
  kitShell(p, cx, by, 35, 23 - sq * 5, body, { seed: 4, plates: 5, spots: 4, ridge: 12, belly: true, bellyRamp: new Ramp(['#3a2e20', '#5a4a30', '#8a7650', '#b4a070', '#d8c898']), grain: 0.1, front: true });
  const GEM = [R.coralBlue, R.coralPink, R.coralOrange, R.glass, R.pearl, R.coralRed, R.coralBlue, R.pearl];
  [[-22, -6, 3.4], [-10, -14, 3], [12, -15, 3.2], [22, -3, 3.4], [-26, 6, 2.6], [4, 5, 3], [16, 8, 2.6], [-15, 8, 2.6]].forEach(([gx, gy, r], i) => { p.shape(GEM[i % GEM.length], { dither: 0.3 }, (s2) => s2.ellipse(cx + gx, by + gy, r, r * 0.85)); p.px(cx + gx - 1, by + gy - 1, '#ffffff'); });
  for (let i = 0; i < 12; i++) p.px(cx - 26 + (i * 13) % 54, by - 10 + (i * 7) % 20, '#4a8a3a');   // kelp bits
  p.chain([[cx - 18, by - 17], [cx - 26, by - 6 + Math.round(sin(t * TAU) * 1.5)], [cx - 30, by + 8]], 2.4, 1, R.seaweed, { dither: 0.4 });
  // Brine Core: the weak point
  const coreGlow = pose === 'stagger' ? 1 : 0.5 + (rage ? 0.4 : 0) + 0.2 * sin(t * TAU);
  p.glow(cx - 1, by - 18, 13, '#ff9ad8', 0.5 * coreGlow); p.shape(R.coralPink, { dither: 0.2 }, (s2) => s2.poly([[cx - 6, by - 14], [cx - 1, by - 25], [cx + 5, by - 14], [cx, by - 10]])); p.px(cx - 1, by - 20, '#ffffff'); p.px(cx, by - 18, '#ffd8f0');
  if (rage) for (let k = 0; k < 6; k++) { p.line(cx - 18 + k * 7, by - 8, cx - 15 + k * 7, by + 2 + (k % 2) * 4, '#ff8a2a'); p.px(cx - 17 + k * 7, by - 4, '#ffe08a'); }
  // near legs
  kitLegs(p, pl, { n: 4, hipX: cx - 26, hipY: by + 15, footY: 84, span: 50, splay: 13, ramp: body, tip: body.c[4], r0: 5, r1: 2.6, kneeUp: 10, kneeOut: 13, bias: -0.1 });
  // angry eyes on thick stalks
  const ey = by - 25 + sq * 6, ball = new Ramp(['#8a1010', '#c8301a', '#ffd84a', '#fff6a8', '#ffffff']);
  kitEye(p, cx + 14, ey - 2, by - 18, { stalk: far.c[2], thick: true, r: 5, ball, pupil: '#170d1c' }); kitEye(p, cx + 26, ey + 1, by - 16, { stalk: far.c[2], thick: true, r: 5, ball, pupil: '#170d1c' });
  p.line(cx + 9, ey - 5, cx + 18, ey - 2, '#170d1c'); p.line(cx + 29, ey - 5, cx + 21, ey - 2, '#170d1c');
  // tusks and mandibles
  p.poly([[cx + 26, by + 5], [cx + 33, by + 14], [cx + 22, by + 10]], R.bone, {}); p.poly([[cx + 18, by + 8], [cx + 20, by + 17], [cx + 13, by + 11]], R.bone, {});
  kitClaw(p, cx + 27, by + 2, C.ext, C.lift + 0.1, C.open, 3.7, body, false, { jaw: 1.1, palm: 1.15, edge: body.c[4] });
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
  const bone = R.bone.tint(0, 0.5, 1.1), coat = rage ? new Ramp(['#0a1a2a', '#183448', '#2e5a74', '#4a88a0', '#8ad0e0']) : R.rust, ghost = R.ghost, G = R.gold;
  const flame = rage ? '#7affff' : '#9affff', HAT = new Ramp(['#0a0a14', '#1a1a2a', '#2a2a40', '#44445a', '#6a6a80']);
  // spectral lower body: a column of tattered, glowing mist with a ship's chain drifting through it
  p.glow(cx, cy + 22, 34, flame, rage ? 0.22 : 0.12, 5);
  for (let i = 0; i < 7; i++) { const a = sin(t * TAU + i * 1.1) * 3; p.chain([[cx - 13 + i * 4.4, cy + 12 + bob], [cx - 15 + i * 4.4 + a, cy + 28], [cx - 18 + i * 4.4 + a * 1.5, cy + 46 - (i % 3) * 3]], 3.6, 0.6, ghost, { outline: false, dither: 0.6, bias: 0.05 }); }
  for (let k = 0; k < 9; k++) { const yy = cy + 20 + k * 3, xx = cx - 8 + sin(t * TAU + k * 0.7) * 6; p.ellipse(xx, yy, 1.8, 1.2, R.chain, { dither: 0.2 }); }
  // coat: long tails, double row of buttons, collar, bandolier and belt
  p.shape(coat, { dither: 0.5, texture: { seed: 2, p: 0.06 } }, (s2) => { s2.poly([[cx - 13, cy - 9 + bob], [cx + 13, cy - 9 + bob], [cx + 19, cy + 22 + bob], [cx + 10, cy + 27 + bob], [cx, cy + 20 + bob], [cx - 10, cy + 27 + bob], [cx - 19, cy + 22 + bob]]); });
  p.line(cx, cy - 8 + bob, cx, cy + 20 + bob, coat.c[1]);
  for (let k = 0; k < 4; k++) { p.px(cx - 3, cy - 3 + k * 5 + bob, G.c[3]); p.px(cx + 3, cy - 3 + k * 5 + bob, G.c[3]); }
  p.line(cx - 12, cy - 8 + bob, cx + 10, cy + 16 + bob, coat.c[1]); p.line(cx - 12, cy - 7 + bob, cx + 10, cy + 17 + bob, coat.c[3]);
  p.line(cx - 16, cy + 14 + bob, cx + 16, cy + 14 + bob, '#170d1c'); p.rect(cx - 3, cy + 12 + bob, 6, 4, G, { dither: 0 });
  for (let k = 0; k < 6; k++) { p.px(cx - 18 + k * 7, cy + 22 + (k % 2) * 2 + bob, ghost.c[3]); p.line(cx - 18 + k * 7, cy + 22 + bob, cx - 18 + k * 7, cy + 26 + (k % 3) + bob, '#2a6a3a'); }   // weeds
  p.poly([[cx - 12, cy - 11 + bob], [cx - 3, cy - 6 + bob], [cx - 9, cy - 3 + bob]], coat.tint(0, 1, 1.25), {}); p.poly([[cx + 12, cy - 11 + bob], [cx + 3, cy - 6 + bob], [cx + 9, cy - 3 + bob]], coat.tint(0, 1, 1.25), {});
  // epaulettes
  for (const sx of [-1, 1]) { p.shape(G, { dither: 0.3 }, (s2) => s2.ellipse(cx + sx * 14, cy - 8 + bob, 4.5, 3)); for (let k = 0; k < 3; k++) p.px(cx + sx * 14 - 2 + k * 2, cy - 5 + bob, G.c[2]); }
  // skull: jaw, sockets burning with ghost-fire
  p.shape(bone, { dither: 0.4 }, (s2) => { s2.ellipse(cx + 2, cy - 19 + bob, 8.5, 9); s2.rect(cx - 3, cy - 12 + bob, 11, 5); });
  p.ellipse(cx - 1, cy - 19 + bob, 2.4, 2.8, R.void, { outline: false }); p.ellipse(cx + 6, cy - 19 + bob, 2.4, 2.8, R.void, { outline: false });
  p.px(cx - 1, cy - 19 + bob, flame); p.px(cx + 6, cy - 19 + bob, flame); p.px(cx - 1, cy - 20 + bob, '#ffffff'); p.px(cx + 6, cy - 20 + bob, '#ffffff'); p.glow(cx + 2, cy - 19 + bob, 14, flame, 0.22);
  p.px(cx + 2, cy - 16 + bob, '#05030a'); p.px(cx + 3, cy - 16 + bob, '#05030a');
  for (let k = 0; k < 5; k++) { p.px(cx - 2 + k * 2, cy - 11 + bob, '#05030a'); p.px(cx - 2 + k * 2, cy - 10 + bob, bone.c[4]); }
  // tricorn hat with a skull badge, feather and barnacles
  p.shape(HAT, { dither: 0.3 }, (s2) => { s2.poly([[cx - 18, cy - 24 + bob], [cx + 22, cy - 24 + bob], [cx + 12, cy - 35 + bob], [cx - 8, cy - 35 + bob]]); });
  p.poly([[cx - 18, cy - 24 + bob], [cx - 24, cy - 28 + bob], [cx - 10, cy - 28 + bob]], HAT, {}); p.poly([[cx + 22, cy - 24 + bob], [cx + 28, cy - 29 + bob], [cx + 14, cy - 28 + bob]], HAT, {});
  p.line(cx - 15, cy - 25 + bob, cx + 20, cy - 25 + bob, G.c[3]); p.px(cx + 2, cy - 30 + bob, bone.c[4]); p.px(cx + 1, cy - 30 + bob, bone.c[4]); p.px(cx + 3, cy - 30 + bob, bone.c[4]); p.px(cx + 2, cy - 29 + bob, '#05030a');
  p.chain([[cx + 14, cy - 33 + bob], [cx + 22, cy - 42 + bob + Math.round(sin(t * TAU) * 1)], [cx + 28, cy - 38 + bob]], 1.8, 0.6, rage ? R.divine : R.coralRed, { outline: false });
  for (let k = 0; k < 4; k++) p.px(cx - 8 + k * 6, cy - 33 + (k % 2) + bob, ghost.c[4]);
  // lantern arm (left): a cage of ghost-fire
  p.chain([[cx - 12, cy - 6 + bob], [cx - 23, cy + 1 + bob], [cx - 27, cy + 9 + bob]], 3.2, 2.4, coat, {});
  p.glow(cx - 27, cy + 15 + bob, rage ? 16 : 11, flame, 0.8); p.shape(R.glass, { dither: 0.3 }, (s2) => s2.ellipse(cx - 27, cy + 15 + bob, 3.6, 4.4)); p.line(cx - 31, cy + 11 + bob, cx - 23, cy + 11 + bob, '#170d1c'); p.px(cx - 27, cy + 14 + bob, '#ffffff');
  // anchor arm (right): the pose decides the swing
  const anchor = (ax, ay, ang) => {
    const dx = cos(ang), dy = sin(ang), nx = -dy, ny = dx, x2 = ax + dx * 36, y2 = ay + dy * 36, IR = R.rust.tint(0, 0.7, 0.9);
    p.chain([[ax, ay], [x2, y2]], 2.4, 2.4, IR, {});
    p.shape(IR, { dither: 0.3 }, (s2) => { s2.ellipse(x2 + dx * 2, y2 + dy * 2, 3.2, 3.2); s2.capsule(x2 - nx * 11, y2 - ny * 11 + 0, x2 + nx * 11, y2 + ny * 11, 2.2, 2.2); });
    p.poly([[x2 - nx * 11, y2 - ny * 11], [x2 - nx * 11 + dx * 9, y2 - ny * 11 + dy * 9], [x2 - nx * 7 + dx * 2, y2 - ny * 7 + dy * 2]], IR, {}); p.poly([[x2 + nx * 11, y2 + ny * 11], [x2 + nx * 11 + dx * 9, y2 + ny * 11 + dy * 9], [x2 + nx * 7 + dx * 2, y2 + ny * 7 + dy * 2]], IR, {});
    p.chain([[ax, ay], [ax - dx * 8 + 2, ay - dy * 8 + 3]], 1.4, 1.4, R.chain, { outline: false });
    p.px(rd(x2), rd(y2), R.rust.c[4]);
  };
  const A = { idle: [cx + 14, cy + 2, 1.2], windup: [cx + 14, cy - 4, -1.5], swing: [cx + 14, cy - 2, 0.05], slam: [cx + 16, cy - 4, 1.35], roar: [cx + 14, cy - 4, -1.0] }[pose] || [cx + 14, cy + 2, 1.2];
  p.chain([[cx + 12, cy - 6 + bob], [A[0] + 4, A[1] + bob]], 3.6, 2.8, coat, {}); p.shape(bone, { dither: 0.3 }, (s2) => s2.ellipse(A[0] + 4, A[1] + bob, 2.6, 2.6));
  anchor(A[0] + 4, A[1] + bob, A[2]);
  p.glow(cx, cy, 30, '#7affff', rage ? 0.22 : 0.1);
};
const rd = Math.round;
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
  const cx = 150, cy = 106, pose = o.pose, bob = Math.round(sin(t * TAU) * 2), br = o.broken || 0;
  const B = new Ramp(['#14101c', '#2e2438', '#54465e', '#847486', '#b8aabc']), F = B.tint(0, 1, 0.72), glow = '#ff7a3a', EYE = new Ramp(['#8a2a0a', '#d85a1a', '#ffb070', '#fff0d0', '#ffffff']);
  const tail = pose === 'tail' ? 1 : pose === 'windup' ? -1 : 0, cl = pose === 'smash' ? 1 : pose === 'windup' ? -1 : 0;
  // the tail: a heavy segmented curl ending in a glowing sting
  const tailPts = [[cx - 66, cy + 4], [cx - 94, cy + 6], [cx - 116, cy - 8 + tail * 12], [cx - 124, cy - 36 + tail * 26], [cx - 104, cy - 62 + tail * 36]];
  p.chain(tailPts, 13, 4.5, B, { dither: 0.5, texture: { seed: 11, p: 0.05 } });
  for (let k = 1; k < 4; k++) { const [tx, ty] = tailPts[k]; p.line(rd(tx - 8), rd(ty - 8), rd(tx + 8), rd(ty + 8), B.c[1]); }
  const tp = tailPts[4]; p.poly([[tp[0] - 7, tp[1] + 3], [tp[0] + 24, tp[1] - 24 - tail * 6], [tp[0] + 4, tp[1] - 2]], R.coralOrange, {}); p.glow(tp[0] + 22, tp[1] - 22, 14, glow, 0.55); p.px(rd(tp[0] + 22), rd(tp[1] - 22), '#ffffff');
  // far claw arm
  kitClaw(p, cx + 42, cy - 4, cl * 0.6 + 0.2, cl * 0.5, 0.35 + (cl > 0 ? 0 : 0.3), 4.6, F, true, { jaw: 1.2, palm: 1.05, thin: 1.2 });
  // far legs
  kitLegs(p, { legs: 'idle', legT: t }, { n: 4, hipX: cx - 52, hipY: cy + 14, footY: cy + 64, span: 92, splay: 16, ramp: F, tip: F.c[3], r0: 5.8, r1: 3.2, kneeUp: 20, kneeOut: 18 });
  // armoured segments of the body
  for (let i = 5; i >= 0; i--) { const rx = 21 - Math.abs(i - 2.5) * 1.5, ry = 28 - Math.abs(i - 2) * 2.2, sx = cx - 62 + i * 21; p.shape(i % 2 ? B : B.tint(0, 1, 0.9), { dither: 0.5, texture: { seed: i + 1, p: 0.05 } }, (s2) => s2.ellipse(sx, cy + bob, rx, ry)); p.line(rd(sx - rx + 3), rd(cy - ry + 6 + bob), rd(sx - rx + 3), rd(cy + ry - 6 + bob), B.c[1]); p.px(rd(sx), rd(cy - ry + 2 + bob), B.c[4]); p.px(rd(sx + 1), rd(cy - ry + 2 + bob), B.c[4]); p.poly([[sx - 5, cy - ry + 4 + bob], [sx, cy - ry - 7 + bob], [sx + 5, cy - ry + 4 + bob]], B.tint(0, 1, 1.15), {}); }
  // near legs
  kitLegs(p, { legs: 'idle', legT: t }, { n: 4, hipX: cx - 58, hipY: cy + 18, footY: cy + 66, span: 98, splay: 17, ramp: B, tip: B.c[4], r0: 6.8, r1: 3.6, kneeUp: 20, kneeOut: 19, bias: -0.1, joint: B.c[4] });
  // the great head shield with its brow crest and burning eyes
  p.shape(B, { dither: 0.5, texture: { seed: 9, p: 0.05 } }, (s2) => { s2.ellipse(cx + 58, cy - 2 + bob, 38, 29); });
  p.poly([[cx + 28, cy - 22 + bob], [cx + 56, cy - 56 + bob], [cx + 80, cy - 20 + bob]], F, {}); p.line(cx + 56, cy - 54 + bob, cx + 56, cy - 24 + bob, B.c[4]);
  for (let k = 0; k < 4; k++) p.poly([[cx + 32 + k * 9, cy - 24 + bob], [cx + 36 + k * 9, cy - 34 - (k % 2) * 4 + bob], [cx + 40 + k * 9, cy - 24 + bob]], B.tint(0, 1, 1.2), {});
  for (const ex of [cx + 46, cx + 72]) { p.ellipse(ex, cy - 14 + bob, 8.5, 9.5, EYE, { dither: 0 }); p.ellipse(ex + 2, cy - 12 + bob, 3.4, 4.4, R.void, { outline: false }); p.px(ex - 2, cy - 18 + bob, '#ffffff'); p.line(ex - 9, cy - 23 + bob, ex + 8, cy - 19 + bob, '#170d1c'); }
  for (let k = 0; k < 3; k++) p.ellipse(cx + 54 + k * 6, cy - 2 + bob, 2, 2, EYE, { dither: 0 });
  p.glow(cx + 58, cy - 14 + bob, 24, glow, pose === 'gaze' ? 0.75 : 0.3);
  // mouthparts
  for (let k = 0; k < 4; k++) p.poly([[cx + 74 + k * 3, cy + 14 + bob], [cx + 84 + k * 3, cy + 26 + bob], [cx + 78 + k * 3, cy + 14 + bob]], R.bone, {});
  // chains: four glowing shackle-chains to the floor and ceiling; broken ones hang limp
  const ch = [[cx - 10, cy + 20, 40, cy + 80], [cx + 40, cy + 26, 90, cy + 86], [cx + 100, cy + 22, 200, cy + 80], [cx + 20, cy - 26, 60, 8]];
  ch.forEach(([x, y, ex, ey], i) => { const gone = i < br; for (let k = 0; k < 12; k++) { const u = k / 11, xx = x + (ex - x) * u + (gone ? Math.sin(k) * 3 : 0), yy = y + (ey - y) * u * (gone ? 0.5 : 1) + (gone ? u * u * 20 : 0); p.ellipse(xx, yy, 2.8, 1.9, gone ? R.chain : new Ramp(['#2a1a08', '#8a4a10', '#ffa030', '#ffd870', '#ffffff']), { outline: !gone }); } });
  // near claw: the titan's smashing arm
  kitClaw(p, cx + 62, cy + 8 + bob, pose === 'smash' ? 1 : 0.4, pose === 'smash' ? -0.8 : pose === 'windup' ? 1 : 0.1, 0.5, 5.2, B, false, { jaw: 1.2, palm: 1.1, thin: 1.15, edge: '#f8f0d8' });
};
const rd2 = Math.round;

// ---- Kyros the Unsleeping (triton guardian) ---------------------------------------------------------------------------------------
PLANS.kyros = (p, t, o) => {
  const cx = 52, base = 124, bob = Math.round(sin(t * TAU) * 1), pose = o.pose, rage = !!o.rage, sw = sin(t * TAU);
  const M = rage ? new Ramp(['#0a2a3a', '#14506a', '#2a8ab0', '#6ad0e8', '#d0ffff']) : R.divine, G = R.trident, ST = R.steel;
  const flame = rage ? '#ff9a5a' : '#9af0ff';
  // tail: a heavy fish-tail with scaled flukes
  p.chain([[cx, base - 42 + bob], [cx - 10, base - 26], [cx + 6, base - 12], [cx - 6, base + 2]], 12, 4.5, M.tint(0, 0.8, 0.8), { dither: 0.5 });
  p.poly([[cx - 6, base + 2], [cx - 30, base + 12 + sw * 3], [cx - 14, base - 2]], M.tint(0, 0.9, 0.9), { dither: 0.4 }); p.poly([[cx - 6, base + 1], [cx - 26, base - 10 + sw * 3], [cx - 12, base - 4]], M, { dither: 0.4 });
  for (let k = 0; k < 8; k++) { const yy = base - 38 + k * 4.5, xx = cx - 6 + sin(k * 0.9) * 5 + (k > 4 ? 2 : 0); p.line(rd(xx - 4), rd(yy), rd(xx + 1), rd(yy + 2), M.c[1]); p.px(rd(xx + 3), rd(yy), M.c[4]); }
  // waist: scale-mail skirt of gold plates
  for (let k = 0; k < 5; k++) p.shape(G, { dither: 0.3 }, (s2) => s2.poly([[cx - 14 + k * 5.6, base - 44 + bob], [cx - 8.5 + k * 5.6, base - 44 + bob], [cx - 10 + k * 5.6, base - 34 + bob + (k % 2)]]));
  // torso: broad shoulders, narrow waist
  p.shape(M, { dither: 0.4, texture: { seed: 3, p: 0.04 } }, (s2) => { s2.poly([[cx - 19, base - 80 + bob], [cx + 19, base - 80 + bob], [cx + 12, base - 44 + bob], [cx - 12, base - 44 + bob]]); });
  // golden cuirass with a sunburst of tines
  p.shape(G, { dither: 0.3 }, (s2) => { s2.poly([[cx - 15, base - 77 + bob], [cx + 15, base - 77 + bob], [cx + 9, base - 50 + bob], [cx - 9, base - 50 + bob]]); });
  p.line(cx, base - 76 + bob, cx, base - 52 + bob, G.c[4]); for (let k = -2; k <= 2; k++) p.line(cx, base - 62 + bob, cx + k * 5, base - 76 + bob + Math.abs(k) * 2, G.c[1]);
  p.ellipse(cx, base - 64 + bob, 4, 4, new Ramp([flame, flame, '#ffffff', '#ffffff', '#ffffff']), { dither: 0 }); p.glow(cx, base - 64 + bob, 10, flame, 0.4);
  p.line(cx - 12, base - 52 + bob, cx + 12, base - 52 + bob, '#170d1c');
  // pauldrons with fins
  for (const sx of [-1, 1]) { p.shape(G, { dither: 0.3 }, (s2) => s2.ellipse(cx + sx * 20, base - 80 + bob, 9, 7)); p.poly([[cx + sx * 20 - 3, base - 85 + bob], [cx + sx * 21, base - 97 + bob], [cx + sx * 20 + 4, base - 84 + bob]], M.tint(0, 1, 1.15), {}); p.px(cx + sx * 20 - 4, base - 83 + bob, G.c[4]); }
  // head: a finned helm with a glowing visor
  p.shape(M, { dither: 0.3 }, (s2) => { s2.ellipse(cx, base - 92 + bob, 11, 12); }); p.shape(ST, { dither: 0.3 }, (s2) => s2.poly([[cx - 11, base - 100 + bob], [cx + 11, base - 100 + bob], [cx + 12, base - 90 + bob], [cx + 5, base - 82 + bob], [cx - 5, base - 82 + bob], [cx - 12, base - 90 + bob]]));
  p.rect(cx - 8, base - 94 + bob, 16, 4, R.void, { outline: false, flat: 0 }); p.px(cx - 4, base - 92 + bob, flame); p.px(cx + 3, base - 92 + bob, flame); p.px(cx - 5, base - 93 + bob, '#ffffff'); p.px(cx + 2, base - 93 + bob, '#ffffff');
  for (let k = 0; k < 4; k++) p.px(cx - 4 + k * 3, base - 85 + bob, '#170d1c');
  for (let k = 0; k < 5; k++) p.poly([[cx - 10 + k * 5, base - 99 + bob], [cx - 8 + k * 5, base - 108 - (k === 2 ? 5 : (k % 2) * 2) + bob], [cx - 5 + k * 5, base - 99 + bob]], G, {});
  p.poly([[cx - 10, base - 96 + bob], [cx - 24, base - 102 + bob + sw * 2], [cx - 9, base - 90 + bob]], M, {});
  // shield arm: a heavy round shield, thrust forward when guarding
  const guard = pose === 'guard', sxh = cx - 22 + (guard ? 26 : 0), syh = base - 62 + bob;
  p.chain([[cx - 16, base - 76 + bob], [cx - 25, base - 66 + bob], [sxh + 2, syh + 4]], 5.4, 4.4, M, {});
  p.shape(ST, { dither: 0.3 }, (s2) => s2.ellipse(sxh, syh, guard ? 9 : 7.5, guard ? 21 : 16)); p.ellipse(sxh + 1, syh, guard ? 3.4 : 3, guard ? 6 : 5, G, { dither: 0.2 }); p.px(sxh, syh - 2, G.c[4]);
  p.glow(sxh, syh, 11, flame, guard ? 0.6 : 0.35); for (let k = 0; k < 5; k++) { const a = -1.4 + k * 0.7; p.px(rd(sxh + cos(a) * (guard ? 7 : 6)), rd(syh + sin(a) * (guard ? 17 : 13)), G.c[3]); }
  // trident arm and trident
  const T0 = { idle: [18, -70, -1.55], windup: [4, -74, -2.6], thrust: [34, -70, 0], guard: [14, -66, -1.2], throw: [30, -80, -0.4], spin: [20, -72, -0.8], cast: [10, -90, -1.57] }[pose] || [18, -70, -1.55];
  p.chain([[cx + 16, base - 76 + bob], [cx + T0[0] * 0.6 + 10, base + T0[1] * 0.9 + bob], [cx + T0[0] + 6, base + T0[1] + bob]], 5.4, 4.4, M, {});
  const hx = cx + T0[0] + 6, hy = base + T0[1] + bob, dx = cos(T0[2]), dy = sin(T0[2]);
  p.shape(G, { dither: 0.3 }, (s2) => s2.ellipse(hx, hy, 4.2, 4.2));
  p.capsule(hx - dx * 22, hy - dy * 22, hx + dx * 44, hy + dy * 44, 1.6, 1.6, G, {});
  const ex = hx + dx * 44, ey = hy + dy * 44, nx = -dy, ny = dx;
  p.shape(G, { dither: 0.3 }, (s2) => { s2.poly([[ex - nx * 8, ey - ny * 8], [ex - nx * 8 + dx * 14, ey - ny * 8 + dy * 14], [ex - nx * 5.5 + dx * 3, ey - ny * 5.5 + dy * 3]]); s2.poly([[ex + nx * 8, ey + ny * 8], [ex + nx * 8 + dx * 14, ey + ny * 8 + dy * 14], [ex + nx * 5.5 + dx * 3, ey + ny * 5.5 + dy * 3]]); s2.poly([[ex - nx * 2, ey - ny * 2], [ex + dx * 18, ey + dy * 18], [ex + nx * 2, ey + ny * 2]]); s2.capsule(ex - nx * 8, ey - ny * 8, ex + nx * 8, ey + ny * 8, 1.4, 1.4); });
  p.px(rd(ex + dx * 16), rd(ey + dy * 16), '#ffffff');
  p.glow(ex + dx * 14, ey + dy * 14, 10, flame, pose === 'thrust' || pose === 'throw' ? 0.7 : 0.35);
};

// ---- Poseidon ----------------------------------------------------------------------------------------------------------------------------
PLANS.poseidon = (p, t, o) => {
  const cx = 140, cy = 196, pose = o.pose, ph = o.phase || 0, bob = Math.round(sin(t * TAU) * 2), ph2 = ph >= 2, sw0 = sin(t * TAU);
  const ARM = ph === 0 ? new Ramp(['#0e3a4e', '#1e6a82', '#38a0b8', '#78d8d8', '#d8fff4']) : ph === 1 ? new Ramp(['#10202e', '#1e3e58', '#34688a', '#68a4c8', '#c0e4ff']) : ph === 2 ? new Ramp(['#04060c', '#0a1a2e', '#123a58', '#1e6a8a', '#40c0d0']) : new Ramp(['#8a7a4a', '#d8b860', '#ffe890', '#fff6c0', '#ffffff']);
  const SKIN = ph === 3 ? new Ramp(['#8a7a48', '#d8c078', '#fff0b8', '#fffbe0', '#ffffff']) : ph2 ? new Ramp(['#04060c', '#0a2030', '#124a5e', '#2a8a9a', '#7ae8e8']) : R.pearl.tint(0.0, 0.6, 0.95);
  const GOLD = ph === 3 ? new Ramp(['#c8b060', '#fff6c0', '#fff6c0', '#ffffff', '#ffffff']) : R.trident, glow = ph === 3 ? '#fff6c0' : ph2 ? '#40e0ff' : ph === 1 ? '#b0e0ff' : '#9af0e0';
  const TIDE = ph === 3 ? new Ramp(['#a89048', '#e8d080', '#fff0b0', '#fffbe0', '#ffffff']) : ph === 2 ? new Ramp(['#020a12', '#06222e', '#0e4258', '#1a7088', '#38c0d0']) : R.divine;
  const EYE = new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']);
  // aura
  p.glow(cx, cy - 10, ph === 3 ? 100 : 80, glow, ph === 3 ? 0.35 : 0.18, 6);
  // tide-cape streaming behind
  for (let i = 0; i < 7; i++) { const y0 = cy - 50 + i * 9, sw = sin(t * TAU + i * 0.9) * 5; p.chain([[cx - 28, y0 + bob], [cx - 58 + sw, y0 + 6], [cx - 86 + sw * 1.5, y0 + 22 + i * 2], [cx - 108 + sw, y0 + 44 + i * 3]], 7 - i * 0.55, 0.6, ph2 ? R.divine.tint(0, 1, 0.55) : R.divine, { dither: 0.5, outline: false, bias: 0.05 }); }
  // coiling spout of living water for a lower body
  p.chain([[cx, cy + 4 + bob], [cx - 6 + sw0 * 3, cy + 42], [cx + 8 - sw0 * 3, cy + 76], [cx - 4, cy + 104]], 30, 2, TIDE, { dither: 0.6, bias: -0.1 });
  for (let k = 0; k < 6; k++) p.ellipse(cx - 14 + k * 6 + sin(t * TAU + k) * 2, cy + 28 + k * 12, 4.4, 1.7, ph2 ? R.divine : R.pearl, { outline: false, dither: 0 });
  // great torso: golden scale-mail over a bare, powerful chest
  p.shape(ARM, { dither: 0.5, texture: { seed: 5, p: 0.05 } }, (s2) => { s2.poly([[cx - 36, cy - 52 + bob], [cx + 36, cy - 52 + bob], [cx + 26, cy + 10 + bob], [cx - 26, cy + 10 + bob]]); });
  p.shape(SKIN, { dither: 0.5 }, (s2) => s2.poly([[cx - 14, cy - 50 + bob], [cx + 14, cy - 50 + bob], [cx + 9, cy - 6 + bob], [cx - 9, cy - 6 + bob]]));
  for (let k = 0; k < 4; k++) p.line(cx - 28 + k * 18, cy - 46 + bob, cx - 22 + k * 15, cy + 6 + bob, ARM.c[1]);
  for (let row = 0; row < 4; row++) for (let k = 0; k < 6; k++) { const sx = cx - 31 + k * 11 + (row % 2) * 5, sy = cy - 40 + row * 11 + bob; if (Math.abs(sx - cx) < 14 && row < 2) continue; p.px(rd(sx), rd(sy), GOLD.c[3]); p.px(rd(sx + 1), rd(sy + 1), ARM.c[1]); p.px(rd(sx - 1), rd(sy + 1), ARM.c[4]); }
  p.line(cx - 34, cy - 34 + bob, cx + 34, cy - 34 + bob, GOLD.c[3]); p.line(cx - 26, cy - 4 + bob, cx + 26, cy - 4 + bob, GOLD.c[3]);
  p.shape(GOLD, { dither: 0.3 }, (s2) => s2.ellipse(cx, cy - 4 + bob, 7, 5));
  p.ellipse(cx, cy - 16 + bob, 6, 6, ph === 3 ? GOLD : EYE, { dither: 0 }); p.glow(cx, cy - 16 + bob, 14, glow, 0.5);
  if (ph2) for (let k = 0; k < 7; k++) p.line(cx - 28 + k * 9, cy - 46 + bob, cx - 24 + k * 9, cy - 18 + (k % 3) * 8 + bob, '#7ae8e8');
  // pauldrons crowned with spires of coral
  for (const sx of [-1, 1]) { p.shape(ARM, { dither: 0.4 }, (s2) => s2.ellipse(cx + sx * 40, cy - 50 + bob, 17, 12)); p.line(cx + sx * 30, cy - 50 + bob, cx + sx * 50, cy - 50 + bob, GOLD.c[3]); for (let k = 0; k < 3; k++) p.poly([[cx + sx * (31 + k * 9) - 3, cy - 59 + bob], [cx + sx * (33 + k * 9), cy - 74 - (k === 1 ? 6 : 0) + bob], [cx + sx * (31 + k * 9) + 4, cy - 59 + bob]], k === 1 ? GOLD : ARM.tint(0, 1, 1.15), {}); }
  // head: stern face, streaming hair, a beard of water and a crown of spires
  const hy = cy - 76 + bob;
  for (let i = 0; i < 7; i++) { const sw = sin(t * TAU + i) * 2.4; p.chain([[cx - 10 + i * 3.4, hy + 10], [cx - 12 + i * 3.8 + sw, hy + 30], [cx - 14 + i * 4.4 + sw, hy + 52]], 3.6, 0.8, ph2 ? R.divine : R.pearl, { outline: false, dither: 0.5 }); }
  for (let i = 0; i < 8; i++) { const a = -2.6 + i * 0.38, sw = sin(t * TAU + i) * 3; p.chain([[cx + cos(a) * 12, hy - 6 + sin(a) * 10], [cx + cos(a) * 26 + sw, hy - 12 + sin(a) * 20], [cx + cos(a) * 38 + sw * 1.5, hy - 2 + sin(a) * 24 + 8]], 4, 1, ph2 ? R.divine.tint(0, 1, 0.7) : R.divine, { outline: false, dither: 0.5 }); }
  p.shape(SKIN, { dither: 0.4 }, (s2) => { s2.ellipse(cx, hy, 14.5, 17); s2.rect(cx - 6, hy + 10, 12, 10); });
  p.poly([[cx - 4, hy + 1], [cx + 1, hy + 9], [cx + 5, hy + 1]], SKIN.tint(0, 1, 0.8), { outline: false });
  for (const ex of [-6.5, 6.5]) { p.rect(cx + ex - 3.5, hy - 6, 7, 4, R.void, { outline: false, flat: 0 }); p.px(rd(cx + ex - 1), rd(hy - 5), glow); p.px(rd(cx + ex), rd(hy - 5), '#ffffff'); p.px(rd(cx + ex), rd(hy - 4), glow); }
  p.line(cx - 11, hy - 10, cx - 2, hy - 7, '#05030a'); p.line(cx + 11, hy - 10, cx + 2, hy - 7, '#05030a'); p.line(cx - 4, hy + 8, cx + 4, hy + 8, '#05030a');
  const GW = ph === 3 ? 3 : 0;
  for (let i = 0; i < 9; i++) { const sx = cx - 16 + i * 4, hh = 14 + (i === 4 ? 14 : 0) + ((i === 2 || i === 6) ? 5 : 0) + (ph2 ? -4 + (i % 3) * 3 : 0); p.poly([[sx - 2.4, hy - 11], [sx + 0.5, hy - 11 - hh], [sx + 3.4, hy - 11]], GOLD, {}); p.px(rd(sx + 0.5), rd(hy - 10 - hh), '#ffffff'); }
  p.line(cx - 17, hy - 11, cx + 17, hy - 11, GOLD.c[1]); p.ellipse(cx, hy - 12, 2.6, 2.6, EYE, { dither: 0 }); p.glow(cx, hy - 12, 8, glow, 0.5);
  // left arm: a fist closing round an orb of tide
  const castUp = pose === 'cast' || pose === 'roar';
  p.chain([[cx - 36, cy - 46 + bob], [cx - 58, cy - 38 - (castUp ? 30 : 0) + bob], [cx - 68, cy - 20 - (castUp ? 52 : 0) + bob]], 10, 7, ARM, {});
  p.line(cx - 52, cy - 40 - (castUp ? 26 : 0) + bob, cx - 56, cy - 34 - (castUp ? 28 : 0) + bob, GOLD.c[3]);
  p.shape(SKIN, { dither: 0.4 }, (s2) => s2.ellipse(cx - 70, cy - 18 - (castUp ? 52 : 0) + bob, 8, 8)); p.glow(cx - 70, cy - 26 - (castUp ? 54 : 0) + bob, 16, glow, 0.7); p.ellipse(cx - 70, cy - 27 - (castUp ? 54 : 0) + bob, 6, 6, EYE, { dither: 0 });
  // right arm and the trident of the sea
  const Tr = { idle: [50, -26, -1.5], thrust: [66, -38, 0], raise: [50, -66, -1.57], slam: [54, -44, 1.5], cast: [54, -76, -1.57], roar: [54, -76, -1.57], sweep: [64, -34, -0.3] }[pose] || [50, -26, -1.5];
  p.chain([[cx + 36, cy - 46 + bob], [cx + 52, cy - 42 + bob], [cx + Tr[0], cy + Tr[1] + bob]], 10, 7, ARM, {});
  p.shape(GOLD, { dither: 0.3 }, (s2) => s2.ellipse(cx + 49, cy - 40 + bob, 5, 3.5));
  p.shape(SKIN, { dither: 0.4 }, (s2) => s2.ellipse(cx + Tr[0], cy + Tr[1] + bob, 8, 8));
  const hx = cx + Tr[0], hy2 = cy + Tr[1] + bob, dx = cos(Tr[2]), dy = sin(Tr[2]), nx = -dy, ny = dx;
  p.capsule(hx - dx * 40, hy2 - dy * 40, hx + dx * 74, hy2 + dy * 74, 2.4, 2.4, GOLD, {});
  for (let k = 0; k < 4; k++) p.px(rd(hx + dx * (10 + k * 12)), rd(hy2 + dy * (10 + k * 12)), GOLD.c[4]);
  const ex = hx + dx * 74, ey = hy2 + dy * 74;
  p.shape(GOLD, { dither: 0.3 }, (s2) => {
    s2.poly([[ex - nx * 15, ey - ny * 15], [ex - nx * 15 + dx * 30, ey - ny * 15 + dy * 30], [ex - nx * 10 + dx * 7, ey - ny * 10 + dy * 7]]);
    s2.poly([[ex + nx * 15, ey + ny * 15], [ex + nx * 15 + dx * 30, ey + ny * 15 + dy * 30], [ex + nx * 10 + dx * 7, ey + ny * 10 + dy * 7]]);
    s2.poly([[ex - nx * 3, ey - ny * 3], [ex + dx * 38, ey + dy * 38], [ex + nx * 3, ey + ny * 3]]);
    s2.capsule(ex - nx * 15, ey - ny * 15, ex + nx * 15, ey + ny * 15, 2.2, 2.2); s2.ellipse(ex - dx * 3, ey - dy * 3, 4, 4);
  });
  p.px(rd(ex + dx * 34), rd(ey + dy * 34), '#ffffff'); p.glow(ex + dx * 22, ey + dy * 22, ph === 3 ? 18 : 13, glow, 0.7);
  // restraints: runed chains from the wrists to the edges of the world until the third phase, then broken links hang
  const cp = [[cx - 70, cy - 12 + bob, 4, 70], [cx + Tr[0], cy + Tr[1] + 10 + bob, 336, 70], [cx - 22, cy + 70, 8, 300], [cx + 22, cy + 70, 332, 300]];
  cp.forEach(([x, y, ex2, ey2]) => { for (let k = 0; k < 11; k++) { const u = k / 10, xx = x + (ex2 - x) * u * (ph2 ? 0.25 : 1), yy = y + (ey2 - y) * u * (ph2 ? 0.3 : 1) + (ph2 ? u * u * 30 : 0); p.ellipse(xx, yy, 2.6, 1.8, ph2 ? R.chain : new Ramp(['#0e1a2a', '#2a4a6a', '#58a0c8', '#9af0ff', '#ffffff']), { outline: !ph2, dither: 0 }); } });
};
const rd3 = Math.round;

// ---- The Hollow Maw (void horror) ------------------------------------------------------------------------------------------------------
PLANS.maw = (p, t, o) => {
  const cx = 90, cy = 74, pose = o.pose, open = pose === 'open' || pose === 'roar' || pose === 'charge' ? 1 : 0, pul = sin(t * TAU) * 2;
  const V = new Ramp(['#04010a', '#0c0418', '#1c0a34', '#34186a', '#5a30a8']), EYEV = new Ramp(['#400a60', '#8a30c8', '#d8a0ff', '#ffffff', '#ffffff']);
  p.glow(cx, cy, 80, '#8a30c8', 0.2, 6);
  // grasping tendrils, each ending in a watching eye
  for (let i = 0; i < 8; i++) {
    const a0 = -Math.PI * 0.95 + i * 0.42, sw = sin(t * TAU + i * 1.1) * 6, L = 66 + (i % 3) * 6;
    const pts = [[cx + cos(a0) * 34, cy + sin(a0) * 28], [cx + cos(a0) * (L * 0.55) + sw, cy + sin(a0) * (L * 0.5) + sw * 0.4], [cx + cos(a0 + 0.25) * L + sw * 1.4, cy + sin(a0 + 0.25) * (L * 0.8) + 8]];
    p.chain(pts, 7, 2.4, V, { dither: 0.5 });
    const e = pts[2]; p.ellipse(e[0], e[1], 4.2, 4.2, EYEV, { dither: 0 }); p.px(rd(e[0] + 1), rd(e[1]), '#10041e'); p.px(rd(e[0] + 1), rd(e[1] + 1), '#10041e'); p.glow(e[0], e[1], 8, '#c070ff', 0.4);
  }
  // the body: a swirling sphere of void, ringed with cracks that leak light
  p.shape(V, { dither: 0.5, texture: { seed: 3, p: 0.08 } }, (s2) => s2.ellipse(cx, cy, 46 + pul, 38 + pul));
  for (let k = 0; k < 4; k++) { const rr = 14 + k * 8; for (let a1 = 0; a1 < TAU; a1 += 0.16) { const x = cx + cos(a1 + t * TAU * (k % 2 ? 1 : -1) * 0.25) * rr * 1.1, y = cy + sin(a1 + t * TAU * (k % 2 ? 1 : -1) * 0.25) * rr * 0.9; if (hashy(a1 * 10 + k) > 0.62) p.px(rd(x), rd(y), V.c[3]); } }
  for (let k = 0; k < 7; k++) { const a1 = -2.5 + k * 0.85; p.line(rd(cx + cos(a1) * 22), rd(cy + sin(a1) * 18), rd(cx + cos(a1) * 42), rd(cy + sin(a1) * 34), '#8a30c8'); p.px(rd(cx + cos(a1) * 30), rd(cy + sin(a1) * 25), '#e0b0ff'); }
  // the maw: two rings of teeth round a vortex
  const mh = open ? 25 : 9, mw = 30;
  p.ellipse(cx, cy + 10, mw, mh, new Ramp(['#000000', '#05010a', '#10041e', '#240a3a', '#3a1058']), { dither: 0.2 });
  for (let k = 0; k < 3; k++) p.ellipse(cx, cy + 10, mw * (0.7 - k * 0.2), mh * (0.7 - k * 0.2), new Ramp(['#000000', '#0a0214', '#1a0630', '#3a1070', '#7a40d0']), { outline: false, dither: 0.1, flat: 3 - k });
  for (let i = 0; i < 16; i++) { const a1 = (i / 16) * TAU, tx = cx + cos(a1) * mw, ty = cy + 10 + sin(a1) * mh, inward = i % 2 ? 11 : 8; p.poly([[tx - 2.4, ty - 0.5], [tx - cos(a1) * inward, ty - sin(a1) * inward], [tx + 2.4, ty + 0.5]], R.bone, {}); }
  for (let i = 0; i < 12; i++) { const a1 = (i / 12) * TAU + 0.2, tx = cx + cos(a1) * mw * 0.72, ty = cy + 10 + sin(a1) * mh * 0.72; p.px(rd(tx), rd(ty), R.bone.c[3]); p.px(rd(tx - cos(a1) * 2), rd(ty - sin(a1) * 2), R.bone.c[2]); }
  // the great eyes above the mouth
  for (const [ex, ey, r] of [[cx - 26, cy - 15, 6], [cx + 24, cy - 17, 7], [cx, cy - 27, 9], [cx - 38, cy + 3, 4], [cx + 40, cy + 1, 4]]) { p.ellipse(ex, ey, r, r, EYEV, { dither: 0 }); p.ellipse(ex + 1, ey + 1, r * 0.45, r * 0.6, R.void, { outline: false }); p.px(rd(ex - r * 0.4), rd(ey - r * 0.4), '#ffffff'); }
  p.glow(cx, cy, 70, '#8a30c8', 0.18, 5);
};
const hashy = (x) => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };

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
