using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World.Generation
{
    /// <summary>Per-(x,z) description of a generated column, shared with neighbours for tree placement and tint.</summary>
    public struct ColumnSurface
    {
        public int Height;          // y of the ground block (top terrain block before plants/trees)
        public ushort Top;          // block at Height
        public Biome Biome;
        public byte Temperature;    // 0..255
        public byte Humidity;       // 0..255
    }

    /// <summary>
    /// Generates one whole column into a contiguous buffer: 3D density terrain (height field plus
    /// overhang noise), biome surface layers, water and ice, caves (spaghetti tunnels, cheese caverns,
    /// flooded aquifers), ore clusters, cave-floor moss and glowcaps, and surface plants.
    /// Trees are added afterwards by <see cref="DecorationJob"/>, which needs neighbouring columns.
    /// </summary>
    [BurstCompile]
    public struct ColumnGenerationJob : IJob
    {
        public int2 Column;
        public uint Seed;
        public NativeArray<ushort> Voxels;             // ColumnVolume
        public NativeArray<ColumnSurface> Surface;     // ChunkArea

        const int Step = 4;                             // lattice spacing for 3D noise
        const int LX = ChunkSize / Step + 1;            // 9
        const int LY = (MaxWorldY - MinWorldY) / Step + 1;  // 65

        public void Execute()
        {
            int2 origin = Column * ChunkSize;
            const int P = ChunkSize + 2;
            var heights = new NativeArray<float>(P * P, Allocator.Temp, NativeArrayOptions.UninitializedMemory);
            var samples = new NativeArray<TerrainNoise.Sample>(ChunkArea, Allocator.Temp, NativeArrayOptions.UninitializedMemory);

            for (int z = -1; z <= ChunkSize; z++)
            for (int x = -1; x <= ChunkSize; x++)
            {
                var s = TerrainNoise.SampleSurface(new float2(origin.x + x, origin.y + z), Seed);
                heights[(x + 1) + (z + 1) * P] = s.Height;
                if (x >= 0 && z >= 0 && x < ChunkSize && z < ChunkSize) samples[x + z * ChunkSize] = s;
            }

            var lattice = BuildLattice(origin);

            float3 caveOff = TerrainNoise.SeedOffset3(Seed, 40);
            float2 entranceOff = TerrainNoise.SeedOffset(Seed, 41);
            float2 aquiferOff = TerrainNoise.SeedOffset(Seed, 42);
            float2 stripeOff = TerrainNoise.SeedOffset(Seed, 43);

            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                var s = samples[x + z * ChunkSize];
                int hi = (x + 1) + (z + 1) * P;
                float hf = heights[hi];
                float slope = math.max(
                    math.max(math.abs(heights[hi + 1] - hf), math.abs(heights[hi - 1] - hf)),
                    math.max(math.abs(heights[hi + P] - hf), math.abs(heights[hi - P] - hf)));

                float2 wp = new float2(origin.x + x, origin.y + z);
                float n = noise.snoise(wp * 0.07f + entranceOff);
                var rules = SurfaceRules(s, slope, n, wp);

                bool entrance = noise.snoise(wp * 0.011f + entranceOff * 0.5f) > 0.55f;
                float lakeLevel = -40f + TerrainNoise.Fbm(wp * 0.004f + aquiferOff, 2) * 16f;
                bool frozen = s.Biome == Biome.FrozenOcean || s.Biome == Biome.FrozenRiver || s.Biome == Biome.SnowyBeach
                              || s.Temperature < 0.16f;

                float amp = s.Overhang;
                int solidTop = (int)math.ceil(hf + amp) + 1;
                int solidBottom = (int)math.floor(hf - amp) - 1;

                int groundTop = int.MinValue;
                ushort groundBlock = BlockId.Air;
                int depth = -1;                 // solid blocks since the last air cell, -1 while in air
                for (int y = MaxWorldY - 1; y >= MinWorldY; y--)
                {
                    bool solid;
                    if (y > solidTop) solid = false;
                    else if (y < solidBottom) solid = true;
                    else
                    {
                        float d = hf - y;
                        if (amp > 0f) d += SampleLattice(lattice, x, y, z).x * amp;
                        solid = d > 0f;
                    }

                    ushort b;
                    if (!solid)
                    {
                        depth = -1;
                        b = groundTop == int.MinValue && y <= SeaLevel
                            ? (frozen && y == SeaLevel ? BlockId.Ice : BlockId.Water)
                            : BlockId.Air;
                    }
                    else
                    {
                        depth++;
                        if (groundTop == int.MinValue) groundTop = y;
                        b = PickSolid(in rules, y, depth, wp, stripeOff);
                        if (depth == 0 && groundTop == y) groundBlock = b;

                        if (y <= MinWorldY + 3)
                        {
                            uint h = math.hash(new int3((int)wp.x, y, (int)wp.y) ^ (int)Seed);
                            if (y == MinWorldY || (h & 3) < (uint)(MinWorldY + 4 - y)) b = BlockId.Bedrock;
                        }
                        else if (y > MinWorldY + 5)
                        {
                            int below = groundTop - y;
                            bool underWater = groundTop < SeaLevel + 1;
                            bool allowed = (below >= 6 || entrance) && !(underWater && below < 12) && s.River < 0.2f;
                            if (allowed && IsCave(lattice, x, y, z, below))
                                b = y <= lakeLevel ? BlockId.Water : BlockId.Air;
                        }
                    }
                    Voxels[ColumnIndex(x, y, z)] = b;
                }

                // a cave entrance may have removed the ground block itself
                if (groundTop != int.MinValue && Voxels[ColumnIndex(x, groundTop, z)] != groundBlock) groundBlock = BlockId.Air;

                Surface[x + z * ChunkSize] = new ColumnSurface
                {
                    Height = groundTop,
                    Top = groundBlock,
                    Biome = s.Biome,
                    Temperature = (byte)(math.saturate(s.Temperature) * 255f),
                    Humidity = (byte)(math.saturate(s.Humidity) * 255f),
                };
            }

            PlaceOres(origin);
            DecorateCaveFloors(origin, caveOff);
            PlaceSurfacePlants(origin);
        }

        // ------------------------------------------------------------------ surface materials

        struct Rules
        {
            public ushort Top, Filler, Deep, Underwater;
            public int FillerDepth;
            public byte Kind;   // 0 normal, 1 desert (sandstone band), 2 badlands strata
        }

        static Rules SurfaceRules(in TerrainNoise.Sample s, float slope, float n, float2 wp)
        {
            var r = new Rules { Top = BlockId.Grass, Filler = BlockId.Dirt, Deep = BlockId.Stone, FillerDepth = 3 + (n > 0.2f ? 1 : 0) };
            r.Underwater = s.Height < SeaLevel - 7 + (int)(n * 3f) ? BlockId.Gravel : BlockId.Sand;
            bool cliff = slope > 2.3f + n * 0.5f;
            switch (s.Biome)
            {
                case Biome.Ocean: case Biome.FrozenOcean:
                    r.Top = r.Filler = r.Underwater; break;
                case Biome.Beach: case Biome.SnowyBeach:
                    r.Top = r.Filler = BlockId.Sand; r.FillerDepth = 4; break;
                case Biome.River: case Biome.FrozenRiver:
                    r.Top = r.Filler = r.Underwater = n > 0.1f ? BlockId.Sand : BlockId.Gravel; r.FillerDepth = 2; break;
                case Biome.Desert:
                    r.Top = r.Filler = BlockId.Sand; r.FillerDepth = 3; r.Kind = 1;
                    if (cliff) r.Top = r.Filler = BlockId.Sandstone;
                    break;
                case Biome.Badlands:
                    r.Top = r.Filler = r.Deep = BlockId.RedSandstone; r.FillerDepth = 0; r.Kind = 2; break;
                case Biome.Swamp:
                    if (n > 0.3f) r.Top = BlockId.Mud;
                    r.Underwater = BlockId.Mud; break;
                case Biome.SnowyTundra: case Biome.SnowyTaiga:
                    r.Top = BlockId.SnowyGrass; break;
                case Biome.Mountains:
                case Biome.SnowyPeaks:
                {
                    float snowLine = 138f + noise.snoise(wp * 0.011f) * 10f;
                    if (s.Height > snowLine || s.Biome == Biome.SnowyPeaks)
                    {
                        r.Top = slope > 2.6f ? BlockId.Stone : BlockId.Snow;
                        r.Filler = BlockId.Stone; r.FillerDepth = 0;
                    }
                    else if (s.Height > snowLine - 22f && slope > 1.4f)
                    {
                        r.Top = n > 0f ? BlockId.Gravel : BlockId.Stone;
                        r.Filler = BlockId.Stone; r.FillerDepth = 1;
                    }
                    break;
                }
            }
            if (cliff && r.Kind == 0 && r.Top != BlockId.Sand && r.Top != BlockId.Gravel)
            {
                r.Top = BlockId.Stone; r.Filler = BlockId.Stone; r.FillerDepth = 0;
            }
            return r;
        }

        static ushort PickSolid(in Rules r, int y, int depth, float2 wp, float2 stripeOff)
        {
            if (y < SeaLevel && depth <= r.FillerDepth && r.Kind == 0)
                return depth == 0 && r.Top != BlockId.Stone ? r.Underwater : (depth == 0 ? r.Top : r.Filler);
            if (depth == 0)
            {
                ushort top = r.Top;
                if (top == BlockId.Grass && y < SeaLevel) top = BlockId.Dirt;
                return top;
            }
            if (depth <= r.FillerDepth) return r.Filler;
            if (r.Kind == 1 && depth <= r.FillerDepth + 7) return BlockId.Sandstone;
            if (r.Kind == 2 && depth <= 48)
            {
                // horizontal strata that wobble slightly, like layered sediment
                float wobble = noise.snoise(wp * 0.02f + stripeOff) * 1.5f;
                int band = (int)math.floor((y + wobble) / 3f);
                return (band % 4 == 0) ? BlockId.Sandstone : BlockId.RedSandstone;
            }
            return r.Deep;
        }

        // ------------------------------------------------------------------ 3D noise lattice

        NativeArray<float4> BuildLattice(int2 origin)
        {
            var lattice = new NativeArray<float4>(LX * LX * LY, Allocator.Temp, NativeArrayOptions.UninitializedMemory);
            float3 oOver = TerrainNoise.SeedOffset3(Seed, 30);
            float3 oCheese = TerrainNoise.SeedOffset3(Seed, 31);
            float3 oA = TerrainNoise.SeedOffset3(Seed, 32);
            float3 oB = TerrainNoise.SeedOffset3(Seed, 33);
            for (int ly = 0; ly < LY; ly++)
            for (int lz = 0; lz < LX; lz++)
            for (int lx = 0; lx < LX; lx++)
            {
                float3 p = new float3(origin.x + lx * Step, MinWorldY + ly * Step, origin.y + lz * Step);
                float over = TerrainNoise.Fbm(p * new float3(1f / 38f, 1f / 26f, 1f / 38f) + oOver, 2);
                float cheese = noise.snoise(p * new float3(1f / 72f, 1f / 40f, 1f / 72f) + oCheese);
                float a = noise.snoise(p * new float3(1f / 52f, 1f / 30f, 1f / 52f) + oA);
                float b = noise.snoise(p * new float3(1f / 52f, 1f / 30f, 1f / 52f) + oB);
                lattice[lx + lz * LX + ly * LX * LX] = new float4(over, cheese, a, b);
            }
            return lattice;
        }

        static float4 SampleLattice(NativeArray<float4> lattice, int x, int worldY, int z)
        {
            int yy = worldY - MinWorldY;
            int x0 = x / Step, z0 = z / Step, y0 = math.min(yy / Step, LY - 2);
            float fx = (x - x0 * Step) / (float)Step;
            float fz = (z - z0 * Step) / (float)Step;
            float fy = (yy - y0 * Step) / (float)Step;
            int i000 = x0 + z0 * LX + y0 * LX * LX;
            const int dX = 1, dZ = LX, dY = LX * LX;
            float4 c00 = math.lerp(lattice[i000], lattice[i000 + dX], fx);
            float4 c10 = math.lerp(lattice[i000 + dZ], lattice[i000 + dZ + dX], fx);
            float4 c01 = math.lerp(lattice[i000 + dY], lattice[i000 + dY + dX], fx);
            float4 c11 = math.lerp(lattice[i000 + dY + dZ], lattice[i000 + dY + dZ + dX], fx);
            return math.lerp(math.lerp(c00, c10, fz), math.lerp(c01, c11, fz), fy);
        }

        static bool IsCave(NativeArray<float4> lattice, int x, int y, int z, int depthBelowSurface)
        {
            float4 v = SampleLattice(lattice, x, y, z);
            // large caverns, rarer toward the surface
            float cheeseThreshold = 0.58f + 0.16f * math.smoothstep(-30f, 70f, y);
            if (v.y > cheeseThreshold) return true;
            // spaghetti tunnels: intersection of two noise isosurfaces
            float width = 0.055f + 0.02f * math.saturate(v.x);
            if (depthBelowSurface < 6) width *= 0.8f;
            return v.z * v.z + v.w * v.w < width * width;
        }

        // ------------------------------------------------------------------ ores, cave floors, plants

        void PlaceOres(int2 origin)
        {
            var rng = new Unity.Mathematics.Random(math.hash(new int3(Column.x, Column.y, (int)Seed)) | 1u);
            Cluster(ref rng, BlockId.CoalOre, 18, 0, 128, 6, 14);
            Cluster(ref rng, BlockId.IronOre, 12, -60, 64, 4, 9);
            Cluster(ref rng, BlockId.GoldOre, 4, -64, 8, 3, 7);
            Cluster(ref rng, BlockId.DiamondOre, 2, -64, -36, 2, 5);
        }

        void Cluster(ref Unity.Mathematics.Random rng, ushort ore, int attempts, int minY, int maxY, int minSize, int maxSize)
        {
            for (int a = 0; a < attempts; a++)
            {
                int3 p = new int3(rng.NextInt(ChunkSize), rng.NextInt(minY, maxY), rng.NextInt(ChunkSize));
                int size = rng.NextInt(minSize, maxSize + 1);
                for (int k = 0; k < size; k++)
                {
                    if (p.x >= 0 && p.x < ChunkSize && p.z >= 0 && p.z < ChunkSize && p.y > MinWorldY + 4 && p.y < MaxWorldY)
                    {
                        int i = ColumnIndex(p.x, p.y, p.z);
                        if (Voxels[i] == BlockId.Stone) Voxels[i] = ore;
                    }
                    int axis = rng.NextInt(3);
                    p[axis] += rng.NextBool() ? 1 : -1;
                }
            }
        }

        void DecorateCaveFloors(int2 origin, float3 caveOff)
        {
            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                int ground = Surface[x + z * ChunkSize].Height;
                for (int y = MinWorldY + 6; y < ground - 6; y++)
                {
                    if (Voxels[ColumnIndex(x, y, z)] != BlockId.Air) continue;
                    int below = ColumnIndex(x, y - 1, z);
                    ushort floor = Voxels[below];
                    if (floor != BlockId.Stone && floor != BlockId.Gravel) continue;
                    float3 p = new float3(origin.x + x, y, origin.y + z);
                    float damp = noise.snoise(p * 0.035f + caveOff);
                    uint h = math.hash(new int3((int)p.x, y, (int)p.z) ^ (int)(Seed * 7919u));
                    float r = (h & 0xFFFF) / 65536f;
                    if (damp > 0.25f) Voxels[below] = BlockId.Moss;
                    if (r < (damp > 0.25f ? 0.06f : 0.006f)) Voxels[ColumnIndex(x, y, z)] = BlockId.Glowcap;
                }
            }
        }

        void PlaceSurfacePlants(int2 origin)
        {
            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                var s = Surface[x + z * ChunkSize];
                int y = s.Height + 1;
                if (s.Height < SeaLevel || y >= MaxWorldY - 3) continue;
                if (Voxels[ColumnIndex(x, y, z)] != BlockId.Air) continue;

                float2 wp = new float2(origin.x + x, origin.y + z);
                uint h = math.hash(new int2((int)wp.x, (int)wp.y) ^ (int)(Seed * 104729u));
                float r = (h & 0xFFFF) / 65536f;
                float clump = math.saturate(noise.snoise(wp * 0.08f) * 0.6f + 0.6f);

                ushort plant = BlockId.Air;
                if (s.Top == BlockId.Grass)
                {
                    float grass = 0f, flowers = 0f;
                    switch (s.Biome)
                    {
                        case Biome.Plains: grass = 0.30f; flowers = 0.035f; break;
                        case Biome.Forest: grass = 0.18f; flowers = 0.012f; break;
                        case Biome.DenseForest: grass = 0.12f; break;
                        case Biome.Jungle: grass = 0.38f; break;
                        case Biome.Savanna: grass = 0.32f; break;
                        case Biome.Taiga: grass = 0.10f; break;
                        case Biome.Swamp: grass = 0.20f; break;
                        default: grass = 0.08f; break;
                    }
                    float flowerPatch = math.saturate(noise.snoise(wp * 0.03f + 300f) * 2f);
                    if (r < flowers * flowerPatch * 3f)
                        plant = noise.snoise(wp * 0.02f + 77f) > 0f ? BlockId.FlowerRed : BlockId.FlowerYellow;
                    else if (r < grass * clump + flowers * flowerPatch * 3f)
                        plant = BlockId.TallGrass;
                }
                else if (s.Top == BlockId.Sand && s.Biome == Biome.Desert)
                {
                    if (r < 0.004f)
                    {
                        int height = 1 + (int)(h >> 20) % 3;
                        for (int k = 0; k < height && y + k < MaxWorldY; k++)
                            Voxels[ColumnIndex(x, y + k, z)] = BlockId.Cactus;
                        continue;
                    }
                    if (r < 0.011f) plant = BlockId.DeadBush;
                }
                else if (s.Top == BlockId.RedSandstone && r < 0.012f) plant = BlockId.DeadBush;

                if (plant != BlockId.Air) Voxels[ColumnIndex(x, y, z)] = plant;
            }
        }
    }
}
