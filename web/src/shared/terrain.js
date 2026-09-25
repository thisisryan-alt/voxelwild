// Port of Voxelwild.World.Generation.TerrainNoise: continents, climate, 19 biomes, dunes, mesas, swamps, rivers.
import { Simplex, hash4, smoothstep, lerp, clamp, saturate } from './noise.js';
import { SEA, MIN_Y, MAX_Y } from './const.js';

export const Biome = {
  Ocean: 0, FrozenOcean: 1, Beach: 2, SnowyBeach: 3, River: 4, FrozenRiver: 5, Desert: 6, Badlands: 7, Savanna: 8, Plains: 9,
  Forest: 10, DenseForest: 11, Jungle: 12, Swamp: 13, Taiga: 14, SnowyTaiga: 15, SnowyTundra: 16, Mountains: 17, SnowyPeaks: 18,
};
export const BIOME_NAMES = Object.keys(Biome);

export function seedOffset(seed, salt) {
  const h = hash4(seed, salt, 0x51ED);
  const h2 = hash4(h, salt ^ 0x9E3779B9, 7);
  return [(h & 0xFFFF) - 32768, (h2 & 0xFFFF) - 32768];
}

function continentalBase(c) {
  if (c < -0.45) return 28;
  if (c < -0.20) return lerp(28, 50, (c + 0.45) / 0.25);
  if (c < -0.06) return lerp(50, 62, (c + 0.20) / 0.14);
  if (c < 0.02) return lerp(62, 67, (c + 0.06) / 0.08);
  if (c < 0.35) return lerp(67, 80, (c - 0.02) / 0.33);
  return lerp(80, 92, saturate((c - 0.35) / 0.4));
}
const terrace = (h, step) => { const k = h / step; const f = k - Math.floor(k); return (Math.floor(k) + smoothstep(0.72, 0.95, f)) * step; };
const band = (x, lo, hi, s) => smoothstep(lo - s, lo + s, x) * (1 - smoothstep(hi - s, hi + s, x));

