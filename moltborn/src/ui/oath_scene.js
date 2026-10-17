// Swearing oaths before a rift: toggle up to three handicaps for a bigger payout, then set off. ENTER toggles the selected
// oath, TAB (or the last line) starts the run, ESC goes back to the Tide Board.
import { panel, text, button, COL, drawText, textWidth } from './ui.js';
import { OATHS, OATH_IDS, MAX_OATHS, cleanOaths, rewardBonus } from '../data/oaths.js';

export class OathScene {
  // `go(oaths)` is called with the chosen list when the swimmer sets off
  // `forced` oaths are sworn already and cannot be put down (the daily rift's)
  constructor(game, title, go, forced = []) {
    this.g = game; this.title = title; this.go = go; this.forced = cleanOaths(forced); this.opaque = false; this.sel = 0; this.t = 0; this.msg = ''; this.msgT = 0;
    this.picked = cleanOaths([...this.forced, ...(game.state.lastOaths || [])]);
  }
  onEnter() { this.g.audio.sfx('select'); }
  start() { this.g.state.lastOaths = this.picked.filter((id) => !this.forced.includes(id)); this.g.engine.pop(); this.go([...this.picked]); }
  say(m) { this.msg = m; this.msgT = 1.8; }
  update(dt) {
    const g = this.g, inp = g.input, n = OATH_IDS.length + 1; this.t += dt; this.msgT -= dt;
    if (inp.pressed('cancel') || inp.pressed('pause')) { g.audio.sfx('back'); g.engine.pop(); return; }
    if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; g.audio.sfx('tick'); }
    if (inp.pressed('menu')) { g.audio.sfx('select'); this.start(); return; }
    if (inp.pressed('confirm')) {
      if (this.sel === OATH_IDS.length) { g.audio.sfx('select'); this.start(); return; }
      const id = OATH_IDS[this.sel], at = this.picked.indexOf(id);
      if (this.forced.includes(id)) { g.audio.sfx('deny'); this.say('Today\'s oath cannot be put down'); }
      else if (at >= 0) { this.picked.splice(at, 1); g.audio.sfx('back'); }
      else if (this.picked.length >= MAX_OATHS) { g.audio.sfx('deny'); this.say(`At most ${MAX_OATHS} oaths`); }
      else { this.picked.push(id); g.audio.sfx('select'); }
    }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(2,8,20,0.82)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 50, 24, 380, 222, { alpha: 0.97 }); drawText(ctx, 'SWEAR OATHS', 240, 30, { color: COL.gold, scale: 2, align: 'center', shadow: '#000' });
    text(ctx, this.title, 240 - textWidth(this.title) / 2, 52, COL.dim);
    OATH_IDS.forEach((id, i) => {
      const O = OATHS[id], y = 66 + i * 25, sel = i === this.sel, on = this.picked.includes(id);
      panel(ctx, 60, y, 360, 23, { fill: sel ? '#14305a' : COL.panel, border: on ? O.color : sel ? COL.borderLit : COL.border, alpha: 0.95 });
      ctx.fillStyle = '#05030a'; ctx.fillRect(66, y + 7, 9, 9); ctx.fillStyle = on ? O.color : '#16284a'; ctx.fillRect(67, y + 8, 7, 7); if (on) { ctx.fillStyle = '#ffffff'; ctx.fillRect(69, y + 10, 3, 3); }
      text(ctx, O.name + (this.forced.includes(id) ? '  (today)' : ''), 82, y + 3, on ? O.color : COL.text); text(ctx, O.desc, 82, y + 13, COL.dim); const r = `+${Math.round(O.reward * 100)}%`; text(ctx, r, 410 - textWidth(r), y + 8, COL.gold);
    });
    const y = 66 + OATH_IDS.length * 25; button(ctx, 'SET OFF', 60, y, 360, 17, this.sel === OATH_IDS.length);
    const bonus = Math.round(rewardBonus(this.picked) * 100), s = this.picked.length ? `${this.picked.length} oath${this.picked.length > 1 ? 's' : ''} sworn: +${bonus}% coins and experience` : 'No oaths: the rift as it is';
    text(ctx, s, 240 - textWidth(s) / 2, 210, this.picked.length ? COL.green : COL.dim);
    if (this.msgT > 0) text(ctx, this.msg, 240 - textWidth(this.msg) / 2, 225, COL.red); else { const h = 'ENTER toggle    TAB set off    ESC back'; text(ctx, h, 240 - textWidth(h) / 2, 225, '#9ad8ff'); }
  }
}
