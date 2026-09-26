// Port of DecorationJob: trees on a world-space jittered grid; every column applies all trees that reach it
// (its own and its 8 neighbours') in one global order, writing only its own blocks - seamless and deterministic.
// Also computes the sky-light heightmap (topmost light-blocking block per x,z).
import { CS, CS2, MIN_Y, MAX_Y, SEA, colIdx } from './const.js';
import { B, BLOCKS, F, C, CAT } from './blocks.js';
import { Biome } from './terrain.js';
import { hash4, mulberry32 } from './noise.js';
import { placeProps } from './props.js';

const K = { Oak: 0, BigOak: 1, Birch: 2, Spruce: 3, TallSpruce: 4, Jungle: 5, JungleGiant: 6, Bush: 7, SwampOak: 8, Acacia: 9, DarkOak: 10, Cherry: 11 };
const GRID = 5;
const fdiv = (a, b) => Math.floor(a / b);

/** neighbours: array of 9 surfaces (index (dx+1)+(dz+1)*3), each {height, top, biome}. dim: 0 overworld, 1 nether, 2 end. */
export function decorateColumn(vox, cx, cz, seed, neighbours, dim = 0) {
  if (dim) return decorateOther(vox, cx, cz, seed, neighbours, dim);
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
      case Biome.DenseForest: chance = 0.85; kind = r2 < 0.3 ? K.BigOak : r2 < 0.62 ? K.DarkOak : r2 < 0.85 ? K.Oak : K.Birch; break;
      case Biome.Jungle: chance = 0.9; kind = r2 < 0.16 ? K.JungleGiant : r2 < 0.58 ? K.Jungle : K.Bush; break;
      case Biome.Savanna: chance = 0.09; kind = K.Acacia; break;
      case Biome.Swamp: chance = 0.3; kind = K.SwampOak; break;
      case Biome.Taiga: chance = 0.6; kind = r2 < 0.7 ? K.Spruce : K.TallSpruce; break;
      case Biome.SnowyTaiga: chance = 0.45; kind = r2 < 0.6 ? K.Spruce : K.TallSpruce; break;
      case Biome.SnowyTundra: chance = 0.03; kind = K.Spruce; break;
      case Biome.Mountains: chance = height < 126 ? 0.14 : 0; kind = height < 110 && r2 < 0.35 ? K.Cherry : K.Spruce; break;
    }
    if (r1 >= chance) continue;
    trees.push({ x: px, y: height + 1, z: pz, kind, seed: hash4(px, pz, seed, 2) | 1 });
  }
  trees.sort((a, b) => (a.z !== b.z ? a.z - b.z : a.x - b.x));

  const ox = cx * CS, oz = cz * CS;
  const inside = (x, y, z) => x >= ox && z >= oz && x < ox + CS && z < oz + CS && y >= MIN_Y && y < MAX_Y;
  const soft = (b) => b === B.Air || ((BLOCKS[b].flags & F.Replaceable) && !(BLOCKS[b].flags & F.Liquid));
  const isLeaves = (b) => (b >= B.OakLeaves && b <= B.JungleLeaves) || (CAT[b] && CAT[b].cat === 'leaves');
  const w = {
    log(x, y, z, id) { if (!inside(x, y, z)) return; const i = colIdx(x - ox, y, z - oz); const c = vox[i]; if (soft(c) || isLeaves(c)) vox[i] = id; },
    leaf(x, y, z, id) { if (!inside(x, y, z)) return; const i = colIdx(x - ox, y, z - oz); if (soft(vox[i])) vox[i] = id; },
    root(x, y, z) { if (!inside(x, y, z)) return; const i = colIdx(x - ox, y, z - oz); if (vox[i] === B.Grass || vox[i] === B.SnowyGrass) vox[i] = B.Dirt; },
  };
  for (const t of trees) build(t, w);
  // props after trees (they need open ground), before the heightmap (boulder cores block light)
  const props = placeProps(vox, cx, cz, seed, neighbours[4].height, neighbours[4].biome);
  return { heightmap: heightmapOf(vox), props };
}

