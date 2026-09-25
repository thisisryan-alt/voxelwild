// Blocks, texture layers, items, mining and recipes - mirrors the Unity registry (BlockId, BlockRegistry,
// ItemRegistry, Mining, Recipes) so both builds play by the same rules.

export const B = {
  Air: 0, Stone: 1, Dirt: 2, Grass: 3, Sand: 4, Gravel: 5, Snow: 6, Bedrock: 7, Water: 8, Cobblestone: 9, Planks: 10, Bricks: 11,
  OakLog: 12, BirchLog: 13, SpruceLog: 14, JungleLog: 15, OakLeaves: 16, BirchLeaves: 17, SpruceLeaves: 18, JungleLeaves: 19,
  Sandstone: 20, RedSandstone: 21, Mud: 22, Moss: 23, Ice: 24, CoalOre: 25, IronOre: 26, GoldOre: 27, DiamondOre: 28,
  TallGrass: 29, FlowerRed: 30, FlowerYellow: 31, DeadBush: 32, Glowcap: 33, Torch: 34, Cactus: 35, SnowyGrass: 36,
  // 37 PropBarrier is unused in the browser build
  Flow1: 38, Flow7: 44,
};
export const BLOCK_COUNT = 45;
export const waterLevel = (id) => (id === B.Water ? 8 : id >= B.Flow1 && id <= B.Flow7 ? id - 37 : 0);
export const isWater = (id) => id === B.Water || (id >= B.Flow1 && id <= B.Flow7);

// Texture layers (order of SourceArt/Textures/block_layers.json)
export const LAYER_NAMES = ['Stone', 'Dirt', 'GrassTop', 'Sand', 'Gravel', 'Snow', 'Bedrock', 'Cobblestone', 'Planks', 'Bricks',
  'OakLog', 'BirchLog', 'SpruceLog', 'JungleLog', 'LogTop', 'Leaves', 'Needles', 'Sandstone', 'RedSandstone', 'Mud', 'Moss', 'Ice',
  'CoalOre', 'IronOre', 'GoldOre', 'DiamondOre', 'GrassTuft', 'FlowerRed', 'FlowerYellow', 'DeadBush', 'Glowcap', 'Torch', 'TorchTop',
  'Cactus', 'CactusTop'];
export const L = Object.fromEntries(LAYER_NAMES.map((n, i) => [n, i]));
export const NONE = 255;

export const F = { Solid: 1, Opaque: 2, Liquid: 4, Replaceable: 8, Breakable: 16, NeedsSupport: 32 };
export const Shape = { None: 0, Cube: 1, Cutout: 2, Cross: 3, Torch: 4, Liquid: 5 };
export const Tint = { None: 0, Grass: 1, Foliage: 2, Birch: 3, Spruce: 4 };

const T = F.Solid | F.Opaque | F.Breakable;
const PLANT = F.Replaceable | F.Breakable | F.NeedsSupport;
function cube(name, top, side = top, bottom = side, overlay = NONE, tint = 0, flags = T) {
  return { name, flags, shape: Shape.Cube, top, side, bottom, overlay, emission: 0, opacity: 15, tint, wind: 0 };
}
const leaves = (name, layer, tint) => ({ name, flags: F.Solid | F.Breakable, shape: Shape.Cutout, top: layer, side: layer, bottom: layer, overlay: NONE, emission: 0, opacity: 1, tint, wind: 70 });
const cross = (name, layer, tint, emission = 0, wind = 255) => ({ name, flags: PLANT, shape: Shape.Cross, top: layer, side: layer, bottom: layer, overlay: NONE, emission, opacity: 0, tint, wind });
const water = (name) => ({ name, flags: F.Liquid | F.Replaceable, shape: Shape.Liquid, top: NONE, side: NONE, bottom: NONE, overlay: NONE, emission: 0, opacity: 2, tint: 0, wind: 0 });

