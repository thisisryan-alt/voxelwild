// Level-authoring DSL. Coordinates are in tiles (16px). A zone is a solid mass with water carved out of it,
// plus spawns, props, entries/exits and hazard areas. finish() returns the plain zone object World loads.
import { T, TS, Grid, isSolid } from './tiles.js';
import { rng, vnoise } from '../core/util.js';

export class ZoneBuilder {
  constructor(o) {
    this.id = o.id; this.name = o.name; this.biome = o.biome; this.w = o.w; this.h = o.h;
    this.seed = o.seed ?? 1; this.rand = rng(this.seed);
    this.grid = new Grid(o.w, o.h, o.fill ?? T.ROCK);
    this.meta = { music: o.music, map: o.map, dark: o.dark, pressure: o.pressure ?? 0, safe: !!o.safe, bgStyle: o.bgStyle, fgFish: o.fgFish, title: o.title ?? o.name, flags: o.flags || {} };
    this.spawns = []; this.props = []; this.entries = {}; this.exits = []; this.areas = []; this.lights = []; this.protect = [];
    this.surfaceMat = o.surface ?? T.GROUND;
  }
  // ---- geometry --------------------------------------------------------------------------
  fill(t) { this.grid.t.fill(t); return this; }
  rect(x, y, w, h, t = T.AIR) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.grid.set(x + i, y + j, t); return this; }
  carve(x, y, w, h) { return this.rect(x, y, w, h, T.AIR); }
  ellipse(cx, cy, rx, ry, t = T.AIR) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; if (nx * nx + ny * ny <= 1) this.grid.set(x, y, t);
    }
    return this;
  }
  // smooth tunnel through points (Catmull-Rom), radius r (number or [r0,r1]) with organic wobble
  path(pts, r = 3, o = {}) {
    const wob = o.wobble ?? 0.8, t = o.tile ?? T.AIR, seed = this.seed + (o.salt || 0);
    const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
    let dist = 0;
    for (let i = 0; i < pts.length - 1; i++) dist += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), steps = Math.max(2, Math.ceil(len * 2));
      for (let s = 0; s < steps; s++) {
        const u = s / steps, u2 = u * u, u3 = u2 * u;
        const cx = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3);
        const cy = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
        const k = (acc + u * len) / dist;
        const base = Array.isArray(r) ? r[0] + (r[1] - r[0]) * k : r;
        const rr = base + (vnoise(cx * 0.35, cy * 0.35, seed) - 0.5) * 2 * wob;
        this.ellipse(cx, cy, Math.max(0.8, rr), Math.max(0.8, rr * (o.squash ?? 1)), t);
      }
      acc += len;
    }
    return this;
  }
  // flat-bottomed open chamber (arenas, halls)
  hall(x, y, w, h, t = T.AIR) { return this.rect(x, y, w, h, t); }
  // rolling seabed: fills solid below f(x) over [x0,x1)
  seabed(x0, x1, f, t = T.ROCK) { for (let x = x0; x < x1; x++) { const gy = Math.round(f(x)); for (let y = gy; y < this.h; y++) this.grid.set(x, y, t); } return this; }
  ceiling(x0, x1, f, t = T.ROCK) { for (let x = x0; x < x1; x++) { const gy = Math.round(f(x)); for (let y = 0; y < gy; y++) this.grid.set(x, y, t); } return this; }
  mound(cx, baseY, hw, ht, t = T.GROUND) { return this.ellipse(cx, baseY, hw, ht, t); }
  platform(x, y, w, t = T.PLATFORM) { for (let i = 0; i < w; i++) this.grid.set(x + i, y, t); return this; }
  pillar(x, y1, y2, w = 2, t = T.RUIN) { return this.rect(x, y1, w, y2 - y1 + 1, t); }
  // knock a cellular smoothing pass over non-protected solid/air boundary tiles
  smooth(passes = 1) {
    const g = this.grid;
    for (let p = 0; p < passes; p++) {
      const snap = g.t.slice();
      for (let y = 1; y < this.h - 1; y++) for (let x = 1; x < this.w - 1; x++) {
        if (this.isProtected(x, y)) continue;
        let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && isSolid(snap[(y + dy) * this.w + x + dx])) n++;
        const here = snap[y * this.w + x];
        if (here === T.AIR && n >= 7) g.t[y * this.w + x] = T.ROCK;
        else if (isSolid(here) && (here === T.ROCK || here === T.GROUND) && n <= 2) g.t[y * this.w + x] = T.AIR;
      }
    }
    return this;
  }
  keep(x, y, w, h) { this.protect.push([x, y, w, h]); return this; }
  isProtected(x, y) { return this.protect.some(([a, b, w, h]) => x >= a && y >= b && x < a + w && y < b + h); }
  // convert exposed upward faces to the surface material (sand etc.)
  surface(t = this.surfaceMat, depth = 2) {
    const g = this.grid;
    for (let x = 0; x < this.w; x++) for (let y = 0; y < this.h; y++) {
      if (g.get(x, y) !== T.ROCK) continue;
      if (g.get(x, y - 1) === T.AIR) { for (let d = 0; d < depth + (x * 7 + y) % 2 && g.get(x, y + d) === T.ROCK; d++) g.set(x, y + d, t); }
    }
    return this;
  }
  // ---- queries ---------------------------------------------------------------------------
  isOpen(x, y) { return this.grid.get(x, y) === T.AIR || this.grid.get(x, y) === T.PLATFORM; }
  // first solid row at/below the first open row at/below ty (i.e. the floor you would land on)
  floorRow(tx, ty = 0) {
    let y = ty; while (y < this.h - 1 && isSolid(this.grid.get(tx, y))) y++;
    while (y < this.h - 1 && !isSolid(this.grid.get(tx, y))) y++;
    return y;
  }
  ceilRow(tx, ty) { let y = ty; while (y > 0 && !isSolid(this.grid.get(tx, y))) y--; return y; }
  // ---- content ---------------------------------------------------------------------------
  entry(name, tx, ty) { this.entries[name] = { x: (tx + 0.5) * TS, y: ty * TS + TS }; return this; }   // feet position (bottom of tile ty)
  exit(x, y, w, h, to, entry, o = {}) { this.exits.push({ x: x * TS, y: y * TS, w: w * TS, h: h * TS, to, entry, ...o }); return this; }
  spawn(type, tx, ty, o = {}) { this.spawns.push({ type, x: (tx + 0.5) * TS, y: ty * TS + TS / 2, floor: false, ...o }); return this; }
  spawnFloor(type, tx, ty = 0, o = {}) { const r = this.floorRow(tx, ty); this.spawns.push({ type, x: (tx + 0.5) * TS, y: r * TS, floor: true, ...o }); return this; }
  prop(type, tx, ty, o = {}) { this.props.push({ type, x: (tx + 0.5) * TS, y: ty * TS + TS, ...o }); return this; }
  propFloor(type, tx, o = {}) { const r = this.floorRow(tx, o.from ?? 0); this.props.push({ type, x: (tx + 0.5) * TS, y: r * TS, ...o }); return this; }
  light(tx, ty, r, color = '#ffe8a0', a = 0.8) { this.lights.push({ x: (tx + 0.5) * TS, y: (ty + 0.5) * TS, r, color, a }); return this; }
  area(kind, x, y, w, h, o = {}) { this.areas.push({ kind, x: x * TS, y: y * TS, w: w * TS, h: h * TS, ...o }); return this; }
  // scatter dressing on exposed floors / ceilings. table: {floor:[[type,weight,variants],...], ceil:[...], density}
  decorate(table, density = 0.35) {
    const r = rng(this.seed + 99), g = this.grid, taken = new Set(this.props.map((p) => Math.floor(p.x / TS)));
    const total = (a) => a.reduce((s, e) => s + e[1], 0);
    const pick = (a) => { let k = r() * total(a); for (const e of a) { k -= e[1]; if (k <= 0) return e; } return a[0]; };
    for (let x = 1; x < this.w - 1; x++) {
      for (let y = 1; y < this.h - 1; y++) {
        if (table.floor && g.get(x, y) === T.AIR && isSolid(g.get(x, y + 1)) && g.get(x, y + 1) !== T.CRACKED && r() < density && !this.nearEntry(x, y)) {
          const e = pick(table.floor);
          this.props.push({ type: e[0], x: (x + 0.5) * TS + (r() - 0.5) * 8, y: (y + 1) * TS + 1, v: Math.floor(r() * (e[2] || 3)), layer: e[3] || 'back' });
          y += 1;
        }
        if (table.ceil && g.get(x, y) === T.AIR && isSolid(g.get(x, y - 1)) && g.get(x, y - 1) !== T.PLATFORM && r() < density * 0.4) {
          const e = pick(table.ceil);
          this.props.push({ type: e[0], x: (x + 0.5) * TS + (r() - 0.5) * 6, y: y * TS - 1, v: Math.floor(r() * (e[2] || 3)), layer: 'back' });
        }
      }
    }
    return this;
  }
  nearEntry(x, y) { return Object.values(this.entries).some((e) => Math.abs(e.x / TS - x) < 2 && Math.abs(e.y / TS - y) < 2); }
  finish() {
    return {
      id: this.id, name: this.name, biome: this.biome, w: this.w, h: this.h, seed: this.seed, grid: this.grid,
      spawns: this.spawns, props: this.props, entries: this.entries, exits: this.exits, areas: this.areas, lights: this.lights, ...this.meta,
    };
  }
}

