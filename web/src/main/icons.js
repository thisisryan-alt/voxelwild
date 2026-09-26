// Item icons (Unity Gameplay.ItemIcons): block icons are isometric cubes drawn from the real block textures, plants
// and torches are their sprite, materials/tools are drawn as small pixel-art shapes. Packed into one atlas used by the
// HUD (CSS background) and by the renderer (dropped items and the held item).
import { ITEMS, BLOCKS, Kind, Shape, LAYER_TUNING, NONE, I, ToolType } from '../shared/blocks.js';

const CELL = 64, COLS = 8;

export class Icons {
  /** opts: { tuning (per-layer, default the built-in), items: Map item id -> image (resource-pack item textures) } */
  constructor(albedoBitmap, opts = {}) {
    this.tuning = opts.tuning || LAYER_TUNING;
    this.itemImages = opts.items || null;
    this.ids = Object.keys(ITEMS).map(Number).sort((a, b) => a - b);
    const rows = Math.ceil(this.ids.length / COLS);
    this.canvas = document.createElement('canvas');
    this.canvas.width = CELL * COLS; this.canvas.height = CELL * rows;
    this.index = new Map(this.ids.map((id, i) => [id, i]));
    this.layerAvg = [];
    this.thumbs = albedoBitmap ? this.makeThumbs(albedoBitmap, opts.thumb) : null;
    const ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    for (const id of this.ids) {
      const i = this.index.get(id), x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL;
      ctx.save(); ctx.translate(x, y);
      try { this.draw(ctx, id); } catch (e) { console.warn('icon', id, e); }
      ctx.restore();
    }
    // a short blob: URL (a data: URL of the whole atlas repeated in every slot's CSS grows past string limits)
    const data = atob(this.canvas.toDataURL('image/png').split(',')[1]), bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
    this.url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  }

  /** 64px tinted thumbnails of every texture layer, plus the average colour (linear) for particles. */
  /** thumb(l): [image, sx, sy, sw, sh] of a layer's picture, or null to read layer l of the vertical strip bmp. */
  makeThumbs(bmp, thumb) {
    const size = bmp.width, T = 64;
    const n = thumb ? this.tuning.length : Math.min(Math.round(bmp.height / size), this.tuning.length);
    const c = document.createElement('canvas'); c.width = T; c.height = T * n;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    if (thumb) for (let l = 0; l < n; l++) { const s = thumb(l); if (s) x.drawImage(s[0], s[1], s[2], s[3], s[4], 0, l * T, T, T); }
    else x.drawImage(bmp, 0, 0, size, size * n, 0, 0, T, T * n);
    const img = x.getImageData(0, 0, T, T * n), d = img.data;
    const thumbs = [];
    for (let l = 0; l < n; l++) {
      const t = this.tuning[l] || LAYER_TUNING[0];
      const k = t.tint.map((v) => Math.pow(v, 1 / 2.2));
      const cutout = t.cutout > 0;
      const sum = [0, 0, 0]; let cnt = 0;
      for (let p = l * T * T * 4; p < (l + 1) * T * T * 4; p += 4) {
        for (let ch = 0; ch < 3; ch++) d[p + ch] = Math.min(255, d[p + ch] * k[ch]);
        if (!cutout) d[p + 3] = 255;
        else d[p + 3] = d[p + 3] > 110 ? 255 : 0;
        if (d[p + 3] > 0) { for (let ch = 0; ch < 3; ch++) sum[ch] += Math.pow(d[p + ch] / 255, 2.2); cnt++; }
      }
      this.layerAvg[l] = sum.map((s) => s / Math.max(1, cnt));
      const tc = document.createElement('canvas'); tc.width = T; tc.height = T;
      tc.getContext('2d').putImageData(new ImageData(d.slice(l * T * T * 4, (l + 1) * T * T * 4), T, T), 0, 0);
      thumbs.push(tc);
    }
    return thumbs;
  }

  /** UV rect [u, v, w, h] of an item icon in the atlas. */
  rect(id) {
    const i = this.index.get(id) ?? 0, W = this.canvas.width, H = this.canvas.height;
    return [(i % COLS) * CELL / W, Math.floor(i / COLS) * CELL / H, CELL / W, CELL / H];
  }
  /** CSS for a slot of the given pixel size. */
  css(id, px) {
    const i = this.index.get(id) ?? 0, k = px / CELL;
    return `background-image:url(${this.url});background-size:${this.canvas.width * k}px ${this.canvas.height * k}px;background-position:${-(i % COLS) * CELL * k}px ${-Math.floor(i / COLS) * CELL * k}px`;
  }

  draw(ctx, id) {
    const def = ITEMS[id];
    const img = this.itemImages && this.itemImages.get(id);
    if (img) { ctx.imageSmoothingEnabled = true; ctx.drawImage(img, 2, 2, CELL - 4, CELL - 4); return; }
    if (def.kind === Kind.Block) {
      const b = BLOCKS[def.block];
      if (this.thumbs && (b.shape === Shape.Cube || b.shape === Shape.Cutout)) return this.cube(ctx, b);
      if (this.thumbs) {
        const layer = b.shape === Shape.Torch ? b.side : b.side;
        ctx.imageSmoothingEnabled = false;
        if (b.shape === Shape.Torch) { ctx.drawImage(this.thumbs[layer], 26, 0, 12, 64, 26, 4, 12, 56); return; }
        ctx.drawImage(this.thumbs[layer], 4, 4, 56, 56);
        return;
      }
    }
    this.material(ctx, id, def);
  }