export const BLOCKS = [];
BLOCKS[B.Air] = { name: 'Air', flags: F.Replaceable, shape: Shape.None, top: NONE, side: NONE, bottom: NONE, overlay: NONE, emission: 0, opacity: 0, tint: 0, wind: 0 };
BLOCKS[B.Stone] = cube('Stone', L.Stone);
BLOCKS[B.Dirt] = cube('Dirt', L.Dirt);
BLOCKS[B.Grass] = cube('Grass', L.GrassTop, L.Dirt, L.Dirt, L.GrassTop, Tint.Grass);
BLOCKS[B.Sand] = cube('Sand', L.Sand);
BLOCKS[B.Gravel] = cube('Gravel', L.Gravel);
BLOCKS[B.Snow] = cube('Snow', L.Snow);
BLOCKS[B.Bedrock] = cube('Bedrock', L.Bedrock, L.Bedrock, L.Bedrock, NONE, 0, F.Solid | F.Opaque);
BLOCKS[B.Water] = water('Water');
BLOCKS[B.Cobblestone] = cube('Cobblestone', L.Cobblestone);
BLOCKS[B.Planks] = cube('Planks', L.Planks);
BLOCKS[B.Bricks] = cube('Bricks', L.Bricks);
BLOCKS[B.OakLog] = cube('Oak Log', L.LogTop, L.OakLog, L.LogTop);
BLOCKS[B.BirchLog] = cube('Birch Log', L.LogTop, L.BirchLog, L.LogTop);
BLOCKS[B.SpruceLog] = cube('Spruce Log', L.LogTop, L.SpruceLog, L.LogTop);
BLOCKS[B.JungleLog] = cube('Jungle Log', L.LogTop, L.JungleLog, L.LogTop);
BLOCKS[B.OakLeaves] = leaves('Oak Leaves', L.Leaves, Tint.Foliage);
BLOCKS[B.BirchLeaves] = leaves('Birch Leaves', L.Leaves, Tint.Birch);
BLOCKS[B.SpruceLeaves] = leaves('Spruce Leaves', L.Needles, Tint.Spruce);
BLOCKS[B.JungleLeaves] = leaves('Jungle Leaves', L.Leaves, Tint.Foliage);
BLOCKS[B.Sandstone] = cube('Sandstone', L.Sandstone);
BLOCKS[B.RedSandstone] = cube('Red Sandstone', L.RedSandstone);
BLOCKS[B.Mud] = cube('Mud', L.Mud);
BLOCKS[B.Moss] = cube('Moss', L.Moss);
BLOCKS[B.Ice] = cube('Ice', L.Ice);
BLOCKS[B.CoalOre] = cube('Coal Ore', L.CoalOre);
BLOCKS[B.IronOre] = cube('Iron Ore', L.IronOre);
BLOCKS[B.GoldOre] = cube('Gold Ore', L.GoldOre);
BLOCKS[B.DiamondOre] = cube('Diamond Ore', L.DiamondOre);
BLOCKS[B.TallGrass] = cross('Tall Grass', L.GrassTuft, Tint.Grass);
BLOCKS[B.FlowerRed] = cross('Poppy', L.FlowerRed, 0);
BLOCKS[B.FlowerYellow] = cross('Dandelion', L.FlowerYellow, 0);
BLOCKS[B.DeadBush] = cross('Dead Bush', L.DeadBush, 0);
BLOCKS[B.Glowcap] = cross('Glowcap', L.Glowcap, 0, 11, 0);
BLOCKS[B.Torch] = { name: 'Torch', flags: F.Breakable | F.NeedsSupport, shape: Shape.Torch, top: L.TorchTop, side: L.Torch, bottom: L.Torch, overlay: NONE, emission: 14, opacity: 0, tint: 0, wind: 0 };
BLOCKS[B.Cactus] = cube('Cactus', L.CactusTop, L.Cactus, L.CactusTop);
BLOCKS[B.SnowyGrass] = cube('Snowy Grass', L.Snow, L.Dirt, L.Dirt, L.Snow);
BLOCKS[37] = BLOCKS[B.Air];
for (let lv = 1; lv <= 7; lv++) BLOCKS[37 + lv] = water('Flowing Water');

