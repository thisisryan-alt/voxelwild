// The Coral Kingdom: Gate Plaza, the vertical Throne Spires and the Court of Pearls (Aurelia's arena).
import { ZoneBuilder } from '../world/zonebuilder.js';
import { T } from '../world/tiles.js';

const KING_DECOR = { floor: [['branch', 4, 4], ['brain', 2, 3], ['fan', 3, 3], ['seaweed', 1.5, 3], ['anemone', 1.5, 3], ['shell', 1, 3], ['pillar', 0.5, 3]], ceil: [['stalactite', 1, 3]] };

export function kingdom_gate() {
  const b = new ZoneBuilder({ id: 'kingdom_gate', name: 'Gate Plaza', biome: 'kingdom', w: 112, h: 52, seed: 31, music: 'kingdom' });
  b.fill(T.ROCK).carve(2, 4, 108, 44);
  b.seabed(2, 110, (x) => 42 + Math.round(Math.sin(x * 0.12) * 0.8)); b.ceiling(2, 110, (x) => 5 + Math.round(Math.sin(x * 0.3)));
  // palace steps, plaza dais and ruined arches (RUIN tiles)
  b.rect(30, 38, 14, 5, T.RUIN); b.rect(34, 34, 6, 4, T.RUIN); b.rect(62, 38, 10, 5, T.RUIN); b.rect(66, 34, 4, 4, T.RUIN);
  b.pillar(50, 22, 41, 2, T.RUIN); b.pillar(56, 22, 41, 2, T.RUIN); b.rect(50, 20, 8, 2, T.RUIN);
  b.platform(78, 34, 5); b.platform(84, 29, 5); b.platform(90, 24, 6); b.rect(96, 22, 12, 2, T.RUIN);
  b.ladder(19, 42, 6, 6, 5, 5);
  // gate to the spires: a locked door at the east end
  b.rect(106, 36, 4, 12, T.RUIN); b.carve(106, 37, 4, 5);
  b.surface(T.GROUND, 1); b.smooth(1); b.carve(106, 37, 4, 5);
  b.keep(104, 36, 8, 8);
  b.lockdoor(106, 37, 2, 5, 'brineguard_key', { lockText: "The Brineguard's postern is locked. Only Court-issue keys open it." });
  b.carve(33, 39, 8, 3); b.rect(41, 39, 3, 3, T.CRACKED); b.exit(33, 39, 4, 3, 'kingdom_vaults', 'stair'); b.entry('cellar', 39, 41); b.keep(30, 37, 15, 6);   // a stair down, hidden in the dais
  b.sign(36, 'The stone steps spiral down. A brass plaque: VAULTS - AUTHORISED PERSONNEL. (Somebody has crossed out AUTHORISED.)', { from: 39 });
  b.exitN(14, 24, 'forest_heart', 'south'); b.entry('north', 18, 8); b.carve(14, 0, 11, 8);
  b.exitE(37, 41, 'kingdom_spires', 'west'); b.entryFloor('east', 100, { facing: -1, from: 20 });
  b.shrine('rest', 26, { from: 28 }); b.propFloor('board', 32, { from: 28 });
  b.npc('vael', 46, { from: 20 }); b.npc('ruby', 60, { from: 20 }); b.npc('ostrea', 74, { from: 20 });
  b.spawnFloor('brineguard', 36, 20); b.spawnFloor('brineguard', 68, 20); b.spawn('archerfish', 40, 28); b.spawn('archerfish', 86, 22); b.spawn('puffer', 56, 30); b.spawn('puffer', 96, 20);
  b.spawnFloor('anemone_c', 20, 20); b.spawnFloor('anemone_c', 92, 20); b.spawnFloor('hermit', 100, 20);
  b.coins(14, 33, 4); b.coins(26, 24, 4); b.coins(80, 31, 4); b.coins(98, 19, 5);
  b.chest(102, { coins: [60, 90], items: { kelp_wrap: 2 } }, { from: 10 });
  b.mural(8, 'mural_kingdom', { from: 20 });
  b.mural(44, 'tithe_notice', { from: 20, v: 1 });
  b.decorate(KING_DECOR, 0.26);
  return b.finish();
}

