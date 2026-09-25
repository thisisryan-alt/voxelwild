// Minecraft Java resource packs (e.g. photorealistic LabPBR packs) as the game's block materials.
// The pack stays in the player's browser: it is read from the ZIP they choose, converted here, and kept in
// IndexedDB; nothing of it is part of the published page.
//
// Per block texture the pack may have <name>.png (colour; alpha = opacity for leaves/plants), <name>_n.png
// (LabPBR: RG normal, B AO, A height for POM; "old PBR": RGB normal, A height) and <name>_s.png (LabPBR:
// R smoothness, G F0 / metal >= 230, A emission; old PBR: R smoothness, G metalness, B emission).
// Output: the three texture-array strips the renderer uses (albedo: rgb + opacity or height; normal: xyz;
// mask: AO, roughness, metal, emission) plus per-layer tuning for one-texture-per-block mapping.
import { LAYER_NAMES, LAYER_TUNING } from '../shared/blocks.js';
import { listZip, readEntry } from './zip.js';

// game layer -> Minecraft texture names (1.13+ first, then older names)
export const PACK_NAMES = {
  Stone: ['stone'], Dirt: ['dirt'], GrassTop: ['grass_block_top', 'grass_top'], Sand: ['sand'], Gravel: ['gravel'], Snow: ['snow'],
  Bedrock: ['bedrock'], Cobblestone: ['cobblestone'], Planks: ['oak_planks', 'planks_oak'], Bricks: ['bricks', 'brick'],
  OakLog: ['oak_log', 'log_oak'], BirchLog: ['birch_log', 'log_birch'], SpruceLog: ['spruce_log', 'log_spruce'], JungleLog: ['jungle_log', 'log_jungle'],
  LogTop: ['oak_log_top', 'log_oak_top'], Leaves: ['oak_leaves', 'leaves_oak'], Needles: ['spruce_leaves', 'leaves_spruce'],
  Sandstone: ['sandstone', 'sandstone_normal'], RedSandstone: ['red_sandstone', 'red_sandstone_normal'], Mud: ['mud'], Moss: ['moss_block'],
  Ice: ['ice'], CoalOre: ['coal_ore'], IronOre: ['iron_ore'], GoldOre: ['gold_ore'], DiamondOre: ['diamond_ore'],
  GrassTuft: ['short_grass', 'grass', 'tallgrass'], FlowerRed: ['poppy', 'flower_rose'], FlowerYellow: ['dandelion', 'flower_dandelion'],
  DeadBush: ['dead_bush', 'deadbush'],
  // Glowcap, Torch and Cactus keep the game's own art: Minecraft's versions are shaped for different models
};
// Minecraft paints these grey and tints them with the biome colour map; a grey pack texture gets the default tint
const MC_TINT = { GrassTop: [0x91, 0xbd, 0x59], GrassTuft: [0x91, 0xbd, 0x59], Leaves: [0x77, 0xab, 0x2f], Needles: [0x61, 0x99, 0x61] };

export const MAX_RES = 512;

// ---------------------------------------------------------------- built-in packs (assets/packs.json)

/**
 * Fetches one of the packs that ship with the page (built by web/tools/build_packs.py) and returns it in the
 * same shape readPackZip gives, with the textures already decoded: colour strip -> <name>, and for PBR packs
 * the greyscale data strip's columns (normal x/y, AO, height, smoothness, F0) -> <name>_n and <name>_s.
 */
export async function fetchBuiltinPack(assetBase, id) {
  const list = await (await fetch(assetBase + 'packs.json')).json();
  const def = list.find((p) => p.id === id);
  if (!def) throw new Error(`No built-in pack "${id}"`);
  const bitmap = async (file) => {
    const res = await fetch(assetBase + file);
    if (!res.ok) throw new Error(`Could not load ${file} (${res.status})`);
    return decodeLarge(await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }));
  };
  const S = def.size, T = S * S * 4;
  const color = await bitmap(def.strips.color);
  const data = def.strips.data ? await bitmap(def.strips.data) : null;
  const ch = def.dataChannels || [];
  const images = {};
  def.names.forEach((name, i) => {
    images[name] = { w: S, h: S, data: color.data.slice(i * T, (i + 1) * T) };
    if (!data) return;
    const n = new Uint8Array(T), sp = new Uint8Array(T), W = data.w;
    const col = (k) => ch.indexOf(k) * S;
    for (let y = 0; y < S; y++) {
      const row = (i * S + y) * W;
      for (let x = 0; x < S; x++) {
        const o = (x + y * S) * 4, at = (c) => data.data[(row + col(c) + x) * 4];
        n[o] = at('nx'); n[o + 1] = at('ny'); n[o + 2] = at('ao'); n[o + 3] = at('height');
        sp[o] = at('smooth'); sp[o + 1] = at('f0'); sp[o + 2] = 0; sp[o + 3] = 255;
      }
    }
    images[`${name}_n`] = { w: S, h: S, data: n };
    images[`${name}_s`] = { w: S, h: S, data: sp };
  });
  return { name: def.name, description: def.description, credit: def.credit, builtin: def.id, images, opts: def.opts, icon: null };
}

