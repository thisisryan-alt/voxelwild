namespace Voxelwild.World
{
    /// <summary>Numeric block ids stored in voxel arrays. Append only: ids will be persisted in saves.</summary>
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

        public const int Count = 12;
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

        None = 255,
    }
}
