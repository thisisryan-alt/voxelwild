// Port of Player.VoxelBody (swept axis-separated AABB collision) and PlayerController movement: walking, sprinting,
// jumping, swimming, creative flight (double-tap space or F), fall tracking.
import { BLOCKS, F, isWater } from '../shared/blocks.js';

const SKIN = 0.001;

export class VoxelBody {
  constructor() {
    this.pos = [0, 80, 0];         // centre of the feet
    this.vel = [0, 0, 0];
    this.half = 0.3; this.height = 1.8;
    this.grounded = false; this.hitCeiling = false; this.hitWall = false;
  }
  min() { return [this.pos[0] - this.half, this.pos[1], this.pos[2] - this.half]; }
  max() { return [this.pos[0] + this.half, this.pos[1] + this.height, this.pos[2] + this.half]; }

  move(world, d) {
    this.grounded = this.hitCeiling = this.hitWall = false;
    const ay = this.sweep(world, 1, d[1]);
    if (ay !== d[1]) { if (d[1] < 0) this.grounded = true; else this.hitCeiling = true; this.vel[1] = 0; }
    this.pos[1] += ay;
    const ax = this.sweep(world, 0, d[0]);
    if (ax !== d[0]) { this.hitWall = true; this.vel[0] = 0; }
    this.pos[0] += ax;
    const az = this.sweep(world, 2, d[2]);
    if (az !== d[2]) { this.hitWall = true; this.vel[2] = 0; }
    this.pos[2] += az;
    return [ax, ay, az];
  }

  probeGround(world, depth = 0.05) { return this.sweep(world, 1, -depth) > -depth; }

  overlaps(bx, by, bz) {
    const mn = this.min(), mx = this.max();
    return mx[0] > bx + SKIN && mn[0] < bx + 1 - SKIN && mx[1] > by + SKIN && mn[1] < by + 1 - SKIN && mx[2] > bz + SKIN && mn[2] < bz + 1 - SKIN;
  }

  sweep(world, axis, amount) {
    if (amount === 0) return 0;
    const mn = this.min(), mx = this.max();
    const a1 = (axis + 1) % 3, a2 = (axis + 2) % 3;
    const lo1 = Math.floor(mn[a1] + SKIN), hi1 = Math.floor(mx[a1] - SKIN);
    const lo2 = Math.floor(mn[a2] + SKIN), hi2 = Math.floor(mx[a2] - SKIN);
    const p = [0, 0, 0];
    const anySolid = (c) => {
      for (let i = lo1; i <= hi1; i++) for (let j = lo2; j <= hi2; j++) {
        p[axis] = c; p[a1] = i; p[a2] = j;
        if (world.isSolidAt(p[0], p[1], p[2])) return true;
      }
      return false;
    };
    if (amount > 0) {
      const start = Math.ceil(mx[axis] - SKIN), end = Math.floor(mx[axis] + amount);
      for (let c = start; c <= end; c++) if (anySolid(c)) return Math.max(0, c - mx[axis] - SKIN);
    } else {
      const start = Math.floor(mn[axis] + SKIN) - 1, end = Math.floor(mn[axis] + amount);
      for (let c = start; c >= end; c--) if (anySolid(c)) return Math.min(0, c + 1 - mn[axis] + SKIN);
    }
    return amount;
  }
}

export class Player {
  constructor() {
    this.body = new VoxelBody();
    this.yaw = 0; this.pitch = 0;               // radians; yaw 0 looks toward -Z
    this.walkSpeed = 4.3; this.sprintSpeed = 6.4; this.flySpeed = 14;
    this.jumpHeight = 1.25; this.gravity = 30; this.groundAccel = 18; this.airAccel = 3.5;
    this.eyeHeight = 1.62;
    this.canFly = false; this.flying = false;
    this.inWater = false; this.headInWater = false; this.sprinting = false;
    this.jumps = 0; this.distance = 0;
    this.fallStart = NaN;
    this.onLand = null;             // (height, intoWater)
    this.lastSpaceTap = -1;
    this.stepDist = 0;              // for footstep sounds
    this.onStep = null;
    this.crouchEye = 0;
  }

