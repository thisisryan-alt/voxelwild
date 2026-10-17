// Optional zones added after the main road: each hangs off an existing zone behind a cracked wall or a hidden passage and ends
// in a mini-boss arena. They reuse the same builder DSL as the main zones.
import { ZoneBuilder } from '../world/zonebuilder.js';
import { T } from '../world/tiles.js';

const TIDE_DECOR = { floor: [['anemone', 3, 3], ['seaweed', 3, 3], ['brain', 2, 3], ['fan', 2, 3], ['shell', 1.5, 3], ['pebbles', 1.5, 2], ['branch', 1.5, 4], ['rocks', 1, 2]], ceil: [['stalactite', 1, 3]] };

// ---- Sunken Tidepools (reef, off Kelp Hollow): terraced pools, menders and fumecaps, and Brun the Hermit King at the end -------------------
export function reef_tidepools() {
  const b = new ZoneBuilder({ id: 'reef_tidepools', name: 'Sunken Tidepools', biome: 'reef', w: 112, h: 40, seed: 17, music: 'reef', title: 'Sunken Tidepools' });
  b.fill(T.ROCK);
  b.carve(3, 12, 68, 22); b.carve(70, 24, 8, 8); b.carve(77, 8, 32, 26);
  // terraces step gently down to the east; the shell hall is flat for the fight
  b.floorLine(2, 14, 27); b.floorLine(14, 26, 28); b.floorLine(26, 38, 29); b.floorLine(38, 52, 30); b.floorLine(52, 77, 31); b.floorLine(77, 110, 31);
  b.platform(8, 22, 6); b.platform(18, 19, 5); b.platform(28, 22, 5); b.platform(36, 17, 6); b.platform(46, 20, 5); b.platform(56, 23, 6); b.platform(62, 18, 5);
  b.rect(14, 12, 3, 4, T.ROCK); b.rect(34, 12, 4, 3, T.ROCK); b.rect(52, 12, 3, 5, T.ROCK); b.rect(64, 12, 3, 3, T.ROCK);
  // the tide pool: a four-deep basin with a cracked wall into a hidden chamber
  b.carve(44, 30, 9, 4); b.carve(35, 31, 8, 3); b.breakable(43, 31, 1, 3); b.keep(34, 30, 20, 6);
  // Brun's hall: two perches for the fight
  b.platform(84, 22, 6); b.platform(98, 22, 6); b.rect(80, 8, 3, 4, T.ROCK); b.rect(102, 8, 3, 4, T.ROCK);
  b.surface(T.GROUND, 2);
  b.exitW(22, 26, 'reef_hollow', 'tide'); b.entryFloor('west', 5, { facing: 1 });
  b.shrine('rest', 18);
  b.npc('brack', 12); b.sign(24, 'The pools were counted every spring, once. Brack still counts them. Be polite: he is slightly deaf and extremely armed.', { speaker: 'Tideworn Marker' });
  b.mural(32, 'mural_tidepools');
  b.itemAt(22, 17, 'tide_barnacle'); b.itemAt(48, 17, 'tide_barnacle'); b.itemAt(66, 29, 'tide_barnacle');
  b.chest(38, { item: 'claw_hermit', coins: [40, 60] }, { from: 30, tint: 1, secret: true, key: 'tidepool_vault' });
  b.chest(66, { coins: [30, 50], items: { kelp_wrap: 2 } }, { from: 20 });
  b.coins(9, 20, 4); b.coins(29, 20, 4); b.coins(47, 18, 3); b.coins(63, 16, 4); b.coins(90, 20, 4);
  b.spawnFloor('pinchling', 12, 20, { count: 2, spread: 22 }); b.spawnFloor('pinchling', 30, 24); b.spawnFloor('urchin', 24, 24); b.spawn('minnow', 22, 17, { count: 4 });
  b.spawnFloor('hermit', 34, 24); b.spawnFloor('mender', 38, 24); b.spawnFloor('fumecap', 46, 24); b.spawnFloor('pinchling', 42, 24, { count: 2, spread: 22 });
  b.spawn('minnow', 50, 16, { count: 4 }); b.spawnFloor('hermit', 58, 24); b.spawnFloor('mender', 62, 24); b.spawnFloor('fumecap', 66, 24); b.spawnFloor('urchin', 54, 24);
  b.spawns.push({ boss: 'hermit_king', floor: true, x: 95 * 16, y: 31 * 16, arena: { x: 77, y: 8, w: 32, h: 24 }, trigger: { x: 82, y: 10, w: 24, h: 21 }, barriers: [{ x: 76, y: 24, w: 1, h: 7 }] });
  b.decorate(TIDE_DECOR, 0.3);
  return b.finish();
}

