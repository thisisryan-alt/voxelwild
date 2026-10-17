// Optional mini-boss — the Pearl Tyrant: a grumpy giant clam. Only vulnerable while its shell is open.
import { Boss } from '../entities/boss.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import '../gfx/sprites_bosses.js';
import { drawFrame } from '../entities/entity.js';
import { moveBody } from '../world/physics.js';
import { clamp } from '../core/util.js';
import { TS } from '../world/tiles.js';

export class PearlTyrant extends Boss {
  static def = {
    key: 'pearl_tyrant', name: 'The Pearl Tyrant', title: 'Glutton Beneath the Garden', hp: 520, w: 96, h: 52, armor: 0, xp: 220, music: 'boss1', contact: 12,
    loot: { ep: 2, sp: 1, black_pearl: 2, coins: [80, 120], items: { dye_albino: 1, mut_barbed: 1 } },
    phases: [
      { at: 1, name: 'The Tyrant', attacks: [['pearlSpray', 2], ['shellSlam', 2], ['suck', 1.2]], rest: 1.2 },
      { at: 0.5, name: 'Pearl Rage', attacks: [['pearlSpray', 2], ['shellSlam', 2], ['suck', 1.5]], rest: 0.8, onEnter(b) { b.dmgMult = 1.3; } },
    ],
    sprite: { plan: 'tyrant', w: 120, h: 100, ax: 60, ay: 62, frames: 2, o: {} }, fps: 3,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); if (spawn.floor) this.y = spawn.y - this.h / 2 - 0.2; this.intro = this.introTalk; }
  *introTalk(c) { yield c.say('MY pearl. MINE. It was a very good pearl and I ate it fair and square. The little fish dropped it. That is how dropping works!', 'The Pearl Tyrant'); }
  physics(dt) { this.vy = Math.min(this.vy + 600 * dt, 300); moveBody(this.world.grid, this, dt, {}); }
  takeHit(hit, pl) { if (this.pose !== 'open' && this.pose !== 'spray') hit = { ...hit, dmg: hit.dmg * 0.25 }; return super.takeHit(hit, pl); }
  get floorY() { return this.y + this.h / 2; }
  *pearlSpray() {
    this.pose = 'open'; this.sfx('roar'); yield 0.8; const n = this.phaseIdx ? 9 : 6;
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.28 + (Math.random() - 0.5) * 0.1; this.shootDir('pearl', 10, a, 190, { x: this.x, y: this.y - 20, grav: 200, life: 2.6, trail: '#ffd8f0' }); yield 0.12; }
    yield 1.3; this.pose = 'idle';
  }
  *shellSlam() { this.pose = 'idle'; this.teleCircle(this.x, this.floorY - 8, 90, 0.9); yield 0.9; this.pose = 'slam'; this.world.shake(7); this.sfx('boom'); this.strikeBox(this.x - 90, this.floorY - 40, 180, 50, 16, 0.2, { kb: 230 }); for (const d of [-1, 1]) this.world.addProjectile({ kind: 'shard', team: 'enemy', x: this.x + d * 40, y: this.floorY - 8, vx: d * 180, vy: 0, dmg: Math.round(11 * this.dmgMult), life: 1.5, ghost: true, boss: true, pierce: true }); yield 0.7; this.pose = 'idle'; }
  *suck() {
    this.pose = 'open'; this.sfx('whirl'); const w = this.world, pl = this.player, area = { kind: 'current', x: (this.x - 200), y: this.y - 120, w: 400, h: 200, vx: 0, vy: 0 }; w.zone.areas.push(area); let t = 0;
    while (t < 1.8) { area.vx = Math.sign(this.x - pl.x) * 90; area.vy = 0; t += 1 / 60; yield 1 / 60; }
    w.zone.areas.splice(w.zone.areas.indexOf(area), 1); this.pose = 'slam'; this.strikeBox(this.x - 60, this.y - 50, 120, 90, 18, 0.2, { kb: 240 }); this.sfx('boom'); yield 0.8; this.pose = 'idle';
  }
  *afterDefeat() {
    const w = this.world, g = w.game; w.player.locked = true; w.slowT = 0; yield 0.3; let done = false;
    g.systems.dialogue.run(function* (c) { yield c.say('...Fine. FINE. Take the stupid pearl. It was never that tasty.', 'The Pearl Tyrant'); }, null, null, () => { done = true; }); while (!done) yield 0.1; w.player.locked = false;
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const f = enemyFrame(this.key, this.def.sprite, this.pose === 'stagger' ? 'idle' : this.pose, Math.floor(this.t * 3));
    drawFrame(ctx, f, this.x - cam.x, this.y - cam.y, false, this.flash > 0, this.alpha);
  }
}
BOSS_CLASSES.pearl_tyrant = PearlTyrant;