export const has = (id, f) => (BLOCKS[id].flags & f) !== 0;
export const isOpaque = (id) => (BLOCKS[id].flags & F.Opaque) !== 0;
export const isSolid = (id) => (BLOCKS[id].flags & F.Solid) !== 0;
export const layerFor = (d, face) => (face === 2 ? d.top : face === 3 ? d.bottom : d.side);

// Per-layer material tuning (Unity WorldSceneBuilder.DefaultLayer): tiling (blocks per repeat), normal strength,
// roughness scale, macro variation, tint rgb, specular, emission, translucency, biome tint, cutout.
export const LAYER_TUNING = LAYER_NAMES.map((n) => {
  const built = n === 'Cobblestone' || n === 'Planks' || n === 'Bricks';
  const t = { tile: built ? 1 : n === 'GrassTop' ? 2 : 2.5, normal: built ? 1 : 1.15, rough: 1.15, macro: built ? 0.12 : 0.4,
    tint: [1, 1, 1], spec: 1, emission: 0, trans: 0, biome: 0, cutout: 0 };
  switch (n) {
    case 'Stone': t.tint = [1.45, 1.42, 1.38]; t.rough = 1.35; break;
    case 'Bedrock': t.tint = [1.3, 1.3, 1.3]; t.rough = 1.3; break;
    case 'GrassTop': t.tint = [0.84, 0.92, 0.76]; t.rough = 1.8; t.biome = 1; t.spec = 0.3; break;
    case 'Dirt': t.rough = 1.3; t.spec = 0.5; break;
    case 'Snow': t.rough = 1.2; t.macro = 0.15; break;
    case 'OakLog': case 'SpruceLog': case 'JungleLog': t.tile = 1.5; t.macro = 0.15; t.rough = 1.3; break;
    case 'BirchLog': t.tile = 1.5; t.macro = 0.1; t.tint = [1.55, 1.52, 1.45]; break;
    case 'LogTop': t.tile = 1; t.macro = 0.05; break;
    case 'Leaves': t.tile = 1; t.macro = 0.25; t.rough = 1.5; t.tint = [0.62, 0.78, 0.48]; t.biome = 1; t.cutout = 1; t.trans = 0.9; t.spec = 0.3; break;
    case 'Needles': t.tile = 1; t.macro = 0.2; t.biome = 1; t.cutout = 1; t.trans = 0.5; t.spec = 0.3; break;
    case 'Sandstone': t.tint = [1.1, 1.02, 0.9]; t.tile = 2; break;
    case 'RedSandstone': t.tile = 3; t.tint = [1.15, 0.92, 0.8]; break;
    case 'Mud': t.rough = 0.8; break;
    case 'Moss': t.tile = 2; t.rough = 1.3; t.spec = 0.3; break;
    case 'Ice': t.tile = 2; t.rough = 0.5; t.macro = 0.1; break;
    case 'CoalOre': case 'IronOre': case 'GoldOre': case 'DiamondOre': t.tile = 1; t.macro = 0.2; t.tint = [1.45, 1.42, 1.38]; break;
    case 'GrassTuft': t.tile = 1; t.macro = 0.2; t.biome = 1; t.cutout = 1; t.trans = 1; t.rough = 1.3; t.tint = [0.9, 1, 0.85]; t.spec = 0.3; break;
    case 'FlowerRed': case 'FlowerYellow': case 'DeadBush': t.tile = 1; t.macro = 0; t.cutout = 1; t.trans = 0.7; t.spec = 0.5; break;
    case 'Glowcap': t.tile = 1; t.macro = 0; t.cutout = 1; t.emission = 5; t.trans = 0.4; break;
    case 'Torch': case 'TorchTop': t.tile = 1; t.macro = 0; t.emission = 9; break;
    case 'Cactus': case 'CactusTop': t.tile = 1; t.macro = 0.1; break;
  }
  return t;
});

// ---------------------------------------------------------------- items

