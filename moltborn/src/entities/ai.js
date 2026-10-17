// Enemy behaviour library. Each behaviour is {init(e), update(e, dt, world)}; e.p holds per-enemy params.
// States are plain strings; e.st is time-in-state. Enemies telegraph (pose 'windup') before every attack.
import { hasLOS } from '../world/physics.js';
import { rng, clamp, TAU } from '../core/util.js';

const rand = rng(909);
const GRAV = 230, MAXFALL = 140;

const dirTo = (e, pl) => (pl.x >= e.x ? 1 : -1);
function walkerPhysics(e, dt) {
  e.vy = Math.min(e.vy + GRAV * dt, MAXFALL);
}
function ledgeAhead(e, dir) {
  const g = e.world.grid, tx = Math.floor((e.x + dir * (e.w / 2 + 3)) / 16), ty = Math.floor((e.y + e.h / 2 + 4) / 16);
  return !g.solid(tx, ty) && !g.get(tx, ty) === 30;
}
function wallAhead(e, dir) {
  const g = e.world.grid, tx = Math.floor((e.x + dir * (e.w / 2 + 2)) / 16), ty = Math.floor(e.y / 16);
  return g.solid(tx, ty) || g.solid(tx, ty - 0);
}
function noGroundAhead(e, dir) {
  const g = e.world.grid, tx = Math.floor((e.x + dir * (e.w / 2 + 4)) / 16), ty = Math.floor((e.y + e.h / 2 + 3) / 16);
  return !g.solid(tx, ty);
}
const steer = (e, tx, ty, speed, accel, dt) => {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  e.vx += (dx / d * speed - e.vx) * Math.min(1, accel * dt); e.vy += (dy / d * speed - e.vy) * Math.min(1, accel * dt);
};
const sees = (e, pl, range) => {
  const d = Math.hypot(pl.x - e.x, pl.y - e.y);
  if (d > range) return false;
  if (e.losT <= 0) { e.losT = 0.2; e.los = hasLOS(e.world.grid, e.x, e.y, pl.x, pl.y); }
  return e.los;
};

