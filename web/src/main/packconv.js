// Resource pack conversion, doing what Minecraft (with OptiFine) does with a pack, so an imported pack looks like it
// does in the game it was made for:
//  - every block the game has, the catalog included, takes the pack's texture (by Minecraft texture name)
//  - weighted random variants from the pack's blockstates and models (with random quarter turns where the pack
//    rotates them), OptiFine CTM: repeat (one big picture over w x h blocks), random (weighted), fixed per height band
//  - animated textures (.png.mcmeta), blended between frames
//  - grey textures Minecraft tints (grass, foliage, spruce, birch, vines) get the default biome colour
//  - the grass side overlay, the pack's items, destroy stages, moon and sounds
//  - LabPBR / old-PBR normal, height and specular maps when the pack has them; generated from the colour when not
// Output: raw texture-array layers (one per game layer, then variant/animation textures), tuning and variant rows.
import { LAYER_NAMES, LAYER_TUNING, BASE_LAYERS, L, I } from '../shared/blocks.js';
import CATALOG from '../shared/catalog.json';
import { PACK_NAMES, decodePNG, square } from './respack.js';
import { listZip, readEntry } from './zip.js';

const SLOTS = 32;
const GRASS = [0x91, 0xbd, 0x59], FOLIAGE = [0x77, 0xab, 0x2f], SPRUCE = [0x61, 0x99, 0x61], BIRCH = [0x80, 0xa7, 0x55];
// the textures Minecraft tints, by Minecraft name
const TINTED = {
  grass_block_top: GRASS, grass_block_side_overlay: GRASS, short_grass: GRASS, grass: GRASS, fern: GRASS, tall_grass_top: GRASS, tall_grass_bottom: GRASS,
  oak_leaves: FOLIAGE, jungle_leaves: FOLIAGE, acacia_leaves: FOLIAGE, dark_oak_leaves: FOLIAGE, mangrove_leaves: FOLIAGE, vine: FOLIAGE,
  spruce_leaves: SPRUCE, birch_leaves: BIRCH, lily_pad: [0x20, 0x80, 0x30],
};
// game layer -> Minecraft block (for blockstates and CTM) and which face class its texture is
const LAYER_BLOCK = {
  Stone: ['stone', 'all'], Dirt: ['dirt', 'all'], GrassTop: ['grass_block', 'top'], Sand: ['sand', 'all'], Gravel: ['gravel', 'all'],
  Snow: ['snow_block', 'all'], Bedrock: ['bedrock', 'all'], Cobblestone: ['cobblestone', 'all'], Planks: ['oak_planks', 'all'],
  Bricks: ['bricks', 'all'], OakLog: ['oak_log', 'side'], BirchLog: ['birch_log', 'side'], SpruceLog: ['spruce_log', 'side'],
  JungleLog: ['jungle_log', 'side'], LogTop: ['oak_log', 'top'], Leaves: ['oak_leaves', 'all'], Needles: ['spruce_leaves', 'all'],
  Sandstone: ['sandstone', 'side'], RedSandstone: ['red_sandstone', 'side'], Mud: ['mud', 'all'], Moss: ['moss_block', 'all'], Ice: ['ice', 'all'],
  CoalOre: ['coal_ore', 'all'], IronOre: ['iron_ore', 'all'], GoldOre: ['gold_ore', 'all'], DiamondOre: ['diamond_ore', 'all'],
  GrassTuft: ['short_grass', 'all'], Netherrack: ['netherrack', 'all'], Glowstone: ['glowstone', 'all'], NetherBricks: ['nether_bricks', 'all'],
  EndStone: ['end_stone', 'all'], Obsidian: ['obsidian', 'all'], SoulSand: ['soul_sand', 'all'], StoneBricks: ['stone_bricks', 'all'],
};
export const PACK_ITEMS = { Stick: 'stick', Coal: 'coal', IronChunk: 'raw_iron', GoldChunk: 'raw_gold', Diamond: 'diamond', Apple: 'apple',
  Berries: 'sweet_berries', Flint: 'flint', FlintAndSteel: 'flint_and_steel', NetherQuartz: 'quartz', GlowstoneDust: 'glowstone_dust',
  EyeOfEnder: 'ender_eye', RawCopper: 'raw_copper', Emerald: 'emerald', LapisLazuli: 'lapis_lazuli', Redstone: 'redstone', Beef: 'beef',
  Porkchop: 'porkchop', Mutton: 'mutton', RawChicken: 'chicken', Feather: 'feather', Leather: 'leather', RottenFlesh: 'rotten_flesh', Bone: 'bone',
  Arrow: 'arrow', Gunpowder: 'gunpowder', String: 'string', GoldNugget: 'gold_nugget', BlazeRod: 'blaze_rod', GhastTear: 'ghast_tear' };
