using Unity.Mathematics;
using UnityEngine;
using Voxelwild.Gameplay;
using Voxelwild.Player;
using Voxelwild.World;

namespace Voxelwild.Rendering
{
    /// <summary>
    /// Small particle effects: debris cubes when a block breaks or is struck while mining, a spray when the
    /// player falls into water, and leaves drifting down from canopies near the player. Debris takes the
    /// block's colour from its icon. The world has no colliders, so particles are kept out of solid blocks
    /// here: each frame, any particle inside a solid block is set down on top of it.
    /// </summary>
    public sealed class BlockEffects : MonoBehaviour
    {
        [SerializeField] VoxelWorld world;
        [SerializeField] PlayerController player;
        [SerializeField] BlockInteractor interactor;
        [SerializeField] ItemIcons icons;
        [SerializeField] EnvironmentLighting environment;
        [SerializeField] Material particleMaterial;
        [SerializeField] int maxDebris = 600;
        [SerializeField] int maxLeaves = 160;
        [SerializeField] float leafRadius = 14f;
        [SerializeField] float leavesPerSecond = 6f;

        ParticleSystem _debris, _leaves;
        ParticleSystem.Particle[] _buffer;
        Mesh _cube;
        float _leafClock;

        void Awake()
        {
            var tmp = GameObject.CreatePrimitive(PrimitiveType.Cube);
            _cube = Instantiate(tmp.GetComponent<MeshFilter>().sharedMesh);
            Destroy(tmp);
            _debris = MakeSystem("Debris", maxDebris, mesh: true, gravity: 1.6f);
            _leaves = MakeSystem("Leaves", maxLeaves, mesh: false, gravity: 0f);
            var noise = _leaves.noise;   // flutter
            noise.enabled = true;
            noise.strength = 0.6f;
            noise.frequency = 0.35f;
            noise.scrollSpeed = 0.2f;
            var rot = _leaves.rotationOverLifetime;
            rot.enabled = true;
            rot.z = new ParticleSystem.MinMaxCurve(-2f, 2f);
            _buffer = new ParticleSystem.Particle[math.max(maxDebris, maxLeaves)];
        }

        void OnDestroy()
        {
            if (_cube != null) Destroy(_cube);
        }

        ParticleSystem MakeSystem(string name, int max, bool mesh, float gravity)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            // loops forever with emission off: a playing system simulates whatever Emit() adds
            main.loop = true;
            main.playOnAwake = false;
            main.maxParticles = max;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.gravityModifier = gravity;
            main.startSpeed = 0f;
            main.startRotation3D = mesh;
            var emission = ps.emission;
            emission.enabled = false;
            var shape = ps.shape;
            shape.enabled = false;
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.sharedMaterial = particleMaterial;
            r.renderMode = mesh ? ParticleSystemRenderMode.Mesh : ParticleSystemRenderMode.Billboard;
            if (mesh) r.mesh = _cube;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = true;
            ps.Play();
            return ps;
        }

        void OnEnable()
        {
            if (interactor != null)
            {
                interactor.Broken += OnBroken;
                interactor.MiningHit += OnHit;
            }
            if (player != null) player.Landed += OnLanded;
        }

        void OnDisable()
        {
            if (interactor != null)
            {
                interactor.Broken -= OnBroken;
                interactor.MiningHit -= OnHit;
            }
            if (player != null) player.Landed -= OnLanded;
        }

        // ------------------------------------------------------------------ emitters

        Color BlockColor(ushort block, float3 at)
        {
            Color c;
            if (BlockId.IsWater(block)) c = new Color(0.75f, 0.85f, 0.9f);
            else
            {
                ushort item = ItemRegistry.ForBlock(block);
                c = icons != null && item != ItemId.None ? icons.AverageColor(item) : new Color(0.5f, 0.5f, 0.5f);
            }
            return Sheltered(at) ? c * 0.35f : c;
        }

        bool Sheltered(float3 p)
        {
            int? top = world.GetHeightmap((int)math.floor(p.x), (int)math.floor(p.z));
            return top.HasValue && top.Value >= p.y;
        }

        void Burst(float3 centre, float3 spread, Color color, int count, float speed, float size, float life)
        {
            var e = new ParticleSystem.EmitParams();
            for (int i = 0; i < count; i++)
            {
                float3 o = new float3(UnityEngine.Random.value - 0.5f, UnityEngine.Random.value - 0.5f, UnityEngine.Random.value - 0.5f);
                e.position = (Vector3)(centre + o * spread);
                e.velocity = (Vector3)(math.normalizesafe(o) * speed * UnityEngine.Random.Range(0.4f, 1f) + new float3(0, speed * 0.8f, 0));
                e.startSize = size * UnityEngine.Random.Range(0.6f, 1.2f);
                e.startLifetime = life * UnityEngine.Random.Range(0.7f, 1.3f);
                e.rotation3D = new Vector3(UnityEngine.Random.value * 360f, UnityEngine.Random.value * 360f, 0f);
                float shade = UnityEngine.Random.Range(0.8f, 1.1f);
                e.startColor = new Color(color.r * shade, color.g * shade, color.b * shade, 1f);
                _debris.Emit(e, 1);
            }
        }

