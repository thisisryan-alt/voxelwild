// Menu scenes driven with a scripted input: navigation, toggling, selling, claiming, paging. Nothing is drawn; these check the
// logic that sits in each scene's update().
import { test, ok, eq } from './harness.mjs';
import { OathScene } from '../../src/ui/oath_scene.js';
import { SellScene } from '../../src/ui/sell_scene.js';
import { BountyScene } from '../../src/ui/bounty_scene.js';
import { BoardScene } from '../../src/ui/board_scene.js';
import { HelpScene } from '../../src/ui/help_scene.js';
import { HallScene } from '../../src/ui/hall_scene.js';
import { MAX_OATHS, OATH_IDS } from '../../src/data/oaths.js';
import { PAGES } from '../../src/data/help.js';
import { Market } from '../../src/systems/market.js';
import { Bounties } from '../../src/systems/bounties.js';
import { History } from '../../src/systems/history.js';
import { Journal } from '../../src/systems/journal.js';
import { Rifts } from '../../src/systems/rifts.js';
import { REROLL_COST } from '../../src/data/bounties.js';
import { newState } from '../../src/systems/progression.js';
import { newRecords } from '../../src/systems/stats.js';

// a scripted input: queue('confirm', 'down') presses those on the next update calls, one per call
function input() { const q = []; return { queue: (...a) => q.push(...a), pressed(a) { if (q[0] === a) { q.shift(); return true; } return false; }, isDown: () => false, peek: () => q[0], drop: () => q.shift(), size: () => q.length }; }
function game(over = {}) {
  const state = newState(); state.records = newRecords(); state.stats = { coinsEarned: 0 }; state.visited = {}; state.bosses = {}; state.flags = {}; Object.assign(state, over);
  const sfx = [], popped = [], pushed = [];
  const g = { state, systems: {}, input: input(), audio: { sfx: (n) => sfx.push(n), setMuffle() {} }, engine: { pop: () => popped.push(1), push: (s) => pushed.push(s) }, events: { on() {}, emit() {} }, toast() {}, setFlag() {}, popped, pushed, sfx,
    itemCount: (id) => state.inv[id] || 0, addItem: (id, n) => { state.inv[id] = (state.inv[id] || 0) + n; if (state.inv[id] <= 0) delete state.inv[id]; }, grantItem: (id, n = 1) => g.addItem(id, n), giveXp() {}, world: { player: { x: 0, y: 0 }, zone: { id: 'reef_garden' } } };
  g.systems.market = new Market(g); g.systems.bounties = new Bounties(g); g.systems.history = new History(g); g.systems.journal = new Journal(g); g.systems.rifts = new Rifts(g); g.systems.arena = { active: false }; return g;
}
// feed the scene one scripted press per update until the script is empty
// (a key the scene does not use is ignored: after a few updates it is dropped so it cannot block the next one)
function play(scene, g, ...keys) { g.input.queue(...keys); for (let n = 0; n < keys.length + 2 && g.input.peek(); n++) { const before = g.input.size(); scene.update(0.016); if (g.input.size() === before) g.input.drop(); } scene.update(0.016); }

// ---- oaths --------------------------------------------------------------------------------------------------------------------------------------
test('the oath scene toggles an oath on and off and moves the cursor', () => {
  const g = game(), s = new OathScene(g, 'Shallow Rift', () => {}); play(s, g, 'confirm'); eq(s.picked.join(), OATH_IDS[0]); play(s, g, 'confirm'); eq(s.picked.length, 0); play(s, g, 'down', 'confirm'); eq(s.picked.join(), OATH_IDS[1]); play(s, g, 'up', 'up'); eq(s.sel, OATH_IDS.length, 'wraps to the start button');
});
test('the oath scene refuses a fourth oath', () => { const g = game(), s = new OathScene(g, 't', () => {}); const keys = []; for (let i = 0; i < OATH_IDS.length; i++) keys.push('confirm', 'down'); play(s, g, ...keys); eq(s.picked.length, MAX_OATHS); ok(g.sfx.includes('deny')); ok(s.msgT > 0); });
test('setting off hands the choice to the run and remembers it for next time', () => {
  const g = game(); let got = null; const s = new OathScene(g, 't', (o) => { got = o; }); play(s, g, 'confirm', 'down', 'confirm', 'menu'); eq(got.join(), OATH_IDS.slice(0, 2).join()); eq(g.state.lastOaths.join(), got.join()); eq(g.popped.length, 1);
  const again = new OathScene(g, 't', () => {}); eq(again.picked.join(), got.join(), 'the last choice is pre-selected');
});
test('the last line of the oath scene also sets off, and escape backs out without starting', () => {
  const g = game(); let started = false; const s = new OathScene(g, 't', () => { started = true; }); play(s, g, 'up', 'confirm'); ok(started); const g2 = game(); let started2 = false; const s2 = new OathScene(g2, 't', () => { started2 = true; }); play(s2, g2, 'cancel'); ok(!started2); eq(g2.popped.length, 1);
});
test('stale or damaged remembered oaths are cleaned when the scene opens', () => { const g = game({ lastOaths: ['iron', 'nonsense', 'iron', 'fury', 'haste', 'fog'] }); eq(new OathScene(g, 't', () => {}).picked.length, MAX_OATHS); });

