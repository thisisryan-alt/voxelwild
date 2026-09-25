// Port of DecorationJob: trees on a world-space jittered grid; every column applies all trees that reach it
// (its own and its 8 neighbours') in one global order, writing only its own blocks - seamless and deterministic.
// Also computes the sky-light heightmap (topmost light-blocking block per x,z).
import { CS, CS2, MIN_Y, MAX_Y, SEA, colIdx } from './const.js';
import { B, BLOCKS, F } from './blocks.js';
import { Biome } from './terrain.js';
import { hash4, mulberry32 } from './noise.js';

const K = { Oak: 0, BigOak: 1, Birch: 2, Spruce: 3, TallSpruce: 4, Jungle: 5, JungleGiant: 6, Bush: 7, SwampOak: 8 };
const GRID = 5;
const fdiv = (a, b) => Math.floor(a / b);

/** neighbours: array of 9 surfaces (index (dx+1)+(dz+1)*3), each {height, top, biome}. */
export function decorateColumn(vox, cx, cz, seed, neighbours) {
  const trees = [];
  const minX = (cx - 1) * CS, minZ = (cz - 1) * CS, maxX = (cx + 2) * CS, maxZ = (cz + 2) * CS;
  for (let gz = fdiv(minZ, GRID); gz <= fdiv(maxZ - 1, GRID); gz++) for (let gx = fdiv(minX, GRID); gx <= fdiv(maxX - 1, GRID); gx++) {
    const h = hash4(gx, gz, seed ^ 0x5A17, 1);
    const px = gx * GRID + (h & 3), pz = gz * GRID + ((h >>> 2) & 3);
    if (px < minX || pz < minZ || px >= maxX || pz >= maxZ) continue;
    const lx = px - minX, lz = pz - minZ;
    const s = neighbours[(lx >> 5) + (lz >> 5) * 3];
    const k = (lx & 31) + (lz & 31) * CS;
    const height = s.height[k], top = s.top[k], biome = s.biome[k];
    if (height < SEA || height > MAX_Y - 30) continue;
    if (top !== B.Grass && top !== B.SnowyGrass && top !== B.Dirt && top !== B.Moss && top !== B.Mud) continue;
    const r1 = ((h >>> 8) & 0xFFF) / 4096, r2 = ((h >>> 20) & 0xFFF) / 4096;
    let chance = 0, kind = K.Oak;
    switch (biome) {
      case Biome.Plains: chance = 0.05; kind = r2 < 0.4 ? K.BigOak : K.Oak; break;
      case Biome.Forest: chance = 0.55; kind = r2 < 0.45 ? K.Oak : r2 < 0.8 ? K.Birch : K.BigOak; break;
      case Biome.DenseForest: chance = 0.85; kind = r2 < 0.5 ? K.BigOak : r2 < 0.82 ? K.Oak : K.Birch; break;
      case Biome.Jungle: chance = 0.9; kind = r2 < 0.16 ? K.JungleGiant : r2 < 0.58 ? K.Jungle : K.Bush; break;
      case Biome.Savanna: chance = 0.08; kind = K.SwampOak; break;
      case Biome.Swamp: chance = 0.3; kind = K.SwampOak; break;
      case Biome.Taiga: chance = 0.6; kind = r2 < 0.7 ? K.Spruce : K.TallSpruce; break;
      case Biome.SnowyTaiga: chance = 0.45; kind = r2 < 0.6 ? K.Spruce : K.TallSpruce; break;
      case Biome.SnowyTundra: chance = 0.03; kind = K.Spruce; break;
      case Biome.Mountains: chance = height < 126 ? 0.14 : 0; kind = K.Spruce; break;
    }
    if (r1 >= chance) continue;
    trees.push({ x: px, y: height + 1, z: pz, kind, seed: hash4(px, pz, seed, 2) | 1 });
  }
  trees.sort((a, b) => (a.z !== b.z ? a.z - b.z : a.x - b.x));

  const ox = cx * CS, oz = cz * CS;
  const inside = (x, y, z) => x >= ox && z >= oz && x < ox + CS && z < oz + CS && y >= MIN_Y && y < MAX_Y;
  const soft = (b) => b === B.Air || ((BLOCKS[b].flags & F.Replaceable) && !(BLOCKS[b].flags & F.Liquid));
  const isLeaves = (b) => b >= B.OakLeaves && b <= B.JungleLeaves;
  const w = {
    log(x, y, z, id) { if (!inside(x, y, z)) return; const i = colIdx(x - ox, y, z - oz); const c = vox[i]; if (soft(c) || isLeaves(c)) vox[i] = id; },
    leaf(x, y, z, id) { if (!inside(x, y, z)) return; const i = colIdx(x - ox, y, z - oz); if (soft(vox[i])) vox[i] = id; },
    root(x, y, z) { if (!inside(x, y, z)) return; const i = colIdx(x - ox, y, z - oz); if (vox[i] === B.Grass || vox[i] === B.SnowyGrass) vox[i] = B.Dirt; },
  };
  for (const t of trees) build(t, w);

  const heightmap = new Int32Array(CS2);
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    let top = MIN_Y - 1;
    for (let y = MAX_Y - 1; y >= MIN_Y; y--) {
      const b = vox[colIdx(x, y, z)];
      if (b !== B.Air && BLOCKS[b].opacity > 0) { top = y; break; }
    }
    heightmap[x + z * CS] = top;
  }
  return heightmap;
}

