using System.Linq;
using NUnit.Framework;
using Unity.Collections;
using Unity.Collections.LowLevel.Unsafe;
using Unity.Jobs;
using Unity.Mathematics;
using Voxelwild.World;
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
            for (int i = 0; i < PaddedVolume; i++) _buffers.Padded[i] = BlockId.Air;
        }

        [TearDown]
        public void TearDown()
        {
            _blocks.Dispose();
            _buffers.Dispose();
        }

        void Set(int x, int y, int z, ushort id) => _buffers.Padded[PaddedIndex(x, y, z)] = id;

        TerrainVertex[] Mesh()
        {
            _buffers.CreateJob(_blocks).Run();
            return _buffers.Vertices.AsArray().ToArray();
        }

        [Test]
        public void SingleBlock_HasSixExposedFaces()
        {
            Set(5, 5, 5, BlockId.Stone);
            var v = Mesh();
            Assert.AreEqual(24, v.Length);
            Assert.AreEqual(36, _buffers.OpaqueIndices.Length);
            Assert.AreEqual(0, _buffers.WaterIndices.Length);
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
            // the top face of the left block continues into the right block along +X (= +T for +Y faces)
            var quads = Enumerable.Range(0, v.Length / 4).Select(q => v.Skip(q * 4).Take(4).ToArray());
            var topLeft = quads.Single(q => q[0].Face == Faces.PosY && q.All(x => x.Position.x <= 6f));
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
                float3 expected = (float3)Faces.Normal(v[idx[t]].Face);
                Assert.Greater(math.dot(n, expected), 0.99f, $"triangle {t / 3} faces inward");
            }
        }

        [Test]
        public void BlockInCorner_GetsAmbientOcclusion()
        {
            // floor block with two walls meeting above its (+x,+z) corner
            Set(5, 5, 5, BlockId.Stone);
            Set(6, 6, 5, BlockId.Stone);
            Set(5, 6, 6, BlockId.Stone);
            var v = Mesh();
            var top = v.Where(x => x.Face == Faces.PosY && math.all(x.Position.xz >= 5f) && math.all(x.Position.xz <= 6f) && x.Position.y == 6f).ToArray();
            Assert.AreEqual(4, top.Length);
            var corner = top.Single(x => x.Position.x == 6f && x.Position.z == 6f);
            Assert.AreEqual(0, corner.AO, "two occluding sides give full occlusion");
            var open = top.Single(x => x.Position.x == 5f && x.Position.z == 5f);
            Assert.AreEqual(3, open.AO);
        }

        [Test]
        public void GrassSides_CarryOverlay_TopAndBottomDoNot()
        {
            Set(5, 5, 5, BlockId.Grass);
            var v = Mesh();
            foreach (var x in v)
            {
                if (x.Face == Faces.PosY) { Assert.AreEqual((int)TextureLayer.GrassTop, x.Layer); Assert.AreEqual(255, x.Overlay); }
                else if (x.Face == Faces.NegY) { Assert.AreEqual((int)TextureLayer.Dirt, x.Layer); Assert.AreEqual(255, x.Overlay); }
                else { Assert.AreEqual((int)TextureLayer.Dirt, x.Layer); Assert.AreEqual((int)TextureLayer.GrassTop, x.Overlay); }
            }
        }

        [Test]
        public void Water_OnlyFacesAirAndIsLowered()
        {
            Set(5, 5, 5, BlockId.Water);
            Set(6, 5, 5, BlockId.Water);
            Set(5, 4, 5, BlockId.Stone);
            Set(6, 4, 5, BlockId.Stone);
            Mesh();
            var v = _buffers.Vertices.AsArray().ToArray();
            var water = _buffers.WaterIndices.AsArray().ToArray().Distinct().Select(i => v[i]).ToArray();
            // 2 blocks: tops 2, sides: -x, +x ends + 2x front/back = 6 faces, no bottoms (stone), no shared face
            Assert.AreEqual(8 * 4, water.Length);
            Assert.IsTrue(water.Where(x => x.Face == Faces.PosY).All(x => x.Position.y < 6f && x.Position.y > 5.8f));
        }

        [Test]
        public unsafe void NeighborhoodBuilder_MapsNeighbourShells()
        {
            var centre = new NativeArray<ushort>(ChunkVolume, Allocator.Temp);
            var east = new NativeArray<ushort>(ChunkVolume, Allocator.Temp);
            centre[Index(31, 7, 9)] = BlockId.Bricks;
            east[Index(0, 7, 9)] = BlockId.Planks;
            ushort** sources = stackalloc ushort*[27];
            ushort* uniform = stackalloc ushort[27];
            for (int i = 0; i < 27; i++) { sources[i] = null; uniform[i] = BlockId.Stone; }
            uniform[1 + 1 * 3 + 2 * 9] = BlockId.Air;              // above: air
            sources[1 + 1 * 3 + 1 * 9] = (ushort*)centre.GetUnsafePtr();
            sources[2 + 1 * 3 + 1 * 9] = (ushort*)east.GetUnsafePtr();
            _buffers.FillPadded(sources, uniform);

            Assert.AreEqual(BlockId.Bricks, _buffers.Padded[PaddedIndex(31, 7, 9)]);
            Assert.AreEqual(BlockId.Planks, _buffers.Padded[PaddedIndex(32, 7, 9)]);
            Assert.AreEqual(BlockId.Air, _buffers.Padded[PaddedIndex(5, 32, 5)]);
            Assert.AreEqual(BlockId.Stone, _buffers.Padded[PaddedIndex(-1, -1, -1)]);
            centre.Dispose();
            east.Dispose();
        }
    }
}
