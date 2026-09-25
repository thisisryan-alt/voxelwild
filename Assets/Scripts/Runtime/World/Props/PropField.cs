using System.Collections.Generic;
using Unity.Collections;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.Rendering;
using Voxelwild.World.Meshing;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World.Props
{
    /// <summary>
    /// Runtime side of the props: keeps the props of every loaded column bucketed by section, lights them
    /// from the voxel light their section's mesh job computed, removes them when an edit breaks what they
    /// stand on, and draws them with GPU instancing (one batch per mesh LOD, per-instance voxel light).
    ///
    /// Props follow their section: a section hidden by cave culling hides its props, and props only appear
    /// once their section has been lit (meshed), so they never flash in unlit.
    /// Owned and driven by <see cref="VoxelWorld"/>.
    /// </summary>
    public sealed class PropField
    {
        const int BatchSize = 1023;
        const float ShadowMargin = 16f;
        static readonly int LightId = Shader.PropertyToID("_PropLight");

        sealed class SectionProps
        {
            public int3 Coord;
            public readonly List<PropInstance> Items = new List<PropInstance>();
            public Matrix4x4[] Matrices = new Matrix4x4[0];
            public int[] Entry = new int[0];
            public Vector4[] Light = new Vector4[0];
            public Vector3[] Position = new Vector3[0];
            public Bounds Bounds;
            public bool Lit;
        }

        sealed class Batch
        {
            public Mesh Mesh;
            public Material[] Materials;
            public ShadowCastingMode Shadows;
            public readonly Matrix4x4[] Matrices = new Matrix4x4[BatchSize];
            public readonly Vector4[] Light = new Vector4[BatchSize];
            public int Count;
        }

        readonly PropLibrary _library;
        readonly PropRule[] _rules;
        readonly List<PropLibrary.Entry> _entries = new List<PropLibrary.Entry>();
        readonly List<int> _entryKind = new List<int>();
        readonly List<float[]> _lodDistSq = new List<float[]>();
        readonly List<Batch[]> _batches = new List<Batch[]>();
        readonly Dictionary<int3, SectionProps> _sections = new Dictionary<int3, SectionProps>();
        readonly Dictionary<int2, List<int3>> _columnSections = new Dictionary<int2, List<int3>>();
        readonly HashSet<int3> _removed = new HashSet<int3>();
        readonly Stack<SectionProps> _pool = new Stack<SectionProps>();
        readonly MaterialPropertyBlock _mpb = new MaterialPropertyBlock();
        readonly Plane[] _frustum = new Plane[6];
        readonly int[] _firstEntry;          // [kind] -> index of variant 0 in _entries, -1 when missing
        readonly int[] _variantCount;
        readonly float _maxDrawDistance;

        /// <summary>Multiplies every draw and LOD distance (quality presets).</summary>
        public float DistanceScale { get; set; } = 1f;
        public int Loaded { get; private set; }
        public int Drawn { get; private set; }
        public bool HasArt => _entries.Count > 0;

        public PropField(PropLibrary library)
        {
            _library = library;
            _rules = new PropRule[PropRegistry.Count];
            _firstEntry = new int[PropRegistry.Count];
            _variantCount = new int[PropRegistry.Count];
            for (int k = 0; k < _rules.Length; k++)
            {
                _rules[k] = PropRegistry.Get(k);
                _maxDrawDistance = math.max(_maxDrawDistance, _rules[k].DrawDistance);
                _firstEntry[k] = -1;
            }
            if (library == null) return;

            var byKind = library.ByKind;
            for (int k = 0; k < byKind.Length; k++)
            {
                var variants = byKind[k];
                _firstEntry[k] = variants.Length > 0 ? _entries.Count : -1;
                _variantCount[k] = variants.Length;
                foreach (var e in variants)
                {
                    _entries.Add(e);
                    _entryKind.Add(k);
                    if (e == null)
                    {
                        _lodDistSq.Add(null);
                        _batches.Add(null);
                        continue;
                    }
                    // LOD switch distances as fractions of the kind's draw distance
                    int n = e.lods.Length;
                    float[] fractions = n >= 3 ? new[] { 0.22f, 0.5f, 1f } : n == 2 ? new[] { 0.4f, 1f } : new[] { 1f };
                    var d2 = new float[n];
                    var batches = new Batch[n];
                    for (int l = 0; l < n; l++)
                    {
                        float d = _rules[k].DrawDistance * fractions[math.min(l, fractions.Length - 1)];
                        d2[l] = d * d;
                        batches[l] = new Batch
                        {
                            Mesh = e.lods[l].mesh, Materials = e.lods[l].materials,
                            Shadows = _rules[k].CastShadows ? ShadowCastingMode.On : ShadowCastingMode.Off,
                        };
                    }
                    _lodDistSq.Add(d2);
                    _batches.Add(batches);
                }
            }
        }

        // ------------------------------------------------------------------ lifecycle

        /// <summary>Takes the props the decoration job placed in a column that just became Ready.</summary>
        public void OnColumnReady(ChunkColumn col)
        {
            OnColumnUnloaded(col.Coord);
            var list = new List<int3>(4);
            for (int i = 0; i < col.Props.Length; i++)
            {
                var p = col.Props[i];
                if (_removed.Contains(p.Cell)) continue;
                var coord = WorldToSection(p.Cell);
                if (!_sections.TryGetValue(coord, out var sp))
                {
                    sp = _pool.Count > 0 ? _pool.Pop() : new SectionProps();
                    sp.Coord = coord;
                    sp.Items.Clear();
                    sp.Lit = false;
                    _sections.Add(coord, sp);
                    list.Add(coord);
                }
                sp.Items.Add(p);
                Loaded++;
            }
            foreach (var c in list) Rebuild(_sections[c]);
            if (list.Count > 0) _columnSections[col.Coord] = list;
        }

        public void OnColumnUnloaded(int2 coord)
        {
            if (!_columnSections.TryGetValue(coord, out var list)) return;
            foreach (var c in list)
            {
                if (!_sections.TryGetValue(c, out var sp)) continue;
                Loaded -= sp.Items.Count;
                _sections.Remove(c);
                _pool.Push(sp);
            }
            _columnSections.Remove(coord);
        }

        /// <summary>
        /// Reads the voxel light around each prop from the finished mesh job's region (the job lit a 64³ region
        /// around the section, so every prop and its neighbours are inside it).
        /// </summary>
        public void OnSectionLit(ChunkSection s, MeshJobBuffers b)
        {
            if (!_sections.TryGetValue(s.Coord, out var sp)) return;
            int3 origin = s.Coord * ChunkSize;
            for (int i = 0; i < sp.Items.Count; i++)
            {
                var p = sp.Items[i];
                int3 l = p.Cell - origin;
                int sky = 0, block = 0;
                for (int n = 0; n < 7; n++)
                {
                    int3 q = l + (n == 0 ? int3.zero : Faces.Normal(n - 1));
                    int ri = RegionIndex(q.x, q.y, q.z);
                    sky = math.max(sky, b.Sky[ri]);
                    block = math.max(block, b.BlockLight[ri]);
                }
                ushort c = b.ClimatePatch[(l.x + RegionMargin) + (l.z + RegionMargin) * RegionSize];
                sp.Light[i] = new Vector4(sky / (float)MaxLight, block / (float)MaxLight, (c & 255) / 255f, (c >> 8) / 255f);
            }
            sp.Lit = true;
        }

        /// <summary>A uniform-air section is never meshed: estimate its props' light from the sky heightmap.</summary>
        public void OnSectionTrivial(ChunkSection s)
        {
            if (!_sections.TryGetValue(s.Coord, out var sp) || s.Column == null) return;
            for (int i = 0; i < sp.Items.Count; i++)
            {
                var p = sp.Items[i];
                int lx = p.Cell.x & ChunkMask, lz = p.Cell.z & ChunkMask;
                int h = s.Column.Heightmap[lx + lz * ChunkSize];
                var surf = s.Column.Surface[lx + lz * ChunkSize];
                sp.Light[i] = new Vector4(p.Cell.y > h ? 1f : 0.5f, 0f, surf.Temperature / 255f, surf.Humidity / 255f);
            }
            sp.Lit = true;
        }

        /// <summary>
        /// Removes every prop that depends on <paramref name="cell"/> (after an edit there) and appends the cells
        /// it wrote into the terrain (core, barriers) with the block it wrote, so the world can clear them.
        /// Removed props stay removed when their column reloads.
        /// </summary>
        public void RemoveDependents(int3 cell, List<(int3 cell, ushort block)> leftovers)
        {
            // footprints reach at most 2 cells, barriers 2 up: scan the sections around the cell
            int3 lo = WorldToSection(cell - new int3(3, 3, 3));
            int3 hi = WorldToSection(cell + new int3(3, 3, 3));
            for (int y = lo.y; y <= hi.y; y++)
            for (int z = lo.z; z <= hi.z; z++)
            for (int x = lo.x; x <= hi.x; x++)
            {
                if (!_sections.TryGetValue(new int3(x, y, z), out var sp)) continue;
                bool changed = false;
                for (int i = sp.Items.Count - 1; i >= 0; i--)
                {
                    var p = sp.Items[i];
                    var rule = _rules[p.Kind];
                    if (!PropRegistry.DependsOn(rule, p, cell)) continue;
                    sp.Items.RemoveAt(i);
                    // keep the light array aligned with the items
                    System.Array.Copy(sp.Light, i + 1, sp.Light, i, sp.Items.Count - i);
                    _removed.Add(p.Cell);
                    Loaded--;
                    changed = true;
                    CollectOwnedCells(rule, p, leftovers);
                }
                if (changed) Rebuild(sp);
            }
        }

        /// <summary>Cells a prop wrote into the terrain, with the block it wrote: its core and its barrier cells.</summary>
        public static void CollectOwnedCells(in PropRule rule, in PropInstance p, List<(int3 cell, ushort block)> cells)
        {
            if (rule.CoreBlock != BlockId.Air) cells.Add((p.Cell, rule.CoreBlock));
            if (rule.BarrierHeight == 0) return;
            int3 axis = rule.Footprint > 0 ? PropRegistry.FootprintAxis(p) : int3.zero;
            for (int t = -rule.Footprint; t <= rule.Footprint; t++)
            for (int y = 0; y < rule.BarrierHeight; y++)
                cells.Add((p.Cell + axis * t + new int3(0, y, 0), BlockId.PropBarrier));
        }

        // ------------------------------------------------------------------ transforms

        void Rebuild(SectionProps sp)
        {
            int n = sp.Items.Count;
            if (sp.Matrices.Length < n)
            {
                int cap = math.max(n, sp.Matrices.Length * 2);
                System.Array.Resize(ref sp.Matrices, cap);
                System.Array.Resize(ref sp.Entry, cap);
                System.Array.Resize(ref sp.Light, cap);
                System.Array.Resize(ref sp.Position, cap);
            }
            var min = new Vector3(float.MaxValue, float.MaxValue, float.MaxValue);
            var max = -min;
            for (int i = 0; i < n; i++)
            {
                var p = sp.Items[i];
                var rule = _rules[p.Kind];
                float scale = PropRegistry.ScaleOf(rule, p);
                int entry = ResolveEntry(rule, p, scale);
                sp.Entry[i] = entry;
                sp.Matrices[i] = Transform(rule, p, scale);
                sp.Position[i] = sp.Matrices[i].GetColumn(3);
                if (entry < 0) continue;
                var e = _entries[entry];
                float r = e.radius * scale;
                var pos = sp.Position[i];
                min = Vector3.Min(min, pos + new Vector3(-r, e.bottom * scale, -r));
                max = Vector3.Max(max, pos + new Vector3(r, e.top * scale, r));
            }
            sp.Bounds = min.x <= max.x ? new Bounds((min + max) * 0.5f, max - min) : default;
        }

        /// <summary>Picks the variant's library entry; formations shrink to the longest variant that fits their room.</summary>
        int ResolveEntry(in PropRule rule, in PropInstance p, float scale)
        {
            int first = _firstEntry[p.Kind];
            int count = _variantCount[p.Kind];
            if (first < 0 || count == 0) return -1;
            int v = p.Variant % count;
            bool cave = rule.Placement != PropPlacement.Ground;
            for (; v >= 0; v--)
            {
                var e = _entries[first + v];
                if (e == null) continue;
                if (!cave || e.Length * scale <= p.Room - 0.1f) return first + v;
            }
            return -1;
        }

        public static Matrix4x4 Transform(in PropRule rule, in PropInstance p, float scale)
        {
            var pos = new Vector3(p.Cell.x + 0.5f, p.Cell.y, p.Cell.z + 0.5f);
            if (rule.Placement == PropPlacement.CaveCeiling) pos.y += 1f;
            else pos.y -= rule.Sink * scale;
            // small free-standing props wander inside their cell so rows of them don't line up
            if (rule.Grid <= 1 && rule.Footprint == 0 && rule.CoreBlock == BlockId.Air && rule.BarrierHeight == 0)
            {
                uint h = math.hash(p.Cell);
                pos.x += ((h & 255) / 255f - 0.5f) * 0.5f;
                pos.z += (((h >> 8) & 255) / 255f - 0.5f) * 0.5f;
            }
            var rot = Quaternion.AngleAxis(PropRegistry.YawOf(p) * Mathf.Rad2Deg, Vector3.up);
            return Matrix4x4.TRS(pos, rot, new Vector3(scale, scale, scale));
        }

        // ------------------------------------------------------------------ drawing

        /// <summary>Queues every visible prop for this frame (all cameras, shadows included).</summary>
        public void Draw(Camera camera, System.Func<int3, ChunkSection> getSection, int layer)
        {
            Drawn = 0;
            if (camera == null || _entries.Count == 0) return;
            GeometryUtility.CalculateFrustumPlanes(camera, _frustum);
            Vector3 cam = camera.transform.position;
            float scale2 = DistanceScale * DistanceScale;
            float maxSq = _maxDrawDistance * _maxDrawDistance * scale2;

            foreach (var sp in _sections.Values)
            {
                if (!sp.Lit || sp.Bounds.size == Vector3.zero) continue;
                var s = getSection(sp.Coord);
                if (s == null || s.CulledByOcclusion) continue;
                if (sp.Bounds.SqrDistance(cam) > maxSq) continue;
                // props just outside the view can still cast shadows into it
                var cull = sp.Bounds;
                cull.Expand(ShadowMargin);
                if (!GeometryUtility.TestPlanesAABB(_frustum, cull)) continue;
                for (int i = 0; i < sp.Items.Count; i++)
                {
                    int e = sp.Entry[i];
                    if (e < 0) continue;
                    float d2 = (sp.Position[i] - cam).sqrMagnitude / scale2;
                    var dists = _lodDistSq[e];
                    int lod = 0;
                    while (lod < dists.Length && d2 > dists[lod]) lod++;
                    if (lod >= dists.Length) continue;
                    var batch = _batches[e][lod];
                    batch.Matrices[batch.Count] = sp.Matrices[i];
                    batch.Light[batch.Count] = sp.Light[i];
                    if (++batch.Count == BatchSize) Flush(batch, layer);
                    Drawn++;
                }
            }
            foreach (var bs in _batches)
                if (bs != null)
                    foreach (var b in bs)
                        if (b.Count > 0) Flush(b, layer);
        }

        void Flush(Batch b, int layer)
        {
            _mpb.Clear();
            _mpb.SetVectorArray(LightId, b.Light);
            if (b.Mesh == null || b.Materials.Length == 0) { b.Count = 0; return; }
            for (int sub = 0; sub < b.Mesh.subMeshCount; sub++)
            {
                var mat = b.Materials[math.min(sub, b.Materials.Length - 1)];
                if (mat == null) continue;
                Graphics.DrawMeshInstanced(b.Mesh, sub, mat, b.Matrices, b.Count, _mpb, b.Shadows, true, layer, null,
                    LightProbeUsage.Off);
            }
            b.Count = 0;
        }
    }
}
