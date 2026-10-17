// The final boss — Poseidon, God of the Sea. Four mechanically distinct phases, then a choice that decides the ending.
import { Boss } from '../entities/boss.js';
import { BOSS_CLASSES } from '../entities/bosses.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import '../gfx/sprites_bosses.js';
import { drawFrame } from '../entities/entity.js';
import { Script, clamp, TAU } from '../core/util.js';
import { TS } from '../world/tiles.js';

export class Poseidon extends Boss {
  static def = {
    key: 'poseidon', name: 'Poseidon', title: 'God of the Sea, Warden of the Seal', hp: 3800, w: 84, h: 130, armor: 200, xp: 5000, music: 'boss_final', contact: 24, flying: true, ghost: true, staggerTime: 2.6, noLoot: true,
    phases: [
      { at: 1, name: 'The Judgment of the Sea', attacks: [['judgment', 2.2], ['tideBolts', 2], ['breakingWave', 2], ['crownBlast', 1.2]], rest: 1.0 },
      { at: 0.7, name: 'The Wrath of the Ocean', attacks: [['judgment', 1.6], ['tideBolts', 1.4], ['breakingWave', 1.6], ['lightningRain', 2], ['whirlpools', 1.2], ['summonTide', 0.9]], rest: 0.8, transTime: 2.2,
        onEnter(b) { b.dmgMult = 1.2; b.say2('The sea is not a metaphor. Let me show you its temper.'); b.surge = true; } },
      { at: 0.4, name: 'The Drowned God', attacks: [['drownedGrasp', 2.2], ['voidBeam', 2], ['judgment', 1.2], ['floodVents', 1.4], ['tentacleRain', 1.6], ['abyssRoar', 1.4]], rest: 0.65, transTime: 4.2,
        onEnter(b) { b.dmgMult = 1.4; b.breakRestraints(); } },
      { at: 0.14, name: 'The Last Tide', attacks: [['lastTide', 3], ['judgment', 1], ['tideBolts', 1], ['voidBeam', 1]], rest: 0.5, transTime: 3,
        onEnter(b) { b.dmgMult = 1.45; b.say2('No more words. Let us settle it as the tides do: all at once.'); b.world.player.fury = 100; b.cycle = 0; } },
    ],
    sprite: { plan: 'poseidon', w: 200, h: 200, ax: 100, ay: 104, frames: 4, o: {} }, fps: 5,
  };
  constructor(world, x, y, spawn) { super(world, x, y, spawn); this.intro = this.introTalk; this.surge = false; this.vents = []; this.cycle = 0; this.clashed = 0; this.waitUlt = false; this.floorY = (this.arena.y + this.arena.h - 4) * TS; }
  *introTalk(c) {
    yield c.say('So. The unfinished one. I have dreamed of this door opening for four thousand years, and I have never decided whether to dread it or ask it to hurry.', 'Poseidon');
    yield c.say('You think me a tyrant. Everyone does. I made sure of it. A feared king keeps a quiet sea; a loved one would have been asked for mercy, and mercy has no budget.', 'Poseidon');
    yield c.say('Below me is the Hollow. Below the Hollow is the end of everything with a shape. I am the lock. Do you know what a lock must never do? Rest. Do you know what a lock must never be? Forgiven.', 'Poseidon');
    yield c.say('Come, then, Moltborn. Judge me. Or try.', 'Poseidon');
  }
  say2(t) { this.world.fx.text(this.x, this.y - 90, t.length > 40 ? t.slice(0, 40) + '...' : t, '#ffe890', false, { life: 2.4, vy: -6 }); this.world.game.toast('Poseidon: ' + t, '#ffe890'); }
  physics(dt) { this.flyPhysics(dt, 10); this.y += Math.sin(this.t * 1.2) * 0.12; this.facing = this.player.x < this.x ? -1 : 1; for (const v of this.vents) { v.t += dt; } }
  breakRestraints() {
    const w = this.world; this.sfx('thunder'); w.shake(14); w.flash = 0.7; w.fx.ring(this.x, this.y, 10, 300, 1, '#ffffff', 5); w.darkMul = 1;
    for (let i = 0; i < 40; i++) w.fx.add({ x: this.x + (Math.random() - 0.5) * 160, y: this.y + (Math.random() - 0.5) * 120, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, life: 1.2, size: 3, color: ['#aab', '#fff', '#40e0ff'][i % 3], drag: 1.5, shrink: true });
    this.say2('These chains were never his. I chained myself. See what holding it shut keeps in a body.');
  }
  // ---- Phase 1 ----
  *judgment() {
    const pl = this.player, a = this.arena; const n = this.phaseIdx > 1 ? 3 : 3;
    for (let i = 0; i < n; i++) {
      const side = pl.x < this.x ? 1 : -1;
      yield* this.moveTo(clamp(pl.x + side * 170, (a.x + 8) * TS, (a.x + a.w - 8) * TS), clamp(pl.y - 10, (a.y + 14) * TS, this.floorY - 70), 360, 1.2); this.faceTo(pl.x); this.pose = 'thrust';
      const d = this.facing, len = i === 2 ? 260 : 190, y = this.y - 30 + (i - 1) * 6, x0 = d > 0 ? this.x + 10 : this.x - 10 - len, tele = i === 2 ? 0.85 : 0.6;
      this.teleRect(x0, y - 18, len, 36, tele, { fill: 'h' }); yield tele;
      this.sfx('swoosh'); this.strikeBox(x0, y - 18, len, 36, i === 2 ? 26 : 20, 0.16, { kb: 260 }); this.world.shake(3);
      this.world.fx.foam(this.x + d * 60, y, d, 8); yield 0.35 + (i === 2 ? 0.3 : 0);
    }
    this.pose = 'idle';
  }
  *tideBolts() {
    this.pose = 'cast'; this.sfx('whirl'); yield 0.6; const vols = this.phaseIdx > 1 ? 3 : 2;
    for (let v = 0; v < vols; v++) { const base = Math.atan2(this.player.y - this.y, this.player.x - this.x); const n = 7; for (let i = 0; i < n; i++) this.shootDir('water', 12, base + (i - 3) * 0.18, 200, { life: 2.8, trail: '#9af0ff', scale: 1.2 }); this.sfx('spit'); yield 0.7; }
    this.pose = 'idle';
  }
  *breakingWave() {
    const a = this.arena, fromLeft = Math.random() < 0.5, y = this.floorY - 34; this.pose = 'cast';
    this.teleRect((a.x + 1) * TS, y - 34, (a.w - 2) * TS, 68, 1.1, { fill: 'h' }); this.sfx('bosswarn'); yield 1.1; this.sfx('wave'); this.world.shake(5);
    this.world.addProjectile({ kind: 'water', team: 'enemy', x: (fromLeft ? a.x + 1 : a.x + a.w - 1) * TS, y, w: 40, h: 64, vx: fromLeft ? 340 : -340, vy: 0, dmg: Math.round(22 * this.dmgMult), life: 3.2, scale: 3.6, ghost: true, pierce: true, boss: true, trail: '#9af0ff' });
    if (this.phaseIdx > 1) setTimeout(() => {}, 0); yield 1.5; this.pose = 'idle';
  }
  *crownBlast() {
    const pl = this.player, a = this.arena; this.pose = 'raise'; const x = clamp(pl.x, (a.x + 4) * TS, (a.x + a.w - 4) * TS);
    this.teleRect(x - 24, a.y * TS, 48, a.h * TS, 1.0); this.sfx('thunder'); yield 1.0; this.strikeBox(x - 22, a.y * TS, 44, a.h * TS, 26, 0.2, { kb: 300 }); this.world.fx.burst(x, this.floorY - 20, ['#ffffff', '#9af0ff'], 110, 0.6, 3); this.world.shake(8); this.pose = 'idle'; yield 0.8;
  }
  // ---- Phase 2 ----
  *lightningRain() {
    const a = this.arena, pl = this.player; this.pose = 'raise'; this.sfx('thunder'); const xs = [];
    for (let i = 0; i < 7; i++) { const x = i < 3 ? clamp(pl.x + (i - 1) * 70, (a.x + 3) * TS, (a.x + a.w - 3) * TS) : (a.x + 6 + Math.random() * (a.w - 12)) * TS; xs.push(x); this.teleRect(x - 20, a.y * TS, 40, a.h * TS, 0.9 + i * 0.12); }
    yield 0.9; for (let i = 0; i < xs.length; i++) { this.strikeBox(xs[i] - 18, a.y * TS, 36, a.h * TS, 22, 0.15, { kb: 220 }); this.world.fx.burst(xs[i], this.floorY - 30, ['#ffffff', '#b0e0ff'], 70, 0.4, 3); this.sfx('thunder'); yield 0.12; }
    this.world.shake(6); this.pose = 'idle'; yield 0.8;
  }
  *whirlpools() {
    const a = this.arena; this.pose = 'cast'; this.sfx('whirl'); yield 0.5;
    for (const fx of [0.3, 0.7]) this.world.addField({ kind: 'whirl', team: 'enemy', x: (a.x + a.w * fx) * TS, y: this.floorY - 90, r: 64, life: 9, dps: 7, pull: 70 });
    this.world.fx.text(this.x, this.y - 80, 'WHIRLPOOLS', '#9ad8ff', true); this.pose = 'idle'; yield 1;
  }
  *summonTide() { this.pose = 'roar'; this.sfx('roar'); yield 0.6; const a = this.arena; this.summon('stormhorse', (a.x + 10) * TS, (a.y + 16) * TS); this.summon('tidewisp', (a.x + a.w - 10) * TS, (a.y + 20) * TS); this.pose = 'idle'; yield 1; }
  // ---- Phase 3 ----
  *drownedGrasp() {
    const pl = this.player, a = this.arena; this.pose = 'cast'; this.sfx('roar'); const xs = [pl.x, pl.x - 90, pl.x + 90, pl.x + (Math.random() - 0.5) * 300].map((x) => clamp(x, (a.x + 4) * TS, (a.x + a.w - 4) * TS));
    xs.forEach((x, i) => this.teleRect(x - 30, this.floorY - 170, 60, 172, 0.9 + i * 0.14)); yield 0.9;
    for (const x of xs) { this.strikeBox(x - 28, this.floorY - 170, 56, 172, 28, 0.25, { kb: 320 }); this.world.fx.burst(x, this.floorY - 70, ['#0a2030', '#40e0ff', '#ffffff'], 90, 0.7, 3); this.sfx('boom'); yield 0.14; }
    this.world.shake(9); this.pose = 'idle'; yield 0.7;
  }
  *voidBeam() {
    const pl = this.player; this.pose = 'cast'; this.faceTo(pl.x); const sx = this.x + this.facing * 50, sy = this.y - 20; let ang = Math.atan2(pl.y - sy, pl.x - sx); const sweep = (this.facing > 0 ? 1 : -1) * 1.5 * (Math.random() < 0.5 ? 1 : -1);
    const tl = this.tele({ kind: 'line', x: sx, y: sy, x2: sx + Math.cos(ang) * 900, y2: sy + Math.sin(ang) * 900, w: 8, dur: 1.2, color: '#ff4a8a' }); this.sfx('whirl'); yield 1.2; tl.dur = 0; this.sfx('beam');
    const T = 1.9; let t = 0; const a0 = ang; const live = this.tele({ kind: 'line', x: sx, y: sy, x2: sx, y2: sy, w: 16, dur: T + 0.2, color: '#40e0ff' });
    while (t < T) { ang = a0 + sweep * (t / T); live.x2 = sx + Math.cos(ang) * 900; live.y2 = sy + Math.sin(ang) * 900; live.t = 0.9 * live.dur; for (let r = 30; r < 760; r += 26) this.strikeBox(sx + Math.cos(ang) * r - 14, sy + Math.sin(ang) * r - 14, 28, 28, 18, 0.06, { kb: 160 }); if (Math.floor(t * 60) % 4 === 0) this.world.shake(2); t += 1 / 60; yield 1 / 60; }
    live.dur = 0; this.pose = 'idle'; yield 0.6;
  }
  *floodVents() {
    const a = this.arena; this.pose = 'roar'; this.sfx('bosswarn'); yield 0.5; const w = this.world, areas = [];
    for (let i = 0; i < 5; i++) { const x = (a.x + 8 + i * ((a.w - 16) / 4)) * TS; const ar = { kind: 'vent', x: x - 24, y: this.floorY - 140, w: 48, h: 142, period: 3.6, on: 1.3, dmg: 24, phase: i * 0.7 }; w.zone.areas.push(ar); areas.push(ar); this.teleRect(x - 24, this.floorY - 140, 48, 142, 0.9, { color: '#40e0ff' }); }
    this.pose = 'idle'; yield 7; for (const ar of areas) w.zone.areas.splice(w.zone.areas.indexOf(ar), 1);
  }
  *tentacleRain() {
    const a = this.arena; this.pose = 'cast'; this.sfx('roar'); yield 0.5;
    for (let i = 0; i < 16; i++) { const x = (a.x + 4 + Math.random() * (a.w - 8)) * TS; this.world.addProjectile({ kind: 'orb', team: 'enemy', x, y: (a.y + 1) * TS, vx: 0, vy: 90, dmg: Math.round(14 * this.dmgMult), grav: 160, life: 3.5, boss: true, ghost: true, trail: '#40e0ff' }); yield 0.18; }
    this.pose = 'idle'; yield 0.8;
  }
  *abyssRoar() {
    this.pose = 'roar'; this.sfx('roar'); this.teleCircle(this.x, this.y, 170, 1.0); yield 1.0; this.sfx('boom'); this.world.shake(10); this.world.fx.ring(this.x, this.y, 10, 190, 0.6, '#40e0ff', 4);
    this.strikeBox(this.x - 170, this.y - 170, 340, 340, 26, 0.2, { kb: 340 }); yield 1.0; this.pose = 'idle';
  }
  // ---- Final phase: duel of ultimates ----
  *lastTide() {
    const pl = this.player, w = this.world, a = this.arena; this.pose = 'cast'; yield* this.moveTo((a.x + a.w - 24) * TS, this.floorY - 90, 320, 2);
    this.cycle++; this.faceTo(pl.x); this.pose = 'raise'; this.sfx('bosswarn'); w.fx.text(this.x, this.y - 100, 'THE LAST TIDE', '#ffe890', true, { life: 1.8 }); w.game.toast('Unleash your Ultimate (Q) to meet the Last Tide!', '#9af0ff');
    pl.fury = 100; this.waitUlt = true; this.clashed = false; const t0 = this.t;
    const tl = this.teleRect((a.x + 1) * TS, a.y * TS, (a.w - 2) * TS, a.h * TS, 4.2, { color: '#40e0ff', fill: 'h' });
    let counter = null; const onUlt = () => { counter = true; };
    while (this.t - t0 < 4.2 && !this.clashed) { this.vx = this.vy = 0; if (pl.state === 'ult' || pl.surge > 0) { this.clashed = true; } if (Math.random() < 0.4) w.fx.add({ x: this.x + (Math.random() - 0.5) * 120, y: this.y + (Math.random() - 0.5) * 120, vx: 0, vy: -20, life: 0.7, size: 2, color: '#9af0ff', shrink: true }); yield 1 / 60; }
    this.waitUlt = false; tl.dur = 0;
    if (this.clashed) {
      this.sfx('boom'); w.flash = 0.9; w.shake(14); w.game.hitstop(14); w.fx.ring((this.x + pl.x) / 2, this.y, 10, 260, 0.9, '#ffffff', 5);
      this.hp -= this.maxHp * 0.055; this.hp = Math.max(1, this.hp); w.fx.text(this.x, this.y - 70, 'TIDES COLLIDE', '#ffffff', true, { life: 1.4 }); this.breakArmor();
      this.clashCount = (this.clashCount || 0) + 1; yield 1.2;
      if (this.hp <= this.maxHp * 0.03) { this.hp = 0; this.die(); }
    } else {
      this.sfx('wave'); w.shake(12); for (let i = 0; i < 3; i++) w.addProjectile({ kind: 'water', team: 'enemy', x: (a.x + a.w - 2) * TS, y: this.floorY - 40 - i * 80, w: 60, h: 90, vx: -380, vy: 0, dmg: Math.round(34 * this.dmgMult), life: 3.5, scale: 4, ghost: true, pierce: true, boss: true, unblockable: true, trail: '#9af0ff' });
      yield 2.2;
    }
    this.pose = 'idle'; if (!this.dying) yield 0.3;
  }
  // ---- defeat: the choice ----
  die(silent, hit) { if (this.dying) return; super.die(silent, hit); }
  *afterDefeat() {
    const w = this.world, g = w.game, S = g.state; w.player.locked = true; w.slowT = 0; w.fields.length = 0; this.vents.length = 0; yield 0.5;
    const pearls = [1, 2, 3, 4, 5, 6, 7].filter((n) => g.hasItem('mp' + n)).length;
    const secret = S.form === 'primordial' && pearls >= 7;
    const mercy = pearls >= 5 && g.flag('hatchlings_freed') && (g.flag('aurelia_redeemed') || g.flag('krael_freed'));
    let pick = '';
    yield* this.talk(function* (c) {
      yield c.say('...There. It is done. You are very good. You are very, very good. I think... I am glad.', 'Poseidon');
      yield c.say('I never wanted to rule. I wanted to be the lock. Every child I fed it kept the door shut one more year, and I told myself the sea had not been this safe in an age. I told myself this very often.', 'Poseidon');
      const opts = ['Strike him down. End the tyrant.', 'Take the Trident. Become the new Warden.'], keys = ['slay', 'trident'];
      if (mercy) { opts.push('Offer your claw. Share the Seal.'); keys.push('mercy'); }
      if (secret) { opts.push('Look into the water. Remember.'); keys.push('secret'); }
      const i = yield c.ask('The Trident hangs in the water between you. The Hollow stirs below.', opts, 'You');
      pick = keys[i];
    });
    g.state.endingPick = pick; g.setFlag('ending_' + pick);
    yield 0.3;
  }
  onFinished() { const g = this.world.game; g.state.endingPick = g.state.endingPick || 'slay'; g.systems.endings.play(g.state.endingPick); }
  draw(ctx, cam) {
    if (this.alpha <= 0) return;
    const phase = this.phaseIdx + (this.dying ? 0 : 0), pose = this.pose === 'stagger' ? 'idle' : this.pose === 'windup' ? 'raise' : this.pose === 'swing' ? 'thrust' : this.pose === 'open' ? 'roar' : this.pose;
    const f = enemyFrame(this.key + phase, { ...this.def.sprite, o: { phase } }, pose, Math.floor(this.t * 5));
    drawFrame(ctx, f, this.x - cam.x, this.y - cam.y, this.facing < 0, this.flash > 0, this.alpha);
  }
}
BOSS_CLASSES.poseidon = Poseidon;
