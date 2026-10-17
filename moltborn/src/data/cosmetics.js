// Cosmetics unlocked by trophies: a title shown beside the swimmer's name, and a wake that trails behind it when it swims
// fast or dashes. Nothing here changes how the game plays. `by` is the achievement that unlocks the entry (null = always).
export const TITLES = {
  none:        { name: 'No title', by: null },
  hatchling:   { name: 'the Hatchling', by: 'first_snip' },
  reefcleaner: { name: 'Reef Cleaner', by: 'reef_cleaner' },
  scourge:     { name: 'Scourge of the Deep', by: 'scourge' },
  tidebreaker: { name: 'Tidebreaker', by: 'tidebreaker' },
  rhythm:      { name: 'of Unbroken Rhythm', by: 'unbroken' },
  riposte:     { name: 'the Riposte Artist', by: 'riposte' },
  untouched:   { name: 'the Untouched', by: 'untouched' },
  cartographer: { name: 'the Cartographer', by: 'master_cartographer' },
  loremaster:  { name: 'the Loremaster', by: 'loremaster' },
  giantkiller: { name: 'Giant Killer', by: 'first_titan' },
  wardensbane: { name: "Warden's Bane", by: 'wardens_bane' },
  whole_court: { name: 'Breaker of the Court', by: 'the_whole_court' },
  molted:      { name: 'the Molted', by: 'molted' },
  thalassarch: { name: 'Thalassarch', by: 'mythic_ascent' },
  unmolted:    { name: 'the Unmolted', by: 'first_tide' },
  neighbour:   { name: 'Good Neighbour', by: 'good_neighbour' },
  forager:     { name: 'the Forager', by: 'master_forager' },
  chef:        { name: 'House Special', by: 'house_special' },
  best_friend: { name: 'Friend of Crabs', by: 'best_friend' },
  riftwalker:  { name: 'Rift Walker', by: 'rift_walker' },
  riftrunner:  { name: 'Rift Runner', by: 'rift_runner' },
  gauntlet:    { name: 'Pearl Gladiator', by: 'gauntlet' },
  champion:    { name: 'Champion Slayer', by: 'champion_slayer' },
  maelstrom:   { name: 'Maelstrom Survivor', by: 'maelstrom_survivor' },
  another:     { name: 'of Another Tide', by: 'another_tide' },
  shutterbug:  { name: 'the Shutterbug', by: 'shutterbug' },
  completionist: { name: 'the Completionist', by: 'completionist' },
};

// wake styles. colors are cycled; `kind` is a particle kind from gfx/particles.js; `rate` is seconds between puffs
export const TRAILS = {
  default: { name: 'Bubbles', by: null, colors: ['#d8f4ff', '#a8e0f8'], kind: 'bubble', rate: 0.1 },
  ember:   { name: 'Embers', by: 'pyromancers_pinch', colors: ['#ffd070', '#ff8a3a', '#ff5a2a'], kind: 'rect', rate: 0.05, rise: -26 },
  frost:   { name: 'Frost', by: 'cold_shoulder', colors: ['#ffffff', '#9adcff', '#d8f4ff'], kind: 'star', rate: 0.07, rise: -6 },
  gold:    { name: 'Gilt', by: 'rich', colors: ['#ffe680', '#ffd84a', '#fff6c8'], kind: 'star', rate: 0.06, rise: -10 },
  ink:     { name: 'Ink', by: 'red_tide', colors: ['#2a1450', '#4a2490', '#150a2a'], kind: 'rect', rate: 0.05, rise: 4, size: 2 },
  rift:    { name: 'Rift Motes', by: 'rift_walker', colors: ['#c07aff', '#7af0ff', '#ffffff'], kind: 'rect', rate: 0.05, rise: -18 },
  pearl:   { name: 'Pearlescent', by: 'pearl_diver', colors: ['#ffffff', '#ffd8f0', '#d0f0ff'], kind: 'bubble', rate: 0.07 },
  prism:   { name: 'Prism', by: 'completionist', colors: ['#ff6a6a', '#ffd84a', '#7aff9a', '#6ab0ff', '#d89aff'], kind: 'star', rate: 0.04, rise: -8 },
};
