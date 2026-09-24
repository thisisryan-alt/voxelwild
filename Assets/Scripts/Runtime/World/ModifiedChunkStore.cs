using System.Collections.Generic;
using Unity.Collections;
using Unity.Mathematics;

namespace Voxelwild.World
{
    /// <summary>
    /// Keeps player-edited sections alive across unload/reload, run-length encoded.
    /// This is the in-memory half of world saving; writing it to disk arrives with world save/load.
    /// </summary>
    public sealed class ModifiedChunkStore
    {
        readonly Dictionary<int3, ushort[]> _rle = new Dictionary<int3, ushort[]>();

        public int Count => _rle.Count;

        public bool Contains(int3 section) => _rle.ContainsKey(section);

        public void Store(int3 section, NativeArray<ushort> voxels)
        {
            var runs = new List<ushort>(256);
            int i = 0;
            while (i < voxels.Length)
            {
                ushort v = voxels[i];
                int run = 1;
                while (i + run < voxels.Length && voxels[i + run] == v && run < ushort.MaxValue) run++;
                runs.Add((ushort)run);
                runs.Add(v);
                i += run;
            }
            _rle[section] = runs.ToArray();
        }

        public void StoreUniform(int3 section, ushort block, int volume)
        {
            var runs = new List<ushort>();
            for (int left = volume; left > 0; left -= ushort.MaxValue)
            {
                runs.Add((ushort)math.min(left, ushort.MaxValue));
                runs.Add(block);
            }
            _rle[section] = runs.ToArray();
        }

        public bool TryRestore(int3 section, NativeArray<ushort> into)
        {
            if (!_rle.TryGetValue(section, out var runs)) return false;
            int o = 0;
            for (int r = 0; r < runs.Length; r += 2)
            {
                int run = runs[r];
                ushort v = runs[r + 1];
                for (int k = 0; k < run; k++) into[o++] = v;
            }
            return true;
        }
    }
}
