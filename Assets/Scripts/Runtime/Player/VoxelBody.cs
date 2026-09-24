using Unity.Mathematics;
using Voxelwild.World;

namespace Voxelwild.Player
{
    /// <summary>
    /// Axis-aligned box moving through the voxel grid with swept, axis-separated collision.
    /// Independent of Unity physics so the terrain needs no colliders and the logic is unit-testable.
    /// Position is the centre of the box's bottom face (the feet).
    /// </summary>
    public sealed class VoxelBody
    {
        public const float Skin = 0.001f;

        public float3 Position;
        public float3 Velocity;
        public float HalfWidth = 0.3f;
        public float Height = 1.8f;

        public bool Grounded { get; private set; }
        public bool HitCeiling { get; private set; }
        public bool HitWall { get; private set; }

        public float3 Min => Position - new float3(HalfWidth, 0f, HalfWidth);
        public float3 Max => Position + new float3(HalfWidth, Height, HalfWidth);

        /// <summary>Moves by <paramref name="delta"/>, stopping at solid voxels. Returns the applied motion.</summary>
        public float3 Move(IVoxelQuery world, float3 delta)
        {
            Grounded = false;
            HitCeiling = false;
            HitWall = false;
            float3 applied;

            applied.y = Sweep(world, 1, delta.y);
            if (applied.y != delta.y)
            {
                if (delta.y < 0) Grounded = true; else HitCeiling = true;
                Velocity.y = 0f;
            }
            Position.y += applied.y;

            applied.x = Sweep(world, 0, delta.x);
            if (applied.x != delta.x) { HitWall = true; Velocity.x = 0f; }
            Position.x += applied.x;

            applied.z = Sweep(world, 2, delta.z);
            if (applied.z != delta.z) { HitWall = true; Velocity.z = 0f; }
            Position.z += applied.z;

            return applied;
        }

        /// <summary>True if a solid block lies within <paramref name="depth"/> below the feet.</summary>
        public bool ProbeGround(IVoxelQuery world, float depth = 0.05f) =>
            Sweep(world, 1, -depth) > -depth;

        public bool Overlaps(int3 block)
        {
            float3 mn = Min, mx = Max;
            return mx.x > block.x + Skin && mn.x < block.x + 1 - Skin
                && mx.y > block.y + Skin && mn.y < block.y + 1 - Skin
                && mx.z > block.z + Skin && mn.z < block.z + 1 - Skin;
        }

        float Sweep(IVoxelQuery world, int axis, float amount)
        {
            if (amount == 0f) return 0f;
            float3 mn = Min, mx = Max;
            int a1 = (axis + 1) % 3, a2 = (axis + 2) % 3;
            int lo1 = (int)math.floor(mn[a1] + Skin), hi1 = (int)math.floor(mx[a1] - Skin);
            int lo2 = (int)math.floor(mn[a2] + Skin), hi2 = (int)math.floor(mx[a2] - Skin);

            if (amount > 0f)
            {
                // cells whose near face lies ahead of the leading face; cells already overlapped are ignored
                int start = (int)math.ceil(mx[axis] - Skin);
                int end = (int)math.floor(mx[axis] + amount);
                for (int c = start; c <= end; c++)
                    if (AnySolid(world, axis, c, a1, lo1, hi1, a2, lo2, hi2))
                        return math.max(0f, c - mx[axis] - Skin);
            }
            else
            {
                int start = (int)math.floor(mn[axis] + Skin) - 1;
                int end = (int)math.floor(mn[axis] + amount);
                for (int c = start; c >= end; c--)
                    if (AnySolid(world, axis, c, a1, lo1, hi1, a2, lo2, hi2))
                        return math.min(0f, c + 1 - mn[axis] + Skin);
            }
            return amount;
        }

        static bool AnySolid(IVoxelQuery world, int axis, int c, int a1, int lo1, int hi1, int a2, int lo2, int hi2)
        {
            for (int i = lo1; i <= hi1; i++)
            for (int j = lo2; j <= hi2; j++)
            {
                int3 p = default;
                p[axis] = c;
                p[a1] = i;
                p[a2] = j;
                if (world.IsSolid(p)) return true;
            }
            return false;
        }
    }
}
