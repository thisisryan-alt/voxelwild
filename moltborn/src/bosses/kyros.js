// Boss 7 — Kyros the Unsleeping: the Sea-King's doorman. A fast duelist: thrusts, shield rushes, thrown tridents, phantoms and lightning.
import { Boss } from '../entities/boss.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import '../gfx/sprites_bosses.js';
import { drawFrame } from '../entities/entity.js';
import { moveBody } from '../world/physics.js';
import { clamp } from '../core/util.js';
import { TS } from '../world/tiles.js';

export class Kyros extends Boss {
  static def = {
    key: 'kyros', name: 'Kyros the Unsleeping', title: "Doorman of the Sea-King", hp: 2300, w: 30, h: 70, armor: 120, xp: 1300, music: 'boss7', contact: 18, npc: 'kyros',
    loot: { ep: 6, sp: 2, coins: [420, 520], items: { tide_sigil: 1 } },
    phases: [
      { at: 1, name: 'The Doorman', attacks: [['tridentCombo', 2.2], ['shieldRush', 1.6], ['lanceThrow', 1.8]], rest: 0.9 },
      { at: 0.62, name: 'Tide Guard', attacks: [['tridentCombo', 2], ['shieldRush', 1.5], ['lanceThrow', 1.5], ['skyfall', 1.8], ['tideSurge', 1]], rest: 0.75, onEnter(b) { b.dmgMult = 1.2; b.rageSkin = true; } },
      { at: 0.3, name: 'Unsleeping', attacks: [['tridentCombo', 2], ['lanceThrow', 1.4], ['skyfall', 1.6], ['phantomRush', 2.2], ['lightningStorm', 2]], rest: 0.55, onEnter(b) { b.dmgMult = 1.35; } },
    ],
    sprite: { plan: 'kyros', w: 110, h: 130, ax: 52, ay: 100, frames: 4, o: {} }, fps: 6,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); if (spawn.floor) this.y = spawn.y - this.h / 2 - 0.2; this.intro = this.introTalk; this.rageSkin = false; }
  *introTalk(c) {
    yield c.say('Halt. I am Kyros. I have not slept in four hundred years. It is a poor guard who sleeps.', 'Kyros');
    yield c.say("You are very small to be so far from home. I was told you would come, you know. Small, soft-shelled, unfinished. He has been preparing this door for you. I am sorry. I like the look of you, a little.", 'Kyros');
    yield c.say('The king asked me to deliver you a message: "Go back." I shall deliver it with my trident.', 'Kyros');
  }
  physics(dt) { this.vy = Math.min(this.vy + 900 * dt, 520); moveBody(this.world.grid, this, dt, {}); }
  get floorY() { return this.y + this.h / 2; }
  *step(dx, v = 300, t = 0.14) { this.faceTo(this.player.x); const d = Math.sign(this.player.x - this.x) || 1; let tt = 0; while (tt < t) { this.vx = d * v; tt += 1 / 60; yield 1 / 60; } this.vx = 0; }
  *thrust(len, dmg, tele = 0.4) {
    this.faceTo(this.player.x); const d = this.facing; this.pose = 'windup'; const x0 = d > 0 ? this.x : this.x - len; this.teleRect(x0, this.y - 30, len, 26, tele, { fill: 'h' }); yield tele;
    this.pose = 'thrust'; this.sfx('swoosh'); this.strikeBox(x0, this.y - 30, len, 26, dmg, 0.14, { kb: 180 }); yield 0.3;
  }
  *tridentCombo() {
    yield* this.step(); yield* this.thrust(92, 15, 0.45); yield* this.step(320, 0.1); yield* this.thrust(92, 15, 0.38); yield* this.step(340, 0.1); yield* this.thrust(120, 20, 0.6); yield 0.3;
  }
  *shieldRush() {
    this.faceTo(this.player.x); this.pose = 'guard'; this.guardFront = true; yield 0.7; const d = this.facing; this.contactMult = 1.5; this.sfx('swoosh'); let t = 0; while (t < 0.7 && !this.hitX) { this.vx = d * 360; t += 1 / 60; yield 1 / 60; }
    this.vx = 0; this.contactMult = 1; this.guardFront = false; this.strikeBox(d > 0 ? this.x : this.x - 50, this.y - 30, 50, 60, 17, 0.14, { kb: 260 }); this.world.shake(4); yield 0.7;
  }
  *lanceThrow() {
    this.faceTo(this.player.x); this.pose = 'windup'; yield 0.5; this.pose = 'throw';
    for (let i = 0; i < 2; i++) { this.faceTo(this.player.x); this.shootAt('trident', 18, 270, { x: this.x + this.facing * 24, y: this.y - 30, trail: '#9af0ff' }); this.sfx('zap'); yield 0.55; }
    yield 0.4;
  }
  *skyfall() {
    const pl = this.player; this.pose = 'windup'; yield 0.35; this.vy = -560; this.vx = clamp((pl.x - this.x) * 0.9, -260, 260); this.pose = 'cast'; yield 0.5;
    const tx = pl.x; this.teleCircle(tx, this.floorY - 6, 40, 0.5); this.vx = clamp((tx - this.x) * 3, -400, 400); this.vy = 700; let t = 0; while (!this.onGround && t < 1.4) { t += 1 / 60; yield 1 / 60; }
    this.vx = 0; this.pose = 'slam'; this.world.shake(8); this.sfx('boom'); this.strikeBox(this.x - 50, this.y - 20, 100, 70, 20, 0.2, { kb: 280 });
    for (const d of [-1, 1]) this.world.addProjectile({ kind: 'shard', team: 'enemy', x: this.x + d * 20, y: this.floorY - 8, vx: d * 210, vy: 0, dmg: Math.round(13 * this.dmgMult), life: 1.6, ghost: true, pierce: true, boss: true, trail: '#9af0ff' });
    yield 0.9;
  }
  *tideSurge() { this.pose = 'cast'; this.sfx('roar'); yield 0.6; const a = this.arena; this.summon('tridentstatue', (a.x + 5) * TS, this.floorY - 20); this.summon('tridentstatue', (a.x + a.w - 5) * TS, this.floorY - 20); yield 1; }
  *phantomRush() {
    const a = this.arena, pl = this.player;
    for (let i = 0; i < 3; i++) { const y = clamp(pl.y + (i - 1) * 30, (a.y + 6) * TS, this.floorY - 10), dir = i % 2 ? 1 : -1, x0 = (dir > 0 ? a.x + 1 : a.x + a.w - 1) * TS; this.teleRect((a.x + 1) * TS, y - 20, (a.w - 2) * TS, 40, 0.7, { fill: 'h' }); this.sfx('alert'); yield 0.7; this.sfx('swoosh'); this.world.addProjectile({ kind: 'water', team: 'enemy', x: x0, y, w: 20, h: 34, vx: dir * 560, vy: 0, dmg: Math.round(17 * this.dmgMult), life: 2, scale: 2, ghost: true, pierce: true, boss: true, trail: '#9af0ff' }); yield 0.35; }
    yield 0.6;
  }
  *lightningStorm() {
    const a = this.arena, pl = this.player; this.pose = 'cast'; this.sfx('thunder'); yield 0.4;
    for (let i = 0; i < 5; i++) { const x = clamp(pl.x + (Math.random() - 0.5) * 80, (a.x + 3) * TS, (a.x + a.w - 3) * TS); this.teleRect(x - 18, a.y * TS, 36, a.h * TS, 0.85); yield 0.35; setTimeout(() => {}, 0); const xx = x; this._pending = this._pending || []; this._pending.push({ x: xx, t: 0.85 - 0.35 }); }
    yield 0.9; for (const q of this._pending || []) { this.strikeBox(q.x - 18, a.y * TS, 36, a.h * TS, 19, 0.15, { kb: 200 }); this.world.fx.burst(q.x, this.floorY - 20, ['#ffffff', '#9af0ff'], 90, 0.5, 3); } this._pending = []; this.sfx('thunder'); this.world.shake(6); yield 1;
  }
  *afterDefeat() {
    const w = this.world, g = w.game; w.player.locked = true; w.slowT = 0; yield 0.3; let done = false;
    g.systems.dialogue.run(function* (c) {
      yield c.say('...Four hundred years awake. I may sleep, now, I think. Thank you for the courtesy of an honest fight.', 'Kyros');
      yield c.say("Take the Sigil. It is his mark, the proof of your standing in the Domain. Beyond is the Apotheosis Shrine, and beyond that the Throne. He is not what the Court says. He is not what the murals say, either. He is... tired. And frightened. And entirely, terribly capable. Be ready.", 'Kyros');
    }, null, null, () => { done = true; }); while (!done) yield 0.1; w.player.locked = false;
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const rage = this.rageSkin, pose = this.pose === 'stagger' ? 'idle' : this.pose === 'slam' ? 'throw' : this.pose === 'toss' ? 'idle' : this.pose;
    const f = enemyFrame(this.key + (rage ? 'R' : ''), { ...this.def.sprite, o: { rage } }, pose, Math.floor(this.t * 6));
    drawFrame(ctx, f, this.x - cam.x, this.y + this.h / 2 - cam.y, this.facing < 0, this.flash > 0, this.alpha);
  }
}
BOSS_CLASSES.kyros = Kyros;
