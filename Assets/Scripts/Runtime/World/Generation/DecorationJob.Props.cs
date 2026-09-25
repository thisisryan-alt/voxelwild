using Unity.Collections;
using Unity.Mathematics;
using Voxelwild.World.Props;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World.Generation
{
    /// <summary>
    /// Prop placement (Phase 3), run by the decoration job after trees and before the light heightmap.
    ///
    /// Props are placed from this column's own voxels and write only this column (boulder cores and barrier
    /// cells), so they need no neighbour data and come out identical whenever the column is regenerated.
    /// Candidates come from world-space hashes: per surface cell for small props, one hashed spot per
    /// Grid x Grid cell for big ones (keeps them apart), and per open cell next to cave rock underground.
    /// Big props are placed first and claim the cells around them.
    /// </summary>
    public partial struct DecorationJob
    {
        /// <summary>Prop rules (<see cref="PropRegistry.CreateNative"/>); an empty array places no props.</summary>
        [ReadOnly] public NativeArray<PropRule> PropRules;
        /// <summary>Output: this column's props, cleared first.</summary>
        public NativeList<PropInstance> Props;

        const int CaveDepth = 6;        // cave props stay at least this far below the surface height
        const int MaxRoom = 16;

        void PlaceProps()
        {
            Props.Clear();
            var taken = new NativeArray<byte>(ChunkArea, Allocator.Temp);
            // two passes over ground kinds: spaced big props first, then per-cell small ones
            for (int pass = 0; pass < 2; pass++)
            for (int k = 0; k < PropRules.Length; k++)
            {
                var rule = PropRules[k];
                if (rule.Placement != PropPlacement.Ground || (rule.Grid > 1) != (pass == 0)) continue;
                if (rule.Grid > 1) PlaceGrid(k, rule, taken);
                else
                    for (int z = 0; z < ChunkSize; z++)
                    for (int x = 0; x < ChunkSize; x++)
                        TryGround(k, rule, x, z, taken);
            }
            PlaceCave();
        }

        void PlaceGrid(int kind, in PropRule rule, NativeArray<byte> taken)
        {
            int g = rule.Grid;
            int2 origin = Column * ChunkSize;
            int2 cellMin = FloorDiv(origin, g);
            int2 cellMax = FloorDiv(origin + ChunkSize - 1, g);
            for (int cz = cellMin.y; cz <= cellMax.y; cz++)
            for (int cx = cellMin.x; cx <= cellMax.x; cx++)
            {
                uint h = math.hash(new int4(cx, cz, kind, (int)(Seed ^ 0x9E37u)));
                int2 p = new int2(cx, cz) * g + new int2((int)(h % (uint)g), (int)((h >> 8) % (uint)g));
                int2 l = p - origin;
                // each hashed spot lies in exactly one column, which owns it
                if (math.any(l < 0) || math.any(l >= ChunkSize)) continue;
                TryGround(kind, rule, l.x, l.y, taken);
            }
        }

        void TryGround(int kind, in PropRule rule, int lx, int lz, NativeArray<byte> taken)
        {
            if (taken[lx + lz * ChunkSize] != 0) return;
            var s = Neighborhood[4 * ChunkArea + lx + lz * ChunkSize];     // index 4 = this column
            if (!rule.InBiome(s.Biome)) return;
            int wx = Column.x * ChunkSize + lx, wz = Column.y * ChunkSize + lz;

            uint h = math.hash(new int4(wx, wz, kind, (int)Seed));
            float chance = rule.Chance * (rule.Rich(s.Biome) ? rule.RichFactor : 1f)
                           * Cluster(rule, new float3(wx, 0f, wz), kind);
            if ((h & 0xFFFFFF) / 16777216f >= chance) return;

            int ground = s.Height;
            int anchor = ground + 1;
            if (ground <= MinWorldY || anchor + rule.Clearance >= MaxWorldY) return;
            if (!rule.Supports(Voxels[ColumnIndex(lx, ground, lz)])) return;

            uint h2 = math.hash(new int4(wx, wz, kind, (int)(Seed * 747796405u + 1)));
            byte yaw = rule.Cardinal ? (byte)((h2 & 3) * 64) : (byte)(h2 & 255);
            var probe = new PropInstance { Yaw = yaw };
            int3 axis = rule.Footprint > 0 ? PropRegistry.FootprintAxis(probe) : int3.zero;

            // every cell of the footprint: inside this column, unclaimed, same flat support, open above
            for (int t = -rule.Footprint; t <= rule.Footprint; t++)
            {
                int x = lx + axis.x * t, z = lz + axis.z * t;
                if (x < 0 || z < 0 || x >= ChunkSize || z >= ChunkSize) return;
                if (taken[x + z * ChunkSize] != 0) return;
                if (!rule.Supports(Voxels[ColumnIndex(x, ground, z)])) return;
                for (int c = 0; c < rule.Clearance; c++)
                    if (Voxels[ColumnIndex(x, anchor + c, z)] != BlockId.Air) return;
            }

            int room = 0;
            while (room < MaxRoom && anchor + room < MaxWorldY && Voxels[ColumnIndex(lx, anchor + room, lz)] == BlockId.Air) room++;

            // claim: the footprint, plus a one-cell ring around spaced (big) props
            int ring = rule.Grid > 1 ? 1 : 0;
            for (int t = -rule.Footprint; t <= rule.Footprint; t++)
            for (int dz = -ring; dz <= ring; dz++)
            for (int dx = -ring; dx <= ring; dx++)
            {
                int x = lx + axis.x * t + dx, z = lz + axis.z * t + dz;
                if (x >= 0 && z >= 0 && x < ChunkSize && z < ChunkSize) taken[x + z * ChunkSize] = 1;
            }

            if (rule.CoreBlock != BlockId.Air) Voxels[ColumnIndex(lx, anchor, lz)] = rule.CoreBlock;
            for (int t = -rule.Footprint; t <= rule.Footprint; t++)
            for (int y = 0; y < rule.BarrierHeight; y++)
            {
                int i = ColumnIndex(lx + axis.x * t, anchor + y, lz + axis.z * t);
                if (Voxels[i] == BlockId.Air) Voxels[i] = BlockId.PropBarrier;
            }

            Props.Add(new PropInstance
            {
                Cell = new int3(wx, anchor, wz),
                Kind = (byte)kind,
                Variant = (byte)((h2 >> 8) % math.max(1u, rule.Variants)),
                Yaw = yaw,
                Scale = (byte)(h2 >> 16),
                Room = (byte)room,
            });
        }

        void PlaceCave()
        {
            int2 origin = Column * ChunkSize;
            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                var s = Neighborhood[4 * ChunkArea + x + z * ChunkSize];
                int top = math.min(s.Height - CaveDepth, MaxWorldY - 2);
                for (int y = MinWorldY + 1; y <= top; y++)
                {
                    if (Voxels[ColumnIndex(x, y, z)] != BlockId.Air) continue;
                    ushort below = Voxels[ColumnIndex(x, y - 1, z)];
                    ushort above = Voxels[ColumnIndex(x, y + 1, z)];
                    for (int k = 0; k < PropRules.Length; k++)
                    {
                        var rule = PropRules[k];
                        bool floor = rule.Placement == PropPlacement.CaveFloor && rule.Supports(below);
                        bool ceiling = rule.Placement == PropPlacement.CaveCeiling && rule.Supports(above);
                        if (!floor && !ceiling) continue;
                        int wx = origin.x + x, wz = origin.y + z;
                        uint h = math.hash(new int4(wx, y, wz, k ^ (int)(Seed * 2654435761u)));
                        float chance = rule.Chance * Cluster(rule, new float3(wx, y, wz), k);
                        if ((h & 0xFFFFFF) / 16777216f >= chance) continue;

                        int dir = floor ? 1 : -1;
                        int room = 0;
                        while (room < MaxRoom)
                        {
                            int yy = y + dir * room;
                            if (yy <= MinWorldY || yy >= MaxWorldY || Voxels[ColumnIndex(x, yy, z)] != BlockId.Air) break;
                            room++;
                        }
                        if (room < rule.Clearance) continue;
                        uint h2 = math.hash(new int4(wx, y, wz, k + 101));
                        Props.Add(new PropInstance
                        {
                            Cell = new int3(wx, y, wz),
                            Kind = (byte)k,
                            Variant = (byte)((h2 >> 8) % math.max(1u, rule.Variants)),
                            Yaw = (byte)(h2 & 255),
                            Scale = (byte)(h2 >> 16),
                            Room = (byte)room,
                        });
                        break;      // one cave prop per cell
                    }
                }
            }
        }

        /// <summary>Clumping: a smooth noise field in [0, 3], about 1 on average, so props gather in patches.</summary>
        float Cluster(in PropRule rule, float3 p, int kind)
        {
            if (rule.ClusterFrequency <= 0f) return 1f;
            float3 off = new float3(kind * 37.1f, (Seed & 1023) * 0.61f, kind * -11.7f);
            float n = noise.snoise(p * rule.ClusterFrequency + off);
            return math.smoothstep(-0.2f, 0.7f, n) * 3f;
        }
    }
}
