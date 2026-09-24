using System.Collections.Generic;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.Rendering;
using Voxelwild.Rendering;
using Voxelwild.World.Generation;
using Voxelwild.World.Meshing;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World
{
    /// <summary>
    /// Streams the voxel world around a viewer: schedules Burst generation per column, Burst meshing
    /// per section, uploads meshes, unloads far columns, and applies block edits with immediate remeshing.
    /// </summary>
    [DefaultExecutionOrder(-100)]
    public sealed class VoxelWorld : MonoBehaviour, IVoxelQuery
    {
        [Header("World")]
        [SerializeField] uint seed = 20260924;
        [SerializeField, Range(3, 32)] int viewDistance = 10;
        [SerializeField] Transform viewer;

        [Header("Rendering")]
        [SerializeField] Material terrainMaterial;
        [SerializeField] Material waterMaterial;
        [SerializeField] TerrainLayerProfile layerProfile;
        [SerializeField] bool castShadows = true;

        [Header("Budgets")]
        [SerializeField, Range(1, 64)] int maxColumnsStartedPerFrame = 6;
        [SerializeField, Range(1, 256)] int maxColumnsGenerating = 24;
        [SerializeField, Range(1, 64)] int maxMeshJobsInFlight = 16;

        public uint Seed => seed;
        public int ViewDistance => viewDistance;
        public Transform Viewer { get => viewer; set => viewer = value; }

        NativeArray<BlockDefinition> _blocks;
        readonly Dictionary<int2, ChunkColumn> _columns = new Dictionary<int2, ChunkColumn>();
        readonly List<ChunkColumn> _generating = new List<ChunkColumn>();
        readonly List<InFlightMesh> _meshing = new List<InFlightMesh>();
        readonly List<int2> _loadOffsets = new List<int2>();
        readonly List<int2> _unloadScratch = new List<int2>();
        readonly HashSet<ChunkSection> _editScratch = new HashSet<ChunkSection>();

        readonly Stack<NativeArray<ushort>> _voxelPool = new Stack<NativeArray<ushort>>();
        readonly Stack<ChunkColumn> _columnPool = new Stack<ChunkColumn>();
        readonly Stack<ChunkSection> _sectionPool = new Stack<ChunkSection>();
        readonly Stack<MeshJobBuffers> _bufferPool = new Stack<MeshJobBuffers>();
        MeshJobBuffers _syncBuffers;
        readonly ModifiedChunkStore _modified = new ModifiedChunkStore();
        readonly SubMeshDescriptor[] _subMeshes = new SubMeshDescriptor[2];

        int _offsetsForDistance = -1;
        int2 _viewerColumn = new int2(int.MinValue, int.MinValue);
        int _loadCursor;
        bool _initialized;

        struct InFlightMesh
        {
            public ChunkSection Section;
            public MeshJobBuffers Buffers;
            public JobHandle Handle;
            public int Version;
        }

        // ---- stats (read by the debug HUD / capture tool) ----
        public int LoadedColumns => _columns.Count;
        public int GeneratingColumns => _generating.Count;
        public int MeshJobsInFlight => _meshing.Count;
        public int ModifiedSections => _modified.Count;
        public int RenderedSections { get; private set; }
        public long RenderedTriangles { get; private set; }

        void OnEnable()
        {
            if (_initialized) return;
            _blocks = BlockRegistry.CreateNative(Allocator.Persistent);
            _syncBuffers = new MeshJobBuffers();
            if (layerProfile != null) layerProfile.ApplyGlobals();
            else Debug.LogError("[VoxelWorld] no TerrainLayerProfile assigned: terrain will render black", this);
            if (terrainMaterial == null || waterMaterial == null) Debug.LogError("[VoxelWorld] terrain/water material missing", this);
            _initialized = true;
        }

        void OnDisable()
        {
            if (!_initialized) return;
            foreach (var c in _generating) c.Generation.Complete();
            foreach (var m in _meshing) m.Handle.Complete();
            _generating.Clear();

            foreach (var m in _meshing) m.Buffers.Dispose();
            _meshing.Clear();

            foreach (var col in _columns.Values)
            {
                foreach (var s in col.Sections)
                {
                    if (s == null) continue;
                    DestroySectionObjects(s);
                    s.DisposeNative();
                }
                col.DisposeNative();
            }
            _columns.Clear();
            foreach (var s in _sectionPool) { DestroySectionObjects(s); s.DisposeNative(); }
            _sectionPool.Clear();
            foreach (var c in _columnPool) c.DisposeNative();
            _columnPool.Clear();
            foreach (var v in _voxelPool) v.Dispose();
            _voxelPool.Clear();
            foreach (var b in _bufferPool) b.Dispose();
            _bufferPool.Clear();
            _syncBuffers.Dispose();
            _blocks.Dispose();
            _initialized = false;
        }

        void OnValidate()
        {
            if (layerProfile != null && Application.isPlaying) layerProfile.ApplyGlobals();
        }

        void Update()
        {
            if (viewer == null) return;
            float3 vp = viewer.position;
            var vc = new int2((int)math.floor(vp.x) >> ChunkSizeLog2, (int)math.floor(vp.z) >> ChunkSizeLog2);
            if (!vc.Equals(_viewerColumn) || _offsetsForDistance != viewDistance)
            {
                _viewerColumn = vc;
                _loadCursor = 0;
                RebuildOffsets();
                UnloadFarColumns();
            }
            else if (Time.frameCount % 90 == 0)
                UnloadFarColumns();   // retry columns that were busy last time

            CompleteGeneration();
            CompleteMeshes();
            StartGeneration();
            StartMeshing();
            JobHandle.ScheduleBatchedJobs();
        }

        // ------------------------------------------------------------------ streaming

        void RebuildOffsets()
        {
            if (_offsetsForDistance == viewDistance) return;
            _offsetsForDistance = viewDistance;
            _loadOffsets.Clear();
            int r = viewDistance + 1;
            for (int z = -r; z <= r; z++)
            for (int x = -r; x <= r; x++)
                if (x * x + z * z <= r * r) _loadOffsets.Add(new int2(x, z));
            _loadOffsets.Sort((a, b) => math.lengthsq(a).CompareTo(math.lengthsq(b)));
        }

        void StartGeneration()
        {
            int started = 0;
            for (; _loadCursor < _loadOffsets.Count; _loadCursor++)
            {
                if (started >= maxColumnsStartedPerFrame || _generating.Count >= maxColumnsGenerating) return;
                var coord = _viewerColumn + _loadOffsets[_loadCursor];
                if (_columns.ContainsKey(coord)) continue;
                ScheduleColumn(coord);
                started++;
            }
        }

        void ScheduleColumn(int2 coord)
        {
            var col = _columnPool.Count > 0 ? _columnPool.Pop() : new ChunkColumn();
            col.Coord = coord;
            col.State = ColumnState.Generating;

            var surfaceJob = new ColumnSurfaceJob { Column = coord, Seed = seed, Surface = col.Surface }.Schedule();
            var all = surfaceJob;
            for (int i = 0; i < SectionsPerColumn; i++)
            {
                var section = _sectionPool.Count > 0 ? _sectionPool.Pop() : new ChunkSection();
                section.Init(col, new int3(coord.x, MinSectionY + i, coord.y), RentVoxels());
                col.Sections[i] = section;
                var fill = new SectionFillJob
                {
                    Section = section.Coord,
                    Seed = seed,
                    Surface = col.Surface,
                    Voxels = section.Voxels,
                    Stats = section.FillStats,
                }.Schedule(surfaceJob);
                all = JobHandle.CombineDependencies(all, fill);
            }
            col.Generation = all;
            _columns.Add(coord, col);
            _generating.Add(col);
        }

        void CompleteGeneration()
        {
            for (int i = _generating.Count - 1; i >= 0; i--)
            {
                var col = _generating[i];
                if (!col.Generation.IsCompleted) continue;
                col.Generation.Complete();
                _generating.RemoveAt(i);

                foreach (var s in col.Sections)
                {
                    if (_modified.TryRestore(s.Coord, s.Voxels))
                    {
                        s.Modified = true;
                        continue;
                    }
                    if (s.FillStats[0] == 1)
                        ReturnVoxels(s.CollapseToUniform((ushort)s.FillStats[1]));
                }
                col.State = ColumnState.Ready;
            }
        }

        void UnloadFarColumns()
        {
            int limit = (viewDistance + 2) * (viewDistance + 2);
            _unloadScratch.Clear();
            foreach (var kv in _columns)
            {
                if (math.lengthsq(kv.Key - _viewerColumn) <= limit) continue;
                if (kv.Value.State != ColumnState.Ready) continue;
                bool busy = false;
                foreach (var s in kv.Value.Sections) busy |= s.Meshing;
                if (!busy) _unloadScratch.Add(kv.Key);
            }
            foreach (var coord in _unloadScratch) UnloadColumn(coord);
        }

        void UnloadColumn(int2 coord)
        {
            var col = _columns[coord];
            _columns.Remove(coord);
            for (int i = 0; i < col.Sections.Length; i++)
            {
                var s = col.Sections[i];
                if (s.Modified && !s.IsUniform) _modified.Store(s.Coord, s.Voxels);
                var arr = s.Release();
                if (arr.IsCreated) ReturnVoxels(arr);
                if (s.Go != null) s.Go.SetActive(false);
                if (s.Mesh != null) s.Mesh.Clear();
                _sectionPool.Push(s);
                col.Sections[i] = null;
            }
            _columnPool.Push(col);
        }

        NativeArray<ushort> RentVoxels() =>
            _voxelPool.Count > 0 ? _voxelPool.Pop() : new NativeArray<ushort>(ChunkVolume, Allocator.Persistent, NativeArrayOptions.UninitializedMemory);

        void ReturnVoxels(NativeArray<ushort> arr) => _voxelPool.Push(arr);

        // ------------------------------------------------------------------ meshing

        bool ColumnAndNeighboursReady(int2 c)
        {
            for (int dz = -1; dz <= 1; dz++)
            for (int dx = -1; dx <= 1; dx++)
                if (!_columns.TryGetValue(c + new int2(dx, dz), out var n) || n.State != ColumnState.Ready) return false;
            return true;
        }

        void StartMeshing()
        {
            if (_meshing.Count >= maxMeshJobsInFlight) return;
            int r2 = viewDistance * viewDistance;
            foreach (var off in _loadOffsets)
            {
                if (math.lengthsq(off) > r2) break;
                if (!_columns.TryGetValue(_viewerColumn + off, out var col) || col.State != ColumnState.Ready) continue;

                bool any = false;
                foreach (var s in col.Sections) any |= s.NeedsMesh && !s.Meshing;
                if (!any || !ColumnAndNeighboursReady(col.Coord)) continue;

                foreach (var s in col.Sections)
                {
                    if (!s.NeedsMesh || s.Meshing) continue;
                    if (TryResolveTrivially(s)) continue;
                    var buffers = _bufferPool.Count > 0 ? _bufferPool.Pop() : new MeshJobBuffers();
                    FillNeighbourhood(s, buffers);
                    var handle = buffers.CreateJob(_blocks).Schedule();
                    s.Meshing = true;
                    s.NeedsMesh = false;
                    _meshing.Add(new InFlightMesh { Section = s, Buffers = buffers, Handle = handle, Version = s.Version });
                    if (_meshing.Count >= maxMeshJobsInFlight) return;
                }
            }
        }

        /// <summary>Uniform air, or uniform opaque fully enclosed by uniform opaque, produces no faces.</summary>
        bool TryResolveTrivially(ChunkSection s)
        {
            if (!s.IsUniform) return false;
            bool empty = s.UniformBlock == BlockId.Air;
            if (!empty && _blocks[s.UniformBlock].Has(BlockFlags.Opaque))
            {
                empty = true;
                for (int f = 0; f < 6 && empty; f++)
                {
                    var n = GetSection(s.Coord + Faces.Normal(f));
                    empty = n == null
                        ? s.Coord.y + Faces.Normal(f).y < MinSectionY    // below the world counts as bedrock
                        : n.IsUniform && _blocks[n.UniformBlock].Has(BlockFlags.Opaque);
                }
            }
            if (!empty) return false;
            ApplyEmpty(s);
            s.NeedsMesh = false;
            s.MeshedVersion = s.Version;
            return true;
        }

        unsafe void FillNeighbourhood(ChunkSection s, MeshJobBuffers buffers)
        {
            ushort** sources = stackalloc ushort*[27];
            ushort* uniform = stackalloc ushort[27];
            for (int dy = -1; dy <= 1; dy++)
            for (int dz = -1; dz <= 1; dz++)
            for (int dx = -1; dx <= 1; dx++)
            {
                int n = (dx + 1) + (dz + 1) * 3 + (dy + 1) * 9;
                var coord = s.Coord + new int3(dx, dy, dz);
                var ns = GetSection(coord);
                if (ns == null)
                {
                    sources[n] = null;
                    uniform[n] = coord.y < MinSectionY ? BlockId.Bedrock : BlockId.Air;
                }
                else
                {
                    sources[n] = ns.UnsafePtrOrNull();
                    uniform[n] = ns.UniformBlock;
                }
            }
            buffers.FillPadded(sources, uniform);
        }

        void CompleteMeshes()
        {
            for (int i = _meshing.Count - 1; i >= 0; i--)
            {
                var m = _meshing[i];
                if (!m.Handle.IsCompleted) continue;
                m.Handle.Complete();
                _meshing.RemoveAt(i);
                m.Section.Meshing = false;

                // Unloaded meanwhile, or edited since the job was scheduled: drop the stale result.
                bool alive = m.Section.Column != null;
                if (alive && m.Version == m.Section.Version)
                {
                    ApplyMesh(m.Section, m.Buffers);
                    m.Section.MeshedVersion = m.Version;
                }
                else if (alive && m.Section.MeshedVersion != m.Section.Version)
                    m.Section.NeedsMesh = true;
                _bufferPool.Push(m.Buffers);
            }
        }

        void EnsureSectionObjects(ChunkSection s)
        {
            if (s.Go == null)
            {
                s.Go = new GameObject("Section");
                s.Go.transform.SetParent(transform, false);
                s.Filter = s.Go.AddComponent<MeshFilter>();
                s.Renderer = s.Go.AddComponent<MeshRenderer>();
                s.Renderer.sharedMaterials = new[] { terrainMaterial, waterMaterial };
                s.Renderer.shadowCastingMode = castShadows ? ShadowCastingMode.On : ShadowCastingMode.Off;
                s.Renderer.receiveShadows = true;
                s.Renderer.lightProbeUsage = LightProbeUsage.Off;
                s.Renderer.reflectionProbeUsage = ReflectionProbeUsage.BlendProbesAndSkybox;
                s.Mesh = new Mesh { name = "SectionMesh" };
                s.Mesh.MarkDynamic();
                s.Filter.sharedMesh = s.Mesh;
            }
#if UNITY_EDITOR
            s.Go.name = $"Section {s.Coord.x},{s.Coord.y},{s.Coord.z}";
#endif
            s.Go.transform.localPosition = (float3)(s.Coord * ChunkSize);
            if (!s.Go.activeSelf) s.Go.SetActive(true);
        }

        void ApplyEmpty(ChunkSection s)
        {
            if (s.Mesh != null) s.Mesh.Clear();
            if (s.Go != null && s.Go.activeSelf) s.Go.SetActive(false);
        }

        void ApplyMesh(ChunkSection s, MeshJobBuffers b)
        {
            int vc = b.Vertices.Length;
            if (vc == 0)
            {
                ApplyEmpty(s);
                return;
            }
            EnsureSectionObjects(s);
            const MeshUpdateFlags flags = MeshUpdateFlags.DontRecalculateBounds | MeshUpdateFlags.DontValidateIndices | MeshUpdateFlags.DontNotifyMeshUsers;
            var mesh = s.Mesh;
            int oc = b.OpaqueIndices.Length, wc = b.WaterIndices.Length;
            mesh.SetVertexBufferParams(vc, TerrainVertex.Layout);
            mesh.SetVertexBufferData(b.Vertices.AsArray(), 0, 0, vc, 0, flags);
            mesh.SetIndexBufferParams(oc + wc, IndexFormat.UInt32);
            if (oc > 0) mesh.SetIndexBufferData(b.OpaqueIndices.AsArray(), 0, 0, oc, flags);
            if (wc > 0) mesh.SetIndexBufferData(b.WaterIndices.AsArray(), 0, oc, wc, flags);
            // set both ranges at once so the old layout never overlaps the new one
            _subMeshes[0] = new SubMeshDescriptor(0, oc);
            _subMeshes[1] = new SubMeshDescriptor(oc, wc);
            mesh.SetSubMeshes(_subMeshes, flags);
            mesh.bounds = new Bounds(new Vector3(ChunkSize, ChunkSize, ChunkSize) * 0.5f, new Vector3(ChunkSize, ChunkSize + 2, ChunkSize));
        }

        void LateUpdate()
        {
            // running totals for the HUD, refreshed a few times per second
            if (Time.frameCount % 20 != 0) return;
            int sections = 0;
            long tris = 0;
            foreach (var col in _columns.Values)
            foreach (var s in col.Sections)
            {
                if (s?.Go == null || !s.Go.activeSelf) continue;
                sections++;
                for (int i = 0; i < s.Mesh.subMeshCount; i++) tris += (long)s.Mesh.GetSubMesh(i).indexCount / 3;
            }
            RenderedSections = sections;
            RenderedTriangles = tris;
        }

        void DestroySectionObjects(ChunkSection s)
        {
            if (s.Mesh != null) Destroy(s.Mesh);
            if (s.Go != null) Destroy(s.Go);
            s.Go = null;
            s.Mesh = null;
        }

        // ------------------------------------------------------------------ queries & edits

        public ChunkSection GetSection(int3 sectionCoord)
        {
            if (!IsSectionYInWorld(sectionCoord.y)) return null;
            if (!_columns.TryGetValue(sectionCoord.xz, out var col) || col.State != ColumnState.Ready) return null;
            return col.SectionAtY(sectionCoord.y);
        }

        public bool TryGetBlock(int3 world, out ushort block)
        {
            if (world.y < MinWorldY) { block = BlockId.Bedrock; return true; }
            if (world.y >= MaxWorldY) { block = BlockId.Air; return true; }
            var s = GetSection(WorldToSection(world));
            if (s == null) { block = BlockId.Air; return false; }
            var l = WorldToLocal(world);
            block = s.Get(l.x, l.y, l.z);
            return true;
        }

        /// <summary>Sets a block and synchronously remeshes every section whose mesh depends on it.</summary>
        public bool SetBlock(int3 world, ushort block)
        {
            var s = GetSection(WorldToSection(world));
            if (s == null) return false;
            var l = WorldToLocal(world);
            if (s.Get(l.x, l.y, l.z) == block) return false;
            s.Set(l.x, l.y, l.z, block, RentVoxels);

            _editScratch.Clear();
            for (int dy = -1; dy <= 1; dy++)
            for (int dz = -1; dz <= 1; dz++)
            for (int dx = -1; dx <= 1; dx++)
            {
                var ns = GetSection(WorldToSection(world + new int3(dx, dy, dz)));
                if (ns != null) _editScratch.Add(ns);
            }
            foreach (var ns in _editScratch)
            {
                ns.Version++;
                if (ColumnAndNeighboursReady(ns.Coord.xz)) RemeshNow(ns);
                else ns.NeedsMesh = true;
            }
            return true;
        }

        void RemeshNow(ChunkSection s)
        {
            if (TryResolveTrivially(s)) return;
            FillNeighbourhood(s, _syncBuffers);
            _syncBuffers.CreateJob(_blocks).Run();
            ApplyMesh(s, _syncBuffers);
            s.MeshedVersion = s.Version;
            s.NeedsMesh = false;
        }

        /// <summary>True when every column within <paramref name="radius"/> of the point is generated and meshed.</summary>
        public bool IsAreaReady(float3 position, int radius)
        {
            var c = new int2((int)math.floor(position.x) >> ChunkSizeLog2, (int)math.floor(position.z) >> ChunkSizeLog2);
            for (int dz = -radius; dz <= radius; dz++)
            for (int dx = -radius; dx <= radius; dx++)
            {
                if (!_columns.TryGetValue(c + new int2(dx, dz), out var col) || col.State != ColumnState.Ready) return false;
                foreach (var s in col.Sections)
                    if (s.NeedsMesh || s.Meshing) return false;
            }
            return true;
        }

        /// <summary>Finds a dry-land spawn near the origin using the same height function as the generator.</summary>
        public float3 FindSpawnPoint()
        {
            for (int ring = 0; ring < 64; ring++)
            for (int i = 0; i < 8; i++)
            {
                float a = i * math.PI / 4f + ring * 0.37f;
                var xz = new float2(math.cos(a), math.sin(a)) * ring * 24f;
                var s = TerrainNoise.SampleSurface(math.floor(xz) + 0.5f, seed);
                if (s.Height > SeaLevel + 3 && s.Height < 110 && s.MountainMask < 0.3f)
                    return new float3(math.floor(xz.x) + 0.5f, math.floor(s.Height) + 1.05f, math.floor(xz.y) + 0.5f);
            }
            return new float3(0.5f, MaxWorldY - 4, 0.5f);
        }
    }
}
