// The controls screen: every gameplay action with up to three keys, rebindable. Up/Down choose an action, Left/Right a
// key slot, ENTER waits for the next key press, BACKSPACE clears a slot, R restores the defaults. Changes are saved to the
// settings file as they are made.
import { panel, text, COL, drawText, textWidth } from './ui.js';
import { KEYMAP } from '../core/input.js';
import { REBINDABLE, SLOTS, keyLabel, setBinding, clearBinding, resetKeymap, diffKeymap, RESERVED } from '../core/keymap.js';
import { Save } from '../core/save.js';

const PAD = [['Stroke / jump', 'A'], ['Claw', 'X'], ['Heavy claw', 'Y'], ['Dash', 'B'], ['Block', 'RB or RT'], ['Ability 1-2', 'LB / LT'], ['Menu', 'Start'], ['Map', 'Select']];

export class ControlsScene {
  constructor(game) { this.g = game; this.opaque = false; this.row = 0; this.slot = 0; this.wait = false; this.msg = ''; this.msgT = 0; this.t = 0; }
  onEnter() { this.g.audio.sfx('select'); }
  save() { const s = this.g.state.settings; s.keymap = diffKeymap(); Save.saveSettings(s); }
  say(m) { this.msg = m; this.msgT = 2.2; }

  update(dt) {
    const g = this.g, inp = g.input; this.t += dt; this.msgT -= dt;
    if (this.wait) {
      if (inp.rawPressed('Escape')) { this.wait = false; g.audio.sfx('back'); return; }
      const code = inp.lastCode;
      if (code && inp.rawPressed(code)) {
        this.wait = false; const a = REBINDABLE[this.row].a;
        if (RESERVED.has(code)) { g.audio.sfx('deny'); this.say(keyLabel(code) + ' is reserved for menus'); return; }
        const r = setBinding(inp, a, this.slot, code);
        if (!r.ok) { g.audio.sfx('deny'); this.say(r.why === 'last' ? `${REBINDABLE.find((x) => x.a === r.other).label} needs at least one key` : 'That key cannot be used'); return; }
        g.audio.sfx('select'); this.save(); this.say(r.stolen ? `${keyLabel(code)} moved from ${REBINDABLE.find((x) => x.a === r.stolen).label}` : `Bound ${keyLabel(code)}`);
      }
      return;
    }
    if (inp.pressed('cancel') || inp.pressed('pause')) { g.audio.sfx('back'); g.engine.pop(); return; }
    if (inp.pressed('up')) { this.row = (this.row + REBINDABLE.length - 1) % REBINDABLE.length; g.audio.sfx('tick'); }
    if (inp.pressed('down')) { this.row = (this.row + 1) % REBINDABLE.length; g.audio.sfx('tick'); }
    if (inp.pressed('left')) { this.slot = (this.slot + SLOTS - 1) % SLOTS; g.audio.sfx('tick'); }
    if (inp.pressed('right')) { this.slot = (this.slot + 1) % SLOTS; g.audio.sfx('tick'); }
    if (inp.rawPressed('Backspace')) { if (clearBinding(inp, REBINDABLE[this.row].a, this.slot)) { this.save(); g.audio.sfx('back'); this.say('Key removed'); } else { g.audio.sfx('deny'); this.say('At least one key is needed'); } return; }
    if (inp.rawPressed('KeyR')) { resetKeymap(inp); this.save(); g.audio.sfx('select'); this.say('Defaults restored'); return; }
    if (inp.pressed('confirm') || inp.rawPressed('Enter')) { this.wait = true; g.audio.sfx('select'); inp.codeEdge.clear(); inp.lastCode = null; }
  }

  draw(ctx) {
    ctx.fillStyle = 'rgba(2,8,20,0.82)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 20, 12, 440, 246, { alpha: 0.97 }); drawText(ctx, 'CONTROLS', 240, 18, { color: COL.gold, align: 'center', shadow: '#000' });
    const vis = 13, top = Math.max(0, Math.min(this.row - 6, REBINDABLE.length - vis));
    REBINDABLE.slice(top, top + vis).forEach((r, k) => {
      const i = top + k, y = 36 + k * 14, sel = i === this.row;
      if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(26, y - 2, 272, 13); }
      text(ctx, r.label, 32, y, sel ? '#ffffff' : COL.dim);
      for (let s = 0; s < SLOTS; s++) {
        const x = 150 + s * 50, code = KEYMAP[r.a][s], on = sel && s === this.slot;
        ctx.fillStyle = on ? (this.wait ? '#a04020' : '#2a6aa8') : '#0c1830'; ctx.fillRect(x, y - 2, 46, 12);
        ctx.fillStyle = on ? COL.borderLit : '#2a3a58'; ctx.fillRect(x, y + 9, 46, 1);
        const lb = on && this.wait ? '...' : keyLabel(code); text(ctx, lb, x + 23 - textWidth(lb) / 2, y, code ? (on ? '#ffffff' : COL.text) : '#506080');
      }
    });
    if (REBINDABLE.length > vis) { const h = 14 * vis, th = Math.max(6, Math.round(h * vis / REBINDABLE.length)), ty = 34 + Math.round((h - th) * (top / (REBINDABLE.length - vis))); ctx.fillStyle = '#2a3a58'; ctx.fillRect(300, 34, 2, h); ctx.fillStyle = COL.borderLit; ctx.fillRect(300, ty, 2, th); }
    // gamepad reference and help
    text(ctx, 'GAMEPAD', 318, 36, COL.gold);
    PAD.forEach(([a, b], i) => { text(ctx, a, 318, 50 + i * 12, COL.dim); text(ctx, b, 450 - textWidth(b), 50 + i * 12, COL.text); });
    text(ctx, 'ENTER  change key', 318, 160, '#9ad8ff'); text(ctx, 'BACKSPACE  clear key', 318, 172, '#9ad8ff'); text(ctx, 'R  restore defaults', 318, 184, '#9ad8ff'); text(ctx, 'ESC  back', 318, 196, '#9ad8ff');
    if (this.wait) { const s = 'Press the new key  (ESC to cancel)'; panel(ctx, 240 - textWidth(s) / 2 - 8, 214, textWidth(s) + 16, 18, { border: COL.gold }); text(ctx, s, 240 - textWidth(s) / 2, 219, COL.gold); }
    else if (this.msgT > 0) { text(ctx, this.msg, 240 - textWidth(this.msg) / 2, 238, COL.green); }
  }
}