export const I = {
  Stick: 256, Coal: 257, IronChunk: 258, GoldChunk: 259, Diamond: 260, Apple: 261, Berries: 262,
  WoodenPickaxe: 270, StonePickaxe: 271, IronPickaxe: 272, DiamondPickaxe: 273,
  WoodenAxe: 274, StoneAxe: 275, IronAxe: 276, DiamondAxe: 277,
  WoodenShovel: 278, StoneShovel: 279, IronShovel: 280, DiamondShovel: 281,
};
export const Kind = { Block: 0, Material: 1, Tool: 2, Food: 3 };
export const ToolType = { None: 0, Pickaxe: 1, Axe: 2, Shovel: 3 };
export const Tier = { Hand: 0, Wood: 1, Stone: 2, Iron: 3, Diamond: 4 };

export const ITEMS = {};
const placeable = [B.Stone, B.Dirt, B.Grass, B.Sand, B.Gravel, B.Snow, B.Cobblestone, B.Planks, B.Bricks, B.OakLog, B.BirchLog, B.SpruceLog,
  B.JungleLog, B.OakLeaves, B.BirchLeaves, B.SpruceLeaves, B.JungleLeaves, B.Sandstone, B.RedSandstone, B.Mud, B.Moss, B.Ice, B.CoalOre,
  B.IronOre, B.GoldOre, B.DiamondOre, B.TallGrass, B.FlowerRed, B.FlowerYellow, B.DeadBush, B.Glowcap, B.Torch, B.Cactus, B.SnowyGrass];
for (const b of placeable) ITEMS[b] = { id: b, name: BLOCKS[b].name, kind: Kind.Block, stack: 64, block: b };
const mat = (id, name) => (ITEMS[id] = { id, name, kind: Kind.Material, stack: 64 });
const food = (id, name, f, sat) => (ITEMS[id] = { id, name, kind: Kind.Food, stack: 64, food: f, sat });
mat(I.Stick, 'Stick'); mat(I.Coal, 'Coal'); mat(I.IronChunk, 'Iron Chunk'); mat(I.GoldChunk, 'Gold Chunk'); mat(I.Diamond, 'Diamond');
food(I.Apple, 'Apple', 4, 2.4); food(I.Berries, 'Wild Berries', 2, 0.4);
const tiers = [['Wooden', Tier.Wood, 60], ['Stone', Tier.Stone, 132], ['Iron', Tier.Iron, 251], ['Diamond', Tier.Diamond, 1562]];
tiers.forEach(([prefix, tier, dur], t) => {
  ITEMS[I.WoodenPickaxe + t] = { id: I.WoodenPickaxe + t, name: `${prefix} Pickaxe`, kind: Kind.Tool, stack: 1, tool: ToolType.Pickaxe, tier, durability: dur };
  ITEMS[I.WoodenAxe + t] = { id: I.WoodenAxe + t, name: `${prefix} Axe`, kind: Kind.Tool, stack: 1, tool: ToolType.Axe, tier, durability: dur };
  ITEMS[I.WoodenShovel + t] = { id: I.WoodenShovel + t, name: `${prefix} Shovel`, kind: Kind.Tool, stack: 1, tool: ToolType.Shovel, tier, durability: dur };
});
export const itemName = (id) => (ITEMS[id] ? ITEMS[id].name : `Item ${id}`);

// ---------------------------------------------------------------- mining (Unity Gameplay.Mining)

