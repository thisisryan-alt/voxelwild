// Enchanting (Minecraft's, simplified): an enchanting table offers three enchantments for the held tool, weapon or
// armour piece, costing levels and lapis lazuli. Enchantments live on the stack (stack.ench = { key: level }).
import { ITEMS, Kind, ToolType, I } from './blocks.js';

export const ENCHANTS = {
  sharpness: { name: 'Sharpness', max: 5, for: ['sword', 'axe'] },
  fire_aspect: { name: 'Fire Aspect', max: 2, for: ['sword'] },
  looting: { name: 'Looting', max: 3, for: ['sword'] },
  knockback: { name: 'Knockback', max: 2, for: ['sword'] },
  efficiency: { name: 'Efficiency', max: 5, for: ['pickaxe', 'axe', 'shovel', 'hoe'] },
  fortune: { name: 'Fortune', max: 3, for: ['pickaxe'] },
  silk_touch: { name: 'Silk Touch', max: 1, for: ['pickaxe', 'axe', 'shovel'], clash: 'fortune' },
  unbreaking: { name: 'Unbreaking', max: 3, for: ['sword', 'pickaxe', 'axe', 'shovel', 'hoe', 'armor', 'bow'] },
  protection: { name: 'Protection', max: 4, for: ['armor'] },
  feather_falling: { name: 'Feather Falling', max: 4, for: ['boots'] },
  power: { name: 'Power', max: 5, for: ['bow'] },
  infinity: { name: 'Infinity', max: 1, for: ['bow'] },
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

/** What kind of thing an item is, for enchanting ('sword', 'pickaxe', 'armor', 'boots', 'bow', ...), or null. */
export function enchantKind(item) {
  const d = ITEMS[item];
  if (!d) return null;
  if (item === I.Bow) return 'bow';
  if (d.kind === Kind.Armor) return d.slot === 3 ? 'boots' : 'armor';
  if (d.kind !== Kind.Tool) return null;
  return { [ToolType.Sword]: 'sword', [ToolType.Pickaxe]: 'pickaxe', [ToolType.Axe]: 'axe', [ToolType.Shovel]: 'shovel', [ToolType.Hoe]: 'hoe' }[d.tool] || null;
}
const fits = (e, kind) => e.for.includes(kind) || (kind === 'boots' && e.for.includes('armor'));

/** Three offers for an item: [{ levels, lapis, ench: { key: level } }] (seeded, so they stay put until used). */
export function enchantOffers(item, seed) {
  const kind = enchantKind(item);
  if (!kind) return [];
  let s = (seed ^ Math.imul(item, 2654435761)) >>> 0;
  const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 374761393) >>> 0; return (s >>> 8) / 16777216; };
  const pool = Object.entries(ENCHANTS).filter(([, e]) => fits(e, kind));
  return [[1, 5], [2, 15], [3, 30]].map(([lapis, levels]) => {
    const power = levels / 30, ench = {};
    const n = 1 + (rnd() < power * 0.7 ? 1 : 0) + (rnd() < power * 0.35 ? 1 : 0);
    for (let k = 0; k < n && pool.length; k++) {
      const [key, e] = pool[Math.floor(rnd() * pool.length)];
      if (ench[key] || (e.clash && ench[e.clash]) || Object.keys(ench).some((o) => ENCHANTS[o].clash === key)) continue;
      ench[key] = Math.max(1, Math.min(e.max, Math.round(e.max * (0.25 + power * 0.75) * (0.7 + rnd() * 0.5))));
    }
    return { levels, lapis, ench };
  });
}

export const enchLevel = (stack, key) => (stack && stack.ench && stack.ench[key]) || 0;
export const enchText = (ench) => Object.entries(ench || {}).map(([k, v]) => `${ENCHANTS[k] ? ENCHANTS[k].name : k} ${ROMAN[v] || v}`).join(', ');

/** Minecraft's experience curve: points needed to go from level L to L + 1. */
export const xpToNext = (L) => (L < 16 ? 2 * L + 7 : L < 31 ? 5 * L - 38 : 9 * L - 158);
