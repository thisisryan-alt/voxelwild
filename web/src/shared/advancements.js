// Advancements: milestones for a survival world, kept in meta.advancements ({ id: day reached }).
// `have` ones are checked against the inventory, `dim` against where the player is; the rest are awarded by
// game.advance(id) where they happen.
import { I, B, C, ITEMS } from './blocks.js';

const anyLog = (s) => ITEMS[s.item] && /\b(Log|Stem)$/.test(ITEMS[s.item].name);
const is = (...ids) => (s) => ids.filter(Boolean).includes(s.item);

export const ADVANCEMENTS = [
  { id: 'wood', name: 'Getting Wood', desc: 'Pick up a log', have: anyLog },
  { id: 'bench', name: 'Benchmarking', desc: 'Make a crafting table', have: is(C.crafting_table) },
  { id: 'pick', name: 'Time to Mine!', desc: 'Make a wooden pickaxe', have: is(I.WoodenPickaxe) },
  { id: 'stone', name: 'Getting an Upgrade', desc: 'Make a stone pickaxe', have: is(I.StonePickaxe) },
  { id: 'furnace', name: 'Hot Topic', desc: 'Make a furnace', have: is(C.furnace) },
  { id: 'iron', name: 'Acquire Hardware', desc: 'Smelt an iron ingot', have: is(I.IronIngot) },
  { id: 'armor', name: 'Suit Up', desc: 'Wear a piece of armour', armor: 1 },
  { id: 'diamond', name: 'Diamonds!', desc: 'Find a diamond', have: is(I.Diamond) },
  { id: 'diamond_armor', name: 'Cover Me with Diamonds', desc: 'Wear a full set of diamond armour', armor: 'diamond' },
  { id: 'obsidian', name: 'Ice Bucket Challenge', desc: 'Get a block of obsidian', have: is(B.Obsidian) },
  { id: 'nether', name: 'We Need to Go Deeper', desc: 'Enter the Nether', dim: 1 },
  { id: 'end', name: 'The End?', desc: 'Enter the End', dim: 2 },
  { id: 'sky', name: 'Above the Clouds', desc: 'Reach the Skylands', dim: 3 },
  { id: 'hunter', name: 'Monster Hunter', desc: 'Defeat a monster' },
  { id: 'sleep', name: 'Sweet Dreams', desc: 'Sleep in a bed' },
  { id: 'trade', name: 'What a Deal!', desc: 'Trade with a villager' },
  { id: 'bounty', name: 'Hired Help', desc: 'Complete a villager bounty' },
  { id: 'waystone', name: 'Fast Travel', desc: 'Travel by waystone' },
  { id: 'wolf', name: 'Best Friends Forever', desc: 'Tame a wolf' },
  { id: 'fish', name: 'Fishy Business', desc: 'Catch a fish' },
  { id: 'enchant', name: 'Enchanter', desc: 'Enchant an item' },
  { id: 'anvil', name: 'Good as New', desc: 'Use an anvil' },
  { id: 'totem', name: 'Postmortal', desc: 'Be saved by a Totem of Undying' },
  { id: 'brew', name: 'Local Brewery', desc: 'Drink a potion' },
  { id: 'pearl', name: 'Into Thin Air', desc: 'Teleport with an ender pearl' },
  { id: 'glide', name: 'Sky Rider', desc: 'Fly with a glider' },
  { id: 'boat', name: 'Set Sail', desc: 'Ride a boat' },
  { id: 'void', name: 'Free the End', desc: 'Defeat the Void Phantom' },
  { id: 'level30', name: 'Seasoned', desc: 'Reach level 30', level: 30 },
  { id: 'boss', name: 'Boss Slayer', desc: 'Defeat a boss' },
  { id: 'bosses', name: 'Monarch of Monsters', desc: 'Defeat all five bosses' },
];
export const ADV_BY_ID = Object.fromEntries(ADVANCEMENTS.map((a) => [a.id, a]));
