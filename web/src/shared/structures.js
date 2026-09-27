// Overworld and Nether structures: villages (houses, farms, a well, lamps, dirt roads), pillager outposts, desert
// pyramids and wells, igloos, ruined portals, swamp huts, underground dungeons with spawners, and Nether bastions.
//
// Each kind has a region grid; a region holds at most one, at a spot and with a layout that depend only on the seed,
// so every column builds its own share of the structures reaching into it (like strongholds). The game uses the same
// plans to populate them (villagers, pillagers, brutes, spawners) and to fill their chests.
import { CS, SEA, colIdx } from './const.js';
import { B, C, FAM } from './blocks.js';
import { Biome } from './terrain.js';
import { hash4, mulberry32 } from './noise.js';

const KINDS = {
  village: { size: 256, chance: 0.85, reach: 48, salt: 0x51A6, tries: 4 },
  outpost: { size: 384, chance: 0.5, reach: 12, salt: 0x0B57, tries: 3 },
  pyramid: { size: 256, chance: 0.6, reach: 13, salt: 0x9A3D, tries: 3 },
  well: { size: 192, chance: 0.3, reach: 4, salt: 0x3E11 },
  igloo: { size: 224, chance: 0.55, reach: 6, salt: 0x1611, tries: 3 },
  portal: { size: 320, chance: 0.35, reach: 7, salt: 0x9047 },
  hut: { size: 256, chance: 0.6, reach: 6, salt: 0x7A77, tries: 3 },
  dungeon: { size: 72, chance: 0.4, reach: 5, salt: 0xD06E },
};
const NETHER = { bastion: { size: 384, chance: 0.5, reach: 16, salt: 0xBA57 } };
const cache = new Map();

/** Plans of the structures (of dimension dim) whose area touches the rectangle [x0, x1] x [z0, z1]. */
export function structuresIn(seed, T, x0, z0, x1, z1, dim = 0) {
  const out = [];
  for (const [kind, k] of Object.entries(dim === 1 ? NETHER : dim === 0 ? KINDS : {})) {
    const rx0 = Math.floor((x0 - k.reach) / k.size), rx1 = Math.floor((x1 + k.reach) / k.size);
    const rz0 = Math.floor((z0 - k.reach) / k.size), rz1 = Math.floor((z1 + k.reach) / k.size);
    for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
      const key = `${seed}:${kind}:${rx}:${rz}`;
      let plan = cache.get(key);
      if (plan === undefined) { plan = planFor(kind, k, seed, T, rx, rz); cache.set(key, plan); if (cache.size > 4000) cache.delete(cache.keys().next().value); }
      if (plan && plan.x1 >= x0 && plan.x0 <= x1 && plan.z1 >= z0 && plan.z0 <= z1) out.push(plan);
    }
  }
  return out;
}

/** The kind of structure at a block (for chest loot), or null. */
export function structureAt(seed, T, x, y, z, dim = 0) {
  for (const p of structuresIn(seed, T, x, z, x, z, dim)) if (y >= p.y0 && y <= p.y1) return p.kind;
  return null;
}

// ---------------------------------------------------------------- plans

