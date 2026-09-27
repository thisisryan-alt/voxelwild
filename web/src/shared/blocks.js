import CATALOG from './catalog.json';
import { K, KIND_NAMES, STATES, SOLID_KINDS, FACE6, DIR6, setRedstoneBlock } from './shapes.js';
// Blocks, texture layers, items, mining and recipes - mirrors the Unity registry (BlockId, BlockRegistry,
// ItemRegistry, Mining, Recipes) so both builds play by the same rules.

export const B = {
  Air: 0, Stone: 1, Dirt: 2, Grass: 3, Sand: 4, Gravel: 5, Snow: 6, Bedrock: 7, Water: 8, Cobblestone: 9, Planks: 10, Bricks: 11,
  OakLog: 12, BirchLog: 13, SpruceLog: 14, JungleLog: 15, OakLeaves: 16, BirchLeaves: 17, SpruceLeaves: 18, JungleLeaves: 19,
  Sandstone: 20, RedSandstone: 21, Mud: 22, Moss: 23, Ice: 24, CoalOre: 25, IronOre: 26, GoldOre: 27, DiamondOre: 28,
  TallGrass: 29, FlowerRed: 30, FlowerYellow: 31, DeadBush: 32, Glowcap: 33, Torch: 34, Cactus: 35, SnowyGrass: 36,
  PropBarrier: 37,   // invisible collision inside dead trees, stumps and fallen logs (props)
  Flow1: 38, Flow7: 44,
  // lava (source 45, flowing levels 1..7 = 46..52), the Nether, the End and strongholds
  Lava: 45, LavaFlow1: 46, LavaFlow7: 52,
  Obsidian: 53, NetherPortalX: 54, NetherPortalZ: 55, Netherrack: 56, NetherQuartzOre: 57, NetherGoldOre: 58, Glowstone: 59,
  SoulSand: 60, SoulSoil: 61, Basalt: 62, Blackstone: 63, Magma: 64, NetherBricks: 65, CrimsonNylium: 66, WarpedNylium: 67,
  CrimsonStem: 68, WarpedStem: 69, NetherWartBlock: 70, WarpedWartBlock: 71, Shroomlight: 72, CrimsonFungus: 73, WarpedFungus: 74,
  CrimsonRoots: 75, WarpedRoots: 76, WeepingVines: 77, TwistingVines: 78,
  EndStone: 79, EndStoneBricks: 80, Purpur: 81, EndPortalFrame: 82, EndPortalFrameEye: 83, EndPortal: 84, EndGateway: 85,
  ChorusPlant: 86, ChorusFlower: 87, StoneBricks: 88, MossyStoneBricks: 89, CrackedStoneBricks: 90,
};
export const BLOCK_COUNT = 91;
export const waterLevel = (id) => (id === B.Water ? 8 : id >= B.Flow1 && id <= B.Flow7 ? id - 37 : 0);
export const isWater = (id) => id === B.Water || (id >= B.Flow1 && id <= B.Flow7);
export const lavaLevel = (id) => (id === B.Lava ? 8 : id >= B.LavaFlow1 && id <= B.LavaFlow7 ? id - 45 : 0);
export const isLava = (id) => id >= B.Lava && id <= B.LavaFlow7;
export const isLiquid = (id) => isWater(id) || isLava(id);
export const isPortal = (id) => id === B.NetherPortalX || id === B.NetherPortalZ;
/** Dimensions: the overworld, the Nether (y 0..127 between bedrock) and the End (islands over the void). */
export const Dim = { Overworld: 0, Nether: 1, End: 2, Sky: 3 };   // Sky: the Skylands (not in Minecraft)

// Texture layers (order of SourceArt/Textures/block_layers.json)
export const LAYER_NAMES = ['Stone', 'Dirt', 'GrassTop', 'Sand', 'Gravel', 'Snow', 'Bedrock', 'Cobblestone', 'Planks', 'Bricks',
  'OakLog', 'BirchLog', 'SpruceLog', 'JungleLog', 'LogTop', 'Leaves', 'Needles', 'Sandstone', 'RedSandstone', 'Mud', 'Moss', 'Ice',
  'CoalOre', 'IronOre', 'GoldOre', 'DiamondOre', 'GrassTuft', 'FlowerRed', 'FlowerYellow', 'DeadBush', 'Glowcap', 'Torch', 'TorchTop',
  'Cactus', 'CactusTop',
  'Lava', 'Obsidian', 'NetherPortal', 'Netherrack', 'NetherQuartzOre', 'NetherGoldOre', 'Glowstone', 'SoulSand', 'SoulSoil', 'BasaltTop',
  'BasaltSide', 'BlackstoneTop', 'Blackstone', 'Magma', 'NetherBricks', 'CrimsonNylium', 'CrimsonNyliumSide', 'WarpedNylium',
  'WarpedNyliumSide', 'CrimsonStem', 'CrimsonStemTop', 'WarpedStem', 'WarpedStemTop', 'NetherWart', 'WarpedWart', 'Shroomlight',
  'CrimsonFungus', 'WarpedFungus', 'CrimsonRoots', 'WarpedRoots', 'WeepingVines', 'TwistingVines', 'EndStone', 'EndStoneBricks', 'Purpur',
  'EndFrameTop', 'EndFrameSide', 'EndFrameEye', 'EndPortal', 'ChorusPlant', 'ChorusFlower', 'StoneBricks', 'MossyStoneBricks',
  'CrackedStoneBricks', 'LeavesExt', 'NeedlesExt'];
// the catalog's textures follow ('c:' + Minecraft texture name); index 255 stays unused (it means "no layer")
export const BASE_LAYERS = LAYER_NAMES.length;
for (const t of CATALOG.textures) { if (LAYER_NAMES.length === 255) LAYER_NAMES.push('_none'); LAYER_NAMES.push('c:' + t); }
export const L = Object.fromEntries(LAYER_NAMES.map((n, i) => [n, i]));
export const NONE = 255;

export const F = { Solid: 1, Opaque: 2, Liquid: 4, Replaceable: 8, Breakable: 16, NeedsSupport: 32 };
export const Shape = { None: 0, Cube: 1, Cutout: 2, Cross: 3, Torch: 4, Liquid: 5, Portal: 6, EndPortal: 7, Glass: 8, Model: 9 };
export const Tint = { None: 0, Grass: 1, Foliage: 2, Birch: 3, Spruce: 4 };

