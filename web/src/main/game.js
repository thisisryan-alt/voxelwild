// The game session: world streaming, player, block interaction (mining with tool tiers, placing with support rules),
// item entities, particles, survival, day/night, weather, audio and autosave. The DOM side lives in ui.js.
import { World } from './world.js';
import { Renderer } from './renderer.js';
import { TimeOfDay } from './sky.js';
import { Player, raycast, targetable } from './player.js';
import { Inventory, SurvivalStats, Weather, CREATIVE_HOTBAR, HOTBAR, WEATHER_NAMES } from './gameplay.js';
import { GameAudio } from './audio.js';
import { Icons } from './icons.js';
import { FarTerrain } from './far.js';
import { Mobs, MOB_TYPES } from './mobs.js';
import { MobModels } from './mobrender.js';
import { SaveStore, PackStore } from './save.js';
import { decodeLarge, fetchBuiltinPack, square } from './respack.js';
import { readPackZip, convertPack } from './packconv.js';
import { LAYER_TUNING, LAYER_NAMES, I, BASE_LAYERS, CAT } from '../shared/blocks.js';
import CATALOG from '../shared/catalog.json';
import { BLOCKS, B, F, ITEMS, Kind, Shape, isWater, isLava, isPortal, Dim, breakSeconds, drops, canHarvest, itemName, layerFor, FAMS, FAM, famOf, isLiquid } from '../shared/blocks.js';
import { K, facingFromYaw, facingFromFace, opposite } from '../shared/shapes.js';
import { strongholds, frameRing } from '../shared/stronghold.js';
import { END_ARRIVAL, END_GATEWAY, outerGateway } from '../shared/end.js';
import { netherClimate, nearestFortress } from '../shared/nether.js';
import { Simplex } from '../shared/noise.js';
import { terrainFor } from '../shared/gen.js';
import { Biome, BIOME_NAMES } from '../shared/terrain.js';
import { VoxelBody } from './player.js';
import { MIN_Y, MAX_Y, SEA } from '../shared/const.js';

const REACH = 6;
const EMITTERS = BLOCKS.map((d) => d.emission || 0);
const OPACITY = BLOCKS.map((d) => d.opacity || 0);

export class Game {
  constructor(canvas, workerUrl, assetBase = 'assets/') {
    this.canvas = canvas;
    this.workerUrl = workerUrl;
    this.assetBase = assetBase;
    this.state = 'title';
    this.audio = new GameAudio();
    this.store = new SaveStore();
    this.settings = null;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { left: false, right: false, leftClicked: false, rightClicked: false };
    this.time = 0;
    this.entities = [];
    this.particles = { break: [], rain: [], snow: [] };
    this.flash = 0;
    this.damageFlash = 0;
    this.camSky = 1;
    this.lightProbe = { sky: 1, block: 0, at: -1 };
    this.fps = 0; this.frameMs = 0;
    this.listeners = {};
  }

  on(ev, fn) { (this.listeners[ev] || (this.listeners[ev] = [])).push(fn); }
  emit(ev, ...a) { for (const fn of this.listeners[ev] || []) fn(...a); }

