// Mini-boss body plans for the optional zones. Registered into PLANS like sprites_bosses.js; sprites face RIGHT.
import { PLANS } from './sprites_enemies.js';
import { legs as kitLegs, claw as kitClaw, eyeStalk as kitEye, shell as kitShell } from './crab_kit.js';
import { Ramp } from './painter.js';
import { R } from './palette.js';

const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, rd = Math.round;

// ---- Brun, the Hermit King: a soft crab inside a spiral palace of a shell, crowned in gold coral -----------------------
const HSHELL = new Ramp(['#3a1838', '#7a3470', '#c0609a', '#f09ab8', '#ffe0d8']);
const HBODY = new Ramp(['#5a1c10', '#a8381c', '#e0602a', '#ff9a4a', '#ffd88a']);
PLANS.hermitking = (p, t, o) => {
  const pose = o.pose, rage = !!o.rage, hide = pose === 'hide' || pose === 'spin', cx = 62, by = 62 + (pose === 'idle' ? rd(sin(t * TAU)) : pose === 'stagger' ? 5 : pose === 'windup' ? 2 : 0);
  const C = { idle: { ext: 0.3, lift: 0.2, open: 0.3 }, walk: { ext: 0.4, lift: 0.1, open: 0.3 }, windup: { ext: -0.2, lift: 1, open: 1 }, smash: { ext: 1, lift: -0.2, open: 0.4 }, roar: { ext: 0.5, lift: 0.9, open: 1 }, stagger: { ext: 0.1, lift: 0, open: 0 }, hide: { ext: 0, lift: 0, open: 0 }, spin: { ext: 0, lift: 0, open: 0 } }[pose] || { ext: 0.3, lift: 0.2, open: 0.3 };
  const body = rage ? HBODY.tint(-0.03, 1.15, 1.0) : HBODY, far = body.tint(0, 1, 0.7), shl = rage ? HSHELL.tint(-0.06, 1.1, 1.05) : HSHELL;
  const pl = { legs: hide ? 'tuck' : pose === 'walk' ? 'walk' : 'idle', legT: t, squash: 0 };
  kitLegs(p, pl, { n: 3, hipX: cx - 10, hipY: by + 10, footY: 88, span: 30, splay: 9, ramp: far, tip: far.c[3], r0: 3.6, r1: 2, kneeUp: 8, kneeOut: 10 });
  if (!hide) kitClaw(p, cx + 18, by + 2, C.ext * 0.8, C.lift * 0.8 + 0.2, C.open, 2.6, far, true, { jaw: 1.05, palm: 1.1 });
  // the palace: a spiral shell piled on the back (slides forward over the crab when he hides)
  const sx = hide ? cx + 4 : cx - 14, sy = hide ? by - 2 : by - 14, sr = hide ? 34 : 28;
  p.shape(shl, { dither: 0.45, texture: { seed: 6, p: 0.06 } }, (s) => { s.ellipse(sx, sy, sr, sr * 0.92); s.ellipse(sx + (hide ? 10 : -6), sy + sr * 0.5, sr * 0.7, sr * 0.5); });
  for (let a = 0.4, r = 2; a < 12.5; a += 0.12, r += 0.11) p.px(rd(sx + cos(a) * r * 2.1), rd(sy + sin(a) * r * 1.95), a > 6 ? shl.c[1] : shl.c[0]);
  for (let a = 0.9; a < 6; a += 0.55) p.px(rd(sx + cos(a - 2) * sr * 0.7), rd(sy + sin(a - 2) * sr * 0.64), shl.c[4]);
  // crown of golden coral planted on the shell
  for (let i = 0; i < 5; i++) { const cxx = sx - 12 + i * 6, h = 11 + (i % 2) * 6 + (rage ? 3 : 0); p.poly([[cxx - 2.4, sy - sr * 0.8], [cxx, sy - sr * 0.8 - h], [cxx + 2.4, sy - sr * 0.8]], R.gold, {}); }
  p.glow(sx, sy - sr * 0.85, 14, '#ffd84a', rage ? 0.5 : 0.3);
  if (!hide) {
    kitShell(p, cx + 10, by + 6, 20, 12, body, { seed: 7, plates: 3, spots: 2, ridge: 6, belly: true });
    kitLegs(p, pl, { n: 3, hipX: cx - 8, hipY: by + 13, footY: 88, span: 32, splay: 10, ramp: body, tip: body.c[4], r0: 4.2, r1: 2.2, kneeUp: 8, kneeOut: 11, bias: -0.1 });
    const ey = by - 8 + (pose === 'stagger' ? 5 : 0);
    kitEye(p, cx + 20, ey, by - 2, { stalk: far.c[2], r: 4, thick: true, ball: new Ramp(['#8a1010', '#c8301a', '#ffd84a', '#fff6a8', '#ffffff']) }); kitEye(p, cx + 30, ey + 2, by + 1, { stalk: far.c[2], r: 4, thick: true, ball: new Ramp(['#8a1010', '#c8301a', '#ffd84a', '#fff6a8', '#ffffff']) });
    p.line(cx + 16, ey - 5, cx + 24, ey - 3, '#170d1c'); p.line(cx + 34, ey - 3, cx + 28, ey - 1, '#170d1c');
    kitClaw(p, cx + 30, by + 6, C.ext, C.lift + 0.1, C.open, 3.3, body, false, { jaw: 1.1, palm: 1.15, edge: body.c[4] });
  } else {
    p.ellipse(cx + 36, by + 12, 6, 4, R.void, { outline: false }); p.px(cx + 34, by + 10, '#ffd84a'); p.px(cx + 38, by + 10, '#ffd84a');   // eyes in the dark mouth of the shell
    if (pose === 'spin') for (let k = 0; k < 4; k++) p.line(cx - 30 - k * 4, by - 14 + k * 9, cx - 22 - k * 4, by - 14 + k * 9, '#ffffff');
  }
};