/** A region's structure: a few candidate spots are tried (the first may be in the sea or on a mountain). */
function planFor(kind, k, seed, T, rx, rz) {
  const h0 = hash4(rx, rz, seed ^ k.salt, 7);
  if ((h0 & 1023) / 1024 >= k.chance) return null;
  for (let t = 0; t < (k.tries || 1); t++) {
    const plan = planAt(kind, k, seed, T, rx, rz, t ? hash4(rx, rz, seed ^ k.salt, 7 + t) : h0);
    if (plan) return plan;
  }
  return null;
}
function planAt(kind, k, seed, T, rx, rz, h) {
  const r = mulberry32(h | 1), m = Math.floor(k.size * 0.2);
  const x = rx * k.size + m + Math.floor(r() * (k.size - 2 * m)), z = rz * k.size + m + Math.floor(r() * (k.size - 2 * m));
  const rot = Math.floor(r() * 4);
  if (kind === 'dungeon') {
    const y = -30 + Math.floor(r() * 60);
    if (T) { const g = Math.floor(T.sample(x, z).height); if (y + 6 > g - 4) return null; }
    const mob = ['husk', 'skeleton', 'spider', 'husk'][Math.floor(r() * 4)];
    return box(kind, x, y, z, 4, 0, 5, { mob, chests: 1 + Math.floor(r() * 2), seed: h });
  }
  if (kind === 'bastion') return box(kind, x, 20, z, 15, 30, 15, { rot, seed: h });
  if (!T) return null;
  const s = T.sample(x, z), g = Math.floor(s.height), b = s.biome;
  if (g <= SEA + 1 || s.river > 0.3) return null;
  const flat = (rad) => { let lo = g, hi = g; for (const [dx, dz] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad], [rad, rad], [-rad, -rad]]) { const v = Math.floor(T.sample(x + dx, z + dz).height); lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
  // small buildings stand on the highest ground round their middle (foundations fill in below)
  const high = (rad) => { let hi = g; for (const [dx, dz] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) hi = Math.max(hi, Math.floor(T.sample(x + dx, z + dz).height)); return hi; };
  const desert = b === Biome.Desert || b === Biome.Badlands, snowy = b === Biome.SnowyTundra || b === Biome.SnowyTaiga;
  switch (kind) {
    case 'village': {
      if (![Biome.Plains, Biome.Savanna, Biome.Desert, Biome.Taiga, Biome.SnowyTundra, Biome.SnowyTaiga, Biome.Forest, Biome.Jungle, Biome.Swamp, Biome.Badlands].includes(b) || flat(24) > 14) return null;
      const style = desert ? 'desert' : b === Biome.Savanna ? 'savanna' : b === Biome.Taiga ? 'taiga' : snowy ? 'snowy' : 'plains';
      const pieces = [{ kind: 'well', x, z, y: g, rot: 0 }];
      const roads = [];
      for (let d = 0; d < 4; d++) {
        const len = 18 + Math.floor(r() * 12), [ux, uz] = [[1, 0], [0, 1], [-1, 0], [0, -1]][d];
        roads.push({ ux, uz, len });
        for (let t = 8; t <= len; t += 9) for (const side of [-1, 1]) {
          if (r() < 0.2) continue;
          const pick = r(), type = pick < 0.42 ? 'house' : pick < 0.62 ? 'bighouse' : pick < 0.86 ? 'farm' : 'lamp';
          const off = type === 'lamp' ? 2 : type === 'bighouse' ? 7 : type === 'farm' ? 7 : 6;
          // side offset perpendicular to the road; the front faces the road
          const px = x + ux * t - uz * side * off, pz = z + uz * t + ux * side * off;
          // the front (local north) turns toward the road
          const fr = uz === 0 ? (ux * side > 0 ? 0 : 2) : (-uz * side > 0 ? 3 : 1);
          pieces.push({ kind: type, x: px, z: pz, y: Math.floor(T.sample(px, pz).height), rot: fr });
        }
      }
      return box(kind, x, g - 8, z, 46, g + 16 - (g - 8), 46, { style, pieces, roads, seed: h });
    }
    case 'outpost':
      if (![Biome.Plains, Biome.Savanna, Biome.Desert, Biome.Taiga, Biome.SnowyTundra, Biome.Forest].includes(b) || flat(6) > 8) return null;
      return box(kind, x, g - 4, z, 11, 30, 11, { rot, seed: h });
    case 'pyramid':
      if (b !== Biome.Desert || flat(10) > 8) return null;
      return box(kind, x, g - 14, z, 11, 30, 11, { seed: h });
    case 'well':
      if (b !== Biome.Desert) return null;
      return box(kind, x, high(2) - 3, z, 3, 8, 3, { seed: h, gy: high(2) });
    case 'igloo':
      if (!snowy || flat(4) > 5) return null;
      return box(kind, x, high(3) - 2, z, 5, 8, 5, { rot, seed: h, gy: high(3) });
    case 'portal':
      if (flat(4) > 4) return null;
      return box(kind, x, high(2) - 3, z, 6, 12, 6, { rot, seed: h, gy: high(2), mossy: b === Biome.Jungle || b === Biome.Swamp });
    case 'hut':
      if (b !== Biome.Swamp) return null;
      return box(kind, x, high(3) - 3, z, 5, 12, 5, { rot, seed: h, gy: high(3) });
  }
  return null;
}

