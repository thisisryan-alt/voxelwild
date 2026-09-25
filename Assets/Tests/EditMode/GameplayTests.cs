using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Unity.Mathematics;
using Voxelwild.Gameplay;
using Voxelwild.World;

namespace Voxelwild.Tests
{
    // Engine-free: also runs outside Unity (tools/dotnet-tests).
    public class ItemAndMiningTests
    {
        static ItemDefinition Hand => default;
        static ItemDefinition Item(ushort id) => ItemRegistry.Get(id);

        [Test]
        public void BlockItems_ShareTheirBlockId_AndEveryRecipeUsesRealItems()
        {
            Assert.AreEqual(BlockId.Planks, ItemRegistry.ForBlock(BlockId.Planks));
            Assert.AreEqual(ItemId.None, ItemRegistry.ForBlock(BlockId.Water), "water is not an item");
            Assert.AreEqual(ItemId.None, ItemRegistry.ForBlock(BlockId.PropBarrier));
            foreach (var r in Recipes.All)
            {
                Assert.IsTrue(ItemRegistry.Exists(r.Output.Item), r.Name);
                foreach (var (item, count) in r.Inputs) Assert.IsTrue(ItemRegistry.Exists(item) && count > 0, $"{r.Name}: {item}");
            }
            Assert.AreEqual(Recipes.All.Length, Recipes.All.Select(r => r.Name + string.Join(",", r.Inputs)).Distinct().Count());
        }

        [Test]
        public void Stone_NeedsAPickaxe_AndBetterTiersMineFaster()
        {
            Assert.IsFalse(Mining.CanHarvest(BlockId.Stone, Hand));
            Assert.AreEqual(default(ItemStack), Drops.For(BlockId.Stone, Hand, 0.5));
            Assert.AreEqual(BlockId.Cobblestone, Drops.For(BlockId.Stone, Item(ItemId.WoodenPickaxe), 0.5).Item);
            float wood = Mining.BreakSeconds(BlockId.Stone, Item(ItemId.WoodenPickaxe));
            float iron = Mining.BreakSeconds(BlockId.Stone, Item(ItemId.IronPickaxe));
            float hand = Mining.BreakSeconds(BlockId.Stone, Hand);
            Assert.Less(iron, wood);
            Assert.Less(wood, hand);
            Assert.IsFalse(Mining.CanHarvest(BlockId.DiamondOre, Item(ItemId.StonePickaxe)));
            Assert.AreEqual(ItemId.Diamond, Drops.For(BlockId.DiamondOre, Item(ItemId.IronPickaxe), 0.5).Item);
            Assert.AreEqual(float.PositiveInfinity, Mining.BreakSeconds(BlockId.Bedrock, Item(ItemId.DiamondPickaxe)));
        }

        [Test]
        public void Drops_FollowTheBlock()
        {
            Assert.AreEqual(BlockId.Dirt, Drops.For(BlockId.Grass, Hand, 0.5).Item);
            Assert.AreEqual(ItemId.Apple, Drops.For(BlockId.OakLeaves, Hand, 0.01).Item);
            Assert.IsTrue(Drops.For(BlockId.OakLeaves, Hand, 0.5).IsEmpty);
            Assert.AreEqual(0f, Mining.BreakSeconds(BlockId.TallGrass, Hand), "plants break instantly");
            var logs = Drops.For(BlockId.PropBarrier, Hand, 0.5);
            Assert.AreEqual((BlockId.OakLog, 3), (logs.Item, logs.Count), "dead wood gives logs");
        }
    }

    public class InventoryTests
    {
        [Test]
        public void Add_StacksThenFillsEmptySlots_AndReportsOverflow()
        {
            var inv = new Inventory();
            Assert.AreEqual(0, inv.Add(ItemStack.Of(BlockId.Dirt, 100)));
            Assert.AreEqual(64, inv[0].Count);
            Assert.AreEqual(36, inv[1].Count);
            Assert.AreEqual(0, inv.Add(ItemStack.Of(BlockId.Dirt, 30)));
            Assert.AreEqual(64, inv[1].Count, "tops up the existing stack first");
            Assert.AreEqual(2, inv[2].Count);
            var full = new Inventory();
            for (int i = 0; i < Inventory.Size; i++) full[i] = ItemStack.Of(BlockId.Stone, 64);
            Assert.AreEqual(5, full.Add(ItemStack.Of(BlockId.Dirt, 5)));
        }

