using System;
using Voxelwild.World;

namespace Voxelwild.Gameplay
{
    public enum ItemKind : byte { Block, Material, Tool, Food }
    public enum ToolType : byte { None, Pickaxe, Axe, Shovel }

    /// <summary>Tool tiers; a block's required tier must be reached to harvest it.</summary>
    public enum ToolTier : byte { Hand, Wood, Stone, Iron, Diamond }

    public struct ItemDefinition
    {
        public ushort Id;
        public string Name;
        public ItemKind Kind;
        public int MaxStack;
        /// <summary>For block items: the block placed.</summary>
        public ushort Block;
        public ToolType Tool;
        public ToolTier Tier;
        public int Durability;
        /// <summary>Hunger restored when eaten.</summary>
        public int Food;
        public float Saturation;
    }

    /// <summary>
    /// Every item. Block items share their block's id (below 256), so a block drops "itself" without a lookup;
    /// other items start at 256. Append only: ids are stored in saves.
    /// </summary>
    public static class ItemId
    {
        public const ushort None = 0;
        public const ushort Stick = 256;
        public const ushort Coal = 257;
        public const ushort IronChunk = 258;
        public const ushort GoldChunk = 259;
        public const ushort Diamond = 260;
        public const ushort Apple = 261;
        public const ushort Berries = 262;
        public const ushort WoodenPickaxe = 270;
        public const ushort StonePickaxe = 271;
        public const ushort IronPickaxe = 272;
        public const ushort DiamondPickaxe = 273;
        public const ushort WoodenAxe = 274;
        public const ushort StoneAxe = 275;
        public const ushort IronAxe = 276;
        public const ushort DiamondAxe = 277;
        public const ushort WoodenShovel = 278;
        public const ushort StoneShovel = 279;
        public const ushort IronShovel = 280;
        public const ushort DiamondShovel = 281;
    }

    public static class ItemRegistry
    {
        public const int MaxItemId = 512;
        static readonly ItemDefinition[] Items = Build();

        static ItemDefinition[] Build()
        {
            var items = new ItemDefinition[MaxItemId];
            // block items: every block a player can hold
            foreach (ushort b in new[]
            {
                BlockId.Stone, BlockId.Dirt, BlockId.Grass, BlockId.Sand, BlockId.Gravel, BlockId.Snow, BlockId.Cobblestone,
                BlockId.Planks, BlockId.Bricks, BlockId.OakLog, BlockId.BirchLog, BlockId.SpruceLog, BlockId.JungleLog,
                BlockId.OakLeaves, BlockId.BirchLeaves, BlockId.SpruceLeaves, BlockId.JungleLeaves, BlockId.Sandstone,
                BlockId.RedSandstone, BlockId.Mud, BlockId.Moss, BlockId.Ice, BlockId.CoalOre, BlockId.IronOre, BlockId.GoldOre,
                BlockId.DiamondOre, BlockId.TallGrass, BlockId.FlowerRed, BlockId.FlowerYellow, BlockId.DeadBush, BlockId.Glowcap,
                BlockId.Torch, BlockId.Cactus, BlockId.SnowyGrass,
            })
                items[b] = new ItemDefinition { Id = b, Name = BlockRegistry.Name(b), Kind = ItemKind.Block, MaxStack = 64, Block = b };

            void Material(ushort id, string name) => items[id] = new ItemDefinition { Id = id, Name = name, Kind = ItemKind.Material, MaxStack = 64 };
            void Food(ushort id, string name, int food, float sat) =>
                items[id] = new ItemDefinition { Id = id, Name = name, Kind = ItemKind.Food, MaxStack = 64, Food = food, Saturation = sat };
            void Tool(ushort id, string name, ToolType type, ToolTier tier, int durability) =>
                items[id] = new ItemDefinition { Id = id, Name = name, Kind = ItemKind.Tool, MaxStack = 1, Tool = type, Tier = tier, Durability = durability };

            Material(ItemId.Stick, "Stick");
            Material(ItemId.Coal, "Coal");
            Material(ItemId.IronChunk, "Iron Chunk");
            Material(ItemId.GoldChunk, "Gold Chunk");
            Material(ItemId.Diamond, "Diamond");
            Food(ItemId.Apple, "Apple", 4, 2.4f);
            Food(ItemId.Berries, "Wild Berries", 2, 0.4f);
            var tiers = new[] { ("Wooden", ToolTier.Wood, 60), ("Stone", ToolTier.Stone, 132), ("Iron", ToolTier.Iron, 251), ("Diamond", ToolTier.Diamond, 1562) };
            for (int t = 0; t < 4; t++)
            {
                var (prefix, tier, dur) = tiers[t];
                Tool((ushort)(ItemId.WoodenPickaxe + t), prefix + " Pickaxe", ToolType.Pickaxe, tier, dur);
                Tool((ushort)(ItemId.WoodenAxe + t), prefix + " Axe", ToolType.Axe, tier, dur);
                Tool((ushort)(ItemId.WoodenShovel + t), prefix + " Shovel", ToolType.Shovel, tier, dur);
            }
            return items;
        }

