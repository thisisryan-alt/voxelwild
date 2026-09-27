// Shaped blocks: stairs, slabs, walls, fences, gates, doors, trapdoors, panes, carpets, plates, buttons, ladders, rails,
// snow layers, paths, two-block plants, lily pads and wall torches. Each family is a run of block ids, one per state
// (facing, half, open ...); its geometry is a list of boxes in block units, used by the mesher, collision and picking.
// Boxes are [x0, y0, z0, x1, y1, z1]; fence and wall collision reaches 1.5 blocks up, like Minecraft's.

export const K = { Slab: 1, Stairs: 2, Fence: 3, Gate: 4, Wall: 5, Pane: 6, Door: 7, Trapdoor: 8, Carpet: 9, Plate: 10, Button: 11,
  Ladder: 12, Rail: 13, Lily: 14, Snow: 15, Path: 16, Tall: 17, WallTorch: 18, Wire: 19, RTorch: 20, Lever: 21, Repeater: 22, Piston: 23,
  Head: 24, Bed: 25, Crop: 26, Comparator: 27, Observer: 28, Dispenser: 29, Hopper: 30, Waystone: 31, Grave: 32, SkyPortal: 33, EnchTable: 34, Anvil: 35 };
export const KIND_NAMES = { slab: K.Slab, stairs: K.Stairs, fence: K.Fence, gate: K.Gate, wall: K.Wall, pane: K.Pane, door: K.Door,
  trapdoor: K.Trapdoor, carpet: K.Carpet, plate: K.Plate, button: K.Button, ladder: K.Ladder, rail: K.Rail, lily: K.Lily, snow: K.Snow,
  path: K.Path, tall: K.Tall, walltorch: K.WallTorch, wire: K.Wire, rtorch: K.RTorch, lever: K.Lever, repeater: K.Repeater, piston: K.Piston,
  head: K.Head, bed: K.Bed, crop: K.Crop, comparator: K.Comparator, observer: K.Observer, dispenser: K.Dispenser, hopper: K.Hopper, waystone: K.Waystone, grave: K.Grave, skyportal: K.SkyPortal, enchtable: K.EnchTable, anvil: K.Anvil };
export const STATES = { [K.Slab]: 3, [K.Stairs]: 8, [K.Fence]: 1, [K.Gate]: 8, [K.Wall]: 1, [K.Pane]: 1, [K.Door]: 16, [K.Trapdoor]: 16,
  [K.Carpet]: 1, [K.Plate]: 2, [K.Button]: 12, [K.Ladder]: 4, [K.Rail]: 2, [K.Lily]: 1, [K.Snow]: 8, [K.Path]: 1, [K.Tall]: 2, [K.WallTorch]: 4,
  [K.Wire]: 16, [K.RTorch]: 10, [K.Lever]: 12, [K.Repeater]: 32, [K.Piston]: 12, [K.Head]: 12, [K.Bed]: 8, [K.Crop]: 8,
  [K.Comparator]: 16, [K.Observer]: 12, [K.Dispenser]: 12, [K.Hopper]: 5, [K.Waystone]: 2, [K.Grave]: 4, [K.SkyPortal]: 2, [K.EnchTable]: 1, [K.Anvil]: 4 };
/** Kinds the player collides with (the rest can be walked through). */
export const SOLID_KINDS = new Set([K.Slab, K.Stairs, K.Fence, K.Gate, K.Wall, K.Pane, K.Door, K.Trapdoor, K.Carpet, K.Snow, K.Path, K.Repeater,
  K.Piston, K.Head, K.Bed, K.Comparator, K.Observer, K.Dispenser, K.Hopper, K.Waystone, K.Grave, K.EnchTable, K.Anvil]);
/** Kinds that link up with their neighbours. */
export const CONNECTING = new Set([K.Fence, K.Wall, K.Pane, K.Wire, K.Stairs]);
/** Six-way facings (pistons): 0 east, 1 west, 2 south, 3 north, 4 up, 5 down; FACE6[f] = the mesher's face index. */
export const DIR6 = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];
export const FACE6 = [0, 1, 4, 5, 2, 3];
let redstoneBlockId = -1;
export const setRedstoneBlock = (id) => { redstoneBlockId = id; };
/** A box drawn for an upward-facing piston, turned to face f (the shapes are symmetric across their front axis). */
function face6(b, f) {
  const P = (x, y, z) => (f === 4 ? [x, y, z] : f === 5 ? [x, 1 - y, z] : f === 0 ? [y, x, z] : f === 1 ? [1 - y, x, z] : f === 2 ? [x, z, y] : [x, z, 1 - y]);
  const a = P(b[0], b[1], b[2]), c = P(b[3], b[4], b[5]);
  return [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2]), Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2]), ...b.slice(6)];
}
/** A floor-mounted box moved onto a wall (attach 0..3, the wall's side), the ceiling (5) or kept on the floor (4). */
function attach(b, a) {
  if (a === 4) return b;
  if (a === 5) return [b[0], 1 - b[4], b[2], b[3], 1 - b[1], b[5], ...b.slice(6)];
  return turn([b[0], b[2], b[1], b[3], b[5], b[4], ...b.slice(6)], a);
}