const T = F.Solid | F.Opaque | F.Breakable;
const PLANT = F.Replaceable | F.Breakable | F.NeedsSupport;
function cube(name, top, side = top, bottom = side, overlay = NONE, tint = 0, flags = T) {
  return { name, flags, shape: Shape.Cube, top, side, bottom, overlay, emission: 0, opacity: 15, tint, wind: 0 };
}
const leaves = (name, layer, tint) => ({ name, flags: F.Solid | F.Breakable, shape: Shape.Cutout, top: layer, side: layer, bottom: layer, overlay: NONE, emission: 0, opacity: 1, tint, wind: 150 });
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
// leaves carry an extension layer: loose clusters that stick out past the cube (fancy leaves, like better-leaves packs)
BLOCKS[B.OakLeaves] = { ...leaves('Oak Leaves', L.Leaves, Tint.Foliage), ext: L.LeavesExt };
BLOCKS[B.BirchLeaves] = { ...leaves('Birch Leaves', L.Leaves, Tint.Birch), ext: L.LeavesExt };
BLOCKS[B.SpruceLeaves] = { ...leaves('Spruce Leaves', L.Needles, Tint.Spruce), ext: L.NeedlesExt };
BLOCKS[B.JungleLeaves] = { ...leaves('Jungle Leaves', L.Leaves, Tint.Foliage), ext: L.LeavesExt };
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
BLOCKS[B.PropBarrier] = { name: 'Dead Wood', flags: F.Solid | F.Breakable, shape: Shape.None, top: NONE, side: NONE, bottom: NONE, overlay: NONE, emission: 0, opacity: 0, tint: 0, wind: 0 };
for (let lv = 1; lv <= 7; lv++) BLOCKS[37 + lv] = water('Flowing Water');
// ---- lava: an opaque, glowing liquid (meshed like water, drawn with the terrain)
const lava = (name) => ({ name, flags: F.Liquid | F.Replaceable, shape: Shape.Liquid, top: L.Lava, side: L.Lava, bottom: L.Lava, overlay: NONE, emission: 15, opacity: 15, tint: 0, wind: 0 });
BLOCKS[B.Lava] = lava('Lava');
for (let lv = 1; lv <= 7; lv++) BLOCKS[B.Lava + lv] = lava('Flowing Lava');
const glow = (d, e) => { d.emission = e; return d; };
const portal = (name) => ({ name, flags: 0, shape: Shape.Portal, top: L.NetherPortal, side: L.NetherPortal, bottom: L.NetherPortal, overlay: NONE, emission: 11, opacity: 0, tint: 0, wind: 0 });
BLOCKS[B.Obsidian] = cube('Obsidian', L.Obsidian);
BLOCKS[B.NetherPortalX] = portal('Nether Portal');
BLOCKS[B.NetherPortalZ] = portal('Nether Portal');
BLOCKS[B.Netherrack] = cube('Netherrack', L.Netherrack);
BLOCKS[B.NetherQuartzOre] = cube('Nether Quartz Ore', L.NetherQuartzOre);
BLOCKS[B.NetherGoldOre] = cube('Nether Gold Ore', L.NetherGoldOre);
BLOCKS[B.Glowstone] = glow(cube('Glowstone', L.Glowstone), 15);
BLOCKS[B.SoulSand] = cube('Soul Sand', L.SoulSand);
BLOCKS[B.SoulSoil] = cube('Soul Soil', L.SoulSoil);
BLOCKS[B.Basalt] = cube('Basalt', L.BasaltTop, L.BasaltSide, L.BasaltTop);
BLOCKS[B.Blackstone] = cube('Blackstone', L.BlackstoneTop, L.Blackstone, L.BlackstoneTop);
BLOCKS[B.Magma] = glow(cube('Magma Block', L.Magma), 3);
BLOCKS[B.NetherBricks] = cube('Nether Bricks', L.NetherBricks);
BLOCKS[B.CrimsonNylium] = cube('Crimson Nylium', L.CrimsonNylium, L.CrimsonNyliumSide, L.Netherrack);
BLOCKS[B.WarpedNylium] = cube('Warped Nylium', L.WarpedNylium, L.WarpedNyliumSide, L.Netherrack);
BLOCKS[B.CrimsonStem] = cube('Crimson Stem', L.CrimsonStemTop, L.CrimsonStem, L.CrimsonStemTop);
BLOCKS[B.WarpedStem] = cube('Warped Stem', L.WarpedStemTop, L.WarpedStem, L.WarpedStemTop);
BLOCKS[B.NetherWartBlock] = cube('Nether Wart Block', L.NetherWart);
BLOCKS[B.WarpedWartBlock] = cube('Warped Wart Block', L.WarpedWart);
BLOCKS[B.Shroomlight] = glow(cube('Shroomlight', L.Shroomlight), 15);
BLOCKS[B.CrimsonFungus] = cross('Crimson Fungus', L.CrimsonFungus, 0, 0, 0);
BLOCKS[B.WarpedFungus] = cross('Warped Fungus', L.WarpedFungus, 0, 0, 0);
BLOCKS[B.CrimsonRoots] = cross('Crimson Roots', L.CrimsonRoots, 0, 0, 60);
BLOCKS[B.WarpedRoots] = cross('Warped Roots', L.WarpedRoots, 0, 0, 60);
// vines hang from ceilings (weeping) or climb from the floor (twisting): no support check
BLOCKS[B.WeepingVines] = { ...cross('Weeping Vines', L.WeepingVines, 0, 0, 0), flags: F.Replaceable | F.Breakable };
BLOCKS[B.TwistingVines] = { ...cross('Twisting Vines', L.TwistingVines, 0, 0, 0), flags: F.Replaceable | F.Breakable };
BLOCKS[B.EndStone] = cube('End Stone', L.EndStone);
BLOCKS[B.EndStoneBricks] = cube('End Stone Bricks', L.EndStoneBricks);
BLOCKS[B.Purpur] = cube('Purpur Block', L.Purpur);
BLOCKS[B.EndPortalFrame] = cube('End Portal Frame', L.EndFrameTop, L.EndFrameSide, L.EndStone, NONE, 0, F.Solid | F.Opaque);
BLOCKS[B.EndPortalFrameEye] = glow(cube('End Portal Frame', L.EndFrameEye, L.EndFrameSide, L.EndStone, NONE, 0, F.Solid | F.Opaque), 1);
BLOCKS[B.EndPortal] = { name: 'End Portal', flags: 0, shape: Shape.EndPortal, top: L.EndPortal, side: L.EndPortal, bottom: L.EndPortal, overlay: NONE, emission: 15, opacity: 0, tint: 0, wind: 0 };
BLOCKS[B.EndGateway] = { name: 'End Gateway', flags: 0, shape: Shape.Cube, top: L.EndPortal, side: L.EndPortal, bottom: L.EndPortal, overlay: NONE, emission: 15, opacity: 15, tint: 0, wind: 0 };
BLOCKS[B.ChorusPlant] = { ...leaves('Chorus Plant', L.ChorusPlant, 0), wind: 0 };
BLOCKS[B.ChorusFlower] = glow({ ...leaves('Chorus Flower', L.ChorusFlower, 0), wind: 0 }, 0);
BLOCKS[B.StoneBricks] = cube('Stone Bricks', L.StoneBricks);
BLOCKS[B.MossyStoneBricks] = cube('Mossy Stone Bricks', L.MossyStoneBricks);
BLOCKS[B.CrackedStoneBricks] = cube('Cracked Stone Bricks', L.CrackedStoneBricks);

// ---------------------------------------------------------------- the catalog (catalog.json): ids from 1000
export const CATALOG_START = 1000;
export const C = {};                       // catalog key -> block id
export const CAT = [];                     // block id -> catalog entry
const TINTS = { grass: Tint.Grass, foliage: Tint.Foliage, birch: Tint.Birch, spruce: Tint.Spruce };
CATALOG.blocks.forEach((e, k) => {
  const id = CATALOG_START + k, lt = (t) => L['c:' + t];
  const top = lt(e.top), side = lt(e.side), bottom = lt(e.bottom), tint = TINTS[e.tint] || 0, emission = e.emission || 0;
  let d;
  switch (e.shape) {
    case 'cross': d = cross(e.name, side, tint, emission, e.cat === 'plant' && !/mushroom|cobweb|coral|lily|kelp|seagrass|spore/.test(e.key) ? 200 : 0); break;
    case 'leaves': d = { ...leaves(e.name, side, tint), ext: side }; break;
    case 'clear': d = { ...cube(e.name, top, side, bottom, NONE, tint, F.Solid | F.Breakable), shape: Shape.Cutout, opacity: 1, wind: 0 }; break;
    case 'glass': d = { ...cube(e.name, top, side, bottom, NONE, tint, F.Solid | F.Breakable), shape: Shape.Glass, opacity: 1 }; break;
    default: d = cube(e.name, top, side, bottom, NONE, tint);
  }
  d.emission = emission;
  if (e.key.startsWith('sugar_cane')) d.flags = PLANT;
  BLOCKS[id] = d; C[e.key] = id; CAT[id] = e;
});

