namespace Voxelwild.World
{
    /// <summary>Numeric block ids stored in voxel arrays. Append only: ids are persisted in saves.</summary>
    public static class BlockId
    {
        public const ushort Air = 0;
        public const ushort Stone = 1;
        public const ushort Dirt = 2;
        public const ushort Grass = 3;
        public const ushort Sand = 4;
        public const ushort Gravel = 5;
        public const ushort Snow = 6;
        public const ushort Bedrock = 7;
        public const ushort Water = 8;
        public const ushort Cobblestone = 9;
        public const ushort Planks = 10;
        public const ushort Bricks = 11;
        // --- Phase 2
        public const ushort OakLog = 12;
        public const ushort BirchLog = 13;
        public const ushort SpruceLog = 14;
        public const ushort JungleLog = 15;
        public const ushort OakLeaves = 16;
        public const ushort BirchLeaves = 17;
        public const ushort SpruceLeaves = 18;
        public const ushort JungleLeaves = 19;
        public const ushort Sandstone = 20;
        public const ushort RedSandstone = 21;
        public const ushort Mud = 22;
        public const ushort Moss = 23;
        public const ushort Ice = 24;
        public const ushort CoalOre = 25;
        public const ushort IronOre = 26;
        public const ushort GoldOre = 27;
        public const ushort DiamondOre = 28;
        public const ushort TallGrass = 29;
        public const ushort FlowerRed = 30;
        public const ushort FlowerYellow = 31;
        public const ushort DeadBush = 32;
        public const ushort Glowcap = 33;
        public const ushort Torch = 34;
        public const ushort Cactus = 35;
        public const ushort SnowyGrass = 36;
        // --- Phase 3
        /// <summary>Invisible solid cell inside a prop (dead-tree trunks, fallen logs): cell-sized collision,
        /// no mesh, no light blocking. Breaking it removes the prop.</summary>
        public const ushort PropBarrier = 37;
        // --- Phase 5: flowing water, one id per level (1 weakest .. 7 strongest). Water (8) is a source, level 8.
        public const ushort FlowingWater1 = 38;
        public const ushort FlowingWater7 = 44;

        public const int Count = 45;

        public static bool IsWater(ushort id) => id == Water || (id >= FlowingWater1 && id <= FlowingWater7);

        /// <summary>8 for a source, 1..7 for flowing water, 0 for anything else.</summary>
        public static int WaterLevel(ushort id) =>
            id == Water ? 8 : id >= FlowingWater1 && id <= FlowingWater7 ? id - FlowingWater1 + 1 : 0;

        /// <summary>The flowing-water block for a level 1..7 (8 gives a source).</summary>
        public static ushort WaterOfLevel(int level) =>
            level >= 8 ? Water : level <= 0 ? Air : (ushort)(FlowingWater1 + level - 1);
    }

    /// <summary>
    /// Layers of the terrain Texture2DArrays. Order must match SourceArt/Textures/block_layers.json
    /// (verified by an EditMode test).
    /// </summary>
    public enum TextureLayer : byte
    {
        Stone = 0,
        Dirt = 1,
        GrassTop = 2,
        Sand = 3,
        Gravel = 4,
        Snow = 5,
        Bedrock = 6,
        Cobblestone = 7,
        Planks = 8,
        Bricks = 9,
        OakLog = 10,
        BirchLog = 11,
        SpruceLog = 12,
        JungleLog = 13,
        LogTop = 14,
        Leaves = 15,
        Needles = 16,
        Sandstone = 17,
        RedSandstone = 18,
        Mud = 19,
        Moss = 20,
        Ice = 21,
        CoalOre = 22,
        IronOre = 23,
        GoldOre = 24,
        DiamondOre = 25,
        GrassTuft = 26,
        FlowerRed = 27,
        FlowerYellow = 28,
        DeadBush = 29,
        Glowcap = 30,
        Torch = 31,
        TorchTop = 32,
        Cactus = 33,
        CactusTop = 34,

        None = 255,
    }
}
