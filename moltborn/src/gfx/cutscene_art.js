// Story-panel illustrations: layered, animated scenes built from the game's own backgrounds and sprites.
// Every scene is drawn in 480x270 space from a single time value, with no state, so it can be crossfaded freely.
import { getBackground } from './background.js';
import { playerFrame, variantFor } from './sprites_player.js';
import { enemyFrame } from './sprites_enemies.js';
import { propSprite } from './sprites_world.js';
import { Painter, Ramp } from './painter.js';
import { rng, TAU, lerp, clamp } from '../core/util.js';

const W = 480, H = 270;

// ---- small helpers ------------------------------------------------------------------------------------------
function grad(ctx, stops, x0 = 0, y0 = 0, x1 = 0, y1 = H) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function glow(ctx, x, y, r, col, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
function rays(ctx, t, o = {}) {
  const { n = 7, color = '#ffffff', a = 0.09, x0 = 240, spread = 260, len = 280, seed = 3 } = o, r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const bx = x0 + (r() - 0.5) * spread + Math.sin(t * 0.25 + i * 1.7) * 14, w = 10 + r() * 26, lean = (bx - x0) * 0.45;
    ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(t * 0.6 + i * 2.1)) * (0.5 + r() * 0.7);
    ctx.beginPath(); ctx.moveTo(bx, -10); ctx.lineTo(bx + w, -10); ctx.lineTo(bx + w + lean + 24, len); ctx.lineTo(bx + lean - 24, len); ctx.fill();
  }
  ctx.restore();
}
function motes(ctx, t, o = {}) {
  const { n = 50, color = '#bfefff', seed = 5, speed = 8, size = 1, a = 0.7, drift = 6 } = o, r = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x0 = r() * W, y0 = r() * H, s = speed * (0.4 + r() * 1.2), ph = r() * 6.3, sz = r() < 0.2 ? size + 1 : size;
    const y = ((y0 - t * s) % H + H) % H, x = x0 + Math.sin(t * 0.7 + ph) * drift;
    ctx.globalAlpha = a * (0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + ph)));
    ctx.fillRect(Math.round(x), Math.round(y), sz, sz);
  }
  ctx.globalAlpha = 1;
}
function vignette(ctx, a = 0.55) {
  const g = ctx.createRadialGradient(240, 135, 90, 240, 135, 300); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function sprite(ctx, f, x, y, s = 1, flip = false, alpha = 1) {
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha *= alpha; ctx.translate(Math.round(x), Math.round(y)); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(f.canvas, -f.ax * s, -f.ay * s, f.w * s, f.h * s); ctx.restore();
}

// ---- cached silhouette strips (960 px wide, tiled) ---------------------------------------------------------------
const strips = new Map();
function strip(type, color, seed = 1, h = 150) {
  const key = `${type}|${color}|${seed}|${h}`; let cv = strips.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = 960; cv.height = h; const g = cv.getContext('2d'), r = rng(seed * 97 + type.length); g.fillStyle = color; g.strokeStyle = color;
  const base = h;
  if (type === 'coral') {
    for (let x = 0; x < 960; x += 14 + r() * 30) { const hh = 14 + r() * (h * 0.5); g.beginPath(); g.ellipse(x, base, 10 + r() * 22, hh, 0, Math.PI, 0); g.fill(); if (r() < 0.5) { g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + k * 6, base - hh * 0.6); g.lineTo(x + k * 6 + (r() - 0.5) * 12, base - hh - 10 - r() * 20); g.stroke(); } } }
    g.fillRect(0, base - 6, 960, 6);
  } else if (type === 'kelp') {
    for (let x = 0; x < 960; x += 10 + r() * 18) { const hh = 40 + r() * (h - 50), w = 3 + r() * 3, ph = r() * 6; for (let y = 0; y < hh; y += 2) g.fillRect(Math.round(x + Math.sin(y * 0.07 + ph) * 5), base - y, w, 2); }
  } else if (type === 'spire') {
    for (let x = 0; x < 960; x += 30 + r() * 50) { const w = 18 + r() * 22, hh = 40 + r() * (h - 60); g.fillRect(x - w / 2, base - hh, w, hh); g.beginPath(); g.moveTo(x - w / 2 - 2, base - hh); g.lineTo(x, base - hh - w * 1.2); g.lineTo(x + w / 2 + 2, base - hh); g.fill(); }
  } else if (type === 'column') {
    for (let x = 0; x < 960; x += 60 + r() * 70) { const w = 16 + r() * 12, hh = h * (0.5 + r() * 0.5); g.fillRect(x - w / 2, base - hh, w, hh); g.fillRect(x - w / 2 - 3, base - hh, w + 6, 4); g.fillRect(x - w / 2 - 3, base - 5, w + 6, 5); if (r() < 0.5) { g.clearRect(x - w, base - hh - 2, w * 2, 3 + r() * 6); } }
  } else if (type === 'rock') {
    for (let x = 0; x < 960; x += 20 + r() * 40) { const w = 24 + r() * 50, hh = 20 + r() * (h * 0.7); g.beginPath(); g.moveTo(x - w / 2, base); g.lineTo(x - w * 0.2, base - hh * 0.8); g.lineTo(x + w * 0.05, base - hh); g.lineTo(x + w * 0.35, base - hh * 0.5); g.lineTo(x + w / 2, base); g.fill(); }
  }
  strips.set(key, cv); return cv;
}
function drawStrip(ctx, cv, base, pan, alpha = 1) {
  ctx.globalAlpha = alpha; const o = -(((pan % 960) + 960) % 960);
  for (let x = o; x < W; x += 960) ctx.drawImage(cv, Math.round(x), Math.round(base - cv.height));
  ctx.globalAlpha = 1;
}

