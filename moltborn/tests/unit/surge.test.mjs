// Tidal surges: when they may happen, the warn / rush / wake cycle, what washes up, and the bait recipes that go with fishing.
import { test, ok, eq } from './harness.mjs';
import { Surge, SURGE, rollFlotsam, inRange } from '../../src/systems/surge.js';
import { FORAGE } from '../../src/data/forage.js';
import { ITEMS } from '../../src/data/items.js';
import { defaults } from '../../src/systems/settings.js';
import { rng } from '../../src/core/util.js';
import { TS } from '../../src/world/tiles.js';

// a world just big enough for the system: a floor along row 10, open water above it
function fakeGame(over = {}) {
  const events = [], toasts = [], pickups = [], areas = [], shakes = [], forced = [];
  const grid = { get: (x, y) => (y >= 10 ? 1 : 0) };
  const zone = { id: 'reef_garden', biome: 'reef', w: 50, h: 20, areas, ...over.zone };
  const world = { zone, grid, boss: null, cinematic: false, player: { x: 200, y: 100, alive: true }, fx: { ring() {}, burst() {} }, shake: (n) => shakes.push(n), addPickup: (p) => pickups.push(p), sky: { force: (k, o) => forced.push([k, o]) }, ...over.world };
  const g = { state: { settings: { ...defaults(), ...over.settings }, records: { surges: 0 } }, world, events: { on: () => {}, emit: (...a) => events.push(a) }, toast: (m) => toasts.push(m), audio: { sfx() {} }, systems: {}, evs: events, toasts, pickups, areas, shakes, forced };
  g.systems.surge = new Surge(g); return g;
}
const run = (g, seconds, dt = 0.1) => { const S = g.systems.surge; for (let t = 0; t < seconds; t += dt) S.update(dt); return S; };

test('constants describe a short, rare, readable event', () => { ok(SURGE.warn >= 3 && SURGE.length >= 8 && SURGE.length <= 30); ok(SURGE.gap[0] >= 120 && SURGE.gap[1] > SURGE.gap[0]); ok(SURGE.first[0] >= 40); ok(SURGE.force > 100 && SURGE.force < 400); ok(SURGE.flotsam[0] >= 3); });
test('inRange interpolates', () => { eq(inRange([10, 20], 0), 10); eq(inRange([10, 20], 1), 20); eq(inRange([10, 20], 0.5), 15); });

test('flotsam is coins, realm ingredients and bait only', () => {
  const r = rng(4), all = new Set(); for (let i = 0; i < 40; i++) for (const p of rollFlotsam(r, 'forest', 9)) { all.add(p.type); if (p.type === 'item') ok(ITEMS[p.id], p.id); else ok(p.value === 1 || p.value === 5); }
  ok(all.has('coin') && all.has('item'));
});
test('ingredients that wash up come from the realm\'s forage patches', () => {
  const r = rng(11), allowed = new Set(FORAGE.graveyard.flatMap((k) => k.yield.map(([id]) => id)).concat(['bait_kelp', 'bait_glow'])); for (let i = 0; i < 200; i++) for (const p of rollFlotsam(r, 'graveyard', 8)) if (p.type === 'item') ok(allowed.has(p.id), p.id);
});
test('more coins than anything else wash up', () => { const r = rng(2); let coins = 0, items = 0; for (let i = 0; i < 400; i++) for (const p of rollFlotsam(r, 'reef', 6)) (p.type === 'coin' ? coins++ : items++); ok(coins > items, `${coins} vs ${items}`); });
test('a realm without forage still gets coins', () => { for (const p of rollFlotsam(rng(1), 'nowhere', 6)) eq(p.type, 'coin'); });

