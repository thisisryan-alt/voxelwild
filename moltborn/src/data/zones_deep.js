// The Abyss, the Trench of the Forgotten and Poseidon's Domain.
import { ZoneBuilder } from '../world/zonebuilder.js';
import { T } from '../world/tiles.js';

const ABYSS_DECOR = { floor: [['glowcap', 3, 1], ['crystal', 1.2, 3], ['bones', 1, 1], ['rocks', 1, 2], ['anemone', 1, 3], ['kelp', 0.6, 3]], ceil: [['stalactite', 3, 3], ['vine', 0.6, 3]] };
const TRENCH_DECOR = { floor: [['bones', 3, 1], ['ribs', 1, 1], ['crystal', 0.5, 3], ['rocks', 1.5, 2], ['branch', 0.6, 4]], ceil: [['stalactite', 3, 3], ['chainhang', 1.2, 3]] };
const DOMAIN_DECOR = { floor: [['pillar', 1, 3], ['statue', 0.5, 1], ['fan', 1, 3], ['branch', 0.8, 4], ['crystal', 0.6, 3]], ceil: [['chainhang', 1, 3], ['stalactite', 0.4, 3]] };

// ------------------------------------------------------------------------------------------------- ABYSS
export function abyss_descent() {
  const b = new ZoneBuilder({ id: 'abyss_descent', name: 'Twilight Descent', biome: 'abyss', w: 90, h: 100, seed: 51, music: 'abyss', pressure: 2 });
  b.fill(T.ROCK);
  b.path([[24, 3], [28, 14], [20, 28], [32, 42], [26, 56], [38, 70], [30, 84], [40, 94], [3, 94]], [4, 6], { wobble: 1.6 });
  b.ellipse(28, 12, 9, 8); b.ellipse(22, 30, 10, 8); b.ellipse(34, 46, 10, 8); b.ellipse(26, 62, 10, 8); b.ellipse(38, 76, 11, 9); b.ellipse(32, 90, 9, 6);
  // side caves: the Lantern Folk's hamlet and a deep pocket that needs Pressure Lung
  b.path([[22, 30], [44, 32], [60, 30], [72, 28]], 3.2, { wobble: 0.8 }); b.ellipse(72, 28, 8, 6);
  b.path([[34, 46], [52, 50], [64, 58], [70, 70]], 3.4, { wobble: 0.9 }); b.ellipse(72, 74, 8, 7);
  b.path([[28, 62], [12, 66], [10, 76]], 3, { wobble: 0.6 }); b.ellipse(10, 80, 6, 6);
  b.surface(T.GROUND, 1); b.smooth(1);
  b.area('pressure', 3, 74, 16, 14, { level: 4 });
  b.exitN(22, 27, 'grave_captain', 'south'); b.entry('north', 24, 6); b.carve(21, 0, 8, 8);
  b.exitW(92, 96, 'abyss_lanterns', 'east'); b.entryFloor('west', 4, { facing: 1, from: 80 });
  b.shrine('rest', 26, { from: 14 }); b.shrine('rest2', 38, { from: 74 });
  b.npc('glimmer', 22, { from: 14 });
  b.spawn('lanternfish', 26, 22, { count: 2, spread: 24 }); b.spawn('deepjelly', 30, 40); b.spawn('deepjelly', 24, 56); b.spawn('lanternfish', 38, 70, { count: 2, spread: 20 }); b.spawn('inksquid', 30, 84); b.spawn('voidwisp', 44, 32); b.spawn('voidwisp', 60, 56);
  b.spawn('gulper', 50, 32); b.spawn('inksquid', 70, 28); b.spawn('lanternfish', 72, 70);
  b.coins(28, 20, 4); b.coins(36, 44, 5); b.coins(30, 60, 5); b.coins(60, 30, 4); b.coins(66, 64, 4);
  b.chest(72, { item: 'mut_glowskin', coins: [60, 80] }, { from: 20 }); b.chest(74, { black_pearl: 2, coins: [80, 100] }, { from: 66, tint: 1 });
  b.chest(10, { item: 'mp5', coins: [60, 90] }, { from: 74, tint: 1, secret: true, key: 'mp5_chest' });
  b.itemAt(70, 26, 'lantern_stone');
  b.mural(20, 'mural_abyss', { from: 20 });
  b.decorate(ABYSS_DECOR, 0.2);
  return b.finish();
}

