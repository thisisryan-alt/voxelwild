// The Starting Reef: nursery (tutorial), coral garden, kelp hollow, and Grumbold's arena.
import { ZoneBuilder } from '../world/zonebuilder.js';
import { T } from '../world/tiles.js';

const REEF_DECOR = { floor: [['seaweed', 5, 3], ['brain', 2, 3], ['branch', 2, 4], ['rocks', 1.2, 2], ['pebbles', 1.5, 2], ['shell', 0.8, 3], ['fan', 1, 3], ['anemone', 0.8, 3], ['kelp', 1, 3]], ceil: [['stalactite', 1, 3]] };

export function reef_nursery() {
  const b = new ZoneBuilder({ id: 'reef_nursery', name: 'Shoreline Nursery', biome: 'reef', w: 100, h: 38, seed: 11, music: 'reef' });
  const floor = (x) => 30 + Math.round(Math.sin(x * 0.11) * 1.2 + Math.sin(x * 0.043) * 1.5);
  b.fill(T.ROCK).carve(2, 4, 96, 33);
  b.seabed(2, 98, floor); b.ceiling(2, 98, (x) => 5 + Math.round(Math.sin(x * 0.3) * 0.9 + (x > 60 && x < 74 ? -1 : 0)));
  // rock shelf and step-ups
  b.rect(34, 27, 4, 8, T.ROCK); b.rect(38, 28, 3, 8, T.ROCK);       // 2-step rock
  b.platform(50, 24, 6); b.platform(58, 21, 5); b.platform(66, 18, 5);   // coral shelf stair up to a ledge
  b.rect(70, 14, 8, 2, T.ROCK); b.rect(72, 12, 4, 2, T.ROCK);       // sunlit ledge up top (chest)
  b.rect(62, 31, 12, 8, T.ROCK); b.carve(63, 32, 10, 6);            // dip
  b.mound(14, 31, 5, 2.2, T.GROUND);
  // left wall rock with a one-tile crevice (small forms only) leading to a hidden pocket
  b.rect(2, 4, 8, 33, T.ROCK); b.carve(2, 28, 1, 1);
  b.rect(10, 27, 4, 4, T.ROCK); b.carve(2, 31, 12, 1); b.carve(3, 29, 4, 3);   // pocket behind the first rock
  b.carve(7, 30, 7, 1);
  b.surface(T.GROUND, 2); b.smooth(1);
  // re-open the crevice after smoothing so it survives
  b.carve(4, 30, 10, 1); b.carve(3, 28, 4, 3);
  b.keep(2, 26, 12, 8);
  b.entryFloor('start', 18, { facing: 1 });
  b.shrine('rest', 22);
  b.exitE(24, 31, 'reef_garden', 'west'); b.entryFloor('east', 94, { facing: -1 });
  // content
  b.npc('old_brine', 26, { facing: -1 });
  b.sign(14, 'A / D  scuttle    SPACE  paddle up    J  claw    L  dash\nK  heavy    SHIFT  tuck (block)    E  talk / use    TAB  menu', { speaker: 'Tideworn Marker' });
  b.spawnFloor('minnow', 30, 0, { count: 3 }); b.spawnFloor('pinchling', 44, 0, { p: { range: 40 } });
  b.spawn('minnow', 56, 18, { count: 4 }); b.spawnFloor('pinchling', 61, 0, { p: { range: 30 } }); b.spawnFloor('urchin', 66, 0);
  b.spawn('minnow', 82, 22, { count: 3 }); b.spawnFloor('pinchling', 85, 0);
  b.coins(26, 29, 4); b.coins(53, 21, 3); b.coins(60, 18, 3); b.coins(68, 15, 3); b.coins(80, 27, 4);
  b.chest(74, { coins: [25, 40], items: { kelp_wrap: 1 } }, { from: 5 });
  b.chest(5, { coins: [10, 18], items: { brine_tonic: 1 }, ep: 1 }, { from: 27, key: 'crab_hollow' });   // behind the crevice
  b.mural(8, 'mural_nursery', { from: 27 });
  b.decorate(REEF_DECOR, 0.3);
  return b.finish();
}

export function reef_garden() {
  const b = new ZoneBuilder({ id: 'reef_garden', name: 'Coral Garden', biome: 'reef', w: 120, h: 46, seed: 12, music: 'reef' });
  b.fill(T.ROCK).carve(2, 4, 116, 39);
  const floor = (x) => 36 + Math.round(Math.sin(x * 0.09) * 2 + Math.sin(x * 0.2) * 0.8);
  b.seabed(2, 118, floor); b.ceiling(2, 118, (x) => 6 + Math.round(Math.sin(x * 0.2) * 1.2));
  // coral terraces
  b.rect(20, 30, 10, 12, T.CORAL); b.rect(36, 26, 8, 20, T.CORAL); b.platform(46, 28, 5); b.platform(54, 23, 5); b.platform(62, 18, 6);
  b.rect(70, 22, 12, 24, T.ROCK); b.rect(72, 20, 8, 2, T.ROCK);
  // cracked wall hiding a vault (needs the Warrior's heavy strike)
  b.rect(100, 24, 12, 22, T.ROCK); b.carve(103, 26, 7, 12); b.breakable(100, 36, 3, 2);
  b.rect(88, 14, 10, 2, T.ROCK); b.platform(86, 30, 4); b.platform(92, 25, 4);
  // little hall above the first ceiling dip: market alcove
  b.rect(8, 10, 14, 2, T.ROCK); b.carve(10, 12, 10, 6); b.rect(8, 12, 2, 7, T.ROCK); b.rect(20, 12, 2, 7, T.ROCK); b.carve(14, 10, 2, 2);
  b.surface(T.GROUND, 2); b.smooth(1); b.carve(104, 30, 5, 6);
  b.exitW(32, 38, 'reef_nursery', 'east'); b.entryFloor('west', 4, { facing: 1 });
  b.exitE(34, 40, 'reef_hollow', 'west'); b.entryFloor('east', 114, { facing: -1 });
  b.shrine('rest', 10, { from: 12 });
  b.npc('cowrie', 15, { from: 12 }); b.npc('pip', 52, { from: 20 });
  b.spawnFloor('pinchling', 28, 0); b.spawnFloor('hermit', 40, 0); b.spawn('minnow', 48, 22, { count: 5 }); b.spawnFloor('urchin', 58, 0); b.spawnFloor('urchin', 60, 0);
  b.spawnFloor('pinchling', 76, 0, { count: 2, spread: 24 }); b.spawn('minnow', 92, 18, { count: 4 }); b.spawnFloor('hermit', 96, 0);
  b.coins(22, 28, 5); b.coins(56, 20, 3); b.coins(64, 15, 3); b.coins(90, 11, 4);
  b.chest(74, { coins: [30, 50], black_pearl: 0, pearl: 2 }, { from: 16 });
  b.chest(106, { item: 'mut_barbed' }, { from: 26, tint: 1, key: 'garden_vault' });
  b.mural(24, 'mural_garden', { from: 20 });
  b.decorate(REEF_DECOR, 0.3);
  return b.finish();
}
