// Player-facing settings: one schema drives the defaults, the options screen and every system that reads a setting.
// Settings persist separately from save slots (see core/save.js) so they follow the player across games.

export const DIFFICULTIES = ['calm', 'tide', 'rip', 'maelstrom'];

// type: 'slider' (min..max by step), 'toggle', 'cycle' (options list)
export const SCHEMA = [
  { group: 'Audio', key: 'music', label: 'Music volume', type: 'slider', min: 0, max: 1, step: 0.1, def: 0.7 },
  { group: 'Audio', key: 'sfx', label: 'Effects volume', type: 'slider', min: 0, max: 1, step: 0.1, def: 0.8 },
  { group: 'Audio', key: 'ambience', label: 'Ambience volume', type: 'slider', min: 0, max: 1, step: 0.1, def: 0.6 },
  { group: 'Audio', key: 'deepMuffle', label: 'Deep-water muffling', type: 'toggle', def: 1, hint: 'Sounds dull and heavy the deeper you go.' },
  { group: 'Audio', key: 'mute', label: 'Mute all', type: 'toggle', def: 0, runtime: true },

  { group: 'Video', key: 'bloom', label: 'Glow (bloom)', type: 'slider', min: 0, max: 1, step: 0.1, def: 0.6, hint: 'Bright things bleed light into the water.' },
  { group: 'Video', key: 'grading', label: 'Colour grading', type: 'slider', min: 0, max: 1, step: 0.1, def: 0.8, hint: 'Each realm gets its own palette tilt.' },
  { group: 'Video', key: 'wobble', label: 'Water refraction', type: 'slider', min: 0, max: 1, step: 0.1, def: 0.5, hint: 'A gentle shimmer of the picture itself.' },
  { group: 'Video', key: 'particles', label: 'Particle density', type: 'slider', min: 0.2, max: 1, step: 0.2, def: 1 },
  { group: 'Video', key: 'scanlines', label: 'Scanlines', type: 'toggle', def: 0 },
  { group: 'Video', key: 'ambientLife', label: 'Ambient sea life', type: 'toggle', def: 1, hint: 'Fish, jellies, whales and other background life.' },
  { group: 'Video', key: 'dayNight', label: 'Day and night', type: 'cycle', options: ['off', 'subtle', 'full'], def: 'full', hint: 'A ten-minute day: the light changes, and so do the odds. Off keeps the reef at noon.' },
  { group: 'Video', key: 'showClock', label: 'Show clock', type: 'toggle', def: 1, hint: 'A small sun or moon beside your coins.' },
  { group: 'Video', key: 'showFps', label: 'Show FPS', type: 'toggle', def: 0 },

  { group: 'Gameplay', key: 'difficulty', label: 'Difficulty', type: 'cycle', options: DIFFICULTIES, def: 'tide', hint: 'Calm: forgiving. Tide: as designed. Rip: tougher foes. Maelstrom: unforgiving.' },
  { group: 'Gameplay', key: 'surges', label: 'Tidal surges', type: 'toggle', def: 1, hint: 'Now and then the sea heaves: currents push you, then wash up flotsam.' },
  { group: 'Gameplay', key: 'mouseAttack', label: 'Mouse attacks', type: 'toggle', def: 1, hint: 'Left click claws (hold to keep going), right click heavy claws, middle click dashes.' },
  { group: 'Gameplay', key: 'mouseAim', label: 'Aim with mouse', type: 'toggle', def: 1, hint: 'Mouse attacks and dashes turn toward the pointer.' },
  { group: 'Gameplay', key: 'packTactics', label: 'Pack tactics', type: 'toggle', def: 1, hint: 'Foes take turns attacking instead of piling on all at once.' },
  { group: 'Gameplay', key: 'shake', label: 'Screen shake', type: 'slider', min: 0, max: 1, step: 0.1, def: 1 },
  { group: 'Gameplay', key: 'damageNumbers', label: 'Damage numbers', type: 'cycle', options: ['off', 'small', 'normal'], def: 'normal' },
  { group: 'Gameplay', key: 'minimap', label: 'Minimap', type: 'cycle', options: ['off', 'small', 'large'], def: 'small', hint: 'Press N in game to cycle it.' },
  { group: 'Gameplay', key: 'showDps', label: 'Damage meter', type: 'toggle', def: 0, hint: 'Shows your damage per second over the last few seconds.' },
  { group: 'Gameplay', key: 'tips', label: 'Hints', type: 'toggle', def: 1 },
  { group: 'Gameplay', key: 'comboCounter', label: 'Combo counter', type: 'toggle', def: 1 },
  { group: 'Gameplay', key: 'cameraPunch', label: 'Camera punch', type: 'slider', min: 0, max: 1, step: 0.1, def: 0.7, hint: 'Small zooms and nudges on big hits.' },

  { group: 'Access', key: 'captions', label: 'Sound captions', type: 'toggle', def: 0, hint: 'Describes important sounds in text, with arrows for direction.' },
  { group: 'Access', key: 'reduceFlashes', label: 'Reduce flashes', type: 'toggle', def: 0, hint: 'Softens full-screen flashes and chromatic pulses.' },
  { group: 'Access', key: 'reduceMotion', label: 'Reduce motion', type: 'toggle', def: 0, hint: 'Turns off refraction, camera punch and screen shake.' },
  { group: 'Access', key: 'highContrast', label: 'High-contrast telegraphs', type: 'toggle', def: 0, hint: 'Bolder outlines around dangerous attacks.' },
  { group: 'Access', key: 'colorblind', label: 'Colour-blind palette', type: 'cycle', options: ['off', 'red-green', 'blue-yellow'], def: 'off' },
  { group: 'Access', key: 'uiScale', label: 'HUD size', type: 'cycle', options: ['normal', 'large'], def: 'normal' },
  { group: 'Access', key: 'haptics', label: 'Controller rumble', type: 'slider', min: 0, max: 1, step: 0.2, def: 0.8 },
];

