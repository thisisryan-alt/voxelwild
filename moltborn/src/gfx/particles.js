// Pooled pixel particles: bubbles, motes, sparks, debris, foam, shockwave rings, floating damage text.
import { rng, TAU } from '../core/util.js';
import { drawText } from './font.js';

const rand = rng(77);
export class Particles {
  constructor() { this.p = []; this.rings = []; this.texts = []; this.max = 1400; }
  add(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, size: 1, color: '#fff', grav: 0, drag: 0, shrink: false, kind: 'rect', fade: true, wob: 0, ...o, max: o.life ?? 1 });
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
  update(dt) {
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
      else ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
    }
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
}
