// The Nether: y 0..127 between bedrock, 3D-noise caverns over a lava sea at y 31, five biomes (nether wastes, crimson
// and warped forests, soul sand valleys, basalt deltas), glowstone hanging from the roof, quartz and gold ores, vines,
// basalt pillars and nether brick fortresses. Huge fungi are placed by decorate.js (they cross column borders).
// Everything is a function of world position and seed, so neighbouring columns always agree.
import { CS, CS2, MIN_Y, HEIGHT, colIdx } from './const.js';
import { B } from './blocks.js';
import { Biome } from './terrain.js';
import { Simplex, hash4, smoothstep } from './noise.js';

export const NETHER_TOP = 127;       // bedrock roof
export const LAVA_SEA = 31;
const STEP = 4, LX = CS / STEP + 1, LY = 128 / STEP + 1;

const noiseCache = new Map();
function noiseFor(seed) {
  let n = noiseCache.get(seed);
  if (!n) { n = new Simplex((seed ^ 0x4E7E4) >>> 0); noiseCache.set(seed, n); }
  return n;
}

// biome centres in the (heat, wet) climate plane
const CENTRES = [
  [Biome.NetherWastes, 0, 0], [Biome.CrimsonForest, 0.42, 0.12], [Biome.WarpedForest, -0.42, 0.22],
  [Biome.SoulSandValley, 0.06, -0.46], [Biome.BasaltDeltas, -0.34, -0.42],
];
/** Biome weights at a point (softmin over the climate distance) and the dominant biome. */
export function netherClimate(n, x, z, out = {}) {
  const heat = n.fbm2(x / 260 + 11.3, z / 260 - 7.1, 3), wet = n.fbm2(x / 260 + 503.7, z / 260 + 91.9, 3);
  let best = 0, bd = 1e9, sum = 0;
  const w = out.w || (out.w = new Float32Array(5));
  for (let i = 0; i < 5; i++) {
    const d = (heat - CENTRES[i][1]) ** 2 + (wet - CENTRES[i][2]) ** 2;
    w[i] = Math.exp(-d / 0.012);
    sum += w[i];
    if (d < bd) { bd = d; best = i; }
  }
  for (let i = 0; i < 5; i++) w[i] /= sum;
  out.biome = CENTRES[best][0];
  return out;
}

export function generateNether(cx, cz, seed) {
  const n = noiseFor(seed);
  const ox = cx * CS, oz = cz * CS;
  // density lattice (world-aligned, so columns agree at their borders)
  const lat = new Float32Array(LX * LX * LY);
  const clim = {};
  for (let lz = 0; lz < LX; lz++) for (let lx = 0; lx < LX; lx++) {
    const px = ox + lx * STEP, pz = oz + lz * STEP;
    const w = netherClimate(n, px, pz, clim).w;
    const forest = w[1] + w[2], soul = w[3], basalt = w[4];
    for (let ly = 0; ly < LY; ly++) {
      const py = ly * STEP;
      const n1 = n.fbm3(px / 82, py / 50, pz / 82, 3);
      const n2 = n.noise3(px / 24 + 70.1, py / 17, pz / 24 - 33.3);
      const floor = smoothstep(48, 4, py) * (1.3 + 0.5 * soul);
      const ceil = smoothstep(82, 126, py) * 1.7;
      lat[lx + lz * LX + ly * LX * LX] = n1 + n2 * (0.24 + 0.4 * basalt) + floor + ceil - 0.44 - 0.1 * forest + 0.05 * soul;
    }
  }
  const density = (x, y, z) => {
    const fx = x / STEP, fz = z / STEP, fy = y / STEP;
    const x0 = Math.min(fx | 0, LX - 2), z0 = Math.min(fz | 0, LX - 2), y0 = Math.min(fy | 0, LY - 2);
    const tx = fx - x0, tz = fz - z0, ty = fy - y0;
    const i = x0 + z0 * LX + y0 * LX * LX, dZ = LX, dY = LX * LX;
    const a = lat[i] + (lat[i + 1] - lat[i]) * tx, b = lat[i + dZ] + (lat[i + dZ + 1] - lat[i + dZ]) * tx;
    const c = lat[i + dY] + (lat[i + dY + 1] - lat[i + dY]) * tx, d = lat[i + dY + dZ] + (lat[i + dY + dZ + 1] - lat[i + dY + dZ]) * tx;
    const e = a + (b - a) * tz, f = c + (d - c) * tz;
    return e + (f - e) * ty;
  };

  const vox = new Uint16Array(HEIGHT * CS2);
  const sHeight = new Int32Array(CS2), sTop = new Uint16Array(CS2), sBiome = new Uint8Array(CS2);
  const sTemp = new Uint8Array(CS2).fill(128), sHumid = new Uint8Array(CS2).fill(128);
  const col = new Uint16Array(128);
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const wx = ox + x, wz = oz + z;
    const biome = netherClimate(n, wx, wz, clim).biome;
    // raw terrain
    for (let y = 0; y < 128; y++) {
      let b;
      if (y === 0 || y === NETHER_TOP) b = B.Bedrock;
      else if (y <= 4 && (hash4(wx, y, wz, seed) & 3) < 5 - y) b = B.Bedrock;
      else if (y >= 123 && (hash4(wx, y, wz, seed + 1) & 3) < y - 122) b = B.Bedrock;
      else b = density(x, y, z) > 0 ? B.Netherrack : y <= LAVA_SEA ? B.Lava : B.Air;
      col[y] = b;
    }
    surface(col, biome, wx, wz, seed, n);
    // below the Nether: bedrock (never reached); above the roof: air
    for (let y = MIN_Y; y < 0; y++) vox[colIdx(x, y, z)] = B.Bedrock;
    for (let y = 0; y < 128; y++) vox[colIdx(x, y, z)] = col[y];
    // fungus ground for decorate.js: the highest nylium floor with head room
    let tree = -9999, top = B.Air;
    for (let y = 110; y > LAVA_SEA; y--) {
      const b = col[y];
      if ((b === B.CrimsonNylium || b === B.WarpedNylium) && col[y + 1] === B.Air) {
        let air = 0; while (air < 12 && y + 1 + air < 127 && col[y + 1 + air] === B.Air) air++;
        if (air >= 10) { tree = y; top = b; break; }
      }
    }
    const k = x + z * CS;
    sHeight[k] = tree; sTop[k] = top; sBiome[k] = biome;
  }
  fortresses(vox, ox, oz, seed);
  return { voxels: vox, surface: { height: sHeight, top: sTop, biome: sBiome, temp: sTemp, humid: sHumid } };
}