        void OnBroken(int3 cell, ushort block)
        {
            float3 c = (float3)cell + 0.5f;
            Burst(c, new float3(0.8f), BlockColor(block, c), 16, 2.6f, 0.11f, 0.9f);
        }

        void OnHit(int3 cell, ushort block)
        {
            // from the face the player is looking at
            float3 normal = interactor.HasTarget ? (float3)(interactor.Target.Adjacent - interactor.Target.Block) : new float3(0, 1, 0);
            float3 c = (float3)cell + 0.5f + normal * 0.52f;
            Burst(c, new float3(0.5f) * (1f - math.abs(normal)), BlockColor(block, c), 3, 1.6f, 0.06f, 0.5f);
        }

        void OnLanded(float height, bool water)
        {
            if (!water || height < 1f) return;
            float3 feet = player.Body.Position;
            // spray from the surface the player fell through
            float3 at = new float3(feet.x, math.floor(feet.y) + 0.9f, feet.z);
            for (int k = 0; k < 4 && BlockId.IsWater(world.GetBlockOrAir((int3)math.floor(at + new float3(0, 1, 0)))); k++) at.y += 1f;
            int count = (int)math.clamp(height * 5f, 10f, 40f);
            Burst(at, new float3(1.2f, 0.2f, 1.2f), BlockColor(BlockId.Water, at + new float3(0, 2, 0)), count, math.min(1.5f + height * 0.3f, 4.5f), 0.07f, 0.8f);
        }

        static bool IsLeaves(ushort b) => b >= BlockId.OakLeaves && b <= BlockId.JungleLeaves;

        void SpawnLeaves()
        {
            if (player == null || !player.Spawned) return;
            _leafClock += Time.deltaTime * leavesPerSecond;
            float3 eye = player.EyePosition;
            var e = new ParticleSystem.EmitParams();
            float2 wind = environment != null ? (float2)(Vector2)environment.WindDirection * environment.WindStrength * 8f : new float2(0.3f, 0.2f);
            for (; _leafClock >= 1f; _leafClock -= 1f)
            {
                float2 d = (float2)UnityEngine.Random.insideUnitCircle * leafRadius;
                int x = (int)math.floor(eye.x + d.x), z = (int)math.floor(eye.z + d.y);
                int? top = world.GetHeightmap(x, z);
                if (!top.HasValue || math.abs(top.Value - eye.y) > 30f) continue;
                ushort b = world.GetBlockOrAir(new int3(x, top.Value, z));
                if (!IsLeaves(b)) continue;
                float3 at = new float3(x + UnityEngine.Random.value, top.Value - 0.05f, z + UnityEngine.Random.value);
                // the leaf falls from under the lowest leaf block of this canopy column
                for (int k = 0; k < 8 && IsLeaves(world.GetBlockOrAir((int3)math.floor(at - new float3(0, 1, 0)))); k++) at.y -= 1f;
                e.position = (Vector3)at;
                e.velocity = new Vector3(wind.x, -0.7f, wind.y);
                e.startSize = UnityEngine.Random.Range(0.08f, 0.13f);
                e.startLifetime = UnityEngine.Random.Range(6f, 10f);
                e.rotation = UnityEngine.Random.value * 360f;
                var c = BlockColor(b, at) * UnityEngine.Random.Range(0.75f, 1.05f);
                c.a = 1f;
                e.startColor = c;
                _leaves.Emit(e, 1);
            }
        }

        // ------------------------------------------------------------------ frame

        void LateUpdate()
        {
            if (world == null) return;
            SpawnLeaves();
            Settle(_debris, bounce: 0.25f);
            Settle(_leaves, bounce: 0f);
        }

        /// <summary>Particles inside a solid block are put on top of it and lose most of their speed.</summary>
        void Settle(ParticleSystem ps, float bounce)
        {
            int n = ps.GetParticles(_buffer);
            if (n == 0) return;
            bool changed = false;
            for (int i = 0; i < n; i++)
            {
                var p = _buffer[i];
                float3 pos = p.position;
                var cell = (int3)math.floor(pos);
                if (!world.IsSolid(cell)) continue;
                pos.y = cell.y + 1.001f;
                float3 v = p.velocity;
                p.position = (Vector3)pos;
                p.velocity = (Vector3)new float3(v.x * 0.4f, math.abs(v.y) * bounce, v.z * 0.4f);
                // resting leaves fade out sooner
                if (bounce == 0f) p.remainingLifetime = math.min(p.remainingLifetime, 2f);
                _buffer[i] = p;
                changed = true;
            }
            if (changed) ps.SetParticles(_buffer, n);
        }
    }
}