// ---- Glowcap Grotto (forest, off the Rootmaze): a tall dark cavern lit by toadstools, climbed on cap-shelves to the Sporemother's hall ------
const GROTTO_DECOR = { floor: [['glowcap', 5, 1], ['kelp', 2, 3], ['seaweed', 2, 3], ['rocks', 1.2, 2], ['anemone', 1, 3]], ceil: [['vine', 3, 3], ['stalactite', 2, 3]] };
export function forest_grotto() {
  const b = new ZoneBuilder({ id: 'forest_grotto', name: 'Glowcap Grotto', biome: 'forest', w: 92, h: 76, seed: 23, music: 'forest', title: 'Glowcap Grotto', dark: 0.36 });
  b.fill(T.ROCK);
  b.carve(28, 60, 36, 10); b.carve(24, 24, 44, 40);             // entry chamber and the tall cavern
  b.carve(8, 4, 76, 14);                                         // the spore hall
  b.smooth(2);
  b.floorLine(24, 68, 70); b.rect(8, 18, 76, 3, T.ROCK); b.carve(44, 18, 5, 6);   // chamber floor, hall floor, and the hole between
  b.ladder(46, 63, 26, 9, 6, 4);
  b.rect(24, 50, 9, 3, T.ROCK); b.rect(59, 43, 9, 3, T.ROCK); b.rect(24, 36, 9, 3, T.ROCK); b.rect(59, 31, 9, 3, T.ROCK);
  b.carve(69, 38, 11, 6); b.breakable(68, 40, 1, 3); b.keep(66, 36, 16, 9);     // cache behind a cracked wall off the east shelf
  b.surface(T.GROUND, 1);
  b.carve(2, 64, 24, 5); b.exitW(64, 68, 'forest_roots', 'grotto'); b.entryFloor('door', 6, { facing: 1, from: 60 });
  b.shrine('rest', 56, { from: 55 });
  b.npc('morel', 36, { from: 55 });
  b.sign(44, 'Do not eat the blue ones. Do not eat the red ones. If it glows and it is pleasant, DEFINITELY do not eat it. - Dr. M.', { from: 55, speaker: 'Field Note' });
  b.mural(52, 'mural_grotto', { from: 55 });
  b.itemAt(28, 47, 'glowcap_sample'); b.itemAt(63, 40, 'glowcap_sample'); b.itemAt(28, 33, 'glowcap_sample');
  b.chest(74, { item: 'charm_spore', coins: [50, 70] }, { from: 37, tint: 1, secret: true, key: 'grotto_cache' });
  b.chest(62, { coins: [40, 60], items: { brine_tonic: 2 } }, { from: 28 });
  b.light(46, 64, 70, '#9affc0', 0.5); b.light(30, 46, 46, '#c8ff90', 0.5); b.light(62, 38, 46, '#ff90d0', 0.5); b.light(46, 28, 56, '#9affc0', 0.5); b.light(30, 32, 40, '#ffe080', 0.4);
  b.coins(30, 46, 4); b.coins(60, 40, 4); b.coins(30, 32, 4); b.coins(62, 28, 4);
  b.spawn('splitjelly', 40, 54, { count: 1 }); b.spawn('splitjelly', 56, 48); b.spawn('splitjelly', 44, 38); b.spawn('splitjelly', 52, 30);
  b.spawnFloor('mantis', 28, 40); b.spawnFloor('fumecap', 29, 44); b.spawnFloor('mender', 31, 44); b.spawnFloor('fumecap', 63, 38); b.spawnFloor('mantis', 65, 38); b.spawnFloor('fumecap', 62, 26); b.spawnFloor('fumecap', 28, 30);
  b.spawnFloor('sporepod', 36, 55); b.spawnFloor('sporepod', 58, 55); b.spawnFloor('mender', 64, 26);
  b.spawns.push({ boss: 'sporemother', floor: true, x: 62 * 16, y: 18 * 16, arena: { x: 8, y: 3, w: 76, h: 15 }, trigger: { x: 14, y: 6, w: 64, h: 12 }, barriers: [{ x: 44, y: 18, w: 5, h: 1 }] });
  b.coins(20, 16, 4); b.coins(70, 16, 4);
  b.decorate(GROTTO_DECOR, 0.35);
  return b.finish();
}