export function abyss_lanterns() {
  const b = new ZoneBuilder({ id: 'abyss_lanterns', name: 'Lantern Caverns', biome: 'abyss', w: 128, h: 60, seed: 52, music: 'abyss', pressure: 2 });
  b.fill(T.ROCK);
  b.path([[125, 52], [108, 50], [96, 44], [84, 36], [70, 32], [56, 38], [44, 44], [30, 40], [16, 34], [4, 30]], [4, 5.4], { wobble: 1.4 });
  b.ellipse(104, 48, 10, 7); b.ellipse(66, 30, 12, 8); b.ellipse(24, 38, 10, 8);
  b.path([[84, 36], [86, 24], [100, 16], [112, 14]], 3.4, { wobble: 1 }); b.ellipse(112, 14, 8, 6);
  b.path([[30, 40], [26, 50], [40, 54], [56, 52]], 3.4, { wobble: 1 }); b.ellipse(48, 54, 7, 4);
  b.path([[56, 38], [60, 22], [56, 12], [44, 8], [32, 10]], 3.2, { wobble: 0.9 }); b.ellipse(36, 10, 8, 5);
  b.surface(T.GROUND, 1); b.smooth(1);
  b.exitE(48, 54, 'abyss_descent', 'west'); b.entryFloor('east', 122, { facing: -1, from: 40 });
  b.exitW(26, 32, 'abyss_throat', 'east'); b.entryFloor('west', 4, { facing: 1, from: 20 });
  b.shrine('rest', 66, { from: 24 });
  b.prop('brazier', 112, 14, { total: 3 }); b.prop('brazier', 66, 30, { total: 3 }); b.prop('brazier', 36, 10, { total: 3 });
  b.itemAt(48, 52, 'lantern_stone'); b.itemAt(108, 12, 'lantern_stone');
  b.spawn('lanternfish', 70, 28, { count: 2 }); b.spawn('lanternfish', 24, 36); b.spawn('deepjelly', 100, 46); b.spawn('deepjelly', 46, 42); b.spawn('inksquid', 108, 18); b.spawn('inksquid', 40, 10); b.spawn('voidwisp', 84, 30, { count: 2 }); b.spawn('voidwisp', 56, 14);
  b.spawn('gulper', 90, 30); b.spawn('gulper', 20, 28); b.spawn('gulper', 56, 52);
  b.coins(100, 46, 5); b.coins(66, 28, 5); b.coins(24, 36, 5); b.coins(110, 12, 4); b.coins(44, 52, 4);
  b.chest(34, { item: 'claw_lumen' }, { from: 4, tint: 1 }); b.chest(114, { coins: [90, 130], pearl: 3 }, { from: 8 }); b.chest(56, { item: 'mut_pressure' }, { from: 44, tint: 1 });
  b.mural(60, 'abyss_whale', { from: 22 });
  b.decorate(ABYSS_DECOR, 0.2);
  return b.finish();
}

export function abyss_throat() {
  const b = new ZoneBuilder({ id: 'abyss_throat', name: 'Abyssal Throat', biome: 'abyss', w: 96, h: 56, seed: 53, music: 'abyss', pressure: 2, title: 'Abyssal Throat' });
  b.fill(T.ROCK).carve(84, 30, 10, 8); b.ellipse(46, 30, 36, 22); b.carve(12, 8, 70, 40);
  b.seabed(12, 84, (x) => 46 + Math.round(Math.sin(x * 0.12))); b.carve(84, 30, 10, 14);
  b.rect(24, 36, 6, 10, T.ROCK); b.rect(60, 34, 6, 12, T.ROCK); b.platform(34, 30, 8); b.platform(48, 24, 8); b.platform(18, 24, 6); b.platform(68, 26, 6);
  b.surface(T.GROUND, 1); b.smooth(1); b.carve(84, 30, 10, 14); 
  b.exitE(33, 44, 'abyss_lanterns', 'west'); b.entryFloor('east', 90, { facing: -1, from: 20 });
  b.exitS(40, 47, 'trench_bones', 'north'); b.carve(40, 46, 8, 10); b.entry('south', 44, 52);
  b.shrine('rest', 88, { from: 20 });
  b.spawns.push({ boss: 'lurelord', x: 30 * 16, y: 26 * 16, arena: { x: 12, y: 8, w: 72, h: 42 }, trigger: { x: 16, y: 12, w: 60, h: 34 }, barriers: [{ x: 84, y: 33, w: 1, h: 11 }, { x: 40, y: 50, w: 8, h: 1 }] });
  b.decorate({ floor: [['glowcap', 2, 1], ['bones', 2, 1], ['ribs', 0.4, 1], ['crystal', 0.6, 3]], ceil: [['stalactite', 4, 3]] }, 0.14);
  return b.finish();
}

