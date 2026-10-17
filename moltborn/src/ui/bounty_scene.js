// The bounty board: today's four bounties with their progress, rewards and a claim button, plus the streak. ENTER claims a
// finished bounty, TAB swaps an unclaimed one for another (for a few coins), ESC goes back to the Tide Board.
import { panel, text, COL, drawText, textWidth } from './ui.js';
import { ENEMIES } from '../data/enemies.js';
import { REROLL_COST, STREAK_BONUS } from '../data/bounties.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import { drawFrame } from '../entities/entity.js';

// little glyphs for the non-creature bounties, drawn from rectangles so they stay crisp at any size
const GLYPH = {
  chest: (c, x, y) => { c.fillStyle = '#8a5a2a'; c.fillRect(x + 4, y + 10, 24, 14); c.fillStyle = '#b88040'; c.fillRect(x + 4, y + 6, 24, 6); c.fillStyle = '#ffd84a'; c.fillRect(x + 14, y + 12, 4, 5); },
  leaf: (c, x, y) => { c.fillStyle = '#4ac070'; c.fillRect(x + 8, y + 8, 14, 12); c.fillRect(x + 12, y + 4, 10, 6); c.fillStyle = '#b8ffd0'; c.fillRect(x + 10, y + 12, 8, 2); c.fillStyle = '#2a7a48'; c.fillRect(x + 6, y + 20, 4, 6); },
  pot: (c, x, y) => { c.fillStyle = '#5a6a8a'; c.fillRect(x + 6, y + 10, 20, 14); c.fillStyle = '#8a9aba'; c.fillRect(x + 4, y + 8, 24, 4); c.fillStyle = '#ffb060'; c.fillRect(x + 10, y + 2, 3, 5); c.fillRect(x + 18, y + 3, 3, 4); },
  skull: (c, x, y) => { c.fillStyle = '#e8e0cc'; c.fillRect(x + 6, y + 4, 20, 16); c.fillRect(x + 10, y + 20, 12, 5); c.fillStyle = '#05030a'; c.fillRect(x + 9, y + 10, 5, 5); c.fillRect(x + 18, y + 10, 5, 5); },
  rift: (c, x, y) => { c.fillStyle = '#4a2a90'; c.fillRect(x + 8, y + 2, 16, 26); c.fillStyle = '#60d8ff'; c.fillRect(x + 14, y + 4, 4, 22); c.fillStyle = '#ffffff'; c.fillRect(x + 15, y + 8, 2, 12); },
  ring: (c, x, y) => { c.strokeStyle = '#ffd84a'; c.lineWidth = 3; c.beginPath(); c.arc(x + 16, y + 15, 11, 0, 6.3); c.stroke(); c.fillStyle = '#ffffff'; c.fillRect(x + 14, y + 13, 4, 4); },
  wave: (c, x, y) => { c.fillStyle = '#6ab0ff'; for (let i = 0; i < 4; i++) c.fillRect(x + 4 + i * 6, y + 10 + (i % 2) * 6, 6, 4); c.fillStyle = '#d8f4ff'; c.fillRect(x + 4, y + 22, 24, 2); },
  shrine: (c, x, y) => { c.fillStyle = '#ff9ad8'; c.fillRect(x + 12, y + 6, 8, 18); c.fillRect(x + 8, y + 22, 16, 4); c.fillStyle = '#ffe0f4'; c.fillRect(x + 14, y + 2, 4, 6); },
  star: (c, x, y) => { c.fillStyle = '#ffd84a'; c.fillRect(x + 13, y + 3, 6, 24); c.fillRect(x + 4, y + 12, 24, 6); c.fillStyle = '#fff6a8'; c.fillRect(x + 14, y + 12, 4, 6); },
  drop: (c, x, y) => { c.fillStyle = '#e0304a'; c.fillRect(x + 12, y + 4, 8, 6); c.fillRect(x + 8, y + 10, 16, 12); c.fillRect(x + 11, y + 22, 10, 3); c.fillStyle = '#ff9aa8'; c.fillRect(x + 11, y + 12, 3, 5); },
};

