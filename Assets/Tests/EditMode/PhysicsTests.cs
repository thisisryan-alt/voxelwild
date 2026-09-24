using NUnit.Framework;
using Unity.Mathematics;
using Voxelwild.Player;
using Voxelwild.World;

namespace Voxelwild.Tests
{
    public class VoxelRaycastTests
    {
        [Test]
        public void HitsFirstSolidBlock_WithFaceNormal()
        {
            var w = new FakeVoxelWorld();
            w.Set(new int3(0, 0, 5), BlockId.Stone);
            w.Set(new int3(0, 0, 8), BlockId.Stone);
            Assert.IsTrue(VoxelRaycast.Cast(w, new float3(0.5f, 0.5f, 0.5f), new float3(0, 0, 1), 10f, out var hit));
            Assert.AreEqual(new int3(0, 0, 5), hit.Block);
            Assert.AreEqual(new int3(0, 0, -1), hit.Normal);
            Assert.AreEqual(new int3(0, 0, 4), hit.Adjacent);
            Assert.AreEqual(4.5f, hit.Distance, 1e-4f);
        }

        [Test]
        public void PassesThroughWater_AndRespectsRange()
        {
            var w = new FakeVoxelWorld();
            w.Set(new int3(2, 0, 0), BlockId.Water);
            w.Set(new int3(4, 0, 0), BlockId.Dirt);
            Assert.IsTrue(VoxelRaycast.Cast(w, new float3(0.5f, 0.5f, 0.5f), new float3(1, 0, 0), 6f, out var hit));
            Assert.AreEqual(new int3(4, 0, 0), hit.Block);
            Assert.IsFalse(VoxelRaycast.Cast(w, new float3(0.5f, 0.5f, 0.5f), new float3(1, 0, 0), 3f, out _));
        }

        [Test]
        public void DiagonalRay_HitsCorrectFace()
        {
            var w = new FakeVoxelWorld();
            w.Fill(new int3(-5, -1, -5), new int3(5, -1, 5), BlockId.Grass);
            Assert.IsTrue(VoxelRaycast.Cast(w, new float3(0.2f, 1.7f, 0.3f), new float3(0.3f, -1f, 0.4f), 8f, out var hit));
            Assert.AreEqual(-1, hit.Block.y);
            Assert.AreEqual(new int3(0, 1, 0), hit.Normal);
        }
    }

    public class VoxelBodyTests
    {
        static FakeVoxelWorld Floor()
        {
            var w = new FakeVoxelWorld();
            w.Fill(new int3(-8, -1, -8), new int3(8, -1, 8), BlockId.Stone);
            return w;
        }

        [Test]
        public void FallingBody_LandsOnFloor()
        {
            var w = Floor();
            var b = new VoxelBody { Position = new float3(0.5f, 5f, 0.5f) };
            b.Move(w, new float3(0, -20f, 0));
            Assert.IsTrue(b.Grounded);
            Assert.AreEqual(0f, b.Position.y, 0.01f);
            Assert.GreaterOrEqual(b.Position.y, 0f);
        }

        [Test]
        public void RestingBody_StaysGroundedAndDoesNotSink()
        {
            var w = Floor();
            var b = new VoxelBody { Position = new float3(0.5f, 5f, 0.5f) };
            b.Move(w, new float3(0, -20f, 0));
            for (int i = 0; i < 100; i++)
            {
                b.Move(w, new float3(0, -0.5f, 0));
                Assert.IsTrue(b.Grounded);
            }
            Assert.AreEqual(0f, b.Position.y, 0.01f);
            Assert.IsTrue(b.ProbeGround(w));
        }

        [Test]
        public void Wall_BlocksHorizontalMotion_AndBodyCanSlideAlongIt()
        {
            var w = Floor();
            w.Fill(new int3(2, 0, -8), new int3(2, 3, 8), BlockId.Stone);
            var b = new VoxelBody { Position = new float3(0.5f, 0f, 0.5f) };
            var moved = b.Move(w, new float3(5f, 0, 3f));
            Assert.IsTrue(b.HitWall);
            Assert.LessOrEqual(b.Max.x, 2f);
            Assert.AreEqual(2f - b.HalfWidth, b.Position.x, 0.01f);
            Assert.AreEqual(3f, moved.z, 1e-4f, "motion along the wall is preserved");
        }

        [Test]
        public void Ceiling_StopsJump()
        {
            var w = Floor();
            w.Set(new int3(0, 2, 0), BlockId.Stone);
            var b = new VoxelBody { Position = new float3(0.5f, 0f, 0.5f), Velocity = new float3(0, 5, 0) };
            b.Move(w, new float3(0, 1f, 0));
            Assert.IsTrue(b.HitCeiling);
            Assert.LessOrEqual(b.Max.y, 2f);
            Assert.AreEqual(0f, b.Velocity.y);
        }

        [Test]
        public void TwoHighGap_IsPassable_OneHighIsNot()
        {
            var w = Floor();
            // tunnel along +x: ceiling at y=2 leaves a 2-block gap (body is 1.8 tall)
            w.Fill(new int3(1, 2, -1), new int3(6, 2, 1), BlockId.Stone);
            var b = new VoxelBody { Position = new float3(0.5f, 0f, 0.5f) };
            b.Move(w, new float3(4f, 0, 0));
            Assert.AreEqual(4.5f, b.Position.x, 1e-3f);

            w.Fill(new int3(7, 1, -1), new int3(7, 1, 1), BlockId.Stone);   // 1-high opening at x=7
            b.Move(w, new float3(4f, 0, 0));
            Assert.LessOrEqual(b.Max.x, 7f);
        }

        [Test]
        public void Overlaps_DetectsPlacementIntoBody()
        {
            var b = new VoxelBody { Position = new float3(0.5f, 0f, 0.5f) };
            Assert.IsTrue(b.Overlaps(new int3(0, 0, 0)));
            Assert.IsTrue(b.Overlaps(new int3(0, 1, 0)));
            Assert.IsFalse(b.Overlaps(new int3(0, 2, 0)));
            Assert.IsFalse(b.Overlaps(new int3(1, 0, 0)));
            Assert.IsFalse(b.Overlaps(new int3(0, -1, 0)));
        }
    }
}
