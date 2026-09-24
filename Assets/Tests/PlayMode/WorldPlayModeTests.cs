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
            _world = Object.FindAnyObjectByType<VoxelWorld>();
            _player = Object.FindAnyObjectByType<PlayerController>();
            _interactor = Object.FindAnyObjectByType<BlockInteractor>();
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
            // find a cell whose six neighbours are all air (spawns can be in forests)
            var cell = (int3)math.floor(_player.Body.Position) + new int3(3, 3, 0);
            for (int i = 0; i < 64 && !OpenCell(cell); i++) cell.y++;
            Assert.IsTrue(OpenCell(cell), "no open air cell above spawn");
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

        bool OpenCell(int3 c)
        {
            if (_world.GetBlockOrAir(c) != BlockId.Air) return false;
            for (int f = 0; f < 6; f++)
                if (_world.GetBlockOrAir(c + Faces.Normal(f)) != BlockId.Air) return false;
            return true;
        }

        [UnityTest]
        public IEnumerator Torch_NeedsSupport_AndDropsWithIt()
        {
            var feet = (int3)math.floor(_player.Body.Position);
            // an opaque block with air above, scanning down from well above the player
            var ground = feet + new int3(2, 20, 0);
            for (int i = 0; i < 60; i++, ground.y--)
                if (BlockRegistry.Get(_world.GetBlockOrAir(ground)).Has(BlockFlags.Opaque)
                    && _world.GetBlockOrAir(ground + new int3(0, 1, 0)) == BlockId.Air) break;
            Assert.IsTrue(BlockRegistry.Get(_world.GetBlockOrAir(ground)).Has(BlockFlags.Opaque), "no ground found");
            var torch = ground + new int3(0, 1, 0);
            Assert.IsFalse(_interactor.TryPlace(torch + new int3(0, 1, 0), BlockId.Torch), "torch needs a solid block below");
            Assert.IsTrue(_interactor.TryPlace(torch, BlockId.Torch));
            Assert.AreEqual(BlockId.Torch, _world.GetBlockOrAir(torch));
            Assert.IsTrue(_interactor.TryBreak(ground));
            Assert.AreEqual(BlockId.Air, _world.GetBlockOrAir(torch), "torch drops when its support is broken");
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
