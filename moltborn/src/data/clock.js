// The tide clock: one day on the reef lasts ten minutes of play. Each phase has a name, a short line shown when it begins,
// small gameplay modifiers, and the colour the picture is graded towards. `GRADE_KEYS` are anchor points around the
// cycle; the picture is blended between them so the light changes smoothly instead of switching.
export const CYCLE = 600;          // seconds of play per day
export const START = 0.2;          // a new voyage begins mid-morning

export const PHASES = [
  { id: 'dawn',  name: 'Dawn Tide',  from: 0.00, to: 0.10, line: 'First light finds the reef.', status: 'sunlit', mods: { xp: 1, coin: 1, aggro: 1 } },
  { id: 'day',   name: 'High Sun',   from: 0.10, to: 0.50, line: 'The water is bright and warm.', status: 'sunlit', mods: { xp: 1, coin: 1, aggro: 1 } },
  { id: 'dusk',  name: 'Dusk Tide',  from: 0.50, to: 0.62, line: 'Merchants pay better at dusk.', status: null, mods: { xp: 1, coin: 1.1, aggro: 1 } },
  { id: 'night', name: 'Deep Night', from: 0.62, to: 1.00, line: 'Foes grow wary. Hunting pays more.', status: 'moonlit', mods: { xp: 1.15, coin: 1, aggro: 1.2 } },
];

// colour anchors: t is the point in the cycle, c the tint, a how strongly it is laid over the picture, dark the extra shade
export const GRADE_KEYS = [
  { t: 0.00, c: [255, 154, 106], a: 0.10, dark: 0.04 },
  { t: 0.10, c: [255, 255, 255], a: 0.00, dark: 0.00 },
  { t: 0.46, c: [255, 255, 255], a: 0.00, dark: 0.00 },
  { t: 0.52, c: [255, 122, 80],  a: 0.12, dark: 0.04 },
  { t: 0.62, c: [106, 74, 168],  a: 0.22, dark: 0.18 },
  { t: 0.70, c: [24, 36, 120],   a: 0.34, dark: 0.36 },
  { t: 0.94, c: [24, 36, 120],   a: 0.34, dark: 0.36 },
  { t: 1.00, c: [255, 154, 106], a: 0.10, dark: 0.04 },
];

// how much of the weather of the sky reaches a realm (the deep is always dark)
export const OPENNESS = { reef: 1, forest: 0.75, kingdom: 0.8, domain: 0.5, graveyard: 0.45, abyss: 0.12, trench: 0.1 };

export function phaseAt(frac) { const f = ((frac % 1) + 1) % 1; return PHASES.find((p) => f >= p.from && f < p.to) || PHASES[0]; }
export function gradeAt(frac) {
  const f = ((frac % 1) + 1) % 1; let i = 0; while (i < GRADE_KEYS.length - 2 && f >= GRADE_KEYS[i + 1].t) i++;
  const a = GRADE_KEYS[i], b = GRADE_KEYS[i + 1], k = Math.max(0, Math.min(1, (f - a.t) / Math.max(1e-6, b.t - a.t))), s = k * k * (3 - 2 * k);
  return { r: a.c[0] + (b.c[0] - a.c[0]) * s, g: a.c[1] + (b.c[1] - a.c[1]) * s, b: a.c[2] + (b.c[2] - a.c[2]) * s, a: a.a + (b.a - a.a) * s, dark: a.dark + (b.dark - a.dark) * s };
}
