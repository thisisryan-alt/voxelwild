using Unity.Mathematics;
using UnityEngine;
using UnityEngine.InputSystem;
using Voxelwild.World;

namespace Voxelwild.Player
{
    /// <summary>
    /// First-person controller on top of <see cref="VoxelBody"/>: walking, sprinting, jumping,
    /// swimming and a fly mode. Waits for the terrain around the spawn point before enabling physics.
    /// </summary>
    public sealed class PlayerController : MonoBehaviour
    {
        [SerializeField] VoxelWorld world;
        [SerializeField] Transform cameraPivot;

        [Header("Movement")]
        [SerializeField] float walkSpeed = 4.3f;
        [SerializeField] float sprintSpeed = 6.4f;
        [SerializeField] float flySpeed = 14f;
        [SerializeField] float jumpHeight = 1.25f;
        [SerializeField] float gravity = 30f;
        [SerializeField] float groundAcceleration = 18f;
        [SerializeField] float airAcceleration = 3.5f;
        [SerializeField] float eyeHeight = 1.62f;

        [Header("Look")]
        [SerializeField] float mouseSensitivity = 0.09f;

        public VoxelBody Body { get; } = new VoxelBody();
        public bool Flying { get; set; }
        public bool Spawned { get; private set; }
        public bool InWater { get; private set; }
        public bool HeadInWater { get; private set; }
        /// <summary>External code (capture tool, cutscenes) can take over the camera.</summary>
        public bool InputEnabled { get; set; } = true;

        public float Yaw { get; private set; }
        public float Pitch { get; private set; }
        public Transform CameraPivot => cameraPivot;

        /// <summary>Where to appear instead of the generated spawn point (a loaded save); set before Start.</summary>
        public float3? SpawnOverride { get; set; }
        public float2 SpawnLook { get; set; }
        /// <summary>Creative allows flying (F, double-tap space); survival doesn't.</summary>
        public bool CanFly { get; set; } = true;
        public bool Sprinting { get; private set; }
        /// <summary>Jumps and horizontal metres travelled since the last <see cref="ConsumeActivity"/> (hunger).</summary>
        public int Jumps { get; private set; }
        public float Distance { get; private set; }
        /// <summary>Raised on landing: fall height in blocks, and whether the landing was in water.</summary>
        public event System.Action<float, bool> Landed;

        float _fallStart = float.NaN;

        public (int jumps, float distance) ConsumeActivity()
        {
            var r = (Jumps, Distance);
            Jumps = 0;
            Distance = 0f;
            return r;
        }
        public float3 EyePosition => Body.Position + new float3(0, eyeHeight, 0);

        float _lastSpaceTap = -1f;

        void Start()
        {
            Body.Position = SpawnOverride ?? world.FindSpawnPoint();
            if (SpawnOverride.HasValue) { Yaw = SpawnLook.x; Pitch = SpawnLook.y; }
            world.Viewer = transform;
            SyncTransform();
        }

        void Update()
        {
            if (!Spawned)
            {
                if (!world.IsAreaReady(Body.Position, 1)) return;
                Spawned = true;
                SettleOnGround();
            }

            float dt = math.min(Time.deltaTime, 0.05f);
            if (InputEnabled)
            {
                HandleCursor();
                if (Cursor.lockState == CursorLockMode.Locked) Look();
                Move(dt);
            }
            SyncTransform();
        }

        public void Teleport(float3 feet, float yaw, float pitch)
        {
            Body.Position = feet;
            Body.Velocity = 0;
            Yaw = yaw;
            Pitch = math.clamp(pitch, -89.5f, 89.5f);
            SyncTransform();
        }

        void SettleOnGround()
        {
            // The spawn point comes from the height function; push up out of anything solid.
            for (int i = 0; i < 64 && world.IsSolid((int3)math.floor(Body.Position + new float3(0, 0.1f, 0))); i++)
                Body.Position.y = math.floor(Body.Position.y) + 1.001f;
        }

        void HandleCursor()
        {
            var mouse = Mouse.current;
            var kb = Keyboard.current;
            if (kb != null && kb.escapeKey.wasPressedThisFrame) Cursor.lockState = CursorLockMode.None;
            else if (mouse != null && mouse.leftButton.wasPressedThisFrame && Cursor.lockState != CursorLockMode.Locked)
                Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = Cursor.lockState != CursorLockMode.Locked;
        }

        void Look()
        {
            var mouse = Mouse.current;
            if (mouse == null) return;
            Vector2 d = mouse.delta.ReadValue() * mouseSensitivity;
            Yaw = (Yaw + d.x) % 360f;
            Pitch = math.clamp(Pitch - d.y, -89.5f, 89.5f);
        }

