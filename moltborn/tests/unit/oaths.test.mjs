// Oaths: the data, the arithmetic, and how a run with oaths differs from one without.
import { test, ok, eq, near } from './harness.mjs';
import { OATHS, OATH_IDS, MAX_OATHS, cleanOaths, rewardBonus, oathMult, oathHaste, oathDark } from '../../src/data/oaths.js';
import { Rifts } from '../../src/systems/rifts.js';
import { RIFT_TIERS } from '../../src/data/relics.js';
import { computeStats, newState } from '../../src/systems/progression.js';
import { newRecords } from '../../src/systems/stats.js';
import { History } from '../../src/systems/history.js';

function game() {
  const state = newState(); state.records = newRecords(); state.stats = { coinsEarned: 0 }; state.visited = { reef_garden: true }; state.bosses = {}; state.flags = {};
  const g = { state, systems: {}, events: { on() {}, emit() {} }, toast() {}, audio: { sfx() {} }, world: null }; g.systems.rifts = new Rifts(g); return g;
}
function run(g, oaths, tier = 'shallow', depth = 1) {
  const R = g.systems.rifts, T = RIFT_TIERS.find((t) => t.id === tier);
  R.run = { seed: 5, tier: T, max: T.depths, depth, kills: 0, cleared: false, picking: false, offered: 0, t0: 0, daily: false, hub: { zone: 'reef_garden', x: 0, y: 0 }, done: false, depthKills: 0, oaths: cleanOaths(oaths) }; R.mods = () => []; return R;
}

