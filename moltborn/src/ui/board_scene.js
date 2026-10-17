// The Tide Board menu (choose a rift, the daily rift or the Pearl Gauntlet) and the summary shown when a run ends.
import { panel, text, button, COL, drawText, textWidth, wrapText } from './ui.js';
import { RELICS, RARITY } from '../data/relics.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { itemIcon } from '../gfx/sprites_ui.js';
import { ITEMS } from '../data/items.js';
import { today } from '../world/rift_gen.js';
import { OrdersScene } from './orders_scene.js';

const bossName = (k) => BOSS_CLASSES[k]?.def?.name || k;
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export class BoardScene {
  constructor(game) { this.g = game; this.opaque = false; this.sel = 0; this.t = 0; this.msg = ''; this.msgT = 0; }
  onEnter() { this.g.audio.sfx('select'); this.g.audio.setMuffle?.(0.4); }
  onExit() { this.g.audio.setMuffle?.(0); }
  entries() {
    const R = this.g.systems.rifts, s = this.g.state, list = R.tiers().map((t) => ({ kind: 'rift', tier: t, name: t.name, open: t.open, why: t.needs ? `Defeat ${bossName(t.needs)} first.` : '' }));
    const best = R.tiers().filter((t) => t.open).pop();
    list.push({ kind: 'daily', tier: best, name: 'Daily Rift', open: true, why: '' });
    const arenaOpen = !!s.bosses.grumbold;
    list.push({ kind: 'arena', name: 'Pearl Gauntlet', open: arenaOpen, why: arenaOpen ? '' : `Defeat ${bossName('grumbold')} first.` });
    list.push({ kind: 'orders', name: 'Kitchen Orders', open: true, why: '' });
    return list;
  }
  say(m) { this.msg = m; this.msgT = 2; }
  update(dt) {
    const g = this.g, inp = g.input, list = this.entries(); this.t += dt; this.msgT -= dt;
    if (inp.pressed('cancel') || inp.pressed('pause') || inp.pressed('menu')) { g.audio.sfx('back'); g.engine.pop(); return; }
    if (inp.pressed('up')) { this.sel = (this.sel + list.length - 1) % list.length; g.audio.sfx('tick'); }
    if (inp.pressed('down')) { this.sel = (this.sel + 1) % list.length; g.audio.sfx('tick'); }
    if (inp.pressed('confirm')) {
      const e = list[this.sel];
      if (!e.open) { g.audio.sfx('deny'); this.say(e.why); return; }
      if (e.kind === 'orders') { g.audio.sfx('select'); g.engine.push(new OrdersScene(g)); return; }
      g.engine.pop(); g.audio.sfx('select');
      if (e.kind === 'arena') g.systems.arena.start();
      else g.systems.rifts.start({ tier: e.tier.id, daily: e.kind === 'daily', seed: e.kind === 'daily' ? today() : undefined });
    }
  }
  draw(ctx) {
    const g = this.g, rec = g.state.records, list = this.entries(), e = list[this.sel];
    ctx.fillStyle = 'rgba(2,8,20,0.8)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 30, 20, 420, 230, { alpha: 0.96 }); drawText(ctx, 'THE TIDE BOARD', 240, 26, { color: COL.gold, scale: 2, align: 'center', shadow: '#000' });
    list.forEach((it, i) => button(ctx, it.name + (it.open ? '' : '  (locked)'), 40, 52 + i * 20, 168, 17, i === this.sel));
    panel(ctx, 216, 50, 226, 140, { alpha: 0.9 });
    if (e.kind === 'rift' || e.kind === 'daily') {
      const t = e.tier; text(ctx, e.name, 224, 56, COL.gold);
      const blurb = e.kind === 'daily' ? `Everyone swims the same rift today (${today()}). The first clear of the day pays a bonus.` : t.blurb;
      wrapText(blurb, 210).forEach((l, i) => text(ctx, l, 224, 70 + i * 10, COL.text));
      const y = 70 + wrapText(blurb, 210).length * 10 + 6;
      text(ctx, `${t.depths} depths   Reward x${t.reward}`, 224, y, COL.dim);
      wrapText('Clear every foe to open the way. Choose a relic between depths. Death ends the run.', 210).forEach((l, i) => text(ctx, l, 224, y + 14 + i * 10, '#9ad8ff'));
      if (e.kind === 'daily') text(ctx, g.state.flags['daily_' + today()] ? 'Bonus already claimed today.' : 'Bonus available!', 224, y + 54, g.state.flags['daily_' + today()] ? COL.dim : COL.green);
    } else if (e.kind === 'orders') {
      text(ctx, 'Kitchen Orders', 224, 56, COL.gold);
      wrapText('Three requests a day for dishes you know how to cook. Deliver them for coins; every third pays a pearl.', 210).forEach((l, i) => text(ctx, l, 224, 70 + i * 10, COL.text));
      const o = g.systems.orders.refresh(); text(ctx, `Today: ${o.filter((x) => x.done).length}/${o.length} delivered`, 224, 120, COL.dim);
    } else {
      text(ctx, 'Pearl Gauntlet', 224, 56, COL.gold);
      wrapText('A sealed arena. Wave after wave of the sea\'s creatures, each tougher than the last. Pearls at every fifth wave.', 210).forEach((l, i) => text(ctx, l, 224, 70 + i * 10, COL.text));
      text(ctx, `Best wave ${rec.arenaBest}    Foes felled ${rec.arenaKills}`, 224, 120, COL.dim);
    }
    if (!e.open) text(ctx, e.why, 224, 176, COL.red);
    text(ctx, `Rifts cleared ${rec.rifts}   Deepest ${rec.riftBest}   Gauntlet ${rec.arenaBest}`, 40, 196, COL.dim);
    text(ctx, 'ENTER begin    ESC leave', 240 - textWidth('ENTER begin    ESC leave') / 2, 236, '#9ad8ff');
    if (this.msgT > 0) text(ctx, this.msg, 240 - textWidth(this.msg) / 2, 214, COL.red);
  }
}

