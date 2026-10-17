// Pooled pixel particles: bubbles, motes, sparks, debris, foam, shockwave rings, floating damage text.
import { rng, TAU } from '../core/util.js';
import { drawText } from './font.js';

const rand = rng(77);
const pixCache = new WeakMap();
export class Particles {
  constructor() { this.p = []; this.rings = []; this.texts = []; this.slashes = []; this.impacts = []; this.max = 1800; }
  add(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1, size: 1, color: '#fff', grav: 0, drag: 0, shrink: false, kind: 'rect', fade: true, wob: 0, ...o, max: o.life ?? 1 });
  }
  bubble(x, y, n = 1, spread = 6, vy = -26) {
    for (let i = 0; i < n; i++) this.add({ x: x + (rand() - 0.5) * spread, y, vx: (rand() - 0.5) * 8, vy: vy - rand() * 14, life: 0.9 + rand() * 1.1, size: rand() < 0.3 ? 2 : 1, color: rand() < 0.5 ? '#d8f4ff' : '#a8e0f8', kind: 'bubble', wob: rand() * 6 });
  }
  burst(x, y, n, color, speed = 60, life = 0.4, size = 2, o = {}) {
    for (let i = 0; i < n; i++) { const a = rand() * TAU, s = speed * (0.4 + rand() * 0.8); this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + rand() * 0.6), size, color: Array.isArray(color) ? color[Math.floor(rand() * color.length)] : color, drag: 3, shrink: true, ...o }); }
  }
  foam(x, y, dir, n = 6) { for (let i = 0; i < n; i++) this.add({ x, y: y + (rand() - 0.5) * 8, vx: dir * (30 + rand() * 60), vy: (rand() - 0.5) * 40, life: 0.3 + rand() * 0.2, size: rand() < 0.4 ? 2 : 1, color: ['#ffffff', '#cfefff', '#9fd8f0'][Math.floor(rand() * 3)], drag: 3.5, shrink: true }); }
  sparkle(x, y, color = '#fff8a8') { this.add({ x, y, vx: (rand() - 0.5) * 20, vy: -10 - rand() * 20, life: 0.5 + rand() * 0.4, size: 1, color, kind: 'star', drag: 1 }); }
  ring(x, y, r1 = 4, r2 = 60, life = 0.4, color = '#ffffff', w = 2) { this.rings.push({ x, y, r1, r2, life, max: life, color, w }); }
  text(x, y, str, color = '#ffffff', big = false, o = {}) { this.texts.push({ x, y, str: String(str), color, life: 0.8, max: 0.8, vy: -34, big, ...o }); }
  // ---- combat effects ---------------------------------------------------------------------------------------
  // crescent claw-slash: a bright arc that sweeps open and fades. style: sweep +1 (down to up) or -1, big for heavy strikes.
  slash(x, y, dir, R = 22, color = '#fff0c8', o = {}) { this.slashes.push({ x, y, dir, R, color, life: o.life ?? 0.17, max: o.life ?? 0.17, tilt: o.tilt ?? 0, arc: o.arc ?? 1.05, th: o.th ?? 6, sweep: o.sweep ?? 1, rim: o.rim ?? '#ffffff' }); }
  // hit flash: a starburst at the point of contact with speed streaks thrown along the blow
  impact(x, y, dir, o = {}) {
    const crit = !!o.crit, col = o.color || (crit ? '#fff6a8' : '#ffe0b8');
    this.impacts.push({ x, y, dir, life: 0.2, max: 0.2, crit, color: col, size: o.size ?? (crit ? 11 : 7), spikes: o.spikes ?? (crit ? 10 : 7) });
    const n = o.sparks ?? (crit ? 12 : 7);
    for (let i = 0; i < n; i++) { const a = (rand() - 0.5) * 2.2 + (dir > 0 ? 0 : Math.PI), sp = 90 + rand() * 150; this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, life: 0.16 + rand() * 0.16, size: 1, color: rand() < 0.5 ? '#ffffff' : col, kind: 'streak', drag: 3.2 }); }
  }
  // the sprite itself breaks apart: real pixels sampled from the frame fly out and sink
  debris(f, x, y, flip = false, n = 40, power = 70, o = {}) {
    if (!f || !f.canvas) return;
    const cv = f.canvas; let d = pixCache.get(cv);
    if (!d) { const g = cv.getContext('2d'); const img = g.getImageData(0, 0, cv.width, cv.height), idx = []; for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3] > 200) idx.push(i / 4); d = { img, idx, w: cv.width }; pixCache.set(cv, d); }
    if (!d.idx.length) return;
    for (let k = 0; k < n; k++) {
      let pi = d.idx[Math.floor(rand() * d.idx.length)], o4 = pi * 4;
      for (let tries = 0; tries < 4 && d.img.data[o4] + d.img.data[o4 + 1] + d.img.data[o4 + 2] < 170; tries++) { pi = d.idx[Math.floor(rand() * d.idx.length)]; o4 = pi * 4; } // favour lit pixels over outline
      const px = pi % d.w, py = Math.floor(pi / d.w);
      const ox = (px - f.ax) * (flip ? -1 : 1), oy = py - f.ay, a = Math.atan2(oy - (o.cy ?? -f.h * 0.35 + f.ay * 0), ox || 0.01), sp = power * (0.4 + rand() * 0.9);
      const dx = ox * 0.0, c = `rgb(${d.img.data[o4]},${d.img.data[o4 + 1]},${d.img.data[o4 + 2]})`;
      this.add({ x: x + ox, y: y + oy, vx: Math.cos(a) * sp * 0.6 + (o.vx ?? 0) + dx, vy: Math.sin(a) * sp * 0.6 + (o.vy ?? -20) - rand() * 20, life: (0.7 + rand() * 0.7) * (o.life ?? 1), size: rand() < (o.big ?? 0.25) ? (rand() < 0.3 ? 3 : 2) : 1, color: c, grav: o.grav ?? 55, drag: 1.4, fade: true });
    }
  }
  // dust and foam running out along the seabed
  groundWave(x, y, n = 10, spread = 70) { for (const s of [-1, 1]) for (let i = 0; i < n / 2; i++) this.add({ x: x + s * rand() * 6, y: y - rand() * 2, vx: s * (spread * (0.4 + rand() * 0.8)), vy: -rand() * 14, life: 0.3 + rand() * 0.3, size: rand() < 0.4 ? 2 : 1, color: ['#ffffff', '#cfefff', '#e8d4a8'][Math.floor(rand() * 3)], drag: 3 }); }
  update(dt) {
    for (let i = this.slashes.length - 1; i >= 0; i--) { this.slashes[i].life -= dt; if (this.slashes[i].life <= 0) this.slashes.splice(i, 1); }
    for (let i = this.impacts.length - 1; i >= 0; i--) { this.impacts[i].life -= dt; if (this.impacts[i].life <= 0) this.impacts.splice(i, 1); }
    for (let i = this.p.length - 1; i >= 0; i--) {
      const q = this.p[i]; q.life -= dt;
      if (q.life <= 0) { this.p.splice(i, 1); continue; }
      q.vy += q.grav * dt; if (q.drag) { const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.kind === 'bubble') q.x += Math.sin((q.life + q.wob) * 5) * 0.12;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].life -= dt; if (this.rings[i].life <= 0) this.rings.splice(i, 1); }
    for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.life -= dt; t.y += t.vy * dt; t.vy *= 0.94; if (t.life <= 0) this.texts.splice(i, 1); }
  }
  draw(ctx, cam) {
    for (const q of this.p) {
      const k = q.life / q.max; let s = q.shrink ? Math.max(1, Math.round(q.size * k * 1.2)) : q.size;
      const x = Math.round(q.x - cam.x), y = Math.round(q.y - cam.y);
      if (x < -8 || y < -8 || x > 488 || y > 278) continue;
      ctx.globalAlpha = q.fade ? Math.min(1, k * 2) : 1;
      ctx.fillStyle = q.color;
      if (q.kind === 'bubble') { ctx.fillRect(x, y, s, s); if (s > 1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); } }
      else if (q.kind === 'star') { ctx.fillRect(x, y - 1, 1, 3); ctx.fillRect(x - 1, y, 3, 1); }
      else if (q.kind === 'streak') { const n = Math.max(1, Math.round(Math.hypot(q.vx, q.vy) * 0.03)), ux = q.vx / (Math.hypot(q.vx, q.vy) || 1), uy = q.vy / (Math.hypot(q.vx, q.vy) || 1); for (let i = 0; i < n; i++) ctx.fillRect(Math.round(x - ux * i), Math.round(y - uy * i), 1, 1); }
      else ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
    }
    ctx.globalAlpha = 1;
    for (const sl of this.slashes) this.drawSlash(ctx, cam, sl);
    for (const im of this.impacts) this.drawImpact(ctx, cam, im);
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const t = 1 - r.life / r.max, rad = r.r1 + (r.r2 - r.r1) * (1 - (1 - t) * (1 - t));
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = r.color; ctx.lineWidth = r.w;
      ctx.beginPath(); ctx.arc(Math.round(r.x - cam.x) + 0.5, Math.round(r.y - cam.y) + 0.5, rad, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      const a = Math.min(1, t.life / (t.max * 0.5));
      drawText(ctx, t.str, t.x - cam.x, t.y - cam.y, { color: t.color, outline: '#170d1c', align: 'center', scale: t.big ? 2 : 1, alpha: a });
    }
  }
  // a crescent that sweeps out along the claw's path: solid, tapering to a point at the tail, white-hot on the outer edge
  drawSlash(ctx, cam, sl) {
    const t = 1 - sl.life / sl.max, reveal = Math.min(1, t * 2.6), fade = Math.max(0, 1 - Math.max(0, t - 0.3) / 0.7);
    const cx = Math.round(sl.x - cam.x), cy = Math.round(sl.y - cam.y), A = sl.arc, steps = Math.ceil(A * 2 * sl.R * 1.5);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, ph = sl.sweep > 0 ? u : 1 - u; if (ph > reveal) continue;
      const a = -A + u * 2 * A + sl.tilt, age = reveal - ph, prof = Math.pow(Math.sin(Math.PI * (0.06 + u * 0.88)), 0.8);
      const th = Math.max(1, Math.round(sl.th * 1.5 * prof * Math.max(0.45, 1 - age * 0.8))), al = fade * Math.max(0.55, 1 - age * 0.9);
      for (let r = 0; r < th; r++) {
        const rr = sl.R - r * 0.9, x = cx + Math.round(Math.cos(a) * rr * sl.dir), y = cy + Math.round(Math.sin(a) * rr * 0.92);
        ctx.globalAlpha = al * (r === 0 ? 1 : 0.95 - (r / th) * 0.5);
        ctx.fillStyle = r === 0 || age < 0.08 ? sl.rim : (r < th * 0.5 ? sl.color : r < th * 0.8 ? sl.color2 || sl.color : sl.color2 || '#7ab8e0');
        ctx.fillRect(x, y, 1, 1);
        if (r < 2 && sl.R > 24) ctx.fillRect(x + (sl.dir > 0 ? 1 : -1), y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  // a starburst: a diamond core with long and short rays, shrinking as it fades
  drawImpact(ctx, cam, im) {
    const t = 1 - im.life / im.max, x = Math.round(im.x - cam.x), y = Math.round(im.y - cam.y), pop = t < 0.3 ? t / 0.3 : 1, a = 1 - Math.max(0, t - 0.4) / 0.6;
    const c = Math.max(1, Math.round(im.size * (1 - t) * 0.55));
    ctx.globalAlpha = a; ctx.fillStyle = im.color;
    for (let k = 0; k < im.spikes; k++) {
      const ang = (k / im.spikes) * TAU + (im.crit ? 0.2 : 0), len = (im.size * 0.7 + (k % 2 ? 0 : im.size * 1.0)) * pop * (1 - t * 0.5);
      for (let r = c; r < len + c; r++) ctx.fillRect(x + Math.round(Math.cos(ang) * r), y + Math.round(Math.sin(ang) * r), 1, 1);
    }
    ctx.fillStyle = '#ffffff';
    for (let dy = -c; dy <= c; dy++) { const w = c - Math.abs(dy); ctx.fillRect(x - w, y + dy, w * 2 + 1, 1); }
    ctx.globalAlpha = 1;
  }
}