/** Floors, ceilings, ores and small features of one x,z column (col: y 0..127). */
function surface(col, biome, wx, wz, seed, n) {
  const r = (y, salt) => (hash4(wx, y, wz, seed * 31 + salt) & 0xFFFF) / 65536;
  const patch = n.noise2(wx / 9 + 17.7, wz / 9 - 3.1);
  const spikes = biome === Biome.BasaltDeltas ? Math.max(0, n.noise2(wx / 5.5, wz / 5.5) - 0.15) * 9 : 0;
  // glowstone: clusters around points of an 11-block grid hang from high ceilings
  const gx = Math.floor(wx / 11), gz = Math.floor(wz / 11);
  let glow = 0;
  if (biome !== Biome.SoulSandValley) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const h = hash4(gx + dx, gz + dz, seed, 0x61F);
      if ((h & 255) > (biome === Biome.NetherWastes ? 110 : 60)) continue;
      const px = (gx + dx) * 11 + ((h >>> 8) & 7) + 2, pz = (gz + dz) * 11 + ((h >>> 12) & 7) + 2;
      const rad = 1.6 + ((h >>> 16) & 7) * 0.3;
      const d = Math.hypot(wx - px, wz - pz);
      if (d < rad) glow = Math.max(glow, (rad - d) * 2.2 + ((h >>> 20) & 3));
    }
  }
  // basalt pillars in soul sand valleys (radius-1 columns on a 13-block grid)
  let pillar = false;
  if (biome === Biome.SoulSandValley || biome === Biome.BasaltDeltas) {
    const px = Math.floor(wx / 13), pz = Math.floor(wz / 13), h = hash4(px, pz, seed, 0xBA5);
    if ((h & 255) < (biome === Biome.SoulSandValley ? 70 : 40)) {
      const qx = px * 13 + 3 + ((h >>> 8) & 7), qz = pz * 13 + 3 + ((h >>> 12) & 7);
      pillar = Math.abs(wx - qx) + Math.abs(wz - qz) <= 1;
    }
  }
  const quartzZone = n.noise3(wx / 14, 0.5, wz / 14);
  for (let y = 126; y >= 1; y--) {
    const b = col[y];
    if (b !== B.Netherrack) continue;
    const above = col[y + 1], below = col[y - 1];
    // floor: the top 1..3 blocks take the biome's ground
    if (above === B.Air || above === B.Lava) {
      let top = B.Netherrack, fill = B.Netherrack, depth = 0;
      switch (biome) {
        case Biome.CrimsonForest: top = above === B.Air ? B.CrimsonNylium : B.Netherrack; break;
        case Biome.WarpedForest: top = above === B.Air ? B.WarpedNylium : B.Netherrack; break;
        case Biome.SoulSandValley: top = fill = patch > 0.1 ? B.SoulSoil : B.SoulSand; depth = 2 + (r(y, 1) < 0.5 ? 1 : 0); break;
        case Biome.BasaltDeltas: top = fill = patch > -0.15 ? B.Basalt : B.Blackstone; depth = 3; break;
        default:
          if (y <= LAVA_SEA + 4 && y >= LAVA_SEA - 3) { top = fill = patch > 0.35 ? B.Gravel : patch < -0.4 ? B.SoulSand : B.Netherrack; depth = 1; }
      }
      col[y] = top;
      for (let k = 1; k <= depth && y - k > 0 && col[y - k] === B.Netherrack; k++) col[y - k] = fill;
      // magma near the lava line
      if ((biome === Biome.NetherWastes || biome === Biome.BasaltDeltas) && y >= LAVA_SEA - 2 && y <= LAVA_SEA + 4 && patch < -0.1 && r(y, 2) < 0.55) col[y] = B.Magma;
      if (above !== B.Air) continue;
      // things standing on the floor
      if (biome === Biome.CrimsonForest || biome === Biome.WarpedForest) {
        const crimson = biome === Biome.CrimsonForest, q = r(y, 3);
        if (!crimson && q < 0.035) { const len = 1 + Math.floor(r(y, 4) * 5); for (let k = 1; k <= len && col[y + k] === B.Air; k++) col[y + k] = B.TwistingVines; }
        else if (q < 0.16) col[y + 1] = crimson ? B.CrimsonRoots : B.WarpedRoots;
        else if (q < 0.19) col[y + 1] = crimson ? B.CrimsonFungus : B.WarpedFungus;
      } else if (biome === Biome.BasaltDeltas) {
        // jagged basalt columns and small lava pools
        const hgt = Math.floor(spikes);
        for (let k = 1; k <= hgt && col[y + k] === B.Air; k++) col[y + k] = B.Basalt;
        if (hgt === 0 && y > LAVA_SEA && n.noise2(wx / 7 + 5.5, wz / 7 - 9.1) > 0.45) col[y] = B.Lava;
      }
      if (pillar) for (let k = 1; y + k < 123 && col[y + k] === B.Air; k++) col[y + k] = B.Basalt;
    } else if (below === B.Air) {
      // ceiling: glowstone and weeping vines hang down
      if (glow > 0 && y > 50) {
        const len = Math.floor(glow);
        for (let k = 0; k <= len && y - k > LAVA_SEA; k++) {
          if (k > 0 && col[y - k] !== B.Air) break;
          col[y - k] = B.Glowstone;
        }
        continue;
      }
      if (biome === Biome.CrimsonForest && r(y, 5) < 0.06) {
        const len = 1 + Math.floor(r(y, 6) * 7);
        for (let k = 1; k <= len && col[y - k] === B.Air; k++) col[y - k] = B.WeepingVines;
      }
      if (biome === Biome.BasaltDeltas && r(y, 7) < 0.5) col[y] = B.Blackstone;
    }
    // ores inside the netherrack
    if (col[y] === B.Netherrack) {
      const q = r(y, 8);
      if (q < 0.006 + Math.max(0, quartzZone) * 0.05) col[y] = B.NetherQuartzOre;
      else if (q > 0.994) col[y] = B.NetherGoldOre;
    }
  }
  // lava falls: now and then a source set into a high wall above open air
  if ((hash4(wx, wz, seed, 0x1A7A) & 1023) < 3) {
    for (let y = 100; y > 45; y--) if (col[y] === B.Netherrack && col[y - 1] === B.Air && col[y + 1] === B.Netherrack) { col[y] = B.Lava; break; }
  }
}

