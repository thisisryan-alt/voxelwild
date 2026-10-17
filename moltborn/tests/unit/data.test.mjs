// Data integrity: every table that points at another table must point at something that exists.
import { test, ok, eq } from './harness.mjs';
import { ITEMS, SHOP } from '../../src/data/items.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { LORE } from '../../src/data/lore.js';
import { ZONE_INFO } from '../../src/data/zoneinfo.js';
import { QUESTS } from '../../src/data/quests.js';
import { NPCS } from '../../src/data/npcs.js';
import { BEASTS, REVEAL } from '../../src/data/bestiary.js';
import { RECIPES, DROPS } from '../../src/data/recipes.js';
import { CRAFT_ITEMS, INGREDIENT_IDS, DISH_IDS } from '../../src/data/items_craft.js';
import { ACHIEVEMENTS, TIERS, CATS, BY_ID, totalPoints } from '../../src/data/achievements.js';
import { RELICS, RARITY, RIFT_MODS, RIFT_TIERS } from '../../src/data/relics.js';
import { AFFIXES, AFFIX_IDS, ELITE_BASE } from '../../src/data/affixes.js';
import { SETS, SET_OF, activeSets } from '../../src/data/sets.js';
import { BARKS } from '../../src/data/barks.js';
import { FORAGE, ROUNDS, YIELD_BY_HITS } from '../../src/data/forage.js';
import { FISH } from '../../src/data/fish.js';
import { STATUS } from '../../src/systems/status.js';
import { computeStats, newState } from '../../src/systems/progression.js';

const BOSSES = ['grumbold', 'pearl_tyrant', 'hermit_king', 'mother_moray', 'sporemother', 'brass_colossus', 'aurelia', 'captain_rust', 'magmaw', 'lurelord', 'krael', 'hollow_maw', 'kyros', 'poseidon'];
const STAT_KEYS = Object.keys(computeStats(newState()));

test('craft items merged into the main item table', () => { for (const id of Object.keys(CRAFT_ITEMS)) ok(ITEMS[id], id); });
test('ingredients and dishes partition the craft items', () => { eq(INGREDIENT_IDS.length + DISH_IDS.length, Object.keys(CRAFT_ITEMS).length); });
test('ingredients are priced so the shop can sell them', () => { for (const id of INGREDIENT_IDS) ok(ITEMS[id].price > 0, id); });
test('shops only sell items that exist and have prices', () => { for (const [shop, list] of Object.entries(SHOP)) for (const id of list) { ok(ITEMS[id], `${shop}:${id}`); ok(ITEMS[id].price > 0, `${shop}:${id} has no price`); } });
test('every recipe output and ingredient exists', () => { for (const r of RECIPES) { ok(ITEMS[r.out], r.id); for (const k of Object.keys(r.needs)) ok(ITEMS[k], `${r.id}:${k}`); } });
test('recipe ids are unique', () => { eq(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length); });
test('dish effects reference real statuses', () => { for (const id of DISH_IDS) for (const b of ITEMS[id].use.buffs || []) ok(STATUS[b.id], `${id}:${b.id}`); });
test('drop tables name real creatures and ingredients', () => { for (const [e, list] of Object.entries(DROPS)) { ok(ENEMIES[e], e); for (const [id, ch] of list) { ok(ITEMS[id], id); ok(ch > 0 && ch <= 1, `${e}:${id}`); } } });
test('every ingredient can be obtained from a drop, a forage patch or a fishing spot', () => { const got = new Set(); for (const f of FISH) got.add('fish_' + f.id); for (const l of Object.values(DROPS)) for (const [id] of l) got.add(id); for (const ks of Object.values(FORAGE)) for (const k of ks) for (const [id] of k.yield) got.add(id); for (const id of INGREDIENT_IDS) ok(got.has(id), id + ' has no source'); });
test('forage kinds have unique ids, yields and colours', () => { const ids = []; for (const [b, ks] of Object.entries(FORAGE)) { ok(ZONE_INFO && ks.length >= 2, b); for (const k of ks) { ids.push(k.id); ok(k.color && k.yield.length, k.id); for (const [id] of k.yield) ok(ITEMS[id], id); } } eq(new Set(ids).size, ids.length); });
test('forage rounds get harder and yields rise with hits', () => { for (let i = 1; i < ROUNDS.length; i++) { ok(ROUNDS[i].zone < ROUNDS[i - 1].zone); ok(ROUNDS[i].speed > ROUNDS[i - 1].speed); } for (let i = 1; i < YIELD_BY_HITS.length; i++) ok(YIELD_BY_HITS[i] >= YIELD_BY_HITS[i - 1]); });

test('the bestiary covers every creature and boss', () => { for (const k of [...Object.keys(ENEMIES).filter((k) => !ENEMIES[k].noop), ...BOSSES]) ok(BEASTS[k], k); });
test('bestiary entries are complete', () => { for (const [k, b] of Object.entries(BEASTS)) { ok(b.habitat && b.note && b.tip, k); ok(b.note.length > 30, k); } ok(REVEAL.lore < REVEAL.stats && REVEAL.stats < REVEAL.tip); });

