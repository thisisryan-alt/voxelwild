// Atmosphere around the tile map: drifting caustic light, parallax plankton, critters swimming behind the terrain, sparse
// foreground silhouettes, and the visual language of hazards (current streaks, vent plumes). Purely cosmetic.
import { rng, TAU } from '../core/util.js';
import { hexToRgb, rgbHex } from './painter.js';
import { TS, isSolid } from '../world/tiles.js';

const rd = Math.round, sin = Math.sin;
const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };

// ---- caustics: a tileable net of bright filaments, built once per tint --------------------------------------------------------
const CAU = 96, causticCache = new Map();
function causticTex(tint) {
  let c = causticCache.get(tint); if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = CAU; const g = c.getContext('2d'), im = g.createImageData(CAU, CAU), [tr, tg, tb] = hexToRgb(tint);
  const R = rd((255 + tr) / 2), G = rd((255 + tg) / 2), B = rd((255 + tb) / 2);
  for (let y = 0; y < CAU; y++) for (let x = 0; x < CAU; x++) {
    const u = (x / CAU) * TAU, v = (y / CAU) * TAU, a = sin(u * 2 + sin(v * 3) * 1.3) + sin(v * 2 + sin(u * 3 + 1) * 1.3) + sin((u + v) * 2 + 2);
    const i = (y * CAU + x) * 4; im.data[i] = R; im.data[i + 1] = G; im.data[i + 2] = B; im.data[i + 3] = rd(Math.pow(Math.max(0, 1 - Math.abs(a) * 1.15), 5) * 255);
  }
  g.putImageData(im, 0, 0); causticCache.set(tint, c); return c;
}

// ---- per-biome recipe -----------------------------------------------------------------------------------------------------------
const CFG = {
  reef:      { caustic: 0.2,  mote: ['#e8fbff', '#a8e4f8', '#ffffff'], drift: -5, fg: 'kelp', crit: { school: 6, turtle: 1 } },
  forest:    { caustic: 0.12, mote: ['#b8ffb0', '#e8ffc8', '#8ae0a0'], drift: -4, fg: 'kelp', crit: { school: 4, glow: 24 } },
  kingdom:   { caustic: 0.14, mote: ['#ffe8f8', '#d8c0ff', '#ffffff'], drift: -6, fg: 'kelp', crit: { school: 5, glow: 12 } },
  graveyard: { caustic: 0.05, mote: ['#8aa8a0', '#a8c0b8', '#6a8884'], drift: 7,  fg: 'rope', crit: { wisp: 8, school: 2 } },
  abyss:     { caustic: 0,    mote: ['#58d0e8', '#c07aff', '#6aff9a'], drift: 3,  fg: 'tendril', glow: true, crit: { jelly: 6, lure: 3, glow: 16 } },
  trench:    { caustic: 0,    mote: ['#ff7a9a', '#c040c0', '#ffb0a0'], drift: -9, fg: 'spire', glow: true, crit: { jelly: 3, glow: 14 } },
  domain:    { caustic: 0.14, mote: ['#9af0e0', '#ffffff', '#d0fff8'], drift: -4, fg: 'crystal', glow: true, crit: { school: 4, glow: 18 } },
};
const SCHOOL = { reef: ['#ffd84a', '#5ac0f0', '#ff8aa8'], forest: ['#b8e0c8', '#78d0a0'], kingdom: ['#ffb0d8', '#c8a0ff'], graveyard: ['#506a70'], domain: ['#9af0e0', '#ffffff'] };

