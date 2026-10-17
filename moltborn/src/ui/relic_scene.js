// Choose one of three relics between depths of a Tidal Rift. Left/Right (or Up/Down) pick a card, ENTER takes it.
import { panel, text, COL, drawText, textWidth, wrapText } from './ui.js';
import { RELICS, RARITY } from '../data/relics.js';
import { itemIcon } from '../gfx/sprites_ui.js';
import { STATUS } from '../systems/status.js';

const EFFECT_LABEL = { dmg: 'Damage', hp: 'Health', def: 'Defence', speed: 'Speed', crit: 'Crit', tideRegen: 'Tide regen', coinBonus: 'Coins', light: 'Light', regen: 'Regen', thorns: 'Thorns' };

export class RelicScene {
  constructor(game, choices) { this.g = game; this.opaque = false; this.choices = choices; this.sel = 0; this.t = 0; this.locked = 0.5; }
  onEnter() { this.g.audio.sfx('relic'); this.g.audio.setMuffle?.(0.4); }
  onExit() { this.g.audio.setMuffle?.(0); }
  update(dt) {
    const inp = this.g.input; this.t += dt; this.locked -= dt;
    const n = this.choices.length;
    if (inp.pressed('left') || inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; this.g.audio.sfx('tick'); }
    if (inp.pressed('right') || inp.pressed('down')) { this.sel = (this.sel + 1) % n; this.g.audio.sfx('tick'); }
    if (this.locked <= 0 && (inp.pressed('confirm') || inp.pressed('attack'))) { this.g.audio.sfx('select'); this.g.systems.rifts.pick(this.choices[this.sel]); this.g.engine.pop(); }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(2,8,20,0.78)'; ctx.fillRect(0, 0, 480, 270);
    drawText(ctx, 'CHOOSE A RELIC', 240, 30, { color: COL.gold, scale: 2, align: 'center', shadow: '#000' });
    text(ctx, 'It will stay with you until the rift ends.', 240 - textWidth('It will stay with you until the rift ends.') / 2, 54, COL.dim);
    const n = this.choices.length, cw = 130, gap = 12, x0 = 240 - (n * cw + (n - 1) * gap) / 2;
    this.choices.forEach((id, i) => {
      const R = RELICS[id], rar = RARITY[R.rarity], x = x0 + i * (cw + gap), y = 72 + (i === this.sel ? -4 : 0), sel = i === this.sel;
      panel(ctx, x, y, cw, 150, { fill: sel ? '#14305a' : COL.panel, border: sel ? rar.color : '#2a3a58' });
      ctx.fillStyle = rar.color; ctx.globalAlpha = 0.2 + (sel ? 0.12 * Math.sin(this.t * 5) : 0); ctx.fillRect(x + 2, y + 2, cw - 4, 22); ctx.globalAlpha = 1;
      text(ctx, rar.name.toUpperCase(), x + cw / 2 - textWidth(rar.name.toUpperCase()) / 2, y + 8, rar.color);
      try { const ic = itemIcon('relic:' + id, R.icon); ctx.drawImage(ic, x + cw / 2 - 16, y + 30, 32, 32); } catch (e) { /* icon missing */ }
      const nm = R.name; text(ctx, nm, x + cw / 2 - textWidth(nm) / 2, y + 70, '#ffffff');
      wrapText(R.desc, cw - 16).forEach((l, k) => text(ctx, l, x + 8, y + 86 + k * 10, COL.text));
      const fx = R.fx ? Object.entries(R.fx).map(([k, v]) => `${EFFECT_LABEL[k] || k} ${v > 0 ? '+' : ''}${Math.abs(v) < 1 ? Math.round(v * 100) + '%' : v}`) : [];
      fx.slice(0, 2).forEach((l, k) => text(ctx, l, x + 8, y + 124 + k * 10, '#9ad8ff'));
    });
    const have = this.g.state.riftRelics || []; if (have.length) text(ctx, `Relics held: ${have.map((r) => RELICS[r].name).join(', ')}`.slice(0, 74), 14, 252, COL.dim);
    text(ctx, 'ARROWS choose    ENTER take', 240 - textWidth('ARROWS choose    ENTER take') / 2, 236, '#9ad8ff');
  }
}