function box(kind, x, y, z, rxz, height, rz2, extra) {
  const ry = height || rxz;
  return { kind, x, z, y, x0: x - rxz, x1: x + rxz, z0: z - rz2, z1: z + rz2, y0: y, y1: y + (height || 2 * rz2), ...extra, ry };
}

// ---------------------------------------------------------------- building

/** Builds the share of every structure reaching into column (ox, oz). sHeight: the column's surface heights (cells
 *  covered by a building are cleared of trees by marking them -9999). */
export function applyStructures(vox, ox, oz, seed, T, sHeight, dim = 0) {
  const plans = structuresIn(seed, T, ox, oz, ox + CS - 1, oz + CS - 1, dim);
  if (!plans.length) return;
  const inside = (x, z) => x >= ox && z >= oz && x < ox + CS && z < oz + CS;
  const W = {
    set(x, y, z, b) { if (inside(x, z) && y > -64 && y < 320) vox[colIdx(x - ox, y, z - oz)] = b; },
    get(x, y, z) { return inside(x, z) ? vox[colIdx(x - ox, y, z - oz)] : -1; },
    inside,
    /** Topmost solid ground of a column cell (within 12 of y). */
    top(x, z, y) {
      if (!inside(x, z)) return y;
      for (let k = y + 10; k > y - 14; k--) { const v = vox[colIdx(x - ox, k, z - oz)]; if (v !== B.Air && v !== B.Water && !isPlant(v)) return k; }
      return y;
    },
    noTrees(x, z) { if (inside(x, z) && sHeight) sHeight[(x - ox) + (z - oz) * CS] = -9999; },
  };
  for (const p of plans) BUILD[p.kind](W, p, mulberry32((p.seed ^ 0x2545F491) | 1));
}
const isPlant = (v) => v === B.TallGrass || v === B.FlowerRed || v === B.FlowerYellow || v === B.DeadBush || v === B.Snow && false;

/** A building frame: local (lx, ly, lz) around a centre, turned by rot (0: the front, local -z, faces north). */
function frame(W, cx, y, cz, rot) {
  const P = (lx, lz) => (rot === 0 ? [cx + lx, cz + lz] : rot === 1 ? [cx - lz, cz + lx] : rot === 2 ? [cx - lx, cz - lz] : [cx + lz, cz - lx]);
  const F = (f) => { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][f], [a, b] = P(d[0], d[1]), [o0, o1] = P(0, 0), v = [a - o0, b - o1]; return v[0] === 1 ? 0 : v[0] === -1 ? 1 : v[1] === 1 ? 2 : 3; };
  return {
    set(lx, ly, lz, b) { const [x, z] = P(lx, lz); W.set(x, y + ly, z, b); },
    face: F,
    at: P,
    /** Fill under the footprint down to the ground and clear the space above it. */
    ground(x0, x1, z0, z1, floor, above = 10, fill = B.Cobblestone) {
      for (let lz = z0; lz <= z1; lz++) for (let lx = x0; lx <= x1; lx++) {
        const [x, z] = P(lx, lz);
        if (!W.inside(x, z)) continue;
        W.noTrees(x, z);
        for (let k = 1; k <= above; k++) W.set(x, y + k, z, B.Air);
        W.set(x, y, z, floor);
        for (let k = 1; k < 12; k++) { const v = W.get(x, y - k, z); if (v !== B.Air && v !== B.Water && v !== B.Lava) break; W.set(x, y - k, z, fill); }
      }
    },
  };
}

