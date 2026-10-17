// Evolution painters: Warrior Crab, Abyssal Predator, Ancient Leviathan, Thalassarch (Mythic) and the secret Unmolted.
// Each reads the shared pose model (see sprites_player.js) so every form has the full animation set.
import { FORMS, registerFormRamps, legsPose, claw, eye } from './sprites_player.js';
import { Ramp } from './painter.js';
import { R } from './palette.js';

const TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos;
const round = Math.round;
const c4 = (ramp) => ramp.c[4];

// ---- palettes per form/branch ------------------------------------------------------------------------
const WAR = { bulwark: { ramp: R.steel, far: R.steel.tint(0, 1, 0.65), accent: R.bone }, duelist: { ramp: R.crimson, far: R.crimson.tint(0, 1, 0.65), accent: R.gold }, none: { ramp: R.steel.tint(-0.04), far: R.steel.tint(-0.04, 1, 0.6), accent: R.bone } };
const ABY = { venom: { ramp: new Ramp(['#0a1a1e', '#16363a', '#2a5c54', '#46887a', '#8ac8aa']), far: new Ramp(['#060e12', '#0e2226', '#183a38', '#2a5a50', '#4a8a78']), accent: R.venom, glow: '#7aff9a' }, lumen: { ramp: new Ramp(['#0a1230', '#152458', '#2a4a8a', '#4a7ac0', '#9ac8f0']), far: new Ramp(['#060a1c', '#0e1838', '#182c58', '#2a4a80', '#4a74b0']), accent: R.lumen, glow: '#a0f8ff' }, none: { ramp: R.abyssal, far: R.abyssal.tint(0, 1, 0.6), accent: R.lumen, glow: '#a0f8ff' } };
const LEV = { tidebreaker: { ramp: R.leviathan.tint(0.02, 1.2, 1), far: R.leviathan.tint(0.02, 1, 0.65), accent: R.coralOrange, glow: '#ffb44a' }, tideweaver: { ramp: new Ramp(['#0e1e30', '#1e3e5a', '#34688a', '#5a9ab8', '#a8dcea']), far: new Ramp(['#08121e', '#122438', '#1e405a', '#34688a', '#5a9ab8']), accent: R.divine, glow: '#8af0e8' }, none: { ramp: R.leviathan, far: R.leviathan.tint(0, 1, 0.65), accent: R.coralOrange, glow: '#ffb44a' } };
registerFormRamps({
  warrior: (s) => { const b = WAR[s.branches.warrior] || WAR.none; return { ...b, branch: s.branches.warrior }; },
  abyssal: (s) => { const b = ABY[s.branches.abyssal] || ABY.none; return { ...b, branch: s.branches.abyssal }; },
  leviathan: (s) => { const b = LEV[s.branches.leviathan] || LEV.none; return { ...b, branch: s.branches.leviathan }; },
  mythic: (s) => { const lin = s.branches.leviathan; return { ramp: R.pearl, far: R.pearl.tint(0, 0.8, 0.7), accent: lin === 'tidebreaker' ? R.gold : R.divine, glow: lin === 'tidebreaker' ? '#ffe890' : '#9af0ff', branch: lin }; },
  primordial: () => ({ ramp: new Ramp(['#7a86c8', '#b8c4f0', '#e8eeff', '#fffaf0', '#ffffff']), far: new Ramp(['#4a5698', '#8a96d0', '#b8c4f0', '#e8eeff', '#ffffff']), accent: R.gold, glow: '#ffffff', branch: 'primordial' }),
});