// facings: 0 east (+X), 1 west (-X), 2 south (+Z), 3 north (-Z). Shapes are written facing north and turned.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const q = (v) => v / 16;
function turn(b, f) {
  if (f === 3) return b;
  const P = (x, z) => (f === 2 ? [1 - x, 1 - z] : f === 0 ? [1 - z, x] : [z, 1 - x]);
  const [ax, az] = P(b[0], b[2]), [bx, bz] = P(b[3], b[5]);
  return [Math.min(ax, bx), b[1], Math.min(az, bz), Math.max(ax, bx), b[4], Math.max(az, bz), ...b.slice(6)];
}
const cut = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3]), Math.min(a[4], b[4]), Math.min(a[5], b[5])];
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
      const half = (g) => turn(top ? [0, 0, 0, 1, 0.5, 0.5] : [0, 0.5, 0, 1, 1, 0.5], g);
      const slab = top ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
      if (!conn) return [slab, half(f)];
      const nf = conn & 3, type = conn >> 2;
      // outer corner: only the quarter both steps share; inner corner: the step plus the quarter that turns the corner
      return type === 1 ? [slab, cut(half(f), half(nf))] : [slab, half(f), cut(half(nf), half(f ^ 1))];
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
    case K.Plate: return collision ? [] : [box16(1, 0, 1, 15, s ? 0.5 : 1, 15)];
    case K.Button: {
      if (collision) return [];
      return [attach(box16(5, 0, 6, 11, s >= 6 ? 1 : 2, 10), s % 6)];     // attach 0..3: on the wall at that side
    }
    case K.Wire: {
      if (collision) return [];
      const b = [];
      const one = (conn & (conn - 1)) === 0 && conn !== 0;
      const c = one ? conn | (conn & 3 ? conn ^ 3 : conn ^ 12) : conn;     // a single link runs straight through
      if (c & 12) { if (c & 8) b.push([0, 0, 0, 1, 0.012, 0.5, 1]); if (c & 4) b.push([0, 0, 0.5, 1, 0.012, 1, 1]); }
      if (c & 3) { if (c & 1) b.push([0.5, 0, 0, 1, 0.018, 1, 2]); if (c & 2) b.push([0, 0, 0, 0.5, 0.018, 1, 2]); }
      if (!c || ((c & 12) && (c & 3))) b.push([0, 0, 0, 1, 0.024, 1, 0]);
      return b;
    }
    case K.RTorch: return collision || s < 2 ? [] : [turn(box16(7, 3, 0, 9, 13, 2.2), (s - 2) >> 1)];
    case K.Lever: {
      if (collision) return [];
      const a = s % 6, on = s >= 6;
      return [attach([...box16(5, 0, 4, 11, 3, 12), 1], a), attach([...box16(7, 3, on ? 4 : 10, 9, 10, on ? 6 : 12), 0], a), attach([...box16(7, 2, 7, 9, 4, 9), 0], a)];
    }
    case K.Repeater: {
      const f = s & 3, delay = (s >> 2) & 3;
      if (collision) return [box16(0, 0, 0, 16, 2, 16)];
      return [box16(0, 0, 0, 16, 2, 16), turn([...box16(7, 2, 2, 9, 7, 4), 1], f), turn([...box16(7, 2, 6 + delay * 2, 9, 7, 8 + delay * 2), 1], f)];
    }
    case K.Piston: {
      const f = s % 6, ext = s >= 6;
      return [face6(ext ? box16(0, 0, 0, 16, 12, 16) : FULL, f)];
    }
    case K.Head: {
      const f = s % 6;
      return [face6(box16(0, 12, 0, 16, 16, 16), f), face6(box16(6, 0, 6, 10, 12, 10), f)];
    }
    case K.Bed: return [box16(0, 0, 0, 16, 9, 16)];
    case K.Comparator: {
      const f = s & 3;
      if (collision) return [box16(0, 0, 0, 16, 2, 16)];
      return [box16(0, 0, 0, 16, 2, 16), turn([...box16(4, 2, 11, 6, 7, 13), 1], f), turn([...box16(10, 2, 11, 12, 7, 13), 1], f), turn([...box16(7, 2, 2, 9, 6, 4), 2], f)];
    }
    case K.Observer: case K.Dispenser: return [FULL];
    case K.Waystone: return s === 0 ? [box16(1, 0, 1, 15, 3, 15), box16(3, 3, 3, 13, 16, 13)] : [box16(3, 0, 3, 13, 12, 13), box16(4, 12, 4, 12, 15, 12)];
    case K.EnchTable: return [box16(0, 0, 0, 16, 12, 16)];
    case K.Anvil: return [box16(2, 0, 2, 14, 4, 14), turn(box16(4, 4, 3, 12, 5, 13), s), turn(box16(6, 5, 4, 10, 10, 12), s), turn(box16(3, 10, 0, 13, 16, 16), s)];
    case K.SkyPortal: return collision ? [] : [s === 0 ? [0, 0, 0.375, 1, 1, 0.625] : [0.375, 0, 0, 0.625, 1, 1]];
    case K.Grave: return [box16(1, 0, 2, 15, 2, 14), turn(box16(3, 2, 6, 13, 14, 9), s)];
    case K.Hopper: {
      const out = [box16(0, 10, 0, 16, 16, 16), box16(4, 4, 4, 12, 10, 12)];
      if (collision) return [box16(0, 10, 0, 16, 16, 16), box16(4, 0, 4, 12, 10, 12)];
      out.push(s === 0 ? box16(6, 0, 6, 10, 4, 10) : turn(box16(6, 4, 0, 10, 8, 4), s - 1));
      return out;
    }
    case K.Crop: return [];
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

