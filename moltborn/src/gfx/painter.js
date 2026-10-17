// Pixel painter: shaded, outlined primitives written into a pixel buffer. All Moltborn art is
// painted through this so every sprite shares one pixel scale, one light direction and one
// outline style (dark outline, 4-5 tone ramps with light dithering — the look of the reference art).
import { hash2, clamp } from '../core/util.js';

export const pack = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
export const unpack = (c) => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24];
export function hexToRgb(h) {
  if (typeof h === 'number') return [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  let s = h[0] === '#' ? h.slice(1) : h;
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
export const color = (h, a = 255) => { const [r, g, b] = hexToRgb(h); return pack(r, g, b, a); };
const toColor = (c) => (typeof c === 'number' && c > 0xffffff ? c : color(c));

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
export function hslToRgb(h, s, l) {
  const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [Math.round(f(p, q, h + 1 / 3) * 255), Math.round(f(p, q, h) * 255), Math.round(f(p, q, h - 1 / 3) * 255)];
}
export const rgbHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

// A colour ramp: dark -> light. Accepts hex strings.
export class Ramp {
  constructor(hexes) {
    this.hex = hexes;
    this.n = hexes.length;
    this.c = hexes.map((h) => color(h));
  }
  // hue rotate (0..1), saturation and lightness multipliers → new ramp
  tint(dh = 0, ms = 1, ml = 1) {
    return new Ramp(this.hex.map((h) => {
      const [r, g, b] = hexToRgb(h); let [hh, s, l] = rgbToHsl(r, g, b);
      hh = (hh + dh + 1) % 1; s = clamp(s * ms, 0, 1); l = clamp(l * ml, 0, 1);
      const [rr, gg, bb] = hslToRgb(hh, s, l); return rgbHex(rr, gg, bb);
    }));
  }
  mix(other, t) {
    return new Ramp(this.hex.map((h, i) => {
      const a = hexToRgb(h), b = hexToRgb(other.hex[Math.min(i, other.n - 1)]);
      return rgbHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    }));
  }
  at(i) { return this.c[clamp(Math.round(i), 0, this.n - 1)]; }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
const LIGHT = (() => { const l = [-0.45, -0.7, 0.55]; const m = Math.hypot(...l); return l.map((v) => v / m); })();

export function blendPx(dst, src, a) {
  if (a >= 1) return src;
  const da = dst >>> 24; if (da === 0) return ((Math.round(255 * a) << 24) | (src & 0xffffff)) >>> 0;
  const r = (dst & 255) + ((src & 255) - (dst & 255)) * a;
  const g = ((dst >>> 8) & 255) + (((src >>> 8) & 255) - ((dst >>> 8) & 255)) * a;
  const b = ((dst >>> 16) & 255) + (((src >>> 16) & 255) - ((dst >>> 16) & 255)) * a;
  return pack(r, g, b, da);
}

export class Painter {
  constructor(w, h, outline = '#1a1020') {
    this.w = w; this.h = h;
    this.d = new Uint32Array(w * h);
    this.ol = toColor(outline);
    this._tone = new Float32Array(w * h).fill(-1);
    this._bb = null;
  }
  set(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = toColor(c); }
  get(x, y) { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
  px(x, y, c) { this.set(x, y, c); return this; }
  clear() { this.d.fill(0); return this; }
  rectFlat(x, y, w, h, c) { c = toColor(c); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const X = (x + i) | 0, Y = (y + j) | 0; if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.d[Y * this.w + X] = c; } return this; }
  line(x1, y1, x2, y2, c) {
    c = toColor(c); x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
    const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1), sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x1 >= 0 && y1 >= 0 && x1 < this.w && y1 < this.h) this.d[y1 * this.w + x1] = c;
      if (x1 === x2 && y1 === y2) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x1 += sx; }
      if (e2 <= dx) { err += dx; y1 += sy; }
    }
    return this;
  }
  // alpha-blended pixel
  blend(x, y, c, a) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x; this.d[i] = blendPx(this.d[i], toColor(c), a);
  }
  // stepped (pixel-style) radial glow; adds light-coloured rings with falling alpha
  glow(cx, cy, r, c, a = 0.5, steps = 4) {
    for (let s = 0; s < steps; s++) {
      const rr = r * (1 - s / steps), aa = a / steps;
      for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rr * rr) this.blend(x, y, c, aa);
      }
    }
    return this;
  }

  // ---- shaded shape groups -------------------------------------------------------------
  // fn receives an accumulator with ellipse/capsule/poly/rect; the union is outlined and shaded once.
  shape(ramp, o, fn) {
    const acc = new ShapeAcc(this);
    fn(acc);
    this._flush(acc, ramp, o || {});
    return this;
  }
  ellipse(cx, cy, rx, ry, ramp, o) { return this.shape(ramp, o, (s) => s.ellipse(cx, cy, rx, ry)); }
  capsule(x1, y1, x2, y2, r1, r2, ramp, o) { return this.shape(ramp, o, (s) => s.capsule(x1, y1, x2, y2, r1, r2)); }
  poly(pts, ramp, o) { return this.shape(ramp, o, (s) => s.poly(pts)); }
  rect(x, y, w, h, ramp, o) { return this.shape(ramp, o, (s) => s.rect(x, y, w, h)); }
  // polyline of tapered capsules as ONE shape (no inner outlines), e.g. a limb or tentacle
  chain(pts, r1, r2, ramp, o) {
    return this.shape(ramp, o, (s) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
        s.capsule(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r1 + (r2 - r1) * t0, r1 + (r2 - r1) * t1);
      }
    });
  }

  _flush(acc, ramp, o) {
    const { x0, y0, x1, y1 } = acc.bb;
    if (x1 < x0) return;
    const w = this.w, tone = this._tone, d = this.d;
    const outline = o.outline === false ? null : o.outline !== undefined && o.outline !== true ? toColor(o.outline) : this.ol;
    if (outline !== null) {
      for (let y = Math.max(0, y0 - 1); y <= Math.min(this.h - 1, y1 + 1); y++) for (let x = Math.max(0, x0 - 1); x <= Math.min(w - 1, x1 + 1); x++) {
        const i = y * w + x;
        if (tone[i] >= 0) continue;
        if ((x > 0 && tone[i - 1] >= 0) || (x < w - 1 && tone[i + 1] >= 0) || (y > 0 && tone[i - w] >= 0) || (y < this.h - 1 && tone[i + w] >= 0)) d[i] = outline;
      }
    }
    const n = ramp.n, dith = o.dither === undefined ? 0.42 : o.dither, bias = o.bias || 0, contrast = o.contrast || 1;
    const flat = o.flat;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= this.h) continue;
      const i = y * w + x, t = tone[i];
      if (t < 0) continue;
      let idx;
      if (flat !== undefined) idx = flat;
      else {
        const tt = clamp((t - 0.5) * contrast + 0.5 + bias, 0, 1);
        idx = clamp(Math.round(tt * (n - 1) + BAYER[(y & 3) * 4 + (x & 3)] * dith), 0, n - 1);
      }
      d[i] = o.shade ? o.shade(x, y, idx, ramp) : ramp.c[idx];
      tone[i] = -1;
    }
    // clear any leftover mask in the expanded box
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) tone[y * w + x] = -1;
    if (o.texture) this.texture(ramp, o.texture.seed || 1, o.texture.p || 0.12, x0, y0, x1, y1);
  }

  // randomly step pixels of a ramp up/down a tone for a speckled, hand-dithered texture
  texture(ramp, seed = 1, p = 0.12, x0 = 0, y0 = 0, x1 = this.w - 1, y1 = this.h - 1) {
    const idxOf = new Map(ramp.c.map((c, i) => [c, i]));
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) {
      const i = y * this.w + x, k = idxOf.get(this.d[i]);
      if (k === undefined) continue;
      const r = hash2(x, y, seed);
      if (r < p) this.d[i] = ramp.c[clamp(k + (hash2(x, y, seed + 9) < 0.5 ? -1 : 1), 0, ramp.n - 1)];
    }
    return this;
  }

  // silhouette outline around everything currently painted (draws only into empty pixels)
  outlineAll(c) {
    const col = c ? toColor(c) : this.ol, w = this.w, h = this.h, d = this.d, src = d.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (src[i] >>> 24) continue;
      if ((x > 0 && src[i - 1] >>> 24) || (x < w - 1 && src[i + 1] >>> 24) || (y > 0 && src[i - w] >>> 24) || (y < h - 1 && src[i + w] >>> 24)) d[i] = col;
    }
    return this;
  }

  toCanvas() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.d);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

