// The Skylands (not in Minecraft; after the Aether mod): floating islands of grass and pale calcite over a sea of
// clouds, reached through a glowstone portal lit with water. Trees with blossom canopies, glowstone and amethyst in
// the stone, and floating quartz temples where a Storm Ghast waits. Falling off the islands drops the player back
// into the overworld.
//
// The island density is 3D noise sampled on a world-aligned 4-block lattice and blended, so it is a pure function of
// the world position: any column can find the top of an island in another (trees, temples) and agree with it.
import { CS, CS2, HEIGHT, colIdx } from './const.js';
import { B, C } from './blocks.js';
import { Biome } from './terrain.js';
import { Simplex, hash4, mulberry32 } from './noise.js';

export const SKY_LOW = 44, SKY_HIGH = 216;          // islands live between these heights
const L = 4;
const cache = new Map();
function noiseFor(seed) {
  let n = cache.get(seed);
  if (!n) { n = new Simplex((seed ^ 0x5C7A) >>> 0); cache.set(seed, n); }
  return n;
}

/** How much island there is over (x, z) and where its middle floats. */
function column(n, x, z) {
  const mask = n.fbm2(x / 230 + 17.3, z / 230 - 4.1, 3) * 1.15 + 0.02;
  const centre = 112 + n.fbm2(x / 380 + 9.1, z / 380 + 2.7, 2) * 46;
  return { mask, centre };
}
const lat = (n, X, Y, Z) => n.fbm3(X * L / 56 + 3.3, Y * L / 26, Z * L / 56 - 7.7, 3);

/** Island density at a block (positive = rock). memo: a Map for lattice corners shared by nearby calls. */
export function skyDensity(n, x, y, z, memo) {
  const X = Math.floor(x / L), Y = Math.floor(y / L), Z = Math.floor(z / L), fx = x / L - X, fy = y / L - Y, fz = z / L - Z;
  const g = (a, b, c) => { const k = `${a},${b},${c}`; let v = memo && memo.get(k); if (v === undefined) { v = lat(n, a, b, c); if (memo) memo.set(k, v); } return v; };
  const c00 = g(X, Y, Z) + (g(X + 1, Y, Z) - g(X, Y, Z)) * fx, c10 = g(X, Y, Z + 1) + (g(X + 1, Y, Z + 1) - g(X, Y, Z + 1)) * fx;
  const c01 = g(X, Y + 1, Z) + (g(X + 1, Y + 1, Z) - g(X, Y + 1, Z)) * fx, c11 = g(X, Y + 1, Z + 1) + (g(X + 1, Y + 1, Z + 1) - g(X, Y + 1, Z + 1)) * fx;
  const noise = (c00 + (c10 - c00) * fz) + ((c01 + (c11 - c01) * fz) - (c00 + (c10 - c00) * fz)) * fy;
  const col = column(n, x, z);
  // flat-ish tops, long dripping undersides
  const fall = y > col.centre ? ((y - col.centre) / 9) ** 2 : ((col.centre - y) / 30) ** 1.6;
  return noise * 0.6 + col.mask - fall - 0.28;
}

/** The top of the island over (x, z), or null. */
export function islandTop(seed, x, z, memo = new Map()) {
  const n = noiseFor(seed), col = column(n, x, z);
  if (col.mask + 0.6 - 0.28 < 0) return null;
  for (let y = Math.min(SKY_HIGH, Math.floor(col.centre) + 30); y > col.centre - 70 && y > SKY_LOW; y--) if (skyDensity(n, x, y, z, memo) > 0) return y;
  return null;
}

/** Floating temples: one per 320-block region (60%), high over the islands. */
export function skyTemples(seed, x0, z0, x1, z1) {
  const out = [], S = 320;
  for (let rz = Math.floor((z0 - 16) / S); rz <= Math.floor((z1 + 16) / S); rz++) for (let rx = Math.floor((x0 - 16) / S); rx <= Math.floor((x1 + 16) / S); rx++) {
    const h = hash4(rx, rz, seed ^ 0x7E3B, 5);
    if ((h & 1023) / 1024 > 0.6) continue;
    const r = mulberry32(h | 1);
    out.push({ x: rx * S + 60 + Math.floor(r() * (S - 120)), z: rz * S + 60 + Math.floor(r() * (S - 120)), y: 168 + Math.floor(r() * 20), key: `${rx},${rz}` });
  }
  return out;
}

