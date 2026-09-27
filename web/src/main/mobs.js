// Mobs: Minecraft's animals and monsters with Mojang's Bedrock models (tools/geo) and LB Photo Realism Reload!'s
// skins (tools/build_mobs.py). Spawning follows Minecraft's rules in spirit: animals on grass in daylight, monsters in
// the dark (at night and in caves), zombified piglins, blazes (on nether bricks) and ghasts in the Nether. Behaviour:
// wandering, fleeing when hurt, chasing and melee, skeletons' arrows, creepers' fuse and explosion, blazes' and ghasts'
// fireballs, skeletons burning in daylight. Drops on death.
import { VoxelBody } from './player.js';
import { B, BLOCKS, F, I, C, ITEMS, Dim, isWater, isLava, isLiquid, mining } from '../shared/blocks.js';
import { Biome } from '../shared/terrain.js';
import { structuresIn } from '../shared/structures.js';
import { skyTemples } from '../shared/skylands.js';
import { terrainFor } from '../shared/gen.js';

const GRASSY = new Set([Biome.Plains, Biome.Forest, Biome.DenseForest, Biome.Savanna, Biome.Taiga, Biome.SnowyTaiga, Biome.Jungle, Biome.Swamp, Biome.Mountains, Biome.SnowyTundra]);

// size in blocks, health in half hearts (Minecraft's), speed in blocks/second
export const MOB_TYPES = {
  cow: { name: 'Cow', health: 10, speed: 1.1, half: 0.45, height: 1.4, kind: 'passive', drops: [[I.Beef, 1, 3], [I.Leather, 0, 2]] },
  pig: { name: 'Pig', health: 10, speed: 1.2, half: 0.45, height: 0.9, kind: 'passive', drops: [[I.Porkchop, 1, 3]] },
  sheep: { name: 'Sheep', health: 8, speed: 1.1, half: 0.45, height: 1.3, kind: 'passive', drops: [[I.Mutton, 1, 2], ['white_wool', 1, 1]] },
  chicken: { name: 'Chicken', health: 4, speed: 1.0, half: 0.2, height: 0.7, kind: 'passive', drops: [[I.RawChicken, 1, 1], [I.Feather, 0, 2]], flutter: true },
  wolf: { name: 'Wolf', health: 8, speed: 2.4, half: 0.3, height: 0.85, kind: 'neutral', damage: 4, drops: [] },
  husk: { name: 'Husk', health: 20, speed: 2.3, half: 0.3, height: 1.95, kind: 'hostile', damage: 3, drops: [[I.RottenFlesh, 0, 2]] },
  skeleton: { name: 'Skeleton', health: 20, speed: 2.3, half: 0.3, height: 1.99, kind: 'hostile', ranged: 'arrow', drops: [[I.Bone, 0, 2], [I.Arrow, 0, 2]], burns: true },
  creeper: { name: 'Creeper', health: 20, speed: 2.0, half: 0.3, height: 1.7, kind: 'hostile', explode: 3, drops: [[I.Gunpowder, 0, 2]] },
  spider: { name: 'Spider', health: 16, speed: 2.9, half: 0.7, height: 0.9, kind: 'hostile', damage: 2, drops: [[I.String, 0, 2]], dayNeutral: true },
  zombified_piglin: { name: 'Zombified Piglin', health: 20, speed: 2.3, half: 0.3, height: 1.95, kind: 'neutral', damage: 5, group: true, drops: [[I.RottenFlesh, 0, 1], [I.GoldNugget, 0, 1]] },
  blaze: { name: 'Blaze', health: 20, speed: 2.3, half: 0.3, height: 1.8, kind: 'hostile', flying: true, ranged: 'fireball', drops: [[I.BlazeRod, 0, 1]], glow: 1 },
  stray: { name: 'Stray', health: 20, speed: 2.3, half: 0.3, height: 1.99, kind: 'hostile', ranged: 'arrow', drops: [[I.Bone, 0, 2], [I.Arrow, 0, 2]], burns: true, base: 'skeleton' },
  wither_skeleton: { name: 'Wither Skeleton', health: 20, speed: 2.4, half: 0.35, height: 2.4, kind: 'hostile', damage: 8, drops: [[I.Coal, 0, 1], [I.Bone, 0, 2]], base: 'skeleton', melee: true },
  cave_spider: { name: 'Cave Spider', health: 12, speed: 3.1, half: 0.35, height: 0.5, kind: 'hostile', damage: 2, drops: [[I.String, 0, 2]], base: 'spider' },
  ghast: { name: 'Ghast', health: 10, speed: 1.6, half: 1, height: 2.2, kind: 'hostile', flying: true, ranged: 'ghastball', drops: [[I.GhastTear, 0, 1], [I.Gunpowder, 0, 2]], range: 32 },
  pillager: { name: 'Pillager', health: 24, speed: 2.3, half: 0.3, height: 1.95, kind: 'hostile', ranged: 'arrow', drops: [[I.Arrow, 0, 2]], armsForward: true },
  vindicator: { name: 'Vindicator', health: 24, speed: 2.6, half: 0.3, height: 1.95, kind: 'hostile', damage: 8, drops: [[I.Emerald, 0, 1]], armsForward: true },
  slime_big: { name: 'Slime', health: 16, speed: 1.9, half: 1.0, height: 2.0, kind: 'hostile', damage: 4, hop: 1, splits: 'slime_medium', drops: [] },
  slime_medium: { name: 'Slime', health: 4, speed: 1.9, half: 0.5, height: 1.0, kind: 'hostile', damage: 2, hop: 1, splits: 'slime_small', drops: [] },
  slime_small: { name: 'Slime', health: 1, speed: 1.9, half: 0.26, height: 0.52, kind: 'hostile', damage: 0, hop: 1, drops: [[I.SlimeBall, 0, 2]] },
  // a boss (Terraria's King Slime, not in Minecraft): summoned with a Slime Crown
  king_slime: { name: 'King Slime', health: 300, speed: 2.4, half: 2.0, height: 4.0, kind: 'hostile', damage: 8, hop: 2, boss: true,
    drops: [[I.GoldIngot, 5, 10], [I.SlimeBall, 10, 20], [I.Diamond, 1, 3], [I.Emerald, 2, 6]] },
  inferno_spirit: { name: 'Inferno Spirit', health: 400, speed: 2.6, half: 0.9, height: 5.4, kind: 'hostile', flying: true, ranged: 'fireball', boss: true, bossAI: 'inferno', range: 40, glow: 1,
    drops: [[I.FlameBlade, 1, 1], [I.BlazeRod, 3, 8], [I.GoldIngot, 4, 8]] },
  hollow_king: { name: 'Hollow King', health: 450, speed: 3.0, half: 0.8, height: 5.2, kind: 'hostile', damage: 14, boss: true, bossAI: 'hollow', base: 'skeleton', armsForward: true,
    drops: [[I.BoneGreatsword, 1, 1], [I.Bone, 6, 12], [I.Emerald, 3, 8], [I.Diamond, 1, 3]] },
  storm_ghast: { name: 'Storm Ghast', health: 500, speed: 1.8, half: 2.5, height: 5.5, kind: 'hostile', flying: true, ranged: 'ghastball', boss: true, bossAI: 'storm', range: 48, hover: 10,
    drops: [[I.CloudBottle, 1, 1], [I.GhastTear, 2, 5], [I.Diamond, 2, 4]] },
  frost_colossus: { name: 'Frost Colossus', health: 420, speed: 2.4, half: 2.0, height: 4.2, kind: 'hostile', damage: 12, boss: true, bossAI: 'frost',
    drops: [[I.Frostbrand, 1, 1], [I.Diamond, 2, 4], [I.Leather, 4, 8]] },
  sky_whale: { name: 'Sky Whale', health: 40, speed: 1.2, half: 1.7, height: 3.5, kind: 'passive', flying: true, hover: 14, drops: [[I.Leather, 2, 5]] },
  moa: { name: 'Moa', health: 16, speed: 2.8, half: 0.45, height: 1.8, kind: 'passive', flutter: true, drops: [[I.Feather, 2, 5], [I.RawChicken, 1, 2]] },
  polar_bear: { name: 'Polar Bear', health: 30, speed: 1.7, half: 0.7, height: 1.4, kind: 'neutral', damage: 6, drops: [] },
  strider: { name: 'Strider', health: 20, speed: 1.2, half: 0.45, height: 1.7, kind: 'passive', lavaWalk: true, drops: [[I.String, 0, 3]] },
  piglin_brute: { name: 'Piglin Brute', health: 50, speed: 2.4, half: 0.3, height: 1.95, kind: 'hostile', damage: 9, drops: [[I.GoldIngot, 0, 1]], armsForward: true },
};

