using Unity.Mathematics;

namespace Voxelwild.World
{
    public struct VoxelHit
    {
        public int3 Block;       // the block that was hit
        public int3 Normal;      // face normal of the hit face (zero if the ray started inside)
        public int3 Adjacent => Block + Normal;  // where a placed block would go
        public float Distance;
        public ushort Id;
    }

    /// <summary>Amanatides-Woo grid traversal. Hits breakable/solid blocks, passes through air and liquids.</summary>
    public static class VoxelRaycast
    {
        public static bool Cast(IVoxelQuery world, float3 origin, float3 direction, float maxDistance, out VoxelHit hit)
        {
            hit = default;
            direction = math.normalizesafe(direction);
            if (math.all(direction == 0)) return false;

            int3 cell = (int3)math.floor(origin);
            int3 step = (int3)math.sign(direction);
            float3 invAbs = new float3(
                direction.x != 0 ? math.abs(1f / direction.x) : float.PositiveInfinity,
                direction.y != 0 ? math.abs(1f / direction.y) : float.PositiveInfinity,
                direction.z != 0 ? math.abs(1f / direction.z) : float.PositiveInfinity);
            float3 frac = origin - math.floor(origin);
            float3 tMax = new float3(
                step.x > 0 ? (1f - frac.x) * invAbs.x : frac.x * invAbs.x,
                step.y > 0 ? (1f - frac.y) * invAbs.y : frac.y * invAbs.y,
                step.z > 0 ? (1f - frac.z) * invAbs.z : frac.z * invAbs.z);

            int3 normal = int3.zero;
            float t = 0f;
            while (t <= maxDistance)
            {
                if (world.TryGetBlock(cell, out var id) && id != BlockId.Air)
                {
                    var def = BlockRegistry.Get(id);
                    if (def.Has(BlockFlags.Solid))
                    {
                        hit = new VoxelHit { Block = cell, Normal = normal, Distance = t, Id = id };
                        return true;
                    }
                }

                if (tMax.x < tMax.y && tMax.x < tMax.z)
                {
                    t = tMax.x; tMax.x += invAbs.x; cell.x += step.x; normal = new int3(-step.x, 0, 0);
                }
                else if (tMax.y < tMax.z)
                {
                    t = tMax.y; tMax.y += invAbs.y; cell.y += step.y; normal = new int3(0, -step.y, 0);
                }
                else
                {
                    t = tMax.z; tMax.z += invAbs.z; cell.z += step.z; normal = new int3(0, 0, -step.z);
                }
            }
            return false;
        }
    }
}
