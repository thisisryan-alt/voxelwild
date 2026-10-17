// In-game HUD: health/tide/fury, abilities, currency, quest tracker, boss bar, toasts, prompts, banners.
import { panel, bar, text, COL, drawText, textWidth, wrapText } from './ui.js';
import { ABILITIES } from '../combat/abilities.js';
import { abilityIcon, itemIcon, iconCoin } from '../gfx/sprites_ui.js';
import { FORMS, xpToNext } from '../data/forms.js';
import { ITEMS } from '../data/items.js';
import { HudExtra } from './hud_extra.js';
import { setting } from '../systems/settings.js';

export class Hud {
  constructor(game) { this.g = game; this.t = 0; this.lowT = 0; this.hpShown = null; this.ultFlash = 0; this.x = new HudExtra(this); }
  update(dt) {
    this.t += dt; const g = this.g, p = g.world?.player; if (!p) return;
    if (this.hpShown === null) this.hpShown = p.hp; this.hpShown += (p.hp - this.hpShown) * Math.min(1, dt * 6);
    g.systems.tips?.update(dt); this.x.update(dt);
    for (const t of g.toasts) t.t += dt; g.toasts = g.toasts.filter((t) => t.t < 2.8);
    for (const t of g.popups) t.t += dt; g.popups = g.popups.filter((t) => t.t < 3.2);
    if (g.bannerState) { g.bannerState.t += dt; if (g.bannerState.t > 2.8) g.bannerState = null; }
  }
  draw(ctx) {
    const g = this.g, w = g.world; if (!w) return; const p = w.player, S = p.stats, st = g.state;
    // --- vitals: no backing panel, just the bars ---
    const big = this.x.beginScale(ctx), F = FORMS[st.form];
    const hpw = 96, hpf = Math.max(0, Math.min(1, p.hp / S.maxHp));
    bar(ctx, 8, 8, hpw, 7, this.hpShown / S.maxHp, '#7a2030', '#a8404a', '#1a0a14');
    ctx.fillStyle = '#e8483c'; ctx.fillRect(8, 8, Math.round(hpw * hpf), 7); ctx.fillStyle = '#ff9a7a'; ctx.fillRect(8, 8, Math.round(hpw * hpf), 2);
    text(ctx, `${Math.ceil(p.hp)}`, 11, 8, '#ffffff', { shadow: '#3a0a14' });
    bar(ctx, 8, 18, 64, 3, p.tide / S.maxTide, '#3a8ae8', '#8ad0ff', '#0a1a3a');
    if (p.fury > 2) bar(ctx, 8, 24, 48, 2, p.fury / 100, p.fury >= 100 ? '#ffd84a' : '#ff8a3a', '#ffe0a0', '#2a1408');
    if ((p.combo || 0) >= 3 && p.comboLife > 0) { // combo counter: a number that kicks on every hit and a bar that drains
      const c = p.combo, col = c >= 30 ? '#ff7ad0' : c >= 15 ? '#ffd84a' : c >= 8 ? '#ffe9a8' : '#ffffff', a = Math.min(1, p.comboLife * 3);
      ctx.globalAlpha = a; text(ctx, `${c} HITS`, 8, 31 - Math.round((p.comboPop || 0) * 2), col, { shadow: '#2a1408' });
      ctx.fillStyle = '#2a1408'; ctx.fillRect(8, 41, 34, 2); ctx.fillStyle = col; ctx.fillRect(8, 41, Math.round(34 * Math.min(1, p.comboLife / 2.4)), 2); ctx.globalAlpha = 1;
    }
    text(ctx, `${st.level}`, 108, 8, COL.gold, { shadow: '#000' });
    if (this.t < 6 || g.state.level !== this.lvShown) { this.lvShown = g.state.level; this.nameT = this.t; }
    if (this.t - (this.nameT ?? 0) < 5) { ctx.globalAlpha = Math.min(1, 5 - (this.t - this.nameT)); const tt = g.systems.cosmetics?.titleText(); text(ctx, F.name + (tt ? '  ' + tt : ''), 108 + textWidth(String(st.level)) + 5, 8, COL.dim, { shadow: '#000' }); ctx.globalAlpha = 1; }
    this.x.statusRow(ctx, 8, (p.combo || 0) >= 3 && p.comboLife > 0 ? 47 : 30); this.x.endScale(ctx, big);
    // --- currency: one line; EP / SP only when there is something to spend ---
    this.x.clock(ctx, 476 - textWidth(String(st.coins)) - 36, 3);
    const cw = textWidth(String(st.coins)); ctx.drawImage(iconCoin(), 476 - cw - 14, 6); text(ctx, String(st.coins), 476 - cw, 8, COL.gold);
    let ry = 20; const evolvable = this.g.systems.evolution?.readyFor?.();
    if (st.ep > 0) { text(ctx, `EP ${st.ep}`, 476 - textWidth(`EP ${st.ep}`), ry, COL.pink); ry += 10; }
    if (st.sp > 0) { text(ctx, `SP ${st.sp}`, 476 - textWidth(`SP ${st.sp}`), ry, COL.blue); ry += 10; }
    if (evolvable && Math.floor(this.t * 2) % 2) text(ctx, 'MOLT READY', 476 - textWidth('MOLT READY'), ry, '#ffffff', { shadow: '#a0306a' });
    // --- quest tracker: full for a few seconds after it changes, then one dim line ---
    const tr = g.systems.quests?.tracker?.();
    if (tr && !g.bannerState && !(w.boss && w.boss.engaged)) {
      const key = tr.title + '|' + tr.text; if (key !== this.trKey) { this.trKey = key; this.trT = this.t; }
      const age = this.t - this.trT, full = age < 7;
      if (full) { const lines = wrapText(tr.text, 150); const h = 13 + lines.length * 10; ctx.globalAlpha = Math.min(1, (7 - age) * 1.5, age * 4 + 0.2); panel(ctx, 480 - 162, 38, 158, h, { alpha: 0.6 }); text(ctx, tr.title, 324, 42, COL.gold); lines.forEach((l, i) => text(ctx, l, 324, 52 + i * 10, COL.text)); ctx.globalAlpha = 1; }
      else { const t2 = tr.title.length > 26 ? tr.title.slice(0, 25) + '...' : tr.title; ctx.globalAlpha = 0.45; text(ctx, t2, 476 - textWidth(t2), ry + (evolvable ? 11 : 1), COL.gold); ctx.globalAlpha = 1; }
    }
    // --- abilities: only what you have ---
    const slots = st.slots, nS = Math.max(1, F.abilitySlots), have = [];
    for (let i = 0; i < nS; i++) if (slots[i]) have.push(i);
    const showUlt = p.fury > 4, cells = have.length + (showUlt ? 1 : 0), y0 = 270 - 25, x0 = 240 - (cells * 24) / 2;
    have.forEach((i, k) => {
      const id = slots[i], x = x0 + k * 24; panel(ctx, x, y0, 22, 22, { alpha: 0.7, border: COL.border });
      const ab = ABILITIES[id]; ctx.drawImage(abilityIcon(ab.icon), x + 4, y0 + 4);
      const cd = p.cool[id] || 0; if (cd > 0) { ctx.fillStyle = 'rgba(5,10,20,0.7)'; const hh = Math.round(22 * Math.min(1, cd / (ab.cd || 1))); ctx.fillRect(x + 1, y0 + 22 - hh, 20, hh); }
      else if (p.tide < Math.round(ab.cost * (1 + S.tideCost))) { ctx.fillStyle = 'rgba(40,60,160,0.45)'; ctx.fillRect(x + 1, y0 + 1, 20, 20); }
      text(ctx, String(i + 1), x + 2, y0 + 13, '#9ad8ff', { shadow: '#000' });
    });
    const slotCells = have.map((i, k) => ({ id: slots[i], x: x0 + k * 24, y: y0 })); this.x.cooldownText(ctx, p, slotCells); this.x.abilityFlash(ctx, slotCells);
    if (showUlt) { const x = x0 + have.length * 24, ready = p.fury >= 100; panel(ctx, x, y0, 22, 22, { alpha: 0.7, border: ready ? COL.gold : '#2a3a58' }); ctx.globalAlpha = ready ? 1 : 0.4; ctx.drawImage(abilityIcon('ult'), x + 4, y0 + 4); ctx.globalAlpha = 1; text(ctx, 'Q', x + 2, y0 + 13, ready ? COL.gold : '#6a7a98', { shadow: '#000' }); }
    // --- boss bar ---
    const b = w.boss; if (b && b.alive && b.engaged && !b.dying) {
      const bw = 190, bx = 145, by = 15;
      panel(ctx, bx - 5, by - 12, bw + 10, 28, { alpha: 0.85, border: '#a02030' });
      text(ctx, b.displayName, 240 - textWidth(b.displayName) / 2, by - 9, '#ffd8c0');
      bar(ctx, bx, by + 1, bw, 7, Math.max(0, b.hp) / b.maxHp, '#c02838', '#ff7a6a', '#2a0a14');
      if (b.armorBar > 0) bar(ctx, bx, by + 10, bw, 2, Math.max(0, b.poiseShown ?? 0), '#ffd84a', '#fff', '#2a2008');
      for (const m of b.phaseMarks || []) { ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + Math.round(bw * m), by, 1, 8); }
      this.x.bossExtras(ctx, b);
    }
    // --- interact prompt ---
    if (w.near) {
      const i = w.near, cam = w.lastCam || w.cam, x = Math.round(i.x - cam.x), y = Math.round(i.y - i.h / 2 - cam.y) - 20, s = `E  ${i.prompt()}`, tw = textWidth(s) + 8;
      panel(ctx, x - tw / 2, y + Math.round(Math.sin(this.t * 4)), tw, 13, { alpha: 0.9, border: COL.borderLit }); text(ctx, s, x - tw / 2 + 4, y + 3 + Math.round(Math.sin(this.t * 4)), '#ffffff');
    }
    // --- minimap (bottom left) ---
    const mm = g.systems.minimap, mode = setting(g, 'minimap');
    if (mm && mode !== 'off' && !w.cinematic) mm.draw(ctx, 6, mode === 'large' ? 166 : 204);
    // --- loot popups (left) ---
    g.popups.forEach((pp, i) => { const a = Math.min(1, (3.2 - pp.t) * 2, pp.t * 4), y = 84 + i * 20; ctx.globalAlpha = a; panel(ctx, 4, y, 130, 18, { alpha: 0.8, border: '#a08a3a' }); try { ctx.drawImage(pp.icon === 'gem' ? itemIcon('abyssal_core') : itemIcon(pp.icon), 7, y + 1); } catch (e) {} text(ctx, pp.text, 26, y + 5, pp.color); ctx.globalAlpha = 1; });
    g.systems.tips?.draw(ctx, panel, text, textWidth);
    // --- toasts ---
    g.toasts.forEach((t, i) => { const a = Math.min(1, (3.2 - t.t) * 2, t.t * 5), tw = textWidth(t.msg) + 12, y = 78 + i * 15 - Math.max(0, 1 - t.t * 6) * 6; ctx.globalAlpha = a; panel(ctx, 240 - tw / 2, y, tw, 13, { alpha: 0.85 }); text(ctx, t.msg, 240 - tw / 2 + 6, y + 3, t.color); ctx.globalAlpha = 1; });
    // --- zone banner ---
    g.systems.achievements?.drawBanner(ctx);
    const bn = g.bannerState; if (bn) { const a = Math.min(1, bn.t * 2, (2.8 - bn.t) * 1.5); ctx.globalAlpha = a * 0.92; drawText(ctx, bn.title, 240, 44, { color: '#ffffff', scale: 2, align: 'center', shadow: '#05204a', outline: '#05204a' }); if (bn.sub) drawText(ctx, bn.sub, 240, 64, { color: '#9ad8ff', align: 'center', shadow: '#05204a' }); ctx.globalAlpha = 1; }
    this.x.hurtArcs(ctx, w.lastCam || w.cam); this.x.xpLine(ctx); this.x.fps(ctx); this.x.dps(ctx); g.systems.captions?.draw(ctx);
    // --- low health pulse (the post-processing pass paints its own when it is running) ---
    if (p.hp / S.maxHp < 0.25 && p.alive && (!g.systems.post || g.systems.post.lite)) { ctx.globalAlpha = 0.18 + 0.12 * Math.sin(this.t * 6); ctx.fillStyle = '#c01020'; ctx.fillRect(0, 0, 480, 6); ctx.fillRect(0, 264, 480, 6); ctx.fillRect(0, 0, 6, 270); ctx.fillRect(474, 0, 6, 270); ctx.globalAlpha = 1; }
    // pressure warning
    if (p.fear > 0.05) { ctx.globalAlpha = Math.min(0.5, p.fear * 0.5); ctx.fillStyle = '#2a1a6a'; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1; if (p.fear > 0.3) text(ctx, 'PRESSURE', 240 - textWidth('PRESSURE') / 2, 70, '#b8a4ff'); }
    if (g.debug) { text(ctx, `${g.engine.fps}fps  x${Math.round(p.x)} y${Math.round(p.y)}  ${p.state}  en:${w.enemies.length}  fx:${w.fx.p.length}`, 6, 258, '#8f8'); }
  }
}
