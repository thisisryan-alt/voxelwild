// Port of ColumnGenerationJob: 3D density terrain (height + overhang noise on a 4-block lattice), per-biome surface
// strata, water/ice, caves (spaghetti tunnels, cheese caverns, flooded aquifers), ores, cave floors, plants, springs.
import { CS, CS2, CS3, MIN_Y, MAX_Y, HEIGHT, SEA, colIdx } from './const.js';
import { B, C } from './blocks.js';
import { Terrain, Biome, seedOffset } from './terrain.js';
import { hash4, mulberry32, smoothstep } from './noise.js';
import { generateNether } from './nether.js';
import { generateEnd } from './end.js';
import { applyStrongholds } from './stronghold.js';

export const LAVA_LEVEL = -54;   // caves below this fill with lava (Minecraft's deep lava lakes)

const STEP = 4, LX = CS / STEP + 1, LY = HEIGHT / STEP + 1;
const terrainCache = new Map();
export function terrainFor(seed) {
  let t = terrainCache.get(seed);
  if (!t) { t = new Terrain(seed); terrainCache.set(seed, t); }
  return t;
}

/** Generates column (cx, cz). Returns { voxels: Uint16Array(HEIGHT*CS2) in colIdx order, surface: {...} }. */
export function generateColumn(cx, cz, seed, dim = 0) {
  if (dim === 1) return generateNether(cx, cz, seed);
  if (dim === 2) return generateEnd(cx, cz, seed);
  const T = terrainFor(seed), n = T.n;
  const ox = cx * CS, oz = cz * CS;
  const P = CS + 2;
  const heights = new Float32Array(P * P);
  const samples = new Array(CS2);
  const tmp = {};
  for (let z = -1; z <= CS; z++) for (let x = -1; x <= CS; x++) {
    const s = T.sample(ox + x, oz + z, tmp);
    heights[(x + 1) + (z + 1) * P] = s.height;
    if (x >= 0 && z >= 0 && x < CS && z < CS) samples[x + z * CS] = { ...s };
  }

  // coarse 3D lattice: overhang, cheese, spaghetti A, spaghetti B
  const lat = new Float32Array(LX * LX * LY * 4);
  const o30 = seedOffset(seed, 30), o31 = seedOffset(seed, 31), o32 = seedOffset(seed, 32), o33 = seedOffset(seed, 33);
  for (let ly = 0; ly < LY; ly++) for (let lz = 0; lz < LX; lz++) for (let lx = 0; lx < LX; lx++) {
    const px = ox + lx * STEP, py = MIN_Y + ly * STEP, pz = oz + lz * STEP;
    const i = (lx + lz * LX + ly * LX * LX) * 4;
    lat[i] = n.fbm3(px / 38 + o30[0] * 0.25, py / 26, pz / 38 + o30[1] * 0.25, 2);
    lat[i + 1] = n.noise3(px / 72 + o31[0] * 0.25, py / 40, pz / 72 + o31[1] * 0.25);
    lat[i + 2] = n.noise3(px / 52 + o32[0] * 0.25, py / 30, pz / 52 + o32[1] * 0.25);
    lat[i + 3] = n.noise3(px / 52 + o33[0] * 0.25, py / 30 + 91.7, pz / 52 + o33[1] * 0.25);
  }
  const L = new Float32Array(4);
  function sampleLat(x, wy, z) {
    const yy = wy - MIN_Y;
    const x0 = (x / STEP) | 0, z0 = (z / STEP) | 0, y0 = Math.min((yy / STEP) | 0, LY - 2);
    const fx = (x - x0 * STEP) / STEP, fz = (z - z0 * STEP) / STEP, fy = (yy - y0 * STEP) / STEP;
    const b = (x0 + z0 * LX + y0 * LX * LX) * 4, dX = 4, dZ = LX * 4, dY = LX * LX * 4;
    for (let c = 0; c < 4; c++) {
      const c00 = lat[b + c] + (lat[b + dX + c] - lat[b + c]) * fx;
      const c10 = lat[b + dZ + c] + (lat[b + dZ + dX + c] - lat[b + dZ + c]) * fx;
      const c01 = lat[b + dY + c] + (lat[b + dY + dX + c] - lat[b + dY + c]) * fx;
      const c11 = lat[b + dY + dZ + c] + (lat[b + dY + dZ + dX + c] - lat[b + dY + dZ + c]) * fx;
      const a = c00 + (c10 - c00) * fz, d = c01 + (c11 - c01) * fz;
      L[c] = a + (d - a) * fy;
    }
    return L;
  }

  const vox = new Uint16Array(HEIGHT * CS2);
  const sHeight = new Int32Array(CS2), sTop = new Uint16Array(CS2), sBiome = new Uint8Array(CS2), sTemp = new Uint8Array(CS2), sHumid = new Uint8Array(CS2);
  const oEnt = seedOffset(seed, 41), oAq = seedOffset(seed, 42), oStripe = seedOffset(seed, 43);

  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const s = samples[x + z * CS];
    const hi = (x + 1) + (z + 1) * P, hf = heights[hi];
    const slope = Math.max(Math.abs(heights[hi + 1] - hf), Math.abs(heights[hi - 1] - hf), Math.abs(heights[hi + P] - hf), Math.abs(heights[hi - P] - hf));
    const wx = ox + x, wz = oz + z;
    const nn = n.noise2(wx * 0.07 + oEnt[0], wz * 0.07 + oEnt[1]);
    const rules = surfaceRules(s, slope, nn, wx, wz, n);
    const entrance = n.noise2(wx * 0.011 + oEnt[0] * 0.5, wz * 0.011 + oEnt[1] * 0.5) > 0.55;
    const lakeLevel = -40 + n.fbm2(wx * 0.004 + oAq[0], wz * 0.004 + oAq[1], 2) * 16;
    const frozen = s.biome === Biome.FrozenOcean || s.biome === Biome.FrozenRiver || s.biome === Biome.SnowyBeach || s.temp < 0.16;
    const amp = s.overhang;
    const solidTop = Math.ceil(hf + amp) + 1, solidBottom = Math.floor(hf - amp) - 1;
    let groundTop = -999999, groundBlock = B.Air, depth = -1;
    const wobble = n.noise2(wx * 0.02 + oStripe[0], wz * 0.02 + oStripe[1]) * 1.5;

    for (let y = MAX_Y - 1; y >= MIN_Y; y--) {
      let solid;
      if (y > solidTop) solid = false;
      else if (y < solidBottom) solid = true;
      else { let d = hf - y; if (amp > 0) d += sampleLat(x, y, z)[0] * amp; solid = d > 0; }
      let b;
      if (!solid) {
        depth = -1;
        b = groundTop === -999999 && y <= SEA ? (frozen && y === SEA ? B.Ice : B.Water) : B.Air;
      } else {
        depth++;
        if (groundTop === -999999) groundTop = y;
        b = pickSolid(rules, y, depth, wobble);
        if (depth === 0 && groundTop === y) groundBlock = b;
        if (y <= MIN_Y + 3) {
          const h = hash4(wx, y, wz, seed);
          if (y === MIN_Y || (h & 3) < MIN_Y + 4 - y) b = B.Bedrock;
        } else if (y > MIN_Y + 5) {
          const below = groundTop - y;
          const underWater = groundTop < SEA + 1;
          const allowed = (below >= 6 || entrance) && !(underWater && below < 12) && s.river < 0.2;
          if (allowed && isCave(sampleLat(x, y, z), y, below)) b = y <= LAVA_LEVEL ? B.Lava : y <= lakeLevel ? B.Water : B.Air;
        }
      }
      vox[colIdx(x, y, z)] = b;
    }
    if (groundTop !== -999999 && vox[colIdx(x, groundTop, z)] !== groundBlock) groundBlock = B.Air;
    const k = x + z * CS;
    sHeight[k] = groundTop; sTop[k] = groundBlock; sBiome[k] = s.biome;
    sTemp[k] = Math.round(Math.min(1, Math.max(0, s.temp)) * 255); sHumid[k] = Math.round(Math.min(1, Math.max(0, s.humid)) * 255);
  }

  // where an aquifer rests on a lava lake the lava has already set to obsidian
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const i = colIdx(x, LAVA_LEVEL, z);
    if (vox[i] === B.Lava && vox[colIdx(x, LAVA_LEVEL + 1, z)] === B.Water) vox[i] = B.Obsidian;
  }
  placeOres(vox, cx, cz, seed);
  stoneVariety(vox, ox, oz, seed);
  applyStrongholds(vox, ox, oz, seed);
  decorateCaveFloors(vox, sHeight, ox, oz, seed, n);
  placeSurfacePlants(vox, sHeight, sTop, sBiome, ox, oz, seed, n);
  placeSpring(vox, heights, P, sHeight, sBiome, cx, cz, seed);
  return { voxels: vox, surface: { height: sHeight, top: sTop, biome: sBiome, temp: sTemp, humid: sHumid } };
}

