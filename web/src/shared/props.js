// Port of World.Props (PropRegistry rules) and DecorationJob.Props (placement). Props are the Blender-made
// meshes (rocks, boulders, cave formations, dead wood, plants) placed on top of the voxels. Placement uses only
// this column's voxels and writes only this column (boulder cores, barrier cells), so it is seamless and
// deterministic. Big spaced props are placed first and claim the cells around them.
import { CS, CS2, MIN_Y, MAX_Y, colIdx } from './const.js';
import { B, BLOCKS, F } from './blocks.js';
import { Biome } from './terrain.js';
import { hash4, Simplex } from './noise.js';

export const Placement = { Ground: 0, CaveFloor: 1, CaveCeiling: 2 };
export const PROP_BARRIER = 37;

const biomes = (...l) => l.reduce((m, b) => m | (1 << b), 0) >>> 0;
const blocks = (...l) => new Set(l);
const Soil = blocks(B.Grass, B.Dirt, B.SnowyGrass, B.Moss, B.Mud);
const Rocky = blocks(B.Grass, B.Dirt, B.SnowyGrass, B.Stone, B.Gravel, B.Sand, B.Snow, B.Sandstone, B.RedSandstone, B.Moss);
const CaveRock = blocks(B.Stone, B.CoalOre, B.IronOre, B.GoldOre, B.DiamondOre, B.Sandstone, B.RedSandstone, B.Moss);
const Open = biomes(Biome.Plains, Biome.Forest, Biome.DenseForest, Biome.Savanna, Biome.Taiga, Biome.SnowyTaiga, Biome.SnowyTundra,
  Biome.Mountains, Biome.SnowyPeaks, Biome.Desert, Biome.Badlands, Biome.Beach, Biome.SnowyBeach, Biome.River, Biome.Jungle, Biome.Swamp);
const Highland = biomes(Biome.Mountains, Biome.SnowyPeaks, Biome.Taiga, Biome.SnowyTaiga, Biome.SnowyTundra, Biome.Badlands);
const Woods = biomes(Biome.Forest, Biome.DenseForest, Biome.Taiga, Biome.SnowyTaiga, Biome.Jungle, Biome.Swamp);
const Meadow = biomes(Biome.Plains, Biome.Forest, Biome.Savanna, Biome.Jungle, Biome.Swamp, Biome.Taiga);

const R = (o) => ({ placement: Placement.Ground, variants: 1, grid: 1, chance: 0, rich: 1, cluster: 0, biomes: 0, richBiomes: 0, support: Rocky,
  scaleMin: 1, scaleMax: 1, clearance: 1, footprint: 0, cardinal: false, core: B.Air, barrier: 0, sink: 0, drawDistance: 64, shadows: false, ...o });