function heightmapOf(vox) {
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

// ---------------------------------------------------------------- the Nether's huge fungi, the End's chorus plants

function decorateOther(vox, cx, cz, seed, neighbours, dim) {
  const items = [];
  const grid = dim === 1 ? 4 : 6;
  const minX = (cx - 1) * CS, minZ = (cz - 1) * CS, maxX = (cx + 2) * CS, maxZ = (cz + 2) * CS;
  for (let gz = fdiv(minZ, grid); gz <= fdiv(maxZ - 1, grid); gz++) for (let gx = fdiv(minX, grid); gx <= fdiv(maxX - 1, grid); gx++) {
    const h = hash4(gx, gz, seed ^ 0x6F9, dim);
    const px = gx * grid + (h % grid), pz = gz * grid + ((h >>> 4) % grid);
    if (px < minX || pz < minZ || px >= maxX || pz >= maxZ) continue;
    const lx = px - minX, lz = pz - minZ;
    const sf = neighbours[(lx >> 5) + (lz >> 5) * 3];
    const k = (lx & 31) + (lz & 31) * CS;
    const height = sf.height[k], top = sf.top[k], biome = sf.biome[k];
    if (height < -1000) continue;
    const r = ((h >>> 8) & 0xFFF) / 4096;
    if (dim === 1) {
      if (top !== B.CrimsonNylium && top !== B.WarpedNylium) continue;
      if (r >= 0.42) continue;
      items.push({ x: px, y: height + 1, z: pz, crimson: top === B.CrimsonNylium, seed: hash4(px, pz, seed, 5) | 1 });
    } else {
      if (biome !== Biome.EndHighlands && biome !== Biome.EndMidlands) continue;
      if (r >= (biome === Biome.EndHighlands ? 0.3 : 0.08)) continue;
      items.push({ x: px, y: height + 1, z: pz, chorus: true, seed: hash4(px, pz, seed, 6) | 1 });
    }
  }
  items.sort((a, b) => (a.z !== b.z ? a.z - b.z : a.x - b.x));
  const ox = cx * CS, oz = cz * CS;
  const inside = (x, y, z) => x >= ox && z >= oz && x < ox + CS && z < oz + CS && y >= MIN_Y && y < MAX_Y;
  const soft = (b) => b === B.Air || ((BLOCKS[b].flags & F.Replaceable) && !(BLOCKS[b].flags & F.Liquid));
  const put = (x, y, z, id, force) => { if (!inside(x, y, z)) return; const i = colIdx(x - ox, y, z - oz); if (force || soft(vox[i])) vox[i] = id; };
  for (const t of items) (t.chorus ? chorus : fungus)(t, put);
  return { heightmap: heightmapOf(vox), props: new Int32Array(0) };
}

/** Minecraft's huge fungus: a tall stem under a domed hat of wart blocks with shroomlights and (crimson) hanging vines. */
function fungus(t, put) {
  const rng = mulberry32(t.seed);
  const stem = t.crimson ? B.CrimsonStem : B.WarpedStem, wart = t.crimson ? B.NetherWartBlock : B.WarpedWartBlock;
  const h = 5 + Math.floor(rng() * 9) * (rng() < 0.1 ? 2 : 1);
  const hat = Math.max(3, Math.min(h - 1, 3 + Math.floor(rng() * (h / 3))));
  const top = t.y + h;
  for (let k = 0; k <= h; k++) put(t.x, t.y + k, t.z, stem, true);
  for (let i = 0; i < hat; i++) {
    const y = top - i;
    const r = i === 0 ? 1.5 : i === 1 ? 2.6 : 3.3 + (i > 3 ? 0.4 : 0);
    const R = Math.ceil(r);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dz);
      if (d > r || (dx === 0 && dz === 0)) continue;
      const shell = i === 0 || d > r - 1.15;
      if (!shell) { if (i === hat - 1 && rng() < 0.08) put(t.x + dx, y, t.z + dz, B.Shroomlight); continue; }
      if (rng() < 0.06) continue;                                   // ragged edge
      put(t.x + dx, y, t.z + dz, rng() < 0.05 ? B.Shroomlight : wart);
      if (i === hat - 1 && t.crimson && rng() < 0.3) {
        const len = 1 + Math.floor(rng() * 4);
        for (let k = 1; k <= len; k++) put(t.x + dx, y - k, t.z + dz, B.WeepingVines);
      }
    }
  }
}

