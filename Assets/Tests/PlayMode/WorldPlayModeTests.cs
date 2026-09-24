using System.Collections;
using NUnit.Framework;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Voxelwild.Player;
using Voxelwild.World;

namespace Voxelwild.Tests
{
    /// <summary>Loads the real World scene and exercises streaming, physics and block editing together.</summary>
    public class WorldPlayModeTests
    {
        VoxelWorld _world;
        PlayerController _player;
        BlockInteractor _interactor;

        [UnitySetUp]
        public IEnumerator LoadWorld()
        {
            yield return SceneManager.LoadSceneAsync("World", LoadSceneMode.Single);
            _world = Object.FindFirstObjectByType<VoxelWorld>();
            _player = Object.FindFirstObjectByType<PlayerController>();
            _interactor = Object.FindFirstObjectByType<BlockInteractor>();
            Assert.IsNotNull(_world);
            Assert.IsNotNull(_player);
            _player.InputEnabled = false;

            float start = Time.realtimeSinceStartup;
            while (!_player.Spawned)
            {
                Assert.Less(Time.realtimeSinceStartup - start, 120f, "spawn area not ready within 120 s");
                yield return null;
            }
        }

        [UnityTest]
        public IEnumerator Player_SpawnsOnDryLand_AndStandsOnTerrain()
        {
            _player.InputEnabled = true;   // let gravity run (no devices -> no movement)
            for (int i = 0; i < 90; i++) yield return null;
            var feet = _player.Body.Position;
            Assert.IsTrue(_player.Body.ProbeGround(_world), $"player at {feet} should be standing on ground");
            Assert.IsFalse(_player.InWater);
            Assert.Greater(feet.y, VoxelConstants.SeaLevel);
            var below = _world.GetBlockOrAir((int3)math.floor(feet - new float3(0, 0.5f, 0)));
            Assert.IsTrue(BlockRegistry.Get(below).Has(BlockFlags.Solid), $"block under feet is {BlockRegistry.Name(below)}");
        }

        [UnityTest]
        public IEnumerator PlaceAndBreak_UpdatesWorldAndMesh()
        {
            var cell = (int3)math.floor(_player.Body.Position) + new int3(3, 3, 0);
            Assert.IsTrue(_world.TryGetBlock(cell, out var before));
            Assert.AreEqual(BlockId.Air, before);

            int trisBefore = SectionTriangles(cell);
            Assert.IsTrue(_interactor.TryPlace(cell, BlockId.Bricks));
            Assert.IsTrue(_world.TryGetBlock(cell, out var placed));
            Assert.AreEqual(BlockId.Bricks, placed);
            Assert.AreEqual(trisBefore + 12, SectionTriangles(cell), "a floating block adds 6 quads immediately");
            yield return null;

            Assert.IsTrue(_interactor.TryBreak(cell));
            Assert.IsTrue(_world.TryGetBlock(cell, out var after));
            Assert.AreEqual(BlockId.Air, after);
            Assert.AreEqual(trisBefore, SectionTriangles(cell));
        }

        [UnityTest]
        public IEnumerator CannotPlaceBlockInsidePlayer()
        {
            var feet = (int3)math.floor(_player.Body.Position);
            Assert.IsFalse(_interactor.TryPlace(feet + new int3(0, 1, 0), BlockId.Stone));
            yield return null;
        }

        int SectionTriangles(int3 world)
        {
            var s = _world.GetSection(VoxelConstants.WorldToSection(world));
            if (s?.Mesh == null || s.Go == null || !s.Go.activeSelf) return 0;
            return (int)(s.Mesh.GetSubMesh(0).indexCount / 3);
        }
    }
}