  /** textures: 'lbpr' (default: LB Photo Realism Reload! baked in by tools/build_lbpr.py) or 'original' (the game's own art). */
  async init(progress, textures = 'lbpr') {
    this.renderer = new Renderer(this.canvas);
    this.far = new FarTerrain(this.renderer.gl, this.workerUrl);
    this.renderer.far = this.far;
    this.mobs = new Mobs(this);
    // mob models and skins (optional: the world plays without them)
    this.mobsReady = (async () => {
      try {
        const defs = await (await fetch(this.assetBase + 'lbpr/mobs.json')).json();
        const models = new MobModels(this.renderer.gl);
        await models.load(defs, (f) => this.loadBitmap('lbpr/' + f));
        this.renderer.mobModels = models;
      } catch (e) { console.warn('mobs unavailable:', e && e.message); }
    })();
    await this.store.open();
    progress && progress('Loading textures', 0.1);
    const load = (name) => this.loadBitmap(name);
    this.sets = {};
    // Blender props: optional art (the world generates the same without it)
    this.propsReady = (async () => {
      try {
        const [lib, bn, bm] = await Promise.all([
          fetch(this.assetBase + 'props.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
          load('prop_normal.webp'), load('prop_mask.webp')]);
        // geometry: gzip + base64 inside the JSON (artifacts serve no raw binary files)
        const gz = Uint8Array.from(atob(lib.data), (c) => c.charCodeAt(0));
        const bin = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        delete lib.data;
        this.renderer.uploadProps(lib, bin, bn, bm);
        this.propLib = lib;
        if (this.world) this.world.props.setLibrary(lib);
      } catch (e) { console.warn('props unavailable:', e && e.message); }
    })();
    let set = null;
    if (textures !== 'original') {
      try { set = await this.loadSet('lbpr'); } catch (e) { console.warn('LBPR textures unavailable, using the originals:', e && e.message); }
    }
    if (!set) set = await this.loadSet('original');
    progress && progress('Preparing materials', 0.6);
    this.applySet(set);
    // a resource pack the player loaded earlier
    try {
      const saved = await PackStore.get();
      if (saved) {
        progress && progress('Applying your resource pack', 0.8);
        // built-in packs are stored by id only and fetched again from the page's assets
        await this.applyPack(saved.builtin ? await fetchBuiltinPack(this.assetBase, saved.builtin) : saved, false);
      }
    } catch (e) { console.warn('saved resource pack could not be applied:', e); }
    progress && progress('Ready', 1);
  }

  // ---------------------------------------------------------------- texture sets

  async loadBitmap(name) {
    const res = await fetch(this.assetBase + name);
    if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
    return createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  }

  /** The built-in texture sets: 'original' (the game's art) and 'lbpr' (the baked LB Photo Realism Reload! pack). */
  async loadSet(name) {
    if (this.sets[name]) return this.sets[name];
    const load = (f) => this.loadBitmap(f);
    let set;
    if (name === 'lbpr') {
      const res = await fetch(this.assetBase + 'lbpr/lbpr.json');
      if (!res.ok) throw new Error(`lbpr.json (${res.status})`);
      const meta = await res.json();
      const parts = meta.parts || 1, sfx = (k) => (k ? `.${k}` : '');
      const strip = (name) => Promise.all(Array.from({ length: parts }, (_, k) => load(`lbpr/${name}${sfx(k)}.webp`)));
      const [albedoP, normalP, maskP, items, crack, moon, stars] = await Promise.all([strip('albedo'), strip('normal'), strip('mask'),
        ...['items', 'crack', 'moon', 'stars'].map((f) => load(`lbpr/${f}.webp`).catch(() => null))]);
      const [albedo, normal, mask] = [albedoP[0], normalP[0], maskP[0]];
      const itemImages = new Map();
      meta.items.forEach((key, k) => {
        if (I[key] == null) return;
        const c = document.createElement('canvas'); c.width = c.height = items.width;
        c.getContext('2d').drawImage(items, 0, k * items.width, items.width, items.width, 0, 0, items.width, items.width);
        itemImages.set(I[key], c);
      });
      const sounds = {};
      await Promise.all(Object.entries(meta.sounds).map(async ([group, files]) => {
        sounds[group] = await Promise.all(files.map(async (f) => {
          try { const r = await fetch(this.assetBase + 'lbpr/' + f); return r.ok ? await r.arrayBuffer() : null; } catch { return null; }
        }));
        sounds[group] = sounds[group].filter(Boolean);
      }));
      set = { name, albedo, normal, mask, parts: { albedo: albedoP, normal: normalP, mask: maskP }, tuning: meta.tuning, variants: meta.variants,
        items: itemImages, crack, moon, stars, sounds, credit: meta.credit };
      await this.addCatalog(set, meta, load, parts);
    } else {
      const [albedo, normal, mask] = await Promise.all([load('albedo.webp'), load('normal.webp'), load('mask.webp')]);
      set = { name: 'original', albedo, normal, mask, tuning: LAYER_TUNING, variants: null, items: null, crack: null, moon: null, sounds: null, credit: null };
      // the Unity art has nothing for the Nether, the End or strongholds: those layers (and their variants) come from LBPR
      if (Math.round(albedo.height / albedo.width) < LAYER_NAMES.length) {
        try { await this.borrowLayers(set, await this.loadSet('lbpr')); } catch (e) { console.warn('no textures for the new blocks:', e && e.message); }
      }
    }
    this.sets[name] = set;
    return set;
  }

  /** The block catalog's textures: colour strips from the set, normal and material maps generated in a worker,
   *  appended after the set's own textures; variant rows, tuning and icon sources for the catalog layers. */
  async addCatalog(set, meta, load, parts) {
    const base = meta.baseLayers || BASE_LAYERS, texBase = meta.layers, n = LAYER_NAMES.length, size = meta.size;
    const cat = meta.catalog || { count: 0, parts: 0 };
    const bmps = await Promise.all(Array.from({ length: cat.parts }, (_, k) => load(`lbpr/catalog${k ? '.' + k : ''}.webp`)));
    const L = size * size * 4, colour = new Uint8Array(L * cat.count);
    let o = 0;
    for (const b of bmps) { const d = (await decodeLarge(b)).data; colour.set(d.subarray(0, Math.min(d.length, colour.length - o)), o); o += d.length; }
    // generation settings per texture from the blocks that use it
    const opts = CATALOG.textures.map((t) => {
      const tu = LAYER_TUNING[LAYER_NAMES.indexOf('c:' + t)] || {};
      const e = CATALOG.blocks.find((b) => b.top === t || b.side === t || b.bottom === t) || {};
      const rough = { metal: 0.35, glass: 0.12, ice: 0.12, wool: 0.95, wood: 0.72, leaves: 0.75, plant: 0.7, dirt: 0.92, sand: 0.9 }[e.cat] ?? 0.82;
      return { cutout: tu.cutout > 0, normal: e.cat === 'wool' ? 0.8 : 1.6, rough, emission: e.emission ? 0.3 : null };
    });
    const maps = await new Promise((resolve, reject) => {
      const w = new Worker(this.workerUrl);
      w.onmessage = (e) => { w.terminate(); resolve(e.data); };
      w.onerror = (e) => { w.terminate(); reject(new Error(e.message)); };
      w.postMessage({ type: 'surface', id: 1, size, count: cat.count, data: colour, opts }, [colour.buffer]);
    });
    set.extra = { albedo: { data: maps.A, count: cat.count }, normal: { data: maps.N, count: cat.count }, mask: { data: maps.M, count: cat.count } };
    // rows: the set's own layers, the catalog layers (identity onto their textures), then the virtual rows moved past them
    const rows = [];
    for (let i = 0; i < base; i++) rows[i] = meta.variants[i];
    const catIndex = new Map(CATALOG.textures.map((t, k) => [t, k]));
    for (let i = base; i < n; i++) {
      const k = catIndex.get(LAYER_NAMES[i].slice(2));
      rows[i] = { mode: 0, w: 1, h: 1, flags: 0, slots: new Array(32).fill(k == null ? 0 : texBase + k), side: 255 };
    }
    const virtual = meta.variants.slice(base);
    virtual.forEach((r, k) => { rows[n + k] = r; });
    for (const r of rows) if (r && r.side != null && r.side !== 255 && r.side >= base) r.side = r.side - base + n;
    set.variants = rows;
    set.tuning = [...meta.tuning.slice(0, base), ...LAYER_TUNING.slice(base)];
    // icons: base layers from the first strip, catalog layers from a sheet of the colour textures
    const cols = 16, sheet = document.createElement('canvas');
    sheet.width = cols * size; sheet.height = Math.ceil(cat.count / cols) * size;
    const sx = sheet.getContext('2d', { willReadFrequently: true });   // CPU-side: icons read it back layer by layer
    for (let k = 0; k < cat.count; k++) {
      const px = new Uint8ClampedArray(maps.A.buffer, k * L, L).slice();
      for (let p = 3; p < L; p += 4) if (!opts[k].cutout) px[p] = 255;
      sx.putImageData(new ImageData(px, size, size), (k % cols) * size, Math.floor(k / cols) * size);
    }
    const first = set.parts.albedo[0], perPart = Math.round(first.height / first.width);
    set.thumb = (l) => {
      const t = rows[l] ? rows[l].slots[0] : l;
      if (t < texBase) { const part = set.parts.albedo[Math.floor(t / perPart)]; return [part, 0, (t % perPart) * size, size, size]; }
      const k = t - texBase;
      return [sheet, (k % cols) * size, Math.floor(k / cols) * size, size, size];
    };
    // a layer's own picture as raw RGBA (for resource packs that leave it out, and for the original art's borrowing)
    set.rawLayer = async (which, l) => {
      const t = rows[l] ? rows[l].slots[0] : l;
      if (t >= texBase) return set.extra[which].data.subarray((t - texBase) * L, (t - texBase + 1) * L);
      set.decoded = set.decoded || {};
      if (!set.decoded[which]) set.decoded[which] = await Promise.all(set.parts[which].map(async (b) => (await decodeLarge(b)).data));
      const part = set.decoded[which][Math.floor(t / perPart)];
      return part.subarray((t % perPart) * L, (t % perPart + 1) * L);
    };
  }

  /** Generated normal / height / material maps in a worker (for textures without PBR maps). */
  runSurface(data, size, count, opts) {
    return new Promise((resolve, reject) => {
      const w = new Worker(this.workerUrl);
      w.onmessage = (e) => { w.terminate(); resolve(e.data); };
      w.onerror = (e) => { w.terminate(); reject(new Error(e.message)); };
      w.postMessage({ type: 'surface', id: 1, size, count, data, opts }, [data.buffer]);
    });
  }

  /** Completes a set with fewer layers than the game has from another set: its layers from there on, plus the variant
   *  textures those layers use, resampled to this set's size (and the variant table renumbered to match). */
  async borrowLayers(set, from) {
    const n = LAYER_NAMES.length, own = Math.round(set.albedo.height / set.albedo.width), S0 = set.albedo.width, S = Math.min(S0, from.albedo.width);
    const dec = async (bmps) => { const out = []; for (const b of bmps) out.push(await decodeLarge(b)); return out; };
    const src = { albedo: await dec(from.parts.albedo), normal: await dec(from.parts.normal), mask: await dec(from.parts.mask) };
    const fs = from.albedo.width, perPart = Math.round(from.parts.albedo[0].height / fs);
    const partsTotal = from.parts.albedo.reduce((a, b) => a + Math.round(b.height / fs), 0), FL = fs * fs * 4;
    const layerOf = (which, t) => {
      if (t >= partsTotal) return { w: fs, h: fs, data: from.extra[which].data.subarray((t - partsTotal) * FL, (t - partsTotal + 1) * FL) };
      const part = src[which][Math.floor(t / perPart)], k = t % perPart;
      return { w: fs, h: fs, data: part.data.subarray(k * FL, (k + 1) * FL) };
    };
    // which source textures: the borrowed layers themselves, then every texture their variant rows reach
    const map = new Map(), order = [];
    for (let i = own; i < n; i++) { map.set(i, i); order.push(i); }
    const rows = [];
    for (let i = own; i < n; i++) {
      const row = from.variants && from.variants[i];
      if (!row) continue;
      const tex = [...row.slots, ...(row.bands || []).map((b) => b[0])];
      for (const t of tex) if (!map.has(t)) { map.set(t, n + order.length - (n - own)); order.push(t); }
      rows[i] = { ...row, slots: row.slots.map((t) => map.get(t)), bands: row.bands ? row.bands.map((b) => [map.get(b[0]), b[1], b[2], b[3]]) : undefined };
    }
    const total = own + order.length, L = S * S * 4;
    const own3 = { albedo: (await decodeLarge(set.albedo)).data, normal: (await decodeLarge(set.normal)).data, mask: (await decodeLarge(set.mask)).data };
    set.raw = { size: S, layers: total };
    for (const which of ['albedo', 'normal', 'mask']) {
      const out = new Uint8Array(L * total);
      // the set's own pictures, brought to the shared size
      for (let i = 0; i < own; i++) out.set(square({ w: S0, h: S0, data: own3[which].subarray(i * S0 * S0 * 4, (i + 1) * S0 * S0 * 4) }, S), i * L);
      order.forEach((t, k) => out.set(square(layerOf(which, t), S), (own + k) * L));
      set.raw[which] = out;
    }
    set.tuning = LAYER_TUNING.map((t, i) => (i < own ? t : from.tuning[i]));
    set.variants = rows;
    set.items = new Map([...from.items].filter(([id]) => ITEMS[id] && ITEMS[id].id >= I.Flint));
    set.stars = from.stars;
    // thumbnails for the item icons: an opaque copy of the base layers on a sheet (a strip would be too tall for a canvas)
    const cols = 16, sheet = document.createElement('canvas');
    sheet.width = cols * S; sheet.height = Math.ceil(n / cols) * S;
    const sx = sheet.getContext('2d', { willReadFrequently: true });   // CPU-side: icons read it back layer by layer
    for (let i = 0; i < n; i++) {
      const px = new Uint8ClampedArray(set.raw.albedo.subarray(i * L, (i + 1) * L));
      if (!set.tuning[i].cutout) for (let p = 3; p < L; p += 4) px[p] = 255;
      sx.putImageData(new ImageData(px, S, S), (i % cols) * S, Math.floor(i / cols) * S);
    }
    set.thumb = (l) => [sheet, (l % cols) * S, Math.floor(l / cols) * S, S, S];
  }

  /** Makes a texture set the block materials (under any resource pack the player loaded). */
  applySet(set) {
    this.builtin = set;
    this.builtinRaw = set.raw ? { size: set.raw.size, albedo: set.raw.albedo, normal: set.raw.normal, mask: set.raw.mask } : null;
    const r = this.renderer;
    if (set.raw) for (const w of ['albedo', 'normal', 'mask']) r.uploadLayersRaw(w, set.raw[w], set.raw.size, set.raw.layers);
    else for (const w of ['albedo', 'normal', 'mask']) r.uploadLayers(w, set.parts ? set.parts[w] : set[w], set.extra ? set.extra[w] : null);
    r.setTuning(set.tuning);
    r.setVariants(set.variants);
    r.setCrackTexture(set.crack);
    r.setMoonTexture(set.moon);
    r.setStarsTexture(set.stars || null);
    this.icons = new Icons(set.thumbs || set.albedo, { tuning: set.tuning, items: set.items, thumb: set.thumbs ? null : set.thumb });
    r.uploadAtlas(this.icons.canvas);
    this.updateFarPalette();
    this.audio.setSamples(set.sounds);
    this.emit('inventory'); this.emit('textures', set);
  }

  /** Far terrain colours: the average colour of each surface texture (so it matches the textures in use). */
  updateFarPalette() {
    const avg = (name) => this.icons.layerAvg[LAYER_NAMES.indexOf(name)] || [0.3, 0.3, 0.3];
    const names = ['GrassTop', 'Sand', 'Snow', 'Stone', 'Gravel', 'RedSandstone', 'Sandstone', 'Mud', 'Stone', 'Ice'];
    this.renderer.farPalette = new Float32Array(names.flatMap((n) => avg(n)));
    this.renderer.farLeaf = avg('Leaves');
  }

  /** Switches the built-in set from the settings; a loaded resource pack is converted again on top of it. */
  async setTextureSet(name) {
    const set = await this.loadSet(name);
    if (set === this.builtin) return set;
    this.applySet(set);
    if (this.pack) {
      const saved = await PackStore.get();
      if (saved) await this.applyPack(saved, false);
    }
    return set;
  }

  // ---------------------------------------------------------------- resource packs

  /** Reads a pack ZIP the player chose, applies it and keeps it in this browser. */
  async loadPackFile(file, opts) {
    const pack = await readPackZip(await file.arrayBuffer(), file.name);
    pack.opts = opts;
    const info = await this.applyPack(pack, true);
    pack.info = info;
    const stored = await PackStore.put(pack);
    return { ...info, stored };
  }

  /** Switches to one of the packs that ship with the game (Settings > Block textures). */
  async useBuiltinPack(id) {
    const pack = await fetchBuiltinPack(this.assetBase, id);
    const info = await this.applyPack(pack, true);
    await PackStore.put({ builtin: id, name: pack.name, opts: pack.opts });
    return info;
  }

  /** Converts a pack (from a ZIP or from storage) into the block materials. */
  async applyPack(pack, fresh) {
    if (!this.builtinRaw) {
      // every layer's own picture, one per layer, for the blocks a pack leaves out
      const set = this.builtin, n = LAYER_NAMES.length, S = set.albedo.width, L = S * S * 4;
      const raw = { size: S, albedo: new Uint8Array(L * n), normal: new Uint8Array(L * n), mask: new Uint8Array(L * n) };
      for (const w of ['albedo', 'normal', 'mask']) for (let i = 0; i < n; i++) raw[w].set(await set.rawLayer(w, i), i * L);
      this.builtinRaw = raw;
    }
    const conv = await convertPack(pack, this.builtinRaw, pack.opts || {}, { surface: (data, size, count, opts) => this.runSurface(data, size, count, opts) });
    const n = LAYER_NAMES.length, r = this.renderer;
    r.uploadLayersRaw('albedo', conv.albedo, conv.size, conv.layers);
    r.uploadLayersRaw('normal', conv.normal, conv.size, conv.layers);
    r.uploadLayersRaw('mask', conv.mask, conv.size, conv.layers);
    r.setTuning(conv.tuning);
    r.setVariants(conv.variants);
    r.setCrackTexture(conv.crack || this.builtin.crack);
    r.setMoonTexture(conv.moon || this.builtin.moon);
    // item icons: block faces from the converted layers (a sheet: a strip would be too tall), items from the pack
    const S = conv.size, LB = S * S * 4, cols = 16, sheet = document.createElement('canvas');
    sheet.width = cols * S; sheet.height = Math.ceil(n / cols) * S;
    const sx = sheet.getContext('2d', { willReadFrequently: true });   // CPU-side: icons read it back layer by layer
    for (let i = 0; i < n; i++) {
      const px = new Uint8ClampedArray(conv.albedo.subarray(i * LB, (i + 1) * LB));
      if (!conv.tuning[i].cutout) for (let q = 3; q < LB; q += 4) px[q] = 255;
      sx.putImageData(new ImageData(px, S, S), (i % cols) * S, Math.floor(i / cols) * S);
    }
    const items = new Map([...(this.builtin.items || []), ...conv.items]);
    this.icons = new Icons(sheet, { tuning: conv.tuning, items, thumb: (l) => [sheet, (l % cols) * S, Math.floor(l / cols) * S, S, S] });
    r.uploadAtlas(this.icons.canvas);
    this.updateFarPalette();
    this.audio.setSamples({ ...(this.builtin.sounds || {}), ...conv.sounds });
    if (this.packIcon) URL.revokeObjectURL(this.packIcon);
    this.packIcon = pack.icon ? URL.createObjectURL(new Blob([pack.icon], { type: 'image/png' })) : null;
    this.pack = { name: pack.name, description: pack.description, credit: pack.credit || '', builtin: pack.builtin || null, found: conv.found, size: conv.size, source: conv.source,
      stats: conv.stats, items: conv.items.size, sounds: Object.keys(conv.sounds).length, opts: pack.opts || {} };
    this.emit('inventory'); this.emit('pack', this.pack);
    return this.pack;
  }

  async removePack() {
    this.pack = null;
    this.applySet(this.builtin);
    await PackStore.clear();
    this.emit('inventory'); this.emit('pack', null);
  }

  /** Re-applies the stored pack with other options (normal convention, specular format). */
  async repackWith(opts) {
    const saved = await PackStore.get();
    if (!saved || saved.builtin) return null;   // built-in packs carry their own conventions
    saved.opts = opts;
    await PackStore.put(saved);
    return this.applyPack(saved, false);
  }

  applySettings(s) {
    this.settings = s;
    const r = this.renderer.settings;
    r.renderScale = s.renderScale; r.shadows = s.shadows; r.bloom = s.bloom; r.godRays = s.godRays; r.fov = s.fov; r.pom = s.pom;
    Object.assign(r, { bloomStrength: s.bloomStrength ?? 1, rayStrength: s.rayStrength ?? 1, clouds: s.clouds !== false, ao: s.ao ?? 1,
      brightness: s.brightness ?? 1, nightBrightness: s.nightBrightness ?? 1, saturation: s.saturation ?? 1, fogMul: s.fog ?? 1,
      shadowDistance: s.shadowDistance ?? 88, farDistance: s.farDistance ?? 0, cloudQuality: s.cloudQuality ?? 1, ssao: s.ssao !== false,
      aa: s.aa !== false, sharpen: s.sharpen ?? 0.6 });
    this.renderer.setShadowSize(s.shadowQuality || 2048);
    if (this.world) { this.world.viewDistance = s.viewDistance; this.world.setLeaves(s.leaves || 'fluffy'); }
    this.applyClock();
    this.audio.volumes = { master: s.volume, sfx: s.sfx, ambience: s.ambience };
    this.audio.applyVolumes();
  }

  /** Day cycle, fixed hours and forced weather from the settings (not for the title-screen backdrop). */
  applyClock() {
    const s = this.settings;
    if (!this.tod || !s || (this.meta && this.meta.menu)) return;
    this.tod.dayMinutes = s.dayLength || 20;
    const mode = s.dayCycle || 'normal';
    if (mode === 'normal') this.tod.running = true;
    else {
      this.tod.running = false;
      if (mode === 'day') this.tod.hour = 12;
      else if (mode === 'night') { this.tod.hour = 0.5; this.tod.day = 4; }   // a full moon high in the sky
      else this.tod.hour = s.fixedHour ?? 12;
    }
    const forced = { clear: 0, cloudy: 1, rain: 2, storm: 4, fog: 5 }[s.weatherMode];
    if (this.weather) {
      if (forced == null) this.weather.frozen = false;
      else if (this.weather.current !== forced || !this.weather.frozen) { this.weather.force(forced); this.weather.frozen = true; this.weather.blend = 0; }
    }
  }

  // ---------------------------------------------------------------- session

  /** A streaming world for a dimension; edits of every dimension are kept in dimModified between visits. */
  makeWorld(dim) {
    const w = new World({
      seed: this.meta.seed, workerUrl: this.workerUrl, viewDistance: this.settings.viewDistance, modified: this.dimModified[dim], dim,
      onMesh: (s, m) => this.renderer.uploadSection(s, m),
      onUnloadSection: (s) => this.renderer.freeSection(s),
    });
    if (dim === Dim.Overworld) {
      if (this.meta.removedProps) for (const a of this.meta.removedProps) w.props.removed.add(a);
      if (this.propLib) w.props.setLibrary(this.propLib);
    }
    return w;
  }

  async startWorld(meta, isNew) {
    this.stopWorld();
    this.meta = meta;
    // saved sections: overworld keys as they were, the Nether's and the End's prefixed N/ and E/
    const all = isNew ? new Map() : await this.store.loadSections(meta.id);
    this.dimModified = [new Map(), new Map(), new Map()];
    for (const [k, v] of all) {
      const d = k.startsWith('N/') ? 1 : k.startsWith('E/') ? 2 : 0;
      this.dimModified[d].set(d ? k.slice(2) : k, v);
    }
    this.dim = isNew ? Dim.Overworld : meta.dim || Dim.Overworld;
    meta.portals = meta.portals || [];
    this.world = this.makeWorld(this.dim);
    this.player = new Player();
    this.inventory = new Inventory();
    this.stats = new SurvivalStats();
    this.tod = new TimeOfDay();
    this.weather = new Weather(meta.seed);
    this.entities = [];
    this.particles = { break: [], rain: [], snow: [] };
    this.mobs.clear();
    this.mining = null;
    this.creative = meta.mode === 'creative';
    this.player.canFly = this.creative;
    this.player.onLand = (h, water) => {
      if (water) { if (h > 1.5) { this.audio.splash(); this.spawnSplash(Math.min(1, h / 8)); } return; }
      if (h > 0.6) this.audio.step(this.blockUnderFeet(), 0.55);
      if (!this.creative) this.stats.land(h, water);
    };
    this.player.onStep = () => this.audio.step(this.blockUnderFeet());
    this.stats.onDamage = (a) => { this.damageFlash = Math.min(1, this.damageFlash + 0.5 + a * 0.05); this.audio.hurt(); this.emit('hud'); };
    this.stats.onDeath = (cause) => this.die(cause);
    this.inventory.onChange = () => this.emit('inventory');
    if (isNew) {
      if (this.creative) CREATIVE_HOTBAR.forEach((b, i) => { this.inventory.slots[i] = { item: b, count: 64 }; });
      this.spawn = this.findSpawn();
      this.player.teleport(this.spawn, meta.spawnYaw ?? 0.6, -0.08);
      this.needGround = true;
      this.tod.hour = 8.2;
    } else {
      const p = meta.player;
      this.spawn = p.spawn;
      this.player.teleport(p.pos, p.yaw, p.pitch);
      this.player.flying = !!p.flying && this.creative;
      this.inventory.load(meta.inventory);
      this.stats.load(meta.stats);
      this.tod.hour = meta.time.hour; this.tod.day = meta.time.day;
      if (meta.weather) this.weather.load(meta.weather);
      this.needGround = false;
    }
    this.state = 'loading';
    this.loadStart = performance.now();
    this.world.setLeaves((this.settings && this.settings.leaves) || 'fluffy');
    this.applyClock();
    this.nextAutosave = this.time + 60;
    this.emit('state', this.state);
    this.emit('inventory');
  }

  stopWorld() {
    if (this.world) {
      if (this.dimModified && !this.meta.menu) this.dimModified[this.dim] = this.world.editedSections();
      for (const col of this.world.columns.values()) for (const s of col.render) this.renderer.freeSection(s);
      this.world.dispose();
      this.world = null;
    }
  }

  findSpawn() {
    const T = terrainFor(this.meta.seed), tmp = {};
    for (let ring = 0; ring < 96; ring++) for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + ring * 0.37;
      const x = Math.floor(Math.cos(a) * ring * 24), z = Math.floor(Math.sin(a) * ring * 24);
      const s = T.sample(x + 0.5, z + 0.5, tmp);
      const open = s.biome === Biome.Plains || s.biome === Biome.Forest || s.biome === Biome.Savanna || s.biome === Biome.Taiga;
      if (open && s.height > SEA + 3 && s.height < 110 && (s.mountain ?? 0) < 0.3) return [x + 0.5, Math.floor(s.height) + 1.05, z + 0.5];
    }
    return [0.5, 150, 0.5];
  }