test('a surge warns, rushes, then calms and leaves flotsam, in that order', () => {
  const g = fakeGame(), S = g.systems.surge; S.next = 1; const phases = []; g.events.emit = (...a) => { if (a[0] === 'surge') phases.push(a[1]); };
  run(g, 1.5); eq(S.state, 'warn'); eq(g.areas.length, 0, 'nothing moves during the warning'); run(g, SURGE.warn + 0.3); eq(S.state, 'rush'); eq(g.areas.length, 1); run(g, SURGE.length + 0.3); eq(S.state, 'wake');
  eq(g.areas.length, 0, 'the current is removed'); ok(g.pickups.length >= SURGE.flotsam[0] - 2, 'flotsam: ' + g.pickups.length); eq(phases.join(), 'warn,rush,calm'); eq(g.state.records.surges, 1);
});
test('the rushing current covers the whole zone, runs one way and expires by itself', () => {
  const g = fakeGame(), S = g.systems.surge; S.next = 0.5; run(g, 0.7 + SURGE.warn + 0.2); const a = g.areas[0]; ok(a && a.kind === 'current'); eq(a.w, 50 * TS); eq(a.h, 20 * TS); eq(Math.abs(a.vx), SURGE.force); eq(a.vy, 0); ok(a.ttl > SURGE.length && a.ttl < SURGE.length + 2);
  eq(g.forced[0][0], 'surge'); eq(g.forced[0][1].dir, Math.sign(a.vx));
});
test('after the wake the countdown starts over', () => { const g = fakeGame(), S = g.systems.surge; S.next = 0.2; run(g, 0.4 + SURGE.warn + SURGE.length + 6); eq(S.state, 'idle'); ok(S.next >= SURGE.first[0] - 1); });
test('surges never start where they should not', () => {
  for (const over of [{ zone: { rift: { depth: 1 } } }, { zone: { arena: {} } }, { zone: { id: 'rift:1:1:4' } }, { zone: { biome: 'abyss' } }, { zone: { biome: 'trench' } }, { zone: { safe: true } }, { world: { cinematic: true } }, { world: { boss: { engaged: true } } }, { world: { player: { x: 0, y: 0, alive: false } } }, { settings: { surges: 0 } }]) {
    const g = fakeGame(over), S = g.systems.surge; S.next = 0.1; run(g, 5); eq(S.state, 'idle', JSON.stringify(over).slice(0, 60)); eq(g.areas.length, 0);
  }
});
test('a surge in flight is cancelled cleanly when the swimmer leaves', () => { const g = fakeGame(), S = g.systems.surge; S.next = 0.1; run(g, 0.3 + SURGE.warn + 1); eq(S.state, 'rush'); S.reset(); eq(S.state, 'idle'); eq(S.area, null); });
test('a boss fight interrupts a surge that is already rushing', () => { const g = fakeGame(), S = g.systems.surge; S.next = 0.1; run(g, 0.3 + SURGE.warn + 1); eq(S.state, 'rush'); g.world.boss = { engaged: true }; run(g, 0.5); eq(S.state, 'idle'); });
test('the floor search finds the floor, and gives up in solid rock or a bottomless column', () => {
  const g = fakeGame(), S = g.systems.surge; eq(S.floorBelow(100, 100), 10 * TS); eq(S.floorBelow(100, 5 * TS), 10 * TS);
  g.world.grid.get = () => 1; eq(S.floorBelow(100, 100), null); g.world.grid.get = () => 0; eq(S.floorBelow(100, 100), null);
});
test('flotsam lands on the floor within a short swim of the player', () => {
  const g = fakeGame(), S = g.systems.surge; S.leave(Array.from({ length: 20 }, () => ({ type: 'coin', value: 1 })));
  ok(g.pickups.length >= 15); for (const p of g.pickups) { ok(Math.abs(p.x - 200) <= 190, 'near'); ok(p.y < 10 * TS && p.y > 8 * TS, 'on the floor ' + p.y); eq(p.kind, 'coin'); }
});
test('bait is a flotsam prize that exists', () => { ok(ITEMS.bait_kelp && ITEMS.bait_glow); });