/** Which way a connecting block's neighbour links: mask bit f set when the neighbour on side f joins it.
 *  Stairs return their corner instead: 0 straight, (1 << 2 | facing) outer, (2 << 2 | facing) inner (facing of the other step). */
export function connections(kind, nb /* (dx, dz, dy) => { id, model, opaque } */, self) {
  let m = 0;
  if (kind === K.Stairs) {
    const f = self.state >> 1, top = self.state & 1;
    const stair = (d) => { const n = nb(DIRS[d][0], DIRS[d][1], 0); return n && n.model && n.model.kind === K.Stairs && (n.model.state & 1) === top ? n.model.state >> 1 : -1; };
    const back = stair(f);
    if (back >= 0 && (back >> 1) !== (f >> 1)) return (1 << 2) | back;
    const front = stair(f ^ 1);
    if (front >= 0 && (front >> 1) !== (f >> 1)) return (2 << 2) | front;
    return 0;
  }
  if (kind === K.Wire) {
    const above = nb(0, 0, 1), roof = above && above.opaque;
    for (let f = 0; f < 4; f++) {
      const n = nb(DIRS[f][0], DIRS[f][1], 0);
      if (!n) continue;
      if (wireLinks(n, f)) { m |= 1 << f; continue; }
      // dust running up or down a block edge
      if (!n.opaque) { const d = nb(DIRS[f][0], DIRS[f][1], -1); if (d && d.model && d.model.kind === K.Wire) { m |= 1 << f; continue; } }
      if (!roof && n.opaque) { const u = nb(DIRS[f][0], DIRS[f][1], 1); if (u && u.model && u.model.kind === K.Wire) m |= 1 << f; }
    }
    return m;
  }
  for (let f = 0; f < 4; f++) {
    const n = nb(DIRS[f][0], DIRS[f][1], 0);
    if (!n) continue;
    if (n.opaque) { m |= 1 << f; continue; }
    const k = n.model ? n.model.kind : 0;
    if (kind === K.Fence ? k === K.Fence || (k === K.Gate && ((n.model.state >> 1) >> 1) !== (f >> 1)) :
      kind === K.Wall ? k === K.Wall || k === K.Pane || k === K.Gate :
      k === K.Pane || k === K.Wall) m |= 1 << f;
  }
  return m;
}

/** Does redstone dust link up with neighbour n on its side f? */
export function wireLinks(n, f) {
  if (n.id === redstoneBlockId) return true;
  const m = n.model;
  if (!m) return false;
  switch (m.kind) {
    case K.Wire: case K.RTorch: case K.Lever: case K.Button: case K.Plate: return true;
    case K.Repeater: case K.Comparator: return ((m.state & 3) >> 1) === (f >> 1);
    case K.Observer: return true;
    default: return false;
  }
}
