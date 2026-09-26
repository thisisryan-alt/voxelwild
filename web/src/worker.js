// World worker: terrain generation, tree decoration (+ section split and heightmap), and lighting + meshing.
// The page keeps the voxel data; every job's input arrives by transfer and its output goes back by transfer.
import { generateColumn } from './shared/gen.js';
import { decorateColumn } from './shared/decorate.js';
import { Mesher } from './shared/mesh.js';
import { CS3, SECTIONS } from './shared/const.js';
import { farGrid } from './shared/far.js';

const mesher = new Mesher();

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.type === 'far') {
      const data = farGrid(m.seed, m.x0, m.z0, m.cell, m.n);
      self.postMessage({ type: 'far', id: m.id, level: m.level, seed: m.seed, x0: m.x0, z0: m.z0, data }, [data.buffer]);
    } else if (m.type === 'gen') {
      const t0 = performance.now();
      const { voxels, surface } = generateColumn(m.cx, m.cz, m.seed, m.dim | 0);
      self.postMessage({ type: 'gen', id: m.id, cx: m.cx, cz: m.cz, voxels, surface, ms: performance.now() - t0 },
        [voxels.buffer, surface.height.buffer, surface.top.buffer, surface.biome.buffer, surface.temp.buffer, surface.humid.buffer]);
    } else if (m.type === 'decorate') {
      const t0 = performance.now();
      const vox = m.voxels;
      const { heightmap, props } = decorateColumn(vox, m.cx, m.cz, m.seed, m.neighbours, m.dim | 0);
      // split into sections; a section of one block id is sent as that id only
      const sections = new Array(SECTIONS), transfer = [heightmap.buffer, props.buffer];
      for (let s = 0; s < SECTIONS; s++) {
        const view = vox.subarray(s * CS3, (s + 1) * CS3);
        const first = view[0];
        let uniform = true;
        for (let i = 1; i < CS3; i++) if (view[i] !== first) { uniform = false; break; }
        if (uniform) sections[s] = first;
        else { const copy = view.slice(); sections[s] = copy; transfer.push(copy.buffer); }
      }
      self.postMessage({ type: 'decorate', id: m.id, cx: m.cx, cz: m.cz, sections, heightmap, props, ms: performance.now() - t0 }, transfer);
    } else if (m.type === 'mesh') {
      const t0 = performance.now();
      const r = mesher.mesh(m.region, m.heightPatch, m.climate, m.sx, m.sy, m.sz, m.fancy);
      // voxel light for the props standing in this section (brightest of the cell and its 6 neighbours)
      const propLight = m.propCells ? mesher.lightAtCells(m.propCells) : null;
      self.postMessage({ type: 'mesh', id: m.id, key: m.key, version: m.version, ...r, propLight, region: m.region, heightPatch: m.heightPatch, climate: m.climate,
        ms: performance.now() - t0 },
        [r.vertices, r.opaque.buffer, r.cutout.buffer, r.water.buffer, r.glow.buffer, m.region.buffer, m.heightPatch.buffer, m.climate.buffer, ...(propLight ? [propLight.buffer] : [])]);
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err && err.stack || err) });
  }
};