// ---- Sporemother: a mound of toadstool-flesh with a face in the cap and a skirt of root-legs ------------------------------
const SPORE = new Ramp(['#1a2a10', '#386a2a', '#6aa83a', '#b0e060', '#f0ffb0']);
const CAP = new Ramp(['#3a1038', '#7a2a78', '#c050a8', '#f088c8', '#ffd8f0']);
PLANS.sporemother = (p, t, o) => {
  const pose = o.pose, rage = !!o.rage, cx = 70, base = 100, open = pose === 'spray' || pose === 'roar' || pose === 'windup', sag = pose === 'stagger' ? 8 : 0;
  const pulse = sin(t * TAU), capY = base - 62 + sag + rd(pulse * 1.2), cap = rage ? CAP.tint(0.12, 1.2, 1.0) : CAP;
  // root legs fanning out of a thick stalk
  for (let i = 0; i < 6; i++) { const a = -2.7 + i * 0.9, lx = cx + cos(a) * 36, wob = sin(t * TAU + i * 1.3) * 2; p.chain([[cx + (i - 2.5) * 4, base - 22 + sag], [cx + (i - 2.5) * 12 + wob, base - 8], [lx, base - 1]], 3, 1.4, SPORE.tint(0, 1, 0.8), { dither: 0.4 }); }
  p.shape(SPORE, { dither: 0.5, texture: { seed: 3, p: 0.06 } }, (s) => { s.capsule(cx, base - 18 + sag, cx, capY + 18, 17, 13); });
  p.ellipse(cx, base - 30 + sag, 12, 8, new Ramp(['#5a4a2a', '#8a7a48', '#b8a870', '#e0d4a0', '#fff8d8']), { outline: false, dither: 0.3 });
  // gills and the cap
  p.shape(cap, { dither: 0.5, texture: { seed: 5, p: 0.07 } }, (s) => { s.ellipse(cx, capY, open ? 50 : 44, open ? 19 : 22); });
  for (let k = -3; k <= 3; k++) p.line(cx + k * 6, capY + (open ? 14 : 12), cx + k * 6 + k, capY + 5, cap.c[1]);
  for (const [dx, dy, r] of [[-26, -6, 5], [-8, -14, 4], [14, -12, 5], [28, -2, 4], [-30, 6, 3], [6, -6, 3], [22, 5, 3]]) { p.ellipse(cx + dx, capY + dy, r, r * 0.8, R.pearl, { outline: false, dither: 0.2 }); p.px(cx + dx - 1, capY + dy - 1, '#ffffff'); }
  // face on the stalk: two lamp eyes and a ragged mouth
  const ey = base - 34 + sag; for (const ex of [cx - 8, cx + 8]) { p.ellipse(ex, ey, 4, 4, new Ramp(['#6a2a00', '#c87a10', '#ffe040', '#fff8a0', '#ffffff']), { dither: 0 }); p.px(ex + 1, ey, '#170d1c'); }
  p.line(cx - 12, ey - 6, cx - 4, ey - 4, '#170d1c'); p.line(cx + 12, ey - 6, cx + 4, ey - 4, '#170d1c');
  const mo = open ? 6 : 2; p.poly([[cx - 8, ey + 8], [cx, ey + 8 + mo], [cx + 8, ey + 8], [cx, ey + 6]], R.void, {}); for (let k = -1; k <= 1; k++) p.px(cx + k * 4, ey + 8, '#ffffff');
  if (open) for (let k = 0; k < 14; k++) p.px(rd(cx - 40 + ((k * 37 + t * 40) % 80)), rd(capY + 22 + ((k * 13 + t * 30) % 26)), k % 2 ? '#c8ff90' : '#ffb0e8');
  p.glow(cx, capY, 34, '#ff80d0', 0.18 + (rage ? 0.12 : 0));
};

