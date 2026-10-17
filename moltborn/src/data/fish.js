// Fish: what can be caught, where, when and how hard it fights. Every species is also an ingredient (see items_craft.js)
// that cooks into dishes. `biomes` limits where it bites, `phases` (optional) the hours of the tide clock, `fight` is
// how it behaves on the line: speed of its darting, how erratic it is, and how fast the catch meter drains when it slips away.
export const RARITY = {
  common:    { name: 'Common',    color: '#c8d4e4', weight: 60, size: 1.0 },
  uncommon:  { name: 'Uncommon',  color: '#7aff9a', weight: 26, size: 1.2 },
  rare:      { name: 'Rare',      color: '#6ab0ff', weight: 11, size: 1.5 },
  legendary: { name: 'Legendary', color: '#ff7ad8', weight: 3,  size: 2.2 },
};

export const FISH = [
  // ---- reef ----------------------------------------------------------------------------------------------------------------------------
  { id: 'silverfin', name: 'Silverfin', rarity: 'common', biomes: ['reef', 'forest'], len: [14, 26], value: 12, color: 'white', note: 'A quick silver flash. The reef lives on them.', fight: { speed: 0.9, erratic: 0.3, drain: 0.16 } },
  { id: 'reef_bream', name: 'Reef Bream', rarity: 'common', biomes: ['reef', 'kingdom'], len: [20, 38], value: 15, color: 'orange', note: 'Round, patient and not very bright.', fight: { speed: 0.8, erratic: 0.25, drain: 0.15 } },
  { id: 'sunfish', name: 'Gilt Sunfish', rarity: 'uncommon', biomes: ['reef', 'kingdom'], phases: ['dawn', 'day'], len: [28, 54], value: 34, color: 'gold', note: 'Only rises when the light is high. It basks and it bites.', fight: { speed: 1.0, erratic: 0.4, drain: 0.18 } },
  { id: 'pearlfin', name: 'Pearlfin', rarity: 'rare', biomes: ['reef', 'kingdom'], len: [18, 30], value: 80, color: 'pink', note: 'Its scales are nacre. Courtiers once kept them in glass.', fight: { speed: 1.25, erratic: 0.55, drain: 0.2 } },
  // ---- forest ----------------------------------------------------------------------------------------------------------------------------
  { id: 'greenback', name: 'Greenback', rarity: 'common', biomes: ['forest'], len: [16, 30], value: 13, color: 'green', note: 'Hides in the kelp and tastes of it.', fight: { speed: 0.9, erratic: 0.35, drain: 0.16 } },
  { id: 'glassfin', name: 'Glassfin', rarity: 'uncommon', biomes: ['forest', 'abyss'], len: [12, 22], value: 30, color: 'cyan', note: 'You can read through it. Most things that swim near it do not notice.', fight: { speed: 1.1, erratic: 0.5, drain: 0.18 } },
  { id: 'moss_eel', name: 'Moss Eel', rarity: 'rare', biomes: ['forest', 'graveyard'], phases: ['dusk', 'night'], len: [60, 110], value: 72, color: 'green', note: 'Long as a rope and twice as stubborn.', fight: { speed: 1.2, erratic: 0.45, drain: 0.22 } },
  // ---- kingdom ----------------------------------------------------------------------------------------------------------------------------
  { id: 'court_carp', name: 'Court Carp', rarity: 'uncommon', biomes: ['kingdom'], len: [30, 60], value: 36, color: 'purple', note: 'Bred in the fountains of the Pearl Court. They never left.', fight: { speed: 1.0, erratic: 0.35, drain: 0.17 } },
  { id: 'gilded_koi', name: 'Gilded Koi', rarity: 'rare', biomes: ['kingdom'], len: [40, 70], value: 95, color: 'gold', note: 'A courtier\'s pet, gone wild. It wears gold the way others wear moss.', fight: { speed: 1.3, erratic: 0.6, drain: 0.21 } },
  // ---- graveyard ----------------------------------------------------------------------------------------------------------------------------
  { id: 'wreck_cod', name: 'Wreck Cod', rarity: 'common', biomes: ['graveyard'], len: [30, 70], value: 16, color: 'bone', note: 'Fat from living in a cargo hold.', fight: { speed: 0.85, erratic: 0.3, drain: 0.15 } },
  { id: 'rustscale', name: 'Rustscale', rarity: 'uncommon', biomes: ['graveyard', 'trench'], len: [22, 40], value: 32, color: 'rust', note: 'Scales like flaking iron. Do not eat the bolts.', fight: { speed: 1.05, erratic: 0.4, drain: 0.18 } },
  { id: 'ghost_pike', name: 'Ghost Pike', rarity: 'rare', biomes: ['graveyard'], phases: ['night'], len: [70, 120], value: 90, color: 'white', note: 'Seen only at night, and sometimes not even then.', fight: { speed: 1.35, erratic: 0.55, drain: 0.22 } },
  // ---- abyss & trench ---------------------------------------------------------------------------------------------------------------------
  { id: 'lantern_smelt', name: 'Lantern Smelt', rarity: 'common', biomes: ['abyss'], len: [8, 16], value: 14, color: 'cyan', note: 'A lamp on a hook, and the hook is the fish.', fight: { speed: 0.95, erratic: 0.4, drain: 0.16 } },
  { id: 'void_angler', name: 'Void Angler', rarity: 'rare', biomes: ['abyss', 'trench'], len: [40, 90], value: 110, color: 'purple', note: 'It fishes too. You are the bait.', fight: { speed: 1.4, erratic: 0.6, drain: 0.24 } },
  { id: 'bone_gar', name: 'Bone Gar', rarity: 'uncommon', biomes: ['trench'], len: [50, 100], value: 38, color: 'bone', note: 'More skeleton than fish, and quite pleased about it.', fight: { speed: 1.1, erratic: 0.45, drain: 0.19 } },
  // ---- anywhere ---------------------------------------------------------------------------------------------------------------------------
  { id: 'moon_koi', name: 'Moon Koi', rarity: 'legendary', biomes: ['reef', 'forest', 'kingdom', 'domain'], phases: ['night'], len: [60, 100], value: 260, color: 'white', note: 'It rises only under a full night and takes the moon with it when it goes.', fight: { speed: 1.6, erratic: 0.7, drain: 0.28 } },
  { id: 'old_one', name: 'The Old One', rarity: 'legendary', biomes: ['abyss', 'trench', 'graveyard', 'domain'], len: [180, 320], value: 320, color: 'black', note: 'Everyone has a story about the one that got away. This is that one.', fight: { speed: 1.7, erratic: 0.75, drain: 0.3 } },
  { id: 'tide_marlin', name: 'Tide Marlin', rarity: 'legendary', biomes: ['domain'], len: [140, 240], value: 300, color: 'cyan', note: 'A sword of living current. It does not tire.', fight: { speed: 1.8, erratic: 0.7, drain: 0.3 } },
];
export const FISH_BY_ID = Object.fromEntries(FISH.map((f) => [f.id, f]));
export const FISH_BIOMES = ['reef', 'forest', 'kingdom', 'graveyard', 'abyss', 'trench', 'domain'];

// timing of the bite
export const WAIT = [1.4, 4.2];      // seconds a line waits before something bites
export const HOOK_WINDOW = 0.9;      // seconds to answer a bite
export const SPOT_COOLDOWN = 150;    // seconds of play before a spot is lively again
export const SPOTS_PER_ZONE = [1, 2];
