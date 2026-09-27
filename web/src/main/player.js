// Port of Player.VoxelBody (swept axis-separated AABB collision) and PlayerController movement: walking, sprinting,
// jumping, swimming, creative flight (double-tap space or F), fall tracking.
import { BLOCKS, B, F, isWater, isLava } from '../shared/blocks.js';
import { K } from '../shared/shapes.js';

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

  /** step: how high the body may step up onto slabs, stairs and paths when walking into them. Returns the step taken. */
  move(world, d, step = 0) {
    const start = [...this.pos], vel = [...this.vel];
    this.moveOnce(world, d);
    this.stepped = 0;
    if (step > 0 && this.hitWall && d[1] <= 0) {
      const after = [...this.pos], flags = [this.grounded, this.hitCeiling, this.hitWall], vAfter = [...this.vel];
      this.pos = [...start];
      const up = this.sweep(world, 1, step);
      this.pos[1] += up;
      const ax = this.sweep(world, 0, d[0]); this.pos[0] += ax;
      const az = this.sweep(world, 2, d[2]); this.pos[2] += az;
      const down = this.sweep(world, 1, -up + Math.min(d[1], 0));
      this.pos[1] += down;
      const gainOld = Math.hypot(after[0] - start[0], after[2] - start[2]), gainNew = Math.hypot(this.pos[0] - start[0], this.pos[2] - start[2]);
      if (gainNew > gainOld + 1e-3 && down > -up + 1e-4) {
        this.grounded = true; this.hitCeiling = false; this.hitWall = ax !== d[0] || az !== d[2];
        this.vel = [ax !== d[0] ? 0 : vel[0], 0, az !== d[2] ? 0 : vel[2]];
        this.stepped = this.pos[1] - after[1];
      } else {
        this.pos = after; [this.grounded, this.hitCeiling, this.hitWall] = flags; this.vel = vAfter;
      }
    }
    return this.stepped;
  }

  moveOnce(world, d) {
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

  /** Solid boxes the body is inside of (by more than a hair). */
  overlapping(world) {
    const mn = this.min(), mx = this.max(), boxes = [], out = [];
    for (let y = Math.floor(mn[1]); y <= Math.floor(mx[1] - SKIN); y++) for (let z = Math.floor(mn[2] + SKIN); z <= Math.floor(mx[2] - SKIN); z++)
      for (let x = Math.floor(mn[0] + SKIN); x <= Math.floor(mx[0] - SKIN); x++) world.collisionBoxes(x, y, z, boxes);
    for (const b of boxes) {
      if (Math.min(mx[0], b[3]) - Math.max(mn[0], b[0]) > 0.01 && Math.min(mx[1], b[4]) - Math.max(mn[1], b[1]) > 0.01 &&
          Math.min(mx[2], b[5]) - Math.max(mn[2], b[2]) > 0.01) out.push(b);
    }
    return out;
  }
  /** Out of the ground: a shallow overlap is stepped up onto (or pushed out sideways), a deep one climbs to the
   *  first free space above (up to maxLift blocks). Returns true when the body moved. */
  unstick(world, maxLift = 1.2) {
    let hit = this.overlapping(world);
    if (!hit.length) return false;
    if (hit.some((b) => b[0] === -Infinity)) return false;
    const top = Math.max(...hit.map((b) => b[4]));
    const start = [...this.pos];
    if (top - this.pos[1] <= maxLift) {
      this.pos[1] = top + SKIN;
      if (!this.overlapping(world).length) { this.vel[1] = Math.max(0, this.vel[1]); return true; }
    }
    // sideways, by the shallowest way out
    this.pos = [...start];
    const mn = this.min(), mx = this.max();
    for (const [a, dir] of [[0, 1], [0, -1], [2, 1], [2, -1]]) {
      const d = dir > 0 ? Math.max(...hit.map((b) => b[3 + a] - mn[a])) : -Math.max(...hit.map((b) => mx[a] - b[a]));
      if (Math.abs(d) > 0.35) continue;
      this.pos[a] = start[a] + d + dir * SKIN;
      if (!this.overlapping(world).length) return true;
      this.pos = [...start];
    }
    // deep inside: climb to the first gap tall enough
    for (let k = 1; k <= Math.max(1, Math.ceil(maxLift)); k++) {
      this.pos = [start[0], Math.floor(start[1]) + k + SKIN, start[2]];
      if (!this.overlapping(world).length) { this.vel = [0, 0, 0]; return true; }
    }
    this.pos = start;
    return false;
  }

  probeGround(world, depth = 0.05) { return this.sweep(world, 1, -depth) > -depth; }

  overlaps(bx, by, bz) {
    const mn = this.min(), mx = this.max();
    return mx[0] > bx + SKIN && mn[0] < bx + 1 - SKIN && mx[1] > by + SKIN && mn[1] < by + 1 - SKIN && mx[2] > bz + SKIN && mn[2] < bz + 1 - SKIN;
  }

  /** How far the box can move along axis (clipped against full blocks and the boxes of shaped blocks). */
  sweep(world, axis, amount) {
    if (amount === 0) return 0;
    const mn = this.min(), mx = this.max();
    const a1 = (axis + 1) % 3, a2 = (axis + 2) % 3;
    const lo = [mn[0], mn[1], mn[2]], hi = [mx[0], mx[1], mx[2]];
    if (amount > 0) hi[axis] += amount; else lo[axis] += amount;
    const boxes = [];
    for (let y = Math.floor(lo[1] + SKIN); y <= Math.floor(hi[1] - SKIN); y++)
      for (let z = Math.floor(lo[2] + SKIN); z <= Math.floor(hi[2] - SKIN); z++)
        for (let x = Math.floor(lo[0] + SKIN); x <= Math.floor(hi[0] - SKIN); x++) world.collisionBoxes(x, y, z, boxes);
    for (const b of boxes) {
      if (!(b[3 + a1] > mn[a1] + SKIN && b[a1] < mx[a1] - SKIN && b[3 + a2] > mn[a2] + SKIN && b[a2] < mx[a2] - SKIN)) continue;
      if (amount > 0) { if (b[axis] >= mx[axis] - SKIN * 0.5) amount = Math.min(amount, Math.max(0, b[axis] - mx[axis] - SKIN)); }
      else if (b[3 + axis] <= mn[axis] + SKIN * 0.5) amount = Math.max(amount, Math.min(0, b[3 + axis] - mn[axis] + SKIN));
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

  eye() { return [this.body.pos[0], this.body.pos[1] + this.eyeHeight - this.crouchEye - (this.stepLag || 0), this.body.pos[2]]; }
  forward() { const cp = Math.cos(this.pitch); return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp]; }

  look(dx, dy, sens) {
    sens *= this.zoomSens || 1;            // slower while looking through a spyglass
    this.yaw -= dx * sens;
    this.pitch = Math.max(-1.5621, Math.min(1.5621, this.pitch - dy * sens));
    this.yaw %= Math.PI * 2;
  }

  consumeActivity() { const r = [this.jumps, this.distance]; this.jumps = 0; this.distance = 0; return r; }

  /** input: { fwd, strafe, jump, jumpPressed, sprint, descend, flyToggle, time } */
  update(world, dt, input) {
    // long frames (a slow GPU at 4K) are split into steps, so the player keeps real-time speed
    if (dt > 0.05) {
      const n = Math.min(5, Math.ceil(dt / 0.05));
      for (let k = 0; k < n; k++) this.step(world, dt / n, k === 0 ? input : { ...input, jumpPressed: false, flyToggle: false });
      return;
    }
    this.step(world, dt, input);
  }

  step(world, dt, input) {
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
    this.inLava = feet >= 0 && isLava(feet);
    const swimming = this.inWater || this.inLava;
    // ladders and vines: climb by walking or jumping into them, hold still by sneaking
    const climbAt = (y) => { const c = world.getBlock(Math.floor(b.pos[0]), Math.floor(y), Math.floor(b.pos[2])); return c > 0 && BLOCKS[c].model && BLOCKS[c].model.kind === K.Ladder; };
    this.climbing = !this.flying && !swimming && (climbAt(b.pos[1] + 0.1) || climbAt(b.pos[1] + 1.2));

    if (this.flying) {
      const sp = this.flySpeed * (input.sprint ? 2 : 1);
      const k = 1 - Math.exp(-10 * dt);
      const ty = ((input.jump ? 1 : 0) - (input.descend ? 1 : 0)) * sp * 0.7;
      v[0] += (wx * sp - v[0]) * k; v[1] += (ty - v[1]) * k; v[2] += (wz * sp - v[2]) * k;
    } else if (swimming) {
      const sp = this.walkSpeed * (this.inLava ? 0.3 : 0.55) * (input.sprint ? 1.35 : 1);
      const k = 1 - Math.exp(-6 * dt);
      v[0] += (wx * sp - v[0]) * k; v[2] += (wz * sp - v[2]) * k;
      v[1] -= this.gravity * 0.18 * dt;
      if (input.jump) v[1] += (this.inLava ? 11 : 16) * dt;
      if (input.descend) v[1] -= 8 * dt;
      v[1] = Math.max(-3, Math.min(3.2, v[1] * Math.exp(-2.5 * dt)));
      // climbing out onto a ledge
      if (input.jump && b.hitWall && !this.headInWater) v[1] = Math.max(v[1], 5.2);
    } else {
      const grounded = b.probeGround(world);
      // soul sand drags at the feet
      const under = grounded ? world.getBlock(Math.floor(b.pos[0]), Math.floor(b.pos[1] - 0.05), Math.floor(b.pos[2])) : -1;
      if (this.slowT > 0) this.slowT -= dt;       // frozen by the Frost Colossus
      const sp = (input.sprint ? this.sprintSpeed : this.walkSpeed) * (under === B.SoulSand ? 0.45 : 1) * (this.slowT > 0 ? 0.5 : 1) * (this.speedMul || 1);
      const k = 1 - Math.exp(-(grounded ? this.groundAccel : this.airAccel) * dt);
      v[0] += (wx * sp - v[0]) * k; v[2] += (wz * sp - v[2]) * k;
      if (grounded && input.jump && v[1] <= 0.01) { v[1] = Math.sqrt(2 * this.gravity * this.jumpHeight); this.jumps++; }
      // a Cloud in a Bottle (not in Minecraft): one more jump in the air
      if (grounded) this.usedDouble = false;
      else if (input.jumpPressed && this.doubleJump && !this.usedDouble) { v[1] = Math.sqrt(2 * this.gravity * this.jumpHeight) * 0.95; this.usedDouble = true; this.didDoubleJump = true; this.fallStart = NaN; }
      v[1] = Math.max(v[1] - this.gravity * dt, -60);
      if (this.climbing) {
        if (input.jump || (iz > 0.1 && b.hitWall)) v[1] = 2.4;
        else if (input.descend) v[1] = Math.max(v[1], 0);
        else v[1] = Math.max(v[1], -2.2);
        this.fallStart = NaN;
      }
    }
    if (!this.canFly) this.flying = false;
    this.sprinting = input.sprint && (ix || iz) && !this.flying;

    const before = [b.pos[0], b.pos[2]];
    // never stay inside the ground (blocks placed or moved into the player, respawns into built-up land)
    if (b.unstick(world, 0.6)) this.fallStart = NaN;
    const canStep = !this.flying && !swimming && b.probeGround(world);
    const stepped = b.move(world, [v[0] * dt, v[1] * dt, v[2] * dt], canStep ? 0.6 : 0);
    // the camera eases up a step instead of jumping
    this.stepLag = Math.max(0, (this.stepLag || 0) + stepped) * Math.exp(-14 * dt);
    const moved = Math.hypot(b.pos[0] - before[0], b.pos[2] - before[1]);
    this.distance += moved;
    if (b.grounded && !this.flying && !swimming) {
      this.stepDist += moved;
      if (this.stepDist > (this.sprinting ? 1.9 : 1.6)) { this.stepDist = 0; if (this.onStep) this.onStep(); }
    }
    if (this.flying && b.grounded && !input.jump) this.flying = false;
    this.trackFall();
  }

  trackFall() {
    const b = this.body;
    if (this.flying || this.inWater || this.inLava) {
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
    if (pick(b)) {
      const d = BLOCKS[b];
      if (!d.model || !world.modelBoxesAt || d.shape !== 9) return { hit: [x, y, z], prev: [px, py, pz], face, block: b, dist: t, point: origin.map((o, k) => o + dir[k] * t) };
      // shaped blocks: the ray has to meet one of their boxes
      let best = null;
      for (const k of pickBoxes(d.model, world.modelBoxesAt(x, y, z, b, false))) {
        const r = rayBox(origin, dir, [x + k[0], y + k[1], z + k[2]], [x + k[3], y + k[4], z + k[5]]);
        if (r && (!best || r.t < best.t)) best = r;
      }
      if (best && best.t <= maxDist) {
        const n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][best.face];
        return { hit: [x, y, z], prev: [x + n[0], y + n[1], z + n[2]], face: best.face, block: b, dist: best.t, point: origin.map((o, k) => o + dir[k] * best.t) };
      }
    }
    px = x; py = y; pz = z;
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; face = sx > 0 ? 1 : 0; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; face = sy > 0 ? 3 : 2; }
    else { z += sz; t = tmz; tmz += tdz; face = sz > 0 ? 5 : 4; }
  }
  return null;
}

