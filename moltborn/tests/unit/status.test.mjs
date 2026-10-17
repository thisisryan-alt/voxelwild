import { test, ok, eq, near } from './harness.mjs';
import { StatusSet, STATUS, BUFFS, DEBUFFS, dotDamage, hotHeal, applyHitStatuses } from '../../src/systems/status.js';

const mockEnemy = (hp = 100) => ({ maxHp: hp, hp, alive: true, def: {}, ticks: [], applied: [], ended: [],
  hurtDot(n, id) { this.hp -= n; this.ticks.push([id, n]); if (this.hp <= 0) this.alive = false; }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
  onStatusApplied(id) { this.applied.push(id); }, onStatusEnd(id) { this.ended.push(id); } });
const mockPlayer = () => ({ stats: { maxHp: 100 }, hp: 100, alive: true, hurtDot(n) { this.hp -= n; }, heal(n) { this.hp = Math.min(100, this.hp + n); } });

test('every status has a name, colour and a valid kind', () => { for (const [id, d] of Object.entries(STATUS)) { ok(d.name && d.color && d.dur > 0, id); ok(BUFFS.includes(id) !== DEBUFFS.includes(id), id + ' is both or neither'); } });
test('apply creates a status and notifies the owner', () => { const e = mockEnemy(), s = new StatusSet(e); ok(s.apply('burn')); ok(s.has('burn')); eq(e.applied[0], 'burn'); eq(s.size, 1); });
test('unknown statuses are refused', () => { const s = new StatusSet(mockEnemy()); eq(s.apply('nonsense'), false); });
test('reapplying refreshes time and stacks up to the cap', () => { const s = new StatusSet(mockEnemy()); for (let i = 0; i < 6; i++) s.apply('burn'); eq(s.get('burn').stacks, STATUS.burn.maxStacks); });
test('multipliers combine multiplicatively', () => { const s = new StatusSet(mockEnemy()); s.apply('chill'); s.apply('haste'); near(s.mult('speed'), 0.65 * 1.18); near(s.mult('dmgIn'), 1); s.apply('frail'); near(s.mult('dmgIn'), 1.25); });
test('statuses expire after their duration', () => { const e = mockEnemy(), s = new StatusSet(e); s.apply('chill', { dur: 1 }); for (let i = 0; i < 59; i++) s.update(1 / 60); ok(s.has('chill')); for (let i = 0; i < 4; i++) s.update(1 / 60); ok(!s.has('chill')); eq(e.ended[0], 'chill'); });
test('burn damages on its tick interval', () => { const e = mockEnemy(500), s = new StatusSet(e); s.apply('burn', { dur: 3 }); for (let i = 0; i < 62; i++) s.update(1 / 60); eq(e.ticks.length, 2); ok(e.hp < 500); });
test('damage scales with stacks and power', () => { const e = mockEnemy(500), s = { power: 1, stacks: 1 }, s3 = { power: 1, stacks: 3 }; ok(dotDamage(e, STATUS.burn, s3) > dotDamage(e, STATUS.burn, s)); });
test('bosses take far less damage over time than regular foes', () => { const reg = mockEnemy(1000), boss = mockEnemy(1000); boss.def.boss = true; const s = { power: 1, stacks: 1 }; ok(dotDamage(boss, STATUS.burn, s) < dotDamage(reg, STATUS.burn, s)); });
test('regeneration heals the owner', () => { const e = mockEnemy(100); e.hp = 50; const s = new StatusSet(e); s.apply('regen', { dur: 5 }); for (let i = 0; i < 120; i++) s.update(1 / 60); ok(e.hp > 50); });
test('hot healing uses the player max hp', () => { near(hotHeal(mockPlayer(), STATUS.regen, { power: 1 }), 2); });
test('immunity and resistance are honoured', () => { const e = mockEnemy(); e.immune = (id) => id === 'burn'; e.statusResist = () => 0.5; const s = new StatusSet(e); eq(s.apply('burn'), false); s.apply('chill', { dur: 4 }); near(s.get('chill').t, 2); });
test('cleanse removes only harmful effects, up to n', () => { const s = new StatusSet(mockEnemy()); s.apply('burn'); s.apply('chill'); s.apply('bleed'); s.apply('might'); eq(s.cleanse(2), 2); ok(s.has('might')); eq(s.size, 2); });
test('clear(true) keeps buffs', () => { const s = new StatusSet(mockEnemy()); s.apply('burn'); s.apply('ward'); s.clear(true); ok(!s.has('burn') && s.has('ward')); });
test('entries list buffs first', () => { const s = new StatusSet(mockEnemy()); s.apply('burn'); s.apply('might'); eq(s.entries()[0].id, 'might'); });
test('hit statuses apply from an ability object', () => { const s = new StatusSet(mockEnemy()); applyHitStatuses(s, { burn: 2, chill: 1 }); ok(s.has('burn') && s.has('chill')); eq(s.get('burn').power, 2); });
test('a dead owner stops ticking', () => { const e = mockEnemy(2), s = new StatusSet(e); s.apply('burn', { dur: 5, power: 5 }); for (let i = 0; i < 300; i++) s.update(1 / 60); ok(!e.alive); });
