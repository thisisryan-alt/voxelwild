// Behaviours for the creatures that came through the rifts. They register into the shared AI table, so a def only needs
// `ai: 'blinker'` (and friends) to use them.
//   blinker  - vanishes, reappears at a distance and fires a burst of shards
//   latcher  - leaps on the swimmer and clings, draining health until shaken off by a dash or a few good blows
//   caller   - hangs overhead and calls a gust that shoves the swimmer sideways
//   bulwark  - a slow wall of glass that slams the ground, throwing shards along it
import { AI } from './ai.js';
import { hasLOS } from '../world/physics.js';
import { rng, TAU } from '../core/util.js';

const rand = rng(2718);
const GRAV = 230, MAXFALL = 140, TS = 16;

const dirTo = (e, pl) => (pl.x >= e.x ? 1 : -1);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const steer = (e, tx, ty, speed, accel, dt) => {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, accel * dt);
  e.vx += (dx / d * speed - e.vx) * k; e.vy += (dy / d * speed - e.vy) * k;
};
const solidAt = (w, x, y) => w.grid.solid(Math.floor(x / TS), Math.floor(y / TS));
// a spot within [r0, r1] of the player with open water around it and a clear line to them
export function blinkSpot(w, pl, r0, r1, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const a = rand() * TAU, r = r0 + rand() * (r1 - r0), x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r * 0.7;
    let clear = true; for (const [dx, dy] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]]) if (solidAt(w, x + dx, y + dy)) clear = false;
    if (clear && hasLOS(w.grid, x, y, pl.x, pl.y)) return [x, y];
  }
  return null;
}

AI.blinker = {
  init(e) { e.a = { cd: 1.2 + rand() * 1.6, ph: rand() * TAU, shots: 0, to: null }; e.setState('drift'); },
  update(e, dt, w) {
    const pl = w.player, p = e.p, a = e.a; a.cd -= dt; a.ph += dt * 1.4;
    if (e.state === 'drift') {
      e.phased = false;
      const near = dist(e, pl) < p.aggro, ang = a.ph * 0.5, r = p.keep || 110;
      steer(e, near ? pl.x + Math.cos(ang) * r : e.x, near ? pl.y - 20 + Math.sin(ang) * r * 0.4 : e.y + Math.sin(a.ph) * 4, p.speed, 1.4, dt);
      if (Math.abs(e.vx) > 2) e.facing = e.vx > 0 ? 1 : -1;
      if (near && a.cd <= 0) { e.setState('fade'); e.alertFx(); e.sfx('rift'); }
    } else if (e.state === 'fade') {
      e.vx *= 0.8; e.vy *= 0.8; e.pose = 'windup'; e.phased = e.st > 0.15;
      if (e.st > p.fade) {
        a.to = blinkSpot(w, pl, p.blinkMin, p.blinkMax);
        if (a.to) { w.fx.burst(e.x, e.y, ['#c8a8ff', '#ffffff'], 60, 0.4, 2); e.x = a.to[0]; e.y = a.to[1]; w.fx.burst(e.x, e.y, ['#c8a8ff', '#ffffff'], 60, 0.4, 2); }
        e.facing = dirTo(e, pl); e.setState('appear'); a.shots = 0;
      }
    } else if (e.state === 'appear') {
      e.phased = false; e.vx *= 0.8; e.vy *= 0.8; e.facing = dirTo(e, pl); e.pose = 'windup';
      if (e.st > p.wind) { e.setState('fire'); }
    } else if (e.state === 'fire') {
      e.vx *= 0.8; e.vy *= 0.8; e.facing = dirTo(e, pl);
      if (e.st > a.shots * 0.16) { a.shots++; e.shoot(); }
      if (a.shots >= (p.burst || 3)) { e.setState('drift'); a.cd = p.cd; }
    }
  },
};

