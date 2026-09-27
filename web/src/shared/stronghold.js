// Strongholds: three buried stone-brick portal rooms on a ring 450..800 blocks from the origin, each with twelve end
// portal frames around a lava pit (a few frames already hold an eye) and four long corridors. Eyes of ender fly
// toward the nearest one. Pieces are world-space boxes, so every column carves its own share.
import { CS, colIdx } from './const.js';
import { B } from './blocks.js';
import { hash4, mulberry32 } from './noise.js';

export const CORRIDOR = 56;

export function strongholds(seed) {
  const rng = mulberry32(hash4(seed, 0x57A0, 3) | 1);
  const a0 = rng() * Math.PI * 2;
  return [0, 1, 2].map((i) => {
    const a = a0 + i * Math.PI * 2 / 3, d = 450 + rng() * 350;
    const x = Math.floor(Math.cos(a) * d), z = Math.floor(Math.sin(a) * d);
    return { x, y: -24 + Math.floor(rng() * 30), z };
  });
}

/** The ring of twelve frame cells around a portal centre (x, z), in order. */
export function frameRing(cx, cz) {
  const out = [];
  for (let i = -1; i <= 1; i++) out.push([cx + i, cz - 2], [cx + i, cz + 2], [cx - 2, cz + i], [cx + 2, cz + i]);
  return out;
}

export function applyStrongholds(vox, ox, oz, seed) {
  for (const s of strongholds(seed)) {
    if (s.x + CORRIDOR + 3 < ox || s.x - CORRIDOR - 3 >= ox + CS || s.z + CORRIDOR + 3 < oz || s.z - CORRIDOR - 3 >= oz + CS) continue;
    build(vox, ox, oz, s, seed);
  }
}

function build(vox, ox, oz, s, seed) {
  const inside = (x, z) => x >= ox && z >= oz && x < ox + CS && z < oz + CS;
  const brick = (x, y, z) => {
    const h = hash4(x, y, z, seed ^ 0xB71C) & 15;
    return h < 3 ? B.MossyStoneBricks : h < 5 ? B.CrackedStoneBricks : B.StoneBricks;
  };
  const set = (x, y, z, b) => { if (inside(x, z)) vox[colIdx(x - ox, y, z - oz)] = b; };
  const y0 = s.y;
  // corridors: 3 wide, 3 high, lined with bricks, out along the four axes
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let t = 7; t <= CORRIDOR; t++) for (let a = -2; a <= 2; a++) for (let k = 0; k <= 4; k++) {
      const x = s.x + dx * t + dz * a, z = s.z + dz * t + dx * a;
      if (!inside(x, z)) continue;
      const shell = Math.abs(a) === 2 || k === 0 || k === 4;
      set(x, y0 + k, z, shell ? brick(x, y0 + k, z) : B.Air);
      if (!shell && k === 1 && Math.abs(a) === 1 && t % 12 === 6 && a === 1) set(x, y0 + k, z, B.Torch);
    }
  }
  // the room: 15 x 15, 10 high
  for (let z = s.z - 7; z <= s.z + 7; z++) for (let x = s.x - 7; x <= s.x + 7; x++) {
    if (!inside(x, z)) continue;
    const wall = Math.abs(x - s.x) === 7 || Math.abs(z - s.z) === 7;
    const door = wall && (x === s.x || z === s.z || Math.abs(x - s.x) === 1 && Math.abs(z - s.z) === 7 || Math.abs(z - s.z) === 1 && Math.abs(x - s.x) === 7);
    for (let k = 0; k <= 9; k++) {
      let b = B.Air;
      if (k === 0 || k === 9) b = brick(x, y0 + k, z);
      else if (wall) b = door && k >= 1 && k <= 3 ? B.Air : brick(x, y0 + k, z);
      set(x, y0 + k, z, b);
    }
    // raised dais with the frame ring on top, a lava pit beneath the portal
    const dx = x - s.x, dz = z - s.z, ad = Math.max(Math.abs(dx), Math.abs(dz));
    if (ad <= 3) {
      set(x, y0 + 1, z, brick(x, y0 + 1, z));
      set(x, y0 + 2, z, ad <= 1 ? B.Lava : brick(x, y0 + 2, z));
    }
    if (Math.abs(dx) === 5 && Math.abs(dz) === 5) set(x, y0 + 1, z, B.Torch);
  }
  for (const [fx, fz] of frameRing(s.x, s.z)) {
    const eye = (hash4(fx, fz, seed, 0xE7E) & 15) < 2;   // about one in eight frames already holds an eye
    set(fx, y0 + 3, fz, eye ? B.EndPortalFrameEye : B.EndPortalFrame);
  }
  for (let z = s.z - 1; z <= s.z + 1; z++) for (let x = s.x - 1; x <= s.x + 1; x++) set(x, y0 + 3, z, B.Air);
}