// shown after a rift or gauntlet ends, over the hub zone
export class RiftSummary {
  constructor(game, s) { this.g = game; this.opaque = false; this.s = s; this.t = 0; }
  onEnter() { this.g.audio.sfx(this.s.success ? 'levelup' : 'wave_clear'); }
  update(dt) { this.t += dt; const inp = this.g.input; if (this.t > 0.6 && (inp.pressed('confirm') || inp.pressed('cancel'))) { this.g.audio.sfx('select'); this.g.engine.pop(); } }
  draw(ctx) {
    const s = this.s, rw = s.rw; ctx.fillStyle = 'rgba(2,8,20,0.78)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 90, 24, 300, 222, { alpha: 0.97, border: s.success ? COL.gold : '#a05060' });
    drawText(ctx, s.title || (s.success ? 'RIFT CLEARED' : 'RIFT LOST'), 240, 32, { color: s.success ? COL.gold : '#ff9a8a', scale: 2, align: 'center', shadow: '#000' });
    text(ctx, s.label || `${s.tier}  -  depth ${s.depth} of ${s.max}`, 240 - textWidth(s.label || `${s.tier}  -  depth ${s.depth} of ${s.max}`) / 2, 52, COL.dim);
    const rows = [['Time', fmt(s.secs)], ['Foes defeated', s.kills], ['Coins', '+' + rw.coins]]; if (rw.xp) rows.push(['Experience', '+' + rw.xp]);
    if (rw.pearls) rows.push(['Pearls', '+' + rw.pearls]); if (rw.black) rows.push(['Black pearls', '+' + rw.black]); if (rw.sp) rows.push(['Skill point', '+' + rw.sp]);
    rows.forEach(([k, v], i) => { text(ctx, k, 110, 70 + i * 12, COL.dim); const t = String(v); text(ctx, t, 370 - textWidth(t), 70 + i * 12, COL.text); });
    const items = Object.entries(rw.items || {}); let y = 70 + rows.length * 12 + 6;
    if (items.length) { text(ctx, 'INGREDIENTS', 110, y, COL.gold); y += 12; items.forEach(([id, n], i) => { const x = 110 + (i % 2) * 130, yy = y + Math.floor(i / 2) * 14; ctx.drawImage(itemIcon(id), x, yy - 3, 12, 12); text(ctx, `${ITEMS[id].name} x${n}`, x + 15, yy, COL.text); }); y += Math.ceil(items.length / 2) * 14 + 4; }
    if (s.relics?.length) { text(ctx, 'RELICS', 110, y, COL.gold); y += 11; s.relics.forEach((r, i) => text(ctx, RELICS[r].name, 110 + (i % 2) * 130, y + Math.floor(i / 2) * 11, RARITY[RELICS[r].rarity].color)); }
    text(ctx, 'ENTER continue', 240 - textWidth('ENTER continue') / 2, 232, '#9ad8ff');
  }
}
