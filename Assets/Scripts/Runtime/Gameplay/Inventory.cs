using System;
using System.Collections.Generic;

namespace Voxelwild.Gameplay
{
    /// <summary>
    /// 36 slots: 0–8 are the hotbar, 9–35 the backpack. Adding fills matching stacks first (hotbar before backpack),
    /// then empty slots in the same order. Engine-free.
    /// </summary>
    public sealed class Inventory
    {
        public const int HotbarSize = 9;
        public const int Size = 36;

        readonly ItemStack[] _slots = new ItemStack[Size];
        int _selected;

        public event Action Changed;

        public ItemStack this[int slot]
        {
            get => _slots[slot];
            set { _slots[slot] = value.IsEmpty ? default : value; Changed?.Invoke(); }
        }

        public int Selected
        {
            get => _selected;
            set { _selected = ((value % HotbarSize) + HotbarSize) % HotbarSize; Changed?.Invoke(); }
        }

        public ItemStack Held => _slots[_selected];
        public ItemDefinition HeldItem => ItemRegistry.Get(_slots[_selected].Item);

        /// <summary>Adds items; returns how many didn't fit.</summary>
        public int Add(ItemStack stack)
        {
            if (stack.IsEmpty) return 0;
            int left = stack.Count;
            int max = Math.Max(1, ItemRegistry.Get(stack.Item).MaxStack);
            for (int i = 0; i < Size && left > 0; i++)
            {
                ref var s = ref _slots[i];
                if (s.IsEmpty || s.Item != stack.Item || s.Count >= max || max == 1) continue;
                int n = Math.Min(left, max - s.Count);
                s.Count += n;
                left -= n;
            }
            for (int i = 0; i < Size && left > 0; i++)
            {
                ref var s = ref _slots[i];
                if (!s.IsEmpty) continue;
                int n = Math.Min(left, max);
                s = new ItemStack { Item = stack.Item, Count = n, Durability = stack.Durability };
                left -= n;
            }
            if (left != stack.Count) Changed?.Invoke();
            return left;
        }

        public int Count(ushort item)
        {
            int n = 0;
            foreach (var s in _slots) if (!s.IsEmpty && s.Item == item) n += s.Count;
            return n;
        }

        /// <summary>Removes up to <paramref name="count"/> items (backpack first, so the hotbar keeps its stock).</summary>
        public int Remove(ushort item, int count)
        {
            int removed = 0;
            for (int pass = 0; pass < 2 && removed < count; pass++)
            {
                int from = pass == 0 ? HotbarSize : 0, to = pass == 0 ? Size : HotbarSize;
                for (int i = from; i < to && removed < count; i++)
                {
                    ref var s = ref _slots[i];
                    if (s.IsEmpty || s.Item != item) continue;
                    int n = Math.Min(s.Count, count - removed);
                    s.Count -= n;
                    removed += n;
                    if (s.Count <= 0) s = default;
                }
            }
            if (removed > 0) Changed?.Invoke();
            return removed;
        }

        /// <summary>Uses one of the held item (placing a block, eating).</summary>
        public bool ConsumeHeld()
        {
            ref var s = ref _slots[_selected];
            if (s.IsEmpty) return false;
            if (--s.Count <= 0) s = default;
            Changed?.Invoke();
            return true;
        }

        /// <summary>Wears the held tool by one use; returns true when it breaks.</summary>
        public bool WearHeld()
        {
            ref var s = ref _slots[_selected];
            if (s.IsEmpty || ItemRegistry.Get(s.Item).Kind != ItemKind.Tool) return false;
            if (--s.Durability > 0) { Changed?.Invoke(); return false; }
            s = default;
            Changed?.Invoke();
            return true;
        }