export function generateSkylands(cx, cz, seed) {
  const n = noiseFor(seed), ox = cx * CS, oz = cz * CS;
  const vox = new Uint16Array(HEIGHT * CS2);
  const sHeight = new Int32Array(CS2).fill(-9999), sTop = new Uint16Array(CS2), sBiome = new Uint8Array(CS2).fill(Biome.Plains);
  const sTemp = new Uint8Array(CS2).fill(150), sHumid = new Uint8Array(CS2).fill(150);
  const memo = new Map();
  const set = (x, y, z, b) => { if (x >= ox && z >= oz && x < ox + CS && z < oz + CS && y > 0 && y < 250) vox[colIdx(x - ox, y, z - oz)] = b; };
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const wx = ox + x, wz = oz + z, col = column(n, wx, wz);
    // cloud banks far below the islands: soft to land on
    const cl = n.fbm2(wx / 90 + 40, wz / 90, 3);
    if (cl > 0.28) { const t = cl > 0.45 ? 3 : 2; for (let y = 38; y < 38 + t; y++) vox[colIdx(x, y, z)] = C.powder_snow; }
    if (col.mask + 0.6 - 0.28 < 0) continue;
    let depth = -1, top = null;
    for (let y = Math.min(SKY_HIGH, Math.floor(col.centre) + 30); y > col.centre - 70 && y > SKY_LOW; y--) {
      if (skyDensity(n, wx, y, wz, memo) <= 0) { depth = -1; continue; }
      depth++;
      if (top === null) top = y;
      let b;
      if (depth === 0) b = B.Grass;
      else if (depth < 4) b = B.Dirt;
      else {
        const h = hash4(wx, y, wz, seed ^ 0x51) & 1023;
        b = h < 12 ? B.Glowstone : h < 19 ? C.amethyst_block : h < 24 ? B.GoldOre : h < 26 ? B.DiamondOre : C.calcite;
      }
      vox[colIdx(x, y, z)] = b;
    }
    if (top !== null) {
      const k = x + z * CS;
      sHeight[k] = top; sTop[k] = B.Grass;
      const h = hash4(wx, top, wz, seed ^ 0x77) & 255;
      if (h < 20) vox[colIdx(x, top + 1, z)] = B.TallGrass;
      else if (h < 26) vox[colIdx(x, top + 1, z)] = h & 1 ? B.FlowerRed : B.FlowerYellow;
    }
  }
  // trees on the islands: pale trunks, blossom canopies (any column can find another's island top)
  const G = 7;
  for (let gz = Math.floor((oz - 4) / G); gz <= Math.floor((oz + CS + 4) / G); gz++) for (let gx = Math.floor((ox - 4) / G); gx <= Math.floor((ox + CS + 4) / G); gx++) {
    const h = hash4(gx, gz, seed ^ 0x7A3, 9);
    if ((h & 255) > 90) continue;
    const px = gx * G + ((h >>> 8) % G), pz = gz * G + ((h >>> 12) % G);
    if (px < ox - 3 || pz < oz - 3 || px >= ox + CS + 3 || pz >= oz + CS + 3) continue;
    const top = islandTop(seed, px, pz, memo);
    if (top === null) continue;
    const r = mulberry32(h | 1), trunk = 4 + Math.floor(r() * 3);
    const leaves = [C.cherry_leaves, C.flowering_azalea_leaves, C.azalea_leaves, C.cherry_leaves][Math.floor(r() * 4)] || B.OakLeaves;
    for (let k = 1; k <= trunk; k++) set(px, top + k, pz, B.BirchLog);
    const cy = top + trunk;
    for (let dy = -2; dy <= 2; dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx, dy * 1.4, dz);
      if (d > 3.1 || (dx === 0 && dz === 0 && dy <= 0)) continue;
      if (d > 2.5 && r() < 0.5) continue;
      const x = px + dx, y = cy + dy, z = pz + dz;
      if (x >= ox && z >= oz && x < ox + CS && z < oz + CS && vox[colIdx(x - ox, y, z - oz)] === B.Air) vox[colIdx(x - ox, y, z - oz)] = leaves;
    }
  }
  // floating quartz temples
  for (const t of skyTemples(seed, ox, oz, ox + CS - 1, oz + CS - 1)) buildTemple(set, t, seed);
  return { voxels: vox, surface: { height: sHeight, top: sTop, biome: sBiome, temp: sTemp, humid: sHumid } };
}

function buildTemple(set, t, seed) {
  const q = C.quartz_block || B.Stone, qp = C.quartz_pillar || q, sq = C.smooth_quartz || q, r = mulberry32(hash4(t.x, t.z, seed, 11) | 1);
  for (let dz = -12; dz <= 12; dz++) for (let dx = -12; dx <= 12; dx++) {
    const d = Math.hypot(dx, dz);
    if (d > 12.4) continue;
    // a floating platform, thinning to a point underneath
    const under = Math.floor((12.4 - d) * 0.9);
    for (let k = 0; k <= under; k++) set(t.x + dx, t.y - k, t.z + dz, k === 0 ? ((dx + dz) & 1 ? q : sq) : C.calcite);
    for (let k = 1; k <= 9; k++) set(t.x + dx, t.y + k, t.z + dz, 0);
  }
  // a ring of pillars with glowstone crowns
  for (let a = 0; a < 12; a++) {
    const x = t.x + Math.round(Math.cos(a / 12 * Math.PI * 2) * 10), z = t.z + Math.round(Math.sin(a / 12 * Math.PI * 2) * 10);
    for (let k = 1; k <= 6; k++) set(x, t.y + k, z, qp);
    set(x, t.y + 7, z, B.Glowstone);
  }
  // the altar in the middle and the treasure
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) set(t.x + dx, t.y + 1, t.z + dz, Math.abs(dx) === 2 || Math.abs(dz) === 2 ? sq : C.gold_block || B.Glowstone);
  set(t.x, t.y + 2, t.z, B.Glowstone);
  for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) if (r() < 0.8) set(t.x + dx, t.y + 1, t.z + dz, C.chest);
}