  /** Once the spawn column is loaded: stand on real ground (trees and water can cover the sampled height). */
  settleOnGround() {
    const w = this.world, p = this.player.body.pos;
    const ground = (x, z) => {
      for (let y = MAX_Y - 1; y > MIN_Y; y--) {
        const b = w.getBlock(x, y, z);
        if (b < 0) return null;
        if (b === B.Air || (BLOCKS[b].flags & F.Replaceable && !isWater(b))) continue;
        if (isWater(b) || BLOCKS[b].shape === Shape.Cutout) return null;
        if (BLOCKS[b].flags & F.Solid) return y + 1;
        return null;
      }
      return null;
    };
    const bx = Math.floor(p[0]), bz = Math.floor(p[2]);
    for (let r = 0; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const y = ground(bx + dx, bz + dz);
      if (y != null) { this.spawn = [bx + dx + 0.5, y + 0.02, bz + dz + 0.5]; this.player.teleport(this.spawn); return; }
    }
    this.player.teleport([p[0], Math.max(p[1], (w.heightmapAt(bx, bz) ?? 100) + 1.05), p[2]]);
  }

  loadingProgress() {
    const w = this.world, p = this.player.body.pos;
    const cx = Math.floor(p[0]) >> 5, cz = Math.floor(p[2]) >> 5;
    let ready = 0, total = 0;
    const R = 3;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > R * R) continue;
      total++;
      const c = w.column(cx + dx, cz + dz);
      if (c && c.state === 'ready' && !c.render.some((s) => s.needsMesh || s.meshing)) ready++;
    }
    return ready / total;
  }

  metaSnapshot() {
    const p = this.player;
    return {
      ...this.meta,
      player: { pos: [...p.body.pos], yaw: p.yaw, pitch: p.pitch, spawn: this.spawn, flying: p.flying }, dim: this.dim, portals: this.meta.portals || [],
      inventory: this.inventory.toJSON(), stats: this.stats.toJSON(),
      time: { hour: this.tod.hour, day: this.tod.day }, weather: this.weather.toJSON(),
      removedProps: this.dim === Dim.Overworld ? [...this.world.props.removed] : this.meta.removedProps || [],
    };
  }

  /** The title screen's backdrop: a world that loads behind the menu and slowly turns at golden hour. */
  async startMenuWorld() {
    await this.startWorld({ id: 'menu', name: 'Voxelwild', seed: 20260925, mode: 'creative', menu: true }, true);
    this.tod.hour = 17.35; this.tod.running = false;
    this.weather.frozen = true;
  }

  async save(manual = false) {
    if (!this.world || this.state === 'loading' || this.meta.menu || this.meta.unsaved) return;
    try {
      const meta = this.metaSnapshot();
      const sections = new Map();
      for (let d = 0; d < 3; d++) {
        const src = d === this.dim ? this.world.editedSections() : this.dimModified[d];
        for (const [k, v] of src) sections.set((d === 1 ? 'N/' : d === 2 ? 'E/' : '') + k, v);
      }
      await this.store.saveWorld(meta, sections);
      this.meta = meta;
      this.emit('saved', manual);
    } catch (e) { console.error('save failed', e); this.emit('toast', 'Saving failed: ' + (e && e.message)); }
  }

  die(cause) {
    const p = this.player.body.pos;
    // scatter the inventory where the player fell
    for (let i = 0; i < this.inventory.slots.length; i++) {
      const s = this.inventory.slots[i];
      if (!s) continue;
      this.spawnItem(s.item, s.count, [p[0], Math.max(p[1], MIN_Y + 2) + 0.8, p[2]], [(Math.random() - 0.5) * 5, 3 + Math.random() * 2, (Math.random() - 0.5) * 5], s.wear);
      this.inventory.slots[i] = null;
    }
    this.inventory.changed();
    this.deathCause = cause;
    this.state = 'dead';
    this.mining = null;
    this.emit('state', this.state, cause);
  }

  respawn() {
    this.stats.reset();
    this.burning = 0;
    if (this.dim !== Dim.Overworld) {
      this.player.flying = false;
      this.travel(Dim.Overworld, this.spawn, this.player.yaw, null);
      this.emit('hud');
      return;
    }
    this.player.teleport(this.spawn, this.player.yaw, 0);
    this.player.flying = false;
    this.state = 'loading';
    this.needGround = false;
    this.emit('state', this.state);
    this.emit('hud');
  }

  setMode(creative) {
    this.creative = creative;
    this.meta.mode = creative ? 'creative' : 'survival';
    this.player.canFly = creative;
    if (!creative) this.player.flying = false;
    this.emit('hud'); this.emit('inventory');
  }

  // ---------------------------------------------------------------- queries

  blockUnderFeet() {
    const p = this.player.body.pos;
    const b = this.world.getBlock(Math.floor(p[0]), Math.floor(p[1] - 0.05), Math.floor(p[2]));
    return b < 0 ? B.Stone : b;
  }

  /** Approximate sky + block light at a point (entities, the held item, camera exposure). */
  lightAt(x, y, z) {
    // sky light: 15 minus the opacity stacked above (leaves dim it, rock blocks it), like the mesher's column pass
    const w = this.world, bx = Math.floor(x), bz = Math.floor(z);
    const h = w.heightmapAt(bx, bz);
    let light = 15;
    if (h != null) for (let yy = Math.floor(y) + 1; yy <= h && light > 0; yy++) {
      const b = w.getBlock(bx, yy, bz);
      if (b > 0) light -= Math.max(1, OPACITY[b] === 15 ? 15 : OPACITY[b]);
    }
    return { sky: Math.max(0, light) / 15, block: this.blockLightNear(x, y, z) };
  }
  blockLightNear(x, y, z) {
    const w = this.world, bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    let best = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
      const d = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
      if (d > 13) continue;
      const b = w.getBlock(bx + dx, by + dy, bz + dz);
      if (b > 0 && EMITTERS[b] && EMITTERS[b] - d > best) best = EMITTERS[b] - d;
    }
    return best / 15;
  }

  // ---------------------------------------------------------------- frame

  frame(dt) {
    this.time += dt;
    if (!this.world) return;
    const w = this.world, pl = this.player;
    const eye = pl.eye();
    w.setViewer(eye[0], eye[1], eye[2]);
    // far terrain in the overworld, out to the chosen distance
    const farDist = this.settings ? this.settings.farDistance || 0 : 0;
    const farOn = farDist > 0 && this.dim === Dim.Overworld && farDist > w.viewDistance * 32;
    this.renderer.farOn = farOn;
    if (farOn) this.far.update(eye, this.meta.seed >>> 0, farDist);
    w.update(this.state === 'playing' || this.state === 'loading' || this.state === 'inventory' ? dt : 0);

    if (this.meta.menu) {
      // title backdrop: no player, just a slow turn above the spawn
      if (this.state === 'loading' && this.loadingProgress() >= 1) {
        if (this.needGround) { this.settleOnGround(); this.needGround = false; }
        this.menuBase = [...this.player.body.pos];
        this.state = 'menu';
        this.emit('menuReady');
      }
      if (this.state === 'menu') {
        this.menuAngle = (this.menuAngle ?? 2.2) + dt * 0.025;
        const b = this.menuBase;
        this.player.teleport([b[0] + Math.sin(this.menuAngle) * 6, b[1] + 26, b[2] + Math.cos(this.menuAngle) * 6], this.menuAngle + Math.PI, -0.16);
      }
    } else if (this.state === 'loading') {
      const prog = this.loadingProgress();
      this.emit('loading', prog);
      const c = w.column(Math.floor(pl.body.pos[0]) >> 5, Math.floor(pl.body.pos[2]) >> 5);
      if (prog >= 1 && c && c.state === 'ready') {
        if (this.arrival) { const a = this.arrival; this.arrival = null; a(); }
        else if (this.needGround) { this.settleOnGround(); this.needGround = false; }
        this.state = 'playing';
        this.emit('state', this.state);
        this.emit('hud');
      }
    }
    const active = this.state === 'playing' || this.state === 'inventory';
    if (active) this.update(dt);
    this.updateEnvironment(active || this.state === 'menu' ? dt : 0);
    w.updateVisibility(pl.eye());
    this.draw(dt);
    this.pressed.clear();
    this.mouse.leftClicked = this.mouse.rightClicked = false;
  }

  input() {
    const k = this.keys, p = this.pressed;
    const locked = this.state === 'playing';
    const on = (c) => locked && k.has(c);
    return {
      fwd: (on('KeyW') || on('ArrowUp') ? 1 : 0) - (on('KeyS') || on('ArrowDown') ? 1 : 0) + (this.touch ? this.touch.fwd : 0),
      strafe: (on('KeyD') ? 1 : 0) - (on('KeyA') ? 1 : 0) + (this.touch ? this.touch.strafe : 0),
      jump: on('Space') || !!(this.touch && this.touch.jump),
      jumpPressed: locked && p.has('Space'),
      sprint: on('ControlLeft') || on('ControlRight') || (this.sprintToggle && (on('KeyW') || (this.touch && this.touch.fwd > 0.5))),
      descend: on('ShiftLeft') || on('ShiftRight'),
      flyToggle: locked && p.has('KeyF'),
      time: this.time,
    };
  }

  update(dt) {
    const pl = this.player, w = this.world;
    const inp = this.input();
    if (this.keys.has('KeyW') && this.pressed.has('KeyW')) {
      if (this.time - (this.lastW || -1) < 0.3) this.sprintToggle = true;
      this.lastW = this.time;
    }
    if (!this.keys.has('KeyW') && !(this.touch && this.touch.fwd > 0.5)) this.sprintToggle = false;
    // arrow-key look (also the fallback when the pointer cannot be captured)
    if (this.state === 'playing') {
      const lk = 2.2 * dt;
      if (this.keys.has('ArrowLeft')) pl.yaw += lk;
      if (this.keys.has('ArrowRight')) pl.yaw -= lk;
    }
    const before = pl.body.pos[1];
    pl.update(w, dt, inp);
    this.updateHazards(dt);
    if (pl.body.pos[1] < MIN_Y - 40) { if (this.creative) pl.teleport([pl.body.pos[0], MAX_Y - 4, pl.body.pos[2]]); else this.stats.damage(1000, 'void'); }
    const wasHead = this.headWet;
    this.headWet = pl.headInWater;
    if (!wasHead && pl.inWater && before - pl.body.pos[1] > 0.05 && !this.inWaterPrev) this.audio.splash();
    this.inWaterPrev = pl.inWater;

    if (this.state === 'playing') {
      this.hotbarKeys();
      this.interact(dt);
    }
    this.updateEntities(dt);
    this.updateEyes(dt);
    if (!this.meta.menu) this.mobs.update(dt);

    const [jumps, dist] = pl.consumeActivity();
    if (!this.creative) this.stats.tick(dt, dist, pl.sprinting, jumps, pl.headInWater);
    this.hudTimer = (this.hudTimer || 0) - dt;
    if (this.hudTimer <= 0) { this.hudTimer = 0.2; this.emit('hud'); }
    if (this.time >= this.nextAutosave) { this.nextAutosave = this.time + 60; this.save(); }
  }

  hotbarKeys() {
    for (let i = 0; i < HOTBAR; i++) if (this.pressed.has(`Digit${i + 1}`)) this.select(i);
    if (this.pressed.has('KeyQ')) this.dropHeld(this.keys.has('ControlLeft'));
  }
  select(i) { this.inventory.selected = ((i % HOTBAR) + HOTBAR) % HOTBAR; this.mining = null; this.emit('inventory'); this.emit('heldName'); }
  scroll(d) { this.select(this.inventory.selected + (d > 0 ? 1 : -1)); }

  dropHeld(all) {
    const s = this.inventory.held;
    if (!s) return;
    const n = all ? s.count : 1;
    const f = this.player.forward(), e = this.player.eye();
    this.spawnItem(s.item, n, [e[0] + f[0] * 0.4, e[1] - 0.3, e[2] + f[2] * 0.4], [f[0] * 5, f[1] * 5 + 1.5, f[2] * 5], s.wear, 1.2);
    s.count -= n;
    if (s.count <= 0) this.inventory.slots[this.inventory.selected] = null;
    this.inventory.changed();
  }

  // ---------------------------------------------------------------- mining / placing

  interact(dt) {
    const pl = this.player, w = this.world, inv = this.inventory;
    const eye = pl.eye(), dir = pl.forward();
    let hit = raycast(w, eye, dir, REACH, targetable);
    this.swing = Math.max(0, (this.swing || 0) - dt * 3.2);
    const mobHit = this.mobs.pick(eye, dir, 3.6);
    this.attackT = (this.attackT || 0) - dt;
    if (mobHit && (!hit || mobHit.dist < hit.dist)) {
      this.target = null;
      if (this.mouse.leftClicked && this.attackT <= 0) {
        const def = inv.heldItem;
        const dmg = def && def.kind === Kind.Tool ? (def.damage || [1, 2, 3, 4, 5][def.tier] + 1) : 1;
        this.mobs.hurt(mobHit.mob, this.creative ? Math.max(dmg, 4) : dmg, this.player);
        this.attackT = 0.45; this.swing = 1;
        this.spawnBreakParticles([mobHit.mob.body.pos[0] - 0.5, mobHit.mob.body.pos[1] + mobHit.mob.def.height * 0.4, mobHit.mob.body.pos[2] - 0.5], B.Stone, 0);
        if (def && def.kind === Kind.Tool && !this.creative && inv.wearHeld()) this.emit('toast', `${def.name} broke`);
      }
      this.mining = null;
      return;
    }
    this.target = hit;

    // breaking
    if (this.mouse.left && hit) {
      const key = hit.hit.join(',');
      if (!this.mining || this.mining.key !== key || this.mining.block !== hit.block) {
        const held = inv.held ? inv.held.item : 0;
        this.mining = { key, pos: hit.hit, block: hit.block, progress: 0, time: this.creative ? 0 : breakSeconds(hit.block, held), hitTimer: 0 };
      }
      const m = this.mining;
      if (this.creative) {
        this.breakCooldown = (this.breakCooldown || 0) - dt;
        if (this.breakCooldown <= 0 && m.block !== B.Bedrock) { this.breakBlock(m.pos, m.block, false); this.breakCooldown = 0.2; this.mining = null; this.swing = 1; }
      } else if (m.time !== Infinity) {
        m.progress += m.time > 0 ? dt / m.time : 1;
        m.hitTimer -= dt;
        if (m.hitTimer <= 0) { m.hitTimer = 0.24; this.audio.hit(m.block); this.swing = 1; this.spawnBreakParticles(m.pos, m.block, 3); }
        if (m.progress >= 1) { this.breakBlock(m.pos, m.block, true); this.mining = null; }
      }
    } else {
      this.mining = null;
      this.breakCooldown = 0;
    }
    if (this.mouse.leftClicked && !hit) this.swing = 1;

    // using / placing
    this.useCooldown = (this.useCooldown || 0) - dt;
    if ((this.mouse.rightClicked || (this.mouse.right && this.useCooldown <= 0))) {
      this.useCooldown = 0.25;
      const def = inv.heldItem;
      const sneaking = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      if (hit && !sneaking && this.toggle(hit)) { this.useCooldown = 0.3; this.swing = 1; }
      else if (def && def.kind === Kind.Use) this.useItem(def, hit);
      else if (def && def.kind === Kind.Food) {
        if (!this.creative && this.stats.hunger < 20) { this.stats.eat(def.food, def.sat); inv.consumeHeld(); this.audio.eat(); this.swing = 1; this.emit('hud'); }
      } else if (hit && def && def.kind === Kind.Block) this.place(hit, def.block);
    }
  }

  breakBlock(pos, block, survival) {
    const w = this.world;
    const [x, y, z] = pos;
    const inv = this.inventory, held = inv.held ? inv.held.item : 0;
    if (!w.setBlock(x, y, z, B.Air)) return;
    if (block === B.Obsidian) this.breakPortalsAround(x, y, z);
    this.audio.break(block);
    this.spawnBreakParticles(pos, block, 26);
    if (survival) {
      for (const [item, n] of drops(block, held, Math.random()))
        this.spawnItem(item, n, [x + 0.5, y + 0.3, z + 0.5], [(Math.random() - 0.5) * 2, 3, (Math.random() - 0.5) * 2]);
      const def = inv.heldItem;
      if (def && def.kind === Kind.Tool && BLOCKS[block] && (BLOCKS[block].flags & F.Breakable)) {
        if (inv.wearHeld()) { this.audio.break(B.Planks); this.emit('toast', `${def.name} broke`); }
      }
      this.stats.addExhaustion(0.005);
    }
    // the other half of a door or a tall plant goes with it
    const fam = famOf(block);
    if (fam && (fam.kind === K.Door || fam.kind === K.Tall)) {
      const oy = BLOCKS[block].model.state & 1 ? y - 1 : y + 1, other = w.getBlock(x, oy, z);
      if (other > 0 && famOf(other) === fam) { w.setBlock(x, oy, z, B.Air); this.spawnBreakParticles([x, oy, z], other, 10); }
    }
    // blocks that need support fall with it (plants, torches on top)
    let yy = y + 1;
    for (;;) {
      const above = w.getBlock(x, yy, z);
      if (above <= 0 || !(BLOCKS[above].flags & F.NeedsSupport)) break;
      w.setBlock(x, yy, z, B.Air);
      this.spawnBreakParticles([x, yy, z], above, 10);
      if (survival) for (const [item, n] of drops(above, 0, Math.random())) this.spawnItem(item, n, [x + 0.5, yy + 0.3, z + 0.5], [0, 2, 0]);
      yy++;
    }
  }

  /** Outline boxes of the targeted block (shaped blocks show their real shape). */
  selectionBoxes(t) {
    const d = BLOCKS[t.block];
    if (!d || !d.model || d.shape !== Shape.Model) return null;
    const bs = this.world.modelBoxesAt(t.hit[0], t.hit[1], t.hit[2], t.block, false);
    if (!bs.length) return null;
    const u = [1, 1, 1, 0, 0, 0];
    for (const b of bs) for (let k = 0; k < 3; k++) { u[k] = Math.min(u[k], b[k]); u[k + 3] = Math.max(u[k + 3], b[k + 3]); }
    return bs.length > 3 ? [u] : bs;
  }

  /** Right-click on doors, trapdoors and gates: open or close. Returns true when something toggled. */
  toggle(hit) {
    const w = this.world, fam = famOf(hit.block);
    if (!fam || (fam.kind !== K.Door && fam.kind !== K.Trapdoor && fam.kind !== K.Gate)) return false;
    const [x, y, z] = hit.hit, st = BLOCKS[hit.block].model.state;
    const flip = fam.kind === K.Gate ? 1 : 2;
    w.setBlock(x, y, z, fam.first + (st ^ flip));
    if (fam.kind === K.Door) {
      const oy = st & 1 ? y - 1 : y + 1, other = w.getBlock(x, oy, z);
      if (other > 0 && famOf(other) === fam) w.setBlock(x, oy, z, fam.first + (BLOCKS[other].model.state ^ 2));
    }
    this.audio.place(hit.block);
    return true;
  }

  /** The state a shaped block takes from where it is placed and which way the player looks; -1 if it cannot go there. */
  modelState(fam, hit, pos) {
    const w = this.world, f = facingFromYaw(this.player.yaw), fy = hit.point ? hit.point[1] - Math.floor(hit.point[1] - (hit.face === 2 ? 1e-4 : 0)) : 0.25;
    const upper = hit.face === 3 || (hit.face !== 2 && fy > 0.5) ? 1 : 0;
    const wall = (side) => { const n = [[1, 0], [-1, 0], [0, 1], [0, -1]][side], b = w.getBlock(pos[0] + n[0], pos[1], pos[2] + n[1]); return b > 0 && (BLOCKS[b].flags & F.Opaque); };
    switch (fam.kind) {
      case K.Slab: return upper;
      case K.Stairs: return f * 2 + upper;
      case K.Gate: return f * 2;
      case K.Door: return f * 4;
      case K.Trapdoor: return f * 4 + upper;
      case K.Button: return hit.face === 2 ? 4 : hit.face === 3 ? 5 : opposite(facingFromFace(hit.face));
      case K.Ladder: case K.WallTorch: {
        const side = hit.face === 2 || hit.face === 3 ? f : opposite(facingFromFace(hit.face));
        return wall(side) || fam.key === 'vine' && hit.face !== 2 && hit.face !== 3 ? side : -1;
      }
      case K.Rail: return f >= 2 ? 0 : 1;
      default: return 0;
    }
  }

  place(hit, block) {
    const w = this.world;
    let fam = famOf(block);
    // torches on walls
    if (block === B.Torch && FAM.wall_torch && hit.face !== 2 && hit.face !== 3 && hit.face >= 0) { fam = FAM.wall_torch; block = fam.first; }
    const hm = BLOCKS[hit.block].model;
    if (fam && hm && hm.fam === fam.index) {
      // a slab onto its matching slab: a double slab; snow onto snow: a deeper layer
      if (fam.kind === K.Slab && hm.state !== 2 && ((hm.state === 0 && hit.face === 2) || (hm.state === 1 && hit.face === 3))) {
        if (w.setBlock(hit.hit[0], hit.hit[1], hit.hit[2], fam.first + 2)) { this.audio.place(block); this.swing = 1; if (!this.creative) this.inventory.consumeHeld(); }
        return;
      }
      if (fam.kind === K.Snow && hm.state < 7 && hit.face === 2) {
        if (w.setBlock(hit.hit[0], hit.hit[1], hit.hit[2], fam.first + hm.state + 1)) { this.audio.place(block); this.swing = 1; if (!this.creative) this.inventory.consumeHeld(); }
        return;
      }
    }
    if (fam && fam.kind === K.Lily) {
      // lily pads float: aim through to the water surface
      const eye = this.player.eye(), wh = raycast(w, eye, this.player.forward(), REACH, (b) => b !== 0);
      if (!wh || !isWater(wh.block) || w.getBlock(wh.hit[0], wh.hit[1] + 1, wh.hit[2]) !== B.Air) return;
      if (w.setBlock(wh.hit[0], wh.hit[1] + 1, wh.hit[2], fam.first)) { this.audio.place(block); this.swing = 1; if (!this.creative) this.inventory.consumeHeld(); }
      return;
    }
    const d = BLOCKS[block];
    // plants and other replaceables are built into, not onto
    const tgt = BLOCKS[hit.block].flags & F.Replaceable && !isWater(hit.block) ? hit.hit : hit.prev;
    const [x, y, z] = tgt;
    if (y < MIN_Y || y >= MAX_Y) return;
    const cur = w.getBlock(x, y, z);
    if (cur < 0 || !(BLOCKS[cur].flags & F.Replaceable)) return;
    if (d.flags & F.NeedsSupport) {
      const below = w.getBlock(x, y - 1, z);
      if (below < 0 || !(BLOCKS[below].flags & F.Solid) || !(BLOCKS[below].flags & F.Opaque)) return;
      if (isWater(cur)) return;
    }
    let id = block;
    if (fam) {
      const st = this.modelState(fam, hit, [x, y, z]);
      if (st < 0) return;
      id = fam.first + st;
      if (fam.kind === K.Door || fam.kind === K.Tall) {
        const up = w.getBlock(x, y + 1, z);
        if (up < 0 || !(BLOCKS[up].flags & F.Replaceable) || isLiquid(up)) return;
      }
    }
    if (d.flags & F.Solid) {
      const bs = fam ? w.modelBoxesAt(x, y, z, id, true) : [[0, 0, 0, 1, 1, 1]], mn = this.player.body.min(), mx = this.player.body.max();
      if (bs.some((b) => mx[0] > x + b[0] + 1e-3 && mn[0] < x + b[3] - 1e-3 && mx[1] > y + b[1] + 1e-3 && mn[1] < y + b[4] - 1e-3 && mx[2] > z + b[2] + 1e-3 && mn[2] < z + b[5] - 1e-3)) return;
    }
    if (!w.setBlock(x, y, z, id)) return;
    if (fam && (fam.kind === K.Door || fam.kind === K.Tall)) w.setBlock(x, y + 1, z, id + 1);
    this.audio.place(block);
    this.swing = 1;
    if (!this.creative) this.inventory.consumeHeld();
  }

  // ---------------------------------------------------------------- dimensions and portals

  /** Leaves this dimension for another: the new world streams in around pos, then arrive() places the player. */
  travel(dim, pos, yaw, arrive) {
    this.stopWorld();
    this.dim = dim;
    this.meta.dim = dim;
    this.world = this.makeWorld(dim);
    this.world.setLeaves((this.settings && this.settings.leaves) || 'fluffy');
    this.entities = [];
    this.mobs.clear();
    this.particles = { break: [], rain: [], snow: [], motes: [] };
    this.mining = null;
    this.portalTime = 0; this.portalLock = true;
    this.player.teleport(pos, yaw ?? this.player.yaw, 0);
    this.player.body.vel = [0, 0, 0];
    this.arrival = arrive;
    this.needGround = !arrive;
    this.state = 'loading';
    this.loadStart = performance.now();
    this.lutDirty = true;
    this.emit('travel', dim);
    this.emit('state', this.state);
  }

  /** Called every frame while playing: portals, lava, magma, burning. */
  updateHazards(dt) {
    const pl = this.player, w = this.world, p = pl.body.pos;
    const bx = Math.floor(p[0]), bz = Math.floor(p[2]);
    const feet = w.getBlock(bx, Math.floor(p[1] + 0.2), bz), head = w.getBlock(bx, Math.floor(p[1] + 1.4), bz);
    const eye = pl.eye();
    this.headInLava = isLava(w.getBlock(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2])));
    // nether portal: stand in it (4 s, 1 s in creative)
    const inPortal = isPortal(feet) || isPortal(head);
    if (inPortal && !this.portalLock && (this.dim !== Dim.End)) {
      this.portalTime = (this.portalTime || 0) + dt;
      this.portalHum = (this.portalHum || 0) - dt;
      if (this.portalTime >= (this.creative ? 1 : 4)) { this.portalTime = 0; this.netherTravel(); return; }
    } else if (!inPortal) { this.portalTime = Math.max(0, (this.portalTime || 0) - dt * 2); this.portalLock = false; }
    // end portal: straight through
    if ((feet === B.EndPortal || head === B.EndPortal) && !this.portalLock) {
      this.portalLock = true;
      if (this.dim === Dim.End) this.travel(Dim.Overworld, this.spawn, this.player.yaw, () => { this.settleOnGround(); this.emit('toast', 'Back in the overworld'); });
      else this.travel(Dim.End, END_ARRIVAL, Math.PI / 2, () => this.arriveEnd());
      return;
    }
    if ((feet === B.EndGateway || head === B.EndGateway || w.getBlock(bx, Math.floor(p[1] + 1.9), bz) === B.EndGateway) && !this.gatewayLock) {
      this.gatewayLock = true;
      const g = outerGateway(this.meta.seed);
      const out = Math.abs(p[0] - END_GATEWAY[0]) < 8;
      const target = out ? [g[0] + 4.5, g[1] + 4, g[2] + 0.5] : [END_GATEWAY[0] + 16.5, 64, END_GATEWAY[2] + 0.5];
      pl.teleport(target, pl.yaw, 0);
      this.state = 'loading'; this.needGround = true; this.emit('state', 'loading');
      this.arrival = () => { this.settleOnGround(); };
      return;
    } else if (feet !== B.EndGateway && head !== B.EndGateway) this.gatewayLock = false;
    if (this.creative) { this.burning = 0; return; }
    // lava burns, and keeps burning a while after
    const inLava = isLava(feet) || isLava(head);
    if (inLava) this.burning = 3.5;
    else if (isWater(feet) || isWater(head)) this.burning = 0;
    this.hurtTimer = (this.hurtTimer || 0) - dt;
    if (this.hurtTimer <= 0) {
      if (inLava) { this.stats.damage(4, 'lava'); this.hurtTimer = 0.5; this.spawnEmbers([p[0], p[1] + 0.5, p[2]], 6); }
      else if (this.burning > 0) { this.stats.damage(1, 'lava'); this.hurtTimer = 1; }
      else if (this.blockUnderFeet() === B.Magma && !this.keys.has('ShiftLeft') && pl.body.grounded) { this.stats.damage(1, 'magma'); this.hurtTimer = 1; }
    }
    this.burning = Math.max(0, (this.burning || 0) - dt);
  }

  netherTravel() {
    const to = this.dim === Dim.Nether ? Dim.Overworld : Dim.Nether;
    const p = this.player.body.pos, k = to === Dim.Nether ? 1 / 8 : 8;
    const tx = Math.floor(p[0] * k), tz = Math.floor(p[2] * k);
    // a portal already linked near the target (Minecraft searches 16 blocks in the Nether, 128 in the overworld)
    const radius = to === Dim.Nether ? 16 : 128;
    let best = null, bd = Infinity;
    for (const q of this.meta.portals) {
      if (q.dim !== to) continue;
      const d = Math.hypot(q.x - tx, q.z - tz);
      if (d <= radius && d < bd) { bd = d; best = q; }
    }
    const at = best ? [best.x + 0.5, best.y, best.z + 0.5] : [tx + 0.5, to === Dim.Nether ? 70 : 90, tz + 0.5];
    this.travel(to, at, this.player.yaw, () => this.arrivePortal(to, tx, tz, best));
  }

  arrivePortal(dim, tx, tz, known) {
    const w = this.world;
    if (known) {
      if (isPortal(w.getBlock(known.x, known.y, known.z))) { this.player.teleport([known.x + 0.5, known.y, known.z + 0.5]); this.portalLock = true; return; }
      this.meta.portals = this.meta.portals.filter((q) => q !== known);
    }
    // find a flat, open spot for a 4 x 5 frame near the target; failing that, carve one out
    const ok = (x, y, z) => {
      for (let i = 0; i < 4; i++) {
        const fl = w.getBlock(x + i, y - 1, z);
        if (fl < 0 || !(BLOCKS[fl].flags & F.Solid)) return false;
        for (let k = 0; k < 5; k++) for (let dz = -1; dz <= 1; dz++) if (w.getBlock(x + i, y + k, z + dz) !== B.Air) return false;
      }
      return true;
    };
    let spot = null;
    const yLo = dim === Dim.Nether ? 33 : 40, yHi = dim === Dim.Nether ? 110 : 180;
    outer: for (let r = 0; r <= 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = tx + dx - 1, z = tz + dz;
      if (dim === Dim.Overworld) {
        const h = w.heightmapAt(x, z);
        if (h != null && h >= yLo && h < yHi && !isWater(w.getBlock(x, h, z)) && ok(x, h + 1, z)) { spot = [x, h + 1, z]; break outer; }
      } else {
        for (let y = 70 - Math.floor(r / 2); y >= yLo; y--) if (ok(x, y, z)) { spot = [x, y, z]; break outer; }
        for (let y = 71; y < yHi; y++) if (ok(x, y, z)) { spot = [x, y, z]; break outer; }
      }
    }
    if (!spot) spot = [tx - 1, dim === Dim.Nether ? 70 : Math.max(70, (w.heightmapAt(tx, tz) ?? 69) + 1), tz];
    const [x0, y0, z0] = spot;
    // Minecraft's smallest frame: 4 wide, 5 tall, a 2 x 3 pane; open space in front and behind
    for (let i = 0; i < 4; i++) for (let k = -1; k <= 3; k++) {
      const frame = i === 0 || i === 3 || k === -1 || k === 3;
      w.setBlock(x0 + i, y0 + k, z0, frame ? B.Obsidian : B.NetherPortalX);
      if (k >= 0) for (const dz of [-1, 1]) if (w.getBlock(x0 + i, y0 + k, z0 + dz) !== B.Air) w.setBlock(x0 + i, y0 + k, z0 + dz, B.Air);
    }
    // a ledge on both sides when the frame stands over nothing (or over lava)
    for (let i = 0; i < 4; i++) for (const dz of [-1, 1]) {
      const b = w.getBlock(x0 + i, y0 - 1, z0 + dz);
      if (b === B.Air || isLava(b) || (b >= 0 && BLOCKS[b].flags & F.Replaceable)) w.setBlock(x0 + i, y0 - 1, z0 + dz, B.Obsidian);
    }
    this.meta.portals.push({ dim, x: x0 + 1, y: y0, z: z0 });
    this.player.teleport([x0 + 2, y0, z0 + 0.5], this.player.yaw, 0);
    this.portalLock = true;
    this.audio.portal && this.audio.portal();
  }

  /** The End: Minecraft's obsidian landing platform in the void, rebuilt on every visit. */
  arriveEnd() {
    const w = this.world, [ax, ay, az] = END_ARRIVAL.map(Math.floor);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      w.setBlock(ax + dx, ay - 1, az + dz, B.Obsidian);
      for (let k = 0; k < 3; k++) w.setBlock(ax + dx, ay + k, az + dz, B.Air);
    }
    this.player.teleport([ax + 0.5, ay, az + 0.5], Math.PI / 2, 0);
    this.portalLock = true;
    this.emit('toast', 'The End');
  }

  /** Flint and steel on an obsidian frame lights a portal; an eye of ender goes into a frame or flies toward a stronghold. */
  useItem(def, hit) {
    const inv = this.inventory, w = this.world;
    if (def.id === I.FlintAndSteel) {
      if (!hit) return;
      const [x, y, z] = hit.prev;
      this.swing = 1;
      if (this.dim !== Dim.End && this.lightPortal(x, y, z)) {
        this.audio.place(B.Obsidian);
        if (!this.creative) inv.wearHeld();
        this.emit('toast', 'The portal hums');
      } else this.spawnEmbers([x + 0.5, y + 0.2, z + 0.5], 6);
      return;
    }
    if (def.id === I.EyeOfEnder) {
      if (hit && hit.block === B.EndPortalFrame) {
        const [x, y, z] = hit.hit;
        w.setBlock(x, y, z, B.EndPortalFrameEye);
        if (!this.creative) inv.consumeHeld();
        this.swing = 1;
        this.audio.place(B.Obsidian);
        for (let cz = z - 2; cz <= z + 2; cz++) for (let cx = x - 2; cx <= x + 2; cx++) {
          if (frameRing(cx, cz).every(([fx, fz]) => w.getBlock(fx, y, fz) === B.EndPortalFrameEye)) {
            for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) w.setBlock(cx + dx, y, cz + dz, B.EndPortal);
            this.emit('toast', 'The End portal opens');
            return;
          }
        }
        return;
      }
      if (this.dim !== Dim.Overworld) { this.emit('toast', 'The eye drifts aimlessly here'); return; }
      const p = this.player.body.pos;
      let best = null, bd = Infinity;
      for (const s of strongholds(this.meta.seed)) { const d = Math.hypot(s.x - p[0], s.z - p[2]); if (d < bd) { bd = d; best = s; } }
      if (!this.creative) inv.consumeHeld();
      const e = this.player.eye(), dir = [best.x + 0.5 - e[0], best.z + 0.5 - e[2]], l = Math.hypot(dir[0], dir[1]) || 1;
      const close = bd < 12;
      (this.eyes || (this.eyes = [])).push({ p: [...e], d: [dir[0] / l, dir[1] / l], t: 0, close, drop: Math.random() < 0.8 });
      const card = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][Math.round(Math.atan2(dir[1], dir[0]) / (Math.PI / 4) + 8) % 8];
      this.emit('toast', close ? 'The eye sinks into the ground: dig down' : `The eye flies ${card}, about ${Math.round(bd / 10) * 10} blocks`);
      this.swing = 1;
    }
  }

  updateEyes(dt) {
    if (!this.eyes) return;
    for (let i = this.eyes.length - 1; i >= 0; i--) {
      const e = this.eyes[i];
      e.t += dt;
      if (e.t < 1.6) {
        const k = e.close ? 0 : 7 * dt;
        e.p[0] += e.d[0] * k; e.p[2] += e.d[1] * k; e.p[1] += (e.close ? -2 : 1.2) * dt;
        if (Math.random() < 0.5) this.particles.break.push({ p: [...e.p], v: [0, 0.3, 0], life: 0.5, size: 0.025, c: [0.25, 0.9, 0.6], sky: 1, blk: 1 });
      } else {
        if (e.drop) this.spawnItem(I.EyeOfEnder, 1, e.p, [0, 1, 0], undefined, 0.3);
        else this.spawnEmbers(e.p, 14, [0.3, 0.9, 0.55]);
        this.eyes.splice(i, 1);
      }
    }
  }

  /** Flood the air inside an obsidian frame (either axis, 2x3 up to 21x21) with portal blocks. */
  lightPortal(x, y, z) {
    const w = this.world;
    if (w.getBlock(x, y, z) !== B.Air) return false;
    for (const alongX of [true, false]) {
      const cells = [], seen = new Set([`${x},${y}`]), q = [[x, y, z]];
      let ok = true;
      while (q.length && ok) {
        const [cx, cy, cz] = q.pop();
        cells.push([cx, cy, cz]);
        if (cells.length > 441) { ok = false; break; }
        const nbs = alongX ? [[cx + 1, cy, cz], [cx - 1, cy, cz], [cx, cy + 1, cz], [cx, cy - 1, cz]] : [[cx, cy, cz + 1], [cx, cy, cz - 1], [cx, cy + 1, cz], [cx, cy - 1, cz]];
        for (const [nx, ny, nz] of nbs) {
          const key = `${alongX ? nx : nz},${ny}`;
          if (seen.has(key)) continue;
          const b = w.getBlock(nx, ny, nz);
          if (b === B.Obsidian) continue;
          if (b !== B.Air) { ok = false; break; }
          seen.add(key); q.push([nx, ny, nz]);
        }
      }
      if (!ok) continue;
      const us = cells.map((c) => (alongX ? c[0] : c[2])), vs = cells.map((c) => c[1]);
      const wdt = Math.max(...us) - Math.min(...us) + 1, hgt = Math.max(...vs) - Math.min(...vs) + 1;
      if (wdt < 2 || hgt < 3 || wdt > 21 || hgt > 21) continue;
      for (const [cx, cy, cz] of cells) w.setBlock(cx, cy, cz, alongX ? B.NetherPortalX : B.NetherPortalZ);
      this.meta.portals.push({ dim: this.dim, x: cells[0][0], y: Math.min(...vs), z: cells[0][2] });
      return true;
    }
    return false;
  }

  breakPortalsAround(x, y, z) {
    const w = this.world;
    const start = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(([dx, dy, dz]) => [x + dx, y + dy, z + dz]).filter(([a, b, c]) => isPortal(w.getBlock(a, b, c)));
    const q = [...start], seen = new Set();
    while (q.length) {
      const [a, b, c] = q.pop(), k = `${a},${b},${c}`;
      if (seen.has(k) || !isPortal(w.getBlock(a, b, c)) || seen.size > 600) continue;
      seen.add(k);
      w.setBlock(a, b, c, B.Air);
      q.push([a + 1, b, c], [a - 1, b, c], [a, b + 1, c], [a, b - 1, c], [a, b, c + 1], [a, b, c - 1]);
    }
  }

  spawnEmbers(pos, n, color = [1.6, 0.55, 0.12]) {
    const list = this.particles.break;
    for (let i = 0; i < n; i++) list.push({ p: [pos[0] + (Math.random() - 0.5) * 0.6, pos[1] + Math.random() * 0.5, pos[2] + (Math.random() - 0.5) * 0.6],
      v: [(Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 1.5], life: 0.4 + Math.random() * 0.5, size: 0.02 + Math.random() * 0.02,
      c: color, sky: 0, blk: 1 });
  }

  // ---------------------------------------------------------------- the Nether's and the End's sky, fog and air

  dimSky(dt) {
    const s = this.dimSkyState || (this.dimSkyState = {});
    const e = this.player.eye();
    let fog, amb, density, exposure = 1.9;
    if (this.dim === Dim.Nether) {
      const clim = this.world.climateAt(Math.floor(e[0]), Math.floor(e[2]));
      const b = clim ? clim.biome : Biome.NetherWastes;
      fog = { [Biome.CrimsonForest]: [0.13, 0.012, 0.008], [Biome.WarpedForest]: [0.018, 0.04, 0.05], [Biome.SoulSandValley]: [0.03, 0.06, 0.062],
        [Biome.BasaltDeltas]: [0.07, 0.062, 0.078] }[b] || [0.11, 0.02, 0.013];
      density = b === Biome.BasaltDeltas ? 0.022 : b === Biome.SoulSandValley ? 0.016 : 0.011;
      amb = fog.map((c) => c * 1.6 + 0.012);
    } else {
      fog = [0.016, 0.011, 0.026];
      amb = [0.05, 0.042, 0.075];
      density = 0.0035;
      exposure = 1.2;
    }
    // ease from biome to biome
    const k = s.fogColor ? 1 - Math.exp(-(dt || 0) * 1.5) : 1;
    const ease = (a, b) => (a ? a.map((v, i) => v + (b[i] - v) * k) : b.slice());
    s.fogColor = ease(s.fogColor, fog); s.dimAmb = ease(s.dimAmb, amb);
    s.fogDensity = s.fogDensity == null ? density : s.fogDensity + (density - s.fogDensity) * k;
    const end = this.dim === Dim.End;
    s.sun = [0, -1, 0]; s.moon = [0, -1, 0]; s.illum = 0; s.daylight = 0; s.sunWeight = 0; s.sunVisible = 0; s.starRot = this.time * 0.002;
    s.lightDir = end ? [0.38, 0.84, 0.39] : [0, 1, 0];
    s.lightColor = end ? [0.3, 0.27, 0.42] : [0, 0, 0];
    s.lightIsSun = false; s.exposure = exposure;
    s.ambUp = end ? [0.07, 0.055, 0.1] : s.fogColor.map((c) => c * 0.3); s.ambHorizon = end ? [0.05, 0.04, 0.075] : s.ambUp; s.ambDown = end ? [0.03, 0.025, 0.04] : s.ambUp;
    s.fogSun = [0, 0, 0]; s.sunColorClouds = [0, 0, 0]; s.zenith = s.fogColor;
    this.lutT = (this.lutT || 0) - (dt || 0);
    if (this.lutT <= 0 || this.lutDirty) { this.lutT = 0.25; this.lutDirty = false; s.skyDirty = true; }
    return s;
  }

  /** Floating spores, ash and embers around the camera. */
  updateMotes(dt) {
    const list = this.particles.motes || (this.particles.motes = []);
    const e = this.player.eye(), w = this.world;
    let color = [0.5, 0.4, 0.8], want = 60, a = 0.7, rise = 0.05;
    if (this.dim === Dim.Nether) {
      const clim = w.climateAt(Math.floor(e[0]), Math.floor(e[2]));
      const b = clim ? clim.biome : Biome.NetherWastes;
      if (b === Biome.CrimsonForest) { color = [0.9, 0.12, 0.08]; want = 320; }
      else if (b === Biome.WarpedForest) { color = [0.22, 0.75, 0.85]; want = 320; }
      else if (b === Biome.SoulSandValley) { color = [0.55, 0.62, 0.66]; want = 260; rise = -0.15; }
      else if (b === Biome.BasaltDeltas) { color = [0.7, 0.7, 0.72]; want = 600; rise = -0.35; }
      else { color = [1.6, 0.5, 0.1]; want = 70; a = 0.9; rise = 0.25; }
    }
    want = Math.floor(want * (this.settings.particles ?? 1));
    while (list.length < want) list.push({ p: [e[0] + (Math.random() - 0.5) * 36, e[1] + (Math.random() - 0.5) * 20, e[2] + (Math.random() - 0.5) * 36], life: 2 + Math.random() * 6, ph: Math.random() * 6.28, size: 0.012 + Math.random() * 0.025, c: color, a });
    if (list.length > want) list.length = want;
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      m.life -= dt; m.ph += dt;
      m.p[0] += Math.sin(m.ph * 0.7) * 0.25 * dt; m.p[1] += (rise + Math.sin(m.ph) * 0.1) * dt; m.p[2] += Math.cos(m.ph * 0.5) * 0.25 * dt;
      if (m.life <= 0 || Math.abs(m.p[0] - e[0]) > 20 || Math.abs(m.p[2] - e[2]) > 20) list.splice(i, 1);
      else m.c = color;
    }
  }

  // ---------------------------------------------------------------- item entities

  spawnItem(item, count, pos, vel, wear, delay = 0.5) {
    if (!ITEMS[item] || count <= 0) return;
    const body = new VoxelBody();
    body.half = 0.125; body.height = 0.25;
    body.pos = [...pos]; body.vel = [...vel];
    this.entities.push({ item, count, wear, body, age: 0, pickup: delay, rot: Math.random() * 6.28 });
  }

  updateEntities(dt) {
    const w = this.world, pl = this.player;
    const eye = pl.body.pos;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i], b = e.body;
      e.age += dt; e.pickup -= dt; e.rot += dt * 1.4;
      const here = w.getBlock(Math.floor(b.pos[0]), Math.floor(b.pos[1] + 0.1), Math.floor(b.pos[2]));
      if (isLava(here)) { this.spawnEmbers(b.pos, 8); this.entities.splice(i, 1); continue; }
      const inWater = isWater(here);
      if (inWater) { b.vel[1] += (1.5 - b.vel[1]) * Math.min(1, dt * 3); b.vel[0] *= 0.95; b.vel[2] *= 0.95; }
      else b.vel[1] = Math.max(b.vel[1] - 20 * dt, -30);
      const col = w.column(Math.floor(b.pos[0]) >> 5, Math.floor(b.pos[2]) >> 5);
      if (col && col.state === 'ready') {
        // pushed out when a block is placed into it
        if (w.isSolidAt(Math.floor(b.pos[0]), Math.floor(b.pos[1] + 0.1), Math.floor(b.pos[2]))) b.pos[1] = Math.floor(b.pos[1] + 0.1) + 1.01;
        b.move(w, [b.vel[0] * dt, b.vel[1] * dt, b.vel[2] * dt]);
        if (b.grounded) { const k = Math.exp(-dt * 8); b.vel[0] *= k; b.vel[2] *= k; }
      }
      // magnet + pickup
      const dx = eye[0] - b.pos[0], dy = eye[1] + 0.8 - b.pos[1], dz = eye[2] - b.pos[2];
      const d = Math.hypot(dx, dy, dz);
      // picked up inside the player's box grown by 1 block sideways and half a block up and down
      const touching = Math.abs(dx) < 1.3 && Math.abs(dz) < 1.3 && b.pos[1] > eye[1] - 0.75 && b.pos[1] < eye[1] + 2.3;
      if (e.pickup <= 0 && this.state !== 'dead') {
        if (touching || d < 1.4) {
          const left = this.inventory.add(e.item, e.count, { wear: e.wear });
          if (left < e.count) { this.audio.pop(); this.emit('pickup', e.item, e.count - left); }
          e.count = left;
          if (left <= 0) { this.entities.splice(i, 1); continue; }
        } else if (d < 3) {
          const k = dt * 7 / Math.max(d, 0.3);
          b.pos[0] += dx * k * 0.5; b.pos[1] += dy * k * 0.5; b.pos[2] += dz * k * 0.5;
        }
      }
      if (e.age > 300 || b.pos[1] < MIN_Y - 32) this.entities.splice(i, 1);
    }
    // merge stacks lying together
    if ((this.mergeTimer = (this.mergeTimer || 0) - dt) <= 0) {
      this.mergeTimer = 0.5;
      for (let i = 0; i < this.entities.length; i++) for (let j = this.entities.length - 1; j > i; j--) {
        const a = this.entities[i], c = this.entities[j];
        if (a.item !== c.item || ITEMS[a.item].stack <= 1 || a.count + c.count > ITEMS[a.item].stack) continue;
        const p = a.body.pos, q = c.body.pos;
        if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 1) { a.count += c.count; this.entities.splice(j, 1); }
      }
    }
  }

  // ---------------------------------------------------------------- particles

  layerColor(layer) { return (this.icons && this.icons.layerAvg[layer]) || [0.5, 0.5, 0.5]; }

  spawnBreakParticles(pos, block, n) {
    const d = BLOCKS[block];
    if (!d || d.top === 255) return;
    const list = this.particles.break;
    const L = this.lightAt(pos[0] + 0.5, pos[1] + 1, pos[2] + 0.5);
    for (let i = 0; i < n; i++) {
      const layer = layerFor(d, i % 3 === 0 ? 2 : 0);
      const c = this.layerColor(layer);
      const v = 0.7 + Math.random() * 0.5;
      list.push({ p: [pos[0] + 0.2 + Math.random() * 0.6, pos[1] + 0.2 + Math.random() * 0.6, pos[2] + 0.2 + Math.random() * 0.6],
        v: [(Math.random() - 0.5) * 3, Math.random() * 3 + 0.5, (Math.random() - 0.5) * 3], life: 0.6 + Math.random() * 0.6,
        size: 0.035 + Math.random() * 0.03, c: c.map((x) => x * v), sky: L.sky, blk: L.block });
    }
    if (list.length > 600) list.splice(0, list.length - 600);
  }

  /** Spray and droplets where the player hit the water. */
  spawnSplash(strength) {
    const p = this.player.body.pos, list = this.particles.break;
    const s = this.tod.state, amb = s.ambUp;
    const y = Math.floor(p[1]) + 1;
    for (let i = 0; i < 20 + strength * 40; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.6, up = 2 + Math.random() * 4 * (0.5 + strength);
      list.push({ p: [p[0] + Math.cos(a) * r, y, p[2] + Math.sin(a) * r], v: [Math.cos(a) * (1 + Math.random() * 2), up, Math.sin(a) * (1 + Math.random() * 2)],
        life: 0.5 + Math.random() * 0.6, size: 0.02 + Math.random() * 0.03, c: [0.75, 0.85, 0.9], sky: 1, blk: 0, water: true });
    }
  }

  /** Now and then a leaf lets go of a canopy near the player and drifts down. */
  spawnLeaves(dt) {
    const w = this.world, e = this.player.eye(), list = this.particles.leaves || (this.particles.leaves = []);
    this.leafTimer = (this.leafTimer || 0) - dt;
    if (this.leafTimer > 0 || list.length > 60) return;
    this.leafTimer = 0.06;
    for (let tries = 0; tries < 4; tries++) {
      const x = Math.floor(e[0] + (Math.random() - 0.5) * 28), z = Math.floor(e[2] + (Math.random() - 0.5) * 28);
      const y = Math.floor(e[1] + (Math.random() - 0.3) * 16);
      const b = w.getBlock(x, y, z);
      if (b < B.OakLeaves || b > B.JungleLeaves || w.getBlock(x, y - 1, z) !== B.Air) continue;
      const clim = w.climateAt(x, z);
      const base = this.layerColor(BLOCKS[b].side), t = clim ? clim.temp : 0.5;
      const tint = b === B.BirchLeaves ? [1.1, 1.08, 0.7] : b === B.SpruceLeaves ? [0.8, 0.9, 0.85] : [0.85 + t * 0.3, 1, 0.75];
      list.push({ p: [x + Math.random(), y - 0.05, z + Math.random()], v: [0, -0.6, 0], life: 9, size: 0.05 + Math.random() * 0.03,
        c: base.map((v, i) => v * tint[i] * 1.2), sky: 1, blk: 0, ph: Math.random() * 6.28, spin: 0.8 + Math.random() * 1.5 });
      break;
    }
  }

  updateParticles(dt) {
    const w = this.world;
    const br = this.particles.break;
    // drifting leaves: sway down on the wind, settle on the ground and fade
    if (dt > 0) this.spawnLeaves(dt);
    const lv = this.particles.leaves || [];
    const wind = this.windVec || [0, 0];
    for (let i = lv.length - 1; i >= 0; i--) {
      const p = lv[i];
      p.life -= dt;
      if (p.life <= 0) { lv.splice(i, 1); continue; }
      if (p.landed) continue;
      p.ph += dt * p.spin;
      const nx = p.p[0] + (Math.sin(p.ph) * 0.6 + wind[0] * 0.05) * dt, ny = p.p[1] - (0.55 + Math.cos(p.ph * 2) * 0.25) * dt, nz = p.p[2] + (Math.cos(p.ph * 0.7) * 0.5 + wind[1] * 0.05) * dt;
      if (w.isSolidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz)) || isWater(w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) { p.landed = true; p.life = Math.min(p.life, 3); continue; }
      p.p[0] = nx; p.p[1] = ny; p.p[2] = nz;
    }
    for (let i = br.length - 1; i >= 0; i--) {
      const p = br[i];
      p.life -= dt;
      if (p.life <= 0) { br.splice(i, 1); continue; }
      p.v[1] -= 16 * dt;
      const nx = p.p[0] + p.v[0] * dt, ny = p.p[1] + p.v[1] * dt, nz = p.p[2] + p.v[2] * dt;
      if (w.isSolidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) { p.v[0] *= 0.3; p.v[2] *= 0.3; p.v[1] = 0; }
      else { p.p[0] = nx; p.p[1] = ny; p.p[2] = nz; }
    }
    if (this.dim !== Dim.Overworld) { this.updateMotes(dt); this.particles.rain.length = 0; this.particles.snow.length = 0; return; }
    // precipitation around the camera, only where the sky is open
    const wp = this.weather.params, eye = this.player.eye();
    const clim = w.climateAt(Math.floor(eye[0]), Math.floor(eye[2]));
    const cold = (clim && clim.temp < 0.2) || eye[1] > 150;
    this.cold = cold;
    const want = Math.floor(wp.precip * (cold ? 900 : 1400) * (this.settings.particles ?? 1));
    const rain = this.particles.rain, snow = this.particles.snow;
    const arr = cold ? snow : rain, other = cold ? rain : snow;
    if (other.length) other.length = Math.max(0, other.length - 20);
    const spawn = (p) => {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 22;
      p.p = [eye[0] + Math.cos(a) * r + wind[0] * 3, eye[1] + 8 + Math.random() * 14, eye[2] + Math.sin(a) * r + wind[1] * 3];
      const h = w.heightmapAt(Math.floor(p.p[0]), Math.floor(p.p[2]));
      p.floor = h == null ? eye[1] - 30 : h + 1;
      p.ph = Math.random() * 6.28;
      return p;
    };
    while (arr.length < want) { const p = spawn({}); p.p[1] = eye[1] - 6 + Math.random() * 28; arr.push(p); }
    if (arr.length > want) arr.length = want;
    const fall = cold ? 1.6 : 13;
    for (const p of arr) {
      p.p[1] -= fall * dt;
      p.p[0] += wind[0] * dt * (cold ? 1.5 : 3) + (cold ? Math.sin(this.time * 1.3 + p.ph) * 0.4 * dt : 0);
      p.p[2] += wind[1] * dt * (cold ? 1.5 : 3);
      if (p.p[1] < p.floor || p.p[1] < eye[1] - 12 || Math.abs(p.p[0] - eye[0]) > 26 || Math.abs(p.p[2] - eye[2]) > 26) spawn(p);
    }
  }

  packParticles(f) {
    const s = this.skyNow || this.tod.state;
    const amb = s.ambUp.map((a, i) => a * 0.7 + s.lightColor[i] * 0.35);
    const groups = [];
    const pack = (list, color, size, stretch, round) => {
      const n = list.length;
      if (!n) return;
      const data = (this.packBufs = this.packBufs || {})[round ? 'r' : stretch ? 's' : 'b'];
      let buf = data && data.length >= n * 8 ? data : new Float32Array(Math.max(n * 8, 1024));
      this.packBufs[round ? 'r' : stretch ? 's' : 'b'] = buf;
      for (let i = 0; i < n; i++) {
        const p = list[i], o = i * 8;
        buf[o] = p.p[0]; buf[o + 1] = p.p[1]; buf[o + 2] = p.p[2]; buf[o + 3] = p.size || size;
        const c = color(p);
        buf[o + 4] = c[0]; buf[o + 5] = c[1]; buf[o + 6] = c[2]; buf[o + 7] = c[3];
      }
      groups.push({ data: buf, count: n, stretch, round });
    };
    const lv = this.particles.leaves || [];
    if (lv.length) {
      const all = this.particles.break.concat(lv);
      this.particles.breakAll = all;
    } else this.particles.breakAll = this.particles.break;
    pack(this.particles.breakAll, (p) => {
      const k = p.sky * p.sky, b = p.blk * p.blk, a = p.water ? 0.7 : p.landed ? Math.min(1, p.life / 2) : 1;
      return [p.c[0] * (amb[0] * k + 2.4 * b + 0.01), p.c[1] * (amb[1] * k + 1.5 * b + 0.01), p.c[2] * (amb[2] * k + 0.7 * b + 0.01), a];
    }, 0.05, null, false);
    const wind = this.windVec || [0, 0];
    pack(this.particles.rain, () => [amb[0] * 0.55, amb[1] * 0.6, amb[2] * 0.7, 0.32], 0.012, [-wind[0] * 0.03 * 3, 0.42, -wind[1] * 0.03 * 3], false);
    pack(this.particles.snow, () => [amb[0] * 0.95, amb[1] * 0.95, amb[2], 0.9], 0.045, null, true);
    if (this.particles.motes && this.particles.motes.length) pack(this.particles.motes, (p) => [p.c[0], p.c[1], p.c[2], Math.min(1, p.life) * p.a], 0.03, null, true);
    return groups;
  }

  // ---------------------------------------------------------------- environment

  updateEnvironment(dt) {
    const pl = this.player, w = this.world;
    this.tod.advance(dt);
    const wp = this.weather.params;
    const sunUp = Math.max(0, this.tod.state.sun ? this.tod.state.sun[1] : 0);
    if (dt > 0 && this.dim === Dim.Overworld && this.weather.step(dt, !!this.cold, Math.min(1, sunUp * 3))) {
      this.flash = 1;
      const near = Math.random() < 0.3;
      this.audio.thunder(near, near ? 0.15 : 0.6 + Math.random() * 2.5);
    }
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
    const a = this.weather.windAngle;
    const ws = wp.wind;
    this.windVec = [Math.cos(a) * ws * 20, Math.sin(a) * ws * 20];
    this.tod.update(this.time, { cloudCover: wp.cloud, sunDim: wp.light });
    this.skyNow = this.dim === Dim.Overworld ? this.tod.state : this.dimSky(dt);
    this.updateParticles(dt);

    // light at the camera (exposure / fog darkening underground) - smoothed
    const e = pl.eye();
    if (this.time - this.lightProbe.at > 0.25) {
      this.lightProbe = { ...this.lightAt(e[0], e[1], e[2]), at: this.time };
    }
    const target = this.dim === Dim.Overworld ? this.lightProbe.sky : 1;
    this.camSky += (target - this.camSky) * (1 - Math.exp(-dt * 2));
    if (dt === 0) this.camSky = this.camSky || target;

    // ambience
    const s = this.tod.state, under = pl.headInWater;
    const open = this.camSky;
    const day = s.daylight;
    const rainy = this.cold ? 0 : wp.precip;
    // water nearby (recorded stream / waterfall beds): open water surfaces and flowing water around the player
    this.waterScanT = (this.waterScanT || 0) - dt;
    if (this.waterScanT <= 0 && this.world) {
      this.waterScanT = 0.5;
      const [px, py, pz] = Array.from(pl.body.pos, Math.floor);
      let still = 0, flow = 0;
      let lava = 0;
      for (let dz = -8; dz <= 8; dz += 2) for (let dx = -8; dx <= 8; dx += 2) for (let dy = -4; dy <= 3; dy++) {
        const id = this.world.getBlock(px + dx, py + dy, pz + dz);
        if (isLava(id)) { lava++; continue; }
        if (!isWater(id)) continue;
        if (id !== B.Water) flow++;
        else if (!isWater(this.world.getBlock(px + dx, py + dy + 1, pz + dz))) still++;
      }
      this.nearWater = { still: Math.min(1, still / 18), flow: Math.min(1, flow / 5), lava: Math.min(1, lava / 14) };
    }
    const nw = this.nearWater || { still: 0, flow: 0, lava: 0 };
    if (this.dim !== Dim.Overworld) {
      this.audio.setAmbience(under ? { underwater: 1 } : this.dim === Dim.Nether
        ? { nether: 0.85, lava: 0.15 + nw.lava * 0.8, water: 0, waterfall: 0 }
        : { end: 0.8, water: 0, waterfall: 0 }, Math.max(dt, 0.016));
      return;
    }
    this.audio.setAmbience(under ? { underwater: 1 } : {
      water: nw.still * 0.55,
      waterfall: nw.flow * 0.7,
      wind: (0.18 + wp.wind * 3) * open * (1 - rainy * 0.3),
      rain: rainy * open * 0.9,
      birds: day * (1 - wp.precip) * open * (this.cold ? 0.2 : 0.55),
      crickets: (1 - day) * (1 - wp.precip) * open * (this.cold ? 0 : 0.35),
      cave: (1 - open) * 0.9,
    }, Math.max(dt, 0.016));
  }

  draw(dt) {
    const pl = this.player, w = this.world;
    const eye = pl.eye();
    const clim = w.climateAt(Math.floor(eye[0]), Math.floor(eye[2]));
    const wp = this.weather.params;
    const inv = this.inventory;
    const entities = [], sprites = [];
    for (const m of this.mobs.list) m.light = this.lightAt(m.body.pos[0], m.body.pos[1] + m.def.height * 0.6, m.body.pos[2]);
    for (const e of this.entities) {
      const L = this.lightAt(e.body.pos[0], e.body.pos[1] + 0.3, e.body.pos[2]);
      const def = ITEMS[e.item];
      const bob = Math.sin(e.age * 2.5) * 0.05 + 0.18;
      const pos = [e.body.pos[0], e.body.pos[1] + bob, e.body.pos[2]];
      const isCube = def.kind === Kind.Block && (BLOCKS[def.block].shape === Shape.Cube || BLOCKS[def.block].shape === Shape.Cutout);
      if (isCube) entities.push({ block: def.block, pos, rot: e.rot, scale: 0.25, sky: L.sky, blockLight: L.block });
      else sprites.push({ pos: [pos[0], pos[1] + 0.05, pos[2]], size: 0.2, rect: this.icons.rect(e.item), sky: L.sky, block: L.block });
    }

    let hand = null;
    if (this.state === 'playing' || this.state === 'inventory') {
      const held = inv.held, def = held ? ITEMS[held.item] : null;
      const moving = Math.hypot(pl.body.vel[0], pl.body.vel[2]);
      this.bobPhase = (this.bobPhase || 0) + dt * moving * 1.6 * (pl.body.grounded || pl.body.probeGround(w) ? 1 : 0);
      const bobK = this.settings && this.settings.viewBob === false ? 0 : 1;
      const bob = [Math.sin(this.bobPhase) * 0.012 * bobK * Math.min(1, moving / 4), -Math.abs(Math.cos(this.bobPhase)) * 0.014 * bobK * Math.min(1, moving / 4)];
      const L = this.lightProbe;
      this.handSwap = Math.max(0, (this.handSwap || 0) - dt * 5);
      if (held && def) {
        const isCube = def.kind === Kind.Block && (BLOCKS[def.block].shape === Shape.Cube || BLOCKS[def.block].shape === Shape.Cutout);
        hand = { block: isCube ? def.block : null, rect: isCube ? null : this.icons.rect(held.item), swing: this.swing || 0, bob, lower: this.handSwap,
          sky: L.sky, blockLight: L.block };
      }
    }
    const other = this.dim !== Dim.Overworld, sky = this.skyNow || this.tod.state;
    const inLava = this.headInLava;
    const f = {
      dt, time: this.time, camPos: eye, yaw: pl.yaw, pitch: pl.pitch, sky,
      dim: this.dim, dimAmb: sky.dimAmb, dimFog: inLava ? 1.2 : other ? sky.fogDensity : null, portal: Math.min(1, (this.portalTime || 0) / 3),
      weather: other ? { cloudCover: 0, windX: 0.2, windZ: 0.1, windStrength: 0.3, gust: 0.2, fog: 0, storm: 0, wetness: 0, snowCover: 0 } : { cloudCover: wp.cloud, windX: this.windVec[0] / 20 || 0, windZ: this.windVec[1] / 20 || 0, windStrength: 0.35 + wp.wind * 5, gust: wp.gust,
        fog: (wp.fog - 1) * 0.02 + (1 - wp.fogDist) * 0.3, storm: Math.max(0, (wp.precip - 0.5) * 2), wetness: this.weather.wetness,
        snowCover: this.weather.snowCover * (clim && clim.temp < 0.25 ? 1 : 0) },
      viewDistance: this.world.viewDistance, camSky: this.camSky, underwater: pl.headInWater || inLava, underwaterColor: inLava ? [0.9, 0.25, 0.02] : null,
      selection: this.target && this.state === 'playing' ? this.target.hit : null,
      selectionBoxes: this.target && this.state === 'playing' ? this.selectionBoxes(this.target) : null,
      crack: this.mining && this.mining.progress > 0 ? { pos: this.mining.pos, progress: Math.min(1, this.mining.progress) } : null,
      entities, mobs: this.mobs.list,
      sprites, particles: this.packParticles(), hand, damage: this.damageFlash * 0.6, flash: this.flash, props: this.world.props,
    };
    this.renderer.render(f);
  }

  /** Debug/test helper: places in the Nether and End (biomes, fortresses) and the overworld's strongholds. */
  findPlace(kind, name) {
    const p = this.player.body.pos, seed = this.meta.seed;
    if (kind === 'stronghold') { const l = strongholds(seed); return l.reduce((a, b) => (Math.hypot(a.x - p[0], a.z - p[2]) < Math.hypot(b.x - p[0], b.z - p[2]) ? a : b)); }
    if (kind === 'fortress') return nearestFortress(p[0], p[2], seed);
    if (kind === 'netherBiome') {
      const n = new Simplex((seed ^ 0x4E7E4) >>> 0), want = Biome[name], c = {};
      for (let r = 0; r <= 3000; r += 16) for (let i = 0, k = Math.max(1, Math.floor(r / 8)); i < k; i++) {
        const a = (i / k) * Math.PI * 2, x = Math.floor(p[0] + Math.cos(a) * r), z = Math.floor(p[2] + Math.sin(a) * r);
        if (netherClimate(n, x, z, c).biome === want && netherClimate(n, x + 24, z + 24, c).biome === want && netherClimate(n, x - 24, z - 24, c).biome === want) return [x + 0.5, 70, z + 0.5];
      }
    }
    return null;
  }

  /** Debug/test helper: the nearest column of a biome (by name) on a spiral from the player. */
  findBiome(name, maxRadius = 4000) {
    const T = terrainFor(this.meta.seed), want = Biome[name], tmp = {};
    const p = this.player.body.pos;
    for (let r = 0; r <= maxRadius; r += 24) for (let i = 0, n = Math.max(1, Math.floor(r / 8)); i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.floor(p[0] + Math.cos(a) * r), z = Math.floor(p[2] + Math.sin(a) * r);
      const s = T.sample(x + 0.5, z + 0.5, tmp);
      if (s.biome === want) return [x + 0.5, Math.floor(s.height) + 1, z + 0.5];
    }
    return null;
  }

  debugInfo() {
    const pl = this.player, w = this.world, p = pl.body.pos;
    const clim = w.climateAt(Math.floor(p[0]), Math.floor(p[2]));
    const r = this.renderer;
    return {
      pos: p.map((v) => v.toFixed(1)).join(' '), dim: ['overworld', 'nether', 'end'][this.dim], biome: clim ? BIOME_NAMES[clim.biome] : '-',
      fps: this.fps.toFixed(0), ms: this.frameMs.toFixed(1), sections: r.sections.size, drawn: r.stats.drawn, tris: Math.round(r.stats.tris / 1000) + 'k',
      props: `${r.stats.props || 0}/${w.props.loaded}`, columns: w.columns.size, gpuMB: (r.gpuBytes / 1048576).toFixed(0), time: `day ${this.tod.day + 1} ${Math.floor(this.tod.hour).toString().padStart(2, '0')}:${Math.floor((this.tod.hour % 1) * 60).toString().padStart(2, '0')}`,
      weather: WEATHER_NAMES[this.weather.current], entities: this.entities.length, workers: w.workers.length, errors: w.errors.length,
    };
  }
}

export { itemName, canHarvest };
