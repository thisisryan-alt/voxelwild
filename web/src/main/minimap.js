// A minimap in the corner and a full map on M (Xaero's Minimap is Minecraft's most downloaded mod): the terrain seen
// from above in the colours of its textures, hill-shaded, with the player, mobs and waypoints (the last death, the
// bed, waystones). In the Nether and underground it maps the floor round the player instead of the sky-lit top.
import { BLOCKS, B, isWater, isLava } from '../shared/blocks.js';
import { Dim } from '../shared/blocks.js';
import { structuresIn } from '../shared/structures.js';
import { terrainFor } from '../shared/gen.js';

const srgb = (v) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2));

export class MiniMap {
  constructor(game, canvas, bigCanvas) {
    this.g = game;
    this.canvas = canvas; this.big = bigCanvas;
    this.colors = new Map();
    this.timer = 0;
    this.memory = new Map();       // "dim:cx:cz" -> Uint8Array(32 * 32 * 3): terrain seen this session
    this.memT = 0;
  }

  /** Records the colours of loaded columns (a few per call), so the map keeps what has been explored. */
  remember() {
    const g = this.g, w = g.world;
    if (!w || g.dim !== Dim.Overworld) return;
    let n = 0;
    for (const col of w.columns.values()) {
      if (col.state !== 'ready') continue;
      const key = `${g.dim}:${col.cx}:${col.cz}`;
      const ver = col.render ? col.render.reduce((a, r) => a + r.version, 0) : 0;
      const old = this.memory.get(key);
      if (old && old.ver === ver) continue;
      const data = new Uint8Array(32 * 32 * 3);
      for (let z = 0; z < 32; z++) for (let x = 0; x < 32; x++) {
        const s = this.surface(col.cx * 32 + x, col.cz * 32 + z, 0, false);
        const c = s ? this.color(s[0]) : [18, 18, 18], k = s ? this.shade(col.cx * 32 + x, col.cz * 32 + z, s[1]) : 1, o = (x + z * 32) * 3;
        data[o] = Math.min(255, c[0] * k); data[o + 1] = Math.min(255, c[1] * k); data[o + 2] = Math.min(255, c[2] * k);
      }
      data.ver = ver;
      this.memory.set(key, data);
      if (++n >= 12) break;
    }
  }
  shade(x, z, y) {
    const nw = this.g.world.heightmapAt(x - 1, z - 1);
    return nw == null ? 1 : 1 + Math.max(-0.35, Math.min(0.35, (y - nw) * 0.09));
  }
  remembered(x, z) {
    const m = this.memory.get(`${this.g.dim}:${x >> 5}:${z >> 5}`);
    if (!m) return null;
    const o = ((x & 31) + (z & 31) * 32) * 3;
    return [m[o], m[o + 1], m[o + 2]];
  }

  color(id) {
    let c = this.colors.get(id);
    if (c) return c;
    const d = BLOCKS[id];
    if (isWater(id)) c = [48, 86, 190];
    else if (isLava(id)) c = [230, 110, 30];
    else if (id === B.Snow || id === B.SnowyGrass) c = [235, 240, 245];
    else if (!d || d.top === 255) c = [120, 120, 120];
    else {
      const a = this.g.layerColor(d.top), tint = d.tint ? [0.72, 0.95, 0.55] : [1, 1, 1];
      c = a.map((v, i) => srgb(v * tint[i] * 1.25));
    }
    this.colors.set(id, c);
    return c;
  }

  /** The surface block and its height at x, z (for the Nether and caves: the floor near the player's level). */
  surface(x, z, py, under) {
    const w = this.g.world;
    if (!under) {
      const h = w.heightmapAt(x, z);
      if (h == null) return null;
      let y = h, id = w.getBlock(x, y, z);
      // water over the ground: show the water
      for (let k = 1; k < 3; k++) { const a = w.getBlock(x, y + k, z); if (isWater(a)) { y += k; id = a; } }
      return [id, y];
    }
    for (let y = py + 3; y > py - 24; y--) {
      const id = w.getBlock(x, y, z);
      if (id < 0) return null;
      if (id !== B.Air && w.getBlock(x, y + 1, z) === B.Air) return [id, y];
    }
    return [B.Bedrock, py - 24];
  }

  /** Draws the terrain round (cx, cz) into ctx: size px, scale blocks per pixel. */
  paint(ctx, size, scale, cx, cz, py, under) {
    const img = ctx.createImageData(size, size), d = img.data, half = size / 2;
    const hs = new Float32Array(size + 1);
    let prevRow = new Float32Array(size).fill(NaN);
    for (let j = 0; j < size; j++) {
      const row = new Float32Array(size);
      for (let i = 0; i < size; i++) {
        const x = Math.floor(cx + (i - half) * scale), z = Math.floor(cz + (j - half) * scale);
        const s = this.surface(x, z, py, under), o = (i + j * size) * 4;
        if (!s) {
          const m = !under && this.remembered(x, z);
          if (m) { d[o] = m[0]; d[o + 1] = m[1]; d[o + 2] = m[2]; } else { d[o] = d[o + 1] = d[o + 2] = 18; }
          d[o + 3] = 255; row[i] = NaN; continue;
        }
        const [id, y] = s, c = this.color(id);
        row[i] = y;
        // hill shading: lit from the north-west
        const nw = i > 0 ? prevRow[i - 1] : NaN;
        let k = Number.isNaN(nw) ? 1 : 1 + Math.max(-0.35, Math.min(0.35, (y - nw) * 0.09 / scale));
        if (isWater(id)) k = 0.85 + Math.min(0.15, (y - (this.g.world.heightmapAt(x, z) ?? y)) * 0.05);
        d[o] = Math.min(255, c[0] * k); d[o + 1] = Math.min(255, c[1] * k); d[o + 2] = Math.min(255, c[2] * k); d[o + 3] = 255;
      }
      prevRow = row;
    }
    void hs;
    ctx.putImageData(img, 0, 0);
  }