// ------------------------------------------------------------------------------------------------- TRENCH
export function trench_bones() {
  const b = new ZoneBuilder({ id: 'trench_bones', name: 'Bone Fields', biome: 'trench', w: 120, h: 64, seed: 61, music: 'trench', pressure: 3 });
  b.fill(T.ROCK);
  b.path([[44, 3], [44, 14], [30, 24], [24, 36], [40, 46], [60, 50], [80, 44], [100, 38], [112, 44], [117, 50]], [5, 6.4], { wobble: 1.6 });
  b.ellipse(44, 12, 10, 8); b.ellipse(26, 34, 10, 8); b.ellipse(62, 48, 12, 8); b.ellipse(102, 38, 11, 8);
  b.path([[62, 48], [64, 58], [90, 58], [108, 56]], 4.2, { wobble: 1 }); b.path([[100, 38], [96, 24], [84, 18], [66, 16]], 4.2, { wobble: 1 }); b.ellipse(62, 16, 9, 6); b.ellipse(104, 56, 7, 4);
  b.path([[26, 34], [14, 38], [4, 40]], 5, { wobble: 0.5 });
  b.surface(T.GROUND, 1); b.smooth(1);
  // secret pocket below the west corridor, behind a Seal (Ancient Molt)
  b.carve(4, 50, 8, 7); b.seal(6, 46, 3, 4); b.keep(3, 44, 10, 14); b.carve(4, 50, 8, 7);
  b.exitN(40, 47, 'abyss_throat', 'south'); b.entry('north', 44, 6);
  b.carve(2, 36, 4, 9); b.lockdoor(8, 36, 2, 9, 'trench_gate_rune', { lockText: 'A door carved in the old script. The Gate Rune from the Abyss would fit here.' });
  b.exitW(37, 43, 'trench_temple', 'east'); b.entryFloor('west', 6, { facing: 1, from: 30 }); b.entryFloor('east', 112, { facing: -1, from: 30 });
  b.shrine('rest', 62, { from: 40 });
  b.spawnFloor('bonecrawler', 28, 28); b.spawnFloor('bonecrawler', 60, 40); b.spawnFloor('bonecrawler', 100, 32); b.spawn('hollowshade', 44, 14); b.spawn('hollowshade', 80, 42, { count: 2 }); b.spawn('hollowshade', 66, 16); b.spawnFloor('wardenbone', 104, 32); b.spawn('voidwisp', 26, 36); b.spawn('gulper', 90, 58);
  b.coins(44, 12, 5); b.coins(26, 32, 5); b.coins(62, 46, 6); b.coins(102, 36, 5); b.coins(100, 56, 4);
  b.chest(66, { item: 'mut_razor', coins: [100, 150] }, { from: 8, tint: 1 }); b.chest(105, { black_pearl: 2, pearl: 3 }, { from: 50 }); b.chest(6, { item: 'mp6', ep: 1 }, { from: 50, tint: 1, secret: true, key: 'mp6_chest' });
  b.mural(44, 'mural_trench1', { from: 8 });
  b.decorate(TRENCH_DECOR, 0.2);
  return b.finish();
}

