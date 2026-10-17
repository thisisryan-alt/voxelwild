// Items: every entry has a purpose. type: consumable | key | evo | equip | mutation | lore | material
export const ITEMS = {
  // consumables
  kelp_wrap: { name: 'Kelp Wrap', type: 'consumable', price: 30, desc: 'Restores 40% of your health. Tastes of salt and regret.', use: { heal: 0.4 } },
  brine_tonic: { name: 'Brine Tonic', type: 'consumable', price: 25, desc: 'Restores half your Tide.', use: { tide: 0.5 } },
  fury_ink: { name: 'Fury Ink', type: 'consumable', price: 60, desc: 'Fills 50 Fury at once. Smells like thunder.', use: { fury: 50 } },
  // materials
  pearl: { name: 'Sea Pearl', type: 'material', price: 0, desc: 'A clean white pearl. The Pearl-Smith reforges gear with these.' },
  black_pearl: { name: 'Black Pearl', type: 'material', price: 0, desc: 'Deep-sea pearl. Needed for the finest reforging.' },
  crew_token: { name: 'Crew Token', type: 'key', desc: 'A brass crew tag, green with age. Hobb wants it back.' },
  map_fragment: { name: 'Map Fragment', type: 'key', desc: 'A torn piece of Fenwick\'s atlas of the forest.' },
  tithe_ledger: { name: "Vael's Tithe Ledger", type: 'key', desc: 'Names, dates, and a running tally of the Seal.' },
  tide_barnacle: { name: 'Tide Barnacle', type: 'key', desc: 'A fat pearl-barnacle from the Tidepools. Brack counts these.' },
  // evolution catalysts
  brine_core: { name: 'Brine Core', type: 'evo', desc: 'The crystallised pride of the Reef. Needed for the Hardshell Molt.' },
  abyssal_core: { name: 'Abyssal Core', type: 'evo', desc: 'Dense as a dying star. Needed for the Deep Molt.' },
  titan_heart: { name: "Titan's Heart", type: 'evo', desc: 'Still beating, faintly. Needed for the Ancient Molt.' },
  tide_sigil: { name: 'Tide Sigil', type: 'evo', desc: 'Poseidon’s own mark, shed at the gate. Needed for the Apotheosis.' },
  // keys
  brineguard_key: { name: 'Brineguard Key', type: 'key', desc: 'Opens the Court’s inner gate.' },
  captain_key: { name: "Captain's Key", type: 'key', desc: 'Salt-eaten brass. Opens a stateroom in the Graveyard.' },
  lantern_stone: { name: 'Lantern Stone', type: 'key', desc: 'A warm stone. Anglers use them to light the Abyss.' },
  trench_gate_rune: { name: 'Gate Rune', type: 'key', desc: 'A rune carved with the old script. It hums near the Trench seal.' },
  spiral_shell: { name: 'Spiral Shell', type: 'key', desc: 'A perfect little shell. Somebody has been looking for it.' },
  ledger: { name: "Inkwell's Ledger", type: 'key', desc: 'A soaked ledger of illicit cargo.' },
  stolen_regalia: { name: 'Stolen Regalia', type: 'key', desc: 'A Coral Kingdom relic someone wanted smuggled out.' },
  // memory pearls
  mp1: { name: 'Memory Pearl: Dawn', type: 'lore', desc: 'It shows the first tide, rising with no one to command it.' },
  mp2: { name: 'Memory Pearl: Kelp', type: 'lore', desc: 'A forest that sang before there were ears.' },
  mp3: { name: 'Memory Pearl: Crown', type: 'lore', desc: 'A crab with a crown of foam, kneeling to the Mother.' },
  mp4: { name: 'Memory Pearl: Wreck', type: 'lore', desc: 'Sailors crying out to a god who answered with a wave.' },
  mp5: { name: 'Memory Pearl: Lantern', type: 'lore', desc: 'Something vast turning over in the dark, and sighing.' },
  mp6: { name: 'Memory Pearl: Chain', type: 'lore', desc: 'A hand of the sea-king, wrapping a seal in iron. Trembling.' },
  mp7: { name: 'Memory Pearl: Mother', type: 'lore', desc: 'A voice that is every wave: "Come home."' },
  // equipment — shell
  shell_driftwood: { name: 'Driftwood Plate', type: 'equip', slot: 'shell', price: 80, desc: 'Better than nothing. +2 Def.', fx: { def: 2 } },
  shell_barnacle: { name: 'Barnacle Mantle', type: 'equip', slot: 'shell', price: 220, desc: '+4 Def, 8% thorns.', fx: { def: 4, thorns: 0.08 } },
  shell_pearl: { name: 'Pearl-Lined Shell', type: 'equip', slot: 'shell', desc: '+6 Def, +10% max HP.', fx: { def: 6, hp: 0.1 } },
  shell_ironhull: { name: 'Ironhull Plating', type: 'equip', slot: 'shell', desc: 'Salvaged ship iron. +9 Def, -5% speed.', fx: { def: 9, speed: -0.05 } },
  shell_hermitking: { name: "Hermit King's Carapace", type: 'equip', slot: 'shell', desc: '+8 Def, +12% max HP, 10% thorns. It hums a lullaby.', fx: { def: 8, hp: 0.12, thorns: 0.1 } },
  shell_tidewoven: { name: 'Tidewoven Carapace', type: 'equip', slot: 'shell', desc: '+8 Def, +15% Tide.', fx: { def: 8, tide: 0.15 } },
  // equipment — claw
  claw_rusty: { name: 'Rusty Pincer-Cap', type: 'equip', slot: 'claw', price: 90, desc: '+2 Atk.', fx: { atk: 2 } },
  claw_urchin: { name: 'Urchin-Spine Claw', type: 'equip', slot: 'claw', price: 240, desc: '+4 Atk, hits poison briefly.', fx: { atk: 4, poison: 1 } },
  claw_coral: { name: 'Coral Edge', type: 'equip', slot: 'claw', desc: '+7 Atk, +8% crit.', fx: { atk: 7, crit: 0.08 } },
  claw_anchor: { name: 'Anchor-Fluke Claw', type: 'equip', slot: 'claw', desc: '+10 Atk, heavy hits +20%.', fx: { atk: 10, heavyDmg: 0.2 } },
  claw_hermit: { name: "Hermit's Pincer", type: 'equip', slot: 'claw', desc: '+8 Atk, parry window 30% longer.', fx: { atk: 8, parryWindow: 0.3 } },
  claw_lumen: { name: 'Lumen Fang', type: 'equip', slot: 'claw', desc: '+9 Atk, +20% ability damage.', fx: { atk: 9, abilityDmg: 0.2 } },
  // equipment — charm / relic
  charm_pearlstring: { name: 'Pearl String', type: 'equip', slot: 'charm', price: 150, desc: 'Coins and pearls are drawn to you from farther away.', fx: { magnet: 60 } },
  charm_lantern: { name: 'Lantern Charm', type: 'equip', slot: 'charm', desc: 'A steady glow lights the dark around you.', fx: { light: 40 } },
  charm_tideglass: { name: 'Tideglass Locket', type: 'equip', slot: 'charm', desc: '+25% Tide regen.', fx: { tideRegen: 0.25 } },
  charm_ghostcoin: { name: "Ghostcoin", type: 'equip', slot: 'charm', desc: 'Pay the toll: +30% coin from enemies.', fx: { coinBonus: 0.3 } },
  charm_kingsigil: { name: "Regent's Signet", type: 'equip', slot: 'charm', desc: 'Court favour: shops are 20% cheaper.', fx: { discount: 0.2 } },
  // mutations (passive traits)
  mut_barbed: { name: 'Barbed Shell', type: 'mutation', desc: 'Spines grow through the plating. Attackers that hit you take damage.', fx: { thorns: 0.12 } },
  mut_gills: { name: 'Second Gills', type: 'mutation', desc: 'Defeated foes restore a little health.', fx: { lifeOnKill: 3 } },
  mut_glowskin: { name: 'Glowskin', type: 'mutation', desc: 'Faint bioluminescence lights the dark.', fx: { light: 34 } },
  mut_razor: { name: 'Razor Edge', type: 'mutation', desc: '+12% crit chance.', fx: { crit: 0.12 } },
  mut_brineheart: { name: 'Brine Heart', type: 'mutation', desc: '+20% max health.', fx: { hp: 0.2 } },
  mut_hungry: { name: 'Hungry Claw', type: 'mutation', desc: 'Each hit builds more Fury.', fx: { furyGain: 0.3 } },
  mut_echo: { name: 'Echo Sense', type: 'mutation', desc: 'Sense hidden things nearby: secrets shimmer.', fx: { sense: 1 } },
  mut_salt: { name: 'Salt Blood', type: 'mutation', desc: 'Poison and burns harm you half as much.', fx: { poisonResist: 0.5 } },
  mut_pressure: { name: 'Pressure Lung', type: 'mutation', desc: 'Deep water presses less hard (+2 pressure resistance).', fx: { pressure: 2 } },
  mut_tidememory: { name: 'Tide Memory', type: 'mutation', desc: 'Abilities cost 20% less Tide.', fx: { tideCost: -0.2 } },
  mut_coralarmor: { name: 'Coral Armor', type: 'mutation', desc: '+3 defence; sluggish.', fx: { def: 3, speed: -0.04 } },
  mut_census: { name: 'Census Eye', type: 'mutation', desc: 'You notice what others miss: secrets shimmer, +15% coins from foes.', fx: { sense: 1, coinBonus: 0.15 } },
  mut_venom: { name: 'Venom Blood', type: 'mutation', desc: 'Your strikes carry poison.', fx: { poison: 1 } },
  // dyes
  dye_albino: { name: 'Albino Mutation', type: 'dye', desc: 'A pale, ghostly shell colour.' },
  dye_cobalt: { name: 'Cobalt Mutation', type: 'dye', desc: 'A rare blue shell, like a cobalt lobster.' },
  dye_gilded: { name: 'Gilded Mutation', type: 'dye', desc: 'Gold leaf seams along every plate.' },
  dye_ember: { name: 'Ember Mutation', type: 'dye', desc: 'A deep volcanic glow.' },
  dye_spectral: { name: 'Spectral Mutation', type: 'dye', desc: 'You look half a memory.' },
};
export const SHOP = {
  cowrie: ['kelp_wrap', 'brine_tonic', 'shell_driftwood', 'claw_rusty', 'charm_pearlstring', 'shell_barnacle', 'claw_urchin'],
  smuggler: ['fury_ink', 'kelp_wrap', 'brine_tonic'],
};
export const DYES = {
  default: null,
  albino: { item: 'dye_albino', hue: 0, sat: 0.15, light: 1.35 },
  cobalt: { item: 'dye_cobalt', hue: 0.55, sat: 1.0, light: 1.0 },
  gilded: { item: 'dye_gilded', hue: 0.12, sat: 0.9, light: 1.15 },
  ember: { item: 'dye_ember', hue: -0.04, sat: 1.1, light: 0.85 },
  spectral: { item: 'dye_spectral', hue: 0.45, sat: 0.5, light: 1.25 },
};