function surfaceRules(s, slope, n, wx, wz, noise) {
  const r = { top: B.Grass, filler: B.Dirt, deep: B.Stone, under: B.Sand, fillerDepth: 3 + (n > 0.2 ? 1 : 0), kind: 0 };
  r.under = s.height < SEA - 7 + Math.trunc(n * 3) ? B.Gravel : B.Sand;
  const cliff = slope > 2.3 + n * 0.5;
  switch (s.biome) {
    case Biome.Ocean: case Biome.FrozenOcean: r.top = r.filler = r.under; break;
    case Biome.Beach: case Biome.SnowyBeach: r.top = r.filler = B.Sand; r.fillerDepth = 4; break;
    case Biome.River: case Biome.FrozenRiver: r.top = r.filler = r.under = n > 0.1 ? B.Sand : B.Gravel; r.fillerDepth = 2; break;
    case Biome.Desert: r.top = r.filler = B.Sand; r.fillerDepth = 3; r.kind = 1; if (cliff) r.top = r.filler = B.Sandstone; break;
    case Biome.Badlands: r.top = r.filler = r.deep = B.RedSandstone; r.fillerDepth = 0; r.kind = 2; break;
    case Biome.Swamp: if (n > 0.3) r.top = B.Mud; r.under = B.Mud; break;
    case Biome.SnowyTundra: case Biome.SnowyTaiga: r.top = B.SnowyGrass; break;
    case Biome.Mountains: case Biome.SnowyPeaks: {
      const snowLine = 138 + noise.noise2(wx * 0.011, wz * 0.011) * 10;
      if (s.height > snowLine || s.biome === Biome.SnowyPeaks) { r.top = slope > 2.6 ? B.Stone : B.Snow; r.filler = B.Stone; r.fillerDepth = 0; }
      else if (s.height > snowLine - 22 && slope > 1.4) { r.top = n > 0 ? B.Gravel : B.Stone; r.filler = B.Stone; r.fillerDepth = 1; }
      break;
    }
  }
  if (cliff && r.kind === 0 && r.top !== B.Sand && r.top !== B.Gravel) { r.top = B.Stone; r.filler = B.Stone; r.fillerDepth = 0; }
  return r;
}

