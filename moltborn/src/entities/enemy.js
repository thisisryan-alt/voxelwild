// Enemy entity: data-driven (data/enemies.js) with behaviours from ai.js. Handles hits, guard, poise,
// status effects, drops and drawing.
import { Entity, Projectile, Pickup, drawFrame, blobShadow } from './entity.js';
import { moveBody } from '../world/physics.js';
import { AI } from './ai.js';
import { ENEMIES } from '../data/enemies.js';
import { enemyFrame } from '../gfx/sprites_enemies.js';
import { rng, clamp } from '../core/util.js';
import { chestFrame } from '../gfx/sprites_ui.js';

const rand = rng(31337);

export class Enemy extends Entity {
  constructor(world, type, x, y, o = {}) {
    const def = ENEMIES[type];
    if (!def) throw new Error('unknown enemy ' + type);
    super(world, x, y, def.w, def.h);
    this.type = type; this.def = def; this.p = { ...def.p, ...(o.p || {}) };
    this.maxHp = Math.round(def.hp * (o.hpMult || 1)); this.hp = this.maxHp;
    this.maxPoise = def.poise ?? 8; this.poise = this.maxPoise;
    this.state = ''; this.st = 0; this.pose = 'move'; this.flash = 0; this.stunT = 0; this.invuln = false; this.scale = 1;
    this.contactMult = 1; this.contactCd = 0; this.losT = 0; this.los = false; this.a = null; this.phased = false; this.disguised = false;
    this.guardFront = false; this.guardAll = false; this.tuckT = 0; this.statuses = {}; this.ghost = !!def.ghost; this.slowT = 0; this.weakT = 0;
    this.xpMult = o.xpMult || 1; this.spawnId = o.spawnId; this.persistKey = o.persistKey; this.group = o.group;
    this.behaviour = AI[def.ai];
    this.facing = o.facing || (rand() < 0.5 ? -1 : 1);
    this.alpha = 1; this.deathT = 0; this.dying = false;
    if (def.anchor !== 'center' && o.floor !== false) { /* feet-anchored: y given as feet */ }
    this.behaviour.init(this);
  }
  setState(s) { this.state = s; this.st = 0; if (s === 'windup' || s === 'attack' || s === 'guard') this.pose = s; else if (s !== 'hidden') this.pose = 'move'; }
  sfx(n) { this.world.game.audio.sfx(n, { x: this.x, y: this.y }); }
  alertFx() { this.world.fx.text(this.x, this.y - this.h / 2 - 8, '!', '#ff6a5a', false, { life: 0.5, vy: -10 }); this.sfx('alert'); }
  stun(t) { this.stunT = Math.max(this.stunT, t); }
  canBeHit() { return this.alive && !this.dying && !this.invuln && !this.def.friendly && !this.phased && this.state !== 'hidden' && !this.disguised; }
  hurtBox() { const s = this.scale; return { x: this.x - this.w * s / 2, y: this.y - this.h * s / 2, w: this.w * s, h: this.h * s }; }
  dmgNow() { return Math.round(this.def.dmg * (this.dmgMult || 1) * (1 + (this.world.difficulty || 0) * 0)); }
  strike(rel, dmg, life = 0.12, o = {}) { this.world.spawnHitbox({ team: 'enemy', x: this.x + rel.x - rel.w / 2, y: this.y + rel.y - rel.h / 2, w: rel.w, h: rel.h, dmg, life, kb: o.kb ?? 100, poise: 8, owner: this, follow: this, status: o.status || this.def.status, unblockable: o.unblockable }); }
  shoot() {
    const sh = this.def.shoot; if (!sh) return;
    const pl = this.world.player, ox = this.x + this.facing * (this.w / 2), oy = this.y - this.h * 0.15;
    let base = sh.aim === 'dir' ? (this.facing > 0 ? 0 : Math.PI) : Math.atan2(pl.y - oy, pl.x - ox);
    if (sh.lead) base = Math.atan2(pl.y + pl.vy * 0.3 - oy, pl.x + pl.vx * 0.3 - ox);
    const n = sh.count || 1, spread = sh.spread || 0.3;
    for (let i = 0; i < n; i++) {
      const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * 2);
      let vx = Math.cos(a) * sh.speed, vy = Math.sin(a) * sh.speed;
      if (sh.arc) vy -= sh.arc;
      this.world.addProjectile({ kind: sh.kind, team: 'enemy', x: ox, y: oy, vx, vy, dmg: this.dmgNow() * (sh.dmgMult || 1), grav: sh.grav || 0, life: sh.life || 3, status: sh.status || this.def.status, homing: sh.homing || 0, ghost: !!sh.ghost, kb: 80, trail: sh.trail });
    }
    this.sfx(sh.sfx || 'shoot');
  }
  burst() {
    const w = this.world, r = this.p.burstR + 8;
    w.fx.burst(this.x, this.y, ['#ffffff', '#f8f0d8', '#ffd0a0'], 120, 0.5, 2); w.fx.ring(this.x, this.y, 4, r, 0.3, '#fff6c8');
    w.spawnHitbox({ team: 'enemy', x: this.x - r, y: this.y - r, w: r * 2, h: r * 2, dmg: this.dmgNow(), life: 0.1, kb: 140, owner: this });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; w.addProjectile({ kind: 'dart', team: 'enemy', x: this.x, y: this.y, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, dmg: Math.round(this.dmgNow() * 0.6), life: 0.9, kb: 60 }); }
    this.sfx('boom'); w.shake(3); this.die(true);
  }

  takeHit(hit, player) {
    if (!this.canBeHit()) return false;
    const w = this.world, dir = hit.dir ?? (this.x >= (hit.x ?? player.x) ? 1 : -1);
    // guard checks
    const frontal = (this.facing > 0 && dir < 0) || (this.facing < 0 && dir > 0);
    const guarded = (this.guardAll || (this.guardFront && frontal)) && !hit.guardBreak;
    if (guarded) {
      w.fx.burst(this.x + dir * -this.w / 2, this.y, ['#ffffff', '#cfe4ff'], 50, 0.25, 2); w.fx.text(this.x, this.y - this.h / 2 - 6, 'BLOCKED', '#9ab8e0');
      this.sfx('clang'); this.vx += dir * 20; if (player) player.onBlockedHit(this, hit);
      w.game.hitstop(3);
      return 'blocked';
    }
    if (hit.guardBreak && (this.guardAll || this.guardFront)) { this.tuckT = 0; this.stun(0.9); w.fx.text(this.x, this.y - this.h / 2 - 8, 'GUARD BREAK', '#ffd84a'); this.guardFront = false; }
    let dmg = hit.dmg;
    if (this.weakT > 0) dmg *= 1.25;
    if (this.tuckT > 0 || this.guardAll) dmg *= 0.25;
    dmg = Math.max(1, Math.round(dmg));
    this.hp -= dmg; this.flash = 0.09;
    w.fx.text(this.x + (rand() - 0.5) * 6, this.y - this.h / 2 - 4, dmg, hit.crit ? '#ffd84a' : '#ffffff', !!hit.crit);
    w.fx.burst(this.x, this.y, hit.crit ? ['#fff6a8', '#ffffff'] : ['#ffffff', '#ffe0c0', '#ff9a6a'], hit.crit ? 80 : 50, 0.3, 2);
    w.fx.impact(this.x - dir * this.w * 0.4, this.y + (rand() - 0.5) * this.h * 0.4, -dir, { crit: !!hit.crit, size: hit.heavy ? 10 : undefined, sparks: hit.heavy ? 11 : undefined });
    w.fx.foam(this.x - dir * this.w / 2, this.y, -dir, 3);
    if (hit.stop) w.game.hitstop(hit.stop);
    if (hit.shake) w.shake(hit.shake);
    this.sfx(hit.crit ? 'crit' : (hit.heavy ? 'heavyhit' : 'hit'));
    const mass = this.def.mass || 1;
    if (!this.def.noKnock && !this.noKnock) { this.vx += dir * (hit.kb || 60) / mass; if (!this.onGround || this.def.flying) this.vy += -10; }
    this.poise -= hit.poise || 0;
    if (hit.stun) this.stun(hit.stun);
    if (this.poise <= 0 && !this.def.noStagger) { this.poise = this.maxPoise; this.stun(0.55 + (hit.heavy ? 0.3 : 0)); this.state !== 'hidden' && (this.pose = 'move'); }
    if (hit.status) this.applyStatus(hit.status);
    if (this.behaviour.onHurt) this.behaviour.onHurt(this, hit);
    if (this.def.spiky && !hit.ranged && player && !hit.fromAbility) player.takeHit({ dmg: 3, x: this.x, y: this.y, kb: 60, thorn: true });
    if (this.hp <= 0) this.die(false, hit);
    return true;
  }
  applyStatus(s) {
    if (s.poison) this.statuses.poison = { t: 4, dps: s.poison };
    if (s.slow) this.slowT = Math.max(this.slowT, s.slow);
    if (s.weak) this.weakT = Math.max(this.weakT, s.weak);
    if (s.stun) this.stun(s.stun);
  }
  die(silent, hit) {
    if (this.dying) return; this.dying = true; this.alive = false;
    const w = this.world, d = this.def, g = w.game;
    w.fx.burst(this.x, this.y, ['#ffffff', '#ffd0a0', this.def.sprite.o?.ramp?.hex?.[3] || '#ff9a6a'], 160, 0.55, 3);
    w.fx.ring(this.x, this.y, 3, 28, 0.3, '#ffffff', 1);
    for (let i = 0; i < 4; i++) w.fx.bubble(this.x, this.y, 1, 10, -30);
    if (!d.boss && !this.disguised && this.state !== 'hidden') { // the body breaks into its own pixels
      const f = enemyFrame(this.type, d.sprite, this.pose, Math.floor(this.t * (d.fps || 8))), feet = d.anchor !== 'center';
      w.fx.debris(f, this.x, feet ? this.y + this.h / 2 : this.y, this.facing < 0 !== (d.sprite.flip === true), clamp(Math.round(f.w * f.h / 60), 14, 46), 70, { vx: (hit?.dir || 0) * 30 });
    }
    this.sfx(d.boss ? 'bossdie' : 'die');
    if (silent && !d.dropOnBurst) return;
    g.onEnemyKilled(this, hit);
  }
  update(dt) {
    this.t += dt; this.st += dt; this.losT -= dt; this.flash = Math.max(0, this.flash - dt); this.contactCd -= dt;
    const w = this.world, pl = w.player;
    if (this.slowT > 0) this.slowT -= dt; if (this.weakT > 0) this.weakT -= dt;
    if (this.statuses.poison) { const ps = this.statuses.poison; ps.t -= dt; ps.acc = (ps.acc || 0) + dt; if (ps.acc >= 0.5) { ps.acc = 0; this.hp -= ps.dps; w.fx.text(this.x, this.y - this.h / 2, ps.dps, '#8aff8a'); if (this.hp <= 0) { this.die(false, { poison: true }); return; } } if (ps.t <= 0) delete this.statuses.poison; }
    if (this.stunT > 0) {
      this.stunT -= dt; this.vx *= Math.exp(-6 * dt); this.vy = this.def.flying ? this.vy * Math.exp(-4 * dt) : Math.min(this.vy + 230 * dt, 140);
      moveBody(w.grid, this, dt, { ghost: this.ghost }); return;
    }
    // far-away enemies sleep (cheap)
    if (pl && Math.abs(pl.x - this.x) > 420 && Math.abs(pl.y - this.y) > 300) return;
    const slow = this.slowT > 0 ? 0.5 : 1;
    this.behaviour.update(this, dt * slow, w);
    moveBody(w.grid, this, dt * slow, { ghost: this.ghost, step: !this.def.flying && this.def.ai !== 'mimic' });
    if (this.facing === 0) this.facing = 1;
    // contact damage
    if (this.def.dmg > 0 && !this.disguised && !this.phased && this.state !== 'hidden' && this.contactCd <= 0 && pl && pl.alive && this.def.contact !== false) {
      if (this.overlaps(pl.hurtBox())) {
        this.contactCd = 0.7;
        const r = pl.takeHit({ dmg: Math.round(this.dmgNow() * this.contactMult * (this.def.contactMult || 0.8)), x: this.x, y: this.y, kb: 110, status: this.def.status, source: this });
        if (r === 'parried') this.stun(0.8);
      }
    }
  }
  draw(ctx, cam) {
    const d = this.def, sp = d.sprite;
    if (this.state === 'hidden') { // only glinting eyes peek from the hole
      const x = Math.round(this.a.hx - cam.x), y = Math.round(this.a.hy - cam.y);
      if (Math.sin(this.t * 3) > 0.2) { ctx.fillStyle = '#ffe85a'; ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2); }
      return;
    }
    if (this.disguised) { const c = chestFrame(false, 0); ctx.drawImage(c, Math.round(this.x - cam.x - c.width / 2), Math.round(this.y + this.h / 2 - cam.y - c.height)); return; }
    const pose = this.pose;
    const frame = enemyFrame(this.type, sp, pose, Math.floor(this.t * (d.fps || 8)));
    const feet = d.anchor !== 'center';
    const x = this.x - cam.x, y = (feet ? this.y + this.h / 2 : this.y) - cam.y;
    if (feet && this.onGround && this.alive !== false) blobShadow(ctx, x, y, Math.round(this.w * 0.7), 0.24);
    const flash = this.flash > 0 || (this.state === 'windup' && Math.floor(this.st * 14) % 2 === 0 && this.def.dmg > 0 && !d.noBlink);
    let alpha = this.phased ? 0.38 : 1; if (this.stunT > 0 && Math.floor(this.t * 20) % 2) alpha *= 0.85;
    if (this.scale !== 1) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(this.scale, this.scale); drawFrame(ctx, frame, 0, 0, this.facing < 0 !== (sp.flip === true), this.flash > 0, alpha); ctx.restore(); }
    else drawFrame(ctx, frame, x, y, this.facing < 0 !== (sp.flip === true), flash && this.flash > 0 ? true : false, alpha);
    if (this.state === 'windup' && !d.noBlink && this.def.dmg > 0) { // red telegraph pip
      ctx.fillStyle = Math.floor(this.st * 12) % 2 ? '#ff4a3a' : '#ffd0a0'; ctx.fillRect(Math.round(this.x - cam.x) - 1, Math.round(this.y - this.h / 2 - cam.y) - 7, 3, 3);
    }
    if (this.statuses.poison && Math.floor(this.t * 6) % 2) { ctx.fillStyle = '#8aff8a'; ctx.fillRect(Math.round(this.x - cam.x) - 6, Math.round(this.y - this.h / 2 - cam.y) - 4, 2, 2); }
    if (this.hp < this.maxHp && !d.boss && !this.disguised) { // small health bar
      const bw = Math.max(12, this.w), bx = Math.round(this.x - cam.x - bw / 2), by = Math.round(this.y - this.h / 2 - cam.y) - 5 - (d.barLift || 0);
      ctx.fillStyle = '#170d1c'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4); ctx.fillStyle = '#5a1020'; ctx.fillRect(bx, by, bw, 2);
      ctx.fillStyle = '#ff5a4a'; ctx.fillRect(bx, by, Math.round(bw * clamp(this.hp / this.maxHp, 0, 1)), 2);
    }
  }
}