// ---- Brass Colossus: a vault guardian of gilded plate, riveted and hollow, wielding a pillar of a trident ----------------------------
const BRASS = new Ramp(['#2a1a0a', '#6a4a14', '#b8841a', '#f0c440', '#fff2a0']);
const IRON = new Ramp(['#12182a', '#2a3858', '#4a6894', '#7ea4d0', '#d0e8ff']);
PLANS.colossus = (p, t, o) => {
  const pose = o.pose, rage = !!o.rage, cx = 60, base = 120, bob = pose === 'idle' ? rd(sin(t * TAU) * 1) : 0, stag = pose === 'stagger' ? 10 : 0;
  const metal = rage ? BRASS.tint(-0.05, 1.2, 1.05) : BRASS, steel = IRON, walk = sin(t * TAU), wk = pose === 'walk' ? walk * 4 : 0;
  const top = base - 100 + stag + bob;
  // legs: two pillars with knee plates
  for (const [lx, d] of [[cx - 16, -1], [cx + 14, 1]]) { const sw = d * wk; p.shape(steel, { dither: 0.4 }, (s) => s.capsule(lx, base - 44, lx + sw, base - 8, 10, 8)); p.shape(metal, { dither: 0.3 }, (s) => { s.ellipse(lx + sw * 0.5, base - 27, 11, 7); s.rect(lx - 12 + sw, base - 10, 24, 8, 2); }); }
  // torso: a wide riveted barrel
  p.shape(metal, { dither: 0.4, texture: { seed: 2, p: 0.05 } }, (s) => { s.rect(cx - 30, top + 30 + stag * 0.2, 60, 46, 8); s.ellipse(cx, top + 36, 28, 14); });
  p.rect(cx - 30, top + 56, 60, 5, steel, { dither: 0.2 });
  for (let i = 0; i < 6; i++) { p.px(cx - 24 + i * 9, top + 38, metal.c[4]); p.px(cx - 24 + i * 9, top + 66, metal.c[4]); }
  p.ellipse(cx, top + 48, 8, 8, R.divine, { dither: 0.2 }); p.glow(cx, top + 48, 14, '#9af0e0', pose === 'stagger' ? 0.8 : 0.4 + 0.15 * sin(t * TAU));     // the core
  // shoulders and arms
  for (const [sx, d] of [[cx - 36, -1], [cx + 36, 1]]) p.shape(metal, { dither: 0.3 }, (s) => s.ellipse(sx, top + 32, 13, 11));
  const raise = pose === 'windup' ? 1 : pose === 'slam' ? -0.4 : 0.2;
  // off arm
  p.shape(steel, { dither: 0.4 }, (s) => s.capsule(cx - 36, top + 38, cx - 46, top + 60, 7, 6)); p.ellipse(cx - 47, top + 64, 8, 7, metal, { dither: 0.3 });
  // trident arm and weapon
  const ax = cx + 38, ay = top + 40, hx = ax + 10, hy = ay - raise * 26 + 14;
  p.shape(steel, { dither: 0.4 }, (s) => s.capsule(ax, ay, hx, hy, 7, 6)); p.ellipse(hx, hy, 7, 6, metal, { dither: 0.3 });
  const tx = hx + 2, ty = hy; p.line(tx, ty - 46, tx + (raise < 0 ? 18 : 0), ty + 40 * (raise < 0 ? 0.4 : 0.9), R.trident.c[2]); p.line(tx + 1, ty - 46, tx + 1, ty + 36, R.trident.c[1]);
  p.poly([[tx - 9, ty - 54], [tx - 6, ty - 40], [tx - 3, ty - 54], [tx, ty - 62], [tx + 3, ty - 54], [tx + 6, ty - 40], [tx + 9, ty - 54], [tx + 3, ty - 36], [tx - 3, ty - 36]], R.trident, {});
  // helm: tall visor with a slit of light
  p.shape(metal, { dither: 0.3 }, (s) => { s.rect(cx - 15, top + 4, 30, 28, 5); s.poly([[cx - 15, top + 6], [cx, top - 8], [cx + 15, top + 6]]); });
  p.rect(cx - 11, top + 15, 22, 5, R.void, { outline: false });
  p.line(cx - 10, top + 17, cx + 10, top + 17, rage ? '#ff6a3a' : '#9af0e0'); p.glow(cx, top + 17, 16, rage ? '#ff6a3a' : '#9af0e0', 0.35);
  p.line(cx, top - 8, cx, top + 4, metal.c[1]);
  if (rage) for (let k = 0; k < 4; k++) p.px(cx - 20 + k * 13, top + 30, '#ff9a4a');
};

