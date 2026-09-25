using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Unity.Mathematics;
using Voxelwild.EditorTools;
using Voxelwild.World;
using Voxelwild.World.Generation;
using Voxelwild.World.Props;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.Tests
{
    public class PropRegistryTests
    {
        [Test]
        public void Kinds_AreUniqueAndSane()
        {
            var names = new HashSet<string>();
            for (int k = 0; k < PropRegistry.Count; k++)
            {
                var r = PropRegistry.Get(k);
                string n = PropRegistry.Name(k);
                Assert.IsTrue(names.Add(n), $"duplicate kind {n}");
                Assert.AreEqual(k, PropRegistry.Find(n));
                Assert.Greater(r.Variants, 0, n);
                Assert.GreaterOrEqual(r.Grid, 1, n);
                Assert.That(r.Chance, Is.InRange(0.0001f, 1f), n);
                Assert.LessOrEqual(r.ScaleMin, r.ScaleMax, n);
                Assert.Greater(r.ScaleMin, 0f, n);
                Assert.GreaterOrEqual(r.Clearance, 1, n);
                Assert.AreNotEqual(0ul, r.Support, n);
                Assert.Greater(r.DrawDistance, 10f, n);
                if (r.Placement == PropPlacement.Ground) Assert.AreNotEqual(0u, r.Biomes, $"{n}: ground props need biomes");
                if (r.CoreBlock != BlockId.Air)
                {
                    // the mesh encloses its core at scale 1; only growing keeps it hidden
                    Assert.GreaterOrEqual(r.ScaleMin, 1f, n);
                    Assert.IsTrue(BlockRegistry.Get(r.CoreBlock).Has(BlockFlags.Opaque), n);
                }
                if (r.Footprint > 0) Assert.IsTrue(r.Cardinal, $"{n}: footprints need cardinal yaw");
            }
        }

        [Test]
        public void PropBarrier_IsSolidInvisibleAndLetsLightThrough()
        {
            var d = BlockRegistry.Get(BlockId.PropBarrier);
            Assert.IsTrue(d.Has(BlockFlags.Solid));
            Assert.IsTrue(d.Has(BlockFlags.Breakable));
            Assert.IsFalse(d.Has(BlockFlags.Opaque));
            Assert.AreEqual(RenderShape.None, d.Shape);
            Assert.AreEqual(0, d.LightOpacity);
        }

        [Test]
        public void DependsOn_CoversSupportAnchorCoreAndBarriers()
        {
            var boulder = PropRegistry.Get(PropRegistry.RockBoulder);
            var b = new PropInstance { Cell = new int3(0, 64, 0), Kind = PropRegistry.RockBoulder };
            Assert.IsTrue(PropRegistry.DependsOn(boulder, b, new int3(0, 63, 0)), "ground");
            Assert.IsTrue(PropRegistry.DependsOn(boulder, b, new int3(0, 64, 0)), "core");
            Assert.IsFalse(PropRegistry.DependsOn(boulder, b, new int3(1, 64, 0)));
            Assert.IsFalse(PropRegistry.DependsOn(boulder, b, new int3(0, 65, 0)));

            var tree = PropRegistry.Get(PropRegistry.TreeDead);
            var t = new PropInstance { Cell = new int3(3, 70, 3), Kind = PropRegistry.TreeDead };
            Assert.IsTrue(PropRegistry.DependsOn(tree, t, new int3(3, 71, 3)), "upper barrier");
            Assert.IsFalse(PropRegistry.DependsOn(tree, t, new int3(3, 72, 3)));

            var stalactite = PropRegistry.Get(PropRegistry.CaveStalactite);
            var s = new PropInstance { Cell = new int3(5, 10, 5), Kind = PropRegistry.CaveStalactite };
            Assert.IsTrue(PropRegistry.DependsOn(stalactite, s, new int3(5, 11, 5)), "ceiling");
            Assert.IsFalse(PropRegistry.DependsOn(stalactite, s, new int3(5, 9, 5)));

            var log = PropRegistry.Get(PropRegistry.TreeFallenLog);
            var l = new PropInstance { Cell = new int3(0, 64, 0), Kind = PropRegistry.TreeFallenLog, Yaw = 64 };
            Assert.AreEqual(new int3(0, 0, 1), PropRegistry.FootprintAxis(l));
            Assert.IsTrue(PropRegistry.DependsOn(log, l, new int3(0, 64, 2)), "end of the log");
            Assert.IsTrue(PropRegistry.DependsOn(log, l, new int3(0, 63, -2)), "ground under the other end");
            Assert.IsFalse(PropRegistry.DependsOn(log, l, new int3(2, 64, 0)));
            Assert.IsFalse(PropRegistry.DependsOn(log, l, new int3(0, 64, 3)));
        }

        [Test]
        public void Transform_PlacesPivotsOnTheGrid()
        {
            var boulder = PropRegistry.Get(PropRegistry.RockBoulder);
            var m = PropField.Transform(boulder, new PropInstance { Cell = new int3(4, 70, -3) }, 1f);
            Assert.AreEqual(new UnityEngine.Vector4(4.5f, 70f, -2.5f, 1f), m.GetColumn(3), "core props sit exactly on their cell");
            var stalactite = PropRegistry.Get(PropRegistry.CaveStalactite);
            var s = PropField.Transform(stalactite, new PropInstance { Cell = new int3(0, 10, 0) }, 1f);
            Assert.AreEqual(11f, s.GetColumn(3).y, 1e-5f, "ceiling props hang from the underside of the block above");
        }
    }

    public class PropManifestTests
    {
        [Test]
        public void Manifest_ProvidesEveryVariantTheRegistryPlaces()
        {
            var manifest = PropLibraryBuilder.LoadManifest();
            Assert.IsNotNull(manifest, "run ./tools/blender.ps1 build");
            for (int k = 0; k < PropRegistry.Count; k++)
            {
                var rule = PropRegistry.Get(k);
                var assets = manifest.assets.Where(a => a.kind == PropRegistry.Name(k)).OrderBy(a => a.variant).ToArray();
                CollectionAssert.AreEqual(Enumerable.Range(0, rule.Variants).ToArray(), assets.Select(a => a.variant).ToArray(),
                    PropRegistry.Name(k));
                foreach (var a in assets)
                {
                    Assert.IsTrue(System.IO.File.Exists(a.fbx), a.fbx);
                    var tris = a.lods.Select(l => l.triangles).ToArray();
                    for (int i = 1; i < tris.Length; i++) Assert.Less(tris[i], tris[i - 1], $"{a.name} LOD{i}");
                    Assert.AreEqual(rule.Placement == PropPlacement.CaveCeiling, a.hang, a.name);
                    Assert.AreEqual(rule.CoreBlock != BlockId.Air, a.core, a.name);
                    if (a.hang) Assert.That(a.extents.top, Is.InRange(0f, 0.2f), $"{a.name} hangs from its pivot");
                    else Assert.LessOrEqual(a.extents.bottom, 0f, $"{a.name} rests on its pivot");
                    if (a.core)
                    {
                        // encloses every yaw of the 1 m core block: radius >= sqrt(0.5), top above 1 m
                        Assert.Greater(a.extents.radius, 0.75f, a.name);
                        Assert.Greater(a.extents.top, 1.05f, a.name);
                    }
                    foreach (var s in a.slots)
                        if (!string.IsNullOrEmpty(s.layer))
                            Assert.IsTrue(System.Enum.TryParse<TextureLayer>(s.layer, out _), $"{a.name}.{s.name}: layer {s.layer}");
                }
            }
        }
    }

    public class PropPlacementTests
    {
        const uint Seed = 20260924;

        static IEnumerable<TestGen.Column> Sample(out int2[] coords)
        {
            coords = new[]
            {
                TestGen.FindColumn(Seed, s => s.Biome == Biome.Forest),
                TestGen.FindColumn(Seed, s => s.Biome == Biome.Mountains),
                TestGen.FindColumn(Seed, s => s.Biome == Biome.Savanna),
                TestGen.FindColumn(Seed, s => s.Biome == Biome.Plains),
                TestGen.FindColumn(Seed, s => s.Biome == Biome.Taiga),
                new int2(0, 0), new int2(4, -3),
            };
            return coords.Select(c => TestGen.Generate(c, Seed)).ToArray();
        }

        [Test]
        public void Placement_IsDeterministic()
        {
            var c = TestGen.FindColumn(Seed, s => s.Biome == Biome.Forest);
            var a = TestGen.Generate(c, Seed);
            var b = TestGen.Generate(c, Seed);
            Assert.Greater(a.Props.Length, 0);
            CollectionAssert.AreEqual(a.Props, b.Props);
        }

        [Test]
        public void Props_FollowTheirRules()
        {
            var columns = Sample(out var coords).ToArray();
            var perKind = new int[PropRegistry.Count];
            for (int ci = 0; ci < columns.Length; ci++)
            {
                var col = columns[ci];
                int2 origin = coords[ci] * ChunkSize;
                var anchors = new HashSet<int3>();
                foreach (var p in col.Props)
                {
                    var rule = PropRegistry.Get(p.Kind);
                    string n = $"{PropRegistry.Name(p.Kind)} at {p.Cell}";
                    perKind[p.Kind]++;
                    Assert.IsTrue(anchors.Add(p.Cell), $"{n}: two props share a cell");
                    int lx = p.Cell.x - origin.x, lz = p.Cell.z - origin.y;
                    Assert.That(lx, Is.InRange(0, ChunkSize - 1), n);
                    Assert.That(lz, Is.InRange(0, ChunkSize - 1), n);
                    Assert.Less(p.Variant, rule.Variants, n);
                    Assert.GreaterOrEqual(p.Room, rule.Clearance, n);

                    ushort at = col.At(lx, p.Cell.y, lz);
                    ushort expected = rule.CoreBlock != BlockId.Air ? rule.CoreBlock
                                    : rule.BarrierHeight > 0 ? BlockId.PropBarrier : BlockId.Air;
                    Assert.AreEqual(expected, at, $"{n}: anchor");
                    switch (rule.Placement)
                    {
                        case PropPlacement.Ground:
                            Assert.IsTrue(rule.InBiome(col.Surface[lx + lz * ChunkSize].Biome), $"{n}: biome");
                            Assert.IsTrue(rule.Supports(col.At(lx, p.Cell.y - 1, lz)), $"{n}: support");
                            break;
                        case PropPlacement.CaveFloor:
                            Assert.IsTrue(rule.Supports(col.At(lx, p.Cell.y - 1, lz)), $"{n}: floor");
                            Assert.Less(p.Cell.y, col.Surface[lx + lz * ChunkSize].Height, n);
                            break;
                        case PropPlacement.CaveCeiling:
                            Assert.IsTrue(rule.Supports(col.At(lx, p.Cell.y + 1, lz)), $"{n}: ceiling");
                            Assert.Less(p.Cell.y, col.Surface[lx + lz * ChunkSize].Height, n);
                            break;
                    }
                    if (rule.Footprint > 0)
                    {
                        int3 axis = PropRegistry.FootprintAxis(p);
                        for (int t = -rule.Footprint; t <= rule.Footprint; t++)
                        {
                            int3 c = p.Cell + axis * t;
                            Assert.IsTrue(rule.Supports(col.At(c.x - origin.x, c.y - 1, c.z - origin.y)), $"{n}: footprint support {t}");
                        }
                    }
                }

                // every barrier cell belongs to a prop, and every cell a prop owns still holds its block
                var owned = new List<(int3 cell, ushort block)>();
                foreach (var p in col.Props) PropField.CollectOwnedCells(PropRegistry.Get(p.Kind), p, owned);
                var ownedCells = new HashSet<int3>(owned.Select(o => o.cell));
                foreach (var (cell, block) in owned)
                    Assert.AreEqual(block, col.At(cell.x - origin.x, cell.y, cell.z - origin.y), $"owned cell {cell}");
                for (int y = MinWorldY; y < MaxWorldY; y++)
                for (int z = 0; z < ChunkSize; z++)
                for (int x = 0; x < ChunkSize; x++)
                    if (col.At(x, y, z) == BlockId.PropBarrier)
                        Assert.IsTrue(ownedCells.Contains(new int3(origin.x + x, y, origin.y + z)), $"stray barrier at {x},{y},{z}");
            }

            foreach (var k in new[] { PropRegistry.RockPebbles, PropRegistry.RockStone, PropRegistry.CaveStalactite,
                                      PropRegistry.CaveStalagmite, PropRegistry.PlantGrassClump })
                Assert.Greater(perKind[k], 0, $"no {PropRegistry.Name(k)} in the sample columns");
        }

        [Test]
        public void RemovedProps_TakeTheirBarriersAndStayRemoved()
        {
            var field = new PropField(null);
            var col = new ChunkColumn { Coord = new int2(0, 0) };
            try
            {
                var tree = new PropInstance { Cell = new int3(5, 70, 5), Kind = PropRegistry.TreeDead };
                var grass = new PropInstance { Cell = new int3(9, 70, 9), Kind = PropRegistry.PlantGrassClump };
                col.Props.Add(tree);
                col.Props.Add(grass);
                field.OnColumnReady(col);
                Assert.AreEqual(2, field.Loaded);

                var leftovers = new List<(int3 cell, ushort block)>();
                field.RemoveDependents(new int3(5, 69, 5), leftovers);      // break the ground under the tree
                Assert.AreEqual(1, field.Loaded);
                CollectionAssert.AreEquivalent(new[] { (new int3(5, 70, 5), BlockId.PropBarrier), (new int3(5, 71, 5), BlockId.PropBarrier) }, leftovers);

                field.OnColumnUnloaded(col.Coord);
                Assert.AreEqual(0, field.Loaded);
                field.OnColumnReady(col);                                     // regenerated: the tree must not come back
                Assert.AreEqual(1, field.Loaded);
            }
            finally
            {
                col.DisposeNative();
            }
        }
    }
}
