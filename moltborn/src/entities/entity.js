// Base entity, projectiles, pickups. Bodies use centre x,y and full w,h.
import { moveBody } from '../world/physics.js';
import { rng } from '../core/util.js';
import { Painter, flashOf } from '../gfx/painter.js';
import { R, OUTLINE } from '../gfx/palette.js';
import { coinFrame, pearlFrame, orbFrame, itemIcon } from '../gfx/sprites_ui.js';

const rand = rng(4242);

export function drawFrame(ctx, f, x, y, flip = false, flash = false, alpha = 1) {
  x = Math.round(x); y = Math.round(y);
  if (drawFrame.rec) drawFrame.rec.push({ f, x, y, flip });
  const src = flash ? flashOf(f) : f.canvas;
  if (alpha < 1) ctx.globalAlpha = alpha;
  if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(src, -f.ax, -f.ay); ctx.restore(); }
  else ctx.drawImage(src, x - f.ax, y - f.ay);
  if (alpha < 1) ctx.globalAlpha = 1;
}

// soft contact shadow so characters sit on the seabed instead of floating over it
export function blobShadow(ctx, x, y, rw, a = 0.28) {
  x = Math.round(x); y = Math.round(y); ctx.fillStyle = `rgba(4,10,24,${a})`; ctx.fillRect(x - rw, y, rw * 2, 1); ctx.fillRect(x - rw + 2, y - 1, rw * 2 - 4, 1); ctx.fillRect(x - rw + 2, y + 1, rw * 2 - 4, 1);
}

export class Entity {
  constructor(world, x, y, w, h) {
    this.world = world; this.x = x; this.y = y; this.w = w; this.h = h; this.vx = 0; this.vy = 0;
    this.facing = 1; this.alive = true; this.onGround = false; this.hitX = 0; this.hitY = 0; this.t = 0;
  }
  get left() { return this.x - this.w / 2; } get top() { return this.y - this.h / 2; }
  get right() { return this.x + this.w / 2; } get bottom() { return this.y + this.h / 2; }
  box() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  overlaps(b) { return this.x - this.w / 2 < b.x + b.w && this.x + this.w / 2 > b.x && this.y - this.h / 2 < b.y + b.h && this.y + this.h / 2 > b.y; }
  update(dt) { this.t += dt; }
  draw() {}
}

// ---- projectiles ---------------------------------------------------------------------------
const PROJ = {
  bubble: { w: 8, h: 8, paint: (p) => { p.ellipse(5, 5, 3.8, 3.8, R.lumen, { dither: 0 }); p.px(3, 3, '#fff'); p.px(4, 3, '#fff'); } },
  dart: { w: 8, h: 4, paint: (p) => { p.line(1, 3, 8, 3, '#b8ffb0'); p.line(2, 4, 8, 4, '#23915a'); p.px(9, 3, '#ffffff'); }, size: [12, 7] },
  spore: { w: 7, h: 7, paint: (p) => { p.ellipse(5, 5, 3.4, 3.4, R.fishYellow, { dither: 0 }); p.px(4, 4, '#fff'); p.glow(5, 5, 6, '#e8ff70', 0.4); } },
  cannonball: { w: 9, h: 9, paint: (p) => { p.ellipse(6, 6, 4.5, 4.5, R.chain, { dither: 0.3 }); p.px(4, 4, '#e8e8f8'); }, size: [12, 12] },
  pearl: { w: 7, h: 7, paint: (p) => { p.ellipse(5, 5, 3.4, 3.4, R.pearl, { dither: 0 }); p.px(4, 4, '#fff'); p.glow(5, 5, 6, '#ffffff', 0.4); }, size: [10, 10] },
  water: { w: 14, h: 10, paint: (p) => { p.shape(R.divine, { dither: 0.4 }, (s) => { s.ellipse(9, 6, 6.5, 4); s.poly([[1, 6], [5, 2], [5, 10]]); }); p.px(10, 4, '#fff'); }, size: [18, 12] },
  orb: { w: 10, h: 10, paint: (p) => { p.ellipse(7, 7, 4.5, 4.5, R.abyssal, { dither: 0.3 }); p.px(5, 5, '#fff'); p.glow(7, 7, 8, '#b8a4ff', 0.5); }, size: [14, 14] },
  trident: { w: 22, h: 8, paint: (p) => { p.line(1, 5, 20, 5, R.trident.c[2]); p.line(1, 6, 20, 6, R.trident.c[1]); p.poly([[19, 2], [26, 5.5], [19, 9]], R.trident, {}); p.glow(23, 5, 8, '#9af0ff', 0.4); }, size: [28, 12] },
  shard: { w: 8, h: 8, paint: (p) => { p.poly([[1, 6], [8, 1], [11, 7], [4, 10]], R.glass, {}); }, size: [12, 12] },
  ink: { w: 8, h: 8, paint: (p) => { p.ellipse(5, 5, 3.8, 3.8, R.void, { dither: 0.3 }); p.px(4, 4, '#c8a0ff'); }, size: [10, 10] },
  fire: { w: 8, h: 8, paint: (p) => { p.ellipse(5, 5, 3.6, 3.6, R.coralOrange, { dither: 0.3 }); p.px(4, 4, '#fff6a8'); p.glow(5, 5, 7, '#ffb040', 0.5); }, size: [10, 10] },
};
const pcache = {};
function projFrame(kind) {
  if (pcache[kind]) return pcache[kind];
  const d = PROJ[kind] || PROJ.bubble, [w, h] = d.size || [d.w + 4, d.h + 4];
  const p = new Painter(w, h, OUTLINE); d.paint(p);
  return (pcache[kind] = { canvas: p.toCanvas(), w, h, ax: w / 2, ay: h / 2 });
}

