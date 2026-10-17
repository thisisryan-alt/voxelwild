// Ambient ocean events: now and then something large happens in the background of a zone so that the sea feels like
// a place with weather and traffic. A whale slides across the deep, a drowned ship drifts through the murk, a curtain
// of marine snow comes down, shafts of light sweep the shallows, a stream of fish crosses the screen, and the trench
// shudders far below. Events never touch gameplay (the tremor's shake is a tiny cosmetic nudge) and respect the
// "ambient sea life" and "reduce motion" options.
import { rng, clamp } from '../core/util.js';
import { setting } from '../systems/settings.js';
import { TS } from '../world/tiles.js';

const W = 480, H = 270;

// weights per realm: which event may occur where
const WEIGHTS = {
  reef:      { whale: 3, stream: 5, sun: 4, turtle: 3, manta: 2, bubbles: 2 },
  forest:    { stream: 3, sun: 3, whale: 1, drift: 4, turtle: 2, bubbles: 2, jellybloom: 2 },
  kingdom:   { stream: 3, sun: 4, whale: 2, manta: 3, bubbles: 2 },
  graveyard: { ghost: 3, snow: 3, stream: 1, bubbles: 1 },
  abyss:     { snow: 3, whale: 2, tremor: 2, jellybloom: 4, glowpulse: 3 },
  trench:    { tremor: 3, snow: 3, glowpulse: 2, jellybloom: 2 },
  domain:    { sun: 2, stream: 2, whale: 3, manta: 3, glowpulse: 3 },
};