for (const t of ['wooden', 'stone', 'iron', 'diamond']) for (const k of ['pickaxe', 'axe', 'shovel', 'sword']) PACK_ITEMS[t[0].toUpperCase() + t.slice(1) + k[0].toUpperCase() + k.slice(1)] = `${t}_${k}`;
// sound events the game plays, and where vanilla keeps them
const SOUND_EVENTS = {
  grassStep: ['block.grass.step', ['step/grass1', 'step/grass2', 'step/grass3', 'step/grass4']],
  stoneBreak: ['block.stone.break', ['dig/stone1', 'dig/stone2', 'dig/stone3', 'dig/stone4', 'break/stone1']],
  pop: ['entity.item.pickup', ['random/pop']],
  rain: ['weather.rain', ['ambient/weather/rain1', 'ambient/weather/rain2', 'ambient/weather/rain3']],
  water: ['block.water.ambient', ['liquid/water']],
};

/** Minecraft names for a game layer, best first. */
function namesFor(layer) {
  if (PACK_NAMES[layer]) return PACK_NAMES[layer];
  if (layer.startsWith('c:')) {
    const t = layer.slice(2);
    if (t.startsWith('@dense:')) { const b = t.slice(7).replace('_better', ''); return [b, t.slice(7)]; }
    return [t];
  }
  return [];
}
function blockFor(layer) {
  if (LAYER_BLOCK[layer]) return LAYER_BLOCK[layer];
  if (!layer.startsWith('c:')) return null;
  const t = layer.slice(2);
  const e = CATALOG.blocks.find((b) => b.top === t || b.side === t || b.bottom === t);
  if (!e) return null;
  return [e.key, e.top === t && e.side !== t ? 'top' : e.side === t && e.top !== t ? 'side' : 'all'];
}

// ---------------------------------------------------------------- reading a ZIP (only what the game can use)

