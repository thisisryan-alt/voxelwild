// The kitchen orders board: today's three requests, who made them and what they pay. ENTER delivers the selected order.
import { panel, text, COL, drawText, textWidth, wrapText } from './ui.js';
import { ITEMS } from '../data/items.js';
import { itemIcon } from '../gfx/sprites_ui.js';
import { npcFrame } from '../gfx/sprites_npc.js';
import { drawFrame } from '../entities/entity.js';

export class OrdersScene {
  constructor(game) { this.g = game; this.opaque = false; this.sel = 0; this.t = 0; this.msg = ''; this.msgT = 0; this.list = game.systems.orders.refresh(); }
  onEnter() { this.g.audio.sfx('select'); }
  say(m) { this.msg = m; this.msgT = 2.2; }
  update(dt) {
    const g = this.g, inp = g.input, O = g.systems.orders; this.t += dt; this.msgT -= dt;
    if (inp.pressed('cancel') || inp.pressed('pause')) { g.audio.sfx('back'); g.engine.pop(); return; }
    const n = Math.max(1, this.list.length);
    if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; g.audio.sfx('tick'); }
    if (inp.pressed('confirm') && this.list[this.sel]) {
      const o = this.list[this.sel];
      if (o.done) { g.audio.sfx('deny'); this.say('Already delivered'); } else if (!O.canDeliver(o)) { g.audio.sfx('deny'); this.say(`You need ${o.n - Math.min(o.n, g.itemCount(o.dish))} more ${ITEMS[o.dish].name}`); } else O.deliver(o);
    }
  }
  draw(ctx) {
    const g = this.g, O = g.systems.orders;
    ctx.fillStyle = 'rgba(2,8,20,0.8)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 30, 20, 420, 230, { alpha: 0.96 }); drawText(ctx, 'KITCHEN ORDERS', 240, 26, { color: COL.gold, scale: 2, align: 'center', shadow: '#000' });
    if (!this.list.length) {
      wrapText('The kitchen board is bare. Gather ingredients from creatures and forage patches, learn a recipe, and orders will appear here.', 380).forEach((l, i) => text(ctx, l, 50, 70 + i * 11, COL.dim)); return;
    }
    this.list.forEach((o, i) => {
      const y = 52 + i * 56, sel = i === this.sel, npc = O.who(o), have = g.itemCount(o.dish);
      panel(ctx, 40, y, 400, 52, { fill: sel ? '#14305a' : COL.panel, border: o.done ? '#3a6a4a' : sel ? COL.borderLit : COL.border, alpha: o.done ? 0.6 : 0.95 });
      if (npc) { try { ctx.save(); ctx.beginPath(); ctx.rect(46, y + 3, 36, 46); ctx.clip(); drawFrame(ctx, npcFrame(npc.sprite, Math.floor(this.t * 4)), 64, y + 44, false, false, o.done ? 0.5 : 1); ctx.restore(); } catch (e) { /* no portrait */ } }
      text(ctx, npc?.name || o.npc, 90, y + 5, o.done ? '#6a8a7a' : COL.gold);
      wrapText(O.line(o), 250).slice(0, 3).forEach((l, k) => text(ctx, l, 90, y + 17 + k * 10, o.done ? '#6a8a7a' : COL.text));
      ctx.drawImage(itemIcon(o.dish), 352, y + 6, 16, 16); const c = `${Math.min(have, o.n)}/${o.n}`; text(ctx, c, 372, y + 10, have >= o.n ? COL.green : COL.red);
      const pay = o.done ? 'DELIVERED' : `${o.coins} coins`; text(ctx, pay, 432 - textWidth(pay), y + 36, o.done ? COL.green : COL.gold);
      const reg = O.regard(o.npc); if (reg) text(ctx, '*'.repeat(Math.min(5, reg)), 352, y + 28, '#ffd84a');
    });
    const done = this.list.filter((o) => o.done).length; text(ctx, `${done}/${this.list.length} done today   Total delivered ${O.state.delivered}   Every ${3}rd pays a pearl`, 44, 226, COL.dim);
    if (this.msgT > 0) text(ctx, this.msg, 240 - textWidth(this.msg) / 2, 238, COL.red); else text(ctx, 'ENTER deliver    ESC back', 240 - textWidth('ENTER deliver    ESC back') / 2, 238, '#9ad8ff');
  }
}