// ---- foreground strips (pre-rendered, wrap-tiled) -------------------------------------------------------------------------
const FW = 512, FH = 120, fgCache = new Map();
function fgStrip(biome, B, seed) {
  const key = biome + seed; let c = fgCache.get(key); if (c) return c;
  const cfg = CFG[biome], r = rng(seed * 13 + 5), cv = document.createElement('canvas'); cv.width = FW; cv.height = FH; const g = cv.getContext('2d');
  const col = mix(B.bottom, '#000000', 0.62), rim = mix(B.top, B.tint, 0.5), top = cfg.fg === 'rope' || cfg.fg === 'tendril';
  g.fillStyle = col;
  const n = cfg.fg === 'spire' ? 7 : 9;
  for (let i = 0; i < n; i++) {
    const x = rd((i / n) * FW + r.range(-18, 18)), h = rd(r.range(34, FH - 8)), w = cfg.fg === 'spire' || cfg.fg === 'crystal' ? rd(r.range(10, 22)) : rd(r.range(3, 6));
    if (cfg.fg === 'kelp') { for (let y = 0; y < h; y += 2) { const xx = x + rd(sin(y * 0.07 + i) * 3); g.fillRect(xx, FH - y - 2, w - (y > h * 0.7 ? 1 : 0), 2); if (y % 10 === 0) { g.fillRect(xx + w, FH - y - 4, 5, 2); g.fillRect(xx - 4, FH - y - 8, 4, 2); } } }
    else if (cfg.fg === 'rope') { for (let y = 0; y < h; y += 2) g.fillRect(x + rd(sin(y * 0.05 + i) * 2), y, 2, 2); g.fillRect(x - 3, h, 8, 4); }
    else if (cfg.fg === 'tendril') { for (let y = 0; y < h; y += 2) { g.fillRect(x + rd(sin(y * 0.09 + i * 2) * 4), y, 2, 2); } g.fillStyle = rim; g.globalAlpha = 0.55; g.fillRect(x + rd(sin(h * 0.09 + i * 2) * 4), h, 2, 2); g.globalAlpha = 1; g.fillStyle = col; }
    else if (cfg.fg === 'spire') { g.beginPath(); g.moveTo(x - w, FH); g.lineTo(x, FH - h); g.lineTo(x + w, FH); g.fill(); }
    else { g.beginPath(); g.moveTo(x - w * 0.5, FH); g.lineTo(x - w * 0.2, FH - h); g.lineTo(x + w * 0.35, FH - h * 0.85); g.lineTo(x + w * 0.6, FH); g.fill(); }
  }
  c = { cv, top, sway: cfg.fg === 'kelp' ? 2.4 : cfg.fg === 'rope' || cfg.fg === 'tendril' ? 1.6 : 0 }; fgCache.set(key, c); return c;
}

