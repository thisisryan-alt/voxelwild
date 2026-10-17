// Mini-boss — Brun, the Hermit King of the Sunken Tidepools: a soft crab in a stolen palace of a shell. He smashes, rolls
// the whole palace across the floor, and bursts out of it in a ring of shards. Rolling into a wall leaves him dazed.
import { Boss } from '../entities/boss.js';
import '../gfx/sprites_bosses2.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import { drawFrame } from '../entities/entity.js';
import { moveBody } from '../world/physics.js';
import { TS } from '../world/tiles.js';

export class HermitKing extends Boss {
  static def = {
    key: 'hermit_king', name: 'Brun, the Hermit King', title: 'Monarch of the Tidepools', hp: 340, w: 56, h: 40, armor: 55, xp: 240, music: 'boss1', contact: 11,
    loot: { ep: 2, sp: 1, coins: [90, 130], items: { shell_hermitking: 1 } },
    phases: [
      { at: 1, name: 'The Hermit King', attacks: [['clawSmash', 2], ['shellRoll', 1.6], ['callCourt', 1]], rest: 1.2 },
      { at: 0.5, name: 'Palace Aflame', attacks: [['clawSmash', 2], ['shellRoll', 2], ['shellBurst', 1.8], ['callCourt', 0.8]], rest: 0.85, onEnter(b) { b.dmgMult = 1.25; } },
    ],
    sprite: { plan: 'hermitking', w: 150, h: 100, ax: 62, ay: 88, frames: 4, o: {} }, fps: 8,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); if (spawn.floor) this.y = spawn.y - this.h / 2 - 0.2; this.intro = this.introTalk; }
  *introTalk(c) {
    yield c.say('KNEEL! ...No? Hm. A crab. In MY pools. I am Brun the First, Second, and Only, and this is my palace. Observe the crown. It is very nearly real.', 'Brun');
    yield c.say('I found the shell on the beach. It was sitting right there, humming. Finders keepers. Kings keepers. Now: bow, or be counted among the barnacles!', 'Brun');
  }
  physics(dt) { this.vy = Math.min(this.vy + 520 * dt, 300); moveBody(this.world.grid, this, dt, {}); }
  get floorY() { return this.y + this.h / 2; }
  // armoured while hiding in the shell; softer while dazed
  takeHit(hit, pl) {
    if (this.pose === 'hide' || this.pose === 'spin') { hit = { ...hit, dmg: hit.dmg * 0.2 }; this.sfx('clang'); }
    else if (this.pose === 'stagger') hit = { ...hit, dmg: hit.dmg * 1.3 };
    return super.takeHit(hit, pl);
  }
  // --- attacks ------------------------------------------------------------------------------------------------------------
  *clawSmash() {
    const n = this.phaseIdx ? 2 : 1;
    for (let k = 0; k < n; k++) {
      yield* this.approach(70, 150);
      this.faceTo(this.player.x); this.pose = 'windup'; const d = this.facing, x = d > 0 ? this.x + 8 : this.x - 8 - 84;
      this.teleRect(x, this.y - 28, 84, 56, 0.7); yield 0.7;
      this.pose = 'smash'; this.strikeBox(x, this.y - 28, 84, 56, 14, 0.2, { kb: 210 }); this.sfx('heavy'); this.world.shake(4); this.world.fx.groundWave(this.x + d * 46, this.floorY, 10, 90);
      yield 0.5;
    }
  }
  *shellRoll() {
    const pl = this.player, ar = this.arena; this.faceTo(pl.x); this.pose = 'hide'; const d = this.facing;
    const far = d > 0 ? (ar.x + ar.w - 3) * TS : (ar.x + 3) * TS, x0 = Math.min(this.x, far), w = Math.abs(far - this.x);
    this.teleRect(x0, this.floorY - 36, w, 36, 0.85, { fill: 'h' }); yield 0.85;
    this.pose = 'spin'; this.contactMult = 1.5; this.sfx('swoosh'); let t = 0;
    while (t < 2) { this.vx = d * (250 + this.phaseIdx * 50); if (this.hitX) break; t += 1 / 60; if (Math.random() < 0.4) this.world.fx.add({ x: this.x - d * 24, y: this.floorY - 4, vx: -d * 20, vy: -20, life: 0.4, size: 2, color: '#f6d9a6', shrink: true }); yield 1 / 60; }
    this.vx = 0; this.contactMult = 1;
    if (this.hitX) { this.world.shake(8); this.sfx('boom'); this.world.game.hitstop(6); this.pose = 'stagger'; this.hitX = 0; this.world.fx.burst(this.x + d * 30, this.y, ['#ffd84a', '#f09ab8', '#ffffff'], 90, 0.5, 3);
      const a = this.arena; for (let i = 0; i < 3; i++) this.world.addProjectile({ kind: 'cannonball', team: 'enemy', x: (a.x + 6 + Math.random() * (a.w - 12)) * TS, y: (a.y + 1) * TS, vx: 0, vy: 30, dmg: 9, grav: 260, life: 3, boss: true });
      yield 1.5; }
    else { this.pose = 'idle'; yield 0.4; }
  }
  *shellBurst() {
    this.pose = 'hide'; this.world.fx.ring(this.x, this.y, 4, 60, 0.7, '#ffd84a', 2); this.teleCircle(this.x, this.y, 74, 0.9); yield 0.9;
    this.pose = 'roar'; this.sfx('boom'); this.world.shake(7);
    this.strikeBox(this.x - 74, this.y - 54, 148, 100, 13, 0.2, { kb: 240 });
    const n = 12; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.shootDir('shard', 9, a, 150, { ghost: true, trail: '#f09ab8', life: 1.8 }); }
    yield 1.1;
  }
  *callCourt() {
    this.pose = 'roar'; this.sfx('roar'); yield 0.5; const ar = this.arena;
    this.summon('pinchling', (ar.x + 6) * TS, this.y); this.summon('pinchling', (ar.x + ar.w - 6) * TS, this.y);
    if (this.phaseIdx) this.summon('hermit', (ar.x + ar.w / 2) * TS, this.y - 20);
    yield 0.9;
  }
  *afterDefeat() {
    const g = this.world.game, w = this.world; w.player.locked = true; w.slowT = 0; yield 0.4; let done = false;
    g.systems.dialogue.run(function* (c) {
      yield c.say('...Ah. Off with the crown, then. It was only coral. I glued it on myself.', 'Brun');
      yield c.say('The shell, though. Listen to it. Hold it to where an ear would be, if I had one. There is a lullaby in there, and it is not mine. It never was.', 'Brun');
      yield c.say("Take the palace. It is very heavy and it is full of someone else's song. Tell Brack the census is — no. Tell him the barnacles are fine.", 'Brun');
    }, null, null, () => { done = true; });
    while (!done) yield 0.1;
    w.player.locked = false; g.systems.codex.unlock('brun_crown');
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const pose = this.pose === 'idle' && Math.abs(this.vx) > 8 ? 'walk' : this.pose, rage = this.phaseIdx > 0;
    const f = enemyFrame(this.key + (rage ? 'R' : ''), { ...this.def.sprite, o: { rage } }, pose, Math.floor(this.t * 8));
    drawFrame(ctx, f, this.x - cam.x, this.y + this.h / 2 - cam.y + 2, this.facing < 0, this.flash > 0, this.alpha);
    this.drawTeles(ctx, cam);
  }
}
BOSS_CLASSES.hermit_king = HermitKing;