// ---- Pearl Vaults (kingdom, under the Gate Plaza dais): the Court's strongroom. A key hunt, a hidden treasury and a brass guardian ----------
const VAULT_DECOR = { floor: [['pillar', 1.5, 3], ['fan', 2, 3], ['branch', 2, 4], ['shell', 1.5, 3], ['pebbles', 1, 2], ['statue', 0.6, 1]], ceil: [['chainhang', 2, 3], ['stalactite', 1, 3]] };
export function kingdom_vaults() {
  const b = new ZoneBuilder({ id: 'kingdom_vaults', name: 'Pearl Vaults', biome: 'kingdom', w: 124, h: 64, seed: 34, music: 'kingdom', title: 'Pearl Vaults', dark: 0.12 });
  b.fill(T.ROCK);
  b.carve(3, 28, 30, 18); b.carve(33, 36, 58, 10);               // entry hall and the long gallery
  b.carve(36, 14, 26, 14); b.carve(44, 28, 6, 8);                // key room above, with a shaft down to the gallery
  b.carve(64, 16, 15, 12);                                       // the treasury east of the key room
  b.carve(89, 38, 5, 8); b.carve(93, 16, 28, 30);                // doorway and the guardian's hall
  b.floorLine(2, 122, 46, T.RUIN); b.rect(36, 28, 26, 2, T.RUIN); b.rect(64, 28, 15, 2, T.RUIN);
  b.carve(44, 28, 6, 2);                                         // reopen the shaft through the key-room slab
  b.ladder(46, 45, 28, 3, 4, 4);
  b.platform(8, 38, 6); b.platform(20, 34, 6); b.rect(54, 36, 2, 3, T.RUIN); b.rect(72, 36, 2, 3, T.RUIN); b.rect(84, 36, 2, 3, T.RUIN);
  b.platform(98, 36, 6); b.platform(112, 36, 6); b.platform(105, 28, 6); b.rect(96, 16, 3, 4, T.RUIN); b.rect(116, 16, 3, 4, T.RUIN);
  b.breakable(62, 24, 2, 4); b.keep(60, 22, 8, 8);               // cracked wall from the key room into the treasury
  b.surface(T.GROUND, 1);
  b.exitW(40, 45, 'kingdom_gate', 'cellar'); b.entryFloor('stair', 5, { facing: 1, from: 30 });
  b.shrine('rest', 14, { from: 30 });
  b.npc('tallow', 24, { from: 30 });
  b.sign(30, 'VAULT INVENTORY - LEVEL ONE. Please do not touch the exhibits. The exhibits will touch you.', { from: 30, speaker: 'Brass Plaque' });
  b.mural(40, 'mural_vaults', { from: 36 });
  b.chest(56, { item: 'vault_key' }, { from: 14, tint: 1, key: 'vault_key_chest' });
  b.chest(68, { coins: [90, 130], items: { dye_gilded: 1 } }, { from: 16, tint: 1, secret: true, key: 'vault_treasury_a' });
  b.chest(74, { item: 'claw_trident', coins: [60, 90] }, { from: 16, tint: 1, secret: true, key: 'vault_treasury_b' });
  b.chest(76, { black_pearl: 2, items: { brine_tonic: 2 } }, { from: 16, secret: true, key: 'vault_treasury_c' });
  b.chest(28, { coins: [60, 80], items: { kelp_wrap: 2 } }, { from: 30 });
  b.lockdoor(90, 38, 2, 8, 'vault_key', { lockText: 'A brass door the height of the gallery. It wants a vault key.' });
  b.coins(12, 36, 4); b.coins(40, 42, 5); b.coins(60, 42, 4); b.coins(80, 42, 4); b.coins(40, 22, 4); b.coins(104, 26, 4);
  b.spawnFloor('tridentstatue', 48, 36); b.spawnFloor('tridentstatue', 66, 36); b.spawnFloor('tridentstatue', 82, 36);
  b.spawnFloor('spawncoral', 40, 30); b.spawnFloor('mantis', 52, 16); b.spawnFloor('mender', 58, 16); b.spawnFloor('mantis', 38, 18);
  b.spawnFloor('brineguard', 38, 36); b.spawnFloor('brineguard', 74, 36, { count: 1 }); b.spawn('archerfish', 56, 40, { count: 2, spread: 24 }); b.spawn('puffer', 70, 40);
  b.spawnFloor('hermit', 70, 20); b.spawnFloor('mender', 72, 20);
  b.spawns.push({ boss: 'brass_colossus', floor: true, x: 108 * 16, y: 46 * 16, arena: { x: 93, y: 15, w: 28, h: 31 }, trigger: { x: 98, y: 20, w: 20, h: 25 }, barriers: [{ x: 93, y: 38, w: 1, h: 8 }] });
  b.decorate(VAULT_DECOR, 0.22);
  return b.finish();
}

