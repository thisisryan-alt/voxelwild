// The sell screen: what this buyer will take from your pack, with prices. ENTER sells one, RIGHT sells the whole stack,
// A sells everything the buyer wants. ESC leaves.
import { panel, text, COL, drawText, textWidth, wrapText } from './ui.js';
import { BUYERS } from '../systems/market.js';
import { ITEMS } from '../data/items.js';
import { FISH_BY_ID, RARITY } from '../data/fish.js';
import { itemIcon, iconCoin } from '../gfx/sprites_ui.js';

export class SellScene {
  constructor(game, buyer, done) { this.g = game; this.buyer = buyer; this.done = done; this.opaque = false; this.sel = 0; this.t = 0; this.msg = ''; this.msgT = 0; this.earned = 0; this.list = this.g.systems.market.sellable(buyer); }
  onEnter() { this.g.audio.sfx('select'); }
  onExit() { this.done?.(); }
  refresh() { this.list = this.g.systems.market.sellable(this.buyer); this.sel = Math.min(this.sel, Math.max(0, this.list.length - 1)); }
  say(m, bad) { this.msg = m; this.msgT = 1.6; this.bad = !!bad; }
  update(dt) {
    const g = this.g, inp = g.input, M = g.systems.market; this.t += dt; this.msgT -= dt;
    if (inp.pressed('cancel') || inp.pressed('pause')) { g.audio.sfx('back'); g.engine.pop(); return; }
    const n = this.list.length; if (!n) return;
    if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; g.audio.sfx('tick'); }
    const e = this.list[this.sel];
    if (inp.pressed('confirm')) { const c = M.sell(this.buyer, e.id, 1); this.earned += c; this.say(`Sold ${ITEMS[e.id].name} for ${c}`); this.refresh(); }
    else if (inp.pressed('right')) { const c = M.sell(this.buyer, e.id, e.n); this.earned += c; this.say(`Sold ${e.n} for ${c}`); this.refresh(); }
    else if (inp.pressed('ab1') || inp.pressed('heal')) { const c = M.sellAll(this.buyer); this.earned += c; this.say(`Sold everything for ${c}`); this.refresh(); }
  }
  draw(ctx) {
    const g = this.g, B = BUYERS[this.buyer];
    ctx.fillStyle = 'rgba(2,8,20,0.78)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 60, 22, 360, 226, { alpha: 0.96 }); drawText(ctx, 'SELL', 240, 28, { color: COL.gold, scale: 2, align: 'center', shadow: '#000' });
    text(ctx, B.name + ': ' + B.greeting, 70, 48, COL.dim); ctx.drawImage(iconCoin(), 350, 44, 12, 12); text(ctx, String(g.state.coins), 364, 48, COL.gold);
    if (!this.list.length) { text(ctx, 'Nothing in your pack that they want.', 70, 80, COL.dim); this.footer(ctx); return; }
    const top = 62, rows = 10, off = Math.max(0, Math.min(this.sel - 4, this.list.length - rows));
    this.list.slice(off, off + rows).forEach((e, k) => {
      const i = off + k, y = top + k * 15, sel = i === this.sel, it = ITEMS[e.id], f = it.fish ? FISH_BY_ID[it.fish] : null;
      if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(64, y - 2, 352, 14); }
      ctx.drawImage(itemIcon(e.id), 68, y - 3, 12, 12); text(ctx, it.name, 84, y, f ? RARITY[f.rarity].color : COL.text); text(ctx, `x${e.n}`, 230, y, COL.dim);
      const p = `${e.price}c`; text(ctx, p, 300 - textWidth(p), y, COL.gold); const tot = `${e.price * e.n}c`; text(ctx, tot, 408 - textWidth(tot), y, COL.dim);
    });
    if (this.list.length > rows) text(ctx, `${this.sel + 1}/${this.list.length}`, 380, 48 + 0, COL.dim);
    const e = this.list[this.sel]; if (e && ITEMS[e.id].desc) wrapText(ITEMS[e.id].desc, 340).slice(0, 2).forEach((l, i) => text(ctx, l, 70, 216 + i * 9, COL.dim));
    this.footer(ctx);
  }
  footer(ctx) {
    if (this.msgT > 0) text(ctx, this.msg, 240 - textWidth(this.msg) / 2, 236, this.bad ? COL.red : COL.green);
    else { const h = `ENTER sell one   RIGHT sell stack   1 sell all   ESC back${this.earned ? `   (+${this.earned})` : ''}`; text(ctx, h, 240 - textWidth(h) / 2, 236, '#9ad8ff'); }
  }
}
