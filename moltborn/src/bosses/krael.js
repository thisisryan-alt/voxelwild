// Boss 6 — Krael, the Chained Titan: the first guardian, shackled to the Seal. Break his chains, then decide his fate.
import { Boss } from '../entities/boss.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import '../gfx/sprites_bosses.js';
import { drawFrame } from '../entities/entity.js';
import { clamp, TAU } from '../core/util.js';
import { TS } from '../world/tiles.js';

export class Krael extends Boss {
  static def = {
    key: 'krael', name: 'Krael, the Chained Titan', title: 'First Wall of the Sea-King', hp: 1600, w: 150, h: 80, armor: 130, xp: 1100, music: 'boss6', contact: 20, flying: true, ghost: true,
    loot: { ep: 6, sp: 1, coins: [320, 420], items: { titan_heart: 1 } },
    phases: [
      { at: 1, name: 'First Wall', attacks: [['tailSweep', 2], ['clawSmash', 2], ['gazeBeam', 1.6]], rest: 1.2 },
      { at: 0.62, name: 'Chains Break', attacks: [['tailSweep', 2], ['clawSmash', 2], ['gazeBeam', 1.6], ['chainLash', 2.2]], rest: 0.95, transTime: 2, onEnter(b) { b.dmgMult = 1.2; b.broken = 2; b.world.fx.text(b.x, b.y - 60, 'THE CHAINS BREAK', '#ffb070', true, { life: 1.6 }); } },
      { at: 0.3, name: 'Unbound', attacks: [['tailSweep', 2], ['clawSmash', 2], ['gazeBeam', 2], ['chainLash', 2], ['titanRoar', 2]], rest: 0.7, onEnter(b) { b.dmgMult = 1.35; b.broken = 4; } },
    ],
    sprite: { plan: 'krael', w: 250, h: 190, ax: 120, ay: 84, frames: 4, o: {} }, fps: 4,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); this.broken = 0; this.beam = null; this.intro = this.introTalk; this.floorY = (this.arena.y + this.arena.h - 3) * TS; this.y = this.floorY - 70; this.hx = this.x; }
  *introTalk(c) {
    yield c.say('...Small. You are small. I remember small. Small ones came to the nursery-vault, once, and asked me to open the door. I said no. I said no for a very long time.', 'Krael');
    yield c.say('Do you know what it is to be a wall? You are not permitted to be tired. You are not permitted to be kind. You are only permitted to be between. I am so very tired of between.', 'Krael');
    yield c.say('Strike me, then. Or do not. It will all be the same to the chains.', 'Krael');
  }
  physics() {}
  hurtBoxes() { return [{ x: this.x - 70, y: this.y - 44, w: 170, h: 90 }, { x: this.x + 90, y: this.y - 10, w: 60, h: 56 }]; }
  hurtBox() { return this.hurtBoxes()[0]; }
  // ---- attacks ----
  *tailSweep() {
    const a = this.arena, y = this.floorY - 22; this.pose = 'windup'; this.teleRect(this.x + 60, y - 22, (a.x + a.w - 3) * TS - this.x - 60, 44, 1.0, { fill: 'h' }); this.sfx('roar'); yield 1.0;
    this.pose = 'tail'; this.sfx('swoosh'); this.world.shake(5);
    for (let i = 0; i < 3; i++) this.world.addProjectile({ kind: 'shard', team: 'enemy', x: this.x + 70, y, vx: 250 + i * 40, vy: 0, dmg: Math.round(15 * this.dmgMult), life: 3, ghost: true, pierce: true, boss: true, trail: '#ffb070', scale: 1.8 });
    this.strikeBox(this.x - 130, y - 40, 120, 80, 20, 0.2, { kb: 240 }); yield 1.0; this.pose = 'idle';
  }
  *clawSmash() {
    const pl = this.player, a = this.arena; this.pose = 'windup'; const tx = clamp(pl.x, (a.x + 40) * TS, (a.x + a.w - 4) * TS), ty = clamp(pl.y, (a.y + 6) * TS, this.floorY - 10);
    this.teleCircle(tx, ty, 64, 1.1); this.sfx('roar'); yield 1.1; this.pose = 'smash'; this.sfx('boom'); this.world.shake(10); this.world.game.hitstop(5);
    this.strikeBox(tx - 64, ty - 64, 128, 128, 24, 0.2, { kb: 300 });
    for (let i = 0; i < 4; i++) this.world.addProjectile({ kind: 'cannonball', team: 'enemy', x: tx - 80 + i * 55, y: (a.y + 2) * TS, vx: 0, vy: 40, dmg: Math.round(11 * this.dmgMult), grav: 300, life: 3, boss: true });
    yield 1.0; this.pose = 'idle';
  }
  *gazeBeam() {
    const a = this.arena, pl = this.player, left = pl.x < (a.x + a.w / 2) * TS; let bx = clamp(pl.x, (a.x + 30) * TS, (a.x + a.w - 4) * TS);
    this.pose = 'gaze'; const t = this.teleRect(bx - 18, a.y * TS, 36, a.h * TS, 1.1, { fill: 'h' }); this.sfx('whirl'); yield 1.1;
    const dir = left ? 1 : -1; this.sfx('zap'); let tt = 0; const T = this.phaseIdx > 1 ? 2.2 : 1.8; const bt = this.tele({ kind: 'rect', x: bx - 14, y: a.y * TS, w: 28, h: a.h * TS, dur: T, color: '#ffe0a0', fill: false });
    while (tt < T) { bx += dir * 80 / 60; bt.x = bx - 14; bt.t = 0.9 * bt.dur; if (Math.floor(tt * 60) % 6 === 0) this.strikeBox(bx - 14, a.y * TS, 28, a.h * TS, 14, 0.1, { kb: 120 }); this.world.fx.add({ x: bx + (Math.random() - 0.5) * 20, y: a.y * TS + Math.random() * a.h * TS, vx: 0, vy: 0, life: 0.3, size: 2, color: '#ffe0a0' }); tt += 1 / 60; yield 1 / 60; }
    bt.dur = 0; this.pose = 'idle'; yield 0.5;
  }
  *chainLash() {
    const a = this.arena; this.pose = 'windup'; const ys = [this.floorY - 18, this.floorY - 80, this.floorY - 150], skip = Math.floor(Math.random() * 3);
    ys.forEach((y, i) => { if (i !== skip) this.teleRect(this.x + 60, y - 12, (a.x + a.w - 3) * TS - this.x - 60, 24, 0.9, { fill: 'h' }); }); this.sfx('roar'); yield 0.9; this.pose = 'tail'; this.sfx('swoosh');
    ys.forEach((y, i) => { if (i !== skip) this.world.addProjectile({ kind: 'shard', team: 'enemy', x: this.x + 70, y, vx: 300, vy: 0, dmg: Math.round(15 * this.dmgMult), life: 3, ghost: true, pierce: true, boss: true, trail: '#ffa030', scale: 1.8 }); }); this.world.shake(4); yield 1.1; this.pose = 'idle';
  }
  *titanRoar() {
    const a = this.arena, pl = this.player; this.pose = 'windup'; this.sfx('roar'); this.world.shake(8); yield 0.5;
    for (let i = 0; i < 9; i++) { const x = clamp(pl.x + (Math.random() - 0.5) * 160, (a.x + 6) * TS, (a.x + a.w - 4) * TS); this.teleCircle(x, this.floorY - 10, 30, 0.7); this.world.addProjectile({ kind: 'cannonball', team: 'enemy', x, y: (a.y + 2) * TS, vx: 0, vy: 60, dmg: Math.round(12 * this.dmgMult), grav: 320, life: 3, boss: true }); yield 0.3; }
    for (const d of [1]) this.world.addProjectile({ kind: 'water', team: 'enemy', x: this.x + 80, y: this.floorY - 40, w: 24, h: 70, vx: 220, vy: 0, dmg: Math.round(18 * this.dmgMult), life: 3, scale: 2.6, ghost: true, pierce: true, boss: true, trail: '#ffb070' });
    this.pose = 'idle'; yield 1;
  }
  *afterDefeat() {
    const w = this.world, g = w.game; w.player.locked = true; w.slowT = 0; this.broken = 4; yield 0.4; let choice = 0;
    yield* this.talk(function* (c) {
      yield c.say('...Enough. Enough. I can feel the weight shifting. It is... a little lighter. I am not sure I remember what to do with that.', 'Krael');
      yield c.say('Little Moltborn. I know the shape of your shell. We kept the hatchlings in the vault above, safe, asleep, while the Seal drank their years. I was ashamed. I am ashamed. Listen. Take what you need: my Heart is the oldest thing in the sea that is still beating.', 'Krael');
      const i = yield c.ask('Krael waits for your decision. His chains hang slack.', ['Take his Heart by force. (Slay Krael)', 'Break his chains. (Free Krael)'], 'You');
      choice = i;
    });
    g.setFlag('krael_decided'); const extra = { sp: 1 };
    if (choice === 0) { g.setFlag('krael_slain'); extra.items = { fury_ink: 2 }; w.fx.burst(this.x, this.y, ['#ff7a3a', '#fff'], 200, 1, 3); yield* this.talk(function* (c) { yield c.say('Good. Quick. It is... kinder than the chains.', 'Krael'); }); }
    else { g.setFlag('krael_freed'); extra.items = { mut_brineheart: 1 }; w.fx.ring(this.x, this.y, 4, 160, 1, '#ffd8a0', 3); w.flash = 0.5; yield* this.talk(function* (c) { yield c.say('Oh. The chains are... gone. I can breathe. I can breathe!', 'Krael'); yield c.say('I will not stay a wall. I will go to the Domain gate, and I will stand in front of it. Not between. In front. Go well, Moltborn. Be bigger than all of us.', 'Krael'); }); }
    g.grantLoot(extra, this.x, this.y, true); g.systems.codex.unlock('titan_chains'); w.player.locked = false;
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const f = enemyFrame(this.key + this.broken, { ...this.def.sprite, o: { broken: this.broken } }, this.pose === 'stagger' ? 'idle' : this.pose, Math.floor(this.t * 4));
    drawFrame(ctx, f, this.x - cam.x, this.y - cam.y, false, this.flash > 0, this.alpha);
  }
}
BOSS_CLASSES.krael = Krael;
