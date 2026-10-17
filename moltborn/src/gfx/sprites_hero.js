// Hero forms, rebuilt on the crab kit: Shore Crab, Warrior Crab, Abyssal Stalker, Ancient Leviathan, Thalassarch and the
// Unmolted. Each paints from the shared pose model (sprites_player.js) so every form has the full animation set.
// Sprites face right; (ax, ay) is the feet anchor; `hit` is the gameplay hitbox, independent of the art.
import { FORMS, registerFormRamps } from './sprites_player.js';
import { Ramp } from './painter.js';
import { R } from './palette.js';
import { legs, claw, eyeStalk, shell, bobY, sin, cos, TAU, rd, lerp } from './crab_kit.js';

// ---- Shore Crab ---------------------------------------------------------------------------------------------
FORMS.shore = {
  w: 58, h: 34, ax: 24, ay: 31, hit: [14, 10],
  paint(p, pose, o) {
    const r = o.ramp, far = o.far, sq = pose.squash, by = bobY(pose, 19, sq), bx = 22 + rd(pose.lunge * 0.5);
    // legs sit under the shell: the far set is dark, the near set lighter, both tucked beneath the carapace
    legs(p, pose, { n: 3, hipX: bx - 6, hipY: by + 3, footY: 31, span: 11, splay: 4, ramp: far, tip: far.c[3], r0: 1.2, r1: 0.7, kneeUp: 2.6, kneeOut: 3.4 });
    claw(p, bx + 7, by - 1, pose.c2.ext, pose.c2.lift + 0.2, pose.c2.open, 0.8, far, true);
    legs(p, pose, { n: 4, hipX: bx - 8, hipY: by + 4, footY: 32, span: 15, splay: 4.2, ramp: r, tip: r.c[4], r0: 1.4, r1: 0.8, kneeUp: 2.4, kneeOut: 3.6, bias: -0.1 });
    shell(p, bx, by, 12, 7.4 - sq * 1.5, r, { seed: 3, plates: 3, spots: 3 });
    p.px(bx + 11, by + 3, far.c[1]); p.px(bx + 12, by + 4, far.c[2]);   // mouthparts
    const ey = rd(by - 11 + sq * 2), shut = pose.shut || sq > 0.6;
    eyeStalk(p, bx + 4, ey, by - 5, { shut, stalk: far.c[1] }); eyeStalk(p, bx + 9.5, ey - 0.5, by - 5, { shut, stalk: far.c[1] });
    claw(p, bx + 10, by + 1, pose.c1.ext, pose.c1.lift + 0.15, pose.c1.open, 1.12, r, false, { palm: 1.1 });
    if (pose.glow > 0) p.glow(bx + 4, by, 15, '#ffd8a0', 0.35 * pose.glow);
  },
};

