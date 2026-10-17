// Tile ids, solidity and the grid container used by every zone.
export const T = {
  AIR: 0,
  GROUND: 1, ROCK: 2, RUIN: 3, WOOD: 4, CORAL: 5, BONE: 6, DIVINE: 7, OBSID: 8,
  CRACKED: 20,   // breaks to a heavy blow (Stage 2+)
  SEAL: 21,      // ancient seal: breaks to Leviathan-class power
  TIDEGATE: 22,  // divine gate: opened by Mythic tide power
  BARRIER: 23,   // boss arena door (dynamic)
  LOCKED: 24,    // key door; opens when flag set
  PLATFORM: 30,  // one-way shelf
  SPIKE: 40,     // hazard (not solid)
  CREVICE: 50,   // visual-only marker; air. (passages are authored 1-tile-wide)
};
export const isSolid = (t) => (t >= 1 && t <= 8) || (t >= 20 && t <= 24);
export const isOneWay = (t) => t === T.PLATFORM;
export const isBreakable = (t) => t === T.CRACKED || t === T.SEAL || t === T.TIDEGATE;
export const TS = 16;

export class Grid {
  constructor(w, h, fill = T.ROCK) { this.w = w; this.h = h; this.t = new Uint8Array(w * h).fill(fill); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.t[y * this.w + x] : T.ROCK; }
  set(x, y, v) { if (this.in(x, y)) this.t[y * this.w + x] = v; }
  solid(x, y) { return isSolid(this.get(x, y)); }
  // is the pixel position inside a solid tile?
  solidPx(px, py) { return isSolid(this.get(Math.floor(px / TS), Math.floor(py / TS))); }
}