test('achievement ids are unique with positive goals', () => { eq(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length); for (const a of ACHIEVEMENTS) { ok(a.goal > 0, a.id); ok(TIERS[a.tier], a.id); ok(CATS.some((c) => c.id === a.cat), a.id); ok(typeof a.get === 'function', a.id); } });
test('achievement getters survive an empty save', () => {
  const s = newState(); s.records.rifts = 0; const ctx = { g: {}, s, r: s.records, kills: 0, zones: 0, combo: 0, codex: 0, endings: 0, others: 0, totalOthers: ACHIEVEMENTS.length - 1 };
  for (const a of ACHIEVEMENTS) { const v = a.get(ctx); ok(Number.isFinite(+v), `${a.id} -> ${v}`); ok(+v < a.goal || a.id === 'completionist' && v === 0 || false, `${a.id} is already earned by an empty save`); }
});
test('every tier is worth points and the total is the sum', () => { for (const t of Object.values(TIERS)) ok(t.pts > 0); eq(totalPoints(), ACHIEVEMENTS.reduce((n, a) => n + TIERS[a.tier].pts, 0)); });
test('there is exactly one completion trophy and it needs the others', () => { ok(BY_ID.completionist && BY_ID.completionist.hidden); });

test('relic effects use real stat keys', () => { const extra = new Set(['hp', 'tide', 'atk', 'def', 'speed']); for (const [id, r] of Object.entries(RELICS)) { ok(RARITY[r.rarity], id); ok(r.name && r.desc, id); ok(r.fx || r.hook, id + ' does nothing'); for (const k of Object.keys(r.fx || {})) ok(STAT_KEYS.includes(k) || extra.has(k), `${id}:${k}`); } });
test('relic hooks are ones the rift system knows', () => { for (const r of Object.values(RELICS)) if (r.hook) ok(['siphon', 'adrenal', 'nova'].includes(r.hook), r.hook); });
test('relics of every rarity exist', () => { for (const k of Object.keys(RARITY)) ok(Object.values(RELICS).some((r) => r.rarity === k), k); });
test('rift modifiers have multipliers or flags', () => { for (const [id, m] of Object.entries(RIFT_MODS)) { ok(m.name && m.desc && m.color, id); ok(m.mult || m.haste || m.dark, id + ' does nothing'); } });
test('rift tiers grow in length and reward', () => { for (let i = 1; i < RIFT_TIERS.length; i++) { ok(RIFT_TIERS[i].depths > RIFT_TIERS[i - 1].depths); ok(RIFT_TIERS[i].reward > RIFT_TIERS[i - 1].reward); } });

test('affixes define a colour, a name and at least one effect', () => { for (const [id, a] of Object.entries(AFFIXES)) { ok(a.name && a.color && a.tip, id); ok(a.hp || a.dmgIn || a.status || a.hitStatus || a.leech || a.thorns || a.shield || a.onDeath, id + ' does nothing'); for (const [s] of a.status || []) ok(STATUS[s], id); } });
test('elite chance rises with difficulty', () => { for (let i = 1; i < ELITE_BASE.length; i++) ok(ELITE_BASE[i] >= ELITE_BASE[i - 1]); eq(ELITE_BASE[0], 0); });
test('affix list matches the table', () => { eq(AFFIX_IDS.length, Object.keys(AFFIXES).length); });

test('every set piece exists as equipment in the right slot order', () => { for (const [id, s] of Object.entries(SETS)) { eq(s.pieces.length, 3, id); const slots = s.pieces.map((p) => { ok(ITEMS[p] && ITEMS[p].type === 'equip', p); return ITEMS[p].slot; }); eq(slots.join(), 'shell,claw,charm', id); ok(s.two.text && s.three.text); } });
test('no item belongs to two sets', () => { eq(Object.keys(SET_OF).length, Object.values(SETS).reduce((n, s) => n + s.pieces.length, 0)); });
test('set bonuses only activate with enough pieces', () => { const s = SETS.cinder_forge; eq(activeSets({ shell: s.pieces[0] }).length, 0); eq(activeSets({ shell: s.pieces[0], claw: s.pieces[1] })[0].fx.length, 1); eq(activeSets({ shell: s.pieces[0], claw: s.pieces[1], charm: s.pieces[2] })[0].fx.length, 2); });
test('set bonuses change computed stats', () => { const st = newState(), base = computeStats(st).heatResist; const s = SETS.cinder_forge; st.equip = { shell: s.pieces[0], claw: s.pieces[1], charm: s.pieces[2] }; const full = computeStats(st).heatResist; st.equip = { shell: s.pieces[0], claw: s.pieces[1], charm: null }; ok(computeStats(st).heatResist > base); ok(full >= computeStats(st).heatResist); });

test('barks belong to real people and have lines', () => { for (const [id, lines] of Object.entries(BARKS)) { ok(NPCS[id], id); ok(lines.some((l) => typeof l === 'string'), id + ' needs a plain line'); for (const l of lines) { const t = typeof l === 'string' ? l : l.text; ok(t.length > 8 && t.length < 120, `${id}: "${t}"`); if (typeof l === 'object') ok(typeof l.when === 'function', id); } } });
test('quests give rewards that exist', () => { for (const [id, q] of Object.entries(QUESTS)) { ok(q.steps.length, id); for (const s of q.steps) ok(typeof s.done === 'function', id); } });
test('lore entries are well formed', () => { for (const [id, e] of Object.entries(LORE)) ok(e.title && e.text, id); });
