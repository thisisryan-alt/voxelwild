// More systems against stubs: cooking and recipe discovery, elite rolls, trophies, fast travel, accessibility palettes and the
// progression curve. Each test builds the smallest game that lets the system run.
import { test, ok, eq, near } from './harness.mjs';
import { Crafting } from '../../src/systems/crafting.js';
import { Elites } from '../../src/systems/affixes.js';
import { Achievements } from '../../src/systems/achievements.js';
import { Travel } from '../../src/systems/travel.js';
import { Access } from '../../src/systems/access.js';
import { RECIPES, RECIPE_BY_ID } from '../../src/data/recipes.js';
import { ITEMS } from '../../src/data/items.js';
import { AFFIXES, AFFIX_IDS, ELITE_BASE, ELITE_NG, ELITE_CAP, NO_AFFIX } from '../../src/data/affixes.js';
import { ACHIEVEMENTS, TIERS, BY_ID } from '../../src/data/achievements.js';
import { ZONE_INFO } from '../../src/data/zoneinfo.js';
import { DIFFICULTIES, defaults } from '../../src/systems/settings.js';
import { newState, grantXp, canBuySkill, computeStats } from '../../src/systems/progression.js';
import { xpToNext } from '../../src/data/forms.js';
import { SKILLS } from '../../src/data/skills.js';
import { newRecords } from '../../src/systems/stats.js';
import { StatusSet } from '../../src/systems/status.js';

function bus() { const m = {}; return { on: (e, f) => (m[e] ||= []).push(f), emit: (e, ...a) => (m[e] || []).forEach((f) => f(...a)) }; }
function base(over = {}) {
  const state = newState(); state.records = newRecords(); state.stats = { coinsEarned: 0, secrets: 0 }; state.settings = { ...defaults(), ...(over.settings || {}) }; state.visited = {};
  const toasts = [], popups = [];
  const g = {
    state, systems: {}, events: bus(), toasts, popups, world: over.world || null, audio: { sfx() {} }, toast: (m) => toasts.push(m), popup: (...a) => popups.push(a), engine: { pop() {} },
    itemCount: (id) => state.inv[id] || 0, addItem: (id, n) => { state.inv[id] = (state.inv[id] || 0) + n; if (state.inv[id] <= 0) delete state.inv[id]; },
    grantItem: (id, n = 1) => { g.addItem(id, n); g.events.emit('gotitem', id, n); }, hasItem: (id) => (state.inv[id] || 0) > 0,
  };
  return g;
}