// ---- Ember Vents (abyss, below the Lantern Caverns): a hot descent of timed vent plumes and a river-current, ending at Magmaw's hole ------------
const VENT_DECOR = { floor: [['rocks', 3, 2], ['pebbles', 2, 2], ['bones', 1, 1], ['glowcap', 1.2, 1], ['kelp', 0.6, 3]], ceil: [['stalactite', 3, 3], ['chainhang', 0.5, 3]] };
export function abyss_vents() {
  const b = new ZoneBuilder({ id: 'abyss_vents', name: 'Ember Vents', biome: 'abyss', w: 132, h: 72, seed: 53, music: 'abyss', pressure: 2, dark: 0.42, title: 'Ember Vents' });
  b.fill(T.ROCK);
  b.path([[22, 3], [22, 12], [32, 24], [26, 36], [40, 46], [62, 52], [84, 52], [104, 54]], [3.8, 5], { wobble: 1.1 });
  b.ellipse(22, 14, 11, 8); b.ellipse(31, 26, 10, 7); b.ellipse(42, 46, 12, 8); b.ellipse(72, 52, 13, 8); b.ellipse(96, 52, 8, 6);
  b.path([[26, 36], [10, 40], [8, 52], [20, 60], [38, 62]], 3.4, { wobble: 0.9 }); b.ellipse(40, 62, 8, 5);   // a loop below for the forge
  b.carve(104, 34, 26, 30);                                                                              // Magmaw's pit
  b.floorLine(104, 130, 62, T.ROCK);
  b.smooth(1); b.surface(T.GROUND, 1);
  b.carve(104, 34, 26, 28); b.floorLine(104, 130, 62, T.ROCK); b.keep(102, 32, 30, 32);
  b.exitN(19, 25, 'abyss_lanterns', 'vents'); b.entry('north', 22, 8);
  b.shrine('rest', 22, { from: 6 }); b.shrine('rest2', 34, { from: 58 });
  b.npc('sear', 42, { from: 58 });
  b.sign(26, 'WARNING: the floor below breathes out at regular intervals. Count four. Move on three. - Sear', { from: 6, speaker: 'Scorched Plank' });
  b.mural(18, 'mural_vents', { from: 6 });
  // vents (timed plumes) and a current against the traveller
  b.area('vent', 47, 39, 3, 14, { period: 4, on: 1.4, dmg: 22, phase: 0 }); b.area('vent', 56, 45, 3, 11, { period: 4, on: 1.4, dmg: 22, phase: 1.3 });
  b.area('vent', 62, 47, 3, 10, { period: 4, on: 1.4, dmg: 22, phase: 2.6 }); b.area('vent', 84, 47, 3, 10, { period: 4, on: 1.4, dmg: 24, phase: 0.6 }); b.area('vent', 90, 48, 3, 9, { period: 4, on: 1.4, dmg: 24, phase: 2.6 });
  b.area('current', 66, 44, 16, 15, { vx: -60, vy: 0 });
  b.light(48, 52, 56, '#ff8a3a', 0.6); b.light(57, 55, 50, '#ff8a3a', 0.6); b.light(63, 56, 50, '#ff8a3a', 0.6); b.light(85, 56, 50, '#ff8a3a', 0.6); b.light(91, 56, 50, '#ff8a3a', 0.6); b.light(40, 64, 46, '#ffb060', 0.6); b.light(118, 60, 70, '#ff6a3a', 0.5);
  b.itemAt(58, 52, 'cinder_core'); b.itemAt(87, 54, 'cinder_core'); b.itemAt(99, 55, 'cinder_core');
  b.chest(36, { item: 'charm_emberglass', coins: [80, 120] }, { from: 58, tint: 1, key: 'vents_forge_chest' });
  b.chest(70, { coins: [100, 140], pearl: 3, items: { brine_tonic: 2 } }, { from: 50 });
  b.chest(100, { black_pearl: 2, coins: [90, 120] }, { from: 50, tint: 1 });
  b.coins(30, 24, 4); b.coins(44, 44, 5); b.coins(70, 50, 5); b.coins(94, 52, 4); b.coins(30, 60, 4);
  b.spawn('tuskram', 44, 42); b.spawn('hookjaw', 52, 48, { count: 1 }); b.spawn('inksquid', 30, 28); b.spawn('voidwisp', 72, 48, { count: 2 }); b.spawn('tuskram', 78, 52); b.spawn('hookjaw', 94, 50); b.spawn('gulper', 60, 52); b.spawn('deepjelly', 36, 36); b.spawn('splitjelly', 22, 20, { hpMult: 1.4 });
  b.spawnFloor('mender', 70, 48); b.spawnFloor('mantis', 74, 48); b.spawnFloor('fumecap', 88, 48);
  b.spawn('lanternfish', 20, 12);
  b.spawns.push({ boss: 'magmaw', x: 118 * 16, y: 46 * 16, arena: { x: 104, y: 34, w: 26, h: 28 }, trigger: { x: 108, y: 38, w: 18, h: 22 }, barriers: [{ x: 103, y: 47, w: 1, h: 12 }] });
  b.coins(112, 56, 5);
  b.decorate(VENT_DECOR, 0.22);
  return b.finish();
}

