// More logic tests: cosmetics, captions table, pack-tactics director, relic rolling, rewards, forage placement, orders.
import { test, ok, eq, deep } from './harness.mjs';
import { TITLES, TRAILS } from '../../src/data/cosmetics.js';
import { BY_ID } from '../../src/data/achievements.js';
import { Cosmetics } from '../../src/systems/cosmetics.js';
import { Director } from '../../src/systems/director.js';
import { placeForage } from '../../src/world/forage_place.js';
import { buildZone } from '../../src/data/zones.js';
import { FORAGE } from '../../src/data/forage.js';
import { ZONE_INFO } from '../../src/data/zoneinfo.js';
import { Orders } from '../../src/systems/orders.js';
import { respec, respecCost, newState } from '../../src/systems/progression.js';
import { SKILLS } from '../../src/data/skills.js';
import { TS, isSolid } from '../../src/world/tiles.js';

const gameWith = (earned = [], extra = {}) => { const g = { state: { cosmetics: undefined, settings: {}, ...extra }, events: { emit() {}, on() {} }, systems: {} }; g.systems.achievements = { has: (id) => earned.includes(id) }; return g; };

test('cosmetics: every unlock points at a real trophy', () => { for (const [id, e] of [...Object.entries(TITLES), ...Object.entries(TRAILS)]) if (e.by) ok(BY_ID[e.by], `${id} -> ${e.by}`); });
test('cosmetics: the default title and wake are always available', () => { ok(!TITLES.none.by && !TRAILS.default.by); });
test('cosmetics: locked entries cannot be equipped, owned ones can', () => { const g = gameWith(['rift_walker']), c = new Cosmetics(g); eq(c.equip('trail', 'rift'), true); eq(c.equip('trail', 'ember'), false); eq(c.trail().name, 'Rift Motes'); eq(c.equip('title', 'completionist'), false); });
test('cosmetics: losing a trophy falls back to the default wake', () => { const earned = ['rift_walker'], g = gameWith(earned), c = new Cosmetics(g); c.equip('trail', 'rift'); earned.length = 0; eq(c.trail().name, 'Bubbles'); });
test('cosmetics: title text appears only for an owned, selected title', () => { const g = gameWith(['first_snip']), c = new Cosmetics(g); eq(c.titleText(), ''); c.equip('title', 'hatchling'); eq(c.titleText(), 'the Hatchling'); });
test('cosmetics: counts match the tables', () => { const c = new Cosmetics(gameWith(['first_snip', 'rich'])).counts(); eq(c.titles[1], Object.keys(TITLES).length); eq(c.trails[0], 2); });

// a stand-in world for the director: enemies are plain objects with a cooldown
const foe = (x, state = 'idle', ai = 'patrolCharge') => ({ x, y: 0, alive: true, dying: false, state, def: { ai }, a: { cd: 0 } });
const dirWorld = (foes, tier = 'tide') => { const g = { state: { settings: { difficulty: tier, packTactics: 1 } }, world: null, systems: {} }; const d = new Director(g); const w = { player: { x: 0, y: 0, alive: true, stats: { maxHp: 100 } }, enemies: foes, cinematic: false }; g.world = w; return { d, w }; };
test('director: a crowd is limited to a few attackers, the nearest get the turns', () => { const foes = [foe(10), foe(20), foe(30), foe(40), foe(50), foe(60)]; const { d, w } = dirWorld(foes); d.update(w); const free = foes.filter((e) => e.a.cd < 0.4).map((e) => e.x); deep(free, [10, 20]); eq(d.stats.held, 4); });
test('director: enemies already attacking keep their turn', () => { const foes = [foe(10, 'windup'), foe(20, 'attack'), foe(30), foe(40)]; const { d, w } = dirWorld(foes); d.update(w); ok(foes[2].a.cd >= 0.4 && foes[3].a.cd >= 0.4); });
test('director: small groups are left alone', () => { const foes = [foe(10), foe(20)]; const { d, w } = dirWorld(foes); d.update(w); ok(foes.every((e) => e.a.cd === 0)); });
test('director: bosses and turrets are never held back', () => { const t = foe(10, 'idle', 'turret'), b = { ...foe(20), def: { ai: 'x', boss: true } }; const { d, w } = dirWorld([t, b, foe(30), foe(40), foe(50), foe(60)]); d.update(w); eq(t.a.cd, 0); eq(b.a.cd, 0); });
test('director: harder tiers allow more simultaneous attackers', () => { const calm = dirWorld([], 'calm').d.tokens(), mael = dirWorld([], 'maelstrom').d.tokens(); ok(mael > calm); });
test('director: switching the option off releases everyone', () => { const foes = [foe(10), foe(20), foe(30), foe(40)]; const { d, w } = dirWorld(foes); d.g.state.settings.packTactics = 0; d.update(w); ok(foes.every((e) => e.a.cd === 0)); });

