using System.Runtime.InteropServices;
using Unity.Burst;
using Unity.Collections;
using Unity.Collections.LowLevel.Unsafe;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine.Rendering;
using Voxelwild.World.Generation;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World.Meshing
{
    /// <summary>
    /// 24-byte terrain vertex (section-local position + three UNorm8x4 attributes).
    /// Data0 (TEXCOORD0): x = face (bits 0-2) | convex-edge mask or plant UV corner (bits 3-6),
    ///                    y = texture layer, z = voxel AO (0..3 * 85), w = side overlay layer (255 none)
    /// Data1 (TEXCOORD1): x = sky light * 17, y = block light * 17, z = temperature, w = humidity
    /// Data2 (TEXCOORD2): x = tint mode, y = wind weight, zw = reserved
    /// </summary>
    [StructLayout(LayoutKind.Sequential)]
    public struct TerrainVertex
    {
        public float3 Position;
        public uint Data0;
        public uint Data1;
        public uint Data2;

        public static readonly VertexAttributeDescriptor[] Layout =
        {
            new VertexAttributeDescriptor(VertexAttribute.Position, VertexAttributeFormat.Float32, 3),
            new VertexAttributeDescriptor(VertexAttribute.TexCoord0, VertexAttributeFormat.UNorm8, 4),
            new VertexAttributeDescriptor(VertexAttribute.TexCoord1, VertexAttributeFormat.UNorm8, 4),
            new VertexAttributeDescriptor(VertexAttribute.TexCoord2, VertexAttributeFormat.UNorm8, 4),
        };

        public static uint Pack(int face, int edges, int layer, int ao, int overlay) =>
            (uint)(face | (edges << 3)) | ((uint)layer << 8) | ((uint)(ao * 85) << 16) | ((uint)overlay << 24);

        public static uint PackLight(int sky, int block, int temp, int humid) =>
            (uint)(sky * 17) | ((uint)(block * 17) << 8) | ((uint)temp << 16) | ((uint)humid << 24);

        public int Face => (int)(Data0 & 7);
        public int Edges => (int)((Data0 >> 3) & 15);
        public int Layer => (int)((Data0 >> 8) & 255);
        public int AO => (int)((Data0 >> 16) & 255) / 85;
        public int Overlay => (int)(Data0 >> 24);
        public int SkyLight => (int)(Data1 & 255) / 17;
        public int BlockLight => (int)((Data1 >> 8) & 255) / 17;
        public int Tint => (int)(Data2 & 255);
        public int Wind => (int)((Data2 >> 8) & 255);
    }

    /// <summary>
    /// Builds the 64^3 mesher/lighting region around a section from its 26 neighbours, plus the matching
    /// 64x64 heightmap and climate patches, so the mesh job owns all of its input. Burst direct call.
    /// </summary>
    [BurstCompile]
    public static unsafe class NeighborhoodBuilder
    {
        /// <param name="sources">27 section pointers, index (dx+1) + (dz+1)*3 + (dy+1)*9; null = uniform.</param>
        /// <param name="uniform">27 block ids used where the pointer is null.</param>
        /// <param name="heightmaps">9 column heightmaps (ChunkArea ints), index (dx+1) + (dz+1)*3; null = no column.</param>
        /// <param name="surfaces">9 column surfaces (ChunkArea), same indexing; null = no column.</param>
        [BurstCompile]
        public static void Build(ushort** sources, ushort* uniform, int** heightmaps, ColumnSurface** surfaces,
                                 ushort* region, int* heightPatch, ushort* climatePatch)
        {
            for (int ry = 0; ry < RegionSize; ry++)
            {
                int sy = ry - RegionMargin;
                int dy = sy < 0 ? -1 : sy >= ChunkSize ? 1 : 0;
                int ly = sy - dy * ChunkSize;
                for (int rz = 0; rz < RegionSize; rz++)
                {
                    int sz = rz - RegionMargin;
                    int dz = sz < 0 ? -1 : sz >= ChunkSize ? 1 : 0;
                    int lz = sz - dz * ChunkSize;
                    int rowBase = rz * RegionSize + ry * RegionArea;
                    for (int rx = 0; rx < RegionSize; rx++)
                    {
                        int sx = rx - RegionMargin;
                        int dx = sx < 0 ? -1 : sx >= ChunkSize ? 1 : 0;
                        int lx = sx - dx * ChunkSize;
                        int n = (dx + 1) + (dz + 1) * 3 + (dy + 1) * 9;
                        ushort* src = sources[n];
                        region[rowBase + rx] = src == null
                            ? uniform[n]
                            : src[lx + (lz << ChunkSizeLog2) + (ly << (ChunkSizeLog2 * 2))];
                    }
                }
            }

            for (int rz = 0; rz < RegionSize; rz++)
            {
                int sz = rz - RegionMargin;
                int dz = sz < 0 ? -1 : sz >= ChunkSize ? 1 : 0;
                int lz = sz - dz * ChunkSize;
                for (int rx = 0; rx < RegionSize; rx++)
                {
                    int sx = rx - RegionMargin;
                    int dx = sx < 0 ? -1 : sx >= ChunkSize ? 1 : 0;
                    int lx = sx - dx * ChunkSize;
                    int n = (dx + 1) + (dz + 1) * 3;
                    int li = lx + lz * ChunkSize;
                    int o = rx + rz * RegionSize;
                    heightPatch[o] = heightmaps[n] != null ? heightmaps[n][li] : MinWorldY - 1;
                    climatePatch[o] = surfaces[n] != null
                        ? (ushort)(surfaces[n][li].Temperature | (surfaces[n][li].Humidity << 8))
                        : (ushort)(128 | (128 << 8));
                }
            }
        }
    }

    /// <summary>
    /// Lights and meshes one section.
    /// Lighting: sky light is 15 above each column's topmost light-blocking block and floods from there
    /// (under overhangs, into caves, dimmed by leaves and water); block light floods from emitters.
    /// Both are BFS over the 64^3 region, which contains every source that can reach the section.
    /// Meshing: face-culled cubes with voxel AO, convex-edge flags and smooth per-vertex light; cutout
    /// leaves; crossed plants; torches; water.
    /// </summary>
    [BurstCompile]
    public struct ChunkMeshJob : IJob
    {
        public int3 Section;
        /// <summary>
        /// Source pointers: [0..26] section voxel arrays (index (dx+1)+(dz+1)*3+(dy+1)*9, 0 = uniform),
        /// [27..35] column heightmaps, [36..44] column surfaces (index (dx+1)+(dz+1)*3, 0 = missing).
        /// The job copies them into its own region first, so the main thread never pays for the copy.
        /// VoxelWorld keeps the referenced columns loaded until the job completes; concurrent edits only
        /// produce a stale mesh, which the section version check discards.
        /// </summary>
        public bool CopyRegion;
        [ReadOnly] public NativeArray<long> Sources;
        [ReadOnly] public NativeArray<ushort> Uniform;
        /// <summary>Near the camera: keep faces between neighbouring leaf blocks (depth through the gaps).
        /// Far away: drop them, which roughly thirds the triangle count of a forest.</summary>
        public bool FancyLeaves;
        public NativeArray<ushort> Region;
        public NativeArray<int> HeightPatch;
        public NativeArray<ushort> ClimatePatch;
        [ReadOnly] public NativeArray<BlockDefinition> Blocks;

        public NativeArray<byte> Sky;
        public NativeArray<byte> BlockLight;
        public NativeList<int> Queue;

        public NativeList<TerrainVertex> Vertices;
        public NativeList<uint> OpaqueIndices;
        public NativeList<uint> CutoutIndices;
        public NativeList<uint> WaterIndices;

        /// <summary>Scratch for the connectivity flood fill (ChunkVolume).</summary>
        public NativeArray<byte> Visited;
        /// <summary>[0] = face-to-face connectivity through non-opaque cells: bit (a*6+b) set when faces a and b
        /// are joined by open space inside the section (used for cave/occlusion culling).</summary>
        public NativeArray<ulong> Connectivity;
        /// <summary>[0] = number of cutout-cube (leaf) blocks meshed.</summary>
        public NativeArray<int> Stats;

        const float WaterSurfaceDrop = 0.12f;

        public void Execute()
        {
            Vertices.Clear();
            OpaqueIndices.Clear();
            CutoutIndices.Clear();
            WaterIndices.Clear();

            if (CopyRegion) FillRegion();
            ComputeLight();
            ComputeConnectivity();
            int leaves = 0;

            for (int y = 0; y < ChunkSize; y++)
            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                ushort id = Region[RegionIndex(x, y, z)];
                if (id == BlockId.Air) continue;
                var def = Get(id);
                var p = new int3(x, y, z);
                switch (def.Shape)
                {
                    case RenderShape.Cube:
                        for (int face = 0; face < 6; face++)
                            if (!IsOpaque(p + Faces.Normal(face))) EmitCubeFace(p, face, def);
                        break;
                    case RenderShape.CutoutCube:
                        leaves++;
                        for (int face = 0; face < 6; face++)
                        {
                            int3 n = p + Faces.Normal(face);
                            if (IsOpaque(n)) continue;
                            if (!FancyLeaves && Get(At(n)).Shape == RenderShape.CutoutCube) continue;
                            EmitCubeFace(p, face, def);
                        }
                        break;
                    case RenderShape.Cross: EmitCross(p, def); break;
                    case RenderShape.Torch: EmitTorch(p, def); break;
                    case RenderShape.Liquid: EmitWater(p, id); break;
                }
            }
            Stats[0] = leaves;
        }

        unsafe void FillRegion()
        {
            ushort** sources = stackalloc ushort*[27];
            int** heights = stackalloc int*[9];
            ColumnSurface** surfaces = stackalloc ColumnSurface*[9];
            for (int i = 0; i < 27; i++) sources[i] = (ushort*)Sources[i];
            for (int i = 0; i < 9; i++)
            {
                heights[i] = (int*)Sources[27 + i];
                surfaces[i] = (ColumnSurface*)Sources[36 + i];
            }
            NeighborhoodBuilder.Build(sources, (ushort*)Uniform.GetUnsafeReadOnlyPtr(), heights, surfaces,
                (ushort*)Region.GetUnsafePtr(), (int*)HeightPatch.GetUnsafePtr(), (ushort*)ClimatePatch.GetUnsafePtr());
        }

        // ------------------------------------------------------------------ lighting

        void ComputeLight()
        {
            int baseY = Section.y * ChunkSize - RegionMargin;
            Queue.Clear();

            // initialise: open sky above each column's heightmap, emitters for block light
            for (int y = 0; y < RegionSize; y++)
            {
                int wy = baseY + y;
                for (int z = 0; z < RegionSize; z++)
                for (int x = 0; x < RegionSize; x++)
                {
                    int i = x + z * RegionSize + y * RegionArea;
                    Sky[i] = (byte)(wy > HeightPatch[x + z * RegionSize] ? MaxLight : 0);
                    byte e = Blocks[Region[i]].LightEmission;
                    BlockLight[i] = e;
                    if (e > 0) Queue.Add(i);
                }
            }
            Flood(BlockLight);

            // sky seeds: open-sky cells next to shaded ones (column edges, and the cell right above a
            // translucent top block such as leaves or water)
            Queue.Clear();
            for (int z = 0; z < RegionSize; z++)
            for (int x = 0; x < RegionSize; x++)
            {
                int h = HeightPatch[x + z * RegionSize];
                int top = h;
                if (x > 0) top = math.max(top, HeightPatch[x - 1 + z * RegionSize]);
                if (x < RegionSize - 1) top = math.max(top, HeightPatch[x + 1 + z * RegionSize]);
                if (z > 0) top = math.max(top, HeightPatch[x + (z - 1) * RegionSize]);
                if (z < RegionSize - 1) top = math.max(top, HeightPatch[x + (z + 1) * RegionSize]);
                int from = math.max(h + 1 - baseY, 0);
                int to = math.min(math.max(top, h + 1) - baseY, RegionSize - 1);
                for (int y = from; y <= to; y++) Queue.Add(x + z * RegionSize + y * RegionArea);
            }
            Flood(Sky);
        }

        void Flood(NativeArray<byte> light)
        {
            int head = 0;
            while (head < Queue.Length)
            {
                int i = Queue[head++];
                int l = light[i];
                if (l <= 1) continue;
                int x = i & (RegionSize - 1), z = (i >> 6) & (RegionSize - 1), y = i >> 12;
                if (x > 0) Spread(light, i - 1, l);
                if (x < RegionSize - 1) Spread(light, i + 1, l);
                if (z > 0) Spread(light, i - RegionSize, l);
                if (z < RegionSize - 1) Spread(light, i + RegionSize, l);
                if (y > 0) Spread(light, i - RegionArea, l);
                if (y < RegionSize - 1) Spread(light, i + RegionArea, l);
            }
            Queue.Clear();
        }

        void Spread(NativeArray<byte> light, int n, int l)
        {
            int op = Blocks[Region[n]].LightOpacity;
            if (op >= MaxLight) return;
            int nl = l - math.max(1, op);
            if (nl > light[n])
            {
                light[n] = (byte)nl;
                Queue.Add(n);
            }
        }

        // ------------------------------------------------------------------ visibility

        /// <summary>
        /// Flood-fills the section's non-opaque cells; every region that touches several faces joins those
        /// faces. The world's visibility search only walks between joined faces, so sealed caves (and the
        /// surface, seen from deep inside rock) are culled.
        /// </summary>
        void ComputeConnectivity()
        {
            ulong conn = 0;
            for (int i = 0; i < ChunkVolume; i++) Visited[i] = 0;
            Queue.Clear();
            for (int start = 0; start < ChunkVolume; start++)
            {
                if (Visited[start] != 0) continue;
                int sx = start & ChunkMask, sz = (start >> ChunkSizeLog2) & ChunkMask, sy = start >> (ChunkSizeLog2 * 2);
                if (IsOpaque(new int3(sx, sy, sz))) { Visited[start] = 1; continue; }

                int faces = 0;
                Queue.Clear();
                Queue.Add(start);
                Visited[start] = 1;
                int head = 0;
                while (head < Queue.Length)
                {
                    int i = Queue[head++];
                    int x = i & ChunkMask, z = (i >> ChunkSizeLog2) & ChunkMask, y = i >> (ChunkSizeLog2 * 2);
                    if (x == ChunkSize - 1) faces |= 1 << Faces.PosX;
                    if (x == 0) faces |= 1 << Faces.NegX;
                    if (y == ChunkSize - 1) faces |= 1 << Faces.PosY;
                    if (y == 0) faces |= 1 << Faces.NegY;
                    if (z == ChunkSize - 1) faces |= 1 << Faces.PosZ;
                    if (z == 0) faces |= 1 << Faces.NegZ;
                    if (x > 0) Visit(i - 1, x - 1, y, z);
                    if (x < ChunkSize - 1) Visit(i + 1, x + 1, y, z);
                    if (z > 0) Visit(i - ChunkSize, x, y, z - 1);
                    if (z < ChunkSize - 1) Visit(i + ChunkSize, x, y, z + 1);
                    if (y > 0) Visit(i - ChunkArea, x, y - 1, z);
                    if (y < ChunkSize - 1) Visit(i + ChunkArea, x, y + 1, z);
                }
                for (int a = 0; a < 6; a++)
                {
                    if ((faces & (1 << a)) == 0) continue;
                    for (int b = 0; b < 6; b++)
                        if ((faces & (1 << b)) != 0) conn |= 1ul << (a * 6 + b);
                }
            }
            Queue.Clear();
            Connectivity[0] = conn;
        }

        void Visit(int i, int x, int y, int z)
        {
            if (Visited[i] != 0) return;
            Visited[i] = 1;
            if (!IsOpaque(new int3(x, y, z))) Queue.Add(i);
        }

        // ------------------------------------------------------------------ helpers

        BlockDefinition Get(ushort id) => id < Blocks.Length ? Blocks[id] : Blocks[0];
        ushort At(int3 p) => Region[RegionIndex(p.x, p.y, p.z)];
        bool IsOpaque(int3 p) => Get(At(p)).Has(BlockFlags.Opaque);

        int2 LightAt(int3 p)
        {
            int i = RegionIndex(p.x, p.y, p.z);
            return new int2(Sky[i], BlockLight[i]);
        }

        uint Climate(int3 p)
        {
            ushort c = ClimatePatch[(p.x + RegionMargin) + (p.z + RegionMargin) * RegionSize];
            return (uint)c;
        }

        uint LightData(int2 light, int3 climateCell)
        {
            uint c = Climate(climateCell);
            return TerrainVertex.PackLight(light.x, light.y, (int)(c & 255), (int)(c >> 8));
        }

        static uint Extra(BlockDefinition def, int wind) => (uint)def.Tint | ((uint)wind << 8);

        /// <summary>Smooth light at a face corner: mean over the non-opaque cells of the 2x2 front layer.</summary>
        int2 CornerLight(int3 front, int3 side1, int3 side2, bool s1, bool s2)
        {
            int2 sum = LightAt(front);
            int count = 1;
            if (!s1) { sum += LightAt(side1); count++; }
            if (!s2) { sum += LightAt(side2); count++; }
            if (!(s1 && s2))
            {
                int3 corner = side1 + side2 - front;
                if (!IsOpaque(corner)) { sum += LightAt(corner); count++; }
            }
            return (sum + count / 2) / count;
        }

        // ------------------------------------------------------------------ shapes

        void EmitCubeFace(int3 p, int face, BlockDefinition def)
        {
            int3 n = Faces.Normal(face);
            int3 t = Faces.Tangent(face);
            int3 b = Faces.Bitangent(face);
            int3 front = p + n;
            bool cutout = def.Shape == RenderShape.CutoutCube;

            int edges = cutout ? 0
                : (IsOpaque(p - t) ? 0 : 1) | (IsOpaque(p + t) ? 0 : 2) | (IsOpaque(p - b) ? 0 : 4) | (IsOpaque(p + b) ? 0 : 8);

            bool sNT = IsOpaque(front - t), sPT = IsOpaque(front + t);
            bool sNB = IsOpaque(front - b), sPB = IsOpaque(front + b);
            int ao0 = Ao(sNT, sNB, IsOpaque(front - t - b));
            int ao1 = Ao(sNT, sPB, IsOpaque(front - t + b));
            int ao2 = Ao(sPT, sPB, IsOpaque(front + t + b));
            int ao3 = Ao(sPT, sNB, IsOpaque(front + t - b));
            int2 l0 = CornerLight(front, front - t, front - b, sNT, sNB);
            int2 l1 = CornerLight(front, front - t, front + b, sNT, sPB);
            int2 l2 = CornerLight(front, front + t, front + b, sPT, sPB);
            int2 l3 = CornerLight(front, front + t, front - b, sPT, sNB);

            int layer = (int)def.LayerForFace(face);
            int overlay = face != Faces.PosY && face != Faces.NegY ? (int)def.SideOverlay : 255;
            uint extra = Extra(def, def.Wind);

            float3 center = (float3)p + 0.5f + (float3)n * 0.5f;
            float3 ht = (float3)t * 0.5f, hb = (float3)b * 0.5f;

            uint start = (uint)Vertices.Length;
            Vertices.Add(new TerrainVertex { Position = center - ht - hb, Data0 = TerrainVertex.Pack(face, edges, layer, ao0, overlay), Data1 = LightData(l0, p), Data2 = extra });
            Vertices.Add(new TerrainVertex { Position = center - ht + hb, Data0 = TerrainVertex.Pack(face, edges, layer, ao1, overlay), Data1 = LightData(l1, p), Data2 = extra });
            Vertices.Add(new TerrainVertex { Position = center + ht + hb, Data0 = TerrainVertex.Pack(face, edges, layer, ao2, overlay), Data1 = LightData(l2, p), Data2 = extra });
            Vertices.Add(new TerrainVertex { Position = center + ht - hb, Data0 = TerrainVertex.Pack(face, edges, layer, ao3, overlay), Data1 = LightData(l3, p), Data2 = extra });

            int s02 = ao0 + ao2 + (l0.x + l2.x) / 8, s13 = ao1 + ao3 + (l1.x + l3.x) / 8;
            if (cutout)
            {
                if (s02 >= s13) AddQuad(ref CutoutIndices, start, 0, 1, 2, 0, 2, 3);
                else AddQuad(ref CutoutIndices, start, 1, 2, 3, 1, 3, 0);
            }
            else
            {
                if (s02 >= s13) AddQuad(ref OpaqueIndices, start, 0, 1, 2, 0, 2, 3);
                else AddQuad(ref OpaqueIndices, start, 1, 2, 3, 1, 3, 0);
            }
        }

        /// <summary>Two crossed double-sided quads, jittered per block so fields of plants don't grid.</summary>
        void EmitCross(int3 p, BlockDefinition def)
        {
            int3 world = Section * ChunkSize + p;
            uint h = math.hash(world);
            float2 jitter = (new float2(h & 255, (h >> 8) & 255) / 255f - 0.5f) * 0.3f;
            float height = def.Wind > 0 ? 0.85f + ((h >> 16) & 255) / 255f * 0.3f : 1f;
            int2 light = LightAt(p);
            uint data1 = LightData(light, p);
            int layer = (int)def.Side;
            const float inset = 0.08f;
            for (int plane = 0; plane < 2; plane++)
            {
                int face = plane == 0 ? Faces.CrossA : Faces.CrossB;
                float3 a = plane == 0 ? new float3(inset, 0, inset) : new float3(1 - inset, 0, inset);
                float3 c = plane == 0 ? new float3(1 - inset, 0, 1 - inset) : new float3(inset, 0, 1 - inset);
                a.xz += jitter; c.xz += jitter;
                float3 o = p;
                uint start = (uint)Vertices.Length;
                // edge bits carry the quad corner (bit0 = u, bit1 = v); AO darkens the base
                Vertices.Add(new TerrainVertex { Position = o + a, Data0 = TerrainVertex.Pack(face, 0, layer, 1, 255), Data1 = data1, Data2 = Extra(def, 0) });
                Vertices.Add(new TerrainVertex { Position = o + a + new float3(0, height, 0), Data0 = TerrainVertex.Pack(face, 2, layer, 3, 255), Data1 = data1, Data2 = Extra(def, def.Wind) });
                Vertices.Add(new TerrainVertex { Position = o + c + new float3(0, height, 0), Data0 = TerrainVertex.Pack(face, 3, layer, 3, 255), Data1 = data1, Data2 = Extra(def, def.Wind) });
                Vertices.Add(new TerrainVertex { Position = o + c, Data0 = TerrainVertex.Pack(face, 1, layer, 1, 255), Data1 = data1, Data2 = Extra(def, 0) });
                AddQuad(ref CutoutIndices, start, 0, 1, 2, 0, 2, 3);
            }
        }

        /// <summary>2/16-wide, 10/16-tall post; world-projected UVs put the ember at the top.</summary>
        void EmitTorch(int3 p, BlockDefinition def)
        {
            const float lo = 7f / 16f, hi = 9f / 16f, top = 10f / 16f;
            float3 min = (float3)p + new float3(lo, 0, lo);
            float3 max = (float3)p + new float3(hi, top, hi);
            uint data1 = LightData(LightAt(p), p);
            for (int face = 0; face < 6; face++)
            {
                if (face == Faces.NegY) continue;
                int3 n = Faces.Normal(face);
                float3 t = Faces.Tangent(face), b = Faces.Bitangent(face);
                float3 c = (min + max) * 0.5f;
                float3 half = (max - min) * 0.5f;
                float3 center = c + (float3)n * half;
                float3 ht = t * half, hb = b * half;
                uint d0 = TerrainVertex.Pack(face, 0, (int)def.LayerForFace(face), 3, 255);
                uint start = (uint)Vertices.Length;
                Vertices.Add(new TerrainVertex { Position = center - ht - hb, Data0 = d0, Data1 = data1 });
                Vertices.Add(new TerrainVertex { Position = center - ht + hb, Data0 = d0, Data1 = data1 });
                Vertices.Add(new TerrainVertex { Position = center + ht + hb, Data0 = d0, Data1 = data1 });
                Vertices.Add(new TerrainVertex { Position = center + ht - hb, Data0 = d0, Data1 = data1 });
                AddQuad(ref OpaqueIndices, start, 0, 1, 2, 0, 2, 3);
            }
        }

        void EmitWater(int3 p, ushort id)
        {
            bool surface = At(p + new int3(0, 1, 0)) != id;
            for (int face = 0; face < 6; face++)
            {
                int3 n = Faces.Normal(face);
                ushort other = At(p + n);
                if (other == id || Get(other).Has(BlockFlags.Opaque)) continue;

                int3 t = Faces.Tangent(face);
                int3 b = Faces.Bitangent(face);
                float3 center = (float3)p + 0.5f + (float3)n * 0.5f;
                float3 ht = (float3)t * 0.5f, hb = (float3)b * 0.5f;
                float3 v0 = center - ht - hb, v1 = center - ht + hb, v2 = center + ht + hb, v3 = center + ht - hb;

                if (surface)
                {
                    float topY = p.y + 1f - WaterSurfaceDrop;
                    if (face == Faces.PosY) { v0.y = v1.y = v2.y = v3.y = topY; }
                    else if (face != Faces.NegY) { v1.y = math.min(v1.y, topY); v2.y = math.min(v2.y, topY); }
                }

                uint data0 = TerrainVertex.Pack(face, 0, 255, 3, 255);
                uint data1 = LightData(math.max(LightAt(p), LightAt(p + n)), p);
                uint start = (uint)Vertices.Length;
                Vertices.Add(new TerrainVertex { Position = v0, Data0 = data0, Data1 = data1 });
                Vertices.Add(new TerrainVertex { Position = v1, Data0 = data0, Data1 = data1 });
                Vertices.Add(new TerrainVertex { Position = v2, Data0 = data0, Data1 = data1 });
                Vertices.Add(new TerrainVertex { Position = v3, Data0 = data0, Data1 = data1 });
                AddQuad(ref WaterIndices, start, 0, 1, 2, 0, 2, 3);
            }
        }

        static int Ao(bool side1, bool side2, bool corner) =>
            side1 && side2 ? 0 : 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0));

        static void AddQuad(ref NativeList<uint> list, uint s, uint a, uint b, uint c, uint d, uint e, uint f)
        {
            list.Add(s + a); list.Add(s + b); list.Add(s + c);
            list.Add(s + d); list.Add(s + e); list.Add(s + f);
        }
    }

    /// <summary>Reusable buffers for one in-flight mesh job (~1.2 MB).</summary>
    public sealed class MeshJobBuffers : System.IDisposable
    {
        public NativeArray<ushort> Region;
        public NativeArray<int> HeightPatch;
        public NativeArray<ushort> ClimatePatch;
        public NativeArray<byte> Sky;
        public NativeArray<byte> BlockLight;
        public NativeList<int> Queue;
        public NativeList<TerrainVertex> Vertices;
        public NativeList<uint> OpaqueIndices;
        public NativeList<uint> CutoutIndices;
        public NativeList<uint> WaterIndices;
        public NativeArray<byte> Visited;
        public NativeArray<ulong> Connectivity;
        public NativeArray<int> Stats;
        public NativeArray<long> Sources;
        public NativeArray<ushort> Uniform;

        public MeshJobBuffers()
        {
            Region = new NativeArray<ushort>(RegionVolume, Allocator.Persistent, NativeArrayOptions.UninitializedMemory);
            HeightPatch = new NativeArray<int>(RegionArea, Allocator.Persistent, NativeArrayOptions.UninitializedMemory);
            ClimatePatch = new NativeArray<ushort>(RegionArea, Allocator.Persistent, NativeArrayOptions.UninitializedMemory);
            Sky = new NativeArray<byte>(RegionVolume, Allocator.Persistent, NativeArrayOptions.UninitializedMemory);
            BlockLight = new NativeArray<byte>(RegionVolume, Allocator.Persistent, NativeArrayOptions.UninitializedMemory);
            Queue = new NativeList<int>(16384, Allocator.Persistent);
            Vertices = new NativeList<TerrainVertex>(8192, Allocator.Persistent);
            OpaqueIndices = new NativeList<uint>(12288, Allocator.Persistent);
            CutoutIndices = new NativeList<uint>(2048, Allocator.Persistent);
            WaterIndices = new NativeList<uint>(1024, Allocator.Persistent);
            Visited = new NativeArray<byte>(ChunkVolume, Allocator.Persistent, NativeArrayOptions.UninitializedMemory);
            Connectivity = new NativeArray<ulong>(1, Allocator.Persistent);
            Stats = new NativeArray<int>(1, Allocator.Persistent);
            Sources = new NativeArray<long>(45, Allocator.Persistent);
            Uniform = new NativeArray<ushort>(27, Allocator.Persistent);
        }

        /// <summary>Records source pointers; the job itself copies the region (see ChunkMeshJob.Sources).</summary>
        public unsafe void SetSources(ushort** sources, ushort* uniform, int** heightmaps, ColumnSurface** surfaces)
        {
            for (int i = 0; i < 27; i++) { Sources[i] = (long)sources[i]; Uniform[i] = uniform[i]; }
            for (int i = 0; i < 9; i++) { Sources[27 + i] = (long)heightmaps[i]; Sources[36 + i] = (long)surfaces[i]; }
            _hasSources = true;
        }

        bool _hasSources;

        public unsafe void Fill(ushort** sources, ushort* uniform, int** heightmaps, ColumnSurface** surfaces) =>
            NeighborhoodBuilder.Build(sources, uniform, heightmaps, surfaces,
                (ushort*)Region.GetUnsafePtr(), (int*)HeightPatch.GetUnsafePtr(), (ushort*)ClimatePatch.GetUnsafePtr());

        public ChunkMeshJob CreateJob(int3 section, NativeArray<BlockDefinition> blocks, bool fancyLeaves = true) => new ChunkMeshJob
        {
            Section = section,
            FancyLeaves = fancyLeaves,
            CopyRegion = _hasSources,
            Sources = Sources,
            Uniform = Uniform,
            Stats = Stats,
            Region = Region,
            HeightPatch = HeightPatch,
            ClimatePatch = ClimatePatch,
            Blocks = blocks,
            Sky = Sky,
            BlockLight = BlockLight,
            Queue = Queue,
            Vertices = Vertices,
            OpaqueIndices = OpaqueIndices,
            CutoutIndices = CutoutIndices,
            WaterIndices = WaterIndices,
            Visited = Visited,
            Connectivity = Connectivity,
        };

        public void Dispose()
        {
            if (Region.IsCreated) Region.Dispose();
            if (HeightPatch.IsCreated) HeightPatch.Dispose();
            if (ClimatePatch.IsCreated) ClimatePatch.Dispose();
            if (Sky.IsCreated) Sky.Dispose();
            if (BlockLight.IsCreated) BlockLight.Dispose();
            if (Queue.IsCreated) Queue.Dispose();
            if (Vertices.IsCreated) Vertices.Dispose();
            if (OpaqueIndices.IsCreated) OpaqueIndices.Dispose();
            if (CutoutIndices.IsCreated) CutoutIndices.Dispose();
            if (WaterIndices.IsCreated) WaterIndices.Dispose();
            if (Visited.IsCreated) Visited.Dispose();
            if (Connectivity.IsCreated) Connectivity.Dispose();
            if (Stats.IsCreated) Stats.Dispose();
            if (Sources.IsCreated) Sources.Dispose();
            if (Uniform.IsCreated) Uniform.Dispose();
        }
    }
}
