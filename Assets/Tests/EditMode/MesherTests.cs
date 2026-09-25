using System.Linq;
using NUnit.Framework;
using Unity.Collections;
using Unity.Collections.LowLevel.Unsafe;
using Unity.Jobs;
using Unity.Mathematics;
using Voxelwild.World;
using Voxelwild.World.Generation;
using Voxelwild.World.Meshing;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.Tests
{
    public class MesherTests
    {
        NativeArray<BlockDefinition> _blocks;
        MeshJobBuffers _buffers;

        [SetUp]
        public void SetUp()
        {
            _blocks = BlockRegistry.CreateNative(Allocator.Persistent);
            _buffers = new MeshJobBuffers();
            for (int i = 0; i < RegionVolume; i++) _buffers.Region[i] = BlockId.Air;
            for (int i = 0; i < RegionArea; i++)
            {
                _buffers.HeightPatch[i] = MinWorldY - 1;   // open sky everywhere
                _buffers.ClimatePatch[i] = 128 | (128 << 8);
            }
        }

        [TearDown]
        public void TearDown()
        {
            _blocks.Dispose();
            _buffers.Dispose();
        }

        // Section (0,0,0): section-local == world coordinates.
        void Set(int x, int y, int z, ushort id)
        {
            _buffers.Region[RegionIndex(x, y, z)] = id;
            var d = BlockRegistry.Get(id);
            int hi = (x + RegionMargin) + (z + RegionMargin) * RegionSize;
            if (d.LightOpacity > 0 && y > _buffers.HeightPatch[hi]) _buffers.HeightPatch[hi] = y;
        }

        TerrainVertex[] Mesh()
        {
            _buffers.CreateJob(int3.zero, _blocks).Run();
            return _buffers.Vertices.AsArray().ToArray();
        }

        static TerrainVertex[][] Quads(TerrainVertex[] v) =>
            Enumerable.Range(0, v.Length / 4).Select(q => v.Skip(q * 4).Take(4).ToArray()).ToArray();

        [Test]
        public void SingleBlock_HasSixExposedFaces()
        {
            Set(5, 5, 5, BlockId.Stone);
            var v = Mesh();
            Assert.AreEqual(24, v.Length);
            Assert.AreEqual(36, _buffers.OpaqueIndices.Length);
            Assert.AreEqual(0, _buffers.WaterIndices.Length + _buffers.CutoutIndices.Length);
            Assert.IsTrue(v.All(x => x.Edges == 15), "every edge of a lone block is convex");
            Assert.IsTrue(v.All(x => x.AO == 3), "nothing occludes a lone block");
            Assert.IsTrue(v.All(x => x.Layer == (int)TextureLayer.Stone));
            CollectionAssert.AreEquivalent(new[] { 0, 1, 2, 3, 4, 5 }, v.Select(x => x.Face).Distinct());
        }

        [Test]
        public void AdjacentBlocks_CullSharedFaces_AndMarkCoplanarEdges()
        {
            Set(5, 5, 5, BlockId.Stone);
            Set(6, 5, 5, BlockId.Stone);
            var v = Mesh();
            Assert.AreEqual(10 * 4, v.Length);
            var topLeft = Quads(v).Single(q => q[0].Face == Faces.PosY && q.All(x => x.Position.x <= 6f));
            Assert.AreEqual(0, topLeft[0].Edges & 2, "+T edge should not be bevelled");
            Assert.AreNotEqual(0, topLeft[0].Edges & 1, "-T edge is exposed");
        }

        [Test]
        public void FaceWinding_PointsOutward()
        {
            Set(5, 5, 5, BlockId.Stone);
            var v = Mesh();
            var idx = _buffers.OpaqueIndices.AsArray().ToArray();
            for (int t = 0; t < idx.Length; t += 3)
            {
                float3 a = v[idx[t]].Position, b = v[idx[t + 1]].Position, c = v[idx[t + 2]].Position;
                // Unity front faces are clockwise as seen from outside, which in its left-handed
                // world space makes cross(b-a, c-a) point along the outward face normal.
                float3 n = math.normalize(math.cross(b - a, c - a));
                Assert.Greater(math.dot(n, (float3)Faces.Normal(v[idx[t]].Face)), 0.99f, $"triangle {t / 3} faces inward");
            }
        }

        [Test]
        public void BlockInCorner_GetsAmbientOcclusion()
        {
            Set(5, 5, 5, BlockId.Stone);
            Set(6, 6, 5, BlockId.Stone);
            Set(5, 6, 6, BlockId.Stone);
            var v = Mesh();
            var top = v.Where(x => x.Face == Faces.PosY && math.all(x.Position.xz >= 5f) && math.all(x.Position.xz <= 6f) && x.Position.y == 6f).ToArray();
            Assert.AreEqual(4, top.Length);
            Assert.AreEqual(0, top.Single(x => x.Position.x == 6f && x.Position.z == 6f).AO, "two occluding sides give full occlusion");
            Assert.AreEqual(3, top.Single(x => x.Position.x == 5f && x.Position.z == 5f).AO);
        }

        [Test]
        public void GrassSides_CarryOverlay_TopAndBottomDoNot()
        {
            Set(5, 5, 5, BlockId.Grass);
            foreach (var x in Mesh())
            {
                if (x.Face == Faces.PosY) { Assert.AreEqual((int)TextureLayer.GrassTop, x.Layer); Assert.AreEqual(255, x.Overlay); }
                else if (x.Face == Faces.NegY) { Assert.AreEqual((int)TextureLayer.Dirt, x.Layer); Assert.AreEqual(255, x.Overlay); }
                else { Assert.AreEqual((int)TextureLayer.Dirt, x.Layer); Assert.AreEqual((int)TextureLayer.GrassTop, x.Overlay); }
                Assert.AreEqual((int)TintMode.Grass, x.Tint);
            }
        }

        [Test]
        public void Water_OnlyFacesAirAndIsLowered()
        {
            Set(5, 5, 5, BlockId.Water);
            Set(6, 5, 5, BlockId.Water);
            Set(5, 4, 5, BlockId.Stone);
            Set(6, 4, 5, BlockId.Stone);
            var v = Mesh();
            var water = _buffers.WaterIndices.AsArray().ToArray().Distinct().Select(i => v[i]).ToArray();
            Assert.AreEqual(8 * 4, water.Length);
            Assert.IsTrue(water.Where(x => x.Face == Faces.PosY).All(x => x.Position.y < 6f && x.Position.y > 5.8f));
        }

        [Test]
        public void FlowingWater_SlopesDownhill_AndCarriesItsFlowDirection()
        {
            // a source feeding a level-4 flow along +x, in a stone channel
            for (int x = 4; x <= 7; x++)
            {
                Set(x, 4, 5, BlockId.Stone);
                Set(x, 5, 4, BlockId.Stone);
                Set(x, 5, 6, BlockId.Stone);
            }
            Set(4, 5, 5, BlockId.Stone);
            Set(5, 5, 5, BlockId.Water);
            Set(6, 5, 5, BlockId.WaterOfLevel(4));
            var v = Mesh();
            var tops = _buffers.WaterIndices.AsArray().ToArray().Distinct().Select(i => v[i]).Where(x => x.Face == Faces.PosY).ToArray();
            Assert.AreEqual(8, tops.Length, "two top quads");
            const float source = 0.88f, flowing = 0.44f;
            foreach (var x in tops)
            {
                float expected = x.Position.x < 5.5f ? source : x.Position.x > 6.5f ? flowing : (source + flowing) / 2f;
                Assert.AreEqual(5f + expected, x.Position.y, 1e-4f, $"corner at x={x.Position.x}");
            }
            Assert.IsTrue(tops.Where(x => x.Position.x < 6.5f).All(x => x.FlowX > 20 && math.abs(x.FlowZ) < 3), "source flows toward +x");
        }

        [Test]
        public void Plants_AreTwoCrossedCutoutQuads_WithRootsAnchored()
        {
            Set(5, 4, 5, BlockId.Grass);
            Set(5, 5, 5, BlockId.TallGrass);
            var v = Mesh();
            var plant = _buffers.CutoutIndices.AsArray().ToArray().Distinct().Select(i => v[i]).ToArray();
            Assert.AreEqual(8, plant.Length);
            Assert.IsTrue(plant.All(x => x.Face == Faces.CrossA || x.Face == Faces.CrossB));
            Assert.IsTrue(plant.Where(x => x.Position.y == 5f).All(x => x.Wind == 0), "roots must not sway");
            Assert.IsTrue(plant.Where(x => x.Position.y > 5.5f).All(x => x.Wind > 0));
            // the grass top under the plant is still drawn (plants don't hide faces)
            Assert.IsTrue(v.Any(x => x.Face == Faces.PosY && x.Position.y == 5f && x.Layer == (int)TextureLayer.GrassTop));
        }

        [Test]
        public void Leaves_AreCutout_AndDoNotHideNeighbourFaces()
        {
            Set(5, 5, 5, BlockId.OakLeaves);
            Set(6, 5, 5, BlockId.OakLeaves);
            Mesh();
            Assert.AreEqual(0, _buffers.OpaqueIndices.Length);
            Assert.AreEqual(12 * 6, _buffers.CutoutIndices.Length, "fancy leaves: inner faces are kept");
        }

        [Test]
        public void DistantLeaves_DropInnerFaces()
        {
            Set(5, 5, 5, BlockId.OakLeaves);
            Set(6, 5, 5, BlockId.OakLeaves);
            _buffers.CreateJob(int3.zero, _blocks, fancyLeaves: false).Run();
            Assert.AreEqual(10 * 6, _buffers.CutoutIndices.Length);
            Assert.AreEqual(2, _buffers.Stats[0]);
        }

        // ------------------------------------------------------------------ lighting

        int LightAt(int x, int y, int z, bool sky) => sky ? _buffers.Sky[RegionIndex(x, y, z)] : _buffers.BlockLight[RegionIndex(x, y, z)];

        [Test]
        public void OpenSky_IsFullyLit_EnclosedPocketIsDark()
        {
            // a sealed 3x3x3 room of stone with air inside, under open sky
            for (int y = 2; y <= 6; y++)
            for (int z = 2; z <= 6; z++)
            for (int x = 2; x <= 6; x++)
                Set(x, y, z, y == 2 || y == 6 || x == 2 || x == 6 || z == 2 || z == 6 ? BlockId.Stone : BlockId.Air);
            var v = Mesh();
            Assert.AreEqual(MaxLight, LightAt(4, 7, 4, true));
            Assert.AreEqual(0, LightAt(4, 4, 4, true), "sealed pocket receives no sky light");
            var roof = v.Where(x => x.Face == Faces.PosY && x.Position.y == 7f).ToArray();
            Assert.IsTrue(roof.All(x => x.SkyLight == MaxLight));
            var inner = v.Where(x => x.Face == Faces.PosY && x.Position.y == 3f).ToArray();
            Assert.IsTrue(inner.Length > 0 && inner.All(x => x.SkyLight == 0));
        }

        [Test]
        public void SkyLight_LeaksUnderOverhang_AndFallsOff()
        {
            // a roof slab at y=10 over x in [0,10]; floor at y=0
            for (int z = 0; z < 20; z++)
            for (int x = 0; x < 20; x++)
            {
                Set(x, 0, z, BlockId.Stone);
                if (x <= 10) Set(x, 10, z, BlockId.Stone);
            }
            Mesh();
            Assert.AreEqual(MaxLight, LightAt(15, 1, 5, true));
            Assert.AreEqual(MaxLight - 1, LightAt(10, 5, 5, true), "one step in from the open side");
            Assert.AreEqual(MaxLight - 6, LightAt(5, 5, 5, true));
        }

        [Test]
        public void Leaves_DimSkyLightBeneath()
        {
            for (int z = 0; z < 5; z++)
            for (int x = 0; x < 5; x++)
            {
                Set(x, 0, z, BlockId.Grass);
                Set(x, 8, z, BlockId.OakLeaves);
                Set(x, 9, z, BlockId.OakLeaves);
            }
            Mesh();
            int under = LightAt(2, 3, 2, true);
            Assert.Less(under, MaxLight);
            Assert.Greater(under, 8, "a thin canopy shades but doesn't black out");
        }

        [Test]
        public void Torch_EmitsBlockLight_ThatFallsOffWithDistance()
        {
            for (int z = -10; z < 30; z++)
            for (int x = -10; x < 30; x++)
                Set(x, 0, z, BlockId.Stone);
            Set(10, 1, 10, BlockId.Torch);
            var v = Mesh();
            int e = BlockRegistry.Get(BlockId.Torch).LightEmission;
            Assert.AreEqual(e, LightAt(10, 1, 10, false));
            Assert.AreEqual(e - 3, LightAt(13, 1, 10, false));
            Assert.AreEqual(e - 5, LightAt(12, 1, 7, false));
            Assert.AreEqual(0, LightAt(28, 1, 28, false));
            var nearFloor = v.Where(x => x.Face == Faces.PosY && x.Position.y == 1f && math.distance(x.Position.xz, new float2(10.5f, 10.5f)) < 1.2f);
            Assert.IsTrue(nearFloor.All(x => x.BlockLight >= e - 2));
        }

        [Test]
        public unsafe void NeighborhoodBuilder_MapsNeighbourShells()
        {
            var centre = new NativeArray<ushort>(ChunkVolume, Allocator.Temp);
            var east = new NativeArray<ushort>(ChunkVolume, Allocator.Temp);
            var hm = new NativeArray<int>(ChunkArea, Allocator.Temp);
            centre[Index(31, 7, 9)] = BlockId.Bricks;
            east[Index(15, 7, 9)] = BlockId.Planks;
            hm[3 + 4 * ChunkSize] = 77;
            ushort** sources = stackalloc ushort*[27];
            ushort* uniform = stackalloc ushort[27];
            int** heights = stackalloc int*[9];
            ColumnSurface** surfaces = stackalloc ColumnSurface*[9];
            for (int i = 0; i < 27; i++) { sources[i] = null; uniform[i] = BlockId.Stone; }
            for (int i = 0; i < 9; i++) { heights[i] = null; surfaces[i] = null; }
            uniform[1 + 1 * 3 + 2 * 9] = BlockId.Air;
            sources[1 + 1 * 3 + 1 * 9] = (ushort*)centre.GetUnsafePtr();
            sources[2 + 1 * 3 + 1 * 9] = (ushort*)east.GetUnsafePtr();
            heights[1 + 1 * 3] = (int*)hm.GetUnsafePtr();
            _buffers.Fill(sources, uniform, heights, surfaces);

            Assert.AreEqual(BlockId.Bricks, _buffers.Region[RegionIndex(31, 7, 9)]);
            Assert.AreEqual(BlockId.Planks, _buffers.Region[RegionIndex(47, 7, 9)]);
            Assert.AreEqual(BlockId.Air, _buffers.Region[RegionIndex(5, 40, 5)]);
            Assert.AreEqual(BlockId.Stone, _buffers.Region[RegionIndex(-16, -16, -16)]);
            Assert.AreEqual(77, _buffers.HeightPatch[(3 + RegionMargin) + (4 + RegionMargin) * RegionSize]);
            Assert.AreEqual(MinWorldY - 1, _buffers.HeightPatch[0], "missing columns count as open sky");
            centre.Dispose();
            east.Dispose();
            hm.Dispose();
        }
    }
}
