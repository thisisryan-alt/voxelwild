using System.Collections.Generic;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.Rendering;
using Voxelwild.Player;
using Voxelwild.World;
using Voxelwild.World.Meshing;

namespace Voxelwild.Gameplay
{
    /// <summary>
    /// Dropped items: small spinning blocks (drawn with the terrain materials, so they look like the block) or
    /// coloured tokens for materials, tools and food. They fall and settle with the same voxel physics as the
    /// player, get picked up when the player walks close, and vanish after five minutes.
    /// </summary>
    public sealed class ItemEntities : MonoBehaviour
    {
        [SerializeField] VoxelWorld world;
        [SerializeField] PlayerSurvival survival;
        [SerializeField] Material terrainMaterial;
        [SerializeField] Material foliageMaterial;
        [SerializeField] Material tokenMaterial;
        [SerializeField] float pickupRadius = 1.6f;
        [SerializeField] float lifetime = 300f;

        sealed class Entity
        {
            public ItemStack Stack;
            public VoxelBody Body;
            public GameObject Go;
            public MeshFilter Filter;
            public MeshRenderer Renderer;
            public float Age;
            public float Spin;
        }

        readonly List<Entity> _live = new List<Entity>();
        readonly Stack<Entity> _pool = new Stack<Entity>();
        readonly Dictionary<(ushort, bool), Mesh> _blockMeshes = new Dictionary<(ushort, bool), Mesh>();
        MaterialPropertyBlock _mpb;
        Mesh _token;

        static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");
        public int Count => _live.Count;

        void Awake()
        {
            _mpb = new MaterialPropertyBlock();
            _token = MakeTokenMesh();
        }

        void OnDestroy()
        {
            foreach (var m in _blockMeshes.Values) Destroy(m);
            if (_token != null) Destroy(_token);
        }

        public void Spawn(ItemStack stack, float3 position, float3 velocity)
        {
            if (stack.IsEmpty) return;
            var e = _pool.Count > 0 ? _pool.Pop() : Create();
            e.Stack = stack;
            e.Age = 0f;
            e.Spin = UnityEngine.Random.Range(0f, 360f);
            e.Body.Position = position;
            e.Body.Velocity = velocity;
            ApplyLook(e, lit: true);
            e.Go.SetActive(true);
            _live.Add(e);
        }

        /// <summary>Drops everything in the inventory around a point (death in survival).</summary>
        public void Scatter(Inventory inventory, float3 at)
        {
            foreach (var (slot, stack) in inventory.NonEmpty())
            {
                var dir = UnityEngine.Random.insideUnitCircle * 2.5f;
                Spawn(stack, at + new float3(0, 0.5f, 0), new float3(dir.x, 4f, dir.y));
            }
            inventory.Clear();
        }

        Entity Create()
        {
            var go = new GameObject("DroppedItem");
            go.transform.SetParent(transform, false);
            var e = new Entity
            {
                Go = go,
                Body = new VoxelBody { HalfWidth = 0.14f, Height = 0.28f },
                Filter = go.AddComponent<MeshFilter>(),
                Renderer = go.AddComponent<MeshRenderer>(),
            };
            e.Renderer.shadowCastingMode = ShadowCastingMode.On;
            e.Renderer.lightProbeUsage = LightProbeUsage.Off;
            return e;
        }

        void Update()
        {
            float dt = math.min(Time.deltaTime, 0.05f);
            float3 feet = survival != null ? survival.Player.Body.Position : new float3(float.MaxValue);
            for (int i = _live.Count - 1; i >= 0; i--)
            {
                var e = _live[i];
                e.Age += dt;
                ref float3 v = ref e.Body.Velocity;
                v.y = math.max(v.y - 20f * dt, -30f);
                v.xz *= math.exp(-(e.Body.Grounded ? 8f : 0.5f) * dt);
                e.Body.Move(world, v * dt);

                bool pickup = survival != null && e.Age > 0.6f
                              && math.distancesq(e.Body.Position, feet + new float3(0, 0.5f, 0)) < pickupRadius * pickupRadius;
                if (pickup)
                {
                    int left = survival.Inventory.Add(e.Stack);
                    if (left == 0) { Release(i); continue; }
                    e.Stack.Count = left;
                }
                if (e.Age > lifetime || e.Body.Position.y < VoxelConstants.MinWorldY - 8) { Release(i); continue; }

                // tokens spin; blocks only bob (the terrain shader lights faces by their world-axis normals)
                e.Spin += dt * 70f;
                float bob = math.sin(e.Age * 2.5f) * 0.05f + 0.1f;
                bool block = ItemRegistry.Get(e.Stack.Item).Kind == ItemKind.Block;
                e.Go.transform.SetPositionAndRotation((Vector3)(e.Body.Position + new float3(0, bob, 0)),
                    block ? Quaternion.identity : Quaternion.Euler(0, e.Spin, 25f));
                // under the sky or not: pick the matching baked-light mesh now and then
                if (((i + Time.frameCount) & 31) == 0) ApplyLook(e, IsLit(e.Body.Position));
            }
        }