class ShapeAcc {
  constructor(p) { this.p = p; this.bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }; }
  _grow(x0, y0, x1, y1) {
    const b = this.bb; b.x0 = Math.min(b.x0, Math.floor(x0)); b.y0 = Math.min(b.y0, Math.floor(y0));
    b.x1 = Math.max(b.x1, Math.ceil(x1)); b.y1 = Math.max(b.y1, Math.ceil(y1));
  }
  _put(x, y, t) {
    const p = this.p; if (x < 0 || y < 0 || x >= p.w || y >= p.h) return;
    p._tone[y * p.w + x] = t;
  }
  _lambert(nx, ny) {
    const r2 = nx * nx + ny * ny; const nz = Math.sqrt(Math.max(0, 1 - r2));
    return clamp(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0, 1);
  }
  ellipse(cx, cy, rx, ry) {
    this._grow(cx - rx, cy - ry, cx + rx, cy + ry);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) this._put(x, y, this._lambert(nx, ny));
    }
    return this;
  }
  capsule(x1, y1, x2, y2, r1, r2) {
    const mr = Math.max(r1, r2);
    this._grow(Math.min(x1, x2) - mr, Math.min(y1, y2) - mr, Math.max(x1, x2) + mr, Math.max(y1, y2) + mr);
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1e-6;
    for (let y = Math.floor(Math.min(y1, y2) - mr); y <= Math.ceil(Math.max(y1, y2) + mr); y++) for (let x = Math.floor(Math.min(x1, x2) - mr); x <= Math.ceil(Math.max(x1, x2) + mr); x++) {
      const px = x + 0.5, py = y + 0.5;
      const t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
      const cx = x1 + dx * t, cy = y1 + dy * t, r = r1 + (r2 - r1) * t;
      const ox = (px - cx) / r, oy = (py - cy) / r;
      if (ox * ox + oy * oy <= 1) this._put(x, y, this._lambert(ox, oy));
    }
    return this;
  }
  rect(x, y, w, h, round = 0) {
    this._grow(x, y, x + w, y + h);
    const cx = x + w / 2, cy = y + h / 2;
    for (let j = Math.floor(y); j < Math.ceil(y + h); j++) for (let i = Math.floor(x); i < Math.ceil(x + w); i++) {
      let nx = (i + 0.5 - cx) / (w / 2), ny = (j + 0.5 - cy) / (h / 2);
      nx = clamp(nx, -1, 1) * 0.75; ny = clamp(ny, -1, 1) * 0.75; // flatter shading on boxes
      this._put(i, j, this._lambert(nx, ny));
    }
    return this;
  }
  poly(pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, sx = 0, sy = 0;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); sx += x; sy += y; }
    this._grow(x0, y0, x1, y1);
    const cx = sx / pts.length, cy = sy / pts.length, rx = Math.max(1, (x1 - x0) / 2), ry = Math.max(1, (y1 - y0) / 2);
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const py = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py)) xs.push(a[0] + ((py - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x < Math.ceil(xs[k + 1] - 0.5); x++) {
          const nx = clamp((x + 0.5 - cx) / rx, -1, 1) * 0.8, ny = clamp((py - cy) / ry, -1, 1) * 0.8;
          this._put(x, y, this._lambert(nx, ny));
        }
      }
    }
    return this;
  }
}

