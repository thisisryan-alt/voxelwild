// Boss 3 — Queen Aurelia, the Coral Regent: a corrupted queen. Can be defeated — or redeemed with the Tithe Ledger.
import { Boss } from '../entities/boss.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import '../gfx/sprites_bosses.js';
import { drawFrame } from '../entities/entity.js';
import { Script, TAU, clamp } from '../core/util.js';
import { TS } from '../world/tiles.js';

export class Aurelia extends Boss {
  static def = {
    key: 'aurelia', name: 'Queen Aurelia', title: 'The Coral Regent', hp: 1200, w: 34, h: 54, armor: 80, xp: 520, music: 'boss3', contact: 14, flying: true, ghost: true,
    loot: { ep: 4, sp: 2, coins: [160, 220], items: { claw_coral: 1 } },
    phases: [
      { at: 1, name: 'The Regent', attacks: [['pearlBarrage', 2], ['scepterThrust', 2], ['coralSpires', 2]], rest: 1.1 },
      { at: 0.5, name: 'Royal Command', attacks: [['pearlBarrage', 1.5], ['scepterThrust', 1.5], ['coralSpires', 1.5], ['royalCommand', 1.2], ['tidalDecree', 1.6]], rest: 0.85, onEnter(b) { b.dmgMult = 1.2; b.redeemCheck(); } },
      { at: 0.22, name: 'The Voice Below', attacks: [['pearlBarrage', 2], ['scepterThrust', 1.5], ['coralSpires', 1.4], ['tidalDecree', 1.8], ['spiralStorm', 2]], rest: 0.6, onEnter(b) { b.dmgMult = 1.35; } },
    ],
    sprite: { plan: 'aurelia', w: 112, h: 112, ax: 56, ay: 58, frames: 4, o: {} }, fps: 6,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); this.orbit = 0; this.orbitA = 0; this.intro = this.introTalk; this.redeemed = false; }
  *introTalk(c) {
    yield c.say('You come to my court with mud on your claws, little crab. I do not receive the unfinished.', 'Queen Aurelia');
    yield c.say('Forgive me. That was not me. That was... louder than me. He speaks through the pearl in my crown. He says you are the thing he has been waiting for.', 'Queen Aurelia');
    yield c.say('Strike me down, if you can. It is the only mercy left in the sea.', 'Queen Aurelia');
  }
  physics(dt) { this.flyPhysics(dt); this.y += Math.sin(this.t * 2) * 0.1; this.orbitA += dt * 3; }
  idleAnim() {}
  // ---- redemption ----------------------------------------------------------------------------------------------
  redeemCheck() {
    const g = this.world.game; if (!(g.flag('ledger_used') || g.hasItem('tithe_ledger'))) return;
    this.script = new Script(this.redeemScene());
  }
  *redeemScene() {
    const g = this.world.game, self = this; this.vx = this.vy = 0; this.pose = 'idle';
    let choice = -1;
    yield* this.talk(function* (c) {
      yield c.say('...Stop. Please. Something in your shell is— that paper. What is that paper?', 'Queen Aurelia');
      const i = yield c.ask('The ledger is warm in your claw.', ['Show her the Tithe Ledger.', 'Keep fighting.'], 'You');
      choice = i;
      if (i === 0) { yield c.say('"Delivered to the Deep." Hatchlings. Names. My own handwriting on the margins...? No. Vael\'s. And the Sea-King\'s seal on the bottom: "Seal at 61%. More required."', 'Queen Aurelia'); yield c.say('I counted them and called it grain. I counted them and called it grain.', 'Queen Aurelia'); }
    });
    if (choice === 0) { this.redeemed = true; this.world.game.setFlag('aurelia_redeemed'); this.world.game.setFlag('ledger_used'); this.hp = 1; this.die(); this.hp = 0; return; }
    this.invuln = false; this.startBrain();
  }
  // ---- attacks ------------------------------------------------------------------------------------------------------
  *pearlBarrage() {
    this.pose = 'cast'; this.orbit = 6; yield* this.moveTo(this.x, Math.min(this.y, (this.arena.y + this.arena.h - 16) * TS), 160, 1);
    this.world.fx.ring(this.x, this.y, 4, 46, 0.9, '#ffd8f0', 2); this.sfx('charged'); yield 1.0;
    const waves = this.phaseIdx ? 3 : 2;
    for (let w = 0; w < waves; w++) { const base = Math.atan2(this.player.y - this.y, this.player.x - this.x); for (let i = 0; i < 6; i++) this.shootDir('pearl', 10, base + (i - 2.5) * 0.3 + (w % 2) * 0.15, 140, { homing: this.phaseIdx > 1 ? 1.5 : 0, trail: '#ffd8f0' }); this.sfx('spit'); yield 0.7; }
    this.orbit = 0; yield 0.3;
  }
  *scepterThrust() {
    const pl = this.player, side = this.x < pl.x ? -1 : 1, a = this.arena;
    yield* this.moveTo(clamp(pl.x + side * 130, (a.x + 4) * TS, (a.x + a.w - 4) * TS), clamp(pl.y - 6, (a.y + 6) * TS, (a.y + a.h - 6) * TS), 260, 1.5);
    this.faceTo(pl.x); this.pose = 'thrust'; const d = this.facing;
    this.teleRect(d > 0 ? this.x : this.x - 150, this.y - 14, 150, 28, 0.7, { fill: 'h' }); yield 0.7;
    this.sfx('swoosh'); this.contactMult = 1.5; const x0 = this.x; let t = 0; while (t < 0.28) { this.vx = d * 520; t += 1 / 60; yield 1 / 60; } this.vx = 0; this.contactMult = 1;
    this.strikeBox(d > 0 ? x0 : this.x, this.y - 16, Math.abs(this.x - x0) + 30, 32, 17, 0.12); yield 0.7;
  }
  *coralSpires() {
    const a = this.arena, floorY = (a.y + a.h - 4) * TS, pl = this.player; this.pose = 'cast'; const start = pl.x < (a.x + a.w / 2) * TS ? 1 : -1;
    const xs = []; for (let i = 0; i < 6; i++) xs.push(clamp(pl.x + (i - 2.5) * 50 * start, (a.x + 3) * TS, (a.x + a.w - 3) * TS));
    xs.forEach((x, i) => { setTimeout(() => {}, 0); });
    for (let i = 0; i < xs.length; i++) { this.teleRect(xs[i] - 12, floorY - 84, 24, 86, 0.75 + i * 0.12); }
    this.sfx('roar'); yield 0.75;
    for (let i = 0; i < xs.length; i++) { this.strikeBox(xs[i] - 11, floorY - 84, 22, 86, 15, 0.2); this.world.fx.burst(xs[i], floorY - 40, ['#f0a8c8', '#e87e90', '#ffffff'], 70, 0.5, 3, { grav: 100 }); this.sfx('boom'); yield 0.12; }
    this.world.shake(5); yield 0.6;
  }
  *royalCommand() {
    this.pose = 'cast'; this.sfx('roar'); yield 0.6; const a = this.arena, fy = (a.y + a.h - 6) * TS;
    this.summon('brineguard', (a.x + 8) * TS, fy); this.summon('brineguard', (a.x + a.w - 8) * TS, fy); yield 1.2;
  }
  *tidalDecree() {
    const a = this.arena, ys = [a.y + 10, a.y + 20, a.y + 30].map((y) => y * TS), gap = Math.floor(Math.random() * 3), dir = Math.random() < 0.5 ? 1 : -1;
    this.pose = 'cast'; this.sfx('whirl');
    ys.forEach((y, i) => { if (i !== gap) this.teleRect((a.x + 1) * TS, y - 22, (a.w - 2) * TS, 44, 1.1); });
    yield 1.1; this.sfx('wave');
    ys.forEach((y, i) => { if (i !== gap) this.world.addProjectile({ kind: 'water', team: 'enemy', x: (dir > 0 ? a.x + 2 : a.x + a.w - 2) * TS, y, w: 24, h: 44, vx: dir * 300, vy: 0, dmg: Math.round(16 * this.dmgMult), life: 2.6, scale: 3.2, ghost: true, pierce: true, boss: true, trail: '#9af0ff' }); });
    this.world.shake(4); yield 1.2;
  }
  *spiralStorm() {
    this.pose = 'cast'; yield* this.moveTo((this.arena.x + this.arena.w / 2) * TS, (this.arena.y + 16) * TS, 200, 2); this.sfx('roar'); this.orbit = 6; yield 0.6;
    for (let i = 0; i < 36; i++) { const a = i * 0.45; this.shootDir('pearl', 9, a, 120, { trail: '#d8a0ff' }); this.shootDir('pearl', 9, a + Math.PI, 120, { trail: '#d8a0ff' }); if (i % 6 === 0) this.sfx('spit'); yield 0.09; }
    this.orbit = 0; yield 0.4;
  }
  *afterDefeat() {
    const w = this.world, g = w.game, red = this.redeemed; w.player.locked = true; w.slowT = 0; yield 0.3; let done = false;
    g.systems.dialogue.run(function* (c) {
      if (red) { yield c.say('The pearl in my crown is cracked. The voice is... quiet. Oh. Oh, it is so quiet.', 'Queen Aurelia'); yield c.say('Take this. A seat on the Court for as long as there is a Court. And a warning: whatever he is, he is not the only one holding the door. Something is behind it. Something old.', 'Queen Aurelia'); }
      else { yield c.say('Thank you... that is the kindest thing anyone has done to me in a hundred years.', 'Queen Aurelia'); yield c.say('Listen. The Tithe feeds a seal. The Sea-King is a lock, not a tyrant: though the lock has begun to rust. If you are what I think you are... be careful what you break.', 'Queen Aurelia'); }
    }, null, null, () => { done = true; }); while (!done) yield 0.1;
    if (red) g.grantLoot({ items: { charm_kingsigil: 1 } }, this.x, this.y, true);
    w.player.locked = false; g.systems.codex.unlock('aurelia_diary');
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const rage = this.phaseIdx > 1, f = enemyFrame(this.key + (rage ? 'R' : ''), { ...this.def.sprite, o: { rage } }, this.pose === 'stagger' ? 'idle' : this.pose, Math.floor(this.t * 6));
    drawFrame(ctx, f, this.x - cam.x, this.y - cam.y, this.facing < 0, this.flash > 0, this.alpha);
    if (this.orbit > 0) for (let i = 0; i < this.orbit; i++) { const a = this.orbitA + (i / this.orbit) * TAU, x = this.x + Math.cos(a) * 40 - cam.x, y = this.y - 6 + Math.sin(a) * 26 - cam.y; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); ctx.fillStyle = '#ffd8f0'; ctx.fillRect(Math.round(x) - 3, Math.round(y) - 1, 7, 3); ctx.fillRect(Math.round(x) - 1, Math.round(y) - 3, 3, 7); }
    this.drawTeles(ctx, cam);
  }
}
BOSS_CLASSES.aurelia = Aurelia;