// ---- crafting -----------------------------------------------------------------------------------------------------------------------------------
test('a recipe is learned the first time every ingredient has been held, and announced once', () => {
  const g = base(); g.systems.crafting = new Crafting(g); const C = g.systems.crafting;
  ok(!C.known('kelp_wrap')); g.grantItem('kelp_frond', 1); ok(C.known('kelp_wrap'), 'holding the ingredient once is enough to learn the recipe'); ok(g.toasts.some((t) => t.includes('Kelp Wrap')));
  const n = g.toasts.length; g.grantItem('kelp_frond', 1); eq(g.toasts.length, n, 'no repeat');
});
test('discovery tracks what has been seen, not what is held now', () => { const g = base(); g.systems.crafting = new Crafting(g); g.grantItem('kelp_frond'); g.addItem('kelp_frond', -1); g.grantItem('brine_salt'); ok(g.systems.crafting.kitchen.seen.kelp_frond && g.systems.crafting.kitchen.seen.brine_salt); });
test('only ingredients and pearls count towards discovery', () => { const g = base(); g.systems.crafting = new Crafting(g); g.grantItem('kelp_wrap'); g.grantItem('captain_key'); eq(Object.keys(g.systems.crafting.kitchen.seen).length, 0); g.grantItem('pearl'); ok(g.systems.crafting.kitchen.seen.pearl); });
test('cooking consumes the ingredients, yields the dish, and records it', () => {
  const g = base(); g.systems.crafting = new Crafting(g); const C = g.systems.crafting; g.grantItem('kelp_frond', 4); g.grantItem('brine_salt', 2);
  ok(C.known('kelp_stew')); eq(C.maxBatches(RECIPE_BY_ID.kelp_stew), 2); eq(C.craft('kelp_stew', 2), 2); eq(g.itemCount('kelp_stew'), 2); eq(g.itemCount('kelp_frond'), 0); eq(g.itemCount('brine_salt'), 0); eq(g.state.records.crafted, 2); eq(g.state.records.craftedBy.kelp_stew, 2);
});
test('you cannot cook what you do not know or cannot afford', () => {
  const g = base(); g.systems.crafting = new Crafting(g); const C = g.systems.crafting; eq(C.craft('kelp_stew'), false, 'unknown'); g.grantItem('kelp_frond', 2); g.grantItem('brine_salt', 1); g.addItem('kelp_frond', -2);
  eq(C.craft('kelp_stew'), false, 'missing'); eq(C.missing(RECIPE_BY_ID.kelp_stew).length, 1); eq(C.missing(RECIPE_BY_ID.kelp_stew)[0][0], 'kelp_frond'); eq(C.craft('nonsense'), false);
});
test('batches that make several (bait) credit every piece', () => { const g = base(); g.systems.crafting = new Crafting(g); g.grantItem('kelp_frond', 2); g.grantItem('brine_salt', 1); ok(g.systems.crafting.known('bait_kelp')); eq(g.systems.crafting.craft('bait_kelp'), 2); eq(g.itemCount('bait_kelp'), 2); eq(g.state.records.crafted, 2); });
test('known recipes are counted', () => { const g = base(); g.systems.crafting = new Crafting(g); eq(g.systems.crafting.knownCount(), 0); g.grantItem('kelp_frond', 5); g.grantItem('brine_salt', 5); ok(g.systems.crafting.knownCount() >= 3); ok(g.systems.crafting.knownCount() <= RECIPES.length); });
test('every dish can actually be cooked from ingredients that exist', () => { for (const r of RECIPES) { for (const k of Object.keys(r.needs)) { ok(ITEMS[k], r.id + ':' + k); ok(ITEMS[k].type === 'ingredient' || k === 'pearl', `${r.id} needs ${k} (${ITEMS[k]?.type})`); } ok(r.n >= 1 && r.n <= 3); } });