export async function readPackZip(buffer, fileName) {
  const bytes = new Uint8Array(buffer);
  const entries = listZip(bytes);
  let base = null;
  for (const p of entries.keys()) { const i = p.indexOf('assets/minecraft/'); if (i >= 0 && (base === null || i < base.length)) base = p.slice(0, i); }
  if (base === null) throw new Error('No Minecraft assets found in this ZIP. Choose a Java Edition resource pack.');
  const pre = base + 'assets/minecraft/';
  const files = {};
  const read = async (rel) => { if (files[rel] !== undefined) return files[rel]; const e = entries.get(pre + rel); files[rel] = e ? await readEntry(bytes, e) : null; return files[rel]; };
  const wantTex = new Set(['grass_block_side_overlay', 'grass_block_snow']);
  for (let k = 0; k < 10; k++) wantTex.add(`destroy_stage_${k}`);
  for (const l of LAYER_NAMES) for (const n of namesFor(l)) wantTex.add(n);
  const wantBlocks = new Set([...Object.values(LAYER_BLOCK).map((b) => b[0]), ...CATALOG.blocks.map((b) => b.key)]);
  const texDirs = ['textures/block/', 'textures/blocks/'];
  for (const p of entries.keys()) {
    if (!p.startsWith(pre)) continue;
    const rel = p.slice(pre.length);
    let m;
    if ((m = /^textures\/blocks?\/([^/]+?)(_n|_s)?\.png(\.mcmeta)?$/.exec(rel)) && wantTex.has(m[1])) await read(rel);
    else if ((m = /^blockstates\/([^/]+)\.json$/.exec(rel)) && wantBlocks.has(m[1])) await read(rel);
    else if (/^models\/block\/.+\.json$/.test(rel)) await read(rel);
    else if (/^optifine\/ctm\/.+\.properties$/.test(rel)) await read(rel);
    else if (rel === 'sounds.json' || rel === 'textures/environment/moon_phases.png') await read(rel);
    else if ((m = /^textures\/items?\/([^/]+)\.png$/.exec(rel)) && Object.values(PACK_ITEMS).includes(m[1])) await read(rel);
  }
  // CTM tiles and blockstate model textures the pack refers to
  for (const rel of Object.keys(files)) {
    if (!rel.endsWith('.properties') || !files[rel]) continue;
    const props = parseProps(new TextDecoder().decode(files[rel]));
    for (const t of ctmTiles(props, rel)) { await read(t); await read(t.replace(/\.png$/, '_n.png')); await read(t.replace(/\.png$/, '_s.png')); }
  }
  for (const rel of Object.keys(files)) {
    if (!rel.startsWith('blockstates/') || !files[rel]) continue;
    let bs; try { bs = JSON.parse(new TextDecoder().decode(files[rel])); } catch { continue; }
    for (const v of stateVariants(bs)) for (const tex of Object.values(modelTextures(files, v.model))) {
      if (typeof tex !== 'string' || tex.startsWith('#')) continue;
      const rp = texPath(tex);
      for (const d of texDirs) if (rp) { await read(d + rp + '.png'); await read(d + rp + '.png.mcmeta'); await read(d + rp + '_n.png'); await read(d + rp + '_s.png'); }
    }
  }
  // sounds
  if (files['sounds.json']) {
    try {
      const sj = JSON.parse(new TextDecoder().decode(files['sounds.json']));
      for (const [ev] of Object.values(SOUND_EVENTS)) {
        const e = sj[ev];
        if (e && e.sounds) for (const s of e.sounds) { const nm = typeof s === 'string' ? s : s.name; if (nm && !(s.type === 'event')) await read(`sounds/${nm.replace('minecraft:', '')}.ogg`); }
      }
    } catch { /* optional */ }
  }
  for (const [, paths] of Object.values(SOUND_EVENTS)) for (const s of paths) await read(`sounds/${s}.ogg`);
  for (const k of Object.keys(files)) if (!files[k]) delete files[k];
  if (!Object.keys(files).some((k) => k.startsWith('textures/'))) throw new Error('No Minecraft block textures found in this ZIP. Choose a Java Edition resource pack.');
  let meta = null, icon = null;
  const me = entries.get(base + 'pack.mcmeta'), ie = entries.get(base + 'pack.png');
  if (me) { try { meta = JSON.parse(new TextDecoder().decode(await readEntry(bytes, me))); } catch { /* optional */ } }
  if (ie) icon = await readEntry(bytes, ie);
  let desc = meta && meta.pack && meta.pack.description;
  if (Array.isArray(desc)) desc = desc.map((d) => (typeof d === 'string' ? d : d.text || '')).join('');
  else if (desc && typeof desc === 'object') desc = desc.text || '';
  return { name: fileName.replace(/\.zip$/i, ''), description: (desc || '').replace(/§./g, ''), files, icon, format: 2 };
}

// ---------------------------------------------------------------- blockstates, models, CTM

const texPath = (t) => { const s = t.replace(/^minecraft:/, ''); return s.startsWith('block/') ? s.slice(6) : s.startsWith('blocks/') ? s.slice(7) : null; };