  markers(ctx, size, scale, cx, cz, round) {
    const g = this.g, half = size / 2;
    const dot = (x, z, col, r) => {
      const px = half + (x - cx) / scale, pz = half + (z - cz) / scale;
      if (round ? Math.hypot(px - half, pz - half) > half - r : px < 0 || pz < 0 || px > size || pz > size) return null;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, pz, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1; ctx.stroke();
      return [px, pz];
    };
    for (const m of g.mobs.list) {
      if (m.dead) continue;
      const col = m.def.villager ? '#5dff7a' : m.def.kind === 'hostile' ? '#ff4a3a' : m.def.kind === 'neutral' ? '#ffd23a' : '#f4f4f4';
      dot(m.body.pos[0], m.body.pos[2], col, round ? 2.5 : 3);
    }
    for (const wp of this.waypoints()) {
      const p = dot(wp.x, wp.z, wp.color, round ? 4 : 6);
      if (p && !round) { ctx.fillStyle = '#fff'; ctx.font = '13px monospace'; ctx.fillText(wp.name, p[0] + 8, p[1] + 4); }
    }
    // the player: an arrow pointing where they look (north is up)
    const pl = g.player, px = half + (pl.body.pos[0] - cx) / scale, pz = half + (pl.body.pos[2] - cz) / scale;
    ctx.save(); ctx.translate(px, pz); ctx.rotate(-pl.yaw);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    const s = round ? 6 : 8;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.65, s * 0.7); ctx.lineTo(0, s * 0.3); ctx.lineTo(-s * 0.65, s * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /** Structures near the player (villages, outposts, pyramids, igloos, ruined portals, huts), refreshed every few seconds. */
  structures() {
    const g = this.g;
    if (g.dim !== Dim.Overworld || !g.meta || g.meta.flat) return [];
    const p = g.player.body.pos, now = performance.now();
    if (!this.structList || now - this.structT > 3000 || Math.hypot(p[0] - this.structAt[0], p[2] - this.structAt[1]) > 100) {
      const T = terrainFor(g.meta.seed), names = { village: ['Village', '#ffd84a'], outpost: ['Pillager Outpost', '#ff7a4a'], pyramid: ['Desert Pyramid', '#ffe0a0'],
        igloo: ['Igloo', '#bfe8ff'], portal: ['Ruined Portal', '#c07aff'], hut: ['Swamp Hut', '#9ad07a'], well: ['Desert Well', '#ffe0a0'] };
      this.structList = structuresIn(g.meta.seed, T, p[0] - 600, p[2] - 600, p[0] + 600, p[2] + 600).filter((q) => names[q.kind])
        .map((q) => ({ name: names[q.kind][0], color: names[q.kind][1], x: q.x + 0.5, z: q.z + 0.5, kind: 'structure' }));
      this.structT = now; this.structAt = [p[0], p[2]];
    }
    return this.structList;
  }

  waypoints() {
    const g = this.g, m = g.meta || {}, out = [...this.structures()];
    for (const wp of m.waypoints || []) if ((wp.dim || 0) === (g.dim || 0)) out.push(wp);
    if (g.spawn && (g.dim || 0) === 0) out.push({ name: 'Spawn', x: g.spawn[0], z: g.spawn[2], color: '#6ec8ff' });
    return out;
  }

  /** The corner map, redrawn a few times a second. */
  update(dt) {
    const g = this.g;
    if (!g.world || !g.player || !this.canvas) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.3;
    this.memT -= 0.3;
    if (this.memT <= 0) { this.memT = 1.5; this.remember(); }
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true }), size = this.canvas.width;
    const p = g.player.body.pos, under = (g.dim !== Dim.Overworld && g.dim !== 3) || (g.camSky ?? 1) < 0.2;
    this.paint(ctx, size, 1, Math.floor(p[0]), Math.floor(p[2]), Math.floor(p[1]), under);
    // round mask
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    this.markers(ctx, size, 1, Math.floor(p[0]), Math.floor(p[2]), true);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('N', size / 2, 12); ctx.textAlign = 'left';
  }

  /** The full map (M): 2 blocks a pixel round the player. */
  drawBig() {
    const g = this.g, ctx = this.big.getContext('2d', { willReadFrequently: true }), size = this.big.width;
    const p = g.player.body.pos, under = (g.dim !== Dim.Overworld && g.dim !== 3) || (g.camSky ?? 1) < 0.2;
    const scale = this.bigScale || 2;
    this.paint(ctx, size, scale, Math.floor(p[0]), Math.floor(p[2]), Math.floor(p[1]), under);
    this.markers(ctx, size, scale, Math.floor(p[0]), Math.floor(p[2]), false);
  }
}