// ---- Magmaw, the vent-eel: segments are drawn by the boss itself; this is the head --------------------------------------------------
const CINDER = new Ramp(['#1a0a0a', '#4a1410', '#8a2a14', '#d85a1a', '#ffc060']);
PLANS.magmaw = (p, t, o) => {
  const open = o.pose === 'open' || o.pose === 'spray', rage = !!o.rage, c = 40, m = 32, jaw = open ? 12 : 2, ramp = rage ? CINDER.tint(0.02, 1.1, 1.2) : CINDER;
  for (let i = 0; i < 5; i++) p.poly([[c - 18 + i * 6, m - 14], [c - 15 + i * 6, m - 28 - (i % 2) * 4], [c - 9 + i * 6, m - 14]], R.bone, {});
  p.shape(ramp, { dither: 0.5, texture: { seed: 9, p: 0.07 } }, (s) => { s.ellipse(c, m, 20, 15); s.ellipse(c + 16, m + 1, 15, 10); });
  p.poly([[c + 8, m + 4], [c + 32, m + 3 + jaw], [c + 30, m + 9 + jaw], [c + 6, m + 12]], ramp.tint(0, 1, 0.8), {});
  if (open) { p.poly([[c + 10, m + 3], [c + 33, m + 2], [c + 32, m + 3 + jaw], [c + 8, m + 5]], new Ramp(['#5a0a00', '#c03a00', '#ff8a1a', '#ffd060', '#fff6c0']), {}); p.glow(c + 22, m + 5 + jaw / 2, 14, '#ffa040', 0.6); for (let i = 0; i < 6; i++) { p.px(c + 12 + i * 3, m + 2, '#ffffff'); p.px(c + 12 + i * 3, m + 4 + jaw - 2, '#ffffff'); } }
  p.ellipse(c + 9, m - 7, 4, 4, new Ramp(['#6a1000', '#ff5a10', '#ffd060', '#fff6c0', '#ffffff']), { dither: 0 }); p.px(c + 10, m - 7, '#05030a'); p.px(c + 10, m - 6, '#05030a');
  p.line(c + 4, m - 12, c + 14, m - 10, '#05030a');
  p.glow(c + 9, m - 7, 10, '#ff8a3a', 0.4);
  for (let k = 0; k < 4; k++) p.px(c - 14 + k * 7, m - 8 + (k % 2) * 3, '#ffb040');     // ember freckles
};
export function cinderSeg(r, k) {
  const R2 = Math.round(r), s = R2 * 2 + 10, c = s / 2;
  return plainFrameLazy(`cseg${R2}_${k}`, s, s, c, c, (p) => {
    p.poly([[c - r * 0.7, c - r + 1], [c, c - r - 4 - (k % 2) * 2], [c + r * 0.7, c - r + 1]], CINDER.tint(0.04, 1, 1.15), {});
    p.shape(CINDER, { dither: 0.5, texture: { seed: k, p: 0.07 } }, (a) => a.ellipse(c, c, r, r));
    p.ellipse(c, c + r * 0.4, r * 0.75, r * 0.35, new Ramp(['#5a1a00', '#a83a10', '#e86a1a', '#ffa040', '#ffe0a0']), { outline: false, dither: 0.3 });
    if (k % 3 === 0) for (let i = 0; i < 3; i++) p.px(c - 2 + i * 2, c - r * 0.4, '#ffd080');
  });
}
import { plainFrame as plainFrameLazy } from './sprites_enemies.js';