export class BountyScene {
  constructor(game) { this.g = game; this.opaque = false; this.sel = 0; this.t = 0; this.msg = ''; this.msgT = 0; this.list = game.systems.bounties.refresh(); }
  onEnter() { this.g.audio.sfx('select'); }
  say(m, bad = true) { this.msg = m; this.msgT = 2.2; this.bad = bad; }
  update(dt) {
    const g = this.g, inp = g.input, B = g.systems.bounties; this.t += dt; this.msgT -= dt; this.list = B.state.list;
    if (inp.pressed('cancel') || inp.pressed('pause')) { g.audio.sfx('back'); g.engine.pop(); return; }
    const n = this.list.length;
    if (inp.pressed('up')) { this.sel = (this.sel + n - 1) % n; g.audio.sfx('tick'); } if (inp.pressed('down')) { this.sel = (this.sel + 1) % n; g.audio.sfx('tick'); }
    const b = this.list[this.sel];
    if (inp.pressed('confirm') && b) {
      if (b.claimed) { g.audio.sfx('deny'); this.say('Already claimed'); }
      else if (!B.complete(b)) { g.audio.sfx('deny'); this.say(`${b.n - B.progress(b)} to go`); }
      else if (B.claim(b)) this.say('Paid in full', false);
    }
    if (inp.pressed('menu') && b) {
      if (b.claimed) { g.audio.sfx('deny'); this.say('A claimed bounty cannot be swapped'); }
      else if (g.state.coins < REROLL_COST) { g.audio.sfx('deny'); this.say(`A swap costs ${REROLL_COST} coins`); }
      else if (B.reroll(this.sel)) { g.audio.sfx('select'); this.say('A different job', false); }
    }
  }
  portrait(ctx, b, x, y) {
    if (b.kind === 'hunt') {
      const d = ENEMIES[b.target]; try { const f = enemyFrame(b.target, d.sprite, 'move', 0), k = Math.min(1, 34 / Math.max(f.w, f.h)); ctx.save(); ctx.translate(x + 16, y + 16); ctx.scale(k, k); drawFrame(ctx, f, 0, 0, false, false, 1); ctx.restore(); } catch (e) { /* a creature without a frame just has no portrait */ }
    } else { (GLYPH[this.iconOf(b)] || GLYPH.star)(ctx, x, y); }
  }
  iconOf(b) { return { chests: 'chest', forage: 'leaf', crafted: 'pot', elites: 'skull', rifts: 'rift', gauntlet: 'ring', dashes: 'wave', rests: 'shrine', crits: 'star', healed: 'drop' }[b.target] || 'star'; }
  draw(ctx) {
    const g = this.g, B = g.systems.bounties, st = B.state;
    ctx.fillStyle = 'rgba(2,8,20,0.8)'; ctx.fillRect(0, 0, 480, 270);
    panel(ctx, 30, 14, 420, 244, { alpha: 0.96 }); drawText(ctx, 'HUNT BOUNTIES', 240, 20, { color: COL.gold, scale: 2, align: 'center', shadow: '#000' });
    this.list.forEach((b, i) => {
      const y = 42 + i * 47, sel = i === this.sel, prog = B.progress(b), done = B.complete(b), dim = b.claimed;
      panel(ctx, 40, y, 400, 43, { fill: sel ? '#14305a' : COL.panel, border: b.claimed ? '#3a6a4a' : done ? '#6aff9a' : sel ? COL.borderLit : COL.border, alpha: dim ? 0.6 : 0.95 });
      ctx.save(); ctx.globalAlpha = dim ? 0.5 : 1; this.portrait(ctx, b, 46, y + 5); ctx.restore();
      text(ctx, B.label(b), 86, y + 6, dim ? '#6a8a7a' : COL.text);
      const bw = 200, frac = prog / b.n; ctx.fillStyle = '#05102a'; ctx.fillRect(86, y + 20, bw, 6); ctx.fillStyle = done ? '#6aff9a' : '#6ab0ff'; ctx.fillRect(86, y + 20, Math.round(bw * frac), 6); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(86, y + 20, Math.round(bw * frac), 2);
      text(ctx, `${prog}/${b.n}`, 292, y + 19, done ? COL.green : COL.dim);
      const reward = `${b.coins}c  ${b.xp}xp${b.pearl ? '  +pearl' : ''}`; text(ctx, reward, 86, y + 30, dim ? '#6a8a7a' : COL.gold);
      const tag = b.claimed ? 'CLAIMED' : done ? 'CLAIM' : 'ACTIVE', tc = b.claimed ? COL.green : done ? '#6aff9a' : COL.dim;
      text(ctx, tag, 432 - textWidth(tag), y + 6, tc);
      if (done && !b.claimed && Math.floor(this.t * 3) % 2) { ctx.fillStyle = '#6aff9a'; ctx.fillRect(40, y, 3, 43); }
    });
    const full = this.list.every((b) => b.claimed);
    text(ctx, `Streak ${st.streak} day${st.streak === 1 ? '' : 's'}   Claimed ${st.claimed}   ${full ? 'Board cleared!' : `Clear all four for a streak (+${Math.max(0, STREAK_PREVIEW(st.streak + 1))} pearl)`}`, 44, 232, full ? COL.green : COL.dim);
    if (this.msgT > 0) text(ctx, this.msg, 240 - textWidth(this.msg) / 2, 244, this.bad ? COL.red : COL.green);
    else { const h = `ENTER claim    TAB swap (${REROLL_COST}c)    ESC back`; text(ctx, h, 240 - textWidth(h) / 2, 244, '#9ad8ff'); }
  }
}
const STREAK_PREVIEW = (n) => STREAK_BONUS[Math.min(STREAK_BONUS.length - 1, n)];
