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
        /// <summary>Fully hides neighbouring faces and contributes voxel AO.</summary>
        Opaque = 1 << 1,
        Liquid = 1 << 2,
        /// <summary>Placing a block into this cell overwrites it (air, water).</summary>
        Replaceable = 1 << 3,
        /// <summary>Can be broken by the player.</summary>
        Breakable = 1 << 4,
    }

    /// <summary>Blittable per-block render/physics data, readable from Burst jobs.</summary>
    public struct BlockDefinition
    {
        public BlockFlags Flags;
        public TextureLayer Top;
        public TextureLayer Side;
        public TextureLayer Bottom;
        /// <summary>Layer blended over the upper part of side faces (grass hanging over dirt).</summary>
        public TextureLayer SideOverlay;

        public bool Has(BlockFlags f) => (Flags & f) != 0;

        public TextureLayer LayerForFace(int face) =>
            face == Faces.PosY ? Top : face == Faces.NegY ? Bottom : Side;
    }

    public static class BlockRegistry
    {
        const BlockFlags Terrain = BlockFlags.Solid | BlockFlags.Opaque | BlockFlags.Breakable;

        static readonly (string name, BlockDefinition def)[] Table =
        {
            ("Air", new BlockDefinition
            {
                Flags = BlockFlags.Replaceable,
                Top = TextureLayer.None, Side = TextureLayer.None, Bottom = TextureLayer.None, SideOverlay = TextureLayer.None,
            }),
            ("Stone", Uniform(TextureLayer.Stone)),
            ("Dirt", Uniform(TextureLayer.Dirt)),
            ("Grass", new BlockDefinition
            {
                Flags = Terrain,
                Top = TextureLayer.GrassTop, Side = TextureLayer.Dirt, Bottom = TextureLayer.Dirt, SideOverlay = TextureLayer.GrassTop,
            }),
            ("Sand", Uniform(TextureLayer.Sand)),
            ("Gravel", Uniform(TextureLayer.Gravel)),
            ("Snow", Uniform(TextureLayer.Snow)),
            ("Bedrock", Uniform(TextureLayer.Bedrock, BlockFlags.Solid | BlockFlags.Opaque)),
            ("Water", new BlockDefinition
            {
                Flags = BlockFlags.Liquid | BlockFlags.Replaceable,
                Top = TextureLayer.None, Side = TextureLayer.None, Bottom = TextureLayer.None, SideOverlay = TextureLayer.None,
            }),
            ("Cobblestone", Uniform(TextureLayer.Cobblestone)),
            ("Planks", Uniform(TextureLayer.Planks)),
            ("Bricks", Uniform(TextureLayer.Bricks)),
        };

        static BlockDefinition Uniform(TextureLayer layer, BlockFlags flags = Terrain) => new BlockDefinition
        {
            Flags = flags, Top = layer, Side = layer, Bottom = layer, SideOverlay = TextureLayer.None,
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
