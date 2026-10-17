// Story-panel illustrations: layered, animated scenes built from the game's own backgrounds and sprites.
// Every scene is drawn in 480x270 space from a single time value, with no state, so it can be crossfaded freely.
import { getBackground } from './background.js';
import { playerFrame, variantFor } from './sprites_player.js';
import { enemyFrame } from './sprites_enemies.js';
import { propSprite } from './sprites_world.js';
import './sprites_bosses.js';
import './sprites_bosses2.js';
import './sprites_hero.js';
import { morayHead, moraySeg } from './sprites_bosses.js';
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
    const f = enemyFrame('poseidon0', { plan: 'poseidon', w: 340, h: 310, ax: 140, ay: 196, frames: 4, o: { phase: 0 } }, 'idle', Math.floor(t * 4) % 4);
    ctx.save(); ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 1; ctx.globalAlpha = 0.5; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(240, 78, 48 + k * 9, 0, TAU); ctx.setLineDash([3 + k * 2, 5]); ctx.lineDashOffset = t * (10 + k * 6) * (k % 2 ? 1 : -1); ctx.stroke(); } ctx.restore();
    sprite(ctx, f, 240, 200 + Math.sin(t * 0.8) * 2, 1);
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

  // ---- biome establishing shots ---------------------------------------------------------------------------------
  forest(ctx, t) {
    grad(ctx, [[0, '#2aa890'], [0.5, '#0e5a56'], [1, '#04201e']]);
    glow(ctx, 300, 0, 200, '#c8ffd8', 0.28); rays(ctx, t, { x0: 300, a: 0.11, color: '#d8ffd8', n: 8, spread: 220 });
    const bg = getBackground('forest', 3); bg.draw(ctx, { x: t * 8, y: 0 }, { h: 30 }, t, true);
    drawStrip(ctx, strip('column', '#0a3a34', 4, 250), 270, t * 3, 0.9);          // trunks
    drawStrip(ctx, strip('kelp', '#0c5a3c', 5, 220), 280, t * 6, 0.95);
    // a root arch with a tiny crab on it
    ctx.strokeStyle = '#06261e'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(120, 262); ctx.bezierCurveTo(130, 160, 250, 150, 340, 262); ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#0a3a2c'; ctx.beginPath(); ctx.moveTo(140, 262); ctx.bezierCurveTo(150, 190, 240, 180, 320, 262); ctx.stroke();
    const f = playerFrame('shore', variantFor({ form: 'shore', branches: {}, dye: 'default' }), 'idle', Math.floor(t * 4) % 4); sprite(ctx, f, 236, 178, 2);
    for (let i = 0; i < 26; i++) { const x = (i * 83) % W, y = 120 + ((i * 47 + t * 6 * (1 + (i % 3))) % 130); glow(ctx, x, y, 7, '#a8ff88', 0.5 * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i)))); }
    motes(ctx, t, { n: 40, color: '#c8ffc8', a: 0.5, speed: 4, seed: 21 }); vignette(ctx, 0.6);
  },
  kingdom(ctx, t) {
    grad(ctx, [[0, '#5a9cf8'], [0.5, '#2a3a98'], [1, '#0a1040']]);
    glow(ctx, 240, 0, 240, '#e0d0ff', 0.4); rays(ctx, t, { x0: 240, a: 0.12, color: '#f0e8ff', n: 8 });
    drawStrip(ctx, strip('spire', '#2a2a78', 6, 220), 250, t * 2, 0.8); drawStrip(ctx, strip('spire', '#4a3a98', 9, 180), 262, t * 4 + 100, 0.95);
    // lit windows and banners
    for (let i = 0; i < 40; i++) { const x = (i * 59 + 20) % W, y = 120 + (i * 37) % 110; ctx.fillStyle = `rgba(255,220,140,${0.35 + 0.4 * Math.abs(Math.sin(t + i))})`; ctx.fillRect(x, y, 2, 3); }
    // the great gate, lit from inside
    ctx.fillStyle = '#0c0c3a'; ctx.beginPath(); ctx.moveTo(190, 262); ctx.lineTo(190, 170); ctx.arc(240, 170, 50, Math.PI, 0); ctx.lineTo(290, 262); ctx.fill(); glow(ctx, 240, 215, 70, '#ffe8a0', 0.5);
    for (const bx of [170, 310]) { ctx.fillStyle = '#7a2a8a'; ctx.beginPath(); ctx.moveTo(bx, 110); ctx.lineTo(bx + 16, 110); ctx.lineTo(bx + 16, 150 + Math.sin(t * 2 + bx) * 3); ctx.lineTo(bx + 8, 142); ctx.lineTo(bx, 150 + Math.sin(t * 2 + bx) * 3); ctx.fill(); ctx.fillStyle = '#ffd84a'; ctx.fillRect(bx + 6, 120, 4, 4); }
    fishShoal(ctx, t, { y: 100, spread: 40, col: '#ffd8f0', n: 14, seed: 12, speed: 10 });
    motes(ctx, t, { n: 40, color: '#e8e0ff', a: 0.6, speed: 5, seed: 22 }); vignette(ctx, 0.5);
  },
  graveyard(ctx, t) {
    grad(ctx, [[0, '#2c6a6a'], [0.5, '#123a40'], [1, '#04161c']]);
    glow(ctx, 330, 0, 180, '#a8e8e0', 0.2); rays(ctx, t, { x0: 330, a: 0.08, color: '#c8fff0', n: 5 });
    // hulls and masts leaning in the silt
    const hull = (x, y, w, h, tilt, col) => { ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.lineTo(w / 2, -h * 0.8); ctx.lineTo(w * 0.35, 0); ctx.lineTo(-w * 0.4, 0); ctx.fill(); ctx.fillRect(-2, -h - 70, 3, 72); ctx.fillRect(-26, -h - 50, 50, 2); ctx.restore(); };
    hull(100, 214, 150, 44, -0.2, '#14424a'); hull(390, 222, 170, 52, 0.16, '#103840'); hull(250, 232, 120, 34, 0.05, '#1a4e56');
    ctx.fillStyle = '#0c3236'; ctx.fillRect(0, 222, W, 60);
    for (let i = 0; i < 5; i++) { const x = 90 + i * 80 + Math.sin(t * 0.8 + i) * 10, y = 160 + Math.sin(t * 1.1 + i * 2) * 8; glow(ctx, x, y, 24, '#9affff', 0.35); ctx.fillStyle = '#d8ffff'; ctx.fillRect(Math.round(x), Math.round(y), 2, 3); }
    ctx.fillStyle = 'rgba(160,220,220,0.07)'; for (let k = 0; k < 6; k++) ctx.fillRect(0, 150 + k * 18 + Math.sin(t * 0.6 + k) * 4, W, 9);
    motes(ctx, t, { n: 36, color: '#a8d8d8', a: 0.5, speed: 3, seed: 23 }); vignette(ctx, 0.65);
  },
  abyss(ctx, t) {
    grad(ctx, [[0, '#0e2250'], [0.6, '#040a24'], [1, '#010208']]);
    drawStrip(ctx, strip('rock', '#02040e', 7, 130), 270, 0, 1);
    // drifting jellyfish of light, and a far-off lure
    for (let i = 0; i < 8; i++) { const x = (i * 71 + 40 + Math.sin(t * 0.3 + i) * 20) % W, y = 40 + ((i * 53 + t * (3 + i % 3)) % 170), r = 8 + (i % 3) * 3; glow(ctx, x, y, r * 3, '#58a0ff', 0.4); ctx.fillStyle = '#9ad0ff'; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, 0, Math.PI, 0); ctx.fill(); for (let k = -1; k <= 1; k++) ctx.fillRect(Math.round(x + k * r * 0.5), Math.round(y), 1, 8 + Math.round(Math.sin(t * 2 + k + i) * 2)); ctx.globalAlpha = 1; }
    const lx = 390 + Math.sin(t * 0.5) * 10; glow(ctx, lx, 120, 40, '#ffe890', 0.6); ctx.fillStyle = '#fff6c0'; ctx.fillRect(Math.round(lx) - 1, 119, 3, 3);
    ctx.fillStyle = '#02040e'; ctx.beginPath(); ctx.ellipse(lx + 30, 150, 60, 26, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff6c0'; ctx.fillRect(lx + 6, 142, 3, 3);
    const f = playerFrame('shore', variantFor({ form: 'shore', branches: {}, dye: 'default' }), 'idle', Math.floor(t * 4) % 4); glow(ctx, 120, 232, 40, '#ffb89a', 0.18); sprite(ctx, f, 120, 238, 2);
    motes(ctx, t, { n: 60, color: '#6a98e8', a: 0.45, speed: 3, seed: 24 }); vignette(ctx, 0.7);
  },
  trench(ctx, t) {
    grad(ctx, [[0, '#2a0a3a'], [0.5, '#12041c'], [1, '#030106']]);
    glow(ctx, 240, 250, 240, '#a040c0', 0.3 + 0.1 * Math.sin(t));
    // the cleft: two walls and the ruins in between
    ctx.fillStyle = '#06020a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(150, 0); ctx.lineTo(120, 120); ctx.lineTo(170, 270); ctx.lineTo(0, 270); ctx.fill(); ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(330, 0); ctx.lineTo(360, 110); ctx.lineTo(310, 270); ctx.lineTo(W, 270); ctx.fill();
    drawStrip(ctx, strip('column', '#1c0c2a', 8, 170), 262, 0, 0.95);
    // a colossal carved face with two dim eyes, half-buried
    ctx.fillStyle = '#1a0c28'; ctx.beginPath(); ctx.ellipse(240, 160, 70, 60, 0, 0, TAU); ctx.fill(); for (const ex of [212, 268]) { ctx.fillStyle = '#05010a'; ctx.fillRect(ex - 12, 148, 24, 10); const f2 = 0.4 + 0.5 * Math.abs(Math.sin(t * 0.8 + ex)); ctx.fillStyle = `rgba(200,120,255,${f2})`; ctx.fillRect(ex - 2, 150, 4, 5); glow(ctx, ex, 152, 22, '#b060ff', 0.4 * f2); }
    ctx.fillStyle = '#05010a'; ctx.fillRect(228, 176, 24, 4);
    motes(ctx, t, { n: 60, color: '#c090ff', a: 0.5, speed: 6, seed: 25 }); vignette(ctx, 0.7);
  },
  domain(ctx, t) {
    grad(ctx, [[0, '#1a7a9a'], [0.5, '#0a3a5a'], [1, '#03101c']]);
    glow(ctx, 240, 40, 220, '#ffe8a0', 0.35); rays(ctx, t, { x0: 240, a: 0.14, color: '#fff0c0', n: 9, spread: 160 });
    drawStrip(ctx, strip('column', '#0a3a4e', 11, 240), 262, 0, 0.85); drawStrip(ctx, strip('column', '#062a3a', 14, 270), 270, 200, 1);
    // the open doors and the road of tide-marble
    ctx.fillStyle = '#0c4a5e'; ctx.beginPath(); ctx.moveTo(120, 270); ctx.lineTo(210, 150); ctx.lineTo(270, 150); ctx.lineTo(360, 270); ctx.fill(); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(240, 270); ctx.lineTo(240, 150); ctx.stroke();
    for (const dx of [-1, 1]) { ctx.fillStyle = '#082a3a'; ctx.beginPath(); ctx.moveTo(240 + dx * 30, 150); ctx.lineTo(240 + dx * 90, 80); ctx.lineTo(240 + dx * 90, 150 + 20); ctx.lineTo(240 + dx * 30, 200); ctx.fill(); }
    glow(ctx, 240, 150, 60, '#fff0c0', 0.5);
    // a trident carved over the door
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(240, 60); ctx.lineTo(240, 100); ctx.moveTo(228, 68); ctx.lineTo(228, 86); ctx.lineTo(252, 86); ctx.lineTo(252, 68); ctx.stroke();
    motes(ctx, t, { n: 46, color: '#fff0c0', a: 0.5, speed: 5, seed: 26 }); vignette(ctx, 0.5);
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

// ---- boss portraits and evolution scenes: "boss:<key>" and "form:<id>" --------------------------------------------
const BOSS_ART = {
  grumbold: { sp: { plan: 'grumbold', w: 176, h: 96, ax: 64, ay: 84, frames: 4 }, z: 2, y: 196, bg: ['#2aa8c8', '#0a3a62'], aura: '#ffb0e0' },
  aurelia: { sp: { plan: 'aurelia', w: 112, h: 112, ax: 56, ay: 58, frames: 4 }, z: 2, y: 150, bg: ['#4a3a98', '#12104a'], aura: '#ffd8f0' },
  captain_rust: { sp: { plan: 'captain', w: 120, h: 112, ax: 60, ay: 52, frames: 4 }, z: 2, y: 140, bg: ['#1e4a52', '#06161c'], aura: '#9affff' },
  lurelord: { sp: { plan: 'lurelord', w: 150, h: 120, ax: 76, ay: 62, frames: 4 }, z: 2, y: 132, bg: ['#0e0a30', '#020208'], aura: '#ffe890' },
  krael: { sp: { plan: 'krael', w: 320, h: 226, ax: 150, ay: 106, frames: 4 }, z: 1, y: 150, bg: ['#2a0a3a', '#030106'], aura: '#ff7a3a' },
  kyros: { sp: { plan: 'kyros', w: 176, h: 156, ax: 52, ay: 124, frames: 4 }, z: 1, y: 190, bg: ['#0a5a7a', '#031620'], aura: '#9af0ff' },
  hermit_king: { sp: { plan: 'hermitking', w: 150, h: 100, ax: 62, ay: 88, frames: 4 }, z: 2, y: 214, bg: ['#3ab8d8', '#0a4a72'], aura: '#ffd84a' },
  sporemother: { sp: { plan: 'sporemother', w: 140, h: 104, ax: 70, ay: 100, frames: 4 }, z: 2, y: 212, bg: ['#1a6a4a', '#041a10'], aura: '#c8ff90' },
  brass_colossus: { sp: { plan: 'colossus', w: 120, h: 128, ax: 60, ay: 120, frames: 4 }, z: 2, y: 224, bg: ['#4a3a98', '#12104a'], aura: '#ffe890' },
  magmaw: { sp: { plan: 'magmaw', w: 80, h: 64, ax: 40, ay: 32, frames: 1 }, z: 4, y: 150, bg: ['#5a1a0a', '#0a0202'], aura: '#ff9a3a' },
  hollow_maw: { sp: { plan: 'maw', w: 180, h: 150, ax: 88, ay: 70, frames: 4 }, z: 1, y: 130, bg: ['#12041c', '#010003'], aura: '#c070ff' },
};
function bossScene(ctx, key, t) {
  const B = BOSS_ART[key]; if (!B) return SCENES.night(ctx, t);
  grad(ctx, [[0, B.bg[0]], [1, B.bg[1]]]); glow(ctx, 240, 120, 230, B.aura, 0.3); rays(ctx, t, { x0: 240, a: 0.09, color: B.aura, n: 7, spread: 220 });
  // light leaves the fallen: a slow fountain of motes and a ring of broken shell
  const k = clamp(t / 3, 0, 1);
  if (key === 'mother_moray') { /* handled below */ }
  const f = enemyFrame(`cs_${key}`, { ...B.sp, o: { rage: false, phase: 0 } }, 'idle', Math.floor(t * 3) % 4);
  ctx.save(); ctx.globalAlpha = 1 - 0.0 * k; sprite(ctx, f, 240, B.y + Math.sin(t * 0.7) * 3 + k * 6, B.z); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = B.aura; const r = rng(31);
  for (let i = 0; i < 70; i++) { const x = 240 + (r() - 0.5) * 300, y0 = 150 + r() * 120, sp = 8 + r() * 24, y = y0 - ((t * sp) % 200); ctx.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(t + i)); ctx.fillRect(Math.round(x), Math.round(y), 1 + (i % 4 === 0), 1 + (i % 4 === 0)); }
  ctx.restore();
  drawStrip(ctx, strip('rock', '#02040a', 15, 70), 272, 0, 0.9); vignette(ctx, 0.55);
}
function morayScene(ctx, t) {
  grad(ctx, [[0, '#1a6a4a'], [1, '#04180e']]); glow(ctx, 240, 120, 220, '#a8ff98', 0.25); rays(ctx, t, { x0: 240, a: 0.09, color: '#d8ffd0', n: 6 });
  drawStrip(ctx, strip('kelp', '#0a3a22', 17, 200), 270, t * 4, 0.9);
  // the great serpent coiled round a nest of green-lit eggs
  const head = morayHead(0, 0);
  for (let i = 0; i < 22; i++) { const a = i * 0.34 - t * 0.3, rad = 90 - i * 2.2, x = 230 + Math.cos(a) * rad * 1.5, y = 150 + Math.sin(a) * rad * 0.55, seg = moraySeg(15 - i * 0.35, i); sprite(ctx, seg, x, y, 1); }
  sprite(ctx, head, 300, 118 + Math.sin(t) * 2, 2);
  for (let i = 0; i < 7; i++) { const x = 195 + i * 15, y = 158 + (i % 2) * 5; glow(ctx, x, y, 14, '#a8ff68', 0.4 + 0.2 * Math.sin(t * 2 + i)); ctx.fillStyle = '#d8ffb8'; ctx.beginPath(); ctx.ellipse(x, y, 4, 5, 0, 0, TAU); ctx.fill(); }
  motes(ctx, t, { n: 40, color: '#c8ffb0', a: 0.5, speed: 4, seed: 27 }); vignette(ctx, 0.6);
}
function formScene(ctx, id, t, info) {
  const st = info?.st || { form: id, branches: {}, dye: 'default' }, form = id;
  const cols = { shore: ['#4ab8d8', '#0a3a62', '#ffd8a0'], warrior: ['#4a78d8', '#0a1a4a', '#a8d8ff'], abyssal: ['#0e3a4a', '#020a12', '#7affb0'], leviathan: ['#3a2a52', '#08040e', '#ffb44a'], mythic: ['#3a5ac8', '#060a30', '#9af0ff'], primordial: ['#a89ad8', '#1a1440', '#fff6c0'] }[form] || ['#2a6a9a', '#06203a', '#ffffff'];
  grad(ctx, [[0, cols[0]], [1, cols[1]]]); glow(ctx, 240, 120, 210, cols[2], 0.4); rays(ctx, t, { x0: 240, a: 0.12, color: cols[2], n: 9, spread: 160 });
  // the shell it left behind, cracked open on the sand
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 232, W, 40);
  const big = { shore: 4, warrior: 4, abyssal: 3, leviathan: 2, mythic: 2, primordial: 2 }[form] || 2;
  const f = playerFrame(form, variantFor({ ...st, form }), 'idle', Math.floor(t * 4) % 4);
  const lift = clamp(t / 1.2, 0, 1); ctx.save(); ctx.globalAlpha = lift; sprite(ctx, f, 240, 200 - (1 - lift) * 20 + Math.sin(t) * 1.5, big); ctx.restore();
  const r = rng(41); ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 22; i++) { const a = r() * TAU, d = 40 + r() * 140, sp = 0.2 + r() * 0.5, x = 240 + Math.cos(a + t * sp) * d, y = 150 + Math.sin(a + t * sp) * d * 0.5; ctx.fillStyle = cols[2]; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + 2, y); ctx.lineTo(x, y + 3); ctx.lineTo(x - 2, y); ctx.fill(); }
  ctx.restore(); motes(ctx, t, { n: 40, color: cols[2], a: 0.7, speed: 6, seed: 28 }); vignette(ctx, 0.5);
}


