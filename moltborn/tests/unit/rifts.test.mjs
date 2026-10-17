// The Tidal Rift run logic with a stub game: tiers and unlocks, the modifiers and multipliers of each depth, relic offers,
// rewards, leaving rules. (Chamber generation is covered in systems.test.mjs and by tests/validate_rifts.mjs.)
import { test, ok, eq, near } from './harness.mjs';
import { Rifts, isRiftZone } from '../../src/systems/rifts.js';
import { RELICS, RELIC_IDS, RARITY, RIFT_MODS, RIFT_MOD_IDS, RIFT_TIERS } from '../../src/data/relics.js';
import { INGREDIENT_IDS } from '../../src/data/items_craft.js';
import { newState } from '../../src/systems/progression.js';
import { newRecords } from '../../src/systems/stats.js';
import { today } from '../../src/world/rift_gen.js';

function game(over = {}) {
  const state = newState(); state.records = newRecords(); state.stats = { coinsEarned: 0 }; state.visited = { reef_garden: true }; state.bosses = {}; Object.assign(state, over.state || {});
  const toasts = [];
  const g = { state, systems: {}, events: { on() {}, emit() {} }, toast: (m) => toasts.push(m), audio: { sfx() {} }, world: null, toasts };
  g.systems.rifts = new Rifts(g); return g;
}
function startRun(g, tierId = 'shallow', seed = 1234, depth = 1) {
  const R = g.systems.rifts, tier = RIFT_TIERS.find((t) => t.id === tierId);
  R.run = { seed, tier, max: tier.depths, depth, kills: 0, cleared: false, picking: false, offered: 0, t0: 0, daily: false, hub: { zone: 'reef_garden', x: 0, y: 0 }, done: false, depthKills: 0 };
  return R;
}

test('rift zone ids are recognised', () => { ok(isRiftZone('rift:1:2:4')); ok(!isRiftZone('arena:5')); ok(!isRiftZone('reef_garden')); ok(!isRiftZone(null)); });

test('the shallow tier is always open; the others need a boss', () => {
  const g = game(), R = g.systems.rifts; let t = R.tiers(); ok(t[0].open); ok(!t[1].open && !t[2].open);
  g.state.bosses.mother_moray = true; t = R.tiers(); ok(t[1].open && !t[2].open); g.state.bosses.krael = true; ok(R.tiers()[2].open);
});
test('tiers get longer and richer', () => { for (let i = 1; i < RIFT_TIERS.length; i++) { ok(RIFT_TIERS[i].depths > RIFT_TIERS[i - 1].depths && RIFT_TIERS[i].mult > RIFT_TIERS[i - 1].mult && RIFT_TIERS[i].reward > RIFT_TIERS[i - 1].reward); } });
test('a rift only offers realms the swimmer has visited', () => { const g = game(), R = g.systems.rifts; eq(R.unlockedThemes().join(), 'reef'); g.state.visited.forest_roots = true; g.state.visited.abyss_lanterns = true; eq(R.unlockedThemes().join(), 'reef,forest,abyss'); g.state.visited = {}; eq(R.unlockedThemes().join(), 'reef', 'never empty'); });

