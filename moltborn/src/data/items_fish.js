// Every fish is an ingredient, and a handful of dishes are built from them. Merged into CRAFT_ITEMS (items_craft.js).
import { FISH } from './fish.js';

export const FISH_INGREDIENTS = Object.fromEntries(FISH.map((f) => [`fish_${f.id}`, { name: f.name, type: 'ingredient', price: Math.max(6, Math.round(f.value * 0.6)), icon: ['fish', f.color], fish: f.id, desc: f.note }]));

export const FISH_DISHES = {
  grilled_silverfin: { name: 'Grilled Silverfin', type: 'dish', icon: ['potion', 'white'], desc: 'Salt, smoke and a hot rock. Heals a third of your health and quickens your stroke.', use: { heal: 0.3, buffs: [{ id: 'haste', dur: 20 }] } },
  bream_chowder: { name: 'Bream Chowder', type: 'dish', icon: ['potion', 'orange'], desc: 'Creamy, golden and filling. Heals and wards you for half a minute.', use: { heal: 0.4, buffs: [{ id: 'ward', dur: 30 }] } },
  glass_carpaccio: { name: 'Glassfin Carpaccio', type: 'dish', icon: ['potion', 'cyan'], desc: 'Sliced so thin the plate shows through. Sharpens strength and Tide at once.', use: { buffs: [{ id: 'might', dur: 30 }, { id: 'focus', dur: 25 }] } },
  koi_pie: { name: 'Gilded Koi Pie', type: 'dish', icon: ['potion', 'gold'], desc: 'A pie for people who have everything. Coins find you for a full minute, and you mend a little.', use: { heal: 0.2, buffs: [{ id: 'fortune', dur: 60 }, { id: 'regen', dur: 12 }] } },
  angler_stew: { name: 'Lantern Stew', type: 'dish', icon: ['potion', 'purple'], desc: 'It glows faintly. Refills some Tide and keeps it coming back.', use: { tide: 0.4, buffs: [{ id: 'focus', dur: 30 }, { id: 'regen', dur: 10 }] } },
  eel_skewers: { name: 'Mossy Eel Skewers', type: 'dish', icon: ['potion', 'green'], desc: 'Long strips of eel, charred over the vent and wrapped in kelp. Mends over time and hardens you for a while.', use: { heal: 0.25, buffs: [{ id: 'regen', dur: 15 }, { id: 'ward', dur: 25 }] } },
  carp_jelly: { name: 'Court Carp in Jelly', type: 'dish', icon: ['potion', 'purple'], desc: 'The Pearl Court served this on feast days. The jelly is cool, the carp is a little smug. Clears the mind and the body.', use: { cleanse: 3, tide: 0.35, buffs: [{ id: 'focus', dur: 25 }] } },
  pike_broth: { name: 'Ghost Pike Broth', type: 'dish', icon: ['potion', 'white'], desc: 'It is pale, cold and nearly weightless. You feel quick, and slightly seen through.', use: { buffs: [{ id: 'haste', dur: 30 }, { id: 'focus', dur: 20 }] } },
  bait_kelp: { name: 'Kelp Ball', type: 'dish', icon: ['drop', 'green'], desc: 'Chewed kelp rolled round a hook. Rarer fish bite for the next four minutes.', use: { buffs: [{ id: 'baited', dur: 240, power: 1 }] } },
  bait_glow: { name: 'Glow Bait', type: 'dish', icon: ['drop', 'orange'], desc: 'A spore and a scale in a knot of weed. It glows in the water; the fish come to look. Much better odds for four minutes.', use: { buffs: [{ id: 'baited', dur: 240, power: 2 }] } },
  bait_pearl: { name: 'Pearl Lure', type: 'dish', icon: ['pearl', 'white'], desc: 'A pearl on a hook is vanity. It works. The best odds there are, for two minutes.', use: { buffs: [{ id: 'baited', dur: 120, power: 3.5 }] } },
  moon_sashimi: { name: 'Moonlit Sashimi', type: 'dish', icon: ['potion', 'white'], desc: 'Cut thin, eaten slowly, remembered a long time. Might, haste and a deep calm.', use: { heal: 0.25, buffs: [{ id: 'might', dur: 40 }, { id: 'haste', dur: 30 }, { id: 'ward', dur: 30 }] } },
};
export const FISH_RECIPES = [
  { id: 'grilled_silverfin', out: 'grilled_silverfin', n: 1, needs: { fish_silverfin: 2, brine_salt: 1 }, note: 'Nothing fancy: a hot stone and patience.' },
  { id: 'bream_chowder', out: 'bream_chowder', n: 1, needs: { fish_reef_bream: 2, kelp_frond: 1, brine_salt: 1 }, note: 'Bones for the stock, meat for the bowl.' },
  { id: 'glass_carpaccio', out: 'glass_carpaccio', n: 1, needs: { fish_glassfin: 1, urchin_spine: 1 }, note: 'The urchin spine is the knife.' },
  { id: 'koi_pie', out: 'koi_pie', n: 1, needs: { fish_gilded_koi: 1, shell_chip: 1, kelp_frond: 1 }, note: 'The crust is gold leaf. The koi did not mind.' },
  { id: 'angler_stew', out: 'angler_stew', n: 1, needs: { fish_lantern_smelt: 2, glow_spore: 1 }, note: 'A stew that finds its own way to the table.' },
  { id: 'eel_skewers', out: 'eel_skewers', n: 1, needs: { fish_moss_eel: 1, kelp_frond: 1 }, note: 'The kelp keeps the eel from sliding off.' },
  { id: 'carp_jelly', out: 'carp_jelly', n: 1, needs: { fish_court_carp: 1, jelly_gel: 1 }, note: 'Chill it. Serve it to someone you are trying to impress.' },
  { id: 'pike_broth', out: 'pike_broth', n: 1, needs: { fish_ghost_pike: 1, bone_dust: 1 }, note: 'Made at night, drunk at night.' },
  { id: 'bait_kelp', out: 'bait_kelp', n: 2, needs: { kelp_frond: 2, brine_salt: 1 }, note: 'Two balls from one batch. The fish are not proud.' },
  { id: 'bait_glow', out: 'bait_glow', n: 2, needs: { glow_spore: 1, fin_scale: 1 }, note: 'The spore is the lamp; the scale is the lie.' },
  { id: 'bait_pearl', out: 'bait_pearl', n: 1, needs: { pearl: 1, fish_silverfin: 1 }, note: 'A silverfin on a pearl. Cannibals love it.' },
  { id: 'moon_sashimi', out: 'moon_sashimi', n: 1, needs: { fish_moon_koi: 1, brine_salt: 1 }, note: 'Only if you caught it yourself.' },
];
