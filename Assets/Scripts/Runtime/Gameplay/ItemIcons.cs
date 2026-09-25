using System.Collections.Generic;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Voxelwild.World;
using Voxelwild.World.Meshing;

namespace Voxelwild.Gameplay
{
    /// <summary>
    /// Inventory icons. Block items are rendered once at startup as small isometric blocks with the real terrain
    /// materials (so an icon always matches the block in the world), on a private layer by an off-screen camera.
    /// Materials, food and tools get simple drawn icons in their token colours.
    /// </summary>
    public sealed class ItemIcons : MonoBehaviour
    {
        [SerializeField] Material terrainMaterial;
        [SerializeField] Material foliageMaterial;
        [SerializeField, Range(0, 31)] int iconLayer = 31;
        [SerializeField] int size = 64;

        readonly Dictionary<ushort, Texture2D> _icons = new Dictionary<ushort, Texture2D>();
        readonly Dictionary<ushort, Color> _average = new Dictionary<ushort, Color>();
        bool _built;

        public Texture2D Get(ushort item)
        {
            if (!_built) Build();
            return _icons.TryGetValue(item, out var t) ? t : null;
        }

        /// <summary>
        /// The mean colour of an item's icon (opaque pixels only): debris and leaf particles take their colour from
        /// the block they came from. Grey when there is no icon.
        /// </summary>
        public Color AverageColor(ushort item)
        {
            if (_average.TryGetValue(item, out var c)) return c;
            var icon = Get(item);
            c = new Color(0.5f, 0.5f, 0.5f);
            if (icon != null)
            {
                var px = icon.GetPixels32();
                float r = 0, g = 0, b = 0;
                int n = 0;
                foreach (var p in px)
                {
                    if (p.a < 128) continue;
                    r += p.r; g += p.g; b += p.b;
                    n++;
                }
                if (n > 0) c = new Color(r / (255f * n), g / (255f * n), b / (255f * n));
            }
            _average[item] = c;
            return c;
        }

        void Build()
        {
            _built = true;
            foreach (var def in ItemRegistry.All)
                _icons[def.Id] = def.Kind == ItemKind.Block ? RenderBlock(def.Block) : Draw(def);
        }

        void OnDestroy()
        {
            foreach (var t in _icons.Values) if (t != null) Destroy(t);
        }

        Texture2D RenderBlock(ushort block)
        {
            var def = BlockRegistry.Get(block);
            var go = new GameObject("IconBlock") { layer = iconLayer, hideFlags = HideFlags.HideAndDontSave };
            var camGo = new GameObject("IconCamera") { hideFlags = HideFlags.HideAndDontSave };
            var rt = RenderTexture.GetTemporary(size, size, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            Mesh mesh = null;
            try
            {
                mesh = BlockCube(block, 15);
                mesh.hideFlags = HideFlags.HideAndDontSave;
                // high above the world: out of every view, and clear of the height fog that pools low down
                go.transform.position = new Vector3(0f, 5000f, 0f);
                go.AddComponent<MeshFilter>().sharedMesh = mesh;
                var r = go.AddComponent<MeshRenderer>();
                r.sharedMaterial = def.Shape == RenderShape.Cube ? terrainMaterial : foliageMaterial;
                r.shadowCastingMode = ShadowCastingMode.Off;

                var cam = camGo.AddComponent<Camera>();
                cam.orthographic = true;
                cam.orthographicSize = 0.9f;
                cam.cullingMask = 1 << iconLayer;
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = new Color(0, 0, 0, 0);
                cam.nearClipPlane = 0.1f;
                cam.farClipPlane = 10f;
                cam.enabled = false;
                var data = camGo.AddComponent<UniversalAdditionalCameraData>();
                data.renderPostProcessing = false;
                data.renderShadows = false;
                // isometric view of the top and two sides
                camGo.transform.position = go.transform.position + new Vector3(0.5f, 0.5f, 0.5f) + new Vector3(-3f, 2.5f, -3f);
                camGo.transform.LookAt(go.transform.position + new Vector3(0.5f, 0.5f, 0.5f));

                var request = new RenderPipeline.StandardRequest { destination = rt };
                if (RenderPipeline.SupportsRenderRequest(cam, request)) RenderPipeline.SubmitRenderRequest(cam, request);
                else { cam.targetTexture = rt; cam.Render(); cam.targetTexture = null; }

                var prev = RenderTexture.active;
                RenderTexture.active = rt;
                var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = "Icon_" + BlockRegistry.Name(block) };
                tex.ReadPixels(new Rect(0, 0, size, size), 0, 0);
                tex.Apply();
                RenderTexture.active = prev;
                return tex;
            }
            finally
            {
                RenderTexture.ReleaseTemporary(rt);
                Destroy(go);
                Destroy(camGo);
                if (mesh != null) Destroy(mesh);
            }
        }