export class Terrain {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.n = new Simplex(this.seed);
    this.o = [];
    for (let s = 0; s < 50; s++) this.o[s] = seedOffset(this.seed, s);
  }

  /** Surface sample at world (x, z). Returns a reused object - copy what you keep. */
  sample(x, z, out = {}) {
    const n = this.n, o = this.o;
    const px = x + o[1][0], pz = z + o[1][1];
    const wx = n.fbm2(px * 0.0021 + o[2][0] * 0.001, pz * 0.0021 + o[2][1] * 0.001, 3) * 70;
    const wz = n.fbm2(px * 0.0021 + o[3][0] * 0.001, pz * 0.0021 + o[3][1] * 0.001, 3) * 70;
    const qx = px + wx, qz = pz + wz;

    const cont = n.fbm2(qx * 0.00085, qz * 0.00085, 5) * 1.25;
    const erosion = n.fbm2(qx * 0.0017 + 311.7, qz * 0.0017 + 311.7, 4);
    const ridge = n.ridged2(qx * 0.0019 + 719.3, qz * 0.0019 + 719.3, 4);
    const massif = n.fbm2(qx * 0.0011 + 1733.1, qz * 0.0011 + 1733.1, 3) * 0.5 + 0.5;
    const hills = n.fbm2(qx * 0.0085 + 51.1, qz * 0.0085 + 51.1, 4);
    const detail = n.fbm2(px * 0.045 + 97.5, pz * 0.045 + 97.5, 2);

    const jitter = n.fbm2(px * 0.09 + 5.5, pz * 0.09 + 5.5, 2) * 0.025;
    let t = saturate(n.fbm2(qx * 0.00042 + o[4][0] * 0.01, qz * 0.00042 + o[4][1] * 0.01, 3) * 1.7 * 0.5 + 0.5 + jitter);
    const hu = saturate(n.fbm2(qx * 0.0005 + o[5][0] * 0.01, qz * 0.0005 + o[5][1] * 0.01, 3) * 1.7 * 0.5 + 0.5 - jitter);

    const baseH = continentalBase(cont);
    const mountainMask = smoothstep(0.02, 0.42, cont) * smoothstep(0.35, -0.30, erosion);
    const desert = smoothstep(0.60, 0.70, t) * smoothstep(0.40, 0.30, hu) * (1 - mountainMask);
    const badlands = desert * smoothstep(0.05, 0.30, n.fbm2(qx * 0.0013 + 911.3, qz * 0.0013 + 911.3, 3));
    const lowland = smoothstep(-0.08, 0.0, cont) * (1 - smoothstep(0.12, 0.28, cont));
    const swamp = smoothstep(0.64, 0.76, hu) * band(t, 0.42, 0.66, 0.04) * lowland * (1 - mountainMask);
    const jungle = smoothstep(0.62, 0.72, t) * smoothstep(0.55, 0.68, hu);

    const mountains = (massif * 38 + Math.pow(ridge, 1.25) * 72) * mountainMask * (1 - desert * 0.6);
    const inland = smoothstep(-0.10, 0.25, cont);
    const hillAmp = lerp(3, 15, inland) * (1 - 0.6 * mountainMask) * lerp(1.2, 0.6, saturate(erosion * 0.5 + 0.5))
      * (1 + 0.6 * jungle) * (1 - 0.6 * desert) * (1 - 0.85 * swamp);
    let h = baseH + mountains + hills * hillAmp + detail * 1.4;

    const dx = px * 0.8 + pz * 0.6, dz = -px * 0.6 + pz * 0.8;
    h += n.ridged2(dx * 0.011, dz * 0.025, 2) * 7 * desert * (1 - badlands);
    if (badlands > 0) {
      const plateau = h + 20 * badlands + n.fbm2(qx * 0.004 + 71.2, qz * 0.004 + 71.2, 3) * 10;
      h = lerp(h, terrace(plateau, 7), smoothstep(0, 0.6, badlands));
    }
    h = lerp(h, SEA + 0.4 + detail * 1.6 + hills * 1.5, swamp * 0.9);

    const rv = Math.abs(n.fbm2(qx * 0.00095 + o[6][0] * 0.01, qz * 0.00095 + o[6][1] * 0.01, 3));
    const river = (1 - smoothstep(0.010, 0.040, rv)) * smoothstep(-0.14, -0.02, cont);
    const bed = SEA - 2.5 - (1 - smoothstep(0, 0.012, rv)) * 3;
    if (h > bed) h = lerp(h, bed, river);
    h = clamp(h, MIN_Y + 8, MAX_Y - 6);
    t = saturate(t - Math.max(0, h - 95) / 200);

    out.height = h; out.cont = cont; out.mountain = mountainMask; out.temp = t; out.humid = hu;
    out.river = river; out.desert = desert; out.badlands = badlands; out.swamp = swamp;
    out.overhang = mountainMask * 11 + badlands * 3;
    out.biome = classify(out);
    return out;
  }
}

export function classify(s) {
  const cold = s.temp < 0.2;
  if (s.river > 0.5 && s.height < SEA + 1) return cold ? Biome.FrozenRiver : Biome.River;
  if (s.height < SEA - 1) return cold ? Biome.FrozenOcean : Biome.Ocean;
  if (s.height <= SEA + 2 && s.cont < 0.06 && s.swamp < 0.5 && s.badlands < 0.3) return cold ? Biome.SnowyBeach : Biome.Beach;
  if (s.mountain > 0.55 || s.height > 128) return s.height > 148 || cold ? Biome.SnowyPeaks : Biome.Mountains;
  if (s.badlands > 0.5) return Biome.Badlands;
  if (s.desert > 0.5) return Biome.Desert;
  if (s.swamp > 0.5) return Biome.Swamp;
  if (cold) return s.humid < 0.45 ? Biome.SnowyTundra : Biome.SnowyTaiga;
  if (s.temp < 0.36) return Biome.Taiga;
  if (s.temp > 0.66) return s.humid > 0.55 ? Biome.Jungle : Biome.Savanna;
  if (s.humid < 0.38) return Biome.Plains;
  return s.humid < 0.6 ? Biome.Forest : Biome.DenseForest;
}