/** The list of built-in packs (id, name, description, credit), or [] when the page ships none. */
export async function listBuiltinPacks(assetBase) {
  try { const r = await fetch(assetBase + 'packs.json'); return r.ok ? await r.json() : []; } catch { return []; }
}

// ---------------------------------------------------------------- reading

/** Reads the block textures (+ _n/_s maps, pack.mcmeta, pack.png) out of a pack ZIP. */
export async function readPackZip(buffer, fileName) {
  const bytes = new Uint8Array(buffer);
  const entries = listZip(bytes);
  const files = {};
  let base = null, meta = null, icon = null;
  const wanted = new Set();
  for (const names of Object.values(PACK_NAMES)) for (const n of names) { wanted.add(n); wanted.add(`${n}_n`); wanted.add(`${n}_s`); }
  for (const [path, e] of entries) {
    const m = /^(.*?)assets\/minecraft\/textures\/blocks?\/([^/]+)\.png$/i.exec(path);
    if (m && wanted.has(m[2].toLowerCase()) && !files[m[2].toLowerCase()]) { files[m[2].toLowerCase()] = await readEntry(bytes, e); base = m[1]; }
  }
  if (!Object.keys(files).length) throw new Error('No Minecraft block textures found in this ZIP. Choose a Java Edition resource pack.');
  const metaEntry = entries.get(`${base}pack.mcmeta`), iconEntry = entries.get(`${base}pack.png`);
  if (metaEntry) { try { meta = JSON.parse(new TextDecoder().decode(await readEntry(bytes, metaEntry))); } catch { /* optional */ } }
  if (iconEntry) icon = await readEntry(bytes, iconEntry);
  let desc = meta && meta.pack && meta.pack.description;
  if (Array.isArray(desc)) desc = desc.map((d) => (typeof d === 'string' ? d : d.text || '')).join('');
  else if (desc && typeof desc === 'object') desc = desc.text || '';
  return { name: fileName.replace(/\.zip$/i, ''), description: (desc || '').replace(/§./g, ''), files, icon };
}

// ---------------------------------------------------------------- decoding (exact, straight alpha)

let dec = null;
function decoder() {
  if (dec) return dec;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
  const gl = c.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is needed to read the pack.');
  dec = { gl, tex: gl.createTexture(), fb: gl.createFramebuffer() };
  return dec;
}
/** PNG bytes -> { w, h, data: Uint8Array RGBA, rows top-down } without premultiplying alpha (heights live there). */
export async function decodePNG(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  return decodeBitmap(bmp);
}
/**
 * Like decodeBitmap, for images of any size: taller than the GPU's texture limit (8192 on many GPUs; the game's
 * texture strips are ~9000-11000 px tall) it decodes horizontal bands and joins them.
 */