AI.latcher = {
  init(e) { e.a = { cd: 1 + rand() * 1.5, ph: rand() * TAU, hold: 0, tick: 0, hits: 0, off: [0, -2], dirX: 1, dirY: 0 }; e.setState('hunt'); },
  update(e, dt, w) {
    const pl = w.player, p = e.p, a = e.a; a.cd -= dt; a.ph += dt * 3;
    if (e.state === 'hunt') {
      const near = dist(e, pl) < p.aggro;
      steer(e, near ? pl.x : e.x + Math.cos(a.ph * 0.3) * 20, near ? pl.y + Math.sin(a.ph) * 14 : e.y, p.speed, 2, dt);
      if (Math.abs(e.vx) > 2) e.facing = e.vx > 0 ? 1 : -1;
      if (near && a.cd <= 0 && dist(e, pl) < p.leapR && pl.alive && !pl.locked) { e.setState('windup'); e.alertFx(); }
    } else if (e.state === 'windup') {
      e.vx *= 0.8; e.vy *= 0.8; e.facing = dirTo(e, pl);
      if (e.st > p.wind) { e.setState('leap'); const dx = pl.x - e.x, dy = pl.y - e.y, d = Math.hypot(dx, dy) || 1; a.dirX = dx / d; a.dirY = dy / d; e.vx = a.dirX * p.leap; e.vy = a.dirY * p.leap; e.sfx('swoosh'); }
    } else if (e.state === 'leap') {
      e.contactMult = 0.3;
      if (dist(e, pl) < (pl.w + e.w) / 2 + 3 && pl.alive && pl.invulnT <= 0) {
        e.setState('attached'); a.hold = 0; a.tick = 0; a.hits = 0; a.off = [(e.x - pl.x) * 0.5, (e.y - pl.y) * 0.5 - 2]; e.contactMult = 0; e.attached = true; e.sfx('alert');
        w.fx.text(pl.x, pl.y - 16, 'LATCHED!', '#ff8a8a', false, { life: 0.9 });
      } else if (e.st > p.leapTime) { e.contactMult = 1; e.setState('hunt'); a.cd = p.cd * 0.6; }
    } else if (e.state === 'attached') {
      a.hold += dt; a.tick += dt; e.contactMult = 0;
      e.x = pl.x + a.off[0] * (1 - Math.min(1, a.hold * 3)) + (pl.facing || 1) * -3; e.y = pl.y - 2 + Math.sin(a.hold * 9) * 1.5; e.vx = e.vy = 0; e.facing = pl.facing || 1;
      pl.status.apply('chill', { dur: 0.6, power: 1 });
      if (a.tick >= p.tick) { a.tick = 0; pl.takeHit({ dmg: Math.max(1, Math.round(e.dmgNow() * 0.5)), x: e.x, y: e.y, kb: 0, source: e, unblockable: true }); w.fx.burst(pl.x, pl.y - 2, ['#8a1428', '#e0304a'], 40, 0.3, 1); e.hp = Math.min(e.maxHp, e.hp + 1); }
      if (e.hp < e.lastHp) a.hits++; e.lastHp = e.hp;
      const shaken = pl.state === 'dash' || a.hits >= 2 || a.hold > p.hold || !pl.alive;
      if (shaken) { e.attached = false; e.setState('recover'); e.vx = -(pl.facing || 1) * 90; e.vy = -50; e.stun(0.5); w.fx.text(e.x, e.y - 10, 'SHAKEN OFF', '#ffffff', false, { life: 0.7 }); }
    } else if (e.state === 'recover') {
      e.vx *= 0.94; e.vy *= 0.94; e.contactMult = 1; if (e.st > 0.9) { e.setState('hunt'); a.cd = p.cd; }
    }
    if (e.lastHp === undefined) e.lastHp = e.hp;
  },
};