export function trench_temple() {
  const b = new ZoneBuilder({ id: 'trench_temple', name: 'Temple of the Old Gods', biome: 'trench', w: 112, h: 70, seed: 62, music: 'trench', pressure: 3 });
  b.fill(T.RUIN);
  // great hypostyle hall with side chambers, built from ruin tiles
  b.carve(3, 28, 106, 14); b.carve(20, 6, 70, 24); b.carve(10, 42, 90, 20);
  for (const x of [26, 40, 56, 72, 86]) { b.pillar(x, 8, 18, 3, T.RUIN); }
  for (const x of [20, 50, 80]) { b.pillar(x, 46, 56, 3, T.RUIN); }
  b.rect(28, 54, 50, 2, T.ROCK); b.carve(40, 54, 12, 2);
  // vault with the sleeping hatchlings, behind three seals
  b.carve(2, 44, 6, 14); b.seal(8, 44, 2, 14); b.carve(2, 62, 14, 5);
  b.surface(T.RUIN, 1); b.smooth(0);
  b.exitE(30, 38, 'trench_bones', 'west'); b.entryFloor('east', 106, { facing: -1, from: 20 });
  b.exitW(30, 38, 'trench_titan', 'east'); b.entryFloor('west', 4, { facing: 1, from: 20 });
  b.shrine('rest', 60, { from: 20 });
  b.npc('thessaly', 56, { from: 20 });
  b.prop('cocoons', 4, 60, {}); b.prop('cocoons', 8, 60, {}); b.prop('cocoons', 12, 60, {});
  b.spawn('hollowshade', 30, 18, { count: 2 }); b.spawn('hollowshade', 78, 18, { count: 2 }); b.spawnFloor('wardenbone', 44, 28); b.spawnFloor('wardenbone', 84, 28); b.spawnFloor('bonecrawler', 36, 56); b.spawnFloor('bonecrawler', 70, 56); b.spawn('voidwisp', 60, 50, { count: 2 }); b.spawnFloor('guardian', 60, 46);
  b.coins(30, 16, 5); b.coins(90, 16, 5); b.coins(50, 52, 6);
  b.chest(98, { item: 'shell_tidewoven', ep: 1 }, { from: 40, tint: 1 }); b.chest(40, { black_pearl: 2, coins: [120, 160] }, { from: 46 });
  b.mural(70, 'mural_trench2', { from: 30 }); b.mural(18, 'mural_trench3', { from: 30, v: 1 }); b.mural(100, 'titan_chains', { from: 30 });
  b.decorate({ floor: [['bones', 1, 1], ['statue', 0.5, 1], ['crystal', 0.6, 3]], ceil: [['chainhang', 2, 3]] }, 0.08);
  return b.finish();
}

export function trench_titan() {
  const b = new ZoneBuilder({ id: 'trench_titan', name: "Krael's Chain", biome: 'trench', w: 110, h: 66, seed: 63, music: 'trench', pressure: 3, title: "Krael's Chain" });
  b.fill(T.ROCK).carve(100, 30, 8, 12); b.ellipse(56, 34, 44, 26); b.carve(12, 12, 90, 40);
  b.seabed(12, 102, (x) => 52); b.carve(100, 30, 8, 22);
  b.rect(30, 40, 6, 12, T.ROCK); b.rect(78, 40, 6, 12, T.ROCK); b.platform(40, 34, 10); b.platform(60, 28, 10); b.platform(22, 28, 8); b.platform(84, 30, 8);
  b.surface(T.GROUND, 1); b.smooth(1);
  b.carve(2, 36, 12, 12);
  b.exitE(32, 41, 'trench_temple', 'west'); b.entryFloor('east', 105, { facing: -1, from: 20 });
  b.exitS(54, 62, 'domain_gate', 'north'); b.carve(54, 54, 9, 12); b.entry('south', 58, 62);
  b.lockdoor(8, 42, 2, 6, null, { need: (g) => g.flag('sanctum_opened') || [1, 2, 3, 4, 5, 6, 7].every((n) => g.hasItem('mp' + n)), lockText: 'Seven shallow hollows are carved in the stone, each the size of a pearl. They are empty.', flag: 'sanctum_opened' }); b.carve(2, 42, 6, 8);
  b.exitW(44, 49, 'trench_sanctum', 'east'); b.entryFloor('west', 4, { facing: 1, from: 20 });
  b.shrine('molt_trench', 96, { kind: 'molt', from: 20 });
  b.spawns.push({ boss: 'krael', x: 28 * 16, y: 40 * 16, arena: { x: 12, y: 12, w: 90, h: 42 }, trigger: { x: 36, y: 20, w: 60, h: 32 }, barriers: [{ x: 99, y: 38, w: 1, h: 14 }, { x: 54, y: 53, w: 9, h: 1 }] });
  b.decorate({ floor: [['bones', 3, 1], ['ribs', 0.6, 1]], ceil: [['chainhang', 3, 3], ['stalactite', 2, 3]] }, 0.1);
  return b.finish();
}

