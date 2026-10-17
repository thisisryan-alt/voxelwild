// Mini-boss — the Brass Colossus, guardian of the Court's strongroom: a gilded hollow giant with a pillar for a trident.
// Slow, heavy, telegraphed. Charging into a wall staggers it; in its second phase the alarm sounds and spears rain from the ceiling.
import { Boss } from '../entities/boss.js';
import '../gfx/sprites_bosses2.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import { drawFrame } from '../entities/entity.js';
import { moveBody } from '../world/physics.js';
import { TS } from '../world/tiles.js';
import { clamp } from '../core/util.js';

export class BrassColossus extends Boss {
  static def = {
    key: 'brass_colossus', name: 'The Brass Colossus', title: 'Warden of the Pearl Vaults', hp: 700, w: 56, h: 100, armor: 100, xp: 420, music: 'boss3', contact: 14,
    loot: { ep: 3, sp: 1, coins: [140, 200], items: { shell_brass: 1 } },
    phases: [
      { at: 1, name: 'Vault Guardian', attacks: [['tridentThrust', 2], ['groundPound', 1.6], ['shoulderCharge', 1.6]], rest: 1.3 },
      { at: 0.5, name: 'Alarm Sounded', attacks: [['tridentThrust', 1.6], ['groundPound', 1.4], ['shoulderCharge', 1.6], ['lanceRain', 1.8], ['coreBeam', 1.5]], rest: 0.9, onEnter(b) { b.dmgMult = 1.25; } },
    ],
    sprite: { plan: 'colossus', w: 120, h: 128, ax: 60, ay: 120, frames: 4, o: {} }, fps: 6,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); if (spawn.floor) this.y = spawn.y - this.h / 2 - 0.2; this.intro = this.introTalk; }
  *introTalk(c) {
    yield c.say('VAULT ACCESS: DENIED. Visitor identified: UNREGISTERED. Tithe balance: ZERO. Reason for visit: ...none stated.', 'The Brass Colossus');
    yield c.say('Protocol requires that all intruders be preserved. Please remain very still while I preserve you. Preservation may be loud.', 'The Brass Colossus');
  }
  physics(dt) { this.vy = Math.min(this.vy + 560 * dt, 320); moveBody(this.world.grid, this, dt, {}); }
  get floorY() { return this.y + this.h / 2; }
  // --- attacks ------------------------------------------------------------------------------------------------------------------
  *tridentThrust() {
    yield* this.approach(100, 110);
    const pl = this.player; this.faceTo(pl.x); this.pose = 'windup'; const d = this.facing, x = d > 0 ? this.x + 14 : this.x - 14 - 120;
    this.teleRect(x, this.floorY - 70, 120, 32, 0.8); yield 0.8;
    this.pose = 'slam'; this.strikeBox(x, this.floorY - 70, 120, 32, 15, 0.22, { kb: 220 }); this.sfx('heavy'); this.world.shake(4);
    for (let i = 0; i < 5; i++) this.world.fx.add({ x: this.x + d * (30 + i * 20), y: this.floorY - 54, vx: d * 120, vy: 0, life: 0.25, size: 2, color: '#fff2a0', shrink: true });
    yield 0.6; this.pose = 'idle';
  }
  *groundPound() {
    yield* this.approach(70, 110);
    this.pose = 'windup'; this.teleCircle(this.x, this.floorY - 6, 90, 0.9); yield 0.9;
    this.pose = 'slam'; this.world.shake(9); this.sfx('boom'); this.world.game.hitstop(5);
    this.strikeBox(this.x - 92, this.floorY - 36, 184, 40, 16, 0.2, { kb: 270 });
    for (const d of [-1, 1]) this.world.addProjectile({ kind: 'shard', team: 'enemy', x: this.x + d * 40, y: this.floorY - 10, vx: d * 190, vy: 0, dmg: Math.round(10 * this.dmgMult), life: 1.7, ghost: true, boss: true, trail: '#ffd84a', pierce: true });
    this.world.fx.groundWave(this.x, this.floorY, 22, 150);
    yield 1; this.pose = 'idle';
  }
  *shoulderCharge() {
    const pl = this.player, ar = this.arena; this.faceTo(pl.x); this.pose = 'windup'; const d = this.facing;
    const far = d > 0 ? (ar.x + ar.w - 4) * TS : (ar.x + 4) * TS, x0 = Math.min(this.x, far), w = Math.abs(far - this.x);
    this.teleRect(x0, this.floorY - 70, w, 70, 0.9, { fill: 'h' }); yield 0.9;
    this.pose = 'walk'; this.contactMult = 1.5; this.sfx('swoosh'); let t = 0;
    while (t < 2) { this.vx = d * (200 + this.phaseIdx * 40); if (this.hitX) break; t += 1 / 60; if (Math.random() < 0.3) this.world.fx.add({ x: this.x - d * 20, y: this.floorY - 4, vx: -d * 20, vy: -20, life: 0.4, size: 2, color: '#f6d9a6', shrink: true }); yield 1 / 60; }
    this.vx = 0; this.contactMult = 1;
    if (this.hitX) { this.hitX = 0; this.world.shake(9); this.sfx('boom'); this.world.game.hitstop(6); this.pose = 'stagger'; this.world.fx.burst(this.x + d * 30, this.y, ['#ffd84a', '#fff2a0', '#ffffff'], 100, 0.5, 3); yield 1.7; }
    else { this.pose = 'idle'; yield 0.4; }
  }
  *lanceRain() {
    this.pose = 'windup'; this.sfx('roar'); const ar = this.arena, pl = this.player; yield 0.4;
    const xs = []; for (let i = 0; i < 6; i++) xs.push(clamp(pl.x + (i - 2.5) * 52 + (Math.random() - 0.5) * 24, (ar.x + 3) * TS, (ar.x + ar.w - 3) * TS));
    xs.forEach((x, i) => this.teleRect(x - 8, (ar.y + 1) * TS, 16, this.floorY - (ar.y + 1) * TS, 0.7 + i * 0.12, { color: '#ffd84a' }));
    for (let i = 0; i < xs.length; i++) { yield 0.12; this.world.fx.ring(xs[i], (ar.y + 2) * TS, 2, 12, 0.3, '#ffd84a', 1); }
    yield 0.45;
    for (const x of xs) { this.world.addProjectile({ kind: 'trident', team: 'enemy', x, y: (ar.y + 1) * TS, vx: 0, vy: 230, dmg: Math.round(11 * this.dmgMult), life: 2, boss: true, ghost: false, trail: '#ffe65a' }); }
    yield 1.1; this.pose = 'idle';
  }
  *coreBeam() {
    const pl = this.player; this.faceTo(pl.x); this.pose = 'windup'; const d = this.facing, ar = this.arena;
    const y = clamp(pl.y, this.floorY - 120, this.floorY - 20), L = Math.abs((d > 0 ? (ar.x + ar.w) * TS : ar.x * TS) - this.x), x0 = d > 0 ? this.x : this.x - L;
    this.teleRect(x0, y - 14, L, 28, 1.1, { fill: 'h', color: '#9af0e0' }); this.world.fx.ring(this.x, this.y - 10, 20, 4, 1.1, '#9af0e0', 2); this.sfx('charge'); yield 1.1;
    this.pose = 'slam'; this.strikeBox(x0, y - 14, L, 28, 18, 0.35, { kb: 240, unblockable: true }); this.world.addBeam({ x: this.x, y, dir: d, len: L, life: 0.35, color: '#d0ffff' }); this.sfx('beam'); this.world.shake(6);
    yield 0.9; this.pose = 'idle';
  }
  *afterDefeat() {
    const g = this.world.game, w = this.world; w.player.locked = true; w.slowT = 0; yield 0.4; let done = false;
    g.systems.dialogue.run(function* (c) {
      yield c.say('INVENTORY... COMPLETE. All drawers accounted for. All drawers... empty. Visitor, I have a question. Where is the Court?', 'The Brass Colossus');
      yield c.say('I was told to guard the treasure until the war ended. Nobody told me the war ended. I think... it ended a long time ago. I think I have been guarding an empty room.', 'The Brass Colossus');
      yield c.say('Take the plating. It is only brass. It has never been needed. Tell the archivist the last drawer is open. He will know what I mean. He always knew.', 'The Brass Colossus');
    }, null, null, () => { done = true; });
    while (!done) yield 0.1;
    w.player.locked = false; g.systems.codex.unlock('colossus_log');
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const pose = this.pose === 'idle' && Math.abs(this.vx) > 8 ? 'walk' : this.pose, rage = this.phaseIdx > 0;
    const f = enemyFrame(this.key + (rage ? 'R' : ''), { ...this.def.sprite, o: { rage } }, pose, Math.floor(this.t * 6));
    drawFrame(ctx, f, this.x - cam.x, this.y + this.h / 2 - cam.y + 2, this.facing < 0, this.flash > 0, this.alpha);
    this.drawTeles(ctx, cam);
  }
}
BOSS_CLASSES.brass_colossus = BrassColossus;