// ---- Warrior Crab: armoured, with a hammer-claw (Bulwark) or a blade-claw (Duelist) --------------------------------------
FORMS.warrior = {
  w: 78, h: 46, ax: 32, ay: 42, hit: [14, 12],
  paint(p, pose, o) {
    const r = o.ramp, far = o.far, acc = o.accent, sq = pose.squash, br = o.branch, duel = br === 'duelist';
    const by = bobY(pose, 28, sq), bx = 27 + rd(pose.lunge * 0.5);
    const cs = duel ? { jaw: 1.55, palm: 0.8, thin: 0.65, blade: '#ffe8e8', teeth: false } : { jaw: 0.85, palm: 1.45, thin: 1.5 };
    legs(p, pose, { n: 4, hipX: bx - 10, hipY: by + 4, footY: 42, span: 17, splay: 4.5, ramp: far, tip: far.c[3], r0: 1.5, r1: 0.9, kneeUp: 3, kneeOut: 4.2, hipDrop: 1.2 });
    claw(p, bx + 11, by - 1, pose.c2.ext, pose.c2.lift + 0.2, pose.c2.open, 1.05, far, true, cs);
    legs(p, pose, { n: 4, hipX: bx - 11, hipY: by + 5, footY: 43, span: 18, splay: 4.8, ramp: r, tip: acc.c[4], r0: 1.7, r1: 1.0, kneeUp: 2.8, kneeOut: 4.4, bias: -0.1, hipDrop: 1.2 });
    // spikes along the back, angled away from the head
    for (let k = 0; k < 3; k++) { const sx = bx - 11 + k * 5; p.poly([[sx, by - 6 - k * 0.6], [sx - 3, by - 14 - k], [sx + 3, by - 7.5 - k * 0.6]], acc, {}); p.px(sx - 2, by - 12 - k, acc.c[4]); }
    shell(p, bx, by, 15, 9.4 - sq * 1.8, r, { seed: 5, plates: 0, spots: 0, ridge: 9, rim: r.c[1], bellyRamp: r.tint(0, 0.5, 1.1) });
    // overlapping armour bands following the dome
    for (let k = 0; k < 3; k++) { const rr = 5.5 + k * 3.2; for (let a = -2.7; a < -0.2; a += 0.12) { const x = bx - 2 + cos(a) * (rr + 4), y = by + 4 + sin(a) * rr; p.px(rd(x), rd(y), r.c[1]); p.px(rd(x), rd(y - 1), r.c[4]); } }
    p.line(rd(bx - 12), rd(by + 2), rd(bx + 12), rd(by + 1), r.c[1]);
    for (let k = 0; k < 4; k++) p.px(rd(bx - 7 + k * 5), rd(by - 3 + (k % 2)), acc.c[4]);
    // shoulder plate over the claw root
    p.shape(acc, { dither: 0.3 }, (s2) => s2.ellipse(bx + 10, by - 2, 4.2, 3.4)); p.px(bx + 9, by - 4, acc.c[4]);
    const ey = rd(by - 12 + sq * 2), shut = pose.shut || sq > 0.6;
    eyeStalk(p, bx + 3, ey, by - 7, { shut, stalk: far.c[1], r: 2.4 }); eyeStalk(p, bx + 9.5, ey - 0.5, by - 7, { shut, stalk: far.c[1], r: 2.4 });
    if (duel) p.chain([[bx - 8, by - 6], [bx - 15, by - 13 + (pose.bob || 0)], [bx - 22, by - 9]], 1.3, 0.7, R.crimson, { outline: false });
    claw(p, bx + 12, by + 2, pose.c1.ext, pose.c1.lift + 0.15, pose.c1.open, duel ? 1.3 : 1.55, r, false, { ...cs, edge: duel ? undefined : acc.c[4] });
    if (pose.glow > 0) p.glow(bx + 5, by, 18, duel ? '#ff90a8' : '#a8d8ff', 0.35 * pose.glow);
  },
};