/** Rules by kind id (Unity PropRegistry order). */
export const PROP_RULES = [
  R({ name: 'Rock_Pebbles', variants: 4, chance: 0.012, rich: 2.5, cluster: 1 / 12, biomes: Open, richBiomes: Highland | biomes(Biome.Beach, Biome.River),
    scaleMin: 0.8, scaleMax: 1.35, sink: 0.02, drawDistance: 48 }),
  R({ name: 'Rock_Stone', variants: 4, chance: 0.005, rich: 3, cluster: 1 / 16, biomes: Open, richBiomes: Highland,
    scaleMin: 0.8, scaleMax: 1.4, sink: 0.04, drawDistance: 110, shadows: true }),
  R({ name: 'Rock_Boulder', variants: 4, grid: 8, chance: 0.1, rich: 3, biomes: (Open & ~biomes(Biome.Beach, Biome.SnowyBeach, Biome.River, Biome.Swamp)) >>> 0,
    richBiomes: Highland | biomes(Biome.Plains), scaleMin: 1, scaleMax: 1.3, clearance: 2, core: B.Stone, drawDistance: 260, shadows: true }),
  R({ name: 'Cave_Stalactite', placement: Placement.CaveCeiling, variants: 4, chance: 0.05, cluster: 1 / 10, support: CaveRock,
    scaleMin: 0.8, scaleMax: 1.2, clearance: 2, drawDistance: 72, shadows: true }),
  R({ name: 'Cave_Stalagmite', placement: Placement.CaveFloor, variants: 4, chance: 0.03, cluster: 1 / 10, support: CaveRock,
    scaleMin: 0.8, scaleMax: 1.2, clearance: 2, drawDistance: 72, shadows: true }),
  R({ name: 'Tree_Dead', variants: 3, grid: 9, chance: 0.08, rich: 4,
    biomes: biomes(Biome.Savanna, Biome.Desert, Biome.Badlands, Biome.SnowyTundra, Biome.Mountains, Biome.Plains), richBiomes: biomes(Biome.Savanna, Biome.Badlands),
    scaleMin: 0.85, scaleMax: 1.15, clearance: 6, barrier: 2, sink: 0.05, drawDistance: 260, shadows: true }),
  R({ name: 'Tree_Stump', variants: 2, grid: 6, chance: 0.08, rich: 2, biomes: (Woods | biomes(Biome.Plains)) >>> 0, richBiomes: biomes(Biome.Forest, Biome.Taiga),
    support: Soil, scaleMin: 0.9, scaleMax: 1.2, clearance: 2, barrier: 1, sink: 0.05, drawDistance: 110, shadows: true }),
  R({ name: 'Tree_FallenLog', variants: 2, grid: 11, chance: 0.2, rich: 1.5, biomes: Woods, richBiomes: biomes(Biome.Forest, Biome.DenseForest),
    support: Soil, scaleMin: 0.9, scaleMax: 1.1, clearance: 1, footprint: 2, cardinal: true, barrier: 1, sink: 0.06, drawDistance: 160, shadows: true }),
  R({ name: 'Plant_Mushrooms', variants: 3, chance: 0.004, rich: 3, cluster: 1 / 8, biomes: Woods, richBiomes: biomes(Biome.DenseForest, Biome.Swamp),
    support: Soil, scaleMin: 0.8, scaleMax: 1.4, drawDistance: 40 }),
  R({ name: 'Plant_GrassClump', variants: 2, chance: 0.03, rich: 2, cluster: 1 / 9, biomes: Meadow, richBiomes: biomes(Biome.Plains, Biome.Savanna),
    support: blocks(B.Grass), scaleMin: 0.8, scaleMax: 1.3, sink: 0.01, drawDistance: 56 }),
  R({ name: 'Plant_FlowerClump', variants: 2, chance: 0.008, rich: 2.5, cluster: 1 / 7, biomes: biomes(Biome.Plains, Biome.Forest), richBiomes: biomes(Biome.Plains),
    support: blocks(B.Grass), scaleMin: 0.9, scaleMax: 1.2, sink: 0.01, drawDistance: 48 }),
];
export const KIND_BY_NAME = Object.fromEntries(PROP_RULES.map((r, i) => [r.name, i]));

// A prop instance is 5 int32s: x, y, z (anchor cell), kind | variant << 8 | yaw << 16 | scale << 24, room
export const PROP_STRIDE = 5;
export const scaleOf = (rule, s) => rule.scaleMin + (rule.scaleMax - rule.scaleMin) * (s / 255);
export const yawOf = (yaw) => yaw * (Math.PI * 2 / 256);
export const footprintAxis = (yaw) => ((((yaw + 32) >> 6) & 1) === 0 ? [1, 0, 0] : [0, 0, 1]);

