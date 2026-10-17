// Relics are picked between depths of a Tidal Rift and last until the run ends. Each has stat effects (the same keys
// gear and mutations use, see systems/progression.js) and optionally a `hook` handled in systems/rifts.js.
// Rift modifiers ("tides") change a depth for everyone: enemy health/damage, rewards, visibility.
export const RARITY = {
  common: { name: 'Common', color: '#c8d4e4', weight: 60 },
  rare:   { name: 'Rare',   color: '#6ab0ff', weight: 30 },
  epic:   { name: 'Epic',   color: '#ff7ad8', weight: 10 },
};

export const RELICS = {
  coral_splinter: { name: 'Coral Splinter', rarity: 'common', icon: ['claw', 'pink'], fx: { dmg: 0.1 }, desc: '+10% damage.' },
  kelp_knot:      { name: 'Kelp Knot', rarity: 'common', icon: ['charm', 'green'], fx: { hp: 0.12 }, desc: '+12% health.' },
  tide_pearl:     { name: 'Tide Pearl', rarity: 'common', icon: ['pearl', 'cyan'], fx: { tideRegen: 0.2 }, desc: 'Tide regenerates 20% faster.' },
  salt_charm:     { name: 'Salt Charm', rarity: 'common', icon: ['charm', 'white'], fx: { def: 2 }, desc: '+2 defence.' },
  swift_fin:      { name: 'Swift Fin', rarity: 'common', icon: ['charm', 'cyan'], fx: { speed: 0.08, dashCd: -0.1 }, desc: 'Swim 8% faster; dash recovers sooner.' },
  lucky_cowrie:   { name: 'Lucky Cowrie', rarity: 'common', icon: ['shell', 'gold'], fx: { coinBonus: 0.25 }, desc: '+25% coins.' },
  keen_barnacle:  { name: 'Keen Barnacle', rarity: 'common', icon: ['gem', 'white'], fx: { crit: 0.08 }, desc: '+8% critical chance.' },
  lantern_scale:  { name: 'Lantern Scale', rarity: 'common', icon: ['drop', 'orange'], fx: { light: 30, sense: 1 }, desc: 'A brighter light; hidden things shimmer.' },

  emberheart:     { name: 'Emberheart', rarity: 'rare', icon: ['heart'], fx: { hitBurn: 0.25 }, desc: '25% chance for blows to set foes alight.' },
  frostfin:       { name: 'Frostfin', rarity: 'rare', icon: ['charm', 'cyan'], fx: { hitChill: 0.25 }, desc: '25% chance for blows to chill foes.' },
  razor_tooth:    { name: 'Razor Tooth', rarity: 'rare', icon: ['claw', 'red'], fx: { hitBleed: 0.3, heavyDmg: 0.15 }, desc: 'Blows may open wounds; heavy blows hit harder.' },
  mender_gill:    { name: "Mender's Gill", rarity: 'rare', icon: ['drop', 'green'], fx: { regen: 0.6 }, desc: 'Slowly knit back together.' },
  spiked_shell:   { name: 'Spiked Shell', rarity: 'rare', icon: ['shell', 'purple'], fx: { thorns: 0.15 }, desc: 'Foes that strike you are hurt in return.' },
  riptide_band:   { name: 'Riptide Band', rarity: 'rare', icon: ['charm', 'blue'], fx: { dashDist: 0.25, iframes: 0.15 }, desc: 'Dash farther, untouchable a little longer.' },
  echo_shell:     { name: 'Echo Shell', rarity: 'rare', icon: ['shell', 'blue'], fx: { abilityDmg: 0.2, cooldown: -0.15 }, desc: 'Abilities hit harder and recover sooner.' },
  second_wind:    { name: 'Second Wind', rarity: 'rare', icon: ['heart'], fx: { secondWind: 1 }, desc: 'Once per run, survive a fatal blow at 40% health.' },
  hunters_mark:   { name: "Hunter's Mark", rarity: 'rare', icon: ['gem', 'red'], fx: { execute: 0.3 }, desc: '+30% damage to foes below 30% health.' },
  leech_tooth:    { name: 'Leech Tooth', rarity: 'rare', icon: ['claw', 'red'], hook: 'siphon', desc: 'Heal for 4% of the damage you deal.' },
  adrenal_gland:  { name: 'Adrenal Gland', rarity: 'rare', icon: ['drop', 'red'], hook: 'adrenal', desc: 'Taking a hit makes you faster for four seconds.' },

  godshard:       { name: 'Godshard', rarity: 'epic', icon: ['gem', 'gold'], fx: { dmg: 0.25, hp: 0.15 }, desc: '+25% damage and +15% health.' },
  black_tide:     { name: 'Black Tide', rarity: 'epic', icon: ['pearl', 'black'], fx: { lifeOnKill: 4, killRush: 1 }, desc: 'Kills heal and set you rushing.' },
  storm_shell:    { name: 'Storm in a Shell', rarity: 'epic', icon: ['shell', 'cyan'], fx: { furyGain: 0.5, ultCharge: 0.4 }, desc: 'Fury builds far faster.' },
  abyss_heart:    { name: 'Abyss Heart', rarity: 'epic', icon: ['heart'], fx: { hp: 0.2, def: 3, pressure: 2 }, desc: '+20% health, +3 defence, pressure-proof.' },
  tidal_mastery:  { name: 'Tidal Mastery', rarity: 'epic', icon: ['gem', 'blue'], fx: { tideCost: -0.25, abKillTide: 1, tideRegen: 0.3 }, desc: 'Cheaper abilities; ability kills refund Tide.' },
  glass_crown:    { name: 'Glass Crown', rarity: 'epic', icon: ['charm', 'gold'], fx: { dmg: 0.4, hp: -0.25 }, desc: '+40% damage, -25% health. Beautiful. Brittle.' },
  parry_pearl:    { name: 'Parry Pearl', rarity: 'epic', icon: ['pearl', 'white'], fx: { parryWindow: 0.5, parryTide: 4 }, desc: 'A longer parry window; parries refund Tide.' },
  shock_nova:     { name: 'Shock Nova', rarity: 'epic', icon: ['gem', 'cyan'], hook: 'nova', desc: 'A quarter of kills burst outward and hurt what is near.' },
};
export const RELIC_IDS = Object.keys(RELICS);

