// The dive log: which events are written down, that each moment appears once, stamps and trimming.
import { test, ok, eq } from './harness.mjs';
import { Journal, KEEP, KINDS } from '../../src/systems/journal.js';
import { ACHIEVEMENTS } from '../../src/data/achievements.js';
import '../../src/bosses/index.js';

function bus() { const m = {}; return { on: (e, f) => (m[e] ||= []).push(f), emit: (e, ...a) => (m[e] || []).forEach((f) => f(...a)) }; }
function game() { const g = { state: { playtime: 3725, records: { surges: 0 } }, events: bus(), systems: {} }; g.systems.journal = new Journal(g); return g; }
const texts = (g) => g.systems.journal.log.map((e) => e.text);

test('a defeated guardian is written down with its name, once', () => { const g = game(); g.events.emit('boss', 'grumbold'); g.events.emit('boss', 'grumbold'); eq(g.systems.journal.count(), 1); ok(texts(g)[0].includes('Grumbold'), texts(g)[0]); eq(g.systems.journal.log[0].kind, 'boss'); });
test('an unknown boss key still reads sensibly', () => { const g = game(); g.events.emit('boss', 'mystery'); ok(texts(g)[0].includes('mystery')); });
test('a molt names the new form', () => { const g = game(); g.events.emit('evolved', 'warrior', 'shore'); ok(/Molted into the .*Warrior/i.test(texts(g)[0]), texts(g)[0]); eq(g.systems.journal.log[0].kind, 'molt'); });
test('a finished quest uses its title', () => { const g = game(); g.events.emit('questdone', 'sq_board'); ok(texts(g)[0].includes('Notices on the Tide'), texts(g)[0]); g.events.emit('questdone', 'sq_board'); eq(g.systems.journal.count(), 1); });
test('only every fifth level is remembered', () => { const g = game(); for (let lv = 2; lv <= 30; lv++) g.events.emit('levelup', lv); eq(g.systems.journal.count(), 6); ok(texts(g).includes('Reached level 25.')); ok(!texts(g).includes('Reached level 7.')); });
test('cleared rifts are written, lost ones and short gauntlets are not', () => {
  const g = game(); g.events.emit('runlogged', { kind: 'rift', tier: 'Deep Rift', success: true, secs: 305 }); g.events.emit('runlogged', { kind: 'rift', tier: 'Deep Rift', success: false, secs: 90 }); g.events.emit('runlogged', { kind: 'arena', depth: 4 }); g.events.emit('runlogged', { kind: 'arena', depth: 12 });
  eq(g.systems.journal.count(), 2); ok(texts(g)[0].includes('Deep Rift') && texts(g)[0].includes('5:05')); ok(texts(g)[1].includes('12 waves'));
});
test('legendary and first rare fish are remembered, common ones are not', () => {
  const g = game(); g.events.emit('fish', 'silverfin', 20, { fresh: true }); g.events.emit('fish', 'pearlfin', 24, { fresh: true }); g.events.emit('fish', 'pearlfin', 25, { fresh: false }); g.events.emit('fish', 'moon_koi', 88, { fresh: true }); g.events.emit('fish', 'nonsense', 1, {});
  eq(g.systems.journal.count(), 2); ok(texts(g)[0].includes('Pearlfin')); ok(texts(g)[1].includes('Moon Koi') && texts(g)[1].includes('88'));
});
test('only gold and mythic trophies make the log', () => {
  const g = game(), gold = ACHIEVEMENTS.find((a) => a.tier === 'gold'), bronze = ACHIEVEMENTS.find((a) => a.tier === 'bronze'), mythic = ACHIEVEMENTS.find((a) => a.tier === 'mythic');
  g.events.emit('trophy', bronze.id); eq(g.systems.journal.count(), 0); g.events.emit('trophy', gold.id); g.events.emit('trophy', mythic.id); eq(g.systems.journal.count(), 2); ok(texts(g)[0].includes(gold.name)); g.events.emit('trophy', 'no_such_trophy'); eq(g.systems.journal.count(), 2);
});
test('adopting a hatchling and the first surge are remembered once', () => {
  const g = game(); g.events.emit('companion', 'adopt'); g.events.emit('companion', 'level'); g.events.emit('companion', 'adopt'); eq(g.systems.journal.count(), 1);
  g.state.records.surges = 1; g.events.emit('surge', 'warn'); g.events.emit('surge', 'calm'); eq(g.systems.journal.count(), 2); g.state.records.surges = 2; g.events.emit('surge', 'calm'); eq(g.systems.journal.count(), 2);
});
test('entries carry the play time at which they happened', () => { const g = game(); g.events.emit('boss', 'grumbold'); g.state.playtime = 9000; g.events.emit('boss', 'moray'); eq(g.systems.journal.log[0].t, 3725); eq(g.systems.journal.log[1].t, 9000); });
test('the log is trimmed from the oldest end', () => { const g = game(), J = g.systems.journal; for (let i = 0; i < KEEP + 30; i++) J.add('quest', 'entry ' + i); eq(J.count(), KEEP); eq(J.log[0].text, 'entry 30'); eq(J.log[KEEP - 1].text, 'entry ' + (KEEP + 29)); });
test('recent returns newest first and supports paging', () => { const J = game().systems.journal; for (let i = 0; i < 10; i++) J.add('quest', 'e' + i); eq(J.recent(3).map((e) => e.text).join(), 'e9,e8,e7'); eq(J.recent(3, 3).map((e) => e.text).join(), 'e6,e5,e4'); eq(J.recent(5, 8).length, 2); });
test('keyless entries can repeat, keyed ones cannot', () => { const J = game().systems.journal; J.add('quest', 'same'); J.add('quest', 'same'); eq(J.count(), 2); ok(J.add('boss', 'x', 'k')); eq(J.add('boss', 'x again', 'k'), null); eq(J.count(), 3); });
test('time stamps read naturally', () => { eq(Journal.stamp(0), '1m'); eq(Journal.stamp(59), '1m'); eq(Journal.stamp(125), '2m'); eq(Journal.stamp(3600), '1h 00m'); eq(Journal.stamp(3725), '1h 02m'); eq(Journal.stamp(36000 + 60 * 7), '10h 07m'); });
test('every entry kind has a label and a colour', () => { for (const [k, K] of Object.entries(KINDS)) { ok(K.label && /^#[0-9a-f]{6}$/i.test(K.color), k); } });
test('a fresh save has an empty log and creates it lazily', () => { const g = game(); eq(g.state.journal, undefined); eq(g.systems.journal.count(), 0); ok(Array.isArray(g.state.journal)); });
