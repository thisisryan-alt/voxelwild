// Mini-boss — Magmaw, the vent-eel of the Ember Vents. Moves like Mother Moray (sweeping coils through the whole arena) but
// fights with the vents themselves: it spits embers, calls plumes up out of the floor, and rains fire from the ceiling.
import { MotherMoray } from './moray.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { cinderSeg } from '../gfx/sprites_bosses2.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import { drawFrame } from '../entities/entity.js';
import { TS } from '../world/tiles.js';
import { clamp } from '../core/util.js';

const N = 16;
export class Magmaw extends MotherMoray {
  static def = {
    key: 'magmaw', name: 'Magmaw', title: 'Hearth of the Ember Vents', hp: 1100, w: 30, h: 26, armor: 90, xp: 520, music: 'boss5', contact: 16, flying: true, ghost: true,
    loot: { ep: 3, sp: 1, coins: [200, 260], items: { claw_cinder: 1, dye_ember: 1 } },
    phases: [
      { at: 1, name: 'The Hearth', attacks: [['coilDash', 2], ['emberSpit', 2], ['ventBurst', 1.6]], rest: 0.95 },
      { at: 0.55, name: 'Rekindled', attacks: [['coilDash', 2.2], ['emberSpit', 1.5], ['ventBurst', 1.6], ['lavaRain', 1.6]], rest: 0.75, onEnter(b) { b.dmgMult = 1.25; } },
      { at: 0.25, name: 'Meltdown', attacks: [['coilDash', 2.4], ['emberSpit', 1.2], ['ventBurst', 1.8], ['lavaRain', 1.8]], rest: 0.5, onEnter(b) { b.dmgMult = 1.45; } },
    ],
    sprite: { plan: 'magmaw', w: 80, h: 64, ax: 40, ay: 32, frames: 1, o: {} },
  };
  *introTalk(c) {
    yield c.say('...warm. You are warm. Oh. The others were cold when they stopped by. They never stayed. Everything that comes down here goes cold.', 'Magmaw');
    yield c.say('Please do not go. Please do not — hot. I am so hot. I do not know how to be less. I am only trying to keep the dark from freezing you.', 'Magmaw');
  }
  // --- attacks (coilDash is inherited) -----------------------------------------------------------------------------------------------
  *emberSpit() {
    const a = this.arena, pl = this.player, side = pl.x > (a.x + a.w / 2) * TS ? -1 : 1;
    yield* this.moveTo(clamp(pl.x - side * 130, (a.x + 5) * TS, (a.x + a.w - 5) * TS), clamp(pl.y - 50, (a.y + 6) * TS, (a.y + a.h - 6) * TS), 240, 2.4);
    this.facing = pl.x > this.x ? 1 : -1; this.open = true; yield 0.6;
    const n = this.phaseIdx ? 6 : 4;
    for (let r = 0; r < (this.phaseIdx ? 2 : 1); r++) {
      const base = Math.atan2(pl.y - this.y, pl.x - this.x);
      for (let i = 0; i < n; i++) { this.shootDir('fire', 9, base + (i - (n - 1) / 2) * 0.2, 150, { x: this.x + this.facing * 18, y: this.y, trail: '#ffb040' }); }
      this.sfx('spit'); yield 0.55;
    }
    this.open = false; yield 0.3;
  }
  *ventBurst() {
    const a = this.arena, pl = this.player, floorY = (a.y + a.h - 2) * TS;
    yield* this.moveTo(this.x, (a.y + 8) * TS, 220, 1.4); this.open = true;
    const xs = [pl.x, pl.x - 72, pl.x + 72].map((x) => clamp(x, (a.x + 4) * TS, (a.x + a.w - 4) * TS));
    for (const x of xs) this.teleRect(x - 16, floorY - 150, 32, 152, 0.95, { color: '#ff9a3a' });
    this.sfx('roar'); yield 0.95;
    for (const x of xs) {
      this.strikeBox(x - 14, floorY - 150, 28, 152, 17, 0.28, { kb: 210 });
      for (let i = 0; i < 14; i++) this.world.fx.add({ x: x + (Math.random() - 0.5) * 22, y: floorY - Math.random() * 20, vx: (Math.random() - 0.5) * 30, vy: -170 - Math.random() * 120, life: 0.6, size: 2, color: ['#ffb040', '#ff6a3a', '#fff0b0'][i % 3], drag: 0.8 });
    }
    this.world.shake(6); this.sfx('boom'); this.open = false; yield 0.9;
  }
  *lavaRain() {
    const a = this.arena; this.open = true; this.sfx('roar'); yield* this.moveTo(this.x, (a.y + 7) * TS, 220, 1.2);
    const xs = []; for (let i = 0; i < 9; i++) xs.push((a.x + 3 + Math.random() * (a.w - 6)) * TS);
    for (const x of xs) this.teleCircle(x, (a.y + a.h - 2) * TS, 28, 0.8, { color: '#ff9a3a' });
    yield 0.8;
    for (const x of xs) { this.world.addProjectile({ kind: 'fire', team: 'enemy', x, y: (a.y + 1) * TS, vx: 0, vy: 150, grav: 160, dmg: Math.round(10 * this.dmgMult), life: 3, boss: true, ghost: false, trail: '#ff8a3a', scale: 1.5 }); yield 0.12; }
    this.open = false; yield 0.8;
  }
  *afterDefeat() {
    const w = this.world, g = w.game; w.player.locked = true; w.slowT = 0; yield 0.3; let done = false;
    g.systems.dialogue.run(function* (c) {
      yield c.say('...oh. Cooler. That is... that is what cold feels like. I have been wondering.', 'Magmaw');
      yield c.say('Thank you for staying until the end. Nobody ever stays until the end. Tell the little smith that the hearth is hers now. Tell her to keep it lit. Just enough.', 'Magmaw');
    }, null, null, () => { done = true; });
    while (!done) yield 0.1; w.player.locked = false; g.systems.codex.unlock('magmaw_ash');
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const segs = this.segPositions();
    for (let k = Math.min(N, segs.length - 1); k >= 1; k--) { const r = 10 - k * 0.42, f = cinderSeg(Math.max(3, r), k % 5); drawFrame(ctx, f, segs[k].x - cam.x, segs[k].y - cam.y, false, this.flash > 0, this.alpha); }
    const f = enemyFrame('magmaw' + (this.phaseIdx ? 'R' : ''), { ...this.def.sprite, o: { rage: this.phaseIdx > 0 } }, this.open ? 'open' : 'idle', 0);
    drawFrame(ctx, f, this.x - cam.x, this.y - cam.y, this.dirX < 0 && this.vx !== 0 ? true : this.facing < 0, this.flash > 0, this.alpha);
    this.drawTeles(ctx, cam);
  }
}
BOSS_CLASSES.magmaw = Magmaw;
