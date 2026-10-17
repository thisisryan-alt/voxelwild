// Fishing: the catch tables, lengths, and the reeling game stepped frame by frame.
import { test, ok, eq, near } from './harness.mjs';
import { FISH, FISH_BY_ID, RARITY, FISH_BIOMES, WAIT, HOOK_WINDOW } from '../../src/data/fish.js';
import { FISH_INGREDIENTS, FISH_DISHES, FISH_RECIPES } from '../../src/data/items_fish.js';
import { ITEMS } from '../../src/data/items.js';
import { STATUS } from '../../src/systems/status.js';
import { candidates, rollFish, rollLength, isBig, Reel, Fishing } from '../../src/systems/fishing.js';
import { PHASES } from '../../src/data/clock.js';
import { newState } from '../../src/systems/progression.js';
import { newRecords } from '../../src/systems/stats.js';
import { rng } from '../../src/core/util.js';

test('fish are well formed and unique', () => {
  eq(new Set(FISH.map((f) => f.id)).size, FISH.length);
  for (const f of FISH) { ok(RARITY[f.rarity], f.id); ok(f.biomes.length && f.biomes.every((b) => FISH_BIOMES.includes(b)), f.id); ok(f.len[0] > 0 && f.len[1] > f.len[0], f.id); ok(f.value > 0 && f.note.length > 20, f.id); ok(f.fight.speed > 0 && f.fight.erratic >= 0 && f.fight.drain > 0, f.id); if (f.phases) for (const p of f.phases) ok(PHASES.some((x) => x.id === p), f.id + ':' + p); }
});
test('every fish is an ingredient item', () => { for (const f of FISH) { const it = ITEMS['fish_' + f.id]; ok(it && it.type === 'ingredient' && it.price > 0 && it.fish === f.id, f.id); } eq(Object.keys(FISH_INGREDIENTS).length, FISH.length); });
test('fish dishes and recipes agree', () => { for (const r of FISH_RECIPES) { ok(FISH_DISHES[r.out], r.id); for (const k of Object.keys(r.needs)) ok(ITEMS[k], r.id + ':' + k); if (!r.id.startsWith('bait_')) ok(Object.keys(r.needs).some((k) => k.startsWith('fish_')), r.id + ' uses a fish'); } for (const [id, d] of Object.entries(FISH_DISHES)) for (const b of d.use.buffs || []) ok(STATUS[b.id], id + ':' + b.id); });
test('every realm has something to catch in every phase', () => { for (const b of FISH_BIOMES) for (const p of PHASES) ok(candidates(b, p.id).length >= 1, `${b} at ${p.id}`); });
test('every fish can be caught somewhere at some hour', () => { for (const f of FISH) ok(FISH_BIOMES.some((b) => PHASES.some((p) => candidates(b, p.id).includes(f))), f.id); });
test('night-only fish never bite by day', () => { for (const f of FISH.filter((x) => x.phases && !x.phases.includes('day'))) for (const b of f.biomes) ok(!candidates(b, 'day').includes(f), f.id); });
test('common fish are caught far more often than legendary ones', () => {
  const r = rng(5), got = { common: 0, uncommon: 0, rare: 0, legendary: 0 }; for (let i = 0; i < 6000; i++) { const f = rollFish(r, 'abyss', 'night', 0); got[f.rarity]++; }
  ok(got.common > got.uncommon && got.uncommon > got.rare && got.rare > got.legendary, JSON.stringify(got)); ok(got.legendary > 20 && got.legendary < 600, 'legend rate ' + got.legendary);
});
test('luck shifts weight toward rare fish', () => { const a = rng(9), b = rng(9); let lo = 0, hi = 0; for (let i = 0; i < 4000; i++) { if (rollFish(a, 'reef', 'night', 0).rarity !== 'common') lo++; if (rollFish(b, 'reef', 'night', 0.4).rarity !== 'common') hi++; } ok(hi > lo * 1.15, `${lo} vs ${hi}`); });
test('rolling is repeatable from a seed', () => { const a = rng(77), b = rng(77); for (let i = 0; i < 50; i++) eq(rollFish(a, 'forest', 'day', 0.1).id, rollFish(b, 'forest', 'day', 0.1).id); });
test('lengths stay inside the species range and skew small', () => { const r = rng(3), f = FISH_BY_ID.reef_bream; let sum = 0; for (let i = 0; i < 2000; i++) { const l = rollLength(r, f); ok(l >= f.len[0] && l <= f.len[1]); sum += l; } ok(sum / 2000 < (f.len[0] + f.len[1]) / 2, 'average below the middle'); });
test('big catches are flagged near the top of the range', () => { const f = FISH_BY_ID.silverfin; ok(!isBig(f, f.len[0])); ok(isBig(f, f.len[1])); });

