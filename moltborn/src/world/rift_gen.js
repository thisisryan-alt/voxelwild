// Procedural chambers for Tidal Rifts and the Pearl Gauntlet. A zone id carries everything needed to rebuild the zone:
//   rift:<seed>:<depth>:<max>      arena:<seed>
// so the same id always yields the same cave. Chambers are broad caverns with a rolling floor, a jagged ceiling,
// pillars, mounds and platforms, a way in on the left and a way out on the right.
import { ZoneBuilder } from './zonebuilder.js';
import { T, isSolid } from './tiles.js';
import { scatter } from './scatter.js';
import { rng } from '../core/util.js';
import { ENEMIES } from '../data/enemies.js';
import { spawnPoints } from '../systems/spawner.js';

export const THEMES = {
  reef:      { biome: 'reef', surface: T.GROUND, light: '#9ae8ff', pool: ['pinchling', 'urchin', 'hermit', 'fumecap', 'mantis', 'latchleech'], tough: 'hermit' },
  forest:    { biome: 'forest', surface: T.GROUND, light: '#a8ffb0', pool: ['venomjelly', 'sporepod', 'mossback', 'mantis', 'splitjelly', 'fumecap', 'tidecaller'], tough: 'mossback' },
  kingdom:   { biome: 'kingdom', surface: T.RUIN, light: '#ffd8f0', pool: ['brineguard', 'archerfish', 'puffer', 'anemone_c', 'mantis', 'spawncoral', 'shardling'], tough: 'brineguard' },
  graveyard: { biome: 'graveyard', surface: T.GROUND, light: '#a8d0c0', pool: ['ghostsailor', 'cannon', 'ironturtle', 'barracuda', 'hookjaw', 'tuskram', 'latchleech'], tough: 'ironturtle' },
  abyss:     { biome: 'abyss', surface: T.ROCK, light: '#7ab8ff', pool: ['lanternfish', 'gulper', 'inksquid', 'voidwisp', 'deepjelly', 'hookjaw', 'shardling', 'tidecaller'], tough: 'gulper' },
  trench:    { biome: 'trench', surface: T.BONE, light: '#ff98a8', pool: ['bonecrawler', 'hollowshade', 'wardenbone', 'gulper', 'tuskram', 'guardian', 'glassgolem'], tough: 'wardenbone' },
  domain:    { biome: 'domain', surface: T.DIVINE, light: '#a8f4ff', pool: ['guardian', 'stormhorse', 'tidewisp', 'tridentstatue', 'tuskram', 'glassgolem', 'shardling'], tough: 'guardian' },
};
export const THEME_ORDER = ['reef', 'forest', 'kingdom', 'graveyard', 'abyss', 'trench', 'domain'];

export const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
// what each chamber of a run is: mostly fights, with the occasional elite den, ambush, treasure vault or altar
export const ROOM_KINDS = {
  combat:   { name: 'Chamber', blurb: '' },
  elite:    { name: 'Elite Den', blurb: 'A champion guards this room. The relics here are better.' },
  ambush:   { name: 'Ambush', blurb: 'It is quiet. Too quiet.' },
  treasure: { name: 'Treasure Vault', blurb: 'Chests, and a relic on a stand. Nothing is free.' },
  altar:    { name: 'Altar', blurb: 'A place to rest, to bargain, or to sacrifice.' },
  trial:    { name: 'Trial', blurb: 'Hold out until the tide turns. Waves keep coming.' },
  boss:     { name: "Warden's Chamber", blurb: 'The last chamber. Something is standing in the current.' },
};
export function riftKind(seed, depth, max) {
  if (depth >= max) return 'boss'; if (depth <= 1) return 'combat';
  const r = rng(seed * 41 + depth * 13), prev = riftKind(seed, depth - 1, max), calm = prev === 'treasure' || prev === 'altar';
  const table = calm ? [['combat', 60], ['elite', 22], ['ambush', 18]] : [['combat', 48], ['elite', 16], ['ambush', 14], ['treasure', 12], ['altar', 10]];
  if (depth >= 3 && !calm) table.push(['trial', 12]);               // a trial is a late-run room
  let x = r() * table.reduce((a, [, w]) => a + w, 0); for (const [k, w] of table) { if ((x -= w) <= 0) return k; } return 'combat';
}
export const riftId = (seed, depth, max) => `rift:${seed}:${depth}:${max}`;
export const arenaId = (seed) => `arena:${seed}`;
export function parseId(id) {
  const p = id.split(':');
  if (p[0] === 'rift') return { kind: 'rift', seed: +p[1] | 0, depth: +p[2] | 0, max: +p[3] | 0 };
  if (p[0] === 'arena') return { kind: 'arena', seed: +p[1] | 0 };
  return null;
}
export const isProcedural = (id) => typeof id === 'string' && (id.startsWith('rift:') || id.startsWith('arena:'));