// ---- selling ------------------------------------------------------------------------------------------------------------------------------------
test('the sell scene sells one, a stack, or everything', () => {
  const g = game({ inv: { fish_silverfin: 3, fish_reef_bream: 2, pearl: 4 } }), s = new SellScene(g, 'tunny', () => {}); const before = s.list.length; ok(before >= 2);
  const top = s.list[0]; play(s, g, 'confirm'); eq(g.itemCount(top.id), (top.n || 0) - 1); ok(g.state.coins > 0 && s.earned > 0); const coins = g.state.coins; play(s, g, 'right'); eq(g.itemCount(top.id), 0); ok(g.state.coins > coins);
  g.state.inv.fish_silverfin = 2; s.refresh(); play(s, g, 'ab1'); ok(!Object.keys(g.state.inv).some((k) => k.startsWith('fish_') || k === 'kelp_frond'), 'everything wanted is gone'); eq(g.itemCount('pearl'), 4, 'pearls are not wanted');
});
test('the sell scene keeps its cursor in range as the list shrinks, and copes with an empty pack', () => {
  const g = game({ inv: { fish_silverfin: 1, fish_reef_bream: 1 } }), s = new SellScene(g, 'tunny', () => {}); play(s, g, 'down', 'confirm'); ok(s.sel < s.list.length); play(s, g, 'confirm'); eq(s.list.length, 0); play(s, g, 'confirm', 'down', 'up'); ok(true, 'no crash when empty');
});
test('leaving the sell scene calls the dialogue back exactly once', () => { const g = game(); let n = 0; const s = new SellScene(g, 'tunny', () => { n++; }); s.onExit(); eq(n, 1); });

// ---- bounties -----------------------------------------------------------------------------------------------------------------------------------
function readyBounty(g) {
  const B = g.systems.bounties, list = B.refresh(), b = list[0]; if (b.kind === 'hunt') g.state.records.kills[b.target] = (g.state.records.kills[b.target] || 0) + b.n; else { const path = { chests: 'chests', forage: 'forage', crafted: 'crafted', elites: 'elites', rifts: 'rifts', gauntlet: 'arenaKills', dashes: 'dashes', rests: 'rests', crits: 'crits', healed: 'healed' }[b.target]; g.state.records[path] += b.n; } return b;
}
test('the bounty scene refuses an unfinished claim, pays a finished one, then refuses a second', () => {
  const g = game(); g.state.level = 10; const s = new BountyScene(g), b = g.systems.bounties.state.list[0]; play(s, g, 'confirm'); eq(b.claimed, false); ok(s.msgT > 0 && g.sfx.includes('deny'));
  readyBounty(g); play(s, g, 'confirm'); eq(b.claimed, true); ok(g.state.coins >= b.coins); const c = g.state.coins; play(s, g, 'confirm'); eq(g.state.coins, c, 'no double pay');
});
test('swapping a bounty costs coins and needs them', () => {
  const g = game(); g.state.level = 10; const s = new BountyScene(g), id = g.systems.bounties.state.list[0].id; play(s, g, 'menu'); eq(g.systems.bounties.state.list[0].id, id, 'too poor'); g.state.coins = REROLL_COST + 5; play(s, g, 'menu'); ok(g.systems.bounties.state.list[0].id !== id); eq(g.state.coins, 5);
});
test('the bounty cursor wraps both ways and escape leaves', () => { const g = game(); const s = new BountyScene(g), n = s.list.length; play(s, g, 'up'); eq(s.sel, n - 1); play(s, g, 'down'); eq(s.sel, 0); play(s, g, 'cancel'); eq(g.popped.length, 1); });

