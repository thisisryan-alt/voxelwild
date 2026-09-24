using System;
using Unity.Collections;
using Unity.Collections.LowLevel.Unsafe;
using Unity.Mathematics;
using UnityEngine;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World
{
    /// <summary>
    /// One 32^3 block of voxels. Sections whose contents are a single block id (open air, deep stone)
    /// keep only that id until something is edited.
    /// </summary>
    public sealed class ChunkSection
    {
        public int3 Coord { get; private set; }
        public ChunkColumn Column { get; private set; }

        NativeArray<ushort> _voxels;
        ushort _uniform;

        public bool IsUniform => !_voxels.IsCreated;
        public ushort UniformBlock => _uniform;

        /// <summary>True once player edits make this section differ from the generator.</summary>
        public bool Modified;

        /// <summary>Mesh input version: bumped by VoxelWorld whenever an edit can change this section's
        /// geometry or light, so late async mesh results can be recognised as stale.</summary>
        public int Version;

        // --- render state (owned by VoxelWorld) ---
        public GameObject Go;
        public MeshFilter Filter;
        public MeshRenderer Renderer;
        public Mesh Mesh;
        public bool NeedsMesh;
        public bool Meshing;
        public int MeshedVersion = -1;

        /// <summary>Face-to-face connectivity through open space (bit a*6+b); all set until first meshed.</summary>
        public ulong Connectivity = ulong.MaxValue;
        /// <summary>Visibility-search bookkeeping (VoxelWorld).</summary>
        public int VisitStamp;
        public bool CulledByOcclusion;
        /// <summary>Leaf detail the current mesh was built with, and whether the section has leaves at all.</summary>
        public bool FancyLeaves;
        public bool HasLeaves;

        public void Init(ChunkColumn column, int3 coord, NativeArray<ushort> voxels, ushort uniform)
        {
            Column = column;
            Coord = coord;
            _voxels = voxels;
            _uniform = uniform;
            Modified = false;
            Version = 0;
            NeedsMesh = true;
            Meshing = false;
            MeshedVersion = -1;
            Connectivity = ulong.MaxValue;
            CulledByOcclusion = false;
            FancyLeaves = false;
            HasLeaves = false;
        }

        public NativeArray<ushort> Voxels => _voxels;

        public ushort Get(int x, int y, int z) =>
            _voxels.IsCreated ? _voxels[Index(x, y, z)] : _uniform;

        /// <summary>Writes a voxel, expanding a uniform section with <paramref name="allocate"/> first.</summary>
        public void Set(int x, int y, int z, ushort block, Func<NativeArray<ushort>> allocate)
        {
            if (!_voxels.IsCreated)
            {
                if (block == _uniform) return;
                _voxels = allocate();
                unsafe
                {
                    ushort u = _uniform;
                    UnsafeUtility.MemCpyReplicate(_voxels.GetUnsafePtr(), &u, sizeof(ushort), ChunkVolume);
                }
            }
            _voxels[Index(x, y, z)] = block;
            Modified = true;
        }

        /// <summary>Detaches the voxel array (for pooling) when the section is unloaded.</summary>
        public NativeArray<ushort> Release()
        {
            var arr = _voxels;
            _voxels = default;
            Column = null;
            return arr;
        }

        public void DisposeNative()
        {
            if (_voxels.IsCreated) _voxels.Dispose();
        }

        public unsafe ushort* UnsafePtrOrNull() =>
            _voxels.IsCreated ? (ushort*)_voxels.GetUnsafeReadOnlyPtr() : null;
    }
}
