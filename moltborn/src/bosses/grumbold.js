// Boss 1 — Grumbold the Rockclaw: a territorial rock-crab. Teaches telegraphs, parries and heavy strikes.
import { Boss } from '../entities/boss.js';
import '../gfx/sprites_bosses.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import { drawFrame } from '../entities/entity.js';
import { moveBody } from '../world/physics.js';
import { TS } from '../world/tiles.js';

export class Grumbold extends Boss {
  static def = {
    key: 'grumbold', name: 'Grumbold the Rockclaw', title: 'Tyrant of the Kelp Hollow', hp: 200, w: 54, h: 34, armor: 70, xp: 160, music: 'boss1', contact: 10, npc: 'grumbold',
    loot: { ep: 5, sp: 1, coins: [60, 80], items: { brine_core: 1 } },
    phases: [
      { at: 1, name: 'The Rockclaw', attacks: [['swipe', 2], ['rockToss', 2], ['charge', 1.6]], rest: 1.2 },
      { at: 0.5, name: 'Rockbreaker Rage', attacks: [['swipe', 2], ['rockToss', 1], ['charge', 2], ['leapSlam', 2.2], ['summonMinions', 0.7]], rest: 0.8, onEnter(b) { b.dmgMult = 1.25; } },
    ],
    sprite: { plan: 'grumbold', w: 128, h: 90, ax: 64, ay: 84, frames: 4, o: {} }, fps: 8,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); if (spawn.floor) this.y = spawn.y - this.h / 2 - 0.2; this.intro = this.introTalk; this.idle = 0; }
  *introTalk(c) {
    yield c.say('RRRGH. Little thing. Little LITTLE thing. This is my reef. MINE. I carried every shiny rock in it with my own claws!', 'Grumbold');
    yield c.say("You've got the look of a hatchling from the nursery. They were supposed to be... gone. The Tithe-boats took... took... oh, never mind. Get out of my hollow!", 'Grumbold');
  }
  physics(dt) { this.vy = Math.min(this.vy + 520 * dt, 300); moveBody(this.world.grid, this, dt, {}); }
  get floorY() { return this.y + this.h / 2; }
  // --- attacks ---------------------------------------------------------------------------------------------------
  *swipe() {
    const pl = this.player; this.faceTo(pl.x); this.pose = 'windup'; const d = this.facing;
    const x = d > 0 ? this.x + 10 : this.x - 10 - 78;
    this.teleRect(x, this.y - 26, 78, 52, 0.75);
    yield 0.75; this.pose = 'swipe'; this.strikeBox(x, this.y - 26, 78, 52, 13, 0.2, { kb: 200 }); this.sfx('heavy'); this.world.shake(3); this.world.fx.foam(this.x + d * 40, this.y, d, 8);
    yield 0.55;
  }
  *rockToss() {
    this.faceTo(this.player.x); this.pose = 'toss'; yield 0.55;
    const n = this.phaseIdx ? 4 : 3;
    for (let i = 0; i < n; i++) { this.faceTo(this.player.x); const dx = this.player.x - this.x; this.shootDir('cannonball', 9, Math.atan2(-0.9, Math.sign(dx)) + (i - (n - 1) / 2) * 0.12, 120 + Math.abs(dx) * 0.4, { x: this.x + this.facing * 24, y: this.y - 22, grav: 190, life: 3, trail: '#8a7c50' }); this.sfx('shoot'); yield 0.28; }
    yield 0.4;
  }
  *charge() {
    const pl = this.player, ar = this.arena; this.faceTo(pl.x); this.pose = 'windup'; const d = this.facing;
    const far = d > 0 ? (ar.x + ar.w - 3) * TS : (ar.x + 3) * TS, x0 = Math.min(this.x, far), w = Math.abs(far - this.x);
    this.teleRect(x0, this.y + this.h / 2 - 28, w, 28, 0.85, { fill: 'h' });
    yield 0.85; this.pose = 'charge'; this.contactMult = 1.5; this.sfx('swoosh'); let t = 0;
    while (t < 1.8) { this.vx = d * (230 + this.phaseIdx * 40); this.sfxStep ??= 0; if (this.hitX) break; t += 1 / 60; if (Math.random() < 0.3) this.world.fx.add({ x: this.x - d * 20, y: this.y + 14, vx: -d * 20, vy: -20, life: 0.4, size: 2, color: '#f6d9a6', shrink: true }); yield 1 / 60; }
    this.vx = 0; this.contactMult = 1;
    if (this.hitX) { this.world.shake(8); this.sfx('boom'); this.world.game.hitstop(6); this.pose = 'stagger'; for (let i = 0; i < 4; i++) this.world.addProjectile({ kind: 'cannonball', team: 'enemy', x: (this.arena.x + 6 + Math.random() * (this.arena.w - 12)) * TS, y: (this.arena.y + 1) * TS, vx: 0, vy: 30, dmg: 9, grav: 260, life: 3, boss: true }); this.hitX = 0; yield 1.4; }
    else yield 0.5;
  }
  *leapSlam() {
    const pl = this.player; this.pose = 'windup'; this.faceTo(pl.x); yield 0.45;
    const tx = pl.x; this.teleCircle(tx, this.floorY - 4, 44, 0.9); this.vy = -360; this.vx = (tx - this.x) * 1.15; this.pose = 'roar'; this.sfx('swoosh');
    yield 0.35; let t = 0; while (!this.onGround && t < 1.4) { this.vx *= 0.99; t += 1 / 60; yield 1 / 60; }
    this.vx = 0; this.pose = 'slam'; this.world.shake(9); this.sfx('boom'); this.world.game.hitstop(5);
    this.strikeBox(this.x - 46, this.y - 10, 92, 40, 14, 0.2, { kb: 260 });
    for (const d of [-1, 1]) this.world.addProjectile({ kind: 'shard', team: 'enemy', x: this.x + d * 30, y: this.y + 12, vx: d * 170, vy: 0, dmg: 9, life: 1.6, ghost: true, boss: true, trail: '#f6d9a6', pierce: true });
    yield 0.8;
  }
  *summonMinions() {
    this.pose = 'roar'; this.sfx('roar'); yield 0.5;
    const ar = this.arena; this.summon('pinchling', (ar.x + 6) * TS, this.y); this.summon('pinchling', (ar.x + ar.w - 6) * TS, this.y);
    yield 0.9;
  }
  *afterDefeat() {
    const g = this.world.game, w = this.world; w.player.locked = true; w.slowT = 0;
    yield 0.4;
    let done = false;
    g.systems.dialogue.run(function* (c) {
      yield c.say('...Told you. Told you it was mine.', 'Grumbold');
      yield c.say("The shiny rock. The pink one. It fell off a Tithe-boat, I swear. I thought it was a gift. It was warm, and it hummed, and it hummed like... like somebody I used to know.", 'Grumbold');
      yield c.say("Take it. It was never mine. Neither was the reef. I only kept it warm.", 'Grumbold');
    }, null, null, () => { done = true; });
    while (!done) yield 0.1;
    w.player.locked = false;
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const pose = this.pose === 'idle' && Math.abs(this.vx) > 8 ? 'walk' : this.pose, rage = this.phaseIdx > 0;
    const f = enemyFrame(this.key + (rage ? 'R' : ''), { ...this.def.sprite, o: { rage } }, pose, Math.floor(this.t * 8));
    let flip = this.facing < 0 !== false;
    const st = this.staggerT > 0 && Math.floor(this.t * 20) % 2; 
    drawFrame(ctx, f, this.x - cam.x, this.y + this.h / 2 - cam.y + 4, this.facing < 0, this.flash > 0, this.alpha);
    this.drawTeles(ctx, cam);
  }
}
BOSS_CLASSES.grumbold = Grumbold;
