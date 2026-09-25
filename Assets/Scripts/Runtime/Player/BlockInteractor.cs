using Unity.Mathematics;
using UnityEngine;
using UnityEngine.InputSystem;
using Voxelwild.World;

namespace Voxelwild.Player
{
    /// <summary>
    /// Targets blocks with a voxel raycast, breaks (LMB) and places (RMB) them, and owns the hotbar
    /// selection (1-9 / scroll). Breaking is instant for now; mining time and tools come with survival.
    /// </summary>
    public sealed class BlockInteractor : MonoBehaviour
    {
        [SerializeField] VoxelWorld world;
        [SerializeField] PlayerController player;
        [SerializeField] SelectionOutline outline;
        [SerializeField] float reach = 6f;
        [SerializeField] float repeatDelay = 0.22f;

        public static readonly ushort[] Hotbar =
        {
            BlockId.Cobblestone, BlockId.Stone, BlockId.Dirt, BlockId.Planks, BlockId.Bricks,
            BlockId.OakLog, BlockId.OakLeaves, BlockId.Sandstone, BlockId.Torch,
        };

        public int SelectedSlot { get; set; }
        public ushort SelectedBlock => Hotbar[SelectedSlot];
        public bool HasTarget { get; private set; }
        public VoxelHit Target { get; private set; }

        float _nextAction;

        void Update()
        {
            if (!player.Spawned) return;
            UpdateTarget();
            if (!player.InputEnabled) return;
            HandleHotbar();
            HandleActions();
        }

        void UpdateTarget()
        {
            var cam = player.CameraPivot;
            HasTarget = VoxelRaycast.Cast(world, cam.position, cam.forward, reach, out var hit)
                        && BlockRegistry.Get(hit.Id).Has(BlockFlags.Breakable);
            Target = hit;
            if (outline != null) outline.Show(HasTarget, hit.Block);
        }

        void HandleHotbar()
        {
            var kb = Keyboard.current;
            if (kb != null)
            {
                for (int i = 0; i < Hotbar.Length; i++)
                    if (kb[Key.Digit1 + i].wasPressedThisFrame) SelectedSlot = i;
            }
            var mouse = Mouse.current;
            if (mouse != null)
            {
                float scroll = mouse.scroll.ReadValue().y;
                if (scroll > 0.1f) SelectedSlot = (SelectedSlot + Hotbar.Length - 1) % Hotbar.Length;
                else if (scroll < -0.1f) SelectedSlot = (SelectedSlot + 1) % Hotbar.Length;
            }
        }

        void HandleActions()
        {
            var mouse = Mouse.current;
            if (mouse == null || Cursor.lockState != CursorLockMode.Locked || !HasTarget) return;

            bool breakPressed = mouse.leftButton.wasPressedThisFrame;
            bool placePressed = mouse.rightButton.wasPressedThisFrame;
            bool repeat = Time.time >= _nextAction;
            if (breakPressed || (mouse.leftButton.isPressed && repeat))
            {
                TryBreak(Target.Block);
                _nextAction = Time.time + repeatDelay;
            }
            else if (placePressed || (mouse.rightButton.isPressed && repeat))
            {
                TryPlace(Target.Adjacent, SelectedBlock);
                _nextAction = Time.time + repeatDelay;
            }
        }

        public bool TryBreak(int3 block)
        {
            if (!world.TryGetBlock(block, out var id) || !BlockRegistry.Get(id).Has(BlockFlags.Breakable)) return false;
            // neighbouring water flows into the hole through the water simulation
            if (!world.SetBlock(block, BlockId.Air)) return false;
            // plants and torches standing on the broken block drop with it
            var above = block + new int3(0, 1, 0);
            if (world.TryGetBlock(above, out var up) && BlockRegistry.Get(up).Has(BlockFlags.NeedsSupport))
                world.SetBlock(above, BlockId.Air);
            return true;
        }

        public bool TryPlace(int3 cell, ushort block)
        {
            if (!world.TryGetBlock(cell, out var existing) || !BlockRegistry.Get(existing).Has(BlockFlags.Replaceable)) return false;
            var def = BlockRegistry.Get(block);
            if (def.Has(BlockFlags.Solid) && player.Body.Overlaps(cell)) return false;
            if (def.Has(BlockFlags.NeedsSupport))
            {
                if (!world.TryGetBlock(cell - new int3(0, 1, 0), out var below) || !BlockRegistry.Get(below).Has(BlockFlags.Opaque)) return false;
                if (BlockId.IsWater(existing)) return false;
            }
            return world.SetBlock(cell, block);
        }
    }
}
