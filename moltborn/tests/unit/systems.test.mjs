// Logic that needs no browser: keymap rebinding, difficulty maths, rift and arena generation, save codes, orders.
import { test, ok, eq, near, deep } from './harness.mjs';
import { KEYMAP, Input } from '../../src/core/input.js';
import { DEFAULT_KEYMAP, setBinding, clearBinding, resetKeymap, diffKeymap, applyKeymap, keyLabel, REBINDABLE, RESERVED } from '../../src/core/keymap.js';
import { TIERS, NG_STEP, NG_MAX, NG_KEEP, Difficulty } from '../../src/systems/difficulty.js';
import { composeWave, waveBudget, unlocked, ARENA_POOL } from '../../src/systems/arena.js';
import { riftId, arenaId, parseId, isProcedural, riftThemes, THEME_ORDER, THEMES, buildRift, buildArena, setRiftThemes } from '../../src/world/rift_gen.js';
import { Save, validate } from '../../src/core/save.js';
import { newState, computeStats } from '../../src/systems/progression.js';
import { rng } from '../../src/core/util.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { isSolid } from '../../src/world/tiles.js';

const input = new Input();

test('keymap: setBinding moves a key and reports the steal', () => { resetKeymap(input); const r = setBinding(input, 'attack', 0, 'KeyG'); ok(r.ok); eq(KEYMAP.attack[0], 'KeyG'); const r2 = setBinding(input, 'heavy', 0, 'KeyG'); eq(r2.stolen, 'attack'); ok(!KEYMAP.attack.includes('KeyG')); resetKeymap(input); });
test('keymap: reserved keys and last-key theft are refused', () => { resetKeymap(input); ok(!setBinding(input, 'dash', 0, 'Escape').ok); KEYMAP.dash = ['KeyL']; const r = setBinding(input, 'attack', 0, 'KeyL'); eq(r.ok, false); eq(r.why, 'last'); resetKeymap(input); });
test('keymap: diff and apply round-trip', () => { resetKeymap(input); setBinding(input, 'dash', 0, 'KeyG'); const d = diffKeymap(); deep(Object.keys(d), ['dash']); resetKeymap(input); eq(KEYMAP.dash[0], DEFAULT_KEYMAP.dash[0]); applyKeymap(input, d); eq(KEYMAP.dash[0], 'KeyG'); resetKeymap(input); });
test('keymap: clearing keeps at least one binding', () => { resetKeymap(input); while (KEYMAP.attack.length > 1) ok(clearBinding(input, 'attack', KEYMAP.attack.length - 1)); eq(KEYMAP.attack.length, 1); ok(!clearBinding(input, 'attack', 0)); eq(KEYMAP.attack.length, 1); resetKeymap(input); });
test('keymap: the reverse lookup follows rebinding', () => { resetKeymap(input); setBinding(input, 'attack', 0, 'KeyG'); deep(input.reverse.get('KeyG'), ['attack']); ok(!input.reverse.get('KeyJ')?.includes('attack') || KEYMAP.attack.includes('KeyJ')); resetKeymap(input); });
test('keymap: labels are readable', () => { eq(keyLabel('KeyA'), 'A'); eq(keyLabel('ArrowLeft'), 'LEFT'); eq(keyLabel('Digit1'), '1'); eq(keyLabel('Space'), 'SPACE'); eq(keyLabel(null), '-'); ok(REBINDABLE.every((r) => KEYMAP[r.a])); ok(RESERVED.has('Escape')); });

test('difficulty: tiers scale up monotonically', () => { const order = ['calm', 'tide', 'rip', 'maelstrom']; for (const k of ['hp', 'dmg', 'xp', 'coin']) for (let i = 1; i < order.length; i++) ok(TIERS[order[i]][k] >= TIERS[order[i - 1]][k], k); eq(TIERS.tide.hp, 1); });
test('difficulty: scale combines tier and New Game+', () => { const g = { state: { settings: { difficulty: 'rip' }, ng: 2 }, systems: {} }; const d = new Difficulty(g); const s = d.scale(); near(s.hp, TIERS.rip.hp * (1 + 2 * NG_STEP.hp)); near(s.dmg, TIERS.rip.dmg * (1 + 2 * NG_STEP.dmg)); eq(d.label(), 'Rip  NG+2'); });
test('difficulty: rift and arena multipliers stack on top', () => { const g = { state: { settings: { difficulty: 'tide' }, ng: 0 }, systems: { rifts: { mult: () => ({ hp: 2, dmg: 1.5, xp: 1, coin: 3 }) } } }; const s = new Difficulty(g).scale(); eq(s.hp, 2); eq(s.coin, 3); });
test('difficulty: NG+ carries the character and resets the world', () => {
  const g = { state: { settings: {}, ng: 0 }, systems: {} }, d = new Difficulty(g); const old = newState(); Object.assign(old, { level: 20, form: 'mythic', coins: 500, flags: { quest_done_mq1: true }, bosses: { grumbold: true }, visited: { reef_garden: true }, inv: { kelp_wrap: 2, vault_key: 1, claw_rusty: 1 } }); old.records.kills.pinchling = 5;
  const fresh = d.carry(old, newState()); eq(fresh.ng, 1); eq(fresh.level, 20); eq(fresh.form, 'mythic'); eq(fresh.coins, 500); eq(Object.keys(fresh.bosses).length, 0); eq(Object.keys(fresh.visited).length, 0); ok(!fresh.flags.quest_done_mq1); ok(fresh.flags.evolved_warrior && fresh.flags.evolved_mythic); ok(fresh.inv.kelp_wrap === 2 && !fresh.inv.vault_key && fresh.inv.claw_rusty === 1); eq(fresh.records.kills.pinchling, 5);
});
test('difficulty: NG+ is capped', () => { const d = new Difficulty({ state: { settings: {} }, systems: {} }); const o = newState(); o.ng = NG_MAX; eq(d.carry(o, newState()).ng, NG_MAX); ok(NG_KEEP.includes('records')); });