        [Test]
        public void Tools_DontStack_AndWearOut()
        {
            var inv = new Inventory();
            inv.Add(ItemStack.Of(ItemId.WoodenPickaxe));
            inv.Add(ItemStack.Of(ItemId.WoodenPickaxe));
            Assert.AreEqual(1, inv[0].Count);
            Assert.AreEqual(ItemId.WoodenPickaxe, inv[1].Item);
            inv.Selected = 0;
            int uses = 0;
            while (!inv.WearHeld()) uses++;
            Assert.AreEqual(ItemRegistry.Get(ItemId.WoodenPickaxe).Durability - 1, uses);
            Assert.IsTrue(inv[0].IsEmpty, "broken tool disappears");
        }

        [Test]
        public void Remove_TakesFromTheBackpackFirst_AndMoveMergesStacks()
        {
            var inv = new Inventory();
            inv[0] = ItemStack.Of(BlockId.Sand, 10);
            inv[20] = ItemStack.Of(BlockId.Sand, 10);
            Assert.AreEqual(12, inv.Remove(BlockId.Sand, 12));
            Assert.AreEqual(8, inv[0].Count, "hotbar keeps most of its stock");
            Assert.IsTrue(inv[20].IsEmpty);
            inv[5] = ItemStack.Of(BlockId.Sand, 60);
            inv.Move(0, 5);
            Assert.AreEqual(64, inv[5].Count);
            Assert.AreEqual(4, inv[0].Count);
        }

        [Test]
        public void Crafting_TakesInputs_GivesOutput_AndNeedsEverything()
        {
            var inv = new Inventory();
            inv.Add(ItemStack.Of(BlockId.OakLog, 1));
            var planks = Recipes.All.First(r => r.Output.Item == BlockId.Planks && r.Inputs[0].item == BlockId.OakLog);
            Assert.IsTrue(Recipes.Craft(inv, planks));
            Assert.AreEqual(4, inv.Count(BlockId.Planks));
            Assert.AreEqual(0, inv.Count(BlockId.OakLog));
            var sticks = Recipes.All.First(r => r.Output.Item == ItemId.Stick);
            Assert.IsTrue(Recipes.Craft(inv, sticks));
            var pick = Recipes.All.First(r => r.Output.Item == ItemId.WoodenPickaxe);
            Assert.IsFalse(Recipes.Craft(inv, pick), "only 2 planks left");
            Assert.AreEqual(2, inv.Count(BlockId.Planks));
            Assert.AreEqual(4, inv.Count(ItemId.Stick));
        }
    }

    public class SurvivalTests
    {
        [Test]
        public void Falls_HurtBeyondThreeBlocks_ButNotIntoWater()
        {
            var s = new SurvivalStats();
            s.Land(3f, false);
            Assert.AreEqual(20f, s.Health);
            s.Land(8f, false);
            Assert.AreEqual(15f, s.Health);
            s.Land(40f, true);
            Assert.AreEqual(15f, s.Health);
        }

        [Test]
        public void Drowning_AfterTenSecondsOfBreath()
        {
            var s = new SurvivalStats();
            for (int i = 0; i < 100; i++) s.Tick(0.1f, 0f, false, 0, true);
            Assert.AreEqual(20f, s.Health, "ten seconds of air");
            for (int i = 0; i < 30; i++) s.Tick(0.1f, 0f, false, 0, true);
            Assert.Less(s.Health, 20f);
            for (int i = 0; i < 40; i++) s.Tick(0.1f, 0f, false, 0, false);
            Assert.AreEqual(SurvivalStats.MaxAir, s.Air, 1e-4f, "breath comes back");
        }

