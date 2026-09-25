using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using Voxelwild.EditorTools;
using Voxelwild.World;
using Voxelwild.World.Generation;
using Voxelwild.World.Props;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.Tests
{
    public class CoordinateTests
    {
        [TestCase(0, 0, 0)]
        [TestCase(31, 0, 31)]
        [TestCase(32, 1, 0)]
        [TestCase(-1, -1, 31)]
        [TestCase(-32, -1, 0)]
        [TestCase(-33, -2, 31)]
        public void WorldToSectionAndLocal_UseFloorDivision(int world, int section, int local)
        {
            var p = new int3(world, world, world);
            Assert.AreEqual(new int3(section), WorldToSection(p));
            Assert.AreEqual(new int3(local), WorldToLocal(p));
        }

        [Test]
        public void Index_IsUniqueAndDense()
        {
            var seen = new bool[ChunkVolume];
            for (int y = 0; y < ChunkSize; y++)
            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                int i = Index(x, y, z);
                Assert.IsFalse(seen[i]);
                seen[i] = true;
            }
        }

        [Test]
        public void ColumnIndex_MapsSectionsContiguously()
        {
            Assert.AreEqual(0, ColumnIndex(0, MinWorldY, 0));
            Assert.AreEqual(ChunkVolume, ColumnIndex(0, MinWorldY + ChunkSize, 0));
            Assert.AreEqual(ColumnVolume - 1, ColumnIndex(ChunkSize - 1, MaxWorldY - 1, ChunkSize - 1));
        }

        [Test]
        public void SectionRange_CoversWorldHeight()
        {
            Assert.AreEqual(MinWorldY, MinSectionY * ChunkSize);
            Assert.AreEqual(MaxWorldY, MinWorldY + SectionsPerColumn * ChunkSize);
            Assert.That(SeaLevel, Is.InRange(MinWorldY, MaxWorldY - 1));
            Assert.GreaterOrEqual(RegionMargin, MaxLight + 1, "lighting region must contain every source that can reach the section shell");
        }
    }

    public class BlockRegistryTests
    {
        [Test]
        public void EveryBlockIdIsRegistered()
        {
            Assert.AreEqual(BlockId.Count, BlockRegistry.Count);
            for (ushort i = 0; i < BlockId.Count; i++)
                Assert.IsFalse(BlockRegistry.Name(i).StartsWith("Unknown"), $"id {i}");
        }

        [Test]
        public void RenderedBlocksHaveTextureLayers()
        {
            for (ushort i = 0; i < BlockId.Count; i++)
            {
                var d = BlockRegistry.Get(i);
                if (d.Shape == RenderShape.None || d.Shape == RenderShape.Liquid) continue;
                Assert.AreNotEqual(TextureLayer.None, d.Top, BlockRegistry.Name(i));
                Assert.AreNotEqual(TextureLayer.None, d.Side, BlockRegistry.Name(i));
                Assert.AreNotEqual(TextureLayer.None, d.Bottom, BlockRegistry.Name(i));
            }
        }

        [Test]
        public void OpaqueBlocksAreFullCubesThatBlockLight()
        {
            for (ushort i = 0; i < BlockId.Count; i++)
            {
                var d = BlockRegistry.Get(i);
                if (!d.Has(BlockFlags.Opaque)) continue;
                Assert.AreEqual(RenderShape.Cube, d.Shape, BlockRegistry.Name(i));
                Assert.AreEqual(MaxLight, d.LightOpacity, BlockRegistry.Name(i));
            }
            Assert.Greater(BlockRegistry.Get(BlockId.Torch).LightEmission, 10);
            Assert.Greater(BlockRegistry.Get(BlockId.Glowcap).LightEmission, 5);
            Assert.That(BlockRegistry.Get(BlockId.OakLeaves).LightOpacity, Is.InRange(1, 3));
        }

        [Test]
        public void TextureLayerEnum_MatchesSourceManifestOrder()
        {
            var manifest = BlockTextureArrays.LoadManifest();
            var enumNames = Enum.GetValues(typeof(TextureLayer)).Cast<TextureLayer>()
                .Where(l => l != TextureLayer.None).OrderBy(l => (int)l).Select(l => l.ToString()).ToArray();
            CollectionAssert.AreEqual(enumNames, manifest.layers.Select(l => l.name).ToArray());
        }
    }

    /// <summary>Runs the real generation pipeline (3x3 terrain + decoration of the centre) for test columns.</summary>
    static class TestGen
    {
        public struct Column
        {
            public ushort[] Voxels;
            public int[] Heightmap;
            public ColumnSurface[] Surface;
            public PropInstance[] Props;
            public ushort At(int x, int y, int z) => Voxels[ColumnIndex(x, y, z)];
        }

        public static Column Generate(int2 column, uint seed, bool decorate = true)
        {
            var blocks = BlockRegistry.CreateNative(Allocator.TempJob);
            var neighborhood = new NativeArray<ColumnSurface>(ChunkArea * 9, Allocator.TempJob);
            var voxels = new NativeArray<ushort>(ColumnVolume, Allocator.TempJob);
            var surface = new NativeArray<ColumnSurface>(ChunkArea, Allocator.TempJob);
            var scratch = new NativeArray<ushort>(ColumnVolume, Allocator.TempJob);
            var heightmap = new NativeArray<int>(ChunkArea, Allocator.TempJob);
            var rules = PropRegistry.CreateNative(Allocator.TempJob);
            var props = new NativeList<PropInstance>(256, Allocator.TempJob);
            try
            {
                if (decorate)
                {
                    for (int dz = -1; dz <= 1; dz++)
                    for (int dx = -1; dx <= 1; dx++)
                    {
                        new ColumnGenerationJob { Column = column + new int2(dx, dz), Seed = seed, Voxels = scratch, Surface = surface }.Run();
                        NativeArray<ColumnSurface>.Copy(surface, 0, neighborhood, ((dx + 1) + (dz + 1) * 3) * ChunkArea, ChunkArea);
                    }
                }
                new ColumnGenerationJob { Column = column, Seed = seed, Voxels = voxels, Surface = surface }.Run();
                if (decorate)
                    new DecorationJob
                    {
                        Column = column, Seed = seed, Voxels = voxels, Neighborhood = neighborhood, Blocks = blocks, Heightmap = heightmap,
                        PropRules = rules, Props = props,
                    }.Run();
                return new Column
                {
                    Voxels = voxels.ToArray(), Heightmap = heightmap.ToArray(), Surface = surface.ToArray(),
                    Props = props.AsArray().ToArray(),
                };
            }
            finally
            {
                blocks.Dispose(); neighborhood.Dispose(); voxels.Dispose(); surface.Dispose(); scratch.Dispose(); heightmap.Dispose();
                rules.Dispose(); props.Dispose();
            }
        }

        public static int2 FindColumn(uint seed, Func<TerrainNoise.Sample, bool> predicate)
        {
            for (int r = 0; r < 400; r++)
            for (int k = 0; k < 16; k++)
            {
                float a = k * math.PI / 8f;
                float2 p = new float2(math.cos(a), math.sin(a)) * r * 32f;
                if (predicate(TerrainNoise.SampleSurface(p, seed))) return (int2)math.floor(p / ChunkSize);
            }
            throw new Exception("feature not found");
        }
    }

    public class GenerationTests
    {
        const uint Seed = 20260924;

        [Test]
        public void SameSeed_IsDeterministic()
        {
            var a = TestGen.Generate(new int2(3, -7), 42);
            var b = TestGen.Generate(new int2(3, -7), 42);
            CollectionAssert.AreEqual(a.Voxels, b.Voxels);
            CollectionAssert.AreEqual(a.Heightmap, b.Heightmap);
        }

        [Test]
        public void DifferentSeeds_Differ()
        {
            CollectionAssert.AreNotEqual(TestGen.Generate(new int2(0, 0), 1, false).Voxels, TestGen.Generate(new int2(0, 0), 2, false).Voxels);
        }

        [Test]
        public void Column_HasBedrockFloor_WaterOnlyAtOrBelowSeaLevel_AndValidHeightmap()
        {
            var col = TestGen.Generate(new int2(5, 5), 1234);
            var blocks = Enumerable.Range(0, BlockId.Count).Select(i => BlockRegistry.Get((ushort)i)).ToArray();
            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                Assert.AreEqual(BlockId.Bedrock, col.At(x, MinWorldY, z));
                int hm = col.Heightmap[x + z * ChunkSize];
                for (int y = hm + 1; y < MaxWorldY; y++)
                    Assert.AreEqual(0, blocks[col.At(x, y, z)].LightOpacity, $"light-blocking block above heightmap at ({x},{y},{z})");
                Assert.Greater(blocks[col.At(x, hm, z)].LightOpacity, 0);
                for (int y = SeaLevel + 1; y < MaxWorldY; y++)
                    Assert.AreNotEqual(BlockId.Water, col.At(x, y, z), $"water above sea level at ({x},{y},{z})");
            }
        }

        [Test]
        public void Caves_AreCarvedUnderground()
        {
            int carved = 0;
            foreach (var c in new[] { new int2(0, 0), new int2(4, -3), new int2(-6, 2), new int2(9, 9) })
            {
                var col = TestGen.Generate(c, Seed, false);
                for (int z = 0; z < ChunkSize; z += 2)
                for (int x = 0; x < ChunkSize; x += 2)
                {
                    int ground = col.Surface[x + z * ChunkSize].Height;
                    for (int y = MinWorldY + 6; y < ground - 8; y++)
                        if (col.At(x, y, z) == BlockId.Air || col.At(x, y, z) == BlockId.Water) carved++;
                }
            }
            Assert.Greater(carved, 200, "expected tunnels and caverns below the surface");
        }

        [Test]
        public void Ores_ReplaceStoneWithinTheirDepthBands()
        {
            int coal = 0, diamonds = 0;
            for (int i = 0; i < 6; i++)
            {
                var col = TestGen.Generate(new int2(i * 3, -i), Seed, false);
                for (int y = MinWorldY; y < MaxWorldY; y++)
                for (int z = 0; z < ChunkSize; z++)
                for (int x = 0; x < ChunkSize; x++)
                {
                    ushort b = col.At(x, y, z);
                    if (b == BlockId.CoalOre) coal++;
                    if (b == BlockId.DiamondOre) { diamonds++; Assert.Less(y, -30, "diamonds only deep"); }
                    if (b == BlockId.GoldOre) Assert.Less(y, 10);
                }
            }
            Assert.Greater(coal, 100);
            Assert.Greater(diamonds, 0);
        }

        [Test]
        public void ForestColumns_GrowTreesAndPlants()
        {
            var c = TestGen.FindColumn(Seed, s => s.Biome == Biome.DenseForest);
            var col = TestGen.Generate(c, Seed);
            int logs = col.Voxels.Count(b => b == BlockId.OakLog || b == BlockId.BirchLog);
            int leaves = col.Voxels.Count(b => b == BlockId.OakLeaves || b == BlockId.BirchLeaves);
            Assert.Greater(logs, 10);
            Assert.Greater(leaves, 100);
        }

        [Test]
        public void Terrain_CoversTheMainBiomes()
        {
            var seen = new HashSet<Biome>();
            float min = float.MaxValue, max = float.MinValue;
            for (int z = -6000; z <= 6000; z += 60)
            for (int x = -6000; x <= 6000; x += 60)
            {
                var s = TerrainNoise.SampleSurface(new float2(x, z), Seed);
                seen.Add(s.Biome);
                min = math.min(min, s.Height);
                max = math.max(max, s.Height);
            }
            var required = new[]
            {
                Biome.Ocean, Biome.Beach, Biome.River, Biome.Plains, Biome.Forest, Biome.DenseForest, Biome.Jungle,
                Biome.Desert, Biome.Badlands, Biome.Swamp, Biome.Taiga, Biome.Mountains, Biome.SnowyPeaks,
            };
            foreach (var b in required) Assert.IsTrue(seen.Contains(b), $"{b} never generated; saw {string.Join(",", seen)}");
            Assert.IsTrue(seen.Contains(Biome.SnowyTundra) || seen.Contains(Biome.SnowyTaiga), "no snowy lowland biome");
            Assert.Less(min, SeaLevel - 10, "expected ocean basins");
            Assert.Greater(max, SeaLevel + 60, "expected mountains");
        }
    }

    public class ModifiedChunkStoreTests
    {
        [Test]
        public void RunLengthRoundTrip()
        {
            using var dst = new NativeArray<ushort>(ChunkVolume, Allocator.Temp);
            var rng = new Unity.Mathematics.Random(7);
            var s = new NativeArray<ushort>(ChunkVolume, Allocator.Temp);
            for (int i = 0; i < ChunkVolume; i++) s[i] = (ushort)(i < 20000 ? BlockId.Stone : rng.NextInt(0, 4));
            var store = new ModifiedChunkStore();
            store.Store(new int3(1, 2, 3), s);
            Assert.IsTrue(store.TryRestore(new int3(1, 2, 3), dst));
            CollectionAssert.AreEqual(s.ToArray(), dst.ToArray());
            Assert.IsFalse(store.TryRestore(new int3(0, 0, 0), dst));
            s.Dispose();
        }
    }
}