test('a held button lifts the zone and a released one lets it fall', () => {
  const r = new Reel(FISH_BY_ID.silverfin, 0, 1), z0 = r.zone; for (let i = 0; i < 40; i++) r.step(1 / 60, true); ok(r.zone > z0 + 0.05, 'rose');
  const z1 = r.zone; for (let i = 0; i < 90; i++) r.step(1 / 60, false); ok(r.zone < z1 - 0.1, 'fell');
});
test('the zone and the fish stay on the bar', () => { const r = new Reel(FISH_BY_ID.old_one, 0, 4); for (let i = 0; i < 3000; i++) { r.step(1 / 60, i % 90 < 40); ok(r.zone >= 0 && r.zone + r.zoneH <= 1.0001 && r.pos >= 0 && r.pos <= 1, 'frame ' + i); if (r.state !== 'play') break; } });
test('a perfect player wins against a common fish', () => {
  let wins = 0; for (let seed = 1; seed <= 20; seed++) { const r = new Reel(FISH_BY_ID.silverfin, 0.3, seed); for (let i = 0; i < 60 * 40 && r.state === 'play'; i++) { const center = r.zone + r.zoneH / 2; r.step(1 / 60, r.pos > center || (r.pos > center - 0.02 && r.vel < 0)); } if (r.state === 'won') wins++; }
  ok(wins >= 14, `only ${wins}/20`);
});
test('doing nothing loses', () => { const r = new Reel(FISH_BY_ID.silverfin, 0, 2); for (let i = 0; i < 60 * 30 && r.state === 'play'; i++) r.step(1 / 60, false); ok(r.state !== 'play', 'ended'); });
test('a finished game ignores further steps', () => { const r = new Reel(FISH_BY_ID.silverfin, 0, 2); for (let i = 0; i < 3000 && r.state === 'play'; i++) r.step(1 / 60, false); const s = r.state, p = r.progress; r.step(1, true); eq(r.state, s); eq(r.progress, p); });
test('legendary fish are harder: narrower zone, faster fish', () => { const a = new Reel(FISH_BY_ID.silverfin, 0, 1), b = new Reel(FISH_BY_ID.old_one, 0, 1); ok(b.zoneH < a.zoneH); ok(b.f.speed > a.f.speed && b.f.drain > a.f.drain); });
test('skill widens the zone but never past sensible limits', () => { const lo = new Reel(FISH_BY_ID.silverfin, 0, 1), hi = new Reel(FISH_BY_ID.silverfin, 0.6, 1); ok(hi.zoneH > lo.zoneH && hi.zoneH <= 0.42); ok(new Reel(FISH_BY_ID.old_one, 0, 1).zoneH >= 0.14); });
test('the same seed gives the same fight', () => { const a = new Reel(FISH_BY_ID.glassfin, 0.1, 9), b = new Reel(FISH_BY_ID.glassfin, 0.1, 9); for (let i = 0; i < 500; i++) { a.step(1 / 60, i % 50 < 20); b.step(1 / 60, i % 50 < 20); } near(a.pos, b.pos, 1e-12); near(a.progress, b.progress, 1e-12); });
test('timing constants leave a human-sized window', () => { ok(WAIT[0] >= 1 && WAIT[1] > WAIT[0] && WAIT[1] < 8); ok(HOOK_WINDOW >= 0.6 && HOOK_WINDOW <= 1.5); });

