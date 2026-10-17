// The rift altar menu: rest (free healing), make an offering (coins for a rare relic) or sacrifice (an epic relic for a
// permanent -20% health this run). The altar accepts one gift.
import { panel, text, button, COL, drawText, textWidth, wrapText } from './ui.js';

export class AltarScene {
  constructor(game, altar) { this.g = game; this.altar = altar; this.opaque = false; this.sel = 0; this.t = 0; this.msg = ''; }
  onEnter() { this.g.audio.sfx('select'); }
  options() {
    const run = this.g.systems.rifts.run, cost = 60 * (run?.depth || 1);
    return [
      { id: 'rest', name: 'Rest', desc: 'The altar warms you: restore 60% health, all Tide and cleanse every ailment. Free.' },
      { id: 'offering', name: `Offering (${cost} coins)`, desc: 'Give coins; choose one of three rare or better relics.', can: this.g.state.coins >= cost, why: `You need ${cost} coins.` },
      { id: 'sacrifice', name: 'Sacrifice', desc: 'Give up a fifth of your health for the rest of this run; choose one of three epic relics.' },
    ];
  }
  update(dt) {
    const g = this.g, inp = g.input, list = this.options(); this.t += dt;
    if (inp.pressed('cancel') || inp.pressed('pause')) { g.audio.sfx('back'); g.engine.pop(); return; }
    if (inp.pressed('up')) { this.sel = (this.sel + list.length - 1) % list.length; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.sel = (this.sel + 1) % list.length; g.audio.sfx('tick'); }
    if (inp.pressed('confirm')) {
      const o = list[this.sel]; if (o.can === false) { g.audio.sfx('deny'); this.msg = o.why; return; }
      g.engine.pop(); g.systems.rifts.altar(o.id, this.altar);
    }
  }
  draw(ctx) {
    const list = this.options(), o = list[this.sel];
    ctx.fillStyle = 'rgba(2,8,20,0.78)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 90, 50, 300, 160, { alpha: 0.96, border: '#a080c8' }); drawText(ctx, 'THE ALTAR', 240, 56, { color: '#ffd8f0', scale: 2, align: 'center', shadow: '#000' });
    text(ctx, 'It will accept one gift.', 240 - textWidth('It will accept one gift.') / 2, 76, COL.dim);
    list.forEach((it, i) => button(ctx, it.name, 110, 92 + i * 20, 260, 17, i === this.sel));
    wrapText(o.desc, 260).forEach((l, i) => text(ctx, l, 110, 158 + i * 10, o.can === false ? '#8a6070' : COL.text));
    if (this.msg) text(ctx, this.msg, 240 - textWidth(this.msg) / 2, 194, COL.red);
    text(ctx, 'ENTER choose    ESC step back', 240 - textWidth('ENTER choose    ESC step back') / 2, 200 + (this.msg ? 8 : 0), '#9ad8ff');
  }
}