AI.caller = {
  init(e) { e.a = { cd: 2 + rand() * 2, ph: rand() * TAU, gust: null, dir: 1 }; e.setState('hover'); },
  update(e, dt, w) {
    const pl = w.player, p = e.p, a = e.a; a.cd -= dt; a.ph += dt;
    const near = dist(e, pl) < p.aggro;
    if (a.gust) {
      a.gust.t -= dt;
      if (Math.random() < dt * 26) w.fx.add({ x: e.x + a.gust.dir * (20 + Math.random() * 300), y: e.y + 10 + Math.random() * 120, vx: a.gust.dir * 140, vy: 0, life: 0.5, size: 1, color: '#cfeeff', drag: 0.4, fade: true });
      if (a.gust.t <= 0) a.gust = null;
    }
    if (e.state === 'hover') {
      steer(e, pl.x + Math.sin(a.ph * 0.4) * 90, pl.y - 70 + Math.sin(a.ph) * 8, p.speed, 1.2, dt); if (Math.abs(e.vx) > 2) e.facing = e.vx > 0 ? 1 : -1;
      e.pose = 'move';
      if (near && a.cd <= 0 && !a.gust) { e.setState('windup'); a.dir = pl.x >= e.x ? 1 : -1; e.alertFx(); }
    } else if (e.state === 'windup') {
      e.vx *= 0.9; e.vy *= 0.9; e.pose = 'windup'; e.facing = a.dir;
      if (Math.random() < dt * 18) w.fx.add({ x: e.x + a.dir * 8, y: e.y + (Math.random() - 0.5) * 10, vx: a.dir * 60, vy: 0, life: 0.4, size: 1, color: '#cfeeff', drag: 0.5, fade: true });
      if (e.st > p.wind) {
        e.setState('call'); a.gust = { t: p.gustTime, dir: a.dir }; e.sfx('whirl'); w.fx.ring(e.x, e.y, 4, 40, 0.5, '#cfeeff', 2);
        const x0 = a.dir > 0 ? e.x - 20 : e.x - 340; w.zone.areas.push({ kind: 'current', x: x0, y: e.y - 20, w: 360, h: 180, vx: a.dir * p.force, vy: 0, ttl: p.gustTime });
      }
    } else if (e.state === 'call') {
      e.vx *= 0.9; e.vy *= 0.9; e.pose = 'attack'; if (e.st > 0.5) { e.setState('hover'); a.cd = p.cd; }
    }
  },
};

AI.bulwark = {
  init(e) { e.a = { cd: 1.4, homeX: e.x }; e.setState('advance'); e.guardFront = true; },
  update(e, dt, w) {
    const pl = w.player, p = e.p, a = e.a; a.cd -= dt; e.vy = Math.min(e.vy + GRAV * dt, MAXFALL);
    const dx = pl.x - e.x, near = Math.abs(dx) < p.aggro && Math.abs(pl.y - e.y) < 70;
    if (e.state === 'advance') {
      e.guardFront = true; e.pose = 'move';
      if (near) { e.facing = dirTo(e, pl); e.vx = Math.abs(dx) > p.strike ? e.facing * p.speed : 0; } else e.vx = 0;
      if (near && a.cd <= 0 && Math.abs(dx) < p.strike + 24) { e.setState('windup'); e.guardFront = false; e.alertFx(); }
    } else if (e.state === 'windup') {
      e.vx = 0; e.facing = dirTo(e, pl); e.pose = 'windup';
      if (e.st > p.wind) {
        e.setState('attack'); e.pose = 'attack'; e.sfx('boom'); w.shake?.(2);
        e.strike({ x: e.facing * (e.w / 2 + p.strike / 2), y: e.h * 0.1, w: p.strike, h: e.h * 0.7 }, e.dmgNow(), 0.16, { kb: 170 });
        for (const d of [-1, 1]) w.addProjectile({ kind: 'shard', team: 'enemy', x: e.x + e.facing * e.w * 0.4, y: e.y + e.h * 0.3, vx: e.facing * 120 + d * 20, vy: d * -30, dmg: Math.round(e.dmgNow() * 0.6), grav: 60, life: 1.6, kb: 70, trail: '#b890ff' });
        w.fx.burst(e.x + e.facing * e.w * 0.5, e.y + e.h * 0.4, ['#d8c8ff', '#8a60d8', '#ffffff'], 70, 0.4, 2);
      }
    } else if (e.state === 'attack') { e.vx = 0; if (e.st > 0.3) e.setState('recover'); }
    else if (e.state === 'recover') { e.vx = 0; e.guardFront = false; if (e.st > p.recover) { e.setState('advance'); a.cd = p.cd; } }
  },
};
