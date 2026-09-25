using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using Voxelwild.World.Generation;
using Voxelwild.World.Props;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World
{
    public enum ColumnState
    {
        /// <summary>Terrain job running.</summary>
        Generating,
        /// <summary>Terrain done; waiting for all 8 neighbours to reach at least this state before trees.</summary>
        Generated,
        /// <summary>Tree/heightmap job running.</summary>
        Decorating,
        /// <summary>Split into sections; final data.</summary>
        Ready,
    }

    /// <summary>Scratch memory for a column while it is being generated and decorated (pooled).</summary>
    public sealed class ColumnBuildBuffers : System.IDisposable
    {
        public NativeArray<ushort> Voxels = new NativeArray<ushort>(ColumnVolume, Allocator.Persistent, NativeArrayOptions.UninitializedMemory);
        public NativeArray<ColumnSurface> Neighborhood = new NativeArray<ColumnSurface>(ChunkArea * 9, Allocator.Persistent, NativeArrayOptions.UninitializedMemory);

        public void Dispose()
        {
            if (Voxels.IsCreated) Voxels.Dispose();
            if (Neighborhood.IsCreated) Neighborhood.Dispose();
        }
    }

    /// <summary>The unit of streaming: a vertical stack of sections plus its surface description and light heightmap.</summary>
    public sealed class ChunkColumn
    {
        public int2 Coord;
        public ColumnState State;
        public JobHandle Job;
        public ColumnBuildBuffers Build;
        /// <summary>In-flight mesh jobs reading this column's memory; the column cannot unload while > 0.</summary>
        public int MeshReaders;
        public NativeArray<ColumnSurface> Surface;
        /// <summary>World y of the topmost light-blocking block per (x,z); sky light is 15 above it.</summary>
        public NativeArray<int> Heightmap;
        /// <summary>Props the decoration job placed in this column (see PropField for the live set).</summary>
        public NativeList<PropInstance> Props;
        public readonly ChunkSection[] Sections = new ChunkSection[SectionsPerColumn];

        public ChunkColumn()
        {
            Surface = new NativeArray<ColumnSurface>(ChunkArea, Allocator.Persistent);
            Heightmap = new NativeArray<int>(ChunkArea, Allocator.Persistent);
            Props = new NativeList<PropInstance>(256, Allocator.Persistent);
        }

        public bool HasTerrain => State != ColumnState.Generating;

        public ChunkSection SectionAtY(int sectionY) =>
            IsSectionYInWorld(sectionY) ? Sections[sectionY - MinSectionY] : null;

        public void DisposeNative()
        {
            if (Surface.IsCreated) Surface.Dispose();
            if (Heightmap.IsCreated) Heightmap.Dispose();
            if (Props.IsCreated) Props.Dispose();
        }
    }
}
