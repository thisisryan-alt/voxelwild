// Crab construction kit: jointed legs, articulated claws, eye stalks and shells. Every hero form is built from
// these so the whole line reads as one animal growing up. All pieces face right and draw into a Painter.
import { R } from './palette.js';
import { OUTLINE } from './palette.js';

const sin = Math.sin, cos = Math.cos, TAU = Math.PI * 2, rd = Math.round;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- legs ------------------------------------------------------------------------------------------------
// o: { n, hipX, hipY, footY, span, splay, ramp, tip, r0, r1, kneeUp, kneeOut, stride, lift, trail }
export function legs(p, pose, o) {
  const n = o.n, span = o.span ?? 4 * (n - 1), mode = pose.legs || 'idle', T = pose.legT || 0;
  for (let i = 0; i < n; i++) {
    const side = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;           // -1 (rear) .. 1 (front)
    const hx = o.hipX + (n > 1 ? (i * span) / (n - 1) : 0), hy = o.hipY + Math.abs(side) * (o.hipDrop ?? 0.8);
    let fx = hx + side * (o.splay ?? 2.5), fy = o.footY, lift = 0;
    const ph = T + (i % 2) * 0.5 + i * 0.06;
    if (mode === 'walk') { fx += sin(ph * TAU) * (o.stride ?? 2.4); lift = Math.max(0, cos(ph * TAU)) * (o.lift ?? 2.2); }
    else if (mode === 'trail') { fx = hx - (o.trail ?? 3) - (i % 2); lift = (fy - hy) * 0.3 - sin((T + i * 0.2) * TAU) * 0.6; }
    else if (mode === 'kick') { fx = hx - 2 - T * 3; lift = 1 + T * 2; }
    else if (mode === 'spread') { fx = hx + side * 4.5; lift = 1 + (i % 2) * 1.5; }
    else if (mode === 'tuck') { lift = (fy - hy) * 0.55; fx = hx + side; }
    else if (mode === 'idle') { fx += sin((T + i * 0.3) * TAU) * 0.0; }
    fy -= lift;
    const kx = (hx + fx) / 2 + side * (o.kneeOut ?? 2.5), ky = Math.min(hy, fy) - (o.kneeUp ?? 1.5) + (mode === 'tuck' ? 2 : 0);
    p.chain([[hx, hy], [kx, ky], [fx, fy]], o.r0 ?? 1.3, o.r1 ?? 0.8, o.ramp, { dither: o.dither ?? 0.3, bias: o.bias ?? 0, outline: o.outline });
    if (o.tip) p.px(rd(fx), rd(fy), o.tip);
    if (o.joint) p.px(rd(kx), rd(ky - 1), o.joint);
  }
}

// ---- claw ------------------------------------------------------------------------------------------------
// shoulder (sx,sy); ext 0..1 reach; lift -1..1; open 0..1; scale; st: { jaw, palm, thin, reach, edge, teeth, blade, hook }
export function claw(p, sx, sy, ext, lift, open, scale, ramp, back, st = {}) {
  const S = scale, jaw = st.jaw ?? 1, palm = st.palm ?? 1, th = st.thin ?? 1;
  const reach = (3.2 + ext * 5.2) * S * (st.reach ?? 1), up = -lift * 6 * S;
  const wx = sx + reach, wy = sy + up, ex = sx + reach * 0.42, ey = sy + up * 0.35 - 2.4 * S * 0.6;
  p.chain([[sx, sy], [ex, ey], [wx, wy]], 1.9 * S * th, 1.5 * S * th, ramp, { dither: 0.3 });
  p.shape(ramp, { dither: 0.35, texture: st.texture }, (s) => { s.ellipse(wx, wy, 3.4 * S * palm, 2.9 * S * palm); });
  const L = 7 * S * jaw, a = 0.12 + open * 0.85, bx = wx + 2.2 * S * palm;
  // fixed finger (lower) and moving finger (upper), both tapering to a point
  const lowTip = [bx + L * cos(0.1), wy + 1.1 * S + L * sin(0.1) * 0.6], upTip = [bx + L * cos(-a) * 1.02, wy - 1.1 * S + L * sin(-a)];
  p.shape(ramp, { dither: 0.3 }, (s) => { s.capsule(bx - 1, wy + 1.2 * S, lowTip[0], lowTip[1], 2.3 * S * th, 0.7); });
  p.shape(ramp, { dither: 0.3 }, (s) => { s.capsule(bx - 1, wy - 1.2 * S, upTip[0], upTip[1], 2.6 * S * th, 0.7); });
  if (!back) {
    const hi = ramp.c[4], md = ramp.c[3];
    p.px(rd(wx - S), rd(wy - 2.4 * S), hi); p.px(rd(wx), rd(wy - 2.6 * S), hi); p.px(rd(wx - 2 * S), rd(wy - 1.4 * S), md);
    if (st.teeth !== false) for (let k = 1; k < 4; k++) { const u = k / 4; p.px(rd(lerp(bx, lowTip[0], u)), rd(lerp(wy + 1.2 * S, lowTip[1], u) - 1), hi); p.px(rd(lerp(bx, upTip[0], u)), rd(lerp(wy - 1.2 * S, upTip[1], u) + 1), md); }
  }
  if (st.edge) p.line(rd(bx), rd(wy - 1.2 * S), rd(upTip[0]), rd(upTip[1]), st.edge);
  if (st.blade) p.line(rd(wx), rd(wy), rd(upTip[0] + 2), rd(upTip[1] - 1), st.blade);
  return [wx, wy, lowTip, upTip];
}
const lerp = (a, b, t) => a + (b - a) * t;