// tiny pixel crab (hatchlings, court figures)
const MINI = ['..o....o..', '.o.eeee.o.', '..bbbbbb..', 'cbbbbbbbbc', '.l.l..l.l.'];
function miniCrab(ctx, x, y, col, eye = '#ffffff', flip = false, k = 1) {
  x = Math.round(x); y = Math.round(y);
  MINI.forEach((row, j) => { for (let i = 0; i < 10; i++) { const c = row[flip ? 9 - i : i]; if (c === '.') continue; ctx.fillStyle = c === 'e' ? eye : c === 'o' ? '#1a1020' : col; ctx.fillRect(x + (i - 5) * k, y + (j - 5) * k, k, k); } });
}
function shell(ctx, x, y, rx, ry, whole, col = '#f2d8b8', rot = 0) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(1, ry - 1, rx + 1, 3, 0, 0, TAU); ctx.fill();
  if (whole) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-Math.floor(rx / 2), -Math.floor(ry / 2), 2, 3);
    ctx.fillStyle = 'rgba(120,80,40,0.35)'; ctx.beginPath(); ctx.ellipse(1, 2, rx - 1, ry - 2, 0, 0.2, Math.PI - 0.2); ctx.fill();
  } else { // two broken halves
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-2, 2, rx * 0.8, ry * 0.55, -0.3, 0, Math.PI); ctx.fill(); ctx.beginPath(); ctx.ellipse(rx * 0.7, 3, rx * 0.5, ry * 0.4, 0.5, 0, Math.PI); ctx.fill();
    ctx.fillStyle = 'rgba(60,30,10,0.45)'; ctx.fillRect(-rx, 2, rx * 1.6, 1);
  }
  ctx.restore();
}
function caustics(ctx, t, y0, col = '#ffffff', a = 0.07) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.lineWidth = 1;
  for (let k = 0; k < 14; k++) { ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 1.2 + k)); ctx.beginPath(); for (let x = 0; x <= W; x += 8) { const y = y0 + k * 6 + Math.sin(x * 0.04 + t * 0.9 + k * 1.3) * 3 + Math.sin(x * 0.11 - t * 0.6 + k) * 1.5; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
  ctx.restore();
}
function ribbon(ctx, t, o) {
  const { y = 60, amp = 24, len = 520, col = '#9af0ff', a = 0.18, w = 7, ph = 0, speed = 0.4, k = 0.018 } = o;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.lineCap = 'round';
  for (let pass = 0; pass < 3; pass++) {
    ctx.globalAlpha = a * (1 - pass * 0.28); ctx.lineWidth = w * (1 - pass * 0.3);
    ctx.beginPath(); for (let x = -20; x <= W + 20; x += 6) { const yy = y + Math.sin(x * k + t * speed + ph) * amp + Math.sin(x * k * 2.3 - t * speed * 1.3 + ph) * amp * 0.35 + pass * 1.2; x === -20 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke();
  }
  ctx.restore();
}
function fishShoal(ctx, t, o) {
  const { n = 18, y = 100, spread = 60, col = '#ffd84a', seed = 2, speed = 22, dir = 1, size = 1 } = o, r = rng(seed);
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const ox = r() * 200, oy = (r() - 0.5) * spread, ph = r() * 6, x = (((ox + t * speed * dir) % (W + 80)) + W + 80) % (W + 80) - 40, yy = y + oy + Math.sin(t * 1.5 + ph) * 4 + Math.sin(x * 0.02) * 6;
    ctx.globalAlpha = 0.85; ctx.fillRect(Math.round(x), Math.round(yy), 4 * size, 2 * size); ctx.fillRect(Math.round(x) + (dir > 0 ? -2 : 4 * size), Math.round(yy) - 1 * size, 2 * size, 4 * size); ctx.fillStyle = col;
  }
  ctx.globalAlpha = 1;
}

