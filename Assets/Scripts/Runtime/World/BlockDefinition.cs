using System;
using Unity.Collections;

namespace Voxelwild.World
{
    [Flags]
    public enum BlockFlags : byte
    {
        None = 0,
        /// <summary>Collides with bodies.</summary>
        Solid = 1 << 0,
        /// <summary>Full cube that hides neighbouring faces and contributes voxel AO.</summary>
        Opaque = 1 << 1,
        Liquid = 1 << 2,
        /// <summary>Placing a block into this cell overwrites it (air, water, plants).</summary>
        Replaceable = 1 << 3,
        /// <summary>Can be broken by the player.</summary>
        Breakable = 1 << 4,
        /// <summary>Breaks when the block below is removed (plants, torches).</summary>
        NeedsSupport = 1 << 5,
    }

    public enum RenderShape : byte
    {
        None = 0,
        /// <summary>Opaque cube (terrain submesh).</summary>
        Cube = 1,
        /// <summary>Alpha-tested cube drawn with the foliage material (leaves).</summary>
        CutoutCube = 2,
        /// <summary>Two crossed alpha-tested quads (grass, flowers, mushrooms).</summary>
        Cross = 3,
        /// <summary>Thin post, 2/16 wide and 10/16 tall.</summary>
        Torch = 4,
        Liquid = 5,
    }

    /// <summary>How the shader tints a surface.</summary>
    public enum TintMode : byte
    {
        None = 0,
        /// <summary>Biome grass colour from temperature/humidity.</summary>
        Grass = 1,
        /// <summary>Biome foliage colour from temperature/humidity.</summary>
        Foliage = 2,
        Birch = 3,
        Spruce = 4,
    }

    /// <summary>Blittable per-block render/physics/light data, readable from Burst jobs.</summary>
    public struct BlockDefinition
    {
        public BlockFlags Flags;
        public RenderShape Shape;
        public TextureLayer Top;
        public TextureLayer Side;
        public TextureLayer Bottom;
        /// <summary>Layer blended over the upper part of side faces (grass or snow over dirt).</summary>
        public TextureLayer SideOverlay;
        /// <summary>Block light emitted, 0-15.</summary>
        public byte LightEmission;
        /// <summary>Light lost when passing through, 0-15 (15 blocks light completely).</summary>
        public byte LightOpacity;
        public TintMode Tint;
        /// <summary>Wind sway weight 0-255 (applied to upper vertices of plants, all vertices of leaves).</summary>
        public byte Wind;

        public bool Has(BlockFlags f) => (Flags & f) != 0;

        public TextureLayer LayerForFace(int face) =>
            face == Faces.PosY ? Top : face == Faces.NegY ? Bottom : Side;
    }

    public static class BlockRegistry
    {
        const BlockFlags Terrain = BlockFlags.Solid | BlockFlags.Opaque | BlockFlags.Breakable;
        const BlockFlags Plant = BlockFlags.Replaceable | BlockFlags.Breakable | BlockFlags.NeedsSupport;
        const TextureLayer None = TextureLayer.None;