// the order of realms a rift visits, from its seed and what the player has seen (never a realm they have not reached)
export function riftThemes(seed, unlocked) {
  const r = rng(seed * 7919 + 3), pool = THEME_ORDER.filter((t) => unlocked.includes(t)); if (!pool.length) pool.push('reef');
  const order = pool.slice(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}
// unlocked realms are set by the Rifts system before a run starts, so zone ids stay self-contained
let currentThemes = THEME_ORDER;
export const setRiftThemes = (list) => { currentThemes = list.length ? list : ['reef']; };

// enemy picks for a depth: weaker kinds first, stronger as depth grows
function enemyList(theme, depth, r, count) {
  const pool = theme.pool, list = [];
  for (let i = 0; i < count; i++) {
    const hi = Math.min(pool.length, 2 + Math.floor(depth * 0.8)), type = pool[Math.floor(r() * hi)];
    const def = ENEMIES[type], floor = def.anchor === 'feet';
    const e = list.find((x) => x.type === type); if (e) e.n++; else list.push({ type, n: 1, floor, scale: 1 + Math.max(0, depth - 1) * 0.03 });
  }
  return list;
}

function cavern(b, r, w, h) {
  const floorY = h - 8, ph = r() * 6.28, ph2 = r() * 6.28, amp = 1.5 + r() * 2;
  b.fill(T.ROCK).carve(3, 4, w - 6, h - 9);
  b.seabed(3, w - 3, (x) => floorY + Math.sin(x * 0.16 + ph) * amp + Math.sin(x * 0.05 + ph2) * 2);
  b.ceiling(3, w - 3, (x) => 5 + Math.sin(x * 0.21 + ph2) * 1.5 + (Math.sin(x * 0.9) > 0.8 ? 2 : 0));
  // pillars from floor and ceiling, mounds and floating platforms give the fights some shape
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = 16 + Math.floor((i + 0.5 + (r() - 0.5) * 0.5) * ((w - 32) / n)), kind = r();
    if (kind < 0.35) b.pillar(x, 4, floorY - 6, 2, T.ROCK);              // a column hanging from the ceiling: walkers pass beneath, swimmers weave around
    else if (kind < 0.7) b.mound(x, floorY + 1, 3 + Math.floor(r() * 3), 2 + Math.floor(r() * 2), T.ROCK);
    else { const px = x - 3, py = floorY - 6 - Math.floor(r() * 4); b.platform(px, py, 6 + Math.floor(r() * 3)); }
  }
  for (let i = 0; i < 3; i++) b.platform(10 + Math.floor(r() * (w - 28)), floorY - 10 - Math.floor(r() * 5), 5 + Math.floor(r() * 3));
  return floorY;
}