const MATS = {
  plains: { planks: B.Planks, log: B.OakLog, wall: B.Planks, floor: B.Cobblestone, door: 'oak', stairs: 'oak_stairs', slab: 'oak_slab', fence: 'oak_fence' },
  taiga: { planks: 'spruce_planks', log: B.SpruceLog, wall: 'spruce_planks', floor: B.Cobblestone, door: 'spruce', stairs: 'spruce_stairs', slab: 'spruce_slab', fence: 'spruce_fence' },
  snowy: { planks: 'spruce_planks', log: B.SpruceLog, wall: B.Snow, floor: 'spruce_planks', door: 'spruce', stairs: 'spruce_stairs', slab: 'spruce_slab', fence: 'spruce_fence' },
  savanna: { planks: 'acacia_planks', log: 'acacia_log', wall: 'acacia_planks', floor: B.Cobblestone, door: 'acacia', stairs: 'acacia_stairs', slab: 'acacia_slab', fence: 'acacia_fence' },
  desert: { planks: 'smooth_sandstone', log: 'cut_sandstone', wall: B.Sandstone, floor: 'smooth_sandstone', door: 'jungle', stairs: 'sandstone_stairs', slab: 'sandstone_slab', fence: 'jungle_fence' },
};
const id = (v) => (typeof v === 'string' ? C[v] || (FAM[v] && FAM[v].first) || B.Planks : v);
const fam = (k) => FAM[k];

/** A hipped roof of stairs, from a w x d rectangle (local, centred) at height ly, rising inward. */
function roof(f, w, d, ly, stairs, slab, planks) {
  const st = fam(stairs), sl = fam(slab);
  let hw = Math.floor(w / 2), hd = Math.floor(d / 2), y = ly;
  while (hw >= 0 && hd >= 0) {
    for (let lz = -hd; lz <= hd; lz++) for (let lx = -hw; lx <= hw; lx++) {
      const edgeX = Math.abs(lx) === hw, edgeZ = Math.abs(lz) === hd;
      if (!edgeX && !edgeZ) continue;
      if (hw === 0 || hd === 0) { f.set(lx, y, lz, sl ? sl.first : planks); continue; }
      // the step rises toward the middle: facing inward
      const lf = edgeZ ? (lz < 0 ? 2 : 3) : (lx < 0 ? 0 : 1);
      f.set(lx, y, lz, st ? st.first + f.face(lf) * 2 : planks);
    }
    hw--; hd--; y++;
  }
}

function house(W, p, r, big) {
  const M = MATS[p.style] || MATS.plains, f = frame(W, p.x, p.y, p.z, p.rot);
  const h = big ? 3 : 2, planks = id(M.planks), wall = id(M.wall), log = id(M.log);
  f.ground(-h, h, -h, h, id(M.floor), 12);
  for (let ly = 1; ly <= 3; ly++) for (let lz = -h; lz <= h; lz++) for (let lx = -h; lx <= h; lx++) {
    const corner = Math.abs(lx) === h && Math.abs(lz) === h, edge = Math.abs(lx) === h || Math.abs(lz) === h;
    if (!edge) continue;
    let b = corner ? log : wall;
    if (ly === 2 && !corner && (lx === 0 || lz === 0) && !(lz === -h && lx === 0)) b = FAM.glass_pane.first;
    f.set(lx, ly, lz, b);
  }
  // door at the front (local -z)
  const door = fam(`${M.door}_door`), df = f.face(2);
  f.set(0, 1, -h, door ? door.first + df * 4 : B.Air); f.set(0, 2, -h, door ? door.first + df * 4 + 1 : B.Air);
  f.set(0, 0, -h - 1, FAM.dirt_path.first);
  for (let lz = -h; lz <= h; lz++) for (let lx = -h; lx <= h; lx++) f.set(lx, 4, lz, planks);
  roof(f, 2 * h + 3, 2 * h + 3, 4, M.stairs, M.slab, planks);
  // inside: a bed, a crafting table or furnace, a chest, a torch
  const bed = fam(['red_bed', 'white_bed', 'blue_bed', 'yellow_bed', 'green_bed'][Math.floor(r() * 5)]);
  const bf = f.face(2);                        // head toward the back wall
  f.set(-h + 1, 1, h - 2, bed.first + bf * 2); f.set(-h + 1, 1, h - 1, bed.first + bf * 2 + 1);
  f.set(h - 1, 1, h - 1, C.chest);
  f.set(h - 1, 1, 0, r() < 0.5 ? C.crafting_table : C.furnace);
  if (big) { f.set(h - 1, 1, h - 2, C.barrel || C.chest); f.set(-h + 1, 1, -h + 1, C.crafting_table); f.set(1 - h + 1, 1, h - 1, C.hay_block || planks); }
  f.set(0, 3, h - 1, FAM.wall_torch.first + f.face(2));
  f.set(1, 3, -h - 1, FAM.wall_torch.first + f.face(2));
}

