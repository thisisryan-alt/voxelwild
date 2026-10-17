// Selling: prices, what each buyer wants, coins and records, the hour of the day.
import { test, ok, eq } from './harness.mjs';
import { Market, BUYERS } from '../../src/systems/market.js';
import { ITEMS } from '../../src/data/items.js';
import { FISH_BY_ID, FISH } from '../../src/data/fish.js';
import { newState, computeStats } from '../../src/systems/progression.js';
import { newRecords } from '../../src/systems/stats.js';
import { QUESTS } from '../../src/data/quests.js';
import { NPCS } from '../../src/data/npcs.js';
import { DIALOGUE } from '../../src/data/dialogue.js';

function game(inv = {}) {
  const state = newState(); state.records = newRecords(); state.stats = { coinsEarned: 0 }; state.coins = 0; state.inv = { ...inv }; const events = [];
  const g = { state, systems: {}, events: { emit: (...a) => events.push(a) }, evs: events, itemCount: (id) => state.inv[id] || 0, addItem: (id, n) => { state.inv[id] = (state.inv[id] || 0) + n; if (state.inv[id] <= 0) delete state.inv[id]; } };
  g.systems.market = new Market(g); return g;
}

test('buyers exist as NPCs and want something sensible', () => { for (const [id, B] of Object.entries(BUYERS)) { ok(NPCS[id], id); ok(B.fish > 0 && B.fish <= 1.2, id); for (const r of Object.values(B.types)) ok(r > 0 && r <= 1, id); } });
test('a fish sells for its species value to the fishmonger', () => { const g = game({ fish_silverfin: 3 }), M = g.systems.market; eq(M.price('tunny', 'fish_silverfin'), FISH_BY_ID.silverfin.value); eq(M.price('marlin', 'fish_silverfin'), Math.round(FISH_BY_ID.silverfin.value * 0.7)); });
test('every fish has a positive price from both buyers', () => { const M = game().systems.market; for (const f of FISH) { ok(M.price('tunny', 'fish_' + f.id) >= 1, f.id); ok(M.price('marlin', 'fish_' + f.id) >= 1, f.id); } });
test('rarer fish are worth more', () => { const M = game().systems.market; ok(M.price('tunny', 'fish_moon_koi') > M.price('tunny', 'fish_pearlfin') && M.price('tunny', 'fish_pearlfin') > M.price('tunny', 'fish_silverfin')); });
test('buyers only take what they list', () => { const M = game().systems.market; eq(M.price('tunny', 'pearl'), 0); eq(M.price('tunny', 'kelp_wrap'), 0); eq(M.price('tunny', 'nonsense'), 0); eq(M.price('nobody', 'fish_silverfin'), 0); ok(M.price('tunny', 'kelp_frond') > 0); eq(M.price('marlin', 'kelp_stew'), 0, 'marlin does not buy dishes'); ok(M.price('tunny', 'kelp_stew') > 0); });
test('ingredients sell for less than they cost to buy', () => { const M = game().systems.market; for (const id of ['kelp_frond', 'brine_salt', 'urchin_spine']) ok(M.price('tunny', id) < ITEMS[id].price, id); });
test('the sellable list is the pack filtered and sorted by price', () => {
  const g = game({ fish_silverfin: 2, fish_moon_koi: 1, pearl: 4, kelp_frond: 5 }), l = g.systems.market.sellable('tunny');
  eq(l.length, 3); eq(l[0].id, 'fish_moon_koi'); ok(l[0].price >= l[1].price && l[1].price >= l[2].price); ok(!l.some((e) => e.id === 'pearl')); eq(l.find((e) => e.id === 'kelp_frond').n, 5);
});
test('selling takes items and pays coins', () => { const g = game({ fish_silverfin: 3 }), M = g.systems.market, c = M.sell('tunny', 'fish_silverfin', 2); eq(c, FISH_BY_ID.silverfin.value * 2); eq(g.state.coins, c); eq(g.state.inv.fish_silverfin, 1); eq(g.state.stats.coinsEarned, c); });
test('you cannot sell more than you have, or what is not wanted', () => { const g = game({ fish_silverfin: 2, pearl: 3 }), M = g.systems.market; eq(M.sell('tunny', 'fish_silverfin', 99), FISH_BY_ID.silverfin.value * 2); eq(g.state.inv.fish_silverfin, undefined); eq(M.sell('tunny', 'fish_silverfin', 1), 0); eq(M.sell('tunny', 'pearl', 3), 0); eq(g.state.inv.pearl, 3); });
test('records and events follow every sale', () => { const g = game({ fish_silverfin: 2, kelp_frond: 4 }), M = g.systems.market; M.sell('tunny', 'fish_silverfin', 2); M.sell('tunny', 'kelp_frond', 4); const r = g.state.records; eq(r.sold, 6); eq(r.fishSold, 2); eq(r.soldCoins, g.state.coins); eq(g.evs.filter((e) => e[0] === 'sold').length, 2); });
test('sell all clears everything wanted and nothing else', () => { const g = game({ fish_silverfin: 2, fish_reef_bream: 1, pearl: 2, kelp_wrap: 1 }), M = g.systems.market, total = M.sellAll('tunny'); ok(total > 0); eq(g.state.coins, total); eq(Object.keys(g.state.inv).sort().join(), 'kelp_wrap,pearl'); });
test('dusk pays better through the clock multiplier, and night does not change prices', () => {
  const g = game(); let mult = 1; g.systems.clock = { mult: () => ({ coin: mult }) }; const M = g.systems.market, base = M.price('tunny', 'fish_moon_koi');
  mult = 1.1; const dusk = M.price('tunny', 'fish_moon_koi'); ok(dusk > base, `${dusk} > ${base}`); eq(dusk, Math.round(base * 1.1)); mult = 1; eq(M.price('tunny', 'fish_moon_koi'), base);
  g.systems.clock = { mult: () => null }; eq(M.price('tunny', 'fish_moon_koi'), base, 'clock off');
});
test('the lure charm is a charm with the new luck stat', () => { const it = ITEMS.charm_lure; ok(it && it.type === 'equip' && it.slot === 'charm' && it.fx.fishLuck > 0); const s = newState(); s.equip.charm = 'charm_lure'; s.inv.charm_lure = 1; ok(computeStats(s).fishLuck > 0, 'stat applied'); eq(computeStats(newState()).fishLuck, 0); });
test('the fishing quest is wired to a dialogue and its steps are checkable', () => {
  const q = QUESTS.sq_catch; ok(q && q.giver === 'tunny' && q.steps.length === 4); ok(DIALOGUE.tunny, 'dialogue exists');
  const g = { state: { records: newRecords(), fish: { species: {} }, flags: {} }, flag: (f) => !!g.state.flags[f], hasItem: () => false }; eq(q.steps.filter((s) => s.done(g)).length, 0);
  g.state.records.fished = 5; g.state.fish.species = { a: 1, b: 1, c: 1 }; g.state.records.fishSold = 1; eq(q.steps.filter((s) => s.done(g)).length, 3); g.state.flags.tunny_sunfish = true; eq(q.steps.filter((s) => s.done(g)).length, 4);
});
