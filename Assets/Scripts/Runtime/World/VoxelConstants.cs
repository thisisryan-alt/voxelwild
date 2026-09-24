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

        /// <summary>Padded section used by the mesher: one voxel of neighbour data on every side.</summary>
        public const int PaddedSize = ChunkSize + 2;
        public const int PaddedArea = PaddedSize * PaddedSize;
        public const int PaddedVolume = PaddedArea * PaddedSize;

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static int Index(int x, int y, int z) => x + (z << ChunkSizeLog2) + (y << (ChunkSizeLog2 * 2));

        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static int PaddedIndex(int x, int y, int z) => (x + 1) + (z + 1) * PaddedSize + (y + 1) * PaddedArea;

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