// ---------------------------------------------------------------- nether brick fortresses

const REGION = 432;
/** Fortress plan for a region (or null): a central keep, four bridge arms with side branches, towers at the ends. */
export function fortressIn(rx, rz, seed) {
  const h = hash4(rx, rz, seed, 0xF0A7);
  if ((h & 255) > 150) return null;
  const cx = rx * REGION + 90 + ((h >>> 8) % 250), cz = rz * REGION + 90 + ((h >>> 16) % 250);
  const y = 50 + ((h >>> 24) % 20);
  const pieces = [{ t: 'keep', x0: cx - 7, x1: cx + 7, z0: cz - 7, z1: cz + 7, y }];
  const rng = (k) => (hash4(rx, rz, seed + k, 0xF0A8) & 0xFFFF) / 65536;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  dirs.forEach(([dx, dz], i) => {
    const len = 36 + Math.floor(rng(i) * 50);
    const ex = cx + dx * len, ez = cz + dz * len;
    pieces.push(bridge(cx + dx * 7, cz + dz * 7, ex, ez, y));
    pieces.push({ t: 'tower', x0: ex - 3, x1: ex + 3, z0: ez - 3, z1: ez + 3, y });
    if (rng(i + 10) < 0.7) {
      const at = 16 + Math.floor(rng(i + 20) * (len - 26)), side = rng(i + 30) < 0.5 ? 1 : -1, blen = 14 + Math.floor(rng(i + 40) * 20);
      const bx = cx + dx * at, bz = cz + dz * at;
      const sx = dz * side, sz = dx * side;   // perpendicular
      pieces.push(bridge(bx + sx * 3, bz + sz * 3, bx + sx * blen, bz + sz * blen, y));
      pieces.push({ t: 'tower', x0: bx + sx * blen - 3, x1: bx + sx * blen + 3, z0: bz + sz * blen - 3, z1: bz + sz * blen + 3, y });
    }
  });
  return pieces;
}
function bridge(x0, z0, x1, z1, y) {
  const alongX = z0 === z1;
  return alongX
    ? { t: 'bridge', axis: 0, x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: z0 - 2, z1: z0 + 2, c: z0, y }
    : { t: 'bridge', axis: 2, x0: x0 - 2, x1: x0 + 2, z0: Math.min(z0, z1), z1: Math.max(z0, z1), c: x0, y };
}

