// Surface maps from colour alone (the JavaScript twin of build_lbpr.py's surface_maps): height from luminance (detail plus
// broad high-pass), a tangent-space normal, cavity AO and roughness. Used for textures that ship without normal or
// specular maps (the block catalog, resource packs without PBR maps). Wrap-around filtering: textures tile.

/** Box blur of a size x size float image with wrap-around, three passes (close to a gaussian of the given sigma). */
function blur(src, size, sigma) {
  const r = Math.max(1, Math.round(sigma * 0.9));
  let a = src, b = new Float32Array(src.length);
  const w = 2 * r + 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < size; y++) {         // horizontal
      const row = y * size;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[row + ((k % size) + size) % size];
      for (let x = 0; x < size; x++) {
        b[row + x] = acc / w;
        acc += a[row + ((x + r + 1) % size)] - a[row + ((x - r) % size + size) % size];
      }
    }
    [a, b] = [b, a === src ? new Float32Array(src.length) : a];
    for (let x = 0; x < size; x++) {         // vertical
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[(((k % size) + size) % size) * size + x];
      for (let y = 0; y < size; y++) {
        b[y * size + x] = acc / w;
        acc += a[((y + r + 1) % size) * size + x] - a[(((y - r) % size + size) % size) * size + x];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

/**
 * rgba: Uint8Array size*size*4 (one texture). opts: { cutout, normal (strength), rough (base), emission (0..1 threshold or null) }.
 * Writes into the given offsets of albedo (alpha = height unless cutout), normal and mask (AO, roughness, metal, emission).
 */
export function surfaceMaps(rgba, size, opts, outA, outN, outM, off) {
  const n = size * size;
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4] / 255, g = rgba[i * 4 + 1] / 255, b = rgba[i * 4 + 2] / 255, a = rgba[i * 4 + 3] / 255;
    L[i] = (r * 0.2126 + g * 0.7152 + b * 0.0722) * (opts.cutout ? 0.6 : 1) + (opts.cutout ? a * 0.4 : 0);
  }
  const b1 = blur(L, size, size / 10), b2 = blur(L, size, size / 3);
  const hs = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) { hs[i] = (L[i] - b1[i]) * 0.65 + (L[i] - b2[i]) * 0.35; mean += hs[i]; }
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (hs[i] - mean) ** 2;
  const sd = Math.sqrt(v / n) + 1e-5;
  const h = blur(hs.map((x) => x), size, 0.7);
  for (let i = 0; i < n; i++) h[i] = Math.min(1, Math.max(0, 0.62 + 0.19 * (h[i] - mean) / sd));
  const cav = blur(h, size, size / 24);
  const s = (opts.normal ?? 1.5) * size / 128 * 2;
  const rough = opts.rough ?? 0.85;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, o = off + i * 4;
    const dx = (h[y * size + (x + 1) % size] - h[y * size + (x + size - 1) % size]) * s;
    const dy = (h[((y + 1) % size) * size + x] - h[((y + size - 1) % size) * size + x]) * s;
    const len = Math.hypot(dx, dy, 1);
    outN[o] = (-dx / len * 0.5 + 0.5) * 255; outN[o + 1] = (dy / len * 0.5 + 0.5) * 255; outN[o + 2] = (1 / len * 0.5 + 0.5) * 255; outN[o + 3] = 255;
    outA[o] = rgba[i * 4]; outA[o + 1] = rgba[i * 4 + 1]; outA[o + 2] = rgba[i * 4 + 2];
    outA[o + 3] = opts.cutout ? rgba[i * 4 + 3] : Math.max(1, h[i] * 255);
    const ao = Math.min(1, Math.max(0.3, 1 - Math.max(0, cav[i] - h[i]) * 2.2));
    let em = 0;
    if (opts.emission != null) em = Math.min(1, Math.max(0, (L[i] - opts.emission) / Math.max(0.05, 1 - opts.emission) * 1.6));
    outM[o] = ao * 255; outM[o + 1] = Math.min(1, Math.max(0.04, rough + (0.5 - h[i]) * 0.2)) * 255; outM[o + 2] = 0; outM[o + 3] = em * 255;
  }
}