        [Test]
        public void Activity_Starves_Food_Restores_WellFedHeals()
        {
            var s = new SurvivalStats();
            for (int i = 0; i < 5000 && s.Hunger > 0f; i++) s.Tick(0.5f, 5f, true, 1, false);
            Assert.AreEqual(0f, s.Hunger);
            float before = s.Health;
            for (int i = 0; i < 100; i++) s.Tick(0.5f, 0f, false, 0, false);
            Assert.Less(s.Health, before, "starving hurts");
            Assert.GreaterOrEqual(s.Health, 1f, "but never kills on its own");
            s.Eat(20, 5f);
            float hurt = s.Health;
            for (int i = 0; i < 100; i++) s.Tick(0.5f, 0f, false, 0, false);
            Assert.Greater(s.Health, hurt, "well fed heals");
        }

        [Test]
        public void Death_IsReported_Once()
        {
            var s = new SurvivalStats();
            int deaths = 0;
            s.Died += _ => deaths++;
            s.Land(30f, false);
            s.Land(30f, false);
            Assert.IsTrue(s.Dead);
            Assert.AreEqual(1, deaths);
            s.Reset();
            Assert.AreEqual(20f, s.Health);
        }
    }

    public class RegionFileTests
    {
        const int Volume = 32 * 32 * 32;

        static ushort[] Runs(params (int run, ushort block)[] runs) =>
            runs.SelectMany(r => new[] { (ushort)r.run, r.block }).ToArray();

        [Test]
        public void RoundTrip_PreservesSections_AndIsByteStable()
        {
            var sections = new Dictionary<int3, ushort[]>
            {
                [new int3(0, 2, 0)] = Runs((Volume - 5, BlockId.Air), (5, BlockId.Stone)),
                [new int3(-1, -2, 15)] = Runs((Volume - 1000, BlockId.Stone), (1000, BlockId.Water)),
            };
            var a = new MemoryStream();
            RegionFile.Write(a, sections);
            var b = new MemoryStream();
            RegionFile.Write(b, sections.Reverse());
            CollectionAssert.AreEqual(a.ToArray(), b.ToArray(), "order-independent bytes");
            a.Position = 0;
            var read = RegionFile.Read(a, Volume);
            Assert.AreEqual(2, read.Count);
            foreach (var kv in sections) CollectionAssert.AreEqual(kv.Value, read[kv.Key]);
        }

        [Test]
        public void CorruptFiles_FailLoudly()
        {
            Assert.Throws<InvalidDataException>(() => RegionFile.Read(new MemoryStream(new byte[] { 1, 2, 3, 4, 5, 6, 7, 8 }), Volume));
            var bad = new MemoryStream();
            RegionFile.Write(bad, new Dictionary<int3, ushort[]> { [int3.zero] = Runs((10, BlockId.Air)) });
            bad.Position = 0;
            Assert.Throws<InvalidDataException>(() => RegionFile.Read(bad, Volume), "runs must cover the section");
        }

        [Test]
        public void Regions_GroupSixteenColumns_AndNamesAreSafe()
        {
            Assert.AreEqual(new int2(0, 0), RegionFile.RegionOf(new int3(15, 5, 0)));
            Assert.AreEqual(new int2(1, -1), RegionFile.RegionOf(new int3(16, 0, -1)));
            Assert.AreEqual(new int2(-1, 0), RegionFile.RegionOf(new int3(-16, 0, 15)));
            Assert.AreEqual("r.-1.0.bin", RegionFile.FileName(new int2(-1, 0)));
            Assert.AreEqual("My World___", SaveFolders.SafeName(" My World/:* "));
            Assert.AreEqual("World", SaveFolders.SafeName("  "));
        }

        [Test]
        public void Worlds_AreListedMostRecentFirst()
        {
            string root = Path.Combine(Path.GetTempPath(), "vwsaves_" + System.Guid.NewGuid().ToString("N"));
            try
            {
                foreach (var name in new[] { "Alpha", "Beta" })
                    SaveFolders.WriteAtomic(Path.Combine(SaveFolders.WorldDirectory(root, name), SaveFolders.WorldFile),
                        s => s.WriteByte(1));
                File.SetLastWriteTimeUtc(Path.Combine(root, "Alpha", SaveFolders.WorldFile), System.DateTime.UtcNow.AddMinutes(-5));
                Directory.CreateDirectory(Path.Combine(root, "NotAWorld"));
                CollectionAssert.AreEqual(new[] { "Beta", "Alpha" }, SaveFolders.List(root));
            }
            finally
            {
                if (Directory.Exists(root)) Directory.Delete(root, true);
            }
        }
    }
}
