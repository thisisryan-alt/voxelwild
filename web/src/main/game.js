// The game session: world streaming, player, block interaction (mining with tool tiers, placing with support rules),
// item entities, particles, survival, day/night, weather, audio and autosave. The DOM side lives in ui.js.
import { World } from './world.js';
import { Renderer } from './renderer.js';
import { TimeOfDay } from './sky.js';
import { Player, raycast, targetable } from './player.js';
import { Inventory, SurvivalStats, Weather, CREATIVE_HOTBAR, HOTBAR, WEATHER_NAMES } from './gameplay.js';
import { GameAudio } from './audio.js';
import { Icons } from './icons.js';
import { SaveStore } from './save.js';
import { BLOCKS, B, F, ITEMS, Kind, Shape, isWater, breakSeconds, drops, canHarvest, itemName, layerFor } from '../shared/blocks.js';
import { terrainFor } from '../shared/gen.js';
import { Biome, BIOME_NAMES } from '../shared/terrain.js';
import { VoxelBody } from './player.js';
import { MIN_Y, MAX_Y, SEA } from '../shared/const.js';

const REACH = 6;
const EMITTERS = BLOCKS.map((d) => d.emission || 0);

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

  async init(progress) {
    this.renderer = new Renderer(this.canvas);
    await this.store.open();
    progress && progress('Loading textures', 0.1);
    const load = async (name) => {
      const res = await fetch(this.assetBase + name);
      if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
      return createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    };
    const [albedo, normal, mask] = await Promise.all([load('albedo.webp'), load('normal.webp'), load('mask.webp')]);
    progress && progress('Preparing materials', 0.6);
    this.renderer.uploadLayers('albedo', albedo);
    this.renderer.uploadLayers('normal', normal);
    this.renderer.uploadLayers('mask', mask);
    this.icons = new Icons(albedo);
    this.renderer.uploadAtlas(this.icons.canvas);
    progress && progress('Ready', 1);
  }

  applySettings(s) {
    this.settings = s;
    const r = this.renderer.settings;
    r.renderScale = s.renderScale; r.shadows = s.shadows; r.bloom = s.bloom; r.godRays = s.godRays; r.fov = s.fov;
    if (this.world) this.world.viewDistance = s.viewDistance;
    this.audio.volumes = { master: s.volume, sfx: s.sfx, ambience: s.ambience };
    this.audio.applyVolumes();
  }

  // ---------------------------------------------------------------- session

  async startWorld(meta, isNew) {
    this.stopWorld();
    this.meta = meta;
    const modified = isNew ? new Map() : await this.store.loadSections(meta.id);
    this.world = new World({
      seed: meta.seed, workerUrl: this.workerUrl, viewDistance: this.settings.viewDistance, modified,
      onMesh: (s, m) => this.renderer.uploadSection(s, m),
      onUnloadSection: (s) => this.renderer.freeSection(s),
    });
    this.player = new Player();
    this.inventory = new Inventory();
    this.stats = new SurvivalStats();
    this.tod = new TimeOfDay();
    this.weather = new Weather(meta.seed);
    this.entities = [];
    this.particles = { break: [], rain: [], snow: [] };
    this.mining = null;
    this.creative = meta.mode === 'creative';
    this.player.canFly = this.creative;
    this.player.onLand = (h, water) => {
      if (water) { if (h > 1.5) this.audio.splash(); return; }
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
    this.nextAutosave = this.time + 60;
    this.emit('state', this.state);
    this.emit('inventory');
  }

  stopWorld() {
    if (this.world) {
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
      player: { pos: [...p.body.pos], yaw: p.yaw, pitch: p.pitch, spawn: this.spawn, flying: p.flying },
      inventory: this.inventory.toJSON(), stats: this.stats.toJSON(),
      time: { hour: this.tod.hour, day: this.tod.day }, weather: this.weather.toJSON(),
    };
  }

  async save() {
    if (!this.world || this.state === 'loading') return;
    try {
      const meta = this.metaSnapshot();
      await this.store.saveWorld(meta, this.world.editedSections());
      this.meta = meta;
      this.emit('saved');
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
    const w = this.world;
    const h = w.heightmapAt(Math.floor(x), Math.floor(z));
    let sky = 1;
    if (h != null && y < h + 1) sky = Math.max(0, 1 - (h + 1 - y) / 10) ** 2;
    return { sky, block: this.blockLightNear(x, y, z) };
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
    w.update(this.state === 'playing' || this.state === 'loading' || this.state === 'inventory' ? dt : 0);

    if (this.state === 'loading') {
      const prog = this.loadingProgress();
      this.emit('loading', prog);
      const c = w.column(Math.floor(pl.body.pos[0]) >> 5, Math.floor(pl.body.pos[2]) >> 5);
      if (prog >= 1 && c && c.state === 'ready') {
        if (this.needGround) { this.settleOnGround(); this.needGround = false; }
        this.state = 'playing';
        this.emit('state', this.state);
        this.emit('hud');
      }
    }
    const active = this.state === 'playing' || this.state === 'inventory';
    if (active) this.update(dt);
    this.updateEnvironment(active ? dt : 0);
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
    const hit = raycast(w, eye, dir, REACH, targetable);
    this.target = hit;
    this.swing = Math.max(0, (this.swing || 0) - dt * 3.2);

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
      if (def && def.kind === Kind.Food) {
        if (!this.creative && this.stats.hunger < 20) { this.stats.eat(def.food, def.sat); inv.consumeHeld(); this.audio.eat(); this.swing = 1; this.emit('hud'); }
      } else if (hit && def && def.kind === Kind.Block) this.place(hit, def.block);
    }
  }

  breakBlock(pos, block, survival) {
    const w = this.world;
    const [x, y, z] = pos;
    const inv = this.inventory, held = inv.held ? inv.held.item : 0;
    if (!w.setBlock(x, y, z, B.Air)) return;
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

  place(hit, block) {
    const w = this.world, d = BLOCKS[block];
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
    if ((d.flags & F.Solid) && this.player.body.overlaps(x, y, z)) return;
    if (!w.setBlock(x, y, z, block)) return;
    this.audio.place(block);
    this.swing = 1;
    if (!this.creative) this.inventory.consumeHeld();
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
      const inWater = isWater(w.getBlock(Math.floor(b.pos[0]), Math.floor(b.pos[1] + 0.1), Math.floor(b.pos[2])));
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
      if (e.pickup <= 0 && this.state !== 'dead') {
        if (d < 1.4) {
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

  updateParticles(dt) {
    const w = this.world;
    const br = this.particles.break;
    for (let i = br.length - 1; i >= 0; i--) {
      const p = br[i];
      p.life -= dt;
      if (p.life <= 0) { br.splice(i, 1); continue; }
      p.v[1] -= 16 * dt;
      const nx = p.p[0] + p.v[0] * dt, ny = p.p[1] + p.v[1] * dt, nz = p.p[2] + p.v[2] * dt;
      if (w.isSolidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) { p.v[0] *= 0.3; p.v[2] *= 0.3; p.v[1] = 0; }
      else { p.p[0] = nx; p.p[1] = ny; p.p[2] = nz; }
    }
    // precipitation around the camera, only where the sky is open
    const wp = this.weather.params, eye = this.player.eye();
    const clim = w.climateAt(Math.floor(eye[0]), Math.floor(eye[2]));
    const cold = (clim && clim.temp < 0.2) || eye[1] > 150;
    this.cold = cold;
    const want = Math.floor(wp.precip * (cold ? 900 : 1400) * (this.settings.particles ?? 1));
    const rain = this.particles.rain, snow = this.particles.snow;
    const arr = cold ? snow : rain, other = cold ? rain : snow;
    if (other.length) other.length = Math.max(0, other.length - 20);
    const wind = this.windVec || [0, 0];
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
    const s = this.tod.state;
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
    pack(this.particles.break, (p) => {
      const k = p.sky * p.sky, b = p.blk * p.blk;
      return [p.c[0] * (amb[0] * k + 2.4 * b + 0.01), p.c[1] * (amb[1] * k + 1.5 * b + 0.01), p.c[2] * (amb[2] * k + 0.7 * b + 0.01), 1];
    }, 0.05, null, false);
    const wind = this.windVec || [0, 0];
    pack(this.particles.rain, () => [amb[0] * 0.55, amb[1] * 0.6, amb[2] * 0.7, 0.32], 0.012, [-wind[0] * 0.03 * 3, 0.42, -wind[1] * 0.03 * 3], false);
    pack(this.particles.snow, () => [amb[0] * 0.95, amb[1] * 0.95, amb[2], 0.9], 0.045, null, true);
    return groups;
  }

  // ---------------------------------------------------------------- environment

  updateEnvironment(dt) {
    const pl = this.player, w = this.world;
    this.tod.advance(dt);
    const wp = this.weather.params;
    const sunUp = Math.max(0, this.tod.state.sun ? this.tod.state.sun[1] : 0);
    if (dt > 0 && this.weather.step(dt, !!this.cold, Math.min(1, sunUp * 3))) {
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
    this.updateParticles(dt);

    // light at the camera (exposure / fog darkening underground) - smoothed
    const e = pl.eye();
    if (this.time - this.lightProbe.at > 0.25) {
      this.lightProbe = { ...this.lightAt(e[0], e[1], e[2]), at: this.time };
    }
    const target = this.lightProbe.sky;
    this.camSky += (target - this.camSky) * (1 - Math.exp(-dt * 2));
    if (dt === 0) this.camSky = this.camSky || target;

    // ambience
    const s = this.tod.state, under = pl.headInWater;
    const open = this.camSky;
    const day = s.daylight;
    const rainy = this.cold ? 0 : wp.precip;
    this.audio.setAmbience(under ? { underwater: 1 } : {
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
      const bob = [Math.sin(this.bobPhase) * 0.012 * Math.min(1, moving / 4), -Math.abs(Math.cos(this.bobPhase)) * 0.014 * Math.min(1, moving / 4)];
      const L = this.lightProbe;
      this.handSwap = Math.max(0, (this.handSwap || 0) - dt * 5);
      if (held && def) {
        const isCube = def.kind === Kind.Block && (BLOCKS[def.block].shape === Shape.Cube || BLOCKS[def.block].shape === Shape.Cutout);
        hand = { block: isCube ? def.block : null, rect: isCube ? null : this.icons.rect(held.item), swing: this.swing || 0, bob, lower: this.handSwap,
          sky: L.sky, blockLight: L.block };
      }
    }
    const f = {
      dt, time: this.time, camPos: eye, yaw: pl.yaw, pitch: pl.pitch, sky: this.tod.state,
      weather: { cloudCover: wp.cloud, windX: this.windVec[0] / 20 || 0, windZ: this.windVec[1] / 20 || 0, windStrength: 0.35 + wp.wind * 5, gust: wp.gust,
        fog: (wp.fog - 1) * 0.02 + (1 - wp.fogDist) * 0.3, storm: Math.max(0, (wp.precip - 0.5) * 2), wetness: this.weather.wetness,
        snowCover: this.weather.snowCover * (clim && clim.temp < 0.25 ? 1 : 0) },
      viewDistance: this.world.viewDistance, camSky: this.camSky, underwater: pl.headInWater,
      selection: this.target && (this.state === 'playing') ? this.target.hit : null,
      crack: this.mining && this.mining.progress > 0 ? { pos: this.mining.pos, progress: Math.min(1, this.mining.progress) } : null,
      entities,
      sprites, particles: this.packParticles(), hand, damage: this.damageFlash * 0.6, flash: this.flash,
    };
    this.renderer.render(f);
  }

  debugInfo() {
    const pl = this.player, w = this.world, p = pl.body.pos;
    const clim = w.climateAt(Math.floor(p[0]), Math.floor(p[2]));
    const r = this.renderer;
    return {
      pos: p.map((v) => v.toFixed(1)).join(' '), biome: clim ? BIOME_NAMES[clim.biome] : '-',
      fps: this.fps.toFixed(0), ms: this.frameMs.toFixed(1), sections: r.sections.size, drawn: r.stats.drawn, tris: Math.round(r.stats.tris / 1000) + 'k',
      columns: w.columns.size, gpuMB: (r.gpuBytes / 1048576).toFixed(0), time: `day ${this.tod.day + 1} ${Math.floor(this.tod.hour).toString().padStart(2, '0')}:${Math.floor((this.tod.hour % 1) * 60).toString().padStart(2, '0')}`,
      weather: WEATHER_NAMES[this.weather.current], entities: this.entities.length, workers: w.workers.length, errors: w.errors.length,
    };
  }
}

export { itemName, canHarvest };