// ---------------------------------------------------------------- shaped blocks (catalog.json models, shapes.js): ids after the catalog
export const MODEL_START = CATALOG_START + CATALOG.blocks.length;
export const FAMS = [];                    // family: { key, name, kind (K), first id, states, mat (full block id), list, cat }
export const FAM = {};                     // family key -> family
export const MODEL_LIST = { opaque: 0, cutout: 1, glow: 2 };
const ROT = [1, 3, 0, 2];     // texture turn (0, 90, 180, 270 degrees) for facings east, west, south, north
// face axes as the mesher and shader use them (u along T, image top along +B)
const FT6 = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [-1, 0, 0], [1, 0, 0]], FB6 = [[0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
/** Which quarter turn (0, 90, 180, 270 clockwise) puts a side texture's top edge toward six-way facing f on face k. */
function sideTurn(f, k) {
  const d = DIR6[f], dot = (a) => a[0] * d[0] + a[1] * d[1] + a[2] * d[2];
  const b = dot(FB6[k]), t = dot(FT6[k]);
  return b > 0 ? 0 : b < 0 ? 2 : t > 0 ? 1 : 3;
}
{
  let next = MODEL_START;
  const texLayer = (t) => (t.startsWith('B:') ? BLOCKS[B[t.slice(2)]].side : L['c:' + t]);
  for (const e of CATALOG.models) {
    const kind = KIND_NAMES[e.kind];
    const mat = e.mat ? (e.mat.startsWith('B:') ? B[e.mat.slice(2)] : C[e.mat]) : 0;
    const md = mat ? BLOCKS[mat] : null;
    const fam = { key: e.key, name: e.name, kind, first: next, states: STATES[kind], mat, cat: e.cat, index: FAMS.length };
    fam.list = MODEL_LIST[e.list || (md && md.shape === Shape.Glass ? 'glow' : md && md.shape === Shape.Cutout ? 'cutout' : 'opaque')];
    const tint = TINTS[e.tint] || (md ? md.tint : 0);
    const needsFloor = kind === K.Plate || kind === K.Rail || kind === K.Carpet || kind === K.Tall || kind === K.Snow;
    for (let st = 0; st < fam.states; st++) {
      const id = next++;
      let top = md ? md.top : NONE, side = md ? md.side : NONE, bottom = md ? md.bottom : NONE;
      const tex = e.tex || [];
      if (kind === K.Door) top = side = bottom = texLayer(tex[st & 1]);
      else if (kind === K.Tall) top = side = bottom = texLayer(tex[st]);
      else if (kind === K.Rail) top = side = bottom = texLayer(tex[st]);
      else if (kind === K.Path || kind === K.Waystone) { top = texLayer(tex[0]); side = texLayer(tex[1]); bottom = texLayer(tex[2]); }
      else if (kind === K.Wire) { const b = st === 0 ? 0 : st <= 5 ? 1 : st <= 10 ? 2 : 3; top = side = bottom = texLayer(tex[b * 3]); }
      else if (kind === K.RTorch) top = side = bottom = texLayer(tex[st < 2 ? st : (st - 2) & 1]);
      else if (kind === K.Lever) top = side = bottom = texLayer(tex[0]);
      else if (kind === K.Repeater) { top = texLayer(tex[(st >= 16 ? 4 : 0) + ROT[st & 3]]); side = bottom = texLayer(tex[8]); }
      else if (kind === K.Bed) { top = texLayer(tex[(st & 1 ? 0 : 4) + ROT[st >> 1]]); side = texLayer(tex[8]); bottom = texLayer(tex[9]); }
      else if (kind === K.Crop) top = side = bottom = texLayer(tex[st]);
      else if (tex.length) top = side = bottom = texLayer(tex[0]);
      if (kind === K.Stairs || kind === K.Slab || kind === K.Wall || kind === K.Fence || kind === K.Gate) {
        // logs and pillars cut into shapes keep their side texture all round
        if (md && md.top !== md.side && md.bottom !== md.side && kind !== K.Slab && kind !== K.Stairs) top = bottom = side;
      }
      let flags = F.Breakable | (SOLID_KINDS.has(kind) ? F.Solid : 0) | (needsFloor || kind === K.Wire || kind === K.Crop || kind === K.Repeater ? F.NeedsSupport : 0);
      if (kind === K.Tall && tint) flags |= F.Replaceable;
      const d = { name: e.name, flags, shape: Shape.Model, top, side, bottom, overlay: NONE, emission: e.emission || (md ? md.emission : 0),
        opacity: [K.Slab, K.Stairs, K.Path, K.Snow, K.Bed, K.Piston, K.Head].includes(kind) ? 1 : 0, tint, wind: kind === K.Tall ? 200 : 0, model: { kind, state: st, fam: fam.index } };
      if (kind === K.Slab && st === 2) Object.assign(d, { shape: md && md.shape !== Shape.Model ? md.shape : Shape.Cube, flags: md ? md.flags : T, opacity: md ? md.opacity : 15 });
      if (kind === K.Tall) d.shape = Shape.Cross;
      if (kind === K.Crop) Object.assign(d, { shape: Shape.Cross, wind: 150 });
      if (kind === K.Wire) d.alt = [0, 1, 2].map((k) => texLayer(tex[(st === 0 ? 0 : st <= 5 ? 1 : st <= 10 ? 2 : 3) * 3 + k]));
      if (kind === K.Lever) d.alt = [texLayer(tex[0]), texLayer(tex[1])];
      if (kind === K.Repeater) d.alt = [top, texLayer(tex[st >= 16 ? 9 : 10])];
      if (kind === K.RTorch) {
        d.emission = (st < 2 ? st === 0 : ((st - 2) & 1) === 0) ? 7 : 0;
        if (st < 2) d.shape = Shape.Torch;
      }
      if (kind === K.Piston || kind === K.Head || kind === K.Observer || kind === K.Dispenser) {
        const f = st % 6, front = FACE6[f], back = FACE6[f ^ 1], L6 = tex.map(texLayer);
        // side textures turned so their top edge points the way the block faces
        const sides = kind === K.Piston ? [L6[1], L6[4], L6[5], L6[6]] : kind === K.Head ? L6.slice(2, 6) : kind === K.Observer ? L6.slice(3, 7) : null;
        const side = (k) => (sides ? sides[sideTurn(f, k)] : k === 2 || k === 3 ? L6[3] : L6[2]);
        if (kind === K.Piston) {
          const ext = st >= 6;
          d.faces = [0, 1, 2, 3, 4, 5].map((k) => (k === front ? L6[ext ? 3 : 0] : k === back ? L6[2] : side(k)));
          if (!ext) Object.assign(d, { shape: Shape.Cube, flags: T, opacity: 15 });
        } else if (kind === K.Head) d.faces = [0, 1, 2, 3, 4, 5].map((k) => (k === front || k === back ? L6[st >= 6 ? 1 : 0] : side(k)));
        else if (kind === K.Observer) {
          d.faces = [0, 1, 2, 3, 4, 5].map((k) => (k === front ? L6[0] : k === back ? L6[st >= 6 ? 2 : 1] : side(k)));
          Object.assign(d, { shape: Shape.Cube, flags: T, opacity: 15 });
        } else {
          d.faces = [0, 1, 2, 3, 4, 5].map((k) => (k === front ? L6[f >= 4 ? 1 : 0] : side(k)));
          Object.assign(d, { shape: Shape.Cube, flags: T, opacity: 15 });
        }
        d.top = d.faces[2]; d.side = d.faces[0]; d.bottom = d.faces[3];
      }
      if (kind === K.Comparator) {
        const f = st & 3, sub = (st >> 2) & 1, on = st >= 8;
        top = texLayer(tex[(on ? 4 : 0) + ROT[f]]); side = bottom = texLayer(tex[8]);
        Object.assign(d, { top, side, bottom, alt: [top, texLayer(tex[on ? 9 : 10]), texLayer(tex[sub ? 9 : 10])] });
      }
      if (kind === K.Hopper) Object.assign(d, { top: texLayer(tex[1]), side: texLayer(tex[0]), bottom: texLayer(tex[0]) });
      BLOCKS[id] = d;
    }
    FAMS.push(fam); FAM[e.key] = fam;
  }
}
if (C.redstone_block) setRedstoneBlock(C.redstone_block);
export const modelOf = (id) => (BLOCKS[id] ? BLOCKS[id].model : null);
export const famOf = (id) => { const m = BLOCKS[id] && BLOCKS[id].model; return m ? FAMS[m.fam] : null; };

export const has = (id, f) => (BLOCKS[id].flags & f) !== 0;
export const isOpaque = (id) => (BLOCKS[id].flags & F.Opaque) !== 0;
export const isSolid = (id) => (BLOCKS[id].flags & F.Solid) !== 0;
export const layerFor = (d, face) => (d.faces ? d.faces[face] : face === 2 ? d.top : face === 3 ? d.bottom : d.side);

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
  if (LAYER_NAMES.indexOf(n) >= LAYER_NAMES.indexOf('Lava')) {
    // the Nether, End and stronghold layers have no counterpart in the Unity art: one Minecraft-style texture per block
    Object.assign(t, { tile: 1, normal: 1, rough: 1, macro: 0.05, tint: [1, 1, 1] });
    if (['Lava', 'Glowstone', 'Shroomlight'].includes(n)) t.emission = 4;
    if (n === 'Magma') t.emission = 1.5;
    if (n === 'NetherPortal') { t.emission = 3; t.cutout = 1; }
    if (n === 'EndPortal') t.emission = 3;
    if (['CrimsonFungus', 'WarpedFungus', 'CrimsonRoots', 'WarpedRoots', 'WeepingVines', 'TwistingVines', 'ChorusPlant', 'ChorusFlower'].includes(n)) { t.cutout = 1; t.trans = 0.5; }
    if (n === 'Obsidian') { t.rough = 0.35; t.spec = 1.5; }
  }
  if (n.startsWith('c:') || n === '_none') {
    // catalog textures: one Minecraft texture per block face, settings from the blocks that use them
    Object.assign(t, { tile: 1, normal: 1, rough: 1, macro: 0.04, tint: [1, 1, 1], spec: 1, emission: 0, trans: 0, biome: 0, cutout: 0, pom: 0.015 });
    for (const e of CATALOG.blocks) {
      if (e.top !== n.slice(2) && e.side !== n.slice(2) && e.bottom !== n.slice(2)) continue;
      if (e.shape === 'cross' || e.shape === 'leaves' || e.shape === 'clear' || e.shape === 'glass') { t.cutout = 1; t.pom = 0; }
      if (e.shape === 'cross' || e.shape === 'leaves') { t.trans = 0.7; t.macro = 0.15; }
      if (e.tint) t.biome = 1;
      if (e.emission) t.emission = e.emission / 4;
      if (e.cat === 'glass' || e.cat === 'metal') { t.rough = 0.4; t.spec = 1.4; }
      if (e.cat === 'ice') { t.rough = 0.15; t.spec = 1.5; }
      if (e.cat === 'wool') { t.rough = 1.3; t.spec = 0.4; t.pom = 0.008; }
    }
    const ti = CATALOG.texinfo && CATALOG.texinfo[n.slice(2)];
    if (ti) {
      if (ti.cutout) { t.cutout = 1; t.pom = 0; }
      if (ti.tint) t.biome = 1;
      if (ti.cat === 'plant' || ti.cat === 'leaves') { t.trans = 0.6; t.macro = 0.1; }
      if (ti.cat === 'metal' || ti.cat === 'glass') { t.rough = 0.4; t.spec = 1.4; }
    }
  }
  if (n === 'LeavesExt' || n === 'NeedlesExt') {
    const base = n === 'LeavesExt' ? 'Leaves' : 'Needles';
    Object.assign(t, { tile: 1, macro: 0.25, rough: 1.5, tint: n === 'LeavesExt' ? [0.62, 0.78, 0.48] : [1, 1, 1], biome: 1, cutout: 1, trans: base === 'Leaves' ? 0.9 : 0.5, spec: 0.3, emission: 0 });
  }
  return t;
});