const shade = (c, k, a = 1) => { const n = parseInt(c.slice(1), 16); return `rgba(${Math.round((n >> 16) * k)},${Math.round(((n >> 8) & 255) * k)},${Math.round((n & 255) * k)},${a})`; };
const hex = (c, a = 1) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ---- event kinds: spawn(ev, rnd, world) / step(ev, dt, world) / back or front draw ----------------------------------------------
const KINDS = {
  whale: {
    layer: 'back', life: 70,
    spawn(e, r) { e.dir = r() < 0.5 ? -1 : 1; e.x = e.dir > 0 ? -280 : W + 280; e.y = 40 + r() * 110; e.sp = 9 + r() * 5; e.sc = 0.8 + r() * 0.7; e.par = 0.12; e.sound = false; },
    step(e, dt) { e.x += e.dir * e.sp * dt; e.done = e.dir > 0 ? e.x > W + 300 : e.x < -300; },
    draw(c, e, cam, t, B) {
      const x = e.x - cam.x * e.par, y = e.y - cam.y * e.par * 0.5 + Math.sin(t * 0.3 + e.x * 0.01) * 6, s = e.sc * e.dir;
      c.save(); c.translate(x, y); c.scale(s, e.sc);
      const col = shade(B.bottom, 0.42, 0.4), tail = Math.sin(t * 1.1) * 0.35;
      c.fillStyle = col;
      c.beginPath(); c.moveTo(130, 4); c.bezierCurveTo(100, -34, 20, -42, -60, -22); c.bezierCurveTo(-100, -12, -120, -6, -140, 0);
      c.bezierCurveTo(-120, 8, -100, 14, -60, 22); c.bezierCurveTo(10, 40, 100, 34, 130, 4); c.fill();
      c.save(); c.translate(-136, 0); c.rotate(tail);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-18, -8, -40, -30); c.quadraticCurveTo(-34, -6, -22, 0); c.quadraticCurveTo(-34, 8, -40, 30); c.quadraticCurveTo(-18, 8, 0, 0); c.fill(); c.restore();
      c.save(); c.translate(40, 20); c.rotate(0.5 + Math.sin(t * 0.9) * 0.15); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-10, 26, -34, 38); c.quadraticCurveTo(-8, 18, 6, 0); c.fill(); c.restore();
      c.fillStyle = hex('#ffffff', 0.05); c.beginPath(); c.ellipse(20, -10, 70, 8, -0.05, 0, 6.3); c.fill();
      c.fillStyle = hex(B.top, 0.2); c.beginPath(); c.ellipse(96, -4, 3, 2, 0, 0, 6.3); c.fill();
      c.restore();
    },
  },

  ghost: {
    layer: 'back', life: 90,
    spawn(e, r) { e.dir = r() < 0.5 ? -1 : 1; e.x = e.dir > 0 ? -160 : W + 160; e.y = 70 + r() * 80; e.sp = 6 + r() * 3; e.par = 0.14; },
    step(e, dt) { e.x += e.dir * e.sp * dt; e.done = e.dir > 0 ? e.x > W + 180 : e.x < -180; },
    draw(c, e, cam, t) {
      const x = e.x - cam.x * e.par, y = e.y + Math.sin(t * 0.5) * 5 - cam.y * e.par * 0.4;
      c.save(); c.translate(x, y); c.scale(e.dir, 1); c.rotate(Math.sin(t * 0.4) * 0.04);
      c.fillStyle = 'rgba(40,64,72,0.34)';
      c.beginPath(); c.moveTo(-90, 6); c.lineTo(-70, 30); c.lineTo(80, 30); c.lineTo(104, 4); c.lineTo(82, 8); c.lineTo(-90, 6); c.fill();
      c.fillRect(-60, -10, 4, 18); c.fillRect(-6, -52, 4, 62); c.fillRect(44, -34, 4, 42);
      for (const [mx, top, wd, h] of [[-58, -6, 22, 14], [-4, -48, 30, 30], [46, -30, 24, 20]]) {
        c.beginPath(); c.moveTo(mx, top); c.lineTo(mx + wd, top + 3); c.lineTo(mx + wd - 5, top + h * 0.6); c.lineTo(mx + wd, top + h); c.lineTo(mx, top + h - 2); c.fill();
      }
      c.fillStyle = 'rgba(150,230,210,0.35)'; c.fillRect(70, 12, 2, 2); c.fillRect(-72, 13, 2, 2);
      c.restore();
    },
  },

  sun: {
    layer: 'back', life: 26,
    spawn(e, r) { e.x0 = r() * W; e.sp = (r() < 0.5 ? -1 : 1) * (5 + r() * 4); e.n = 3 + ((r() * 3) | 0); e.t = 0; },
    step(e, dt) { e.t += dt; e.done = e.t > this.life; },
    draw(c, e, cam, t, B, world) {
      const shallow = clamp(1 - (cam.y + H / 2) / Math.max(1, world.zone.h * TS * 0.55), 0, 1); if (shallow <= 0.02) return;
      const k = Math.min(1, e.t / 4, (this.life - e.t) / 5) * shallow;
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < e.n; i++) {
        const bx = ((e.x0 + e.t * e.sp + i * 133) % (W + 240)) - 120, wd = 26 + (i * 37) % 30, lean = 90 + (i * 23) % 40;
        const g = c.createLinearGradient(bx, 0, bx - lean, H * 0.85); g.addColorStop(0, `rgba(255,248,200,${0.17 * k})`); g.addColorStop(1, 'rgba(255,248,200,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(bx, 0); c.lineTo(bx + wd, 0); c.lineTo(bx + wd - lean, H * 0.85); c.lineTo(bx - lean, H * 0.85); c.fill();
      }
      c.restore();
    },
  },

  snow: {
    layer: 'front', life: 22,
    spawn(e, r) { e.t = 0; e.flakes = Array.from({ length: 110 }, () => ({ x: r() * W, y: r() * H, v: 14 + r() * 24, d: (r() - 0.5) * 8, s: r() < 0.2 ? 2 : 1, a: 0.3 + r() * 0.5 })); },
    step(e, dt) { e.t += dt; for (const f of e.flakes) { f.y += f.v * dt; f.x += f.d * dt; if (f.y > H) { f.y -= H + 4; } if (f.x < 0) f.x += W; if (f.x > W) f.x -= W; } e.done = e.t > this.life; },
    draw(c, e, cam, t, B) {
      const k = Math.min(1, e.t / 3, (this.life - e.t) / 4); c.save(); c.fillStyle = B.id === 'trench' ? '#ffb0b8' : '#dff4ff';
      for (const f of e.flakes) { c.globalAlpha = f.a * k * 0.7; c.fillRect((((Math.round(f.x - cam.x * 0.15)) % W) + W) % W, Math.round(f.y), f.s, f.s); }
      c.restore();
    },
  },

  stream: {
    layer: 'front', life: 30,
    spawn(e, r, world) {
      e.dir = r() < 0.5 ? -1 : 1; e.x = e.dir > 0 ? -60 : W + 60; e.y = 50 + r() * 140; e.sp = 46 + r() * 22; e.n = 22 + ((r() * 14) | 0); e.par = 0.5;
      e.col = ({ reef: '#cfe8f4', forest: '#a8e0b0', kingdom: '#f4d8ff', domain: '#c8fff0', graveyard: '#8ab0a8' })[world.zone.biome] || '#cfe8f4';
      e.fish = Array.from({ length: e.n }, (_, i) => ({ ox: (r() - 0.5) * 70, oy: (r() - 0.5) * 40, ph: r() * 6.3, sc: r() < 0.15 ? 2 : 1, i }));
      e.t = 0;
    },
    step(e, dt) { e.t += dt; e.x += e.dir * e.sp * dt; e.done = e.dir > 0 ? e.x > W + 90 : e.x < -90; },
    draw(c, e, cam, t, B, world) {
      const p = world.player, px = p.x - cam.x * e.par, py = p.y - cam.y * e.par;
      c.save(); c.fillStyle = e.col;
      for (const f of e.fish) {
        let x = e.x + f.ox + Math.sin(t * 2 + f.ph) * 4 - cam.x * e.par, y = e.y + f.oy + Math.sin(t * 1.3 + f.ph * 2) * 7 - cam.y * e.par * 0.5;
        const dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
        if (d < 46) { const k = (46 - d) / 46; x += (dx / (d || 1)) * k * 26; y += (dy / (d || 1)) * k * 20; }   // the school parts around the swimmer
        const xr = Math.round(x), yr = Math.round(y), d2 = e.dir;
        c.globalAlpha = 0.85; c.fillRect(xr, yr, 3 * f.sc, f.sc); c.fillRect(xr - d2 * f.sc, yr - (Math.sin(t * 12 + f.ph) > 0 ? f.sc : 0), f.sc, f.sc * 2);
        c.globalAlpha = 0.5; c.fillRect(xr + d2 * 2 * f.sc, yr, f.sc, f.sc);
      }
      c.restore();
    },
  },

  drift: {   // a long surge of current: leaves and silt stream through the picture in one direction
    layer: 'front', life: 16,
    spawn(e, r) { e.dir = r() < 0.5 ? -1 : 1; e.t = 0; e.bits = Array.from({ length: 60 }, () => ({ x: r() * W, y: r() * H, v: 30 + r() * 50, w: 2 + ((r() * 3) | 0), ph: r() * 6.3 })); },
    step(e, dt) { e.t += dt; for (const b of e.bits) { b.x += e.dir * b.v * dt; if (b.x < -6) b.x += W + 12; if (b.x > W + 6) b.x -= W + 12; } e.done = e.t > this.life; },
    draw(c, e, cam, t) {
      const k = Math.min(1, e.t / 2.5, (this.life - e.t) / 3); c.save();
      for (const b of e.bits) { c.globalAlpha = 0.5 * k; c.fillStyle = b.w > 3 ? '#7ab070' : '#b8e0c0'; c.fillRect(Math.round(b.x), Math.round(b.y + Math.sin(t * 3 + b.ph) * 3), b.w, 1); }
      c.restore();
    },
  },


  // a sea turtle, seen from the side, paddling slowly through mid-water
  turtle: {
    layer: 'back', life: 60,
    spawn(e, r) { e.dir = r() < 0.5 ? -1 : 1; e.x = e.dir > 0 ? -60 : W + 60; e.y = 70 + r() * 110; e.sp = 16 + r() * 8; e.sc = 0.8 + r() * 0.5; e.par = 0.3; },
    step(e, dt) { e.x += e.dir * e.sp * dt; e.done = e.dir > 0 ? e.x > W + 80 : e.x < -80; },
    draw(c, e, cam, t, B) {
      const x = e.x - cam.x * e.par, y = e.y + Math.sin(t * 0.7 + e.x * 0.02) * 4 - cam.y * e.par * 0.3, flap = Math.sin(t * 2.4) * 0.5;
      c.save(); c.translate(x, y); c.scale(e.dir * e.sc, e.sc); c.fillStyle = shade(B.bottom, 0.45, 0.45);
      c.beginPath(); c.ellipse(0, 0, 22, 14, 0, 0, 6.3); c.fill(); c.beginPath(); c.ellipse(24, -2, 7, 5, 0, 0, 6.3); c.fill();
      c.save(); c.translate(6, 8); c.rotate(0.6 + flap); c.beginPath(); c.ellipse(0, 6, 4, 14, 0, 0, 6.3); c.fill(); c.restore();
      c.save(); c.translate(-8, 9); c.rotate(-0.4 - flap); c.beginPath(); c.ellipse(0, 5, 3, 10, 0, 0, 6.3); c.fill(); c.restore();
      c.fillStyle = hex(B.top, 0.18); c.beginPath(); c.ellipse(-2, -5, 14, 6, 0, 0, 6.3); c.fill(); c.restore();
    },
  },

  // a manta ray gliding overhead as a wide shadow, wingtips rippling
  manta: {
    layer: 'back', life: 60,
    spawn(e, r) { e.dir = r() < 0.5 ? -1 : 1; e.x = e.dir > 0 ? -90 : W + 90; e.y = 30 + r() * 60; e.sp = 20 + r() * 10; e.sc = 0.9 + r() * 0.6; e.par = 0.2; },
    step(e, dt) { e.x += e.dir * e.sp * dt; e.done = e.dir > 0 ? e.x > W + 110 : e.x < -110; },
    draw(c, e, cam, t, B) {
      const x = e.x - cam.x * e.par, y = e.y - cam.y * e.par * 0.3 + Math.sin(t * 0.8) * 3, w = Math.sin(t * 2) * 6;
      c.save(); c.translate(x, y); c.scale(e.dir * e.sc, e.sc); c.fillStyle = shade(B.bottom, 0.38, 0.38);
      c.beginPath(); c.moveTo(34, 0); c.quadraticCurveTo(10, -10 - w, -26, -26 + w); c.quadraticCurveTo(-14, -4, -22, 2); c.quadraticCurveTo(-14, 6, -26, 26 - w); c.quadraticCurveTo(10, 10 + w, 34, 0); c.fill();
      c.beginPath(); c.moveTo(-22, 2); c.lineTo(-52, 4 + w * 0.5); c.lineTo(-22, 5); c.fill(); c.restore();
    },
  },

  // a column of bubbles rising from the floor of the view
  bubbles: {
    layer: 'front', life: 14,
    spawn(e, r) { e.t = 0; e.x0 = 40 + r() * (W - 80); e.bits = Array.from({ length: 40 }, () => ({ ph: r() * 6.3, y: r() * H, v: 26 + r() * 30, s: r() < 0.25 ? 2 : 1, dx: (r() - 0.5) * 22 })); },
    step(e, dt) { e.t += dt; for (const b of e.bits) { b.y -= b.v * dt; if (b.y < -4) b.y += H + 8; } e.done = e.t > this.life; },
    draw(c, e, cam, t) {
      const k = Math.min(1, e.t / 2, (this.life - e.t) / 3); c.save();
      for (const b of e.bits) { const x = Math.round(e.x0 + b.dx + Math.sin(t * 2 + b.ph) * 4 - cam.x * 0.4), y = Math.round(b.y); c.globalAlpha = 0.55 * k; c.fillStyle = '#d8f4ff'; c.fillRect(x, y, b.s, b.s); c.globalAlpha = 0.9 * k; c.fillStyle = '#ffffff'; c.fillRect(x, y, 1, 1); }
      c.restore();
    },
  },

  // a slow drift of jellyfish, glowing bells pulsing, tentacles trailing
  jellybloom: {
    layer: 'glow', life: 34,
    spawn(e, r, world) { e.t = 0; e.col = world.zone.biome === 'forest' ? '#9affc0' : world.zone.biome === 'trench' ? '#ff9ac8' : '#9ad8ff'; e.js = Array.from({ length: 9 }, () => ({ x: r() * W, y: H * (0.2 + r() * 0.9), v: 8 + r() * 10, s: 0.7 + r() * 0.8, ph: r() * 6.3, dx: (r() - 0.5) * 8 })); },
    step(e, dt) { e.t += dt; for (const j of e.js) { j.y -= j.v * dt; j.x += j.dx * dt; if (j.y < -40) { j.y = H + 30; } } e.done = e.t > this.life; },
    draw(c, e, cam, t) {
      const k = Math.min(1, e.t / 4, (this.life - e.t) / 5); c.save(); c.globalCompositeOperation = 'lighter';
      for (const j of e.js) {
        const x = j.x - cam.x * 0.55, y = j.y, p = 0.5 + 0.5 * Math.sin(t * 2.2 + j.ph), w = (9 + p * 3) * j.s, h = (7 - p * 2) * j.s;
        c.globalAlpha = 0.85 * k; c.fillStyle = e.col; c.beginPath(); c.ellipse(x, y, w, h, 0, Math.PI, 0); c.fill();
        c.globalAlpha = 0.22 * k; c.fillRect(Math.round(x - w * 0.6), Math.round(y - h * 0.4), Math.round(w * 1.2), 1);
        c.globalAlpha = 0.5 * k; c.strokeStyle = e.col; c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * w * 0.4, y); c.quadraticCurveTo(x + i * w * 0.4 + Math.sin(t * 3 + i + j.ph) * 4, y + 12 * j.s, x + i * w * 0.4 + Math.sin(t * 2.2 + i) * 5, y + 22 * j.s); c.stroke(); }
        const g = c.createRadialGradient(x, y, 0, x, y, 28 * j.s); g.addColorStop(0, e.col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = 0.26 * k; c.fillStyle = g; c.fillRect(x - 28 * j.s, y - 28 * j.s, 56 * j.s, 56 * j.s);
      }
      c.restore();
    },
  },

  // a wave of bioluminescence rolling across the whole view, left to right or right to left
  glowpulse: {
    layer: 'glow', life: 6,
    spawn(e, r, world) { e.dir = r() < 0.5 ? -1 : 1; e.t = 0; e.col = world.zone.biome === 'trench' ? '#ff7ab0' : world.zone.biome === 'domain' ? '#7affe8' : '#5ad8ff'; },
    step(e, dt) { e.t += dt; e.done = e.t > this.life; },
    draw(c, e, cam, t) {
      const f = e.t / this.life, cx = e.dir > 0 ? -80 + f * (W + 160) : W + 80 - f * (W + 160), k = Math.sin(f * Math.PI);
      c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(cx - 90, 0, cx + 90, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, e.col); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.16 * k; c.fillStyle = g; c.fillRect(cx - 90, 0, 180, H); c.globalAlpha = 0.5 * k; c.fillStyle = e.col;
      for (let i = 0; i < 26; i++) { const y = ((i * 53 + t * 20) % H), x = cx + Math.sin(i * 7.1) * 70; c.fillRect(Math.round(x), Math.round(y), 2, 2); }
      c.restore();
    },
  },

  tremor: {
    layer: 'none', life: 4.5,
    spawn(e) { e.t = 0; e.dust = false; },
    step(e, dt, world) {
      e.t += dt;
      if (e.t > 0.4 && !e.dust) { e.dust = true; world.game.audio.sfx('rumble'); }
      if (e.t > 0.4 && e.t < 3.6) { world.shake(1.1); if (Math.random() < dt * 40) world.fx.add({ x: world.cam.x + Math.random() * W, y: world.cam.y - 4, vx: (Math.random() - 0.5) * 8, vy: 40 + Math.random() * 40, life: 1.8, size: 1, color: '#8a7a94', grav: 60, drag: 0.1, fade: true }); }
      e.done = e.t > this.life;
    },
    draw() {},
  },
};

