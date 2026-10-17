// The Rift Warden: keeper of the tear at the bottom of every Tidal Rift. Unlike the story bosses it can be fought again and
// again, so its introduction is only spoken once, its health follows the rift's tier, and it never marks the world as "done".
import { Boss } from '../entities/boss.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import '../gfx/sprites_rift.js';
import { drawFrame } from '../entities/entity.js';
import { clamp, rng } from '../core/util.js';
import { TS } from '../world/tiles.js';

const rand = rng(7373);

export class RiftWarden extends Boss {
  static def = {
    key: 'rift_warden', name: 'The Rift Warden', title: 'Keeper of the Tear', hp: 2000, w: 52, h: 76, armor: 90, xp: 800, music: 'boss6', contact: 14, flying: true,
    loot: { ep: 3, coins: [120, 200] },
    phases: [
      { at: 1, name: 'The Tear Opens', attacks: [['shardFan', 2], ['riftTears', 2], ['phaseStep', 1.4]], rest: 1.25 },
      { at: 0.62, name: 'Unmoored', attacks: [['shardFan', 2], ['riftTears', 2], ['phaseStep', 1.5], ['gravityWell', 1.6], ['shardCall', 1.2]], rest: 0.95, onEnter(b) { b.dmgMult = b.baseDmg * 1.15; } },
      { at: 0.28, name: 'Collapse', attacks: [['riftTears', 2], ['lanceRain', 2], ['gravityWell', 1.4], ['riftNova', 2], ['phaseStep', 1.2]], rest: 0.7, onEnter(b) { b.dmgMult = b.baseDmg * 1.3; } },
    ],
    sprite: { plan: 'riftwarden', w: 120, h: 120, ax: 60, ay: 58, frames: 4, o: {} }, fps: 5,
  };

  constructor(world, x, y, spawn) {
    super(world, x, y, spawn);
    this.baseDmg = spawn.dmgMult || 1; this.dmgMult = this.baseDmg; this.hitsTaken = 0; this.lastHp = null;
    this.intro = world.game.flag('met_warden') ? null : this.introTalk;
  }
  *introTalk(c) {
    yield c.narrate('The chamber ends at a wall of still glass. Behind it the water is moving the wrong way, and something tall is standing in the current with its back to you.');
    yield c.say('Every tear in the sea is mine to keep. You have followed this one all the way down. Few do. Fewer are glad of it.', 'The Rift Warden');
    c.set('met_warden');
  }

  // ---- movement: drift to a spot beside the swimmer between attacks ---------------------------------------------------------------------------
  physics(dt) {
    const pl = this.player, a = this.arena;
    if (this.lastHp === null) this.lastHp = pl.hp;
    if (pl.hp < this.lastHp) this.hitsTaken++;
    this.lastHp = pl.hp;
    if (this.state === 'idle' && this.alpha >= 1 && !this.staggerT && !this.transT) {
      const side = pl.x < (a.x + a.w / 2) * TS ? 1 : -1, tx = pl.x + side * 150, ty = pl.y - 46;
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(70, d * 1.4);
      this.vx = dx / d * sp; this.vy = dy / d * sp;
    } else if (this.state === 'idle') { this.vx *= 0.9; this.vy *= 0.9; }
    this.faceTo(pl.x);
    this.flyPhysics(dt, 4);
    this.y += Math.sin(this.t * 2.2) * 0.12;
  }

  // a circle of damage, approximated by stacked strips so what is drawn is what hurts
  strikeCircle(x, y, r, dmg, life = 0.18, o = {}) {
    const n = 7, step = (r * 2) / n;
    for (let i = 0; i < n; i++) {
      const dy = -r + step * (i + 0.5), half = Math.sqrt(Math.max(0, r * r - dy * dy));
      this.strikeBox(x - half, y + dy - step / 2, half * 2, step + 1, dmg, life, o);
    }
  }
  inArena(x, y, m = 3) { const a = this.arena; return [clamp(x, (a.x + m) * TS, (a.x + a.w - m) * TS), clamp(y, (a.y + m) * TS, (a.y + a.h - m) * TS)]; }

