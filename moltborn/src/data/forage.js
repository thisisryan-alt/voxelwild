// Forage patches: places in a zone where the sea grows things worth cooking. Each realm has two kinds; each kind lists the
// ingredients it can give (weights are relative) and how it looks. Patches regrow a while after being harvested.
export const FORAGE = {
  reef:      [{ id: 'kelp_bed', name: 'Kelp Bed', color: '#58c070', yield: [['kelp_frond', 5], ['brine_salt', 2]] }, { id: 'salt_pan', name: 'Salt Crust', color: '#e8f4ff', yield: [['brine_salt', 6], ['shell_chip', 1]] }],
  forest:    [{ id: 'frond_thicket', name: 'Frond Thicket', color: '#3a9a58', yield: [['kelp_frond', 6], ['glow_spore', 1]] }, { id: 'spore_ring', name: 'Spore Ring', color: '#e0a050', yield: [['glow_spore', 5], ['kelp_frond', 2]] }],
  kingdom:   [{ id: 'pearl_moss', name: 'Pearl Moss', color: '#d8a0ff', yield: [['shell_chip', 4], ['kelp_frond', 2], ['brine_salt', 2]] }, { id: 'gilded_weed', name: 'Gilded Weed', color: '#ffd84a', yield: [['kelp_frond', 3], ['shell_chip', 3]] }],
  graveyard: [{ id: 'bone_heap', name: 'Bone Heap', color: '#d8d0bc', yield: [['bone_dust', 6], ['shell_chip', 1]] }, { id: 'rust_bloom', name: 'Rust Bloom', color: '#c0703a', yield: [['ember_ash', 3], ['bone_dust', 3]] }],
  abyss:     [{ id: 'glow_cluster', name: 'Glow Cluster', color: '#4ad8c8', yield: [['glow_spore', 6], ['jelly_gel', 2]] }, { id: 'ink_pool', name: 'Ink Pool', color: '#6a5a9a', yield: [['ink_sac', 5], ['jelly_gel', 2]] }],
  trench:    [{ id: 'bone_field', name: 'Marrow Seam', color: '#e8e0cc', yield: [['bone_dust', 6], ['ink_sac', 1]] }, { id: 'ember_vent', name: 'Cinder Seam', color: '#ff7a3a', yield: [['ember_ash', 6], ['bone_dust', 1]] }],
  domain:    [{ id: 'star_kelp', name: 'Star Kelp', color: '#a8f4ff', yield: [['kelp_frond', 3], ['jelly_gel', 3], ['glow_spore', 2]] }, { id: 'tide_crystal', name: 'Tide Crystal', color: '#62fff0', yield: [['jelly_gel', 4], ['shell_chip', 2]] }],
};
export const REGROW_SECONDS = 720;      // of play time
export const PATCHES_PER_ZONE = [2, 4]; // min..max

// timing game: rounds, the width of the sweet spot (fraction of the bar) per round, the marker speed
export const ROUNDS = [{ zone: 0.26, speed: 0.9 }, { zone: 0.19, speed: 1.15 }, { zone: 0.13, speed: 1.45 }];
// the yield for a harvest: base count by hits (0..3), plus a rare extra on a perfect run
export const YIELD_BY_HITS = [0, 1, 2, 4];
export const RARE_CHANCE = 0.35;