  eye() { return [this.body.pos[0], this.body.pos[1] + this.eyeHeight - this.crouchEye, this.body.pos[2]]; }
  forward() { const cp = Math.cos(this.pitch); return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp]; }

  look(dx, dy, sens) {
    this.yaw -= dx * sens;
    this.pitch = Math.max(-1.5621, Math.min(1.5621, this.pitch - dy * sens));
    this.yaw %= Math.PI * 2;
  }

  consumeActivity() { const r = [this.jumps, this.distance]; this.jumps = 0; this.distance = 0; return r; }

  /** input: { fwd, strafe, jump, jumpPressed, sprint, descend, flyToggle, time } */
  update(world, dt, input) {
    dt = Math.min(dt, 0.05);
    const b = this.body, v = b.vel;
    if (this.canFly && input.flyToggle) this.flying = !this.flying;
    if (input.jumpPressed) {
      if (this.canFly && input.time - this.lastSpaceTap < 0.3) this.flying = !this.flying;
      this.lastSpaceTap = input.time;
    }
    let ix = input.strafe, iz = input.fwd;
    const l = Math.hypot(ix, iz);
    if (l > 1) { ix /= l; iz /= l; }
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);   // forward on the ground
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const wx = fx * iz + rx * ix, wz = fz * iz + rz * ix;

    const feet = world.getBlock(Math.floor(b.pos[0]), Math.floor(b.pos[1] + 0.4), Math.floor(b.pos[2]));
    const e = this.eye();
    const eyeB = world.getBlock(Math.floor(e[0]), Math.floor(e[1]), Math.floor(e[2]));
    this.inWater = feet >= 0 && isWater(feet);
    this.headInWater = eyeB >= 0 && isWater(eyeB);

    if (this.flying) {
      const sp = this.flySpeed * (input.sprint ? 2 : 1);
      const k = 1 - Math.exp(-10 * dt);
      const ty = ((input.jump ? 1 : 0) - (input.descend ? 1 : 0)) * sp * 0.7;
      v[0] += (wx * sp - v[0]) * k; v[1] += (ty - v[1]) * k; v[2] += (wz * sp - v[2]) * k;
    } else if (this.inWater) {
      const sp = this.walkSpeed * 0.55 * (input.sprint ? 1.35 : 1);
      const k = 1 - Math.exp(-6 * dt);
      v[0] += (wx * sp - v[0]) * k; v[2] += (wz * sp - v[2]) * k;
      v[1] -= this.gravity * 0.18 * dt;
      if (input.jump) v[1] += 16 * dt;
      if (input.descend) v[1] -= 8 * dt;
      v[1] = Math.max(-3, Math.min(3.2, v[1] * Math.exp(-2.5 * dt)));
      // climbing out onto a ledge
      if (input.jump && b.hitWall && !this.headInWater) v[1] = Math.max(v[1], 5.2);
    } else {
      const grounded = b.probeGround(world);
      const sp = input.sprint ? this.sprintSpeed : this.walkSpeed;
      const k = 1 - Math.exp(-(grounded ? this.groundAccel : this.airAccel) * dt);
      v[0] += (wx * sp - v[0]) * k; v[2] += (wz * sp - v[2]) * k;
      if (grounded && input.jump && v[1] <= 0.01) { v[1] = Math.sqrt(2 * this.gravity * this.jumpHeight); this.jumps++; }
      v[1] = Math.max(v[1] - this.gravity * dt, -60);
    }
    if (!this.canFly) this.flying = false;
    this.sprinting = input.sprint && (ix || iz) && !this.flying;

    const before = [b.pos[0], b.pos[2]];
    b.move(world, [v[0] * dt, v[1] * dt, v[2] * dt]);
    const moved = Math.hypot(b.pos[0] - before[0], b.pos[2] - before[1]);
    this.distance += moved;
    if (b.grounded && !this.flying && !this.inWater) {
      this.stepDist += moved;
      if (this.stepDist > (this.sprinting ? 1.9 : 1.6)) { this.stepDist = 0; if (this.onStep) this.onStep(); }
    }
    if (this.flying && b.grounded && !input.jump) this.flying = false;
    this.trackFall();
  }

  trackFall() {
    const b = this.body;
    if (this.flying || this.inWater) {
      if (!Number.isNaN(this.fallStart) && this.inWater && this.onLand) this.onLand(this.fallStart - b.pos[1], true);
      this.fallStart = NaN;
      return;
    }
    if (b.grounded) {
      if (!Number.isNaN(this.fallStart) && this.onLand) this.onLand(this.fallStart - b.pos[1], false);
      this.fallStart = NaN;
    } else this.fallStart = Number.isNaN(this.fallStart) ? b.pos[1] : Math.max(this.fallStart, b.pos[1]);
  }

  teleport(feet, yaw, pitch) {
    this.body.pos = [...feet]; this.body.vel = [0, 0, 0];
    if (yaw != null) this.yaw = yaw;
    if (pitch != null) this.pitch = pitch;
    this.fallStart = NaN;
  }
}

/** Voxel DDA raycast (Amanatides-Woo). Returns { hit:[x,y,z], prev:[x,y,z], face, block, dist } or null. */
export function raycast(world, origin, dir, maxDist, pick) {
  let x = Math.floor(origin[0]), y = Math.floor(origin[1]), z = Math.floor(origin[2]);
  const sx = Math.sign(dir[0]), sy = Math.sign(dir[1]), sz = Math.sign(dir[2]);
  const tdx = sx ? Math.abs(1 / dir[0]) : Infinity, tdy = sy ? Math.abs(1 / dir[1]) : Infinity, tdz = sz ? Math.abs(1 / dir[2]) : Infinity;
  let tmx = sx > 0 ? (x + 1 - origin[0]) * tdx : sx < 0 ? (origin[0] - x) * tdx : Infinity;
  let tmy = sy > 0 ? (y + 1 - origin[1]) * tdy : sy < 0 ? (origin[1] - y) * tdy : Infinity;
  let tmz = sz > 0 ? (z + 1 - origin[2]) * tdz : sz < 0 ? (origin[2] - z) * tdz : Infinity;
  let px = x, py = y, pz = z, face = -1, t = 0;
  for (let i = 0; i < 256 && t <= maxDist; i++) {
    const b = world.getBlock(x, y, z);
    if (b < 0) return null;
    if (pick(b)) return { hit: [x, y, z], prev: [px, py, pz], face, block: b, dist: t };
    px = x; py = y; pz = z;
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; face = sx > 0 ? 1 : 0; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; face = sy > 0 ? 3 : 2; }
    else { z += sz; t = tmz; tmz += tdz; face = sz > 0 ? 5 : 4; }
  }
  return null;
}

export const targetable = (b) => b !== 0 && !isWater(b) && (BLOCKS[b].flags & F.Breakable || BLOCKS[b].flags & F.Solid);