function pickSolid(r, y, depth, wobble) {
  if (y < SEA && depth <= r.fillerDepth && r.kind === 0) return depth === 0 && r.top !== B.Stone ? r.under : depth === 0 ? r.top : r.filler;
  if (depth === 0) return r.top === B.Grass && y < SEA ? B.Dirt : r.top;
  if (depth <= r.fillerDepth) return r.filler;
  if (r.kind === 1 && depth <= r.fillerDepth + 7) return B.Sandstone;
  if (r.kind === 2 && depth <= 48) return (Math.floor((y + wobble) / 3) % 4 === 0) ? B.Sandstone : B.RedSandstone;
  return r.deep;
}

function isCave(v, y, below) {
  const cheeseThreshold = 0.58 + 0.16 * smoothstep(-30, 70, y);
  if (v[1] > cheeseThreshold) return true;
  let width = 0.055 + 0.02 * Math.max(0, Math.min(1, v[0]));
  if (below < 6) width *= 0.8;
  return v[2] * v[2] + v[3] * v[3] < width * width;
}

function placeOres(vox, cx, cz, seed) {
  const rng = mulberry32(hash4(cx, cz, seed, 0x0DE5) | 1);
  const ri = (a, b) => a + Math.floor(rng() * (b - a));
  const cluster = (ore, attempts, minY, maxY, minS, maxS) => {
    for (let a = 0; a < attempts; a++) {
      const p = [ri(0, CS), ri(minY, maxY), ri(0, CS)];
      const size = ri(minS, maxS + 1);
      for (let k = 0; k < size; k++) {
        if (p[0] >= 0 && p[0] < CS && p[2] >= 0 && p[2] < CS && p[1] > MIN_Y + 4 && p[1] < MAX_Y) {
          const i = colIdx(p[0], p[1], p[2]);
          if (vox[i] === B.Stone) vox[i] = ore;
        }
        p[ri(0, 3)] += rng() < 0.5 ? 1 : -1;
      }
    }
  };
  cluster(B.CoalOre, 18, 0, 128, 6, 14);
  cluster(B.IronOre, 12, -60, 64, 4, 9);
  cluster(B.GoldOre, 4, -64, 8, 3, 7);
  cluster(B.DiamondOre, 2, -64, -36, 2, 5);
  if (C.copper_ore) cluster(C.copper_ore, 10, -16, 96, 5, 10);
  if (C.lapis_ore) cluster(C.lapis_ore, 3, -60, 32, 3, 7);
  if (C.redstone_ore) cluster(C.redstone_ore, 5, -64, -16, 4, 8);
  if (C.emerald_ore) cluster(C.emerald_ore, 3, 60, 180, 1, 2);
}