        static readonly (string name, BlockDefinition def)[] Table =
        {
            ("Air", new BlockDefinition { Flags = BlockFlags.Replaceable, Shape = RenderShape.None, Top = None, Side = None, Bottom = None, SideOverlay = None }),
            ("Stone", Cube(TextureLayer.Stone)),
            ("Dirt", Cube(TextureLayer.Dirt)),
            ("Grass", Cube(TextureLayer.GrassTop, TextureLayer.Dirt, TextureLayer.Dirt, TextureLayer.GrassTop, TintMode.Grass)),
            ("Sand", Cube(TextureLayer.Sand)),
            ("Gravel", Cube(TextureLayer.Gravel)),
            ("Snow", Cube(TextureLayer.Snow)),
            ("Bedrock", Cube(TextureLayer.Bedrock, flags: BlockFlags.Solid | BlockFlags.Opaque)),
            ("Water", new BlockDefinition
            {
                Flags = BlockFlags.Liquid | BlockFlags.Replaceable, Shape = RenderShape.Liquid,
                Top = None, Side = None, Bottom = None, SideOverlay = None, LightOpacity = 2,
            }),
            ("Cobblestone", Cube(TextureLayer.Cobblestone)),
            ("Planks", Cube(TextureLayer.Planks)),
            ("Bricks", Cube(TextureLayer.Bricks)),
            ("Oak Log", Cube(TextureLayer.LogTop, TextureLayer.OakLog, TextureLayer.LogTop)),
            ("Birch Log", Cube(TextureLayer.LogTop, TextureLayer.BirchLog, TextureLayer.LogTop)),
            ("Spruce Log", Cube(TextureLayer.LogTop, TextureLayer.SpruceLog, TextureLayer.LogTop)),
            ("Jungle Log", Cube(TextureLayer.LogTop, TextureLayer.JungleLog, TextureLayer.LogTop)),
            ("Oak Leaves", Leaves(TextureLayer.Leaves, TintMode.Foliage)),
            ("Birch Leaves", Leaves(TextureLayer.Leaves, TintMode.Birch)),
            ("Spruce Leaves", Leaves(TextureLayer.Needles, TintMode.Spruce)),
            ("Jungle Leaves", Leaves(TextureLayer.Leaves, TintMode.Foliage)),
            ("Sandstone", Cube(TextureLayer.Sandstone)),
            ("Red Sandstone", Cube(TextureLayer.RedSandstone)),
            ("Mud", Cube(TextureLayer.Mud)),
            ("Moss", Cube(TextureLayer.Moss)),
            ("Ice", new BlockDefinition
            {
                Flags = Terrain, Shape = RenderShape.Cube,
                Top = TextureLayer.Ice, Side = TextureLayer.Ice, Bottom = TextureLayer.Ice, SideOverlay = None, LightOpacity = 15,
            }),
            ("Coal Ore", Cube(TextureLayer.CoalOre)),
            ("Iron Ore", Cube(TextureLayer.IronOre)),
            ("Gold Ore", Cube(TextureLayer.GoldOre)),
            ("Diamond Ore", Cube(TextureLayer.DiamondOre)),
            ("Tall Grass", Cross(TextureLayer.GrassTuft, TintMode.Grass)),
            ("Poppy", Cross(TextureLayer.FlowerRed, TintMode.None)),
            ("Dandelion", Cross(TextureLayer.FlowerYellow, TintMode.None)),
            ("Dead Bush", Cross(TextureLayer.DeadBush, TintMode.None)),
            ("Glowcap", Cross(TextureLayer.Glowcap, TintMode.None, light: 11, wind: 0)),
            ("Torch", new BlockDefinition
            {
                Flags = BlockFlags.Breakable | BlockFlags.NeedsSupport, Shape = RenderShape.Torch,
                Top = TextureLayer.TorchTop, Side = TextureLayer.Torch, Bottom = TextureLayer.Torch, SideOverlay = None,
                LightEmission = 14,
            }),
            ("Cactus", Cube(TextureLayer.CactusTop, TextureLayer.Cactus, TextureLayer.CactusTop)),
            ("Snowy Grass", Cube(TextureLayer.Snow, TextureLayer.Dirt, TextureLayer.Dirt, TextureLayer.Snow)),
        };

        static BlockDefinition Cube(TextureLayer top, TextureLayer side = None, TextureLayer bottom = None,
            TextureLayer overlay = None, TintMode tint = TintMode.None, BlockFlags flags = Terrain) => new BlockDefinition
        {
            Flags = flags, Shape = RenderShape.Cube,
            Top = top, Side = side == None ? top : side, Bottom = bottom == None ? (side == None ? top : side) : bottom,
            SideOverlay = overlay, LightOpacity = 15, Tint = tint,
        };

        static BlockDefinition Leaves(TextureLayer layer, TintMode tint) => new BlockDefinition
        {
            Flags = BlockFlags.Solid | BlockFlags.Breakable, Shape = RenderShape.CutoutCube,
            Top = layer, Side = layer, Bottom = layer, SideOverlay = None, LightOpacity = 1, Tint = tint, Wind = 70,
        };

        static BlockDefinition Cross(TextureLayer layer, TintMode tint, byte light = 0, byte wind = 255) => new BlockDefinition
        {
            Flags = Plant, Shape = RenderShape.Cross,
            Top = layer, Side = layer, Bottom = layer, SideOverlay = None, LightEmission = light, Tint = tint, Wind = wind,
        };

        public static int Count => Table.Length;

        public static string Name(ushort id) => id < Table.Length ? Table[id].name : $"Unknown({id})";

        public static BlockDefinition Get(ushort id) => id < Table.Length ? Table[id].def : Table[0].def;

        public static NativeArray<BlockDefinition> CreateNative(Allocator allocator)
        {
            var arr = new NativeArray<BlockDefinition>(Table.Length, allocator);
            for (int i = 0; i < Table.Length; i++) arr[i] = Table[i].def;
            return arr;
        }
    }
}