export class Projectile extends Entity {
  constructor(world, o) {
    const d = PROJ[o.kind] || PROJ.bubble;
    super(world, o.x, o.y, o.w || d.w, o.h || d.h);
    Object.assign(this, { kind: o.kind || 'bubble', team: o.team || 'enemy', dmg: o.dmg || 5, vx: o.vx || 0, vy: o.vy || 0, life: o.life ?? 3, grav: o.grav || 0, kb: o.kb ?? 90, pierce: !!o.pierce, homing: o.homing || 0, ghost: !!o.ghost, status: o.status || null, poise: o.poise ?? 6, reflectable: o.reflectable !== false, hits: new Set(), onHit: o.onHit, spin: !!o.spin, trail: o.trail || null, stun: o.stun || 0, unblockable: !!o.unblockable, boss: !!o.boss, bounce: !!o.bounce, scale: o.scale || 1 });
    this.angle = Math.atan2(this.vy, this.vx);
  }
  update(dt) {
    this.t += dt; this.life -= dt;
    if (this.life <= 0) return this.die(false);
    if (this.homing) {
      const tgt = this.team === 'enemy' ? this.world.player : this.world.nearestEnemy(this.x, this.y, 200);
      if (tgt && tgt.alive !== false) { const dx = tgt.x - this.x, dy = tgt.y - this.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(this.vx, this.vy); this.vx += (dx / d * sp - this.vx) * this.homing * dt; this.vy += (dy / d * sp - this.vy) * this.homing * dt; }
    }
    this.vy += this.grav * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.angle = Math.atan2(this.vy, this.vx);
    if (!this.ghost && this.world.grid.solidPx(this.x, this.y)) { if (this.bounce) { this.x -= this.vx * dt; this.y -= this.vy * dt; this.vx *= -1; this.vy *= -0.6; } else return this.die(true); }
    if (this.trail && rand() < 0.5) this.world.fx.add({ x: this.x, y: this.y, life: 0.3, size: 2, color: this.trail, shrink: true, vx: -this.vx * 0.1, vy: -this.vy * 0.1 });
    if (this.team === 'enemy') {
      const pl = this.world.player;
      if (pl && pl.alive && this.overlaps(pl.hurtBox())) {
        const res = pl.takeHit({ dmg: this.dmg, x: this.x - Math.sign(this.vx) * 6, y: this.y, kb: this.kb, status: this.status, proj: this, poise: this.poise, unblockable: this.unblockable, boss: this.boss });
        if (res === 'parried') return;
        if (!this.pierce) this.die(true);
      }
    } else {
      for (const e of this.world.enemies) {
        if (!e.alive || this.hits.has(e) || !e.canBeHit()) continue;
        if ((e.hurtBoxes ? e.hurtBoxes() : [e.hurtBox()]).some((b) => this.x - this.w / 2 < b.x + b.w && this.x + this.w / 2 > b.x && this.y - this.h / 2 < b.y + b.h && this.y + this.h / 2 > b.y)) { this.hits.add(e); e.takeHit({ dmg: this.dmg, dir: Math.sign(this.vx) || 1, kb: this.kb, poise: this.poise, stop: 2, status: this.status, stun: this.stun, ranged: true, x: this.x, y: this.y, fromAbility: true }, this.world.player); if (this.onHit) this.onHit(e, this); if (!this.pierce) { this.die(true); break; } }
      }
    }
  }
  reflect() { this.team = 'player'; this.vx *= -1.3; this.vy *= -1.3; this.dmg = Math.round(this.dmg * 2); this.hits.clear(); this.life = Math.max(this.life, 2); this.world.fx.burst(this.x, this.y, '#ffffff', 40, 0.3, 2); }
  die(hit) { this.alive = false; if (hit) { this.world.fx.burst(this.x, this.y, this.kind === 'cannonball' ? ['#aaa', '#fff'] : ['#ffffff', '#9fd8f0'], 40, 0.3, 2); } }
  draw(ctx, cam) {
    const f = projFrame(this.kind);
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    ctx.save(); ctx.translate(x, y);
    if (!['bubble', 'spore', 'pearl', 'orb', 'cannonball', 'ink', 'fire'].includes(this.kind) || this.spin) ctx.rotate(this.spin ? this.t * 12 : this.angle);
    if (this.scale !== 1) ctx.scale(this.scale, this.scale);
    ctx.drawImage(f.canvas, -f.ax, -f.ay);
    ctx.restore();
  }
}