/**
 * Minecraft 1.18-style underground: deepslate below y 0 (a ragged boundary), pockets of granite, diorite and andesite
 * (tuff down deep) placed on a 3D grid so they cross columns seamlessly, and the ores in deepslate turned to their
 * deepslate forms.
 */
const DEEP_ORE = () => ({ [B.CoalOre]: C.deepslate_coal_ore, [B.IronOre]: C.deepslate_iron_ore, [B.GoldOre]: C.deepslate_gold_ore,
  [B.DiamondOre]: C.deepslate_diamond_ore, [C.copper_ore]: C.deepslate_copper_ore, [C.lapis_ore]: C.deepslate_lapis_ore,
  [C.redstone_ore]: C.deepslate_redstone_ore, [C.emerald_ore]: C.deepslate_emerald_ore });
function stoneVariety(vox, ox, oz, seed) {
  if (!C.deepslate) return;
  const deepOre = DEEP_ORE();
  // pockets: one candidate per 16^3 cell
  const G = 16;
  for (let gy = Math.floor(MIN_Y / G); gy <= Math.floor(130 / G); gy++) for (let gz = Math.floor((oz - 8) / G); gz <= Math.floor((oz + CS + 8) / G); gz++)
    for (let gx = Math.floor((ox - 8) / G); gx <= Math.floor((ox + CS + 8) / G); gx++) {
      const h = hash4(gx, gy, gz, seed ^ 0x570E);
      if ((h & 255) > 95) continue;
      const cx0 = gx * G + ((h >>> 8) & 15), cy0 = gy * G + ((h >>> 12) & 15), cz0 = gz * G + ((h >>> 16) & 15);
      const rad = 3 + ((h >>> 20) & 3) * 1.1;
      const kind = cy0 < -8 ? (((h >>> 24) & 3) === 0 ? C.tuff : C.andesite) : [C.granite, C.diorite, C.andesite, C.granite][(h >>> 24) & 3];
      if (!kind) continue;
      const R = Math.ceil(rad);
      for (let y = cy0 - R; y <= cy0 + R; y++) for (let z = cz0 - R; z <= cz0 + R; z++) for (let x = cx0 - R; x <= cx0 + R; x++) {
        if (x < ox || z < oz || x >= ox + CS || z >= oz + CS || y <= MIN_Y + 4 || y >= MAX_Y) continue;
        const d = ((x - cx0) ** 2 + ((y - cy0) * 1.3) ** 2 + (z - cz0) ** 2) / (rad * rad);
        if (d > 1 - ((hash4(x, y, z, h) & 255) / 255) * 0.3) continue;
        const i = colIdx(x - ox, y, z - oz);
        if (vox[i] === B.Stone) vox[i] = kind;
      }
    }
  // deepslate below 0
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const top = 2 + (hash4(ox + x, 0, oz + z, seed ^ 0xDEE9) & 7) - 4;
    for (let y = MIN_Y + 1; y <= top; y++) {
      const i = colIdx(x, y, z), b = vox[i];
      if (b === B.Stone || b === C.andesite || b === C.granite || b === C.diorite) vox[i] = y > top - 2 && (hash4(ox + x, y, oz + z, seed) & 1) ? b : C.deepslate;
      else if (deepOre[b]) vox[i] = deepOre[b];
    }
  }
}

