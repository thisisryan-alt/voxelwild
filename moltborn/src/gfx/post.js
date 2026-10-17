// Post-processing for the world picture: colour grading per realm, bloom, water refraction, heat haze, shock ripples,
// chromatic pulses on hard hits, a low-health desaturate-and-pulse, and optional scanlines. It runs on the canvas
// after the world is drawn and before the HUD, so interface text is never smeared. Every effect obeys the options
// (bloom / grading / wobble / scanlines / reduce flashes / reduce motion) and a frame-rate governor drops the
// expensive ones if the machine cannot keep up.
import { clamp } from '../core/util.js';
import { setting } from '../systems/settings.js';
import { TS } from '../world/tiles.js';

const W = 480, H = 270;
const BAND = 2;                      // rows per refraction band

// per-realm grade: `shade` multiplies the shadows, `glow` is soft-lit over the highlights, `sat` > 1 punches colour
export const GRADES = {
  reef:      { shade: '#a8c8ff', glow: '#fff0c0', sat: 1.12, lift: 0.00 },
  forest:    { shade: '#98d8b8', glow: '#e0ffb0', sat: 1.06, lift: 0.00 },
  kingdom:   { shade: '#b0a8e8', glow: '#ffe8a0', sat: 1.14, lift: 0.02 },
  graveyard: { shade: '#a8b8b0', glow: '#c0e8d8', sat: 0.82, lift: 0.00 },
  abyss:     { shade: '#8070c8', glow: '#90c8ff', sat: 1.04, lift: 0.00 },
  trench:    { shade: '#b07898', glow: '#ff98a8', sat: 0.94, lift: 0.00 },
  domain:    { shade: '#8890f0', glow: '#a8f4ff', sat: 1.18, lift: 0.03 },
};
const NEUTRAL = { shade: '#c0c8d8', glow: '#ffffff', sat: 1, lift: 0 };

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export class PostFX {
  constructor(game) {
    this.g = game; game.systems.post = this;
    this.t = 0; this.chroma = 0; this.pulse = 0; this.lowHp = 0; this.beat = 0; this.ripples = []; this.heat = 0;
    this.frame = canvas(W, H); this.small = canvas(W / 4, H / 4); this.tiny = canvas(W / 8, H / 8);
    this.chan = null; this.vignette = null; this.scan = null; this.hurtVig = null;
    this.lite = false; this.slowFor = 0; this.fastFor = 0;
    this.stats = { bloom: false, bands: 0, chroma: false, haze: 0, ripples: 0 };
    const ev = game.events;
    ev.on('hurt', (n, src, blocked) => { const m = game.world?.player?.stats?.maxHp || 100; this.kick(blocked ? 0.4 : Math.min(3, 0.8 + (n / m) * 10)); });
    ev.on('hitdealt', (e, dmg, crit) => { if (crit) this.kick(0.7); });
    ev.on('bigshake', (x, y, a) => this.ripple(x, y, Math.min(3.5, a * 0.45)));
    ev.on('boss', () => { this.kick(2.2); });
    ev.on('playerdied', () => { this.kick(3); });
    ev.on('zone', () => { this.ripples.length = 0; this.chroma = 0; });
  }

  // ---- triggers -------------------------------------------------------------------------------------------------------
  kick(amount) { this.chroma = Math.max(this.chroma, amount * (setting(this.g, 'reduceFlashes') ? 0.25 : 1)); this.pulse = Math.max(this.pulse, amount); }
  ripple(x, y, amp) {
    if (setting(this.g, 'reduceMotion') || setting(this.g, 'wobble') <= 0) return;
    if (this.ripples.length < 4) this.ripples.push({ x, y, t: 0, life: 0.7, amp, r0: 6 });
  }

  update(dt) {
    this.t += dt;
    this.chroma = Math.max(0, this.chroma - dt * 7); this.pulse = Math.max(0, this.pulse - dt * 4);
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter((r) => r.t < r.life);
    const p = this.g.world?.player;
    const want = p && p.alive ? clamp((0.38 - p.hp / p.stats.maxHp) / 0.3, 0, 1) : 0;
    this.lowHp += (want - this.lowHp) * Math.min(1, dt * 3);
    if (this.lowHp > 0.05) { this.beat += dt * (1.6 + this.lowHp * 1.4); if (this.beat >= 1) { this.beat -= 1; this.g.events.emit('heartbeat', this.lowHp); } }
    // frame-rate governor: if the page cannot hold ~50 fps for two seconds, run without the costly passes
    const fps = this.g.engine.fps;
    if (this.g.engine.frames > 0 || fps) {
      if (fps && fps < 42) { this.slowFor += dt; this.fastFor = 0; } else { this.fastFor += dt; if (fps >= 54) this.slowFor = Math.max(0, this.slowFor - dt); }
      if (!this.lite && this.slowFor > 2.5) this.lite = true;
      if (this.lite && this.fastFor > 8) { this.lite = false; this.slowFor = 0; }
    }
  }

  // ---- main entry (called by World.draw) --------------------------------------------------------------------------------
  apply(ctx, world, cam) {
    const g = this.g, st = this.stats;
    st.bloom = false; st.bands = 0; st.chroma = false; st.haze = 0; st.ripples = 0;
    const grading = setting(g, 'grading'), bloom = setting(g, 'bloom'), wobble = setting(g, 'wobble');
    const calm = !!setting(g, 'reduceMotion'), lite = this.lite;
    if (grading > 0.01) this.grade(ctx, world, grading);
    if (bloom > 0.01 && !lite) this.bloomPass(ctx, bloom);
    const needFrame = (wobble > 0.01 && !calm && !lite) || this.chroma > 0.05;
    if (needFrame) {
      const f = this.frame.getContext('2d'); f.globalCompositeOperation = 'copy'; f.drawImage(ctx.canvas, 0, 0); f.globalCompositeOperation = 'source-over';
      if (wobble > 0.01 && !calm && !lite) this.refract(ctx, world, cam, wobble);
      if (this.chroma > 0.05) this.aberrate(ctx);
    }
    if (this.lowHp > 0.03) this.hurtLook(ctx);
    if (setting(g, 'scanlines')) this.scanlines(ctx);
  }

  // ---- colour grade -----------------------------------------------------------------------------------------------------
  grade(ctx, world, k) {
    const G = GRADES[world.zone.biome] || NEUTRAL, depth = clamp(world.player.y / Math.max(1, world.zone.h * TS), 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.12 * k + depth * 0.1 * k; ctx.fillStyle = G.shade; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = (0.14 + (1 - depth) * 0.1) * k; ctx.fillStyle = G.glow; ctx.fillRect(0, 0, W, H);
    if (G.sat < 1) { ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = (1 - G.sat) * k; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); }
    else if (G.sat > 1) { ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = (G.sat - 1) * 1.1 * k; ctx.drawImage(ctx.canvas, 0, 0); }
    if (G.lift) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = G.lift * k; ctx.fillStyle = G.glow; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
    this.edge(ctx, k * (0.35 + depth * 0.25));
  }
  // darkened corners, pre-rendered once
  edge(ctx, a) {
    if (!this.vignette) {
      const c = canvas(W, H), x = c.getContext('2d'), gr = x.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, W * 0.66);
      gr.addColorStop(0, 'rgba(0,4,16,0)'); gr.addColorStop(1, 'rgba(0,4,16,0.55)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); this.vignette = c;
    }
    ctx.globalAlpha = a; ctx.drawImage(this.vignette, 0, 0); ctx.globalAlpha = 1;
  }

  // ---- bloom: bright areas, blurred by down-sampling twice, added back over the picture ---------------------------------------
  bloomPass(ctx, k) {
    const s = this.small.getContext('2d'), t = this.tiny.getContext('2d');
    s.imageSmoothingEnabled = true; t.imageSmoothingEnabled = true;
    s.globalCompositeOperation = 'copy'; s.drawImage(ctx.canvas, 0, 0, W / 4, H / 4);
    s.globalCompositeOperation = 'multiply'; s.drawImage(this.small, 0, 0); s.drawImage(this.small, 0, 0);   // cubing keeps only what is very bright
    s.globalCompositeOperation = 'source-over';
    t.globalCompositeOperation = 'copy'; t.drawImage(this.small, 0, 0, W / 8, H / 8); t.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * k; ctx.drawImage(this.small, 0, 0, W, H);
    ctx.globalAlpha = 0.45 * k; ctx.drawImage(this.tiny, 0, 0, W, H);
    ctx.restore(); this.stats.bloom = true;
  }

  // ---- refraction: the picture is re-laid in thin bands nudged sideways by a travelling wave ------------------------------------
  refract(ctx, world, cam, k) {
    const depth = clamp(world.player.y / Math.max(1, world.zone.h * TS), 0, 1), amp = k * (1.15 - depth * 0.5);
    const t = this.t, haze = this.hazeRects(world, cam), rip = this.ripples;
    let n = 0;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < H; y += BAND) {
      let dx = Math.round(Math.sin(t * 1.7 + y * 0.062) * amp * 0.9 + Math.sin(t * 0.8 - y * 0.017) * amp * 0.7);
      if (dx !== 0) { ctx.drawImage(this.frame, 0, y, W, BAND, dx, y, W, BAND); n++; }
      for (const h of haze) {
        if (y + BAND < h.y || y > h.y + h.h) continue;
        const fall = 1 - (y - h.y) / h.h, hx = Math.round(Math.sin(t * 5.5 + y * 0.31 + h.ph) * (1.4 + fall * 1.6) * h.k);
        if (hx) { ctx.drawImage(this.frame, h.x, y, h.w, BAND, h.x + hx, y, h.w, BAND); n++; }
      }
    }
    for (const r of rip) n += this.rippleBands(ctx, r, cam);
    ctx.restore();
    this.stats.bands = n; this.stats.haze = haze.length; this.stats.ripples = rip.length;
  }
  // vents breathe hot water: a column of shimmer above each active vent area that is on screen
  hazeRects(world, cam) {
    const out = [];
    for (const a of world.zone.areas || []) {
      if (a.kind !== 'vent') continue;
      const on = (world.t + (a.phase || 0)) % (a.period || 4) < (a.on || 1.4) + 0.8;
      const x = a.x - cam.x, y = a.y - cam.y;
      if (x > W || x + a.w < 0 || y > H || y + a.h < 0) continue;
      const rx = clamp(Math.round(x - 6), 0, W), rw = clamp(Math.round(a.w + 12), 1, W - rx), ry = clamp(Math.round(y - 20), 0, H), rh = clamp(Math.round(a.h + 20), 4, H - ry);
      out.push({ x: rx, y: ry, w: rw, h: rh, k: on ? 1 : 0.35, ph: a.x * 0.01 });
      if (out.length >= 5) break;
    }
    return out;
  }
  // an expanding ring where picture pixels are pushed outward from the centre
  rippleBands(ctx, r, cam) {
    const k = r.t / r.life, R = r.r0 + k * 120, w = 10 + k * 8, cx = r.x - cam.x, cy = r.y - cam.y, a = r.amp * (1 - k) * (1 - k);
    let n = 0;
    for (let y = Math.max(0, Math.floor(cy - R - w)); y < Math.min(H, cy + R + w); y += BAND) {
      const dy = y + BAND / 2 - cy, o2 = (R + w) * (R + w) - dy * dy; if (o2 <= 0) continue;
      const i2 = (R - w) * (R - w) - dy * dy, o = Math.sqrt(o2), inn = i2 > 0 ? Math.sqrt(i2) : 0;
      const sx = Math.round(a);
      if (sx < 1) continue;
      const lx = Math.round(cx - o), lw = Math.round(o - inn), rx = Math.round(cx + inn);
      if (lw > 0) {
        const sl = clamp(lx, 0, W), sw = clamp(lx + lw, 0, W) - sl; if (sw > 0) { ctx.drawImage(this.frame, sl, y, sw, BAND, sl - sx, y, sw, BAND); n++; }
        const sr = clamp(rx, 0, W), sw2 = clamp(rx + lw, 0, W) - sr; if (sw2 > 0) { ctx.drawImage(this.frame, sr, y, sw2, BAND, sr + sx, y, sw2, BAND); n++; }
      }
    }
    return n;
  }

  // ---- chromatic split: red, green and blue copies pulled apart for a few frames ----------------------------------------------------
  aberrate(ctx) {
    const px = Math.round(clamp(this.chroma, 0, 3)); if (px < 1) return;
    if (!this.chan) this.chan = ['#ff0000', '#00ff00', '#0000ff'].map((col) => ({ col, c: canvas(W, H) }));
    for (const ch of this.chan) {
      const x = ch.c.getContext('2d'); x.globalCompositeOperation = 'copy'; x.drawImage(this.frame, 0, 0);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = ch.col; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
    }
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.chan[0].c, -px, 0); ctx.drawImage(this.chan[1].c, 0, 0); ctx.drawImage(this.chan[2].c, px, 0);
    ctx.restore(); this.stats.chroma = true;
  }

  // ---- low health: drained colour and a red edge that beats ------------------------------------------------------------------------
  hurtLook(ctx) {
    const k = this.lowHp, calm = setting(this.g, 'reduceFlashes');
    ctx.save();
    ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = 0.55 * k; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    if (!this.hurtVig) {
      const c = canvas(W, H), x = c.getContext('2d'), gr = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.62);
      gr.addColorStop(0, 'rgba(160,0,10,0)'); gr.addColorStop(1, 'rgba(160,0,10,0.75)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); this.hurtVig = c;
    }
    const beat = calm ? 0.5 : 0.5 + 0.5 * Math.sin(this.beat * Math.PI * 2 - 1.2) ** 3;
    ctx.globalAlpha = k * (0.25 + 0.45 * beat); ctx.drawImage(this.hurtVig, 0, 0); ctx.globalAlpha = 1;
  }

  scanlines(ctx) {
    if (!this.scan) {
      const c = canvas(W, H), x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0.2)';
      for (let y = 1; y < H; y += 2) x.fillRect(0, y, W, 1);
      this.scan = c;
    }
    ctx.drawImage(this.scan, 0, 0);
  }
}
