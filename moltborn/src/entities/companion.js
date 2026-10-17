// A hatchling companion that paddles along behind the swimmer. It scoops up coins and pearls near it, nips at foes that
// come close, chirps when something is about to happen, and from level 4 mends its friend when health runs low. It
// levels up with every foe the pair defeat. Companions cannot be hurt and never block anything.
import { enemyFrame } from '../gfx/sprites_enemies.js';
import { drawFrame } from './entity.js';
import { ENEMIES } from '../data/enemies.js';

export const COMPANION_MAX = 10;
export const killsForLevel = (lv) => Math.round(6 * Math.pow(lv, 1.5));

export class Companion {
  constructor(world, data) {
    this.world = world; this.data = data; const p = world.player;
    this.x = p.x - 16; this.y = p.y - 6; this.vx = 0; this.vy = 0; this.facing = 1; this.t = Math.random() * 6; this.atkT = 2; this.healT = 20; this.lunge = null; this.chirpT = 0; this.mood = 0;
  }
  get level() { return this.data.level; }
  near(x, y) { return Math.hypot(x - this.x, y - this.y) < 50 + this.level * 4; }
  get dmg() { return Math.max(1, Math.round(this.world.player.stats.atk * (0.16 + this.level * 0.02))); }
  get cooldown() { return Math.max(1.3, 3.4 - this.level * 0.2); }

  update(dt) {
    const w = this.world, p = w.player, d = this.data; this.t += dt; this.chirpT -= dt;
    // follow: a soft spring to a spot behind and a little above the swimmer
    const side = -(p.facing || 1), tx = p.x + side * 20, ty = p.y - 7 + Math.sin(this.t * 2) * 2;
    const dx = tx - this.x, dy = ty - this.y, dist = Math.hypot(dx, dy);
    if (dist > 260) { this.x = tx; this.y = ty; this.vx = this.vy = 0; }
    this.vx += dx * 14 * dt; this.vy += dy * 14 * dt; const damp = Math.exp(-6 * dt); this.vx *= damp; this.vy *= damp;
    const sp = Math.hypot(this.vx, this.vy), max = 190 + p.stats.speed * 40; if (sp > max) { this.vx *= max / sp; this.vy *= max / sp; }
    if (this.lunge) this.stepLunge(dt); else { this.x += this.vx * dt; this.y += this.vy * dt; }
    if (Math.abs(this.vx) > 8) this.facing = Math.sign(this.vx);
    // keep out of solid rock
    const g = w.grid; if (g.solidPx(this.x, this.y)) { this.x += (p.x - this.x) * 0.2; this.y += (p.y - this.y) * 0.2; }
    if (!p.alive || p.locked) return;
    this.atkT -= dt; this.healT -= dt;
    if (this.atkT <= 0 && !this.lunge) this.tryNip();
    if (d.level >= 4 && this.healT <= 0 && p.hp < p.stats.maxHp * 0.6) { this.healT = 25; p.heal(Math.round(p.stats.maxHp * (0.04 + d.level * 0.004))); w.fx.ring(this.x, this.y, 3, 20, 0.4, '#7aff9a', 2); this.chirp(); }
    // an aggravated foe close by makes it chirp once
    if (this.chirpT <= 0 && w.enemies.some((e) => e.alive && !e.def.friendly && e.state === 'windup' && Math.hypot(e.x - p.x, e.y - p.y) < 130)) this.chirp();
  }
  chirp() { if (this.chirpT > 0) return; this.chirpT = 3; this.mood = 1; this.world.game.audio.sfx('bark', { x: this.x, y: this.y }); this.world.fx.text(this.x, this.y - 10, '!', '#ffe08a'); }

  tryNip() {
    const w = this.world; let best = null, bd = 120;
    for (const e of w.enemies) { if (!e.alive || e.dying || e.def.friendly || e.state === 'hidden' || e.disguised || !e.canBeHit?.()) continue; const d = Math.hypot(e.x - this.x, e.y - this.y); if (d < bd) { bd = d; best = e; } }
    if (!best) { this.atkT = 0.5; return; }
    this.lunge = { e: best, t: 0, hit: false, from: { x: this.x, y: this.y } }; this.atkT = this.cooldown;
  }
  stepLunge(dt) {
    const L = this.lunge, w = this.world; L.t += dt;
    if (!L.e.alive || L.e.dying) { this.lunge = null; return; }
    const k = Math.min(1, L.t / 0.22), tx = L.e.x - Math.sign(L.e.x - L.from.x) * (L.e.w / 2 + 3), ty = L.e.y;
    this.x = L.from.x + (tx - L.from.x) * k; this.y = L.from.y + (ty - L.from.y) * k; this.facing = Math.sign(L.e.x - this.x) || this.facing;
    if (k >= 1 && !L.hit) {
      L.hit = true; w.fx.impact(L.e.x - this.facing * L.e.w * 0.4, L.e.y, -this.facing, { size: 6, sparks: 5 });
      w.spawnHitbox({ team: 'player', x: L.e.x - L.e.w / 2 - 2, y: L.e.y - L.e.h / 2 - 2, w: L.e.w + 4, h: L.e.h + 4, dmg: this.dmg, life: 0.06, kb: 40, poise: 6, owner: w.player, follow: null, fromAbility: true, companion: true });
      w.game.audio.sfx('claw', { x: this.x, y: this.y });
    }
    if (L.t > 0.4) { this.lunge = null; this.vx = this.vy = 0; }
  }

  draw(ctx, cam) {
    const sp = ENEMIES.hatchling.sprite, f = enemyFrame('hatchling', sp, 'move', Math.floor(this.t * 8)), x = this.x - cam.x, y = this.y - cam.y;
    const k = 0.62 + Math.min(0.2, this.level * 0.02), bob = Math.sin(this.t * 5) * 1.2;
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(Math.round(x - 5), Math.round(y + 8 * k + 6), 10, 1);
    ctx.save(); ctx.translate(Math.round(x), Math.round(y + 4 + bob)); ctx.scale(k, k);
    drawFrame(ctx, f, 0, 0, this.facing < 0, false, 1); ctx.restore();
    if (this.mood > 0) { this.mood -= 1 / 60; }
    // a little level pip row above its head when it has just levelled
    if (this.data.flash > 0) { this.data.flash -= 1 / 60; ctx.fillStyle = '#ffd84a'; for (let i = 0; i < Math.min(this.level, 10); i++) ctx.fillRect(Math.round(x) - 10 + i * 2, Math.round(y) - 14, 1, 2); }
  }
}
