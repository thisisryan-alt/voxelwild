using System.Collections.Generic;
using Unity.Burst;
using Unity.Collections;
using Unity.Collections.LowLevel.Unsafe;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.Rendering;
using Voxelwild.Rendering;
using Voxelwild.World.Generation;
using Voxelwild.World.Meshing;
using Voxelwild.World.Props;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World
{
    /// <summary>
    /// Streams the voxel world around a viewer.
    /// Column pipeline: Generating (terrain job) -> Generated -> Decorating (trees + heightmap job, once all
    /// 8 neighbours have terrain) -> Ready (split into sections). A section is meshed (with lighting) once
    /// its own and all 8 neighbouring columns are Ready. Edits keep the light heightmap current, remesh the
    /// directly affected sections in parallel within the frame, and queue light-affected sections async.
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
        [SerializeField] Material foliageMaterial;
        [SerializeField] Material waterMaterial;
        [SerializeField] TerrainLayerProfile layerProfile;
        [SerializeField] bool castShadows = true;
        [Tooltip("Rocks, cave formations, dead wood and plants (Assets/Art/Models, built by tools/blender).")]
        [SerializeField] PropLibrary propLibrary;
        [SerializeField] bool drawProps = true;
        [Tooltip("Flowing water (Phase 5): springs, waterfalls, and water filling dug-out spaces.")]
        [SerializeField] bool simulateWater = true;

        [Header("Budgets")]
        [SerializeField, Range(1, 64)] int maxColumnsStartedPerFrame = 6;
        [SerializeField, Range(1, 256)] int maxColumnJobsInFlight = 24;
        [SerializeField, Range(1, 64)] int maxMeshJobsInFlight = 16;

        [Header("Culling")]
        [Tooltip("Hide sections the camera cannot see through open space (sealed caves from the surface, the surface from deep caves).")]
        [SerializeField] bool occlusionCulling = true;
        [Tooltip("Sections within this many sections of the camera keep inner leaf faces.")]
        [SerializeField, Range(0, 8)] int fancyLeavesDistance = 2;

        /// <summary>World seed. Can only change before any terrain has been generated (GameSession sets it on load).</summary>
        public uint Seed
        {
            get => seed;
            set
            {
                if (_columns.Count > 0) { Debug.LogError("[VoxelWorld] the seed can't change once terrain exists", this); return; }
                seed = value;
            }
        }
        public int ViewDistance { get => viewDistance; set => viewDistance = Mathf.Clamp(value, 3, 32); }
        public Transform Viewer { get => viewer; set => viewer = value; }

        NativeArray<BlockDefinition> _blocks;
        NativeArray<PropRule> _propRules;
        PropField _props;
        readonly Water.WaterSimulation _water = new Water.WaterSimulation();
        WaterGrid _waterGrid;
        float _waterClock;
        float _nextWaterRetry;
        readonly List<(int3 cell, ushort block)> _propLeftovers = new List<(int3, ushort)>();
        readonly Dictionary<int2, ChunkColumn> _columns = new Dictionary<int2, ChunkColumn>();
        readonly List<ChunkColumn> _columnJobs = new List<ChunkColumn>();
        readonly List<InFlightMesh> _meshing = new List<InFlightMesh>();
        readonly List<int2> _loadOffsets = new List<int2>();
        readonly List<int2> _unloadScratch = new List<int2>();
        readonly HashSet<ChunkSection> _syncScratch = new HashSet<ChunkSection>();
        readonly List<InFlightMesh> _syncJobs = new List<InFlightMesh>();

        readonly Stack<NativeArray<ushort>> _voxelPool = new Stack<NativeArray<ushort>>();
        readonly Stack<ChunkColumn> _columnPool = new Stack<ChunkColumn>();
        readonly Stack<ChunkSection> _sectionPool = new Stack<ChunkSection>();
        readonly Stack<ColumnBuildBuffers> _buildPool = new Stack<ColumnBuildBuffers>();
        readonly Stack<MeshJobBuffers> _meshBufferPool = new Stack<MeshJobBuffers>();
        readonly ModifiedChunkStore _modified = new ModifiedChunkStore();
        readonly SubMeshDescriptor[] _subMeshes = new SubMeshDescriptor[3];

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

        // ---- stats (debug HUD / capture tool) ----
        public int LoadedColumns => _columns.Count;
        public int GeneratingColumns => _columnJobs.Count;
        public int MeshJobsInFlight => _meshing.Count;
        public int ModifiedSections => _modified.Count;
        public int RenderedSections { get; private set; }
        public long RenderedTriangles { get; private set; }
        public int PendingMeshes { get; private set; }
        public int OcclusionCulledSections { get; private set; }
        public int PropsLoaded => _props?.Loaded ?? 0;
        public int PropsDrawn => _props?.Drawn ?? 0;
        public bool DrawProps { get => drawProps; set => drawProps = value; }
        public int FancyLeavesDistance
        {
            get => fancyLeavesDistance;
            set { fancyLeavesDistance = Mathf.Clamp(value, 0, 8); _lastCameraSection = new int3(int.MinValue); }
        }
        /// <summary>Multiplies prop draw and LOD distances (quality presets).</summary>
        public float PropDistanceScale { get => _props?.DistanceScale ?? 1f; set { if (_props != null) _props.DistanceScale = value; } }
        public bool OcclusionCulling { get => occlusionCulling; set { occlusionCulling = value; _visibilityDirty = true; } }

        readonly Queue<(ChunkSection s, int entry, int dirs)> _visQueue = new Queue<(ChunkSection, int, int)>();
        int _visStamp;
        bool _visibilityDirty = true;
        int3 _lastCameraSection = new int3(int.MinValue);
        Camera _camera;

        void OnEnable()
        {
            if (_initialized) return;
            _blocks = BlockRegistry.CreateNative(Allocator.Persistent);
            _propRules = PropRegistry.CreateNative(Allocator.Persistent);
            _props = new PropField(propLibrary);
            _props.ImportRemoved(_pendingRemovedProps);
            _waterGrid = new WaterGrid(this);
            if (!_props.HasArt)
                Debug.LogWarning("[VoxelWorld] no prop library: props are placed (cores, barriers) but not drawn. " +
                                 "Run Voxelwild/Art/Build Prop Library.", this);
            if (layerProfile != null) layerProfile.ApplyGlobals();
            else Debug.LogError("[VoxelWorld] no TerrainLayerProfile assigned: terrain will render black", this);
            if (terrainMaterial == null || foliageMaterial == null || waterMaterial == null)
                Debug.LogError("[VoxelWorld] terrain/foliage/water material missing", this);
            _initialized = true;
        }

        void OnDisable()
        {
            if (!_initialized) return;
            foreach (var c in _columnJobs) c.Job.Complete();
            foreach (var m in _meshing) m.Handle.Complete();
            _columnJobs.Clear();
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
                col.Build?.Dispose();
                col.DisposeNative();
            }
            _columns.Clear();
            foreach (var s in _sectionPool) { DestroySectionObjects(s); s.DisposeNative(); }
            _sectionPool.Clear();
            foreach (var c in _columnPool) c.DisposeNative();
            _columnPool.Clear();
            foreach (var v in _voxelPool) v.Dispose();
            _voxelPool.Clear();
            foreach (var b in _buildPool) b.Dispose();
            _buildPool.Clear();
            foreach (var b in _meshBufferPool) b.Dispose();
            _meshBufferPool.Clear();
            _blocks.Dispose();
            _propRules.Dispose();
            _props = null;
            _water.Clear();
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
                UnloadFarColumns();

            CompleteColumnJobs();
            CompleteMeshes();
            TickWater();
            StartGeneration();
            StartDecoration();
            StartMeshing();
            JobHandle.ScheduleBatchedJobs();
        }

        // ------------------------------------------------------------------ saving

        /// <summary>
        /// Every section the player changed, loaded or not, as run-length pairs. Loaded sections are encoded fresh,
        /// so the result is current.
        /// </summary>
        public IEnumerable<KeyValuePair<int3, ushort[]>> ExportEdits()
        {
            foreach (var col in _columns.Values)
            {
                if (col.State != ColumnState.Ready) continue;
                foreach (var s in col.Sections)
                    if (s != null && s.Modified && !s.IsUniform) _modified.Store(s.Coord, s.Voxels);
            }
            return _modified.Entries;
        }

        /// <summary>Loads saved edits; call before terrain streams in (they apply as columns load).</summary>
        public void ImportEdits(IEnumerable<KeyValuePair<int3, ushort[]>> sections)
        {
            foreach (var kv in sections) _modified.Import(kv.Key, kv.Value);
        }

        public IEnumerable<int3> RemovedProps => _props != null ? _props.Removed : System.Array.Empty<int3>();
        public void ImportRemovedProps(IEnumerable<int3> anchors)
        {
            _pendingRemovedProps.AddRange(anchors);
            _props?.ImportRemoved(anchors);
        }
        readonly List<int3> _pendingRemovedProps = new List<int3>();

        // ------------------------------------------------------------------ water

        public int WaterPending => _water.Pending;
        public bool SimulateWater { get => simulateWater; set => simulateWater = value; }

        void TickWater()
        {
            if (!simulateWater) return;
            _waterClock += Time.deltaTime;
            if (_waterClock < Water.WaterSimulation.TickSeconds) return;
            _waterClock = 0f;
            if (Time.time >= _nextWaterRetry && _water.Waiting > 0)
            {
                _nextWaterRetry = Time.time + 2f;
                _water.RetryWaiting();
            }
            if (_water.Pending > 0) _water.Tick(_waterGrid);
        }

        /// <summary>The loaded world as the water simulation sees it.</summary>
        sealed class WaterGrid : Water.IWaterGrid
        {
            readonly VoxelWorld _w;
            public WaterGrid(VoxelWorld w) => _w = w;
            public bool TryGet(int3 cell, out ushort block) => _w.TryGetBlock(cell, out block);
            public bool IsOpen(ushort block)
            {
                var d = _w._blocks[block];
                return d.Has(BlockFlags.Replaceable) && !d.Has(BlockFlags.Liquid);
            }
            public void Set(int3 cell, ushort block) => _w.SetBlockDeferred(cell, block);
        }

        // ------------------------------------------------------------------ streaming

        void RebuildOffsets()
        {
            if (_offsetsForDistance == viewDistance) return;
            _offsetsForDistance = viewDistance;
            _loadOffsets.Clear();
            int r = viewDistance + 2;
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
                if (started >= maxColumnsStartedPerFrame || _columnJobs.Count >= maxColumnJobsInFlight) return;
                var coord = _viewerColumn + _loadOffsets[_loadCursor];
                if (_columns.ContainsKey(coord)) continue;
                var col = _columnPool.Count > 0 ? _columnPool.Pop() : new ChunkColumn();
                col.Coord = coord;
                col.State = ColumnState.Generating;
                col.Build = _buildPool.Count > 0 ? _buildPool.Pop() : new ColumnBuildBuffers();
                col.Job = new ColumnGenerationJob { Column = coord, Seed = seed, Voxels = col.Build.Voxels, Surface = col.Surface }.Schedule();
                _columns.Add(coord, col);
                _columnJobs.Add(col);
                started++;
            }
        }

        void StartDecoration()
        {
            int r2 = (viewDistance + 1) * (viewDistance + 1);
            int started = 0;
            foreach (var off in _loadOffsets)
            {
                if (math.lengthsq(off) > r2) break;
                if (started >= maxColumnsStartedPerFrame || _columnJobs.Count >= maxColumnJobsInFlight) return;
                if (!_columns.TryGetValue(_viewerColumn + off, out var col) || col.State != ColumnState.Generated) continue;
                if (!NeighboursHaveTerrain(col.Coord)) continue;

                for (int dz = -1; dz <= 1; dz++)
                for (int dx = -1; dx <= 1; dx++)
                {
                    int n = (dx + 1) + (dz + 1) * 3;
                    NativeArray<ColumnSurface>.Copy(_columns[col.Coord + new int2(dx, dz)].Surface, 0, col.Build.Neighborhood, n * ChunkArea, ChunkArea);
                }
                col.State = ColumnState.Decorating;
                col.Job = new DecorationJob
                {
                    Column = col.Coord, Seed = seed, Voxels = col.Build.Voxels, Neighborhood = col.Build.Neighborhood,
                    Blocks = _blocks, Heightmap = col.Heightmap, PropRules = _propRules, Props = col.Props,
                    Springs = col.Springs,
                }.Schedule();
                _columnJobs.Add(col);
                started++;
            }
        }

        bool NeighboursHaveTerrain(int2 c)
        {
            for (int dz = -1; dz <= 1; dz++)
            for (int dx = -1; dx <= 1; dx++)
                if (!_columns.TryGetValue(c + new int2(dx, dz), out var n) || !n.HasTerrain) return false;
            return true;
        }

        void CompleteColumnJobs()
        {
            for (int i = _columnJobs.Count - 1; i >= 0; i--)
            {
                var col = _columnJobs[i];
                if (!col.Job.IsCompleted) continue;
                col.Job.Complete();
                _columnJobs.RemoveAt(i);
                if (col.State == ColumnState.Generating) col.State = ColumnState.Generated;
                else if (col.State == ColumnState.Decorating) FinishColumn(col);
            }
        }

        /// <summary>Splits the decorated column buffer into sections (collapsing uniform ones) and restores edits.</summary>
        unsafe void FinishColumn(ChunkColumn col)
        {
            bool restored = false;
            var buffer = (ushort*)col.Build.Voxels.GetUnsafeReadOnlyPtr();
            for (int i = 0; i < SectionsPerColumn; i++)
            {
                var section = _sectionPool.Count > 0 ? _sectionPool.Pop() : new ChunkSection();
                var coord = new int3(col.Coord.x, MinSectionY + i, col.Coord.y);
                ushort* src = buffer + i * ChunkVolume;
                if (_modified.Contains(coord))
                {
                    var arr = RentVoxels();
                    _modified.TryRestore(coord, arr);
                    section.Init(col, coord, arr, BlockId.Air);
                    section.Modified = true;
                    restored = true;
                }
                else if (ColumnOps.IsUniform(src, ChunkVolume, out ushort u))
                    section.Init(col, coord, default, u);
                else
                {
                    var arr = RentVoxels();
                    UnsafeUtility.MemCpy(arr.GetUnsafePtr(), src, ChunkVolume * sizeof(ushort));
                    section.Init(col, coord, arr, BlockId.Air);
                }
                col.Sections[i] = section;
            }
            _buildPool.Push(col.Build);
            col.Build = null;
            col.State = ColumnState.Ready;
            if (restored)
                for (int z = 0; z < ChunkSize; z++)
                for (int x = 0; x < ChunkSize; x++)
                    RecomputeHeight(col, x, z, MaxWorldY - 1);
            _props.OnColumnReady(col);
            for (int i = 0; i < col.Springs.Length; i++) _water.MarkDirty(col.Springs[i]);
        }

        void UnloadFarColumns()
        {
            int limit = (viewDistance + 3) * (viewDistance + 3);
            _unloadScratch.Clear();
            foreach (var kv in _columns)
            {
                if (math.lengthsq(kv.Key - _viewerColumn) <= limit) continue;
                var c = kv.Value;
                if (c.State == ColumnState.Generating || c.State == ColumnState.Decorating) continue;
                bool busy = c.MeshReaders > 0;
                if (c.State == ColumnState.Ready)
                    foreach (var s in c.Sections) busy |= s.Meshing;
                // a neighbour's decoration job copied our surface already, so no read dependency remains
                if (!busy) _unloadScratch.Add(kv.Key);
            }
            foreach (var coord in _unloadScratch) UnloadColumn(coord);
        }

        void UnloadColumn(int2 coord)
        {
            var col = _columns[coord];
            _columns.Remove(coord);
            _props.OnColumnUnloaded(coord);
            if (col.State == ColumnState.Ready)
            {
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
            }
            if (col.Build != null) { _buildPool.Push(col.Build); col.Build = null; }
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
            int r2 = viewDistance * viewDistance;
            int pending = 0;
            foreach (var off in _loadOffsets)
            {
                if (math.lengthsq(off) > r2) break;
                if (!_columns.TryGetValue(_viewerColumn + off, out var col) || col.State != ColumnState.Ready) continue;

                bool any = false;
                foreach (var s in col.Sections) any |= s.NeedsMesh && !s.Meshing;
                if (!any) continue;
                pending++;
                if (_meshing.Count >= maxMeshJobsInFlight || !ColumnAndNeighboursReady(col.Coord)) continue;

                foreach (var s in col.Sections)
                {
                    if (!s.NeedsMesh || s.Meshing) continue;
                    if (TryResolveTrivially(s)) continue;
                    if (_meshing.Count >= maxMeshJobsInFlight) break;
                    _meshing.Add(ScheduleMesh(s));
                }
            }
            PendingMeshes = pending;
        }

        InFlightMesh ScheduleMesh(ChunkSection s)
        {
            var buffers = _meshBufferPool.Count > 0 ? _meshBufferPool.Pop() : new MeshJobBuffers();
            FillNeighbourhood(s, buffers);
            bool fancy = WantsFancyLeaves(s.Coord);
            s.FancyLeaves = fancy;
            AddReaders(s.Coord.xz, +1);
            var handle = buffers.CreateJob(s.Coord, _blocks, fancy).Schedule();
            s.Meshing = true;
            s.NeedsMesh = false;
            return new InFlightMesh { Section = s, Buffers = buffers, Handle = handle, Version = s.Version };
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
                        ? s.Coord.y + Faces.Normal(f).y < MinSectionY
                        : n.IsUniform && _blocks[n.UniformBlock].Has(BlockFlags.Opaque);
                }
            }
            if (!empty) return false;
            ulong conn = s.UniformBlock == BlockId.Air ? ulong.MaxValue : 0ul;
            if (conn != s.Connectivity) { s.Connectivity = conn; _visibilityDirty = true; }
            if (s.UniformBlock == BlockId.Air) _props.OnSectionTrivial(s);
            ApplyEmpty(s);
            s.NeedsMesh = false;
            s.MeshedVersion = s.Version;
            return true;
        }

        unsafe void FillNeighbourhood(ChunkSection s, MeshJobBuffers buffers)
        {
            ushort** sources = stackalloc ushort*[27];
            ushort* uniform = stackalloc ushort[27];
            int** heights = stackalloc int*[9];
            ColumnSurface** surfaces = stackalloc ColumnSurface*[9];
            for (int dz = -1; dz <= 1; dz++)
            for (int dx = -1; dx <= 1; dx++)
            {
                int n2 = (dx + 1) + (dz + 1) * 3;
                if (_columns.TryGetValue(s.Coord.xz + new int2(dx, dz), out var col) && col.State == ColumnState.Ready)
                {
                    heights[n2] = (int*)col.Heightmap.GetUnsafeReadOnlyPtr();
                    surfaces[n2] = (ColumnSurface*)col.Surface.GetUnsafeReadOnlyPtr();
                }
                else
                {
                    heights[n2] = null;
                    surfaces[n2] = null;
                }
                for (int dy = -1; dy <= 1; dy++)
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
            }
            buffers.SetSources(sources, uniform, heights, surfaces);
        }

        void CompleteMeshes()
        {
            for (int i = _meshing.Count - 1; i >= 0; i--)
            {
                var m = _meshing[i];
                if (!m.Handle.IsCompleted) continue;
                m.Handle.Complete();
                _meshing.RemoveAt(i);
                FinishMesh(m);
            }
        }

        void FinishMesh(InFlightMesh m)
        {
            AddReaders(m.Section.Coord.xz, -1);
            m.Section.Meshing = false;
            bool alive = m.Section.Column != null;
            if (alive && m.Version == m.Section.Version)
            {
                ApplyMesh(m.Section, m.Buffers);
                _props.OnSectionLit(m.Section, m.Buffers);
                m.Section.MeshedVersion = m.Version;
                m.Section.HasLeaves = m.Buffers.Stats[0] > 0;
                ulong conn = m.Buffers.Connectivity[0];
                if (conn != m.Section.Connectivity) { m.Section.Connectivity = conn; _visibilityDirty = true; }
            }
            else if (alive && m.Section.MeshedVersion != m.Section.Version)
                m.Section.NeedsMesh = true;
            _meshBufferPool.Push(m.Buffers);
        }

        void EnsureSectionObjects(ChunkSection s)
        {
            if (s.Go == null)
            {
                s.Go = new GameObject("Section");
                s.Go.transform.SetParent(transform, false);
                s.Filter = s.Go.AddComponent<MeshFilter>();
                s.Renderer = s.Go.AddComponent<MeshRenderer>();
                s.Renderer.sharedMaterials = new[] { terrainMaterial, foliageMaterial, waterMaterial };
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
            if (!s.Go.activeSelf) { s.Go.SetActive(true); _visibilityDirty = true; }
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
            int oc = b.OpaqueIndices.Length, cc = b.CutoutIndices.Length, wc = b.WaterIndices.Length;
            mesh.SetVertexBufferParams(vc, TerrainVertex.Layout);
            mesh.SetVertexBufferData(b.Vertices.AsArray(), 0, 0, vc, 0, flags);
            mesh.SetIndexBufferParams(oc + cc + wc, IndexFormat.UInt32);
            if (oc > 0) mesh.SetIndexBufferData(b.OpaqueIndices.AsArray(), 0, 0, oc, flags);
            if (cc > 0) mesh.SetIndexBufferData(b.CutoutIndices.AsArray(), 0, oc, cc, flags);
            if (wc > 0) mesh.SetIndexBufferData(b.WaterIndices.AsArray(), 0, oc + cc, wc, flags);
            _subMeshes[0] = new SubMeshDescriptor(0, oc);
            _subMeshes[1] = new SubMeshDescriptor(oc, cc);
            _subMeshes[2] = new SubMeshDescriptor(oc + cc, wc);
            mesh.SetSubMeshes(_subMeshes, flags);
            // plants sway a little past the block bounds
            mesh.bounds = new Bounds(new Vector3(ChunkSize, ChunkSize, ChunkSize) * 0.5f, new Vector3(ChunkSize + 1, ChunkSize + 2, ChunkSize + 1));
        }

        void LateUpdate()
        {
            UpdateVisibility();
            if (drawProps && _camera != null) _props.Draw(_camera, GetSection, gameObject.layer);
            if (Time.frameCount % 20 != 0) return;
            int sections = 0;
            long tris = 0;
            foreach (var col in _columns.Values)
            foreach (var s in col.Sections)
            {
                if (s?.Go == null || !s.Go.activeSelf || !s.Renderer.enabled) continue;
                sections++;
                for (int i = 0; i < s.Mesh.subMeshCount; i++) tris += (long)s.Mesh.GetSubMesh(i).indexCount / 3;
            }
            RenderedSections = sections;
            RenderedTriangles = tris;
        }

        // ------------------------------------------------------------------ occlusion culling

        /// <summary>
        /// Breadth-first search over sections from the camera, only passing between two faces of a section
        /// when open space joins them, and never stepping back toward the camera. Sections it cannot reach are
        /// hidden. Frustum culling and shadow casting are left to Unity, so terrain behind the camera still
        /// casts shadows; unreachable sections are sealed in rock and cannot be lit by the sun anyway.
        /// </summary>
        void UpdateVisibility()
        {
            if (_camera == null) _camera = Camera.main;
            if (_camera == null) return;
            var camSection = WorldToSection((int3)math.floor((float3)_camera.transform.position));
            camSection.y = math.clamp(camSection.y, MinSectionY, MaxSectionY);
            bool moved = !camSection.Equals(_lastCameraSection);
            // re-run when the camera changes section, or (throttled) when streamed meshes change connectivity
            if (!moved && !(_visibilityDirty && Time.frameCount % 6 == 0)) return;
            _lastCameraSection = camSection;
            _visibilityDirty = false;
            _visStamp++;
            if (moved) RefreshLeafDetail();

            var start = occlusionCulling ? GetSection(camSection) : null;
            if (start != null)
            {
                start.VisitStamp = _visStamp;
                for (int f = 0; f < 6; f++)
                    Enqueue(start.Coord + Faces.Normal(f), f ^ 1, 1 << f);
                int r2 = (viewDistance + 1) * (viewDistance + 1);
                while (_visQueue.Count > 0)
                {
                    var (s, entry, dirs) = _visQueue.Dequeue();
                    for (int f = 0; f < 6; f++)
                    {
                        if ((dirs & (1 << (f ^ 1))) != 0) continue;                       // never walk back toward the camera
                        if ((s.Connectivity & (1ul << (entry * 6 + f))) == 0) continue;   // no open path entry -> f
                        var next = s.Coord + Faces.Normal(f);
                        if (math.lengthsq(next.xz - camSection.xz) > r2) continue;
                        Enqueue(next, f ^ 1, dirs | (1 << f));
                    }
                }
            }

            // without a start section (culling off, or camera outside the loaded world) everything is shown
            int culled = 0;
            foreach (var col in _columns.Values)
            {
                if (col.State != ColumnState.Ready) continue;
                foreach (var s in col.Sections)
                {
                    bool hidden = start != null && s.VisitStamp != _visStamp;
                    s.CulledByOcclusion = hidden;
                    if (s.Renderer != null && s.Renderer.enabled == hidden) s.Renderer.enabled = !hidden;
                    if (hidden && s.Go != null && s.Go.activeSelf) culled++;
                }
            }
            OcclusionCulledSections = culled;
        }

        /// <summary>Mesh jobs read live memory of the 3x3 columns around their section; keep those loaded.</summary>
        void AddReaders(int2 column, int delta)
        {
            for (int dz = -1; dz <= 1; dz++)
            for (int dx = -1; dx <= 1; dx++)
                if (_columns.TryGetValue(column + new int2(dx, dz), out var c)) c.MeshReaders += delta;
        }

        bool WantsFancyLeaves(int3 section)
        {
            if (_lastCameraSection.x == int.MinValue) return true;
            int3 d = math.abs(section - _lastCameraSection);
            return math.cmax(d) <= fancyLeavesDistance;
        }

        /// <summary>Queues leafy sections whose leaf detail no longer matches their distance to the camera.</summary>
        void RefreshLeafDetail()
        {
            foreach (var col in _columns.Values)
            {
                if (col.State != ColumnState.Ready) continue;
                foreach (var s in col.Sections)
                {
                    if (!s.HasLeaves || s.NeedsMesh || s.FancyLeaves == WantsFancyLeaves(s.Coord)) continue;
                    s.Version++;
                    s.NeedsMesh = true;
                }
            }
        }

        void Enqueue(int3 coord, int entry, int dirs)
        {
            var s = GetSection(coord);
            if (s == null || s.VisitStamp == _visStamp) return;
            s.VisitStamp = _visStamp;
            _visQueue.Enqueue((s, entry, dirs));
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

        /// <summary>Sky-light heightmap value (topmost light-blocking y) for a loaded column, else null.</summary>
        public int? GetHeightmap(int x, int z)
        {
            if (!_columns.TryGetValue(WorldToColumn(x, z), out var col) || col.State != ColumnState.Ready) return null;
            return col.Heightmap[(x & ChunkMask) + (z & ChunkMask) * ChunkSize];
        }

        /// <summary>
        /// Sets a block. Sections whose geometry depends on it are remeshed (in parallel) before returning;
        /// sections whose lighting can change are queued for async remeshing. Water around it re-evaluates.
        /// </summary>
        public bool SetBlock(int3 world, ushort block)
        {
            if (!WriteBlock(world, block)) return false;

            // geometry (faces, AO, bevels) depends only on the 3x3x3 voxel neighbourhood: remesh those now
            _syncScratch.Clear();
            for (int dy = -1; dy <= 1; dy++)
            for (int dz = -1; dz <= 1; dz++)
            for (int dx = -1; dx <= 1; dx++)
            {
                var ns = GetSection(WorldToSection(world + new int3(dx, dy, dz)));
                if (ns != null && ColumnAndNeighboursReady(ns.Coord.xz)) _syncScratch.Add(ns);
            }
            _syncJobs.Clear();
            foreach (var ns in _syncScratch)
                if (!TryResolveTrivially(ns)) _syncJobs.Add(ScheduleMesh(ns));
            JobHandle.ScheduleBatchedJobs();
            foreach (var job in _syncJobs)
            {
                job.Handle.Complete();
                FinishMesh(job);
            }

            AfterWrite(world);
            return true;
        }

        /// <summary>
        /// Sets a block and lets the regular async meshing pick up the change (no same-frame remesh). For
        /// simulations that change many cells at once (water).
        /// </summary>
        public bool SetBlockDeferred(int3 world, ushort block)
        {
            if (!WriteBlock(world, block)) return false;
            AfterWrite(world);
            return true;
        }

        /// <summary>Writes the voxel, keeps the light heightmap current and queues every section whose light can change.</summary>
        bool WriteBlock(int3 world, ushort block)
        {
            var s = GetSection(WorldToSection(world));
            if (s == null) return false;
            var l = WorldToLocal(world);
            if (s.Get(l.x, l.y, l.z) == block) return false;
            s.Set(l.x, l.y, l.z, block, RentVoxels);

            // light heightmap
            int oldH = s.Column.Heightmap[l.x + l.z * ChunkSize];
            int newH = oldH;
            if (_blocks[block].LightOpacity > 0) { if (world.y > oldH) newH = world.y; }
            else if (world.y == oldH) newH = RecomputeHeight(s.Column, l.x, l.z, world.y - 1);
            else newH = oldH;
            s.Column.Heightmap[l.x + l.z * ChunkSize] = newH;

            // light can change up to MaxLight blocks away (and along the whole sky shaft if the heightmap moved)
            int yLo = math.min(world.y, math.min(oldH, newH)) - MaxLight - 1;
            int yHi = math.max(world.y, math.max(oldH, newH)) + MaxLight + 1;
            int3 lo = WorldToSection(new int3(world.x - MaxLight - 1, yLo, world.z - MaxLight - 1));
            int3 hi = WorldToSection(new int3(world.x + MaxLight + 1, yHi, world.z + MaxLight + 1));
            for (int sy = math.max(lo.y, MinSectionY); sy <= math.min(hi.y, MaxSectionY); sy++)
            for (int sz = lo.z; sz <= hi.z; sz++)
            for (int sx = lo.x; sx <= hi.x; sx++)
            {
                var ns = GetSection(new int3(sx, sy, sz));
                if (ns == null) continue;
                ns.Version++;
                ns.NeedsMesh = true;
            }
            return true;
        }

        /// <summary>Consequences of a write: water re-evaluates, and props that depended on the cell go.</summary>
        void AfterWrite(int3 world)
        {
            _water.MarkDirty(world);

            // props resting on, hanging from or built into this cell go, and take their core/barrier cells along
            _propLeftovers.Clear();
            _props.RemoveDependents(world, _propLeftovers);
            if (_propLeftovers.Count > 0)
            {
                // copy: the nested SetBlock calls reuse the list
                var cells = _propLeftovers.ToArray();
                foreach (var (c, owned) in cells)
                    if (TryGetBlock(c, out var b) && b == owned)
                        SetBlock(c, BlockId.Air);
            }
        }

        int RecomputeHeight(ChunkColumn col, int lx, int lz, int fromY)
        {
            int h = MinWorldY - 1;
            for (int y = fromY; y >= MinWorldY; y--)
            {
                var s = col.SectionAtY(y >> ChunkSizeLog2);
                ushort b = s.Get(lx, y & ChunkMask, lz);
                if (b != BlockId.Air && _blocks[b].LightOpacity > 0) { h = y; break; }
            }
            col.Heightmap[lx + lz * ChunkSize] = h;
            return h;
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
            for (int ring = 0; ring < 96; ring++)
            for (int i = 0; i < 8; i++)
            {
                float a = i * math.PI / 4f + ring * 0.37f;
                var xz = new float2(math.cos(a), math.sin(a)) * ring * 24f;
                var s = TerrainNoise.SampleSurface(math.floor(xz) + 0.5f, seed);
                bool open = s.Biome == Biome.Plains || s.Biome == Biome.Forest || s.Biome == Biome.Savanna || s.Biome == Biome.Taiga;
                if (open && s.Height > SeaLevel + 3 && s.Height < 110 && s.MountainMask < 0.3f)
                    return new float3(math.floor(xz.x) + 0.5f, math.floor(s.Height) + 1.05f, math.floor(xz.y) + 0.5f);
            }
            return new float3(0.5f, MaxWorldY - 4, 0.5f);
        }
    }

    [BurstCompile]
    static unsafe class ColumnOps
    {
        [BurstCompile]
        public static bool IsUniform(ushort* data, int count, out ushort value)
        {
            value = data[0];
            for (int i = 1; i < count; i++)
                if (data[i] != value) return false;
            return true;
        }
    }
}
