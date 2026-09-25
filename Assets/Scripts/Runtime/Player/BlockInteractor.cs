using Unity.Mathematics;
using UnityEngine;
using UnityEngine.InputSystem;
using Voxelwild.World;

namespace Voxelwild.Player
{
    /// <summary>
    /// Targets blocks with a voxel raycast and acts on them. Creative: LMB breaks instantly, RMB places the held
    /// block, nothing runs out. Survival: holding LMB mines for as long as the block and held tool take
    /// (Gameplay/Mining), then drops what the block yields and wears the tool; RMB places a block from the
    /// inventory or eats held food. The hotbar (1–9 / scroll) selects inventory slots.
    /// TryBreak / TryPlace are the raw world edits (tests and tools use them directly).
    /// </summary>
    public sealed class BlockInteractor : MonoBehaviour
    {
        [SerializeField] VoxelWorld world;
        [SerializeField] PlayerController player;
        [SerializeField] SelectionOutline outline;
        [SerializeField] Gameplay.PlayerSurvival survival;
        [SerializeField] Gameplay.ItemEntities items;
        [SerializeField] float reach = 6f;
        [SerializeField] float repeatDelay = 0.22f;

        /// <summary>Creative hotbar (kept for tools that don't have a PlayerSurvival).</summary>
        public static ushort[] Hotbar => Gameplay.PlayerSurvival.CreativeHotbar;

        public int SelectedSlot
        {
            get => survival != null ? survival.Inventory.Selected : _slot;
            set { if (survival != null) survival.Inventory.Selected = value; else _slot = value; }
        }
        /// <summary>The block the held item places (Air when the held item isn't a block).</summary>
        public ushort SelectedBlock => survival != null
            ? survival.Inventory.HeldItem.Kind == Gameplay.ItemKind.Block ? survival.Inventory.HeldItem.Block : BlockId.Air
            : Hotbar[_slot];
        public bool HasTarget { get; private set; }
        public VoxelHit Target { get; private set; }
        /// <summary>0..1 progress of the block being mined (survival).</summary>
        public float MiningProgress { get; private set; }

        float _nextAction;
        int _slot;
        int3 _miningBlock = new int3(int.MinValue);

        bool Creative => survival == null || survival.Creative;

        void Update()
        {
            if (!player.Spawned) return;
            UpdateTarget();
            if (!player.InputEnabled) { MiningProgress = 0f; return; }
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
                for (int i = 0; i < 9; i++)
                    if (kb[Key.Digit1 + i].wasPressedThisFrame) SelectedSlot = i;
            }
            var mouse = Mouse.current;
            if (mouse != null)
            {
                float scroll = mouse.scroll.ReadValue().y;
                if (scroll > 0.1f) SelectedSlot = (SelectedSlot + 8) % 9;
                else if (scroll < -0.1f) SelectedSlot = (SelectedSlot + 1) % 9;
            }
        }

        void HandleActions()
        {
            var mouse = Mouse.current;
            if (mouse == null || Cursor.lockState != CursorLockMode.Locked) { MiningProgress = 0f; return; }

            bool repeat = Time.time >= _nextAction;
            if (mouse.rightButton.wasPressedThisFrame || (mouse.rightButton.isPressed && repeat))
            {
                _nextAction = Time.time + repeatDelay;
                if (survival != null && survival.TryEat()) return;
                ushort block = SelectedBlock;
                if (HasTarget && block != BlockId.Air && TryPlace(Target.Adjacent, block) && survival != null) survival.ConsumeHeld();
                return;
            }

            if (!mouse.leftButton.isPressed || !HasTarget)
            {
                MiningProgress = 0f;
                _miningBlock = new int3(int.MinValue);
                return;
            }
            if (Creative)
            {
                if (mouse.leftButton.wasPressedThisFrame || repeat)
                {
                    TryBreak(Target.Block);
                    _nextAction = Time.time + repeatDelay;
                }
                return;
            }

            // survival: mine over time; switching target starts over
            if (!Target.Block.Equals(_miningBlock))
            {
                _miningBlock = Target.Block;
                MiningProgress = 0f;
            }
            if (!repeat) return;
            float seconds = Gameplay.Mining.BreakSeconds(Target.Id, survival.Inventory.HeldItem);
            if (float.IsPositiveInfinity(seconds)) return;
            MiningProgress += seconds <= 0f ? 1f : Time.deltaTime / seconds;
            if (MiningProgress < 1f) return;
            BreakAndDrop(Target.Block, Target.Id);
            MiningProgress = 0f;
            _miningBlock = new int3(int.MinValue);
            _nextAction = Time.time + 0.15f;
        }

        /// <summary>Survival break: drops what the block (and anything standing on it) yields, wears the tool.</summary>
        void BreakAndDrop(int3 block, ushort id)
        {
            var held = survival.Inventory.HeldItem;
            var above = block + new int3(0, 1, 0);
            ushort up = world.GetBlockOrAir(above);
            bool upFalls = BlockRegistry.Get(up).Has(BlockFlags.NeedsSupport);
            if (!TryBreak(block)) return;
            Drop(Gameplay.Drops.For(id, held, UnityEngine.Random.value), block);
            if (upFalls) Drop(Gameplay.Drops.For(up, default, UnityEngine.Random.value), above);
            var mining = Gameplay.Mining.For(id);
            if (held.Kind == Gameplay.ItemKind.Tool && mining.Hardness > 0f) survival.Inventory.WearHeld();
            survival.Stats.AddExhaustion(0.005f);
        }

        void Drop(Gameplay.ItemStack stack, int3 cell)
        {
            if (stack.IsEmpty) return;
            if (items != null)
                items.Spawn(stack, (float3)cell + new float3(0.5f, 0.3f, 0.5f), new float3(UnityEngine.Random.Range(-1f, 1f), 3f, UnityEngine.Random.Range(-1f, 1f)));
            else survival.Inventory.Add(stack);
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
