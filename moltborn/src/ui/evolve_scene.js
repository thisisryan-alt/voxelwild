// The evolution cinematic: letterbox, rising light, the old shell cracking, a white-out, and the reveal.
import { FORMS, BRANCHES, EVOLUTIONS } from '../data/forms.js';
import { playerFrame, variantFor } from '../gfx/sprites_player.js';
import { flashOf } from '../gfx/painter.js';
import { drawText, textWidth, wrapText } from '../gfx/font.js';
import { panel, text, COL } from './ui.js';
import { drawFrame } from '../entities/entity.js';
import { rng, TAU, ease } from '../core/util.js';

const rand = rng(777);

export class EvolveScene {
  constructor(game, to, branchId) {
    this.g = game; this.to = to; this.branchId = branchId; this.opaque = false; this.t = 0; this.phase = 0; this.swapped = false; this.done = false;
    this.from = game.state.form; this.parts = []; this.sparks = [];
    this.accent = { warrior: '#ffd88a', abyssal: '#a8a0ff', leviathan: '#ffb070', mythic: '#9af0ff', primordial: '#ffffff' }[to] || '#ffffff';
    this.lines = [];
  }
  onEnter() {
    const g = this.g, w = g.world, p = w.player;
    w.cinematic = true; p.locked = true; p.hideSprite = true; g.playScene.letterTarget = 34;
    w.camFocus = { x: p.x, y: p.y - 6 }; this.px = p.x; this.py = p.y; this.pb = p.bottom;
    g.audio.music.duck?.(0.15, 8); g.audio.sfx('evolve'); this.oldSt = JSON.parse(JSON.stringify({ form: g.state.form, branches: g.state.branches, dye: g.state.dye }));
    this.oldFrame = playerFrame(this.from, variantFor(g.state), 'idle', 0); this.oldFlip = p.facing < 0; this.dir = p.facing;
  }
  update(dt) {
    const g = this.g, w = g.world, p = w.player, inp = g.input;
    this.t += dt; const t = this.t;
    w.fx.update(dt); w.updateCamera(dt); w.flash = Math.max(0, w.flash - dt); w.shakeAmt *= Math.exp(-6 * dt); g.playScene.letterbox += (g.playScene.letterTarget - g.playScene.letterbox) * Math.min(1, dt * 4); g.playScene.hud.update(dt);
    // particles spiral inward during charge-up
    if (t < 3.2 && rand() < 0.9) { const a = rand() * TAU, r = 90 + rand() * 40; this.parts.push({ a, r, s: 0.5 + rand() * 0.8, life: 1.6, y: (rand() - 0.5) * 40, c: this.accent }); }
    for (const q of this.parts) { q.r -= (60 + (3.2 - Math.min(t, 3.2)) * 20) * dt; q.a += dt * 4; q.life -= dt; }
    this.parts = this.parts.filter((q) => q.life > 0 && q.r > 4);
    if (t > 0.3 && t < 3.1 && rand() < 0.4) w.fx.bubble(this.px, this.pb - 4, 1, 12, -40);
    if (t > 1.2 && t < 3.1) w.shakeAmt = Math.max(w.shakeAmt, (t - 1.2) * 1.4);
    // phase: swap form at the white-out
    if (t >= 3.1 && !this.swapped) {
      this.swapped = true; g.systems.evolution.apply(this.to, this.branchId); p.hideSprite = true; w.flash = 0.9; w.shakeAmt = 10; g.audio.sfx('evolve_burst');
      w.fx.ring(this.px, this.py, 4, 220, 0.9, '#ffffff', 4); w.fx.ring(this.px, this.py, 4, 150, 0.7, this.accent, 3);
      for (let i = 0; i < 80; i++) { const a = rand() * TAU, s = 60 + rand() * 200; w.fx.add({ x: this.px, y: this.py, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 + rand(), size: 2, color: rand() < 0.5 ? this.accent : '#ffffff', drag: 2, shrink: true }); }
      this.newFrame = playerFrame(this.to, variantFor(g.state), 'idle', 0);
      const F = FORMS[this.to]; this.title = EVOLUTIONS[this.to].title; this.lines = wrapText(F.biology, 300);
      this.unlocks = F.unlocks; this.branch = this.branchId ? BRANCHES[this.branchId] : null;
    }
    if (t >= 3.1) { p.y -= 0; if (Math.floor(t * 60) % 14 === 0 && t < 5) w.fx.ring(this.px, this.py, 4, 80, 0.5, this.accent, 1); }
    if (t > 5.2 && (inp.pressed('confirm') || inp.pressed('attack') || t > 14)) this.finish();
  }
  finish() {
    const g = this.g, w = g.world, p = w.player;
    p.hideSprite = false; w.cinematic = false; w.camFocus = null; p.locked = false; g.playScene.letterTarget = 0; g.audio.music.duck?.(1, 2);
    g.engine.pop(); g.saveGame(true); g.toast(`You are now the ${FORMS[this.to].name}`, '#ffd84a');
    g.systems.quests?.check?.();
  }
  draw(ctx) {
    const g = this.g, w = g.world, cam = w.lastCam || w.cam, t = this.t;
    const sx = this.px - cam.x, sy = this.pb - cam.y;
    // darken the world around the shrine
    const dark = t < 3.1 ? Math.min(0.6, t * 0.4) : Math.max(0, 0.6 - (t - 3.1) * 0.3);
    ctx.globalAlpha = dark; ctx.fillStyle = '#02050f'; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1;
    // radial light rays
    const intensity = t < 3.1 ? Math.min(1, t / 3) : Math.max(0, 1 - (t - 3.1) * 0.6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rays = 16; for (let i = 0; i < rays; i++) { const a = (i / rays) * TAU + t * 0.4, L = 40 + intensity * 150 * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.7)); ctx.globalAlpha = 0.07 + intensity * 0.12; ctx.fillStyle = this.accent; ctx.beginPath(); ctx.moveTo(sx, sy - 10); ctx.lineTo(sx + Math.cos(a - 0.05) * L, sy - 10 + Math.sin(a - 0.05) * L); ctx.lineTo(sx + Math.cos(a + 0.05) * L, sy - 10 + Math.sin(a + 0.05) * L); ctx.fill(); }
    ctx.globalAlpha = 0.25 * intensity; ctx.fillStyle = this.accent; ctx.beginPath(); ctx.arc(sx, sy - 10, 28 + intensity * 30, 0, TAU); ctx.fill();
    for (const q of this.parts) { ctx.globalAlpha = Math.min(1, q.life); ctx.fillStyle = q.c; ctx.fillRect(Math.round(sx + Math.cos(q.a) * q.r), Math.round(sy - 10 + Math.sin(q.a) * q.r * 0.6 + q.y * 0.2), q.s > 1 ? 2 : 1, q.s > 1 ? 2 : 1); }
    ctx.restore(); ctx.globalAlpha = 1;
    // the hero
    if (t < 3.1) {
      const shake = t > 1.2 ? Math.round((Math.random() - 0.5) * (t - 1.2) * 1.6) : 0;
      const f = this.oldFrame; drawFrame(ctx, f, sx + shake, sy, this.oldFlip);
      if (t > 0.9) { // cracks of light across the old shell
        const n = Math.floor((t - 0.9) * 9); ctx.fillStyle = '#ffffff'; const rr = rand;
        for (let i = 0; i < n; i++) { const a = (i * 2.399) % TAU, L = 5 + (i % 4) * 4; for (let k = 0; k < L; k++) ctx.fillRect(Math.round(sx + Math.cos(a) * k * 0.8 + shake), Math.round(sy - 12 + Math.sin(a) * k * 0.6), 1, 1); }
        ctx.globalAlpha = Math.min(0.9, (t - 1.5) * 0.4); ctx.drawImage(flashOf(f), Math.round(sx + shake - f.ax) * (this.oldFlip ? 1 : 1), Math.round(sy - f.ay)); ctx.globalAlpha = 1;
      }
    } else if (this.newFrame) {
      const k = Math.min(1, (t - 3.1) / 1.3), f = this.newFrame, scale = 0.8 + 0.2 * ease.outBack(k);
      ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.scale(this.dir < 0 ? -scale : scale, scale);
      ctx.drawImage(f.canvas, -f.ax, -f.ay);
      if (k < 1) { ctx.globalAlpha = 1 - k; ctx.drawImage(flashOf(f), -f.ax, -f.ay); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    if (w.flash > 0) { ctx.globalAlpha = Math.min(1, w.flash * 1.6); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1; }
    // text
    if (t >= 3.6 && this.title) {
      const a = Math.min(1, (t - 3.6) * 1.5);
      ctx.globalAlpha = a; drawText(ctx, this.title.toUpperCase(), 240, 8, { color: '#ffffff', scale: 2, align: 'center', shadow: '#10204a', outline: '#10204a' });
      const F = FORMS[this.to]; drawText(ctx, F.name, 240, 28, { color: this.accent, align: 'center', shadow: '#000' }); ctx.globalAlpha = 1;
    }
    if (t >= 4.2 && this.title) {
      const a = Math.min(1, (t - 4.2) * 1.2); ctx.globalAlpha = a;
      let y = 272 - 34 - 10 * this.lines.length;
      this.lines.forEach((l, i) => drawText(ctx, l, 240, 212 + i * 10, { color: '#d8eaff', align: 'center', shadow: '#000' }));
      if (this.branch) drawText(ctx, `${this.branch.name}: ${this.branch.trait}`, 240, 198, { color: '#ffd84a', align: 'center', shadow: '#000' });
      ctx.globalAlpha = 1;
    }
    if (t > 5.2 && Math.floor(t * 2) % 2) drawText(ctx, 'ENTER', 240, 258, { color: '#9ad8ff', align: 'center', shadow: '#000' });
  }
}
