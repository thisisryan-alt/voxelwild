// Body language for the player sprite: springy squash-and-stretch on landings, strokes, dashes and hits, dust where
// feet meet the seabed, a wake of bubbles when swimming fast, drips when badly hurt, and the footstep / landing events
// that audio and the camera listen to. All of it is cosmetic and driven by what the physics already did.
import { clamp } from '../core/util.js';
import { TS, T } from '../world/tiles.js';
import { setting } from '../systems/settings.js';

const SPRING = 240, DAMP = 15;

export class BodyFx {
  constructor(p) {
    this.p = p; this.sx = 1; this.sy = 1; this.vx = 0; this.vy = 0;
    this.wasGround = false; this.fall = 0; this.stepT = 0; this.wakeT = 0; this.dripT = 0; this.t = 0; this.lean = 0;
  }

  // push the scale springs: kick(0.25, -0.2) widens and flattens for a moment
  kick(dx, dy) { this.vx += dx * 14; this.vy += dy * 14; }
  reset() { this.sx = this.sy = 1; this.vx = this.vy = 0; }

  update(dt) {
    const p = this.p, w = p.world; this.t += dt;
    const k = setting(p.game, 'reduceMotion') ? 0.3 : 1;
    this.vx += ((1 - this.sx) * SPRING - this.vx * DAMP) * dt; this.sx += this.vx * dt * k;
    this.vy += ((1 - this.sy) * SPRING - this.vy * DAMP) * dt; this.sy += this.vy * dt * k;
    this.sx = clamp(this.sx, 0.7, 1.35); this.sy = clamp(this.sy, 0.7, 1.35);
    // lean into horizontal motion
    const target = clamp(p.vx / 260, -1, 1) * 0.06; this.lean += (target - this.lean) * Math.min(1, dt * 10);
    if (!p.alive) return;

    // landing: remember how hard we were falling, react when ground is touched
    if (!p.onGround) this.fall = Math.max(this.fall, p.vy);
    if (p.onGround && !this.wasGround) { if (this.fall > 70) this.land(this.fall); this.fall = 0; }
    this.wasGround = p.onGround;

    const speed = Math.hypot(p.vx, p.vy);
    // footsteps and dust while walking
    if (p.onGround && !p.free && Math.abs(p.vx) > 35 && p.state !== 'dash') {
      this.stepT -= dt * clamp(Math.abs(p.vx) / 110, 0.6, 2);
      if (this.stepT <= 0) {
        this.stepT = 0.3; const mat = this.floorMat();
        p.game.events.emit('footstep', mat, Math.abs(p.vx));
        if (speed > 60) this.dust(1 + (speed > 120 ? 1 : 0), 0.5, mat);
      }
    }
    // a wake of bubbles behind a fast swimmer
    if ((p.free || !p.onGround) && speed > 90 && !p.world.cinematic) {
      const T = p.game.systems.cosmetics?.trail(); this.wakeT -= dt;
      if (this.wakeT <= 0) {
        this.wakeT = T ? T.rate : 0.1; const x = p.x - Math.sign(p.vx || p.facing) * p.w * 0.45, y = p.y + (Math.random() - 0.5) * 6;
        if (!T || T.kind === 'bubble' && T.colors.length === 2) w.fx.bubble(x, y, 1, 4, -10);
        else w.fx.add({ x, y, vx: -(p.vx || 0) * 0.1 + (Math.random() - 0.5) * 10, vy: (T.rise ?? -10) + (Math.random() - 0.5) * 8, life: 0.5 + Math.random() * 0.4, size: T.size || (Math.random() < 0.3 ? 2 : 1), color: T.colors[(Math.random() * T.colors.length) | 0], kind: T.kind, drag: 1.5, shrink: T.kind === 'rect', wob: Math.random() * 6 });
      }
    }
    // wounds: dark drops fall from a badly hurt swimmer
    if (p.hp < p.stats.maxHp * 0.3) {
      this.dripT -= dt; if (this.dripT <= 0) { this.dripT = 0.45 + Math.random() * 0.5; w.fx.add({ x: p.x + (Math.random() - 0.5) * p.w * 0.6, y: p.y, vx: 0, vy: 6, life: 1.1, size: 1, color: '#8a1428', grav: 26, drag: 0.4, fade: true }); }
    }
  }

