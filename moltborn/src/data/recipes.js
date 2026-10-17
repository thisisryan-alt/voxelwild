// Recipes and ingredient drops. A recipe is discovered the first time the player has held every one of its ingredients.
//   needs: { item: count }   out: item id   n: how many are made   station: where it can be made ('anywhere' | 'shrine')
export const RECIPES = [
  { id: 'kelp_wrap', out: 'kelp_wrap', n: 1, needs: { kelp_frond: 3 }, note: 'Plain, quick and reliable.' },
  { id: 'brine_tonic', out: 'brine_tonic', n: 1, needs: { brine_salt: 2, kelp_frond: 1 }, note: 'Salt and greens: it restores Tide.' },
  { id: 'fury_ink', out: 'fury_ink', n: 1, needs: { ink_sac: 2, ember_ash: 1 }, note: 'Ink and fire. Handle with gloves.' },
  { id: 'kelp_stew', out: 'kelp_stew', n: 1, needs: { kelp_frond: 2, brine_salt: 1 }, note: 'The first thing every reef cook learns.' },
  { id: 'urchin_fry', out: 'urchin_fry', n: 1, needs: { urchin_spine: 2, brine_salt: 1 }, note: 'Fried hot, eaten hotter.' },
  { id: 'jelly_jam', out: 'jelly_jam', n: 1, needs: { jelly_gel: 2, kelp_frond: 1 }, note: 'Spread thin. Do not let it set.' },
  { id: 'ink_noodles', out: 'ink_noodles', n: 1, needs: { ink_sac: 2, fin_scale: 1 }, note: 'Cut the noodles from kelp, dye them dark.' },
  { id: 'scale_chowder', out: 'scale_chowder', n: 1, needs: { fin_scale: 2, brine_salt: 1 }, note: 'Slow-cooked until the scales melt.' },
  { id: 'gilded_brulee', out: 'gilded_brulee', n: 1, needs: { pearl: 1, shell_chip: 1, brine_salt: 1 }, note: 'Fit for a court that no longer exists.' },
  { id: 'ember_curry', out: 'ember_curry', n: 1, needs: { ember_ash: 2, urchin_spine: 1 }, note: 'Only for those with a vent in the belly.' },
  { id: 'bone_broth', out: 'bone_broth', n: 1, needs: { bone_dust: 2, kelp_frond: 1 }, note: 'The wrecks give up their marrow.' },
  { id: 'pearl_elixir', out: 'pearl_elixir', n: 1, needs: { pearl: 1, jelly_gel: 2 }, note: 'A pearl is a lot to spend on a drink.' },
  { id: 'salve', out: 'salve', n: 2, needs: { jelly_gel: 1, glow_spore: 1 }, note: 'Cools what burns. Two jars from one batch.' },
];
import { FISH_RECIPES } from './items_fish.js';
RECIPES.push(...FISH_RECIPES);
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

// creature -> [ingredient, chance]. Chances are per kill; elites and bosses are not listed.
export const DROPS = {
  pinchling: [['brine_salt', 0.3]], minnow: [['fin_scale', 0.18]], urchin: [['urchin_spine', 0.45]], hermit: [['shell_chip', 0.35], ['brine_salt', 0.2]],
  moray: [['fin_scale', 0.35], ['kelp_frond', 0.15]], venomjelly: [['jelly_gel', 0.4]], sporepod: [['glow_spore', 0.35], ['kelp_frond', 0.2]],
  piranha: [['fin_scale', 0.25]], mossback: [['kelp_frond', 0.5], ['shell_chip', 0.15]],
  brineguard: [['shell_chip', 0.35], ['brine_salt', 0.25]], archerfish: [['fin_scale', 0.35]], puffer: [['urchin_spine', 0.35]], anemone_c: [['kelp_frond', 0.4], ['glow_spore', 0.15]],
  ghostsailor: [['bone_dust', 0.35]], cannon: [['ember_ash', 0.3]], ironturtle: [['shell_chip', 0.4]], barracuda: [['fin_scale', 0.4]], mimic: [['shell_chip', 0.5], ['ember_ash', 0.2]],
  lanternfish: [['glow_spore', 0.45]], gulper: [['jelly_gel', 0.25], ['fin_scale', 0.2]], inksquid: [['ink_sac', 0.5]], voidwisp: [['glow_spore', 0.25]], deepjelly: [['jelly_gel', 0.45]],
  bonecrawler: [['bone_dust', 0.45]], hollowshade: [['bone_dust', 0.3], ['ink_sac', 0.15]], wardenbone: [['bone_dust', 0.4], ['shell_chip', 0.2]], guardian: [['shell_chip', 0.35], ['bone_dust', 0.2]],
  stormhorse: [['fin_scale', 0.3], ['glow_spore', 0.15]], tidewisp: [['jelly_gel', 0.4]], tridentstatue: [['shell_chip', 0.3]],
  mantis: [['shell_chip', 0.3], ['fin_scale', 0.25]], spawncoral: [['kelp_frond', 0.3], ['glow_spore', 0.2]], splitjelly: [['jelly_gel', 0.5]], jellet: [['jelly_gel', 0.12]],
  hookjaw: [['fin_scale', 0.3], ['brine_salt', 0.2]], tuskram: [['bone_dust', 0.25], ['shell_chip', 0.2]], fumecap: [['ember_ash', 0.35], ['glow_spore', 0.3]],
};