// ---------------------------------------------------------------- items

export const I = {
  Stick: 256, Coal: 257, IronChunk: 258, GoldChunk: 259, Diamond: 260, Apple: 261, Berries: 262,
  WoodenPickaxe: 270, StonePickaxe: 271, IronPickaxe: 272, DiamondPickaxe: 273,
  WoodenAxe: 274, StoneAxe: 275, IronAxe: 276, DiamondAxe: 277,
  WoodenShovel: 278, StoneShovel: 279, IronShovel: 280, DiamondShovel: 281,
  Flint: 282, FlintAndSteel: 283, NetherQuartz: 284, GlowstoneDust: 285, EyeOfEnder: 286,
  RawCopper: 287, Emerald: 288, LapisLazuli: 289, Redstone: 290,
  Beef: 291, Porkchop: 292, Mutton: 293, RawChicken: 294, Feather: 295, Leather: 296, RottenFlesh: 297, Bone: 298, Arrow: 299,
  Gunpowder: 300, String: 301, GoldNugget: 302, BlazeRod: 303, GhastTear: 304, WoodenSword: 305, StoneSword: 306, IronSword: 307, DiamondSword: 308,
  IronIngot: 309, GoldIngot: 310, CopperIngot: 311, CookedBeef: 312, CookedPorkchop: 313, CookedMutton: 314, CookedChicken: 315, Charcoal: 316,
  Bread: 317, Wheat: 318, WheatSeeds: 319, WoodenHoe: 320, StoneHoe: 321, IronHoe: 322, DiamondHoe: 323,
  Bow: 340, Bucket: 341, WaterBucket: 342, LavaBucket: 343, SlimeBall: 344, Backpack: 345, GrapplingHook: 346, SlimeCrown: 347, SleepingBag: 348, FlameBlade: 349, BoneGreatsword: 350, CloudBottle: 351, BlazingCore: 352, BoneCrown: 353, StormTear: 354, Frostbrand: 355, FrozenHeart: 356,
  LeatherHelmet: 324,      // armour: 324 + material * 4 + piece (leather, golden, iron, diamond x helmet, chestplate, leggings, boots)
};
export const ARMOR_MATS = ['Leather', 'Golden', 'Iron', 'Diamond'], ARMOR_PIECES = ['Helmet', 'Chestplate', 'Leggings', 'Boots'];
export const Kind = { Block: 0, Material: 1, Tool: 2, Food: 3, Use: 4, Armor: 5 };   // Use: right-click items (flint and steel, eye of ender)
export const ToolType = { None: 0, Pickaxe: 1, Axe: 2, Shovel: 3, Sword: 4, Hoe: 5 };
export const Tier = { Hand: 0, Wood: 1, Stone: 2, Iron: 3, Diamond: 4 };

export const ITEMS = {};
const placeable = [B.Stone, B.Dirt, B.Grass, B.Sand, B.Gravel, B.Snow, B.Cobblestone, B.Planks, B.Bricks, B.OakLog, B.BirchLog, B.SpruceLog,
  B.JungleLog, B.OakLeaves, B.BirchLeaves, B.SpruceLeaves, B.JungleLeaves, B.Sandstone, B.RedSandstone, B.Mud, B.Moss, B.Ice, B.CoalOre,
  B.IronOre, B.GoldOre, B.DiamondOre, B.TallGrass, B.FlowerRed, B.FlowerYellow, B.DeadBush, B.Glowcap, B.Torch, B.Cactus, B.SnowyGrass,
  B.Obsidian, B.Netherrack, B.NetherQuartzOre, B.NetherGoldOre, B.Glowstone, B.SoulSand, B.SoulSoil, B.Basalt, B.Blackstone, B.Magma,
  B.NetherBricks, B.CrimsonNylium, B.WarpedNylium, B.CrimsonStem, B.WarpedStem, B.NetherWartBlock, B.WarpedWartBlock, B.Shroomlight,
  B.CrimsonFungus, B.WarpedFungus, B.CrimsonRoots, B.WarpedRoots, B.WeepingVines, B.TwistingVines, B.EndStone, B.EndStoneBricks, B.Purpur,
  B.EndPortalFrame, B.ChorusPlant, B.ChorusFlower, B.StoneBricks, B.MossyStoneBricks, B.CrackedStoneBricks];