// ---- pickups -------------------------------------------------------------------------------
export class Pickup extends Entity {
  constructor(world, o) {
    super(world, o.x, o.y, 8, 8);
    Object.assign(this, { kind: o.kind, value: o.value || 1, id: o.id, delay: o.delay ?? 0.35, life: o.life ?? 60, vx: o.vx ?? (rand() - 0.5) * 50, vy: o.vy ?? -30 - rand() * 30, fixed: !!o.fixed, bob: rand() * 6, label: o.label });
  }
  update(dt) {
    this.t += dt; this.delay -= dt;
    const pl = this.world.player;
    if (!this.fixed) {
      this.vx *= Math.exp(-2 * dt); this.vy += 60 * dt; this.vy *= Math.exp(-1.2 * dt);
      moveBody(this.world.grid, this, dt);
      if (this.onGround) this.vy = 0;
    }
    if (pl && pl.alive && this.delay <= 0) {
      const dx = pl.x - this.x, dy = pl.y - this.y, d = Math.hypot(dx, dy), mg = pl.stats ? pl.stats.magnet : 40;
      if (this.kind !== 'item' && d < mg) { const s = 180 * (1 - d / (mg + 20)) + 60; this.x += (dx / d) * s * dt; this.y += (dy / d) * s * dt; this.fixed = true; }
      if (d < 11 + pl.w / 4) { this.world.collect(this); this.alive = false; }
    }
    if (!this.fixed) { this.life -= dt; if (this.life <= 0) this.alive = false; }
  }
  draw(ctx, cam) {
    let c, w = 12, h = 12; const bob = Math.sin(this.t * 4 + this.bob) * 1.5;
    if (this.kind === 'coin') c = coinFrame(Math.floor(this.t * 9 + this.bob));
    else if (this.kind === 'pearl') c = pearlFrame(this.id === 'black_pearl' ? 'black' : 'white');
    else if (this.kind === 'orb') c = orbFrame(this.id || 'hp');
    else { c = itemIcon(this.id); w = 16; h = 16; }
    if (this.life < 3 && Math.floor(this.life * 8) % 2) return;
    const x = Math.round(this.x - cam.x - c.width / 2), y = Math.round(this.y - cam.y - c.height / 2 + bob);
    if (this.kind === 'item') { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 5); ctx.fillStyle = '#fff6a8'; ctx.beginPath(); ctx.arc(x + 8, y + 8, 11, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.drawImage(c, x, y);
  }
}