// a column near `tx` with open water above a floor that is level for three tiles and not on a pillar or mound
function flatSpot(b, tx, floorY, taken = [], dir = 0) {
  for (let d = 0; d < 30; d++) for (const x of d ? (dir > 0 ? [tx + d] : dir < 0 ? [tx - d] : [tx - d, tx + d]) : [tx]) {
    if (x < 14 || x > b.w - 14 || taken.some((t) => Math.abs(t - x) < 7)) continue;
    const f = b.floorRow(x, floorY - 9); if (f < floorY - 4 || f > floorY + 5) continue;
    let level = true; for (let c = x - 5; c <= x + 5 && level; c++) if (Math.abs(b.floorRow(c, floorY - 9) - f) > 1) level = false;   // a wide flat stretch, so it is never a pit
    if (!level) continue;
    let clear = true; for (let k = 1; k <= 4 && clear; k++) for (const c of [x - 1, x, x + 1]) if (!b.isOpen(c, f - k)) clear = false;
    if (clear) return x;
  }
  return tx;
}
// the last chamber's boss: the whole cavern is its arena and it wakes when the swimmer is well inside
function wardenSpawn(z, w, h, floorY, P) {
  let sx = w - 20, sy = floorY - 14;
  const roomy = (x, y) => { for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (isSolid(z.grid.get(x + i, y + j))) return false; return true; };
  search: for (let d = 0; d < 24; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === d && roomy(sx + dx, sy + dy)) { sx += dx; sy += dy; break search; }
  return {
    boss: 'rift_warden', repeat: true, x: sx * 16, y: sy * 16,
    arena: { x: 4, y: 5, w: w - 8, h: h - 10 }, trigger: { x: 14, y: 6, w: w - 26, h: h - 12 }, barriers: [],
  };
}
export function buildRift(id) {
  const P = parseId(id), r = rng(P.seed * 131 + P.depth * 977 + 5), themes = riftThemes(P.seed, currentThemes);
  const key = themes[(P.depth - 1) % themes.length], T0 = THEMES[key];
  const w = 72 + Math.floor(r() * 28), h = 36;
  const b = new ZoneBuilder({ id, name: 'Tidal Rift', title: `Rift - Depth ${P.depth}`, biome: T0.biome, w, h, seed: P.seed * 17 + P.depth, pressure: 0 });
  const floorY = cavern(b, r, w, h);
  b.surface(T0.surface, 1); b.smooth(1);
  b.keep(3, 4, 8, h - 9);
  b.carve(3, floorY - 8, 7, 8); b.carve(w - 10, floorY - 8, 7, 8);              // clear footholds at both ends
  b.entryFloor('west', 6, { facing: 1, from: floorY - 9 });
  const last = P.depth >= P.max;
  if (!last) { b.exitE(floorY - 7, floorY - 1, riftId(P.seed, P.depth + 1, P.max), 'west'); b.exits[b.exits.length - 1].cond = (g) => g.systems.rifts.canLeave(); }
  b.entryFloor('east', w - 7, { facing: -1, from: floorY - 9 });
  for (const [tx, col] of [[14, T0.light], [Math.floor(w / 2), T0.light], [w - 16, T0.light]]) b.light(tx, floorY - 8, 56, col, 0.7);
  const kind = riftKind(P.seed, P.depth, P.max);
  b.chest(w - 12, last ? { coins: [150 + P.depth * 30, 220 + P.depth * 40], pearl: 2 + (P.max >= 8 ? 2 : 0) } : { coins: [30 + P.depth * 10, 60 + P.depth * 15] }, { from: floorY - 9, tint: last ? 1 : 0 });
  if (kind === 'treasure') {
    // the vault sits at the exit end of the chamber, whose footholds are always reachable
    const taken = [w - 12], a = flatSpot(b, w - 20, floorY, taken, -1); taken.push(a); const c = flatSpot(b, w - 28, floorY, taken, -1); taken.push(c); const s = flatSpot(b, w - 36, floorY, taken, -1);
    b.chest(a, { coins: [40 + P.depth * 15, 80 + P.depth * 20], pearl: 1 }, { from: floorY - 9, tint: 1 });
    b.chest(c, { coins: [20, 40], item: ['kelp_wrap', 'brine_tonic', 'fury_ink'][Math.floor(r() * 3)] }, { from: floorY - 9 });
    b.propFloor('relicstand', s, { from: floorY - 9 });
  } else if (kind === 'altar') {
    const x = flatSpot(b, 16, floorY, [], 1); b.propFloor('altar', x, { from: floorY - 9 }); b.light(x, floorY - 6, 70, '#ffd8f0', 0.9);
  }
  const quiet = kind === 'treasure' || kind === 'altar';
  const count = quiet || last || kind === 'trial' ? 0 : kind === 'elite' ? 3 : kind === 'ambush' ? 2 : Math.min(14, 4 + Math.round(P.depth * 1.3));
  const z = b.finish(); z.rift = { depth: P.depth, max: P.max, theme: key, last, kind }; z.points = spawnPoints(w);
  if (last) z.spawns.push(wardenSpawn(z, w, h, floorY, P));
  return count ? scatter(z, enemyList(T0, P.depth, r, count)) : z;
}

// ---- the Pearl Gauntlet: a sealed round arena, waves are spawned by systems/arena.js ------------------------------------------------------------
export function buildArena(id) {
  const P = parseId(id), w = 64, h = 34, keys = THEME_ORDER;
  const key = keys[P.seed % keys.length], T0 = THEMES[key];
  const b = new ZoneBuilder({ id, name: 'Pearl Gauntlet', title: 'The Pearl Gauntlet', biome: T0.biome, w, h, seed: P.seed * 7 + 1, pressure: 0, safe: false });
  b.fill(T.ROCK).carve(4, 4, w - 8, h - 9);
  b.seabed(4, w - 4, (x) => h - 8 + Math.sin(x * 0.2) * 1.2);
  b.ceiling(4, w - 4, (x) => 5 + Math.sin(x * 0.3) * 1);
  for (const x of [16, 32, 48]) { b.platform(x - 3, h - 15, 7); }
  b.platform(8, h - 20, 6); b.platform(w - 14, h - 20, 6); b.platform(w / 2 - 4, h - 22, 8);
  b.pillar(24, h - 16, h - 6, 2, T.RUIN); b.pillar(40, h - 16, h - 6, 2, T.RUIN);
  b.surface(T0.surface, 1); b.smooth(1);
  b.entryFloor('west', 8, { facing: 1, from: 6 }); b.entryFloor('start', w / 2, { facing: 1, from: 6 });
  for (const tx of [10, 32, 54]) b.light(tx, 12, 60, '#ffe8a0', 0.8);
  const z = b.finish(); z.arena = { theme: key, seed: P.seed }; z.nospawn = true;
  z.points = []; for (let x = 10; x < w - 10; x += 6) z.points.push(x);
  return z;
}
