using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World.Generation
{
    /// <summary>Per-column surface description shared by all sections of the column.</summary>
    public struct ColumnSurface
    {
        public int Height;          // y of the top solid block
        public ushort Top;          // block at Height
        public ushort Filler;       // blocks below Top
        public byte FillerDepth;    // filler thickness below Top
    }

    /// <summary>
    /// Evaluates the height field for one 32x32 column (plus a 1-block border for slopes)
    /// and decides the surface materials.
    /// </summary>
    [BurstCompile]
    public struct ColumnSurfaceJob : IJob
    {
        public int2 Column;
        public uint Seed;
        [WriteOnly] public NativeArray<ColumnSurface> Surface;

        public void Execute()
        {
            const int P = ChunkSize + 2;
            var heights = new NativeArray<float>(P * P, Allocator.Temp, NativeArrayOptions.UninitializedMemory);
            var cont = new NativeArray<float>(P * P, Allocator.Temp, NativeArrayOptions.UninitializedMemory);
            int2 origin = Column * ChunkSize;

            for (int z = -1; z <= ChunkSize; z++)
            for (int x = -1; x <= ChunkSize; x++)
            {
                var s = TerrainNoise.SampleSurface(new float2(origin.x + x, origin.y + z), Seed);
                int i = (x + 1) + (z + 1) * P;
                heights[i] = s.Height;
                cont[i] = s.Continentalness;
            }

            float2 snowOffset = TerrainNoise.SeedOffset(Seed, 17);
            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                int i = (x + 1) + (z + 1) * P;
                float hf = heights[i];
                int h = (int)math.floor(hf);
                float slope = math.max(
                    math.max(math.abs(heights[i + 1] - hf), math.abs(heights[i - 1] - hf)),
                    math.max(math.abs(heights[i + P] - hf), math.abs(heights[i - P] - hf)));

                float2 wp = new float2(origin.x + x, origin.y + z);
                float n = noise.snoise(wp * 0.07f + snowOffset);
                float snowLine = 138f + noise.snoise(wp * 0.011f + snowOffset) * 10f;

                var col = new ColumnSurface { Height = h, Top = BlockId.Grass, Filler = BlockId.Dirt, FillerDepth = (byte)(3 + (n > 0.2f ? 1 : 0)) };

                bool coast = cont[i] < 0.05f;
                if (h < SeaLevel - 1)
                {
                    // lake / sea floor: sand in the shallows, gravel deeper
                    bool gravel = h < SeaLevel - 7 + (int)(n * 3f);
                    col.Top = gravel ? BlockId.Gravel : BlockId.Sand;
                    col.Filler = col.Top;
                    col.FillerDepth = 3;
                }
                else if (h <= SeaLevel + 1 && (coast || slope < 1.2f))
                {
                    col.Top = BlockId.Sand;
                    col.Filler = BlockId.Sand;
                    col.FillerDepth = 4;
                }
                else if (hf > snowLine)
                {
                    col.Top = slope > 2.6f ? BlockId.Stone : BlockId.Snow;
                    col.Filler = BlockId.Stone;
                    col.FillerDepth = 0;
                }
                else if (slope > 2.2f + n * 0.6f)
                {
                    // cliffs: exposed rock
                    col.Top = BlockId.Stone;
                    col.Filler = BlockId.Stone;
                    col.FillerDepth = 0;
                }
                else if (hf > snowLine - 22f && slope > 1.4f)
                {
                    // scree above the tree line
                    col.Top = n > 0f ? BlockId.Gravel : BlockId.Stone;
                    col.Filler = BlockId.Stone;
                    col.FillerDepth = 1;
                }

                Surface[x + z * ChunkSize] = col;
            }
        }
    }

    /// <summary>Fills one 32^3 section from its column surface. Reports whether the result is uniform.</summary>
    [BurstCompile]
    public struct SectionFillJob : IJob
    {
        public int3 Section;
        public uint Seed;
        [ReadOnly] public NativeArray<ColumnSurface> Surface;
        [WriteOnly] public NativeArray<ushort> Voxels;
        /// <summary>[0] = 1 if every voxel is the same block, [1] = that block (valid when uniform).</summary>
        [WriteOnly] public NativeArray<int> Stats;

        public void Execute()
        {
            int baseY = Section.y * ChunkSize;
            int2 origin = Section.xz * ChunkSize;
            ushort first = 0;
            bool uniform = true;
            bool firstSet = false;

            for (int y = 0; y < ChunkSize; y++)
            {
                int wy = baseY + y;
                for (int z = 0; z < ChunkSize; z++)
                for (int x = 0; x < ChunkSize; x++)
                {
                    var col = Surface[x + z * ChunkSize];
                    ushort b;
                    if (wy <= MinWorldY + 3)
                    {
                        // ragged bedrock floor
                        uint h = math.hash(new int3(origin.x + x, wy, origin.y + z) ^ (int)Seed);
                        b = wy == MinWorldY || (h & 3) < (uint)(MinWorldY + 4 - wy) ? BlockId.Bedrock : BlockId.Stone;
                    }
                    else if (wy > col.Height)
                        b = wy <= SeaLevel ? BlockId.Water : BlockId.Air;
                    else if (wy == col.Height)
                        b = col.Top;
                    else if (wy >= col.Height - col.FillerDepth)
                        b = col.Filler;
                    else
                        b = BlockId.Stone;

                    // grass never survives under water or another block
                    if (b == BlockId.Grass && wy < SeaLevel) b = BlockId.Dirt;

                    Voxels[x + (z << ChunkSizeLog2) + (y << (ChunkSizeLog2 * 2))] = b;
                    if (!firstSet) { first = b; firstSet = true; }
                    else if (b != first) uniform = false;
                }
            }

            Stats[0] = uniform ? 1 : 0;
            Stats[1] = first;
        }
    }
}
