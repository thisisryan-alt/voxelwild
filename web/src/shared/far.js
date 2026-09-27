// Far terrain (Distant-Horizons style): a coarse height grid of the overworld from the same terrain function the
// chunks use, for the landscape beyond the loaded world. Per vertex: surface height (trees and water included), a
// surface material, tree cover, climate and a normal.
import { SEA } from './const.js';
import { Biome, Terrain } from './terrain.js';

export const FarMat = { Grass: 0, Sand: 1, Snow: 2, Stone: 3, Gravel: 4, RedSand: 5, Sandstone: 6, Mud: 7, Water: 8, Ice: 9 };

const terrains = new Map();
const terrainFor = (seed) => { let t = terrains.get(seed); if (!t) { t = new Terrain(seed); terrains.set(seed, t); } return t; };

// canopy cover per biome (roughly the decorator's tree chances)
const COVER = { [Biome.Forest]: 0.75, [Biome.DenseForest]: 0.95, [Biome.Jungle]: 0.95, [Biome.Taiga]: 0.7, [Biome.SnowyTaiga]: 0.55,
  [Biome.Swamp]: 0.45, [Biome.Plains]: 0.06, [Biome.Savanna]: 0.12, [Biome.SnowyTundra]: 0.03, [Biome.Mountains]: 0.2 };

/**
 * (N+1)^2 vertices from world corner (x0, z0) every `cell` blocks.
 * Returns Float32Array of 6 floats per vertex: surface y, material, tree cover, climate (temp*256+humid), normal x, normal z.
 */
export function farGrid(seed, x0, z0, cell, N) {
  const T = terrainFor(seed), V = N + 1;
  const H = new Float32Array((V + 2) * (V + 2)), mat = new Uint8Array(V * V), cover = new Float32Array(V * V), clim = new Float32Array(V * V);
  const tmp = {};
  // heights with a one-cell border (for normals and slope)
  for (let j = -1; j <= V; j++) for (let i = -1; i <= V; i++) {
    const s = T.sample(x0 + i * cell, z0 + j * cell, tmp);
    H[(i + 1) + (j + 1) * (V + 2)] = s.height;
    if (i < 0 || j < 0 || i >= V || j >= V) continue;
    const k = i + j * V;
    const t = Math.max(0, Math.min(1, s.temp)), h = Math.max(0, Math.min(1, s.humid));
    clim[k] = Math.round(t * 255) * 256 + Math.round(h * 255);
    let c = COVER[s.biome] || 0;
    if (s.biome === Biome.Mountains && s.height > 126) c = 0;
    cover[k] = s.height > SEA + 1 ? c : 0;
    let m = FarMat.Grass;
    switch (s.biome) {
      case Biome.Ocean: case Biome.River: m = s.height < SEA - 7 ? FarMat.Gravel : FarMat.Sand; break;
      case Biome.FrozenOcean: case Biome.FrozenRiver: m = FarMat.Sand; break;
      case Biome.Beach: case Biome.SnowyBeach: m = FarMat.Sand; break;
      case Biome.Desert: m = FarMat.Sand; break;
      case Biome.Badlands: m = FarMat.RedSand; break;
      case Biome.Swamp: m = s.humid > 0.8 ? FarMat.Mud : FarMat.Grass; break;
      case Biome.SnowyTundra: case Biome.SnowyTaiga: case Biome.SnowyPeaks: m = FarMat.Snow; break;
      case Biome.Mountains: m = s.height > 138 ? FarMat.Snow : FarMat.Grass; break;
    }
    mat[k] = m;
  }
  const out = new Float32Array(V * V * 6);
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const k = i + j * V, c = (i + 1) + (j + 1) * (V + 2);
    const hx = (H[c + 1] - H[c - 1]) / (2 * cell), hz = (H[c + (V + 2)] - H[c - (V + 2)]) / (2 * cell);
    const slope = Math.hypot(hx, hz);
    let m = mat[k], y = H[c];
    // steep ground shows rock, like the chunk generator's cliffs
    if (slope > 1.1 && m !== FarMat.Sand && m !== FarMat.RedSand) m = FarMat.Stone;
    if (y < SEA) {
      const frozen = (clim[k] >> 8) / 255 < 0.16;
      m = frozen ? FarMat.Ice : FarMat.Water;
    }
    const nl = Math.hypot(hx, 1, hz);
    const o = k * 6;
    out[o] = y < SEA ? SEA - 0.1 : y + 1; out[o + 1] = m; out[o + 2] = cover[k] * (slope > 1.4 ? 0.3 : 1); out[o + 3] = clim[k];
    out[o + 4] = -hx / nl; out[o + 5] = -hz / nl;
  }
  return out;
}