// ---- the god's hand and the crab's claw (painted once) ----------------------------------------------------------
let handsCv = null;
function handsSprite() {
  if (handsCv) return handsCv;
  const RC = new Ramp(['#5c1424', '#a32428', '#d8452e', '#f2793a', '#ffc77a']), RG = new Ramp(['#07323c', '#0e6470', '#2aa4a8', '#74e0d4', '#e4fff2']);
  const p = new Painter(230, 100, '#0a1018');
  // claw reaching in from the left
  p.capsule(0, 70, 46, 56, 9, 7, RC, { dither: 0.3 });
  p.ellipse(54, 52, 17, 14, RC, { dither: 0.3 });
  p.poly([[58, 40], [84, 26], [104, 24], [96, 34], [72, 50]], RC, { dither: 0.3 });   // upper jaw
  p.poly([[60, 62], [84, 72], [104, 74], [96, 64], [72, 54]], RC, { dither: 0.3 });   // lower jaw
  // the god's hand reaching in from the right, fingers open
  p.capsule(230, 22, 176, 40, 15, 11, RG, { dither: 0.3 });
  p.ellipse(168, 44, 15, 12, RG, { dither: 0.3 });
  [[122, 42, 5.2], [124, 49, 5], [128, 56, 4.6], [134, 62, 4]].forEach(([x, y, r], i) => p.capsule(160, 38 + i * 6, x, y, 4.4 - i * 0.3, 3, RG, { dither: 0.3 }));
  p.capsule(172, 34, 140, 30, 4.6, 3.2, RG, { dither: 0.3 });
  handsCv = { canvas: p.toCanvas(), w: 230, h: 100, ax: 115, ay: 50 };
  return handsCv;
}

