using System.Runtime.InteropServices;
using Unity.Burst;
using Unity.Collections;
using Unity.Collections.LowLevel.Unsafe;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine.Rendering;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World.Meshing
{
    /// <summary>
    /// 16-byte terrain vertex. Data packs (little endian bytes):
    ///   x: face index (bits 0-2) | convex edge mask (bits 3-6: -T, +T, -B, +B)
    ///   y: texture layer
    ///   z: voxel ambient occlusion, 0..3 scaled to 0..255
    ///   w: side overlay layer (255 = none)
    /// Positions are section-local. The shader rebuilds normal/tangent frames from the face index.
    /// </summary>
    [StructLayout(LayoutKind.Sequential)]
    public struct TerrainVertex
    {
        public float3 Position;
        public uint Data;

        public static readonly VertexAttributeDescriptor[] Layout =
        {
            new VertexAttributeDescriptor(VertexAttribute.Position, VertexAttributeFormat.Float32, 3),
            new VertexAttributeDescriptor(VertexAttribute.TexCoord0, VertexAttributeFormat.UNorm8, 4),
        };

        public static uint Pack(int face, int edges, int layer, int ao, int overlay) =>
            (uint)(face | (edges << 3)) | ((uint)layer << 8) | ((uint)(ao * 85) << 16) | ((uint)overlay << 24);

        public int Face => (int)(Data & 7);
        public int Edges => (int)((Data >> 3) & 15);
        public int Layer => (int)((Data >> 8) & 255);
        public int AO => (int)((Data >> 16) & 255) / 85;
        public int Overlay => (int)(Data >> 24);
    }

    /// <summary>
    /// Copies a section and the one-voxel shell of its 26 neighbours into a padded 34^3 buffer so the
    /// mesh job owns its input and never touches live chunk memory. Called directly (Burst direct call).
    /// </summary>
    [BurstCompile]
    public static unsafe class NeighborhoodBuilder
    {
        /// <param name="sources">27 pointers, index (dx+1) + (dz+1)*3 + (dy+1)*9. Null means "uniform".</param>
        /// <param name="uniform">27 fallback block ids used where the pointer is null.</param>
        [BurstCompile]
        public static void Build(ushort** sources, ushort* uniform, ushort* padded)
        {
            for (int py = 0; py < PaddedSize; py++)
            {
                int sy = py - 1;
                int dy = sy < 0 ? -1 : sy >= ChunkSize ? 1 : 0;
                int ly = sy - dy * ChunkSize;
                for (int pz = 0; pz < PaddedSize; pz++)
                {
                    int sz = pz - 1;
                    int dz = sz < 0 ? -1 : sz >= ChunkSize ? 1 : 0;
                    int lz = sz - dz * ChunkSize;
                    int rowBase = pz * PaddedSize + py * PaddedArea;
                    for (int px = 0; px < PaddedSize; px++)
                    {
                        int sx = px - 1;
                        int dx = sx < 0 ? -1 : sx >= ChunkSize ? 1 : 0;
                        int lx = sx - dx * ChunkSize;
                        int n = (dx + 1) + (dz + 1) * 3 + (dy + 1) * 9;
                        ushort* src = sources[n];
                        padded[rowBase + px] = src == null
                            ? uniform[n]
                            : src[lx + (lz << ChunkSizeLog2) + (ly << (ChunkSizeLog2 * 2))];
                    }
                }
            }
        }
    }

    /// <summary>
    /// Face-culled mesher with per-vertex voxel AO and convex-edge flags. Emits one quad per visible
    /// face so each quad can carry its own bevel/AO data (greedy merging would lose it; far LODs can
    /// use a greedy path later). Opaque and water faces go to separate index lists / submeshes.
    /// </summary>
    [BurstCompile]
    public struct ChunkMeshJob : IJob
    {
        [ReadOnly] public NativeArray<ushort> Padded;
        [ReadOnly] public NativeArray<BlockDefinition> Blocks;

        public NativeList<TerrainVertex> Vertices;
        public NativeList<uint> OpaqueIndices;
        public NativeList<uint> WaterIndices;

        const float WaterSurfaceDrop = 0.12f;

        public void Execute()
        {
            Vertices.Clear();
            OpaqueIndices.Clear();
            WaterIndices.Clear();

            for (int y = 0; y < ChunkSize; y++)
            for (int z = 0; z < ChunkSize; z++)
            for (int x = 0; x < ChunkSize; x++)
            {
                ushort id = Padded[PaddedIndex(x, y, z)];
                if (id == BlockId.Air) continue;
                var def = Get(id);
                var p = new int3(x, y, z);

                if (def.Has(BlockFlags.Liquid))
                {
                    EmitWater(p, id);
                    continue;
                }
                if (!def.Has(BlockFlags.Opaque)) continue;

                for (int face = 0; face < 6; face++)
                {
                    int3 n = Faces.Normal(face);
                    if (IsOpaque(p + n)) continue;
                    EmitOpaqueFace(p, face, def);
                }
            }
        }

        BlockDefinition Get(ushort id) => id < Blocks.Length ? Blocks[id] : Blocks[0];

        ushort At(int3 p) => Padded[PaddedIndex(p.x, p.y, p.z)];

        bool IsOpaque(int3 p) => Get(At(p)).Has(BlockFlags.Opaque);

        void EmitOpaqueFace(int3 p, int face, BlockDefinition def)
        {
            int3 n = Faces.Normal(face);
            int3 t = Faces.Tangent(face);
            int3 b = Faces.Bitangent(face);
            int3 front = p + n;

            // Convex edges: the neighbour across that edge is not opaque, so the block corner is exposed.
            int edges = (IsOpaque(p - t) ? 0 : 1)
                      | (IsOpaque(p + t) ? 0 : 2)
                      | (IsOpaque(p - b) ? 0 : 4)
                      | (IsOpaque(p + b) ? 0 : 8);

            // Voxel AO sampled in the layer in front of the face.
            bool sNT = IsOpaque(front - t), sPT = IsOpaque(front + t);
            bool sNB = IsOpaque(front - b), sPB = IsOpaque(front + b);
            int ao0 = Ao(sNT, sNB, IsOpaque(front - t - b)); // (-u,-v)
            int ao1 = Ao(sNT, sPB, IsOpaque(front - t + b)); // (-u,+v)
            int ao2 = Ao(sPT, sPB, IsOpaque(front + t + b)); // (+u,+v)
            int ao3 = Ao(sPT, sNB, IsOpaque(front + t - b)); // (+u,-v)

            int layer = (int)def.LayerForFace(face);
            int overlay = face != Faces.PosY && face != Faces.NegY ? (int)def.SideOverlay : 255;

            float3 center = (float3)p + 0.5f + (float3)n * 0.5f;
            float3 ht = (float3)t * 0.5f, hb = (float3)b * 0.5f;

            uint start = (uint)Vertices.Length;
            Vertices.Add(new TerrainVertex { Position = center - ht - hb, Data = TerrainVertex.Pack(face, edges, layer, ao0, overlay) });
            Vertices.Add(new TerrainVertex { Position = center - ht + hb, Data = TerrainVertex.Pack(face, edges, layer, ao1, overlay) });
            Vertices.Add(new TerrainVertex { Position = center + ht + hb, Data = TerrainVertex.Pack(face, edges, layer, ao2, overlay) });
            Vertices.Add(new TerrainVertex { Position = center + ht - hb, Data = TerrainVertex.Pack(face, edges, layer, ao3, overlay) });

            // Split along the brighter diagonal so AO interpolates without anisotropy artefacts.
            if (ao0 + ao2 >= ao1 + ao3)
                AddQuad(ref OpaqueIndices, start, 0, 1, 2, 0, 2, 3);
            else
                AddQuad(ref OpaqueIndices, start, 1, 2, 3, 1, 3, 0);
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
                    // Lower the free surface slightly; side quads follow so there is no gap.
                    float top = p.y + 1f - WaterSurfaceDrop;
                    if (face == Faces.PosY) { v0.y = v1.y = v2.y = v3.y = top; }
                    else if (face != Faces.NegY) { v1.y = math.min(v1.y, top); v2.y = math.min(v2.y, top); }
                }

                uint data = TerrainVertex.Pack(face, 0, 255, 3, 255);
                uint start = (uint)Vertices.Length;
                Vertices.Add(new TerrainVertex { Position = v0, Data = data });
                Vertices.Add(new TerrainVertex { Position = v1, Data = data });
                Vertices.Add(new TerrainVertex { Position = v2, Data = data });
                Vertices.Add(new TerrainVertex { Position = v3, Data = data });
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

    /// <summary>Reusable buffers for one in-flight mesh job.</summary>
    public sealed class MeshJobBuffers : System.IDisposable
    {
        public NativeArray<ushort> Padded;
        public NativeList<TerrainVertex> Vertices;
        public NativeList<uint> OpaqueIndices;
        public NativeList<uint> WaterIndices;

        public MeshJobBuffers()
        {
            Padded = new NativeArray<ushort>(PaddedVolume, Allocator.Persistent, NativeArrayOptions.UninitializedMemory);
            Vertices = new NativeList<TerrainVertex>(8192, Allocator.Persistent);
            OpaqueIndices = new NativeList<uint>(12288, Allocator.Persistent);
            WaterIndices = new NativeList<uint>(1024, Allocator.Persistent);
        }

        public unsafe void FillPadded(ushort** sources, ushort* uniform) =>
            NeighborhoodBuilder.Build(sources, uniform, (ushort*)Padded.GetUnsafePtr());

        public ChunkMeshJob CreateJob(NativeArray<BlockDefinition> blocks) => new ChunkMeshJob
        {
            Padded = Padded,
            Blocks = blocks,
            Vertices = Vertices,
            OpaqueIndices = OpaqueIndices,
            WaterIndices = WaterIndices,
        };

        public void Dispose()
        {
            if (Padded.IsCreated) Padded.Dispose();
            if (Vertices.IsCreated) Vertices.Dispose();
            if (OpaqueIndices.IsCreated) OpaqueIndices.Dispose();
            if (WaterIndices.IsCreated) WaterIndices.Dispose();
        }
    }
}