        void Move(float dt)
        {
            var kb = Keyboard.current;
            float2 input = 0;
            bool jump = false, sprint = false, descend = false;
            if (kb != null)
            {
                input.y = (kb.wKey.isPressed ? 1 : 0) - (kb.sKey.isPressed ? 1 : 0);
                input.x = (kb.dKey.isPressed ? 1 : 0) - (kb.aKey.isPressed ? 1 : 0);
                jump = kb.spaceKey.isPressed;
                sprint = kb.leftCtrlKey.isPressed;
                descend = kb.leftShiftKey.isPressed;

                if (CanFly && kb.fKey.wasPressedThisFrame) Flying = !Flying;
                if (kb.spaceKey.wasPressedThisFrame)
                {
                    if (CanFly && Time.unscaledTime - _lastSpaceTap < 0.3f) Flying = !Flying;
                    _lastSpaceTap = Time.unscaledTime;
                }
            }
            if (math.lengthsq(input) > 1) input = math.normalize(input);

            float yawRad = math.radians(Yaw);
            float3 forward = new float3(math.sin(yawRad), 0, math.cos(yawRad));
            float3 right = new float3(forward.z, 0, -forward.x);
            float3 wish = forward * input.y + right * input.x;

            var feetBlock = world.GetBlockOrAir((int3)math.floor(Body.Position + new float3(0, 0.4f, 0)));
            var eyeBlock = world.GetBlockOrAir((int3)math.floor(EyePosition));
            InWater = BlockRegistry.Get(feetBlock).Has(BlockFlags.Liquid);
            HeadInWater = BlockRegistry.Get(eyeBlock).Has(BlockFlags.Liquid);

            ref float3 v = ref Body.Velocity;
            if (Flying)
            {
                float speed = flySpeed * (sprint ? 2f : 1f);
                float3 target = wish * speed + new float3(0, (jump ? 1 : 0) - (descend ? 1 : 0), 0) * speed * 0.7f;
                v = math.lerp(v, target, 1f - math.exp(-10f * dt));
            }
            else if (InWater)
            {
                float speed = walkSpeed * 0.55f;
                float3 target = wish * speed;
                float k = 1f - math.exp(-6f * dt);
                v.x = math.lerp(v.x, target.x, k);
                v.z = math.lerp(v.z, target.z, k);
                v.y -= gravity * 0.18f * dt;
                if (jump) v.y += 16f * dt;
                v.y = math.clamp(v.y * math.exp(-2.5f * dt), -3f, 3.2f);
            }
            else
            {
                bool grounded = Body.ProbeGround(world);
                float speed = sprint ? sprintSpeed : walkSpeed;
                float accel = grounded ? groundAcceleration : airAcceleration;
                float k = 1f - math.exp(-accel * dt);
                v.x = math.lerp(v.x, wish.x * speed, k);
                v.z = math.lerp(v.z, wish.z * speed, k);
                if (grounded && jump && v.y <= 0.01f) { v.y = math.sqrt(2f * gravity * jumpHeight); Jumps++; }
                v.y = math.max(v.y - gravity * dt, -60f);
            }
            if (!CanFly) Flying = false;
            Sprinting = sprint && math.lengthsq(input) > 0 && !Flying;

            float3 before = Body.Position;
            Body.Move(world, v * dt);
            Distance += math.length((Body.Position - before).xz);
            if (Flying && Body.Grounded && !jump) Flying = false;   // landing ends flight
            TrackFall();
        }

        /// <summary>Measures falls from the highest point since leaving the ground; water and flight cancel them.</summary>
        void TrackFall()
        {
            if (Flying || InWater)
            {
                if (!float.IsNaN(_fallStart) && InWater) Landed?.Invoke(_fallStart - Body.Position.y, true);
                _fallStart = float.NaN;
                return;
            }
            if (Body.Grounded)
            {
                if (!float.IsNaN(_fallStart)) Landed?.Invoke(_fallStart - Body.Position.y, false);
                _fallStart = float.NaN;
            }
            else _fallStart = float.IsNaN(_fallStart) ? Body.Position.y : math.max(_fallStart, Body.Position.y);
        }

        /// <summary>Back to a spawn point after death.</summary>
        public void Respawn(float3 feet)
        {
            Teleport(feet, Yaw, 0f);
            Flying = false;
            _fallStart = float.NaN;
        }

        void SyncTransform()
        {
            transform.SetPositionAndRotation(Body.Position, Quaternion.Euler(0, Yaw, 0));
            if (cameraPivot != null)
            {
                cameraPivot.localPosition = new Vector3(0, eyeHeight, 0);
                cameraPivot.localRotation = Quaternion.Euler(Pitch, 0, 0);
            }
        }
    }
}