// ---- Warrior Crab -----------------------------------------------------------------------------------------
FORMS.warrior = {
  w: 58, h: 42, ax: 29, ay: 38, hit: [14, 12],
  paint(p, pose, o) {
    const r = o.ramp, far = o.far, acc = o.accent, sq = pose.squash, br = o.branch;
    const lun = round(pose.lunge * 0.5), by = round(24 + pose.bob + sq * 3), bx = 25 + lun;
    const cs = br === 'bulwark' ? { jaw: 1.15, palm: 1.05, thin: 1.15 } : br === 'duelist' ? { jaw: 1.55, palm: 0.85, thin: 0.7, edge: '#ffe8e8' } : { jaw: 1.1 };
    legsPose(p, pose, bx - 9, by + 6, 38, 4, [far.c[1], far.c[2]], 5, 1);
    claw(p, bx + 10, by - 1, pose.c2.ext, pose.c2.lift + 0.2, pose.c2.open, 1.05, far, true, cs);
    // rear spikes + carapace
    p.poly([[bx - 10, by - 5], [bx - 15, by - 11], [bx - 7, by - 8]], acc, {});
    p.shape(r, { texture: { seed: 5, p: 0.05 } }, (s) => { s.ellipse(bx, by, 14, 9.5 - sq * 1.8); });
    p.ellipse(bx - 1, by + 5 - sq, 9.5, 2.6, R.belly, { outline: false, dither: 0.25 });
    for (let k = 0; k < 4; k++) { p.line(bx - 9 + k * 5, by - 7, bx - 8 + k * 5, by + 3, r.c[1]); p.px(bx - 10 + k * 5, by - 5, r.c[4]); p.px(bx - 9 + k * 5, by - 6, r.c[3]); }
    p.line(bx - 11, by - 4, bx + 9, by - 6, r.c[3]);
    p.poly([[bx - 7, by - 7], [bx - 4, by - 16], [bx - 1, by - 7]], acc, {});
    p.px(bx - 4, by - 13, c4(acc));
    legsPose(p, pose, bx - 8, by + 6, 39, 4, [r.c[1], r.c[4]], 5, 2);
    const ey = round(by - 12 + sq * 2), shut = pose.shut || sq > 0.6;
    p.line(bx + 4, by - 6, bx + 4, ey + 2, far.c[1]); p.line(bx + 10, by - 5, bx + 10, ey + 2, far.c[1]);
    eye(p, bx + 4, ey, shut, 0, 2.1); eye(p, bx + 10, ey, shut, 0, 2.1);
    if (br === 'duelist') { p.chain([[bx - 2, by - 9], [bx - 9, by - 17 + (pose.bob)], [bx - 15, by - 14]], 1.4, 0.7, R.crimson, { outline: false }); }
    claw(p, bx + 11, by + 1, pose.c1.ext, pose.c1.lift + 0.15, pose.c1.open, br === 'bulwark' ? 1.45 : 1.3, r, false, cs);
    if (pose.glow > 0) p.glow(bx + 5, by, 18, br === 'duelist' ? '#ff90a8' : '#a8d8ff', 0.35 * pose.glow);
  },
};