/** Chorus plant: a branching purple stalk with flowers at its tips (Minecraft's ChorusFlower.generatePlant). */
function chorus(t, put) {
  const rng = mulberry32(t.seed);
  const grow = (x, y, z, depth) => {
    const height = 1 + Math.floor(rng() * (depth === 0 ? 4 : 3)) + (depth === 0 ? 1 : 0);
    for (let k = 0; k < height; k++) put(x, y + k, z, B.ChorusPlant);
    const ty = y + height - 1;
    let branched = false;
    if (depth < 4) {
      const n = depth === 0 ? 1 + Math.floor(rng() * 3) : Math.floor(rng() * 4);
      for (let b = 0; b < n; b++) {
        const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rng() * 4)];
        const nx = x + d[0], nz = z + d[1];
        if (Math.abs(nx - t.x) > 7 || Math.abs(nz - t.z) > 7) continue;
        put(nx, ty, nz, B.ChorusPlant);
        grow(nx, ty + 1, nz, depth + 1);
        branched = true;
      }
    }
    if (!branched) put(x, ty + 1, z, B.ChorusFlower);
  };
  grow(t.x, t.y, t.z, 0);
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
    case K.Acacia: {
      // a leaning trunk that forks into flat, wide crowns
      const log = C.acacia_log || B.OakLog, leaf = C.acacia_leaves || B.OakLeaves;
      const h = ri(4, 7), dx = rng() < 0.5 ? 1 : -1, dz = rng() < 0.5 ? 1 : -1;
      trunk(t.x, t.y, t.z, h - 2, log);
      let x = t.x, z = t.z, y = t.y + h - 2;
      for (let k = 0; k < 3; k++) { x += dx * (k > 0 ? 1 : 0); z += dz * (k === 2 ? 1 : 0); w.log(x, y + k, z, log); }
      const top = y + 2;
      for (let yy = 0; yy <= 1; yy++) { const r = yy === 0 ? 3.2 : 2.1; blob(x, top + yy, z, r, 0.6, r, leaf); }
      if (rng() < 0.6) { const bx = t.x - dx * 2, bz = t.z - dz; w.log(t.x - dx, t.y + h - 3, t.z, log); w.log(bx, t.y + h - 2, bz, log); blob(bx, t.y + h - 1, bz, 2.3, 0.6, 2.3, leaf); }
      break;
    }
    case K.DarkOak: {
      // 2 x 2 trunk under a heavy, low dome
      const log = C.dark_oak_log || B.OakLog, leaf = C.dark_oak_leaves || B.OakLeaves, h = ri(6, 9);
      for (let dz = 0; dz <= 1; dz++) for (let dx = 0; dx <= 1; dx++) trunk(t.x + dx, t.y, t.z + dz, h, log);
      blob(t.x + 1, t.y + h, t.z + 1, 4.2, 2.4, 4.2, leaf);
      blob(t.x + 1, t.y + h + 2, t.z + 1, 2.6, 1.4, 2.6, leaf);
      break;
    }
    case K.Cherry: {
      const log = C.cherry_log || B.OakLog, leaf = C.cherry_leaves || B.OakLeaves, h = ri(5, 8);
      trunk(t.x, t.y, t.z, h, log);
      blob(t.x, t.y + h, t.z, 3.6, 2.2, 3.6, leaf);
      const dx = rng() < 0.5 ? 2 : -2;
      for (let k = 1; k <= 2; k++) w.log(t.x + Math.sign(dx) * k, t.y + h - 3 + k, t.z, log);
      blob(t.x + dx, t.y + h - 1, t.z, 2.6, 1.8, 2.6, leaf);
      break;
    }
  }
}
