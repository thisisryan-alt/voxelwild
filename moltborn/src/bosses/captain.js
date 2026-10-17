// Boss 4 — Captain Rust: the drowned captain of the Gannet. Anchor sweeps, ghost crew, cannon broadsides.
import { Boss } from '../entities/boss.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import '../gfx/sprites_bosses.js';
import { drawFrame } from '../entities/entity.js';
import { clamp } from '../core/util.js';
import { TS } from '../world/tiles.js';

export class CaptainRust extends Boss {
  static def = {
    key: 'captain_rust', name: 'Captain Rust', title: 'Drowned Master of the Gannet', hp: 1400, w: 32, h: 50, armor: 90, xp: 700, music: 'boss4', contact: 15, flying: true, ghost: true,
    loot: { ep: 4, sp: 2, coins: [200, 280], items: { abyssal_core: 1 } },
    phases: [
      { at: 1, name: 'All Hands', attacks: [['anchorSwing', 2], ['anchorSlam', 2], ['ghostCrew', 1]], rest: 1.1 },
      { at: 0.6, name: 'Broadside!', attacks: [['anchorSwing', 2], ['anchorSlam', 1.6], ['ghostCrew', 1], ['broadside', 2.2]], rest: 0.9, onEnter(b) { b.dmgMult = 1.2; } },
      { at: 0.28, name: 'Dead Reckoning', attacks: [['anchorSwing', 2], ['anchorSlam', 2], ['broadside', 2], ['ghostLantern', 2]], rest: 0.6, onEnter(b) { b.dmgMult = 1.35; b.world.darkMul = 1; } },
    ],
    sprite: { plan: 'captain', w: 120, h: 112, ax: 60, ay: 52, frames: 4, o: {} }, fps: 5,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); this.intro = this.introTalk; }
  *introTalk(c) {
    yield c.say('Who goes there? State your ship and your cargo.', 'Captain Rust');
    yield c.say('...No ship. No cargo. Hm. A stowaway. The Gannet does not carry stowaways. Hands to the deck! All hands!', 'Captain Rust');
  }
  physics(dt) { this.flyPhysics(dt); }
  *anchorSwing() {
    const pl = this.player, a = this.arena; this.faceTo(pl.x);
    yield* this.moveTo(clamp(pl.x - this.facing * 100, (a.x + 5) * TS, (a.x + a.w - 5) * TS), clamp(pl.y - 4, (a.y + 8) * TS, (a.y + a.h - 8) * TS), 220, 1.4); this.faceTo(pl.x);
    const d = this.facing; this.pose = 'windup'; const x0 = d > 0 ? this.x : this.x - 110; this.teleRect(x0, this.y - 30, 110, 60, 0.8); yield 0.8;
    this.pose = 'swing'; this.sfx('heavy'); this.strikeBox(x0, this.y - 30, 110, 60, 18, 0.2, { kb: 220 }); this.world.shake(4); yield 0.5;
    if (this.phaseIdx) { this.faceTo(this.player.x); const d2 = this.facing; const x1 = d2 > 0 ? this.x : this.x - 110; this.teleRect(x1, this.y - 30, 110, 60, 0.45); this.pose = 'windup'; yield 0.45; this.pose = 'swing'; this.strikeBox(x1, this.y - 30, 110, 60, 18, 0.2, { kb: 220 }); this.sfx('heavy'); yield 0.4; }
  }
  *anchorSlam() {
    const a = this.arena, pl = this.player; this.pose = 'windup'; yield* this.moveTo(clamp(pl.x, (a.x + 5) * TS, (a.x + a.w - 5) * TS), (a.y + 8) * TS, 260, 1.2);
    const tx = this.x, floorY = (a.y + a.h - 6) * TS; this.teleRect(tx - 22, floorY - 90, 44, 92, 0.85); yield 0.85;
    this.pose = 'slam'; this.vy = 520; this.sfx('swoosh'); let t = 0; while (this.y < floorY - 30 && t < 1) { t += 1 / 60; yield 1 / 60; } this.vy = 0;
    this.world.shake(8); this.sfx('boom'); this.world.game.hitstop(5); this.strikeBox(this.x - 26, this.y - 10, 52, 60, 20, 0.2, { kb: 240 });
    for (const d of [-1, 1]) this.world.addProjectile({ kind: 'shard', team: 'enemy', x: this.x + d * 20, y: floorY - 6, vx: d * 170, vy: 0, dmg: Math.round(12 * this.dmgMult), life: 1.8, ghost: true, pierce: true, boss: true, trail: '#7affff' });
    yield 0.9; yield* this.moveTo(this.x, (a.y + 14) * TS, 200, 1);
  }
  *ghostCrew() {
    this.pose = 'roar'; this.sfx('roar'); yield 0.6; const a = this.arena;
    this.summon('ghostsailor', (a.x + 8) * TS, (a.y + 20) * TS); this.summon('ghostsailor', (a.x + a.w - 8) * TS, (a.y + 20) * TS); yield 1;
  }
  *broadside() {
    const a = this.arena, fromLeft = Math.random() < 0.5; this.pose = 'roar'; this.sfx('bosswarn');
    const rows = [a.y + 12, a.y + 19, a.y + 26].map((r) => r * TS), skip = Math.floor(Math.random() * 3);
    rows.forEach((y, i) => { if (i !== skip) this.teleRect((a.x + 1) * TS, y - 9, (a.w - 2) * TS, 18, 1.2, { fill: 'h' }); });
    yield 1.2;
    rows.forEach((y, i) => { if (i === skip) return; this.sfx('cannon'); this.world.addProjectile({ kind: 'cannonball', team: 'enemy', x: (fromLeft ? a.x + 1 : a.x + a.w - 1) * TS, y, vx: fromLeft ? 260 : -260, vy: 0, dmg: Math.round(16 * this.dmgMult), life: 4, boss: true, ghost: true, pierce: true, scale: 1.6 }); });
    this.world.shake(5); yield 1.2;
  }
  *ghostLantern() {
    this.pose = 'roar'; this.sfx('roar'); const w = this.world; w.darkMul = 1.3; yield 0.5;
    for (let i = 0; i < 6; i++) { this.shootDir('fire', 10, (i / 6) * 6.283, 70, { homing: 2.2, life: 3.5, ghost: true, trail: '#9affff' }); yield 0.18; }
    yield 1.4; w.darkMul = 1;
  }
  *afterDefeat() {
    const w = this.world, g = w.game; w.player.locked = true; w.slowT = 0; w.darkMul = 1; yield 0.3; let done = false;
    g.systems.dialogue.run(function* (c) {
      yield c.say('...The tide has gone slack. I can hear the harbour bell. It was always so close.', 'Captain Rust');
      yield c.say('We prayed to him, you know. The sea-god. We never wanted a kingdom, only a fair wind. He answered us with a wave. He was crying, I think. I could never tell with all the water.', 'Captain Rust');
      yield c.say('Take the heart of my anchor. It is the weight of three hundred and eleven prayers. If you mean to go down to where he keeps his secrets... go with a clean conscience. It is lighter.', 'Captain Rust');
    }, null, null, () => { done = true; }); while (!done) yield 0.1; w.player.locked = false;
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const rage = this.phaseIdx > 1, f = enemyFrame(this.key + (rage ? 'R' : ''), { ...this.def.sprite, o: { rage } }, this.pose === 'toss' || this.pose === 'stagger' ? 'idle' : this.pose, Math.floor(this.t * 5));
    drawFrame(ctx, f, this.x - cam.x, this.y - cam.y, this.facing < 0, this.flash > 0, this.alpha);
    this.drawTeles(ctx, cam);
  }
}
BOSS_CLASSES.captain_rust = CaptainRust;