  // ---- attacks -----------------------------------------------------------------------------------------------------------------------------------------------------
  // fans of crystal shards, each volley aimed where the swimmer is now
  *shardFan() {
    this.pose = 'open'; this.sfx('roar'); yield 0.5;
    const rounds = 2 + this.phaseIdx, n = 5 + this.phaseIdx * 2, pl = this.player;
    for (let r = 0; r < rounds; r++) {
      const base = Math.atan2(pl.y - this.y, pl.x - this.x), gap = 0.2 - this.phaseIdx * 0.015;
      for (let i = 0; i < n; i++) this.shootDir('shard', 8, base + (i - (n - 1) / 2) * gap, 120 + this.phaseIdx * 18, { trail: '#b890ff', life: 3.2 });
      this.sfx('spore'); yield 0.7 - this.phaseIdx * 0.08;
    }
    this.pose = 'idle'; yield 0.3;
  }

  // tears open in the water around the swimmer and snap shut
  *riftTears() {
    this.pose = 'roar'; this.sfx('bosswarn');
    const pl = this.player, n = 3 + this.phaseIdx * 2, tears = [];
    for (let i = 0; i < n; i++) {
      const [x, y] = i === 0 ? this.inArena(pl.x, pl.y) : this.inArena(pl.x + (rand() - 0.5) * 190, pl.y + (rand() - 0.5) * 110);
      tears.push({ x, y }); this.teleCircle(x, y, 38, 0.9 + i * 0.18, { color: '#b060ff' });
    }
    yield 0.9;
    for (const t of tears) {
      this.strikeCircle(t.x, t.y, 38, 15, 0.2, { kb: 210 });
      this.world.fx.ring(t.x, t.y, 6, 44, 0.4, '#d8b8ff', 3); this.world.fx.burst(t.x, t.y, ['#8a60d8', '#e0ccff', '#38b8ff'], 70, 0.5, 2); this.sfx('boom'); yield 0.18;
    }
    this.world.shake(5); this.pose = 'idle'; yield 0.5;
  }

  // fade out, come back on the far side of the swimmer and sweep a blade of glass through the water
  *phaseStep() {
    const pl = this.player, w = this.world; this.pose = 'windup';
    for (let k = 9; k >= 0; k--) { this.alpha = k / 10; yield 0.03; }
    const dir = pl.x > this.x ? 1 : -1, [nx, ny] = this.inArena(pl.x + dir * 100, pl.y - 6);
    this.x = nx; this.y = ny; this.vx = this.vy = 0; w.fx.burst(nx, ny, ['#8a60d8', '#e0ccff'], 80, 0.4, 2);
    for (let k = 1; k <= 10; k++) { this.alpha = k / 10; yield 0.02; }
    this.faceTo(pl.x); const face = this.facing, len = 190, bx = face > 0 ? this.x : this.x - len;
    this.teleRect(bx, this.y - 26, len, 52, 0.75, { color: '#b060ff', fill: 'h' }); this.sfx('bosswarn'); this.pose = 'windup'; yield 0.75;
    this.pose = 'open'; this.strikeBox(bx, this.y - 26, len, 52, 20, 0.2, { kb: 230 });
    w.fx.groundWave?.(this.x, this.y, 10, 90); this.sfx('boom'); w.shake(5); yield 0.25;
    this.pose = 'idle'; yield 0.4;
  }

  // the tear inhales: a current drags everything toward the Warden, then it slams shut
  *gravityWell() {
    const w = this.world, pl = this.player, a = this.arena; this.pose = 'roar'; this.sfx('whirl');
    w.fx.text(this.x, this.y - 54, 'THE TEAR INHALES', '#d8b8ff', true);
    this.teleCircle(this.x, this.y, 88, 1.6, { color: '#b060ff' });
    const area = { kind: 'current', x: a.x * TS, y: a.y * TS, w: a.w * TS, h: a.h * TS, vx: 0, vy: 0, ttl: 1.8 }; w.zone.areas.push(area); let t = 0;
    while (t < 1.6) { const dx = this.x - pl.x, dy = this.y - pl.y, d = Math.hypot(dx, dy) || 1; area.vx = dx / d * 90; area.vy = dy / d * 90; t += 1 / 60; yield 1 / 60; }
    const i = w.zone.areas.indexOf(area); if (i >= 0) w.zone.areas.splice(i, 1);
    this.strikeCircle(this.x, this.y, 88, 22, 0.2, { kb: 300 }); w.fx.ring(this.x, this.y, 8, 90, 0.5, '#d8b8ff', 4); this.sfx('boom'); w.shake(7);
    this.pose = 'idle'; yield 0.7;
  }