export function trench_sanctum() {
  const b = new ZoneBuilder({ id: 'trench_sanctum', name: 'Undertow Sanctum', biome: 'trench', w: 70, h: 44, seed: 64, music: 'trench', pressure: 3, dark: 0.9, title: 'Undertow Sanctum' });
  b.fill(T.OBSID).ellipse(30, 22, 24, 16); b.carve(54, 22, 14, 8); b.carve(10, 16, 40, 20);
  b.floorLine(4, 66, 34, T.OBSID);
  b.surface(T.OBSID, 1);
  b.exitE(24, 32, 'trench_titan', 'west'); b.entryFloor('east', 64, { facing: -1, from: 20 });
  b.spawns.push({ boss: 'hollow_maw', x: 24 * 16, y: 20 * 16, arena: { x: 4, y: 6, w: 52, h: 28 }, trigger: { x: 12, y: 10, w: 40, h: 24 }, barriers: [{ x: 56, y: 24, w: 1, h: 9 }] });
  b.shrine('rest', 60, { from: 20 });
  b.decorate({ floor: [['crystal', 2, 3], ['bones', 1, 1]], ceil: [['stalactite', 3, 3]] }, 0.1);
  return b.finish();
}

// ------------------------------------------------------------------------------------------------- DOMAIN
export function domain_gate() {
  const b = new ZoneBuilder({ id: 'domain_gate', name: 'Gate of Tides', biome: 'domain', w: 112, h: 56, seed: 71, music: 'domain', pressure: 3 });
  b.fill(T.ROCK).carve(2, 6, 108, 44);
  b.seabed(2, 110, (x) => 48); b.ceiling(2, 110, (x) => 7);
  b.rect(30, 38, 4, 10, T.DIVINE); b.rect(78, 38, 4, 10, T.DIVINE); b.rect(26, 36, 12, 2, T.DIVINE); b.rect(74, 36, 12, 2, T.DIVINE);
  b.platform(46, 36, 10); b.platform(56, 26, 10); b.platform(40, 18, 8);
  b.rect(80, 6, 10, 9, T.DIVINE);
  // seal at the door into the Domain: the Ancient Molt's tail can break it
  b.seal(104, 38, 4, 10);
  b.surface(T.DIVINE, 1); b.smooth(1);
  b.carve(83, 8, 4, 6); b.seal(83, 14, 4, 1); b.keep(80, 6, 10, 10); b.carve(83, 8, 4, 6);
  b.exitN(54, 62, 'trench_titan', 'south'); b.carve(54, 0, 9, 9); b.entry('north', 58, 6);
  b.exitE(40, 47, 'domain_halls', 'west'); b.entryFloor('west', 4, { facing: 1, from: 20 }); b.entryFloor('east', 100, { facing: -1, from: 20 });
  b.shrine('rest', 12, { from: 20 });
  b.spawnFloor('guardian', 36, 20); b.spawnFloor('guardian', 76, 20); b.spawn('stormhorse', 50, 28, { count: 2, spread: 24 }); b.spawn('tidewisp', 90, 30); b.spawn('tidewisp', 20, 30); b.spawnFloor('tridentstatue', 64, 20); b.spawnFloor('tridentstatue', 24, 20);
  b.coins(40, 34, 5); b.coins(60, 24, 5); b.coins(90, 44, 6);
  b.chest(44, { coins: [150, 200], black_pearl: 2 }, { from: 8, tint: 1 });
  b.chest(85, { item: 'mp7', ep: 1 }, { from: 8, tint: 1, secret: true, key: 'mp7_chest' });
  b.mural(18, 'mural_domain1', { from: 20 });
  b.decorate(DOMAIN_DECOR, 0.14);
  return b.finish();
}