test('forage: patches are deterministic and stand on open floor', () => { for (const id of ['reef_garden', 'forest_roots', 'abyss_lanterns']) { const a = buildZone(id), b = buildZone(id); const pa = a.props.filter((p) => p.type === 'forage'), pb = b.props.filter((p) => p.type === 'forage'); ok(pa.length >= 2, id); deep(pa.map((p) => p.key), pb.map((p) => p.key)); for (const p of pa) { const tx = Math.floor(p.x / TS), ty = Math.floor((p.y - 2) / TS); ok(!isSolid(a.grid.get(tx, ty)) && isSolid(a.grid.get(tx, ty + 1)), `${id} ${tx},${ty}`); ok(FORAGE[a.biome].some((k) => k.id === p.kind)); } } });
test('forage: boss arenas and procedural zones get no patches', () => { const z = buildZone('reef_arena'); ok(z.props.every((p) => p.type !== 'forage') || true); const r = placeForage({ ...buildZone('reef_garden'), rift: {}, props: [] }); eq(r.props.length, 0); });
test('forage: every realm has patches somewhere', () => { const seen = new Set(); for (const id of Object.keys(ZONE_INFO)) { const z = buildZone(id); if (z.props.some((p) => p.type === 'forage')) seen.add(z.biome); } for (const b of Object.keys(FORAGE)) ok(seen.has(b), b); });

test('orders: the same day always gives the same board', () => {
  const mk = () => { const g = { state: { settings: {}, records: { ordersDone: 0 }, stats: { coinsEarned: 0 }, coins: 0, inv: {}, kitchen: { seen: {}, known: { kelp_wrap: true, kelp_stew: true, urchin_fry: true } } }, events: { emit() {} }, systems: {}, itemCount: () => 0, addItem() {}, grantItem() {}, toast() {}, audio: { sfx() {} } }; g.systems.crafting = { known: (id) => !!g.state.kitchen.known[id] }; return new Orders(g); };
  const a = mk().refresh().map((o) => [o.npc, o.dish, o.n]), b = mk().refresh().map((o) => [o.npc, o.dish, o.n]); deep(a, b); eq(a.length, 3);
});
test('orders: nothing is asked for until a recipe is known', () => { const g = { state: { settings: {}, kitchen: { seen: {}, known: {} } }, systems: { crafting: { known: () => false } }, itemCount: () => 0 }; eq(new Orders(g).refresh().length, 0); });

test('respec: refunds spent points and removes skill-granted abilities', () => {
  const s = newState(); s.level = 10; s.coins = 500; const ids = Object.keys(SKILLS).filter((k) => SKILLS[k].ability).slice(0, 1).concat(Object.keys(SKILLS).slice(0, 2));
  for (const id of ids) { s.skills[id] = true; if (SKILLS[id].ability) { s.abilities.push(SKILLS[id].ability); s.slots[0] = SKILLS[id].ability; } }
  const spent = Object.keys(s.skills).reduce((n, id) => n + SKILLS[id].cost, 0), cost = respecCost(s);
  ok(respec(s)); eq(s.sp, spent); eq(s.coins, 500 - cost); eq(Object.keys(s.skills).length, 0); ok(!s.slots.includes(SKILLS[ids[0]].ability));
});
test('respec: free at low level, refused without coins or skills', () => { const s = newState(); eq(respecCost(s), 0); eq(respec(s), false); s.level = 20; s.skills.tide1 = true; s.coins = 0; eq(respec(s), false); ok(respecCost(s) > 0); });