export const AI = {
  // --- ground crab: patrols, telegraphs, charges ---------------------------------------
  patrolCharge: {
    init(e) { e.a = { dir: rand() < 0.5 ? -1 : 1, homeX: e.x, cd: 1 }; e.setState('patrol'); },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; walkerPhysics(e, dt); a.cd -= dt;
      if (e.state === 'patrol') {
        e.facing = a.dir; e.vx = a.dir * p.speed;
        if (e.hitX || noGroundAhead(e, a.dir) || Math.abs(e.x - a.homeX) > p.range) { a.dir *= -1; e.x += a.dir * 2; }
        if (a.cd <= 0 && sees(e, pl, p.aggro) && Math.abs(pl.y - e.y) < 40) { e.setState('windup'); e.facing = dirTo(e, pl); e.alertFx(); }
      } else if (e.state === 'windup') {
        e.vx = 0; if (e.st >= p.wind) { e.setState('charge'); e.chargeDir = e.facing; e.sfx('swoosh'); }
      } else if (e.state === 'charge') {
        e.vx = e.chargeDir * p.charge; e.facing = e.chargeDir; e.contactMult = 1.4;
        if (e.hitX || noGroundAhead(e, e.chargeDir) || e.st > p.chargeTime) { e.vx = 0; e.contactMult = 1; if (e.hitX) { e.stun(0.5); } e.setState('recover'); a.cd = p.cd; }
      } else if (e.state === 'recover') { e.vx = 0; if (e.st > 0.55) { e.setState('patrol'); a.dir = e.chargeDir * -1; } }
    },
  },
  // --- school fish: orbit, separate, dart-bite ---------------------------------------------
  swarm: {
    init(e) { e.a = { ang: rand() * TAU, cd: rand() * 2 + 1, off: rand() * TAU, homeX: e.x, homeY: e.y }; e.setState('swim'); },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; a.cd -= dt; a.ang += dt * (0.8 + (a.off % 1));
      let sepx = 0, sepy = 0;
      for (const o of w.enemies) { if (o !== e && o.type === e.type && o.alive) { const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy); if (d < 14 && d > 0.1) { sepx += dx / d; sepy += dy / d; } } }
      if (e.state === 'swim') {
        const near = sees(e, pl, p.aggro);
        let tx, ty;
        if (near) { const R = 38 + (a.off % 1) * 20; tx = pl.x + Math.cos(a.ang) * R; ty = pl.y - 6 + Math.sin(a.ang) * R * 0.5; } else { tx = a.homeX + Math.cos(a.ang * 0.5) * 30; ty = a.homeY + Math.sin(a.ang * 0.7) * 14; }
        steer(e, tx, ty, p.speed, 3, dt); e.vx += sepx * 40 * dt; e.vy += sepy * 40 * dt;
        if (near && a.cd <= 0 && Math.hypot(pl.x - e.x, pl.y - e.y) < 90) { e.setState('windup'); e.alertFx(); }
        if (Math.abs(e.vx) > 4) e.facing = e.vx > 0 ? 1 : -1;
      } else if (e.state === 'windup') {
        e.vx *= 0.9; e.vy *= 0.9; e.facing = dirTo(e, pl);
        if (e.st > p.wind) { e.setState('dash'); const dx = pl.x - e.x, dy = pl.y - e.y, d = Math.hypot(dx, dy) || 1; e.vx = dx / d * p.dash; e.vy = dy / d * p.dash; e.contactMult = 1.3; }
      } else if (e.state === 'dash') {
        if (e.st > 0.32 || e.hitX || e.hitY) { e.contactMult = 1; e.setState('swim'); a.cd = p.cd + rand() * 1.5; }
      }
    },
  },
  // --- ambusher (moray): hides, then lunges out along a line ----------------------------------
  ambush: {
    init(e) { e.a = { hx: e.x, hy: e.y, cd: 0, tx: 0, ty: 0 }; e.setState('hidden'); e.ghost = true; },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; a.cd -= dt;
      if (e.state === 'hidden') {
        e.vx = e.vy = 0; e.x = a.hx; e.y = a.hy;
        if (a.cd <= 0 && Math.hypot(pl.x - a.hx, pl.y - a.hy) < p.trigger) { e.setState('peek'); }
      } else if (e.state === 'peek') {
        e.vx = e.vy = 0; e.facing = dirTo(e, pl); if (e.st < 0.1) e.alertFx();
        if (e.st > p.wind) { e.setState('lunge'); const dx = pl.x - e.x, dy = pl.y - e.y, d = Math.hypot(dx, dy) || 1; a.ux = dx / d; a.uy = dy / d; e.sfx('swoosh'); }
      } else if (e.state === 'lunge') {
        e.vx = a.ux * p.lunge; e.vy = a.uy * p.lunge; e.contactMult = 1.2;
        if (e.st > 0.22 || Math.hypot(e.x - a.hx, e.y - a.hy) > p.reach) e.setState('linger');
      } else if (e.state === 'linger') { e.vx = e.vy = 0; if (e.st > 0.35) e.setState('retreat'); }
      else if (e.state === 'retreat') {
        const dx = a.hx - e.x, dy = a.hy - e.y, d = Math.hypot(dx, dy);
        if (d < 4) { e.setState('hidden'); a.cd = p.cd; e.contactMult = 1; } else { e.vx = dx / d * p.lunge * 0.55; e.vy = dy / d * p.lunge * 0.55; }
      }
    },
  },
  // --- jellyfish: slow bobbing drift, stinging contact ---------------------------------------
  drifter: {
    init(e) { e.a = { ph: rand() * TAU, homeY: e.y }; e.setState('drift'); },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; a.ph += dt * 1.6;
      const near = sees(e, pl, p.aggro);
      const tx = near ? pl.x : e.x + Math.sin(a.ph * 0.4) * 10, ty = (near ? pl.y - 14 : a.homeY) + Math.sin(a.ph) * 10;
      e.vx += (clamp(tx - e.x, -1, 1) * p.speed - e.vx) * Math.min(1, 1.2 * dt);
      e.vy += (clamp(ty - e.y, -1, 1) * p.speed * 1.4 - e.vy) * Math.min(1, 1.5 * dt);
      e.pose = Math.sin(a.ph) > 0.6 ? 'windup' : 'move';
      if (Math.abs(e.vx) > 3) e.facing = e.vx > 0 ? 1 : -1;
    },
  },
  // --- stationary shooter (plants, cannons) ------------------------------------------------------
  turret: {
    init(e) { e.a = { cd: rand() * 1.2 + 0.6 }; e.setState('idle'); },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; a.cd -= dt; e.vx = e.vy = 0;
      if (e.state === 'idle') {
        e.facing = dirTo(e, pl);
        if (a.cd <= 0 && sees(e, pl, p.range)) { e.setState('windup'); e.alertFx(); }
      } else if (e.state === 'windup') {
        e.facing = dirTo(e, pl);
        if (e.st > p.wind) { e.setState('attack'); e.shoot(); }
      } else if (e.state === 'attack') { if (e.st > 0.25) { e.setState('idle'); a.cd = p.cd; } }
    },
  },
  // --- shield bearer: faces player, guards, thrusts ------------------------------------------------
  guard: {
    init(e) { e.a = { cd: 1, homeX: e.x }; e.setState('advance'); e.guardFront = true; },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; walkerPhysics(e, dt); a.cd -= dt;
      const dx = pl.x - e.x, near = sees(e, pl, p.aggro);
      if (e.state === 'advance') {
        e.guardFront = true; e.pose = near ? 'guard' : 'move';
        if (near) { e.facing = dirTo(e, pl); if (Math.abs(dx) > p.strike - 6 && !noGroundAhead(e, e.facing) && !e.hitX) e.vx = e.facing * p.speed; else e.vx = 0; }
        else { e.vx = Math.sin(e.t * 0.6) * p.speed * 0.4; if (Math.abs(e.vx) > 1) e.facing = e.vx > 0 ? 1 : -1; if (noGroundAhead(e, e.facing)) e.vx = 0; }
        if (near && a.cd <= 0 && Math.abs(dx) < p.strike + 10 && Math.abs(pl.y - e.y) < 30) { e.setState('windup'); e.guardFront = false; e.alertFx(); }
      } else if (e.state === 'windup') { e.vx = 0; e.guardFront = true; if (e.st > p.wind) { e.setState('attack'); e.guardFront = false; e.strike({ x: e.facing * (e.w / 2 + p.strike / 2), y: 0, w: p.strike, h: e.h * 0.8 }, e.dmgNow(), 0.14, { kb: 120 }); e.sfx('swoosh'); e.vx = e.facing * 40; } }
      else if (e.state === 'attack') { e.guardFront = false; if (e.st > 0.2) { e.vx = 0; e.setState('recover'); } }
      else if (e.state === 'recover') { e.vx = 0; e.guardFront = false; if (e.st > p.recover) { e.setState('advance'); a.cd = p.cd; } }
    },
  },
  // --- armoured turtle: tucks into shell when struck ------------------------------------------------
  shellback: {
    init(e) { e.a = { cd: 1, dir: rand() < 0.5 ? -1 : 1, tuck: 0 }; e.setState('walk'); },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; walkerPhysics(e, dt); a.cd -= dt;
      if (e.tuckT > 0) { e.tuckT -= dt; e.guardAll = true; e.pose = 'guard'; e.vx = 0; if (e.tuckT <= 0) { e.guardAll = false; e.setState('walk'); } return; }
      e.guardAll = false;
      if (e.state === 'walk') {
        const near = sees(e, pl, p.aggro);
        if (near) a.dir = dirTo(e, pl);
        e.facing = a.dir; e.vx = (e.hitX || noGroundAhead(e, a.dir)) ? 0 : a.dir * p.speed * (near ? 1 : 0.5);
        if (e.hitX || noGroundAhead(e, a.dir)) a.dir *= -1;
        if (near && a.cd <= 0 && Math.abs(pl.x - e.x) < p.strike + 8 && Math.abs(pl.y - e.y) < 24) { e.setState('windup'); e.alertFx(); }
      } else if (e.state === 'windup') { e.vx = 0; if (e.st > p.wind) { e.setState('attack'); e.strike({ x: e.facing * (e.w / 2 + 8), y: -2, w: 22, h: e.h * 0.7 }, e.dmgNow(), 0.14, { kb: 150 }); } }
      else if (e.state === 'attack') { if (e.st > 0.3) { e.setState('walk'); a.cd = p.cd; } }
    },
    onHurt(e) { if (e.state !== 'attack' && rand() < 0.65) e.tuckT = 1.4; },
  },
  // --- kiter (barracuda / archer): hover at range, then dash or shoot ---------------------------------
  kiter: {
    init(e) { e.a = { cd: 1.2 + rand(), ph: rand() * TAU, side: rand() < 0.5 ? -1 : 1 }; e.setState('hover'); },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; a.cd -= dt; a.ph += dt;
      if (e.state === 'hover') {
        const near = sees(e, pl, p.aggro);
        if (near) {
          const tx = pl.x + a.side * p.hover, ty = pl.y - 18 + Math.sin(a.ph) * 14; steer(e, tx, ty, p.speed, 2.2, dt); e.facing = dirTo(e, pl);
          if (a.cd <= 0) { e.setState('windup'); e.alertFx(); }
        } else { steer(e, e.x + Math.cos(a.ph * 0.5) * 30, e.y + Math.sin(a.ph) * 8, p.speed * 0.4, 1, dt); if (Math.abs(e.vx) > 4) e.facing = e.vx > 0 ? 1 : -1; }
      } else if (e.state === 'windup') {
        e.vx *= 0.88; e.vy *= 0.88; e.facing = dirTo(e, pl);
        if (e.st > p.wind) {
          if (p.shoots) { e.setState('attack'); e.shoot(); } else { e.setState('dash'); const dx = pl.x - e.x, dy = pl.y - e.y, d = Math.hypot(dx, dy) || 1; e.vx = dx / d * p.dash; e.vy = dy / d * p.dash; e.contactMult = 1.5; e.facing = e.vx > 0 ? 1 : -1; e.sfx('swoosh'); }
        }
      } else if (e.state === 'dash') { if (e.st > 0.45 || e.hitX || e.hitY) { e.contactMult = 1; e.setState('retreat'); a.side *= -1; } }
      else if (e.state === 'attack') { if (e.st > 0.3) { e.setState('retreat'); a.side *= -1; } }
      else if (e.state === 'retreat') { steer(e, e.x + (e.x - pl.x) * 2, e.y - 20, p.speed * 1.2, 2, dt); if (e.st > 0.8) { e.setState('hover'); a.cd = p.cd + rand(); } }
    },
  },
  // --- phasing ghost: passes through walls, solid only when attacking ---------------------------------
  phase: {
    init(e) { e.a = { cd: 2 + rand() * 2 }; e.ghost = true; e.setState('drift'); },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; a.cd -= dt;
      if (e.state === 'drift') {
        e.phased = true; steer(e, pl.x, pl.y - 6, p.speed, 1.2, dt); if (Math.abs(e.vx) > 2) e.facing = e.vx > 0 ? 1 : -1;
        if (a.cd <= 0 && sees({ ...e, los: true, losT: 1, world: e.world, x: e.x, y: e.y }, pl, p.aggro)) { e.setState('appear'); e.alertFx(); }
      } else if (e.state === 'appear') { e.phased = false; e.vx *= 0.9; e.vy *= 0.9; e.pose = 'windup'; if (e.st > p.wind) { e.setState('attack'); e.shoot(); } }
      else if (e.state === 'attack') { e.phased = false; if (e.st > 0.3) e.setState('visible'); }
      else if (e.state === 'visible') { e.phased = false; e.vx *= 0.9; e.vy *= 0.9; if (e.st > 2.0) { e.setState('drift'); a.cd = p.cd; } }
    },
  },
  // --- puffer: swells and bursts into spines ------------------------------------------------------------
  puffer: {
    init(e) { e.a = { ph: rand() * TAU }; e.setState('swim'); },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; a.ph += dt;
      if (e.state === 'swim') {
        const near = sees(e, pl, p.aggro);
        steer(e, near ? pl.x : e.x + Math.cos(a.ph * 0.6) * 20, near ? pl.y : e.y + Math.sin(a.ph) * 10, p.speed, 1.5, dt);
        if (Math.abs(e.vx) > 3) e.facing = e.vx > 0 ? 1 : -1;
        if (near && Math.hypot(pl.x - e.x, pl.y - e.y) < p.burstR) { e.setState('windup'); e.alertFx(); }
      } else if (e.state === 'windup') {
        e.vx *= 0.9; e.vy *= 0.9; e.scale = 1 + e.st * 0.9;
        if (e.st > p.wind) { e.burst(); }
      }
    },
  },
  // --- static hazard (urchin) -------------------------------------------------------------------------------
  spiky: { init(e) { e.a = {}; e.setState('idle'); }, update(e, dt) { e.vx = e.vy = 0; walkerPhysics(e, dt); if (e.onGround) e.vy = 0; e.pose = 'move'; } },
  // --- mimic: pretends to be a chest -------------------------------------------------------------------------
  mimic: {
    init(e) { e.a = { cd: 0 }; e.setState('disguised'); e.disguised = true; },
    update(e, dt, w) {
      const pl = w.player, p = e.p, a = e.a; walkerPhysics(e, dt); a.cd -= dt;
      if (e.state === 'disguised') { e.vx = 0; e.disguised = true; if (Math.hypot(pl.x - e.x, pl.y - e.y) < p.reveal) { e.setState('reveal'); e.alertFx(); } }
      else if (e.state === 'reveal') { e.disguised = false; e.vx = 0; if (e.st > 0.5) e.setState('hop'); }
      else if (e.state === 'hop') {
        e.facing = dirTo(e, pl);
        if (e.onGround && a.cd <= 0) { e.vy = -110; e.vx = e.facing * p.speed * 2; a.cd = 1.0; e.pose = 'attack'; }
        if (e.onGround) e.vx *= 0.8;
      }
    },
  },
};
