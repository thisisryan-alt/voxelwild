using System;
using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World.Generation
{
    public enum TreeKind : byte { Oak, BigOak, Birch, Spruce, TallSpruce, Jungle, JungleGiant, JungleBush, SwampOak }

    /// <summary>
    /// Adds trees and props (DecorationJob.Props.cs) to one generated column and computes its light heightmap.
    ///
    /// Determinism across column borders: tree positions come from a world-space jittered grid (so spacing
    /// never depends on what a neighbouring column contains) and every column applies all trees that can
    /// reach it - its own and its eight neighbours' - in one global order, writing only its own blocks.
    /// A tree therefore comes out identical on both sides of a border, whatever order columns load in,
    /// and regenerating a column after unload reproduces it exactly.
    /// </summary>
    [BurstCompile]
    public partial struct DecorationJob : IJob
    {
        public int2 Column;
        public uint Seed;
        public NativeArray<ushort> Voxels;                    // this column, ColumnVolume
        [ReadOnly] public NativeArray<ColumnSurface> Neighborhood;   // 9 * ChunkArea, n = (dx+1) + (dz+1)*3
        [ReadOnly] public NativeArray<BlockDefinition> Blocks;
        [WriteOnly] public NativeArray<int> Heightmap;         // ChunkArea: y of the top light-blocking block

        public const int GridCell = 5;

        struct Tree : IComparable<Tree>
        {
            public int3 Base;       // first trunk block (one above ground)
            public TreeKind Kind;
            public uint Seed;
            public int CompareTo(Tree o) => Base.z != o.Base.z ? Base.z.CompareTo(o.Base.z) : Base.x.CompareTo(o.Base.x);
        }

        public void Execute()
        {
            var trees = new NativeList<Tree>(128, Allocator.Temp);
            CollectTrees(trees);
            trees.Sort();

            var w = new Writer { Voxels = Voxels, Blocks = Blocks, Origin = Column * ChunkSize };
            for (int i = 0; i < trees.Length; i++) Build(trees[i], ref w);
            PlaceProps();       // after trees (props need open ground), before the heightmap (boulder cores block light)

            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                int top = MinWorldY - 1;
                for (int y = MaxWorldY - 1; y >= MinWorldY; y--)
                {
                    ushort b = Voxels[ColumnIndex(x, y, z)];
                    if (b != BlockId.Air && Blocks[b].LightOpacity > 0) { top = y; break; }
                }
                Heightmap[x + z * ChunkSize] = top;
            }
        }

        // ------------------------------------------------------------------ placement

        void CollectTrees(NativeList<Tree> trees)
        {
            int2 areaMin = (Column - 1) * ChunkSize;
            int2 areaMax = (Column + 2) * ChunkSize;          // exclusive
            int2 cellMin = FloorDiv(areaMin, GridCell);
            int2 cellMax = FloorDiv(areaMax - 1, GridCell);
            for (int cz = cellMin.y; cz <= cellMax.y; cz++)
            for (int cx = cellMin.x; cx <= cellMax.x; cx++)
            {
                uint h = math.hash(new int3(cx, cz, (int)(Seed ^ 0x5A17u)));
                int2 pos = new int2(cx, cz) * GridCell + new int2((int)(h & 3), (int)((h >> 2) & 3));
                if (math.any(pos < areaMin) || math.any(pos >= areaMax)) continue;

                int2 local = pos - areaMin;                    // 0..95
                int n = (local.x >> ChunkSizeLog2) + (local.y >> ChunkSizeLog2) * 3;
                var s = Neighborhood[n * ChunkArea + (local.x & ChunkMask) + (local.y & ChunkMask) * ChunkSize];
                if (s.Height < SeaLevel || s.Height > MaxWorldY - 30) continue;
                if (s.Top != BlockId.Grass && s.Top != BlockId.SnowyGrass && s.Top != BlockId.Dirt
                    && s.Top != BlockId.Moss && s.Top != BlockId.Mud) continue;

                float chance = 0f;
                float r1 = ((h >> 8) & 0xFFF) / 4096f;
                float r2 = ((h >> 20) & 0xFFF) / 4096f;
                TreeKind kind = TreeKind.Oak;
                switch (s.Biome)
                {
                    case Biome.Plains: chance = 0.05f; kind = r2 < 0.4f ? TreeKind.BigOak : TreeKind.Oak; break;
                    case Biome.Forest: chance = 0.55f; kind = r2 < 0.45f ? TreeKind.Oak : r2 < 0.8f ? TreeKind.Birch : TreeKind.BigOak; break;
                    case Biome.DenseForest: chance = 0.85f; kind = r2 < 0.5f ? TreeKind.BigOak : r2 < 0.82f ? TreeKind.Oak : TreeKind.Birch; break;
                    case Biome.Jungle: chance = 0.9f; kind = r2 < 0.16f ? TreeKind.JungleGiant : r2 < 0.58f ? TreeKind.Jungle : TreeKind.JungleBush; break;
                    case Biome.Savanna: chance = 0.08f; kind = TreeKind.SwampOak; break;
                    case Biome.Swamp: chance = 0.3f; kind = TreeKind.SwampOak; break;
                    case Biome.Taiga: chance = 0.6f; kind = r2 < 0.7f ? TreeKind.Spruce : TreeKind.TallSpruce; break;
                    case Biome.SnowyTaiga: chance = 0.45f; kind = r2 < 0.6f ? TreeKind.Spruce : TreeKind.TallSpruce; break;
                    case Biome.SnowyTundra: chance = 0.03f; kind = TreeKind.Spruce; break;
                    case Biome.Mountains: chance = s.Height < 126 ? 0.14f : 0f; kind = TreeKind.Spruce; break;
                }
                if (r1 >= chance) continue;
                trees.Add(new Tree { Base = new int3(pos.x, s.Height + 1, pos.y), Kind = kind, Seed = math.hash(new int3(pos, (int)Seed)) | 1u });
            }
        }

        static int2 FloorDiv(int2 a, int b) => new int2(
            a.x >= 0 ? a.x / b : -((-a.x + b - 1) / b),
            a.y >= 0 ? a.y / b : -((-a.y + b - 1) / b));

        // ------------------------------------------------------------------ writing

        struct Writer
        {
            public NativeArray<ushort> Voxels;
            public NativeArray<BlockDefinition> Blocks;
            public int2 Origin;

            bool Index(int3 p, out int i)
            {
                int lx = p.x - Origin.x, lz = p.z - Origin.y;
                i = 0;
                if (lx < 0 || lz < 0 || lx >= ChunkSize || lz >= ChunkSize || p.y < MinWorldY || p.y >= MaxWorldY) return false;
                i = ColumnIndex(lx, p.y, lz);
                return true;
            }

            static bool IsLeaves(ushort b) => b >= BlockId.OakLeaves && b <= BlockId.JungleLeaves;

            bool Soft(ushort b) => b == BlockId.Air
                                   || (Blocks[b].Has(BlockFlags.Replaceable) && !Blocks[b].Has(BlockFlags.Liquid));

            public void Log(int3 p, ushort log)
            {
                if (!Index(p, out int i)) return;
                ushort cur = Voxels[i];
                if (Soft(cur) || IsLeaves(cur)) Voxels[i] = log;
            }

            public void Leaf(int3 p, ushort leaves)
            {
                if (!Index(p, out int i)) return;
                if (Soft(Voxels[i])) Voxels[i] = leaves;
            }

            /// <summary>Grass under a trunk turns to dirt, like roots killing the turf.</summary>
            public void Root(int3 p)
            {
                if (!Index(p, out int i)) return;
                ushort cur = Voxels[i];
                if (cur == BlockId.Grass || cur == BlockId.SnowyGrass) Voxels[i] = BlockId.Dirt;
            }
        }

        // ------------------------------------------------------------------ shapes

        static void Build(Tree t, ref Writer w)
        {
            var rng = new Unity.Mathematics.Random(t.Seed);
            switch (t.Kind)
            {
                case TreeKind.Oak: Broadleaf(t.Base, ref rng, ref w, BlockId.OakLog, BlockId.OakLeaves, rng.NextInt(4, 7)); break;
                case TreeKind.Birch: Broadleaf(t.Base, ref rng, ref w, BlockId.BirchLog, BlockId.BirchLeaves, rng.NextInt(5, 8)); break;
                case TreeKind.BigOak: BigOak(t.Base, ref rng, ref w); break;
                case TreeKind.Spruce: Spruce(t.Base, ref rng, ref w, rng.NextInt(7, 11), 3); break;
                case TreeKind.TallSpruce: Spruce(t.Base, ref rng, ref w, rng.NextInt(12, 18), 3); break;
                case TreeKind.Jungle: Jungle(t.Base, ref rng, ref w); break;
                case TreeKind.JungleGiant: JungleGiant(t.Base, ref rng, ref w); break;
                case TreeKind.JungleBush: Bush(t.Base, ref rng, ref w); break;
                case TreeKind.SwampOak: SwampOak(t.Base, ref rng, ref w); break;
            }
        }

        static void Trunk(int3 b, int height, ushort log, ref Writer w)
        {
            w.Root(b - new int3(0, 1, 0));
            for (int y = 0; y < height; y++) w.Log(b + new int3(0, y, 0), log);
        }

        /// <summary>Ellipsoid of leaves with a ragged rim.</summary>
        static void Blob(int3 c, float rx, float ry, float rz, ushort leaves, ref Unity.Mathematics.Random rng, ref Writer w)
        {
            int ix = (int)math.ceil(rx), iy = (int)math.ceil(ry), iz = (int)math.ceil(rz);
            for (int dy = -iy; dy <= iy; dy++)
            for (int dz = -iz; dz <= iz; dz++)
            for (int dx = -ix; dx <= ix; dx++)
            {
                float d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) + (dz * dz) / (rz * rz);
                float edge = 1f - rng.NextFloat() * 0.35f;
                if (d <= edge) w.Leaf(c + new int3(dx, dy, dz), leaves);
            }
        }

        static void Broadleaf(int3 b, ref Unity.Mathematics.Random rng, ref Writer w, ushort log, ushort leaves, int h)
        {
            Trunk(b, h, log, ref w);
            for (int dy = h - 3; dy <= h; dy++)
            {
                int r = dy >= h - 1 ? 1 : 2;
                for (int dz = -r; dz <= r; dz++)
                for (int dx = -r; dx <= r; dx++)
                {
                    bool corner = math.abs(dx) == r && math.abs(dz) == r;
                    if (corner && (dy >= h - 1 || rng.NextFloat() < 0.5f)) continue;
                    w.Leaf(b + new int3(dx, dy, dz), leaves);
                }
            }
        }

        static void BigOak(int3 b, ref Unity.Mathematics.Random rng, ref Writer w)
        {
            int h = rng.NextInt(7, 11);
            Trunk(b, h, BlockId.OakLog, ref w);
            Blob(b + new int3(0, h, 0), 3.3f, 2.4f, 3.3f, BlockId.OakLeaves, ref rng, ref w);
            int branches = rng.NextInt(2, 5);
            for (int i = 0; i < branches; i++)
            {
                float a = rng.NextFloat(0f, 2f * math.PI);
                int start = rng.NextInt(h / 2, h - 1);
                int len = rng.NextInt(2, 5);
                float3 p = b + new int3(0, start, 0);
                float3 dir = math.normalize(new float3(math.cos(a), 0.55f, math.sin(a)));
                for (int k = 0; k < len; k++)
                {
                    p += dir;
                    w.Log((int3)math.floor(p + 0.5f), BlockId.OakLog);
                }
                Blob((int3)math.floor(p + 0.5f) + new int3(0, 1, 0), 2.4f, 1.8f, 2.4f, BlockId.OakLeaves, ref rng, ref w);
            }
        }

        static void Spruce(int3 b, ref Unity.Mathematics.Random rng, ref Writer w, int h, int maxR)
        {
            Trunk(b, h, BlockId.SpruceLog, ref w);
            int bare = math.max(2, h / 4 + rng.NextInt(0, 2));
            int r = 0;
            for (int y = h; y >= bare; y--)
            {
                // tiers: radius grows downward and pulls back every other layer, giving the layered cone
                int fromTop = h - y;
                r = fromTop == 0 ? 0 : math.min(maxR, 1 + fromTop / 3) - ((fromTop & 1) == 0 ? 1 : 0);
                r = math.max(r, fromTop == 0 ? 0 : 1);
                for (int dz = -r; dz <= r; dz++)
                for (int dx = -r; dx <= r; dx++)
                {
                    if (dx * dx + dz * dz > r * r + 1) continue;
                    if (math.abs(dx) + math.abs(dz) == 2 * r && r > 1 && rng.NextFloat() < 0.6f) continue;
                    w.Leaf(b + new int3(dx, y, dz), BlockId.SpruceLeaves);
                }
            }
            w.Leaf(b + new int3(0, h + 1, 0), BlockId.SpruceLeaves);
        }

        static void Jungle(int3 b, ref Unity.Mathematics.Random rng, ref Writer w)
        {
            int h = rng.NextInt(7, 12);
            Trunk(b, h, BlockId.JungleLog, ref w);
            Blob(b + new int3(0, h, 0), 3.2f, 2f, 3.2f, BlockId.JungleLeaves, ref rng, ref w);
            if (rng.NextFloat() < 0.6f)
                Blob(b + new int3(rng.NextInt(-2, 3), h - rng.NextInt(3, 5), rng.NextInt(-2, 3)), 2f, 1.4f, 2f, BlockId.JungleLeaves, ref rng, ref w);
        }

        static void JungleGiant(int3 b, ref Unity.Mathematics.Random rng, ref Writer w)
        {
            int h = rng.NextInt(16, 25);
            for (int dz = 0; dz <= 1; dz++)
            for (int dx = 0; dx <= 1; dx++)
                Trunk(b + new int3(dx, 0, dz), h, BlockId.JungleLog, ref w);
            // buttress roots flaring out at the base
            for (int i = 0; i < 4; i++)
            {
                int2 d = i == 0 ? new int2(-1, 0) : i == 1 ? new int2(2, 1) : i == 2 ? new int2(1, -1) : new int2(0, 2);
                int rh = rng.NextInt(1, 4);
                for (int y = -1; y < rh; y++) w.Log(b + new int3(d.x, y, d.y), BlockId.JungleLog);
            }
            float3 top = b + new float3(0.5f, h, 0.5f);
            Blob((int3)math.floor(top), 5.2f, 3f, 5.2f, BlockId.JungleLeaves, ref rng, ref w);
            int branches = rng.NextInt(3, 6);
            for (int i = 0; i < branches; i++)
            {
                float a = rng.NextFloat(0f, 2f * math.PI);
                float3 p = b + new float3(0.5f, h - rng.NextInt(3, 8), 0.5f);
                float3 dir = math.normalize(new float3(math.cos(a), 0.45f, math.sin(a)));
                int len = rng.NextInt(3, 6);
                for (int k = 0; k < len; k++) { p += dir; w.Log((int3)math.floor(p), BlockId.JungleLog); }
                Blob((int3)math.floor(p) + new int3(0, 1, 0), 3f, 1.8f, 3f, BlockId.JungleLeaves, ref rng, ref w);
            }
        }

        static void Bush(int3 b, ref Unity.Mathematics.Random rng, ref Writer w)
        {
            Trunk(b, 1, BlockId.JungleLog, ref w);
            Blob(b + new int3(0, 1, 0), 2.3f, 1.6f, 2.3f, BlockId.JungleLeaves, ref rng, ref w);
        }

        static void SwampOak(int3 b, ref Unity.Mathematics.Random rng, ref Writer w)
        {
            int h = rng.NextInt(5, 8);
            Trunk(b, h, BlockId.OakLog, ref w);
            Blob(b + new int3(0, h, 0), 4.2f, 1.6f, 4.2f, BlockId.OakLeaves, ref rng, ref w);
        }
    }
}