test('every oath is described and pays something, with at least one real effect', () => {
  for (const id of OATH_IDS) { const O = OATHS[id]; ok(O.name.startsWith('Oath of '), id); ok(/^#[0-9a-f]{6}$/i.test(O.color) && O.desc.length > 15, id); ok(O.reward > 0 && O.reward <= 0.3, id); ok(O.mult || O.haste || O.dark || O.fx, id + ' does something'); }
  ok(OATH_IDS.length >= 5 && MAX_OATHS >= 2 && MAX_OATHS <= OATH_IDS.length);
});
test('cleanOaths drops unknown and repeated ids and enforces the limit', () => {
  eq(cleanOaths(['iron', 'nonsense', 'iron', 'fury']).join(), 'iron,fury'); eq(cleanOaths(OATH_IDS).length, MAX_OATHS); eq(cleanOaths(null).length, 0); eq(cleanOaths([]).length, 0); eq(cleanOaths(OATH_IDS).join(), OATH_IDS.slice(0, MAX_OATHS).join());
});
test('the reward bonus adds up, and is zero with no oaths', () => { eq(rewardBonus([]), 0); near(rewardBonus(['iron']), OATHS.iron.reward, 1e-12); near(rewardBonus(['iron', 'haste', 'fury']), OATHS.iron.reward + OATHS.haste.reward + OATHS.fury.reward, 1e-12); near(rewardBonus(['iron', 'iron']), OATHS.iron.reward, 1e-12); });
test('foe multipliers multiply, never add', () => {
  const m = oathMult(['iron', 'fury']); near(m.hp, 1.25, 1e-12); near(m.dmg, 1.2, 1e-12); eq(m.xp, 1); eq(m.coin, 1); const none = oathMult([]); eq(none.hp, 1); eq(none.dmg, 1);
});
test('haste and darkness are read from the right oaths', () => { ok(oathHaste(['haste'])); ok(!oathHaste(['iron', 'fog'])); near(oathDark(['fog']), 0.3, 1e-12); eq(oathDark(['iron']), 0); eq(oathDark(['fog', 'iron']), 0.3); });

test('oaths raise the rift multipliers on top of the depth and tier', () => {
  const g = game(), plain = run(g, [], 'shallow', 4).mult(), sworn = run(g, ['iron', 'fury'], 'shallow', 4).mult();
  near(sworn.hp, plain.hp * 1.25, 1e-9); near(sworn.dmg, plain.dmg * 1.2, 1e-9); near(sworn.xp, plain.xp, 1e-12); near(sworn.coin, plain.coin, 1e-12);
});
test('a run without oaths is exactly as before', () => { const g = game(), R = run(g, undefined, 'deep', 3), m = R.mult(); near(m.hp, 1.2 * 1.25, 1e-9); near(m.dmg, 1.14 * 1.125, 1e-9); });
test('oath rewards scale coins and experience for a cleared run and a lost one', () => {
  const g = game(); const a = run(g, [], 'deep').rewards(true), b = run(g, ['iron', 'fury', 'haste'], 'deep').rewards(true), bonus = 1 + rewardBonus(['iron', 'fury', 'haste']);
  eq(b.coins, Math.round(a.coins * bonus)); eq(b.xp, Math.round(a.xp * bonus)); eq(b.pearls, a.pearls, 'pearls are not scaled'); eq(b.black, a.black);
  const la = run(g, [], 'deep', 4).rewards(false), lb = run(g, ['iron'], 'deep', 4).rewards(false); ok(lb.coins > la.coins && lb.xp > la.xp);
});
test('the oath that cuts your health does so through the normal stat path, and only during a run', () => {
  const s = newState(), plain = computeStats(s).maxHp; s.riftOaths = ['frail']; const sworn = computeStats(s).maxHp; near(sworn / plain, 0.75, 0.02); s.riftOaths = []; eq(computeStats(s).maxHp, plain);
  s.riftOaths = ['iron', 'fury']; eq(computeStats(s).maxHp, plain, 'oaths with no personal cost leave you alone'); s.riftOaths = ['nonsense']; eq(computeStats(s).maxHp, plain);
});
test('oaths stack with relics', () => { const s = newState(); s.riftRelics = ['kelp_knot']; const a = computeStats(s).maxHp; s.riftOaths = ['frail']; ok(computeStats(s).maxHp < a); });
test('the history records how many oaths a run carried', () => {
  const g = game(), events = []; g.events.emit = (...a) => events.push(a); g.systems.history = new History(g); const e = g.systems.history.add({ tier: 'Deep Rift', depth: 6, max: 6, success: true, secs: 300, kills: 40, relics: [], rw: { coins: 400 }, oaths: ['iron', 'fury'] }); eq(e.oaths, 2);
  eq(g.systems.history.add({ tier: 'Deep Rift', depth: 6, max: 6, success: true, secs: 300, kills: 40, relics: [], rw: { coins: 400 } }).oaths, 0);
});

// ---- the daily oath -----------------------------------------------------------------------------------------------------------------------------
import { dailyOath } from '../../src/data/oaths.js';
import { OathScene } from '../../src/ui/oath_scene.js';
import { today } from '../../src/world/rift_gen.js';

test('the daily oath is the same all day and everywhere, and a real oath', () => { const d = today(); eq(dailyOath(d), dailyOath(d)); ok(OATHS[dailyOath(d)]); eq(dailyOath(20260101), dailyOath(20260101)); });
test('over a year the daily oath visits every oath', () => { const seen = new Set(); for (let d = 0; d < 365; d++) seen.add(dailyOath(20260101 + d)); eq(seen.size, OATH_IDS.length); });
test('no oath dominates the calendar', () => { const n = {}; for (let d = 0; d < 1000; d++) { const o = dailyOath(20240101 + d); n[o] = (n[o] || 0) + 1; } for (const id of OATH_IDS) ok(n[id] > 100 && n[id] < 320, `${id}: ${n[id]}`); });
test('a daily run always carries the day\'s oath, once, ahead of the chosen ones', () => {
  const g = game(), R = g.systems.rifts; g.world = { player: { x: 0, y: 0, hp: 5, recalc() {} }, zone: { id: 'reef_garden' } }; g.playScene = { fadeOut() {}, fadeIn() {} }; const day = today(); R.go = () => {};
  R.start({ tier: 'shallow', daily: true, seed: day, oaths: ['iron'] }); const d = dailyOath(day); eq(R.run.oaths[0], d); eq(new Set(R.run.oaths).size, R.run.oaths.length); ok(R.run.oaths.length <= MAX_OATHS); ok(R.run.oaths.includes('iron') || d === 'iron');
  R.run = null; R.start({ tier: 'shallow', oaths: ['fury'] }); eq(R.run.oaths.join(), 'fury', 'an ordinary run has only what was chosen');
});
test('the oath scene will not put down a forced oath, and does not remember it as a preference', () => {
  const popped = [], st = newState(), g = { state: st, audio: { sfx() {} }, engine: { pop: () => popped.push(1) }, input: { pressed: () => false } };
  let got = null; const s = new OathScene(g, 'daily', (o) => { got = o; }, ['haste']); eq(s.picked.join(), 'haste'); s.sel = OATH_IDS.indexOf('haste'); let pressed = 'confirm'; g.input.pressed = (a) => { if (a === pressed) { pressed = null; return true; } return false; }; s.update(0.016);
  eq(s.picked.join(), 'haste', 'still sworn'); ok(s.msgT > 0); s.picked.push('iron'); s.start(); eq(got.join(), 'haste,iron'); eq(st.lastOaths.join(), 'iron', 'only the free choice is remembered');
});