// ---- eyes --------------------------------------------------------------------------------------------------
export function eyeStalk(p, x, y, baseY, o = {}) {
  const { shut = false, r = 2.4, stalk, glow, pupil = '#170d1c', look = 1 } = o;
  if (stalk) { p.line(rd(x), rd(baseY), rd(x), rd(y + r - 0.5), stalk); if (o.thick) p.line(rd(x - 1), rd(baseY), rd(x - 1), rd(y + r - 0.5), stalk); }
  if (shut) { p.line(rd(x - 2), rd(y), rd(x + 1), rd(y), OUTLINE); return; }
  p.ellipse(x, y, r, r, o.ball || R.eyeWhite, { dither: 0 });
  const px = rd(x + look * 0.5 - 0.5), py = rd(y - 0.2);
  p.px(px, py, pupil); p.px(px + 1, py, pupil); p.px(px, py + 1, pupil); p.px(px + 1, py + 1, pupil);
  p.px(rd(x - 1.4), rd(y - 1.6), '#ffffff');
  if (glow) p.glow(x, y, r * 3.4, glow, 0.28, 3);
}

// ---- shell -------------------------------------------------------------------------------------------------
// A domed carapace with a lit ridge, growth plates and a pale underside. o: { belly, plates, spots, seed, rimY }
export function shell(p, cx, cy, rx, ry, ramp, o = {}) {
  p.shape(ramp, { dither: o.dither ?? 0.42, texture: { seed: o.seed || 3, p: o.grain ?? 0.06 }, bias: o.bias ?? 0, contrast: o.contrast }, (s) => { s.ellipse(cx, cy, rx, ry); if (o.front) s.ellipse(cx + rx * 0.55, cy + ry * 0.05, rx * 0.5, ry * 0.8); });
  if (o.belly !== false) p.ellipse(cx - 1, cy + ry * 0.62, rx * 0.8, Math.max(1.6, ry * 0.3), o.bellyRamp || R.belly, { outline: false, dither: 0.25 });
  // lit ridge along the top-left of the dome
  for (let k = 0; k < (o.ridge ?? 6); k++) { const a = -2.7 + k * 0.32; p.px(rd(cx + cos(a) * (rx - 1.6)), rd(cy + sin(a) * (ry - 1.4)), k < 2 ? ramp.c[4] : ramp.c[3]); }
  // growth plates: curved dark lines down the dome
  const np = o.plates ?? 3;
  for (let k = 0; k < np; k++) { const u = (k + 1) / (np + 1), x = cx - rx * 0.78 + u * rx * 1.5; p.line(rd(x), rd(cy - ry * 0.74), rd(x + 1), rd(cy + ry * 0.3), ramp.c[1]); }
  for (let k = 0; k < (o.spots ?? 3); k++) { const a = -1.9 + k * 0.7; p.px(rd(cx + cos(a) * rx * 0.45), rd(cy + sin(a) * ry * 0.35 + 1), ramp.c[1]); }
  if (o.rim) p.line(rd(cx - rx + 1), rd(cy + 1), rd(cx + rx - 2), rd(cy + 1), o.rim);
}

// small helpers shared by the forms
export const bobY = (pose, base, sq = 0) => rd(base + (pose.bob || 0) + sq * 3);
export const breathe = (pose) => sin((pose.legT || 0) * TAU) * 0.4;
export { sin, cos, TAU, rd, clamp, lerp };
