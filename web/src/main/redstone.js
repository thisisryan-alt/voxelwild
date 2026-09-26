// Redstone: dust with power levels 0..15, torches (inverters), levers, buttons, pressure plates, repeaters, lamps,
// redstone blocks, pistons and sticky pistons, TNT, and doors / trapdoors / gates that open when powered.
//
// Runs at Minecraft's redstone rate (10 ticks a second) over the components the player has placed (kept per dimension
// in meta.redstone). Each tick: dust levels are flooded from the sources, then torches, repeaters, lamps and
// mechanisms react. Torches and repeaters read the previous tick's state, which gives them their one-tick delay (and
// makes torch clocks work).
import { BLOCKS, B, C, F, FAM, famOf, isLiquid } from '../shared/blocks.js';
import { K, DIR6, connections } from '../shared/shapes.js';

const H4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];       // horizontal sides 0 east, 1 west, 2 south, 3 north
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const TICK = 0.1;
const key = (x, y, z) => `${x},${y},${z}`;

/** Is this block part of a circuit (so the simulation keeps track of it)? */
export function isRedstone(id) {
  if (id <= 0 || !BLOCKS[id]) return false;
  if (id === C.redstone_block || id === C.redstone_lamp || id === C.lit_redstone_lamp || id === C.tnt || id === C.note_block) return true;
  const m = BLOCKS[id].model;
  return !!m && [K.Wire, K.RTorch, K.Lever, K.Button, K.Plate, K.Repeater, K.Piston, K.Door, K.Trapdoor, K.Gate].includes(m.kind);
}

export class Redstone {
  constructor(game) {
    this.g = game;
    this.acc = 0;
    this.tickNo = 0;
    this.pending = [];        // { at, x, y, z, id } scheduled block changes (repeaters, button release)
    this.last = new Map();    // mechanism key -> powered last tick (doors, pistons and TNT react to changes)
    this.tnt = [];            // primed TNT: { x, y, z, t }
    this.tntId = C.tnt;
  }

  get list() {
    const m = this.g.meta, d = this.g.dim || 0;
    m.redstone = m.redstone || {};
    return (m.redstone[d] = m.redstone[d] || []);
  }
  track(x, y, z) {
    const id = this.g.world.getBlock(x, y, z);
    if (!isRedstone(id)) return;
    const k = key(x, y, z), l = this.list;
    if (!l.includes(k)) l.push(k);
  }