export const GROUPS = [...new Set(SCHEMA.map((r) => r.group))];
export const BY_KEY = Object.fromEntries(SCHEMA.map((r) => [r.key, r]));

export function defaults() {
  const d = {};
  for (const r of SCHEMA) if (!r.runtime) d[r.key] = r.def;
  d.ui = 1;
  return d;
}

// fill anything missing, drop nothing (unknown keys belong to other systems: endings, trophies, keymap...)
export function ensureSettings(s) {
  for (const r of SCHEMA) {
    if (r.runtime) continue;
    if (s[r.key] === undefined) { s[r.key] = r.def; continue; }
    if (r.type === 'slider') s[r.key] = Math.min(r.max, Math.max(r.min, +s[r.key] || 0));
    else if (r.type === 'toggle') s[r.key] = s[r.key] ? 1 : 0;
    else if (r.type === 'cycle' && !r.options.includes(s[r.key])) s[r.key] = r.def;
  }
  return s;
}

// a tolerant reader for systems that may run before settings are fully populated
export function setting(game, key) {
  const s = game?.state?.settings, r = BY_KEY[key];
  const v = s ? s[key] : undefined;
  return v === undefined ? (r ? r.def : undefined) : v;
}

// step a row by one notch in a direction (+1/-1); returns the new value
export function stepSetting(row, value, dir) {
  if (row.type === 'toggle') return value ? 0 : 1;
  if (row.type === 'cycle') { const i = Math.max(0, row.options.indexOf(value)); return row.options[(i + dir + row.options.length) % row.options.length]; }
  const n = Math.round((value + dir * row.step) / row.step) * row.step;
  return Math.min(row.max, Math.max(row.min, Math.round(n * 100) / 100));
}

export function displayValue(row, value) {
  if (row.type === 'toggle') return value ? 'ON' : 'OFF';
  if (row.type === 'cycle') return String(value).toUpperCase();
  return Math.round(value * 100) + '%';
}

// the motion/flash switches collapse several settings into one question for the renderers
export function motionScale(game) { return setting(game, 'reduceMotion') ? 0 : 1; }
export function flashScale(game) { return setting(game, 'reduceFlashes') ? 0.25 : 1; }