// ---- rift modifiers --------------------------------------------------------------------------------------------------------------------------
// mult: folded into the difficulty multipliers (hp / dmg / xp / coin);  haste: enemies keep a haste status;  dark: visibility penalty
export const RIFT_MODS = {
  thick_hide:  { name: 'Thick Hide',  color: '#9aa8c0', mult: { hp: 1.4 }, desc: 'Foes have 40% more health.' },
  sharp_tide:  { name: 'Sharp Tide',  color: '#ff6a5a', mult: { dmg: 1.35 }, desc: 'Foes hit 35% harder.' },
  swift_tide:  { name: 'Swift Tide',  color: '#ffe65a', haste: true, desc: 'Foes swim and strike faster.' },
  rich_tide:   { name: 'Rich Tide',   color: '#ffd84a', mult: { coin: 1.6, xp: 1.25 }, desc: 'Coins and experience flow richer.' },
  murk:        { name: 'Murk',        color: '#6a5a9a', dark: 0.35, desc: 'The water is dark and close.' },
  glass_tide:  { name: 'Glass Tide',  color: '#c8f0ff', mult: { dmg: 1.3, hp: 0.75 }, desc: 'Everything breaks easily, including you.' },
  gilded:      { name: 'Gilded',      color: '#ffd84a', mult: { coin: 2 }, elite: 0.1, desc: 'Double coins, and more elites.' },
  frenzy:      { name: 'Frenzy',      color: '#ff7ad8', mult: { hp: 0.8, dmg: 1.15, xp: 1.4 }, haste: true, desc: 'Fast, fragile and eager.' },
};
export const RIFT_MOD_IDS = Object.keys(RIFT_MODS);

// run lengths; `needs` is a boss the player must have defeated to attempt it
export const RIFT_TIERS = [
  { id: 'shallow', name: 'Shallow Rift', depths: 4, needs: null, mult: 1, reward: 1, blurb: 'A short descent. Good for a first try.' },
  { id: 'deep', name: 'Deep Rift', depths: 6, needs: 'mother_moray', mult: 1.25, reward: 1.6, blurb: 'Six chambers of rising trouble.' },
  { id: 'abyssal', name: 'Abyssal Rift', depths: 8, needs: 'krael', mult: 1.6, reward: 2.4, blurb: 'Eight depths. Bring everything.' },
];
