// The Trial room timing rules, the room's place in the rift tables and its drive from the Rifts system.
import { test, ok, eq, near } from './harness.mjs';
import { TRIAL, newTrial, stepTrial, clockText, waveSize, waveElite } from '../../src/systems/rift_trial.js';
import { riftKind, ROOM_KINDS, buildRift, riftId, setRiftThemes, THEME_ORDER } from '../../src/world/rift_gen.js';

const simulate = (depth = 3, pending = () => 0, seconds = TRIAL.length + 2, dt = 0.1) => {
  const tr = newTrial(), waves = []; let t = 0;
  while (t < seconds) { const n = stepTrial(tr, dt, depth, pending()); if (n) waves.push({ t: +t.toFixed(1), n }); t += dt; }
  return { tr, waves };
};

test('a new trial starts with the full clock, no waves and is not done', () => { const tr = newTrial(); eq(tr.left, TRIAL.length); eq(tr.waves, 0); ok(!tr.done); });
test('the first wave comes after the first delay and the rest at the set gap', () => {
  const { waves } = simulate(); ok(waves.length >= 3); near(waves[0].t, TRIAL.firstWave, 0.15); for (let i = 1; i < waves.length; i++) near(waves[i].t - waves[i - 1].t, TRIAL.gap, 0.15);
});
test('no wave arrives in the last seconds, so the end is a clean-up', () => { const { waves } = simulate(); for (const w of waves) ok(w.t <= TRIAL.length - TRIAL.stopSpawning + 0.1, 'wave at ' + w.t); });
test('the trial ends exactly when the clock runs out, and then stays ended', () => { const { tr } = simulate(); ok(tr.done); eq(tr.left, 0); eq(stepTrial(tr, 5, 3), 0); eq(tr.waves, simulate().tr.waves, 'no waves after the end'); });
test('waves grow with depth (rifts are at most eight deep)', () => { ok(waveSize(2) < waveSize(8)); eq(waveSize(3), 3); eq(waveSize(8), 6); for (let d = 1; d <= 8; d++) ok(waveSize(d) >= 2 && waveSize(d) <= TRIAL.maxPending);  });
test('a crowd already in the water limits the next wave, and a full house blocks it', () => {
  const tr = newTrial(); tr.next = 0; eq(stepTrial(tr, 0.1, 6, 5), TRIAL.maxPending - 5); const tr2 = newTrial(); tr2.next = 0; eq(stepTrial(tr2, 0.1, 6, 9), 0); eq(tr2.waves, 1, 'the wave is still counted and the clock still resets'); ok(tr2.next > 0);
});
test('the clock text counts down in minutes and seconds', () => { const tr = newTrial(); eq(clockText(tr), '0:40'); tr.left = 9.2; eq(clockText(tr), '0:10'); tr.left = 0; eq(clockText(tr), '0:00'); tr.left = 65; eq(clockText(tr), '1:05'); });
test('later waves are likelier to be led by an elite, and deeper rifts more so', () => {
  const count = (left, depth) => { let n = 0; for (let s = 0; s < 400; s++) { const tr = { left, waves: s }; if (waveElite(tr, depth)) n++; } return n; };
  ok(count(5, 4) > count(38, 4), 'the end is worse than the start'); ok(count(20, 8) > count(20, 3), 'deeper is worse');
});
test('elite choice is repeatable for a given wave', () => { const tr = { left: 20, waves: 3 }; eq(waveElite(tr, 5), waveElite({ ...tr }, 5)); });

test('trials are a real room kind with a name and a blurb', () => { ok(ROOM_KINDS.trial && ROOM_KINDS.trial.name === 'Trial' && ROOM_KINDS.trial.blurb.length > 15); });
test('trials never appear in the first two depths, nor as the last room, nor straight after a calm room', () => {
  let seen = 0;
  for (let seed = 1; seed <= 400; seed++) for (const max of [4, 6, 8]) for (let d = 1; d <= max; d++) {
    const k = riftKind(seed * 13, d, max); if (k !== 'trial') continue; seen++; ok(d >= 3, `depth ${d}`); ok(d < max, 'not last'); const prev = riftKind(seed * 13, d - 1, max); ok(prev !== 'treasure' && prev !== 'altar', 'after ' + prev);
  }
  ok(seen > 100, 'they do occur: ' + seen);
});
test('a trial chamber is empty at the start, and is deterministic', () => {
  setRiftThemes(THEME_ORDER); let found = null; for (let seed = 1; seed < 400 && !found; seed++) if (riftKind(seed, 3, 6) === 'trial') found = seed;
  ok(found, 'a seed with a trial at depth 3'); const id = riftId(found, 3, 6), a = buildRift(id), b = buildRift(id); eq(a.rift.kind, 'trial'); eq(a.spawns.length, 0); eq(b.spawns.length, 0); eq(a.exits.length, 1, 'there is a way on'); eq(a.w, b.w);
});
