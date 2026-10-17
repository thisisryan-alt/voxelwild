// Ingredients that creatures leave behind, and the dishes and tonics a cook can make from them. These merge into ITEMS
// (see the bottom of items.js) so inventory, the item menu and shops treat them like any other item.
//   type 'ingredient': raw material, icon given as [shape, colour]
//   type 'dish': eaten from the Items menu; use.heal / use.tide / use.fury as for consumables, use.buffs a list of
//   { id, dur?, power? } applied to the player's status set, use.cleanse removes that many harmful effects.
export const CRAFT_ITEMS = {
  // ---- ingredients ----------------------------------------------------------------------------------------------------------------
  kelp_frond:  { name: 'Kelp Frond', type: 'ingredient', icon: ['drop', 'green'], desc: 'A supple green ribbon. Chewy, salty, good for you.' },
  brine_salt:  { name: 'Brine Salt', type: 'ingredient', icon: ['drop', 'white'], desc: 'Coarse crystals scraped from a shell. Every kitchen on the reef runs on this.' },
  urchin_spine: { name: 'Urchin Spine', type: 'ingredient', icon: ['drop', 'purple'], desc: 'A hollow spine, still tingling. It adds a sharp kick to anything.' },
  jelly_gel:   { name: 'Jelly Gel', type: 'ingredient', icon: ['drop', 'cyan'], desc: 'Cool, clear and faintly glowing. Do not think about where it came from.' },
  ink_sac:     { name: 'Ink Sac', type: 'ingredient', icon: ['drop', 'black'], desc: 'Dark and glossy. It stains everything, including the taste.' },
  fin_scale:   { name: 'Fin Scale', type: 'ingredient', icon: ['drop', 'blue'], desc: 'A bright, thin scale. Crunches pleasantly when fried.' },
  glow_spore:  { name: 'Glow Spore', type: 'ingredient', icon: ['drop', 'orange'], desc: 'A pinch of living light. The soup will glow for an hour.' },
  bone_dust:   { name: 'Bone Dust', type: 'ingredient', icon: ['drop', 'bone'], desc: 'Fine grey powder from the old wrecks. Makes a surprisingly rich stock.' },
  ember_ash:   { name: 'Ember Ash', type: 'ingredient', icon: ['drop', 'red'], desc: 'Warm to the touch, even now. A little goes a long way.' },
  shell_chip:  { name: 'Shell Chip', type: 'ingredient', icon: ['drop', 'pink'], desc: 'A curl of nacre. Ground fine it seasons and strengthens.' },

  // ---- dishes ---------------------------------------------------------------------------------------------------------------------------
  kelp_stew:   { name: 'Kelp Stew', type: 'dish', icon: ['potion', 'green'], desc: 'Hot, green and comforting. Heals a third of your health and keeps knitting you together.', use: { heal: 0.35, buffs: [{ id: 'regen', dur: 20 }] } },
  urchin_fry:  { name: 'Urchin Fry', type: 'dish', icon: ['potion', 'purple'], desc: 'Spiny, salty, and mean. Your blows land harder for half a minute.', use: { buffs: [{ id: 'might', dur: 30 }] } },
  jelly_jam:   { name: 'Jelly Jam', type: 'dish', icon: ['potion', 'cyan'], desc: 'Wobbles on the spoon. Sharpens the mind: Tide comes back much faster.', use: { tide: 0.25, buffs: [{ id: 'focus', dur: 30 }] } },
  ink_noodles: { name: 'Inkwell Noodles', type: 'dish', icon: ['potion', 'black'], desc: 'Slippery, black and quick to eat. You move like you stole something.', use: { buffs: [{ id: 'haste', dur: 25 }] } },
  scale_chowder: { name: 'Scale Chowder', type: 'dish', icon: ['potion', 'blue'], desc: 'Thick enough to stand a spoon in. A hard shell of warmth takes the edge off blows.', use: { buffs: [{ id: 'ward', dur: 35 }] } },
  gilded_brulee: { name: 'Gilded Brulee', type: 'dish', icon: ['potion', 'gold'], desc: 'Burnt sugar over pearl cream. Coins seem to find you for a whole minute.', use: { buffs: [{ id: 'fortune', dur: 60 }] } },
  ember_curry: { name: 'Ember Curry', type: 'dish', icon: ['potion', 'red'], desc: 'It should come with a warning. Vent plumes hurt less and your strikes run hot.', use: { buffs: [{ id: 'ember', dur: 40 }] } },
  bone_broth:  { name: 'Bone Broth', type: 'dish', icon: ['potion', 'bone'], desc: 'Slow-simmered and restoring. Heals half your health and hardens your shell.', use: { heal: 0.5, buffs: [{ id: 'ward', dur: 20 }] } },
  pearl_elixir: { name: 'Pearl Elixir', type: 'dish', icon: ['potion', 'white'], desc: 'A bright draught with a pearl dissolved in it. Fills your Tide and clears the mind.', use: { tide: 1, buffs: [{ id: 'focus', dur: 20 }] } },
  salve:       { name: 'Glow Salve', type: 'dish', icon: ['potion', 'orange'], desc: 'A cooling paste that draws out burns, chills and bleeding.', use: { cleanse: 4, buffs: [{ id: 'regen', dur: 12 }] } },
};

export const INGREDIENT_IDS = Object.keys(CRAFT_ITEMS).filter((k) => CRAFT_ITEMS[k].type === 'ingredient');
export const DISH_IDS = Object.keys(CRAFT_ITEMS).filter((k) => CRAFT_ITEMS[k].type === 'dish');
