// The End: a lens-shaped main island of end stone over the void, ringed by ten obsidian pillars, with the exit portal
// (a bedrock fountain, already open - there is no dragon) at its centre and an end gateway at its edge that leads to
// the outer islands beyond 1000 blocks: highlands with chorus plants (decorate.js) and purpur towers.
import { CS, CS2, HEIGHT, colIdx } from './const.js';
import { B } from './blocks.js';
import { Biome } from './terrain.js';
import { Simplex, hash4, mulberry32, smoothstep } from './noise.js';

export const END_ARRIVAL = [100.5, 49, 0.5];       // obsidian platform in the void, like Minecraft
export const END_GATEWAY = [-96, 75, 0];           // leads out to the islands
export const OUTER_LANDING = [-1250, 0];           // x, z around which the return gateway sits

const noiseCache = new Map();
function noiseFor(seed) {
  let n = noiseCache.get(seed);
  if (!n) { n = new Simplex((seed ^ 0xE4D) >>> 0); noiseCache.set(seed, n); }
  return n;
}

/** The ten pillars: centre, radius and height (deterministic per seed). */
export function endPillars(seed) {
  const rng = mulberry32(hash4(seed, 0x5B1, 7) | 1);
  const heights = Array.from({ length: 10 }, (_, i) => 76 + i * 3);
  for (let i = 9; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [heights[i], heights[j]] = [heights[j], heights[i]]; }
  return heights.map((h, i) => {
    const a = 2 * Math.PI * i / 10 + Math.PI / 20;
    return { x: Math.round(Math.cos(a) * 42), z: Math.round(Math.sin(a) * 42), r: 2 + ((h - 76) / 3 >> 2), h };
  });
}

/** Island shape at x,z: { top, bottom, biome } (top < bottom means void). */
export function endShape(n, x, z) {
  const d = Math.hypot(x, z);
  if (d < 160) {
    const R = 92 + n.fbm2(x / 70 + 3.3, z / 70 - 1.7, 2) * 16;
    if (d >= R) return { top: -1, bottom: 0, biome: Biome.TheEnd };
    const k = d / R;
    const top = Math.round(60 + n.noise2(x / 34, z / 34) * 1.6 - k ** 4 * 5);
    const bottom = Math.round(top - 6 - 46 * (1 - k * k) ** 1.4 + n.noise2(x / 12 + 9, z / 12) * 3);
    return { top, bottom, biome: Biome.TheEnd };
  }
  if (d < 900) return { top: -1, bottom: 0, biome: Biome.SmallEndIslands };
  const w = smoothstep(900, 1080, d);
  const v = n.fbm2(x / 190 + 40.1, z / 190 - 12.7, 3) + n.noise2(x / 46, z / 46) * 0.12;
  const thick = (v - 0.12) * 120 * w;
  if (thick <= 1) return { top: -1, bottom: 0, biome: thick > -6 ? Biome.SmallEndIslands : Biome.EndMidlands };
  const top = Math.round(56 + n.fbm2(x / 80, z / 80, 2) * 9 + thick * 0.22);
  return { top, bottom: Math.round(top - thick), biome: thick > 16 ? Biome.EndHighlands : Biome.EndMidlands };
}

