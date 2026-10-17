// Trophies: long-term goals with a progress number each. An achievement is earned when get(ctx) reaches goal, where
// ctx is built by systems/achievements.js from the save (records, flags, quests, inventory...). Nothing here touches
// gameplay; it only reads what the player has already done.
import { ZONE_INFO } from './zoneinfo.js';
import { ITEMS } from './items.js';
import { ENEMIES } from './enemies.js';
import { LORE } from './lore.js';
import { SET_IDS } from './sets.js';
import { AFFIX_IDS } from './affixes.js';

export const TIERS = {
  bronze: { name: 'Bronze', color: '#d08850', pts: 5 },
  silver: { name: 'Silver', color: '#c8d4e4', pts: 10 },
  gold:   { name: 'Gold',   color: '#ffd84a', pts: 20 },
  mythic: { name: 'Mythic', color: '#ff7ad8', pts: 40 },
};

export const CATS = [
  { id: 'combat', name: 'Combat', short: 'Combat', color: '#ff7a6a' },
  { id: 'explore', name: 'Exploration', short: 'Explore', color: '#7ad8ff' },
  { id: 'story', name: 'Story', short: 'Story', color: '#ffd84a' },
  { id: 'collect', name: 'Collection', short: 'Collect', color: '#a8ff9a' },
  { id: 'challenge', name: 'Challenge', short: 'Trials', color: '#d89aff' },
];

const BOSSES = ['pearl_tyrant', 'grumbold', 'hermit_king', 'mother_moray', 'sporemother', 'brass_colossus', 'aurelia', 'captain_rust', 'magmaw', 'lurelord', 'krael', 'hollow_maw', 'kyros', 'poseidon'];
const MAIN_BOSSES = ['grumbold', 'mother_moray', 'aurelia', 'captain_rust', 'lurelord', 'krael', 'kyros', 'poseidon'];
const BIOMES = ['reef', 'forest', 'kingdom', 'graveyard', 'abyss', 'trench', 'domain'];
const REAL_ZONES = Object.keys(ZONE_INFO);
const SECRET_ZONES = REAL_ZONES.filter((z) => ZONE_INFO[z].secret);
const EQUIP = Object.keys(ITEMS).filter((k) => ITEMS[k].type === 'equip');
const MUTATIONS = Object.keys(ITEMS).filter((k) => ITEMS[k].type === 'mutation');
const DYES = Object.keys(ITEMS).filter((k) => ITEMS[k].type === 'dye');
const FOES = Object.keys(ENEMIES);
const SIDE_QUESTS = ['sq_tessa', 'sq_choir', 'sq_atlas', 'sq_ledger', 'sq_inkwell', 'sq_hobb', 'sq_lantern', 'sq_siblings', 'sq_pearls', 'sq_census', 'sq_spores', 'sq_vaults', 'sq_vents', 'sq_tyrant'];
const MAIN_QUESTS = ['mq1', 'mq2', 'mq3', 'mq4', 'mq5', 'mq6', 'mq7', 'mq8', 'mq9', 'mq10', 'mq11', 'mq12', 'mq13'];

const count = (list, test) => list.reduce((n, x) => n + (test(x) ? 1 : 0), 0);
const stage = (c) => ({ shore: 1, warrior: 2, abyssal: 3, leviathan: 4, mythic: 5, primordial: 6 })[c.s.form] || 1;
const bossesDown = (c, list = BOSSES) => count(list, (k) => c.s.bosses[k]);
const questsDone = (c, list) => count(list, (id) => c.s.quests[id]?.state === 'done');
const earlyBosses = (c) => count(Object.values(c.r.bossBest), (t) => t <= 60);

