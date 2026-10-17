// The Ship Graveyard: wreck shallows, the galleon's decks, and the captain's bridge.
import { ZoneBuilder } from '../world/zonebuilder.js';
import { T } from '../world/tiles.js';

const GRAVE_DECOR = { floor: [['bones', 2, 1], ['barrel', 1.5, 1], ['anchor', 0.6, 1], ['rocks', 1.5, 2], ['seaweed', 1.5, 3], ['branch', 0.8, 4], ['ribs', 0.3, 1]], ceil: [['chainhang', 2, 3], ['stalactite', 1, 3]] };

// a wooden hull: solid keel + planks with an interior cabin carved out and deck platforms
function hull(b, x, y, w, h, deckRows) {
  b.rect(x, y, w, h, T.WOOD);
  b.carve(x + 2, y + 2, w - 4, h - 3);
  b.carve(x, y + h - 5, 3, 4); b.carve(x + w - 3, y + h - 5, 3, 4); b.carve(x + Math.floor(w / 2) - 2, y, 5, 3);
  for (const r of deckRows) { b.rect(x + 2, y + r, w - 4, 1, T.WOOD); b.carve(x + 5, y + r, 3, 1); b.carve(x + w - 9, y + r, 3, 1); }
}

export function grave_shallows() {
  const b = new ZoneBuilder({ id: 'grave_shallows', name: 'Wreck Shallows', biome: 'graveyard', w: 120, h: 52, seed: 41, music: 'graveyard' });
  b.fill(T.ROCK).carve(2, 4, 116, 44);
  b.seabed(2, 118, (x) => 44 + Math.round(Math.sin(x * 0.09) * 1.5)); b.ceiling(2, 118, (x) => 5 + Math.round(Math.sin(x * 0.2)));
  // three wrecks with navigable interiors
  hull(b, 12, 32, 28, 12, [5]); b.rect(10, 28, 4, 8, T.WOOD); b.carve(11, 30, 2, 5);
  hull(b, 52, 30, 30, 14, [5, 9]); b.rect(60, 18, 2, 12, T.WOOD); b.rect(58, 18, 6, 1, T.WOOD);
  hull(b, 92, 33, 24, 11, [5]); b.rect(100, 22, 2, 11, T.WOOD);
  b.platform(44, 30, 6); b.platform(86, 26, 6); b.rect(26, 20, 10, 2, T.ROCK); b.rect(70, 12, 10, 2, T.ROCK);
  b.surface(T.GROUND, 1); b.smooth(1);
  hull(b, 12, 32, 28, 12, [5]); hull(b, 52, 30, 30, 14, [5, 9]); hull(b, 92, 33, 24, 11, [5]);
  b.exitN(18, 26, 'kingdom_court', 'south'); b.entry('north', 22, 8); b.carve(18, 0, 9, 8);
  b.exitW(38, 43, 'grave_galleon', 'east'); b.entryFloor('west', 4, { facing: 1, from: 30 });
  b.entryFloor('east', 114, { facing: -1, from: 30 });
  b.shrine('rest', 46, { from: 20 });
  b.npc('inkwell', 24, { from: 33 }); b.npc('hobb', 70, { from: 31 });
  b.spawn('ghostsailor', 30, 38, { count: 2, spread: 24 }); b.spawn('ghostsailor', 70, 26); b.spawn('ghostsailor', 104, 38); b.spawn('barracuda', 46, 22); b.spawn('barracuda', 90, 18); b.spawn('barracuda', 20, 20);
  b.spawnFloor('cannon', 36, 30); b.spawnFloor('cannon', 78, 30); b.spawnFloor('ironturtle', 46, 36); b.spawnFloor('ironturtle', 106, 36); b.spawnFloor('mimic', 62, 31, { unique: false });
  b.coins(16, 36, 4); b.coins(56, 34, 4); b.coins(96, 36, 4); b.coins(30, 16, 5);
  b.chest(34, { coins: [60, 90], items: { brine_tonic: 2 } }, { from: 33 }); b.chest(112, { item: 'shell_ironhull' }, { from: 40, tint: 1, secret: false }); b.chest(74, { black_pearl: 1, coins: [40, 60] }, { from: 12 });
  b.itemAt(14, 40, 'crew_token'); b.itemAt(61, 20, 'crew_token'); b.itemAt(100, 24, 'crew_token');
  b.mural(60, 'mural_graveyard', { from: 31 });
  b.decorate(GRAVE_DECOR, 0.22);
  return b.finish();
}

