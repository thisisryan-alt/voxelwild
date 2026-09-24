using System.Runtime.CompilerServices;
using Unity.Mathematics;

namespace Voxelwild.World
{
    /// <summary>
    /// World layout. The world is streamed in columns; each column is a vertical stack of
    /// cubic 32^3 sections. Voxel arrays are laid out x-fastest, then z, then y.
    /// </summary>
    public static class VoxelConstants
    {
        public const int ChunkSizeLog2 = 5;
        public const int ChunkSize = 1 << ChunkSizeLog2;
        public const int ChunkMask = ChunkSize - 1;
        public const int ChunkArea = ChunkSize * ChunkSize;
        public const int ChunkVolume = ChunkArea * ChunkSize;

        public const int MinSectionY = -2;
        public const int MaxSectionY = 5;
        public const int SectionsPerColumn = MaxSectionY - MinSectionY + 1;
        public const int MinWorldY = MinSectionY * ChunkSize;           // -64 (inclusive)
        public const int MaxWorldY = (MaxSectionY + 1) * ChunkSize;     // 192 (exclusive)

        public const int SeaLevel = 64;

        /// <summary>Column voxel buffer used during generation: all sections of a column, contiguous.</summary>
        public const int ColumnVolume = ChunkVolume * SectionsPerColumn;

        /// <summary>Max light level; light spreads at most this far, which sizes the mesher's region margin.</summary>
        public const int MaxLight = 15;

        /// <summary>
        /// Mesher/lighting region: the section plus a 16-voxel margin on every side (64^3). Light from any
        /// source that can reach the section (or its 1-voxel shell) lies inside it, so lighting is exact.
        /// </summary>
        public const int RegionMargin = 16;
        public const int RegionSize = ChunkSize + 2 * RegionMargin;
        public const int RegionArea = RegionSize * RegionSize;
        public const int RegionVolume = RegionArea * RegionSize;

        /// <summary>Region index for section-local coordinates (valid range -16..47).</summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static int RegionIndex(int x, int y, int z) =>
            (x + RegionMargin) + (z + RegionMargin) * RegionSize + (y + RegionMargin) * RegionArea;

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static int ColumnIndex(int x, int worldY, int z)
        {
            int y = worldY - MinWorldY;
            return ((y >> ChunkSizeLog2) * ChunkVolume) + Index(x, y & ChunkMask, z);
        }

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static int Index(int x, int y, int z) => x + (z << ChunkSizeLog2) + (y << (ChunkSizeLog2 * 2));

        /// <summary>Arithmetic shift is floor division, so negative coordinates map correctly.</summary>
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static int3 WorldToSection(int3 world) => world >> ChunkSizeLog2;

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static int3 WorldToLocal(int3 world) => world & ChunkMask;

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static int2 WorldToColumn(int x, int z) => new int2(x >> ChunkSizeLog2, z >> ChunkSizeLog2);

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static bool IsSectionYInWorld(int sectionY) => sectionY >= MinSectionY && sectionY <= MaxSectionY;
    }
}