        public static bool Exists(ushort id) => id != 0 && id < MaxItemId && Items[id].Id == id;
        public static ItemDefinition Get(ushort id) => id < MaxItemId ? Items[id] : default;
        public static string Name(ushort id) => Exists(id) ? Items[id].Name : $"Unknown({id})";

        public static ushort ForBlock(ushort block) => Exists(block) && Items[block].Kind == ItemKind.Block ? block : ItemId.None;

        public static System.Collections.Generic.IEnumerable<ItemDefinition> All
        {
            get
            {
                foreach (var i in Items) if (i.Id != 0) yield return i;
            }
        }
    }

    /// <summary>How hard each block is, which tool suits it and what it takes to harvest.</summary>
    public struct BlockMining
    {
        /// <summary>Seconds to break by hand when harvestable; 0 = instant; negative = unbreakable.</summary>
        public float Hardness;
        public ToolType Tool;
        /// <summary>Lowest tier that makes the block drop anything.</summary>
        public ToolTier Required;
    }

    public static class Mining
    {
        public static BlockMining For(ushort block)
        {
            switch (block)
            {
                case BlockId.Stone: case BlockId.Cobblestone: case BlockId.Bricks: case BlockId.Sandstone: case BlockId.RedSandstone:
                    return new BlockMining { Hardness = 1.5f, Tool = ToolType.Pickaxe, Required = ToolTier.Wood };
                case BlockId.CoalOre: return new BlockMining { Hardness = 3f, Tool = ToolType.Pickaxe, Required = ToolTier.Wood };
                case BlockId.IronOre: return new BlockMining { Hardness = 3f, Tool = ToolType.Pickaxe, Required = ToolTier.Stone };
                case BlockId.GoldOre: case BlockId.DiamondOre:
                    return new BlockMining { Hardness = 3f, Tool = ToolType.Pickaxe, Required = ToolTier.Iron };
                case BlockId.Ice: return new BlockMining { Hardness = 0.5f, Tool = ToolType.Pickaxe, Required = ToolTier.Hand };
                case BlockId.OakLog: case BlockId.BirchLog: case BlockId.SpruceLog: case BlockId.JungleLog: case BlockId.Planks:
                case BlockId.PropBarrier:
                    return new BlockMining { Hardness = 2f, Tool = ToolType.Axe, Required = ToolTier.Hand };
                case BlockId.Cactus: return new BlockMining { Hardness = 0.4f, Tool = ToolType.None, Required = ToolTier.Hand };
                case BlockId.Dirt: case BlockId.Grass: case BlockId.SnowyGrass: case BlockId.Sand: case BlockId.Mud:
                    return new BlockMining { Hardness = 0.5f, Tool = ToolType.Shovel, Required = ToolTier.Hand };
                case BlockId.Gravel: return new BlockMining { Hardness = 0.6f, Tool = ToolType.Shovel, Required = ToolTier.Hand };
                case BlockId.Snow: return new BlockMining { Hardness = 0.2f, Tool = ToolType.Shovel, Required = ToolTier.Hand };
                case BlockId.Moss: return new BlockMining { Hardness = 0.3f, Tool = ToolType.Shovel, Required = ToolTier.Hand };
                case BlockId.OakLeaves: case BlockId.BirchLeaves: case BlockId.SpruceLeaves: case BlockId.JungleLeaves:
                    return new BlockMining { Hardness = 0.2f, Tool = ToolType.None, Required = ToolTier.Hand };
                case BlockId.Bedrock: return new BlockMining { Hardness = -1f };
                default: return new BlockMining { Hardness = 0f, Tool = ToolType.None, Required = ToolTier.Hand };   // plants, torches
            }
        }