/** The weighted model list of a blockstate's first (default) variant, or its first multipart part. */
function stateVariants(bs) {
  let list = null;
  if (bs.variants) { const k = Object.keys(bs.variants)[0]; list = bs.variants[k]; }
  else if (bs.multipart && bs.multipart.length) list = bs.multipart[0].apply;
  if (!list) return [];
  return (Array.isArray(list) ? list : [list]).filter((v) => v && v.model);
}
function modelTextures(files, model, depth = 0) {
  const name = model.replace(/^minecraft:/, '');
  const rel = `models/${name}.json`;
  if (!files[rel]) return depth === 0 ? { all: name } : {};   // a vanilla model: its texture has the model's name
  let m; try { m = JSON.parse(new TextDecoder().decode(files[rel])); } catch { return {}; }
  const own = m.textures || {};
  const parent = m.parent && depth < 8 ? modelTextures(files, m.parent, depth + 1) : {};
  const out = { ...parent, ...own };
  for (const k of Object.keys(out)) { let v = out[k], g = 0; while (typeof v === 'string' && v.startsWith('#') && g++ < 8) v = out[v.slice(1)]; out[k] = v; }
  return out;
}
function faceTexture(tex, face) {
  if (face === 'top') return tex.top || tex.end || tex.up || tex.all || tex.particle;
  if (face === 'side') return tex.side || tex.north || tex.all || tex.particle;
  return tex.all || tex.side || tex.north || tex.particle || tex.top;
}
function parseProps(text) {
  const p = {};
  for (const line of text.split(/\r?\n/)) { const m = /^\s*([\w.]+)\s*=\s*(.*?)\s*$/.exec(line); if (m && !line.trim().startsWith('#')) p[m[1]] = m[2]; }
  return p;
}
/** Paths (relative to assets/minecraft) of a CTM rule's tiles. */
function ctmTiles(props, rel) {
  const dir = rel.slice(0, rel.lastIndexOf('/'));
  const out = [];
  for (const tok of (props.tiles || '').split(/\s+/).filter(Boolean)) {
    const range = /^(\d+)-(\d+)$/.exec(tok);
    if (range) { for (let k = +range[1]; k <= +range[2]; k++) out.push(`${dir}/${k}.png`); continue; }
    let t = tok.replace(/\.png$/, '');
    if (t.startsWith('~/')) out.push(`optifine/${t.slice(2)}.png`);
    else if (t.includes('/')) out.push(t.startsWith('textures/') ? `${t}.png` : `textures/${t.replace(/^minecraft:/, '')}.png`);
    else out.push(`${dir}/${t}.png`);
  }
  return out;
}

// ---------------------------------------------------------------- converting

/**
 * pack: from readPackZip (format 2: files by path), an older stored pack (files by texture name) or a built-in pack
 * (decoded images by name). builtin: { size, albedo, normal, mask } one layer per game layer (fallback pictures).
 * helpers.surface(data, size, count, opts[]) -> Promise<{A, N, M}>: generated maps (a worker).
 */
