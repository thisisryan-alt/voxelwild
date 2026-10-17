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
