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
  b.mound(30, 31, 4, 1.8, T.GROUND);
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
  b.chest(5, { coins: [10, 18], item: 'mp1', ep: 1 }, { from: 27, key: 'crab_hollow' });   // behind the crevice
  b.mural(8, 'mural_nursery', { from: 27 });
  b.decorate(REEF_DECOR, 0.3);
  return b.finish();
}

export function reef_garden() {
  const b = new ZoneBuilder({ id: 'reef_garden', name: 'Coral Garden', biome: 'reef', w: 120, h: 46, seed: 12, music: 'reef' });
  b.fill(T.ROCK).carve(2, 5, 116, 36);
  const floor = (x) => 37 + Math.round(Math.sin(x * 0.08) * 1.3 + Math.sin(x * 0.19) * 0.6);
  b.seabed(2, 118, floor); b.ceiling(2, 118, (x) => 6 + Math.round(Math.sin(x * 0.2) * 1.2));
  // coral terraces (short, climbable) and a platform stair to a sunlit ledge
  b.ellipse(30, 38, 5, 4, T.CORAL); b.ellipse(41, 38, 6, 5, T.CORAL);
  b.platform(46, 33, 4); b.platform(52, 30, 4); b.platform(58, 27, 4); b.rect(62, 26, 12, 2, T.ROCK); b.rect(66, 24, 4, 2, T.ROCK);
  b.rect(78, 34, 4, 4, T.ROCK);
  // vault: a rock mass over the passage, its west face cracked (heavy strike). Platforms let small crabs reach the wall.
  b.rect(94, 20, 17, 14, T.ROCK); b.carve(99, 24, 7, 6); b.breakable(94, 28, 2, 2);
  b.platform(86, 33, 4); b.platform(89, 30, 4);
  b.surface(T.GROUND, 1); b.smooth(1); b.carve(99, 24, 7, 6); b.breakable(94, 28, 2, 2); b.keep(93, 20, 19, 12);
  b.exitW(33, 39, 'reef_nursery', 'east'); b.entryFloor('west', 4, { facing: 1 });
  b.exitE(33, 39, 'reef_hollow', 'west'); b.entryFloor('east', 114, { facing: -1 });
  b.shrine('rest', 17, { from: 10 });
  b.npc('cowrie', 11, { from: 10 }); b.npc('pip', 49, { from: 10 });
  b.spawnFloor('pinchling', 28, 10); b.spawnFloor('hermit', 38, 10); b.spawn('minnow', 46, 26, { count: 5 }); b.spawnFloor('urchin', 55, 10); b.spawnFloor('urchin', 57, 10);
  b.spawnFloor('pinchling', 74, 10, { count: 2, spread: 24 }); b.spawn('minnow', 90, 26, { count: 4 }); b.spawnFloor('hermit', 108, 10);
  b.coins(23, 33, 5); b.coins(58, 24, 3); b.coins(66, 20, 3); b.coins(84, 30, 4);
  b.chest(69, { coins: [30, 50], pearl: 2 }, { from: 8 });
  b.exit(104, 24, 2, 6, 'reef_clam', 'west'); b.entry('clam', 100, 29);
  b.mural(25, 'mural_garden', { from: 10 });
  b.decorate(REEF_DECOR, 0.3);
  return b.finish();
}

export function reef_hollow() {
  const b = new ZoneBuilder({ id: 'reef_hollow', name: 'Kelp Hollow', biome: 'reef', w: 100, h: 44, seed: 13, music: 'reef' });
  b.fill(T.ROCK);
  // main route west -> east through chambers, with a shaft up to the canopy ledge
  b.path([[2, 31], [10, 30], [20, 29], [28, 31], [38, 34], [48, 31], [56, 28], [64, 24]], [3.2, 4.2], { wobble: 1.1 });
  b.ellipse(22, 28, 9, 6); b.ellipse(48, 29, 10, 7); b.ellipse(78, 28, 9, 6.5);
  b.path([[62, 26], [66, 18], [68, 12], [74, 10]], 3.4, { wobble: 0.8 });          // shaft up
  b.ellipse(78, 10, 8, 5);
  b.path([[78, 12], [80, 20], [80, 26], [86, 31], [97, 32]], 3.4, { wobble: 0.9 }); // back down to the exit
  b.path([[74, 10], [60, 8], [50, 9]], 2.6, { wobble: 0.6 });                        // canopy passage west
  b.ellipse(46, 9, 6, 4);
  // flat-ish floors so the crab can walk
  b.floorLine(4, 16, 32); b.floorLine(16, 30, 32); b.platform(30, 26, 5); b.platform(38, 22, 4);
  b.platform(54, 20, 4); b.platform(62, 16, 4);
  b.smooth(1); b.surface(T.GROUND, 2);
  // crevice pocket (1 tile tall) under chamber A: only the small forms fit
  b.carve(6, 36, 14, 1); b.carve(3, 35, 4, 3); b.keep(2, 34, 20, 5);
  // secret vault behind cracked stone near the top-right chamber
  b.carve(86, 6, 8, 5); b.breakable(84, 9, 2, 2); b.keep(84, 5, 12, 7);
  b.exitW(28, 33, 'reef_garden', 'east'); b.entryFloor('west', 5, { facing: 1 });
  b.exitE(30, 34, 'reef_arena', 'west'); b.entryFloor('east', 94, { facing: -1 });
  b.shrine('rest', 50, { from: 24 });
  b.spawnFloor('pinchling', 18, 20); b.spawnFloor('pinchling', 24, 20); b.spawn('minnow', 30, 24, { count: 4 }); b.spawnFloor('urchin', 34, 26);
  b.spawnFloor('hermit', 44, 22); b.spawn('minnow', 56, 18, { count: 3 }); b.spawnFloor('pinchling', 76, 18, { count: 2, spread: 22 }); b.spawnFloor('urchin', 70, 20); b.spawnFloor('hermit', 82, 20);
  b.coins(20, 27, 5); b.coins(56, 18, 3); b.coins(66, 9, 4); b.coins(48, 8, 3);
  b.chest(5, { item: 'spiral_shell' }, { from: 34, key: 'spiral_shell_chest' });
  b.chest(90, { pearl: 3, coins: [30, 40] }, { from: 6, tint: 1, secret: true });
  b.chest(78, { item: 'shell_driftwood', coins: [20, 30] }, { from: 6 });
  b.mural(30, 'mural_hollow', { from: 24 });
  b.sign(8, 'Tessa the hermit-child says: the spiral shell is in the little hole under the first cavern. You have to be small. (Dash is useful here.)', { from: 28 });
  b.decorate(REEF_DECOR, 0.3);
  return b.finish();
}

