// In-game HUD: health/tide/fury, abilities, currency, quest tracker, boss bar, toasts, prompts, banners.
import { panel, bar, text, COL, drawText, textWidth, wrapText } from './ui.js';
import { ABILITIES } from '../combat/abilities.js';
import { abilityIcon, itemIcon, iconCoin } from '../gfx/sprites_ui.js';
import { FORMS, xpToNext } from '../data/forms.js';
import { ITEMS } from '../data/items.js';

export class Hud {
  constructor(game) { this.g = game; this.t = 0; this.lowT = 0; this.hpShown = null; this.ultFlash = 0; }
  update(dt) {
    this.t += dt; const g = this.g, p = g.world?.player; if (!p) return;
    if (this.hpShown === null) this.hpShown = p.hp; this.hpShown += (p.hp - this.hpShown) * Math.min(1, dt * 6);
    g.systems.tips?.update(dt);
    for (const t of g.toasts) t.t += dt; g.toasts = g.toasts.filter((t) => t.t < 3.2);
    for (const t of g.popups) t.t += dt; g.popups = g.popups.filter((t) => t.t < 3.2);
    if (g.bannerState) { g.bannerState.t += dt; if (g.bannerState.t > 3.4) g.bannerState = null; }
  }
  draw(ctx) {
    const g = this.g, w = g.world; if (!w) return; const p = w.player, S = p.stats, st = g.state;
    // --- vitals ---
    panel(ctx, 4, 4, 138, 41, { alpha: 0.78 });
    const F = FORMS[st.form];
    text(ctx, `Lv ${st.level}`, 9, 8, COL.gold); text(ctx, F.name, 46, 8, COL.dim);
    bar(ctx, 9, 19, 128, 10, this.hpShown / S.maxHp, '#e0383a', '#ff8a6a', '#3a1020');
    bar(ctx, 9, 19, 128, 10, 0, '#000', '#000', 'rgba(0,0,0,0)');
    ctx.fillStyle = '#ff5a4a'; const hpw = Math.round(128 * Math.max(0, p.hp) / S.maxHp); ctx.fillRect(9, 19, hpw, 10); ctx.fillStyle = '#ff9a7a'; ctx.fillRect(9, 19, hpw, 3); ctx.fillStyle = '#b02030'; ctx.fillRect(9, 27, hpw, 2);
    text(ctx, `${Math.ceil(p.hp)}/${S.maxHp}`, 12, 20, '#ffffff', { shadow: '#3a0a14' });
    bar(ctx, 9, 32, 100, 5, p.tide / S.maxTide, '#3a8ae8', '#8ad0ff', '#0a1a3a');
    bar(ctx, 9, 39, 100, 3, p.fury / 100, p.fury >= 100 ? '#ffd84a' : '#ff8a3a', '#ffe0a0', '#2a1408');
    if (p.fury >= 100 && Math.floor(this.t * 4) % 2) text(ctx, 'ULT', 112, 35, COL.gold);
    const need = xpToNext(st.level); ctx.fillStyle = '#9ad8ff'; ctx.fillRect(9, 44, Math.round(128 * st.xp / need), 1);
    // --- currency ---
    ctx.drawImage(iconCoin(), 438, 3); text(ctx, String(st.coins), 476 - textWidth(String(st.coins)), 8, COL.gold, { });
    const evolvable = this.g.systems.evolution?.readyFor?.(); text(ctx, `EP ${st.ep}`, 476 - textWidth(`EP ${st.ep}`), 19, COL.pink);
    if (evolvable && Math.floor(this.t * 2) % 2) text(ctx, 'MOLT READY', 476 - textWidth('MOLT READY'), 41, '#ffffff', { shadow: '#a0306a' });
    if (st.sp > 0) text(ctx, `SP ${st.sp}`, 476 - textWidth(`SP ${st.sp}`), 30, COL.blue);
    // --- quest tracker ---
    const tr = g.systems.quests?.tracker?.();
    if (tr) { const lines = wrapText(tr.text, 130); const h = 14 + lines.length * 10; panel(ctx, 480 - 142, 42, 138, h, { alpha: 0.6 }); text(ctx, tr.title, 342, 46, COL.gold); lines.forEach((l, i) => text(ctx, l, 342, 56 + i * 10, COL.text)); }
    // --- abilities ---
    const slots = st.slots, y0 = 270 - 26, nS = Math.max(1, F.abilitySlots), x0 = 240 - ((nS + 1) * 24) / 2;
    for (let i = 0; i < nS; i++) {
      const id = slots[i], x = x0 + i * 24; panel(ctx, x, y0, 22, 22, { alpha: 0.8, border: id ? COL.border : '#2a3a58' });
      if (id) {
        const ab = ABILITIES[id]; ctx.drawImage(abilityIcon(ab.icon), x + 4, y0 + 4);
        const cd = p.cool[id] || 0; if (cd > 0) { ctx.fillStyle = 'rgba(5,10,20,0.7)'; const hh = Math.round(22 * Math.min(1, cd / (ab.cd || 1))); ctx.fillRect(x + 1, y0 + 22 - hh, 20, hh); }
        else if (p.tide < Math.round(ab.cost * (1 + S.tideCost))) { ctx.fillStyle = 'rgba(40,60,160,0.45)'; ctx.fillRect(x + 1, y0 + 1, 20, 20); }
      }
      text(ctx, String(i + 1), x + 2, y0 + 13, '#9ad8ff', { shadow: '#000' });
    }
    { const x = x0 + nS * 24, ready = p.fury >= 100; panel(ctx, x, y0, 22, 22, { alpha: 0.8, border: ready ? COL.gold : '#2a3a58' }); ctx.globalAlpha = ready ? 1 : 0.4; ctx.drawImage(abilityIcon('ult'), x + 4, y0 + 4); ctx.globalAlpha = 1; text(ctx, 'Q', x + 2, y0 + 13, ready ? COL.gold : '#6a7a98', { shadow: '#000' }); if (ready) { ctx.globalAlpha = 0.3 + 0.3 * Math.sin(this.t * 8); ctx.fillStyle = '#ffd84a'; ctx.fillRect(x + 1, y0 + 1, 20, 20); ctx.globalAlpha = 1; } }
    // --- boss bar ---
    const b = w.boss; if (b && b.alive && b.engaged && !b.dying) {
      const bw = 190, bx = 145, by = 15;
      panel(ctx, bx - 5, by - 12, bw + 10, 28, { alpha: 0.85, border: '#a02030' });
      text(ctx, b.displayName, 240 - textWidth(b.displayName) / 2, by - 9, '#ffd8c0');
      bar(ctx, bx, by + 1, bw, 7, Math.max(0, b.hp) / b.maxHp, '#c02838', '#ff7a6a', '#2a0a14');
      if (b.armorBar > 0) bar(ctx, bx, by + 10, bw, 2, Math.max(0, b.poiseShown ?? 0), '#ffd84a', '#fff', '#2a2008');
      for (const m of b.phaseMarks || []) { ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + Math.round(bw * m), by, 1, 8); }
    }
    // --- interact prompt ---
    if (w.near) {
      const i = w.near, cam = w.lastCam || w.cam, x = Math.round(i.x - cam.x), y = Math.round(i.y - i.h / 2 - cam.y) - 20, s = `E  ${i.prompt()}`, tw = textWidth(s) + 8;
      panel(ctx, x - tw / 2, y + Math.round(Math.sin(this.t * 4)), tw, 13, { alpha: 0.9, border: COL.borderLit }); text(ctx, s, x - tw / 2 + 4, y + 3 + Math.round(Math.sin(this.t * 4)), '#ffffff');
    }
    // --- loot popups (left) ---
    g.popups.forEach((pp, i) => { const a = Math.min(1, (3.2 - pp.t) * 2, pp.t * 4), y = 84 + i * 20; ctx.globalAlpha = a; panel(ctx, 4, y, 130, 18, { alpha: 0.8, border: '#a08a3a' }); try { ctx.drawImage(pp.icon === 'gem' ? itemIcon('abyssal_core') : itemIcon(pp.icon), 7, y + 1); } catch (e) {} text(ctx, pp.text, 26, y + 5, pp.color); ctx.globalAlpha = 1; });
    g.systems.tips?.draw(ctx, panel, text, textWidth);
    // --- toasts ---
    g.toasts.forEach((t, i) => { const a = Math.min(1, (3.2 - t.t) * 2, t.t * 5), tw = textWidth(t.msg) + 12, y = 50 + i * 15 - Math.max(0, 1 - t.t * 6) * 6; ctx.globalAlpha = a; panel(ctx, 240 - tw / 2, y, tw, 13, { alpha: 0.85 }); text(ctx, t.msg, 240 - tw / 2 + 6, y + 3, t.color); ctx.globalAlpha = 1; });
    // --- zone banner ---
    const bn = g.bannerState; if (bn) { const a = Math.min(1, bn.t * 2, (3.4 - bn.t) * 1.5); ctx.globalAlpha = a; drawText(ctx, bn.title, 240, 86, { color: '#ffffff', scale: 2, align: 'center', shadow: '#05204a', outline: '#05204a' }); if (bn.sub) drawText(ctx, bn.sub, 240, 108, { color: '#9ad8ff', align: 'center', shadow: '#05204a' }); ctx.globalAlpha = 1; }
    // --- low health pulse ---
    if (p.hp / S.maxHp < 0.25 && p.alive) { ctx.globalAlpha = 0.18 + 0.12 * Math.sin(this.t * 6); ctx.fillStyle = '#c01020'; ctx.fillRect(0, 0, 480, 6); ctx.fillRect(0, 264, 480, 6); ctx.fillRect(0, 0, 6, 270); ctx.fillRect(474, 0, 6, 270); ctx.globalAlpha = 1; }
    // pressure warning
    if (p.fear > 0.05) { ctx.globalAlpha = Math.min(0.5, p.fear * 0.5); ctx.fillStyle = '#2a1a6a'; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1; if (p.fear > 0.3) text(ctx, 'PRESSURE', 240 - textWidth('PRESSURE') / 2, 70, '#b8a4ff'); }
    if (g.debug) { text(ctx, `${g.engine.fps}fps  x${Math.round(p.x)} y${Math.round(p.y)}  ${p.state}  en:${w.enemies.length}  fx:${w.fx.p.length}`, 6, 258, '#8f8'); }
  }
}
