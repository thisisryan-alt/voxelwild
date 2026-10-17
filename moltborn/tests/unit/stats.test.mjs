// Lifetime statistics: how events become records, boss timing and flawless detection, and the small queries the UI reads.
import { test, ok, eq } from './harness.mjs';
import { Stats, newRecords, ensureRecords } from '../../src/systems/stats.js';
import { newState } from '../../src/systems/progression.js';
import { defaults } from '../../src/systems/settings.js';

function bus() { const m = {}; return { on: (e, f) => (m[e] ||= []).push(f), emit: (e, ...a) => (m[e] || []).forEach((f) => f(...a)) }; }
function game(world = null) {
  const state = newState(); state.records = newRecords(); state.stats = { comboBest: 0, parries: 0, deaths: 0 }; state.settings = defaults(); state.visited = {}; state.playtime = 100;
  const g = { state, events: bus(), systems: {}, world }; g.systems.stats = new Stats(g); return g;
}

test('a fresh record set is all zeros and empty maps, with no shared state between saves', () => {
  const a = newRecords(), b = newRecords(); eq(a.hits, 0); eq(Object.keys(a.kills).length, 0); a.kills.pinchling = 1; eq(Object.keys(b.kills).length, 0); ok(a.surges === 0 && a.fished === 0 && a.wardens === 0 && a.oathRuns === 0);
});
test('ensureRecords fills what an older save lacks and keeps what it has', () => {
  const s = { records: { kills: { pinchling: 3 }, hits: 9 } }; const r = ensureRecords(s); eq(r.kills.pinchling, 3); eq(r.hits, 9); eq(r.surges, 0); eq(r.fished, 0); ok(Array.isArray(Object.keys(r.flawless))); ok(s.trophies); const again = ensureRecords(s); eq(again.hits, 9);
});
test('kills count per creature and per form, and elites keep their affixes', () => {
  const g = game(); g.events.emit('kill', 'pinchling', {}); g.events.emit('kill', 'pinchling', {}); g.events.emit('kill', 'hermit', { affixes: ['armored', 'swift'], champion: true }); const r = g.state.records;
  eq(r.kills.pinchling, 2); eq(r.kills.hermit, 1); eq(r.killsByForm.shore, 3); eq(r.elites, 1); eq(r.champions, 1); eq(r.affixKills.armored, 1); eq(r.affixKills.swift, 1); eq(g.systems.stats.totalKills(), 3); eq(g.systems.stats.killsOf('hermit'), 1); eq(g.systems.stats.killsOf('nothing'), 0);
});
test('kills in the gauntlet are counted apart', () => { const g = game({ zone: { arena: {} } }); g.events.emit('kill', 'pinchling', {}); eq(g.state.records.arenaKills, 1); const h = game({ zone: {} }); h.events.emit('kill', 'pinchling', {}); eq(h.state.records.arenaKills, 0); });
test('hits tally damage, criticals and the best blow', () => { const g = game(); g.events.emit('hitdealt', {}, 10.4, false); g.events.emit('hitdealt', {}, 31.6, true); g.events.emit('hitdealt', {}, 12, false); const r = g.state.records; eq(r.hits, 3); eq(r.crits, 1); eq(r.dmgDealt, 10 + 32 + 12); eq(r.bestHit, 32); });
test('damage taken is summed, and counted against a boss only while one is engaged', () => {
  const g = game({ boss: { engaged: false } }); g.events.emit('hurt', 7, {}); eq(g.state.records.dmgTaken, 7); eq(g.state.records.bossHits, 0); g.world.boss.engaged = true; g.events.emit('hurt', 3, {}); eq(g.state.records.bossHits, 1); eq(g.state.records.dmgTaken, 10);
});
test('deaths are blamed on the last known source, the thing that struck, or the tide', () => {
  const g = game({ zone: { id: 'reef_garden' } }); g.events.emit('hurt', 5, { source: { type: 'urchin' } }); g.events.emit('playerdied', null); g.events.emit('playerdied', { type: 'hermit' }); g.events.emit('playerdied', { name: 'Spikes' });
  const r = g.state.records; eq(r.deathsBy.urchin, 1); eq(r.deathsBy.hermit, 1); eq(r.deathsBy.Spikes, 1); eq(r.deathsIn.reef_garden, 3); eq(g.systems.stats.deadliest(), 'urchin');
  const h = game(); h.events.emit('playerdied', null); eq(h.state.records.deathsBy['the tide'], 1);
});
test('a boss fight is timed, tried and recorded, and a hitless one is flawless', () => {
  const g = game({ boss: { engaged: true } }), r = g.state.records; g.events.emit('bossengage', 'grumbold'); g.state.playtime = 160; g.events.emit('boss', 'grumbold');
  eq(r.bossTries.grumbold, 1); eq(r.bossBest.grumbold, 60); ok(r.flawless.grumbold); eq(r.bossStart, null);
  g.state.playtime = 200; g.events.emit('bossengage', 'grumbold'); g.events.emit('hurt', 4, {}); g.state.playtime = 300; g.events.emit('boss', 'grumbold'); eq(r.bossTries.grumbold, 2); eq(r.bossBest.grumbold, 60, 'a slower kill keeps the best time'); ok(r.flawless.grumbold, 'an earlier flawless win is not undone');
  const h = game({ boss: { engaged: true } }); h.events.emit('bossengage', 'moray'); h.events.emit('hurt', 4, {}); h.state.playtime = 150; h.events.emit('boss', 'moray'); ok(!h.state.records.flawless.moray, 'hit once: not flawless');
});
test('a boss that falls without an engagement is ignored, except for the Warden\'s own tally', () => {
  const g = game(); g.events.emit('boss', 'kyros'); eq(Object.keys(g.state.records.bossBest).length, 0); g.events.emit('boss', 'rift_warden'); eq(g.state.records.wardens, 1);
});
test('the hardest difficulty a boss was beaten on is kept', () => {
  const g = game({ boss: { engaged: true } }); g.state.settings.difficulty = 'rip'; g.events.emit('bossengage', 'a'); g.events.emit('boss', 'a'); eq(g.state.records.hardest, 2); g.state.settings.difficulty = 'calm'; g.events.emit('bossengage', 'b'); g.events.emit('boss', 'b'); eq(g.state.records.hardest, 2, 'an easier win does not lower it');
});
test('zone visits and time per zone and realm accumulate from update', () => {
  const g = game({ zone: { id: 'reef_garden', biome: 'reef' }, player: { x: 0, y: 0, alive: true, onGround: true, comboBest: 0, status: { size: 0 } } }), S = g.systems.stats; g.events.emit('zone', 'reef_garden'); g.events.emit('zone', 'reef_garden');
  for (let i = 0; i < 5; i++) S.update(0.5); const r = g.state.records; eq(r.zoneVisits.reef_garden, 2); near2(r.zoneTime.reef_garden, 2.5); near2(r.biomeTime.reef, 2.5); eq(S.favouriteBiome(), 'reef');
});
test('distance is summed from small steps and split into ground and swimming, ignoring teleports', () => {
  const p = { x: 0, y: 0, alive: true, onGround: true, comboBest: 0, status: { size: 0 } }, g = game({ zone: { id: 'z', biome: 'reef' }, player: p }), S = g.systems.stats; S.update(0.1); p.x = 10; S.update(0.1); p.onGround = false; p.x = 30; S.update(0.1); p.x = 5000; S.update(0.1);
  const r = g.state.records; eq(r.distance, 30); eq(r.ground, 10); eq(r.swim, 20);
});
test('a dead swimmer records nothing and a missing world is tolerated', () => { const p = { x: 0, y: 0, alive: false, status: { size: 0 } }, g = game({ zone: { id: 'z', biome: 'reef' }, player: p }); g.systems.stats.update(1); eq(g.state.records.zoneTime.z, undefined); const h = game(); h.systems.stats.update(1); eq(Object.keys(h.state.records.zoneTime).length, 0); });
test('the summary lists the headline numbers in a fixed order', () => { const g = game(); const s = g.systems.stats.summary(); eq(s.length, 12); eq(s[0][0], 'Foes defeated'); eq(s[s.length - 1][0], 'Times fallen'); for (const [k, v] of s) ok(typeof k === 'string' && v !== undefined, k); });
test('queries on an empty record return null instead of throwing', () => { const S = game().systems.stats; eq(S.favouriteBiome(), null); eq(S.deadliest(), null); eq(S.zonesSeen(), 0); });
function near2(a, b) { ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`); }