/** Small parts (levers, buttons, dust, torches, rails ...) are aimed at by a roomier box around them, like Minecraft's
 *  selection boxes, so right-clicking them does not slip past onto the block behind. */
const SMALL = new Set([K.Lever, K.Button, K.Wire, K.RTorch, K.WallTorch, K.Plate, K.Rail, K.Ladder, K.Lily, K.Repeater, K.Comparator, K.Carpet]);
export function pickBoxes(m, boxes) {
  if (!SMALL.has(m.kind) || !boxes.length) return boxes;
  const u = [1, 1, 1, 0, 0, 0];
  for (const b of boxes) for (let k = 0; k < 3; k++) { u[k] = Math.min(u[k], b[k]); u[k + 3] = Math.max(u[k + 3], b[k + 3]); }
  const pad = 2.5 / 16;
  for (let k = 0; k < 3; k++) {
    u[k] = Math.max(0, u[k] - pad); u[k + 3] = Math.min(1, u[k + 3] + pad);
    if (u[k + 3] - u[k] < 0.25) { const c = (u[k] + u[k + 3]) / 2; u[k] = Math.max(0, c - 0.125); u[k + 3] = Math.min(1, c + 0.125); }
  }
  return [u];
}

/** Ray against an axis-aligned box: { t, face } of the entry face (0 +X 1 -X 2 +Y 3 -Y 4 +Z 5 -Z), or null. */
function rayBox(o, d, mn, mx) {
  let t0 = -Infinity, t1 = Infinity, face = -1;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < mn[a] || o[a] > mx[a]) return null; continue; }
    let ta = (mn[a] - o[a]) / d[a], tb = (mx[a] - o[a]) / d[a], fa = a * 2 + 1, fb = a * 2;
    if (ta > tb) { [ta, tb] = [tb, ta]; [fa, fb] = [fb, fa]; }
    if (ta > t0) { t0 = ta; face = fa; }
    t1 = Math.min(t1, tb);
  }
  if (t0 > t1 || t1 < 0) return null;
  return { t: Math.max(0, t0), face };
}

export const targetable = (b) => b !== 0 && !isWater(b) && (BLOCKS[b].flags & F.Breakable || BLOCKS[b].flags & F.Solid);
