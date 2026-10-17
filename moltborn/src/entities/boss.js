// Boss framework: arena lock, phases, scripted attack generators, telegraphs, armour/stagger, defeat sequence.
// A boss class sets static `def` and implements attack generators (*name) listed per phase.
import { Enemy } from './enemy.js';
import { ENEMIES } from '../data/enemies.js';
import { Script, clamp, rng } from '../core/util.js';
import { moveBody } from '../world/physics.js';
import { TS } from '../world/tiles.js';
import { drawText, textWidth } from '../gfx/font.js';

const rand = rng(6161);

export class Boss extends Enemy {
  constructor(world, x, y, spawn = {}) {
    const def = new.target.def; ENEMIES[def.key] = { noop: true, ai: 'noop', boss: true, dmg: def.contact ?? 0, anchor: 'center', fps: 6, coins: null, ...def, sprite: def.sprite || { plan: 'wisp', w: 8, h: 8, ax: 4, ay: 4, frames: 1, o: {} } };
    super(world, def.key, x, y, { facing: -1 });
    this.def = ENEMIES[def.key]; this.key = def.key; this.displayName = def.name; this.maxHp = this.hp = Math.round(def.hp * (spawn.hpMult || 1)); this.spawn = spawn;
    this.arena = spawn.arena; this.trigger = spawn.trigger || spawn.arena; this.barriers = spawn.barriers || []; this.engaged = false; this.phaseIdx = 0; this.teles = [];
    this.armorMax = def.armor ?? 60; this.armor = this.armorMax; this.armorBar = this.armorMax > 0 ? 1 : 0; this.poiseShown = 1; this.staggerT = 0; this.invuln = true; this.transT = 0; this.script = null; this.deathScript = null;
    this.phases = def.phases; this.phaseMarks = this.phases.slice(1).map((p) => p.at); this.rage = 0; this.lastAtk = ''; this.restMul = 1; this.noKnock = true; this.dying = false; this.finished = false; this.dmgMult = 1; this.facing = -1; this.home = { x, y };
    this.intro = spawn.intro; this.cooldownT = 0; this.alpha = 1;
    this.setState('idle');
    world.overlayExtra.push((ctx, cam) => { this._ov = true; this.drawTeles(ctx, cam); this._ov = false; });
  }
  get phase() { return this.phases[this.phaseIdx]; }
  get player() { return this.world.player; }
  canBeHit() { return this.alive && !this.dying && !this.invuln && this.engaged; }
  hurtBox() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }

  // ---- encounter lifecycle ---------------------------------------------------------------------
  checkEngage() {
    const pl = this.player, t = this.trigger; if (!t || this.engaged) return;
    if (pl.x > t.x * TS && pl.x < (t.x + t.w) * TS && pl.y > t.y * TS && pl.y < (t.y + t.h) * TS) this.engage();
  }
  engage() {
    if (this.engaged || this.engaging) return; this.engaging = true;
    const w = this.world, g = w.game;
    const begin = () => {
      this.engaged = true; this.engaging = false; this.invuln = false;
      w.setBarrier(this.barriers, true); if (this.arena) w.lockCamera(this.arena);
      g.audio.sfx('bosswarn'); g.audio.music.play(this.def.music || 'boss'); w.shake(4); g.banner(this.def.name.toUpperCase(), this.def.title || 'Boss'); w.flash = 0.2;
      this.startBrain(); g.events.emit('bossengage', this.key);
    };
    if (this.intro) { w.player.locked = true; g.systems.dialogue.run(this.intro, this.def.npc || null, null, () => { w.player.locked = false; begin(); }); }
    else begin();
  }
  startBrain() { this.script = new Script(this.brain()); }
  *brain() {
    yield 0.8;
    for (;;) {
      const name = this.pickAttack();
      this.lastAtk = name; this.setState('attack'); this.pose = 'idle';
      yield* this[name]();
      this.pose = 'idle'; this.setState('idle'); this.vx = 0;
      yield this.rest();
    }
  }
  rest() { return (this.phase.rest ?? 1.1) * this.restMul; }
  pickAttack() {
    const list = this.phase.attacks.filter(([n]) => n !== this.lastAtk || this.phase.attacks.length === 1);
    const tot = list.reduce((s, a) => s + (a[1] ?? 1), 0); let r = rand() * tot;
    for (const a of list) { r -= a[1] ?? 1; if (r <= 0) return a[0]; } return list[0][0];
  }
  // ---- phases --------------------------------------------------------------------------------------------
  checkPhase() {
    const next = this.phases[this.phaseIdx + 1];
    if (next && this.hp / this.maxHp <= next.at && !this.transT) this.beginPhase(this.phaseIdx + 1);
  }
  beginPhase(i) {
    this.phaseIdx = i; this.transT = 0.01; this.invuln = true; this.script = null; this.teles = []; this.vx = this.vy = 0;
    const w = this.world; w.game.hitstop(14); w.shake(8); w.flash = 0.3; w.fx.ring(this.x, this.y, 8, 140, 0.7, '#ffffff', 3); this.sfx('roar');
    w.fx.text(this.x, this.y - this.h / 2 - 14, (this.phase.name || 'PHASE ' + (i + 1)).toUpperCase(), '#ffd84a', true, { life: 1.6 });
    for (const e of w.enemies) if (e !== this && e.minion) e.hp = 0;
    this.pose = 'roar'; this.phase.onEnter?.(this);
  }
  // ---- armour / stagger ----------------------------------------------------------------------------------------
  takeParried() { this.armor = 0; this.breakArmor(); }
  breakArmor() {
    if (this.staggerT > 0 || this.armorMax <= 0 || this.transT) return;
    this.staggerT = this.def.staggerTime ?? 2.2; this.script = null; this.teles = []; this.vx = this.vy *= 0.2; this.pose = 'stagger'; this.contactMult = 0;
    this.world.fx.text(this.x, this.y - this.h / 2 - 10, 'STAGGERED', '#ffd84a', true); this.world.fx.ring(this.x, this.y, 4, 70, 0.4, '#ffd84a', 2); this.sfx('clang'); this.world.game.hitstop(6);
  }
  takeHit(hit, player) {
    if (!this.canBeHit()) return false;
    const w = this.world, dir = hit.dir ?? 1;
    let dmg = hit.dmg * (this.staggerT > 0 ? 1.35 : 1) * (this.phase.dmgTaken ?? 1); dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg; this.flash = 0.08;
    w.fx.text(this.x + (rand() - 0.5) * 20, this.y - this.h / 2 + (rand() - 0.5) * 12, dmg, hit.crit ? '#ffd84a' : '#ffffff', !!hit.crit);
    w.fx.burst(this.x + (rand() - 0.5) * this.w * 0.6, this.y + (rand() - 0.5) * this.h * 0.5, hit.crit ? ['#fff6a8', '#fff'] : ['#ffffff', '#ffe0c0', '#ff9a6a'], 60, 0.3, 2);
    if (hit.stop) w.game.hitstop(hit.stop); if (hit.shake) w.shake(hit.shake * 0.7);
    this.sfx(hit.heavy ? 'heavyhit' : hit.crit ? 'crit' : 'hit');
    if (this.armorMax > 0 && this.staggerT <= 0 && !this.transT) { this.armor -= (hit.poise || 0) * (this.def.poiseMult ?? 0.4) + (hit.guardBreak ? this.armorMax * 0.2 : 0); this.armorRegenT = 2.5; if (this.armor <= 0) this.breakArmor(); }
    if (hit.status?.poison) this.applyStatus({ poison: Math.max(1, Math.round(hit.status.poison * 0.5)) });
    if (this.hp <= 0) { this.hp = 0; this.die(false, hit); } else this.checkPhase();
    return true;
  }
  die(silent, hit) {
    if (this.dying) return; this.dying = true; this.invuln = true; this.script = null; this.teles = []; this.world.setBarrier(this.barriers, false);
    for (const e of this.world.enemies) if (e !== this && e.minion) e.hp = 0; for (const p of this.world.projectiles) if (p.team === 'enemy') p.die(false);
    this.deathScript = new Script(this.defeat()); this.world.game.audio.music.stop?.(1); this.world.game.audio.music.stinger?.('victory');
  }
  *defeat() {
    const w = this.world, g = w.game; w.slowT = 3.2; w.slowFactor = 0.25; w.flash = 0.25; this.sfx('bossdie'); w.shake(10); this.pose = 'stagger';
    for (let i = 0; i < 14; i++) { w.fx.burst(this.x + (rand() - 0.5) * this.w, this.y + (rand() - 0.5) * this.h, ['#ffffff', '#ffd84a', '#ff9a6a'], 100, 0.8, 3); w.fx.ring(this.x + (rand() - 0.5) * this.w * 0.6, this.y + (rand() - 0.5) * this.h * 0.6, 4, 40, 0.5, '#ffffff', 2); yield 0.16; }
    w.flash = 0.8; yield 0.3; this.alpha = 0;
    yield* this.afterDefeat();
    g.state.bosses[this.key] = true; g.setFlag('boss_' + this.key);
    w.lockCamera(null); g.audio.music.play(w.zone.music || w.biome.music);
    const loot = this.def.loot; if (loot) g.grantLoot(loot, this.x, this.y, true);
    g.giveXp(this.def.xp || 100, this.x, this.y); g.events.emit('boss', this.key); g.saveGame(true);
    this.alive = false; this.finished = true; this.onFinished?.();
  }
  *afterDefeat() {}
  // ---- update ---------------------------------------------------------------------------------------------------
  update(dt) {
    this.t += dt; this.st += dt; this.flash = Math.max(0, this.flash - dt);
    if (this.dying) { this.deathScript?.step(dt / Math.max(0.0001, this.world.slowT > 0 ? this.world.slowFactor : 1)); return; }
    if (!this.engaged) { this.checkEngage(); this.idleAnim?.(dt); return; }
    const w = this.world, pl = this.player;
    if (this.statuses.poison) { const ps = this.statuses.poison; ps.t -= dt; ps.acc = (ps.acc || 0) + dt; if (ps.acc >= 0.5) { ps.acc = 0; this.hp -= ps.dps; w.fx.text(this.x, this.y - 20, ps.dps, '#8aff8a'); if (this.hp <= 0) { this.die(); return; } } if (ps.t <= 0) delete this.statuses.poison; }
    if (this.transT) { this.transT += dt; if (this.transT > (this.phase.transTime ?? 1.6)) { this.transT = 0; this.invuln = false; this.startBrain(); } }
    else if (this.staggerT > 0) { this.staggerT -= dt; this.vx *= Math.exp(-5 * dt); if (this.staggerT <= 0) { this.armor = this.armorMax; this.contactMult = 1; this.pose = 'idle'; this.startBrain(); } }
    else {
      this.script?.step(dt);
      if (this.armorMax > 0) { this.armorRegenT = (this.armorRegenT ?? 0) - dt; if (this.armorRegenT <= 0) this.armor = Math.min(this.armorMax, this.armor + this.armorMax * 0.12 * dt); }
    }
    for (const t of this.teles) t.t += dt; this.teles = this.teles.filter((t) => t.t < t.dur + 0.12);
    this.poiseShown += ((this.staggerT > 0 ? 0 : this.armor / this.armorMax) - this.poiseShown) * Math.min(1, dt * 8);
    this.physics?.(dt);
    this.rage = 1 - this.hp / this.maxHp;
    if (this.def.dmg > 0 && this.contactCd <= 0 && pl.alive && !this.transT) { this.contactCd -= dt; }
    this.contactCd -= dt;
    if (this.def.dmg > 0 && this.contactCd <= 0 && pl.alive && this.staggerT <= 0 && !this.transT) {
      for (const b of this.hurtBoxes ? this.hurtBoxes() : [this.hurtBox()]) { if (pl.hurtBox().x < b.x + b.w && pl.hurtBox().x + pl.hurtBox().w > b.x && pl.hurtBox().y < b.y + b.h && pl.hurtBox().y + pl.hurtBox().h > b.y) { this.contactCd = 0.8; pl.takeHit({ dmg: Math.round(this.def.dmg * (this.contactMult || 1)), x: this.x, y: this.y, kb: 140, source: this, boss: true }); break; } }
    }
  }
  // ---- helpers for attack scripts ----------------------------------------------------------------------------------------
  tele(o) { const t = { t: 0, dur: 0.8, color: '#ff4a3a', ...o }; this.teles.push(t); return t; }
  teleRect(x, y, w, h, dur = 0.8, o = {}) { return this.tele({ kind: 'rect', x, y, w, h, dur, ...o }); }
  teleCircle(x, y, r, dur = 0.8, o = {}) { return this.tele({ kind: 'circle', x, y, r, dur, ...o }); }
  strikeBox(x, y, w, h, dmg, life = 0.15, o = {}) { this.world.spawnHitbox({ team: 'enemy', x, y, w, h, dmg: Math.round(dmg * (this.dmgMult || 1)), life, kb: o.kb ?? 150, poise: 20, owner: this, boss: true, unblockable: o.unblockable, status: o.status }); }
  shootAt(kind, dmg, speed, o = {}) {
    const pl = this.player, ox = o.x ?? this.x, oy = o.y ?? this.y, a = Math.atan2(pl.y - oy, pl.x - ox) + (o.angle || 0);
    return this.world.addProjectile({ kind, team: 'enemy', x: ox, y: oy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: Math.round(dmg * (this.dmgMult || 1)), grav: o.grav || 0, life: o.life || 3, kb: 110, boss: true, ghost: o.ghost, homing: o.homing || 0, trail: o.trail, scale: o.scale, pierce: o.pierce });
  }
  shootDir(kind, dmg, ang, speed, o = {}) { return this.world.addProjectile({ kind, team: 'enemy', x: o.x ?? this.x, y: o.y ?? this.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg: Math.round(dmg * (this.dmgMult || 1)), grav: o.grav || 0, life: o.life || 3, kb: 110, boss: true, ghost: o.ghost, trail: o.trail, scale: o.scale, pierce: o.pierce, homing: o.homing || 0 }); }
  summon(type, x, y, o = {}) { const w = this.world, e = new (Enemy)(w, type, x, y, { floor: false, ...o }); e.minion = true; e.xpMult = 0; e.def = { ...e.def, coins: null }; w.enemies.push(e); w.fx.ring(x, y, 2, 20, 0.3, '#ff9aff', 2); return e; }
  flyPhysics(dt, m = 3) { const a = this.arena; this.x += this.vx * dt; this.y += this.vy * dt; if (a) { this.x = clamp(this.x, (a.x + m) * TS, (a.x + a.w - m) * TS); this.y = clamp(this.y, (a.y + m) * TS, (a.y + a.h - m) * TS); } }
  // run a dialogue generator and wait for it (use with yield*)
  *talk(fn, npc = null) { let done = false; this.world.player.locked = true; this.world.game.systems.dialogue.run(fn, npc, null, () => { done = true; }); while (!done) yield 0.1; this.world.player.locked = false; }
  faceTo(x) { this.facing = x >= this.x ? 1 : -1; }
  *moveTo(tx, ty, speed, maxT = 3, tol = 4) { let t = 0; while (t < maxT) { const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy); if (d < tol) break; this.vx = dx / d * speed; this.vy = dy / d * speed; t += 1 / 60; yield 1 / 60; } this.vx = this.vy = 0; }
  // ---- drawing -------------------------------------------------------------------------------------------------------------
  drawTeles(ctx, cam) {
    if (!this._ov) return;
    for (const t of this.teles) {
      const k = Math.min(1, t.t / t.dur), pulse = 0.1 + 0.05 * Math.sin(t.t * 30), a = t.t > t.dur ? 0.5 : pulse + k * 0.16;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = t.color; ctx.strokeStyle = '#ffffff';
      if (t.kind === 'rect') { const x = Math.round(t.x - cam.x), y = Math.round(t.y - cam.y); ctx.fillRect(x, y, t.w, t.h); ctx.globalAlpha = 0.9; ctx.strokeRect(x + 0.5, y + 0.5, t.w - 1, t.h - 1); ctx.globalAlpha = 0.5; const fh = Math.round(t.h * k), fw = Math.round(t.w * k); if (t.fill === 'h') { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, fw, t.h); } else if (t.fill !== false) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y + t.h - fh, t.w, fh); } }
      else if (t.kind === 'line') { ctx.globalAlpha = a; ctx.strokeStyle = t.color; ctx.lineWidth = t.w || 6; ctx.beginPath(); ctx.moveTo(Math.round(t.x - cam.x), Math.round(t.y - cam.y)); ctx.lineTo(Math.round(t.x2 - cam.x), Math.round(t.y2 - cam.y)); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); }
      else if (t.kind === 'circle') { ctx.beginPath(); ctx.arc(Math.round(t.x - cam.x) + 0.5, Math.round(t.y - cam.y) + 0.5, t.r, 0, 6.3); ctx.fill(); ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(Math.round(t.x - cam.x) + 0.5, Math.round(t.y - cam.y) + 0.5, t.r * k, 0, 6.3); ctx.fill(); }
      ctx.restore();
    }
  }
}
