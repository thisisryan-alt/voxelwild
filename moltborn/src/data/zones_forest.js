// The Sunken Forest: Kelp Canopy (tall vertical reef), the Rootmaze (cave labyrinth), Mangrove Heart (boss arena).
import { ZoneBuilder } from '../world/zonebuilder.js';
import { T } from '../world/tiles.js';

const FOREST_DECOR = { floor: [['kelp', 5, 3], ['seaweed', 3, 3], ['glowcap', 1.4, 1], ['rocks', 1, 2], ['anemone', 1, 3], ['branch', 0.8, 4], ['fan', 0.6, 3]], ceil: [['vine', 4, 3], ['stalactite', 1, 3]] };

export function forest_edge() {
  const b = new ZoneBuilder({ id: 'forest_edge', name: 'Kelp Canopy', biome: 'forest', w: 130, h: 66, seed: 21, music: 'forest' });
  b.fill(T.ROCK).carve(2, 4, 126, 58);
  b.seabed(2, 128, (x) => 58 + Math.round(Math.sin(x * 0.1) * 1.2)); b.ceiling(2, 128, (x) => 5 + Math.round(Math.sin(x * 0.25)));
  // root-ledge ladder climbing to the canopy
  const L = [[16, 51, 10], [30, 45, 9], [44, 39, 9], [58, 33, 10], [74, 27, 9], [90, 21, 10], [106, 15, 9]];
  for (const [x, y, w] of L) { b.rect(x, y, w, 2, T.ROCK); b.platform(x + w, y + 3, 3); }
  b.rect(110, 28, 12, 30, T.ROCK); b.rect(96, 40, 8, 4, T.ROCK); b.rect(60, 50, 6, 8, T.ROCK); b.rect(84, 48, 6, 10, T.ROCK);
  b.rect(110, 44, 3, 14, T.ROCK);
  // pockets in the walls for ambush morays and a cracked-wall vault high in the west
  b.carve(100, 33, 3, 1); b.carve(40, 28, 3, 1); b.carve(24, 40, 3, 1);
  b.rect(2, 8, 22, 18, T.ROCK); b.carve(6, 14, 12, 8); b.breakable(18, 18, 3, 2); b.rect(24, 24, 8, 2, T.ROCK); b.platform(28, 30, 5); b.platform(20, 36, 5);
  b.surface(T.GROUND, 1); b.smooth(1); b.carve(6, 14, 12, 8); b.breakable(18, 18, 3, 2); b.keep(4, 12, 20, 12);
  b.exitW(51, 57, 'reef_arena', 'east'); b.entryFloor('west', 4, { facing: 1, from: 40 });
  b.exitE(52, 57, 'forest_roots', 'west'); b.entryFloor('east', 124, { facing: -1, from: 40 });
  b.shrine('rest', 12, { from: 40 });
  b.npc('fenwick', 22, { from: 40 });
  b.spawn('venomjelly', 24, 42, { count: 2, spread: 24 }); b.spawn('venomjelly', 50, 30); b.spawn('venomjelly', 68, 22, { count: 2 }); b.spawn('venomjelly', 98, 14);
  b.spawn('piranha', 34, 52, { count: 4 }); b.spawn('piranha', 80, 40, { count: 4 }); b.spawn('piranha', 100, 52, { count: 3 });
  b.spawn('moray', 41, 28); b.spawn('moray', 25, 40); b.spawn('moray', 101, 33);
  b.spawnFloor('mossback', 36, 30); b.spawnFloor('mossback', 64, 18); b.spawnFloor('sporepod', 20, 40); b.spawnFloor('sporepod', 48, 30); b.spawnFloor('sporepod', 78, 14); b.spawnFloor('sporepod', 94, 10);
  b.spawnFloor('mossback', 118, 20);
  b.coins(22, 48, 4); b.coins(36, 42, 4); b.coins(50, 36, 4); b.coins(64, 30, 4); b.coins(80, 24, 4); b.coins(96, 18, 4); b.coins(110, 12, 5);
  b.chest(112, { coins: [50, 70], items: { kelp_wrap: 1, brine_tonic: 1 } }, { from: 5 });
  b.chest(9, { item: 'mp2', coins: [40, 60] }, { from: 14, tint: 1, secret: true, key: 'mp2_chest' });
  b.itemAt(70, 42, 'map_fragment');
  b.mural(6, 'forest_records', { from: 40 });
  b.props.push({ type: 'sign', x: 130, y: 100, text: 'The Sunken Forest. Tall things grow here, and so do tall stories. Watch the walls: they have teeth.', speaker: 'Faded Marker' });
  b.decorate(FOREST_DECOR, 0.28);
  return b.finish();
}

