// HUD additions that sit on top of the base HUD: the player's status icons, red arcs showing where a hit came from,
// a flash when an ability comes off cooldown, a hairline experience bar, boss phase names and status pips, an FPS
// readout and the large-HUD scaling option. Each piece is a method so the base HUD stays readable.
import { STATUS, statusIcon } from '../systems/status.js';
import { xpToNext } from '../data/forms.js';
import { text, textWidth, panel } from './ui.js';
import { setting } from '../systems/settings.js';
import { clamp } from '../core/util.js';

export class HudExtra {
  constructor(hud) {
    this.hud = hud; this.g = hud.g; this.arcs = []; this.flashes = {}; this.prevCd = {}; this.xpShown = null; this.xpT = 0; this.lastXp = null; this.hover = 0;
    const ev = this.g.events;
    ev.on('hurt', (n, src, blocked) => this.onHurt(n, src, blocked));
    ev.on('zone', () => { this.arcs.length = 0; this.xpShown = null; });
  }

  update(dt) {
    for (const a of this.arcs) a.t += dt; this.arcs = this.arcs.filter((a) => a.t < 0.9);
    for (const k of Object.keys(this.flashes)) { this.flashes[k] -= dt; if (this.flashes[k] <= 0) delete this.flashes[k]; }
    const p = this.g.world?.player, st = this.g.state; if (!p) return;
    for (const id of st.slots) {
      if (!id) continue; const cd = p.cool[id] || 0;
      if (this.prevCd[id] > 0 && cd <= 0) this.flashes[id] = 0.45;
      this.prevCd[id] = cd;
    }
    const need = xpToNext(st.level), frac = st.level >= 30 ? 1 : clamp(st.xp / need, 0, 1);
    if (this.xpShown === null) this.xpShown = frac;
    if (this.lastXp !== null && (st.xp !== this.lastXp || st.level !== this.lastLevel)) this.xpT = 3.2;
    this.lastXp = st.xp; this.lastLevel = st.level; this.xpT = Math.max(0, this.xpT - dt);
    this.xpShown += (frac - this.xpShown) * Math.min(1, dt * 4); if (this.xpShown > frac + 0.01 && frac < 0.2) this.xpShown = frac;
  }

  onHurt(n, src, blocked) {
    const p = this.g.world?.player, sx = src?.x ?? src?.source?.x; if (!p || sx === undefined) return;
    const sy = src.y ?? src.source?.y ?? p.y, a = Math.atan2(sy - p.y, sx - p.x);
    this.arcs.push({ a, t: 0, big: Math.min(1, n / (p.stats.maxHp * 0.25)), blocked: !!blocked });
    if (this.arcs.length > 4) this.arcs.shift();
  }

  // ---- the player's statuses, beneath the combo counter ------------------------------------------------------------------------
  statusRow(ctx, x, y) {
    const p = this.g.world.player, list = p.status.entries(); if (!list.length) return;
    let i = 0;
    for (const s of list.slice(0, 8)) {
      const def = STATUS[s.id], ix = x + i * 12, expiring = s.t < 4 && Math.floor(s.t * 4) % 2 === 0;
      ctx.globalAlpha = expiring ? 0.45 : 1; ctx.drawImage(statusIcon(s.id, 1), ix, y);
      ctx.globalAlpha = 1; ctx.fillStyle = '#05030a'; ctx.fillRect(ix + 1, y + 10, 8, 2);
      ctx.fillStyle = def.color; ctx.fillRect(ix + 1, y + 10, Math.max(1, Math.round(8 * clamp(s.t / s.max, 0, 1))), 1);
      if (s.stacks > 1) text(ctx, String(s.stacks), ix + 6, y + 1, '#ffffff', { shadow: '#000' });
      i++;
    }
  }