export function domain_halls() {
  const b = new ZoneBuilder({ id: 'domain_halls', name: 'Hall of Guardians', biome: 'domain', w: 140, h: 60, seed: 72, music: 'domain', pressure: 3, title: 'Hall of Guardians' });
  b.fill(T.DIVINE).carve(2, 12, 136, 38);
  b.floorLine(2, 138, 50, T.DIVINE); b.rect(2, 50, 136, 10, T.DIVINE);
  // gauntlet: statues, vents, spikes, currents
  for (const x of [20, 34, 48, 62]) { b.pillar(x, 12, 22, 3, T.DIVINE); }
  b.spikes(26, 49, 5); b.spikes(52, 49, 5);
  b.area('vent', 38, 30, 3, 20, { period: 4, on: 1.4, dmg: 24, phase: 0 }); b.area('vent', 56, 30, 3, 20, { period: 4, on: 1.4, dmg: 24, phase: 2 });
  b.area('current', 66, 14, 24, 36, { vx: 110, vy: 0 });
  // boss arena beyond
  b.carve(92, 8, 40, 42); b.rect(100, 36, 6, 14, T.DIVINE); b.rect(120, 36, 6, 14, T.DIVINE); b.platform(108, 30, 10); b.platform(96, 22, 8); b.platform(122, 22, 8);
  b.surface(T.DIVINE, 1);
  b.exitW(41, 49, 'domain_gate', 'east'); b.entryFloor('west', 4, { facing: 1, from: 20 });
  b.exitE(41, 49, 'domain_shrine', 'west'); b.entryFloor('east', 134, { facing: -1, from: 20 });
  b.shrine('rest', 10, { from: 20 }); b.shrine('rest2', 90, { from: 20 });
  b.spawnFloor('guardian', 28, 20); b.spawnFloor('guardian', 44, 20); b.spawn('stormhorse', 56, 30, { count: 2 }); b.spawnFloor('tridentstatue', 60, 20); b.spawnFloor('tridentstatue', 80, 20); b.spawn('tidewisp', 76, 30, { count: 2 }); b.spawnFloor('guardian', 84, 20);
  b.spawns.push({ boss: 'kyros', floor: true, x: 114 * 16, y: 50 * 16, arena: { x: 92, y: 8, w: 40, h: 44 }, trigger: { x: 98, y: 12, w: 30, h: 38 }, barriers: [{ x: 91, y: 41, w: 1, h: 9 }] });
  b.coins(16, 46, 6); b.coins(70, 30, 6);
  b.chest(14, { coins: [140, 200], items: { fury_ink: 1 } }, { from: 20 }); b.chest(84, { item: 'claw_anchor' }, { from: 20, tint: 1 });
  b.mural(30, 'mural_domain2', { from: 20 });
  b.decorate(DOMAIN_DECOR, 0.1);
  return b.finish();
}

export function domain_shrine() {
  const b = new ZoneBuilder({ id: 'domain_shrine', name: 'Apotheosis Shrine', biome: 'domain', w: 64, h: 40, seed: 73, music: 'domain', title: 'Apotheosis Shrine' });
  b.fill(T.DIVINE).carve(2, 10, 60, 26); b.floorLine(2, 62, 34, T.DIVINE); b.rect(2, 34, 60, 6, T.DIVINE);
  b.tidegate(60, 24, 2, 10);
  b.surface(T.DIVINE, 1);
  b.exitW(26, 33, 'domain_halls', 'east'); b.entryFloor('west', 4, { facing: 1, from: 14 });
  b.exitE(24, 33, 'domain_throne', 'west'); b.entryFloor('east', 56, { facing: -1, from: 14 });
  b.shrine('molt_domain', 30, { kind: 'molt', from: 12 });
  b.mural(14, 'mural_domain3', { from: 12 });
  b.decorate({ floor: [['pillar', 0.4, 3], ['crystal', 1, 3], ['fan', 1, 3]], ceil: [['chainhang', 1, 3]] }, 0.1);
  return b.finish();
}

export function domain_throne() {
  const b = new ZoneBuilder({ id: 'domain_throne', name: 'Throne of Tides', biome: 'domain', w: 120, h: 64, seed: 74, music: 'domain', title: 'Throne of Tides' });
  b.fill(T.DIVINE).carve(3, 36, 14, 12); b.carve(16, 8, 100, 48);
  b.floorLine(2, 118, 56, T.DIVINE); b.rect(2, 56, 116, 8, T.DIVINE);
  b.rect(30, 46, 6, 10, T.DIVINE); b.rect(84, 46, 6, 10, T.DIVINE);
  b.platform(40, 40, 10); b.platform(70, 40, 10); b.platform(56, 30, 10); b.platform(24, 32, 8); b.platform(90, 32, 8);
  b.surface(T.DIVINE, 1);
  b.exitW(36, 47, 'domain_shrine', 'east'); b.entryFloor('west', 6, { facing: 1, from: 30 });
  b.spawns.push({ boss: 'poseidon', x: 80 * 16, y: 30 * 16, arena: { x: 16, y: 8, w: 100, h: 52 }, trigger: { x: 26, y: 12, w: 86, h: 44 }, barriers: [{ x: 15, y: 46, w: 1, h: 10 }] });
  b.decorate({ floor: [['pillar', 0.3, 3], ['statue', 0.3, 1], ['crystal', 0.6, 3]], ceil: [['chainhang', 1, 3]] }, 0.06);
  return b.finish();
}
