// Seeded simplex noise (2D/3D, after Gustavson) plus the fBm / ridged helpers the terrain uses.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 32-bit integer hash of up to four ints (deterministic across threads). */
export function hash4(a, b = 0, c = 0, d = 0) {
  let h = 0x9E3779B1 ^ Math.imul(a | 0, 0x85EBCA77);
  h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D) ^ Math.imul(b | 0, 0xC2B2AE3D);
  h = Math.imul(h ^ (h >>> 13), 0x297A2D39) ^ Math.imul(c | 0, 0x27D4EB2F);
  h = Math.imul(h ^ (h >>> 16), 0x165667B1) ^ Math.imul(d | 0, 0x9E3779B1);
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
  return h >>> 0;
}
export const hashf = (a, b, c, d) => hash4(a, b, c, d) / 4294967296;

const G3 = new Int8Array([1,1,0, -1,1,0, 1,-1,0, -1,-1,0, 1,0,1, -1,0,1, 1,0,-1, -1,0,-1, 0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1]);
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const F3 = 1 / 3, G3f = 1 / 6;

export class Simplex {
  constructor(seed) {
    const rnd = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { this.perm[i] = p[i & 255]; this.permMod12[i] = this.perm[i] % 12; }
  }

  noise2(xin, yin) {
    const perm = this.perm, pm = this.permMod12;
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = pm[ii + perm[jj]] * 3; t0 *= t0; n0 = t0 * t0 * (G3[g] * x0 + G3[g + 1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = pm[ii + i1 + perm[jj + j1]] * 3; t1 *= t1; n1 = t1 * t1 * (G3[g] * x1 + G3[g + 1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = pm[ii + 1 + perm[jj + 1]] * 3; t2 *= t2; n2 = t2 * t2 * (G3[g] * x2 + G3[g + 1] * y2); }
    return 70 * (n0 + n1 + n2);
  }

  noise3(xin, yin, zin) {
    const perm = this.perm, pm = this.permMod12;
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3f;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3f, y1 = y0 - j1 + G3f, z1 = z0 - k1 + G3f;
    const x2 = x0 - i2 + 2 * G3f, y2 = y0 - j2 + 2 * G3f, z2 = z0 - k2 + 2 * G3f;
    const x3 = x0 - 1 + 3 * G3f, y3 = y0 - 1 + 3 * G3f, z3 = z0 - 1 + 3 * G3f;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) { const g = pm[ii + perm[jj + perm[kk]]] * 3; t0 *= t0; n0 = t0 * t0 * (G3[g] * x0 + G3[g + 1] * y0 + G3[g + 2] * z0); }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) { const g = pm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; t1 *= t1; n1 = t1 * t1 * (G3[g] * x1 + G3[g + 1] * y1 + G3[g + 2] * z1); }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) { const g = pm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; t2 *= t2; n2 = t2 * t2 * (G3[g] * x2 + G3[g + 1] * y2 + G3[g + 2] * z2); }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) { const g = pm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; t3 *= t3; n3 = t3 * t3 * (G3[g] * x3 + G3[g + 1] * y3 + G3[g + 2] * z3); }
    return 32 * (n0 + n1 + n2 + n3);
  }

  /** fBm with a rotation per octave (hides the lattice); roughly -1..1. */
  fbm2(x, y, octaves) {
    let sum = 0, amp = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise2(x, y);
      norm += amp; amp *= 0.5;
      const nx = x * 1.6 - y * 1.2; y = x * 1.2 + y * 1.6; x = nx;
    }
    return sum / norm;
  }

  fbm3(x, y, z, octaves) {
    let sum = 0, amp = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise3(x, y, z);
      norm += amp; amp *= 0.5;
      x = x * 2.03 + 17.1; y = y * 2.03 + 17.1; z = z * 2.03 + 17.1;
    }
    return sum / norm;
  }

  /** Ridged multifractal in [0,1]. */
  ridged2(x, y, octaves) {
    let sum = 0, amp = 0.5, weight = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      let n = 1 - Math.abs(this.noise2(x, y));
      n *= n; n *= weight;
      weight = Math.min(1, Math.max(0, n * 2));
      sum += n * amp; norm += amp; amp *= 0.5;
      const nx = x * 1.7 - y * 1.1; y = x * 1.1 + y * 1.7; x = nx;
    }
    return sum / norm;
  }
}

export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const saturate = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
