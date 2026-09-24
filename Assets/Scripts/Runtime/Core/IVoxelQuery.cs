using Unity.Mathematics;

namespace Voxelwild.World
{
    /// <summary>Read access to the voxel grid, used by physics and raycasts (and faked in tests).</summary>
    public interface IVoxelQuery
    {
        /// <summary>False while the column containing <paramref name="world"/> is not generated yet.</summary>
        bool TryGetBlock(int3 world, out ushort block);
    }

    public static class VoxelQueryExtensions
    {
        /// <summary>Unloaded space counts as solid so bodies never fall through ungenerated terrain.</summary>
        public static bool IsSolid(this IVoxelQuery q, int3 p) =>
            !q.TryGetBlock(p, out var b) || BlockRegistry.Get(b).Has(BlockFlags.Solid);

        public static ushort GetBlockOrAir(this IVoxelQuery q, int3 p) =>
            q.TryGetBlock(p, out var b) ? b : BlockId.Air;
    }
}
