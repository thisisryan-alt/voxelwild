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