// ---- Abyssal Stalker: a deep swimming crab with a glowing shell, lateral spines and an angler's lure -------------------------
FORMS.abyssal = {
  w: 100, h: 60, ax: 44, ay: 42, hit: [22, 14],
  paint(p, pose, o) {
    const r = o.ramp, far = o.far, acc = o.accent, glow = o.glow, sq = pose.squash, br = o.branch, T = (pose.legT || 0) * TAU;
    const cx = 42 + rd(pose.lunge * 0.8), cy = bobY(pose, 29, sq * 0.7), pulse = 0.6 + 0.4 * sin(T + (pose.glow || 0) * 3);
    const eyeBall = new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']);
    // far legs and far claw (behind the shell)
    legs(p, pose, { n: 4, hipX: cx - 10, hipY: cy + 4, footY: cy + 20, span: 16, splay: 13, trail: 6, ramp: far, tip: far.c[3], r0: 1.3, r1: 0.7, kneeUp: 6, kneeOut: 8 });
    claw(p, cx + 13, cy + 1, pose.c2.ext, pose.c2.lift + 0.1, pose.c2.open, 1.5, far, true, { jaw: 1.25, thin: 0.85 });
    // lateral spines, one at each end of the carapace
    p.poly([[cx - 12, cy - 3], [cx - 27, cy - 10], [cx - 11, cy + 3]], r.tint(0, 1, 0.9), {});
    p.poly([[cx - 13, cy + 2], [cx - 25, cy + 3], [cx - 11, cy + 6]], r.tint(0, 1, 0.8), {});
    shell(p, cx, cy, 17, 9 - sq, r.tint(0, 1, 0.82), { seed: 7, plates: 0, spots: 0, ridge: 8, belly: true, bellyRamp: r.tint(0, 0.6, 1.3) });
    // veins of light across the shell
    for (let i = 0; i < 4; i++) { const x0 = cx - 12 + i * 6; p.line(rd(x0), rd(cy - 6), rd(x0 + 2), rd(cy + 2), r.c[1]); const v = (pulse > 0.7 || pose.glow > 0.3) ? glow : r.c[3]; p.px(rd(x0 + 1), rd(cy - 2), v); p.px(rd(x0 + 2), rd(cy + 1), v); }
    if (br === 'venom') for (let i = 0; i < 3; i++) p.poly([[cx - 13 + i * 5, cy - 7], [cx - 12 + i * 5, cy - 15 - (i % 2) * 2], [cx - 8 + i * 5, cy - 7.5]], acc, {});
    for (let i = 0; i < 6; i++) { const gx = cx - 13 + i * 5, gy = cy + 3 + (i % 2); p.px(rd(gx), rd(gy), glow); }
    // near legs
    legs(p, pose, { n: 4, hipX: cx - 12, hipY: cy + 5, footY: cy + 21, span: 18, splay: 13, trail: 5, ramp: r, tip: r.c[4], r0: 1.6, r1: 0.9, kneeUp: 6, kneeOut: 8, bias: -0.1 });
    // eyes
    const shut = pose.shut;
    eyeStalk(p, cx + 9, cy - 13, cy - 7, { shut, stalk: r.c[2], thick: true, r: 2.6, pupil: '#0a2a20', glow }); eyeStalk(p, cx + 15, cy - 12, cy - 7, { shut, stalk: r.c[2], thick: true, r: 2.6, pupil: '#0a2a20', glow });
    // lure on a curved rod arching over the head
    const lx = cx + 27, ly = cy - 16 + sin(T) * 1.6;
    p.chain([[cx - 3, cy - 8], [cx + 1, cy - 20], [cx + 13, cy - 24], [lx, ly]], 1.1, 0.7, R.chain, { outline: false });
    p.glow(lx, ly, br === 'lumen' ? 15 : 10, glow, br === 'lumen' ? 0.75 : 0.55); p.ellipse(lx, ly, br === 'lumen' ? 3.2 : 2.5, br === 'lumen' ? 3.2 : 2.5, new Ramp([acc.hex[2], acc.hex[3], acc.hex[4], '#ffffff', '#ffffff']), { dither: 0 });
    claw(p, cx + 13, cy + 3, pose.c1.ext, pose.c1.lift + 0.1, pose.c1.open, 1.85, r, false, { jaw: 1.25, thin: 0.95, palm: 1.05, edge: br === 'venom' ? '#b8ffb0' : undefined });
    if (pose.glow > 0) p.glow(cx + 5, cy, 22, glow, 0.3 * pose.glow);
  },
};