// Each entry: id, name, desc, cat, tier, goal, get(ctx). Optional: hidden (name and text stay "???" until earned), unit (label for progress).
export const ACHIEVEMENTS = [
  // ---- combat -------------------------------------------------------------------------------------------------------------
  { id: 'first_snip', name: 'First Snip', desc: 'Defeat your first foe.', cat: 'combat', tier: 'bronze', goal: 1, get: (c) => c.kills },
  { id: 'reef_cleaner', name: 'Reef Cleaner', desc: 'Defeat 100 foes.', cat: 'combat', tier: 'bronze', goal: 100, get: (c) => c.kills },
  { id: 'scourge', name: 'Scourge of the Deep', desc: 'Defeat 500 foes.', cat: 'combat', tier: 'silver', goal: 500, get: (c) => c.kills },
  { id: 'tidebreaker', name: 'Tidebreaker', desc: 'Defeat 2000 foes.', cat: 'combat', tier: 'gold', goal: 2000, get: (c) => c.kills },
  { id: 'rhythm', name: 'Rhythm', desc: 'Land a 10-hit combo.', cat: 'combat', tier: 'bronze', goal: 10, get: (c) => c.combo },
  { id: 'unbroken', name: 'Unbroken', desc: 'Land a 30-hit combo.', cat: 'combat', tier: 'silver', goal: 30, get: (c) => c.combo },
  { id: 'perpetual', name: 'Perpetual Motion', desc: 'Land a 60-hit combo.', cat: 'combat', tier: 'gold', goal: 60, get: (c) => c.combo },
  { id: 'keen_eye', name: 'Keen Eye', desc: 'Land 100 critical hits.', cat: 'combat', tier: 'bronze', goal: 100, get: (c) => c.r.crits },
  { id: 'heavy_hitter', name: 'Heavy Hitter', desc: 'Land a single blow worth 100 damage.', cat: 'combat', tier: 'silver', goal: 100, get: (c) => c.r.bestHit },
  { id: 'cataclysm', name: 'Cataclysm', desc: 'Land a single blow worth 400 damage.', cat: 'combat', tier: 'gold', goal: 400, get: (c) => c.r.bestHit },
  { id: 'riposte', name: 'Riposte Artist', desc: 'Parry 25 attacks.', cat: 'combat', tier: 'silver', goal: 25, get: (c) => c.s.stats.parries || 0 },
  { id: 'wall_of_shell', name: 'Wall of Shell', desc: 'Parry 100 attacks.', cat: 'combat', tier: 'gold', goal: 100, get: (c) => c.s.stats.parries || 0 },
  { id: 'slipstream', name: 'Slipstream', desc: 'Dash 500 times.', cat: 'combat', tier: 'bronze', goal: 500, get: (c) => c.r.dashes },
  { id: 'pyromancers_pinch', name: "Pyromancer's Pinch", desc: 'Set 25 foes alight.', cat: 'combat', tier: 'bronze', goal: 25, get: (c) => c.r.burned },
  { id: 'cold_shoulder', name: 'Cold Shoulder', desc: 'Chill 25 foes.', cat: 'combat', tier: 'bronze', goal: 25, get: (c) => c.r.chilled },
  { id: 'red_tide', name: 'Red Tide', desc: 'Make 25 foes bleed.', cat: 'combat', tier: 'bronze', goal: 25, get: (c) => c.r.bled },
  { id: 'thick_shell', name: 'Thick Shell', desc: 'Weather 5000 points of damage over a lifetime.', cat: 'combat', tier: 'silver', goal: 5000, get: (c) => c.r.dmgTaken },
  { id: 'wrecking_ball', name: 'Wrecking Ball', desc: 'Deal 50,000 points of damage over a lifetime.', cat: 'combat', tier: 'gold', goal: 50000, get: (c) => c.r.dmgDealt },
  { id: 'untouched', name: 'Untouched', desc: 'Defeat a boss without taking a single hit.', cat: 'combat', tier: 'gold', goal: 1, get: (c) => Object.keys(c.r.flawless).length },
  { id: 'untouchable', name: 'Untouchable', desc: 'Defeat five different bosses without being hit.', cat: 'combat', tier: 'mythic', goal: 5, get: (c) => Object.keys(c.r.flawless).length },
  { id: 'quick_work', name: 'Quick Work', desc: 'Defeat a boss in under a minute.', cat: 'combat', tier: 'silver', goal: 1, get: (c) => earlyBosses(c) },
  { id: 'learning_experience', name: 'Learning Experience', desc: 'Fall for the first time.', cat: 'combat', tier: 'bronze', goal: 1, get: (c) => c.s.stats.deaths },
  { id: 'sink_or_swim', name: 'Sink or Swim', desc: 'Fall 25 times. The sea is patient.', cat: 'combat', tier: 'bronze', goal: 25, hidden: true, get: (c) => c.s.stats.deaths },

  // ---- exploration -------------------------------------------------------------------------------------------------------
  { id: 'curious_crab', name: 'Curious Crab', desc: 'Visit 5 different zones.', cat: 'explore', tier: 'bronze', goal: 5, get: (c) => c.zones },
  { id: 'cartographer', name: 'Cartographer', desc: 'Visit 15 different zones.', cat: 'explore', tier: 'silver', goal: 15, get: (c) => c.zones },
  { id: 'master_cartographer', name: 'Master Cartographer', desc: 'Visit every zone in the sea.', cat: 'explore', tier: 'gold', goal: REAL_ZONES.length, get: (c) => c.zones },
  { id: 'seven_seas', name: 'Seven Seas', desc: 'Visit all seven realms: reef, forest, kingdom, graveyard, abyss, trench and domain.', cat: 'explore', tier: 'silver', goal: BIOMES.length, get: (c) => count(BIOMES, (b) => REAL_ZONES.some((z) => ZONE_INFO[z].biome === b && c.s.visited[z])) },
  { id: 'hidden_depths', name: 'Hidden Depths', desc: 'Find every secret zone.', cat: 'explore', tier: 'gold', goal: SECRET_ZONES.length, get: (c) => count(SECRET_ZONES, (z) => c.s.visited[z]) },
  { id: 'long_swim', name: 'Long Swim', desc: 'Travel 1,000 tiles.', cat: 'explore', tier: 'bronze', goal: 1000, get: (c) => Math.round(c.r.distance / 16) },
  { id: 'marathon', name: 'Marathon', desc: 'Travel 10,000 tiles.', cat: 'explore', tier: 'silver', goal: 10000, get: (c) => Math.round(c.r.distance / 16) },
  { id: 'treasure_hunter', name: 'Treasure Hunter', desc: 'Open 10 chests.', cat: 'explore', tier: 'bronze', goal: 10, get: (c) => c.r.chests },
  { id: 'plunderer', name: 'Plunderer', desc: 'Open 40 chests.', cat: 'explore', tier: 'silver', goal: 40, get: (c) => c.r.chests },
  { id: 'well_rested', name: 'Well Rested', desc: 'Rest at a shrine 10 times.', cat: 'explore', tier: 'bronze', goal: 10, get: (c) => c.r.rests },
  { id: 'pearl_diver', name: 'Pearl Diver', desc: 'Gather 20 pearls.', cat: 'explore', tier: 'silver', goal: 20, get: (c) => c.r.pearls },
  { id: 'archivist', name: 'Archivist', desc: 'Record 10 entries in the codex.', cat: 'explore', tier: 'bronze', goal: 10, get: (c) => c.codex },
  { id: 'loremaster', name: 'Loremaster', desc: 'Record every entry in the codex.', cat: 'explore', tier: 'gold', goal: Object.keys(LORE).length, get: (c) => c.codex },
  { id: 'night_owl', name: 'Night Owl', desc: 'Spend an hour in the trench or the abyss.', cat: 'explore', tier: 'silver', goal: 3600, hidden: true, get: (c) => (c.r.biomeTime.abyss || 0) + (c.r.biomeTime.trench || 0) },

  // ---- story --------------------------------------------------------------------------------------------------------------
  { id: 'first_titan', name: 'Giant Killer', desc: 'Defeat your first boss.', cat: 'story', tier: 'bronze', goal: 1, get: (c) => bossesDown(c) },
  { id: 'three_down', name: 'Three Down', desc: 'Defeat three bosses.', cat: 'story', tier: 'bronze', goal: 3, get: (c) => bossesDown(c) },
  { id: 'wardens_bane', name: "Warden's Bane", desc: 'Defeat every boss on the main road.', cat: 'story', tier: 'gold', goal: MAIN_BOSSES.length - 1, get: (c) => bossesDown(c, MAIN_BOSSES.filter((k) => k !== 'poseidon')) },
  { id: 'the_whole_court', name: 'The Whole Court', desc: 'Defeat all fourteen guardians of the sea.', cat: 'story', tier: 'mythic', goal: BOSSES.length, get: (c) => bossesDown(c) },
  { id: 'molted', name: 'Molted', desc: 'Outgrow your first shell.', cat: 'story', tier: 'bronze', goal: 2, get: (c) => stage(c) },
  { id: 'abyssal_born', name: 'Abyssal Born', desc: 'Reach your third form.', cat: 'story', tier: 'silver', goal: 3, get: (c) => stage(c) },
  { id: 'leviathan_rising', name: 'Leviathan Rising', desc: 'Reach your fourth form.', cat: 'story', tier: 'silver', goal: 4, get: (c) => stage(c) },
  { id: 'mythic_ascent', name: 'Mythic Ascent', desc: 'Reach your final form.', cat: 'story', tier: 'gold', goal: 5, get: (c) => stage(c) },
  { id: 'first_tide', name: 'The First Tide', desc: 'Become something older than the gods.', cat: 'story', tier: 'mythic', goal: 6, hidden: true, get: (c) => stage(c) },
  { id: 'level_10', name: 'Growing Pains', desc: 'Reach level 10.', cat: 'story', tier: 'bronze', goal: 10, get: (c) => c.s.level },
  { id: 'level_20', name: 'Seasoned', desc: 'Reach level 20.', cat: 'story', tier: 'silver', goal: 20, get: (c) => c.s.level },
  { id: 'level_cap', name: 'Full Tide', desc: 'Reach the level cap.', cat: 'story', tier: 'gold', goal: 30, get: (c) => c.s.level },
  { id: 'good_neighbour', name: 'Good Neighbour', desc: 'Finish five side quests.', cat: 'story', tier: 'silver', goal: 5, get: (c) => questsDone(c, SIDE_QUESTS) },
  { id: 'whole_community', name: 'The Whole Community', desc: 'Finish every side quest.', cat: 'story', tier: 'gold', goal: SIDE_QUESTS.length, get: (c) => questsDone(c, SIDE_QUESTS) },
  { id: 'road_taken', name: 'The Road Taken', desc: 'Finish every main quest.', cat: 'story', tier: 'gold', goal: MAIN_QUESTS.length, get: (c) => questsDone(c, MAIN_QUESTS) },
  { id: 'ending_any', name: 'The Tide Turns', desc: 'See any ending.', cat: 'story', tier: 'silver', goal: 1, get: (c) => c.endings },
  { id: 'every_tide', name: 'Every Tide', desc: 'See all four endings.', cat: 'story', tier: 'mythic', goal: 4, hidden: true, get: (c) => c.endings },

  // ---- collection ---------------------------------------------------------------------------------------------------------
  { id: 'well_dressed', name: 'Well Dressed', desc: 'Own 8 pieces of equipment.', cat: 'collect', tier: 'bronze', goal: 8, get: (c) => count(EQUIP, (k) => c.s.inv[k] > 0 || Object.values(c.s.equip).includes(k)) },
  { id: 'armoury', name: 'Armoury', desc: 'Own 20 pieces of equipment.', cat: 'collect', tier: 'gold', goal: 20, get: (c) => count(EQUIP, (k) => c.s.inv[k] > 0 || Object.values(c.s.equip).includes(k)) },
  { id: 'mutant', name: 'Mutant', desc: 'Own 6 mutations.', cat: 'collect', tier: 'silver', goal: 6, get: (c) => Math.max(c.s.mutOwned.length, count(MUTATIONS, (k) => c.s.inv[k] > 0)) },
  { id: 'colourist', name: 'Colourist', desc: 'Own 3 dyes.', cat: 'collect', tier: 'bronze', goal: 3, get: (c) => count(DYES, (k) => c.s.inv[k] > 0) + (c.s.dye && c.s.dye !== 'default' ? 1 : 0) },
  { id: 'student', name: 'Student of the Tide', desc: 'Learn 10 skills.', cat: 'collect', tier: 'bronze', goal: 10, get: (c) => Object.keys(c.s.skills).length },
  { id: 'scholar', name: 'Scholar of the Tide', desc: 'Learn 25 skills.', cat: 'collect', tier: 'gold', goal: 25, get: (c) => Object.keys(c.s.skills).length },
  { id: 'naturalist', name: 'Naturalist', desc: 'Defeat 25 different kinds of creature.', cat: 'collect', tier: 'silver', goal: 25, get: (c) => count(FOES, (k) => c.r.kills[k] > 0) },
  { id: 'taxonomist', name: 'Taxonomist', desc: 'Defeat every kind of creature at least once.', cat: 'collect', tier: 'mythic', goal: FOES.length, get: (c) => count(FOES, (k) => c.r.kills[k] > 0) },
  { id: 'sous_chef', name: 'Sous-Chef', desc: 'Craft 10 things.', cat: 'collect', tier: 'bronze', goal: 10, get: (c) => c.r.crafted },
  { id: 'iron_stomach', name: 'Iron Stomach', desc: 'Try every dish in the galley.', cat: 'collect', tier: 'gold', goal: 8, get: (c) => Object.keys(c.r.eaten).length },
  { id: 'rich', name: 'Pocket Change', desc: 'Hold 2,000 coins at once.', cat: 'collect', tier: 'silver', goal: 2000, get: (c) => c.r.maxCoins },
  { id: 'shutterbug', name: 'Shutterbug', desc: 'Take 5 photographs.', cat: 'collect', tier: 'bronze', goal: 5, get: (c) => c.r.photos },

  // ---- challenge ----------------------------------------------------------------------------------------------------------
  { id: 'rift_walker', name: 'Rift Walker', desc: 'Complete 5 Tidal Rifts.', cat: 'challenge', tier: 'silver', goal: 5, get: (c) => c.r.rifts },
  { id: 'warden_slain', name: 'Keeper of Nothing', desc: 'Defeat the Rift Warden at the bottom of a Tidal Rift.', cat: 'challenge', tier: 'silver', goal: 1, get: (c) => c.r.wardens },
  { id: 'warden_hunter', name: 'Warden Hunter', desc: 'Defeat the Rift Warden 5 times.', cat: 'challenge', tier: 'gold', goal: 5, get: (c) => c.r.wardens },
  { id: 'warden_untouched', name: 'Seamless', desc: 'Defeat the Rift Warden without taking a hit.', cat: 'challenge', tier: 'gold', goal: 1, get: (c) => (c.r.flawless.rift_warden ? 1 : 0) },
  { id: 'bounty_hand', name: 'Odd Jobs', desc: 'Claim 5 bounties from the Tide Board.', cat: 'challenge', tier: 'bronze', goal: 5, get: (c) => c.s.bounties?.claimed || 0 },
  { id: 'bounty_hunter', name: 'Bounty Hunter', desc: 'Claim 30 bounties.', cat: 'challenge', tier: 'silver', goal: 30, get: (c) => c.s.bounties?.claimed || 0 },
  { id: 'bounty_streak', name: 'Regular Customer', desc: 'Clear the whole bounty board three days running.', cat: 'challenge', tier: 'gold', goal: 3, get: (c) => c.s.bounties?.best || 0 },
  { id: 'first_catch', name: 'First Bite', desc: 'Catch a fish.', cat: 'collect', tier: 'bronze', goal: 1, get: (c) => c.r.fished },
  { id: 'angler', name: 'Angler', desc: 'Catch 25 fish.', cat: 'collect', tier: 'silver', goal: 25, get: (c) => c.r.fished },
  { id: 'fish_log', name: 'The Fish Log', desc: 'Catch 10 different kinds of fish.', cat: 'collect', tier: 'gold', goal: 10, get: (c) => Object.keys(c.s.fish?.species || {}).length },
  { id: 'legend_fish', name: 'The One That Got Away', desc: 'Land a legendary fish.', cat: 'collect', tier: 'mythic', goal: 1, get: (c) => c.r.legendFish },
  { id: 'fishmonger', name: 'Fishmonger', desc: 'Sell 10 fish.', cat: 'collect', tier: 'bronze', goal: 10, get: (c) => c.r.fishSold },
  { id: 'market_day', name: 'Market Day', desc: 'Earn 2,000 coins by selling things.', cat: 'collect', tier: 'silver', goal: 2000, get: (c) => c.r.soldCoins },
  { id: 'rift_runner', name: 'Rift Runner', desc: 'Reach depth 10 in a Tidal Rift.', cat: 'challenge', tier: 'gold', goal: 10, get: (c) => c.r.riftBest },
  { id: 'gauntlet', name: 'Gauntlet Runner', desc: 'Survive 10 waves of the Pearl Gauntlet.', cat: 'challenge', tier: 'gold', goal: 10, get: (c) => c.r.arenaBest },
  { id: 'rip_current', name: 'Against the Rip', desc: 'Defeat a boss on Rip difficulty or higher.', cat: 'challenge', tier: 'gold', goal: 3, get: (c) => c.r.hardest + 1 },
  { id: 'maelstrom_survivor', name: 'Maelstrom Survivor', desc: 'Defeat a boss on Maelstrom difficulty.', cat: 'challenge', tier: 'mythic', goal: 4, get: (c) => c.r.hardest + 1 },
  { id: 'another_tide', name: 'Another Tide', desc: 'Begin a New Game+ voyage.', cat: 'challenge', tier: 'gold', goal: 1, get: (c) => c.s.ng || 0 },
  { id: 'globetrotter', name: 'Globetrotter', desc: 'Use shrine travel 10 times.', cat: 'challenge', tier: 'bronze', goal: 10, get: (c) => c.r.travels },
  { id: 'forager', name: 'Forager', desc: 'Harvest 10 forage patches.', cat: 'collect', tier: 'bronze', goal: 10, get: (c) => c.r.forage },
  { id: 'master_forager', name: 'Master Forager', desc: 'Harvest 50 forage patches.', cat: 'collect', tier: 'silver', goal: 50, get: (c) => c.r.forage },
  { id: 'regular', name: 'The Regular', desc: 'Deliver 5 kitchen orders.', cat: 'collect', tier: 'bronze', goal: 5, get: (c) => c.r.ordersDone },
  { id: 'house_special', name: 'House Special', desc: 'Deliver 25 kitchen orders.', cat: 'collect', tier: 'gold', goal: 25, get: (c) => c.r.ordersDone },
  { id: 'dressed_for_it', name: 'Dressed for It', desc: 'Wear a complete three-piece set.', cat: 'collect', tier: 'silver', goal: 1, get: (c) => Object.keys(c.r.setsSeen).length },
  { id: 'full_wardrobe', name: 'Full Wardrobe', desc: 'Wear every equipment set complete.', cat: 'collect', tier: 'gold', goal: SET_IDS.length, get: (c) => Object.keys(c.r.setsSeen).length },
  { id: 'best_friend', name: 'Best Friend', desc: 'Adopt a hatchling companion.', cat: 'collect', tier: 'bronze', goal: 1, get: (c) => (c.s.companion ? 1 : 0) },
  { id: 'grown_up', name: 'All Grown Up', desc: 'Raise your companion to level 5.', cat: 'collect', tier: 'silver', goal: 5, get: (c) => c.s.companion?.level || 0 },
  { id: 'elite_hunter', name: 'Elite Hunter', desc: 'Defeat 25 elite creatures.', cat: 'combat', tier: 'silver', goal: 25, get: (c) => c.r.elites },
  { id: 'affix_scholar', name: 'Affix Scholar', desc: 'Defeat an elite carrying each kind of affix.', cat: 'combat', tier: 'gold', goal: AFFIX_IDS.length, get: (c) => Object.keys(c.r.affixKills).length },
  { id: 'champion_slayer', name: 'Champion Slayer', desc: 'Defeat 3 rift champions.', cat: 'challenge', tier: 'gold', goal: 3, get: (c) => c.r.champions },
  { id: 'relic_hoarder', name: 'Relic Hoarder', desc: 'Hold five relics at once in a single run.', cat: 'challenge', tier: 'silver', goal: 5, get: (c) => c.r.relicPeak },
  { id: 'ng_deeper', name: 'Deeper Voyage', desc: 'Begin a third New Game+ voyage.', cat: 'challenge', tier: 'mythic', goal: 3, hidden: true, get: (c) => c.s.ng || 0 },
  { id: 'completionist', name: 'Completionist', desc: 'Earn every other trophy.', cat: 'challenge', tier: 'mythic', goal: 1, hidden: true, get: (c) => (c.others >= c.totalOthers ? 1 : 0) },
];

export const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const totalPoints = () => ACHIEVEMENTS.reduce((n, a) => n + TIERS[a.tier].pts, 0);