export function generateEnd(cx, cz, seed) {
  const n = noiseFor(seed);
  const ox = cx * CS, oz = cz * CS;
  const vox = new Uint16Array(HEIGHT * CS2);    // all air: the void
  const sHeight = new Int32Array(CS2), sTop = new Uint16Array(CS2), sBiome = new Uint8Array(CS2);
  const sTemp = new Uint8Array(CS2).fill(128), sHumid = new Uint8Array(CS2).fill(128);
  const pillars = Math.hypot(ox + 16, oz + 16) < 120 ? endPillars(seed) : [];
  for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const wx = ox + x, wz = oz + z, k = x + z * CS;
    const s = endShape(n, wx, wz);
    for (let y = s.bottom; y <= s.top; y++) vox[colIdx(x, y, z)] = B.EndStone;
    sHeight[k] = s.top >= s.bottom ? s.top : -9999;
    sTop[k] = s.top >= s.bottom ? B.EndStone : B.Air;
    sBiome[k] = s.biome;
    for (const p of pillars) {
      const d2 = (wx - p.x) ** 2 + (wz - p.z) ** 2;
      if (d2 > p.r * p.r + p.r) continue;
      for (let y = 30; y < p.h; y++) vox[colIdx(x, y, z)] = B.Obsidian;
      if (wx === p.x && wz === p.z) vox[colIdx(x, p.h, z)] = B.Bedrock;
      sHeight[k] = p.h - 1; sTop[k] = B.Obsidian;
    }
  }
  // exit portal fountain at the centre of the main island
  if (ox <= 3 && ox + CS > -4 && oz <= 3 && oz + CS > -4) {
    const top = endShape(n, 0, 0).top;
    const set = (x, y, z, b) => { if (x >= ox && z >= oz && x < ox + CS && z < oz + CS) vox[colIdx(x - ox, y, z - oz)] = b; };
    for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x, z);
      if (d > 3.6) continue;
      set(x, top - 1, z, B.Bedrock);
      if (d > 2.6) set(x, top, z, B.Bedrock);
      else if (x !== 0 || z !== 0) set(x, top, z, B.EndPortal);
      for (let y = top + 1; y < top + 5; y++) if (x !== 0 || z !== 0) set(x, y, z, B.Air);
    }
    for (let y = top; y < top + 4; y++) set(0, y, 0, B.Bedrock);
  }
  // the gateway to the outer islands (and its return gateway out there)
  gateway(vox, ox, oz, END_GATEWAY[0], END_GATEWAY[1], END_GATEWAY[2]);
  const [lx, lz] = OUTER_LANDING;
  if (Math.abs(ox + 16 - lx) < 64 && Math.abs(oz + 16 - lz) < 64) {
    const g = outerGateway(seed);
    gateway(vox, ox, oz, g[0], g[1], g[2]);
  }
  endCity(vox, ox, oz, seed, n);
  return { voxels: vox, surface: { height: sHeight, top: sTop, biome: sBiome, temp: sTemp, humid: sHumid } };
}

/** Where the return gateway on the outer islands sits. */
export function outerGateway(seed) {
  const s = endShape(noiseFor(seed), OUTER_LANDING[0], OUTER_LANDING[1]);
  return [OUTER_LANDING[0], Math.max(s.top, 50) + 10, OUTER_LANDING[1]];
}

function gateway(vox, ox, oz, gx, gy, gz) {
  const set = (x, y, z, b) => { if (x >= ox && z >= oz && x < ox + CS && z < oz + CS) vox[colIdx(x - ox, y, z - oz)] = b; };
  set(gx, gy, gz, B.EndGateway);
  set(gx, gy - 1, gz, B.Bedrock); set(gx, gy + 1, gz, B.Bedrock);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { set(gx + dx, gy - 2, gz + dz, B.Bedrock); set(gx + dx, gy + 2, gz + dz, B.Bedrock); }
}

/** A purpur tower at the centre of some columns on the outer islands. */
function endCity(vox, ox, oz, seed, n) {
  const cx = ox + 16, cz = oz + 16;
  if (Math.hypot(cx, cz) < 1150) return;
  const h = hash4(ox >> 5, oz >> 5, seed, 0xC17);
  if ((h & 255) > 12) return;
  const base = endShape(n, cx, cz);
  if (base.top < base.bottom || base.top - base.bottom < 10) return;
  const levels = 3 + ((h >>> 8) % 3), y0 = base.top + 1;
  const set = (x, y, z, b) => { vox[colIdx(x - ox, y, z - oz)] = b; };
  for (let lv = 0; lv < levels; lv++) {
    const r = lv === levels - 1 ? 3 : 4 - (lv & 1), yb = y0 + lv * 6;
    for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
      const wall = Math.abs(x - cx) === r || Math.abs(z - cz) === r;
      const corner = Math.abs(x - cx) === r && Math.abs(z - cz) === r;
      for (let k = 0; k < 6; k++) {
        let b = B.Air;
        if (k === 0) b = B.Purpur;
        else if (wall) b = corner ? B.EndStoneBricks : (k === 2 || k === 3) && (x === cx || z === cz) ? B.Air : B.Purpur;
        set(x, yb + k, z, b);
      }
    }
  }
  // roof with an overhang
  const yr = y0 + levels * 6;
  for (let z = cz - 5; z <= cz + 5; z++) for (let x = cx - 5; x <= cx + 5; x++) {
    const rim = Math.abs(x - cx) === 5 || Math.abs(z - cz) === 5;
    set(x, yr, z, rim ? B.Purpur : B.EndStoneBricks);
    if (rim && ((x + z) & 1) === 0) set(x, yr + 1, z, B.Purpur);
  }
  // a lit core so the tower reads at night-like End light
  set(cx, y0 + 1, cz, B.Shroomlight);
}