  floorMat() {
    const p = this.p, t = p.world.grid.get(Math.floor(p.x / TS), Math.floor((p.bottom + 2) / TS));
    return t === T.WOOD ? 'wood' : t === T.RUIN || t === T.DIVINE || t === T.OBSID ? 'stone' : t === T.BONE ? 'bone' : t === T.CORAL ? 'coral' : t === T.GROUND ? 'sand' : 'rock';
  }
  dustColors(mat) {
    const g = this.p.world.biome.mats[T.GROUND]?.hex || ['#8a7a60', '#a89878', '#c8b890', '#e0d0a8', '#f4e8c8'];
    return mat === 'sand' ? [g[3], g[4], g[2]] : mat === 'wood' ? ['#8a6a4a', '#b08a5c'] : mat === 'bone' ? ['#e8e0cc', '#c8c0aa'] : ['#9a90a4', '#bcb2c4', '#7a7088'];
  }
  dust(n, speed, mat = this.floorMat()) {
    const p = this.p, cols = this.dustColors(mat), fx = p.world.fx;
    for (let i = 0; i < n; i++) {
      const d = i % 2 ? 1 : -1;
      fx.add({ x: p.x + d * p.w * 0.3 * Math.random(), y: p.bottom - 1, vx: d * (12 + Math.random() * 36) * speed - p.vx * 0.15, vy: -(8 + Math.random() * 26) * speed, life: 0.35 + Math.random() * 0.25, size: Math.random() < 0.3 ? 2 : 1, color: cols[(Math.random() * cols.length) | 0], grav: 40, drag: 2.5, shrink: true });
    }
  }
  land(vy) {
    const p = this.p, hard = clamp((vy - 70) / 220, 0, 1);
    this.kick(0.35 * hard + 0.06, -0.45 * hard - 0.08);
    this.dust(4 + Math.round(hard * 8), 0.9 + hard);
    p.game.events.emit('land', hard, this.floorMat());
  }

  // scale about a pivot (the feet of a walker, the middle of a swimmer) around a draw call
  begin(ctx, x, pivotY) {
    const p = this.p;
    ctx.save(); ctx.translate(Math.round(x), Math.round(pivotY));
    if (this.lean) ctx.transform(1, 0, this.lean * (p.facing < 0 ? -1 : 1), 1, 0, 0);
    ctx.scale(this.sx, this.sy); ctx.translate(-Math.round(x), -Math.round(pivotY));
  }
  end(ctx) { ctx.restore(); }
}

// listens once for the moments that squash the body; each event reaches the current world's player
export class BodyReactions {
  constructor(game) {
    this.g = game; game.systems.bodyfx = this;
    const on = (ev, fn) => game.events.on(ev, (...a) => { const bf = game.world?.player?.bodyFx; if (bf) fn(bf, game.world.player, ...a); });
    on('stroke', (bf) => bf.kick(-0.16, 0.34));
    on('dash', (bf, p) => { bf.kick(p.dashDir?.[1] ? -0.12 : 0.34, p.dashDir?.[1] ? 0.3 : -0.2); });
    on('hurt', (bf, p, n, src, blocked) => { bf.kick(blocked ? 0.1 : 0.28, blocked ? -0.08 : -0.3); });
    on('hitdealt', (bf, p, e, dmg, crit) => { bf.kick(crit ? 0.2 : 0.1, crit ? -0.1 : -0.05); });
    on('playerdied', (bf) => bf.kick(0.3, -0.5));
  }
}