export class Ambience {
  constructor(zone, B) {
    this.zone = zone; this.B = B; this.cfg = CFG[B.id] || CFG.reef; const r = this.r = rng((zone.seed || 1) * 7 + 3);
    this.tex = this.cfg.caustic ? causticTex(B.tint) : null;
    // plankton: two depth layers wrapping around a virtual 520 x 300 field
    const mk = (n, par, size, a) => Array.from({ length: n }, () => ({ x: r.range(0, 520), y: r.range(0, 300), par, size, a, c: this.cfg.mote[Math.floor(r() * this.cfg.mote.length)], ph: r.range(0, TAU), v: r.range(0.5, 1.4) }));
    this.far = mk(54, 0.35, 1, 0.35); this.near = mk(26, 1.3, 2, 0.5);
    this.fg = fgStrip(B.id, B, zone.seed || 1);
    // critters: wander around random open-water homes
    const g = zone.grid, open = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -2; i <= 2; i++) if (isSolid(g.get(x + i, y + j))) return false; return true; };
    this.crit = [];
    for (const [kind, n] of Object.entries(this.cfg.crit)) for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 60; tries++) {
        const tx = 4 + Math.floor(r() * (g.w - 8)), ty = 4 + Math.floor(r() * (g.h - 8)); if (!open(tx, ty)) continue;
        const o = { kind, hx: (tx + 0.5) * TS, hy: (ty + 0.5) * TS, ph: r.range(0, TAU), sp: r.range(0.25, 0.6), rx: r.range(40, 120), ry: r.range(8, 30), col: kind === 'school' ? (SCHOOL[B.id] || SCHOOL.reef)[Math.floor(r() * (SCHOOL[B.id] || SCHOOL.reef).length)] : this.cfg.mote[Math.floor(r() * this.cfg.mote.length)], n: kind === 'school' ? 4 + Math.floor(r() * 4) : 1 };
        this.crit.push(o); break;
      }
    }
    this.t = 0; this.streak = 0;
  }

  // ---- update: hazard language (current streaks, vent plumes) ---------------------------------------------------------------
  update(dt, w) {
    this.t += dt; this.player = w.player; const c = w.cam, fx = w.fx;
    for (const a of this.zone.areas) {
      if (a.x > c.x + 480 || a.x + a.w < c.x || a.y > c.y + 270 || a.y + a.h < c.y) continue;
      if (a.kind === 'current' && (a.vx || a.vy)) {
        const x0 = Math.max(a.x, c.x), x1 = Math.min(a.x + a.w, c.x + 480), y0 = Math.max(a.y, c.y), y1 = Math.min(a.y + a.h, c.y + 270), n = Math.min(34, (x1 - x0) * (y1 - y0) / 2600);
        this.streak += n * dt; while (this.streak >= 1) { this.streak--; fx.add({ x: x0 + this.r() * (x1 - x0), y: y0 + this.r() * (y1 - y0), vx: (a.vx || 0) * 0.9, vy: (a.vy || 0) * 0.9, life: 0.55, size: 1, color: '#ffffff', kind: 'streak', drag: 0, len: 0.12 }); }
      } else if (a.kind === 'vent') {
        const cyc = a.period || 4, k = (w.t + (a.phase || 0)) % cyc, on = k < (a.on || 1.4), warn = !on && k > cyc - 0.8, bx = a.x + a.w / 2, by = a.y + a.h;
        if (on && this.r() < dt * 70) fx.add({ x: bx + (this.r() - 0.5) * a.w * 0.8, y: by - this.r() * 8, vx: (this.r() - 0.5) * 14, vy: -120 - this.r() * 90, life: 0.5 + this.r() * 0.3, size: this.r() < 0.4 ? 2 : 1, color: ['#ffb040', '#ff6a3a', '#fff0b0'][Math.floor(this.r() * 3)], drag: 0.8 });
        else if (warn && this.r() < dt * 12) fx.add({ x: bx + (this.r() - 0.5) * a.w * 0.6, y: by - 2, vx: 0, vy: -26, life: 0.7, size: 1, color: '#ff9a5a', drag: 0.4 });
        else if (!on && !warn && this.r() < dt * 3) fx.bubble(bx + (this.r() - 0.5) * a.w * 0.6, by - 2, 1, 2, -16);
      }
    }
  }

  // ---- behind the terrain: caustics, far plankton, critters ------------------------------------------------------------------
  drawBehind(ctx, cam, t, ph) {
    const cfg = this.cfg;
    if (this.tex) {
      const a = cfg.caustic * Math.max(0, 1 - ph * 1.15); if (a > 0.01) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        for (const [sx, sy, vx, vy, k] of [[1, 1, 5, 3, 1], [-1, 1, -4, 5, 0.6]]) {
          ctx.globalAlpha = a * k; const ox = (((-cam.x * 0.9 + t * vx) % CAU) + CAU) % CAU, oy = (((-cam.y * 0.9 + t * vy) % CAU) + CAU) % CAU;
          for (let y = oy - CAU; y < 270; y += CAU) for (let x = ox - CAU; x < 480; x += CAU) ctx.drawImage(this.tex, rd(x), rd(y));
        }
        ctx.restore();
      }
    }
    this.motes(ctx, cam, t, this.far);
    this.critters(ctx, cam, t);
  }
  motes(ctx, cam, t, list) {
    const glow = this.cfg.glow, drift = this.cfg.drift;
    for (const p of list) {
      const x = (((p.x - cam.x * p.par + sin(t * 0.4 * p.v + p.ph) * 6) % 520) + 520) % 520 - 20, y = (((p.y + drift * t * p.v * 0.6 - cam.y * p.par * 0.8) % 300) + 300) % 300 - 15;
      const tw = glow ? 0.55 + 0.45 * sin(t * 1.3 * p.v + p.ph) : 1; ctx.globalAlpha = p.a * tw; ctx.fillStyle = p.c; ctx.fillRect(rd(x), rd(y), p.size, p.size);
      if (glow && p.size > 1) { ctx.globalAlpha = p.a * tw * 0.25; ctx.fillRect(rd(x) - 1, rd(y) - 1, p.size + 2, p.size + 2); }
    }
    ctx.globalAlpha = 1;
  }
  critters(ctx, cam, t) {
    const pl = this.player;
    for (const o of this.crit) {
      const cx = o.hx + Math.sin(t * o.sp + o.ph) * o.rx, cy = o.hy + Math.sin(t * o.sp * 1.7 + o.ph * 2) * o.ry, dirn = Math.cos(t * o.sp + o.ph) >= 0 ? 1 : -1;
      const sx = cx - cam.x, sy = cy - cam.y; if (sx < -80 || sx > 560 || sy < -60 || sy > 330) continue;
      if (o.kind === 'school') {
        ctx.fillStyle = o.col;
        for (let i = 0; i < o.n; i++) {
          let fx = sx - dirn * i * 7 + Math.sin(t * 1.3 + i * 2) * 3, fy = sy + Math.sin(t * 1.1 + i * 1.7) * 5 + (i % 2) * 4;
          if (pl) { const dx = fx + cam.x - pl.x, dy = fy + cam.y - pl.y, d = Math.hypot(dx, dy); if (d < 46) { fx += (dx / (d || 1)) * (46 - d) * 0.8; fy += (dy / (d || 1)) * (46 - d) * 0.8; } }
          const fl = (t * 6 + i) % 2 | 0; ctx.globalAlpha = 0.8; ctx.fillRect(rd(fx), rd(fy), 5, 2); ctx.fillRect(rd(fx) - dirn * 2, rd(fy) - fl, 2, 1 + fl * 2); ctx.globalAlpha = 1; ctx.fillStyle = '#10243a'; ctx.fillRect(rd(fx) + (dirn > 0 ? 4 : 0), rd(fy), 1, 1); ctx.fillStyle = o.col;
        }
      } else if (o.kind === 'turtle') {
        ctx.globalAlpha = 0.55; ctx.fillStyle = '#2a6a5a'; ctx.fillRect(rd(sx) - 7, rd(sy) - 3, 14, 6); ctx.fillRect(rd(sx) - 5, rd(sy) - 5, 10, 2); ctx.fillStyle = '#58a888'; ctx.fillRect(rd(sx) - 4, rd(sy) - 3, 8, 2); ctx.fillStyle = '#2a6a5a';
        ctx.fillRect(rd(sx) + dirn * 8, rd(sy) - 1, 4, 3); const fl = rd(sin(t * 3 + o.ph) * 3); ctx.fillRect(rd(sx) - 3, rd(sy) + 3, 6, 2); ctx.fillRect(rd(sx) - 2 + fl, rd(sy) - 6 - Math.abs(fl), 5, 2); ctx.globalAlpha = 1;
      } else if (o.kind === 'jelly') {
        const bob = sin(t * 0.9 + o.ph) * 2, pulse = sin(t * 2 + o.ph) * 1; ctx.globalAlpha = 0.22; ctx.fillStyle = o.col; ctx.beginPath(); ctx.ellipse(rd(sx), rd(sy + bob), 9 + pulse, 6 - pulse * 0.4, 0, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 0.5; ctx.fillRect(rd(sx) - 6, rd(sy + bob), 12, 1);
        for (let k = -2; k <= 2; k++) { ctx.globalAlpha = 0.28; ctx.fillRect(rd(sx) + k * 3 + rd(sin(t * 2 + k + o.ph) * 1.5), rd(sy + bob) + 1, 1, 9 + (k & 1) * 4); }
        ctx.globalAlpha = 0.08; ctx.beginPath(); ctx.arc(rd(sx), rd(sy + bob), 20, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      } else if (o.kind === 'lure') {
        const on = sin(t * 0.8 + o.ph) > -0.2; if (on) { ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.fillRect(rd(sx), rd(sy), 2, 2); ctx.globalAlpha = 0.2; ctx.fillStyle = o.col; ctx.beginPath(); ctx.arc(rd(sx) + 1, rd(sy) + 1, 9, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
      } else if (o.kind === 'glow' || o.kind === 'wisp') {
        const a = 0.35 + 0.35 * sin(t * 1.6 + o.ph); ctx.globalAlpha = a; ctx.fillStyle = o.col; ctx.fillRect(rd(sx), rd(sy), 2, 2); ctx.globalAlpha = a * 0.22; ctx.fillRect(rd(sx) - 2, rd(sy) - 2, 6, 6);
        if (o.kind === 'wisp') { ctx.globalAlpha = a * 0.4; for (let k = 1; k < 5; k++) ctx.fillRect(rd(sx) - dirn * k * 3, rd(sy) + k % 2, 2, 1); }
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---- in front of the action: near plankton, soft foreground silhouettes, vent glows ---------------------------------------
  drawAhead(ctx, cam, t) {
    this.motes(ctx, cam, t, this.near);
    const f = this.fg, par = 1.55, ox = ((((-cam.x * par) % FW) + FW) % FW), top = f.top;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 80, 270); ctx.rect(400, 0, 80, 270); ctx.clip(); ctx.globalAlpha = 0.42; // only framing the screen edges, never crossing the middle of the action
    for (let x = ox - FW; x < 480; x += FW) {
      if (!f.sway) { ctx.drawImage(f.cv, rd(x), top ? -22 : 270 - FH + 22); continue; }
      for (let y = 0; y < FH; y += 4) { const sh = rd(sin(t * 0.9 + y * 0.05 + x * 0.01) * f.sway * (top ? y / FH : (FH - y) / FH)); ctx.drawImage(f.cv, 0, y, FW, 4, rd(x) + sh, (top ? -22 : 270 - FH + 22) + y, FW, 4); }
    }
    ctx.restore();
    for (const a of this.zone.areas) {
      if (a.kind !== 'vent' || a.x > cam.x + 480 || a.x + a.w < cam.x) continue;
      const cyc = a.period || 4, k = (this.t + (a.phase || 0)) % cyc, on = k < (a.on || 1.4), warn = !on && k > cyc - 0.8; if (!on && !warn) continue;
      const x = rd(a.x - cam.x), y = rd(a.y - cam.y), gr = ctx.createLinearGradient(0, y + a.h, 0, y); gr.addColorStop(0, on ? 'rgba(255,150,60,0.55)' : 'rgba(255,150,60,0.18)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = gr; ctx.globalAlpha = on ? 0.7 + 0.3 * sin(t * 30) : 0.5 + 0.5 * sin(t * 14); ctx.fillRect(x + 2, y, a.w - 4, a.h); ctx.globalAlpha = 1;
    }
  }
}