// ---- scenes -------------------------------------------------------------------------------------------------
const SCENES = {
  // the Mother Tide dreaming the ocean alive
  ocean(ctx, t) {
    grad(ctx, [[0, '#46b8dc'], [0.45, '#14609a'], [1, '#041a34']]);
    const bg = getBackground('reef', 4); bg.draw(ctx, { x: t * 14, y: 0 }, { h: 30 }, t, true);
    glow(ctx, 350, 62, 150, '#bff4ff', 0.35);
    rays(ctx, t, { x0: 340, a: 0.1, n: 8 });
    ribbon(ctx, t, { y: 52, amp: 22, col: '#c8f6ff', a: 0.2, w: 8, ph: 0 }); ribbon(ctx, t, { y: 78, amp: 28, col: '#8adcff', a: 0.16, w: 6, ph: 2.2, speed: 0.33 }); ribbon(ctx, t, { y: 104, amp: 18, col: '#ffe0b8', a: 0.1, w: 5, ph: 4.1, speed: 0.5 });
    // the dream: a spiral of light that throws off fish
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) { const th = i * 0.42 - t * 0.5, rad = 2 + i * 1.5, x = 350 + Math.cos(th) * rad, y = 62 + Math.sin(th) * rad * 0.62; ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 2 + i * 0.3)); ctx.fillStyle = i % 5 === 0 ? '#ffffff' : '#9af0ff'; ctx.fillRect(Math.round(x), Math.round(y), i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1); }
    ctx.restore();
    fishShoal(ctx, t, { y: 150, spread: 70, col: '#ffd84a', n: 22, seed: 4, speed: 16 }); fishShoal(ctx, t + 3, { y: 120, spread: 50, col: '#ff8aa8', n: 12, seed: 8, speed: -12, dir: -1 });
    drawStrip(ctx, strip('coral', '#0e4a76', 1, 130), 270, t * 5, 0.9); drawStrip(ctx, strip('kelp', '#082c4a', 2, 150), 280, t * 9, 0.95);
    motes(ctx, t, { n: 50, a: 0.6 }); vignette(ctx, 0.5);
  },
  // Poseidon on his throne, the Court beneath him
  throne(ctx, t) {
    grad(ctx, [[0, '#031a24'], [0.5, '#08323e'], [1, '#02080e']]);
    glow(ctx, 240, 96, 190, '#40e0d0', 0.4);
    rays(ctx, t, { x0: 240, a: 0.1, color: '#a8fff0', n: 6, spread: 200 });
    drawStrip(ctx, strip('column', '#04202a', 5, 230), 232, 0, 0.9); drawStrip(ctx, strip('column', '#03151c', 9, 260), 250, 120, 1);
    // dais
    ctx.fillStyle = '#082e3a'; ctx.beginPath(); ctx.moveTo(110, 240); ctx.lineTo(150, 196); ctx.lineTo(330, 196); ctx.lineTo(370, 240); ctx.fill();
    ctx.fillStyle = '#0e4a58'; ctx.fillRect(150, 196, 180, 3); ctx.fillStyle = '#06202a'; ctx.fillRect(0, 240, W, 30);
    // halo and the god
    const f = enemyFrame('poseidon0', { plan: 'poseidon', w: 200, h: 200, ax: 100, ay: 104, frames: 4, o: { phase: 0 } }, 'idle', Math.floor(t * 4) % 4);
    ctx.save(); ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 1; ctx.globalAlpha = 0.5; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(240, 78, 48 + k * 9, 0, TAU); ctx.setLineDash([3 + k * 2, 5]); ctx.lineDashOffset = t * (10 + k * 6) * (k % 2 ? 1 : -1); ctx.stroke(); } ctx.restore();
    sprite(ctx, f, 240, 150 + Math.sin(t * 0.8) * 2, 1);
    // lantern-bearers of the Court
    for (let i = 0; i < 14; i++) { const x = 20 + i * 34 + (i % 2) * 8, y = 246 + (i % 3) * 5; miniCrab(ctx, x, y, '#0a2630', '#3a8a8a', i > 6); const fl = 0.6 + 0.4 * Math.sin(t * 3 + i); glow(ctx, x, y - 12, 14, '#ffb050', 0.4 * fl); ctx.fillStyle = '#ffd890'; ctx.fillRect(x, y - 13, 2, 2); }
    motes(ctx, t, { n: 40, color: '#a8fff0', a: 0.5, speed: 5 }); vignette(ctx, 0.6);
  },
  // the Seal over the Hollow
  seal(ctx, t) {
    grad(ctx, [[0, '#04020a'], [1, '#12061e']]);
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
    glow(ctx, 240, 200, 240, '#8a30c0', 0.25 + pulse * 0.2); glow(ctx, 240, 0, 160, '#40e0d0', 0.22);
    drawStrip(ctx, strip('rock', '#0a0412', 3, 120), 270, 0, 1);
    // chains from the king's light down to the seal
    for (let c = 0; c < 5; c++) {
      const x1 = 240 + (c - 2) * 20, x0 = 130 + c * 55;
      for (let k = 0; k < 26; k++) { const u = k / 25, x = lerp(x1, x0, u * u) + Math.sin(t * 0.9 + c * 1.3 + k * 0.35) * (2 + u * 4), y = lerp(10, 204, u);
        ctx.fillStyle = '#5a4a78'; if (k % 2) ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 6); else ctx.fillRect(Math.round(x) - 2, Math.round(y) + 1, 5, 3);
        ctx.fillStyle = '#a090c8'; ctx.fillRect(Math.round(x) - 1, Math.round(y), 1, 1); }
    }
    // the seal itself, in perspective
    const cx = 240, cy = 214, rx = 168, ry = 36;
    const ringPts = (rad, n, off) => Array.from({ length: n }, (_, i) => { const a = off + (i / n) * TAU; return [cx + Math.cos(a) * rx * rad, cy + Math.sin(a) * ry * rad]; });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [rad, a, col] of [[1, 0.6, '#b060ff'], [0.82, 0.45, '#8a40e0'], [0.45, 0.6, '#d8a0ff']]) { ctx.strokeStyle = col; ctx.globalAlpha = a * (0.6 + pulse * 0.4); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, rx * rad, ry * rad, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#e0c0ff'; for (const [x, y] of ringPts(0.91, 28, t * 0.18)) { ctx.globalAlpha = 0.5 + 0.4 * pulse; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 3); }
    ctx.strokeStyle = '#c890ff'; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
    const star = ringPts(0.82, 6, -t * 0.25); for (let i = 0; i < 6; i++) { const [x1, y1] = star[i], [x2, y2] = star[(i + 2) % 6]; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    ctx.restore();
    // cracks leaking violet light, and something very old looking up
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#c070ff'; const r = rng(7);
    for (let i = 0; i < 40; i++) { const a = r() * TAU, d = 0.2 + r() * 0.9, x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d; ctx.globalAlpha = (0.25 + 0.5 * Math.abs(Math.sin(t * 1.5 + i))) * 0.8; ctx.fillRect(Math.round(x), Math.round(y - ((t * 14 + i * 9) % 70)), 1, 2); }
    ctx.restore();
    motes(ctx, t, { n: 36, color: '#d0a0ff', a: 0.55, speed: 10 }); vignette(ctx, 0.55);
  },
  // the clutch on the shore, hatching
  eggs(ctx, t) { nursery(ctx, t, true); },
  // the nursery at dawn after the Tithe-boats
  empty(ctx, t) { nursery(ctx, t, false); },
  // light through water
  dawn(ctx, t) {
    grad(ctx, [[0, '#ffe9a8'], [0.35, '#7ed8e0'], [1, '#0c4a7a']]);
    glow(ctx, 300, 0, 240, '#fff4c0', 0.55); rays(ctx, t, { x0: 300, a: 0.16, color: '#fff0c0', n: 9, spread: 240, len: 300 });
    const bg = getBackground('reef', 2); bg.draw(ctx, { x: t * 10, y: 0 }, { h: 30 }, t, true);
    fishShoal(ctx, t, { y: 90, spread: 40, col: '#fff0a8', n: 16, seed: 3, speed: 12 });
    drawStrip(ctx, strip('coral', '#0c5a86', 7, 120), 266, t * 3, 0.95);
    // hatchlings in the shallows
    for (let i = 0; i < 10; i++) miniCrab(ctx, 70 + i * 38 + Math.sin(t * 1.4 + i) * 3, 214 + (i % 3) * 6, i % 2 ? '#f2793a' : '#d8452e', '#ffffff', i % 3 === 0, 2);
    caustics(ctx, t, 214, '#fff6c8', 0.06); motes(ctx, t, { n: 50, color: '#fff6d0', a: 0.7, speed: 5 }); vignette(ctx, 0.35);
  },
  // deep, quiet, and something dreaming of lanterns
  night(ctx, t) {
    grad(ctx, [[0, '#02050f'], [1, '#0a1230']]);
    glow(ctx, 240, 280, 260, '#a04ac8', 0.28); glow(ctx, 240, 250, 120, '#ff9ac0', 0.18);
    drawStrip(ctx, strip('rock', '#04060f', 6, 140), 270, 0, 1);
    for (let i = 0; i < 44; i++) {
      const u = ((i / 44) + t * 0.025) % 1, a = u * 11 + i * 0.1, rad = 14 + u * 90, x = 240 + Math.cos(a) * rad * 1.1, y = 236 - u * 190 + Math.sin(a) * rad * 0.18, f = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.4 + i)), sz = 2 + (i % 3 === 0 ? 1 : 0);
      glow(ctx, x, y, 12 + sz * 2, '#ffb860', 0.35 * f); ctx.fillStyle = '#ffe8b0'; ctx.globalAlpha = f; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, sz, sz + 1); ctx.globalAlpha = 1;
    }
    motes(ctx, t, { n: 70, color: '#8ab0ff', a: 0.5, speed: 3, seed: 9 }); vignette(ctx, 0.6);
  },
  // the Mother Tide wakes: seven pearls around a current
  stars(ctx, t) {
    grad(ctx, [[0, '#04061a'], [0.6, '#0a1a4a'], [1, '#02040c']]);
    glow(ctx, 240, 120, 200, '#7ac0ff', 0.3);
    ribbon(ctx, t, { y: 90, amp: 30, col: '#bfe8ff', a: 0.2, w: 8 }); ribbon(ctx, t, { y: 130, amp: 22, col: '#ffd8f0', a: 0.14, w: 6, ph: 2, speed: 0.3 }); ribbon(ctx, t, { y: 160, amp: 16, col: '#9af0ff', a: 0.12, w: 5, ph: 4.3, speed: 0.45 });
    const r = rng(11); ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 90; i++) { ctx.globalAlpha = 0.2 + 0.7 * Math.abs(Math.sin(t * 1.2 + i)); ctx.fillRect(Math.round(r() * W), Math.round(r() * 200), 1, 1); } ctx.globalAlpha = 1;
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + t * 0.35, x = 240 + Math.cos(a) * 78, y = 112 + Math.sin(a) * 32, hue = ['#ffd8f0', '#bff4ff', '#ffe8a0', '#d0c0ff', '#a8ffd8', '#ffb8b0', '#ffffff'][i]; glow(ctx, x, y, 26, hue, 0.6); ctx.fillStyle = hue; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), 4, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 2); }
    drawStrip(ctx, strip('coral', '#050a22', 4, 90), 272, t * 2, 1);
    motes(ctx, t, { n: 50, color: '#cfe8ff', a: 0.6, speed: 4, seed: 13 }); vignette(ctx, 0.5);
  },
  // the final form, alone and large
  crab(ctx, t, o) {
    grad(ctx, [[0, '#04101e'], [0.7, '#0a2a4a'], [1, '#02060e']]);
    rays(ctx, t, { x0: 240, a: 0.1, n: 6, spread: 140, color: '#bff4ff' });
    glow(ctx, 240, 150, 150, '#9af0ff', 0.4);
    drawStrip(ctx, strip('rock', '#030a14', 8, 100), 272, 0, 1);
    ctx.fillStyle = '#061626'; ctx.fillRect(0, 214, W, 60);
    const st = o?.st || { form: 'shore', branches: {}, dye: 'default' }, f = playerFrame(st.form, variantFor(st), 'idle', Math.floor(t * 4) % 4);
    const s = f.w * 2 <= 330 && f.h * 2 <= 150 ? 2 : 1; ctx.save(); ctx.globalAlpha = 0.18; ctx.scale(1, -1); sprite(ctx, f, 240, -(226 + 4), s); ctx.restore();   // faint reflection
    sprite(ctx, f, 240, 222 + Math.sin(t * 1.2) * 1, s);
    motes(ctx, t, { n: 46, a: 0.6, speed: 6, seed: 15 }); vignette(ctx, 0.55);
  },
  // claw and hand
  hands(ctx, t) {
    grad(ctx, [[0, '#ffe9a8'], [0.4, '#58c8d8'], [1, '#062a4a']]);
    glow(ctx, 240, 105, 170, '#ffffff', 0.55); rays(ctx, t, { x0: 240, a: 0.14, color: '#fff6d0', n: 8, spread: 120 });
    const f = handsSprite(), close = 0.5 - 0.5 * Math.cos(Math.min(1, t / 4) * Math.PI);
    ctx.save(); ctx.imageSmoothingEnabled = false; const sc = 2;
    const dx = lerp(-34, 6, close);
    ctx.drawImage(f.canvas, Math.round(240 - f.ax * sc + dx), Math.round(112 - f.ay * sc), f.w * sc, f.h * sc); ctx.restore();
    glow(ctx, 238 + dx * 0.4, 120, 36 + close * 30, '#ffffff', 0.6 + 0.3 * Math.sin(t * 3));
    drawStrip(ctx, strip('coral', '#0a4a78', 5, 100), 270, t * 2, 0.95); motes(ctx, t, { n: 50, color: '#fff6d0', a: 0.8, speed: 7 }); vignette(ctx, 0.35);
  },
};