  // ---- where did that come from? ------------------------------------------------------------------------------------------------
  hurtArcs(ctx, cam) {
    if (!this.arcs.length) return; const p = this.g.world.player, px = p.x - cam.x, py = p.y - cam.y;
    ctx.save(); ctx.lineCap = 'butt';
    for (const a of this.arcs) {
      const k = 1 - a.t / 0.9, r = 24 + (1 - k) * 8; ctx.globalAlpha = k * (a.blocked ? 0.5 : 0.85);
      ctx.strokeStyle = a.blocked ? '#9ab8e0' : '#ff4a3a'; ctx.lineWidth = 2 + a.big * 2;
      ctx.beginPath(); ctx.arc(Math.round(px) + 0.5, Math.round(py) + 0.5, r, a.a - 0.38, a.a + 0.38); ctx.stroke();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ---- ability slots come off cooldown with a little pop ---------------------------------------------------------------------------
  abilityFlash(ctx, cells) {
    for (const c of cells) {
      const f = this.flashes[c.id]; if (!f) continue; const k = f / 0.45, grow = (1 - k) * 5;
      ctx.globalAlpha = k * 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.strokeRect(c.x - grow + 0.5, c.y - grow + 0.5, 21 + grow * 2, 21 + grow * 2);
      ctx.globalAlpha = k * 0.25; ctx.fillStyle = '#ffffff'; ctx.fillRect(c.x + 1, c.y + 1, 20, 20); ctx.globalAlpha = 1;
    }
  }
  // seconds left on a cooldown, drawn over the icon
  cooldownText(ctx, p, cells) {
    for (const c of cells) { const cd = p.cool[c.id] || 0; if (cd > 1) { const s = String(Math.ceil(cd)); text(ctx, s, c.x + 11 - textWidth(s) / 2, c.y + 8, '#ffffff', { shadow: '#000' }); } }
  }

  // ---- experience: a hairline across the bottom edge that appears for a few seconds after every gain ------------------------------------
  xpLine(ctx) {
    const a = Math.min(1, this.xpT), st = this.g.state; if (a <= 0.02) return;
    ctx.globalAlpha = a * 0.9; ctx.fillStyle = '#08142c'; ctx.fillRect(0, 267, 480, 3);
    ctx.fillStyle = '#7ad0ff'; ctx.fillRect(0, 268, Math.round(480 * this.xpShown), 2); ctx.fillStyle = '#d8f4ff'; ctx.fillRect(0, 268, Math.round(480 * this.xpShown), 1);
    if (this.xpT > 1.5) { const s = st.level >= 30 ? 'MAX LEVEL' : `${st.xp} / ${xpToNext(st.level)} XP`; text(ctx, s, 240 - textWidth(s) / 2, 258, '#9ad8ff', { shadow: '#000' }); }
    ctx.globalAlpha = 1;
  }

  // ---- boss: phase name and the effects on it ---------------------------------------------------------------------------------------------
  bossExtras(ctx, b) {
    const ph = b.phase?.name; if (ph) text(ctx, ph, 335 - textWidth(ph), 31, '#c88a8a');
    const list = b.status?.entries().filter((s) => STATUS[s.id].harmful).slice(0, 5) || [];
    list.forEach((s, i) => { ctx.drawImage(statusIcon(s.id, 1), 148 + i * 11, 31); ctx.fillStyle = STATUS[s.id].color; ctx.fillRect(149 + i * 11, 41, Math.max(1, Math.round(8 * clamp(s.t / s.max, 0, 1))), 1); });
  }

  fps(ctx) {
    if (!setting(this.g, 'showFps')) return; const s = `${this.g.engine.fps} FPS`, w = textWidth(s) + 6;
    panel(ctx, 240 - w / 2, 1, w, 11, { alpha: 0.6, border: '#2a3a58' }); text(ctx, s, 243 - w / 2, 3, this.g.engine.fps >= 55 ? '#8aff9a' : '#ffd84a');
  }

  // wraps a block of drawing in the large-HUD transform (top-left anchored)
  beginScale(ctx) { const k = setting(this.g, 'uiScale') === 'large' ? 1.3 : 1; if (k !== 1) { ctx.save(); ctx.scale(k, k); } return k !== 1; }
  endScale(ctx, on) { if (on) ctx.restore(); }
}