const BUILD = {
  village(W, p, r) {
    const M = MATS[p.style] || MATS.plains;
    // roads: dirt paths on the ground (sand paths in the desert)
    const path = p.style === 'desert' ? id('smooth_sandstone') : FAM.dirt_path.first;
    // no trees in the village: round every building and along the roads
    for (const q of p.pieces) for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) W.noTrees(q.x + dx, q.z + dz);
    for (const rd of p.roads) for (let t = -4; t <= rd.len + 6; t++) for (let a = -5; a <= 5; a++) W.noTrees(p.x + rd.ux * t - rd.uz * a, p.z + rd.uz * t + rd.ux * a);
    for (const rd of p.roads) for (let t = 2; t <= rd.len + 3; t++) for (let a = -1; a <= 1; a++) {
      const x = p.x + rd.ux * t - rd.uz * a, z = p.z + rd.uz * t + rd.ux * a;
      if (!W.inside(x, z)) continue;
      const g = W.top(x, z, p.y);
      const v = W.get(x, g, z);
      if (v === B.Grass || v === B.Dirt || v === B.Sand || v === B.SnowyGrass || v === B.Gravel || v === B.Snow) { W.set(x, g, z, path); W.set(x, g + 1, z, B.Air); W.set(x, g + 2, z, B.Air); }
      W.noTrees(x, z);
    }
    for (const q of p.pieces) {
      const pr = mulberry32(hash4(q.x, q.z, p.seed, 3) | 1);
      const piece = { ...q, style: p.style };
      if (q.kind === 'house') house(W, piece, pr, false);
      else if (q.kind === 'bighouse') house(W, piece, pr, true);
      else if (q.kind === 'farm') farm(W, piece, pr, M);
      else if (q.kind === 'lamp') lamp(W, piece, M);
      else if (q.kind === 'well') {
        well(W, piece, p.style === 'desert' ? B.Sandstone : B.Cobblestone, M);
        // every village has a waystone by its well (fast travel: not in Minecraft)
        if (FAM.waystone) { W.set(q.x + 4, q.y + 1, q.z, FAM.waystone.first); W.set(q.x + 4, q.y + 2, q.z, FAM.waystone.first + 1); W.set(q.x + 4, q.y, q.z, B.StoneBricks); }
      }
    }
  },
  outpost(W, p, r) {
    const f = frame(W, p.x, p.y + 4, p.z, p.rot), dark = id('dark_oak_planks'), log = id('dark_oak_log');
    f.ground(-3, 3, -3, 3, B.Cobblestone, 26);
    for (let ly = 1; ly <= 18; ly++) for (let lz = -3; lz <= 3; lz++) for (let lx = -3; lx <= 3; lx++) {
      const corner = Math.abs(lx) === 3 && Math.abs(lz) === 3, edge = Math.abs(lx) === 3 || Math.abs(lz) === 3;
      if (!edge) { if (ly % 6 === 0) f.set(lx, ly, lz, dark); continue; }
      let b = corner ? log : ly <= 2 ? B.Cobblestone : dark;
      if (!corner && ly % 6 === 3 && (lx === 0 || lz === 0)) b = FAM.dark_oak_fence ? FAM.dark_oak_fence.first : B.Air;
      f.set(lx, ly, lz, b);
    }
    // a doorway, a ladder up the inside, floors with a hole for it
    f.set(0, 1, -3, B.Air); f.set(0, 2, -3, B.Air);
    for (let ly = 1; ly <= 18; ly++) { f.set(2, ly, 2, FAM.ladder.first + f.face(0)); }
    for (const ly of [6, 12, 18]) f.set(2, ly, 2, FAM.ladder.first + f.face(0));
    // the lookout: a wider deck with a fence railing and a roof
    for (let lz = -4; lz <= 4; lz++) for (let lx = -4; lx <= 4; lx++) {
      f.set(lx, 19, lz, dark);
      if (Math.abs(lx) === 4 || Math.abs(lz) === 4) f.set(lx, 20, lz, FAM.dark_oak_fence ? FAM.dark_oak_fence.first : dark);
    }
    for (const [lx, lz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) for (let ly = 20; ly <= 22; ly++) f.set(lx, ly, lz, log);
    roof(f, 9, 9, 23, 'dark_oak_stairs', 'dark_oak_slab', dark);
    f.set(0, 20, 0, C.chest);
    f.set(-2, 20, -2, B.Torch);
  },
  pyramid(W, p, r) {
    const f = frame(W, p.x, p.y + 14, p.z, 0), ss = B.Sandstone, cut = id('cut_sandstone'), orange = id('orange_terracotta'), blue = id('blue_terracotta');
    f.ground(-10, 10, -10, 10, ss, 22, ss);
    for (let k = 0; k <= 10; k++) for (let lz = -10 + k; lz <= 10 - k; lz++) for (let lx = -10 + k; lx <= 10 - k; lx++) {
      const shell = Math.abs(lx) === 10 - k || Math.abs(lz) === 10 - k;
      f.set(lx, 1 + k, lz, shell || k >= 7 ? (k % 3 === 0 ? cut : ss) : B.Air);
    }
    // the entrance and the patterned floor
    for (let ly = 1; ly <= 3; ly++) for (let lz = -10; lz <= -7; lz++) f.set(0, ly, lz, B.Air);
    for (let lz = -6; lz <= 6; lz++) for (let lx = -6; lx <= 6; lx++) f.set(lx, 0, lz, (Math.abs(lx) + Math.abs(lz)) % 4 === 0 ? orange : ss);
    f.set(0, 0, 0, blue);
    // the treasure pit under the floor: four chests, and TNT under a pressure plate
    for (let ly = -12; ly <= -1; ly++) for (let lz = -2; lz <= 2; lz++) for (let lx = -2; lx <= 2; lx++) {
      const wall = Math.abs(lx) === 2 || Math.abs(lz) === 2;
      f.set(lx, ly, lz, wall ? ss : ly < -9 ? ss : B.Air);
    }
    f.set(0, -1, 0, B.Air); f.set(0, 0, 0, B.Air);
    for (const [lx, lz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) f.set(lx, -9, lz, C.chest);
    f.set(0, -10, 0, C.tnt); f.set(0, -9, 0, FAM.stone_pressure_plate.first);
    for (const [lx, lz] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) f.set(lx, -10, lz, C.tnt);
  },
  well(W, p) { well(W, { ...p, y: p.gy, rot: 0 }, B.Sandstone, MATS.desert); },
  igloo(W, p, r) {
    const f = frame(W, p.x, p.gy, p.z, p.rot), snow = B.Snow;
    f.ground(-4, 4, -4, 4, snow, 6, snow);
    for (let ly = 1; ly <= 4; ly++) for (let lz = -4; lz <= 4; lz++) for (let lx = -4; lx <= 4; lx++) {
      const d = Math.hypot(lx, (ly - 0.5) * 1.35, lz);
      if (d <= 4.4 && d > 3.2) f.set(lx, ly, lz, snow);
      else if (d <= 3.2) f.set(lx, ly, lz, B.Air);
    }
    f.set(0, 1, -4, B.Air); f.set(0, 2, -4, B.Air); f.set(0, 1, -3, B.Air);
    for (let lz = -2; lz <= 2; lz++) for (let lx = -2; lx <= 2; lx++) f.set(lx, 0, lz, id('white_carpet') ? B.Snow : snow);
    const bed = fam('red_bed'), bf = f.face(2);
    f.set(-2, 1, 1, bed.first + bf * 2); f.set(-2, 1, 2, bed.first + bf * 2 + 1);
    f.set(2, 1, 2, C.furnace); f.set(2, 1, 1, C.crafting_table); f.set(0, 1, 2, B.Torch);
  },
  portal(W, p, r) {
    const f = frame(W, p.x, p.gy, p.z, p.rot), obs = B.Obsidian, cry = id('crying_obsidian');
    f.ground(-2, 1, -1, 1, B.Netherrack, 7, B.Netherrack);
    // netherrack and magma spill round a broken frame
    for (let lz = -5; lz <= 5; lz++) for (let lx = -6; lx <= 6; lx++) {
      if (Math.hypot(lx, lz) > 5.5 + r() * 1.5) continue;
      const [x, z] = f.at(lx, lz);
      if (!W.inside(x, z)) continue;
      const g = W.top(x, z, p.gy);
      W.set(x, g, z, r() < 0.15 ? B.Magma : p.mossy && r() < 0.3 ? id('mossy_cobblestone') : B.Netherrack);
    }
    for (let ly = 1; ly <= 5; ly++) for (let lx = -2; lx <= 1; lx++) {
      const edge = lx === -2 || lx === 1 || ly === 1 || ly === 5;
      if (!edge) continue;
      if (r() < 0.12) continue;                    // missing pieces
      f.set(lx, ly, 0, r() < 0.3 ? cry : obs);
    }
    f.set(3, 1, 2, C.chest); f.set(-4, 1, 1, id('gold_block'));
  },
  hut(W, p, r) {
    const f = frame(W, p.x, p.gy + 3, p.z, p.rot), sp = id('spruce_planks');
    for (const [lx, lz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) for (let ly = -6; ly <= 0; ly++) f.set(lx, ly, lz, B.OakLog);
    for (let lz = -2; lz <= 2; lz++) for (let lx = -3; lx <= 3; lx++) {
      f.set(lx, 1, lz, sp);
      for (let ly = 2; ly <= 4; ly++) f.set(lx, ly, lz, Math.abs(lx) === 3 || Math.abs(lz) === 2 ? (ly === 3 && (lx === 0 || lz === 0) ? FAM.glass_pane.first : sp) : B.Air);
      f.set(lx, 5, lz, sp);
    }
    for (let lx = -3; lx <= 3; lx++) f.set(lx, 6, 0, fam('spruce_slab').first);
    f.set(0, 2, -2, B.Air); f.set(0, 3, -2, B.Air);
    f.set(0, 1, -3, sp); f.set(0, 1, -4, sp);
    f.set(2, 2, 1, C.crafting_table); f.set(-2, 2, 1, C.chest);
    for (let lz = -2; lz <= 2; lz++) for (let lx = -3; lx <= 3; lx++) { const [x, z] = f.at(lx, lz); W.noTrees(x, z); }
  },
  dungeon(W, p, r) {
    for (let y = p.y; y <= p.y + 5; y++) for (let z = p.z - 4; z <= p.z + 4; z++) for (let x = p.x - 4; x <= p.x + 4; x++) {
      const shell = y === p.y || y === p.y + 5 || Math.abs(x - p.x) === 4 || Math.abs(z - p.z) === 4;
      if (shell) { if (W.get(x, y, z) !== B.Air || y === p.y) W.set(x, y, z, r() < 0.4 ? id('mossy_cobblestone') : B.Cobblestone); }
      else W.set(x, y, z, B.Air);
    }
    W.set(p.x, p.y + 1, p.z, C.spawner);
    const spots = [[p.x - 3, p.z], [p.x + 3, p.z], [p.x, p.z - 3], [p.x, p.z + 3]];
    for (let k = 0; k < p.chests; k++) { const s = spots[Math.floor(r() * 4)]; W.set(s[0], p.y + 1, s[1], C.chest); }
    for (let k = 0; k < 6; k++) W.set(p.x - 3 + Math.floor(r() * 7), p.y + 4, p.z - 3 + Math.floor(r() * 7), id('cobweb'));
  },
  bastion(W, p, r) {
    const f = frame(W, p.x, 34, p.z, p.rot), pbb = id('polished_blackstone_bricks'), cr = id('cracked_polished_blackstone_bricks');
    const bs = B.Blackstone, gild = id('gilded_blackstone'), gold = id('gold_block');
    const brick = () => (r() < 0.2 ? cr : r() < 0.05 ? gild : pbb);
    // a platform on blackstone pillars out of the lava, a walled keep with a courtyard
    for (let lz = -14; lz <= 14; lz++) for (let lx = -14; lx <= 14; lx++) {
      f.set(lx, 0, lz, Math.abs(lx) % 7 === 0 && Math.abs(lz) % 7 === 0 ? bs : brick());
      if (Math.abs(lx) % 7 === 0 && Math.abs(lz) % 7 === 0) for (let k = 1; k < 14; k++) { const [x, z] = f.at(lx, lz); const v = W.get(x, 34 - k, z); if (v !== B.Air && v !== B.Lava) break; W.set(x, 34 - k, z, bs); }
      for (let ly = 1; ly <= 13; ly++) {
        const edge = Math.abs(lx) === 14 || Math.abs(lz) === 14, inner = Math.abs(lx) === 8 || Math.abs(lz) === 8;
        const inRing = Math.max(Math.abs(lx), Math.abs(lz)) >= 8;
        let b = B.Air;
        if (edge && ly <= 12 && !(ly <= 4 && (lx === 0 || lz === 0))) b = ly === 12 && (lx + lz) % 2 ? B.Air : brick();
        else if (inner && ly <= 9 && Math.max(Math.abs(lx), Math.abs(lz)) === 8 && !(ly <= 3 && (lx === 0 || lz === 0))) b = brick();
        else if (inRing && ly === 5) b = pbb;                 // the gallery floor between the walls
        f.set(lx, ly, lz, b);
      }
    }
    // treasure in the middle: gold blocks, gilded blackstone, chests, lava braziers
    for (const [lx, lz] of [[-2, -2], [2, 2], [-2, 2], [2, -2]]) { f.set(lx, 1, lz, gold); f.set(lx, 2, lz, gild); }
    f.set(0, 1, 0, C.chest); f.set(0, 6, 11, C.chest); f.set(11, 6, 0, C.chest);
    for (const [lx, lz] of [[-6, -6], [6, 6], [-6, 6], [6, -6]]) f.set(lx, 1, lz, B.Magma);
  },
};

function farm(W, p, r, M) {
  const f = frame(W, p.x, p.y, p.z, p.rot), log = id(M.log);
  f.ground(-3, 3, -4, 4, B.Dirt, 3, B.Dirt);
  for (let lz = -4; lz <= 4; lz++) for (let lx = -3; lx <= 3; lx++) {
    const border = Math.abs(lx) === 3 || Math.abs(lz) === 4;
    if (border) { f.set(lx, 0, lz, log); continue; }
    if (lx === 0) { f.set(lx, 0, lz, B.Water); continue; }
    f.set(lx, 0, lz, FAM.farmland.first);
    f.set(lx, 1, lz, FAM.wheat.first + 3 + Math.floor(r() * 5));
  }
}

function lamp(W, p, M) {
  const f = frame(W, p.x, p.y, p.z, 0), fence = fam(M.fence);
  f.ground(0, 0, 0, 0, B.Cobblestone, 5);
  for (let ly = 1; ly <= 3; ly++) f.set(0, ly, 0, fence ? fence.first : B.Planks);
  f.set(0, 4, 0, B.Glowstone);
}

function well(W, p, stone, M) {
  const f = frame(W, p.x, p.y, p.z, 0);
  f.ground(-2, 2, -2, 2, stone, 6, stone);
  for (let lz = -2; lz <= 2; lz++) for (let lx = -2; lx <= 2; lx++) {
    const rim = Math.abs(lx) === 2 || Math.abs(lz) === 2;
    if (rim) { f.set(lx, 1, lz, stone); continue; }
    f.set(lx, 1, lz, B.Air);
    for (let k = 0; k >= -3; k--) f.set(lx, k, lz, B.Water);
    f.set(lx, -4, lz, stone);
  }
  const fence = fam(M.fence);
  for (const [lx, lz] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) { f.set(lx, 1, lz, stone); f.set(lx, 2, lz, fence ? fence.first : stone); f.set(lx, 3, lz, fence ? fence.first : stone); }
  for (let lz = -1; lz <= 1; lz++) for (let lx = -1; lx <= 1; lx++) f.set(lx, 4, lz, fam(M.slab) ? fam(M.slab).first : stone);
}