for (const b of placeable) ITEMS[b] = { id: b, name: BLOCKS[b].name, kind: Kind.Block, stack: 64, block: b };
for (const k in C) { const b = C[k]; if (CAT[b].hard !== 'unbreakable' && !CAT[b].noitem) ITEMS[b] = { id: b, name: BLOCKS[b].name, kind: Kind.Block, stack: 64, block: b }; }
for (const f of FAMS) {
  if (f.kind === K.WallTorch || CATALOG.models[f.index].noitem) continue;
  const first = f.kind === K.Piston || f.kind === K.Bed ? f.first + 4 : f.kind === K.Observer || f.kind === K.Dispenser ? f.first + 2 : f.first;   // the icon state
  ITEMS[f.first] = { id: f.first, name: f.name, kind: Kind.Block, stack: f.kind === K.Bed ? 1 : 64, block: f.first, icon: first };
}
const mat = (id, name) => (ITEMS[id] = { id, name, kind: Kind.Material, stack: 64 });
const food = (id, name, f, sat) => (ITEMS[id] = { id, name, kind: Kind.Food, stack: 64, food: f, sat });
mat(I.Stick, 'Stick'); mat(I.Coal, 'Coal'); mat(I.IronChunk, 'Iron Chunk'); mat(I.GoldChunk, 'Gold Chunk'); mat(I.Diamond, 'Diamond');
food(I.Apple, 'Apple', 4, 2.4); food(I.Berries, 'Wild Berries', 2, 0.4);
for (const [k, n] of [['Feather', 'Feather'], ['Leather', 'Leather'], ['Bone', 'Bone'], ['Arrow', 'Arrow'], ['Gunpowder', 'Gunpowder'], ['String', 'String'],
  ['GoldNugget', 'Gold Nugget'], ['BlazeRod', 'Blaze Rod'], ['GhastTear', 'Ghast Tear']]) mat(I[k], n);
food(I.Beef, 'Raw Beef', 3, 1.8); food(I.Porkchop, 'Raw Porkchop', 3, 1.8); food(I.Mutton, 'Raw Mutton', 2, 1.2); food(I.RawChicken, 'Raw Chicken', 2, 1.2);
food(I.RottenFlesh, 'Rotten Flesh', 4, 0.8);
mat(I.RawCopper, 'Raw Copper'); mat(I.Emerald, 'Emerald'); mat(I.LapisLazuli, 'Lapis Lazuli'); mat(I.Redstone, 'Redstone Dust');
mat(I.Flint, 'Flint'); mat(I.NetherQuartz, 'Nether Quartz'); mat(I.GlowstoneDust, 'Glowstone Dust');
ITEMS[I.FlintAndSteel] = { id: I.FlintAndSteel, name: 'Flint and Steel', kind: Kind.Use, stack: 1, durability: 64 };
mat(I.IronIngot, 'Iron Ingot'); mat(I.GoldIngot, 'Gold Ingot'); mat(I.CopperIngot, 'Copper Ingot'); mat(I.Charcoal, 'Charcoal'); mat(I.Wheat, 'Wheat');
mat(I.WheatSeeds, 'Wheat Seeds');
food(I.CookedBeef, 'Steak', 8, 12.8); food(I.CookedPorkchop, 'Cooked Porkchop', 8, 12.8); food(I.CookedMutton, 'Cooked Mutton', 6, 9.6);
food(I.CookedChicken, 'Cooked Chicken', 6, 7.2); food(I.Bread, 'Bread', 5, 6);
// armour (Minecraft's defence points and durability)
ARMOR_MATS.forEach((m, mi) => ARMOR_PIECES.forEach((pc, pi) => {
  const id = I.LeatherHelmet + mi * 4 + pi;
  I[`${m}${pc}`] = id;
  const points = [[1, 3, 2, 1], [2, 5, 3, 1], [2, 6, 5, 2], [3, 8, 6, 3]][mi][pi];
  const dur = [55, 77, 165, 363][mi] * [11, 16, 15, 13][pi] / 11 | 0;
  ITEMS[id] = { id, name: `${m === 'Golden' ? 'Golden' : m} ${pc}`, kind: Kind.Armor, stack: 1, slot: pi, points, durability: dur };
}));
// items that place a block: redstone dust lays a wire, seeds plant wheat
if (FAM.redstone_wire) ITEMS[I.Redstone].places = FAM.redstone_wire.first;
if (FAM.wheat) ITEMS[I.WheatSeeds].places = FAM.wheat.first;
ITEMS[I.EyeOfEnder] = { id: I.EyeOfEnder, name: 'Eye of Ender', kind: Kind.Use, stack: 64 };
ITEMS[I.Bow] = { id: I.Bow, name: 'Bow', kind: Kind.Use, stack: 1, durability: 385 };
mat(I.SlimeBall, 'Slimeball');
ITEMS[I.Backpack] = { id: I.Backpack, name: 'Backpack', kind: Kind.Use, stack: 1 };
ITEMS[I.GrapplingHook] = { id: I.GrapplingHook, name: 'Grappling Hook', kind: Kind.Use, stack: 1, durability: 250 };
ITEMS[I.SlimeCrown] = { id: I.SlimeCrown, name: 'Slime Crown', kind: Kind.Use, stack: 1 };
ITEMS[I.SleepingBag] = { id: I.SleepingBag, name: 'Sleeping Bag', kind: Kind.Use, stack: 1 };
// boss rewards and summons (not in Minecraft)
ITEMS[I.FlameBlade] = { id: I.FlameBlade, name: 'Flame Blade', kind: Kind.Tool, stack: 1, tool: ToolType.Sword, tier: Tier.Diamond, durability: 2000, damage: 10, fire: true };
ITEMS[I.BoneGreatsword] = { id: I.BoneGreatsword, name: 'Bone Greatsword', kind: Kind.Tool, stack: 1, tool: ToolType.Sword, tier: Tier.Diamond, durability: 1600, damage: 13, heavy: true };
mat(I.CloudBottle, 'Cloud in a Bottle');
ITEMS[I.BlazingCore] = { id: I.BlazingCore, name: 'Blazing Core', kind: Kind.Use, stack: 1, summons: 'inferno_spirit' };
ITEMS[I.BoneCrown] = { id: I.BoneCrown, name: 'Bone Crown', kind: Kind.Use, stack: 1, summons: 'hollow_king' };
ITEMS[I.StormTear] = { id: I.StormTear, name: 'Storm Tear', kind: Kind.Use, stack: 1, summons: 'storm_ghast' };
ITEMS[I.Frostbrand] = { id: I.Frostbrand, name: 'Frostbrand', kind: Kind.Tool, stack: 1, tool: ToolType.Sword, tier: Tier.Diamond, durability: 1800, damage: 11, frost: true };
ITEMS[I.FrozenHeart] = { id: I.FrozenHeart, name: 'Frozen Heart', kind: Kind.Use, stack: 1, summons: 'frost_colossus' };
ITEMS[I.Bucket] = { id: I.Bucket, name: 'Bucket', kind: Kind.Use, stack: 16 };
ITEMS[I.WaterBucket] = { id: I.WaterBucket, name: 'Water Bucket', kind: Kind.Use, stack: 1 };
ITEMS[I.LavaBucket] = { id: I.LavaBucket, name: 'Lava Bucket', kind: Kind.Use, stack: 1 };
const tiers = [['Wooden', Tier.Wood, 60], ['Stone', Tier.Stone, 132], ['Iron', Tier.Iron, 251], ['Diamond', Tier.Diamond, 1562]];
tiers.forEach(([prefix, tier, dur], t) => {
  ITEMS[I.WoodenPickaxe + t] = { id: I.WoodenPickaxe + t, name: `${prefix} Pickaxe`, kind: Kind.Tool, stack: 1, tool: ToolType.Pickaxe, tier, durability: dur };
  ITEMS[I.WoodenAxe + t] = { id: I.WoodenAxe + t, name: `${prefix} Axe`, kind: Kind.Tool, stack: 1, tool: ToolType.Axe, tier, durability: dur };
  ITEMS[I.WoodenShovel + t] = { id: I.WoodenShovel + t, name: `${prefix} Shovel`, kind: Kind.Tool, stack: 1, tool: ToolType.Shovel, tier, durability: dur };
  ITEMS[I.WoodenSword + t] = { id: I.WoodenSword + t, name: `${prefix} Sword`, kind: Kind.Tool, stack: 1, tool: ToolType.Sword, tier, durability: dur, damage: 4 + t };
  ITEMS[I.WoodenHoe + t] = { id: I.WoodenHoe + t, name: `${prefix} Hoe`, kind: Kind.Tool, stack: 1, tool: ToolType.Hoe, tier, durability: dur };
});
export const itemName = (id) => (typeof id === 'string' ? GROUP_NAMES[id] || id : ITEMS[id] ? ITEMS[id].name : `Item ${id}`);