        /// <summary>Swaps two slots, or merges a into b when they hold the same stackable item.</summary>
        public void Move(int a, int b)
        {
            if (a == b) return;
            ref var sa = ref _slots[a];
            ref var sb = ref _slots[b];
            int max = ItemRegistry.Get(sa.Item).MaxStack;
            if (!sa.IsEmpty && !sb.IsEmpty && sa.Item == sb.Item && max > 1)
            {
                int n = Math.Min(sa.Count, max - sb.Count);
                sb.Count += n;
                sa.Count -= n;
                if (sa.Count <= 0) sa = default;
            }
            else (sa, sb) = (sb, sa);
            Changed?.Invoke();
        }

        public void Clear()
        {
            Array.Clear(_slots, 0, Size);
            Changed?.Invoke();
        }

        public IEnumerable<(int slot, ItemStack stack)> NonEmpty()
        {
            for (int i = 0; i < Size; i++) if (!_slots[i].IsEmpty) yield return (i, _slots[i]);
        }
    }

    public struct Recipe
    {
        public string Name;
        public (ushort item, int count)[] Inputs;
        public ItemStack Output;
    }

    /// <summary>Shapeless recipes chosen from a list (no grid). Engine-free.</summary>
    public static class Recipes
    {
        public static readonly Recipe[] All = Build();

        static Recipe[] Build()
        {
            var list = new List<Recipe>();
            void Add(ItemStack output, params (ushort, int)[] inputs) =>
                list.Add(new Recipe { Name = ItemRegistry.Name(output.Item), Inputs = inputs, Output = output });

            foreach (var log in new[] { Voxelwild.World.BlockId.OakLog, Voxelwild.World.BlockId.BirchLog,
                                        Voxelwild.World.BlockId.SpruceLog, Voxelwild.World.BlockId.JungleLog })
                Add(ItemStack.Of(Voxelwild.World.BlockId.Planks, 4), (log, 1));
            Add(ItemStack.Of(ItemId.Stick, 4), (Voxelwild.World.BlockId.Planks, 2));
            Add(ItemStack.Of(Voxelwild.World.BlockId.Torch, 4), (ItemId.Coal, 1), (ItemId.Stick, 1));
            Add(ItemStack.Of(Voxelwild.World.BlockId.Sandstone, 1), (Voxelwild.World.BlockId.Sand, 4));
            Add(ItemStack.Of(Voxelwild.World.BlockId.Bricks, 1), (Voxelwild.World.BlockId.Cobblestone, 2), (Voxelwild.World.BlockId.Sand, 2));

            var materials = new[] { Voxelwild.World.BlockId.Planks, Voxelwild.World.BlockId.Cobblestone, ItemId.IronChunk, ItemId.Diamond };
            for (int t = 0; t < 4; t++)
            {
                ushort m = materials[t];
                Add(ItemStack.Of((ushort)(ItemId.WoodenPickaxe + t)), (m, 3), (ItemId.Stick, 2));
                Add(ItemStack.Of((ushort)(ItemId.WoodenAxe + t)), (m, 3), (ItemId.Stick, 2));
                Add(ItemStack.Of((ushort)(ItemId.WoodenShovel + t)), (m, 1), (ItemId.Stick, 2));
            }
            return list.ToArray();
        }

        public static bool CanCraft(Inventory inv, in Recipe r)
        {
            foreach (var (item, count) in r.Inputs)
                if (CountFor(inv, item) < count) return false;
            return true;
        }

        /// <summary>Crafts once: takes the inputs and adds the output. False (and no change) when it can't.</summary>
        public static bool Craft(Inventory inv, in Recipe r)
        {
            if (!CanCraft(inv, r)) return false;
            foreach (var (item, count) in r.Inputs) inv.Remove(item, count);
            int left = inv.Add(r.Output);
            if (left > 0)
            {
                // no room: undo
                inv.Remove(r.Output.Item, r.Output.Count - left);
                foreach (var (item, count) in r.Inputs) inv.Add(ItemStack.Of(item, count));
                return false;
            }
            return true;
        }

        static int CountFor(Inventory inv, ushort item) => inv.Count(item);
    }
}
