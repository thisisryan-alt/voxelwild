using System;
using System.Linq;
using NUnit.Framework;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using Voxelwild.EditorTools;
using Voxelwild.World;
using Voxelwild.World.Generation;
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
        public void SectionRange_CoversWorldHeight()
        {
            Assert.AreEqual(MinWorldY, MinSectionY * ChunkSize);
            Assert.AreEqual(MaxWorldY, MinWorldY + SectionsPerColumn * ChunkSize);
            Assert.That(SeaLevel, Is.InRange(MinWorldY, MaxWorldY - 1));
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
        public void OpaqueBlocksHaveTextureLayers()
        {
            for (ushort i = 0; i < BlockId.Count; i++)
            {
                var d = BlockRegistry.Get(i);
                if (!d.Has(BlockFlags.Opaque)) continue;
                Assert.AreNotEqual(TextureLayer.None, d.Top, BlockRegistry.Name(i));
                Assert.AreNotEqual(TextureLayer.None, d.Side, BlockRegistry.Name(i));
                Assert.AreNotEqual(TextureLayer.None, d.Bottom, BlockRegistry.Name(i));
            }
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

    public class GenerationTests
    {
        static ushort[] GenerateColumn(int2 column, uint seed)
        {
            var surface = new NativeArray<ColumnSurface>(ChunkArea, Allocator.TempJob);
            var voxels = new NativeArray<ushort>(ChunkVolume, Allocator.TempJob);
            var stats = new NativeArray<int>(2, Allocator.TempJob);
            var all = new ushort[ChunkVolume * SectionsPerColumn];
            try
            {
                new ColumnSurfaceJob { Column = column, Seed = seed, Surface = surface }.Run();
                for (int s = 0; s < SectionsPerColumn; s++)
                {
                    new SectionFillJob
                    {
                        Section = new int3(column.x, MinSectionY + s, column.y),
                        Seed = seed, Surface = surface, Voxels = voxels, Stats = stats,
                    }.Run();
                    NativeArray<ushort>.Copy(voxels, 0, all, s * ChunkVolume, ChunkVolume);
                }
            }
            finally
            {
                surface.Dispose();
                voxels.Dispose();
                stats.Dispose();
            }
            return all;
        }

        static ushort At(ushort[] col, int x, int wy, int z)
        {
            int s = (wy - MinWorldY) >> ChunkSizeLog2;
            return col[s * ChunkVolume + Index(x, (wy - MinWorldY) & ChunkMask, z)];
        }

        [Test]
        public void SameSeed_IsDeterministic()
        {
            CollectionAssert.AreEqual(GenerateColumn(new int2(3, -7), 42), GenerateColumn(new int2(3, -7), 42));
        }

        [Test]
        public void DifferentSeeds_Differ()
        {
            CollectionAssert.AreNotEqual(GenerateColumn(new int2(0, 0), 1), GenerateColumn(new int2(0, 0), 2));
        }

        [Test]
        public void Column_HasBedrockFloorAndLayeredSurface()
        {
            var col = GenerateColumn(new int2(5, 5), 1234);
            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                Assert.AreEqual(BlockId.Bedrock, At(col, x, MinWorldY, z));

                int top = MaxWorldY - 1;
                while (top > MinWorldY && (At(col, x, top, z) == BlockId.Air || At(col, x, top, z) == BlockId.Water)) top--;
                Assert.Greater(top, MinWorldY + 4, "terrain surface should be well above bedrock");

                // air is never below sea level and water never above it
                for (int y = top + 1; y < MaxWorldY; y++)
                {
                    var b = At(col, x, y, z);
                    Assert.AreEqual(y <= SeaLevel ? BlockId.Water : BlockId.Air, b, $"({x},{y},{z})");
                }
                // grass only on top and never under water
                var t = At(col, x, top, z);
                if (t == BlockId.Grass) Assert.GreaterOrEqual(top, SeaLevel);
            }
        }

        [Test]
        public void Terrain_HasOceansAndMountains()
        {
            float min = float.MaxValue, max = float.MinValue;
            for (int z = -2000; z <= 2000; z += 40)
            for (int x = -2000; x <= 2000; x += 40)
            {
                float h = TerrainNoise.SurfaceHeight(new float2(x, z), 20260924);
                min = math.min(min, h);
                max = math.max(max, h);
            }
            Assert.Less(min, SeaLevel - 10, "expected ocean basins");
            Assert.Greater(max, SeaLevel + 60, "expected mountains");
            Assert.Less(max, MaxWorldY);
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