/** True when an edit at (x, y, z) must remove the prop (anchor, core, barrier, support, footprint). */
export function dependsOn(rule, px, py, pz, yaw, x, y, z) {
  const dx = x - px, dy = y - py, dz = z - pz;
  const axis = rule.footprint > 0 ? footprintAxis(yaw) : [0, 0, 0];
  const along = rule.footprint > 0 ? dx * axis[0] + dz * axis[2] : 0;
  if (Math.abs(along) > rule.footprint) return false;
  const perpX = dx - axis[0] * along, perpZ = dz - axis[2] * along;
  if (perpX !== 0 || perpZ !== 0) return false;
  if (rule.placement === Placement.CaveCeiling) return dy === 1 || dy === 0;
  const top = Math.max(1, rule.barrier) - 1;
  return dy >= -1 && dy <= top;
}

/** Cells a prop wrote into the terrain (its core and barriers) with the block written. */
export function ownedCells(rule, px, py, pz, yaw) {
  const out = [];
  if (rule.core !== B.Air) out.push([px, py, pz, rule.core]);
  if (!rule.barrier) return out;
  const axis = rule.footprint > 0 ? footprintAxis(yaw) : [0, 0, 0];
  for (let t = -rule.footprint; t <= rule.footprint; t++) for (let y = 0; y < rule.barrier; y++)
    out.push([px + axis[0] * t, py + y, pz + axis[2] * t, PROP_BARRIER]);
  return out;
}

const CAVE_DEPTH = 6, MAX_ROOM = 16;
const noiseCache = new Map();
const u = (h) => (h & 0xFFFFFF) / 16777216;

/**
 * Places this column's props (after trees, before the light heightmap). height/biome: this column's surface
 * (Int32Array / Uint8Array, x + z * 32). Returns an Int32Array of instances.
 */