  cube(ctx, b) {
    const top = this.thumbs[b.top], side = this.thumbs[b.side];
    const s = 22;   // half-width of the iso cube
    const cx = 32, cy = 31;
    ctx.imageSmoothingEnabled = true;
    const face = (img, m, shade, overlay) => {
      ctx.save();
      ctx.transform(...m);
      ctx.beginPath(); ctx.rect(0, 0, 64, 64); ctx.clip();
      ctx.drawImage(img, 0, 0, 64, 64);
      if (overlay != null) {
        // grass/snow side: the top texture spills over the upper edge
        ctx.drawImage(this.thumbs[overlay], 0, 0, 64, 64 * 0.22, 0, 0, 64, 64 * 0.22);
      }
      ctx.fillStyle = `rgba(0,0,0,${shade})`; ctx.fillRect(0, 0, 64, 64);
      ctx.restore();
    };
    const k = s / 64;
    // top: rhombus; map unit square (0..64) to the diamond
    face(top, [k, k * 0.5, -k, k * 0.5, cx, cy - s], 0, null);
    // left and right faces
    const ov = b.overlay !== NONE ? b.overlay : null;
    face(side, [k, k * 0.5, 0, k * 1.1, cx - s, cy - s * 0.5 + 0.5], 0.28, ov);
    face(side, [k, -k * 0.5, 0, k * 1.1, cx, cy + 0.5], 0.46, ov);
  }

  material(ctx, id, def) {
    const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x * 4, y * 4, w * 4, h * 4); };
    const blob = (cols, spots) => {
      // irregular lump on the 16x16 grid
      const shape = ['0000011111000000', '0001122221110000', '0011222222211000', '0112222222221100', '0122222222222100', '1122222222222110',
        '1222222222222210', '1222222222222210', '1222222222222210', '1122222222222210', '0122222222222110', '0112222222221100', '0011222222211000',
        '0001112222110000', '0000011111000000', '0000000000000000'];
      shape.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '0') px(x, y + 1, 1, 1, ch === '1' ? cols[0] : cols[1]); }));
      for (const [x, y, c] of spots) px(x, y, 2, 2, c);
    };
    const handle = () => { for (let i = 0; i < 9; i++) px(2 + i, 13 - i, 2, 2, i % 3 === 0 ? '#5b3d1f' : '#7a5530'); };
    const matCol = (tier) => [['#8a6a3d', '#b48a52'], ['#6d6d6d', '#9a9a9a'], ['#b8b8b8', '#eeeeee'], ['#2fb5a8', '#8ff5ea']][tier - 1];
    switch (id) {
      case I.Stick: for (let i = 0; i < 12; i++) px(2 + i, 13 - i, 2, 2, i % 4 === 0 ? '#5b3d1f' : '#8a6238'); return;
      case I.Coal: return blob(['#151515', '#2e2e2e'], [[5, 5, '#474747'], [9, 8, '#3a3a3a']]);
      case I.IronChunk: return blob(['#8f7d6c', '#c9b8a6'], [[5, 5, '#e8d9cc'], [9, 9, '#a8927c']]);
      case I.GoldChunk: return blob(['#b8860b', '#f5cf47'], [[5, 5, '#fff2a6'], [9, 9, '#d9a520']]);
      case I.Diamond: {
        const rows = ['0000011111100000', '0000122222210000', '0001223333221000', '0012233333322100', '0122333443332210', '0012233443322100',
          '0001223333221000', '0000122332210000', '0000012222100000', '0000001221000000', '0000000110000000'];
        const cc = { 1: '#0f6f6a', 2: '#2fd1c1', 3: '#8ff5ea', 4: '#ffffff' };
        rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '0') px(x, y + 3, 1, 1, cc[ch]); }));
        return;
      }
      case I.Apple: {
        blob(['#7d0f0f', '#d42a2a'], [[5, 5, '#ff8080']]);
        px(7, 0, 1, 3, '#5b3d1f'); px(8, 1, 3, 2, '#3f8f2f');
        return;
      }
      case I.Berries: {
        for (const [x, y] of [[4, 6], [8, 5], [6, 9], [10, 9], [7, 12]]) { px(x, y, 3, 3, '#5a1840'); px(x, y, 2, 2, '#9c2a6c'); px(x, y, 1, 1, '#e07ab0'); }
        px(7, 2, 5, 2, '#3f8f2f'); return;
      }
    }
    if (def.kind === Kind.Tool) {
      const [dark, light] = matCol(def.tier);
      handle();
      if (def.tool === ToolType.Pickaxe) {
        // a curved head centred on the handle's tip, bulging away from it
        const outer = [[4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 2], [10, 2], [11, 3], [12, 4], [13, 5], [13, 6], [14, 7], [14, 8], [14, 9], [14, 10]];
        const inner = [[5, 2], [6, 2], [7, 2], [8, 2], [9, 3], [10, 3], [11, 4], [12, 5], [12, 6], [13, 7], [13, 8], [13, 9]];
        for (const [x, y] of outer) px(x, y, 1, 1, light);
        for (const [x, y] of inner) px(x, y, 1, 1, dark);
      } else if (def.tool === ToolType.Axe) {
        for (let y = 1; y < 8; y++) px(7, y, 5 - Math.abs(4 - y) + 2, 1, y < 3 ? light : dark);
        px(12, 2, 1, 5, light);
      } else if (def.tool === ToolType.Shovel) {
        for (let y = 0; y < 6; y++) px(10 + (y > 2 ? 0 : 1), y, 4 - (y === 0 || y === 5 ? 1 : 0), 1, y < 2 ? light : dark);
        px(11, 1, 3, 4, light); px(12, 2, 1, 2, dark);
      }
      return;
    }
    ctx.fillStyle = '#f0f'; ctx.fillRect(16, 16, 32, 32);
  }
}