        /// <summary>A unit cube (0..1) in the terrain vertex format with the block's texture layers and tint.</summary>
        public static Mesh BlockCube(ushort block, int skyLight)
        {
            var def = BlockRegistry.Get(block);
            var verts = new List<TerrainVertex>(24);
            var idx = new List<int>(36);
            uint light = TerrainVertex.PackLight(skyLight, 0, 140, 110);
            for (int face = 0; face < 6; face++)
            {
                int3 n = Faces.Normal(face), t = Faces.Tangent(face), b = Faces.Bitangent(face);
                float3 c = new float3(0.5f) + (float3)n * 0.5f;
                float3 ht = (float3)t * 0.5f, hb = (float3)b * 0.5f;
                int layer = (int)def.LayerForFace(face);
                if (layer == (int)TextureLayer.None) layer = (int)def.Side;
                bool side = face != Faces.PosY && face != Faces.NegY;
                uint d0 = TerrainVertex.Pack(face, 15, layer, 3, side && def.SideOverlay != TextureLayer.None ? (int)def.SideOverlay : 255);
                int s = verts.Count;
                foreach (var p in new[] { c - ht - hb, c - ht + hb, c + ht + hb, c + ht - hb })
                    verts.Add(new TerrainVertex { Position = p, Data0 = d0, Data1 = light, Data2 = (uint)def.Tint });
                idx.AddRange(new[] { s, s + 1, s + 2, s, s + 2, s + 3 });
            }
            var mesh = new Mesh { name = "BlockCube_" + BlockRegistry.Name(block) };
            mesh.SetVertexBufferParams(verts.Count, TerrainVertex.Layout);
            mesh.SetVertexBufferData(verts, 0, 0, verts.Count);
            mesh.SetIndices(idx, MeshTopology.Triangles, 0);
            mesh.bounds = new Bounds(new Vector3(0.5f, 0.5f, 0.5f), Vector3.one * 1.2f);
            return mesh;
        }

        /// <summary>Flat drawn icons for everything that isn't a block.</summary>
        Texture2D Draw(ItemDefinition def)
        {
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { name = "Icon_" + def.Name, filterMode = FilterMode.Bilinear };
            var px = new Color32[size * size];
            Color main = ItemEntities.TokenColor(def.Id);
            Color handle = new Color(0.45f, 0.3f, 0.16f);
            float S = size;
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float2 p = new float2((x + 0.5f) / S, (y + 0.5f) / S);
                Color c = Color.clear;
                if (def.Kind == ItemKind.Tool)
                {
                    // diagonal handle from bottom-left, head across the top-right
                    float2 a = new float2(0.18f, 0.18f), b = new float2(0.72f, 0.72f);
                    if (Segment(p, a, b) < 0.045f) c = handle;
                    float head = def.Tool switch
                    {
                        ToolType.Pickaxe => Segment(p, new float2(0.42f, 0.9f), new float2(0.9f, 0.42f)) - 0.06f,
                        ToolType.Axe => math.length(p - new float2(0.74f, 0.74f)) - 0.17f,
                        _ => math.length((p - new float2(0.8f, 0.8f)) * new float2(1f, 1.5f)) - 0.12f,
                    };
                    if (head < 0f) c = main;
                }
                else if (def.Id == ItemId.Stick)
                {
                    if (Segment(p, new float2(0.22f, 0.2f), new float2(0.78f, 0.8f)) < 0.05f) c = main;
                }
                else if (def.Id == ItemId.Diamond)
                {
                    float2 q = math.abs(p - 0.5f);
                    if (q.x + q.y < 0.32f) c = Color.Lerp(main, Color.white, math.saturate(0.4f - (p.y - 0.5f)));
                }
                else
                {
                    float r = math.length(p - 0.5f);
                    if (r < 0.3f) c = Color.Lerp(main, main * 0.6f, r / 0.3f);
                    if (def.Id == ItemId.Apple && Segment(p, new float2(0.5f, 0.78f), new float2(0.56f, 0.9f)) < 0.025f) c = handle;
                }
                if (c.a > 0f) c.a = 1f;
                px[x + y * size] = c;
            }
            tex.SetPixels32(px);
            tex.Apply();
            return tex;
        }

        static float Segment(float2 p, float2 a, float2 b)
        {
            float2 pa = p - a, ba = b - a;
            float h = math.saturate(math.dot(pa, ba) / math.dot(ba, ba));
            return math.length(pa - ba * h);
        }
    }
}