export function forest_roots() {
  const b = new ZoneBuilder({ id: 'forest_roots', name: 'The Rootmaze', biome: 'forest', w: 124, h: 60, seed: 22, music: 'forest' });
  b.fill(T.ROCK);
  // main route snakes east, up and over
  b.path([[2, 52], [14, 52], [26, 48], [34, 42], [30, 34], [40, 28], [54, 30], [66, 36], [78, 42], [90, 46], [104, 50], [121, 50]], [3.4, 4.2], { wobble: 1.2 });
  b.ellipse(16, 50, 9, 6); b.ellipse(50, 30, 9, 6.5); b.ellipse(84, 44, 10, 7); b.ellipse(112, 50, 8, 6);
  // upper loop with the singing bulbs
  b.path([[34, 42], [20, 36], [14, 28], [20, 18], [34, 14], [50, 14], [64, 18], [70, 28], [66, 36]], 3.2, { wobble: 1 });
  b.ellipse(22, 18, 7, 5); b.ellipse(56, 14, 8, 5); b.ellipse(14, 30, 5, 5);
  // lower detours: a map-fragment cave and a gap for a Memory-free secret
  b.path([[26, 48], [30, 56], [44, 56], [56, 54]], 2.8, { wobble: 0.7 }); b.ellipse(50, 55, 6, 3.5);
  b.path([[90, 46], [96, 38], [100, 28], [96, 20], [86, 16]], 3, { wobble: 0.9 }); b.ellipse(84, 16, 7, 5);
  b.floorLine(4, 30, 54); b.platform(36, 34, 5); b.platform(60, 24, 5); b.platform(44, 22, 4);
  b.surface(T.GROUND, 1); b.smooth(1);
  b.exitW(49, 53, 'forest_edge', 'east'); b.entryFloor('west', 5, { facing: 1, from: 40 });
  b.exitE(48, 52, 'forest_heart', 'west'); b.entryFloor('east', 118, { facing: -1, from: 40 });
  b.shrine('rest', 54, { from: 20 });
  // bulbs in the upper loop (low, high, middle)
  b.prop('bulb', 18, 18, { tone: 0 }); b.prop('bulb', 56, 12, { tone: 1 }); b.prop('bulb', 14, 29, { tone: 2 });
  b.mural(60, 'mural_forest', { from: 8 });
  b.spawn('moray', 24, 36); b.spawn('moray', 66, 34); b.spawnFloor('mossback', 20, 40); b.spawnFloor('mossback', 84, 36); b.spawnFloor('sporepod', 50, 20); b.spawnFloor('sporepod', 56, 8); b.spawnFloor('sporepod', 100, 40);
  b.spawn('venomjelly', 40, 20, { count: 2 }); b.spawn('venomjelly', 90, 32); b.spawn('piranha', 70, 38, { count: 4 }); b.spawn('piranha', 110, 46, { count: 4 }); b.spawn('piranha', 20, 48, { count: 3 });
  b.coins(12, 50, 5); b.coins(44, 28, 4); b.coins(76, 40, 5); b.coins(110, 48, 4); b.coins(30, 12, 4);
  b.chest(50, { coins: [40, 60], pearl: 1 }, { from: 40 }); b.chest(84, { item: 'claw_urchin', coins: [20, 30] }, { from: 8, tint: 1 });
  b.itemAt(48, 53, 'map_fragment'); b.itemAt(86, 14, 'map_fragment');
  b.decorate(FOREST_DECOR, 0.3);
  return b.finish();
}

export function forest_heart() {
  const b = new ZoneBuilder({ id: 'forest_heart', name: 'Mangrove Heart', biome: 'forest', w: 90, h: 56, seed: 23, music: 'forest', title: 'Mangrove Heart' });
  b.fill(T.ROCK).carve(3, 44, 10, 8);
  // great cavern: the Mother's nest
  b.ellipse(48, 28, 36, 20); b.carve(14, 8, 66, 10);
  b.seabed(14, 82, (x) => 46 + Math.round(Math.sin(x * 0.15) * 0.9)); 
  b.rect(30, 38, 6, 8, T.ROCK); b.rect(60, 36, 6, 10, T.ROCK); b.platform(40, 34, 8); b.platform(50, 28, 8); b.platform(24, 30, 6); b.platform(68, 30, 6);
  b.path([[8, 48], [20, 46]], 4, { wobble: 0.3 }); b.carve(3, 44, 14, 6);
  b.path([[48, 46], [48, 54]], 3, { wobble: 0.1 }); b.carve(44, 46, 8, 8);
  b.surface(T.GROUND, 1); b.smooth(1);
  b.carve(3, 44, 14, 6); b.carve(44, 46, 8, 9);
  b.exitW(44, 49, 'forest_roots', 'east'); b.entryFloor('west', 5, { facing: 1, from: 40 });
  b.exitS(44, 51, 'kingdom_gate', 'north'); b.entry('south', 48, 52);
  b.shrine('rest', 8, { from: 40 });
  b.props.push({ type: 'item', id: 'mp2_dummy', x: -100, y: -100 });
  b.props.pop();
  b.mural(66, 'moray_eggs', { from: 20 });
  b.spawns.push({ boss: 'mother_moray', x: 62 * 16, y: 24 * 16, arena: { x: 14, y: 6, w: 68, h: 42 }, trigger: { x: 18, y: 12, w: 60, h: 34 }, barriers: [{ x: 13, y: 44, w: 1, h: 5 }, { x: 44, y: 50, w: 8, h: 1 }] });
  b.decorate({ floor: [['kelp', 3, 3], ['glowcap', 3, 1], ['seaweed', 2, 3], ['bones', 0.5, 1]], ceil: [['vine', 5, 3]] }, 0.22);
  return b.finish();
}