export function placeProps(vox, cx, cz, seed, height, biome) {
  let noise = noiseCache.get(seed);
  if (!noise) { noise = new Simplex((seed ^ 0x9A0B) >>> 0); noiseCache.set(seed, noise); }
  const out = [];
  const taken = new Uint8Array(CS2);
  const ox = cx * CS, oz = cz * CS;
  const at = (x, y, z) => vox[colIdx(x, y, z)];
  const cluster = (rule, x, y, z, kind) => {
    if (rule.cluster <= 0) return 1;
    const n = noise.noise3(x * rule.cluster + kind * 37.1, y * rule.cluster + (seed & 1023) * 0.61, z * rule.cluster - kind * 11.7);
    const t = Math.min(1, Math.max(0, (n + 0.2) / 0.9));
    return t * t * (3 - 2 * t) * 3;
  };
  const inBiome = (rule, b) => rule.biomes === 0 || (rule.biomes & (1 << b)) !== 0;

  const tryGround = (kind, rule, lx, lz) => {
    if (taken[lx + lz * CS]) return;
    const b = biome[lx + lz * CS];
    if (!inBiome(rule, b)) return;
    const wx = ox + lx, wz = oz + lz;
    const h = hash4(wx, wz, kind, seed);
    const chance = rule.chance * ((rule.richBiomes & (1 << b)) ? rule.rich : 1) * cluster(rule, wx, 0, wz, kind);
    if (u(h) >= chance) return;
    const ground = height[lx + lz * CS], anchor = ground + 1;
    if (ground <= MIN_Y || anchor + rule.clearance >= MAX_Y) return;
    if (!rule.support.has(at(lx, ground, lz))) return;
    const h2 = hash4(wx, wz, kind, (Math.imul(seed, 747796405) + 1) >>> 0);
    const yaw = rule.cardinal ? (h2 & 3) * 64 : h2 & 255;
    const axis = rule.footprint > 0 ? footprintAxis(yaw) : [0, 0, 0];
    for (let t = -rule.footprint; t <= rule.footprint; t++) {
      const x = lx + axis[0] * t, z = lz + axis[2] * t;
      if (x < 0 || z < 0 || x >= CS || z >= CS) return;
      if (taken[x + z * CS]) return;
      if (!rule.support.has(at(x, ground, z))) return;
      for (let c = 0; c < rule.clearance; c++) if (at(x, anchor + c, z) !== B.Air) return;
    }
    let room = 0;
    while (room < MAX_ROOM && anchor + room < MAX_Y && at(lx, anchor + room, lz) === B.Air) room++;
    const ring = rule.grid > 1 ? 1 : 0;
    for (let t = -rule.footprint; t <= rule.footprint; t++) for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) {
      const x = lx + axis[0] * t + dx, z = lz + axis[2] * t + dz;
      if (x >= 0 && z >= 0 && x < CS && z < CS) taken[x + z * CS] = 1;
    }
    if (rule.core !== B.Air) vox[colIdx(lx, anchor, lz)] = rule.core;
    for (let t = -rule.footprint; t <= rule.footprint; t++) for (let y = 0; y < rule.barrier; y++) {
      const i = colIdx(lx + axis[0] * t, anchor + y, lz + axis[2] * t);
      if (vox[i] === B.Air) vox[i] = PROP_BARRIER;
    }
    out.push(wx, anchor, wz, kind | (((h2 >>> 8) % Math.max(1, rule.variants)) << 8) | (yaw << 16) | (((h2 >>> 16) & 255) << 24), room);
  };

  for (let pass = 0; pass < 2; pass++) for (let k = 0; k < PROP_RULES.length; k++) {
    const rule = PROP_RULES[k];
    if (rule.placement !== Placement.Ground || (rule.grid > 1) !== (pass === 0)) continue;
    if (rule.grid > 1) {
      const g = rule.grid;
      for (let gz = Math.floor(oz / g); gz <= Math.floor((oz + CS - 1) / g); gz++) for (let gx = Math.floor(ox / g); gx <= Math.floor((ox + CS - 1) / g); gx++) {
        const h = hash4(gx, gz, k, (seed ^ 0x9E37) >>> 0);
        const px = gx * g + (h % g), pz = gz * g + ((h >>> 8) % g);
        const lx = px - ox, lz = pz - oz;
        if (lx < 0 || lz < 0 || lx >= CS || lz >= CS) continue;   // each spot lies in exactly one column
        tryGround(k, rule, lx, lz);
      }
    } else for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) tryGround(k, rule, x, z);
  }

  // cave floors and ceilings, well below the surface
  const caveKinds = PROP_RULES.map((r, k) => [r, k]).filter(([r]) => r.placement !== Placement.Ground);
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const top = Math.min(height[x + z * CS] - CAVE_DEPTH, MAX_Y - 2);
    for (let y = MIN_Y + 1; y <= top; y++) {
      if (at(x, y, z) !== B.Air) continue;
      const below = at(x, y - 1, z), above = at(x, y + 1, z);
      for (const [rule, k] of caveKinds) {
        const floor = rule.placement === Placement.CaveFloor && rule.support.has(below);
        const ceiling = rule.placement === Placement.CaveCeiling && rule.support.has(above);
        if (!floor && !ceiling) continue;
        const wx = ox + x, wz = oz + z;
        const h = hash4(wx, y, wz, (k ^ Math.imul(seed, 2654435761)) >>> 0);
        if (u(h) >= rule.chance * cluster(rule, wx, y, wz, k)) continue;
        const dir = floor ? 1 : -1;
        let room = 0;
        while (room < MAX_ROOM) {
          const yy = y + dir * room;
          if (yy <= MIN_Y || yy >= MAX_Y || at(x, yy, z) !== B.Air) break;
          room++;
        }
        if (room < rule.clearance) continue;
        const h2 = hash4(wx, y, wz, k + 101);
        out.push(wx, y, wz, k | (((h2 >>> 8) % Math.max(1, rule.variants)) << 8) | ((h2 & 255) << 16) | (((h2 >>> 16) & 255) << 24), room);
        break;   // one cave prop per cell
      }
    }
  }
  return new Int32Array(out);
}

export const isBarrier = (b) => b === PROP_BARRIER;
export const barrierFlags = F.Solid | F.Breakable;
export { BLOCKS };