// ---- the board ----------------------------------------------------------------------------------------------------------------------------------
test('the board lists the tiers, the daily, the arena and the side services, locking what is not earned', () => {
  const g = game(), s = new BoardScene(g), e = s.entries(); eq(e.map((x) => x.kind).join(), 'rift,rift,rift,daily,arena,bounties,orders,hall'); ok(e[0].open && !e[1].open && !e[2].open); ok(!e[4].open); ok(e[3].open && e.slice(5).every((x) => x.open));
  g.state.bosses = { grumbold: true, mother_moray: true, krael: true }; const f = new BoardScene(g).entries(); ok(f.every((x) => x.open)); eq(f[3].tier.id, 'abyssal', 'the daily uses the deepest open tier');
});
test('the board flags bounties that are ready to claim', () => { const g = game(); g.state.level = 10; ok(!new BoardScene(g).entries().find((x) => x.kind === 'bounties').name.includes('!')); readyBounty(g); ok(new BoardScene(g).entries().find((x) => x.kind === 'bounties').name.includes('!')); });
test('choosing a locked entry only explains why', () => { const g = game(), s = new BoardScene(g); play(s, g, 'down', 'confirm'); ok(s.msgT > 0 && s.msg.length > 5); eq(g.pushed.length, 0); });
test('choosing a rift opens the oath scene instead of starting at once; sub-screens open from the board', () => {
  const g = game(), s = new BoardScene(g); play(s, g, 'confirm'); eq(g.pushed.length, 1); eq(g.pushed[0].constructor.name, 'OathScene'); eq(g.systems.rifts.run, null, 'nothing has started');
  for (const [kind, scene] of [['bounties', 'BountyScene'], ['orders', 'OrdersScene'], ['hall', 'HallScene']]) { const gg = game(); gg.systems.orders = { refresh: () => [], state: { delivered: 0 } }; const b = new BoardScene(gg); b.sel = b.entries().findIndex((x) => x.kind === kind); play(b, gg, 'confirm'); eq(gg.pushed[0].constructor.name, scene, kind); }
});

// ---- help and the hall --------------------------------------------------------------------------------------------------------------------------
test('the help scene pages with left and right, scrolls within bounds and resets the scroll on a page change', () => {
  const g = game(), s = new HelpScene(g); play(s, g, 'right'); eq(s.page, 1); play(s, g, 'left', 'left'); eq(s.page, PAGES.length - 1); s.page = 2; for (let i = 0; i < 40; i++) play(s, g, 'down'); const max = s.layout().h - 150; ok(s.scroll <= Math.max(0, max)); ok(s.scroll > 0, 'the status page is long'); play(s, g, 'right'); eq(s.scroll, 0);
  play(s, g, 'up'); eq(s.scroll, 0, 'cannot scroll above the top');
});
test('every help page lays out some lines and the heights are positive', () => { const g = game(); for (let i = 0; i < PAGES.length; i++) { const s = new HelpScene(g, i), L = s.layout(); ok(L.lines.length > 4 && L.h > 40, PAGES[i].id); } });
test('the hall pages between runs, fish, journal and totals, and scrolls only the journal', () => {
  const g = game(); for (let i = 0; i < 20; i++) g.systems.journal.add('quest', 'entry ' + i); const s = new HallScene(g); eq(s.page, 0); play(s, g, 'right', 'right'); eq(s.page, 2); play(s, g, 'down', 'down'); eq(s.scroll, 2); play(s, g, 'right'); eq(s.page, 3); eq(s.scroll, 0); play(s, g, 'down'); eq(s.scroll, 0, 'totals do not scroll'); play(s, g, 'right'); eq(s.page, 0);
});
test('the journal scroll stops at the oldest entry', () => { const g = game(); for (let i = 0; i < 15; i++) g.systems.journal.add('quest', 'e' + i); const s = new HallScene(g, 2); const keys = Array(30).fill('down'); play(s, g, ...keys); eq(s.scroll, 15 - 11); });
