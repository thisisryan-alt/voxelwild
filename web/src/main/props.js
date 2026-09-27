// Port of World.Props.PropField: the props of every loaded column bucketed by section, lit from the voxel light
// their section's mesh job computed, removed when an edit breaks what they stand on (and remembered as removed,
// saved with the world), and handed to the renderer as instances.
import { PROP_RULES, PROP_STRIDE, Placement, dependsOn, ownedCells, scaleOf, yawOf } from '../shared/props.js';
import { hash4 } from '../shared/noise.js';
import { CS, MIN_Y } from '../shared/const.js';

const key3 = (cx, sy, cz) => `${cx},${sy},${cz}`;

export class PropField {
  constructor() {
    this.lib = null;             // props.json once loaded (the art); placement never needs it
    this.sections = new Map();   // key3 -> { key, items: [], lit }
    this.columns = new Map();    // "cx,cz" -> [key3]
    this.removed = new Set();    // anchors "x,y,z" the player broke
    this.loaded = 0;
  }

  setLibrary(lib) {
    this.lib = lib;
    this.byKind = PROP_RULES.map((r) => {
      const list = [];
      lib.assets.forEach((a, i) => { if (a.kind === r.name) list[a.variant] = i; });
      return list;
    });
    for (const sp of this.sections.values()) for (const it of sp.items) this.resolve(it);
  }

  onColumnReady(cx, cz, data) {
    this.onColumnUnloaded(cx, cz);
    const keys = [];
    for (let i = 0; i < data.length; i += PROP_STRIDE) {
      const x = data[i], y = data[i + 1], z = data[i + 2], packed = data[i + 3], room = data[i + 4];
      if (this.removed.has(`${x},${y},${z}`)) continue;
      const kind = packed & 255, variant = (packed >>> 8) & 255, yaw = (packed >>> 16) & 255, scale = (packed >>> 24) & 255;
      const key = key3(x >> 5, (y - MIN_Y >> 5) + (MIN_Y >> 5), z >> 5);
      let sp = this.sections.get(key);
      if (!sp) { sp = { key, items: [], lit: false, x0: (x >> 5) * CS, y0: (y >> 5) * CS, z0: (z >> 5) * CS }; this.sections.set(key, sp); keys.push(key); }
      const it = { x, y, z, kind, variant, yaw, scale, room, sky: 1, block: 0, entry: -1 };
      this.transform(it);
      this.resolve(it);
      sp.items.push(it);
      this.loaded++;
    }
    if (keys.length) this.columns.set(`${cx},${cz}`, keys);
  }

  onColumnUnloaded(cx, cz) {
    const keys = this.columns.get(`${cx},${cz}`);
    if (!keys) return;
    for (const k of keys) { const sp = this.sections.get(k); if (sp) { this.loaded -= sp.items.length; this.sections.delete(k); } }
    this.columns.delete(`${cx},${cz}`);
  }

  /** World transform: pivot, scale, yaw; small free-standing props wander inside their cell. */
  transform(it) {
    const rule = PROP_RULES[it.kind];
    const scale = scaleOf(rule, it.scale);
    let px = it.x + 0.5, py = it.y, pz = it.z + 0.5;
    if (rule.placement === Placement.CaveCeiling) py += 1;
    else py -= rule.sink * scale;
    if (rule.grid <= 1 && rule.footprint === 0 && rule.core === 0 && rule.barrier === 0) {
      const h = hash4(it.x, it.y, it.z, 0x7157);
      px += ((h & 255) / 255 - 0.5) * 0.5; pz += (((h >>> 8) & 255) / 255 - 0.5) * 0.5;
    }
    const a = yawOf(it.yaw);
    it.px = px; it.py = py; it.pz = pz; it.s = scale; it.c = Math.cos(a); it.sn = Math.sin(a);
  }

  /** Picks the art for the variant; cave formations shrink to the longest variant that fits their room. */
  resolve(it) {
    it.entry = -1;
    if (!this.lib) return;
    const rule = PROP_RULES[it.kind], list = this.byKind[it.kind];
    if (!list || !list.length) return;
    const cave = rule.placement !== Placement.Ground;
    for (let v = it.variant % list.length; v >= 0; v--) {
      const e = list[v];
      if (e == null) continue;
      const len = this.lib.assets[e].length ?? 0;
      if (!cave || len * it.s <= it.room - 0.1) { it.entry = e; break; }
    }
    if (it.entry >= 0) {
      const a = this.lib.assets[it.entry];
      it.radius = a.extents.radius * it.s; it.top = a.extents.top * it.s; it.bottom = a.extents.bottom * it.s;
    }
  }

  /** Section-local cells of a section's props (sent with its mesh job to read the voxel light). */
  cellsFor(key, ox, oy, oz) {
    const sp = this.sections.get(key);
    if (!sp || !sp.items.length) return null;
    const cells = new Int8Array(sp.items.length * 3);
    sp.items.forEach((it, i) => { cells[i * 3] = it.x - ox; cells[i * 3 + 1] = it.y - oy; cells[i * 3 + 2] = it.z - oz; });
    return { cells, items: sp.items.slice() };
  }

  onSectionLit(key, sent, light, render) {
    const sp = this.sections.get(key);
    if (!sp) return;
    sent.items.forEach((it, i) => { it.sky = light[i * 2] / 15; it.block = light[i * 2 + 1] / 15; });
    sp.lit = true; sp.render = render;
  }

  /** A uniform-air section is never meshed: estimate its props' light from the heightmap. */
  onSectionTrivial(key, heightAt, render) {
    const sp = this.sections.get(key);
    if (!sp) return;
    for (const it of sp.items) { const h = heightAt(it.x, it.z); it.sky = h == null || it.y > h ? 1 : 0.5; it.block = 0; }
    sp.lit = true; sp.render = render;
  }

  /** Removes every prop depending on the edited cell; returns the cells they wrote into the terrain. */
  removeDependents(x, y, z) {
    const out = [];
    for (let sx = (x - 3) >> 5; sx <= (x + 3) >> 5; sx++) for (let sz = (z - 3) >> 5; sz <= (z + 3) >> 5; sz++)
      for (let sy = ((y - 3 - MIN_Y) >> 5) + (MIN_Y >> 5); sy <= ((y + 3 - MIN_Y) >> 5) + (MIN_Y >> 5); sy++) {
        const sp = this.sections.get(key3(sx, sy, sz));
        if (!sp) continue;
        for (let i = sp.items.length - 1; i >= 0; i--) {
          const it = sp.items[i], rule = PROP_RULES[it.kind];
          if (!dependsOn(rule, it.x, it.y, it.z, it.yaw, x, y, z)) continue;
          sp.items.splice(i, 1);
          this.removed.add(`${it.x},${it.y},${it.z}`);
          this.loaded--;
          out.push(...ownedCells(rule, it.x, it.y, it.z, it.yaw));
        }
      }
    return out;
  }
}

export { CS };
