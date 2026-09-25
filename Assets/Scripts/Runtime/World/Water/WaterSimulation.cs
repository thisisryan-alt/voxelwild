using System.Collections.Generic;
using Unity.Mathematics;

namespace Voxelwild.World.Water
{
    /// <summary>What the water simulation needs from the world.</summary>
    public interface IWaterGrid
    {
        /// <summary>False while the cell's column isn't loaded: the simulation waits for it.</summary>
        bool TryGet(int3 cell, out ushort block);
        /// <summary>Blocks water may flow into and wash away: air and plants.</summary>
        bool IsOpen(ushort block);
        void Set(int3 cell, ushort block);
    }

    /// <summary>
    /// Cellular water in the classic block-game style, evaluated only where something changed.
    ///
    /// Sources (<see cref="BlockId.Water"/>, level 8) stay put. Every other cell takes the highest level its
    /// neighbours feed it: water directly above makes a falling column (level 7); a horizontal neighbour feeds
    /// its own level minus one, but only if it rests on solid ground or a source (over air or falling water it
    /// pours down instead), so water falls before it spreads. Two horizontal sources over solid ground or water make a new source. A cell
    /// nothing feeds dries up, so flows retreat when their source goes.
    ///
    /// Each tick reads a snapshot and then applies all changes, so the result doesn't depend on processing
    /// order, and water advances one cell per tick. Engine-free: tested with a fake grid.
    /// </summary>
    public sealed class WaterSimulation
    {
        public const float TickSeconds = 0.25f;

        /// <summary>Cells evaluated per tick at most (the rest wait for the next tick).</summary>
        public int MaxCellsPerTick = 4096;

        readonly HashSet<int3> _dirty = new HashSet<int3>();
        readonly HashSet<int3> _waiting = new HashSet<int3>();
        readonly List<int3> _work = new List<int3>();
        readonly List<(int3 cell, ushort block)> _changes = new List<(int3, ushort)>();

        static readonly int3[] Horizontal = { new int3(1, 0, 0), new int3(-1, 0, 0), new int3(0, 0, 1), new int3(0, 0, -1) };
        static readonly int3 Up = new int3(0, 1, 0);

        public int Pending => _dirty.Count;
        public int Waiting => _waiting.Count;
        public long TotalChanges { get; private set; }

        /// <summary>Something changed at the cell: it and its six neighbours are re-evaluated next tick.</summary>
        public void MarkDirty(int3 cell)
        {
            _dirty.Add(cell);
            _dirty.Add(cell + Up);
            _dirty.Add(cell - Up);
            foreach (var d in Horizontal) _dirty.Add(cell + d);
        }

        /// <summary>Cells that touched unloaded terrain are retried (call when columns finish loading).</summary>
        public void RetryWaiting()
        {
            foreach (var c in _waiting) _dirty.Add(c);
            _waiting.Clear();
        }

        public void Clear()
        {
            _dirty.Clear();
            _waiting.Clear();
        }

        /// <summary>One step. Returns the number of cells that changed.</summary>
        public int Tick(IWaterGrid grid)
        {
            _work.Clear();
            _work.AddRange(_dirty);
            if (_work.Count > MaxCellsPerTick)
            {
                // deterministic subset: lowest cells first, the rest stay dirty
                _work.Sort((a, b) => a.y != b.y ? a.y.CompareTo(b.y) : a.z != b.z ? a.z.CompareTo(b.z) : a.x.CompareTo(b.x));
                _work.RemoveRange(MaxCellsPerTick, _work.Count - MaxCellsPerTick);
                foreach (var c in _work) _dirty.Remove(c);
            }
            else _dirty.Clear();

            _changes.Clear();
            foreach (var c in _work)
            {
                if (!grid.TryGet(c, out ushort current)) continue;
                if (!Evaluate(grid, c, current, out ushort next))
                {
                    _waiting.Add(c);
                    continue;
                }
                if (next != current) _changes.Add((c, next));
            }
            foreach (var (cell, block) in _changes)
            {
                grid.Set(cell, block);
                MarkDirty(cell);
            }
            TotalChanges += _changes.Count;
            return _changes.Count;
        }

        static bool RestsOn(IWaterGrid grid, ushort below) =>
            below == BlockId.Water || (!grid.IsOpen(below) && !BlockId.IsWater(below));

        /// <summary>The block the cell should hold; false when a neighbour isn't loaded yet.</summary>
        static bool Evaluate(IWaterGrid grid, int3 c, ushort current, out ushort next)
        {
            next = current;
            bool water = BlockId.IsWater(current);
            if (!water && !grid.IsOpen(current)) return true;           // solid: never changes
            if (current == BlockId.Water) return true;                  // sources persist

            if (!grid.TryGet(c + Up, out ushort above)) return false;
            if (!grid.TryGet(c - Up, out ushort below)) return false;

            int level = BlockId.IsWater(above) ? 7 : 0;
            int sources = 0;
            foreach (var d in Horizontal)
            {
                if (!grid.TryGet(c + d, out ushort n)) return false;
                int ln = BlockId.WaterLevel(n);
                if (ln == 0) continue;
                if (ln == 8) sources++;
                // a neighbour only spreads sideways when it rests on something: solid ground or a source
                // (over air or falling water it pours down instead)
                if (!grid.TryGet(c + d - Up, out ushort underN)) return false;
                if (!RestsOn(grid, underN)) continue;
                level = math.max(level, ln - 1);
            }
            if (sources >= 2 && RestsOn(grid, below)) level = 8;

            if (level > 0) next = BlockId.WaterOfLevel(level);
            else if (water) next = BlockId.Air;
            return true;
        }
    }
}