function decorateCaveFloors(vox, sHeight, ox, oz, seed, n) {
  const off = seedOffset(seed, 40);
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const ground = sHeight[x + z * CS];
    for (let y = MIN_Y + 6; y < ground - 6; y++) {
      const i = colIdx(x, y, z);
      if (vox[i] !== B.Air) continue;
      const bi = colIdx(x, y - 1, z);
      const floor = vox[bi];
      if (floor !== B.Stone && floor !== B.Gravel) continue;
      const damp = n.noise3((ox + x) * 0.035 + off[0] * 0.25, y * 0.035, (oz + z) * 0.035 + off[1] * 0.25);
      const r = (hash4(ox + x, y, oz + z, seed * 7919) & 0xFFFF) / 65536;
      if (damp > 0.25) vox[bi] = B.Moss;
      if (r < (damp > 0.25 ? 0.06 : 0.006)) vox[i] = B.Glowcap;
    }
  }
}

function placeSurfacePlants(vox, sHeight, sTop, sBiome, ox, oz, seed, n) {
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const k = x + z * CS, h = sHeight[k], y = h + 1;
    if (h < SEA || y >= MAX_Y - 3) continue;
    if (vox[colIdx(x, y, z)] !== B.Air) continue;
    const wx = ox + x, wz = oz + z;
    const hsh = hash4(wx, wz, seed * 104729, 3);
    const r = (hsh & 0xFFFF) / 65536;
    const clump = Math.max(0, Math.min(1, n.noise2(wx * 0.08, wz * 0.08) * 0.6 + 0.6));
    let plant = B.Air;
    const top = sTop[k], biome = sBiome[k];
    if (top === B.Grass) {
      let grass = 0.08, flowers = 0;
      switch (biome) {
        case Biome.Plains: grass = 0.3; flowers = 0.035; break;
        case Biome.Forest: grass = 0.18; flowers = 0.012; break;
        case Biome.DenseForest: grass = 0.12; break;
        case Biome.Jungle: grass = 0.38; break;
        case Biome.Savanna: grass = 0.32; break;
        case Biome.Taiga: grass = 0.1; break;
        case Biome.Swamp: grass = 0.2; break;
      }
      const patch = Math.max(0, Math.min(1, n.noise2(wx * 0.03 + 300, wz * 0.03 + 300) * 2));
      if (r < flowers * patch * 3) {
        // flower fields: one or two kinds per patch
        const kinds = [B.FlowerRed, B.FlowerYellow, C.azure_bluet, C.cornflower, C.allium, C.red_tulip, C.orange_tulip, C.white_tulip, C.pink_tulip, C.blue_orchid];
        const pick = Math.floor((n.noise2(wx * 0.02 + 77, wz * 0.02 + 77) * 0.5 + 0.5) * kinds.length * 0.999);
        plant = kinds[Math.max(0, Math.min(kinds.length - 1, pick + ((hsh >>> 24) & 1)))] || B.FlowerRed;
        if (biome === Biome.Swamp && C.blue_orchid) plant = C.blue_orchid;
      }
      else if (r < grass * clump + flowers * patch * 3) plant = (biome === Biome.Taiga || biome === Biome.Jungle) && ((hsh >>> 20) & 3) === 0 && C.fern ? C.fern : B.TallGrass;
      else if ((biome === Biome.Taiga || biome === Biome.SnowyTaiga) && r < grass * clump + 0.012 && C.sweet_berry_bush_stage3) plant = C.sweet_berry_bush_stage3;
      else if ((biome === Biome.DenseForest || biome === Biome.Swamp) && r > 0.994 && C.brown_mushroom) plant = (hsh >>> 16) & 1 ? C.brown_mushroom : C.red_mushroom;
      else if (r > 0.9993 && C.pumpkin && (biome === Biome.Plains || biome === Biome.Forest)) plant = C.pumpkin;
      // sugar cane on the shore
      if (plant === B.Air && C.sugar_cane && r < 0.25 && h === SEA && (vox[colIdx(Math.min(CS - 1, x + 1), SEA, z)] === B.Water || vox[colIdx(Math.max(0, x - 1), SEA, z)] === B.Water
        || vox[colIdx(x, SEA, Math.min(CS - 1, z + 1))] === B.Water || vox[colIdx(x, SEA, Math.max(0, z - 1))] === B.Water)) {
        const tall = 1 + ((hsh >>> 18) % 3);
        for (let q = 0; q < tall; q++) vox[colIdx(x, y + q, z)] = C.sugar_cane;
        continue;
      }
      // taiga floors
      if ((biome === Biome.Taiga) && C.podzol && n.noise2(wx * 0.05 + 11, wz * 0.05) > 0.35) vox[colIdx(x, h, z)] = C.podzol;
      else if ((biome === Biome.Taiga || biome === Biome.Savanna) && C.coarse_dirt && n.noise2(wx * 0.07 - 31, wz * 0.07) > 0.55) vox[colIdx(x, h, z)] = C.coarse_dirt;
    } else if (top === B.Sand && biome === Biome.Desert) {
      if (r < 0.004) {
        const height = 1 + ((hsh >>> 20) % 3);
        for (let q = 0; q < height && y + q < MAX_Y; q++) vox[colIdx(x, y + q, z)] = B.Cactus;
        continue;
      }
      if (r < 0.011) plant = B.DeadBush;
    } else if (top === B.RedSandstone && r < 0.012) plant = B.DeadBush;
    if (plant !== B.Air) vox[colIdx(x, y, z)] = plant;
  }
}

/** At most one spring per hilly column: a water source set into a cliff face; the water simulation makes the fall. */
function placeSpring(vox, heights, P, sHeight, sBiome, cx, cz, seed) {
  const h = hash4(cx, cz, seed, 0x5E17);
  if ((h & 0xFF) > 70) return;
  for (let k = 0; k < 24; k++) {
    const x = 1 + ((h >>> (k % 24)) + k * 7) % (CS - 2), z = 1 + ((h >>> ((k + 5) % 24)) + k * 13) % (CS - 2);
    const top = sHeight[x + z * CS];
    if (top < SEA + 10 || top > 150) continue;
    const bio = sBiome[x + z * CS];
    if (bio === Biome.Desert || bio === Biome.Badlands) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nt = sHeight[(x + dx) + (z + dz) * CS];
      const y = top - 2;
      if (nt < y - 2 && vox[colIdx(x + dx, y, z + dz)] === B.Air && vox[colIdx(x, y, z)] !== B.Air) {
        vox[colIdx(x, y, z)] = B.Water;
        return;
      }
    }
  }
}