export function grave_galleon() {
  const b = new ZoneBuilder({ id: 'grave_galleon', name: 'The Gannet', biome: 'graveyard', w: 128, h: 64, seed: 42, music: 'graveyard' });
  b.fill(T.ROCK);
  // the great hull: four decks, connected by hatches and a stern gallery
  b.rect(10, 8, 108, 52, T.WOOD); b.carve(14, 10, 100, 48);
  for (const [r, h1, h2] of [[22, 30, 40], [34, 70, 84], [46, 20, 30]]) { b.rect(14, r, 100, 2, T.WOOD); b.carve(h1, r, 6, 2); b.carve(h2, r, 6, 2); }
  b.rect(58, 10, 4, 10, T.WOOD); b.rect(96, 36, 4, 10, T.WOOD); b.rect(36, 24, 4, 10, T.WOOD); b.rect(60, 48, 4, 10, T.WOOD);
  b.rect(26, 2, 2, 8, T.WOOD); b.carve(26, 8, 2, 2); b.rect(70, 2, 2, 8, T.WOOD);
  b.rect(20, 56, 90, 4, T.WOOD);
  // cracked hull plank hiding the hold's stash
  b.breakable(112, 50, 2, 4);
  // open sea at the bow (west) and stern (east)
  b.carve(2, 40, 12, 12); b.carve(114, 40, 12, 12);
  b.smooth(1);
  b.exitE(42, 49, 'grave_shallows', 'west'); b.entryFloor('east', 120, { facing: -1, from: 38 });
  b.exitW(42, 49, 'grave_captain', 'east'); b.entryFloor('west', 4, { facing: 1, from: 38 });
  b.shrine('rest', 76, { from: 12 });
  b.spawn('ghostsailor', 40, 14, { count: 2 }); b.spawn('ghostsailor', 80, 28); b.spawn('ghostsailor', 50, 40, { count: 2 }); b.spawn('ghostsailor', 100, 50); b.spawn('barracuda', 90, 16);
  b.spawnFloor('cannon', 22, 12); b.spawnFloor('cannon', 104, 12); b.spawnFloor('cannon', 24, 24); b.spawnFloor('cannon', 100, 36); b.spawnFloor('ironturtle', 70, 26); b.spawnFloor('ironturtle', 40, 48); b.spawnFloor('mimic', 90, 24); b.spawnFloor('mimic', 74, 50);
  b.coins(20, 20, 5); b.coins(80, 32, 5); b.coins(30, 44, 5); b.coins(94, 56, 4);
  b.chest(16, { coins: [80, 120], black_pearl: 1 }, { from: 12 }); b.chest(46, { item: 'charm_tideglass' }, { from: 24 }); b.chest(102, { item: 'stolen_regalia' }, { from: 36, tint: 1, key: 'regalia_chest' }); b.chest(118, { item: 'mp4', coins: [50, 80] }, { from: 48, tint: 1, secret: true, key: 'mp4_chest' });
  b.itemAt(30, 30, 'crew_token');
  b.mural(32, 'wreck_log', { from: 12 }); b.mural(112, 'inkwell_deal', { from: 12, v: 1 });
  b.decorate(GRAVE_DECOR, 0.1);
  return b.finish();
}

export function grave_captain() {
  const b = new ZoneBuilder({ id: 'grave_captain', name: "Captain's Bridge", biome: 'graveyard', w: 96, h: 44, seed: 43, music: 'graveyard', title: "Captain's Bridge" });
  b.fill(T.ROCK).carve(2, 20, 12, 12); b.carve(14, 6, 70, 30);
  b.rect(2, 32, 92, 12, T.WOOD);               // the deck
  b.surface(T.WOOD, 1); 
  b.rect(30, 24, 3, 8, T.WOOD); b.rect(60, 24, 3, 8, T.WOOD); b.platform(34, 24, 8); b.platform(48, 20, 8); b.platform(20, 20, 6); b.platform(66, 20, 8);
  b.carve(84, 24, 10, 8); b.carve(88, 32, 6, 12);
  b.carve(2, 14, 12, 6); b.rect(2, 20, 12, 1, T.WOOD);
  b.exitE(22, 31, 'grave_galleon', 'west'); b.entryFloor('east', 91, { facing: -1, from: 18 }); 
  b.exitS(89, 92, 'abyss_descent', 'north'); b.entry('south', 90, 40);
  b.shrine('molt_deep', 8, { kind: 'molt', from: 14 });
  b.spawns.push({ boss: 'captain_rust', x: 48 * 16, y: 24 * 16, arena: { x: 14, y: 6, w: 70, h: 32 }, trigger: { x: 20, y: 8, w: 60, h: 28 }, barriers: [{ x: 13, y: 24, w: 1, h: 8 }, { x: 84, y: 24, w: 1, h: 8 }] });
  b.decorate({ floor: [['barrel', 2, 1], ['anchor', 0.5, 1], ['bones', 1, 1]], ceil: [['chainhang', 3, 3]] }, 0.1);
  return b.finish();
}
