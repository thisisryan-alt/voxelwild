// Shaped blocks: stairs, slabs, walls, fences, gates, doors, trapdoors, panes, carpets, plates, buttons, ladders, rails,
// snow layers, paths, two-block plants, lily pads and wall torches. Each family is a run of block ids, one per state
// (facing, half, open ...); its geometry is a list of boxes in block units, used by the mesher, collision and picking.
// Boxes are [x0, y0, z0, x1, y1, z1]; fence and wall collision reaches 1.5 blocks up, like Minecraft's.

export const K = { Slab: 1, Stairs: 2, Fence: 3, Gate: 4, Wall: 5, Pane: 6, Door: 7, Trapdoor: 8, Carpet: 9, Plate: 10, Button: 11,
  Ladder: 12, Rail: 13, Lily: 14, Snow: 15, Path: 16, Tall: 17, WallTorch: 18 };
export const KIND_NAMES = { slab: K.Slab, stairs: K.Stairs, fence: K.Fence, gate: K.Gate, wall: K.Wall, pane: K.Pane, door: K.Door,
  trapdoor: K.Trapdoor, carpet: K.Carpet, plate: K.Plate, button: K.Button, ladder: K.Ladder, rail: K.Rail, lily: K.Lily, snow: K.Snow,
  path: K.Path, tall: K.Tall, walltorch: K.WallTorch };
export const STATES = { [K.Slab]: 3, [K.Stairs]: 8, [K.Fence]: 1, [K.Gate]: 8, [K.Wall]: 1, [K.Pane]: 1, [K.Door]: 16, [K.Trapdoor]: 16,
  [K.Carpet]: 1, [K.Plate]: 1, [K.Button]: 6, [K.Ladder]: 4, [K.Rail]: 2, [K.Lily]: 1, [K.Snow]: 8, [K.Path]: 1, [K.Tall]: 2, [K.WallTorch]: 4 };
/** Kinds the player collides with (the rest can be walked through). */
export const SOLID_KINDS = new Set([K.Slab, K.Stairs, K.Fence, K.Gate, K.Wall, K.Pane, K.Door, K.Trapdoor, K.Carpet, K.Snow, K.Path]);
/** Kinds that link up with their neighbours. */
export const CONNECTING = new Set([K.Fence, K.Wall, K.Pane]);

// facings: 0 east (+X), 1 west (-X), 2 south (+Z), 3 north (-Z). Shapes are written facing north and turned.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const q = (v) => v / 16;
function turn(b, f) {
  if (f === 3) return b;
  const P = (x, z) => (f === 2 ? [1 - x, 1 - z] : f === 0 ? [1 - z, x] : [z, 1 - x]);
  const [ax, az] = P(b[0], b[2]), [bx, bz] = P(b[3], b[5]);
  return [Math.min(ax, bx), b[1], Math.min(az, bz), Math.max(ax, bx), b[4], Math.max(az, bz)];
}
const box16 = (a, b, c, d, e, f) => [q(a), q(b), q(c), q(d), q(e), q(f)];
const FULL = [0, 0, 0, 1, 1, 1];

/** The facing (0..3) a player looks toward, from yaw (0 looks toward -Z). */
export function facingFromYaw(yaw) {
  const x = -Math.sin(yaw), z = -Math.cos(yaw);
  return Math.abs(x) > Math.abs(z) ? (x > 0 ? 0 : 1) : (z > 0 ? 2 : 3);
}
/** The facing of a horizontal hit face (raycast faces: 0 +X 1 -X 4 +Z 5 -Z), or -1. */
export const facingFromFace = (face) => (face === 0 ? 0 : face === 1 ? 1 : face === 4 ? 2 : face === 5 ? 3 : -1);
export const opposite = (f) => f ^ 1;

/**
 * Boxes of a shaped block. m: { kind, state }; conn: 4-bit mask of connected sides (east, west, south, north) for
 * connecting kinds; up: something above (walls keep their post). collision: the boxes you bump into (none for
 * see-through kinds; fence and wall posts 1.5 high).
 */