export async function convertPack(pack, builtin, opts = {}, helpers = {}) {
  const n = LAYER_NAMES.length;
  const files = pack.files || {};
  const images = pack.images || {};
  const texBytes = (name) => files[`textures/block/${name}.png`] || files[`textures/blocks/${name}.png`] || (pack.format !== 2 ? files[name] : null);
  const hasTex = (name) => !!(images[name] || texBytes(name));
  const decodeTex = async (name) => images[name] || (texBytes(name) ? decodePNG(texBytes(name)) : null);
  const decodePath = async (rel) => (files[rel] ? decodePNG(files[rel]) : null);
  const mcmeta = (name) => { const b = files[`textures/block/${name}.png.mcmeta`] || files[`textures/blocks/${name}.png.mcmeta`]; try { return b ? JSON.parse(new TextDecoder().decode(b)) : null; } catch { return null; } };
  // CTM rules
  const rules = [];
  for (const rel of Object.keys(files)) {
    if (!rel.startsWith('optifine/ctm/') || !rel.endsWith('.properties')) continue;
    const p = parseProps(new TextDecoder().decode(files[rel]));
    const method = (p.method || '').trim();
    if (!['repeat', 'random', 'fixed'].includes(method)) continue;
    const tiles = ctmTiles(p, rel).filter((t) => files[t]);
    if (!tiles.length) continue;
    rules.push({ method, tiles, p, blocks: (p.matchBlocks || '').split(/\s+/).map((b) => b.replace(/^minecraft:/, '').split(':')[0]).filter(Boolean),
      tilesMatch: (p.matchTiles || '').split(/\s+/).map((t) => t.replace(/^minecraft:/, '').replace(/^textures\/blocks?\//, '').replace(/^blocks?\//, '').replace(/\.png$/, '')).filter(Boolean) });
  }

  // ---- 1. what each layer gets
  const plan = [];
  let res = 0;
  const found = [];
  for (let i = 0; i < n; i++) {
    const layer = LAYER_NAMES[i];
    const name = namesFor(layer).find(hasTex);
    if (!name) { plan.push(null); continue; }
    const img = await decodeTex(name);
    if (!img) { plan.push(null); continue; }
    res = Math.max(res, img.w);
    const entry = { name, img, normal: await decodeTex(`${name}_n`), spec: await decodeTex(`${name}_s`), extra: [], mode: 0, flags: 0 };
    const bf = blockFor(layer);
    const face = bf ? bf[1] : 'all';
    const faceOk = (r) => { const f = (r.p.faces || 'all').split(/\s+/); return f.includes('all') || (face === 'top' ? f.includes('top') : face === 'side' ? f.includes('sides') || f.some((x) => ['north', 'south', 'east', 'west'].includes(x)) : true); };
    const mine = rules.filter((r) => faceOk(r) && ((bf && r.blocks.includes(bf[0])) || r.tilesMatch.includes(name)));
    const repeat = mine.find((r) => r.method === 'repeat' && !r.p.minHeight && !r.p.biomes);
    const fixed = mine.filter((r) => r.method === 'fixed' && (r.p.minHeight || r.p.maxHeight));
    const random = mine.find((r) => r.method === 'random' && !r.p.biomes && !r.p.minHeight);
    if (repeat) {
      const w = +repeat.p.width || 1, h = +repeat.p.height || 1;
      entry.mode = 2; entry.w = w; entry.h = h; entry.extra = repeat.tiles.slice(0, Math.min(SLOTS, w * h)).map((t) => ({ path: t }));
    } else if (fixed.length) {
      entry.mode = 4;
      entry.bands = fixed.slice(0, 8).map((r) => ({ path: r.tiles[0], min: +(r.p.minHeight ?? -64), max: +(r.p.maxHeight ?? 320), faces: r.p.faces || 'all' }));
    } else {
      // blockstate variants
      const bsBytes = bf && files[`blockstates/${bf[0]}.json`];
      let variants = [];
      if (bsBytes) { try { variants = stateVariants(JSON.parse(new TextDecoder().decode(bsBytes))); } catch { /* ignore */ } }
      const byTex = new Map();
      let rotated = false;
      for (const v of variants) {
        const t = texPath(faceTexture(modelTextures(files, v.model), face) || '');
        if (!t || !hasTex(t)) continue;
        if (v.y) rotated = true;
        byTex.set(t, (byTex.get(t) || 0) + (v.weight ?? 1));
      }
      if (byTex.size > 1 || (byTex.size === 1 && !byTex.has(name))) {
        entry.mode = 1; entry.weights = [];
        const list = [...byTex].slice(0, SLOTS);
        entry.baseWeight = byTex.get(name) || 0;
        entry.extra = list.filter(([t]) => t !== name).map(([t, w]) => ({ tex: t, weight: w }));
        if (!entry.baseWeight) entry.baseWeight = 0;
        if (rotated) entry.flags |= 1;
      } else if (random) {
        const ws = (random.p.weights || '').split(/\s+/).map(Number).filter((x) => !Number.isNaN(x));
        entry.mode = 1; entry.baseWeight = 0;
        entry.extra = random.tiles.slice(0, SLOTS).map((t, k) => ({ path: t, weight: ws[k] || 1 }));
      } else if (variants.some((v) => v.y) && (face === 'top' || face === 'all')) { entry.mode = 1; entry.flags |= 1; entry.baseWeight = 1; }
      // animation
      const anim = mcmeta(name);
      if (entry.mode === 0 && anim && anim.animation && img.h > img.w) {
        const frames = Math.floor(img.h / img.w);
        const order = (anim.animation.frames || [...Array(frames).keys()]).map((f) => (typeof f === 'object' ? f.index : f)).filter((f) => f < frames);
        const step = Math.max(1, Math.ceil(order.length / SLOTS));
        const keep = order.filter((_, k) => k % step === 0).slice(0, SLOTS);
        const ft = (anim.animation.frametime || 1) * step;
        entry.mode = 3; entry.fps = 20 / ft; entry.frames = keep;
      }
    }
    plan.push(entry);
    found.push(layer);
  }
  if (!found.length) throw new Error('None of the textures the game uses are in this pack.');

  // ---- 2. resolution within a memory budget
  let extraCount = 0;
  for (const e of plan) if (e) extraCount += (e.extra ? e.extra.length : 0) + (e.bands ? e.bands.length : 0) + (e.frames ? e.frames.length - 1 : 0);
  const overlayImg = hasTex('grass_block_side_overlay') ? await decodeTex('grass_block_side_overlay') : null;
  const total0 = n + extraCount + (overlayImg ? 1 : 0);
  let R = Math.min(512, Math.max(builtin.size, 1 << Math.ceil(Math.log2(Math.max(16, res)))));
  while (R > 64 && total0 * R * R * 4 * 3 > 320e6) R >>= 1;
  const LB = R * R * 4, total = total0;
  const A = new Uint8Array(LB * total), N = new Uint8Array(LB * total), M = new Uint8Array(LB * total);
  const tuning = LAYER_TUNING.map((t) => ({ ...t, tint: [...t.tint] }));
  const rows = [];
  const gen = [];   // textures that need generated maps: { slot, rgba, cutout, emission }
  let next = n;
  const bs = builtin.size;

  const tintOf = (mcName, a) => {
    const c = TINTED[mcName.replace(/_better$/, '')];
    if (!c) return null;
    let sat = 0, cnt = 0;
    for (let p = 0; p < a.length; p += 16) { if (a[p + 3] < 128) continue; const mx = Math.max(a[p], a[p + 1], a[p + 2]), mn = Math.min(a[p], a[p + 1], a[p + 2]); sat += mx ? (mx - mn) / mx : 0; cnt++; }
    return cnt && sat / cnt < 0.3 ? c.map((v) => v / 255) : null;
  };
  // writes one texture into slot `slot`; returns whether it had PBR maps
  const put = (slot, img, nmImg, spImg, mcName, layerIdx) => {
    const t = tuning[layerIdx], cutout = t.cutout > 0, o = slot * LB;
    const a = square(img, R);
    const tint = tintOf(mcName, a);
    if (tint) for (let p = 0; p < LB; p += 4) { a[p] *= tint[0]; a[p + 1] *= tint[1]; a[p + 2] *= tint[2]; }
    if (cutout) bleedInto(a, R);
    const nm = nmImg ? square(nmImg, R) : null, sp = spImg ? square(spImg, R) : null;
    if (!nm) { gen.push({ slot, rgba: a, cutout, emission: t.emission > 0 ? 0.3 : null }); return false; }
    let emissive = false;
    for (let p = 0; p < LB; p += 4) {
      const q = o + p;
      A[q] = a[p]; A[q + 1] = a[p + 1]; A[q + 2] = a[p + 2];
      A[q + 3] = cutout ? a[p + 3] : Math.max(1, nm[p + 3]);
      const x = nm[p] / 127.5 - 1, y = (nm[p + 1] / 127.5 - 1) * (opts.normalYDown ? -1 : 1), z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      N[q] = (x * 0.5 + 0.5) * 255; N[q + 1] = (y * 0.5 + 0.5) * 255; N[q + 2] = (z * 0.5 + 0.5) * 255; N[q + 3] = 255;
      M[q] = opts.oldPbr ? 255 : nm[p + 2];
      if (sp) {
        const smooth = sp[p] / 255;
        M[q + 1] = (1 - smooth) * (1 - smooth) * 255;
        if (opts.oldPbr) { M[q + 2] = sp[p + 1]; M[q + 3] = sp[p + 2]; }
        else { M[q + 2] = sp[p + 1] >= 230 ? 255 : 0; M[q + 3] = sp[p + 3] < 255 ? sp[p + 3] : 0; }
        if (M[q + 3] > 8) emissive = true;
      } else { M[q + 1] = 200; M[q + 2] = 0; M[q + 3] = 0; }
    }
    if (emissive) t.emission = Math.max(t.emission, 4);
    return true;
  };
  const decodeRef = async (ref) => (ref.path ? { img: await decodePath(ref.path), nm: await decodePath(ref.path.replace(/\.png$/, '_n.png')), sp: await decodePath(ref.path.replace(/\.png$/, '_s.png')), name: ref.path.split('/').pop().replace('.png', '') }
    : { img: await decodeTex(ref.tex), nm: await decodeTex(`${ref.tex}_n`), sp: await decodeTex(`${ref.tex}_s`), name: ref.tex });
  const frameOf = (img, k) => ({ w: img.w, h: img.w, data: img.data.subarray(k * img.w * img.w * 4, (k + 1) * img.w * img.w * 4) });

  let variantSets = 0, animations = 0, bandsN = 0;
  for (let i = 0; i < n; i++) {
    const e = plan[i], o = i * LB;
    if (!e) {
      // the game's own picture for this layer
      for (const [dst, src] of [[A, builtin.albedo], [N, builtin.normal], [M, builtin.mask]]) dst.set(square({ w: bs, h: bs, data: src.subarray(i * bs * bs * 4, (i + 1) * bs * bs * 4) }, R), o);
      continue;
    }
    const t = tuning[i];
    const first = e.mode === 3 ? frameOf(e.img, e.frames[0]) : e.img;
    const pbr = put(i, first, e.normal, e.spec, e.name, i);
    Object.assign(t, { tile: 1, normal: 1, rough: 1, macro: 0.05, tint: [1, 1, 1], pom: t.cutout ? 0 : pbr ? 0.25 : 0.018 });
    if (e.mode === 1 || e.mode === 2) {
      const slots = [], weights = [];
      if (e.mode === 1 && e.baseWeight) { slots.push(i); weights.push(e.baseWeight); }
      for (const ref of e.extra) {
        const d = await decodeRef(ref);
        if (!d.img) continue;
        put(next, d.img.h > d.img.w ? frameOf(d.img, 0) : d.img, d.nm, d.sp, d.name, i);
        slots.push(next++); weights.push(ref.weight || 1);
      }
      if (!slots.length) continue;
      if (e.mode === 2) rows[i] = { mode: 2, w: e.w, h: e.h, flags: 0, slots: [...slots, ...Array(SLOTS - slots.length).fill(slots[0])], side: 255 };
      else rows[i] = { mode: 1, w: 1, h: 1, flags: e.flags, slots: weighted(slots, weights), side: 255 };
      variantSets++;
    } else if (e.mode === 4) {
      const bands = [];
      for (const b of e.bands) {
        const img = await decodePath(b.path);
        if (!img) continue;
        put(next, img.h > img.w ? frameOf(img, 0) : img, await decodePath(b.path.replace(/\.png$/, '_n.png')), null, e.name, i);
        const f = b.faces.split(/\s+/), mask = f.includes('all') ? 7 : (f.includes('sides') ? 1 : 0) | (f.includes('top') ? 2 : 0) | (f.includes('bottom') ? 4 : 0);
        bands.push([next++, Math.max(0, b.min), Math.min(65535, b.max), mask || 7]);
      }
      rows[i] = { mode: 4, w: bands.length, h: 1, flags: 0, slots: Array(SLOTS).fill(i), bands, side: 255 };
      bandsN++;
    } else if (e.mode === 3) {
      const slots = [i];
      for (const k of e.frames.slice(1)) { put(next, frameOf(e.img, k), null, null, e.name, i); slots.push(next++); }
      rows[i] = { mode: 3, w: slots.length, h: Math.max(1, Math.round(e.fps * 10)), flags: 0, slots: [...slots, ...Array(SLOTS - slots.length).fill(i)], side: 255 };
      animations++;
    } else if (e.flags) rows[i] = { mode: 1, w: 1, h: 1, flags: e.flags, slots: Array(SLOTS).fill(i), side: 255 };
  }
  // the grass side overlay: a virtual row past the layers, used by the grass top's sides
  if (overlayImg) {
    put(next, overlayImg, null, null, 'grass_block_side_overlay', L.GrassTop);
    rows[n] = { mode: 0, w: 1, h: 1, flags: 0, slots: Array(SLOTS).fill(next++), side: 255 };
    rows[L.GrassTop] = rows[L.GrassTop] || { mode: 0, w: 1, h: 1, flags: 0, slots: Array(SLOTS).fill(L.GrassTop), side: 255 };
    rows[L.GrassTop].side = n;
  }
  // generated normal / height / material maps for everything without PBR maps
  if (gen.length) {
    const data = new Uint8Array(LB * gen.length);
    gen.forEach((g, k) => data.set(g.rgba, k * LB));
    const maps = await helpers.surface(data, R, gen.length, gen.map((g) => ({ cutout: g.cutout, emission: g.emission, normal: 1.5, rough: 0.85 })));
    gen.forEach((g, k) => {
      const o = g.slot * LB, s = k * LB;
      A.set(maps.A.subarray(s, s + LB), o); N.set(maps.N.subarray(s, s + LB), o); M.set(maps.M.subarray(s, s + LB), o);
    });
  }

  // ---- 3. items, destroy stages, moon, sounds
  const items = new Map();
  for (const [key, mc] of Object.entries(PACK_ITEMS)) {
    const b = files[`textures/item/${mc}.png`] || files[`textures/items/${mc}.png`];
    if (!b || I[key] == null) continue;
    try { const img = await decodePNG(b); items.set(I[key], toCanvas(img.h > img.w ? frameOf(img, 0) : img)); } catch { /* skip */ }
  }
  let crack = null;
  if ([...Array(10).keys()].every((k) => hasTex(`destroy_stage_${k}`))) {
    const frames = []; for (let k = 0; k < 10; k++) frames.push(square(await decodeTex(`destroy_stage_${k}`), 64));
    const c = document.createElement('canvas'); c.width = 64; c.height = 640;
    const x = c.getContext('2d');
    frames.forEach((f, k) => x.putImageData(new ImageData(new Uint8ClampedArray(f), 64, 64), 0, k * 64));
    crack = await createImageBitmap(c);
  }
  let moon = null;
  if (files['textures/environment/moon_phases.png']) {
    const img = await decodePNG(files['textures/environment/moon_phases.png']);
    const cw = Math.floor(img.w / 4), c = document.createElement('canvas'); c.width = cw; c.height = cw;
    const cell = new Uint8ClampedArray(cw * cw * 4);
    for (let y = 0; y < cw; y++) cell.set(img.data.subarray((y * img.w) * 4, (y * img.w + cw) * 4), y * cw * 4);
    c.getContext('2d').putImageData(new ImageData(cell, cw, cw), 0, 0);
    moon = await createImageBitmap(c);
  }
  const sounds = {};
  let sj = null;
  try { sj = files['sounds.json'] ? JSON.parse(new TextDecoder().decode(files['sounds.json'])) : null; } catch { /* ignore */ }
  for (const [group, [ev, paths]] of Object.entries(SOUND_EVENTS)) {
    let list = [];
    if (sj && sj[ev] && sj[ev].sounds) list = sj[ev].sounds.map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean).map((s) => `sounds/${s.replace('minecraft:', '')}.ogg`);
    if (!list.some((p) => files[p])) list = paths.map((p) => `sounds/${p}.ogg`);
    const bufs = list.filter((p) => files[p]).map((p) => files[p].slice().buffer);
    if (bufs.length) sounds[group] = bufs;
  }
  return { size: R, albedo: A, normal: N, mask: M, layers: total, tuning, variants: rows, found, source: res,
    items, crack, moon, sounds, stats: { variantSets, animations, bands: bandsN, generated: gen.length, textures: next } };
}

/** 32 slots in proportion to the weights, interleaved. */
function weighted(slots, weights) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const counts = weights.map((w) => Math.max(1, Math.round(w / total * SLOTS)));
  while (counts.reduce((a, b) => a + b, 0) > SLOTS) counts[counts.indexOf(Math.max(...counts))]--;
  while (counts.reduce((a, b) => a + b, 0) < SLOTS) counts[counts.indexOf(Math.max(...counts))]++;
  const out = [];
  slots.forEach((s, k) => { for (let c = 0; c < counts[k]; c++) out.push(s); });
  return out.map((_, k) => out[(k * 13) % SLOTS]);
}

/** Transparent texels take the colour of nearby opaque ones (no dark fringes when filtered). */
function bleedInto(a, R) {
  const src = a.slice();
  for (let pass = 0; pass < 4; pass++) {
    for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) {
      const o = (y * R + x) * 4;
      if (src[o + 3] >= 128) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = (((y + dy + R) % R) * R + (x + dx + R) % R) * 4;
        if (src[q + 3] >= 128 || src[q + 3] === 1) { r += src[q]; g += src[q + 1]; b += src[q + 2]; n++; }
      }
      if (n) { a[o] = r / n; a[o + 1] = g / n; a[o + 2] = b / n; src[o] = a[o]; src[o + 1] = a[o + 1]; src[o + 2] = a[o + 2]; src[o + 3] = 1; }
    }
  }
}

function toCanvas(img) {
  const c = document.createElement('canvas'); c.width = img.w; c.height = img.h;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0);
  return c;
}

export { BASE_LAYERS };