// villagers: one type per profession (the skin's overlay), all trading
export const PROFESSIONS = ['farmer', 'toolsmith', 'butcher', 'shepherd', 'weaponsmith', 'fletcher'];
for (const p of PROFESSIONS) MOB_TYPES[`villager_${p}`] = { name: 'Villager', health: 20, speed: 1.1, half: 0.3, height: 1.95, kind: 'passive', drops: [], villager: p };

export class Mob {
  constructor(type, pos, rng) {
    const t = MOB_TYPES[type];
    this.type = type; this.def = t;
    this.body = new VoxelBody();
    this.body.half = t.half; this.body.height = t.height;
    this.body.pos = [...pos];
    this.health = t.health;
    this.yaw = rng() * Math.PI * 2; this.headYaw = 0; this.headPitch = 0;
    this.walk = 0; this.walkSpeed = 0;
    this.goal = null; this.goalT = 0;
    this.angry = t.kind === 'hostile' ? 1 : 0;
    this.hurtT = 0; this.flee = 0; this.attackT = 0; this.shootT = 1 + rng() * 2; this.fuse = 0; this.dead = 0;
    this.age = 0;
    this.woolly = true;
  }
}

export class Mobs {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.projectiles = [];
    this.spawnT = 0;
    this.seed = 1;
  }
  rng() { this.seed = (Math.imul(this.seed ^ (this.seed >>> 15), 2246822519) + 374761393) >>> 0; return (this.seed >>> 8) / 16777216; }

  clear() { this.list.length = 0; this.projectiles.length = 0; }

  // ---------------------------------------------------------------- spawning

  update(dt) {
    const g = this.game, w = g.world;
    if (!w || g.state === 'loading') return;
    if ((this.spawnT -= dt) <= 0) { this.spawnT = 0.7; this.trySpawn(); }
    if ((this.structT = (this.structT ?? 1) - dt) <= 0) { this.structT = 2.5; this.structureSpawns(); }
    const pp = g.player.body.pos;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const m = this.list[i];
      const d = Math.hypot(m.body.pos[0] - pp[0], m.body.pos[2] - pp[2]);
      const col = w.column(Math.floor(m.body.pos[0]) >> 5, Math.floor(m.body.pos[2]) >> 5);
      if (d > 110 || !col || col.state !== 'ready' || (m.dead && m.dead > 1.1) || m.body.pos[1] < -120) { this.list.splice(i, 1); continue; }
      this.think(m, dt);
    }
    this.updateProjectiles(dt);
  }

  /** Villages keep their villagers, outposts their pillagers, bastions their brutes; dungeon spawners work. */
  structureSpawns() {
    const g = this.game, w = g.world, p = g.player.body.pos, dim = g.dim;
    if ((g.settings && g.settings.mobs === false) || !g.meta || g.meta.flat) return;
    const peaceful = g.settings && g.settings.difficulty === 'peaceful';
    const T = dim === Dim.Overworld ? (this.T && this.Tseed === g.meta.seed ? this.T : (this.Tseed = g.meta.seed, this.T = terrainFor(g.meta.seed))) : null;
    const plans = structuresIn(g.meta.seed, T, p[0] - 80, p[2] - 80, p[0] + 80, p[2] + 80, dim);
    if (dim === 3 && !peaceful) for (const t of skyTemples(g.meta.seed, p[0] - 40, p[2] - 40, p[0] + 40, p[2] + 40)) {
      if ((g.meta.templesCleared || {})[t.key] || this.list.some((m) => m.def.boss && !m.dead)) continue;
      if (Math.hypot(t.x - p[0], t.z - p[2]) < 14 && Math.abs(p[1] - t.y) < 12) {
        const m = this.spawnAt('storm_ghast', [t.x + 0.5, t.y + 14, t.z + 0.5]);
        m.templeKey = t.key;
        g.emit('toast', 'A Storm Ghast rises over the temple!');
      }
    }
    const near = (test, x, z, r) => this.list.filter((m) => !m.dead && test(m) && Math.hypot(m.body.pos[0] - x, m.body.pos[2] - z) < r).length;
    const ground = (x, z, y0) => {
      // the lowest free spot (street level, not a roof)
      for (let y = y0 - 3; y < y0 + 12; y++) { const f = w.getBlock(x, y - 1, z); if (f > 0 && (BLOCKS[f].flags & F.Solid) && this.standable(x, y, z)) return y; }
      return null;
    };
    // structure guardians: once per structure (bastions: the Hollow King; igloos: the Frost Colossus)
    const guards = { bastion: 'hollow_king', igloo: 'frost_colossus' };
    for (const st of plans) {
      const type = guards[st.kind], key = `${st.kind}:${st.x},${st.z}`;
      if (!type || peaceful || (g.meta.guardians || {})[key] || this.list.some((m) => m.def.boss && !m.dead)) continue;
      if (Math.hypot(st.x - p[0], st.z - p[2]) > (st.kind === 'igloo' ? 12 : 22)) continue;
      const y = st.kind === 'bastion' ? 35 : (st.gy ?? p[1]) + 1;
      const m = this.spawnAt(type, [st.x + (st.kind === 'igloo' ? 8.5 : 0.5), y, st.z + 0.5]);
      g.meta.guardians = { ...(g.meta.guardians || {}), [key]: true };
      g.emit('toast', `${m.def.name} guards this place!`);
    }
    for (const s of plans) {
      const d = Math.hypot(s.x - p[0], s.z - p[2]);
      if (s.kind === 'village' && d < 90) {
        if (near((m) => m.def.villager, s.x, s.z, 56) >= 6) continue;
        const pc = s.pieces[Math.floor(this.rng() * s.pieces.length)];
        const x = pc.x + Math.floor(this.rng() * 3) - 1, z = pc.z - 3 + Math.floor(this.rng() * 2), y = ground(x, z, pc.y);
        if (y == null) continue;
        const v = this.spawnAt(`villager_${PROFESSIONS[Math.floor(this.rng() * PROFESSIONS.length)]}`, [x + 0.5, y, z + 0.5]);
        v.home = [s.x, s.z];
      } else if (s.kind === 'outpost' && !peaceful && d < 70) {
        if (near((m) => m.type === 'pillager' || m.type === 'vindicator', s.x, s.z, 28) >= 4) continue;
        const a = this.rng() * Math.PI * 2, x = Math.floor(s.x + Math.cos(a) * 7), z = Math.floor(s.z + Math.sin(a) * 7), y = ground(x, z, s.y + 4);
        if (y == null) continue;
        const m = this.spawnAt(this.rng() < 0.7 ? 'pillager' : 'vindicator', [x + 0.5, y, z + 0.5]);
        m.home = [s.x, s.z];
      } else if (s.kind === 'bastion' && !peaceful && d < 60) {
        if (near((m) => m.type === 'piglin_brute', s.x, s.z, 20) >= 3) continue;
        const x = s.x - 5 + Math.floor(this.rng() * 11), z = s.z - 5 + Math.floor(this.rng() * 11);
        if (this.standable(x, 35, z)) { const m = this.spawnAt('piglin_brute', [x + 0.5, 35, z + 0.5]); m.home = [s.x, s.z]; }
      } else if (s.kind === 'dungeon' && !peaceful && Math.hypot(d, s.y + 1 - p[1]) < 16) {
        // the spawner: a few of its monster at a time while the player is near
        if (w.getBlock(s.x, s.y + 1, s.z) !== C.spawner) continue;
        g.spawnEmbers([s.x + 0.5, s.y + 1.5, s.z + 0.5], 8, [1.8, 0.6, 0.2]);
        if (near((m) => m.type === s.mob, s.x, s.z, 9) >= 4) continue;
        for (let k = 0; k < 2; k++) {
          const x = s.x - 3 + Math.floor(this.rng() * 7), z = s.z - 3 + Math.floor(this.rng() * 7);
          if (this.standable(x, s.y + 1, z)) this.spawnAt(s.mob, [x + 0.5, s.y + 1, z + 0.5]);
        }
      }
    }
  }

  counts() {
    const c = { passive: 0, hostile: 0, neutral: 0 };
    for (const m of this.list) c[m.def.kind]++;
    return c;
  }

  trySpawn() {
    const g = this.game, w = g.world, p = g.player.body.pos, dim = g.dim;
    if ((g.settings && g.settings.mobs === false) || (g.meta && g.meta.arena)) return;
    const counts = this.counts(), sky = g.skyNow || g.tod.state;
    const night = (sky.daylight ?? 1) < 0.3;
    const peaceful = g.settings && g.settings.difficulty === 'peaceful';
    for (let attempt = 0; attempt < 4; attempt++) {
      const a = this.rng() * Math.PI * 2, r = 24 + this.rng() * 36;
      const x = Math.floor(p[0] + Math.cos(a) * r), z = Math.floor(p[2] + Math.sin(a) * r);
      if (dim === Dim.Overworld) {
        const h = w.heightmapAt(x, z);
        if (h == null) continue;
        const clim = w.climateAt(x, z);
        const top = w.getBlock(x, h, z);
        const open = this.standable(x, h + 1, z) && !isLiquid(top) && (BLOCKS[top].flags & F.Solid);
        if (open && !night && counts.passive < 12 && clim && (clim.biome === Biome.SnowyTundra || clim.biome === Biome.SnowyPeaks) && (top === B.Snow || top === B.SnowyGrass) && this.rng() < 0.4) {
          this.spawnGroup('polar_bear', x, h + 1, z, 1 + (this.rng() < 0.3 ? 1 : 0));
          return;
        }
        if (open && !night && counts.passive < 12 && top === B.Grass && clim && GRASSY.has(clim.biome)) {
          const kinds = clim.biome === Biome.Taiga || clim.biome === Biome.SnowyTaiga ? ['sheep', 'wolf', 'cow'] : ['cow', 'pig', 'sheep', 'chicken'];
          this.spawnGroup(kinds[Math.floor(this.rng() * kinds.length)], x, h + 1, z, 2 + Math.floor(this.rng() * 3));
          return;
        }
        if (peaceful || counts.hostile >= 14) continue;
        // monsters: on the dark surface at night, or in caves any time
        let y = null;
        if (night && open) y = h + 1;
        else {
          for (let k = 0; k < 8; k++) {
            const cy = h - 8 - Math.floor(this.rng() * 70);
            if (this.standable(x, cy, z) && (BLOCKS[w.getBlock(x, cy - 1, z)].flags & F.Solid) && this.dark(x, cy, z)) { y = cy; break; }
          }
        }
        if (y == null) continue;
        const pick = this.rng();
        let kind = pick < 0.35 ? 'husk' : pick < 0.62 ? 'skeleton' : pick < 0.82 ? 'creeper' : 'spider';
        if (kind === 'skeleton' && clim && (clim.biome === Biome.SnowyTaiga || clim.biome === Biome.SnowyTundra)) kind = 'stray';
        if (kind === 'spider' && y < 20 && this.rng() < 0.6) kind = 'cave_spider';
        if ((clim && clim.biome === Biome.Swamp && night && this.rng() < 0.5) || (y < 0 && this.rng() < 0.12)) kind = ['slime_big', 'slime_medium', 'slime_small'][Math.floor(this.rng() * 3)];
        // a rare King Slime in the swamps at night (not in Minecraft)
        if (clim && clim.biome === Biome.Swamp && night && y >= h && this.rng() < 0.015 && !this.list.some((m) => m.def.boss && !m.dead)) { this.spawnAt('king_slime', [x + 0.5, y + 1, z + 0.5]); g.emit('toast', 'The ground shakes: King Slime is near!'); return; }
        if (kind === 'spider' && !this.standableWide(x, y, z)) continue;
        this.spawnGroup(kind, x, y, z, 1 + (this.rng() < 0.3 ? 1 : 0));
        return;
      }
      if (dim === 3) {
        const h = w.heightmapAt(x, z);
        if (h != null && h > 40 && w.getBlock(x, h, z) === B.Grass && this.standable(x, h + 1, z) && counts.passive < 12) {
          this.spawnGroup(this.rng() < 0.55 ? 'moa' : 'sheep', x, h + 1, z, 1 + Math.floor(this.rng() * 3));
          return;
        }
        if (this.rng() < 0.08 && this.list.filter((m) => m.type === 'sky_whale').length < 3) { const y = Math.floor(p[1] + 10 + this.rng() * 20); if (this.openAir(x, y, z)) { this.spawnGroup('sky_whale', x, y, z, 1); return; } }
        continue;
      }
      if (dim === Dim.Nether) {
        if (peaceful) return;
        if (counts.hostile + counts.neutral >= 16) return;
        for (let k = 0; k < 10; k++) {
          const cy = 32 + Math.floor(this.rng() * 80);
          if (!this.standable(x, cy, z)) continue;
          const floor = w.getBlock(x, cy - 1, z);
          if (floor >= 0 && BLOCKS[floor].flags & F.Solid) {
            if (floor === B.NetherBricks) { if (this.rng() < 0.5) this.spawnGroup('blaze', x, cy + 1, z, 1); else if (this.standable(x, cy + 1, z)) this.spawnGroup('wither_skeleton', x, cy, z, 1); return; }
            this.spawnGroup('zombified_piglin', x, cy, z, 1 + Math.floor(this.rng() * 3));
            return;
          }
          // ghasts are rare: a few in the whole Nether around the player
          if (this.rng() < 0.012 && this.list.filter((m) => m.type === 'ghast' && !m.dead).length < 2 && this.openAir(x, cy + 4, z)) { this.spawnGroup('ghast', x, cy + 4, z, 1); return; }
          if (this.rng() < 0.05) {
            // striders on the lava sea
            for (let ly = 40; ly > 20; ly--) if (isLava(w.getBlock(x, ly, z)) && w.getBlock(x, ly + 1, z) === B.Air && w.getBlock(x, ly + 2, z) === B.Air) { if (counts.passive < 6) this.spawnGroup('strider', x, ly + 1, z, 1 + Math.floor(this.rng() * 2)); return; }
          }
        }
      }
    }
  }

  spawnGroup(type, x, y, z, n) {
    for (let k = 0; k < n; k++) {
      const dx = k ? Math.floor(this.rng() * 5) - 2 : 0, dz = k ? Math.floor(this.rng() * 5) - 2 : 0;
      if (k && !this.standable(x + dx, y, z + dz)) continue;
      this.list.push(new Mob(type, [x + dx + 0.5, y, z + dz + 0.5], () => this.rng()));
    }
  }
  spawnAt(type, pos) { const m = new Mob(type, pos, () => this.rng()); this.list.push(m); return m; }

  standable(x, y, z) { const w = this.game.world; return w.getBlock(x, y, z) === B.Air && w.getBlock(x, y + 1, z) === B.Air; }
  standableWide(x, y, z) { for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.standable(x + dx, y, z + dz)) return false; return true; }
  openAir(x, y, z) { const w = this.game.world; for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz += 2) for (let dx = -2; dx <= 2; dx += 2) if (w.getBlock(x + dx, y + dy, z + dz) !== B.Air) return false; return true; }
  dark(x, y, z) { const L = this.game.lightAt(x + 0.5, y + 0.5, z + 0.5); return L.sky < 0.3 && L.block < 0.2; }

  // ---------------------------------------------------------------- behaviour

  think(m, dt) {
    const g = this.game, w = g.world, t = m.def, b = m.body;
    m.age += dt;
    m.hurtT = Math.max(0, m.hurtT - dt);
    if (m.dead) { m.dead += dt; b.vel[0] *= 0.9; b.vel[2] *= 0.9; b.vel[1] -= 20 * dt; b.move(w, [b.vel[0] * dt, b.vel[1] * dt, b.vel[2] * dt]); return; }
    const pl = g.player, pp = pl.body.pos;
    const dx = pp[0] - b.pos[0], dz = pp[2] - b.pos[2], dy = pp[1] - b.pos[1], dist = Math.hypot(dx, dy, dz);
    const sky = g.skyNow || g.tod.state;
    const targetable = g.state === 'playing' && !g.creative;
    let hostile = m.angry > 0 && targetable;
    if (t.dayNeutral && (sky.daylight ?? 0) > 0.5 && !m.provoked) hostile = false;
    const sees = hostile && dist < (t.range || 20) && this.lineOfSight(b.pos[0], b.pos[1] + t.height * 0.85, b.pos[2], pp[0], pp[1] + 1.5, pp[2]);
    let wantX = 0, wantZ = 0, speed = 0;
    if (m.flee > 0) {
      m.flee -= dt;
      const l = Math.hypot(dx, dz) || 1;
      wantX = -dx / l; wantZ = -dz / l; speed = t.speed * 1.9;
    } else if (sees || (hostile && dist < 6)) {
      const l = Math.hypot(dx, dz) || 1;
      const keep = t.ranged === 'arrow' ? 7 : t.ranged ? 10 : 0;
      const dir = dist > keep + 1 ? 1 : dist < keep - 2 ? -0.6 : 0;
      wantX = dx / l * dir; wantZ = dz / l * dir; speed = t.speed * (t.ranged ? 0.8 : 1.15);
      m.yaw = Math.atan2(-dx, -dz);
      // attacks
      m.attackT -= dt; m.shootT -= dt;
      if (t.damage && dist < t.half + 1.2 && m.attackT <= 0) {
        m.attackT = 1; m.swing = 1;
        g.stats.damage(t.damage, m.type);
        const k = 5 / (dist || 1); pl.body.vel[0] += dx * k * 0.6; pl.body.vel[2] += dz * k * 0.6; pl.body.vel[1] = Math.max(pl.body.vel[1], 4);
      }
      if (t.ranged && sees && m.shootT <= 0) {
        m.shootT = t.ranged === 'arrow' ? 1.8 + this.rng() : t.ranged === 'fireball' ? 2.5 : 3.5 + this.rng() * 2;
        this.shoot(m, pp, t.ranged);
      }
      if (t.explode) {
        if (dist < 3) m.fuse += dt; else m.fuse = Math.max(0, m.fuse - dt * 2);
        if (m.fuse > 1.5) { this.explode(b.pos[0], b.pos[1] + 0.8, b.pos[2], t.explode, m); m.health = 0; m.dead = 2; return; }
      }
    } else {
      // wander
      m.goalT -= dt;
      if (m.goalT <= 0) {
        m.goalT = 3 + this.rng() * 7;
        m.goal = this.rng() < 0.35 ? null : [b.pos[0] + (this.rng() - 0.5) * 16, b.pos[2] + (this.rng() - 0.5) * 16];
      }
      if (m.goal) {
        const gx = m.goal[0] - b.pos[0], gz = m.goal[1] - b.pos[2], l = Math.hypot(gx, gz);
        if (l < 0.6) m.goal = null; else { wantX = gx / l; wantZ = gz / l; speed = t.speed * 0.55; }
      }
      m.fuse = Math.max(0, m.fuse - dt * 2);
    }
    if (m.home && !hostile) {
      const hx = m.home[0] - b.pos[0], hz = m.home[1] - b.pos[2], hl = Math.hypot(hx, hz);
      if (hl > 22) { wantX = hx / hl; wantZ = hz / hl; speed = t.speed * 0.6; m.goal = null; }
    }
    if (speed > 0 && (wantX || wantZ)) m.yaw = lerpAngle(m.yaw, Math.atan2(-wantX, -wantZ), Math.min(1, dt * 6));
    // skeletons burn in daylight under the open sky
    if (t.burns && g.dim === Dim.Overworld && (sky.daylight ?? 0) > 0.6 && !isWater(w.getBlock(Math.floor(b.pos[0]), Math.floor(b.pos[1] + 0.5), Math.floor(b.pos[2])))) {
      const h = w.heightmapAt(Math.floor(b.pos[0]), Math.floor(b.pos[2]));
      if (h != null && b.pos[1] > h) { m.burnT = (m.burnT || 0) - dt; if (m.burnT <= 0) { m.burnT = 1; this.hurt(m, 1, null); g.spawnEmbers([b.pos[0], b.pos[1] + 1, b.pos[2]], 6); } }
    }
    // lava hurts them too
    if (isLava(w.getBlock(Math.floor(b.pos[0]), Math.floor(b.pos[1] + 0.2), Math.floor(b.pos[2]))) && !['blaze', 'zombified_piglin', 'ghast', 'strider'].includes(m.type)) this.hurt(m, dt * 8, null);
    if (t.bossAI && hostile) this.bossThink(m, dt, dist, dx, dz, pp);
    if (m.slowT > 0) { m.slowT -= dt; speed *= 0.4; if (Math.random() < dt * 4) g.spawnEmbers([b.pos[0], b.pos[1] + t.height * 0.6, b.pos[2]], 1, [1.2, 1.5, 2.0]); }
    if (m.onFire > 0) {
      m.onFire -= dt; m.fireT = (m.fireT || 0) - dt;
      if (m.fireT <= 0) { m.fireT = 1; this.hurt(m, 2, null); g.spawnEmbers([b.pos[0], b.pos[1] + t.height * 0.5, b.pos[2]], 6); }
    }
    if (t.hop) {
      // slimes do not walk: they gather themselves and jump
      m.hopT = (m.hopT ?? 1) - dt;
      if (t.boss && targetable) {
        // the King teleports back to a player who got away (shrinking into a puddle of motes first)
        m.farT = dist > 28 || (b.hitWall && b.grounded) ? (m.farT || 0) + dt : 0;
        if (m.farT > 4) {
          m.farT = 0;
          g.spawnEmbers([b.pos[0], b.pos[1] + 1, b.pos[2]], 40, [0.4, 1.4, 0.5]);
          const a = this.rng() * Math.PI * 2;
          b.pos = [pp[0] + Math.cos(a) * 6, pp[1] + 6, pp[2] + Math.sin(a) * 6]; b.vel = [0, 0, 0];
          g.spawnEmbers([b.pos[0], b.pos[1] + 1, b.pos[2]], 40, [0.4, 1.4, 0.5]);
          g.emit('toast', 'King Slime teleports!');
        }
      }
      if (b.grounded) {
        b.vel[0] *= 0.6; b.vel[2] *= 0.6;
        if (m.hopT <= 0 && (wantX || wantZ || hostile)) {
          m.hopT = hostile ? 0.6 + this.rng() * 0.6 : 1.5 + this.rng() * 2;
          const l = Math.hypot(wantX, wantZ) || 1, hs = t.speed * (hostile ? 1.6 : 1) * (0.8 + t.height * 0.3);
          b.vel[0] = wantX / l * hs; b.vel[2] = wantZ / l * hs; b.vel[1] = t.boss ? 9 + Math.min(8, dist * 0.35) : 6 + t.height * 1.5;
          if (t.boss) m.hopT = 0.9 + this.rng() * 0.8;
          m.squish = 1;
        }
      }
      m.squish = Math.max(0, (m.squish || 0) - dt * 3);
      b.vel[1] = Math.max(b.vel[1] - 30 * dt, -40);
      b.move(w, [b.vel[0] * dt, b.vel[1] * dt, b.vel[2] * dt]);
      m.walkSpeed = 0;
      const wh = dist < 8 ? Math.atan2(-dx, -dz) - m.yaw : 0;
      m.headYaw = lerpAngle(m.headYaw, clampAngle(wh, 1.0), Math.min(1, dt * 5));
      return;
    }
    if (t.lavaWalk) {
      // striders stand on lava as on ground
      const fy = Math.floor(b.pos[1] - 0.02), under = w.getBlock(Math.floor(b.pos[0]), fy, Math.floor(b.pos[2]));
      if (isLava(w.getBlock(Math.floor(b.pos[0]), Math.floor(b.pos[1] + 0.3), Math.floor(b.pos[2])))) b.vel[1] = Math.max(b.vel[1], 3);
      else if (isLava(under) && b.vel[1] <= 0 && b.pos[1] - (fy + 1) < 0.2) { b.pos[1] = fy + 1; b.vel[1] = 0; b.grounded = true; }
    }
    // move
    const accel = 1 - Math.exp(-10 * dt);
    b.vel[0] += (wantX * speed - b.vel[0]) * accel;
    b.vel[2] += (wantZ * speed - b.vel[2]) * accel;
    if (t.flying) {
      // hover: blazes a few blocks over the ground near their target, ghasts drift high
      const ground = this.groundBelow(b.pos[0], b.pos[1], b.pos[2], 20);
      const noGround = ground <= b.pos[1] - 19;
      let want = t.hover != null ? ground + t.hover : m.type === 'ghast' ? ground + 9 : (hostile ? pp[1] + 2 : ground + 2.5);
      if (hostile && t.boss) want = pp[1] + (t.bossAI === 'storm' ? 10 : 4);
      else if (noGround) want = b.pos[1];
      b.vel[1] += ((want - b.pos[1]) * 1.2 - b.vel[1]) * Math.min(1, dt * 2) + Math.sin(m.age * 1.7) * 0.02;
    } else {
      const inLiquid = isLiquid(w.getBlock(Math.floor(b.pos[0]), Math.floor(b.pos[1] + 0.3), Math.floor(b.pos[2])));
      const onLava = t.lavaWalk && b.grounded && b.vel[1] === 0 && isLava(w.getBlock(Math.floor(b.pos[0]), Math.floor(b.pos[1] - 0.02), Math.floor(b.pos[2])));
      if (onLava) b.vel[1] = 0;
      else if (inLiquid) b.vel[1] = Math.min(b.vel[1] + 14 * dt, 2.2); else b.vel[1] = Math.max(b.vel[1] - 30 * dt, -40);
      if (b.hitWall && b.grounded && speed > 0) b.vel[1] = 8.5;   // hop up a block
      if (t.flutter && b.vel[1] < -2) b.vel[1] = -2;            // chickens flutter down
    }
    b.move(w, [b.vel[0] * dt, b.vel[1] * dt, b.vel[2] * dt]);
    const moved = Math.hypot(b.vel[0], b.vel[2]);
    m.walkSpeed += (Math.min(1, moved / Math.max(0.5, t.speed)) - m.walkSpeed) * Math.min(1, dt * 8);
    m.walk += moved * dt * 2.2;
    m.swing = Math.max(0, (m.swing || 0) - dt * 3);
    // look at the player when near
    const wantHead = dist < 8 ? Math.atan2(-dx, -dz) - m.yaw : 0;
    m.headYaw = lerpAngle(m.headYaw, clampAngle(wantHead, 1.0), Math.min(1, dt * 5));
    m.headPitch += ((dist < 8 ? -Math.atan2(dy + 1.5 - t.height * 0.85, Math.hypot(dx, dz)) : 0) - m.headPitch) * Math.min(1, dt * 5);
    // fall damage for big falls
    if (b.grounded && m.fallFrom != null) { const h = m.fallFrom - b.pos[1]; if (h > 3.5 && !t.flying) this.hurt(m, h - 3, null); m.fallFrom = null; }
    else if (!b.grounded && b.vel[1] < 0 && m.fallFrom == null) m.fallFrom = b.pos[1];
    if (b.grounded) m.fallFrom = null;
  }

  /** The bosses' own moves on top of chasing and shooting. */
  bossThink(m, dt, dist, dx, dz, pp) {
    const g = this.game, b = m.body, t = m.def, low = m.health < t.health * 0.5;
    m.skillT = (m.skillT ?? 3) - dt;
    m.summonT = (m.summonT ?? 10) - dt;
    if (t.bossAI === 'inferno') {
      // a spread of fireballs, and blazes called in when it is hurt
      if (m.skillT <= 0) {
        m.skillT = low ? 1.6 : 2.4;
        const n = low ? 5 : 3;
        for (let k = 0; k < n; k++) {
          this.shoot(m, pp, 'fireball');
          const s = this.projectiles[this.projectiles.length - 1], a = (k - (n - 1) / 2) * 0.16, c = Math.cos(a), si = Math.sin(a);
          s.v = [s.v[0] * c - s.v[2] * si, s.v[1], s.v[0] * si + s.v[2] * c];
        }
      }
      if (low && m.summonT <= 0 && this.list.filter((q) => q.type === 'blaze' && !q.dead).length < 4) { m.summonT = 12; for (let k = 0; k < 2; k++) this.spawnAt('blaze', [b.pos[0] + (k ? 3 : -3), b.pos[1], b.pos[2]]); g.emit('toast', 'The Inferno Spirit calls its blazes!'); }
    } else if (t.bossAI === 'hollow') {
      // a charge every few seconds; wither skeletons once it is hurt
      if (m.skillT <= 0 && dist > 4) {
        m.skillT = low ? 4 : 6; m.charge = 0.7;
        const l = Math.hypot(dx, dz) || 1; m.chargeDir = [dx / l, dz / l];
        g.emit('toast', 'The Hollow King charges!');
      }
      if (m.charge > 0) { m.charge -= dt; b.vel[0] = m.chargeDir[0] * 14; b.vel[2] = m.chargeDir[1] * 14; if (m.charge <= 0) b.vel[0] = b.vel[2] = 0; }
      if (low && m.summonT <= 0 && this.list.filter((q) => q.type === 'wither_skeleton' && !q.dead).length < 4) { m.summonT = 15; for (let k = 0; k < 2; k++) this.spawnAt('wither_skeleton', [b.pos[0] + (k ? 2.5 : -2.5), b.pos[1] + 0.5, b.pos[2]]); g.emit('toast', 'The Hollow King raises the dead!'); }
    } else if (t.bossAI === 'frost') {
      // a ground slam that throws the player up, and a freezing breath that slows them
      const pl = g.player;
      if (m.skillT <= 0) {
        m.skillT = low ? 3 : 4.5;
        if (dist < 9) {
          g.spawnEmbers([b.pos[0], b.pos[1] + 0.3, b.pos[2]], 30, [1.2, 1.4, 1.8]); g.audio.explosion();
          if (!g.creative) { g.stats.damage(Math.round(8 * (1 - dist / 12)), 'frost_colossus'); pl.body.vel[1] = Math.max(pl.body.vel[1], 9); }
        } else if (dist < 16) {
          for (let k = 1; k < 8; k++) g.spawnEmbers([b.pos[0] + dx * k / 8, b.pos[1] + t.height * 0.6 + (pp[1] - b.pos[1]) * k / 8, b.pos[2] + dz * k / 8], 2, [1.3, 1.6, 2.0]);
          if (!g.creative) { g.stats.damage(3, 'frost_colossus'); pl.slowT = 3; }
        }
      }
    } else if (t.bossAI === 'storm') {
      // lightning where the player stands (a warning glow first)
      if (m.strike) {
        m.strike.t -= dt;
        if (Math.random() < 0.5) g.spawnEmbers(m.strike.at, 2, [0.6, 0.8, 2.0]);
        if (m.strike.t <= 0) {
          const [x, y, z] = m.strike.at;
          g.flash = Math.max(g.flash, 1); g.audio.explosion();
          const pl = g.player.body.pos;
          if (Math.hypot(pl[0] - x, pl[2] - z) < 2.5 && Math.abs(pl[1] - y) < 4 && !g.creative) g.stats.damage(7, 'storm_ghast');
          if (g.ignite) g.ignite(Math.floor(x), Math.floor(y), Math.floor(z));
          m.strike = null;
        }
      } else if (m.skillT <= 0) { m.skillT = low ? 2.5 : 4; m.strike = { at: [pp[0], pp[1] + 0.1, pp[2]], t: 1.1 }; }
    }
  }

  groundBelow(x, y, z, max) {
    const w = this.game.world;
    for (let k = 0; k < max; k++) { const b = w.getBlock(Math.floor(x), Math.floor(y) - k, Math.floor(z)); if (b < 0 || (BLOCKS[b].flags & F.Solid) || isLiquid(b)) return Math.floor(y) - k + 1; }
    return y - max;
  }

  lineOfSight(x0, y0, z0, x1, y1, z1) {
    const w = this.game.world, d = Math.hypot(x1 - x0, y1 - y0, z1 - z0), n = Math.ceil(d * 2);
    for (let k = 1; k < n; k++) {
      const f = k / n, b = w.getBlock(Math.floor(x0 + (x1 - x0) * f), Math.floor(y0 + (y1 - y0) * f), Math.floor(z0 + (z1 - z0) * f));
      if (b < 0 || (BLOCKS[b].flags & F.Opaque)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- damage

  /** attacker: the player (null for the world). Returns true when it died. */
  hurt(m, amount, attacker) {
    if (m.dead) return false;
    const g = this.game;
    m.health -= amount;
    m.hurtT = 0.4;
    if (attacker) {
      const pp = g.player.body.pos, dx = m.body.pos[0] - pp[0], dz = m.body.pos[2] - pp[2], l = Math.hypot(dx, dz) || 1;
      m.body.vel[0] += dx / l * 6; m.body.vel[2] += dz / l * 6; m.body.vel[1] = Math.max(m.body.vel[1], 5);
      if (m.def.kind === 'passive') m.flee = 4;
      else { m.angry = 1; m.provoked = true; }
      if (m.def.group) for (const o of this.list) if (o.type === m.type && Math.hypot(o.body.pos[0] - m.body.pos[0], o.body.pos[2] - m.body.pos[2]) < 16) { o.angry = 1; o.provoked = true; }
    }
    g.audio.mobHurt(m.type);
    if (attacker && attacker === g.player && m.health > 0) {
      const held = g.inventory && g.inventory.heldItem;
      if (held && held.fire) m.onFire = 4;
      if (held && held.frost) m.slowT = 4;
      if (held && held.heavy) { const pp2 = g.player.body.pos, ddx = m.body.pos[0] - pp2[0], ddz = m.body.pos[2] - pp2[2], l2 = Math.hypot(ddx, ddz) || 1; m.body.vel[0] += ddx / l2 * 6; m.body.vel[2] += ddz / l2 * 6; }
    }
    if (m.health <= 0 && m.def.boss && g.meta) { g.meta.bossesDefeated = { ...(g.meta.bossesDefeated || {}), [m.type]: ((g.meta.bossesDefeated || {})[m.type] || 0) + 1 }; g.emit('toast', `${m.def.name} defeated!`); }
    if (m.health <= 0 && m.templeKey && g.meta) { g.meta.templesCleared = { ...(g.meta.templesCleared || {}), [m.templeKey]: true }; g.emit('toast', 'The sky temple is quiet'); }
    if (m.def.boss && m.health > 0 && m.type === 'king_slime') {
      // the King sheds slimes as it is hurt
      m.shed = (m.shed || 0) + amount;
      while (m.shed >= 25) { m.shed -= 25; const c = this.spawnAt(this.rng() < 0.7 ? 'slime_small' : 'slime_medium', [m.body.pos[0] + (this.rng() - 0.5) * 3, m.body.pos[1] + 2, m.body.pos[2] + (this.rng() - 0.5) * 3]); c.body.vel = [(this.rng() - 0.5) * 8, 6, (this.rng() - 0.5) * 8]; }
    }
    if (m.health <= 0) {
      m.dead = 0.001;
      if (m.def.splits) {
        const n = 2 + Math.floor(this.rng() * 2);
        for (let k = 0; k < n; k++) {
          const c = this.spawnAt(m.def.splits, [m.body.pos[0] + (this.rng() - 0.5) * m.def.half, m.body.pos[1] + 0.2, m.body.pos[2] + (this.rng() - 0.5) * m.def.half]);
          c.body.vel = [(this.rng() - 0.5) * 4, 4, (this.rng() - 0.5) * 4];
        }
      }
      if (attacker || amount >= 1) this.drop(m);
      return true;
    }
    return false;
  }

  drop(m) {
    const g = this.game, p = m.body.pos;
    for (const [item, lo, hi] of m.def.drops) {
      const n = lo + Math.floor(this.rng() * (hi - lo + 1));
      const id = typeof item === 'string' ? C[item] : item;
      if (n > 0 && id && ITEMS[id]) g.spawnItem(id, n, [p[0], p[1] + 0.5, p[2]], [(this.rng() - 0.5) * 3, 3, (this.rng() - 0.5) * 3]);
    }
  }

  /** The mob the player's crosshair is on within reach (ray from eye along dir), or null. */
  pick(eye, dir, reach) {
    let best = null, bd = reach;
    for (const m of this.list) {
      if (m.dead) continue;
      const b = m.body, h = m.def.half + 0.1;
      const t = rayBox(eye, dir, [b.pos[0] - h, b.pos[1], b.pos[2] - h], [b.pos[0] + h, b.pos[1] + m.def.height, b.pos[2] + h]);
      if (t != null && t < bd) { bd = t; best = m; }
    }
    return best ? { mob: best, dist: bd } : null;
  }

  // ---------------------------------------------------------------- projectiles and explosions

  shoot(m, target, kind) {
    const b = m.body, from = [b.pos[0], b.pos[1] + m.def.height * (kind === 'ghastball' ? 0.5 : 0.8), b.pos[2]];
    const to = [target[0], target[1] + 1.2, target[2]];
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]], l = Math.hypot(...d) || 1;
    const speed = kind === 'arrow' ? 24 : kind === 'fireball' ? 14 : 12;
    const v = d.map((x) => x / l * speed);
    if (kind === 'arrow') v[1] += l * 0.18;   // arc
    const spread = kind === 'arrow' ? 1.2 : 0.4;
    v[0] += (this.rng() - 0.5) * spread; v[2] += (this.rng() - 0.5) * spread;
    this.projectiles.push({ kind, p: from, v, life: 6, owner: m });
    this.game.audio.shoot(kind);
  }

  updateProjectiles(dt) {
    const g = this.game, w = g.world, pp = g.player.body.pos;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const s = this.projectiles[i];
      s.life -= dt;
      if (s.kind === 'arrow') s.v[1] -= 20 * dt;
      const n = [s.p[0] + s.v[0] * dt, s.p[1] + s.v[1] * dt, s.p[2] + s.v[2] * dt];
      if (s.kind !== 'arrow' && g.particles) g.spawnEmbers(s.p, 1, s.kind === 'ghastball' ? [1.8, 0.7, 0.2] : [1.8, 0.8, 0.15]);
      // the player
      const inside = n[0] > pp[0] - 0.4 && n[0] < pp[0] + 0.4 && n[2] > pp[2] - 0.4 && n[2] < pp[2] + 0.4 && n[1] > pp[1] && n[1] < pp[1] + 1.9;
      const b = w.getBlock(Math.floor(n[0]), Math.floor(n[1]), Math.floor(n[2]));
      const solid = b < 0 || (BLOCKS[b] && BLOCKS[b].flags & F.Solid);
      if (s.owner === 'player' || s.owner === 'dispenser') {
        const hitMob = this.list.find((m) => !m.dead && Math.abs(n[0] - m.body.pos[0]) < (m.def.half || 0.3) + 0.2 && Math.abs(n[2] - m.body.pos[2]) < (m.def.half || 0.3) + 0.2 && n[1] > m.body.pos[1] && n[1] < m.body.pos[1] + m.def.height);
        if (hitMob) { this.hurt(hitMob, s.damage || 4, s.owner === 'player' ? g.player : null); this.projectiles.splice(i, 1); continue; }
      }
      if (inside && !g.creative && g.state === 'playing' && s.owner !== 'player') {
        if (s.kind === 'arrow') g.stats.damage(2 + Math.floor(this.rng() * 3), 'skeleton');
        else if (s.kind === 'fireball') { g.stats.damage(5, 'blaze'); g.burning = 3; }
        else this.explode(n[0], n[1], n[2], 1.6, null);
        this.projectiles.splice(i, 1); continue;
      }
      if (solid || s.life <= 0) {
        if (s.kind === 'ghastball' && solid) this.explode(n[0], n[1], n[2], 1.6, null);
        if (s.kind === 'arrow' && s.owner === 'player' && solid && Math.random() < 0.7) g.spawnItem(I.Arrow, 1, s.p, [0, 0.5, 0], 0, 0.3);
        this.projectiles.splice(i, 1); continue;
      }
      s.p = n;
    }
  }

  /** Blows out blocks in a ball (not bedrock or obsidian), hurts and pushes the player and mobs. */
  explode(x, y, z, power, source) {
    const g = this.game, w = g.world, r = power * 1.3;
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy, dz);
      if (d > r * (0.7 + this.rng() * 0.3)) continue;
      const bx = Math.floor(x + dx), by = Math.floor(y + dy), bz = Math.floor(z + dz), b = w.getBlock(bx, by, bz);
      if (b <= 0 || isLiquid(b)) continue;
      if (b === g.redstone.tntId) { g.redstone.prime(bx, by, bz, 0.5 + this.rng()); continue; }     // chain reactions
      const m = mining(b);
      if (m.hardness < 0 || m.hardness >= 50) continue;
      g.spill(bx, by, bz);
      w.setBlock(bx, by, bz, B.Air);
      if (this.rng() < 0.3) g.spawnBreakParticles([bx, by, bz], b, 4);
    }
    g.spawnEmbers([x, y, z], 40, [2, 1.2, 0.5]);
    g.flash = Math.max(g.flash, 0.6);
    g.audio.explosion();
    const pp = g.player.body.pos, pd = Math.hypot(pp[0] - x, pp[1] + 1 - y, pp[2] - z);
    if (pd < r * 2.5 && !g.creative) {
      const k = 1 - pd / (r * 2.5);
      g.stats.damage(Math.round((power * 7 + 1) * k * k + 1), source ? source.type : 'explosion');   // a creeper point-blank: about 22, like Minecraft
      const l = pd || 1; g.player.body.vel[0] += (pp[0] - x) / l * 10 * k; g.player.body.vel[2] += (pp[2] - z) / l * 10 * k; g.player.body.vel[1] += 6 * k;
    }
    for (const m of this.list) {
      if (m === source || m.dead) continue;
      const d = Math.hypot(m.body.pos[0] - x, m.body.pos[1] - y, m.body.pos[2] - z);
      if (d < r * 2) this.hurt(m, (power * 8) * (1 - d / (r * 2)), null);
    }
  }
}

function rayBox(o, d, mn, mx) {
  let t0 = 0, t1 = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-8) { if (o[a] < mn[a] || o[a] > mx[a]) return null; continue; }
    let ta = (mn[a] - o[a]) / d[a], tb = (mx[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const lerpAngle = (a, b, k) => a + wrap(b - a) * k;
const clampAngle = (a, m) => Math.max(-m, Math.min(m, wrap(a)));