        bool IsLit(float3 p)
        {
            int? top = world.GetHeightmap((int)math.floor(p.x), (int)math.floor(p.z));
            return !top.HasValue || top.Value < p.y;
        }

        void Release(int index)
        {
            var e = _live[index];
            e.Go.SetActive(false);
            _live.RemoveAt(index);
            _pool.Push(e);
        }

        void ApplyLook(Entity e, bool lit)
        {
            var def = ItemRegistry.Get(e.Stack.Item);
            if (def.Kind == ItemKind.Block)
            {
                var bd = BlockRegistry.Get(def.Block);
                bool cutout = bd.Shape != RenderShape.Cube;
                e.Filter.sharedMesh = BlockMesh(def.Block, lit);
                e.Renderer.sharedMaterial = cutout ? foliageMaterial : terrainMaterial;
                e.Go.transform.localScale = Vector3.one * 0.25f;
                e.Renderer.SetPropertyBlock(null);
            }
            else
            {
                e.Filter.sharedMesh = _token;
                e.Renderer.sharedMaterial = tokenMaterial;
                e.Go.transform.localScale = def.Kind == ItemKind.Tool ? new Vector3(0.08f, 0.45f, 0.08f) : Vector3.one * 0.2f;
                _mpb.SetColor(BaseColorId, TokenColor(e.Stack.Item) * (lit ? 1f : 0.3f));
                e.Renderer.SetPropertyBlock(_mpb);
            }
        }

        /// <summary>A unit cube (centred on x/z, base at 0) in the terrain vertex format with the block's layers.</summary>
        Mesh BlockMesh(ushort block, bool lit)
        {
            if (_blockMeshes.TryGetValue((block, lit), out var mesh)) return mesh;
            var def = BlockRegistry.Get(block);
            var verts = new List<TerrainVertex>(24);
            var idx = new List<int>(36);
            uint light = TerrainVertex.PackLight(lit ? 15 : 3, 0, 128, 128);
            uint extra = (uint)def.Tint;
            for (int face = 0; face < 6; face++)
            {
                int3 n = Faces.Normal(face), t = Faces.Tangent(face), b = Faces.Bitangent(face);
                float3 c = new float3(0.5f) + (float3)n * 0.5f;
                float3 ht = (float3)t * 0.5f, hb = (float3)b * 0.5f;
                int layer = (int)def.LayerForFace(face);
                if (layer == (int)TextureLayer.None) layer = (int)def.Side;
                uint d0 = TerrainVertex.Pack(face, 0, layer, 3, face != Faces.PosY && face != Faces.NegY && def.SideOverlay != TextureLayer.None ? (int)def.SideOverlay : 255);
                int s = verts.Count;
                foreach (var p in new[] { c - ht - hb, c - ht + hb, c + ht + hb, c + ht - hb })
                    verts.Add(new TerrainVertex { Position = p - new float3(0.5f, 0f, 0.5f), Data0 = d0, Data1 = light, Data2 = extra });
                idx.AddRange(new[] { s, s + 1, s + 2, s, s + 2, s + 3 });
            }
            mesh = new Mesh { name = $"Item_{BlockRegistry.Name(block)}" };
            mesh.SetVertexBufferParams(verts.Count, TerrainVertex.Layout);
            mesh.SetVertexBufferData(verts, 0, 0, verts.Count);
            mesh.SetIndices(idx, MeshTopology.Triangles, 0);
            mesh.bounds = new Bounds(new Vector3(0, 0.5f, 0), Vector3.one * 1.2f);
            _blockMeshes[(block, lit)] = mesh;
            return mesh;
        }

        static Mesh MakeTokenMesh()
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            var mesh = Object.Instantiate(go.GetComponent<MeshFilter>().sharedMesh);
            Destroy(go);
            var v = mesh.vertices;
            for (int i = 0; i < v.Length; i++) v[i] += new Vector3(0, 0.5f, 0);   // base at 0 like blocks
            mesh.vertices = v;
            mesh.RecalculateBounds();
            return mesh;
        }

        public static Color TokenColor(ushort item)
        {
            switch (item)
            {
                case ItemId.Stick: return new Color(0.45f, 0.3f, 0.16f);
                case ItemId.Coal: return new Color(0.08f, 0.08f, 0.09f);
                case ItemId.IronChunk: return new Color(0.72f, 0.66f, 0.6f);
                case ItemId.GoldChunk: return new Color(0.95f, 0.78f, 0.25f);
                case ItemId.Diamond: return new Color(0.45f, 0.92f, 0.9f);
                case ItemId.Apple: return new Color(0.78f, 0.12f, 0.1f);
                case ItemId.Berries: return new Color(0.42f, 0.1f, 0.45f);
            }
            var def = ItemRegistry.Get(item);
            if (def.Kind == ItemKind.Tool)
                return def.Tier switch
                {
                    ToolTier.Wood => new Color(0.55f, 0.38f, 0.2f),
                    ToolTier.Stone => new Color(0.5f, 0.5f, 0.5f),
                    ToolTier.Iron => new Color(0.82f, 0.82f, 0.85f),
                    _ => new Color(0.45f, 0.92f, 0.9f),
                };
            return Color.white;
        }
    }
}