// ---- Ancient Leviathan: a colossal king crab, barnacled and coral-crowned ---------------------------------------------------
FORMS.leviathan = {
  w: 152, h: 84, ax: 62, ay: 56, hit: [40, 22],
  paint(p, pose, o) {
    const r = o.ramp, far = o.far, acc = o.accent, glow = o.glow, sq = pose.squash, br = o.branch, T = (pose.legT || 0) * TAU;
    const cx = 56 + rd(pose.lunge * 0.8), cy = bobY(pose, 38, sq), t = pose.tail || 0;
    const tb = br === 'tidebreaker';
    // far legs and claw
    legs(p, pose, { n: 4, hipX: cx - 22, hipY: cy + 8, footY: 56, span: 38, splay: 9, trail: 8, ramp: far, tip: far.c[3], r0: 2.4, r1: 1.2, kneeUp: 7, kneeOut: 8, hipDrop: 1.5 });
    claw(p, cx + 24, cy - 1, pose.c2.ext, pose.c2.lift + 0.1, pose.c2.open, 2.6, far, true, { jaw: 1.1, palm: 1.05, thin: 1.1 });
    // coral crown growing off the back
    for (let k = 0; k < 5; k++) { const bx2 = cx - 20 + k * 8, hh = 7 + ((k * 5) % 7); const cr = [R.coralPink, R.coralOrange, R.coralBlue, R.coralRed, R.coralPink][k]; p.chain([[bx2, cy - 10], [bx2 + (k % 2 ? 2 : -2), cy - 10 - hh * 0.6], [bx2 + (k % 2 ? -1 : 3), cy - 10 - hh]], 2.0, 0.9, tb ? R.coralOrange : cr, { dither: 0.4 }); }
    // spiked rim and the great carapace
    for (let k = 0; k < 7; k++) { const sx = cx - 24 + k * 7.4, sy = cy - 12 + Math.abs(k - 3) * 1.3; p.poly([[sx - 2, sy + 2], [sx, sy - 6 - (k === 3 ? 3 : 0)], [sx + 2.4, sy + 2]], r.tint(0, 1, 1.1), {}); }
    shell(p, cx, cy, 26, 15 - sq * 1.5, r, { seed: 9, plates: 5, spots: 5, ridge: 12, front: true, belly: true, bellyRamp: r.tint(0, 0.5, 1.15), grain: 0.08 });
    // barnacles
    for (let k = 0; k < 9; k++) { const a = -2.8 + k * 0.45, bx3 = cx - 3 + cos(a) * 20, by3 = cy + 1 + sin(a) * 9; p.ellipse(bx3, by3, 1.6, 1.2, R.bone, { dither: 0.2 }); p.px(rd(bx3), rd(by3), '#251a24'); }
    if (tb) { for (let k = 0; k < 5; k++) { const x0 = cx - 18 + k * 8; p.line(rd(x0), rd(cy - 8), rd(x0 + 3), rd(cy + 1), glow); p.line(rd(x0 + 3), rd(cy + 1), rd(x0 + 1), rd(cy + 7), glow); } p.poly([[cx + 26, cy - 6], [cx + 38, cy - 14], [cx + 32, cy - 1]], R.bone, {}); p.glow(cx, cy, 24, glow, 0.14); }
    else if (br === 'tideweaver') { for (let k = 0; k < 6; k++) { const gx = cx - 20 + k * 7, gy = cy - 3 + (k % 2) * 5; p.px(rd(gx), rd(gy), glow); p.px(rd(gx + 1), rd(gy - 1), '#ffffff'); p.px(rd(gx), rd(gy + 1), glow); } for (let k = 0; k < 3; k++) { const a = T + k * 2.1; p.ellipse(cx - 10 + k * 16, cy - 26 + sin(a) * 3, 2.6, 2.6, R.glass, { dither: 0.3 }); } }
    // near legs
    legs(p, pose, { n: 4, hipX: cx - 24, hipY: cy + 10, footY: 58, span: 42, splay: 10, trail: 8, ramp: r, tip: acc.c[3], r0: 2.9, r1: 1.4, kneeUp: 7, kneeOut: 9, bias: -0.1, hipDrop: 1.5 });
    // heavy eyes and brow
    const ey = rd(cy - 15 + sq * 2), shut = pose.shut;
    p.poly([[cx + 12, cy - 12], [cx + 20, cy - 17], [cx + 31, cy - 12], [cx + 22, cy - 9]], r.tint(0, 1, 0.8), {});
    eyeStalk(p, cx + 17, ey, cy - 11, { shut, stalk: r.c[1], thick: true, r: 3.2, ball: new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']), pupil: '#120a1a', glow }); eyeStalk(p, cx + 27, ey + 1, cy - 11, { shut, stalk: r.c[1], thick: true, r: 3.2, ball: new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']), pupil: '#120a1a', glow });
    const [wx, wy] = claw(p, cx + 26, cy + 6, pose.c1.ext, pose.c1.lift + 0.1, pose.c1.open, 3.1, r, false, { jaw: 1.1, palm: 1.05, thin: 1.1, edge: tb ? '#ffd8a0' : '#d8f8ff' });
    for (let k = 0; k < 3; k++) p.px(rd(wx + 7 + k * 3), rd(wy - 3 + (k % 2)), '#f8f0d8');
    if (pose.glow > 0) p.glow(cx + 14, cy, 32, glow, 0.3 * pose.glow);
  },
};

// ---- Thalassarch (Mythic) and the Unmolted (secret): a crowned crystal crab wrapped in tide-silk ----------------------------------
const NACRE = {
  tidebreaker: { ramp: new Ramp(['#3a1a3e', '#7a3a6e', '#c4608a', '#f8a0a8', '#fff0dc']), far: new Ramp(['#240e2a', '#4a2048', '#7a3a68', '#b06088', '#e0a0b0']), accent: R.gold, glow: '#ffd890' },
  tideweaver: { ramp: new Ramp(['#101e4a', '#223a84', '#3e6cc4', '#86b8f0', '#e8fbff']), far: new Ramp(['#0a1230', '#162a5c', '#2a4a8c', '#5a88c0', '#a0d0ea']), accent: R.gold, glow: '#9af0ff' },
  none: { ramp: new Ramp(['#241e5a', '#4a3e9a', '#7a68d4', '#b8a8f8', '#f4eeff']), far: new Ramp(['#14103a', '#2c2468', '#4a3e98', '#7a6ac4', '#b8aef0']), accent: R.gold, glow: '#c8b8ff' },
};
registerFormRamps({
  mythic: (st) => { const lin = st.branches.leviathan, b = NACRE[lin] || NACRE.none; return { ...b, branch: lin }; },
  primordial: () => ({ ramp: new Ramp(['#8e82ac', '#c8bede', '#f0eaf8', '#fffaf0', '#ffffff']), far: new Ramp(['#5e5484', '#9a90bc', '#c8bede', '#ece6f6', '#ffffff']), accent: R.gold, glow: '#fff6c0', branch: 'primordial' }),
});
// flowing tide-legs: tapered tendrils that undulate, stream back when swimming and curl up when tucked
function tendrils(p, pose, o) {
  const T = (pose.legT || 0) * TAU, mode = pose.legs || 'idle';
  for (let i = 0; i < o.n; i++) {
    const hx = o.hipX + i * o.span / (o.n - 1), hy = o.hipY, k = (i - (o.n - 1) / 2) / ((o.n - 1) / 2);
    const back = mode === 'trail' || mode === 'kick' ? 10 : 0, len = mode === 'tuck' ? o.len * 0.5 : o.len;
    const w1 = sin(T + i * 1.3) * 2.4, w2 = sin(T + i * 1.3 + 1.2) * 3.4;
    const pts = [[hx, hy], [hx + k * 4 - back * 0.4 + w1, hy + len * 0.35], [hx + k * 7 - back * 0.8 + w2, hy + len * 0.68], [hx + k * 8 - back + w1 * 0.7, hy + len]];
    p.chain(pts, o.r0, o.r1, o.ramp, { dither: 0.5, bias: o.bias || 0 });
    p.glow(pts[3][0], pts[3][1], 3.5, o.tip, 0.3, 2);
  }
}
function mythic(p, pose, o, primordial) {
  const r = o.ramp, far = o.far, acc = o.accent, glow = o.glow, sq = pose.squash;
  const cx = 58 + rd(pose.lunge * 0.8), cy = bobY(pose, 48, sq), ph = (pose.legT || 0) * TAU + (pose.glow || 0) * 2;
  const eyeBall = new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']), crown = R.gold, cape = primordial ? R.gold : (o.branch === 'tidebreaker' ? R.coralPink : R.divine);
  // tide-silk streaming behind
  for (let i = 0; i < 5; i++) { const yy = cy - 12 + i * 5.6, sw = sin(ph + i * 0.8) * 3; p.chain([[cx - 14, yy], [cx - 28, yy + sw], [cx - 42 - i * 2, yy + 2 + sw * 1.4], [cx - 58 - i * 2, yy + 5 + sw * 1.8]], 3.4 - i * 0.3, 0.6, cape, { dither: 0.5, outline: false, bias: 0.1 }); }
  // far water-legs and claw
  tendrils(p, pose, { n: 4, hipX: cx - 14, hipY: cy + 8, span: 28, len: 21, ramp: far, tip: glow, r0: 2.2, r1: 0.8 });
  claw(p, cx + 16, cy - 3, pose.c2.ext, pose.c2.lift + 0.2, pose.c2.open, 2.2, far, true, { jaw: 1.2, thin: 0.9 });
  // faceted crystal carapace, a gem at its heart
  p.shape(r, { dither: 0.5, bias: -0.14, contrast: 1.3, texture: { seed: 21, p: 0.04 } }, (s) => { s.ellipse(cx - 2, cy, 22, 14 - sq); s.ellipse(cx + 12, cy - 1, 10, 10); });
  p.poly([[cx - 20, cy - 1], [cx - 9, cy - 13], [cx + 3, cy - 4], [cx - 9, cy + 7]], r.tint(0.55, 0.5, 0.9), { outline: false, bias: -0.1 });
  p.poly([[cx + 3, cy - 4], [cx + 11, cy - 12], [cx + 15, cy], [cx + 4, cy + 8]], r.tint(0.5, 0.4, 0.95), { outline: false, bias: -0.1 });
  p.line(cx - 9, cy - 13, cx - 9, cy + 7, r.c[1]); p.line(cx - 20, cy - 1, cx + 3, cy - 4, r.c[1]); p.line(cx + 3, cy - 4, cx + 15, cy, r.c[1]);
  p.glow(cx - 7, cy - 2, 13, glow, 0.5); p.ellipse(cx - 7, cy - 2, 3.6, 4, eyeBall, { dither: 0 });
  for (let i = 0; i < 7; i++) { const a = -2.95 + i * 0.45; p.px(rd(cx - 2 + cos(a) * 20), rd(cy + sin(a) * 13), glow); }
  p.line(cx - 20, cy + 6, cx + 18, cy + 6, crown.c[3]);
  // near water-legs
  tendrils(p, pose, { n: 4, hipX: cx - 16, hipY: cy + 9, span: 30, len: 23, ramp: r.tint(0, 0.9, 1.0), tip: glow, r0: 2.8, r1: 0.9, bias: -0.1 });
  // eyes on stalks and the crown of spires between them
  const ey = rd(cy - 17 + sq * 2), shut = pose.shut;
  for (let i = 0; i < 5; i++) { const sx = cx + 6 + i * 3.8, hh = 10 + (i === 2 ? 9 : i % 2 ? 0 : 4); p.poly([[sx - 2.2, cy - 11], [sx + 0.2, cy - 11 - hh], [sx + 2.6, cy - 11]], crown, {}); p.px(rd(sx), rd(cy - 10 - hh), '#ffffff'); }
  eyeStalk(p, cx + 4, ey, cy - 10, { shut, stalk: r.c[1], thick: true, r: 3, ball: eyeBall, pupil: '#0a1428', glow }); eyeStalk(p, cx + 22, ey + 1, cy - 9, { shut, stalk: r.c[1], thick: true, r: 3, ball: eyeBall, pupil: '#0a1428', glow });
  p.line(cx + 3, cy - 11, cx + 24, cy - 11, crown.c[1]);
  // orbiting pearl blades
  for (let i = 0; i < 3; i++) { const a = ph * 0.7 + i * (TAU / 3), ox = cx - 4 + cos(a) * 34, oy = cy - 6 + sin(a) * 18; p.shape(R.pearl, { dither: 0.3 }, (s) => s.poly([[ox - 4, oy + 2], [ox + 1, oy - 6], [ox + 5, oy + 2], [ox + 1, oy + 4]])); p.glow(ox, oy, 7, glow, 0.35); }
  const [wx, wy] = claw(p, cx + 20, cy + 5, pose.c1.ext, pose.c1.lift + 0.1, pose.c1.open, 2.45, r, false, { jaw: 1.15, palm: 1.0, edge: crown.hex[4] });
  p.px(rd(wx + 1), rd(wy - 3), crown.c[4]);
  const haloR = 30 + (pose.glow || 0) * 8; p.glow(cx, cy, haloR, glow, primordial ? 0.35 : 0.2, 5);
  if (primordial) for (let i = 0; i < 16; i++) { const a = i * 2.4 + ph, rr = 8 + (i * 5) % 22; p.px(rd(cx - 4 + cos(a) * rr), rd(cy + sin(a) * rr * 0.7), '#ffffff'); }
}
FORMS.mythic = { w: 150, h: 96, ax: 64, ay: 58, hit: [34, 20], paint: (p, pose, o) => mythic(p, pose, o, false) };
FORMS.primordial = { w: 150, h: 96, ax: 64, ay: 58, hit: [34, 20], paint: (p, pose, o) => mythic(p, pose, o, true) };