function build(t, w) {
  const rng = mulberry32(t.seed);
  const ri = (a, b) => a + Math.floor(rng() * (b - a));
  const trunk = (x, y, z, h, log) => { w.root(x, y - 1, z); for (let k = 0; k < h; k++) w.log(x, y + k, z, log); };
  const blob = (cx, cy, cz, rx, ry, rz, id) => {
    const ix = Math.ceil(rx), iy = Math.ceil(ry), iz = Math.ceil(rz);
    for (let dy = -iy; dy <= iy; dy++) for (let dz = -iz; dz <= iz; dz++) for (let dx = -ix; dx <= ix; dx++) {
      const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
      if (d <= 1 - rng() * 0.35) w.leaf(cx + dx, cy + dy, cz + dz, id);
    }
  };
  const broadleaf = (log, leaves, h) => {
    trunk(t.x, t.y, t.z, h, log);
    for (let dy = h - 3; dy <= h; dy++) {
      const r = dy >= h - 1 ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const corner = Math.abs(dx) === r && Math.abs(dz) === r;
        if (corner && (dy >= h - 1 || rng() < 0.5)) continue;
        w.leaf(t.x + dx, t.y + dy, t.z + dz, leaves);
      }
    }
  };
  switch (t.kind) {
    case K.Oak: broadleaf(B.OakLog, B.OakLeaves, ri(4, 7)); break;
    case K.Birch: broadleaf(B.BirchLog, B.BirchLeaves, ri(5, 8)); break;
    case K.BigOak: {
      const h = ri(7, 11);
      trunk(t.x, t.y, t.z, h, B.OakLog);
      blob(t.x, t.y + h, t.z, 3.3, 2.4, 3.3, B.OakLeaves);
      const branches = ri(2, 5);
      for (let i = 0; i < branches; i++) {
        const a = rng() * Math.PI * 2, start = ri(h >> 1, h - 1), len = ri(2, 5);
        let px = t.x, py = t.y + start, pz = t.z;
        const dl = Math.hypot(Math.cos(a), 0.55, Math.sin(a));
        for (let k = 0; k < len; k++) {
          px += Math.cos(a) / dl; py += 0.55 / dl; pz += Math.sin(a) / dl;
          w.log(Math.floor(px + 0.5), Math.floor(py + 0.5), Math.floor(pz + 0.5), B.OakLog);
        }
        blob(Math.floor(px + 0.5), Math.floor(py + 0.5) + 1, Math.floor(pz + 0.5), 2.4, 1.8, 2.4, B.OakLeaves);
      }
      break;
    }
    case K.Spruce: case K.TallSpruce: {
      const h = t.kind === K.Spruce ? ri(7, 11) : ri(12, 18), maxR = 3;
      trunk(t.x, t.y, t.z, h, B.SpruceLog);
      const bare = Math.max(2, (h >> 2) + ri(0, 2));
      for (let y = h; y >= bare; y--) {
        const fromTop = h - y;
        let r = fromTop === 0 ? 0 : Math.min(maxR, 1 + ((fromTop / 3) | 0)) - ((fromTop & 1) === 0 ? 1 : 0);
        r = Math.max(r, fromTop === 0 ? 0 : 1);
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dz * dz > r * r + 1) continue;
          if (Math.abs(dx) + Math.abs(dz) === 2 * r && r > 1 && rng() < 0.6) continue;
          w.leaf(t.x + dx, t.y + y, t.z + dz, B.SpruceLeaves);
        }
      }
      w.leaf(t.x, t.y + h + 1, t.z, B.SpruceLeaves);
      break;
    }
    case K.Jungle: {
      const h = ri(7, 12);
      trunk(t.x, t.y, t.z, h, B.JungleLog);
      blob(t.x, t.y + h, t.z, 3.2, 2, 3.2, B.JungleLeaves);
      if (rng() < 0.6) blob(t.x + ri(-2, 3), t.y + h - ri(3, 5), t.z + ri(-2, 3), 2, 1.4, 2, B.JungleLeaves);
      break;
    }
    case K.JungleGiant: {
      const h = ri(16, 25);
      for (let dz = 0; dz <= 1; dz++) for (let dx = 0; dx <= 1; dx++) trunk(t.x + dx, t.y, t.z + dz, h, B.JungleLog);
      const roots = [[-1, 0], [2, 1], [1, -1], [0, 2]];
      for (const [dx, dz] of roots) { const rh = ri(1, 4); for (let y = -1; y < rh; y++) w.log(t.x + dx, t.y + y, t.z + dz, B.JungleLog); }
      blob(t.x, t.y + h, t.z, 5.2, 3, 5.2, B.JungleLeaves);
      const branches = ri(3, 6);
      for (let i = 0; i < branches; i++) {
        const a = rng() * Math.PI * 2;
        let px = t.x + 0.5, py = t.y + h - ri(3, 8), pz = t.z + 0.5;
        const dl = Math.hypot(Math.cos(a), 0.45, Math.sin(a)), len = ri(3, 6);
        for (let k = 0; k < len; k++) { px += Math.cos(a) / dl; py += 0.45 / dl; pz += Math.sin(a) / dl; w.log(Math.floor(px), Math.floor(py), Math.floor(pz), B.JungleLog); }
        blob(Math.floor(px), Math.floor(py) + 1, Math.floor(pz), 3, 1.8, 3, B.JungleLeaves);
      }
      break;
    }
    case K.Bush: trunk(t.x, t.y, t.z, 1, B.JungleLog); blob(t.x, t.y + 1, t.z, 2.3, 1.6, 2.3, B.JungleLeaves); break;
    case K.SwampOak: { const h = ri(5, 8); trunk(t.x, t.y, t.z, h, B.OakLog); blob(t.x, t.y + h, t.z, 4.2, 1.6, 4.2, B.OakLeaves); break; }
  }
}