export class AmbientEvents {
  constructor(world) {
    this.w = world; this.r = rng((world.zone.seed | 0) + 4242); this.rnd = () => Math.random();
    this.active = []; this.next = 14 + this.r() * 20; this.log = [];
  }
  get enabled() { return !!setting(this.w.game, 'ambientLife') && !this.w.cinematic && !(this.w.boss && this.w.boss.engaged); }

  pick() {
    const tbl = WEIGHTS[this.w.zone.biome]; if (!tbl) return null;
    const entries = Object.entries(tbl); let total = entries.reduce((a, [, v]) => a + v, 0), x = this.r() * total;
    for (const [k, v] of entries) { if ((x -= v) <= 0) return k; }
    return entries[0][0];
  }
  start(kind) {
    const K = KINDS[kind]; if (!K) return null;
    const e = { kind, done: false }; K.spawn(e, this.r, this.w); this.active.push(e); this.log.push(kind); if (this.log.length > 12) this.log.shift();
    this.w.game.events.emit('ambevent', kind);
    return e;
  }
  // start an event now; `mid` puts travellers in the middle of the screen (used by tests and photo mode)
  force(kind, o = {}) {
    const e = this.start(kind); if (e && o.mid) { if (e.x !== undefined) e.x = W / 2 + (e.dir || 1) * -30; if (e.t !== undefined && kind !== 'tremor') e.t = kind === 'glowpulse' ? 3 : 6; }
    return e;
  }

  update(dt) {
    const calm = !!setting(this.w.game, 'reduceMotion');
    for (const e of this.active) KINDS[e.kind].step(e, dt * (calm && e.kind !== 'tremor' ? 0.5 : 1), this.w);
    this.active = this.active.filter((e) => !e.done);
    if (!this.enabled) return;
    this.next -= dt;
    if (this.next > 0) return;
    this.next = 28 + this.r() * 55;
    if (this.active.length >= 2) return;
    const kind = this.pick(); if (!kind || (calm && kind === 'tremor')) return;
    if (this.active.some((e) => e.kind === kind)) return;
    this.start(kind);
  }
  draw(ctx, cam, layer) {
    if (!this.active.length) return;
    const B = this.w.biome, t = this.w.t;
    for (const e of this.active) { const K = KINDS[e.kind]; if (K.layer === layer) K.draw(ctx, e, cam, t, B, this.w); }
  }
}