function fortresses(vox, ox, oz, seed) {
  const rx0 = Math.floor((ox - 140) / REGION), rx1 = Math.floor((ox + CS + 140) / REGION);
  const rz0 = Math.floor((oz - 140) / REGION), rz1 = Math.floor((oz + CS + 140) / REGION);
  const get = (x, y, z) => vox[colIdx(x - ox, y, z - oz)];
  const set = (x, y, z, b) => { if (x >= ox && z >= oz && x < ox + CS && z < oz + CS && y > 0 && y < 127) vox[colIdx(x - ox, y, z - oz)] = b; };
  const open = (b) => b === B.Air || b === B.Lava || b === B.Glowstone || b === B.WeepingVines || b === B.TwistingVines;
  for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
    const plan = fortressIn(rx, rz, seed);
    if (!plan) continue;
    for (const p of plan) {
      const x0 = Math.max(p.x0, ox), x1 = Math.min(p.x1, ox + CS - 1), z0 = Math.max(p.z0, oz), z1 = Math.min(p.z1, oz + CS - 1);
      if (x0 > x1 || z0 > z1) continue;
      const y = p.y;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        if (p.t === 'bridge') {
          const across = p.axis === 0 ? z - p.c : x - p.c, along = p.axis === 0 ? x : z;
          const edge = Math.abs(across) === 2;
          set(x, y, z, B.NetherBricks);
          for (let k = 1; k <= 4; k++) set(x, y + k, z, B.Air);
          if (edge) set(x, y + 1, z, (along & 1) === 0 ? B.NetherBricks : B.Air);   // railing with gaps
          // arches and pillars every 8 blocks
          const m = ((along % 8) + 8) % 8;
          set(x, y - 1, z, B.NetherBricks);
          if (m <= 1 || m === 7) set(x, y - 2, z, B.NetherBricks);
          if (m === 0) for (let k = y - 3; k > 1 && open(get(x, k, z)); k--) set(x, k, z, B.NetherBricks);
        } else {
          const h = p.t === 'keep' ? 8 : 6;
          const wall = x === p.x0 || x === p.x1 || z === p.z0 || z === p.z1;
          const cxm = (p.x0 + p.x1) >> 1, czm = (p.z0 + p.z1) >> 1;
          const door = (x === cxm || z === czm) && wall;
          for (let k = 0; k <= h; k++) {
            let b = B.Air;
            if (k === 0 || k === h) b = B.NetherBricks;
            else if (wall) b = door && k <= 3 ? B.Air : k === 3 && ((x + z) % 3 === 0) ? B.Air : B.NetherBricks;
            set(x, y + k, z, b);
          }
          set(x, y + h + 1, z, wall && ((x + z) & 1) === 0 ? B.NetherBricks : B.Air);
          // footings down to the ground or the lava sea
          if (wall || ((x - p.x0) % 3 === 0 && (z - p.z0) % 3 === 0)) for (let k = y - 1; k > 1 && open(get(x, k, z)); k--) set(x, k, z, B.NetherBricks);
        }
      }
    }
  }
}

/** Nearest fortress keep centre to a point (for tests / debugging), or null. */
export function nearestFortress(x, z, seed) {
  let best = null, bd = Infinity;
  const rx = Math.floor(x / REGION), rz = Math.floor(z / REGION);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const plan = fortressIn(rx + dx, rz + dz, seed);
    if (!plan) continue;
    const k = plan[0], px = (k.x0 + k.x1) / 2, pz = (k.z0 + k.z1) / 2, d = Math.hypot(px - x, pz - z);
    if (d < bd) { bd = d; best = [px, k.y + 1, pz]; }
  }
  return best;
}
