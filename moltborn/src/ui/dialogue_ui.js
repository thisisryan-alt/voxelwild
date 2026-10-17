// Dialogue box with typewriter text, speaker plate and branching choices.
import { panel, text, COL, wrapText, textWidth, drawText } from './ui.js';
import { npcFrame } from '../gfx/sprites_npc.js';
import { drawFrame } from '../entities/entity.js';

export class DialogueBox {
  constructor(game) { this.g = game; this.active = false; this.queue = []; this.cur = null; this.shown = 0; this.choices = null; this.sel = 0; this.t = 0; this.onDone = null; }
  // simple one-shot lines
  say(speaker, textStr, o = {}) { this.open([{ speaker, text: textStr, ...o }]); }
  open(lines, onDone) { this.queue = lines.slice(); this.onDone = onDone || null; this.active = true; this.next(); this.g.audio.sfx('tick'); }
  // node: {speaker, text, sprite?, choices?:[{text, ...}], onSelect}
  next() {
    if (!this.queue.length) { this.close(); return; }
    this.cur = this.queue.shift(); this.shown = 0; this.t = 0; this.choices = this.cur.choices || null; this.sel = 0;
    this.lines = wrapText(this.cur.text || '', 330);
    this.full = this.lines.join('\n');
  }
  close() { this.active = false; this.cur = null; const cb = this.onDone; this.onDone = null; cb?.(); }
  update(dt) {
    if (!this.active) return; const inp = this.g.input; this.t += dt;
    const done = this.shown >= this.full.length;
    if (!done) { const before = Math.floor(this.shown); this.shown += dt * 55; if (Math.floor(this.shown / 2) !== Math.floor(before / 2) && this.cur.speaker) this.g.audio.sfx('talk'); }
    const last = this.choices?.[this.choices.length - 1];
    const bail = done && last && inp.pressed('cancel') && /^(leave|goodbye|never mind|not now|keep|no\b|walk away|back)/i.test(String(last.label ?? last.text ?? last));
    if (bail) this.sel = this.choices.length - 1;
    if (bail || inp.pressed('confirm') || inp.pressed('interact') || inp.pressed('attack')) {
      if (!done) { this.shown = this.full.length; }
      else if (this.choices) { const c = this.choices[this.sel], cb = this.cur.onChoose, i = this.sel; this.g.audio.sfx('select'); this.queue = []; this.active = false; this.cur = null; this.onDone = null; cb?.(c, i); }
      else { this.g.audio.sfx('tick'); this.next(); }
    }
    if (this.choices && done) {
      if (inp.pressed('up')) { this.sel = (this.sel + this.choices.length - 1) % this.choices.length; this.g.audio.sfx('tick'); }
      if (inp.pressed('down')) { this.sel = (this.sel + 1) % this.choices.length; this.g.audio.sfx('tick'); }
    }
  }
  draw(ctx) {
    if (!this.active || !this.cur) return;
    const c = this.cur, y = 270 - 82, hasChoices = this.choices && this.shown >= this.full.length;
    panel(ctx, 20, y, 440, 74, { alpha: 0.95, border: COL.borderLit, fill: '#0a1428' });
    if (c.speaker) { const tw = textWidth(c.speaker) + 12; panel(ctx, 28, y - 8, tw, 14, { fill: '#1e4a7a', border: COL.borderLit }); text(ctx, c.speaker, 34, y - 5, c.color || COL.gold); }
    let tx = 30;
    if (c.sprite) { const f = npcFrame(c.sprite, Math.floor(this.t * 4)); ctx.save(); drawFrame(ctx, f, 52, y + 54); ctx.restore(); tx = 80; }
    const shown = this.full.slice(0, Math.floor(this.shown)).split('\n');
    shown.forEach((l, i) => text(ctx, l, tx, y + 10 + i * 10, COL.text));
    if (hasChoices) {
      const n = this.choices.length, ch = 12, h = n * ch + 6, cx = 250, cy = y - h - 4;
      const w = Math.max(...this.choices.map((x) => textWidth(x.text))) + 24;
      panel(ctx, 460 - w, cy, w, h, { fill: '#0a1428', border: COL.borderLit });
      this.choices.forEach((x, i) => { const sel = i === this.sel; if (sel) { ctx.fillStyle = '#1e4a7a'; ctx.fillRect(462 - w, cy + 3 + i * ch, w - 4, ch - 1); } text(ctx, (sel ? '▶ ' : '  ') + x.text, 466 - w, cy + 5 + i * ch, sel ? '#ffffff' : COL.dim); });
    } else if (this.shown >= this.full.length && Math.floor(this.t * 3) % 2) text(ctx, '▼', 446, y + 62, COL.borderLit);
  }
}