export function kingdom_spires() {
  const b = new ZoneBuilder({ id: 'kingdom_spires', name: 'Throne Spires', biome: 'kingdom', w: 120, h: 76, seed: 32, music: 'kingdom' });
  b.fill(T.ROCK).carve(2, 4, 116, 68);
  b.seabed(2, 118, (x) => 68); b.ceiling(2, 118, () => 5);
  // three tower-cores with a zig-zag of platforms, joined by bridges
  for (const [x, top, h] of [[24, 40, 32], [58, 28, 44], [92, 16, 56]]) b.rect(x - 3, top, 6, h, T.RUIN);
  b.ladder(40, 68, 20, 9, 5, 5);    // between tower 1 and 2
  b.ladder(75, 68, 12, 9, 5, 5);    // between tower 2 and 3
  b.ladder(10, 68, 40, 6, 5, 5);
  b.platform(26, 38, 8); b.platform(60, 26, 8); b.platform(94, 14, 10);
  // the sealed archive in the middle tower
  b.carve(55, 44, 10, 8); b.lockdoor(54, 48, 1, 3, 'brineguard_key', { lockText: 'The Archive door is sealed. Court-issue key.' });
  b.rect(64, 44, 3, 8, T.RUIN); 
  b.surface(T.GROUND, 1); b.smooth(1); b.carve(55, 44, 10, 8); b.keep(52, 40, 18, 14);
  b.lockdoor(53, 48, 1, 3, 'brineguard_key', { lockText: 'The Archive door is sealed. Court-issue key.' });
  b.exitW(62, 67, 'kingdom_gate', 'east'); b.entryFloor('west', 4, { facing: 1, from: 40 });
  b.exitE(8, 13, 'kingdom_court', 'west'); b.entryFloor('east', 114, { facing: -1, from: 6 }); b.carve(100, 10, 18, 4); b.platform(100, 14, 18);
  b.shrine('rest', 10, { from: 40 });
  b.shrine('rest2', 116, { from: 6 });
  b.spawnFloor('brineguard', 20, 30); b.spawnFloor('brineguard', 100, 30); b.spawn('archerfish', 40, 50, { count: 2, spread: 24 }); b.spawn('archerfish', 76, 30, { count: 2, spread: 24 }); b.spawn('puffer', 50, 40); b.spawn('puffer', 84, 40);
  b.spawnFloor('anemone_c', 30, 20); b.spawnFloor('anemone_c', 90, 20); b.spawnFloor('hermit', 60, 20); b.spawnFloor('brineguard', 66, 20);
  b.coins(40, 62, 4); b.coins(75, 55, 4); b.coins(44, 40, 4); b.coins(78, 22, 4); b.coins(96, 12, 5);
  b.chest(60, { item: 'shell_barnacle' }, { from: 26 }); b.chest(24, { coins: [70, 100], pearl: 2 }, { from: 36 }); b.chest(96, { item: 'claw_coral', coins: [40, 60] }, { from: 12 });
  b.props.push({ type: 'item', id: 'tithe_ledger', x: 58 * 16, y: 51 * 16, secret: false });
  b.chest(62, { item: 'mp3', coins: [60, 90] }, { from: 44, tint: 1 });
  b.mural(63, 'aurelia_diary', { from: 44 });
  b.decorate(KING_DECOR, 0.2);
  return b.finish();
}

export function kingdom_court() {
  const b = new ZoneBuilder({ id: 'kingdom_court', name: 'Court of Pearls', biome: 'kingdom', w: 104, h: 46, seed: 33, music: 'kingdom', title: 'Court of Pearls' });
  b.fill(T.ROCK).carve(3, 30, 12, 8); b.carve(14, 6, 76, 34);
  b.floorLine(2, 102, 40, T.RUIN); b.rect(2, 40, 100, 6, T.RUIN);
  b.ceiling(14, 90, (x) => 6 + (x % 9 === 0 ? 2 : 0), T.RUIN);
  for (const x of [26, 40, 64, 78]) { b.pillar(x, 6, 25, 2, T.RUIN); }
  b.platform(30, 30, 8); b.platform(66, 30, 8); b.platform(46, 24, 10); b.platform(48, 34, 6);
  b.carve(88, 30, 12, 8); b.rect(90, 40, 10, 2, T.RUIN);
  b.surface(T.GROUND, 1);
  b.exitW(31, 37, 'kingdom_spires', 'east'); b.entryFloor('west', 5, { facing: 1, from: 28 });
  b.exitS(94, 98, 'grave_shallows', 'north'); b.carve(92, 38, 8, 7); b.rect(90, 44, 12, 2, T.RUIN); b.carve(94, 44, 5, 2);
  b.shrine('rest', 8, { from: 28 });
  b.entry('south', 96, 41);
  b.spawns.push({ boss: 'aurelia', x: 50 * 16, y: 24 * 16, arena: { x: 14, y: 6, w: 76, h: 36 }, trigger: { x: 22, y: 10, w: 60, h: 30 }, barriers: [{ x: 13, y: 30, w: 1, h: 8 }, { x: 90, y: 31, w: 1, h: 8 }] });
  b.decorate({ floor: [['pillar', 0.5, 3], ['statue', 0.4, 1], ['fan', 1, 3]], ceil: [['chainhang', 2, 3]] }, 0.1);
  return b.finish();
}