// ---- sprite helpers --------------------------------------------------------------------
export function makeSprite(w, h, ax, ay, paint, outline) {
  const p = new Painter(w, h, outline);
  paint(p);
  return { canvas: p.toCanvas(), w, h, ax, ay, _flash: null };
}
// white silhouette used for hit flashes
export function flashOf(spr, c = '#ffffff') {
  if (spr._flash && spr._flashC === c) return spr._flash;
  const cv = document.createElement('canvas'); cv.width = spr.canvas.width; cv.height = spr.canvas.height;
  const g = cv.getContext('2d'); g.drawImage(spr.canvas, 0, 0);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = c; g.fillRect(0, 0, cv.width, cv.height);
  spr._flash = cv; spr._flashC = c; return cv;
}
// Horizontal row-shear: sways a sprite pixel-perfectly (tips move most, base stays planted).
export function shear(canvas, amp, baseY = canvas.height - 1) {
  const cv = document.createElement('canvas'); cv.width = canvas.width + Math.ceil(Math.abs(amp)) * 2; cv.height = canvas.height;
  const g = cv.getContext('2d'); const pad = Math.ceil(Math.abs(amp));
  for (let y = 0; y < canvas.height; y++) {
    const k = Math.max(0, (baseY - y) / Math.max(1, baseY));
    const off = Math.round(amp * k * k);
    g.drawImage(canvas, 0, y, canvas.width, 1, pad + off, y, canvas.width, 1);
  }
  cv.pad = pad; return cv;
}
export function mirrorCanvas(canvas) {
  const cv = document.createElement('canvas'); cv.width = canvas.width; cv.height = canvas.height;
  const g = cv.getContext('2d'); g.translate(cv.width, 0); g.scale(-1, 1); g.drawImage(canvas, 0, 0); return cv;
}
