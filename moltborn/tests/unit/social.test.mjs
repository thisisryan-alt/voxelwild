// Things people say and the scenes that announce things: barks choose the most specific line that applies, stories queue once and
// wait for calm, kitchen orders pay out. All against stubs.
import { test, ok, eq } from './harness.mjs';
import { Barks } from '../../src/systems/barks.js';
import { BARKS } from '../../src/data/barks.js';
import { Story, STORIES } from '../../src/systems/story.js';
import { Orders } from '../../src/systems/orders.js';
import { NPCS } from '../../src/data/npcs.js';
import { RECIPES } from '../../src/data/recipes.js';
import { ITEMS } from '../../src/data/items.js';
import { newState } from '../../src/systems/progression.js';
import { newRecords } from '../../src/systems/stats.js';

function bus() { const m = {}; return { on: (e, f) => (m[e] ||= []).push(f), emit: (e, ...a) => (m[e] || []).forEach((f) => f(...a)) }; }
function base() {
  const state = newState(); state.records = newRecords(); state.stats = { coinsEarned: 0 }; state.flags = {}; state.quests = {}; state.bosses = {};
  const sfx = [], toasts = [];
  const g = { state, events: bus(), systems: {}, world: null, audio: { sfx: (n) => sfx.push(n) }, toast: (m) => toasts.push(m), sfx, toasts, itemCount: (id) => state.inv[id] || 0, addItem: (id, n) => { state.inv[id] = (state.inv[id] || 0) + n; if (state.inv[id] <= 0) delete state.inv[id]; }, grantItem: (id, n = 1) => g.addItem(id, n), setFlag: (f, v = true) => { state.flags[f] = v; } };
  return g;
}

// ---- barks ---------------------------------------------------------------------------------------------------------------------------------------
test('every bark speaker is a real NPC and every conditional line has text and a test', () => { for (const [id, list] of Object.entries(BARKS)) { ok(NPCS[id], id); ok(list.length >= 2, id + ' has lines'); for (const l of list) { if (typeof l === 'string') ok(l.length > 8, id); else { ok(typeof l.when === 'function' && l.text.length > 8, id); } } ok(list.some((l) => typeof l === 'string'), id + ' keeps a plain line to fall back on'); } });
test('a bark line that applies beats the plain ones, and does not repeat back to back', () => {
  const g = base(); g.systems.barks = new Barks(g); const B = g.systems.barks; g.state.bosses.poseidon = true; const first = B.pick('old_brine'); ok(first.includes('tide go still'), first);
  const second = B.pick('old_brine'); ok(!second.includes('tide go still'), 'the same conditional line is not repeated straight away');
});
test('plain barks rotate without immediate repeats', () => { const g = base(); g.systems.barks = new Barks(g); const B = g.systems.barks; let prev = null; for (let i = 0; i < 40; i++) { const t = B.pick('pip'); ok(t !== prev, 'repeat at ' + i); prev = t; } });
test('the new hour-aware lines only apply at the right hour', () => {
  const g = base(); g.systems.barks = new Barks(g); const B = g.systems.barks; g.systems.clock = { phase: { id: 'day' } }; const day = new Set(); for (let i = 0; i < 60; i++) day.add(B.pick('tunny')); ok(![...day].some((t) => t.includes('Night is for the careful fish')));
  g.systems.clock = { phase: { id: 'night' } }; B.last = {}; ok(B.pick('tunny').includes('Night is for the careful fish'));
});