        public static float ToolSpeed(ToolTier tier) => tier switch
        {
            ToolTier.Wood => 2f,
            ToolTier.Stone => 4f,
            ToolTier.Iron => 6f,
            ToolTier.Diamond => 8f,
            _ => 1f,
        };

        public static bool CanHarvest(ushort block, in ItemDefinition held)
        {
            var m = For(block);
            if (m.Hardness < 0f) return false;
            if (m.Required == ToolTier.Hand) return true;
            return held.Kind == ItemKind.Tool && held.Tool == m.Tool && held.Tier >= m.Required;
        }

        /// <summary>Seconds to break a block with the held item (survival). Infinity for unbreakable.</summary>
        public static float BreakSeconds(ushort block, in ItemDefinition held)
        {
            var m = For(block);
            if (m.Hardness < 0f) return float.PositiveInfinity;
            if (m.Hardness == 0f) return 0f;
            float t = m.Hardness * (CanHarvest(block, held) ? 1.5f : 5f);
            if (held.Kind == ItemKind.Tool && held.Tool == m.Tool && m.Tool != ToolType.None) t /= ToolSpeed(held.Tier);
            return t;
        }
    }

    public struct ItemStack
    {
        public ushort Item;
        public int Count;
        /// <summary>Uses left for tools; 0 for everything else.</summary>
        public int Durability;

        public bool IsEmpty => Item == ItemId.None || Count <= 0;
        public static ItemStack Of(ushort item, int count = 1) =>
            new ItemStack { Item = item, Count = count, Durability = ItemRegistry.Get(item).Durability };
        public override string ToString() => IsEmpty ? "empty" : $"{Count} x {ItemRegistry.Name(Item)}";
    }

    public static class Drops
    {
        /// <summary>
        /// What breaking <paramref name="block"/> with <paramref name="held"/> yields. <paramref name="roll"/> is a
        /// uniform random number in [0, 1) for chance drops.
        /// </summary>
        public static ItemStack For(ushort block, in ItemDefinition held, double roll)
        {
            if (!Mining.CanHarvest(block, held)) return default;
            switch (block)
            {
                case BlockId.Grass: case BlockId.SnowyGrass: return ItemStack.Of(BlockId.Dirt);
                case BlockId.Stone: return ItemStack.Of(BlockId.Cobblestone);
                case BlockId.CoalOre: return ItemStack.Of(ItemId.Coal);
                case BlockId.IronOre: return ItemStack.Of(ItemId.IronChunk);
                case BlockId.GoldOre: return ItemStack.Of(ItemId.GoldChunk);
                case BlockId.DiamondOre: return ItemStack.Of(ItemId.Diamond);
                case BlockId.OakLeaves: case BlockId.JungleLeaves: return roll < 0.06 ? ItemStack.Of(ItemId.Apple) : default;
                case BlockId.BirchLeaves: case BlockId.SpruceLeaves: return roll < 0.03 ? ItemStack.Of(ItemId.Stick) : default;
                case BlockId.TallGrass: return roll < 0.12 ? ItemStack.Of(ItemId.Berries) : default;
                case BlockId.DeadBush: return roll < 0.5 ? ItemStack.Of(ItemId.Stick) : default;
                case BlockId.Ice: return default;
                case BlockId.PropBarrier: return ItemStack.Of(BlockId.OakLog, 3);    // dead wood yields logs
                default:
                    ushort item = ItemRegistry.ForBlock(block);
                    return item != ItemId.None ? ItemStack.Of(item) : default;
            }
        }
    }
}