  // two wisps slip out of the tear (never more than four at once)
  *shardCall() {
    this.pose = 'roar'; this.sfx('roar'); yield 0.5;
    const a = this.arena, alive = this.world.enemies.filter((e) => e.minion && e.alive).length;
    if (alive < 4) { this.summon('voidwisp', (a.x + 8) * TS, (a.y + 10) * TS); this.summon('voidwisp', (a.x + a.w - 8) * TS, (a.y + 10) * TS); }
    else yield* this.shardFan();
    this.pose = 'idle'; yield 0.8;
  }

  // columns of broken light fall across the chamber, starting at the swimmer and spreading outward
  *lanceRain() {
    this.pose = 'roar'; this.sfx('bosswarn'); const a = this.arena, pl = this.player, n = 8, top = a.y * TS, h = a.h * TS, xs = [];
    for (let i = 0; i < n; i++) { const off = (i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 44), x = clamp(pl.x + off, (a.x + 3) * TS, (a.x + a.w - 3) * TS); xs.push(x); this.teleRect(x - 13, top, 26, h, 0.8 + i * 0.12, { color: '#b060ff' }); }
    yield 0.8;
    for (const x of xs) { this.strikeBox(x - 12, top, 24, h, 15, 0.16, { kb: 180 }); this.world.fx.burst(x, pl.y, ['#e0ccff', '#8a60d8'], 60, 0.4, 2); this.sfx('boom'); yield 0.12; }
    this.world.shake(6); this.pose = 'idle'; yield 0.6;
  }

  // the last act: the tear tries to close on everything at once
  *riftNova() {
    const w = this.world; this.pose = 'roar'; this.sfx('bosswarn');
    const [mx, my] = this.inArena((this.arena.x + this.arena.w / 2) * TS, (this.arena.y + this.arena.h / 2 - 3) * TS);
    yield* this.moveTo(mx, my, 200, 1.6); this.pose = 'open';
    this.teleCircle(this.x, this.y, 150, 1.5, { color: '#ff60c0' }); w.fx.text(this.x, this.y - 54, 'THE TEAR CLOSES', '#ff90e0', true); yield 1.5;
    this.strikeCircle(this.x, this.y, 150, 26, 0.22, { kb: 340, unblockable: true }); w.shake(10); w.flash = 0.25; w.fx.ring(this.x, this.y, 10, 150, 0.6, '#ff90e0', 4); this.sfx('boom');
    for (let i = 0; i < 12; i++) this.shootDir('shard', 8, (i / 12) * Math.PI * 2, 110, { trail: '#ff90e0' });
    this.pose = 'idle'; yield 0.9;
  }

  *afterDefeat() {
    const w = this.world, g = w.game; this.flawless = this.hitsTaken === 0; w.player.locked = true; yield 0.6;
    w.fx.text(this.x, this.y - 30, this.flawless ? 'UNTOUCHED' : 'THE TEAR IS SEALED', this.flawless ? '#ffd84a' : '#d8b8ff', true, { life: 2 });
    g.toast(this.flawless ? 'The Warden never laid a claw on you.' : 'The Rift Warden shatters. The water settles.', this.flawless ? '#ffd84a' : '#d8b8ff');
    g.events.emit('wardenslain', this.flawless);
    yield 0.8; w.player.locked = false;
  }

  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const rage = this.phaseIdx > 1, pose = this.pose === 'walk' ? 'idle' : this.pose;
    const f = enemyFrame(this.key + (rage ? 'R' : ''), { ...this.def.sprite, o: { rage } }, pose, Math.floor(this.t * 5));
    drawFrame(ctx, f, this.x - cam.x, this.y - cam.y, this.facing < 0, this.flash > 0, this.alpha);
  }
}
BOSS_CLASSES.rift_warden = RiftWarden;
