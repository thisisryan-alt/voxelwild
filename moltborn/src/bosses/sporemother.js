// Mini-boss — the Sporemother of the Glowcap Grotto: a lullaby-humming mound of toadstool. Slow and huge. She lobs spore bombs that
// bloom into poison clouds, snares the floor with roots, and stomps. The fight is about footing: stay out of the clouds.
import { Boss } from '../entities/boss.js';
import '../gfx/sprites_bosses2.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import { drawFrame } from '../entities/entity.js';
import { moveBody } from '../world/physics.js';
import { TS } from '../world/tiles.js';
import { clamp } from '../core/util.js';

export class Sporemother extends Boss {
  static def = {
    key: 'sporemother', name: 'The Sporemother', title: 'Lullaby of the Glowcap Grotto', hp: 380, w: 70, h: 64, armor: 50, xp: 260, music: 'boss2', contact: 10,
    loot: { ep: 2, sp: 1, coins: [100, 140], items: { mut_sporeheart: 1 } },
    phases: [
      { at: 1, name: 'The Sporemother', attacks: [['sporeVolley', 2], ['rootSnare', 2], ['crushStomp', 1.5]], rest: 1.3 },
      { at: 0.5, name: 'Full Bloom', attacks: [['sporeVolley', 1.5], ['rootSnare', 2], ['crushStomp', 1.5], ['broodRain', 1.2], ['sporeStorm', 1.6]], rest: 0.9, onEnter(b) { b.dmgMult = 1.2; } },
    ],
    sprite: { plan: 'sporemother', w: 140, h: 104, ax: 70, ay: 100, frames: 4, o: {} }, fps: 5,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); if (spawn.floor) this.y = spawn.y - this.h / 2 - 0.2; this.intro = this.introTalk; }
  *introTalk(c) {
    yield c.say('Shh. Shhh. The little ones are sleeping. Mind where you put your feet, dear. They are everywhere, and they are very small.', 'The Sporemother');
    yield c.say('Are you here to sing to them? No? Then you are here to wake them. Oh dear. Oh, dear dear dear. Mother will have to ask you to leave. Loudly.', 'The Sporemother');
  }
  physics(dt) { this.vy = Math.min(this.vy + 520 * dt, 300); moveBody(this.world.grid, this, dt, {}); }
  get floorY() { return this.y + this.h / 2; }
  bomb(ang, speed) {
    this.world.addProjectile({ kind: 'spore', team: 'enemy', x: this.x, y: this.y - 24, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, grav: 150, dmg: Math.round(8 * this.dmgMult), life: 2.6, kb: 40, boss: true, cloud: { r: 32, life: 4.2, dps: 4 }, scale: 1.4 });
  }
  // --- attacks -----------------------------------------------------------------------------------------------------------
  *sporeVolley() {
    this.faceTo(this.player.x); this.pose = 'windup'; yield 0.7; this.pose = 'spray';
    const n = this.phaseIdx ? 6 : 4;
    for (let i = 0; i < n; i++) {
      const pl = this.player, dx = pl.x - this.x, sgn = Math.sign(dx) || 1;
      this.bomb(Math.atan2(-0.85, sgn) + (Math.random() - 0.5) * 0.25, clamp(Math.sqrt(152 * Math.abs(dx)), 90, 260)); this.sfx('spore'); yield 0.36;
    }
    yield 0.5; this.pose = 'idle';
  }
  *rootSnare() {
    const pl = this.player, ar = this.arena, fy = (ar.y + ar.h) * TS - 4;
    this.pose = 'windup'; const xs = [pl.x, pl.x - 78, pl.x + 78].map((x) => clamp(x, (ar.x + 4) * TS, (ar.x + ar.w - 4) * TS));
    for (const x of xs) this.teleRect(x - 16, fy - 70, 32, 72, 0.9);
    this.sfx('roar'); yield 0.9; this.pose = 'spray';
    for (const x of xs) { this.strikeBox(x - 14, fy - 70, 28, 72, 14, 0.2, { kb: 200 }); this.world.fx.burst(x, fy - 30, ['#6aa83a', '#386a2a', '#f088c8'], 70, 0.6, 3, { grav: 120 }); }
    this.world.shake(5); this.sfx('boom'); yield 0.9; this.pose = 'idle';
  }
  *crushStomp() {
    const pl = this.player; this.faceTo(pl.x); this.pose = 'windup'; yield 0.5;
    const tx = pl.x; this.teleCircle(tx, this.floorY - 6, 50, 1); this.vy = -330; this.vx = (tx - this.x) * 1.05; this.sfx('swoosh');
    yield 0.4; let t = 0; while (!this.onGround && t < 1.6) { t += 1 / 60; yield 1 / 60; }
    this.vx = 0; this.pose = 'roar'; this.world.shake(9); this.sfx('boom'); this.world.game.hitstop(5);
    this.strikeBox(this.x - 54, this.y - 6, 108, 44, 15, 0.2, { kb: 260 });
    for (const d of [-1, 1]) this.world.addProjectile({ kind: 'shard', team: 'enemy', x: this.x + d * 34, y: this.floorY - 10, vx: d * 170, vy: 0, dmg: 9, life: 1.6, ghost: true, boss: true, trail: '#f088c8', pierce: true });
    this.world.addField({ kind: 'cloud', team: 'enemy', x: this.x, y: this.floorY - 14, r: 40, life: 3.5, dps: 4, pull: 0, poison: 2 });
    yield 0.9; this.pose = 'idle';
  }
  *broodRain() {
    this.pose = 'roar'; this.sfx('roar'); yield 0.5; const ar = this.arena;
    this.summon('fumecap', (ar.x + 8) * TS, this.floorY - 14); this.summon('fumecap', (ar.x + ar.w - 8) * TS, this.floorY - 14);
    yield 1; this.pose = 'idle';
  }
  *sporeStorm() {
    this.pose = 'windup'; const ar = this.arena; yield 0.4; this.pose = 'spray';
    const spots = []; for (let i = 0; i < 5; i++) spots.push((ar.x + 8 + (i + Math.random() * 0.7) * ((ar.w - 16) / 5)) * TS);
    for (const x of spots) this.teleCircle(x, this.floorY - 10, 36, 0.9, { color: '#9aff60' });
    this.sfx('spore'); yield 0.9;
    for (const x of spots) { this.world.addField({ kind: 'cloud', team: 'enemy', x, y: this.floorY - 14, r: 34, life: 4, dps: 4, pull: 0, poison: 2 }); this.world.fx.burst(x, this.floorY - 14, ['#b8ff90', '#e8ffc8'], 40, 0.5, 2); }
    yield 1.2; this.pose = 'idle';
  }
  *afterDefeat() {
    const g = this.world.game, w = this.world; w.player.locked = true; w.slowT = 0; yield 0.4; let done = false;
    for (const f of [...w.fields]) f.life = 0;
    g.systems.dialogue.run(function* (c) {
      yield c.say('...Oh. Sleepy. So sleepy. Do you hear them? The little ones. They have gone quiet. That is the good kind of quiet.', 'The Sporemother');
      yield c.say("Spores keep what the sea forgets, dear. A song. A name. A mother's hands. I kept them warm as long as I could.", 'The Sporemother');
      yield c.say('Take a handful. When you are hurt, they will know what to do. They always do. They are only ever trying to help.', 'The Sporemother');
    }, null, null, () => { done = true; });
    while (!done) yield 0.1;
    w.player.locked = false; g.systems.codex.unlock('sporemother_song');
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const rage = this.phaseIdx > 0, pose = this.pose === 'idle' && Math.abs(this.vx) > 8 ? 'idle' : this.pose;
    const f = enemyFrame(this.key + (rage ? 'R' : ''), { ...this.def.sprite, o: { rage } }, pose, Math.floor(this.t * 5));
    drawFrame(ctx, f, this.x - cam.x, this.y + this.h / 2 - cam.y + 2, false, this.flash > 0, this.alpha);
    this.drawTeles(ctx, cam);
  }
}
BOSS_CLASSES.sporemother = Sporemother;