// shared nursery scene: whole clutch hatching, or the shells left behind
function nursery(ctx, t, full) {
  grad(ctx, full ? [[0, '#6ad4ea'], [0.5, '#2a8ab8'], [1, '#0a3a62']] : [[0, '#3a6a8a'], [0.5, '#183e62'], [1, '#081a30']]);
  if (full) { glow(ctx, 330, 0, 220, '#fff4c0', 0.4); rays(ctx, t, { x0: 330, a: 0.12, n: 7 }); }
  else { glow(ctx, 250, 0, 200, '#9ac0e0', 0.18); rays(ctx, t, { x0: 250, a: 0.05, n: 4, color: '#bcd8f0' }); }
  const bg = getBackground('reef', 5); bg.draw(ctx, { x: t * 5, y: 0 }, { h: 30 }, t, true);
  drawStrip(ctx, strip('rock', full ? '#1a5a84' : '#10304e', 12, 90), 176, t * 2, 0.8);
  const sand = full ? ['#e8c888', '#b8884e'] : ['#7a7a88', '#3e3e52'];
  grad2(ctx, 156, 296, sand[0], sand[1]);
  ctx.fillStyle = full ? 'rgba(255,248,200,0.28)' : 'rgba(20,30,60,0.3)'; for (let x = 0; x < W; x += 6) ctx.fillRect(x, 156 + Math.round(Math.sin(x * 0.05) * 2), 4, 1);
  caustics(ctx, t, 158, full ? '#fff6c8' : '#a8c8e8', full ? 0.07 : 0.035);
  const gy = 186;
  for (let i = 0; i < 10; i++) {
    const x = 70 + i * 38, y = gy + Math.sin(i * 1.7) * 4;
    if (full) {
      const hatch = clamp((t - 2.4 - i * 0.45) / 0.7, 0, 1), crack = t > 1 + i * 0.3 ? 1 : 0;
      if (hatch <= 0) shell(ctx, x, y, 9, 12, true, '#f6e2c0', Math.sin(t * (5 + i * 0.3) + i * 2) * 0.07 * crack);
      else { shell(ctx, x, y, 9, 12, false, '#f6e2c0'); miniCrab(ctx, x + Math.sin(t * 2 + i) * 2, y - 6 - Math.sin(hatch * Math.PI) * 14 * (hatch < 1 ? 1 : 0), i % 2 ? '#f2793a' : '#d8452e', '#ffffff', false, 2); }
    } else {
      shell(ctx, x, y, 9, 12, false, '#b8b4c0');
      if (i < 9) { ctx.fillStyle = 'rgba(10,14,30,0.5)'; for (let k = 1; k < 8; k++) ctx.fillRect(Math.round(x + 12 + k * 4 + (i % 2)), Math.round(y + 8 + Math.sin(k + i) * 2), 2, 1); }
    }
  }
  if (!full) {
    const bx = 400 + Math.sin(t * 0.3) * 4;
    ctx.fillStyle = '#05080f'; ctx.beginPath(); ctx.moveTo(bx - 48, 10); ctx.lineTo(bx + 52, 10); ctx.lineTo(bx + 34, 26); ctx.lineTo(bx - 30, 26); ctx.fill(); ctx.fillRect(bx - 4, -20, 2, 32);
    const sw = Math.sin(t * 1.3) * 3; ctx.fillRect(bx + 26, 26, 1, 14); glow(ctx, bx + 26 + sw, 44, 24, '#ffa840', 0.55); ctx.fillStyle = '#ffd890'; ctx.fillRect(bx + 25 + sw, 40, 3, 5);
    ctx.strokeStyle = 'rgba(5,8,15,0.6)'; ctx.beginPath(); ctx.moveTo(bx - 30, 26); for (let k = 0; k < 5; k++) ctx.lineTo(bx - 40 + k * 4 + Math.sin(t + k) * 3, 26 + k * 18); ctx.stroke();
    const f = playerFrame('shore', variantFor({ form: 'shore', branches: {}, dye: 'default' }), 'idle', Math.floor(t * 4) % 4);
    glow(ctx, 240, 168, 50, '#ffb89a', 0.2 + 0.06 * Math.sin(t * 2)); sprite(ctx, f, 240, gy + 14, 2);
  } else {
    fishShoal(ctx, t, { y: 70, spread: 30, col: '#ffe890', n: 8, seed: 7, speed: 9 });
  }
  drawStrip(ctx, strip('kelp', full ? '#0c5a5a' : '#0a2238', 13, 110), 296, t * 6, 1);
  motes(ctx, t, { n: full ? 50 : 30, color: full ? '#ffffff' : '#a0c0e0', a: full ? 0.7 : 0.4, speed: 6 }); vignette(ctx, full ? 0.4 : 0.65);
}
function grad2(ctx, y0, y1, c0, c1) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0); }

export const hasScene = (name) => !!SCENES[name];
export function drawScene(ctx, name, t, info, lift = 0) {
  ctx.save(); if (lift) { ctx.fillStyle = '#02060e'; ctx.fillRect(0, 0, W, H); ctx.translate(0, -lift); }
  (SCENES[name] || SCENES.ocean)(ctx, t, info); ctx.restore();
}