// ---- Abyssal Predator -----------------------------------------------------------------------------------------
FORMS.abyssal = {
  w: 84, h: 52, ax: 42, ay: 38, hit: [22, 14],
  paint(p, pose, o) {
    const r = o.ramp, far = o.far, acc = o.accent, glow = o.glow, sq = pose.squash, br = o.branch;
    const lun = round(pose.lunge * 0.8), cy = round(30 + pose.bob + sq * 2), cx = 42 + lun;
    const sw = sin((pose.legT || 0) * TAU) * 2 + (pose.legs === 'kick' ? -3 : 0);
    // trailing tail fan + swim-legs (behind)
    p.poly([[cx - 20, cy], [cx - 31, cy - 8 + sw], [cx - 34, cy + sw * 0.5], [cx - 31, cy + 8 + sw]], r.tint(0, 1, 0.8), {});
    p.line(cx - 22, cy, cx - 33, cy + sw * 0.5, acc.c[3]);
    for (let i = 0; i < 4; i++) { const hx = cx - 13 + i * 5, wav = sin((pose.legT || 0) * TAU + i * 0.9) * 2; p.chain([[hx, cy + 4], [hx - 4, cy + 9 + wav], [hx - 8 - (i % 2) * 2, cy + 12 + wav]], 1.4, 1.0, far, { outline: false }); p.ellipse(hx - 9, cy + 12 + wav, 2.4, 1.2, far.tint(0, 1, 1.2), { outline: false, dither: 0 }); }
    // far claw
    claw(p, cx + 11, cy + 1, pose.c2.ext, pose.c2.lift + 0.1, pose.c2.open, 1.6, far, true, { jaw: 1.2 });
    // spines (venom) along the back
    if (br === 'venom') for (let i = 0; i < 5; i++) p.poly([[cx - 14 + i * 5, cy - 6], [cx - 12 + i * 5, cy - 13 - (i % 2) * 2], [cx - 9 + i * 5, cy - 6]], acc, {});
    // main body: elongated carapace + head shield
    p.shape(r, { texture: { seed: 7, p: 0.05 } }, (s) => { s.capsule(cx - 17, cy, cx + 5, cy - 1, 7.5 - sq, 6.5 - sq); s.ellipse(cx + 8, cy - 1, 9, 7 - sq); });
    p.ellipse(cx - 2, cy + 4, 11, 2.4, r.tint(0, 0.6, 1.3), { outline: false, dither: 0.3 });
    for (let k = 0; k < 4; k++) { p.line(cx - 14 + k * 5, cy - 6, cx - 13 + k * 5, cy + 3, r.c[1]); p.px(cx - 15 + k * 5, cy - 5, r.c[4]); }
    // bioluminescent photophores
    const pulse = 0.6 + 0.4 * sin((pose.legT || 0) * TAU + (pose.glow || 0) * 3);
    for (let i = 0; i < 6; i++) { const gx = cx - 15 + i * 4.4, gy = cy - 3 + (i % 2) * 4; p.px(gx, gy, glow); if (pulse > 0.8 || pose.glow > 0.3) p.blend(gx, gy - 1, glow, 0.6); }
    // eyes + lure
    const shut = pose.shut;
    if (shut) { p.line(cx + 6, cy - 5, cx + 10, cy - 5, '#170d1c'); } else { p.ellipse(cx + 11, cy - 4, 2.4, 2.6, new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']), { dither: 0 }); p.px(cx + 12, cy - 4, '#05030a'); p.px(cx + 12, cy - 3, '#05030a'); p.ellipse(cx + 5, cy - 6, 1.8, 2, new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']), { dither: 0 }); p.px(cx + 5, cy - 6, '#05030a'); }
    const lx = cx + 20, ly = cy - 15 + sin((pose.legT || 0) * TAU) * 1.5;
    p.chain([[cx + 7, cy - 7], [cx + 12, cy - 15], [lx, ly]], 0.9, 0.7, R.chain, { outline: false });
    p.glow(lx, ly, br === 'lumen' ? 14 : 9, glow, br === 'lumen' ? 0.75 : 0.55); p.ellipse(lx, ly, br === 'lumen' ? 3 : 2.2, br === 'lumen' ? 3 : 2.2, new Ramp([acc.hex[2], acc.hex[3], acc.hex[4], '#ffffff', '#ffffff']), { dither: 0 });
    // near claw
    claw(p, cx + 12, cy + 3, pose.c1.ext, pose.c1.lift + 0.1, pose.c1.open, 1.9, r, false, { jaw: 1.25, palm: 1.0, edge: br === 'venom' ? '#b8ffb0' : undefined });
    // near swim legs
    for (let i = 0; i < 3; i++) { const hx = cx - 9 + i * 5, wav = sin((pose.legT || 0) * TAU + i * 1.3) * 2; p.chain([[hx, cy + 6], [hx - 3, cy + 10 + wav], [hx - 6 - i, cy + 14 + wav]], 1.6, 1.1, r, { outline: false }); }
    if (pose.glow > 0) p.glow(cx + 5, cy, 20, glow, 0.3 * pose.glow);
  },
};

// ---- Ancient Leviathan --------------------------------------------------------------------------------------------
FORMS.leviathan = {
  w: 124, h: 80, ax: 62, ay: 52, hit: [40, 22],
  paint(p, pose, o) {
    const r = o.ramp, far = o.far, acc = o.accent, glow = o.glow, sq = pose.squash, br = o.branch;
    const lun = round(pose.lunge * 0.8), cy = round(38 + pose.bob + sq * 2), cx = 62 + lun, t = pose.tail || 0;
    const idle = sin((pose.legT || 0) * TAU) * 1.5;
    // telson tail: rises behind and curls forward
    const tail = [[cx - 30, cy + 2], [cx - 44, cy + 4], [cx - 54, cy - 2 + t * 6 + idle], [cx - 56, cy - 14 + t * 12 + idle], [cx - 48, cy - 24 + t * 16 + idle]];
    p.chain(tail, 5, 2, r, { dither: 0.5 });
    const tp = tail[4]; p.poly([[tp[0] - 3, tp[1] + 1], [tp[0] + 9, tp[1] - 9 - t * 3], [tp[0] + 2, tp[1] - 1]], br === 'tidebreaker' ? R.coralOrange : acc, {});
    p.px(tp[0] + 7, tp[1] - 8, '#ffffff');
    // far claw
    claw(p, cx + 18, cy - 1, pose.c2.ext, pose.c2.lift + 0.1, pose.c2.open, 2.7, far, true, { jaw: 1.15, palm: 1.0 });
    // segmented thorax
    for (let i = 5; i >= 0; i--) { const sx = cx - 26 + i * 7, rx = 9 - Math.abs(i - 3) * 0.5, ry = 11 - Math.abs(i - 2.5) * 0.9 - (i === 0 ? 3 : 0); p.shape(i % 2 ? r : r.tint(0, 1, 0.92), { dither: 0.5, texture: { seed: i + 2, p: 0.04 } }, (s) => s.ellipse(sx, cy + (5 - i) * 0.2, rx, ry - sq)); p.line(sx - 3, cy - ry + 2, sx - 3, cy + ry - 3, r.c[1]); p.px(sx - 4, cy - ry + 3, r.c[4]); }
    // paddle legs
    for (let i = 0; i < 4; i++) { const hx = cx - 18 + i * 8, wav = sin((pose.legT || 0) * TAU + i * 1.1) * 2.5; p.chain([[hx, cy + 8], [hx - 3, cy + 14 + wav], [hx - 6, cy + 19 + wav]], 2.2, 1.6, far, { outline: false }); p.ellipse(hx - 7, cy + 20 + wav, 3.6, 1.6, far.tint(0, 1, 1.2), { outline: false, dither: 0 }); }
    // head shield (trilobite cephalon)
    p.shape(r, { dither: 0.5, texture: { seed: 9, p: 0.05 } }, (s) => { s.ellipse(cx + 17, cy - 1, 15, 12.5 - sq); });
    p.poly([[cx + 6, cy - 9], [cx + 17, cy - 21], [cx + 24, cy - 8]], r.tint(0, 1, 0.85), {});   // crest
    p.line(cx + 17, cy - 20, cx + 17, cy - 9, r.c[4]);
    for (const sx of [10, 21]) { p.ellipse(cx + sx, cy - 7, 3.4, 3.8, new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']), { dither: 0 }); p.ellipse(cx + sx + 1, cy - 6, 1.4, 1.8, R.void, { outline: false }); }
    p.glow(cx + 17, cy - 7, 14, glow, 0.3);
    // side spines
    for (let i = 0; i < 4; i++) p.poly([[cx - 22 + i * 8, cy - 10], [cx - 19 + i * 8, cy - 17], [cx - 16 + i * 8, cy - 10]], r.tint(0, 1, 1.2), {});
    // branch decoration
    if (br === 'tidebreaker') { for (let i = 0; i < 5; i++) { const gx = cx - 20 + i * 8; p.line(gx, cy - 2, gx + 3, cy + 6, glow); p.px(gx + 1, cy, '#ffffff'); } p.poly([[cx + 26, cy - 6], [cx + 33, cy - 14], [cx + 31, cy - 3]], R.bone, {}); }
    else if (br === 'tideweaver') { for (let i = 0; i < 6; i++) { const gx = cx - 24 + i * 7; p.px(gx, cy - 3, glow); p.px(gx + 1, cy - 4, '#ffffff'); p.px(gx, cy + 3, glow); } for (let i = 0; i < 3; i++) p.chain([[cx - 8 + i * 9, cy - 12], [cx - 10 + i * 9, cy - 20 + sin((pose.legT || 0) * TAU + i) * 2], [cx - 6 + i * 9, cy - 26]], 1.6, 0.6, acc, { outline: false }); }
    // near claw (huge, serrated)
    const [wx, wy] = claw(p, cx + 20, cy + 5, pose.c1.ext, pose.c1.lift + 0.1, pose.c1.open, 3.1, r, false, { jaw: 1.1, palm: 1.0, edge: br === 'tidebreaker' ? '#ffd8a0' : '#d8f8ff' });
    for (let i = 0; i < 3; i++) p.px(wx + 6 + i * 3, wy - 3 + (i % 2), '#f8f0d8');
    if (pose.glow > 0) p.glow(cx + 14, cy, 30, glow, 0.3 * pose.glow);
  },
};

// ---- Thalassarch (Mythic) + The Unmolted -------------------------------------------------------------------------------
function mythic(p, pose, o, primordial) {
  const r = o.ramp, far = o.far, acc = o.accent, glow = o.glow, sq = pose.squash;
  const lun = round(pose.lunge * 0.8), cy = round(46 + pose.bob + sq * 2), cx = 60 + lun, ph = (pose.legT || 0) * TAU + (pose.glow || 0) * 2;
  const eyeR = new Ramp([glow, glow, '#ffffff', '#ffffff', '#ffffff']);
  const crown = primordial ? R.gold : acc;
  const body = { dither: 0.5, bias: -0.14, contrast: 1.3, texture: { seed: 21, p: 0.04 } };
  // tide cape: translucent flowing streams behind
  for (let i = 0; i < 5; i++) { const yy = cy - 11 + i * 5.5, sw = sin(ph + i * 0.8) * 3; const pts = [[cx - 12, yy], [cx - 26, yy + sw], [cx - 40 - i * 2, yy + 2 + sw * 1.4], [cx - 54 - i * 2, yy + 5 + sw * 1.8]]; p.chain(pts, 3.4 - i * 0.3, 0.6, primordial ? R.pearl : R.divine, { outline: false, dither: 0.6, bias: -0.2 }); }
  // far claw
  claw(p, cx + 14, cy - 3, pose.c2.ext, pose.c2.lift + 0.2, pose.c2.open, 2.4, far, true, { jaw: 1.2, thin: 0.9 });
  // water legs
  for (let i = 0; i < 4; i++) { const hx = cx - 14 + i * 7, wav = sin(ph + i * 1.2) * 2.5; p.chain([[hx, cy + 8], [hx - 4, cy + 15 + wav], [hx - 4, cy + 22 + wav]], 2.4, 1.2, primordial ? R.pearl : R.divine, { dither: 0.5, bias: -0.1 }); }
  // wide faceted carapace
  p.shape(r, body, (s) => { s.ellipse(cx - 2, cy, 21, 13.5 - sq); });
  p.poly([[cx - 18, cy - 1], [cx - 8, cy - 12], [cx + 4, cy - 4], [cx - 8, cy + 6]], r.tint(0.55, 0.5, 0.9), { outline: false, bias: -0.1 });
  p.poly([[cx + 4, cy - 4], [cx + 12, cy - 11], [cx + 14, cy], [cx + 4, cy + 7]], r.tint(0.5, 0.4, 0.95), { outline: false, bias: -0.1 });
  p.line(cx - 8, cy - 12, cx - 8, cy + 6, r.c[1]); p.line(cx - 18, cy - 1, cx + 4, cy - 4, r.c[1]); p.line(cx + 4, cy - 4, cx + 14, cy, r.c[1]);
  p.glow(cx - 6, cy - 2, 12, glow, 0.5); p.ellipse(cx - 6, cy - 2, 3.4, 3.8, eyeR, { dither: 0 });
  for (let i = 0; i < 6; i++) { const a = -2.9 + i * 0.5; p.px(cx - 2 + cos(a) * 19, cy + sin(a) * 12, glow); }
  // pauldron spikes
  p.poly([[cx - 14, cy - 9], [cx - 20, cy - 19], [cx - 8, cy - 12]], r.tint(0, 1, 0.95), {}); p.poly([[cx - 4, cy - 12], [cx - 2, cy - 22], [cx + 4, cy - 10]], r.tint(0, 1, 1), {});
  // head / visor
  p.shape(r, body, (s) => { s.ellipse(cx + 17, cy - 3, 10, 9); });
  p.shape(R.void, { outline: true, flat: 1 }, (s) => { s.rect(cx + 12, cy - 7, 13, 6); });
  if (!pose.shut) { for (const ex of [cx + 15, cx + 21]) { p.px(ex, cy - 5, glow); p.px(ex + 1, cy - 5, '#ffffff'); p.px(ex, cy - 4, glow); p.px(ex + 1, cy - 4, glow); } p.glow(cx + 18, cy - 5, 9, glow, 0.35); }
  // crown of spires, above the visor
  for (let i = 0; i < 5; i++) { const sx = cx + 11 + i * 3.2, hh = 7 + (i === 2 ? 6 : i % 2 ? 0 : 3); p.poly([[sx - 1.6, cy - 11], [sx + 0.2, cy - 11 - hh], [sx + 2, cy - 11]], crown, {}); p.px(sx + 0.2, cy - 10 - hh, '#ffffff'); }
  p.line(cx + 9, cy - 11, cx + 25, cy - 11, crown.c[1]);
  // orbiting pearl blades
  for (let i = 0; i < 3; i++) { const a = ph * 0.7 + i * (TAU / 3), ox = cx - 4 + cos(a) * 30, oy = cy - 6 + sin(a) * 16; p.shape(R.pearl, { dither: 0.3 }, (s) => s.poly([[ox - 4, oy + 2], [ox + 1, oy - 6], [ox + 5, oy + 2], [ox + 1, oy + 4]])); p.glow(ox, oy, 6, glow, 0.3); }
  // near claw — large and crystalline
  const [wx, wy] = claw(p, cx + 18, cy + 4, pose.c1.ext, pose.c1.lift + 0.1, pose.c1.open, 2.8, r, false, { jaw: 1.2, palm: 1.0, edge: crown.hex[4] });
  p.px(wx + 1, wy - 3, crown.c[4]);
  const haloR = 28 + (pose.glow || 0) * 8; p.glow(cx, cy, haloR, glow, primordial ? 0.35 : 0.2, 5);
  if (primordial) for (let i = 0; i < 16; i++) { const a = i * 2.4 + ph, rr = 8 + (i * 5) % 20; p.px(cx - 4 + cos(a) * rr, cy + sin(a) * rr * 0.7, '#ffffff'); }
}
FORMS.mythic = { w: 128, h: 92, ax: 64, ay: 56, hit: [34, 20], paint: (p, pose, o) => mythic(p, pose, o, false) };
FORMS.primordial = { w: 128, h: 92, ax: 64, ay: 56, hit: [34, 20], paint: (p, pose, o) => mythic(p, pose, o, true) };