export function reef_arena() {
  const b = new ZoneBuilder({ id: 'reef_arena', name: "Grumbold's Den", biome: 'reef', w: 70, h: 30, seed: 14, music: 'reef', title: "Grumbold's Den" });
  b.fill(T.ROCK);
  b.carve(3, 17, 9, 5); b.carve(12, 6, 40, 16); b.carve(52, 17, 15, 5);
  b.floorLine(2, 68, 22, T.ROCK); b.rect(2, 22, 66, 8, T.ROCK);
  // a few pillars and ledges for the fight
  b.rect(20, 17, 3, 5, T.ROCK); b.rect(41, 17, 3, 5, T.ROCK); b.platform(26, 15, 6); b.platform(34, 12, 6);
  b.ceiling(12, 52, (x) => 6 + (x % 7 === 0 ? 1 : 0));
  b.surface(T.GROUND, 2);
  b.exitW(18, 21, 'reef_hollow', 'east'); b.entryFloor('west', 5, { facing: 1 });
  b.exitE(18, 21, 'forest_edge', 'west'); b.entryFloor('east', 64, { facing: -1 });
  b.shrine('molt_reef', 58, { kind: 'molt' });
  b.props.push({ type: 'sign', x: 8 * 16, y: 22 * 16 - 9, text: 'Claw-marks everywhere. Something big lives here. (Save at the shrine in the Hollow first.)', speaker: 'Warning' });
  b.spawns.push({ boss: 'grumbold', floor: true, x: 40 * 16, y: 22 * 16, arena: { x: 12, y: 6, w: 40, h: 18 }, trigger: { x: 15, y: 8, w: 34, h: 13 }, barriers: [{ x: 11, y: 17, w: 1, h: 5 }, { x: 52, y: 17, w: 1, h: 5 }] });
  b.coins(60, 20, 4);
  b.decorate({ floor: [['rocks', 3, 2], ['pebbles', 3, 2], ['seaweed', 1, 3], ['bones', 1, 1]], ceil: [['stalactite', 2, 3]] }, 0.25);
  return b.finish();
}

export function reef_clam() {
  const b = new ZoneBuilder({ id: 'reef_clam', name: 'Pearl Hollow', biome: 'reef', w: 56, h: 30, seed: 15, music: 'reef', title: 'Pearl Hollow' });
  b.fill(T.ROCK).carve(3, 18, 8, 6); b.carve(10, 6, 40, 18);
  b.floorLine(2, 54, 24, T.ROCK); b.rect(2, 24, 52, 6, T.ROCK);
  b.platform(20, 18, 6); b.platform(34, 14, 6);
  b.surface(T.GROUND, 1);
  b.exitW(18, 23, 'reef_garden', 'clam'); b.entryFloor('west', 5, { facing: 1, from: 8 });
  b.spawns.push({ boss: 'pearl_tyrant', floor: true, x: 36 * 16, y: 24 * 16, arena: { x: 10, y: 6, w: 40, h: 20 }, trigger: { x: 14, y: 8, w: 32, h: 16 }, barriers: [{ x: 9, y: 18, w: 1, h: 6 }] });
  b.coins(16, 22, 5);
  b.decorate({ floor: [['brain', 2, 3], ['shell', 3, 3], ['pebbles', 2, 2], ['fan', 1, 3]], ceil: [['stalactite', 2, 3]] }, 0.25);
  return b.finish();
}
