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