// ---- elites ---------------------------------------------------------------------------------------------------------------------------------------
function elitesGame(difficulty = 'tide', ng = 0, depth = 0) {
  const g = base({ settings: { difficulty } }); g.state.ng = ng; g.systems.elites = new Elites(g); g.systems.rifts = { run: depth ? { depth } : null, eliteBonus: () => 0 }; return g;
}
function foe(type, o = {}) { return { type, def: { name: type, dmg: 5, ...(o.def || {}) }, maxHp: 100, hp: 100, xpMult: 1, status: new StatusSet({}), ...o }; }
function worldOf(foes, seed = 5, o = {}) { return { zone: { seed, safe: false, ...o }, enemies: foes }; }
test('elite chance follows the difficulty tier, New Game+ and rift depth, and is capped', () => {
  const w = worldOf([]); DIFFICULTIES.forEach((d, i) => near(elitesGame(d).systems.elites.chance(w), ELITE_BASE[i], 1e-9));
  near(elitesGame('rip', 2).systems.elites.chance(w), ELITE_BASE[2] + 2 * ELITE_NG, 1e-9); near(elitesGame('tide', 0, 4).systems.elites.chance(w), ELITE_BASE[1] + 0.12, 1e-9); eq(elitesGame('maelstrom', 5, 20).systems.elites.chance(w), ELITE_CAP);
});
test('calm mode has no elites at all', () => { const g = elitesGame('calm'), foes = Array.from({ length: 40 }, (_, i) => foe('pinchling')); g.systems.elites.roll(worldOf(foes)); ok(foes.every((f) => !f.affixes)); });
test('safe zones and the gauntlet never roll elites', () => { const g = elitesGame('maelstrom'); for (const extra of [{ safe: true }, { arena: {} }]) { const foes = Array.from({ length: 30 }, () => foe('pinchling')); g.systems.elites.roll(worldOf(foes, 5, extra)); ok(foes.every((f) => !f.affixes)); } });
test('bosses, friends, harmless things and excluded kinds are never elite', () => {
  const g = elitesGame('maelstrom', 5), foes = [foe('b', { def: { boss: true, dmg: 9 } }), foe('f', { def: { friendly: true, dmg: 9 } }), foe('h', { def: { dmg: 0 } }), ...[...NO_AFFIX].map((t) => foe(t)), ...Array.from({ length: 40 }, () => foe('pinchling'))];
  g.systems.elites.roll(worldOf(foes)); for (const f of foes.slice(0, 3 + NO_AFFIX.size)) ok(!f.affixes, f.type); ok(foes.slice(3 + NO_AFFIX.size).some((f) => f.affixes), 'ordinary foes do roll');
});
test('the same zone seed always crowns the same foes', () => {
  const run = () => { const g = elitesGame('maelstrom', 3), foes = Array.from({ length: 30 }, () => foe('pinchling')); g.systems.elites.roll(worldOf(foes, 99)); return foes.map((f) => (f.affixes || []).join('+')).join('|'); };
  eq(run(), run()); ok(run().length > 30);
});
test('rolled affixes are real, distinct within a foe, and one or two in number', () => {
  const g = elitesGame('maelstrom', 5, 4), foes = Array.from({ length: 200 }, () => foe('pinchling')); g.systems.elites.roll(worldOf(foes, 7)); let two = 0;
  for (const f of foes.filter((x) => x.affixes)) { ok(f.affixes.length >= 1 && f.affixes.length <= 2); eq(new Set(f.affixes).size, f.affixes.length); for (const a of f.affixes) ok(AFFIXES[a], a); if (f.affixes.length === 2) two++; } ok(two > 0, 'some have two');
});
test('applying affixes changes health, shield, status, reward and name', () => {
  const g = elitesGame(), e = foe('hermit', { def: { name: 'Hermit Bruiser', dmg: 9 } }); g.systems.elites.apply(e, ['armored', 'shielded', 'mending']);
  eq(e.maxHp, 144, 'armored then mending: 100 -> 125 -> 144'); eq(e.hp, e.maxHp); eq(e.shield, AFFIXES.shielded.shield); ok(e.status.has('regen')); ok(e.xpMult > 1.5); ok(e.name.includes('Armored') && e.name.includes('Shielded') && e.name.endsWith('Hermit Bruiser')); ok(e.elite);
});
test('every affix has a name, colour, tip and a sane reward', () => { for (const id of AFFIX_IDS) { const A = AFFIXES[id]; ok(A.name && /^#/.test(A.color) && A.tip.length > 15, id); ok(!A.xp || (A.xp >= 1 && A.xp <= 2), id); ok(!A.hp || A.hp > 1, id); } });

// ---- trophies -----------------------------------------------------------------------------------------------------------------------------------
function trophyGame() { const g = base(); g.systems.stats = { zonesSeen: () => 0 }; g.systems.codex = { count: () => 0 }; g.systems.achievements = new Achievements(g); return g; }
test('trophies start unearned and progress is clamped to the goal', () => {
  const g = trophyGame(), A = g.systems.achievements; eq(A.count(), 0); eq(A.points(), 0); eq(A.total(), ACHIEVEMENTS.length);
  const ctx = A.context(); for (const a of ACHIEVEMENTS) { const p = A.progress(a, ctx); ok(p >= 0 && p <= a.goal, a.id); }
});
test('a trophy whose goal is reached can be awarded, and only once', () => {
  const g = trophyGame(), A = g.systems.achievements, a = BY_ID.angler; g.state.records.fished = 30; ok(A.progress(a) >= a.goal); ok(A.award(a, true)); ok(A.has('angler')); eq(A.award(a, true), false); eq(A.count(), 1);
});
test('points follow the tier of what has been earned', () => { const g = trophyGame(), A = g.systems.achievements; A.award(BY_ID.angler, true); A.award(BY_ID.fish_log, true); eq(A.points(), TIERS[BY_ID.angler.tier].pts + TIERS[BY_ID.fish_log.tier].pts); });
test('a broken getter reads as no progress instead of crashing the pass', () => { const g = trophyGame(), A = g.systems.achievements; eq(A.progress({ goal: 5, get: () => { throw new Error('x'); } }), 0); eq(A.progress({ goal: 5, get: () => undefined }), 0); eq(A.progress({ goal: 5, get: () => 99 }), 5); });
test('trophy ids are unique and every tier exists', () => { eq(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length); for (const a of ACHIEVEMENTS) { ok(TIERS[a.tier], a.id); ok(a.goal > 0 && a.name.length > 2 && a.desc.length > 10, a.id); } });

// ---- fast travel -------------------------------------------------------------------------------------------------------------------------------
test('shrines are remembered only for real zones and listed west to east', () => {
  const g = base(); g.systems.travel = new Travel(g); const T = g.systems.travel; T.remember('forest_roots'); T.remember('reef_nursery'); T.remember('nowhere'); T.remember('kingdom_gate', 'east');
  const l = T.list(); eq(l.length, 3); for (let i = 1; i < l.length; i++) ok(ZONE_INFO[l[i]].map.x >= ZONE_INFO[l[i - 1]].map.x); eq(T.shrines.kingdom_gate, 'east'); eq(T.shrines.forest_roots, 'rest');
});
test('travel is refused away from a shrine, in a run, in a boss fight and in combat', () => {
  const g = base(), T = (g.systems.travel = new Travel(g)); eq(T.blocked(), 'Not now');
  g.world = { player: { combatT: 0 }, boss: null, near: null, zone: { id: 'reef_garden' } }; ok(/Pearl Shrine/.test(T.blocked())); g.systems.rifts = { active: true }; eq(T.blocked(), 'Not inside a run'); g.systems.rifts = { active: false };
  g.world.boss = { engaged: true, alive: true }; eq(T.blocked(), 'Not during a boss fight');
});
test('travelling to a place you have not rested at does nothing', () => { const g = base(); g.systems.travel = new Travel(g); eq(g.systems.travel.go('forest_roots'), false); });

// ---- accessibility ---------------------------------------------------------------------------------------------------------------------------------
test('telegraph colours are swapped only in the matching colour-blind mode, case-insensitively', () => {
  const off = new Access(base()); eq(off.tele('#ff4a3a'), '#ff4a3a');
  const rg = new Access(base({ settings: { colorblind: 'red-green' } })); eq(rg.tele('#FF4A3A'), '#ff3aa8'); eq(rg.tele('#123456'), '#123456'); const by = new Access(base({ settings: { colorblind: 'blue-yellow' } })); eq(by.tele('#7a62c8'), '#ff3a3a'); eq(by.tele('#ff4a3a'), '#ff4a3a');
});
test('high contrast follows its setting', () => { ok(!new Access(base()).contrast); ok(new Access(base({ settings: { highContrast: 1 } })).contrast); });

// ---- progression -----------------------------------------------------------------------------------------------------------------------------------
test('experience carries over levels, awards a skill point each, and stops at the cap', () => {
  const s = newState(); eq(s.level, 1); const r = grantXp(s, xpToNext(1) + xpToNext(2) + 5); eq(r.levels, 2); eq(s.level, 3); eq(s.xp, 5); eq(s.sp, 2);
  const c = newState(); c.level = 30; eq(grantXp(c, 99999).levels, 0); eq(c.level, 30); eq(c.xp, 0);
});
test('the experience curve rises with every level', () => { for (let lv = 1; lv < 30; lv++) ok(xpToNext(lv + 1) > xpToNext(lv), 'level ' + lv); });
test('stats grow with level and with gear', () => {
  const lo = computeStats(newState()), s = newState(); s.level = 20; const hi = computeStats(s); ok(hi.maxHp > lo.maxHp && hi.atk > lo.atk && hi.maxTide > lo.maxTide);
  const g = newState(); g.equip.charm = 'charm_lure'; g.inv.charm_lure = 1; ok(computeStats(g).fishLuck > 0 && computeStats(g).maxHp === lo.maxHp);
});
test('a skill cannot be bought twice, without points, or before its prerequisite', () => {
  const ids = Object.keys(SKILLS), root = ids.find((id) => !SKILLS[id].req || !SKILLS[id].req.length), s = newState(); s.sp = 0; ok(!canBuySkill(s, root), 'no points'); s.sp = 5; ok(canBuySkill(s, root)); s.skills[root] = true; ok(!canBuySkill(s, root), 'already owned');
  const child = ids.find((id) => SKILLS[id].req && SKILLS[id].req.length && !SKILLS[id].req.every((r) => s.skills[r])); if (child) ok(!canBuySkill(s, child), 'prerequisite missing');
});
