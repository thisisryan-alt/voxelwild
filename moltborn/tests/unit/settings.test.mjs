import { test, ok, eq, deep } from './harness.mjs';
import { SCHEMA, GROUPS, BY_KEY, defaults, ensureSettings, setting, stepSetting, displayValue, motionScale, flashScale, DIFFICULTIES } from '../../src/systems/settings.js';

test('every setting has a group, key, label and a default in range', () => { for (const r of SCHEMA) { ok(r.group && r.key && r.label, r.key); if (r.type === 'slider') ok(r.def >= r.min && r.def <= r.max, r.key); if (r.type === 'cycle') ok(r.options.includes(r.def), r.key); } });
test('keys are unique', () => { eq(new Set(SCHEMA.map((r) => r.key)).size, SCHEMA.length); });
test('there are four option pages', () => { deep(GROUPS, ['Audio', 'Video', 'Gameplay', 'Access']); });
test('defaults skip runtime-only rows', () => { ok(!('mute' in defaults())); ok('bloom' in defaults()); });
test('ensureSettings fills gaps and keeps unknown keys', () => { const s = ensureSettings({ endings: ['slay'], bloom: 0.3 }); eq(s.bloom, 0.3); eq(s.difficulty, 'tide'); deep(s.endings, ['slay']); });
test('ensureSettings clamps and normalises bad values', () => { const s = ensureSettings({ music: 9, scanlines: 'yes', difficulty: 'nightmare', uiScale: 5 }); eq(s.music, 1); eq(s.scanlines, 1); eq(s.difficulty, 'tide'); eq(s.uiScale, 'normal'); });
test('stepSetting steps sliders in both directions and clamps', () => { const r = BY_KEY.music; eq(stepSetting(r, 0.7, 1), 0.8); eq(stepSetting(r, 0.7, -1), 0.6); eq(stepSetting(r, 1, 1), 1); eq(stepSetting(r, 0, -1), 0); });
test('stepSetting toggles and cycles', () => { eq(stepSetting(BY_KEY.scanlines, 0, 1), 1); eq(stepSetting(BY_KEY.scanlines, 1, 1), 0); eq(stepSetting(BY_KEY.difficulty, 'maelstrom', 1), 'calm'); eq(stepSetting(BY_KEY.difficulty, 'calm', -1), 'maelstrom'); });
test('displayValue formats each type', () => { eq(displayValue(BY_KEY.music, 0.7), '70%'); eq(displayValue(BY_KEY.scanlines, 1), 'ON'); eq(displayValue(BY_KEY.difficulty, 'rip'), 'RIP'); });
test('setting() falls back to the default', () => { eq(setting({ state: { settings: {} } }, 'bloom'), 0.6); eq(setting({}, 'bloom'), 0.6); eq(setting({ state: { settings: { bloom: 0.2 } } }, 'bloom'), 0.2); });
test('motion and flash helpers follow the access options', () => { const g = (o) => ({ state: { settings: o } }); eq(motionScale(g({ reduceMotion: 1 })), 0); eq(motionScale(g({})), 1); eq(flashScale(g({ reduceFlashes: 1 })), 0.25); });
test('difficulty tiers match the options', () => { deep(DIFFICULTIES, BY_KEY.difficulty.options); });

// ---- the settings added with the newer systems --------------------------------------------------------------------------------------------
import { SCHEMA as SCHEMA2, BY_KEY as BY_KEY2, ensureSettings as ensure2, defaults as defaults2 } from '../../src/systems/settings.js';
test('day and night, the clock readout and surges are options with sensible defaults', () => {
  eq(BY_KEY2.dayNight.type, 'cycle'); ok(BY_KEY2.dayNight.options.includes('off') && BY_KEY2.dayNight.options.includes('subtle') && BY_KEY2.dayNight.options.includes('full')); eq(BY_KEY2.dayNight.def, 'full');
  eq(BY_KEY2.showClock.type, 'toggle'); eq(BY_KEY2.showClock.def, 1); eq(BY_KEY2.surges.type, 'toggle'); eq(BY_KEY2.surges.def, 1); eq(BY_KEY2.dayNight.group, 'Video'); eq(BY_KEY2.surges.group, 'Gameplay');
});
test('a damaged value for a new option falls back to its default and a good one survives', () => {
  const s = ensure2({ dayNight: 'sideways', surges: 'yes', showClock: 0 }); eq(s.dayNight, 'full'); eq(s.surges, 1); eq(s.showClock, 0); const t = ensure2({ dayNight: 'subtle' }); eq(t.dayNight, 'subtle'); eq(t.surges, 1);
});
test('every option has a unique key, a label and a hint that is not too long for the screen', () => {
  eq(new Set(SCHEMA2.map((r) => r.key)).size, SCHEMA2.length); for (const r of SCHEMA2) { ok(r.label && r.label.length < 28, r.key); if (r.hint) ok(r.hint.length < 120, r.key + ' hint'); } ok(Object.keys(defaults2()).length >= SCHEMA2.length - SCHEMA2.filter((r) => r.runtime).length);
});
