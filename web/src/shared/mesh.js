// Port of ChunkMeshJob: light (sky + block BFS over a 64^3 region), section connectivity (cave culling), and meshing
// (cubes with voxel AO / convex-edge flags / smooth light, cutout leaves, crossed plants, torches, level-based water).
//
// Vertex = 24 bytes: float32 x,y,z | u8x4 d0 (face | edges<<3, layer, ao*85, overlay) | u8x4 d1 (sky*17, block*17, temp, humid)
//                                   | u8x4 d2 (tint, wind, flowX, flowZ)
import { CS, CS2, CS3, RS, RS2, RS3, RM, MAX_LIGHT, MIN_SY, MAX_SY } from './const.js';
import { BLOCKS, B, F, Shape, NONE, layerFor, waterLevel, isWater, lavaLevel, isLava, FAMS } from './blocks.js';
import { modelBoxes, connections, CONNECTING } from './shapes.js';

const N = BLOCKS.length;
const EXT = new Uint16Array(BLOCKS.length).fill(NONE);
BLOCKS.forEach((d, i) => { if (d && d.ext != null) EXT[i] = d.ext; });
const OPAQUE = new Uint8Array(N), OPACITY = new Uint8Array(N), EMIT = new Uint8Array(N), SHAPE = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const d = BLOCKS[i];
  if (!d) continue;
  OPAQUE[i] = d.flags & F.Opaque ? 1 : 0;
  OPACITY[i] = d.opacity; EMIT[i] = d.emission; SHAPE[i] = d.shape;
}
// faces: 0 +X 1 -X 2 +Y 3 -Y 4 +Z 5 -Z (T = u axis, B = v axis, as seen from outside)
const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const FT = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [-1, 0, 0], [1, 0, 0]];
const FB = [[0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
const RI = (x, y, z) => (x + RM) + (z + RM) * RS + (y + RM) * RS2;

class Growable {
  constructor(bytes) { this.buf = new ArrayBuffer(bytes); this.f32 = new Float32Array(this.buf); this.u8 = new Uint8Array(this.buf); this.len = 0; }
  ensure(extra) {
    if (this.len + extra <= this.buf.byteLength) return;
    let size = this.buf.byteLength * 2; while (size < this.len + extra) size *= 2;
    const nb = new ArrayBuffer(size); new Uint8Array(nb).set(this.u8.subarray(0, this.len));
    this.buf = nb; this.f32 = new Float32Array(nb); this.u8 = new Uint8Array(nb);
  }
}
class IdxList {
  constructor(n) { this.a = new Uint32Array(n); this.len = 0; }
  push6(s, a, b, c, d, e, f) {
    if (this.len + 6 > this.a.length) { const n = new Uint32Array(this.a.length * 2); n.set(this.a); this.a = n; }
    const A = this.a, l = this.len; A[l] = s + a; A[l + 1] = s + b; A[l + 2] = s + c; A[l + 3] = s + d; A[l + 4] = s + e; A[l + 5] = s + f; this.len = l + 6;
  }
}

export class Mesher {
  constructor() {
    this.sky = new Uint8Array(RS3);
    this.blk = new Uint8Array(RS3);
    this.queue = new Int32Array(1 << 20);
    this.visited = new Uint8Array(CS3);
  }

  /**
   * region: Uint16Array(RS3); heightPatch: Int32Array(RS2) world y of top light-blocker; climate: Uint16Array(RS2)
   * Returns transferable result.
   */
  mesh(region, heightPatch, climate, sx, sy, sz, leafBits) {
    const fancyLeaves = (leafBits & 1) !== 0, tufts = (leafBits & 2) !== 0;
    this.region = region; this.heightPatch = heightPatch; this.climate = climate;
    this.sy = sy; this.sx = sx; this.sz = sz;
    this.computeLight();
    const connectivity = this.connectivity();
    const vb = new Growable(1 << 18);
    const opaque = new IdxList(1 << 14), cutout = new IdxList(1 << 12), water = new IdxList(1 << 12), glow = new IdxList(64);
    this.vb = vb; this.vcount = 0;
    let leaves = 0;
    for (let y = 0; y < CS; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const id = region[RI(x, y, z)];
      if (id === 0) continue;
      const shape = SHAPE[id];
      if (shape === Shape.Cube) {
        for (let f = 0; f < 6; f++) { const n = FN[f]; if (!OPAQUE[region[RI(x + n[0], y + n[1], z + n[2])]]) this.cubeFace(x, y, z, f, id, opaque, false); }
      } else if (shape === Shape.Cutout) {
        leaves++;
        for (let f = 0; f < 6; f++) {
          const n = FN[f]; const nb = region[RI(x + n[0], y + n[1], z + n[2])];
          if (OPAQUE[nb]) continue;
          if (!fancyLeaves && SHAPE[nb] === Shape.Cutout) continue;
          this.cubeFace(x, y, z, f, id, cutout, true);
          if (tufts && EXT[id] !== NONE && SHAPE[nb] !== Shape.Cutout && !(f === 3 && !fancyLeaves)) this.leafTuft(x, y, z, f, id, cutout);
        }
      } else if (shape === Shape.Cross) this.cross(x, y, z, id, cutout);
      else if (shape === Shape.Torch) this.torch(x, y, z, id, opaque);
      else if (shape === Shape.Liquid) { if (isLava(id)) this.water(x, y, z, id, opaque, true); else this.water(x, y, z, id, water, false); }
      else if (shape === Shape.Portal) this.portal(x, y, z, id, glow);
      else if (shape === Shape.Glass) {
        for (let f = 0; f < 6; f++) { const n = FN[f], nb = region[RI(x + n[0], y + n[1], z + n[2])]; if (nb !== id && !OPAQUE[nb]) this.cubeFace(x, y, z, f, id, glow, true); }
      }
      else if (shape === Shape.EndPortal) this.endPortal(x, y, z, id, opaque);
      else if (shape === Shape.Model) this.model(x, y, z, id, [opaque, cutout, glow][FAMS[BLOCKS[id].model.fam].list]);
    }
    const vertices = vb.buf.slice(0, vb.len);
    return {
      vertices, vertexCount: this.vcount,
      opaque: opaque.a.slice(0, opaque.len), cutout: cutout.a.slice(0, cutout.len), water: water.a.slice(0, water.len), glow: glow.a.slice(0, glow.len),
      connectivity, leaves,
    };
  }

  /** cells: Int8Array of section-local x,y,z triples. Returns Uint8Array sky,block per cell (0..15). */
  lightAtCells(cells) {
    const n = cells.length / 3, out = new Uint8Array(n * 2);
    const N6 = [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (let i = 0; i < n; i++) {
      let sky = 0, bl = 0;
      for (const d of N6) {
        const ri = RI(cells[i * 3] + d[0], cells[i * 3 + 1] + d[1], cells[i * 3 + 2] + d[2]);
        if (this.sky[ri] > sky) sky = this.sky[ri];
        if (this.blk[ri] > bl) bl = this.blk[ri];
      }
      out[i * 2] = sky; out[i * 2 + 1] = bl;
    }
    return out;
  }

  // ---------------------------------------------------------------- lighting

  computeLight() {
    const region = this.region, hp = this.heightPatch, sky = this.sky, blk = this.blk, q = this.queue;
    const baseY = this.sy * CS - RM;
    let head = 0, tail = 0;
    const QM = q.length - 1;
    for (let y = 0; y < RS; y++) {
      const wy = baseY + y;
      for (let z = 0; z < RS; z++) for (let x = 0; x < RS; x++) {
        const i = x + z * RS + y * RS2;
        sky[i] = wy > hp[x + z * RS] ? MAX_LIGHT : 0;
        const e = EMIT[region[i]];
        blk[i] = e;
        if (e > 0) { q[tail] = i; tail = (tail + 1) & QM; }
      }
    }
    this.flood(blk, head, tail);
    head = 0; tail = 0;
    for (let z = 0; z < RS; z++) for (let x = 0; x < RS; x++) {
      const h = hp[x + z * RS];
      let top = h;
      if (x > 0) top = Math.max(top, hp[x - 1 + z * RS]);
      if (x < RS - 1) top = Math.max(top, hp[x + 1 + z * RS]);
      if (z > 0) top = Math.max(top, hp[x + (z - 1) * RS]);
      if (z < RS - 1) top = Math.max(top, hp[x + (z + 1) * RS]);
      const from = Math.max(h + 1 - baseY, 0), to = Math.min(Math.max(top, h + 1) - baseY, RS - 1);
      for (let y = from; y <= to; y++) { q[tail] = x + z * RS + y * RS2; tail = (tail + 1) & QM; }
    }
    this.flood(sky, head, tail);
  }

  flood(light, head, tail) {
    const q = this.queue, QM = q.length - 1, region = this.region;
    const spread = (n, l) => {
      const op = OPACITY[region[n]];
      if (op >= MAX_LIGHT) return;
      const nl = l - (op > 1 ? op : 1);
      if (nl > light[n]) { light[n] = nl; q[tail] = n; tail = (tail + 1) & QM; }
    };
    while (head !== tail) {
      const i = q[head]; head = (head + 1) & QM;
      const l = light[i];
      if (l <= 1) continue;
      const x = i & 63, z = (i >> 6) & 63, y = i >> 12;
      if (x > 0) spread(i - 1, l);
      if (x < RS - 1) spread(i + 1, l);
      if (z > 0) spread(i - RS, l);
      if (z < RS - 1) spread(i + RS, l);
      if (y > 0) spread(i - RS2, l);
      if (y < RS - 1) spread(i + RS2, l);
    }
  }

  // ---------------------------------------------------------------- connectivity (6 masks: exits reachable from each face)

  connectivity() {
    const conn = [0, 0, 0, 0, 0, 0];
    const vis = this.visited, q = this.queue, region = this.region;
    vis.fill(0);
    for (let s = 0; s < CS3; s++) {
      if (vis[s]) continue;
      const sx = s & 31, sz = (s >> 5) & 31, sy = s >> 10;
      vis[s] = 1;
      if (OPAQUE[region[RI(sx, sy, sz)]]) continue;
      let faces = 0, head = 0, tail = 0;
      q[tail++] = s;
      while (head < tail) {
        const i = q[head++];
        const x = i & 31, z = (i >> 5) & 31, y = i >> 10;
        if (x === 31) faces |= 1; if (x === 0) faces |= 2; if (y === 31) faces |= 4; if (y === 0) faces |= 8; if (z === 31) faces |= 16; if (z === 0) faces |= 32;
        const visit = (j, xx, yy, zz) => { if (vis[j]) return; vis[j] = 1; if (!OPAQUE[region[RI(xx, yy, zz)]]) q[tail++] = j; };
        if (x > 0) visit(i - 1, x - 1, y, z);
        if (x < 31) visit(i + 1, x + 1, y, z);
        if (z > 0) visit(i - 32, x, y, z - 1);
        if (z < 31) visit(i + 32, x, y, z + 1);
        if (y > 0) visit(i - 1024, x, y - 1, z);
        if (y < 31) visit(i + 1024, x, y + 1, z);
      }
      for (let a = 0; a < 6; a++) if (faces & (1 << a)) conn[a] |= faces;
    }
    return conn;
  }

  // ---------------------------------------------------------------- vertex helpers

  opq(x, y, z) { return OPAQUE[this.region[RI(x, y, z)]]; }
  light(x, y, z) { const i = RI(x, y, z); return [this.sky[i], this.blk[i]]; }
  clim(x, z) { return this.climate[(x + RM) + (z + RM) * RS]; }

  vert(px, py, pz, face, edges, layer, ao, overlay, sky, bl, clim, tint, wind, fx = layer === NONE ? 128 : layer >> 8, fz = 128) {
    const vb = this.vb; vb.ensure(24);
    const o = vb.len; const f = vb.f32, u = vb.u8, fi = o >> 2;
    f[fi] = px; f[fi + 1] = py; f[fi + 2] = pz;
    u[o + 12] = face | (edges << 3); u[o + 13] = layer & 255; u[o + 14] = ao * 85; u[o + 15] = overlay;
    u[o + 16] = sky * 17; u[o + 17] = bl * 17; u[o + 18] = clim & 255; u[o + 19] = clim >> 8;
    u[o + 20] = tint; u[o + 21] = wind; u[o + 22] = fx; u[o + 23] = fz;
    vb.len = o + 24;
    return this.vcount++;
  }

  cornerLight(fx, fy, fz, s1x, s1y, s1z, s2x, s2y, s2z, o1, o2) {
    let [s, b] = this.light(fx, fy, fz); let n = 1;
    if (!o1) { const l = this.light(s1x, s1y, s1z); s += l[0]; b += l[1]; n++; }
    if (!o2) { const l = this.light(s2x, s2y, s2z); s += l[0]; b += l[1]; n++; }
    if (!(o1 && o2)) {
      const cx = s1x + s2x - fx, cy = s1y + s2y - fy, cz = s1z + s2z - fz;
      if (!this.opq(cx, cy, cz)) { const l = this.light(cx, cy, cz); s += l[0]; b += l[1]; n++; }
    }
    return [Math.round(s / n), Math.round(b / n)];
  }

  cubeFace(x, y, z, face, id, list, cutout) {
    const d = BLOCKS[id], n = FN[face], t = FT[face], b = FB[face];
    const fx = x + n[0], fy = y + n[1], fz = z + n[2];
    const edges = cutout ? 0
      : (this.opq(x - t[0], y - t[1], z - t[2]) ? 0 : 1) | (this.opq(x + t[0], y + t[1], z + t[2]) ? 0 : 2)
      | (this.opq(x - b[0], y - b[1], z - b[2]) ? 0 : 4) | (this.opq(x + b[0], y + b[1], z + b[2]) ? 0 : 8);
    const sNT = this.opq(fx - t[0], fy - t[1], fz - t[2]), sPT = this.opq(fx + t[0], fy + t[1], fz + t[2]);
    const sNB = this.opq(fx - b[0], fy - b[1], fz - b[2]), sPB = this.opq(fx + b[0], fy + b[1], fz + b[2]);
    const ao = (a, c, k) => (a && c ? 0 : 3 - (a + c + k));
    const ao0 = ao(sNT, sNB, this.opq(fx - t[0] - b[0], fy - t[1] - b[1], fz - t[2] - b[2]));
    const ao1 = ao(sNT, sPB, this.opq(fx - t[0] + b[0], fy - t[1] + b[1], fz - t[2] + b[2]));
    const ao2 = ao(sPT, sPB, this.opq(fx + t[0] + b[0], fy + t[1] + b[1], fz + t[2] + b[2]));
    const ao3 = ao(sPT, sNB, this.opq(fx + t[0] - b[0], fy + t[1] - b[1], fz + t[2] - b[2]));
    const l0 = this.cornerLight(fx, fy, fz, fx - t[0], fy - t[1], fz - t[2], fx - b[0], fy - b[1], fz - b[2], sNT, sNB);
    const l1 = this.cornerLight(fx, fy, fz, fx - t[0], fy - t[1], fz - t[2], fx + b[0], fy + b[1], fz + b[2], sNT, sPB);
    const l2 = this.cornerLight(fx, fy, fz, fx + t[0], fy + t[1], fz + t[2], fx + b[0], fy + b[1], fz + b[2], sPT, sPB);
    const l3 = this.cornerLight(fx, fy, fz, fx + t[0], fy + t[1], fz + t[2], fx - b[0], fy - b[1], fz - b[2], sPT, sNB);
    const layer = layerFor(d, face);
    const overlay = face !== 2 && face !== 3 ? d.overlay : NONE;
    const clim = this.clim(x, z);
    const cx = x + 0.5 + n[0] * 0.5, cy = y + 0.5 + n[1] * 0.5, cz = z + 0.5 + n[2] * 0.5;
    const tx = t[0] * 0.5, ty = t[1] * 0.5, tz = t[2] * 0.5, bx = b[0] * 0.5, by = b[1] * 0.5, bz = b[2] * 0.5;
    const s = this.vert(cx - tx - bx, cy - ty - by, cz - tz - bz, face, edges, layer, ao0, overlay, l0[0], l0[1], clim, d.tint, d.wind);
    this.vert(cx - tx + bx, cy - ty + by, cz - tz + bz, face, edges, layer, ao1, overlay, l1[0], l1[1], clim, d.tint, d.wind);
    this.vert(cx + tx + bx, cy + ty + by, cz + tz + bz, face, edges, layer, ao2, overlay, l2[0], l2[1], clim, d.tint, d.wind);
    this.vert(cx + tx - bx, cy + ty - by, cz + tz - bz, face, edges, layer, ao3, overlay, l3[0], l3[1], clim, d.tint, d.wind);
    const s02 = ao0 + ao2 + ((l0[0] + l2[0]) >> 3), s13 = ao1 + ao3 + ((l1[0] + l3[0]) >> 3);
    // counter-clockwise seen from outside (WebGL's default front face)
    if (s02 >= s13) list.push6(s, 0, 1, 2, 0, 2, 3); else list.push6(s, 1, 2, 3, 1, 3, 0);
  }

  /** A loose leaf cluster outside an exposed leaf face: pushed out, oversized and jittered so canopies read round and fluffy. */
  leafTuft(x, y, z, face, id, list) {
    const d = BLOCKS[id], n = FN[face], t = FT[face], b = FB[face];
    const wx = this.sx * CS + x, wy = this.sy * CS + y, wz = this.sz * CS + z;
    let h = (Math.imul(wx, 73856093) ^ Math.imul(wy, 19349663) ^ Math.imul(wz, 83492791) ^ Math.imul(face + 1, 2654435761)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const r = (k) => ((h >>> (k * 5)) & 31) / 31;
    const out = 0.12 + r(0) * 0.26, half = 0.62 + r(1) * 0.22, ju = (r(2) - 0.5) * 0.35, jv = (r(3) - 0.5) * 0.35;
    const [sl, bl] = this.light(x + n[0], y + n[1], z + n[2]);
    const clim = this.clim(x, z);
    const cx = x + 0.5 + n[0] * (0.5 + out) + t[0] * ju + b[0] * jv, cy = y + 0.5 + n[1] * (0.5 + out) + t[1] * ju + b[1] * jv;
    const cz = z + 0.5 + n[2] * (0.5 + out) + t[2] * ju + b[2] * jv;
    // tilt the cluster a little toward the face normal's neighbours so the silhouette is not a stack of planes
    const tilt = (r(4) - 0.5) * 0.5;
    const tx = t[0] * half, ty = t[1] * half, tz = t[2] * half;
    const bx = b[0] * half + n[0] * tilt, by = b[1] * half + n[1] * tilt, bz = b[2] * half + n[2] * tilt;
    const layer = EXT[id];
    const s = this.vert(cx - tx - bx, cy - ty - by, cz - tz - bz, face, 0, layer, 2, NONE, sl, bl, clim, d.tint, d.wind);
    this.vert(cx - tx + bx, cy - ty + by, cz - tz + bz, face, 0, layer, 3, NONE, sl, bl, clim, d.tint, d.wind);
    this.vert(cx + tx + bx, cy + ty + by, cz + tz + bz, face, 0, layer, 3, NONE, sl, bl, clim, d.tint, d.wind);
    this.vert(cx + tx - bx, cy + ty - by, cz + tz - bz, face, 0, layer, 2, NONE, sl, bl, clim, d.tint, d.wind);
    list.push6(s, 0, 1, 2, 0, 2, 3);
  }

  cross(x, y, z, id, list) {
    const d = BLOCKS[id];
    const wx = this.sx * CS + x, wy = this.sy * CS + y, wz = this.sz * CS + z;
    let h = (Math.imul(wx, 73856093) ^ Math.imul(wy, 19349663) ^ Math.imul(wz, 83492791)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const jx = ((h & 255) / 255 - 0.5) * 0.3, jz = (((h >>> 8) & 255) / 255 - 0.5) * 0.3;
    const height = d.wind > 0 ? 0.85 + (((h >>> 16) & 255) / 255) * 0.3 : 1;
    const [sl, bl] = this.light(x, y, z);
    const clim = this.clim(x, z), inset = 0.08;
    for (let p = 0; p < 2; p++) {
      const face = p === 0 ? 6 : 7;
      const ax = p === 0 ? inset : 1 - inset, az = inset, cx2 = p === 0 ? 1 - inset : inset, cz2 = 1 - inset;
      const s = this.vert(x + ax + jx, y, z + az + jz, face, 0, d.side, 1, NONE, sl, bl, clim, d.tint, 0);
      this.vert(x + ax + jx, y + height, z + az + jz, face, 2, d.side, 3, NONE, sl, bl, clim, d.tint, d.wind);
      this.vert(x + cx2 + jx, y + height, z + cz2 + jz, face, 3, d.side, 3, NONE, sl, bl, clim, d.tint, d.wind);
      this.vert(x + cx2 + jx, y, z + cz2 + jz, face, 1, d.side, 1, NONE, sl, bl, clim, d.tint, 0);
      list.push6(s, 0, 1, 2, 0, 2, 3);
    }
  }

  torch(x, y, z, id, list) {
    const d = BLOCKS[id];
    const lo = 7 / 16, hi = 9 / 16, top = 10 / 16;
    const [sl, bl] = this.light(x, y, z);
    const clim = this.clim(x, z);
    const min = [x + lo, y, z + lo], max = [x + hi, y + top, z + hi];
    const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const hf = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
    for (let f = 0; f < 6; f++) {
      if (f === 3) continue;
      const n = FN[f], t = FT[f], b = FB[f];
      const cx = c[0] + n[0] * hf[0], cy = c[1] + n[1] * hf[1], cz = c[2] + n[2] * hf[2];
      const tx = t[0] * hf[0], ty = t[1] * hf[1], tz = t[2] * hf[2], bx = b[0] * hf[0], by = b[1] * hf[1], bz = b[2] * hf[2];
      const layer = layerFor(d, f);
      const s = this.vert(cx - tx - bx, cy - ty - by, cz - tz - bz, f, 0, layer, 3, NONE, sl, bl, clim, 0, 0);
      this.vert(cx - tx + bx, cy - ty + by, cz - tz + bz, f, 0, layer, 3, NONE, sl, bl, clim, 0, 0);
      this.vert(cx + tx + bx, cy + ty + by, cz + tz + bz, f, 0, layer, 3, NONE, sl, bl, clim, 0, 0);
      this.vert(cx + tx - bx, cy + ty - by, cz + tz - bz, f, 0, layer, 3, NONE, sl, bl, clim, 0, 0);
      list.push6(s, 0, 1, 2, 0, 2, 3);
    }
  }

  /** A box's faces with flat light (portal panes, the end portal slab). faces: which of the 6 to emit. */
  box(min, max, faces, layer, list, x, y, z) {
    const [sl, bl] = this.light(x, y, z);
    const clim = this.clim(x, z);
    const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const hf = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
    for (let f = 0; f < 6; f++) {
      if (!(faces & (1 << f))) continue;
      const n = FN[f], t = FT[f], b = FB[f];
      const cx = c[0] + n[0] * hf[0], cy = c[1] + n[1] * hf[1], cz = c[2] + n[2] * hf[2];
      const tx = t[0] * hf[0], ty = t[1] * hf[1], tz = t[2] * hf[2], bx = b[0] * hf[0], by = b[1] * hf[1], bz = b[2] * hf[2];
      const s = this.vert(cx - tx - bx, cy - ty - by, cz - tz - bz, f, 0, layer, 3, NONE, sl, bl, clim, 0, 0);
      this.vert(cx - tx + bx, cy - ty + by, cz - tz + bz, f, 0, layer, 3, NONE, sl, bl, clim, 0, 0);
      this.vert(cx + tx + bx, cy + ty + by, cz + tz + bz, f, 0, layer, 3, NONE, sl, bl, clim, 0, 0);
      this.vert(cx + tx - bx, cy + ty - by, cz + tz - bz, f, 0, layer, 3, NONE, sl, bl, clim, 0, 0);
      list.push6(s, 0, 1, 2, 0, 2, 3);
    }
  }

  /** A shaped block (shapes.js): its boxes, faces against opaque neighbours dropped, world-aligned textures. */
  model(x, y, z, id, list) {
    const d = BLOCKS[id], m = d.model, region = this.region;
    let conn = 0, up = false;
    if (CONNECTING.has(m.kind)) {
      conn = connections(m.kind, (dx, dz, dy = 0) => { const n = region[RI(x + dx, y + dy, z + dz)]; return { id: n, opaque: OPAQUE[n], model: BLOCKS[n] && BLOCKS[n].model }; }, m);
      up = region[RI(x, y + 1, z)] !== 0;
    }
    const own = this.light(x, y, z), clim = this.clim(x, z);
    for (const bx of modelBoxes(m, conn, up, false)) {
      const min = [x + bx[0], y + bx[1], z + bx[2]], max = [x + bx[3], y + bx[4], z + bx[5]];
      const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
      const hf = [(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2];
      for (let f = 0; f < 6; f++) {
        const n = FN[f], t = FT[f], b = FB[f];
        const edge = [bx[3] >= 1, bx[0] <= 0, bx[4] >= 1, bx[1] <= 0, bx[5] >= 1, bx[2] <= 0][f];
        const nl = this.light(x + n[0], y + n[1], z + n[2]);
        if (edge && OPAQUE[region[RI(x + n[0], y + n[1], z + n[2])]]) continue;
        const sl = Math.max(own[0], nl[0]), bl = Math.max(own[1], nl[1]);
        const cx = c[0] + n[0] * hf[0], cy = c[1] + n[1] * hf[1], cz = c[2] + n[2] * hf[2];
        const tx = t[0] * hf[0], ty = t[1] * hf[1], tz = t[2] * hf[2], ux = b[0] * hf[0], uy = b[1] * hf[1], uz = b[2] * hf[2];
        const layer = bx.length > 6 && d.alt ? d.alt[bx[6]] : layerFor(d, f);
        const P = [[cx - tx - ux, cy - ty - uy, cz - tz - uz], [cx - tx + ux, cy - ty + uy, cz - tz + uz], [cx + tx + ux, cy + ty + uy, cz + tz + uz], [cx + tx - ux, cy + ty - uy, cz + tz - uz]];
        let s0 = -1;
        for (const p of P) {
          const ao = f === 3 ? 2 : f === 2 ? 3 : p[1] <= min[1] + 1e-4 && bx[1] <= 0 ? 2 : 3;
          const v = this.vert(p[0], p[1], p[2], f, 0, layer, ao, NONE, sl, bl, clim, d.tint, 0);
          if (s0 < 0) s0 = v;
        }
        list.push6(s0, 0, 1, 2, 0, 2, 3);
      }
    }
  }

  /** Nether portal: a pane a quarter block thick across the frame (X: spans x, faces +-z). */
  portal(x, y, z, id, list) {
    const alongX = id === B.NetherPortalX, d = BLOCKS[id];
    const min = alongX ? [x, y, z + 0.375] : [x + 0.375, y, z], max = alongX ? [x + 1, y + 1, z + 0.625] : [x + 0.625, y + 1, z + 1];
    let faces = alongX ? (1 << 4) | (1 << 5) : 1 | 2;
    // the thin edges only where the pane ends (not against more portal or the frame)
    for (const f of alongX ? [0, 1, 2, 3] : [2, 3, 4, 5]) {
      const n = FN[f], nb = this.region[RI(x + n[0], y + n[1], z + n[2])];
      if (nb !== id && !OPAQUE[nb]) faces |= 1 << f;
    }
    this.box(min, max, faces, d.side, list, x, y, z);
  }

  /** End portal: a slab 3/4 high showing the starfield (top and, seen from below, bottom). */
  endPortal(x, y, z, id, list) {
    const d = BLOCKS[id];
    let faces = (1 << 2) | (OPAQUE[this.region[RI(x, y - 1, z)]] ? 0 : 1 << 3);
    for (const f of [0, 1, 4, 5]) {
      const n = FN[f], nb = this.region[RI(x + n[0], y, z + n[2])];
      if (nb !== id && !OPAQUE[nb]) faces |= 1 << f;
    }
    this.box([x, y, z], [x + 1, y + 0.75, z + 1], faces, d.top, list, x, y, z);
  }

  // ---------------------------------------------------------------- water (and lava) with levels

  surfaceHeight(x, y, z) {
    const id = this.region[RI(x, y, z)];
    const same = this.lava ? isLava : isWater;
    if (!same(id)) return -1;
    if (same(this.region[RI(x, y + 1, z)])) return 1;
    return (this.lava ? lavaLevel(id) : waterLevel(id)) / 8 * 0.88;
  }

  cornerHeight(x, y, z, cx, cz) {
    // corner at (x+cx, z+cz), cx,cz in {0,1}: average over the four cells touching it
    let sum = 0, n = 0;
    for (let dz = cz - 1; dz <= cz; dz++) for (let dx = cx - 1; dx <= cx; dx++) {
      const h = this.surfaceHeight(x + dx, y, z + dz);
      if (h >= 1) return 1;
      if (h >= 0) { sum += h; n++; }
    }
    return n ? sum / n : 0;
  }

  water(x, y, z, id, list, lava) {
    const region = this.region;
    this.lava = lava;
    const same = lava ? isLava : isWater;
    const layer = lava ? BLOCKS[id].top : NONE;
    const above = region[RI(x, y + 1, z)];
    const full = same(above);
    const h00 = full ? 1 : this.cornerHeight(x, y, z, 0, 0), h10 = full ? 1 : this.cornerHeight(x, y, z, 1, 0);
    const h11 = full ? 1 : this.cornerHeight(x, y, z, 1, 1), h01 = full ? 1 : this.cornerHeight(x, y, z, 0, 1);
    // flow: downhill direction of the surface; falling water flows straight down
    let fx = (h00 + h01) - (h10 + h11), fz = (h00 + h10) - (h01 + h11);
    const below = region[RI(x, y - 1, z)];
    const falling = !same(below) && !OPAQUE[below] ? 1 : 0;
    const fl = Math.hypot(fx, fz);
    if (fl > 1e-3) { fx /= fl; fz /= fl; } else { fx = 0; fz = 0; }
    const fxe = Math.round(fx * 127 + 128), fze = Math.round(fz * 127 + 128);
    const [sl, bl] = this.light(x, y, z);
    const clim = this.clim(x, z);
    const H = [[h00, h01], [h10, h11]];   // H[cx][cz]
    for (let f = 0; f < 6; f++) {
      const n = FN[f];
      const other = region[RI(x + n[0], y + n[1], z + n[2])];
      if (f === 2) { if (full || OPAQUE[other]) continue; }          // free surface only
      else if (same(other) || OPAQUE[other]) continue;          // sides/bottom only against air or see-through blocks
      const t = FT[f], b = FB[f];
      const ls = this.light(x + n[0], y + n[1], z + n[2]);
      const s1 = Math.max(sl, ls[0]), b1 = Math.max(bl, ls[1]);
      const corners = [];
      for (const [su, sv] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
        let px = x + 0.5 + n[0] * 0.5 + t[0] * 0.5 * su + b[0] * 0.5 * sv;
        let py = y + 0.5 + n[1] * 0.5 + t[1] * 0.5 * su + b[1] * 0.5 * sv;
        let pz = z + 0.5 + n[2] * 0.5 + t[2] * 0.5 * su + b[2] * 0.5 * sv;
        if (f !== 3 && py > y + 0.5) {       // top corners follow the surface
          const cxi = Math.round(px - x), czi = Math.round(pz - z);
          py = y + H[cxi][czi];
        }
        corners.push([px, py, pz]);
      }
      const d2 = falling && f !== 2 && f !== 3 ? 255 : 0;
      const tint = lava ? 0 : d2;
      const hx = lava ? layer >> 8 : fxe, hz = lava ? 128 : fze;   // lava needs the layer's high byte, not a flow
      const s = this.vert(corners[0][0], corners[0][1], corners[0][2], f, 0, layer, 3, NONE, s1, b1, clim, tint, 0, hx, hz);
      for (let k = 1; k < 4; k++) this.vert(corners[k][0], corners[k][1], corners[k][2], f, 0, layer, 3, NONE, s1, b1, clim, tint, 0, hx, hz);
      list.push6(s, 0, 1, 2, 0, 2, 3);
    }
  }
}

export const SECTION_RANGE = [MIN_SY, MAX_SY];