// ---- authoring conveniences ----------------------------------------------------------------------------
Object.assign(ZoneBuilder.prototype, {
  entryFloor(name, tx, o = {}) { const f = this.floorRow(tx, o.from ?? 0); this.entry(name, tx, f - 1); if (o.facing) this.entries[name].facing = o.facing; return this; },
  shrine(name, tx, o = {}) { const f = this.floorRow(tx, o.from ?? 0); this.entry(name, tx, f - 1); this.props.push({ type: 'shrine', x: (tx + 0.5) * TS, y: (f - 1) * TS - 2 + 16 - 2, kind: o.kind || 'rest', entry: name, key: `${this.id}:shrine:${name}`, name: o.title }); return this; },
  chest(tx, loot, o = {}) { const f = this.floorRow(tx, o.from ?? 0); this.props.push({ type: 'chest', x: (tx + 0.5) * TS, y: f * TS - 8 + 8, loot, tint: o.tint, key: o.key }); return this; },
  npc(id, tx, o = {}) { const f = this.floorRow(tx, o.from ?? 0); this.props.push({ type: 'npc', npc: id, x: (tx + 0.5) * TS, y: f * TS - 11, facing: o.facing }); return this; },
  sign(tx, text, o = {}) { const f = this.floorRow(tx, o.from ?? 0); this.props.push({ type: 'sign', x: (tx + 0.5) * TS, y: f * TS - 9, text, speaker: o.speaker }); return this; },
  mural(tx, codex, o = {}) { const f = this.floorRow(tx, o.from ?? 0); this.props.push({ type: 'mural', x: (tx + 0.5) * TS, y: f * TS - 15, codex, v: o.v || 0 }); return this; },
  coins(tx, ty, n = 3, step = 1) { for (let i = 0; i < n; i++) this.props.push({ type: 'coin', x: (tx + i * step + 0.5) * TS, y: ty * TS + 16, value: 1 }); return this; },
  pearl(tx, ty, id = 'pearl') { this.props.push({ type: 'pearl', id, x: (tx + 0.5) * TS, y: ty * TS + 16 }); return this; },
  itemAt(tx, ty, id) { this.props.push({ type: 'item', id, x: (tx + 0.5) * TS, y: ty * TS + 16 }); return this; },
  // exits through the zone border; carve a doorway and register the trigger on the very edge column/row
  exitE(y0, y1, to, entry) { this.carve(this.w - 3, y0, 3, y1 - y0 + 1); this.exit(this.w - 1, y0, 1, y1 - y0 + 1, to, entry); return this; },
  exitW(y0, y1, to, entry) { this.carve(0, y0, 3, y1 - y0 + 1); this.exit(0, y0, 1, y1 - y0 + 1, to, entry); return this; },
  exitS(x0, x1, to, entry) { this.carve(x0, this.h - 3, x1 - x0 + 1, 3); this.exit(x0, this.h - 1, x1 - x0 + 1, 1, to, entry); return this; },
  exitN(x0, x1, to, entry) { this.carve(x0, 0, x1 - x0 + 1, 3); this.exit(x0, 0, x1 - x0 + 1, 1, to, entry); return this; },
  entryE(name, ty) { this.entry(name, this.w - 4, ty); return this; },
  entryW(name, ty) { this.entry(name, 3, ty); return this; },
  // fill the open area under a y-line with solid (a flat floor) between x0..x1
  floorLine(x0, x1, y, t = T.ROCK) { for (let x = x0; x < x1; x++) for (let j = y; j < this.h; j++) this.grid.set(x, j, t); return this; },
  breakable(x, y, w = 1, h = 1) { this.rect(x, y, w, h, T.CRACKED); return this; },
  seal(x, y, w = 1, h = 1) { this.rect(x, y, w, h, T.SEAL); return this; },
  tidegate(x, y, w = 1, h = 1) { this.rect(x, y, w, h, T.TIDEGATE); return this; },
  spikes(x, y, w = 1) { for (let i = 0; i < w; i++) this.grid.set(x + i, y, T.SPIKE); return this; },
  lockdoor(x, y, tw, th, key_item, o = {}) { this.rect(x, y, tw, th, T.LOCKED); this.props.push({ type: 'lockdoor', x: (x + tw / 2) * TS, y: (y + th / 2) * TS, tw, th, key_item, key: `${this.id}:door:${x}:${y}`, ...o }); return this; },
});
