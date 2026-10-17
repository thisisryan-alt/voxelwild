// Save tools: export a slot as a portable code (copied to the clipboard and downloaded as a file), import a code into a
// slot, restore the rolling backup of a slot, or delete it. Up/Down choose a slot, Left/Right an action, ENTER does it.
import { panel, text, button, COL, drawText, textWidth, wrapText } from './ui.js';
import { Save } from '../core/save.js';
import { FORMS } from '../data/forms.js';

const ACTIONS = ['EXPORT', 'IMPORT', 'RESTORE', 'DELETE'];
const HELP = { EXPORT: 'Copy this slot as a text code and download it as a file.', IMPORT: 'Paste a save code into this slot (it replaces whatever is there).', RESTORE: 'Bring back the automatic backup from a few minutes before the last save.', DELETE: 'Erase this slot. This cannot be undone.' };
const fmtTime = (s) => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;

export class SaveToolsScene {
  constructor(game) { this.g = game; this.opaque = true; this.slot = 0; this.act = 0; this.msg = ''; this.msgT = 0; this.ok = true; this.confirm = false; this.t = 0; }
  onEnter() { this.g.audio.sfx('select'); }
  say(m, ok = true) { this.msg = m; this.ok = ok; this.msgT = 4; }
  update(dt) {
    const g = this.g, inp = g.input; this.t += dt; this.msgT -= dt;
    if (this.confirm) { if (inp.pressed('confirm')) { Save.delete(this.slot); this.say('Slot deleted'); this.confirm = false; g.audio.sfx('back'); } else if (inp.pressed('cancel')) this.confirm = false; return; }
    if (inp.pressed('cancel') || inp.pressed('pause')) { g.audio.sfx('back'); g.engine.pop(); return; }
    if (inp.pressed('up')) { this.slot = (this.slot + 2) % 3; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.slot = (this.slot + 1) % 3; g.audio.sfx('tick'); }
    if (inp.pressed('left')) { this.act = (this.act + ACTIONS.length - 1) % ACTIONS.length; g.audio.sfx('tick'); } if (inp.pressed('right')) { this.act = (this.act + 1) % ACTIONS.length; g.audio.sfx('tick'); }
    if (inp.pressed('confirm')) this.run(ACTIONS[this.act]);
  }
  run(a) {
    const g = this.g, s = this.slot, has = !!Save.read(s);
    if (a === 'EXPORT') {
      if (!has) return this.deny('Nothing in this slot');
      const code = Save.exportCode(s);
      try { navigator.clipboard?.writeText(code); } catch (e) { /* clipboard may be blocked */ }
      try { const blob = new Blob([code], { type: 'text/plain' }), url = URL.createObjectURL(blob), el = document.createElement('a'); el.href = url; el.download = `moltborn-slot${s + 1}.save.txt`; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); } catch (e) { /* download blocked */ }
      this.lastCode = code; g.audio.sfx('select'); this.say(`Exported ${code.length} characters (clipboard + file)`);
    } else if (a === 'IMPORT') {
      const code = typeof window.prompt === 'function' ? window.prompt('Paste a Moltborn save code:') : null; if (!code) return;
      const r = Save.importCode(s, code); if (r.ok) { g.audio.sfx('levelup'); this.say('Imported into slot ' + (s + 1)); } else this.deny(r.why);
    } else if (a === 'RESTORE') {
      if (!Save.backup(s)) return this.deny('No backup for this slot yet');
      Save.restoreBackup(s); g.audio.sfx('select'); this.say('Backup restored');
    } else if (a === 'DELETE') { if (!has) return this.deny('Already empty'); this.confirm = true; g.audio.sfx('select'); }
  }
  deny(m) { this.g.audio.sfx('deny'); this.say(m, false); }
  draw(ctx) {
    ctx.fillStyle = '#071226'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 40, 20, 400, 230, { alpha: 0.96 }); drawText(ctx, 'SAVE TOOLS', 240, 26, { color: COL.gold, scale: 2, align: 'center', shadow: '#000' });
    Save.list().forEach((s, i) => {
      const y = 52 + i * 32, sel = i === this.slot; panel(ctx, 50, y, 380, 28, { fill: sel ? '#1e4a7a' : COL.panel, border: sel ? COL.borderLit : COL.border });
      if (s.meta) { text(ctx, `Slot ${i + 1}   Lv ${s.meta.level}   ${FORMS[s.meta.form]?.name || ''}${s.meta.ng ? '   NG+' + s.meta.ng : ''}`, 58, y + 4, COL.text); text(ctx, `${s.meta.zone}   ${fmtTime(s.meta.playtime || 0)}   ${Save.backup(i) ? 'backup available' : 'no backup'}`, 58, y + 15, COL.dim); }
      else text(ctx, `Slot ${i + 1}  -  empty`, 58, y + 10, '#6a8ab0');
    });
    ACTIONS.forEach((a, i) => button(ctx, a, 50 + i * 96, 156, 92, 16, i === this.act));
    wrapText(HELP[ACTIONS[this.act]], 370).forEach((l, i) => text(ctx, l, 56, 182 + i * 10, COL.dim));
    if (this.confirm) { panel(ctx, 110, 120, 260, 44, { border: '#ff5a4a' }); text(ctx, 'Delete this slot? ENTER = yes, ESC = no', 118, 138, '#ff9a7a'); }
    else if (this.msgT > 0) text(ctx, this.msg, 240 - textWidth(this.msg) / 2, 214, this.ok ? COL.green : COL.red);
    text(ctx, 'ARROWS choose    ENTER do it    ESC back', 240 - textWidth('ARROWS choose    ENTER do it    ESC back') / 2, 236, '#9ad8ff');
  }
}