function game(level = 10) {
  const state = newState(); state.level = level; state.records = newRecords(); state.playtime = 100; const items = [], events = [];
  const g = { state, systems: {}, world: { zone: { biome: 'reef' } }, grantItem: (id, n) => items.push([id, n]), events: { emit: (...a) => events.push(a) }, items, evs: events };
  g.systems.fishing = new Fishing(g); return g;
}
test('landing a fish stores it, grants the ingredient and records firsts and records', () => {
  const g = game(), F = g.systems.fishing, f = FISH_BY_ID.silverfin;
  let r = F.landed({ fish: f, len: 20 }); ok(r.fresh && r.record); eq(F.log.total, 1); eq(g.state.records.fished, 1); eq(g.items[0][0], 'fish_silverfin');
  r = F.landed({ fish: f, len: 18 }); ok(!r.fresh && !r.record); r = F.landed({ fish: f, len: 25 }); ok(!r.fresh && r.record); eq(F.log.species.silverfin.n, 3); eq(F.log.species.silverfin.best, 25); eq(F.speciesCaught(), 1);
});
test('legendary catches are counted separately', () => { const g = game(), F = g.systems.fishing; F.landed({ fish: FISH_BY_ID.moon_koi, len: 80 }); eq(g.state.records.legendFish, 1); });
test('spots recover with play time', () => {
  const g = game(), F = g.systems.fishing, zs = {}; ok(F.ready(zs, 'k')); F.cool(zs, 'k', 1); ok(!F.ready(zs, 'k')); g.state.playtime += 100; ok(!F.ready(zs, 'k')); g.state.playtime += 100; ok(F.ready(zs, 'k'));
  F.cool(zs, 'k', 0.3); g.state.playtime += 60; ok(F.ready(zs, 'k'), 'a missed bite recovers faster');
});
test('luck and skill grow with level but stay capped', () => { const lo = game(1).systems.fishing, hi = game(30).systems.fishing; ok(hi.luck() > lo.luck() && hi.skill() > lo.skill()); ok(game(99).systems.fishing.luck() <= 0.7 && game(99).systems.fishing.skill() <= 0.6); });
test('bait raises luck in proportion to its power, and expires with its status', () => {
  const g = game(10), F = g.systems.fishing, base = F.luck(); const set = new Map(); g.world.player = { status: { get: (id) => set.get(id) || null } };
  set.set('baited', { power: 1 }); const one = F.luck(); set.set('baited', { power: 3.5 }); const big = F.luck(); set.delete('baited');
  ok(one > base && big > one, `${base} ${one} ${big}`); near(one - base, 0.1, 1e-9); near(F.luck(), base, 1e-12);
});
test('bait items give the baited status with rising power, and the status is a real buff', () => {
  const k = FISH_DISHES.bait_kelp.use.buffs[0], gl = FISH_DISHES.bait_glow.use.buffs[0], pe = FISH_DISHES.bait_pearl.use.buffs[0]; ok(STATUS.baited && !STATUS.baited.harmful);
  ok(k.id === 'baited' && gl.power > k.power && pe.power > gl.power); ok(pe.dur < k.dur, 'the best lure is the shortest');
  for (const r of FISH_RECIPES.filter((x) => x.id.startsWith('bait_'))) { ok(ITEMS[r.out].type === 'dish'); ok(r.n >= 1); }
});
test('picking a catch is deterministic for a spot, hour and salt, and returns a legal fish', () => {
  const g = game(), F = g.systems.fishing, spot = { seed: 12345 }; const a = F.pick(spot, 3), b = F.pick(spot, 3); eq(a.fish.id, b.fish.id); eq(a.len, b.len);
  for (let s = 0; s < 40; s++) { const c = F.pick(spot, s); ok(c.fish.biomes.includes('reef') && c.len >= c.fish.len[0] && c.len <= c.fish.len[1]); }
});
