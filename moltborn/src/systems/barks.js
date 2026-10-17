// Ambient speech bubbles: townsfolk say a line when the swimmer passes by (see data/barks.js). Purely decorative; never blocks.
import { BARKS, BARK_RANGE, BARK_COOLDOWN } from '../data/barks.js';
import { NpcEntity } from '../entities/interactables.js';
import { panel, text, wrapText, textWidth } from '../ui/ui.js';
import { rng } from '../core/util.js';

export class Barks {
  constructor(game) {
    this.g = game; game.systems.barks = this; this.cool = new Map(); this.live = []; this.r = rng(3030); this.last = {};
    game.events.on('zone', () => { this.live.length = 0; this.cool.clear(); const w = game.world; if (w) w.overlayExtra.push((ctx, cam) => this.draw(ctx, cam)); });
  }

  update(dt) {
    const g = this.g, w = g.world, p = w?.player; if (!w || !p || !p.alive) return;
    for (const b of this.live) b.t += dt; this.live = this.live.filter((b) => b.t < b.life);
    for (const [k, v] of this.cool) { if (v - dt <= 0) this.cool.delete(k); else this.cool.set(k, v - dt); }
    if (w.cinematic || g.playScene?.dialogue?.active || w.zone.id.includes(':')) return;
    for (const i of w.interactables) {
      if (!(i instanceof NpcEntity) || !BARKS[i.id] || this.cool.has(i.id)) continue;
      if (Math.hypot(i.x - p.x, i.y - p.y) > BARK_RANGE) continue;
      if (this.live.some((b) => b.npc === i)) continue;
      const line = this.pick(i.id); if (!line) continue;
      this.cool.set(i.id, BARK_COOLDOWN + this.r() * 12); this.say(i, line);
    }
  }
  // the most specific line that currently applies, rotating through plain ones
  pick(id) {
    const list = BARKS[id], g = this.g;
    for (const l of list) if (typeof l === 'object' && l.when(g) && this.last[id] !== l.text) { this.last[id] = l.text; return l.text; }
    const plain = list.filter((l) => typeof l === 'string' && l !== this.last[id]); if (!plain.length) return null;
    const t = plain[Math.floor(this.r() * plain.length)]; this.last[id] = t; return t;
  }
  say(npc, line) { this.live.push({ npc, text: line, t: 0, life: 3.4 + line.length * 0.035 }); this.g.audio.sfx('bark', { x: npc.x, y: npc.y }); this.g.events.emit('bark', npc.id); }

  draw(ctx, cam) {
    for (const b of this.live) {
      const a = Math.min(1, b.t * 5, (b.life - b.t) * 3), lines = wrapText(b.text, 116), w = Math.min(124, Math.max(...lines.map((l) => textWidth(l))) + 10), h = lines.length * 10 + 7;
      const x = Math.round(b.npc.x - cam.x - w / 2), y = Math.round(b.npc.y - b.npc.h / 2 - cam.y - h - 10 - (1 - a) * 4);
      ctx.globalAlpha = a * 0.92; panel(ctx, x, y, w, h, { alpha: 0.85, border: '#7a90b0' });
      ctx.fillStyle = '#0c1830'; ctx.fillRect(Math.round(b.npc.x - cam.x) - 2, y + h - 1, 5, 4); ctx.fillStyle = '#7a90b0'; ctx.fillRect(Math.round(b.npc.x - cam.x) - 3, y + h - 1, 1, 1); ctx.fillRect(Math.round(b.npc.x - cam.x) + 3, y + h - 1, 1, 1);
      ctx.globalAlpha = a; lines.forEach((l, i) => text(ctx, l, x + 5, y + 4 + i * 10, '#e8f4ff'));
    }
    ctx.globalAlpha = 1;
  }
}
