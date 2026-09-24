using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using Voxelwild.World.Generation;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World
{
    public enum ColumnState
    {
        Generating,
        Ready,
    }

    /// <summary>The unit of streaming: a vertical stack of sections plus its surface description.</summary>
    public sealed class ChunkColumn
    {
        public int2 Coord;
        public ColumnState State;
        public JobHandle Generation;
        public NativeArray<ColumnSurface> Surface;
        public readonly ChunkSection[] Sections = new ChunkSection[SectionsPerColumn];

        public ChunkColumn()
        {
            Surface = new NativeArray<ColumnSurface>(ChunkArea, Allocator.Persistent);
        }

        public ChunkSection SectionAtY(int sectionY) =>
            IsSectionYInWorld(sectionY) ? Sections[sectionY - MinSectionY] : null;

        public void DisposeNative()
        {
            if (Surface.IsCreated) Surface.Dispose();
        }
    }
}