// ---- stories -------------------------------------------------------------------------------------------------------------------------------------
function storyGame(over = {}) {
  const g = base(); g.playScene = { busy: false, lock: false }; g.world = { cinematic: false, boss: null, player: { alive: true, locked: false }, zone: { id: 'reef_garden' }, biome: {} }; Object.assign(g.world, over.world || {}); Object.assign(g.playScene, over.ps || {});
  g.engine = { pushed: [], push(s) { this.pushed.push(s); } }; g.systems.story = new Story(g); return g;
}
test('every story has panels with art and text, and any music it names is either null or a string', () => { for (const [id, S] of Object.entries(STORIES)) { ok(S.panels.length >= 1, id); for (const p of S.panels) ok(p.art && p.text.length > 20, id); ok(S.music === undefined || S.music === null || typeof S.music === 'string', id); } });
test('a story is queued once and never again after it has played', () => { const g = storyGame(), S = g.systems.story; S.add('first_catch'); S.add('first_catch'); eq(S.queue.length, 1); g.state.flags.cs_first_catch = true; S.queue.length = 0; S.add('first_catch'); eq(S.queue.length, 0); S.add('no_such_story'); eq(S.queue.length, 0); });
test('a queued story waits out its delay and plays when the water is calm', () => {
  const g = storyGame(), S = g.systems.story; S.add('first_catch'); const delay = STORIES.first_catch.delay; S.pump(delay - 0.2); eq(g.engine.pushed.length, 0); S.pump(0.5); eq(g.engine.pushed.length, 1); ok(g.state.flags.cs_first_catch); eq(S.queue.length, 0);
});
test('stories hold back during a boss fight, a cinematic, a locked player and a busy scene', () => {
  for (const over of [{ world: { boss: { alive: true, engaged: true } } }, { world: { boss: { alive: true, engaging: true } } }, { world: { boss: { dying: true } } }, { world: { cinematic: true } }, { world: { player: { alive: true, locked: true } } }, { world: { player: { alive: false, locked: false } } }, { ps: { busy: true } }, { ps: { lock: true } }]) {
    const g = storyGame(over), S = g.systems.story; S.add('first_catch'); S.pump(10); eq(g.engine.pushed.length, 0, JSON.stringify(over));
  }
});
test('events queue the right stories and rifts never trigger realm stories', () => {
  const g = storyGame(), S = g.systems.story; g.events.emit('boss', 'rift_warden'); g.events.emit('phase', 'night'); g.events.emit('bounty', {}); g.events.emit('fish', 'moon_koi', 80, {}); const ids = S.queue.map((q) => q.id); for (const id of ['won_warden', 'first_night', 'first_bounty', 'first_catch', 'legend_catch']) ok(ids.includes(id), id);
  const h = storyGame(); h.world.zone = { id: 'rift:1:1:4', biome: 'reef' }; h.world.biome = { name: 'x' }; h.events.emit('zone', 'rift:1:1:4'); eq(h.systems.story.queue.length, 0);
});

// ---- kitchen orders ------------------------------------------------------------------------------------------------------------------------------
function ordersGame() {
  const g = base(); g.world = { player: { x: 0, y: 0 } }; g.giveXp = () => {}; g.systems.crafting = { known: (id) => RECIPES.some((r) => r.id === id) }; g.systems.orders = new Orders(g); return g;
}
test('orders ask only for dishes, in sensible numbers, from people who exist', () => {
  const g = ordersGame(), list = g.systems.orders.refresh(); ok(list.length >= 1 && list.length <= 3); for (const o of list) { ok(NPCS[o.npc], o.npc); ok(['dish', 'consumable'].includes(ITEMS[o.dish].type), o.dish); ok(o.n >= 1 && o.n <= 3); ok(o.coins >= 30); ok(g.systems.orders.line(o).includes(ITEMS[o.dish].name)); }
  eq(new Set(list.map((o) => o.npc)).size, list.length, 'each request comes from someone different');
});
test('an order can be delivered only when the pack has the dish, and then it pays and counts', () => {
  const g = ordersGame(), O = g.systems.orders, o = O.refresh()[0]; ok(!O.canDeliver(o)); eq(O.deliver(o), false); g.addItem(o.dish, o.n); ok(O.canDeliver(o)); ok(O.deliver(o)); eq(g.state.coins, o.coins); eq(g.itemCount(o.dish), 0); ok(o.done); eq(O.state.delivered, 1); eq(g.state.records.ordersDone, 1); ok(!O.canDeliver(o), 'once only'); eq(O.regard(o.npc), 1);
});
test('every third delivery pays a pearl', () => {
  const g = ordersGame(), O = g.systems.orders; const pearls = []; g.grantItem = (id, n) => { if (id === 'pearl') pearls.push(n); g.addItem(id, n); };
  for (let i = 0; i < 6; i++) { const o = { id: 'x' + i, npc: 'pip', dish: 'kelp_wrap', n: 1, coins: 10, done: false }; g.addItem('kelp_wrap', 1); O.deliver(o); } eq(pearls.length, 2); eq(O.state.delivered, 6);
});
test('the board refreshes when the day changes but keeps today\'s progress', () => { const g = ordersGame(), O = g.systems.orders, a = O.refresh(); a[0].done = true; eq(O.refresh()[0].done, true); O.state.day = 1; const b = O.refresh(); ok(b[0].done === false || b !== a); });