// ---------------------------------------------------------------- mining (Unity Gameplay.Mining)

export function mining(block) {
  switch (block) {
    case B.Stone: case B.Cobblestone: case B.Bricks: case B.Sandstone: case B.RedSandstone:
      return { hardness: 1.5, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.CoalOre: return { hardness: 3, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.IronOre: return { hardness: 3, tool: ToolType.Pickaxe, required: Tier.Stone };
    case B.GoldOre: case B.DiamondOre: return { hardness: 3, tool: ToolType.Pickaxe, required: Tier.Iron };
    case B.Ice: return { hardness: 0.5, tool: ToolType.Pickaxe, required: Tier.Hand };
    case B.OakLog: case B.BirchLog: case B.SpruceLog: case B.JungleLog: case B.Planks: case B.PropBarrier:
      return { hardness: 2, tool: ToolType.Axe, required: Tier.Hand };
    case B.Cactus: return { hardness: 0.4, tool: ToolType.None, required: Tier.Hand };
    case B.Dirt: case B.Grass: case B.SnowyGrass: case B.Sand: case B.Mud:
      return { hardness: 0.5, tool: ToolType.Shovel, required: Tier.Hand };
    case B.Gravel: return { hardness: 0.6, tool: ToolType.Shovel, required: Tier.Hand };
    case B.Snow: return { hardness: 0.2, tool: ToolType.Shovel, required: Tier.Hand };
    case B.Moss: return { hardness: 0.3, tool: ToolType.Shovel, required: Tier.Hand };
    case B.OakLeaves: case B.BirchLeaves: case B.SpruceLeaves: case B.JungleLeaves:
      return { hardness: 0.2, tool: ToolType.None, required: Tier.Hand };
    case B.Bedrock: case B.EndPortalFrame: case B.EndPortalFrameEye: case B.NetherPortalX: case B.NetherPortalZ: case B.EndPortal: case B.EndGateway:
      return { hardness: -1, tool: ToolType.None, required: Tier.Hand };
    case B.Obsidian: return { hardness: 50, tool: ToolType.Pickaxe, required: Tier.Diamond };
    case B.Netherrack: case B.CrimsonNylium: case B.WarpedNylium: return { hardness: 0.4, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.NetherQuartzOre: case B.NetherGoldOre: return { hardness: 3, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.Basalt: return { hardness: 1.25, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.Blackstone: case B.StoneBricks: case B.MossyStoneBricks: case B.CrackedStoneBricks: case B.Purpur:
      return { hardness: 1.5, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.NetherBricks: return { hardness: 2, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.EndStone: case B.EndStoneBricks: return { hardness: 3, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.Magma: return { hardness: 0.5, tool: ToolType.Pickaxe, required: Tier.Wood };
    case B.SoulSand: case B.SoulSoil: return { hardness: 0.5, tool: ToolType.Shovel, required: Tier.Hand };
    case B.Glowstone: return { hardness: 0.3, tool: ToolType.None, required: Tier.Hand };
    case B.CrimsonStem: case B.WarpedStem: return { hardness: 2, tool: ToolType.Axe, required: Tier.Hand };
    case B.ChorusPlant: case B.ChorusFlower: return { hardness: 0.4, tool: ToolType.Axe, required: Tier.Hand };
    case B.NetherWartBlock: case B.WarpedWartBlock: case B.Shroomlight: return { hardness: 1, tool: ToolType.None, required: Tier.Hand };
    default: {
      const fam = famOf(block);
      if (fam) {
        if ([K.Tall, K.Lily, K.WallTorch, K.Wire, K.RTorch, K.Lever, K.Repeater, K.Crop, K.Comparator].includes(fam.kind)) return { hardness: 0, tool: ToolType.None, required: Tier.Hand };
        if (fam.kind === K.Piston || fam.kind === K.Head) return { hardness: 1.5, tool: ToolType.Pickaxe, required: Tier.Hand };
        if (fam.kind === K.Bed) return { hardness: 0.2, tool: ToolType.None, required: Tier.Hand };
        if (fam.kind === K.Grave) return { hardness: 0.6, tool: ToolType.None, required: Tier.Hand };
        if (fam.kind === K.SkyPortal) return { hardness: -1, tool: ToolType.None, required: Tier.Hand };
        if (fam.kind === K.Ladder) return { hardness: 0.4, tool: ToolType.Axe, required: Tier.Hand };
        if (fam.kind === K.Snow) return { hardness: 0.1, tool: ToolType.Shovel, required: Tier.Hand };
        if (fam.kind === K.Carpet) return { hardness: 0.1, tool: ToolType.None, required: Tier.Hand };
        if (fam.mat) { const m = mining(fam.mat); return m.hardness < 0 ? { ...m, hardness: 2 } : m; }
        return catMining(fam.cat);
      }
      const e = CAT[block];
      if (!e) return { hardness: 0, tool: ToolType.None, required: Tier.Hand };
      if (e.hard === 'unbreakable') return { hardness: -1, tool: ToolType.None, required: Tier.Hand };
      if (e.hard === 'obsidian') return { hardness: 50, tool: ToolType.Pickaxe, required: Tier.Diamond };
      return catMining(e.cat, e);
    }
  }
}
function catMining(cat, e = {}) {
      switch (cat) {
        case 'stone': return { hardness: 1.5, tool: ToolType.Pickaxe, required: Tier.Wood };
        case 'metal': return { hardness: 5, tool: ToolType.Pickaxe, required: Tier.Stone };
        case 'ore': return { hardness: 3, tool: ToolType.Pickaxe, required: [Tier.Hand, Tier.Wood, Tier.Stone, Tier.Iron][e.tier || 1] };
        case 'dirt': case 'sand': return { hardness: 0.5, tool: ToolType.Shovel, required: Tier.Hand };
        case 'wood': return { hardness: 2, tool: ToolType.Axe, required: Tier.Hand };
        case 'wool': return { hardness: 0.8, tool: ToolType.None, required: Tier.Hand };
        case 'glass': return { hardness: 0.3, tool: ToolType.None, required: Tier.Hand };
        case 'ice': return { hardness: 0.5, tool: ToolType.Pickaxe, required: Tier.Hand };
        case 'leaves': return { hardness: 0.2, tool: ToolType.None, required: Tier.Hand };
        case 'plant_block': return { hardness: 0.5, tool: ToolType.None, required: Tier.Hand };
        default: return { hardness: 0, tool: ToolType.None, required: Tier.Hand };
      }
}
// footstep / breaking sound family for the catalog
export const catSurface = (block) => (CAT[block] ? CAT[block].cat : famOf(block) ? famOf(block).cat : null);
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
    case B.Gravel: return rnd < 0.1 ? [[I.Flint, 1]] : [[B.Gravel, 1]];
    case B.NetherQuartzOre: return [[I.NetherQuartz, 1 + (rnd < 0.2 ? 1 : 0)]];
    case B.NetherGoldOre: return [[I.GoldChunk, 1]];
    case B.Glowstone: return [[I.GlowstoneDust, 2 + Math.floor(rnd * 3)]];
    case B.CrimsonNylium: case B.WarpedNylium: return [[B.Netherrack, 1]];
    case B.ChorusPlant: return [];
    case B.WeepingVines: case B.TwistingVines: return rnd < 0.33 ? [[block, 1]] : [];
    case B.PropBarrier: return [[B.OakLog, 3]];   // dead wood yields logs
    case B.OakLeaves: case B.JungleLeaves: return rnd < 0.06 ? [[I.Apple, 1]] : rnd < 0.14 ? [[I.Stick, 1]] : [];
    case B.BirchLeaves: case B.SpruceLeaves: return rnd < 0.1 ? [[I.Stick, 1]] : [];
    case B.TallGrass: return rnd < 0.12 ? [[I.Berries, 1]] : rnd < 0.25 ? [[I.WheatSeeds, 1]] : [];
    case B.DeadBush: return rnd < 0.5 ? [[I.Stick, 1]] : [];
    default: {
      const fam = famOf(block);
      if (fam) {
        const st = BLOCKS[block].model.state;
        if (fam.kind === K.WallTorch) return [[B.Torch, 1]];
        if (fam.kind === K.Wire) return [[I.Redstone, 1]];
        if (fam.kind === K.Head) return [];
        if (fam.kind === K.Piston) return [[fam.first, 1]];
        if (fam.kind === K.Bed) return st & 1 ? [] : [[fam.first, 1]];
        if (fam.kind === K.Crop) return st === 7 ? [[I.Wheat, 1], [I.WheatSeeds, 1 + Math.floor(rnd * 3)]] : [[I.WheatSeeds, 1]];
        if (fam.kind === K.Slab && st === 2) return [[fam.first, 2]];
        if ((fam.kind === K.Door || fam.kind === K.Tall || fam.kind === K.Waystone) && (st & 1)) return [];
        if (fam.kind === K.Grave) return [];
        if (fam.kind === K.Tall && BLOCKS[block].flags & F.Replaceable) return [];
        if (fam.kind === K.Snow) return [[fam.first, st + 1]];
        return [[fam.first, 1]];
      }
      const e = CAT[block];
      if (e) {
        if (e.cat === 'glass' && e.key !== 'sea_lantern' && !e.key.endsWith('froglight') && e.key !== 'redstone_lamp') return [];
        if (e.cat === 'leaves') { const sap = C[e.key.replace('_leaves', '_sapling')]; return rnd < 0.05 && sap ? [[sap, 1]] : rnd < 0.1 ? [[I.Stick, 1]] : []; }
        if (e.cat === 'ore') {
          const k = e.key.replace('deepslate_', '').replace('_ore', '');
          const out = { coal: I.Coal, iron: I.IronChunk, copper: I.RawCopper, gold: I.GoldChunk, redstone: I.Redstone, emerald: I.Emerald, lapis: I.LapisLazuli, diamond: I.Diamond }[k];
          const n = k === 'lapis' ? 4 + Math.floor(rnd * 5) : k === 'redstone' ? 4 + Math.floor(rnd * 2) : k === 'copper' ? 2 + Math.floor(rnd * 4) : 1;
          return out ? [[out, n]] : [];
        }
        if (e.key === 'deepslate') return [[C.cobbled_deepslate, 1]];
        if (e.key === 'lit_furnace') return [[C.furnace, 1]];
        if (e.key === 'lit_redstone_lamp') return [[C.redstone_lamp, 1]];
      }
      return ITEMS[block] ? [[block, 1]] : [];
    }
  }
}

// ---------------------------------------------------------------- recipes (Unity Recipes, shapeless)

export const RECIPES = [];
/** Ingredient groups: a recipe input may name one ('planks') and take any of its members. */
export const GROUPS = {
  planks: [B.Planks, ...['spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'bamboo', 'crimson', 'warped'].map((w) => C[`${w}_planks`]).filter(Boolean)],
  logs: [B.OakLog, B.BirchLog, B.SpruceLog, B.JungleLog, B.CrimsonStem, B.WarpedStem, ...['acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak'].map((w) => C[`${w}_log`]).filter(Boolean)],
  wool: ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'].map((c) => C[`${c}_wool`]).filter(Boolean),
  stone: [B.Cobblestone, C.cobbled_deepslate, B.Blackstone].filter(Boolean),
  coal: [I.Coal, I.Charcoal],
};
export const GROUP_NAMES = { planks: 'Any Planks', logs: 'Any Logs', wool: 'Any Wool', stone: 'Cobblestone', coal: 'Coal' };
export const groupMembers = (item) => (typeof item === 'string' ? GROUPS[item] || [] : [item]);
const recipe = (out, count, inputs) => {
  const n = inputs.reduce((a, [, k]) => a + k, 0);
  RECIPES.push({ out, count, inputs, name: itemName(out), table: n > 4 });    // up to four items fit the 2x2 grid of the inventory
};
recipe(B.Planks, 4, [[B.OakLog, 1]]);
for (const [log, pl] of [[B.BirchLog, 'birch'], [B.SpruceLog, 'spruce'], [B.JungleLog, 'jungle'], [B.CrimsonStem, 'crimson'], [B.WarpedStem, 'warped']]) recipe(C[`${pl}_planks`] || B.Planks, 4, [[log, 1]]);
recipe(I.Stick, 4, [['planks', 2]]);
recipe(B.Torch, 4, [['coal', 1], [I.Stick, 1]]);
if (C.crafting_table) recipe(C.crafting_table, 1, [['planks', 4]]);
if (C.furnace) recipe(C.furnace, 1, [['stone', 8]]);
if (C.chest) recipe(C.chest, 1, [['planks', 8]]);
if (C.barrel) recipe(C.barrel, 1, [['planks', 6], [I.Stick, 2]]);
for (const c of ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'])
  if (FAM[`${c}_bed`] && C[`${c}_wool`]) recipe(FAM[`${c}_bed`].first, 1, [[C[`${c}_wool`], 3], ['planks', 3]]);
recipe(I.Bow, 1, [[I.Stick, 3], [I.String, 3]]);
recipe(I.Arrow, 4, [[I.Flint, 1], [I.Stick, 1], [I.Feather, 1]]);
recipe(I.Bucket, 1, [[I.IronIngot, 3]]);
recipe(I.Backpack, 1, [[I.Leather, 6], [I.String, 2]]);
recipe(I.GrapplingHook, 1, [[I.IronIngot, 3], [I.String, 4]]);
recipe(I.SlimeCrown, 1, [[I.SlimeBall, 20], [I.GoldIngot, 5]]);
recipe(I.SleepingBag, 1, [['wool', 3], [I.Leather, 2]]);
recipe(I.BlazingCore, 1, [[I.BlazeRod, 4], [I.GoldIngot, 4]]);
recipe(I.BoneCrown, 1, [[I.Bone, 12], [I.Coal, 4], [I.GoldIngot, 1]]);
recipe(I.StormTear, 1, [[I.GhastTear, 2], [I.GlowstoneDust, 6]]);
if (C.packed_ice) recipe(I.FrozenHeart, 1, [[C.packed_ice, 4], [I.Diamond, 1]]);
if (FAM.waystone) recipe(FAM.waystone.first, 1, [[B.StoneBricks, 6], [I.GoldIngot, 2]]);
recipe(I.Bread, 1, [[I.Wheat, 3]]);
if (C.hay_block) recipe(C.hay_block, 1, [[I.Wheat, 9]]);
recipe(I.IronIngot, 9, [[C.iron_block, 1]]);
recipe(I.GoldIngot, 1, [[I.GoldNugget, 9]]);
// redstone
if (FAM.redstone_torch) recipe(FAM.redstone_torch.first, 1, [[I.Redstone, 1], [I.Stick, 1]]);
if (FAM.lever) recipe(FAM.lever.first, 1, [[I.Stick, 1], ['stone', 1]]);
if (FAM.repeater) recipe(FAM.repeater.first, 1, [[FAM.redstone_torch.first, 2], [I.Redstone, 1], [B.Stone, 3]]);
if (C.redstone_lamp) recipe(C.redstone_lamp, 1, [[I.Redstone, 4], [B.Glowstone, 1]]);
if (FAM.piston) recipe(FAM.piston.first, 1, [['planks', 3], ['stone', 4], [I.IronIngot, 1], [I.Redstone, 1]]);
if (FAM.sticky_piston) recipe(FAM.sticky_piston.first, 1, [[FAM.piston.first, 1], [I.SlimeBall, 1]]);
if (C.slime_block) { recipe(C.slime_block, 1, [[I.SlimeBall, 9]]); recipe(I.SlimeBall, 9, [[C.slime_block, 1]]); }
if (C.tnt) recipe(C.tnt, 1, [[I.Gunpowder, 5], [B.Sand, 4]]);
if (C.note_block) recipe(C.note_block, 1, [['planks', 8], [I.Redstone, 1]]);
if (FAM.comparator) recipe(FAM.comparator.first, 1, [[FAM.redstone_torch.first, 3], [I.NetherQuartz, 1], [B.Stone, 3]]);
if (FAM.observer) recipe(FAM.observer.first, 1, [['stone', 6], [I.Redstone, 2], [I.NetherQuartz, 1]]);
if (FAM.dispenser) recipe(FAM.dispenser.first, 1, [['stone', 7], [I.Redstone, 1], [I.Bow, 1]]);
if (FAM.dropper) recipe(FAM.dropper.first, 1, [['stone', 7], [I.Redstone, 1]]);
if (FAM.hopper && C.chest) recipe(FAM.hopper.first, 1, [[I.IronIngot, 5], [C.chest, 1]]);
recipe(B.Sandstone, 1, [[B.Sand, 4]]);
recipe(B.Bricks, 1, [[B.Cobblestone, 2], [B.Sand, 2]]);
recipe(I.FlintAndSteel, 1, [[I.IronChunk, 1], [I.Flint, 1]]);
recipe(I.EyeOfEnder, 1, [[I.NetherQuartz, 2], [I.GlowstoneDust, 1]]);
recipe(B.Glowstone, 1, [[I.GlowstoneDust, 4]]);
recipe(B.StoneBricks, 4, [[B.Cobblestone, 4]]);
recipe(B.NetherBricks, 1, [[B.Netherrack, 4]]);
recipe(B.EndStoneBricks, 4, [[B.EndStone, 4]]);
recipe(B.Planks, 4, [[B.CrimsonStem, 1]]);
for (const w of ['acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak']) if (C[`${w}_log`] && C[`${w}_planks`]) recipe(C[`${w}_planks`], 4, [[C[`${w}_log`], 1]]);
for (const [block, item] of [['iron_block', I.IronIngot], ['gold_block', I.GoldIngot], ['copper_block', I.CopperIngot], ['raw_iron_block', I.IronChunk], ['raw_gold_block', I.GoldChunk], ['diamond_block', I.Diamond], ['emerald_block', I.Emerald],
  ['lapis_block', I.LapisLazuli], ['redstone_block', I.Redstone], ['coal_block', I.Coal], ['raw_copper_block', I.RawCopper]]) if (C[block]) recipe(C[block], 1, [[item, 9]]);

if (C.polished_granite) recipe(C.polished_granite, 4, [[C.granite, 4]]);
if (C.polished_diorite) recipe(C.polished_diorite, 4, [[C.diorite, 4]]);
if (C.polished_andesite) recipe(C.polished_andesite, 4, [[C.andesite, 4]]);

for (const f of FAMS) {
  const m = f.mat;
  switch (f.kind) {
    case K.Stairs: recipe(f.first, 4, [[m, 6]]); break;
    case K.Slab: recipe(f.first, 6, [[m, 3]]); break;
    case K.Wall: recipe(f.first, 6, [[m, 6]]); break;
    case K.Fence: recipe(f.first, 3, [[m, 4], [I.Stick, 2]]); break;
    case K.Gate: recipe(f.first, 1, [[m, 2], [I.Stick, 4]]); break;
    case K.Carpet: recipe(f.first, 3, [[m, 2]]); break;
    case K.Plate: recipe(f.first, 1, [[m, 2]]); break;
    case K.Button: recipe(f.first, 1, [[m, 1]]); break;
    case K.Snow: recipe(f.first, 6, [[m, 3]]); break;
  }
}
const woodOf = (key) => { const w = key.replace(/_(door|trapdoor)$/, ''); return w === 'oak' ? B.Planks : C[`${w}_planks`]; };
for (const f of FAMS) {
  if (f.kind === K.Door || f.kind === K.Trapdoor) {
    const wood = woodOf(f.key), metal = f.key.startsWith('iron') ? I.IronIngot : f.key.includes('copper') ? I.CopperIngot : 0;
    const m = wood || metal;
    if (m) recipe(f.first, f.kind === K.Door ? 3 : 2, [[m, f.kind === K.Door ? 6 : metal ? 4 : 6]]);
  }
  if (f.key === 'glass_pane' && C.glass) recipe(f.first, 16, [[C.glass, 6]]);
  if (f.key.endsWith('stained_glass_pane') && C[f.key.replace('_pane', '')]) recipe(f.first, 16, [[C[f.key.replace('_pane', '')], 6]]);
  if (f.key === 'iron_bars') recipe(f.first, 16, [[I.IronIngot, 6]]);
  if (f.key === 'ladder') recipe(f.first, 3, [[I.Stick, 7]]);
  if (f.kind === K.Rail) recipe(f.first, 16, [[I.IronIngot, 6], [I.Stick, 1]]);
  if (f.key === 'dirt_path') recipe(f.first, 1, [[B.Dirt, 1]]);
  if (f.key === 'farmland') recipe(f.first, 1, [[B.Dirt, 1]]);
}
const toolMats = ['planks', 'stone', I.IronIngot, I.Diamond];
toolMats.forEach((m, t) => {
  recipe(I.WoodenPickaxe + t, 1, [[m, 3], [I.Stick, 2]]);
  recipe(I.WoodenAxe + t, 1, [[m, 3], [I.Stick, 2]]);
  recipe(I.WoodenShovel + t, 1, [[m, 1], [I.Stick, 2]]);
  recipe(I.WoodenSword + t, 1, [[m, 2], [I.Stick, 1]]);
  recipe(I.WoodenHoe + t, 1, [[m, 2], [I.Stick, 2]]);
  if (t >= 2 || t === 0) {
    const mi = t === 0 ? 0 : t === 2 ? 2 : 3, mm = t === 0 ? I.Leather : m;
    [5, 8, 7, 4].forEach((n, pi) => recipe(I.LeatherHelmet + mi * 4 + pi, 1, [[mm, n]]));
  }
});

/** Furnace recipes: input -> [output, count]. */
export const SMELT = new Map([[I.IronChunk, [I.IronIngot, 1]], [I.GoldChunk, [I.GoldIngot, 1]], [I.RawCopper, [I.CopperIngot, 1]],
  [I.Beef, [I.CookedBeef, 1]], [I.Porkchop, [I.CookedPorkchop, 1]], [I.Mutton, [I.CookedMutton, 1]], [I.RawChicken, [I.CookedChicken, 1]],
  [B.Sand, [C.glass, 1]], [C.red_sand, [C.glass, 1]], [B.Cobblestone, [B.Stone, 1]], [B.Stone, [C.smooth_stone, 1]], [C.clay, [C.terracotta, 1]],
  [C.cobbled_deepslate, [C.deepslate, 1]], [C.wet_sponge, [C.sponge, 1]], [B.Netherrack, [B.NetherBricks, 1]], [B.StoneBricks, [B.CrackedStoneBricks, 1]],
  [B.IronOre, [I.IronIngot, 1]], [B.GoldOre, [I.GoldIngot, 1]], [B.Cactus, [C.green_concrete_powder, 1]],
  ...GROUPS.logs.map((l) => [l, [I.Charcoal, 1]])].filter(([a, b]) => a && b[0]));
/** Furnace fuel: burn time in seconds (one item takes 10 s). */
export function fuelTime(item) {
  if (item === I.Coal || item === I.Charcoal) return 80;
  if (item === I.BlazeRod) return 120;
  if (item === C.coal_block) return 800;
  if (GROUPS.planks.includes(item) || GROUPS.logs.includes(item)) return 15;
  if (item === I.Stick) return 5;
  if (ITEMS[item] && ITEMS[item].kind === Kind.Tool && ITEMS[item].tier === Tier.Wood) return 10;
  const f = famOf(item);
  if (f && f.cat === 'wood') return 15;
  if (CAT[item] && CAT[item].cat === 'wood') return 15;
  return 0;
}
// golden armour
[5, 8, 7, 4].forEach((n, pi) => recipe(I.LeatherHelmet + 4 + pi, 1, [[I.GoldIngot, n]]));
