// Run history, the help compendium and the totals page, tested without a screen.
import { test, ok, eq } from './harness.mjs';
import { History } from '../../src/systems/history.js';
import { PAGES } from '../../src/data/help.js';
import { entriesFor } from '../../src/ui/help_scene.js';
import { totals, num } from '../../src/ui/hall_scene.js';
import { STATUS } from '../../src/systems/status.js';
import { AFFIX_IDS } from '../../src/data/affixes.js';
import { PHASES } from '../../src/data/clock.js';
import { DIFFICULTIES } from '../../src/systems/settings.js';
import { newState } from '../../src/systems/progression.js';
import { newRecords } from '../../src/systems/stats.js';

function game() { const events = []; const g = { state: newState(), systems: {}, events: { emit: (...a) => events.push(a) }, evs: events }; g.state.records = newRecords(); g.systems.history = new History(g); return g; }
const run = (o = {}) => ({ kind: 'rift', tier: 'Shallow Rift', depth: 4, max: 4, success: true, secs: 200, kills: 30, relics: ['a', 'b'], rw: { coins: 120 }, ...o });

test('a finished run is logged with its numbers', () => { const g = game(), H = g.systems.history; const e = H.add(run()); eq(H.log.length, 1); eq(e.kind, 'rift'); eq(e.coins, 120); eq(e.relics, 2); ok(e.at > 0); eq(g.evs[0][0], 'runlogged'); });
test('daily runs are tagged and arena runs keep their wave', () => { const H = game().systems.history; eq(H.add(run({ daily: true, kind: undefined })).kind, 'daily'); const a = H.add(run({ kind: 'arena', tier: 'Pearl Gauntlet', depth: 12, max: 12, success: true })); eq(a.kind, 'arena'); eq(a.depth, 12); });
test('the log keeps only the most recent runs', () => { const H = game().systems.history; for (let i = 0; i < 60; i++) H.add(run({ kills: i })); eq(H.log.length, 40); eq(H.log[0].kills, 20); eq(H.recent(3)[0].kills, 59); eq(H.recent(3).length, 3); });
test('fastest clears survive the trim and ignore failures and arena runs', () => {
  const H = game().systems.history; H.add(run({ secs: 300 })); H.add(run({ secs: 240 })); H.add(run({ secs: 100, success: false })); H.add(run({ kind: 'arena', tier: 'Pearl Gauntlet', secs: 50 })); eq(H.best['Shallow Rift'], 240); ok(!H.best['Pearl Gauntlet']);
  for (let i = 0; i < 50; i++) H.add(run({ secs: 999, tier: 'Deep Rift' })); eq(H.best['Shallow Rift'], 240, 'kept after the log rolled over');
});
test('stats count runs, wins, streaks and totals', () => {
  const H = game().systems.history; [true, true, false, true, true, true].forEach((s, i) => H.add(run({ success: s, kills: 10, secs: 60 + i, depth: s ? 4 : 2 })));
  const S = H.stats(); eq(S.runs, 6); eq(S.wins, 5); eq(Math.round(S.rate * 100), 83); eq(S.streak, 3); eq(S.longest, 3); eq(S.kills, 60); eq(S.deepest, 4);
});
test('stats on an empty log are all zero', () => { const S = game().systems.history.stats(); eq(S.runs, 0); eq(S.rate, 0); eq(S.streak, 0); eq(S.deepest, 0); eq(S.bestWave, 0); });
test('arena waves are tracked apart from rift depth', () => { const H = game().systems.history; H.add(run({ kind: 'arena', depth: 14, max: 14 })); H.add(run({ depth: 3 })); const S = H.stats(); eq(S.bestWave, 14); eq(S.deepest, 3); eq(S.arena, 1); });
test('ago reads naturally', () => { const H = game().systems.history, now = Date.UTC(2026, 5, 10, 12), e = { day: Math.floor(now / 86400000) }; eq(H.ago(e, now), 'today'); eq(H.ago({ day: e.day - 1 }, now), 'yesterday'); eq(H.ago({ day: e.day - 5 }, now), '5 days ago'); });

test('every help page has a name and content', () => { const g = {}; eq(new Set(PAGES.map((p) => p.id)).size, PAGES.length); for (const p of PAGES) { ok(p.name, p.id); const es = entriesFor(p, g); ok(es.length >= 3, p.id + ' entries'); for (const e of es) { ok(e.t && e.x && e.x.length, `${p.id}:${e.t}`); for (const l of e.x) ok(typeof l === 'string' && l.length > 8, `${p.id}:${e.t}`); } } });
test('the status page lists every status, active ones first', () => { const es = entriesFor(PAGES.find((p) => p.id === 'status'), {}); eq(es.length, Object.keys(STATUS).length); const passive = es.filter((e) => /hour/.test(e.x[1])); eq(passive.length, Object.values(STATUS).filter((s) => s.passive).length); eq(es.slice(-passive.length).every((e) => /hour/.test(e.x[1])), true); });
test('the elite page lists every affix and explains rewards', () => { const es = entriesFor(PAGES.find((p) => p.id === 'elites'), {}); eq(es.length, AFFIX_IDS.length + 1); ok(/experience/.test(es[0].x[0])); });
test('the world page describes every phase of the day', () => { const world = PAGES.find((p) => p.id === 'world'), es = entriesFor(world, {}), clock = es.find((e) => e.t === 'The tide clock'); ok(clock); for (const p of PHASES) ok(clock.x.some((l) => l.startsWith(p.name)), p.name); });
test('the options page covers every difficulty tier with real numbers', () => { const es = entriesFor(PAGES.find((p) => p.id === 'options'), {}); for (const d of DIFFICULTIES) ok(es.some((e) => e.x[1] && /health/.test(e.x[1])), d); ok(es.length >= DIFFICULTIES.length + 2); });
test('help text never mentions keys that do not exist', () => { const all = PAGES.flatMap((p) => entriesFor(p, {})).flatMap((e) => e.x).join(' '); ok(!/F12|Ctrl|Alt\b/.test(all)); });

test('the totals page reads the records and the fish log', () => {
  const s = newState(); s.records = newRecords(); s.records.kills = { pinchling: 5, minnow: 3 }; s.records.chests = 7; s.records.deathsBy = { urchin: 2 }; s.fish = { total: 9, species: { silverfin: { n: 5, best: 20 }, reef_bream: { n: 4, best: 30 } } }; s.bounties = { claimed: 12 }; s.playtime = 3725;
  const t = Object.fromEntries(totals(s)); eq(t['Foes defeated'], 8); eq(t['Chests opened'], 7); eq(t.Deaths, 2); eq(t['Fish caught'], 9); eq(t['Species found'], 2); eq(t['Bounties claimed'], 12); eq(t['Time played'], '1h 02m');
});
test('the totals page copes with a brand new save', () => { const s = newState(); const t = totals(s); eq(t.length, 20); for (const [k, v] of t) ok(typeof k === 'string' && (typeof v === 'number' || typeof v === 'string'), k); });
test('number formatting stays short', () => { eq(num(5), '5'); eq(num(9999), '9999'); eq(num(12345), '12k'); eq(num(2500000), '2.5M'); });