export async function decodeLarge(bmp) {
  const { gl } = decoder();
  const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (bmp.height <= max && bmp.width <= max) return decodeBitmap(bmp);
  if (bmp.width > max) throw new Error(`Image is ${bmp.width} px wide; this GPU allows ${max}.`);
  const w = bmp.width, h = bmp.height, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += max) {
    const band = await createImageBitmap(bmp, 0, y, w, Math.min(max, h - y), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    data.set(decodeBitmap(band).data, y * w * 4);
    band.close && band.close();
  }
  return { w, h, data };
}
export function decodeBitmap(bmp) {
  const { gl, tex, fb } = decoder();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const data = new Uint8Array(bmp.width * bmp.height * 4);
  gl.readPixels(0, 0, bmp.width, bmp.height, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { w: bmp.width, h: bmp.height, data };
}

/** Square frame (animated textures are vertical strips: first frame) resampled to R x R, bilinear, wrapping. */
function square(img, R) {
  const s = img.w, src = img.data, out = new Uint8Array(R * R * 4);
  if (s === R) { out.set(src.subarray(0, R * R * 4)); return out; }
  const k = s / R;
  for (let y = 0; y < R; y++) {
    const fy = (y + 0.5) * k - 0.5, y0 = Math.floor(fy), ty = fy - y0;
    const ya = ((y0 % s) + s) % s, yb = (ya + 1) % s;
    for (let x = 0; x < R; x++) {
      const fx = (x + 0.5) * k - 0.5, x0 = Math.floor(fx), tx = fx - x0;
      const xa = ((x0 % s) + s) % s, xb = (xa + 1) % s;
      const o = (x + y * R) * 4, a = (xa + ya * s) * 4, b = (xb + ya * s) * 4, c = (xa + yb * s) * 4, d = (xb + yb * s) * 4;
      for (let ch = 0; ch < 4; ch++) {
        const top = src[a + ch] + (src[b + ch] - src[a + ch]) * tx, bot = src[c + ch] + (src[d + ch] - src[c + ch]) * tx;
        out[o + ch] = Math.round(top + (bot - top) * ty);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- conversion

/**
 * pack: from readPackZip. builtin: { albedo, normal, mask } decoded strips of the game's own textures.
 * opts: { normalYDown: LabPBR normals are DirectX-style (green = down), oldPbr: SEUS-style specular }.
 */
export async function convertPack(pack, builtin, opts = {}) {
  const n = LAYER_NAMES.length;
  const found = [], layers = [];
  let res = 0;
  for (let i = 0; i < n; i++) {
    const names = PACK_NAMES[LAYER_NAMES[i]] || [];
    // built-in packs arrive already decoded (pack.images); a player's ZIP as PNG bytes (pack.files)
    const has = (nm) => !!((pack.images && pack.images[nm]) || (pack.files && pack.files[nm]));
    const get = async (nm) => (pack.images && pack.images[nm]) || (pack.files && pack.files[nm] ? decodePNG(pack.files[nm]) : null);
    const name = names.find(has);
    if (!name) { layers.push(null); continue; }
    const albedo = await get(name);
    const normal = await get(`${name}_n`);
    const spec = await get(`${name}_s`);
    layers.push({ name, albedo, normal, spec });
    found.push(LAYER_NAMES[i]);
    res = Math.max(res, albedo.w);
  }
  if (!found.length) throw new Error('None of the textures the game uses are in this pack.');
  // array resolution: the pack's own (at least the built-in 256, at most 512 to fit GPU memory)
  const R = Math.min(MAX_RES, Math.max(256, 1 << Math.ceil(Math.log2(res))));
  const L = R * R * 4, A = new Uint8Array(L * n), N = new Uint8Array(L * n), M = new Uint8Array(L * n);
  const tuning = LAYER_TUNING.map((t) => ({ ...t, tint: [...t.tint] }));
  const bs = builtin.size;
  for (let i = 0; i < n; i++) {
    const lay = layers[i], o = i * L;
    if (!lay) {
      // the game's own texture for this layer
      for (const [dst, src] of [[A, builtin.albedo], [N, builtin.normal], [M, builtin.mask]]) {
        dst.set(square({ w: bs, h: bs, data: src.subarray(i * bs * bs * 4, (i + 1) * bs * bs * 4) }, R), o);
      }
      continue;
    }
    const t = tuning[i], cutout = t.cutout > 0;
    const a = square(lay.albedo, R);
    const nm = lay.normal ? square(lay.normal, R) : null;
    const sp = lay.spec ? square(lay.spec, R) : null;
    // grey textures meant for Minecraft's biome tint get its default colour
    let tint = null;
    if (MC_TINT[LAYER_NAMES[i]]) {
      let sat = 0, cnt = 0;
      for (let p = 0; p < L; p += 16) { if (a[p + 3] < 128) continue; const mx = Math.max(a[p], a[p + 1], a[p + 2]), mn = Math.min(a[p], a[p + 1], a[p + 2]); sat += mx ? (mx - mn) / mx : 0; cnt++; }
      if (cnt && sat / cnt < 0.15) tint = MC_TINT[LAYER_NAMES[i]].map((v) => v / 255);
    }
    let emissive = false;
    for (let p = 0; p < L; p += 4) {
      const q = o + p;
      A[q] = tint ? a[p] * tint[0] : a[p]; A[q + 1] = tint ? a[p + 1] * tint[1] : a[p + 1]; A[q + 2] = tint ? a[p + 2] * tint[2] : a[p + 2];
      A[q + 3] = cutout ? a[p + 3] : nm ? Math.max(1, nm[p + 3]) : 255;
      if (nm) {
        const x = nm[p] / 127.5 - 1, y = (nm[p + 1] / 127.5 - 1) * (opts.normalYDown ? -1 : 1);
        const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
        N[q] = (x * 0.5 + 0.5) * 255; N[q + 1] = (y * 0.5 + 0.5) * 255; N[q + 2] = (z * 0.5 + 0.5) * 255; N[q + 3] = 255;
        M[q] = opts.oldPbr ? 255 : nm[p + 2];
      } else { N[q] = 128; N[q + 1] = 128; N[q + 2] = 255; N[q + 3] = 255; M[q] = 255; }
      if (sp) {
        const smooth = sp[p] / 255;
        M[q + 1] = (1 - smooth) * (1 - smooth) * 255;
        if (opts.oldPbr) { M[q + 2] = sp[p + 1]; M[q + 3] = sp[p + 2]; }
        else { M[q + 2] = sp[p + 1] >= 230 ? 255 : 0; M[q + 3] = sp[p + 3] < 255 ? sp[p + 3] : 0; }
        if (M[q + 3] > 8) emissive = true;
      } else { M[q + 1] = 200; M[q + 2] = 0; M[q + 3] = 0; }
    }
    // Minecraft textures cover exactly one block face and carry their own colour and detail
    Object.assign(t, { tile: 1, normal: 1, rough: 1, macro: 0.06, tint: [1, 1, 1], emission: emissive ? 4 : 0, pom: nm && !cutout ? 0.25 : 0 });   // LabPBR: height 0 = a quarter block deep
  }
  return { size: R, albedo: A, normal: N, mask: M, tuning, found, source: res };
}