// ---- Moonpool Cove (reef, off the Coral Garden's west wall) -------------------------------------------------------------------------------
// A still basin lit from above. The way in only opens at night (see Clock.gate): by day the passage is a plain wall of water.
// Inside are a keeper who knows the tides, a fishing spot where the Moon Koi rises, a hidden chest and a mural.
const MOON_DECOR = {
  floor: [
    ['seaweed', 4, 3],
    ['brain', 2, 3],
    ['fan', 2, 3],
    ['shell', 1.5, 3],
    ['pebbles', 1.5, 2],
    ['anemone', 1, 3],
  ],
  ceil: [['stalactite', 1.5, 3]],
};

export function reef_moonpool() {
  const b = new ZoneBuilder({ id: 'reef_moonpool', name: 'Moonpool Cove', biome: 'reef', w: 92, h: 44, seed: 29, music: 'moonpool', title: 'Moonpool Cove', dark: 0.22 });

  // one wide chamber with a basin in the middle: the pool the moon looks into
  b.fill(T.ROCK);
  b.carve(3, 6, 86, 34);
  const floor = (x) => {
    const basin = x > 36 && x < 56 ? 4 : 0;
    return 34 + basin + Math.round(Math.sin(x * 0.13) * 1.2);
  };
  b.seabed(3, 89, floor);
  b.ceiling(3, 89, (x) => 7 + Math.round(Math.sin(x * 0.22) * 1.2));

  // terraces climb away from the basin on both sides; the east one leads to the keeper's ledge
  b.platform(8, 31, 5);
  b.platform(16, 28, 5);
  b.platform(24, 25, 5);
  b.platform(62, 31, 5);
  b.platform(70, 28, 5);
  b.platform(78, 25, 6);
  // two stone islands in the middle of the water, close enough to hop between
  b.rect(41, 26, 4, 2, T.ROCK);
  b.rect(49, 24, 4, 2, T.ROCK);

  // a cracked wall hides the cache under the western terraces
  b.carve(4, 36, 10, 3);
  b.breakable(14, 36, 1, 2);
  b.keep(3, 34, 14, 7);

  b.surface(T.GROUND, 2);
  b.smooth(1);

  // the way in is on the west wall; it is only open at night
  b.exitW(26, 30, 'reef_garden', 'moon');
  b.exits[b.exits.length - 1].cond = (g) => g.systems.clock.gate('The Moonpool is only open at night.');
  b.entryFloor('west', 5, { facing: 1, from: 24 });

  // light: a cool glow over the pool and a lamp at each terrace
  b.light(46, 22, 120, '#aab8ff', 0.9);
  b.light(12, 28, 60, '#7ae8ff', 0.6);
  b.light(80, 22, 60, '#7ae8ff', 0.6);

  b.shrine('rest', 66, { from: 20 });
  b.npc('selene', 80, { from: 20, facing: -1 });
  b.sign(28, 'The pool is deepest where the moon is brightest. Cast there.', { speaker: 'Tideworn Marker', from: 20 });
  b.mural(20, 'mural_moonpool', { from: 20 });
  // the pool itself: the fishing spot where the Moon Koi rises (see Fishing.pick)
  b.propFloor('fishspot', 40, { from: 24, boost: 'moon' });

  b.itemAt(10, 28, 'glow_spore');
  b.itemAt(72, 25, 'glow_spore');
  b.chest(8, { item: 'charm_moonpearl', coins: [40, 80] }, { from: 33, tint: 1, secret: true, key: 'moonpool_cache' });
  b.chest(86, { coins: [30, 60], pearl: 1 }, { from: 20 });
  b.coins(12, 29, 4);
  b.coins(28, 22, 3);
  b.coins(60, 28, 4);
  b.coins(74, 25, 4);

  // night creatures: wary, plentiful, nothing too large
  b.spawnFloor('pinchling', 22, 8, { count: 2, spread: 20 });
  b.spawnFloor('urchin', 30, 8);
  b.spawnFloor('hermit', 66, 8);
  b.spawnFloor('pinchling', 84, 8);
  b.spawn('minnow', 40, 20, { count: 4 });
  b.spawn('minnow', 56, 18, { count: 4 });
  b.spawn('venomjelly', 46, 16);
  b.spawn('venomjelly', 36, 24);
  b.spawn('puffer', 52, 28);

  b.decorate(MOON_DECOR, 0.3);
  return b.finish();
}
