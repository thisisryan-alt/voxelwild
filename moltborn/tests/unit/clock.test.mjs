// The tide clock: phases tile the day, colours blend smoothly around the cycle, modifiers are sane, jumps land where asked.
import { test, ok, eq, near } from './harness.mjs';
import { CYCLE, START, PHASES, GRADE_KEYS, OPENNESS, phaseAt, gradeAt } from '../../src/data/clock.js';
import { Clock } from '../../src/systems/clock.js';
import { STATUS } from '../../src/systems/status.js';
import { defaults } from '../../src/systems/settings.js';

function fake(playtime = 0, mode = 'full') {
  const toasts = [], events = [], state = { playtime, settings: { ...defaults(), dayNight: mode } };
  const status = { list: new Set(), has(id) { return this.list.has(id); }, apply(id) { this.list.add(id); return true; }, remove(id) { return this.list.delete(id); } };
  const g = { state, systems: {}, world: { player: { status } }, toast: (m) => toasts.push(m), events: { emit: (...a) => events.push(a) }, toasts, evs: events };
  g.systems.clock = new Clock(g); return g;
}

test('the phases tile the day with no gaps or overlaps', () => {
  eq(PHASES[0].from, 0); eq(PHASES[PHASES.length - 1].to, 1);
  for (let i = 1; i < PHASES.length; i++) eq(PHASES[i].from, PHASES[i - 1].to);
  for (let f = 0; f < 1; f += 0.003) ok(phaseAt(f), 'phase at ' + f);
});
test('phaseAt wraps negative and large fractions', () => { eq(phaseAt(1.25).id, phaseAt(0.25).id); eq(phaseAt(-0.1).id, phaseAt(0.9).id); eq(phaseAt(0).id, 'dawn'); eq(phaseAt(0.3).id, 'day'); eq(phaseAt(0.55).id, 'dusk'); eq(phaseAt(0.8).id, 'night'); });
test('colour anchors are ordered and the cycle closes on itself', () => {
  for (let i = 1; i < GRADE_KEYS.length; i++) ok(GRADE_KEYS[i].t > GRADE_KEYS[i - 1].t);
  eq(GRADE_KEYS[0].t, 0); eq(GRADE_KEYS[GRADE_KEYS.length - 1].t, 1); const a = GRADE_KEYS[0], b = GRADE_KEYS[GRADE_KEYS.length - 1]; eq(JSON.stringify(a.c), JSON.stringify(b.c)); eq(a.a, b.a);
});
test('the grade blends smoothly: small steps never jump', () => {
  let prev = gradeAt(0); for (let f = 0.002; f <= 1; f += 0.002) { const g = gradeAt(f); ok(Math.abs(g.a - prev.a) < 0.02 && Math.abs(g.dark - prev.dark) < 0.03 && Math.abs(g.r - prev.r) < 25, 'jump near ' + f); prev = g; }
});
test('midday is clear and midnight is dark', () => { const noon = gradeAt(0.3), night = gradeAt(0.8); eq(noon.a, 0); eq(noon.dark, 0); ok(night.a > 0.3 && night.dark > 0.3); ok(night.b > night.r, 'night is blue'); });
test('every realm has an openness between 0 and 1, and the deep is darker than the shallows', () => { for (const [b, v] of Object.entries(OPENNESS)) ok(v > 0 && v <= 1, b); ok(OPENNESS.abyss < OPENNESS.forest && OPENNESS.reef === 1); });
test('modifiers are small and only reward or warn', () => { for (const p of PHASES) { const m = p.mods; ok(m.xp >= 1 && m.xp <= 1.3 && m.coin >= 1 && m.coin <= 1.3 && m.aggro >= 1 && m.aggro <= 1.4, p.id); } ok(PHASES.find((p) => p.id === 'night').mods.xp > 1); });
test('phase statuses exist and are passive', () => { for (const p of PHASES) if (p.status) { ok(STATUS[p.status], p.status); ok(STATUS[p.status].passive && !STATUS[p.status].harmful); } });

test('a new voyage starts in daylight', () => { const g = fake(0), C = g.systems.clock; eq(C.phase.id, 'day'); near(C.frac(), START, 1e-9); });
test('the clock advances with play time and wraps after a full cycle', () => {
  const g = fake(0), C = g.systems.clock; const f0 = C.frac(); g.state.playtime = CYCLE * 3; near(C.frac(), f0, 1e-9); g.state.playtime = CYCLE * 0.5; near(C.frac(), (f0 + 0.5) % 1, 1e-9);
});
test('night follows day in order', () => { const g = fake(0), C = g.systems.clock, seen = []; for (let t = 0; t < CYCLE; t += 5) { g.state.playtime = t; const id = C.phase.id; if (seen[seen.length - 1] !== id) seen.push(id); } eq(seen.join(), 'day,dusk,night,dawn,day'); });
test('untilNext counts down to the next phase', () => { const g = fake(0), C = g.systems.clock; const u = C.untilNext(); ok(u > 0 && u <= CYCLE * 0.4); g.state.playtime += u + 1; eq(C.phase.id, 'dusk'); });
test('jump lands in the asked phase and by fraction', () => { const g = fake(123), C = g.systems.clock; for (const id of ['dawn', 'day', 'dusk', 'night']) { C.jump(id); eq(C.phase.id, id); } C.jump(0.77); near(C.frac(), 0.77, 1e-9); g.state.playtime += 1; near(C.frac(), 0.77 + 1 / CYCLE, 1e-9); });
test('night multiplies experience through the difficulty hook, noon does not', () => {
  const g = fake(0), C = g.systems.clock; C.jump('night'); eq(C.mult().xp, 1.15); eq(C.aggro(), 1.2); C.jump('day'); eq(C.mult().xp, 1); eq(C.aggro(), 1); C.jump('dusk'); eq(C.mult().coin, 1.1);
});
test('with day and night off the clock changes nothing', () => { const g = fake(0, 'off'), C = g.systems.clock; C.jump('night'); eq(C.mult(), null); eq(C.aggro(), 1); ok(!C.on); });
test('moving into a new phase announces it once and swaps the status', () => {
  const g = fake(0), C = g.systems.clock, st = g.world.player.status; C.update(0); ok(st.has('sunlit')); eq(g.toasts.length, 0, 'no toast on the first sync');
  C.jump('night'); C.update(0); ok(st.has('moonlit') && !st.has('sunlit')); eq(g.toasts.length, 1); ok(g.toasts[0].includes('Deep Night') && g.toasts[0].length < 52); C.update(0); eq(g.toasts.length, 1, 'only once');
  C.jump('dusk'); C.update(0); ok(!st.has('moonlit') && !st.has('sunlit'), 'dusk has no status'); eq(g.evs.filter((e) => e[0] === 'phase').length, 2);
});
test('statuses are removed when the clock is turned off', () => { const g = fake(0), C = g.systems.clock, st = g.world.player.status; C.update(0); ok(st.has('sunlit')); g.state.settings.dayNight = 'off'; C.update(0); ok(!st.has('sunlit')); });
test('a lost status is restored by the periodic sync', () => { const g = fake(0), C = g.systems.clock, st = g.world.player.status; C.update(0); st.remove('sunlit'); C.update(2); ok(st.has('sunlit')); });
test('nightness is 0 by day and reaches 1 deep in the night', () => { const g = fake(0), C = g.systems.clock; C.jump('day'); near(C.nightness(), 0, 1e-9); C.jump(0.8); near(C.nightness(), 1, 1e-9); });