test('no multipliers outside a run', () => { eq(game().systems.rifts.mult(), null); eq(game().systems.rifts.mods().length, 0); });
test('modifiers appear from depth 2, two from depth 5, and never repeat within a chamber', () => {
  const R = startRun(game()); eq(R.mods(1).length, 0); eq(R.mods(2).length, 1); eq(R.mods(4).length, 1); eq(R.mods(5).length, 2); eq(R.mods(8).length, 2);
  for (let seed = 1; seed < 40; seed++) { R.run.seed = seed; const m = R.mods(6); eq(new Set(m).size, m.length); for (const id of m) ok(RIFT_MODS[id], id); }
});
test('the same seed and depth always roll the same tides', () => { const R = startRun(game(), 'deep', 777); eq(R.mods(3).join(), R.mods(3).join()); eq(R.mods(6).join(), startRun(game(), 'deep', 777).mods(6).join()); });
test('foe health and damage grow with depth, scaled by the tier', () => {
  const R = startRun(game(), 'shallow'); R.mods = () => []; R.run.depth = 1; const a = R.mult(); R.run.depth = 4; const b = R.mult();
  near(a.hp, 1); near(a.dmg, 1); near(b.hp, 1.3, 1e-9); near(b.dmg, 1.21, 1e-9); ok(b.xp > a.xp); eq(b.coin, 1);
  const A = startRun(game(), 'abyssal'); A.mods = () => []; A.run.depth = 4; ok(A.mult().hp > b.hp && A.mult().dmg > b.dmg);
});
test('rift modifiers fold into the multipliers', () => {
  const R = startRun(game()); R.run.depth = 3; R.mods = () => ['thick_hide', 'rich_tide']; const m = R.mult(); near(m.hp, 1.2 * 1.4, 1e-9); near(m.coin, 1.6, 1e-9); ok(m.xp > 1.2 * 1.25 - 1e-9);
});
test('every modifier does something', () => { for (const id of RIFT_MOD_IDS) { const M = RIFT_MODS[id]; ok(M.name && M.desc && /^#/.test(M.color), id); ok(M.mult || M.haste || M.dark, id + ' has an effect'); } });

test('relic offers are deterministic, distinct, and skip what the swimmer holds', () => {
  const R = startRun(game()); const a = R.roll(3), b = R.roll(3); eq(a.join(), b.join()); eq(new Set(a).size, 3); R.relics().push(a[0]); ok(!R.roll(3).includes(a[0]));
});
test('epic relics wait for depth 2 unless asked for', () => {
  const R = startRun(game()); for (let seed = 1; seed < 60; seed++) { R.run.seed = seed; for (const id of R.roll(4)) ok(RELICS[id].rarity !== 'epic', id); } R.run.depth = 3; let epics = 0; for (let seed = 1; seed < 80; seed++) { R.run.seed = seed; epics += R.roll(4).filter((id) => RELICS[id].rarity === 'epic').length; } ok(epics > 0, 'epics appear later');
});
test('a better pool is honoured after an elite den', () => { const R = startRun(game()); R.run.depth = 3; for (let seed = 1; seed < 40; seed++) { R.run.seed = seed; for (const id of R.roll(4, 'rare')) ok(RELICS[id].rarity !== 'common', id); } });
test('curses are never offered as relics', () => { ok(!RELIC_IDS.includes('sacrificial_vow')); const R = startRun(game()); for (let s = 1; s < 50; s++) { R.run.seed = s; ok(!R.roll(4).includes('sacrificial_vow')); } });
test('the offer pool is large enough for a long run', () => { ok(RELIC_IDS.length >= 20); const w = Object.keys(RARITY).map((k) => RARITY[k].weight); ok(w[0] > w[1] && w[1] > w[2]); });
test('has() and relics() read the saved run relics', () => { const g = game(), R = g.systems.rifts; ok(!R.has('godshard')); R.relics().push('godshard'); ok(R.has('godshard')); eq(g.state.riftRelics.length, 1); });

test('a cleared run pays by tier and run length, and a longer run pays more', () => {
  const s = startRun(game(), 'shallow'), d = startRun(game(), 'deep'), a = startRun(game(), 'abyssal');
  const rs = s.rewards(true), rd = d.rewards(true), ra = a.rewards(true); ok(rd.coins > rs.coins && ra.coins > rd.coins); ok(ra.xp > rd.xp && rd.xp > rs.xp); ok(ra.pearls > rs.pearls); eq(ra.black, 1); eq(rs.black, 0);
});
test('the first clear of each tier pays a skill point, once', () => { const g = game(), R = startRun(g); const r1 = R.rewards(true); eq(r1.sp, 1); eq(r1.first, 'rift_first_shallow'); g.state.flags.rift_first_shallow = true; eq(R.rewards(true).sp, 0); });
test('a cleared run brings back ingredients that exist', () => { const R = startRun(game(), 'deep'), r = R.rewards(true); let n = 0; for (const [id, c] of Object.entries(r.items)) { ok(INGREDIENT_IDS.includes(id), id); n += c; } eq(n, 3 + 6); });
test('the daily rift pays a bonus once per day', () => {
  const g = game(), R = startRun(g, 'shallow', today()); R.run.daily = true; const a = R.rewards(true); ok(a.dailyKey === 'daily_' + today()); const base = startRun(game(), 'shallow', today()).rewards(true); eq(a.coins, base.coins + 200); eq(a.pearls, base.pearls + 1);
  g.state.flags['daily_' + today()] = true; eq(R.rewards(true).dailyKey, undefined);
});
test('a failed run pays a little for every chamber cleared and nothing for the one it died in', () => {
  const R = startRun(game(), 'shallow'); R.run.depth = 1; const none = R.rewards(false); eq(none.coins, 0); eq(none.cleared, 0); R.run.depth = 4; const some = R.rewards(false); eq(some.cleared, 3); ok(some.coins > 0 && some.xp === 120 && some.pearls === 1);
  ok(R.rewards(true).coins > some.coins, 'winning beats losing');
});

test('the way on stays shut until the chamber is cleared and the relic chosen', () => {
  const g = game(), R = startRun(g); R.run.cleared = false; ok(!R.canLeave()); ok(R.warnT > 0, 'the warning is rate-limited'); eq(g.toasts.length, 1); R.canLeave(); eq(g.toasts.length, 1, 'no spam');
  R.warnT = 0; R.run.cleared = true; R.run.picking = true; ok(!R.canLeave()); ok(g.toasts[g.toasts.length - 1].includes('relic')); R.run.picking = false; ok(R.canLeave());
});
test('outside a run every door opens', () => { ok(game().systems.rifts.canLeave()); });
test('game-time timers fire after their delay and not before', () => {
  const R = startRun(game()); let fired = 0; R.after(1, () => { fired++; }); R.update(0.5); eq(fired, 0); R.update(0.6); eq(fired, 1); R.update(5); eq(fired, 1);
});
