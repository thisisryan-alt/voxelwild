// Boss 2 — Mother Moray: a grieving giant eel. Moves like a river: long sweeping dashes, spits, root spikes.
import { Boss } from '../entities/boss.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { moraySeg, morayHead } from '../gfx/sprites_bosses.js';
import { drawFrame } from '../entities/entity.js';
import { TS } from '../world/tiles.js';
import { clamp } from '../core/util.js';

const N = 18, SP = 9;
export class MotherMoray extends Boss {
  static def = {
    key: 'mother_moray', name: 'Mother Moray', title: 'Grief of the Mangrove Heart', hp: 800, w: 26, h: 22, armor: 55, xp: 320, music: 'boss2', contact: 14, flying: true, ghost: true,
    loot: { ep: 4, sp: 1, coins: [100, 140], items: { mut_gills: 1 } },
    phases: [
      { at: 1, name: 'The Mother', attacks: [['coilDash', 2], ['thornSpit', 2], ['rootCrush', 1.6]], rest: 1.1 },
      { at: 0.55, name: 'Brood of Venom', attacks: [['coilDash', 2], ['thornSpit', 1.5], ['rootCrush', 1.5], ['eggBurst', 1.2]], rest: 0.9, onEnter(b) { b.dmgMult = 1.15; } },
      { at: 0.25, name: 'The Tide Pulls', attacks: [['coilDash', 2.2], ['thornSpit', 1.2], ['rootCrush', 1.4], ['eggBurst', 0.8], ['currentRoar', 1.4]], rest: 0.6, onEnter(b) { b.dmgMult = 1.3; } },
    ],
  };
  constructor(world, x, y, spawn) {
    super(world, x, y, spawn); this.trail = []; this.dirX = -1; this.open = false;
    for (let i = 0; i < 160; i++) this.trail.push({ x: this.x + i * 2, y: this.y });
    this.intro = this.introTalk; this.hover = 0;
  }
  *introTalk(c) {
    yield c.say('Not... not them... They are not... for the dark. They are only... children.', 'Mother Moray');
    yield c.say('The water tastes of the king. My eggs go green and... and then they do not stop glowing. Please go away. Please. I can not hold it back.', 'Mother Moray');
  }
  physics(dt) {
    const a = this.arena; this.x += this.vx * dt; this.y += this.vy * dt;
    this.x = clamp(this.x, (a.x + 3) * TS, (a.x + a.w - 3) * TS); this.y = clamp(this.y, (a.y + 3) * TS, (a.y + a.h - 3) * TS);
    this.record();
  }
  record() { const t = this.trail, h = t[0]; if (!h || Math.hypot(this.x - h.x, this.y - h.y) > 2) t.unshift({ x: this.x, y: this.y }); if (t.length > 420) t.length = 420; }
  idleAnim() { this.x += 0; }
  segPositions() { const out = [], t = this.trail; let d = 0, i = 0, acc = 0; out.push(t[0]); for (let k = 1; k < N; k++) { const need = k * SP; while (i < t.length - 1 && acc < need) { acc += Math.hypot(t[i].x - t[i + 1].x, t[i].y - t[i + 1].y); i++; } out.push(t[Math.min(i, t.length - 1)]); } return out; }
  hurtBoxes() { const s = this.segPositions(), out = []; for (let k = 0; k < s.length; k += 2) { const r = k === 0 ? 14 : 9 - k * 0.3; out.push({ x: s[k].x - r, y: s[k].y - r, w: r * 2, h: r * 2 }); } return out; }
  hurtBox() { return this.hurtBoxes()[0]; }
  // ---- attacks ----
  *coilDash() {
    const a = this.arena, pl = this.player, left = this.x > (a.x + a.w / 2) * TS, y = clamp(pl.y, (a.y + 8) * TS, (a.y + a.h - 6) * TS);
    const x0 = (left ? a.x + a.w - 4 : a.x + 4) * TS, x1 = (left ? a.x + 4 : a.x + a.w - 4) * TS;
    yield* this.moveTo(x0, y - 40, 260, 2.5); this.dirX = left ? -1 : 1; this.facing = this.dirX;
    yield* this.moveTo(x0, y, 160, 1, 3); this.open = true;
    this.teleRect(Math.min(x0, x1), y - 20, Math.abs(x1 - x0), 40, 0.9, { fill: 'h' }); this.sfx('roar');
    yield 0.9; this.sfx('swoosh'); this.contactMult = 1.5;
    while (Math.abs(this.x - x1) > 8) { this.vx = this.dirX * (this.phaseIdx ? 360 : 320); this.vy = 0; yield 1 / 60; }
    this.vx = 0; this.open = false; this.contactMult = 1; this.world.shake(3);
  }
  *thornSpit() {
    const a = this.arena, pl = this.player, side = pl.x > (a.x + a.w / 2) * TS ? -1 : 1; const x = pl.x + side * -110;
    yield* this.moveTo(clamp(pl.x - side * 130, (a.x + 5) * TS, (a.x + a.w - 5) * TS), clamp(pl.y - 50, (a.y + 6) * TS, (a.y + a.h - 6) * TS), 240, 2.4);
    this.facing = pl.x > this.x ? 1 : -1; this.open = true; yield 0.6;
    const n = this.phaseIdx ? 7 : 5;
    for (let r = 0; r < (this.phaseIdx > 1 ? 2 : 1); r++) { for (let i = 0; i < n; i++) { const base = Math.atan2(pl.y - this.y, pl.x - this.x); this.shootDir('dart', 8, base + (i - (n - 1) / 2) * 0.17, 150, { x: this.x + this.facing * 16, y: this.y, life: 2.4, trail: '#8aff8a' }); } this.sfx('spit'); yield 0.5; }
    this.open = false; yield 0.3;
  }
  *rootCrush() {
    const a = this.arena, pl = this.player; const floorY = (a.y + a.h - 3) * TS - 2;
    yield* this.moveTo(this.x, (a.y + 8) * TS, 200, 1.2);
    const xs = [pl.x, pl.x - 70, pl.x + 70].map((x) => clamp(x, (a.x + 4) * TS, (a.x + a.w - 4) * TS));
    for (const x of xs) this.teleRect(x - 14, floorY - 90, 28, 92, 0.95);
    this.sfx('roar'); yield 0.95;
    for (const x of xs) { this.strikeBox(x - 12, floorY - 90, 24, 92, 16, 0.2, { kb: 200 }); this.world.fx.burst(x, floorY - 40, ['#5ac878', '#2a8a52', '#8a6a24'], 80, 0.6, 3, { grav: 120 }); }
    this.world.shake(6); this.sfx('boom'); yield 0.9;
  }
  *eggBurst() {
    this.open = true; this.sfx('roar'); yield 0.5; const a = this.arena;
    for (let i = 0; i < 3; i++) this.summon('venomjelly', (a.x + 12 + i * 22) * TS, (a.y + 14) * TS);
    this.open = false; yield 1;
  }
  *currentRoar() {
    const a = this.arena, pl = this.player; this.open = true; this.world.fx.text(pl.x, pl.y - 30, 'THE TIDE PULLS', '#9ad8ff', true);
    const dir = pl.x < (a.x + a.w / 2) * TS ? 1 : -1; this.sfx('whirl');
    const area = { kind: 'current', x: a.x * TS, y: a.y * TS, w: a.w * TS, h: a.h * TS, vx: dir * 120, vy: 0 }; this.world.zone.areas.push(area);
    for (let i = 0; i < 6; i++) { this.shootAt('dart', 8, 160, { x: this.x, y: this.y, angle: (i - 2.5) * 0.12 }); yield 0.45; }
    this.world.zone.areas.splice(this.world.zone.areas.indexOf(area), 1); this.open = false; yield 0.4;
  }
  *afterDefeat() {
    const w = this.world, g = w.game; w.player.locked = true; w.slowT = 0; yield 0.3; let done = false;
    g.systems.dialogue.run(function* (c) {
      yield c.say('...Thank you. The green is going out of the water.', 'Mother Moray');
      yield c.say("He sent it down in the egg-water. A drop of the king's temper, to make guardians out of mothers. He calls it a mercy. I call it... Little Moltborn. I know what you are. The sea has been whispering your shape for a century.", 'Mother Moray');
      yield c.say('Go on to the Court. Watch the queen. She is kinder than she looks, and she looks like a wound.', 'Mother Moray');
    }, null, null, () => { done = true; }); while (!done) yield 0.1; w.player.locked = false; g.systems.codex.unlock('moray_eggs');
  }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const segs = this.segPositions();
    for (let k = N - 1; k >= 1; k--) { const r = 10 - k * 0.38, f = moraySeg(Math.max(3, r), k % 5); drawFrame(ctx, f, segs[k].x - cam.x, segs[k].y - cam.y, false, this.flash > 0, this.alpha); }
    const f = morayHead(this.open ? 1 : 0, this.phaseIdx > 1 ? 1 : 0); drawFrame(ctx, f, this.x - cam.x, this.y - cam.y, this.dirX < 0 && this.vx !== 0 ? true : this.facing < 0, this.flash > 0, this.alpha);
    this.drawTeles(ctx, cam);
  }
}
BOSS_CLASSES.mother_moray = MotherMoray;
