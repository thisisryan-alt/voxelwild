// Boss 5 — The Lurelord: a colossal anglerfish in a pitch-black cavern. Follow the lure; the teeth are behind it.
import { Boss } from '../entities/boss.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import '../gfx/sprites_bosses.js';
import { drawFrame } from '../entities/entity.js';
import { clamp, TAU } from '../core/util.js';
import { TS } from '../world/tiles.js';

export class Lurelord extends Boss {
  static def = {
    key: 'lurelord', name: 'The Lurelord', title: 'Bright Hunger of the Abyssal Throat', hp: 1900, w: 100, h: 60, armor: 100, xp: 900, music: 'boss5', contact: 17, flying: true, ghost: true,
    loot: { ep: 5, sp: 2, coins: [260, 340], items: { trench_gate_rune: 1 } },
    phases: [
      { at: 1, name: 'The Lure', attacks: [['lureSnap', 2], ['gulpCharge', 2], ['mineBloom', 1.5]], rest: 1.1 },
      { at: 0.6, name: 'The Pack', attacks: [['lureSnap', 2], ['gulpCharge', 1.6], ['mineBloom', 1.5], ['summonLurkers', 1.3]], rest: 0.9, onEnter(b) { b.dmgMult = 1.2; } },
      { at: 0.3, name: 'The Maw', attacks: [['lureSnap', 2], ['gulpCharge', 2], ['mineBloom', 1.5], ['inhale', 2.2]], rest: 0.65, onEnter(b) { b.dmgMult = 1.35; } },
    ],
    sprite: { plan: 'lurelord', w: 150, h: 120, ax: 76, ay: 62, frames: 4, o: {} }, fps: 5,
  };
  constructor(world, x, y, spawn) {
    super(world, x, y, spawn); this.lure = { x: x + 40, y: y - 60 }; this.lureMode = 'idle'; this.mines = []; this.intro = this.introTalk;
    world.extraLights.push((L) => { if (this.alive) L.push({ x: this.lure.x, y: this.lure.y, r: this.lureMode === 'snap' ? 120 : 84, a: 1, color: this.lureMode === 'snap' ? '#ff6a5a' : '#9affff' }); for (const m of this.mines) L.push({ x: m.x, y: m.y, r: 30, a: 0.8, color: '#ff90ff' }); });
  }
  *introTalk(c) {
    yield c.say('A bright little light, carried all by itself. How generous. How... delicious.', 'The Lurelord');
    yield c.say('Every creature in the Abyss follows my lantern. You were so quiet, I almost thought you were not coming. Come closer. The light is nicer from the inside.', 'The Lurelord');
  }
  physics(dt) { this.flyPhysics(dt, 6); this.lureIdle(dt); for (const m of this.mines) { m.t += dt; } this.mines = this.mines.filter((m) => { if (m.t >= m.fuse) { this.strikeBox(m.x - 36, m.y - 36, 72, 72, 15, 0.15, { kb: 180 }); this.world.fx.burst(m.x, m.y, ['#ff90ff', '#ffffff', '#c060ff'], 100, 0.5, 3); this.world.fx.ring(m.x, m.y, 4, 40, 0.3, '#ff90ff', 2); this.sfx('boom'); return false; } return true; }); }
  lureIdle(dt) { if (this.lureMode !== 'idle') return; const tx = this.x + this.facing * 70, ty = this.y - 56 + Math.sin(this.t * 2) * 8; this.lure.x += (tx - this.lure.x) * Math.min(1, dt * 5); this.lure.y += (ty - this.lure.y) * Math.min(1, dt * 5); }
  *lureSnap() {
    const pl = this.player, a = this.arena; this.faceTo(pl.x);
    this.lureMode = 'snap'; const tx = clamp(pl.x + (Math.random() - 0.5) * 120, (a.x + 8) * TS, (a.x + a.w - 8) * TS), ty = clamp(pl.y + (Math.random() - 0.5) * 80, (a.y + 8) * TS, (a.y + a.h - 8) * TS);
    this.lure.x = tx; this.lure.y = ty - 20; this.teleCircle(tx, ty, 54, 1.0); this.sfx('alert');
    yield* this.moveTo(tx - this.facing * 180, ty, 230, 0.7); this.pose = 'open'; yield 0.35;
    this.faceTo(tx); this.sfx('roar'); this.contactMult = 1.4; this.pose = 'charge'; const d = this.facing; let t = 0; while (t < 0.35) { this.vx = (tx - this.x) * 6 + d * 80; this.vy = (ty - this.y) * 6; t += 1 / 60; yield 1 / 60; }
    this.strikeBox(this.x + d * 20 - 40, this.y - 40, 80, 80, 20, 0.15, { kb: 240 }); this.world.shake(6); this.sfx('heavy'); this.vx = this.vy = 0; this.contactMult = 1; this.pose = 'idle'; this.lureMode = 'idle'; yield 0.9;
  }
  *gulpCharge() {
    const a = this.arena, pl = this.player, left = this.x > (a.x + a.w / 2) * TS; const y = clamp(pl.y, (a.y + 8) * TS, (a.y + a.h - 8) * TS), x0 = (left ? a.x + a.w - 8 : a.x + 8) * TS, x1 = (left ? a.x + 8 : a.x + a.w - 8) * TS;
    this.lureMode = 'free'; yield* this.moveTo(x0, y, 280, 2.2); this.faceTo(x1); this.pose = 'open'; this.lure.x = this.x + this.facing * 100; this.lure.y = this.y - 40;
    this.teleRect(Math.min(x0, x1), y - 36, Math.abs(x1 - x0), 72, 1.0, { fill: 'h' }); this.sfx('roar'); yield 1.0;
    this.pose = 'charge'; this.contactMult = 1.5; this.sfx('swoosh'); while (Math.abs(this.x - x1) > 12) { this.vx = this.facing * (this.phaseIdx ? 420 : 360); this.lure.x = this.x + this.facing * 100; this.lure.y = this.y - 40; yield 1 / 60; }
    this.vx = 0; this.contactMult = 1; this.pose = 'idle'; this.world.shake(4); this.lureMode = 'idle'; yield 0.8;
  }
  *mineBloom() {
    this.pose = 'open'; this.lureMode = 'free'; const a = this.arena, pl = this.player; this.sfx('spit');
    for (let i = 0; i < 6; i++) { const x = clamp(pl.x + (Math.random() - 0.5) * 220, (a.x + 5) * TS, (a.x + a.w - 5) * TS), y = clamp(pl.y + (Math.random() - 0.5) * 140, (a.y + 6) * TS, (a.y + a.h - 6) * TS); this.mines.push({ x, y, t: 0, fuse: 1.3 + i * 0.12 }); this.teleCircle(x, y, 36, 1.3 + i * 0.12, { color: '#ff60ff' }); this.lure.x = x; this.lure.y = y - 16; yield 0.18; }
    yield 1.6; this.pose = 'idle'; this.lureMode = 'idle';
  }
  *summonLurkers() { this.pose = 'roar'; this.sfx('roar'); yield 0.5; const a = this.arena; for (let i = 0; i < 3; i++) this.summon('lanternfish', (a.x + 12 + i * 24) * TS, (a.y + 12) * TS); this.pose = 'idle'; yield 1; }
  *inhale() {
    const a = this.arena, w = this.world, pl = this.player; this.lureMode = 'free'; yield* this.moveTo((a.x + a.w / 2) * TS, (a.y + a.h / 2) * TS, 240, 2); this.faceTo(pl.x); this.pose = 'open';
    this.world.fx.text(this.x, this.y - 50, 'IT INHALES', '#ff9ad8', true); this.sfx('whirl');
    const dir = pl.x < this.x ? 1 : -1; const area = { kind: 'current', x: a.x * TS, y: a.y * TS, w: a.w * TS, h: a.h * TS, vx: 0, vy: 0, pull: true }; w.zone.areas.push(area);
    let t = 0; while (t < 2.6) { const dx = this.x - pl.x, dy = this.y - pl.y, d = Math.hypot(dx, dy) || 1; area.vx = dx / d * 90; area.vy = dy / d * 90; this.lure.x = this.x + this.facing * 90; this.lure.y = this.y - 40; t += 1 / 60; yield 1 / 60; }
    w.zone.areas.splice(w.zone.areas.indexOf(area), 1); this.pose = 'charge'; this.strikeBox(this.x - 70, this.y - 50, 140, 100, 22, 0.2, { kb: 300 }); this.sfx('boom'); this.world.shake(8); this.pose = 'idle'; this.lureMode = 'idle'; yield 1;
  }
  *afterDefeat() {
    const w = this.world, g = w.game; w.player.locked = true; w.slowT = 0; this.mines.length = 0; yield 0.3; let done = false;
    g.systems.dialogue.run(function* (c) {
      yield c.say('...The light goes out. That is a strange sensation. I did not know it hurt.', 'The Lurelord');
      yield c.say("Do you know what the Slow Song is? It is not a hunger, small light. It is a sleeper. Something under the trench is dreaming, and I have been its lantern for a thousand years. When the dream turns, it will want a lantern. Do not be one.", 'The Lurelord');
      yield c.say('Take the rune. It opens the door the Court was afraid of.', 'The Lurelord');
    }, null, null, () => { done = true; }); while (!done) yield 0.1; w.player.locked = false;
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const f = enemyFrame(this.key, this.def.sprite, this.pose === 'stagger' ? 'idle' : this.pose, Math.floor(this.t * 5));
    drawFrame(ctx, f, this.x - cam.x, this.y - cam.y, this.facing < 0, this.flash > 0, this.alpha);
    // lure: stalk from the brow to the dynamic bulb
    const bx = Math.round(this.lure.x - cam.x), by = Math.round(this.lure.y - cam.y), sx = Math.round(this.x + this.facing * 8 - cam.x), sy = Math.round(this.y - 34 - cam.y);
    ctx.strokeStyle = '#6a6a7a'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + bx) / 2, Math.min(sy, by) - 18, bx, by); ctx.stroke();
    const c = this.lureMode === 'snap' ? '#ff6a5a' : '#9affff'; ctx.globalAlpha = 0.35; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bx, by, 10, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 2, by - 2, 5, 5); ctx.fillStyle = c; ctx.fillRect(bx - 3, by - 1, 7, 3); ctx.fillRect(bx - 1, by - 3, 3, 7);
    for (const m of this.mines) { const k = m.t / m.fuse; ctx.fillStyle = Math.floor(m.t * 12) % 2 ? '#ffffff' : '#ff90ff'; ctx.fillRect(Math.round(m.x - cam.x) - 3, Math.round(m.y - cam.y) - 3, 7, 7); }
  }
}
BOSS_CLASSES.lurelord = Lurelord;