// ---- scenes for the newer systems: rifts, the gauntlet, the kitchen and the hatchling ---------------------------------------
Object.assign(SCENES, {
  // a tear in the sea: a spinning mouth of violet and cyan with shards of other water drifting out of it
  rift(ctx, t) {
    grad(ctx, [[0, '#0a1a3a'], [1, '#03060f']]); glow(ctx, 240, 128, 200, '#7a3aff', 0.3);
    const cx = 240, cy = 128;
    ctx.save(); ctx.translate(cx, cy);
    for (let k = 0; k < 9; k++) {
      const rr = 18 + k * 13, ang = t * (0.5 - k * 0.04) + k * 0.7;
      ctx.save(); ctx.rotate(ang); ctx.scale(1, 0.72); ctx.lineWidth = 3 - k * 0.2; ctx.globalAlpha = 0.85 - k * 0.07;
      ctx.strokeStyle = k % 2 ? '#7af0ff' : '#c07aff'; ctx.beginPath(); ctx.arc(0, 0, rr, 0.2, 4.9 + Math.sin(t + k) * 0.4); ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = '#02030a'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, TAU); ctx.fill(); ctx.restore();
    const r = rng(77); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) { const a = r() * TAU + t * 0.15, d = 40 + ((r() * 160 + t * 22) % 170), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.7; ctx.globalAlpha = 0.5 * (1 - d / 210); ctx.fillStyle = i % 3 ? '#9ae8ff' : '#e0a0ff'; ctx.fillRect(Math.round(x), Math.round(y), 2 + (i % 3), 2); }
    ctx.restore(); motes(ctx, t, { n: 30, color: '#c8f0ff', a: 0.5, speed: 6, seed: 12 }); vignette(ctx, 0.7);
  },
  // an arena of pale columns lit from above, pearls glowing on the floor
  gauntlet(ctx, t) {
    grad(ctx, [[0, '#2a2a5a'], [1, '#0a0a1e']]); glow(ctx, 240, 40, 260, '#ffe8a0', 0.26); rays(ctx, t, { n: 6, color: '#fff2c8', a: 0.1, seed: 9 });
    ctx.fillStyle = '#06060f'; ctx.fillRect(0, 214, W, 56); ctx.fillStyle = '#1a1a3a'; ctx.fillRect(0, 214, W, 3);
    for (const x of [30, 110, 370, 450]) { ctx.fillStyle = '#4a4a7a'; ctx.fillRect(x - 12, 60, 24, 154); ctx.fillStyle = '#7a7ab0'; ctx.fillRect(x - 12, 60, 6, 154); ctx.fillStyle = '#9a9ad0'; ctx.fillRect(x - 16, 54, 32, 8); ctx.fillRect(x - 16, 208, 32, 8); }
    const r = rng(5); for (let i = 0; i < 14; i++) { const x = 60 + r() * 360, y = 224 + r() * 36, p = 0.5 + 0.5 * Math.sin(t * 2 + i); glow(ctx, x, y, 14 + p * 6, '#fff6e0', 0.35); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
    for (let i = 0; i < 5; i++) { const a = t * 0.4 + i * 1.26; ctx.fillStyle = '#c8c8f0'; ctx.fillRect(Math.round(240 + Math.cos(a) * 80), Math.round(150 + Math.sin(a) * 18), 3, 3); }
    motes(ctx, t, { n: 24, color: '#ffe8a0', a: 0.5, speed: 5, seed: 31 }); vignette(ctx, 0.6);
  },
  // a cooking pot over a driftwood fire with steam rising, lanterns above
  kitchen(ctx, t) {
    grad(ctx, [[0, '#3a2a2a'], [1, '#120a0a']]); glow(ctx, 240, 190, 200, '#ff9a3a', 0.4);
    ctx.fillStyle = '#2a1a14'; ctx.fillRect(0, 214, W, 56); ctx.fillStyle = '#4a2a1a'; ctx.fillRect(0, 214, W, 3);
    for (const x of [90, 390]) { ctx.fillStyle = '#05030a'; ctx.fillRect(x - 1, 0, 2, 54); glow(ctx, x, 62, 54, '#ffd070', 0.5); ctx.fillStyle = '#ffd070'; ctx.fillRect(x - 6, 54, 12, 14); ctx.fillStyle = '#fff4c8'; ctx.fillRect(x - 3, 58, 6, 6); }
    ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.ellipse(240, 188, 56, 34, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.ellipse(240, 186, 52, 30, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.ellipse(240, 164, 46, 9, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#c8803a'; ctx.beginPath(); ctx.ellipse(240, 164, 40, 6, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 7; i++) { const f = (i * 0.37 + t * 1.2) % 1; ctx.fillStyle = f < 0.5 ? '#ffd070' : '#ff7a3a'; ctx.fillRect(210 + i * 10 + Math.round(Math.sin(t * 5 + i) * 2), 222 - Math.round(f * 14), 4, 6); }
    const r = rng(3); ctx.save(); for (let i = 0; i < 18; i++) { const f = (r() + t * 0.18) % 1, x = 240 + (r() - 0.5) * 60 + Math.sin(f * 6 + i) * 8, y = 156 - f * 120; ctx.globalAlpha = 0.28 * (1 - f); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 3 + f * 8, 0, TAU); ctx.fill(); } ctx.restore();
    motes(ctx, t, { n: 20, color: '#ffb070', a: 0.4, speed: 6, seed: 8 }); vignette(ctx, 0.65);
  },
  // a speckled egg on warm sand, a crack of light running down it, a small claw pushing through
  hatch(ctx, t) {
    grad(ctx, [[0, '#6ad4ea'], [0.55, '#2a8ab8'], [1, '#0a3a62']]); rays(ctx, t, { n: 8, color: '#fff6c8', a: 0.1, seed: 4 });
    ctx.fillStyle = '#c89c5e'; ctx.fillRect(0, 204, W, 66); ctx.fillStyle = '#eecb94'; ctx.fillRect(0, 204, W, 3);
    const k = clamp((t % 6) / 3, 0, 1), wob = Math.sin(t * 9) * (1 - k) * 2;
    ctx.save(); ctx.translate(240 + wob, 176); ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.ellipse(0, 0, 28, 34, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#f2e4cc'; ctx.beginPath(); ctx.ellipse(0, 0, 25, 31, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d8a8a0'; for (const [x, y] of [[-12, -14], [8, -20], [14, 4], [-6, 12], [-16, 4], [4, 18]]) ctx.fillRect(x, y, 3, 3);
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(2, -18); ctx.lineTo(-4, -8); ctx.lineTo(5, 4 + k * 8); ctx.stroke(); ctx.restore();
    glow(ctx, 240, 176, 90 + k * 40, '#ffe8b0', 0.2 + k * 0.3);
    if (k > 0.7) { ctx.fillStyle = '#e88a9a'; ctx.fillRect(228, 160, 4, 8); ctx.fillRect(248, 162, 4, 8); ctx.fillStyle = '#ffffff'; ctx.fillRect(229, 161, 1, 1); }
    motes(ctx, t, { n: 36, color: '#ffffff', a: 0.6, speed: 5, seed: 19 }); vignette(ctx, 0.45);
  },
});

export const hasScene = (name) => !!SCENES[name] || name.startsWith('boss:') || name.startsWith('form:');
export function drawScene(ctx, name, t, info, lift = 0) {
  ctx.save(); if (lift) { ctx.fillStyle = '#02060e'; ctx.fillRect(0, 0, W, H); ctx.translate(0, -lift); }
  if (name.startsWith('boss:')) { const key = name.slice(5); (key === 'mother_moray' ? morayScene : (c, tt) => bossScene(c, key, tt))(ctx, t, info); }
  else if (name.startsWith('form:')) formScene(ctx, name.slice(5), t, info);
  else (SCENES[name] || SCENES.ocean)(ctx, t, info);
  ctx.restore();
}