export function mining(block) {
  switch (block) {
    case B.Stone: case B.Cobblestone: case B.Bricks: case B.Sandstone: case B.RedSandstone:
      return { hardness: 1.5, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.CoalOre: return { hardness: 3, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.IronOre: return { hardness: 3, tool: ToolType.Pickaxe, required: Tier.Stone };
    case B.GoldOre: case B.DiamondOre: return { hardness: 3, tool: ToolType.Pickaxe, required: Tier.Iron };
    case B.Ice: return { hardness: 0.5, tool: ToolType.Pickaxe, required: Tier.Hand };
    case B.OakLog: case B.BirchLog: case B.SpruceLog: case B.JungleLog: case B.Planks:
      return { hardness: 2, tool: ToolType.Axe, required: Tier.Hand };
    case B.Cactus: return { hardness: 0.4, tool: ToolType.None, required: Tier.Hand };
    case B.Dirt: case B.Grass: case B.SnowyGrass: case B.Sand: case B.Mud:
      return { hardness: 0.5, tool: ToolType.Shovel, required: Tier.Hand };
    case B.Gravel: return { hardness: 0.6, tool: ToolType.Shovel, required: Tier.Hand };
    case B.Snow: return { hardness: 0.2, tool: ToolType.Shovel, required: Tier.Hand };
    case B.Moss: return { hardness: 0.3, tool: ToolType.Shovel, required: Tier.Hand };
    case B.OakLeaves: case B.BirchLeaves: case B.SpruceLeaves: case B.JungleLeaves:
      return { hardness: 0.2, tool: ToolType.None, required: Tier.Hand };
    case B.Bedrock: return { hardness: -1, tool: ToolType.None, required: Tier.Hand };
    default: return { hardness: 0, tool: ToolType.None, required: Tier.Hand };
  }
}
const toolSpeed = (tier) => [1, 2, 4, 6, 8][tier];
export function canHarvest(block, held) {
  const m = mining(block);
  if (m.hardness < 0) return false;
  if (m.required === Tier.Hand) return true;
  const it = held ? ITEMS[held] : null;
  return !!it && it.kind === Kind.Tool && it.tool === m.tool && it.tier >= m.required;
}
export function breakSeconds(block, held) {
  const m = mining(block);
  if (m.hardness < 0) return Infinity;
  if (m.hardness === 0) return 0;
  let t = m.hardness * (canHarvest(block, held) ? 1.5 : 5);
  const it = held ? ITEMS[held] : null;
  if (it && it.kind === Kind.Tool && it.tool === m.tool && m.tool !== ToolType.None) t /= toolSpeed(it.tier);
  return t;
}

/** What breaking a block yields (Unity Drops): [itemId, count] pairs. rnd in [0,1). */
export function drops(block, held, rnd) {
  if (!canHarvest(block, held)) return [];
  switch (block) {
    case B.Stone: return [[B.Cobblestone, 1]];
    case B.Grass: case B.SnowyGrass: return [[B.Dirt, 1]];
    case B.CoalOre: return [[I.Coal, 1]];
    case B.IronOre: return [[I.IronChunk, 1]];
    case B.GoldOre: return [[I.GoldChunk, 1]];
    case B.DiamondOre: return [[I.Diamond, 1]];
    case B.Ice: return [];
    case B.OakLeaves: case B.JungleLeaves: return rnd < 0.06 ? [[I.Apple, 1]] : rnd < 0.14 ? [[I.Stick, 1]] : [];
    case B.BirchLeaves: case B.SpruceLeaves: return rnd < 0.1 ? [[I.Stick, 1]] : [];
    case B.TallGrass: return rnd < 0.12 ? [[I.Berries, 1]] : [];
    case B.DeadBush: return rnd < 0.5 ? [[I.Stick, 1]] : [];
    default: return ITEMS[block] ? [[block, 1]] : [];
  }
}

// ---------------------------------------------------------------- recipes (Unity Recipes, shapeless)

export const RECIPES = [];
const recipe = (out, count, inputs) => RECIPES.push({ out, count, inputs, name: itemName(out) });
for (const log of [B.OakLog, B.BirchLog, B.SpruceLog, B.JungleLog]) recipe(B.Planks, 4, [[log, 1]]);
recipe(I.Stick, 4, [[B.Planks, 2]]);
recipe(B.Torch, 4, [[I.Coal, 1], [I.Stick, 1]]);
recipe(B.Sandstone, 1, [[B.Sand, 4]]);
recipe(B.Bricks, 1, [[B.Cobblestone, 2], [B.Sand, 2]]);
const toolMats = [B.Planks, B.Cobblestone, I.IronChunk, I.Diamond];
toolMats.forEach((m, t) => {
  recipe(I.WoodenPickaxe + t, 1, [[m, 3], [I.Stick, 2]]);
  recipe(I.WoodenAxe + t, 1, [[m, 3], [I.Stick, 2]]);
  recipe(I.WoodenShovel + t, 1, [[m, 1], [I.Stick, 2]]);
});
