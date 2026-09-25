using UnityEngine;
using Voxelwild.Player;
using Voxelwild.World;

namespace Voxelwild.Gameplay
{
    /// <summary>
    /// The player's side of the game rules: inventory, health, hunger and breath. In survival, activity costs
    /// hunger, falls and drowning hurt, and blocks come from and go into the inventory. In creative the hotbar holds
    /// the building blocks, nothing is used up, nothing hurts, and flying is allowed.
    /// </summary>
    [DefaultExecutionOrder(10)]
    public sealed class PlayerSurvival : MonoBehaviour
    {
        [SerializeField] PlayerController player;

        public static readonly ushort[] CreativeHotbar =
        {
            BlockId.Cobblestone, BlockId.Stone, BlockId.Dirt, BlockId.Planks, BlockId.Bricks,
            BlockId.OakLog, BlockId.OakLeaves, BlockId.Sandstone, BlockId.Torch,
        };

        public Inventory Inventory { get; } = new Inventory();
        public SurvivalStats Stats { get; } = new SurvivalStats();
        public PlayerController Player => player;
        public GameMode Mode { get; private set; } = GameMode.Creative;
        public bool Creative => Mode == GameMode.Creative;

        bool _configured;

        void Awake()
        {
            // GameSession (which runs first) may already have set the mode and loaded the inventory
            if (!_configured) SetMode(GameMode.Creative, fillCreativeHotbar: true);
            player.Landed += (height, water) => { if (!Creative) Stats.Land(height, water); };
        }

        public void SetMode(GameMode mode, bool fillCreativeHotbar)
        {
            _configured = true;
            Mode = mode;
            player.CanFly = mode == GameMode.Creative;
            if (mode == GameMode.Creative && fillCreativeHotbar)
            {
                Inventory.Clear();
                for (int i = 0; i < CreativeHotbar.Length; i++) Inventory[i] = ItemStack.Of(CreativeHotbar[i], 64);
            }
        }

        void Update()
        {
            if (!player.Spawned) return;
            var (jumps, distance) = player.ConsumeActivity();
            if (Creative) return;
            Stats.Tick(Time.deltaTime, distance, player.Sprinting, jumps, player.HeadInWater);
            // falling out of the world
            if (player.Body.Position.y < VoxelConstants.MinWorldY - 16) Stats.Damage(1000f, DamageCause.Void);
        }

        /// <summary>Uses up one of the held item, unless in creative.</summary>
        public void ConsumeHeld()
        {
            if (!Creative) Inventory.ConsumeHeld();
        }

        /// <summary>Eats the held food if hungry. True when something was eaten.</summary>
        public bool TryEat()
        {
            var held = Inventory.HeldItem;
            if (held.Kind != ItemKind.Food || Stats.Hunger >= SurvivalStats.MaxHunger || Creative) return false;
            Stats.Eat(held.Food, held.Saturation);
            Inventory.ConsumeHeld();
            return true;
        }
    }
}
