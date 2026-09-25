using System.Collections.Generic;
using NUnit.Framework;
using Unity.Mathematics;
using Voxelwild.World;
using Voxelwild.World.Water;

namespace Voxelwild.Tests
{
    // Engine-free: also runs outside Unity (tools/dotnet-tests).
    public class WaterSimulationTests
    {
        sealed class Grid : IWaterGrid
        {
            public readonly Dictionary<int3, ushort> Blocks = new Dictionary<int3, ushort>();
            public int LoadedMaxX = int.MaxValue;
            public int Writes;

            // like the real world's bedrock: everything at y <= 0 is solid
            public ushort this[int3 p]
            {
                get => Blocks.TryGetValue(p, out var b) ? b : p.y <= 0 ? BlockId.Stone : BlockId.Air;
                set => Blocks[p] = value;
            }

            public bool TryGet(int3 cell, out ushort block)
            {
                block = this[cell];
                return cell.x <= LoadedMaxX;
            }

            public bool IsOpen(ushort block) => block == BlockId.Air || block == BlockId.TallGrass;
            public void Set(int3 cell, ushort block) { this[cell] = block; Writes++; }

        }

        static int Run(WaterSimulation sim, Grid g, int maxTicks = 200)
        {
            int ticks = 0;
            while (sim.Pending > 0 && ticks < maxTicks) { sim.Tick(g); ticks++; }
            Assert.Less(ticks, maxTicks, "water did not settle");
            return ticks;
        }

        static int Level(Grid g, int x, int y, int z) => BlockId.WaterLevel(g[new int3(x, y, z)]);

        [Test]
        public void Source_SpreadsSevenCells_LosingOneLevelPerCell()
        {
            var g = new Grid();
            var sim = new WaterSimulation();
            g[new int3(0, 1, 0)] = BlockId.Water;
            sim.MarkDirty(new int3(0, 1, 0));
            Run(sim, g);
            for (int x = 1; x <= 7; x++) Assert.AreEqual(8 - x, Level(g, x, 1, 0), $"x={x}");
            Assert.AreEqual(0, Level(g, 8, 1, 0), "flow stops after seven cells");
            Assert.AreEqual(8 - 3 - 2, Level(g, 3, 1, -2), "manhattan falloff");
            Assert.AreEqual(0, Level(g, 0, 2, 0), "never climbs");
        }

        [Test]
        public void Water_FallsBeforeItSpreads_AndPoolsAtTheBottom()
        {
            var g = new Grid();
            // a ledge at y=10 reaching to x=0, open to the east
            for (int x = -5; x <= 0; x++) g[new int3(x, 9, 0)] = BlockId.Stone;
            var sim = new WaterSimulation();
            g[new int3(0, 10, 0)] = BlockId.Water;
            sim.MarkDirty(new int3(0, 10, 0));
            Run(sim, g);
            Assert.AreEqual(7, Level(g, 1, 10, 0), "spills over the edge");
            for (int y = 1; y <= 9; y++) Assert.AreEqual(7, Level(g, 1, y, 0), $"falling column at y={y}");
            Assert.AreEqual(0, Level(g, 2, 10, 0), "doesn't run along the air past the edge");
            Assert.AreEqual(6, Level(g, 2, 1, 0), "spreads where it lands");
            Assert.AreEqual(1, Level(g, 7, 1, 0));
        }

        [Test]
        public void RemovingTheSource_DrainsTheFlow()
        {
            var g = new Grid();
            var sim = new WaterSimulation();
            var src = new int3(0, 1, 0);
            g[src] = BlockId.Water;
            sim.MarkDirty(src);
            Run(sim, g);
            g[src] = BlockId.Air;
            sim.MarkDirty(src);
            Run(sim, g);
            foreach (var kv in g.Blocks) Assert.IsFalse(BlockId.IsWater(kv.Value), $"water left at {kv.Key}");
        }

        [Test]
        public void TwoSources_FillTheGapBetweenThem()
        {
            var g = new Grid();
            var sim = new WaterSimulation();
            g[new int3(-1, 1, 0)] = BlockId.Water;
            g[new int3(1, 1, 0)] = BlockId.Water;
            sim.MarkDirty(new int3(0, 1, 0));
            sim.Tick(g);
            Assert.AreEqual(BlockId.Water, g[new int3(0, 1, 0)]);
        }

        [Test]
        public void Water_WashesAwayPlants_ButNotStone()
        {
            var g = new Grid();
            g[new int3(1, 1, 0)] = BlockId.TallGrass;
            g[new int3(-1, 1, 0)] = BlockId.Cobblestone;
            var sim = new WaterSimulation();
            g[new int3(0, 1, 0)] = BlockId.Water;
            sim.MarkDirty(new int3(0, 1, 0));
            Run(sim, g);
            Assert.AreEqual(7, Level(g, 1, 1, 0));
            Assert.AreEqual(BlockId.Cobblestone, g[new int3(-1, 1, 0)]);
        }

        [Test]
        public void TickBudget_OnlySlowsWaterDown()
        {
            var fast = new Grid();
            var slow = new Grid();
            var a = new WaterSimulation();
            var b = new WaterSimulation { MaxCellsPerTick = 8 };
            foreach (var (g, s) in new[] { (fast, a), (slow, b) })
            {
                g[new int3(0, 1, 0)] = BlockId.Water;
                s.MarkDirty(new int3(0, 1, 0));
            }
            int ta = Run(a, fast);
            int tb = Run(b, slow, 5000);
            Assert.Greater(tb, ta);
            CollectionAssert.AreEquivalent(fast.Blocks, slow.Blocks);
        }

        [Test]
        public void UnloadedTerrain_PausesTheFlow_UntilItLoads()
        {
            var g = new Grid { LoadedMaxX = 3 };
            var sim = new WaterSimulation();
            g[new int3(0, 1, 0)] = BlockId.Water;
            sim.MarkDirty(new int3(0, 1, 0));
            Run(sim, g);
            Assert.AreEqual(0, Level(g, 4, 1, 0));
            Assert.Greater(sim.Waiting, 0);
            g.LoadedMaxX = int.MaxValue;
            sim.RetryWaiting();
            Run(sim, g);
            Assert.AreEqual(1, Level(g, 7, 1, 0));
        }

        [Test]
        public void SettledWater_StopsWriting()
        {
            var g = new Grid();
            var sim = new WaterSimulation();
            g[new int3(0, 1, 0)] = BlockId.Water;
            sim.MarkDirty(new int3(0, 1, 0));
            Run(sim, g);
            int writes = g.Writes;
            sim.MarkDirty(new int3(3, 1, 0));
            Run(sim, g);
            Assert.AreEqual(writes, g.Writes, "re-evaluating settled water changes nothing");
        }
    }
}
