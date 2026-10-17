// Hidden boss — The Hollow Maw: the Seal's dreaming wound. Opening the Sanctum is the price of the secret ending.
import { Boss } from '../entities/boss.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import '../gfx/sprites_bosses.js';
import { drawFrame } from '../entities/entity.js';
import { clamp, TAU } from '../core/util.js';
import { TS } from '../world/tiles.js';

export class HollowMaw extends Boss {
  static def = {
    key: 'hollow_maw', name: 'The Hollow Maw', title: 'A Wound That Learned to Dream', hp: 3200, w: 100, h: 80, armor: 150, xp: 2000, music: 'boss8', contact: 22, flying: true, ghost: true,
    loot: { ep: 6, sp: 3, coins: [500, 700], items: { dye_spectral: 1 } },
    phases: [
      { at: 1, name: 'The Dreaming', attacks: [['eyeVolley', 2], ['tendrilSlam', 2], ['shadeCall', 1]], rest: 1.1 },
      { at: 0.65, name: 'The Hunger', attacks: [['eyeVolley', 2], ['tendrilSlam', 2], ['shadeCall', 1], ['swallow', 2]], rest: 0.85, onEnter(b) { b.dmgMult = 1.25; } },
      { at: 0.3, name: 'The Undertow', attacks: [['eyeVolley', 2], ['tendrilSlam', 1.8], ['swallow', 1.6], ['voidNova', 2.2]], rest: 0.6, onEnter(b) { b.dmgMult = 1.4; } },
    ],
    sprite: { plan: 'maw', w: 180, h: 150, ax: 88, ay: 70, frames: 4, o: {} }, fps: 5,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); this.intro = this.introTalk; }
  *introTalk(c) {
    yield c.narrate('Seven pearls hum in your shell. The dark water in the sanctum leans toward you like a sleeper turning toward a voice.');
    yield c.say('...come home...   ...come home...   ...you are so very warm...', 'The Hollow Maw');
  }
  physics(dt) { this.flyPhysics(dt, 8); this.y += Math.sin(this.t * 1.5) * 0.15; }
  *eyeVolley() {
    this.pose = 'open'; const n = this.phaseIdx > 1 ? 40 : 28; this.sfx('roar'); yield 0.5;
    for (let i = 0; i < n; i++) { const a = i * 0.5 + this.t; this.shootDir('orb', 9, a, 110, { trail: '#c060ff' }); if (i % 3 === 0) this.shootAt('orb', 9, 130); if (i % 6 === 0) this.sfx('spore'); yield 0.1; }
    this.pose = 'idle'; yield 0.6;
  }
  *tendrilSlam() {
    const a = this.arena, pl = this.player, fy = (a.y + a.h - 3) * TS; this.pose = 'roar';
    const xs = [0, 1, 2, 3, 4].map((i) => clamp(pl.x + (i - 2) * 56, (a.x + 3) * TS, (a.x + a.w - 3) * TS)); xs.forEach((x, i) => this.teleRect(x - 15, fy - 110, 30, 112, 0.8 + i * 0.15)); this.sfx('roar'); yield 0.8;
    for (const x of xs) { this.strikeBox(x - 14, fy - 110, 28, 112, 18, 0.2, { kb: 220 }); this.world.fx.burst(x, fy - 50, ['#c060ff', '#2a1450', '#ffffff'], 70, 0.5, 3); this.sfx('boom'); yield 0.15; }
    this.world.shake(7); this.pose = 'idle'; yield 0.7;
  }
  *shadeCall() { this.pose = 'roar'; this.sfx('roar'); yield 0.5; const a = this.arena; this.summon('hollowshade', (a.x + 8) * TS, (a.y + 12) * TS); this.summon('hollowshade', (a.x + a.w - 8) * TS, (a.y + 12) * TS); this.pose = 'idle'; yield 1; }
  *swallow() {
    const w = this.world, pl = this.player, a = this.arena; yield* this.moveTo((a.x + a.w / 2) * TS, (a.y + a.h / 2 - 4) * TS, 220, 2); this.pose = 'open'; this.world.fx.text(this.x, this.y - 70, 'IT HUNGERS', '#d8a0ff', true); this.sfx('whirl');
    const area = { kind: 'current', x: a.x * TS, y: a.y * TS, w: a.w * TS, h: a.h * TS, vx: 0, vy: 0 }; w.zone.areas.push(area); let t = 0;
    while (t < 2.8) { const dx = this.x - pl.x, dy = this.y - pl.y, d = Math.hypot(dx, dy) || 1; area.vx = dx / d * 100; area.vy = dy / d * 100; t += 1 / 60; yield 1 / 60; }
    w.zone.areas.splice(w.zone.areas.indexOf(area), 1); this.strikeBox(this.x - 70, this.y - 60, 140, 120, 24, 0.2, { kb: 320 }); this.world.shake(8); this.sfx('boom'); this.pose = 'idle'; yield 1;
  }
  *voidNova() {
    this.pose = 'roar'; this.sfx('bosswarn'); this.teleCircle(this.x, this.y, 150, 1.3); yield 1.3;
    this.sfx('boom'); this.strikeBox(this.x - 150, this.y - 150, 300, 300, 26, 0.2, { kb: 320, unblockable: true }); this.world.shake(10); this.world.flash = 0.25; this.world.fx.ring(this.x, this.y, 10, 150, 0.5, '#c060ff', 4); this.pose = 'idle'; yield 1;
  }
  *afterDefeat() {
    const w = this.world, g = w.game; w.player.locked = true; w.slowT = 0; yield 0.4; let done = false;
    g.systems.dialogue.run(function* (c) {
      yield c.narrate('The Maw does not die. It folds, gently, around the seven pearls in your shell, like a hand closing around a heartbeat.');
      yield c.say('...oh. It is you. Not the king. The one who grew. I was so afraid of being forgotten, I forgot I was a wound. Thank you for remembering me properly.', 'The Hollow Maw');
      yield c.narrate('Your shell sings. Something enormous and old, in the deep of the world, turns over, and for the first time in an age, sleeps without a lock on it.');
    }, null, null, () => { done = true; }); while (!done) yield 0.1;
    g.setFlag('primordial_unlocked'); g.toast('A secret molt awaits at the Apotheosis Shrine.', '#ffffff'); w.player.locked = false;
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const f = enemyFrame(this.key, this.def.sprite, this.pose === 'stagger' ? 'idle' : this.pose, Math.floor(this.t * 5));
    drawFrame(ctx, f, this.x - cam.x, this.y - cam.y, false, this.flash > 0, this.alpha);
  }
}
BOSS_CLASSES.hollow_maw = HollowMaw;
