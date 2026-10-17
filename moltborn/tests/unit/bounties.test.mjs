// Bounties: deterministic daily boards, progress read from the records, claiming, streaks, rerolls.
import { test, ok, eq } from './harness.mjs';
import { Bounties, readStat } from '../../src/systems/bounties.js';
import { STAT_BOUNTIES, HUNT, STREAK_BONUS, REROLL_COST, BOARD_SIZE } from '../../src/data/bounties.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { newState } from '../../src/systems/progression.js';
import { newRecords } from '../../src/systems/stats.js';
import { today } from '../../src/world/rift_gen.js';

function game(level = 10) {
  const state = newState(); state.level = level; state.records = newRecords(); state.stats = { coinsEarned: 0 }; state.coins = 0; state.bosses = { grumbold: true };
  const log = { toasts: [], items: [], xp: 0, events: [] };
  const g = { state, systems: {}, world: { player: { x: 0, y: 0 } }, audio: { sfx() {} }, toast: (m) => log.toasts.push(m), grantItem: (id, n) => log.items.push([id, n]), giveXp: (n) => { log.xp += n; }, events: { emit: (...a) => log.events.push(a) }, log };
  g.systems.bounties = new Bounties(g); return g;
}

test('readStat walks dotted paths and defaults to zero', () => { const r = { kills: { pinchling: 4 }, chests: 2 }; eq(readStat(r, 'kills.pinchling'), 4); eq(readStat(r, 'chests'), 2); eq(readStat(r, 'kills.minnow'), 0); eq(readStat(r, 'nothing.here'), 0); });
test('every stat bounty reads a real record and has a sane range', () => { const r = newRecords(); for (const [k, T] of Object.entries(STAT_BOUNTIES)) { ok(typeof T.get(r) === 'number', k); ok(T.range[0] >= 1 && T.range[1] >= T.range[0], k); ok(T.pay > 0 && T.label(2).length > 5, k); ok(readStat(r, k) === T.get(r), 'path equals getter ' + k); } });
test('a board has four distinct bounties and is the same all day', () => {
  const g = game(), B = g.systems.bounties, a = B.refresh(); eq(a.length, BOARD_SIZE);
  eq(new Set(a.map((b) => b.kind + b.target)).size, BOARD_SIZE, 'no repeats'); const ids = a.map((b) => b.id).join(); eq(B.refresh().map((b) => b.id).join(), ids);
});
test('the same day and level make the same board on any machine', () => {
  const g1 = game(12), g2 = game(12); const a = g1.systems.bounties.refresh(), b = g2.systems.bounties.refresh();
  eq(JSON.stringify(a), JSON.stringify(b));
});
test('hunt bounties ask for creatures the swimmer has met', () => {
  const g = game(); g.state.records.kills = { pinchling: 9, minnow: 4, hermit: 2, venomjelly: 1 };
  for (let salt = 0; salt < 40; salt++) { const b = g.systems.bounties.make(20250101 + salt, 0, salt); if (b.kind === 'hunt') ok(['pinchling', 'minnow', 'hermit', 'venomjelly'].includes(b.target), b.target); }
});
test('with few kills, hunts fall back to the starting creatures', () => { const g = game(); for (const t of g.systems.bounties.huntable()) ok(HUNT.starters.includes(t)); });
test('hunts never name bosses, friends or things that cannot hurt', () => { const g = game(); g.state.records.kills = { grumbold: 3, hatchling: 3, pinchling: 3, minnow: 3, urchin: 3 }; for (const t of g.systems.bounties.huntable()) ok(ENEMIES[t].dmg > 0 && !ENEMIES[t].friendly && !ENEMIES[t].boss, t); });
test('bigger creatures are asked for in smaller numbers', () => {
  const g = game(); g.state.records.kills = { minnow: 5, hermit: 5, glassgolem: 5 }; let small = 0, big = 0, ns = 0, nb = 0;
  for (let s = 0; s < 200; s++) { const b = g.systems.bounties.make(20240000 + s, 0, 0); if (b.kind !== 'hunt') continue; if (b.target === 'minnow') { small += b.n; ns++; } if (b.target === 'glassgolem') { big += b.n; nb++; } }
  ok(ns && nb && small / ns > big / nb, `${small / ns} vs ${big / nb}`);
});
test('progress counts growth since the board was made, capped at the target', () => {
  const g = game(), B = g.systems.bounties, b = { kind: 'stat', target: 'chests', stat: 'chests', n: 3, base: 4, done: false, claimed: false, coins: 50, xp: 20, pearl: 0, id: 'x' };
  eq(B.progress(b), 0); g.state.records.chests = 5; eq(B.progress(b), 1); ok(!B.complete(b)); g.state.records.chests = 9; eq(B.progress(b), 3); ok(B.complete(b));
});
test('claiming a finished stat bounty pays once', () => {
  const g = game(), B = g.systems.bounties; B.state.day = today(); B.state.list = [{ kind: 'stat', target: 'chests', stat: 'chests', n: 2, base: 0, claimed: false, coins: 80, xp: 30, pearl: 1, id: 'a' }];
  ok(!B.claim(B.state.list[0])); g.state.records.chests = 2; ok(B.claim(B.state.list[0])); ok(!B.claim(B.state.list[0]), 'second claim refused');
  eq(g.state.coins, 80); eq(g.log.xp, 30); eq(g.log.items.length, 1); eq(B.state.claimed, 1);
});
test('clearing the board starts a streak and pays a streak pearl once enough days run together', () => {
  const g = game(), B = g.systems.bounties, st = B.state; st.day = today(); st.streak = 2;
  st.list = [0, 1].map((i) => ({ kind: 'stat', target: 'chests', stat: 'chests', n: 1, base: 0, claimed: false, coins: 10, xp: 5, pearl: 0, id: 'b' + i })); g.state.records.chests = 5;
  B.claim(st.list[0]); eq(st.streak, 2); B.claim(st.list[1]); eq(st.streak, 3); eq(st.lastFull, today());
  ok(g.log.items.some(([id]) => id === 'pearl'), 'streak pearl'); B.claim(st.list[1]); eq(st.streak, 3, 'no double count');
});
test('a missed day or an unfinished board breaks the streak', () => {
  const g = game(), B = g.systems.bounties, st = B.state; st.streak = 5; st.day = 20200101; st.list = [{ claimed: true }, { claimed: true }]; B.refresh(); eq(st.streak, 0, 'long gap');
  const g2 = game(), B2 = g2.systems.bounties, s2 = B2.state; s2.streak = 5; s2.day = 20200101; s2.list = [{ claimed: true }, { claimed: false }]; B2.refresh(); eq(s2.streak, 0, 'unfinished');
});
test('rerolling costs coins and replaces only that bounty', () => {
  const g = game(), B = g.systems.bounties, before = B.refresh().map((b) => b.id); ok(!B.reroll(1), 'too poor'); g.state.coins = REROLL_COST + 10;
  ok(B.reroll(1)); eq(g.state.coins, 10); const after = B.state.list.map((b) => b.id); eq(after[0], before[0]); ok(after[1] !== before[1]); eq(after[2], before[2]);
  const kinds = B.state.list.map((b) => b.kind + b.target); eq(new Set(kinds).size, BOARD_SIZE, 'still distinct');
});
test('a claimed bounty cannot be rerolled', () => { const g = game(), B = g.systems.bounties; B.refresh(); B.state.list[0].claimed = true; g.state.coins = 500; ok(!B.reroll(0)); eq(g.state.coins, 500); });
test('rewards grow with level and with the size of the ask', () => {
  const lo = game(2).systems.bounties.make(20250505, 0), hi = game(25).systems.bounties.make(20250505, 0); ok(hi.coins > lo.coins && hi.xp > lo.xp);
  ok(lo.coins >= 20 && lo.coins < 400, 'sane payout ' + lo.coins);
});
test('rift and gauntlet bounties only appear after the first boss', () => {
  const g = game(); g.state.bosses = {}; for (let s = 0; s < 60; s++) { const b = g.systems.bounties.make(20250100 + s, 1, s); ok(b.target !== 'rifts' && b.target !== 'gauntlet', b.target); }
});
test('the update tick announces a ready bounty once', () => {
  const g = game(), B = g.systems.bounties; B.state.day = today(); B.state.list = [{ kind: 'stat', target: 'chests', stat: 'chests', n: 1, base: 0, claimed: false, coins: 1, xp: 1, pearl: 0, id: 'q' }];
  B.update(2); eq(g.log.toasts.length, 0); g.state.records.chests = 1; B.update(2); eq(g.log.toasts.length, 1); B.update(2); eq(g.log.toasts.length, 1);
});
test('streak bonus table never decreases', () => { for (let i = 1; i < STREAK_BONUS.length; i++) ok(STREAK_BONUS[i] >= STREAK_BONUS[i - 1]); });
