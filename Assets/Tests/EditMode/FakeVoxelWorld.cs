using System.Collections.Generic;
using Unity.Mathematics;
using Voxelwild.World;

namespace Voxelwild.Tests
{
    /// <summary>Sparse in-memory world for physics and raycast tests. Everything unset is air.</summary>
    sealed class FakeVoxelWorld : IVoxelQuery
    {
        readonly Dictionary<int3, ushort> _blocks = new Dictionary<int3, ushort>();

        public void Set(int3 p, ushort id) => _blocks[p] = id;

        public void Fill(int3 min, int3 max, ushort id)
        {
            for (int y = min.y; y <= max.y; y++)
            for (int z = min.z; z <= max.z; z++)
            for (int x = min.x; x <= max.x; x++)
                _blocks[new int3(x, y, z)] = id;
        }

        public bool TryGetBlock(int3 world, out ushort block)
        {
            block = _blocks.TryGetValue(world, out var b) ? b : BlockId.Air;
            return true;
        }
    }
}