test('arena: wave budgets and unlocks grow', () => { for (let n = 2; n < 40; n++) { ok(waveBudget(n) > waveBudget(n - 1)); ok(unlocked(n) >= unlocked(n - 1)); } ok(ARENA_POOL.length >= 20); ok(ARENA_POOL.every((t) => ENEMIES[t].dmg > 0)); });
test('arena: waves are deterministic and stay within caps', () => { for (const n of [1, 5, 12, 30]) { const a = composeWave(n, rng(n)), b = composeWave(n, rng(n)); deep(a, b); ok(a.length >= 1 && a.length <= 18, `wave ${n}: ${a.length}`); } });
test('arena: later waves are tougher on average', () => { const power = (t) => ENEMIES[t].hp + ENEMIES[t].dmg * 4; const avg = (n) => { let s = 0, c = 0; for (let k = 0; k < 30; k++) for (const t of composeWave(n, rng(k + 1))) { s += power(t); c++; } return s / c; }; ok(avg(25) > avg(2)); });

test('rift ids round-trip', () => { const id = riftId(123456, 3, 6); deep(parseId(id), { kind: 'rift', seed: 123456, depth: 3, max: 6 }); deep(parseId(arenaId(42)), { kind: 'arena', seed: 42 }); ok(isProcedural(id) && isProcedural('arena:1') && !isProcedural('reef_garden')); eq(parseId('reef_garden'), null); });
test('rift themes only include unlocked realms', () => { const t = riftThemes(7, ['reef', 'forest']); deep([...t].sort(), ['forest', 'reef']); deep(riftThemes(7, []), ['reef']); deep(riftThemes(7, THEME_ORDER).length, THEME_ORDER.length); deep(riftThemes(5, THEME_ORDER), riftThemes(5, THEME_ORDER)); });
test('every theme names real enemies', () => { for (const [k, t] of Object.entries(THEMES)) { ok(ENEMIES[t.tough], k); for (const e of t.pool) ok(ENEMIES[e], `${k}:${e}`); } });
test('rift chambers are deterministic, sealed until the last depth, and spawn foes', () => { setRiftThemes(THEME_ORDER); for (const d of [1, 2, 3]) { const id = riftId(99, d, 3), a = buildRift(id), b = buildRift(id); eq(a.w, b.w); eq(a.spawns.length, b.spawns.length); if (d < 3) ok(a.spawns.length >= 2); eq(a.exits.length, d < 3 ? 1 : 0); ok(a.entries.west && a.entries.east); eq(a.rift.last, d === 3); } });
test('rift chambers get busier with depth', () => { setRiftThemes(THEME_ORDER); let early = 0, late = 0; for (let seed = 1; seed <= 12; seed++) { early += buildRift(riftId(seed, 1, 8)).spawns.length; late += buildRift(riftId(seed, 7, 8)).spawns.length; } ok(late > early); });
test('the last chamber holds only the repeatable Rift Warden, inside open water', () => {
  setRiftThemes(THEME_ORDER);
  for (const max of [4, 6, 8]) { const z = buildRift(riftId(31, max, max)); eq(z.spawns.length, 1); const s = z.spawns[0]; eq(s.boss, 'rift_warden'); ok(s.repeat); ok(s.arena.w > 50 && s.trigger.x > s.arena.x); ok(!isSolid(z.grid.get(Math.floor(s.x / 16), Math.floor(s.y / 16)))); }
  for (const d of [1, 2, 3]) ok(!buildRift(riftId(31, d, 4)).spawns.some((s) => s.boss));
});
test('the arena has spawn columns and an entry', () => { const z = buildArena(arenaId(9)); ok(z.arena && z.points.length >= 6 && z.entries.start); });

test('save codes round-trip through export and import', () => { const s = newState(); s.level = 17; Save.write(0, { v: 1, meta: { level: 17 }, state: s }); const code = Save.exportCode(0); ok(code.startsWith('MB1.')); const r = Save.importCode(1, code); ok(r.ok); eq(Save.read(1).state.level, 17); });
test('save import rejects damage and nonsense', () => { const s = newState(); Save.write(0, { v: 1, meta: {}, state: s }); const code = Save.exportCode(0); ok(!Save.importCode(2, 'nonsense').ok); ok(!Save.importCode(2, code.slice(0, -3) + 'xyz').ok); const parts = code.split('.'); ok(!Save.importCode(2, [parts[0], 'bad', parts[2]].join('.')).ok); });
test('save validation catches missing fields', () => { eq(validate(null) !== null, true); const s = newState(); eq(validate({ state: s }), null); delete s.checkpoint; ok(validate({ state: s })); const t = newState(); t.level = 500; ok(validate({ state: t })); });
test('stats: a fresh state has sane base values', () => { const st = computeStats(newState()); ok(st.maxHp > 0 && st.atk > 0 && st.speed > 0); });
