// The foraging timing game: a marker sweeps back and forth along a bar; press ENTER while it is inside the bright zone.
// Three rounds, each faster with a narrower zone. Hits decide how much is gathered; a perfect run may turn up something rare.
import { panel, text, COL, drawText, textWidth } from './ui.js';
import { ROUNDS, YIELD_BY_HITS, RARE_CHANCE } from '../data/forage.js';
import { ITEMS } from '../data/items.js';
import { itemIcon } from '../gfx/sprites_ui.js';
import { rng } from '../core/util.js';

export class ForageScene {
  constructor(game, patch) {
    this.g = game; this.patch = patch; this.opaque = false; this.round = 0; this.hits = 0; this.pos = 0; this.dir = 1; this.t = 0; this.state = 'play'; this.result = null; this.flash = []; this.pause = 0;
    this.r = rng(Math.floor(game.state.playtime * 7) + patch.seed); this.zoneAt = this.pick();
  }
  onEnter() { this.g.audio.sfx('select'); }
  pick() { const w = ROUNDS[this.round].zone; return 0.15 + this.r() * (0.7 - w); }
  update(dt) {
    const inp = this.g.input; this.t += dt; this.pause = Math.max(0, this.pause - dt);
    if (this.state === 'done') { if (this.t > 0.5 && (inp.pressed('confirm') || inp.pressed('cancel'))) { this.g.engine.pop(); } return; }
    if (inp.pressed('cancel')) { this.g.audio.sfx('back'); this.g.engine.pop(); return; }
    if (this.pause > 0) return;
    const R = ROUNDS[this.round]; this.pos += this.dir * R.speed * dt; if (this.pos > 1) { this.pos = 1; this.dir = -1; } if (this.pos < 0) { this.pos = 0; this.dir = 1; }
    if (inp.pressed('confirm') || inp.pressed('attack')) {
      const inZone = this.pos >= this.zoneAt && this.pos <= this.zoneAt + R.zone;
      this.flash.push({ pos: this.pos, ok: inZone, t: 0 }); if (inZone) this.hits++;
      this.g.audio.sfx(inZone ? 'coin' : 'deny'); this.pause = 0.45; this.round++;
      if (this.round >= ROUNDS.length) this.finish(); else { this.zoneAt = this.pick(); this.pos = 0; this.dir = 1; }
    }
  }
  finish() {
    const g = this.g, kind = this.patch.kind, n = YIELD_BY_HITS[this.hits]; this.state = 'done'; this.t = 0;
    const pool = kind.yield.flatMap(([id, w]) => Array(w).fill(id)), got = {};
    for (let i = 0; i < n; i++) { const id = pool[Math.floor(this.r() * pool.length)]; got[id] = (got[id] || 0) + 1; }
    if (this.hits === 3 && this.r() < RARE_CHANCE) { got.pearl = (got.pearl || 0) + 1; }
    for (const [id, c] of Object.entries(got)) g.grantItem(id, c, true);
    if (n > 0) { this.patch.harvested(); g.state.records.forage = (g.state.records.forage || 0) + 1; g.events.emit('forage', kind.id, this.hits); }
    else { g.toast('The patch crumbles. Nothing gathered.', '#ffb070'); this.patch.harvested(); }
    this.result = got;
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(2,8,20,0.6)'; ctx.fillRect(0, 0, 480, 270);
    const k = this.patch.kind; panel(ctx, 100, 84, 280, 100, { alpha: 0.96 }); drawText(ctx, `FORAGE: ${k.name.toUpperCase()}`, 240, 90, { color: COL.gold, align: 'center', shadow: '#000' });
    const bx = 120, by = 120, bw = 240;
    ctx.fillStyle = '#05030a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 14); ctx.fillStyle = '#16284a'; ctx.fillRect(bx, by, bw, 12);
    if (this.state === 'play' || this.round < ROUNDS.length) {
      const R = ROUNDS[Math.min(this.round, ROUNDS.length - 1)]; ctx.fillStyle = '#3a8a58'; ctx.fillRect(bx + Math.round(this.zoneAt * bw), by, Math.round(R.zone * bw), 12); ctx.fillStyle = '#7aff9a'; ctx.fillRect(bx + Math.round(this.zoneAt * bw), by, Math.round(R.zone * bw), 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + Math.round(this.pos * bw) - 1, by - 3, 3, 18);
    }
    for (const f of this.flash) { ctx.fillStyle = f.ok ? '#7aff9a' : '#ff5a4a'; ctx.fillRect(bx + Math.round(f.pos * bw) - 1, by + 14, 3, 3); }
    for (let i = 0; i < ROUNDS.length; i++) { const x = 226 + i * 14, done = i < this.round; ctx.fillStyle = '#05030a'; ctx.fillRect(x - 1, 144, 10, 10); ctx.fillStyle = done ? (this.flash[i]?.ok ? '#7aff9a' : '#ff5a4a') : '#2a3a58'; ctx.fillRect(x, 145, 8, 8); }
    if (this.state === 'play') text(ctx, 'ENTER when the marker is in the green    ESC leave', 240 - textWidth('ENTER when the marker is in the green    ESC leave') / 2, 168, COL.dim);
    else {
      const items = Object.entries(this.result || {}); const msg = items.length ? 'Gathered:' : 'Nothing gathered.'; text(ctx, msg, 240 - textWidth(msg) / 2, 160, items.length ? COL.green : COL.dim);
      items.forEach(([id, c], i) => { const x = 240 - items.length * 40 + i * 80; ctx.drawImage(itemIcon(id), x, 170 - 2, 12, 12); text(ctx, `${ITEMS[id].name} x${c}`, x + 14, 172, COL.text); });
    }
  }
}
