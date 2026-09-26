// World on the page: streaming (generate -> decorate -> mesh on a worker pool), block storage and queries, edits with
// relighting, persistence of edited sections, the cellular water simulation, and cave culling (section visibility).
import { CS, CS2, CS3, MIN_SY, MAX_SY, SECTIONS, MIN_Y, MAX_Y, RS, RS2, RS3, RM, MAX_LIGHT } from '../shared/const.js';
import { BLOCKS, B, F, isWater, waterLevel, isLava, lavaLevel, isLiquid } from '../shared/blocks.js';
import { modelBoxes, connections, CONNECTING } from '../shared/shapes.js';
import { PropField } from './props.js';

const key2 = (cx, cz) => cx * 65536 + cz;              // cx, cz within +-32767 columns (~1000 km)
const key3 = (cx, sy, cz) => `${cx},${sy},${cz}`;
const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export class World {
  constructor({ seed, workerUrl, viewDistance = 8, onMesh, onUnloadSection, modified, dim = 0 }) {
    this.seed = seed >>> 0;
    this.dim = dim;                               // 0 overworld, 1 nether, 2 end
    this.below = dim === 2 ? B.Air : B.Bedrock;   // what lies under the world: the End's void, bedrock elsewhere
    this.viewDistance = viewDistance;
    this.onMesh = onMesh;
    this.onUnloadSection = onUnloadSection;
    this.columns = new Map();
    this.modified = modified || new Map();       // key3 -> Uint16Array (edited sections, survives unload; saved)
    this.fancyDistance = 2;
    this.leafMode = 'fluffy';
    const n = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
    this.workers = [];
    for (let i = 0; i < n; i++) {
      const w = new Worker(workerUrl);
      w.busy = 0;
      w.onmessage = (e) => this.onWorker(w, e.data);
      w.onerror = (e) => console.error('worker error', e.message);
      this.workers.push(w);
    }
    this.regionPool = [];
    this.jobId = 1;
    this.meshQueueUrgent = [];
    this.viewer = [0, 80, 0];
    this.viewerColumn = [1e9, 1e9];
    this.offsets = [];
    this.offsetsFor = -1;
    this.stats = { genMs: 0, meshMs: 0, gens: 0, meshes: 0 };
    this.waterActive = new Set();
    this.waterTimer = 0;
    this.lavaActive = new Set();
    this.lavaTimer = 0;
    this.visStamp = 0;
    this.visibilityDirty = true;
    this.lastCamSection = null;
    this.errors = [];
    this.props = new PropField();
  }

  // ---------------------------------------------------------------- queries

  column(cx, cz) { return this.columns.get(key2(cx, cz)); }

  getBlock(x, y, z) {
    if (y < MIN_Y) return this.below;
    if (y >= MAX_Y) return B.Air;
    const c = this.columns.get(key2(x >> 5, z >> 5));
    if (!c || c.state !== 'ready') return -1;
    const s = c.sections[(y - MIN_Y) >> 5];
    if (typeof s === 'number') return s;
    return s[(x & 31) + ((z & 31) << 5) + (((y - MIN_Y) & 31) << 10)];
  }

  /** Boxes (block units, relative to the cell) of the shaped block id at x, y, z. */
  modelBoxesAt(x, y, z, id, collision) {
    const m = BLOCKS[id].model;
    let conn = 0, up = false;
    if (CONNECTING.has(m.kind)) {
      conn = connections(m.kind, (dx, dz, dy = 0) => {
        const n = this.getBlock(x + dx, y + dy, z + dz);
        return n < 0 ? null : { id: n, opaque: (BLOCKS[n].flags & F.Opaque) !== 0, model: BLOCKS[n].model };
      });
      up = this.getBlock(x, y + 1, z) > 0;
    }
    return modelBoxes(m, conn, up, collision);
  }

  /** Absolute collision boxes touching cell x, y, z (fence and wall posts from the cell below reach up into it). */
  collisionBoxes(x, y, z, out) {
    const b = this.getBlock(x, y, z);
    if (b < 0) out.push([x, y, z, x + 1, y + 1, z + 1]);
    else if (BLOCKS[b].flags & F.Solid) {
      if (BLOCKS[b].model) { for (const k of this.modelBoxesAt(x, y, z, b, true)) out.push([x + k[0], y + k[1], z + k[2], x + k[3], y + k[4], z + k[5]]); }
      else out.push([x, y, z, x + 1, y + 1, z + 1]);
    }
    const u = this.getBlock(x, y - 1, z);
    if (u > 0 && BLOCKS[u].model && (BLOCKS[u].flags & F.Solid)) {
      for (const k of this.modelBoxesAt(x, y - 1, z, u, true)) if (k[4] > 1) out.push([x + k[0], y - 1 + k[1], z + k[2], x + k[3], y - 1 + k[4], z + k[5]]);
    }
    return out;
  }

  isSolidAt(x, y, z) {
    const b = this.getBlock(x, y, z);
    return b < 0 || (BLOCKS[b].flags & F.Solid) !== 0;
  }

  heightmapAt(x, z) {
    const c = this.columns.get(key2(x >> 5, z >> 5));
    if (!c || c.state !== 'ready') return null;
    return c.heightmap[(x & 31) + ((z & 31) << 5)];
  }

  climateAt(x, z) {
    const c = this.columns.get(key2(x >> 5, z >> 5));
    if (!c || !c.surface) return null;
    const k = (x & 31) + ((z & 31) << 5);
    return { temp: c.surface.temp[k] / 255, humid: c.surface.humid[k] / 255, biome: c.surface.biome[k], height: c.surface.height[k] };
  }

  isAreaReady(x, z, radius = 1) {
    const cx = Math.floor(x) >> 5, cz = Math.floor(z) >> 5;
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const c = this.column(cx + dx, cz + dz);
      if (!c || c.state !== 'ready') return false;
      for (const s of c.render) if (s.needsMesh || s.meshing) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- streaming

  setViewer(x, y, z) {
    this.viewer = [x, y, z];
    const cx = Math.floor(x) >> 5, cz = Math.floor(z) >> 5;
    if (cx !== this.viewerColumn[0] || cz !== this.viewerColumn[1] || this.offsetsFor !== this.viewDistance) {
      this.viewerColumn = [cx, cz];
      this.rebuildOffsets();
      this.unloadFar();
      this.refreshLeafDetail();
    }
  }

  rebuildOffsets() {
    if (this.offsetsFor === this.viewDistance) return;
    this.offsetsFor = this.viewDistance;
    const r = this.viewDistance + 2, list = [];
    for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) if (x * x + z * z <= r * r) list.push([x, z, x * x + z * z]);
    list.sort((a, b) => a[2] - b[2]);
    this.offsets = list;
  }

  idleWorker() {
    let best = null;
    for (const w of this.workers) if (!best || w.busy < best.busy) best = w;
    return best && best.busy < 3 ? best : null;
  }

  post(w, msg, transfer) { w.busy++; w.postMessage(msg, transfer || []); }

  update(dt) {
    const [vcx, vcz] = this.viewerColumn;
    const r = this.viewDistance;
    let started = 0;
    // 1. generation
    for (const [ox, oz, d2] of this.offsets) {
      if (started >= 6) break;
      const cx = vcx + ox, cz = vcz + oz;
      if (this.columns.has(key2(cx, cz))) continue;
      const w = this.idleWorker();
      if (!w) break;
      const col = { cx, cz, state: 'gen', surface: null, sections: null, heightmap: null, render: [], waterSeeds: null };
      this.columns.set(key2(cx, cz), col);
      this.post(w, { type: 'gen', id: this.jobId++, cx, cz, seed: this.seed, dim: this.dim });
      started++;
    }
    // 2. decoration once all 8 neighbours have terrain
    const r1 = (r + 1) * (r + 1);
    for (const [ox, oz, d2] of this.offsets) {
      if (d2 > r1) break;
      const col = this.column(vcx + ox, vcz + oz);
      if (!col || col.state !== 'generated') continue;
      const neighbours = [];
      let ok = true;
      for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1; dx++) {
        const n = this.column(col.cx + dx, col.cz + dz);
        if (!n || !n.surface) { ok = false; break; }
        neighbours.push({ height: n.surface.height, top: n.surface.top, biome: n.surface.biome });
      }
      if (!ok) continue;
      const w = this.idleWorker();
      if (!w) break;
      col.state = 'decorating';
      const vox = col.voxels; col.voxels = null;
      this.post(w, { type: 'decorate', id: this.jobId++, cx: col.cx, cz: col.cz, seed: this.seed, dim: this.dim, voxels: vox, neighbours }, [vox.buffer]);
    }
    // 3. meshing: urgent (edits) first, then nearest sections within the view distance
    while (this.meshQueueUrgent.length) {
      const w = this.idleWorker();
      if (!w) break;
      const s = this.meshQueueUrgent.shift();
      if (s.dead || !s.needsMesh) continue;
      if (!this.neighboursReady(s.cx, s.cz)) { s.needsMesh = true; continue; }
      this.scheduleMesh(s, w);
    }
    const r2 = r * r;
    let pending = 0;
    outer: for (const [ox, oz, d2] of this.offsets) {
      if (d2 > r2) break;
      const col = this.column(vcx + ox, vcz + oz);
      if (!col || col.state !== 'ready') continue;
      let any = false;
      for (const s of col.render) if (s.needsMesh && !s.meshing) { any = true; break; }
      if (!any) continue;
      pending++;
      if (!this.neighboursReady(col.cx, col.cz)) continue;
      // nearest sections first within the column (by height difference to the viewer)
      const order = col.render.filter((s) => s.needsMesh && !s.meshing)
        .sort((a, b) => Math.abs(a.sy * CS + 16 - this.viewer[1]) - Math.abs(b.sy * CS + 16 - this.viewer[1]));
      for (const s of order) {
        if (this.trivial(s)) continue;
        const w = this.idleWorker();
        if (!w) break outer;
        this.scheduleMesh(s, w);
      }
    }
    this.pendingColumns = pending;
    this.stepWater(dt);
    this.stepLava(dt);
  }

  neighboursReady(cx, cz) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const n = this.column(cx + dx, cz + dz);
      if (!n || n.state !== 'ready') return false;
    }
    return true;
  }

  /** Uniform air, or uniform opaque enclosed by uniform opaque: no faces, no job. */
  trivial(s) {
    const col = this.column(s.cx, s.cz);
    const data = col.sections[s.sy - MIN_SY];
    if (typeof data !== 'number') return false;
    let empty = data === B.Air;
    if (!empty && (BLOCKS[data].flags & F.Opaque)) {
      empty = true;
      for (let f = 0; f < 6 && empty; f++) {
        const n = FN[f], nsy = s.sy + n[1];
        if (nsy < MIN_SY) continue;
        if (nsy > MAX_SY) { empty = false; break; }
        const nc = this.column(s.cx + n[0], s.cz + n[2]);
        const nd = nc && nc.sections ? nc.sections[nsy - MIN_SY] : null;
        empty = typeof nd === 'number' && (BLOCKS[nd].flags & F.Opaque) !== 0;
      }
    }
    if (!empty) return false;
    s.needsMesh = false;
    s.meshedVersion = s.version;
    const conn = data === B.Air ? 63 : 0;
    s.conn = [conn, conn, conn, conn, conn, conn];
    this.visibilityDirty = true;
    this.props.onSectionTrivial(s.key, (x, z) => this.heightmapAt(x, z), s);
    this.onMesh(s, null);
    return true;
  }

  scheduleMesh(s, w) {
    const buf = this.regionPool.pop() || { region: new Uint16Array(RS3), heightPatch: new Int32Array(RS2), climate: new Uint16Array(RS2) };
    this.buildRegion(s, buf.region, buf.heightPatch, buf.climate);
    s.meshing = true;
    s.needsMesh = false;
    const fancy = this.wantsFancy(s);
    s.fancy = fancy;
    const leafBits = (fancy ? 1 : 0) | (this.leafMode === 'fluffy' ? 2 : 0);
    const props = this.props.cellsFor(s.key, s.cx * CS, s.sy * CS, s.cz * CS);
    s.propsSent = props;
    this.post(w, { type: 'mesh', id: this.jobId++, key: s.key, version: s.version, region: buf.region, heightPatch: buf.heightPatch,
      climate: buf.climate, sx: s.cx, sy: s.sy, sz: s.cz, fancy: leafBits, propCells: props ? props.cells : null }, [buf.region.buffer, buf.heightPatch.buffer, buf.climate.buffer]);
  }

  buildRegion(s, region, hp, clim) {
    const base = s.sy - MIN_SY;
    for (let dy = -1; dy <= 1; dy++) {
      const sIdx = base + dy;
      const y0 = dy < 0 ? 16 : 0, y1 = dy > 0 ? 16 : 32;          // local range in the neighbour
      const ry = dy * 32 + RM;                                     // region offset of neighbour local 0
      for (let dz = -1; dz <= 1; dz++) {
        const z0 = dz < 0 ? 16 : 0, z1 = dz > 0 ? 16 : 32, rz = dz * 32 + RM;
        for (let dx = -1; dx <= 1; dx++) {
          const x0 = dx < 0 ? 16 : 0, x1 = dx > 0 ? 16 : 32, rx = dx * 32 + RM;
          let data;
          if (sIdx < 0) data = this.below;
          else if (sIdx >= SECTIONS) data = B.Air;
          else data = this.column(s.cx + dx, s.cz + dz).sections[sIdx];
          if (typeof data === 'number') {
            for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
              const o = (rx + x0) + (rz + z) * RS + (ry + y) * RS2;
              region.fill(data, o, o + (x1 - x0));
            }
          } else {
            for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
              let o = (rx + x0) + (rz + z) * RS + (ry + y) * RS2;
              let si = x0 + (z << 5) + (y << 10);
              for (let x = x0; x < x1; x++) region[o++] = data[si++];
            }
          }
        }
      }
    }
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const c = this.column(s.cx + dx, s.cz + dz);
      const z0 = dz < 0 ? 16 : 0, z1 = dz > 0 ? 16 : 32, x0 = dx < 0 ? 16 : 0, x1 = dx > 0 ? 16 : 32;
      for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
        const o = (dx * 32 + RM + x) + (dz * 32 + RM + z) * RS, k = x + (z << 5);
        hp[o] = c.heightmap[k];
        clim[o] = c.surface.temp[k] | (c.surface.humid[k] << 8);
      }
    }
  }

  onWorker(w, m) {
    w.busy--;
    if (m.type === 'error') { console.error('worker job failed', m.message); this.errors.push(m.message); return; }
    if (m.type === 'gen') {
      this.stats.genMs += m.ms; this.stats.gens++;
      const col = this.column(m.cx, m.cz);
      if (!col || col.state !== 'gen') return;
      col.voxels = m.voxels;
      col.surface = m.surface;
      col.state = 'generated';
    } else if (m.type === 'decorate') {
      const col = this.column(m.cx, m.cz);
      if (!col || col.state !== 'decorating') return;
      col.sections = m.sections;
      col.heightmap = m.heightmap;
      let restored = false;
      for (let i = 0; i < SECTIONS; i++) {
        const mod = this.modified.get(key3(col.cx, MIN_SY + i, col.cz));
        if (mod) { col.sections[i] = mod.slice(); restored = true; }
      }
      if (restored) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) this.recomputeHeight(col, x, z, MAX_Y - 1);
      col.render = [];
      for (let i = 0; i < SECTIONS; i++) {
        const sy = MIN_SY + i;
        col.render.push({ key: key3(col.cx, sy, col.cz), cx: col.cx, sy, cz: col.cz, version: 0, meshedVersion: -1, needsMesh: true, meshing: false,
          conn: [63, 63, 63, 63, 63, 63], gl: null, visible: true, visit: 0, fancy: true, hasLeaves: false, dead: false });
      }
      col.state = 'ready';
      this.props.onColumnReady(col.cx, col.cz, m.props);
      this.seedWater(col);
      this.seedLava(col);
      this.visibilityDirty = true;
    } else if (m.type === 'mesh') {
      this.stats.meshMs += m.ms; this.stats.meshes++;
      this.regionPool.push({ region: m.region, heightPatch: m.heightPatch, climate: m.climate });
      const [cxs, sys, czs] = m.key.split(',').map(Number);
      const col = this.column(cxs, czs);
      const s = col && col.render[sys - MIN_SY];
      if (!s || s.dead) return;
      s.meshing = false;
      if (m.version !== s.version) { if (s.meshedVersion !== s.version) s.needsMesh = true; return; }
      s.meshedVersion = m.version;
      s.hasLeaves = m.leaves > 0;
      s.conn = m.connectivity;
      this.visibilityDirty = true;
      if (m.propLight && s.propsSent) this.props.onSectionLit(s.key, s.propsSent, m.propLight, s);
      else this.props.onSectionLit(s.key, { items: [] }, [], s);
      this.onMesh(s, m);
    }
  }

  unloadFar() {
    const [vcx, vcz] = this.viewerColumn;
    const limit = (this.viewDistance + 3) ** 2;
    for (const [k, col] of this.columns) {
      const dx = col.cx - vcx, dz = col.cz - vcz;
      if (dx * dx + dz * dz <= limit) continue;
      if (col.state === 'gen' || col.state === 'decorating') continue;   // result will be discarded when it returns
      if (col.state === 'ready') {
        this.props.onColumnUnloaded(col.cx, col.cz);
        for (const s of col.render) { s.dead = true; this.onUnloadSection(s); }
        for (let i = 0; i < SECTIONS; i++) {
          const k3 = key3(col.cx, MIN_SY + i, col.cz);
          if (col.dirty && col.dirty.has(i)) this.modified.set(k3, col.sections[i].slice());
        }
      }
      this.columns.delete(k);
    }
  }

  /** 'fast': solid leaf cubes; 'fancy': see-through near the camera; 'fluffy': fancy plus loose clusters on every canopy. */
  setLeaves(mode) {
    if (mode === this.leafMode) return;
    this.leafMode = mode;
    this.fancyDistance = mode === 'fast' ? -1 : 2;
    for (const col of this.columns.values()) for (const s of col.render) if (s.hasLeaves && !s.needsMesh) { s.version++; s.needsMesh = true; }
  }

  wantsFancy(s) {
    const c = this.lastCamSection;
    if (!c) return true;
    return Math.max(Math.abs(s.cx - c[0]), Math.abs(s.sy - c[1]), Math.abs(s.cz - c[2])) <= this.fancyDistance;
  }

  refreshLeafDetail() {
    for (const col of this.columns.values()) {
      if (col.state !== 'ready') continue;
      for (const s of col.render) {
        if (!s.hasLeaves || s.needsMesh || s.fancy === this.wantsFancy(s)) continue;
        s.version++; s.needsMesh = true;
      }
    }
  }

  // ---------------------------------------------------------------- edits

  /** Sets a block. Returns false when the target isn't loaded. urgent: remesh its neighbourhood ahead of streaming. */
  setBlock(x, y, z, id, urgent = true) {
    if (y < MIN_Y || y >= MAX_Y) return false;
    const col = this.columns.get(key2(x >> 5, z >> 5));
    if (!col || col.state !== 'ready') return false;
    const si = (y - MIN_Y) >> 5;
    let data = col.sections[si];
    const li = (x & 31) + ((z & 31) << 5) + (((y - MIN_Y) & 31) << 10);
    if (typeof data === 'number') {
      if (data === id) return false;
      const arr = new Uint16Array(CS3); arr.fill(data); col.sections[si] = data = arr;
    }
    if (data[li] === id) return false;
    data[li] = id;
    (col.dirty || (col.dirty = new Set())).add(si);
    this.modified.set(key3(col.cx, MIN_SY + si, col.cz), data);   // live reference; copied on unload/save

    // light heightmap
    const lx = x & 31, lz = z & 31, hk = lx + (lz << 5);
    const oldH = col.heightmap[hk];
    let newH = oldH;
    if (BLOCKS[id].opacity > 0) { if (y > oldH) newH = y; }
    else if (y === oldH) newH = this.recomputeHeight(col, lx, lz, y - 1);
    col.heightmap[hk] = newH;

    // light can change within 16 blocks, and down the whole sky shaft when the heightmap moved
    const yLo = Math.min(y, oldH, newH) - MAX_LIGHT - 1, yHi = Math.max(y, oldH, newH) + MAX_LIGHT + 1;
    const loX = (x - 16) >> 5, hiX = (x + 16) >> 5, loZ = (z - 16) >> 5, hiZ = (z + 16) >> 5;
    const loY = Math.max(MIN_SY, (yLo - MIN_Y >> 5) + MIN_SY), hiY = Math.min(MAX_SY, (yHi - MIN_Y >> 5) + MIN_SY);
    const near = new Set();
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
      near.add(key3((x + dx) >> 5, ((y + dy - MIN_Y) >> 5) + MIN_SY, (z + dz) >> 5));
    for (let scx = loX; scx <= hiX; scx++) for (let scz = loZ; scz <= hiZ; scz++) {
      const c = this.column(scx, scz);
      if (!c || c.state !== 'ready') continue;
      for (let sy = loY; sy <= hiY; sy++) {
        const s = c.render[sy - MIN_SY];
        s.version++; s.needsMesh = true;
        if (urgent && near.has(s.key)) this.meshQueueUrgent.push(s);
      }
    }
    this.wakeWater(x, y, z);   // any edit can open a path for nearby water or lava, or be a liquid itself
    // props resting on, hanging from or built into this cell go with it, and take their barrier/core cells along
    for (const [cx2, cy2, cz2, b] of this.props.removeDependents(x, y, z)) {
      if ((cx2 !== x || cy2 !== y || cz2 !== z) && this.getBlock(cx2, cy2, cz2) === b) this.setBlock(cx2, cy2, cz2, B.Air, urgent);
    }
    return true;
  }

  recomputeHeight(col, lx, lz, fromY) {
    let h = MIN_Y - 1;
    for (let y = fromY; y >= MIN_Y; y--) {
      const data = col.sections[(y - MIN_Y) >> 5];
      const b = typeof data === 'number' ? data : data[lx + (lz << 5) + (((y - MIN_Y) & 31) << 10)];
      if (b !== B.Air && BLOCKS[b].opacity > 0) { h = y; break; }
    }
    col.heightmap[lx + (lz << 5)] = h;
    return h;
  }

  /** Copies of every edited section (for saving). */
  editedSections() {
    const out = new Map(this.modified);
    for (const col of this.columns.values()) {
      if (!col.dirty) continue;
      for (const si of col.dirty) out.set(key3(col.cx, MIN_SY + si, col.cz), col.sections[si]);
    }
    return out;
  }

  // ---------------------------------------------------------------- water simulation (sources = 8, flowing 1..7)

  seedWater(col) {
    // wake springs: water above the sea with air beside or below
    const ox = col.cx * CS, oz = col.cz * CS;
    let found = 0;
    for (let si = 0; si < SECTIONS && found < 64; si++) {
      const data = col.sections[si];
      if (typeof data === 'number') continue;
      for (let i = 0; i < CS3 && found < 64; i++) {
        if (!isWater(data[i])) continue;
        const lx = i & 31, lz = (i >> 5) & 31, ly = i >> 10;
        const wy = MIN_Y + si * CS + ly;
        // generated water is settled (seas, rivers, aquifers) until an edit disturbs it; only cliff springs run from the start
        if (wy < 72) continue;
        const x = ox + lx, z = oz + lz;
        if (this.canFlowInto(x, wy - 1, z) || this.canFlowInto(x + 1, wy, z) || this.canFlowInto(x - 1, wy, z)
          || this.canFlowInto(x, wy, z + 1) || this.canFlowInto(x, wy, z - 1)) { this.waterActive.add(`${x},${wy},${z}`); found++; }
      }
    }
  }

  canFlowInto(x, y, z) {
    const b = this.getBlock(x, y, z);
    if (b < 0) return false;
    if (isLiquid(b)) return false;
    const d = BLOCKS[b];
    return b === B.Air || ((d.flags & F.Replaceable) && !(d.flags & F.Solid));
  }

  wakeWater(x, y, z) {
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 1) continue;
      const b = this.getBlock(x + dx, y + dy, z + dz);
      if (isWater(b)) this.waterActive.add(`${x + dx},${y + dy},${z + dz}`);
      else if (isLava(b)) this.lavaActive.add(`${x + dx},${y + dy},${z + dz}`);
    }
  }

  // ---------------------------------------------------------------- lava (source 8, flowing 1..7): slower and shorter in the
  // overworld (levels drop by 2), quick and long in the Nether; where it meets water a source sets to obsidian, flowing
  // lava to cobblestone

  seedLava(col) {
    if (this.dim !== 1) return;
    const ox = col.cx * CS, oz = col.cz * CS;
    let found = 0;
    for (let si = 0; si < SECTIONS && found < 32; si++) {
      const data = col.sections[si];
      if (typeof data === 'number') continue;
      for (let i = 0; i < CS3 && found < 32; i++) {
        if (data[i] !== B.Lava) continue;
        const wy = MIN_Y + si * CS + (i >> 10);
        if (wy <= 32) continue;          // the lava sea is settled
        const x = ox + (i & 31), z = oz + ((i >> 5) & 31);
        if (this.canFlowInto(x, wy - 1, z) || this.canFlowInto(x + 1, wy, z) || this.canFlowInto(x - 1, wy, z)
          || this.canFlowInto(x, wy, z + 1) || this.canFlowInto(x, wy, z - 1)) { this.lavaActive.add(`${x},${wy},${z}`); found++; }
      }
    }
  }

  stepLava(dt) {
    this.lavaTimer += dt;
    const nether = this.dim === 1;
    if (this.lavaTimer < (nether ? 0.35 : 1.0)) return;
    this.lavaTimer = 0;
    const drop = nether ? 1 : 2, flow = (lv) => B.Lava + lv;
    const active = [...this.lavaActive];
    this.lavaActive.clear();
    const changes = [];
    let budget = 160;
    const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const k of active) {
      if (budget-- <= 0) { this.lavaActive.add(k); continue; }
      const [x, y, z] = k.split(',').map(Number);
      const id = this.getBlock(x, y, z);
      if (id < 0) { this.lavaActive.add(k); continue; }
      if (!isLava(id)) continue;
      const level = lavaLevel(id), source = id === B.Lava;
      // touching water: it sets
      let wet = false;
      for (const [dx, dy, dz] of N6) if (isWater(this.getBlock(x + dx, y + dy, z + dz))) { wet = true; break; }
      if (wet) { changes.push([x, y, z, source ? B.Obsidian : B.Cobblestone]); continue; }
      if (!source) {
        let fed = isLava(this.getBlock(x, y + 1, z));
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nb = this.getBlock(x + dx, y, z + dz);
          if (isLava(nb) && lavaLevel(nb) > level) { fed = true; break; }
        }
        if (!fed) { changes.push([x, y, z, level > drop ? flow(level - drop) : B.Air]); continue; }
      }
      if (this.canFlowInto(x, y - 1, z)) { changes.push([x, y - 1, z, flow(7)]); continue; }
      const below = this.getBlock(x, y - 1, z);
      if (isLava(below) && below !== B.Lava && lavaLevel(below) < 7) { changes.push([x, y - 1, z, flow(7)]); continue; }
      const next = level - drop;
      if (next < 1) continue;
      const onGround = below >= 0 && ((BLOCKS[below].flags & F.Solid) || below === B.Lava);
      if (!onGround && !source) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nb = this.getBlock(x + dx, y, z + dz);
        if (nb < 0) { this.lavaActive.add(k); continue; }
        if (this.canFlowInto(x + dx, y, z + dz) || (isLava(nb) && nb !== B.Lava && lavaLevel(nb) < next)) changes.push([x + dx, y, z + dz, flow(next)]);
      }
    }
    for (const [x, y, z, nid] of changes) {
      const cur = this.getBlock(x, y, z);
      if (cur < 0 || cur === nid) continue;
      if (!isLava(cur) && isLava(nid) && !this.canFlowInto(x, y, z)) continue;
      this.setBlock(x, y, z, nid, false);
    }
  }

  stepWater(dt) {
    this.waterTimer += dt;
    if (this.waterTimer < 0.25) return;
    this.waterTimer = 0;
    const active = [...this.waterActive];
    this.waterActive.clear();
    const changes = [];
    let budget = 220;
    for (const k of active) {
      if (budget-- <= 0) { this.waterActive.add(k); continue; }
      const [x, y, z] = k.split(',').map(Number);
      const id = this.getBlock(x, y, z);
      if (id < 0) { this.waterActive.add(k); continue; }       // wait at unloaded terrain
      if (!isWater(id)) continue;
      const level = waterLevel(id);
      const source = id === B.Water;
      // flowing water needs feeding: water above, or a horizontal neighbour one level higher (or a source)
      if (!source) {
        let fed = isWater(this.getBlock(x, y + 1, z));
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nb = this.getBlock(x + dx, y, z + dz);
          if (isWater(nb) && waterLevel(nb) > level) { fed = true; break; }
        }
        if (!fed) { changes.push([x, y, z, level > 1 ? 37 + level - 1 : B.Air]); continue; }
      }
      // two horizontal sources over solid/water ground make a new source
      if (!source) {
        let sources = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.getBlock(x + dx, y, z + dz) === B.Water) sources++;
        const below = this.getBlock(x, y - 1, z);
        if (sources >= 2 && (below === B.Water || (below >= 0 && (BLOCKS[below].flags & F.Solid)))) { changes.push([x, y, z, B.Water]); continue; }
      }
      // fall first
      if (this.canFlowInto(x, y - 1, z)) { changes.push([x, y - 1, z, B.Flow1 + 6]); continue; }
      const below = this.getBlock(x, y - 1, z);
      if (isWater(below) && below !== B.Water && waterLevel(below) < 7) { changes.push([x, y - 1, z, B.Flow1 + 6]); continue; }
      // then spread over solid ground (or from a source)
      const next = level - 1;
      if (next < 1) continue;
      const onGround = below >= 0 && ((BLOCKS[below].flags & F.Solid) || below === B.Water);
      if (!onGround && !source) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nb = this.getBlock(x + dx, y, z + dz);
        if (nb < 0) { this.waterActive.add(k); continue; }
        if (this.canFlowInto(x + dx, y, z + dz) || (isWater(nb) && nb !== B.Water && waterLevel(nb) < next))
          changes.push([x + dx, y, z + dz, 37 + next]);
      }
    }
    for (const [x, y, z, nid] of changes) {
      const cur = this.getBlock(x, y, z);
      if (cur < 0 || cur === nid) continue;
      if (!isWater(cur) && nid !== B.Air && !this.canFlowInto(x, y, z)) continue;
      // plants and torches washed away
      this.setBlock(x, y, z, nid, false);
    }
  }

  // ---------------------------------------------------------------- cave culling

  updateVisibility(cam) {
    const cs = [Math.floor(cam[0]) >> 5, Math.max(MIN_SY, Math.min(MAX_SY, ((Math.floor(cam[1]) - MIN_Y) >> 5) + MIN_SY)), Math.floor(cam[2]) >> 5];
    const moved = !this.lastCamSection || cs[0] !== this.lastCamSection[0] || cs[1] !== this.lastCamSection[1] || cs[2] !== this.lastCamSection[2];
    if (moved) { this.lastCamSection = cs; this.refreshLeafDetail(); }
    if (!moved && !this.visibilityDirty) return;
    this.visibilityDirty = false;
    const stamp = ++this.visStamp;
    const col = this.column(cs[0], cs[2]);
    const start = col && col.state === 'ready' ? col.render[cs[1] - MIN_SY] : null;
    if (!start) { for (const c of this.columns.values()) for (const s of c.render) s.visible = true; return; }
    const q = [];
    start.visit = stamp;
    const enqueue = (cx, sy, cz, entry, dirs) => {
      if (sy < MIN_SY || sy > MAX_SY) return;
      const c = this.column(cx, cz);
      if (!c || c.state !== 'ready') return;
      const s = c.render[sy - MIN_SY];
      if (s.visit === stamp) return;
      s.visit = stamp;
      q.push([s, entry, dirs]);
    };
    for (let f = 0; f < 6; f++) { const n = FN[f]; enqueue(cs[0] + n[0], cs[1] + n[1], cs[2] + n[2], f ^ 1, 1 << f); }
    const r2 = (this.viewDistance + 1) ** 2;
    for (let h = 0; h < q.length; h++) {
      const [s, entry, dirs] = q[h];
      const exits = s.conn[entry];
      for (let f = 0; f < 6; f++) {
        if (dirs & (1 << (f ^ 1))) continue;
        if (!(exits & (1 << f))) continue;
        const n = FN[f];
        const nx = s.cx + n[0], nz = s.cz + n[2];
        if ((nx - cs[0]) ** 2 + (nz - cs[2]) ** 2 > r2) continue;
        enqueue(nx, s.sy + n[1], nz, f ^ 1, dirs | (1 << f));
      }
    }
    for (const c of this.columns.values()) for (const s of c.render) s.visible = s.visit === stamp;
  }

  dispose() { for (const w of this.workers) w.terminate(); }
}