export function modelBoxes(m, conn = 0, up = false, collision = false) {
  const s = m.state;
  switch (m.kind) {
    case K.Slab: return [s === 0 ? [0, 0, 0, 1, 0.5, 1] : s === 1 ? [0, 0.5, 0, 1, 1, 1] : FULL];
    case K.Stairs: {
      const f = s >> 1, top = s & 1;
      return top ? [[0, 0.5, 0, 1, 1, 1], turn([0, 0, 0, 1, 0.5, 0.5], f)] : [[0, 0, 0, 1, 0.5, 1], turn([0, 0.5, 0, 1, 1, 0.5], f)];
    }
    case K.Fence: {
      const h = collision ? 1.5 : 1;
      const out = [collision ? box16(6, 0, 6, 10, 24, 10) : box16(6, 0, 6, 10, 16, 10)];
      for (let f = 0; f < 4; f++) {
        if (!(conn & (1 << f))) continue;
        if (collision) out.push(turn([q(6), 0, 0, q(10), h, q(6)], f));
        else { out.push(turn(box16(7, 12, 0, 9, 15, 6), f)); out.push(turn(box16(7, 6, 0, 9, 9, 6), f)); }
      }
      return out;
    }
    case K.Gate: {
      const f = s >> 1, open = s & 1;
      if (collision) return open ? [] : [turn([0, 0, q(7), 1, 1.5, q(9)], f)];
      const out = [turn(box16(0, 5, 7, 2, 16, 9), f), turn(box16(14, 5, 7, 16, 16, 9), f)];
      if (!open) out.push(turn(box16(2, 6, 7, 14, 9, 9), f), turn(box16(2, 12, 7, 14, 15, 9), f), turn(box16(6, 9, 7, 10, 12, 9), f));
      else out.push(turn(box16(0, 6, 1, 2, 9, 7), f), turn(box16(0, 12, 1, 2, 15, 7), f), turn(box16(14, 6, 1, 16, 9, 7), f), turn(box16(14, 12, 1, 16, 15, 7), f));
      return out;
    }
    case K.Wall: {
      const h = collision ? 1.5 : q(14);
      const ns = (conn & 12) === 12 && !(conn & 3), ew = (conn & 3) === 3 && !(conn & 12);
      if ((ns || ew) && !up) return [ns ? [q(5), 0, 0, q(11), h, 1] : [0, 0, q(5), 1, h, q(11)]];
      const out = [collision ? [q(4), 0, q(4), q(12), 1.5, q(12)] : box16(4, 0, 4, 12, 16, 12)];
      for (let f = 0; f < 4; f++) if (conn & (1 << f)) out.push(turn([q(5), 0, 0, q(11), h, q(4)], f));
      return out;
    }
    case K.Pane: {
      const out = [box16(7, 0, 7, 9, 16, 9)];
      for (let f = 0; f < 4; f++) if (conn & (1 << f)) out.push(turn(box16(7, 0, 0, 9, 16, 7), f));
      return out;
    }
    case K.Door: {
      const f = s >> 2, open = (s >> 1) & 1;
      return [turn(open ? box16(13, 0, 0, 16, 16, 16) : box16(0, 0, 13, 16, 16, 16), f)];
    }
    case K.Trapdoor: {
      const f = s >> 2, open = (s >> 1) & 1, top = s & 1;
      return [open ? turn(box16(0, 0, 13, 16, 16, 16), f) : top ? box16(0, 13, 0, 16, 16, 16) : box16(0, 0, 0, 16, 3, 16)];
    }
    case K.Carpet: return [box16(0, 0, 0, 16, 1, 16)];
    case K.Plate: return collision ? [] : [box16(1, 0, 1, 15, 1, 15)];
    case K.Button: {
      if (collision) return [];
      if (s === 4) return [box16(5, 0, 6, 11, 2, 10)];
      if (s === 5) return [box16(5, 14, 6, 11, 16, 10)];
      return [turn(box16(5, 6, 0, 11, 10, 2), s)];     // on the wall at the facing side
    }
    case K.Ladder: return collision ? [] : [turn(box16(0, 0, 0, 16, 16, 0.8), s)];
    case K.Rail: return collision ? [] : [box16(0, 0, 0, 16, 1, 16)];
    case K.Lily: return collision ? [] : [box16(0, 0, 0, 16, 0.25, 16)];
    case K.Snow: return [[0, 0, 0, 1, (s + 1) / 8, 1]];
    case K.Path: return [box16(0, 0, 0, 16, 15, 16)];
    case K.Tall: return [];
    case K.WallTorch: return collision ? [] : [turn(box16(7, 3, 0, 9, 13, 2.2), s)];
  }
  return [FULL];
}

/** Which way a connecting block's neighbour links: mask bit f set when the neighbour on side f joins it. */
export function connections(kind, nb /* (dx, dz) => { id, model, opaque } */) {
  let m = 0;
  for (let f = 0; f < 4; f++) {
    const n = nb(DIRS[f][0], DIRS[f][1]);
    if (!n) continue;
    if (n.opaque) { m |= 1 << f; continue; }
    const k = n.model ? n.model.kind : 0;
    if (kind === K.Fence ? k === K.Fence || (k === K.Gate && ((n.model.state >> 1) >> 1) !== (f >> 1)) :
      kind === K.Wall ? k === K.Wall || k === K.Pane || k === K.Gate :
      k === K.Pane || k === K.Wall) m |= 1 << f;
  }
  return m;
}