  update(dt) {
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK && n++ < 4) { this.acc -= TICK; this.tick(); }
    if (this.acc > 1) this.acc = 0;
    // primed TNT
    for (const t of this.tnt) {
      t.t -= dt;
      t.smoke = (t.smoke || 0) - dt;
      if (t.smoke <= 0) { t.smoke = 0.12; this.g.spawnEmbers([t.x + 0.5, t.y + 1.05, t.z + 0.5], 2, [0.8, 0.8, 0.8]); }
    }
    const boom = this.tnt.filter((t) => t.t <= 0);
    if (boom.length) {
      this.tnt = this.tnt.filter((t) => t.t > 0);
      for (const t of boom) {
        if (this.g.world.getBlock(t.x, t.y, t.z) === C.tnt) this.g.world.setBlock(t.x, t.y, t.z, B.Air);
        this.g.mobs.explode(t.x + 0.5, t.y + 0.5, t.z + 0.5, 4, null);
      }
    }
  }

  /** Light a TNT block: it blows up after fuse seconds. */
  prime(x, y, z, fuse = 4) {
    this.g.emit('toast', 'TNT lit!');
    if (this.tnt.some((t) => t.x === x && t.y === y && t.z === z)) return;
    this.tnt.push({ x, y, z, t: fuse });
    this.g.audio.place(C.tnt);
  }

  /** Right-click on a button: pressed for a second (wood: a second and a half). */
  press(x, y, z, id) {
    const f = famOf(id), st = BLOCKS[id].model.state;
    if (st >= 6) return;
    const w = this.g.world;
    w.setBlock(x, y, z, id + 6);
    this.pending.push({ at: this.tickNo + (f.cat === 'wood' ? 15 : 10), x, y, z, from: id + 6, id });
    this.track(x, y, z);
  }

  // ---------------------------------------------------------------- one redstone tick

  tick() {
    this.tickNo++;
    const g = this.g, w = g.world;
    if (!w) return;
    const get = (x, y, z) => w.getBlock(x, y, z);
    // scheduled changes
    const due = this.pending.filter((p) => p.at <= this.tickNo);
    if (due.length) {
      this.pending = this.pending.filter((p) => p.at > this.tickNo);
      for (const p of due) if (get(p.x, p.y, p.z) === p.from) w.setBlock(p.x, p.y, p.z, p.id);
    }
    // the tracked components still in place
    const list = this.list, comps = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const [x, y, z] = list[i].split(',').map(Number);
      const id = get(x, y, z);
      if (id < 0) continue;                                   // not loaded: keep
      if (!isRedstone(id)) { list.splice(i, 1); continue; }
      comps.push([x, y, z, id]);
    }
    if (!comps.length) return;
    const model = (id) => (id > 0 && BLOCKS[id] ? BLOCKS[id].model : null);
    const opaque = (id) => id > 0 && (BLOCKS[id].flags & F.Opaque) !== 0;

    // pressure plates: pressed while something stands on them
    for (const [x, y, z, id] of comps) {
      const m = model(id);
      if (!m || m.kind !== K.Plate) continue;
      const on = this.occupied(x, y, z);
      if (on !== (m.state === 1)) w.setBlock(x, y, z, id + (on ? 1 : -1));
    }

    // ---- sources (from the current block states; torches and repeaters as they were last tick)
    const memoStrong = new Map(), memoWeak = new Map();
    /** Direct power from the non-dust block at (sx, sy, sz) into the cell at (tx, ty, tz) (0 or 15). */
    const emits = (sx, sy, sz, tx, ty, tz) => {
      const id = get(sx, sy, sz);
      if (id <= 0) return 0;
      if (id === C.redstone_block) return 15;
      const m = model(id);
      if (m) {
        switch (m.kind) {
          case K.Lever: case K.Button: return m.state >= 6 ? 15 : 0;
          case K.Plate: return m.state === 1 ? 15 : 0;
          case K.RTorch: {
            const lit = m.state < 2 ? m.state === 0 : ((m.state - 2) & 1) === 0;
            if (!lit) return 0;
            const a = this.torchBase(sx, sy, sz, m);
            return a[0] === tx && a[1] === ty && a[2] === tz ? 0 : 15;
          }
          case K.Repeater: {
            if (m.state < 16) return 0;
            const d = H4[m.state & 3];
            return sx + d[0] === tx && sy === ty && sz + d[1] === tz ? 15 : 0;
          }
          default: return 0;
        }
      }
      return 0;
    };
    /** A solid block powered straight from a lever/button on it, a torch under it, a repeater into it, a plate on it. */
    const strong = (x, y, z) => {
      const k = key(x, y, z);
      if (memoStrong.has(k)) return memoStrong.get(k);
      let p = false;
      if (opaque(get(x, y, z))) {
        for (const [dx, dy, dz] of N6) {
          const nx = x + dx, ny = y + dy, nz = z + dz, id = get(nx, ny, nz), m = model(id);
          if (!m) continue;
          if ((m.kind === K.Lever || m.kind === K.Button) && m.state >= 6) { const a = attachedTo(nx, ny, nz, m.state % 6); if (a[0] === x && a[1] === y && a[2] === z) { p = true; break; } }
          if (m.kind === K.Plate && m.state === 1 && dy === 1) { p = true; break; }
          if (m.kind === K.RTorch && dy === -1 && m.state === 0) { p = true; break; }
          if (m.kind === K.Repeater && m.state >= 16 && emits(nx, ny, nz, x, y, z)) { p = true; break; }
        }
      }
      memoStrong.set(k, p);
      return p;
    };

    // ---- dust: flood from the sources, one level lost per block
    const wires = new Map();
    for (const [x, y, z, id] of comps) { const m = model(id); if (m && m.kind === K.Wire) wires.set(key(x, y, z), [x, y, z, 0]); }
    const level = new Map();
    const queue = [];
    for (const [k, [x, y, z]] of wires) {
      let p = 0;
      for (const [dx, dy, dz] of N6) {
        const nx = x + dx, ny = y + dy, nz = z + dz, id = get(nx, ny, nz);
        if (model(id) && model(id).kind === K.Wire) continue;
        if (emits(nx, ny, nz, x, y, z) || strong(nx, ny, nz)) { p = 15; break; }
      }
      if (p) { level.set(k, p); queue.push(k); }
    }
    const linked = (x, y, z) => {
      // neighbouring dust cells this dust passes power to (flat, up and down a block edge)
      const out = [];
      const above = opaque(get(x, y + 1, z));
      for (const [dx, dz] of H4) {
        const n = get(x + dx, y, z + dz);
        if (model(n) && model(n).kind === K.Wire) out.push(key(x + dx, y, z + dz));
        else if (!opaque(n)) { const d = get(x + dx, y - 1, z + dz); if (model(d) && model(d).kind === K.Wire) out.push(key(x + dx, y - 1, z + dz)); }
        else if (!above) { const u = get(x + dx, y + 1, z + dz); if (model(u) && model(u).kind === K.Wire) out.push(key(x + dx, y + 1, z + dz)); }
      }
      return out;
    };
    while (queue.length) {
      const k = queue.shift(), p = level.get(k), [x, y, z] = wires.get(k);
      if (p <= 1) continue;
      for (const n of linked(x, y, z)) {
        if (!wires.has(n)) continue;
        if ((level.get(n) || 0) < p - 1) { level.set(n, p - 1); queue.push(n); }
      }
    }
    const wireLevel = (x, y, z) => level.get(key(x, y, z)) || 0;
    const wireConn = (x, y, z) => connections(K.Wire, (dx, dz, dy = 0) => {
      const n = get(x + dx, y + dy, z + dz);
      return n < 0 ? null : { id: n, opaque: opaque(n), model: model(n) };
    });
    /** Does the dust at (x, y, z) power the cell on its side f (0..3), or below it (f = -1)? */
    const dustInto = (x, y, z, f) => {
      if (!wireLevel(x, y, z)) return false;
      if (f < 0) return true;
      const c = wireConn(x, y, z);
      return c === 0 || (c & (1 << f)) !== 0 || c === 1 << (f ^ 1);
    };
    /** A solid block powered by anything (dust on it or pointing into it too): it powers mechanisms next to it. */
    const weak = (x, y, z) => {
      const k = key(x, y, z);
      if (memoWeak.has(k)) return memoWeak.get(k);
      let p = false;
      if (opaque(get(x, y, z))) {
        p = strong(x, y, z);
        if (!p) for (let f = 0; f < 4 && !p; f++) { const nx = x - H4[f][0], nz = z - H4[f][1]; if (model(get(nx, y, nz)) && model(get(nx, y, nz)).kind === K.Wire && dustInto(nx, y, nz, f)) p = true; }
        if (!p && model(get(x, y + 1, z)) && model(get(x, y + 1, z)).kind === K.Wire && wireLevel(x, y + 1, z)) p = true;
      }
      memoWeak.set(k, p);
      return p;
    };
    /** Is the mechanism at (x, y, z) powered (from any side but skip)? */
    const powered = (x, y, z, skip = -1) => {
      for (let i = 0; i < 6; i++) {
        if (i === skip) continue;
        const [dx, dy, dz] = N6[i], nx = x + dx, ny = y + dy, nz = z + dz, id = get(nx, ny, nz), m = model(id);
        if (emits(nx, ny, nz, x, y, z)) return true;
        if (m && m.kind === K.Wire) { if (dy === 1 ? wireLevel(nx, ny, nz) : dy === 0 && dustInto(nx, ny, nz, [1, 0, -1, -1, 3, 2][i])) return true; continue; }
        if (weak(nx, ny, nz)) return true;
      }
      return false;
    };

    // ---- apply
    const changes = [];
    for (const [x, y, z, id] of comps) {
      const m = model(id), k = key(x, y, z);
      if (m && m.kind === K.Wire) {
        const lv = wireLevel(x, y, z);
        if (lv !== m.state) changes.push([x, y, z, famOf(id).first + lv]);
      } else if (m && m.kind === K.RTorch) {
        const base = this.torchBase(x, y, z, m);
        const off = weak(base[0], base[1], base[2]);
        const lit = m.state < 2 ? m.state === 0 : ((m.state - 2) & 1) === 0;
        if (off === lit) changes.push([x, y, z, id + (m.state < 2 ? (off ? 1 : -1) : off ? 1 : -1)]);
      } else if (m && m.kind === K.Repeater) {
        const f = m.state & 3, bx = x - H4[f][0], bz = z - H4[f][1];
        const bid = get(bx, y, bz), bm = model(bid);
        const input = emits(bx, y, bz, x, y, z) > 0 || weak(bx, y, bz) || (bm && bm.kind === K.Wire && wireLevel(bx, y, bz) > 0);
        const on = m.state >= 16;
        if (input !== on && !this.pending.some((p) => p.x === x && p.y === y && p.z === z)) {
          const delay = ((m.state >> 2) & 3) + 1;
          this.pending.push({ at: this.tickNo + delay, x, y, z, from: id, id: id + (input ? 16 : -16) });
        }
      } else if (id === C.redstone_lamp || id === C.lit_redstone_lamp) {
        const on = powered(x, y, z);
        if (on !== (id === C.lit_redstone_lamp)) changes.push([x, y, z, on ? C.lit_redstone_lamp : C.redstone_lamp]);
      } else if (id === C.tnt) {
        if (powered(x, y, z)) { this.prime(x, y, z); }
      } else if (m && (m.kind === K.Door || m.kind === K.Trapdoor || m.kind === K.Gate)) {
        let on = powered(x, y, z);
        if (m.kind === K.Door) { const oy = m.state & 1 ? y - 1 : y + 1; on = on || powered(x, oy, z); }
        const was = this.last.get(k);
        this.last.set(k, on);
        if (was === undefined || was === on) continue;
        const bit = m.kind === K.Gate ? 1 : 2, open = (m.state & bit) !== 0;
        if (open !== on) {
          const f = famOf(id);
          changes.push([x, y, z, f.first + (m.state ^ bit)]);
          if (m.kind === K.Door) {
            const oy = m.state & 1 ? y - 1 : y + 1, o = get(x, oy, z);
            if (famOf(o) === f) changes.push([x, oy, z, f.first + (model(o).state ^ 2)]);
          }
        }
      } else if (m && m.kind === K.Piston) {
        const f = m.state % 6, ext = m.state >= 6;
        const on = powered(x, y, z, [0, 1, 4, 5, 2, 3][f]);     // not through its own face
        if (on !== ext) this.movePiston(x, y, z, id, m, on);
      } else if (id === C.note_block) {
        const on = powered(x, y, z), was = this.last.get(k);
        this.last.set(k, on);
        if (on && was === false) this.g.audio.click();
      }
    }
    for (const [x, y, z, id] of changes) w.setBlock(x, y, z, id);
  }

  /** The block a torch stands on or hangs from. */
  torchBase(x, y, z, m) {
    if (m.state < 2) return [x, y - 1, z];
    const d = H4[(m.state - 2) >> 1];
    return [x + d[0], y, z + d[1]];
  }

  occupied(x, y, z) {
    const g = this.g, inside = (p, h) => p[0] > x - h && p[0] < x + 1 + h && p[2] > z - h && p[2] < z + 1 + h && p[1] >= y - 0.01 && p[1] < y + 0.5;
    if (inside(g.player.body.pos, 0.3)) return true;
    for (const m of g.mobs.list) if (!m.dead && inside(m.body.pos, m.def.half || 0.3)) return true;
    for (const e of g.entities) if (e.pos && inside(e.pos, 0.1)) return true;
    return false;
  }

  /** Extend (pushing up to 12 blocks) or retract (pulling one block back for sticky pistons). */
  movePiston(x, y, z, id, m, extend) {
    const w = this.g.world, f = m.state % 6, [dx, dy, dz] = DIR6[f], fam = famOf(id), sticky = fam.key === 'sticky_piston';
    const head = FAM.piston_head;
    const immovable = (b) => b === B.Bedrock || b === B.Obsidian || b === B.EndPortalFrame || b === B.EndPortalFrameEye || b === B.NetherPortalX ||
      b === B.NetherPortalZ || b === B.EndPortal || b === C.chest || b === C.furnace || b === C.lit_furnace || b === C.barrel ||
      (BLOCKS[b].model && (BLOCKS[b].model.kind === K.Head || (BLOCKS[b].model.kind === K.Piston && BLOCKS[b].model.state >= 6)));
    const gone = (b) => b === B.Air || isLiquid(b) || (BLOCKS[b].flags & F.Replaceable) || (BLOCKS[b].model && [K.Wire, K.Crop, K.Tall, K.Lily].includes(BLOCKS[b].model.kind));
    if (extend) {
      const line = [];
      let cx = x + dx, cy = y + dy, cz = z + dz;
      for (;;) {
        const b = w.getBlock(cx, cy, cz);
        if (b < 0) return;
        if (gone(b)) break;
        if (immovable(b) || line.length >= 12) return;
        line.push([cx, cy, cz, b]);
        cx += dx; cy += dy; cz += dz;
      }
      for (let i = line.length - 1; i >= 0; i--) {
        const [bx, by, bz, b] = line[i];
        w.setBlock(bx + dx, by + dy, bz + dz, b);
        this.track(bx + dx, by + dy, bz + dz);
      }
      w.setBlock(x + dx, y + dy, z + dz, head.first + f + (sticky ? 6 : 0));
      w.setBlock(x, y, z, fam.first + f + 6);
      // the player rides along
      const p = this.g.player.body;
      for (const [bx, by, bz] of [[x + dx, y + dy, z + dz], ...line.map((q) => [q[0] + dx, q[1] + dy, q[2] + dz])]) {
        if (p.overlaps(bx, by, bz)) { p.pos[0] += dx; p.pos[1] += dy; p.pos[2] += dz; break; }
      }
      this.g.audio.place(B.Stone);
    } else {
      const hx = x + dx, hy = y + dy, hz = z + dz;
      const h = w.getBlock(hx, hy, hz);
      if (BLOCKS[h] && BLOCKS[h].model && BLOCKS[h].model.kind === K.Head) w.setBlock(hx, hy, hz, B.Air);
      w.setBlock(x, y, z, fam.first + f);
      if (sticky) {
        const b = w.getBlock(hx + dx, hy + dy, hz + dz);
        if (b > 0 && !gone(b) && !immovable(b)) { w.setBlock(hx, hy, hz, b); w.setBlock(hx + dx, hy + dy, hz + dz, B.Air); this.track(hx, hy, hz); }
      }
      this.g.audio.place(B.Stone);
    }
  }
}

/** The block a lever or button is fixed to (attach: 0..3 a wall at that side, 4 the floor, 5 the ceiling). */
function attachedTo(x, y, z, a) {
  if (a === 4) return [x, y - 1, z];
  if (a === 5) return [x, y + 1, z];
  return [x + H4[a][0], y, z + H4[a][1]];
}
